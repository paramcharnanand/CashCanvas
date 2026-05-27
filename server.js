/**
 * Local development API server — mirrors the Vercel /api routes.
 * Run alongside Vite: `npm run dev:full`
 */
import crypto from "crypto";
import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import {
  cleanTransaction,
  preprocessForAI,
  extractMerchant,
  fuzzyMatchMerchant,
} from "./api/lib/transaction-cleaner.js";

const app = express();

// ── CORS ─────────────────────────────────────────────────────────────────────
// Lock down to known local origins. In production, Vercel serves everything
// on the same domain so CORS isn't an issue there.
const DEV_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:5174")
  .split(",").map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || DEV_ORIGINS.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error("CORS: origin not allowed"));
  },
  credentials: true,
}));

// ── Security headers ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(express.json({ limit: "10mb" }));

// ── Rate limiter ──────────────────────────────────────────────────────────────
// Prune old entries every 15 minutes to prevent unbounded memory growth
const rateLimitStore = new Map();
setInterval(() => {
  const cutoff = Date.now() - 3_600_000;
  for (const [k, v] of rateLimitStore) {
    if (v.start < cutoff) rateLimitStore.delete(k);
  }
}, 900_000).unref();

function getClientIp(req) {
  return (
    req.headers["x-real-ip"] ||
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.ip ||
    "unknown"
  );
}

function rateLimit({ windowMs = 60_000, max = 30, keyPrefix = "req" } = {}) {
  return (req, res, next) => {
    const ip  = getClientIp(req);
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);
    if (!entry || now - entry.start > windowMs) {
      rateLimitStore.set(key, { start: now, count: 1 });
      return next();
    }
    entry.count++;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.start + windowMs - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
    }
    next();
  };
}

// Auth: 10 per 15 min; OTP verify: 5 per 15 min; Resend OTP: 3 per hour; General: 100 per min; PDF: 10 per hour
const authLimiter     = rateLimit({ windowMs: 15 * 60_000, max: 10,  keyPrefix: "auth" });
const otpLimiter      = rateLimit({ windowMs: 15 * 60_000, max: 5,   keyPrefix: "otp" });
const resendLimiter   = rateLimit({ windowMs: 60 * 60_000, max: 3,   keyPrefix: "resend" });
const apiLimiter      = rateLimit({ windowMs: 60_000,      max: 100, keyPrefix: "api" });
const parsePdfLimiter = rateLimit({ windowMs: 60 * 60_000, max: 10,  keyPrefix: "parsepdf" });

const OTP_TTL_MS = 10 * 60_000;

// ── Email helpers ─────────────────────────────────────────────────────────────
const isEmailEnabled = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

function createMailer() {
  if (!isEmailEnabled()) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
}

function generateOtp() {
  // crypto.randomInt is available in Node 14.10+
  return (Math.floor(Math.random() * 900000) + 100000).toString();
}

async function sendOtpEmail(toEmail, otp, purpose = "login") {
  const transporter = createMailer();
  if (!transporter) {
    console.warn("[mailer] Email not configured — OTP for", toEmail, "is", otp);
    return;
  }
  const action = purpose === "signup" ? "activate your account" : "sign in";
  await transporter.sendMail({
    from: `"CashCanvas" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: purpose === "signup" ? "Your CashCanvas verification code" : "Your CashCanvas sign-in code",
    html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fbf9f6;">
  <p style="font-family:Georgia,serif;font-style:italic;font-size:22px;color:#005235;margin:0 0 24px;">CashCanvas</p>
  <p style="color:#3f4943;margin:0 0 8px;">Your code to ${action}:</p>
  <div style="letter-spacing:10px;font-size:40px;font-weight:700;color:#005235;font-family:monospace;text-align:center;margin:20px 0;">${otp}</div>
  <p style="color:#6f7a72;font-size:13px;text-align:center;">Expires in 10 minutes. If you didn't request this, ignore this email.</p>
  <hr style="border:none;border-top:1px solid #efeeeb;margin:24px 0;">
  <p style="color:#6f7a72;font-size:11px;">© 2026 CashCanvas</p>
</div>`,
    text: `Your CashCanvas code: ${otp}\n\nEnter this code to ${action}. Expires in 10 minutes.`,
  });
}

