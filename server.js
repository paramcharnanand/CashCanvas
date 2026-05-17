/**
 * Local development API server — mirrors the Vercel /api routes.
 * Run alongside Vite: `npm run dev:full`
 */
import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const JWT_SECRET = process.env.JWT_SECRET || "cashcanvas-dev-secret-change-in-prod";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

let _db;
async function getDb() {
  if (!_db) {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    _db = client.db("cashcanvas");
    console.log("Connected to MongoDB");
  }
  return _db;
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function getUser(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(auth.slice(7), JWT_SECRET);
  } catch {
    return null;
  }
}

// ── AUTH ──────────────────────────────────────────────────────────────────────

app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: "Name, email and password are required" });
  if (password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters" });

  try {
    const db = await getDb();
    const existing = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.collection("users").insertOne({
      name,
      email: email.toLowerCase(),
      passwordHash,
      createdAt: new Date(),
    });

    const token = signToken({ userId: result.insertedId.toString(), email: email.toLowerCase(), name });
    res.status(201).json({ token, user: { name, email: email.toLowerCase() } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });

  try {
    const db = await getDb();
    const user = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    const token = signToken({ userId: user._id.toString(), email: user.email, name: user.name });
    res.json({ token, user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/auth/profile", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  res.json({ name: user.name, email: user.email });
});

// ── CUSTOM CATEGORIES ─────────────────────────────────────────────────────────

app.get("/api/categories", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const db = await getDb();
  const cats = await db.collection("custom_categories")
    .find({ userId: user.userId })
    .sort({ createdAt: 1 })
    .toArray();
  res.json(cats);
});

app.post("/api/categories", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const { categoryName, icon, color, keywords } = req.body || {};
  if (!categoryName?.trim()) return res.status(400).json({ error: "Category name required" });

  try {
    const db = await getDb();
    const existing = await db.collection("custom_categories").findOne({
      userId: user.userId,
      categoryName: { $regex: new RegExp(`^${categoryName.trim()}$`, "i") },
    });
    if (existing) return res.status(409).json({ error: "Category already exists" });

    const doc = {
      userId: user.userId,
      categoryName: categoryName.trim(),
      icon: icon || "🏷️",
      color: color || "#6f7a72",
      keywords: Array.isArray(keywords) ? keywords : [],
      createdAt: new Date(),
    };
    const result = await db.collection("custom_categories").insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/categories/:id", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });

  const { categoryName, icon, color, keywords } = req.body || {};
  const update = {};
  if (categoryName !== undefined) update.categoryName = categoryName.trim();
  if (icon !== undefined) update.icon = icon;
  if (color !== undefined) update.color = color;
  if (keywords !== undefined) update.keywords = Array.isArray(keywords) ? keywords : [];
  update.updatedAt = new Date();

  const db = await getDb();
  await db.collection("custom_categories").updateOne(
    { _id: new ObjectId(id), userId: user.userId },
    { $set: update }
  );
  res.json({ ok: true });
});

app.delete("/api/categories/:id", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });

  const db = await getDb();
  await db.collection("custom_categories").deleteOne({
    _id: new ObjectId(id),
    userId: user.userId,
  });
  res.json({ ok: true });
});

// ── MERCHANT RULES ────────────────────────────────────────────────────────────

app.get("/api/merchant-rules", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const db = await getDb();
  const rules = await db.collection("merchant_category_rules")
    .find({ userId: user.userId })
    .toArray();
  res.json(rules);
});

app.post("/api/merchant-rules", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const { merchantName, category } = req.body || {};
  if (!merchantName || !category)
    return res.status(400).json({ error: "merchantName and category required" });

  const db = await getDb();
  await db.collection("merchant_category_rules").updateOne(
    { userId: user.userId, merchantName },
    { $set: { category, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
  res.json({ ok: true });
});

// ── AI CATEGORIZATION ─────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set([
  "Housing", "Groceries", "Dining", "Transport", "Subscriptions",
  "Utilities", "Shopping", "Health", "Entertainment", "Income", "Other",
]);

