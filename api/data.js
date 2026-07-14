/**
 * /api/data — consolidated data handler
 * Routes:
 *   GET/POST        /api/files
 *   GET/DELETE      /api/files/:id
 *   GET/POST        /api/categories
 *   PUT/DELETE      /api/categories/:id
 *   GET/POST        /api/merchant-rules
 */
import { getDb }             from "./lib/db.js";
import { getUser }           from "./lib/jwt.js";
import { requireCsrf }       from "./lib/csrf.js";
import { withErrorHandling } from "./lib/http.js";
import { checkRateLimit }    from "./lib/ratelimit.js";
import {
  validateTransactionsArray,
  isValidFileName,
  isValidStatementType,
  isValidCategoryName,
  isValidMerchantName,
  sanitizeCsvField,
} from "./lib/validation.js";
import { ObjectId }          from "mongodb";
import crypto                from "crypto";

// ── helpers ───────────────────────────────────────────────────────────────────

function pathId(req) {
  return req.url.split("?")[0].split("/").filter(Boolean).pop();
}

/**
 * Every limit below is keyed per-user (not per-IP): these are all
 * authenticated, already-CSRF-protected routes, so the threat is a
 * compromised/scripted account hammering the DB, not anonymous abuse.
 * Reads are capped high (cheap, indexed queries); writes are capped lower,
 * scaled to realistic worst-case legitimate usage — see inline rationale at
 * each call site and docs/security/threat-model.md.
 */
function rateLimited(res, user, action, windowMs, max) {
  const limit = checkRateLimit(`${action}:${user.userId}`, windowMs, max);
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    res.status(429).json({ error: "Too many requests. Please slow down." });
    return false;
  }
  return true;
}

/** SHA-256 over the sanitized transaction set — used to detect re-uploading the same statement twice. */
function contentHash(transactions) {
  return crypto.createHash("sha256").update(JSON.stringify(transactions)).digest("hex");
}

// ── files ─────────────────────────────────────────────────────────────────────

async function filesCollection(req, res) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const db = await getDb();

  if (req.method === "GET") {
    // 120/15min: a cheap, indexed, own-data-only read — capped generously
    // just to bound scripted polling, not normal UI usage.
    if (!rateLimited(res, user, "files:list", 15 * 60_000, 120)) return;
    const files = await db.collection("uploaded_files")
      .find({ userId: user.userId })
      .project({ transactions: 0 })
      .sort({ uploadedAt: -1 })
      .limit(20)
      .toArray();
    return res.json(files);
  }

  if (req.method === "POST") {
    if (!requireCsrf(req, res)) return;
    // 20/15min: uploading a statement is a deliberate, occasional user
    // action (not something the UI ever does automatically) that writes an
    // embedded array of up to 10,000 transactions — generous enough for a
    // power user importing several months of statements back-to-back, tight
    // enough to bound worst-case write volume from a compromised account.
    if (!rateLimited(res, user, "files:create", 15 * 60_000, 20)) return;

    const { fileName, statementType, transactions } = req.body || {};
    if (!isValidFileName(fileName))
      return res.status(400).json({ error: "fileName is required and must be under 255 characters." });
    if (statementType !== undefined && !isValidStatementType(statementType))
      return res.status(400).json({ error: "Invalid statementType." });

    const txnResult = validateTransactionsArray(transactions);
    if (!txnResult.valid) return res.status(400).json({ error: txnResult.error });

    const hash = contentHash(txnResult.sanitized);
    const existing = await db.collection("uploaded_files").findOne(
      { userId: user.userId, contentHash: hash },
      { projection: { _id: 1 } }
    );
    if (existing) return res.status(409).json({ error: "This statement has already been uploaded." });

    const doc = {
      userId:           user.userId,
      fileName:         sanitizeCsvField(fileName),
      statementType:    statementType || "unknown",
      transactionCount: txnResult.sanitized.length,
      contentHash:      hash,
      uploadedAt:       new Date(),
      transactions:     txnResult.sanitized,
    };
    try {
      const result = await db.collection("uploaded_files").insertOne(doc);
      const { transactions: _t, ...meta } = doc;
      return res.status(201).json({ ...meta, _id: result.insertedId });
    } catch (err) {
      // Unique index catches the race the pre-check above can't (two
      // simultaneous uploads of the same statement).
      if (err.code === 11000) return res.status(409).json({ error: "This statement has already been uploaded." });
      throw err;
    }
  }

  res.status(405).end();
}

async function fileById(req, res) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const id = pathId(req);
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });

  const db     = await getDb();
  const filter = { _id: new ObjectId(id), userId: user.userId };

  if (req.method === "GET") {
    if (!rateLimited(res, user, "files:get", 15 * 60_000, 120)) return;
    const file = await db.collection("uploaded_files").findOne(filter);
    if (!file) return res.status(404).json({ error: "Not found" });
    return res.json(file);
  }

  if (req.method === "DELETE") {
    if (!requireCsrf(req, res)) return;
    if (!rateLimited(res, user, "files:delete", 15 * 60_000, 30)) return;
    await db.collection("uploaded_files").deleteOne(filter);
    return res.json({ ok: true });
  }

  res.status(405).end();
}

