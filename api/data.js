/**
 * /api/data — consolidated data handler
 * Routes:
 *   GET/POST        /api/files
 *   GET/DELETE      /api/files/:id
 *   GET/POST        /api/categories
 *   PUT/DELETE      /api/categories/:id
 *   GET/POST        /api/merchant-rules
 */
import { getDb }     from "./lib/db.js";
import { getUser }   from "./lib/auth.js";
import { ObjectId }  from "mongodb";

// ── helpers ───────────────────────────────────────────────────────────────────

function pathId(req) {
  return req.url.split("?")[0].split("/").filter(Boolean).pop();
}

// ── files ─────────────────────────────────────────────────────────────────────

async function filesCollection(req, res) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const db = await getDb();

  if (req.method === "GET") {
    const files = await db.collection("uploaded_files")
      .find({ userId: user.userId })
      .project({ transactions: 0 })
      .sort({ uploadedAt: -1 })
      .limit(20)
      .toArray();
    return res.json(files);
  }

  if (req.method === "POST") {
    const { fileName, statementType, transactions } = req.body || {};
    if (!fileName || !Array.isArray(transactions))
      return res.status(400).json({ error: "fileName and transactions required" });
    if (transactions.length > 10000)
      return res.status(400).json({ error: "Statement exceeds maximum of 10,000 transactions." });

    const doc = {
      userId:           user.userId,
      fileName,
      statementType:    statementType || "unknown",
      transactionCount: transactions.length,
      uploadedAt:       new Date(),
      transactions,
    };
    const result = await db.collection("uploaded_files").insertOne(doc);
    const { transactions: _t, ...meta } = doc;
    return res.status(201).json({ ...meta, _id: result.insertedId });
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
    const file = await db.collection("uploaded_files").findOne(filter);
    if (!file) return res.status(404).json({ error: "Not found" });
    return res.json(file);
  }

  if (req.method === "DELETE") {
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
    const cats = await db.collection("custom_categories")
      .find({ userId: user.userId })
      .sort({ createdAt: 1 })
      .toArray();
    return res.json(cats);
  }

  if (req.method === "POST") {
    const { categoryName, icon, color, keywords } = req.body || {};
    if (!categoryName?.trim()) return res.status(400).json({ error: "Category name required" });

    const existing = await db.collection("custom_categories").findOne({
      userId:       user.userId,
      categoryName: { $regex: new RegExp(`^${categoryName.trim()}$`, "i") },
    });
    if (existing) return res.status(409).json({ error: "Category already exists" });

    const doc = {
      userId:       user.userId,
      categoryName: categoryName.trim(),
      icon:         icon  || "🏷️",
      color:        color || "#6f7a72",
      keywords:     Array.isArray(keywords) ? keywords : [],
      createdAt:    new Date(),
    };
    const result = await db.collection("custom_categories").insertOne(doc);
    return res.status(201).json({ ...doc, _id: result.insertedId });
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
    const { categoryName, icon, color, keywords } = req.body || {};
    const update = {};
    if (categoryName !== undefined) update.categoryName = categoryName.trim();
    if (icon      !== undefined)    update.icon         = icon;
    if (color     !== undefined)    update.color        = color;
    if (keywords  !== undefined)    update.keywords     = Array.isArray(keywords) ? keywords : [];
    update.updatedAt = new Date();

    const result = await db.collection("custom_categories").updateOne(filter, { $set: update });
    if (result.matchedCount === 0) return res.status(404).json({ error: "Category not found" });
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
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
    const rules = await db.collection("merchant_category_rules")
      .find({ userId: user.userId })
      .toArray();
    return res.json(rules);
  }

  if (req.method === "POST") {
    const { merchantName, category } = req.body || {};
    if (!merchantName || !category)
      return res.status(400).json({ error: "merchantName and category required" });

    await db.collection("merchant_category_rules").updateOne(
      { userId: user.userId, merchantName },
      {
        $set:         { category, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    return res.json({ ok: true });
  }

  res.status(405).end();
}

// ── router ────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
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
}