// ── Account lockout helpers ───────────────────────────────────────────────────
const MAX_FAILED_ATTEMPTS  = 5;
const LOCKOUT_DURATION_MS  = 15 * 60_000; // 15 minutes

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const JWT_SECRET = process.env.JWT_SECRET || "cashcanvas-dev-secret-change-in-prod";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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

app.post("/api/auth/signup", authLimiter, async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim() || !email || !password)
    return res.status(400).json({ error: "Name, email and password are required." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "Please enter a valid email address." });
  if (password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters." });

  try {
    const db = await getDb();
    const existing = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: "This email is already registered. Try signing in instead." });

    const passwordHash   = await bcrypt.hash(password, 12);
    const emailEnabled   = isEmailEnabled();
    const otp            = emailEnabled ? generateOtp() : null;
    const otpExpiry      = emailEnabled ? new Date(Date.now() + OTP_TTL_MS) : null;

    const result = await db.collection("users").insertOne({
      name:  name.trim(),
      email: email.toLowerCase(),
      passwordHash,
      emailVerified:      !emailEnabled,
      pendingOtp:         otp,
      pendingOtpExpiry:   otpExpiry,
      pendingOtpAttempts: 0,
      pendingOtpPurpose:  "signup",
      failedLogins:       0,
      lockedUntil:        null,
      createdAt:          new Date(),
    });

    if (emailEnabled) {
      sendOtpEmail(email.toLowerCase(), otp, "signup").catch(err =>
        console.error("[signup] OTP send error:", err.message)
      );
      return res.status(201).json({ otpRequired: true, email: email.toLowerCase() });
    }

    const token = signToken({ userId: result.insertedId.toString(), email: email.toLowerCase(), name: name.trim() });
    res.status(201).json({ token, user: { name: name.trim(), email: email.toLowerCase() } });
  } catch (err) {
    console.error("[signup]", err);
    res.status(500).json({ error: "Unable to create your account. Please try again." });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required." });

  try {
    const db = await getDb();
    const user = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: "No account found with this email. Please sign up first." });

    // Account lockout
    if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
      const minutesLeft = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60_000);
      return res.status(429).json({
        error: `Account locked after too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.`,
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const failedCount = (user.failedLogins || 0) + 1;
      const shouldLock  = failedCount >= MAX_FAILED_ATTEMPTS;
      await db.collection("users").updateOne({ _id: user._id }, {
        $set: {
          failedLogins: failedCount,
          lastFailedAt: new Date(),
          ...(shouldLock ? { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) } : {}),
        },
      });
      const left = Math.max(0, MAX_FAILED_ATTEMPTS - failedCount);
      const suffix = shouldLock ? " Account locked for 15 minutes."
        : left === 1 ? " 1 attempt remaining before lockout."
        : left > 0  ? ` ${left} attempts remaining.` : "";
      return res.status(401).json({ error: `Incorrect password. Please try again.${suffix}` });
    }

    // Reset failed count
    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { failedLogins: 0, lockedUntil: null } }
    );

    // Dev mode (no email configured): issue JWT directly
    if (!isEmailEnabled()) {
      await db.collection("users").updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
      const token = signToken({ userId: user._id.toString(), email: user.email, name: user.name });
      return res.json({ token, user: { name: user.name, email: user.email } });
    }

    // Generate and email OTP
    const otp    = generateOtp();
    const expiry = new Date(Date.now() + OTP_TTL_MS);
    await db.collection("users").updateOne({ _id: user._id }, {
      $set: { pendingOtp: otp, pendingOtpExpiry: expiry, pendingOtpAttempts: 0, pendingOtpPurpose: "login" },
    });
    sendOtpEmail(user.email, otp, "login").catch(err =>
      console.error("[login] OTP send error:", err.message)
    );
    res.json({ otpRequired: true, email: user.email });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ error: "Unable to sign in. Please try again." });
  }
});