// ── categories ────────────────────────────────────────────────────────────────

async function categoriesCollection(req, res) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const db = await getDb();

  if (req.method === "GET") {
    if (!rateLimited(res, user, "categories:list", 15 * 60_000, 120)) return;
    const cats = await db.collection("custom_categories")
      .find({ userId: user.userId })
      .sort({ createdAt: 1 })
      .toArray();
    return res.json(cats);
  }

  if (req.method === "POST") {
    if (!requireCsrf(req, res)) return;
    if (!rateLimited(res, user, "categories:create", 15 * 60_000, 30)) return;
    const { categoryName, icon, color, keywords } = req.body || {};
    if (!isValidCategoryName(categoryName))
      return res.status(400).json({ error: "Category name required and must be under 100 characters." });
    const trimmedName = sanitizeCsvField(categoryName.trim());

    // Case-insensitive exact match via the index's collation — replaces an
    // unescaped-regex check (a user-typed name containing regex metacharacters
    // like "." or "+" could previously produce false duplicate matches).
    const existing = await db.collection("custom_categories").findOne(
      { userId: user.userId, categoryName: trimmedName },
      { collation: { locale: "en", strength: 2 } }
    );
    if (existing) return res.status(409).json({ error: "Category already exists" });

    const doc = {
      userId:       user.userId,
      categoryName: trimmedName,
      icon:         icon  || "🏷️",
      color:        color || "#6f7a72",
      keywords:     Array.isArray(keywords) ? keywords : [],
      createdAt:    new Date(),
    };
    try {
      const result = await db.collection("custom_categories").insertOne(doc);
      return res.status(201).json({ ...doc, _id: result.insertedId });
    } catch (err) {
      // Unique index catches the race the pre-check above can't (two
      // simultaneous requests for the same name).
      if (err.code === 11000) return res.status(409).json({ error: "Category already exists" });
      throw err;
    }
  }

  res.status(405).end();
}

async function categoryById(req, res) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const id = pathId(req);
  if (!id || !ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });

  const db     = await getDb();
  const filter = { _id: new ObjectId(id), userId: user.userId };

  if (req.method === "PUT") {
    if (!requireCsrf(req, res)) return;
    if (!rateLimited(res, user, "categories:update", 15 * 60_000, 60)) return;
    const { categoryName, icon, color, keywords } = req.body || {};
    if (categoryName !== undefined && !isValidCategoryName(categoryName))
      return res.status(400).json({ error: "Category name must be under 100 characters." });

    const update = {};
    if (categoryName !== undefined) update.categoryName = sanitizeCsvField(categoryName.trim());
    if (icon      !== undefined)    update.icon         = icon;
    if (color     !== undefined)    update.color        = color;
    if (keywords  !== undefined)    update.keywords     = Array.isArray(keywords) ? keywords : [];
    update.updatedAt = new Date();

    const result = await db.collection("custom_categories").updateOne(filter, { $set: update });
    if (result.matchedCount === 0) return res.status(404).json({ error: "Category not found" });
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (!requireCsrf(req, res)) return;
    if (!rateLimited(res, user, "categories:delete", 15 * 60_000, 60)) return;
    await db.collection("custom_categories").deleteOne(filter);
    return res.json({ ok: true });
  }

  res.status(405).end();
}

// ── merchant-rules ────────────────────────────────────────────────────────────

async function merchantRules(req, res) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const db = await getDb();

  if (req.method === "GET") {
    if (!rateLimited(res, user, "merchant-rules:list", 15 * 60_000, 120)) return;
    const rules = await db.collection("merchant_category_rules")
      .find({ userId: user.userId })
      .toArray();
    return res.json(rules);
  }

  if (req.method === "POST") {
    if (!requireCsrf(req, res)) return;
    // 100/15min: the UI calls this once per manual transaction recategorization
    // (see App.jsx) — a user reviewing a large statement can trigger many of
    // these in one sitting, so the cap is set well above realistic manual use.
    if (!rateLimited(res, user, "merchant-rules:create", 15 * 60_000, 100)) return;
    const { merchantName, category } = req.body || {};
    if (!isValidMerchantName(merchantName))
      return res.status(400).json({ error: "merchantName is required and must be under 255 characters." });
    if (!isValidCategoryName(category))
      return res.status(400).json({ error: "category is required and must be under 100 characters." });

    await db.collection("merchant_category_rules").updateOne(
      { userId: user.userId, merchantName: sanitizeCsvField(merchantName) },
      {
        $set:         { category: sanitizeCsvField(category), updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    return res.json({ ok: true });
  }

  res.status(405).end();
}

// ── router ────────────────────────────────────────────────────────────────────

export default withErrorHandling(async function handler(req, res) {
  const path = req.url.split("?")[0];

  // files
  if (path === "/api/files")        return filesCollection(req, res);
  if (path.startsWith("/api/files/")) return fileById(req, res);

  // categories
  if (path === "/api/categories")          return categoriesCollection(req, res);
  if (path.startsWith("/api/categories/")) return categoryById(req, res);

  // merchant-rules
  if (path === "/api/merchant-rules") return merchantRules(req, res);

  res.status(404).json({ error: "Not found" });
});