app.post("/api/categorize", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { transactions } = req.body || {};
  if (!Array.isArray(transactions) || transactions.length === 0)
    return res.json({ results: [] });

  if (!ANTHROPIC_API_KEY) {
    return res.json({ results: [], warning: "ANTHROPIC_API_KEY not configured" });
  }

  const batch = transactions.slice(0, 100);
  const descriptions = batch
    .map((t, i) => `${i + 1}. "${t.desc}" ($${Math.abs(t.amount || 0).toFixed(2)})`)
    .join("\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: `You are an expert bank transaction categorizer. Assign each transaction to exactly one category based on the merchant name and amount.

Categories and what belongs in each:
- Housing: rent, mortgage, HOA fees, storage units, renters/homeowners insurance
- Groceries: supermarkets, grocery stores, Instacart, Amazon Fresh, wholesale clubs (Costco)
- Dining: restaurants, cafes, coffee shops, fast food, food delivery (DoorDash, Uber Eats, Grubhub)
- Transport: Uber/Lyft rides, gas stations, parking, tolls, public transit, airlines, car rentals, car maintenance
- Subscriptions: streaming services (Netflix, Spotify, Hulu), gym memberships, SaaS tools, cloud storage, news subscriptions
- Utilities: electricity, water, gas, internet, phone/cell bills, trash collection
- Shopping: Amazon, retail stores, clothing, electronics, home goods, online marketplaces
- Health: pharmacies (CVS, Walgreens), doctors, dentists, hospitals, health insurance, prescriptions
- Entertainment: movie theaters, concerts, sports tickets, gaming, bowling, amusement parks
- Income: payroll deposits, refunds, reimbursements, interest, dividends, transfers in
- Other: transfers, ATM withdrawals, fees, or anything unclear

Bank statements often abbreviate merchant names. Common patterns:
- AMZN/AMAZON MKTP = Shopping
- SQ * prefix = Square POS (look at the rest of the name)
- TST* prefix = Toast restaurant POS = Dining
- APL*/APPLE.COM = likely Subscriptions
- WFM/WHOLEFDS = Whole Foods = Groceries
- UBER EATS/DOORDASH = Dining, not Transport`,
        messages: [
          {
            role: "user",
            content: `Categorize each transaction. Reply with ONLY the line number and category, one per line.\nFormat: "1. Dining"\n\n${descriptions}`,
          },
        ],
      }),
    });

    if (!response.ok) return res.json({ results: [] });

    const data = await response.json();
    const text = (data.content || []).map((b) => b.text || "").join("");

    const results = text
      .trim()
      .split("\n")
      .map((line) => {
        const m = line.match(/^(\d+)\.\s+(.+)$/);
        if (!m) return null;
        const idx = parseInt(m[1]) - 1;
        const category = m[2].trim();
        return { idx, category: VALID_CATEGORIES.has(category) ? category : "Other" };
      })
      .filter((r) => r !== null && r.idx >= 0 && r.idx < batch.length);

    res.json({ results });
  } catch (err) {
    console.error("Categorize error:", err);
    res.json({ results: [] });
  }
});

// ── FILE HISTORY ──────────────────────────────────────────────────────────────

app.get("/api/files", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const db = await getDb();
  const files = await db.collection("uploaded_files")
    .find({ userId: user.userId })
    .project({ transactions: 0 })
    .sort({ uploadedAt: -1 })
    .limit(20)
    .toArray();
  res.json(files);
});

app.post("/api/files", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const { fileName, statementType, transactions } = req.body || {};
  if (!fileName || !Array.isArray(transactions)) return res.status(400).json({ error: "Invalid" });
  const db = await getDb();
  const doc = {
    userId: user.userId, fileName,
    statementType: statementType || "unknown",
    transactionCount: transactions.length,
    uploadedAt: new Date(), transactions,
  };
  const result = await db.collection("uploaded_files").insertOne(doc);
  const { transactions: _t, ...meta } = doc;
  res.status(201).json({ ...meta, _id: result.insertedId });
});

app.get("/api/files/:id", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });
  const db = await getDb();
  const file = await db.collection("uploaded_files").findOne({ _id: new ObjectId(id), userId: user.userId });
  if (!file) return res.status(404).json({ error: "Not found" });
  res.json(file);
});

app.delete("/api/files/:id", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });
  const db = await getDb();
  await db.collection("uploaded_files").deleteOne({ _id: new ObjectId(id), userId: user.userId });
  res.json({ ok: true });
});

// ── START ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server → http://localhost:${PORT}`);
});