app.post("/api/auth/verify-otp", otpLimiter, async (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp)
    return res.status(400).json({ error: "Email and code are required." });
  if (!/^\d{6}$/.test(otp))
    return res.status(400).json({ error: "Code must be 6 digits." });

  try {
    const db   = await getDb();
    const user = await db.collection("users").findOne({ email: email.toLowerCase() });

    if (!user || !user.pendingOtp)
      return res.status(400).json({ error: "No verification code found. Please request a new one." });

    if (new Date() > new Date(user.pendingOtpExpiry)) {
      await db.collection("users").updateOne({ _id: user._id }, {
        $unset: { pendingOtp: "", pendingOtpExpiry: "", pendingOtpAttempts: "", pendingOtpPurpose: "" },
      });
      return res.status(400).json({ error: "Code expired. Please request a new one.", expired: true });
    }

    const attempts = (user.pendingOtpAttempts || 0) + 1;
    if (user.pendingOtp !== otp) {
      if (attempts >= 3) {
        await db.collection("users").updateOne({ _id: user._id }, {
          $unset: { pendingOtp: "", pendingOtpExpiry: "", pendingOtpAttempts: "", pendingOtpPurpose: "" },
        });
        return res.status(400).json({ error: "Too many incorrect attempts. Please request a new code.", expired: true });
      }
      await db.collection("users").updateOne({ _id: user._id }, { $set: { pendingOtpAttempts: attempts } });
      const left = 3 - attempts;
      return res.status(400).json({ error: `Incorrect code. ${left} attempt${left !== 1 ? "s" : ""} remaining.` });
    }

    const isSignup = user.pendingOtpPurpose === "signup";
    await db.collection("users").updateOne({ _id: user._id }, {
      $set: {
        ...(isSignup ? { emailVerified: true, verifiedAt: new Date() } : {}),
        lastLoginAt:  new Date(),
        failedLogins: 0,
        lockedUntil:  null,
      },
      $unset: { pendingOtp: "", pendingOtpExpiry: "", pendingOtpAttempts: "", pendingOtpPurpose: "" },
    });

    const token = signToken({ userId: user._id.toString(), email: user.email, name: user.name });
    res.json({ token, user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error("[verify-otp]", err);
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

app.post("/api/auth/resend-otp", resendLimiter, async (req, res) => {
  if (!isEmailEnabled())
    return res.status(503).json({ error: "Email is not configured on this server." });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email is required." });

  try {
    const db   = await getDb();
    const user = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ ok: true }); // Don't reveal if email exists

    const otp    = generateOtp();
    const expiry = new Date(Date.now() + OTP_TTL_MS);
    await db.collection("users").updateOne({ _id: user._id }, {
      $set: { pendingOtp: otp, pendingOtpExpiry: expiry, pendingOtpAttempts: 0 },
    });
    sendOtpEmail(user.email, otp, user.pendingOtpPurpose || "login").catch(err =>
      console.error("[resend-otp] Email error:", err.message)
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[resend-otp]", err);
    res.status(500).json({ error: "Unable to resend code. Please try again." });
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

app.post("/api/categorize", apiLimiter, async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { transactions } = req.body || {};
  if (!Array.isArray(transactions) || transactions.length === 0)
    return res.json({ results: [] });

  if (!GEMINI_API_KEY) {
    return res.json({ results: [], warning: "GEMINI_API_KEY not configured" });
  }

  // Load user's merchant rules for fuzzy matching
  let merchantRules = new Map();
  try {
    const db = await getDb();
    const rules = await db.collection("merchant_category_rules")
      .find({ userId: user.userId })
      .toArray();
    rules.forEach(r => merchantRules.set(r.merchantName, r.category));
  } catch { /* proceed without rules */ }

  const batch = transactions.slice(0, 100);
  const results = [];
  const toSendToAI = [];

  // First pass: try fuzzy matching against user's learned rules
  for (let i = 0; i < batch.length; i++) {
    const cleaned = cleanTransaction(batch[i].desc);
    const match = fuzzyMatchMerchant(cleaned, merchantRules);
    if (match && match.score >= 0.65) {
      results.push({ idx: i, category: match.category, confidence: Math.round(match.score * 100) });
    } else {
      toSendToAI.push({ idx: i, desc: batch[i].desc, amount: batch[i].amount });
    }
  }

  // Second pass: send unmatched transactions to Gemini
  if (toSendToAI.length > 0) {
    const descriptions = toSendToAI
      .map((t, i) => `${i + 1}. "${preprocessForAI(t.desc)}" ($${Math.abs(t.amount || 0).toFixed(2)})`)
      .join("\n");

    const systemPrompt = `You are an expert bank transaction categorizer. Assign EVERY transaction to a specific category. NEVER use "Other" unless the transaction is literally an ATM withdrawal, a bank fee, or a person-to-person transfer with no merchant context.

Categories:
- Housing: rent, mortgage, HOA, storage units, renters/homeowners insurance, moving services
- Groceries: supermarkets, grocery stores, Instacart, Amazon Fresh, Costco, wholesale clubs
- Dining: restaurants, cafes, coffee shops, fast food, food delivery (DoorDash, Uber Eats, Grubhub, GoPuff)
- Transport: Uber/Lyft rides, gas stations, parking, tolls, transit, airlines, car rentals, auto repair, EV charging
- Subscriptions: Netflix, Spotify, Hulu, Disney+, HBO, gym memberships, SaaS, cloud storage, news, Adobe, Microsoft 365
- Utilities: electricity, water, gas bill, internet, phone/cell, trash collection
- Shopping: Amazon, eBay, Target, Walmart, retail stores, clothing, electronics, online marketplaces, hardware stores
- Health: CVS, Walgreens, pharmacies, doctors, dentists, hospitals, health insurance, prescriptions, therapy
- Entertainment: movies, concerts, tickets, gaming (Steam, PlayStation, Xbox, Nintendo), bowling, events, parks
- Income: payroll, salary, direct deposit, tax refunds, reimbursements, interest, dividends, Zelle/Venmo received

Bank abbreviations: AMZN/AMAZON MKTP → Shopping; WFM/WHOLEFDS → Groceries; SQ * → Square POS; TST* → Dining; APL*/APPLE.COM → Subscriptions; VZWRLSS/VZW → Utilities; COMCAST/XFINITY → Utilities; DOORDASH → Dining; COSTCO WHSE → Groceries.

CRITICAL: Make your BEST guess. Only use "Other" for ATM withdrawals, unexplained bank fees, or pure person-to-person transfers.

For each transaction, reply with ONLY the line number, category, and confidence (0-100). Format: "1. Dining:95"`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{
              parts: [{
                text: `Categorize each transaction. Reply with ONLY the line number, category, and confidence score. Format: "1. Dining:95"\n\n${descriptions}`,
              }],
            }],
            generationConfig: { maxOutputTokens: 2048, temperature: 0 },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");

        text.trim().split("\n").forEach((line) => {
          const m = line.match(/^(\d+)\.\s+(.+?)(?::(\d+))?$/);
          if (!m) return;
          const aiIdx = parseInt(m[1]) - 1;
          const category = m[2].trim();
          const confidence = m[3] ? parseInt(m[3]) : 75;
          if (aiIdx >= 0 && aiIdx < toSendToAI.length) {
            results.push({
              idx: toSendToAI[aiIdx].idx,
              category: VALID_CATEGORIES.has(category) ? category : "Other",
              confidence,
            });
          }
        });
      }
    } catch (err) {
      console.error("Categorize error:", err);
    }
  }

  res.json({ results });
});

// ── PDF PARSING (AI EXTRACTION) ───────────────────────────────────────────────
// Secure server-side proxy: the Gemini API key never reaches the browser.

app.post("/api/parse-pdf", parsePdfLimiter, async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { pdfBase64, statementType = "unknown" } = req.body || {};
  if (!pdfBase64 || typeof pdfBase64 !== "string") {
    return res.status(400).json({ error: "pdfBase64 is required" });
  }
  // base64 chars × 0.75 ≈ binary bytes; 9.5M chars ≈ 7.1 MB PDF
  if (pdfBase64.length > 9_500_000) {
    return res
      .status(413)
      .json({ error: "PDF too large for AI extraction. Maximum supported size is approximately 7 MB." });
  }

  if (!GEMINI_API_KEY) {
    return res.json({ transactions: [], warning: "GEMINI_API_KEY not configured" });
  }

  const isCreditCard = statementType === "credit_card";
  const prompt = `Extract ALL transactions from this ${
    isCreditCard ? "credit card statement" : "bank statement"
  }. Return ONLY a JSON array, no markdown, no backticks, no explanation. Each object must have:
- "date": string in "YYYY-MM-DD" format
- "desc": merchant/description string
- "amount": number (negative for expenses/charges/purchases, positive for income/payments/credits/deposits)${
    isCreditCard
      ? "\nIMPORTANT: This is a credit card statement. Purchases and charges must be NEGATIVE. Payments you made to the card must be POSITIVE."
      : ""
  }

Example: [{"date":"2025-01-15","desc":"WHOLE FOODS MARKET","amount":-87.32},{"date":"2025-01-14","desc":"PAYROLL DEPOSIT","amount":3200.00}]

Return ONLY the JSON array.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    let geminiRes;
    try {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                { text: prompt },
              ],
            }],
            generationConfig: { maxOutputTokens: 8192, temperature: 0 },
          }),
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      console.error("[parse-pdf] Gemini error:", geminiRes.status, errText.slice(0, 300));
      return res.json({ transactions: [] });
    }

    const data = await geminiRes.json();
    const rawText = (data.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || "")
      .join("");
    const cleanText = rawText.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch {
      console.error("[parse-pdf] JSON parse failed:", cleanText.slice(0, 200));
      return res.json({ transactions: [] });
    }

    if (!Array.isArray(parsed)) return res.json({ transactions: [] });

    const transactions = parsed
      .filter((t) => t.date && t.desc && typeof t.amount === "number")
      .map((t) => ({
        date: String(t.date).trim(),
        desc: String(t.desc).trim(),
        amount: Number(t.amount),
      }))
      .filter(
        (t) =>
          /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
          t.desc.length > 0 &&
          t.amount !== 0
      );

    res.json({ transactions });
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("[parse-pdf] Anthropic request timed out");
      return res
        .status(504)
        .json({ transactions: [], error: "AI parsing timed out. Please try again." });
    }
    console.error("[parse-pdf]", err);
    res.json({ transactions: [] });
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

app.post("/api/files", apiLimiter, async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const { fileName, statementType, transactions } = req.body || {};
  if (!fileName || !Array.isArray(transactions))
    return res.status(400).json({ error: "Invalid statement data. Please try uploading again." });
  if (transactions.length > 10000)
    return res.status(400).json({ error: "Statement exceeds maximum of 10,000 transactions." });

  // Auto-detect metadata from transactions for internal naming
  let detectedMonth = null;
  let detectedYear = null;
  let detectedBank = null;
  if (transactions.length > 0) {
    const dates = transactions
      .map(t => t.date ? new Date(t.date) : null)
      .filter(d => d && !isNaN(d.getTime()));
    if (dates.length > 0) {
      // Use the most common month/year
      const monthCounts = {};
      dates.forEach(d => {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthCounts[key] = (monthCounts[key] || 0) + 1;
      });
      const topMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topMonth) {
        const [y, m] = topMonth.split("-");
        detectedYear = parseInt(y);
        detectedMonth = parseInt(m);
      }
    }
    // Detect bank from common transaction patterns
    const allDescs = transactions.map(t => (t.desc || "").toLowerCase()).join(" ");
    const bankPatterns = [
      ["chase", "Chase"], ["wells fargo", "WellsFargo"], ["bank of america", "BofA"],
      ["citi", "Citi"], ["capital one", "CapitalOne"], ["amex", "Amex"],
      ["discover", "Discover"], ["usaa", "USAA"], ["pnc", "PNC"],
      ["td bank", "TD"], ["us bank", "USBank"],
    ];
    for (const [pattern, name] of bankPatterns) {
      if (allDescs.includes(pattern)) { detectedBank = name; break; }
    }
  }

  // Build internal name: YYYY-MM-BANK-TYPE
  const typeLabel = statementType === "credit_card" ? "Credit" : statementType === "bank" ? "Debit" : "Statement";
  const monthStr = detectedMonth ? String(detectedMonth).padStart(2, "0") : "XX";
  const yearStr = detectedYear || "XXXX";
  const bankStr = detectedBank || "Bank";
  const internalName = `${yearStr}-${monthStr}-${bankStr}-${typeLabel}`;

  const db = await getDb();
  const doc = {
    userId: user.userId,
    fileName,
    internalName,
    statementType: statementType || "unknown",
    detectedMonth,
    detectedYear,
    detectedBank,
    transactionCount: transactions.length,
    uploadedAt: new Date(),
    transactions,
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
