/**
 * /api/ai — consolidated AI handler
 * Routes: POST /api/categorize, POST /api/parse-pdf
 */
import { getUser }            from "./_lib/jwt.js";
import { getDb }              from "./_lib/db.js";
import { checkRateLimit, getClientIp } from "./_lib/ratelimit.js";
import { preprocessForAI, cleanTransaction, fuzzyMatchMerchant } from "./_lib/transaction-cleaner.js";
import { requireCsrf }        from "./_lib/csrf.js";
import { withErrorHandling }  from "./_lib/http.js";
import { isValidTransactionDesc, isValidTransactionAmount } from "./_lib/validation.js";
import { logger }             from "./_lib/logger.js";

// Allow up to 10 MB request bodies (base64-encoded PDFs)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

// ── categorize ────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set([
  "Housing", "Groceries", "Dining", "Transport", "Subscriptions",
  "Utilities", "Shopping", "Health", "Entertainment", "Income", "Other",
]);

const SYSTEM_PROMPT = `You are an expert bank transaction categorizer. Assign EVERY transaction to a specific category. NEVER use "Other" unless the transaction is literally an ATM withdrawal, a bank fee, or a person-to-person transfer with no merchant context.

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

async function categorize(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!requireCsrf(req, res)) return;

  // 150/15min per user+IP: the UI auto-batches uncategorized transactions in
  // groups of 100 (see App.jsx), so a single 10,000-transaction statement can
  // legitimately fire ~100 calls in quick succession on first load. 150
  // covers that worst case plus a reload/retry, while still bounding
  // per-user spend against the paid Gemini API this endpoint calls.
  const ip   = getClientIp(req);
  const rate = checkRateLimit(`categorize:${user.userId}:${ip}`, 15 * 60_000, 150);
  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfter));
    return res.status(429).json({ error: "Too many categorization requests. Please wait before trying again." });
  }

  const { transactions } = req.body || {};
  if (!Array.isArray(transactions) || transactions.length === 0)
    return res.json({ results: [] });

  const batch = transactions.slice(0, 100);

  // First pass: fuzzy-match against merchants this user has already taught
  // the system (via reassigning a transaction's category before). This is a
  // single indexed DB lookup vs. an external Gemini call per transaction —
  // skipping it (as this endpoint used to) meant every "Other" transaction
  // hit Gemini even for merchants the user had already corrected.
  let merchantRules = new Map();
  try {
    const db = await getDb();
    const rules = await db.collection("merchant_category_rules")
      .find({ userId: user.userId })
      .toArray();
    merchantRules = new Map(rules.map(r => [r.merchantName, r.category]));
  } catch {
    // proceed with an empty map — everything just falls through to Gemini
  }

  const results = [];
  const toSendToAI = [];
  batch.forEach((t, i) => {
    // idx must stay positional (matches the array the client sent) — skip
    // malformed entries rather than filtering the array, which would shift
    // every later idx and mis-map results client-side.
    if (!t || !isValidTransactionDesc(t.desc) || !isValidTransactionAmount(t.amount)) return;

    const cleaned = cleanTransaction(t.desc);
    const match = fuzzyMatchMerchant(cleaned, merchantRules);
    if (match) {
      results.push({ idx: i, category: match.category, confidence: Math.round(match.score * 100) });
    } else {
      toSendToAI.push({ idx: i, desc: t.desc, amount: t.amount });
    }
  });

  if (toSendToAI.length === 0) {
    // Every transaction matched a merchant rule the user already taught —
    // no Gemini call needed at all.
    return res.json({ results });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.json({ results, warning: "GEMINI_API_KEY not configured" });

  const descriptions = toSendToAI
    .map((t, i) => `${i + 1}. "${preprocessForAI(t.desc)}" ($${Math.abs(t.amount || 0).toFixed(2)})`)
    .join("\n");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{
            parts: [{
              text: `Categorize each transaction. Reply with ONLY the line number, category, and confidence score. Format: "1. Dining:95"\n\n${descriptions}`,
            }],
          }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0 },
        }),
      }
    );

    if (!response.ok) return res.json({ results });

    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");

    text
      .trim()
      .split("\n")
      .forEach((line) => {
        const m = line.match(/^(\d+)\.\s+(.+?)(?::(\d+))?$/);
        if (!m) return;
        const aiIdx      = parseInt(m[1]) - 1;
        const category   = m[2].trim();
        const confidence = m[3] ? parseInt(m[3]) : 75;
        if (aiIdx >= 0 && aiIdx < toSendToAI.length) {
          results.push({
            idx:        toSendToAI[aiIdx].idx,
            category:   VALID_CATEGORIES.has(category) ? category : "Other",
            confidence,
          });
        }
      });

    res.json({ results });
  } catch {
    res.json({ results });
  }
}

// ── parse-pdf ─────────────────────────────────────────────────────────────────

async function parsePdf(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!requireCsrf(req, res)) return;

  const ip   = getClientIp(req);
  const rate = checkRateLimit(`parse-pdf:${user.userId}:${ip}`, 60 * 60_000, 10);
  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfter));
    return res.status(429).json({ error: "Too many PDF parsing requests. Please wait before trying again." });
  }

  const { pdfBase64, statementType = "unknown" } = req.body || {};
  if (!pdfBase64 || typeof pdfBase64 !== "string")
    return res.status(400).json({ error: "pdfBase64 is required" });
  if (pdfBase64.length > 9_500_000)
    return res.status(413).json({ error: "PDF too large for AI extraction. Maximum supported size is approximately 7 MB." });

  // Guard against a non-PDF file (or garbage) reaching Gemini under a
  // mismatched extension/MIME type — decode just the first few bytes and
  // check the "%PDF" magic number rather than trusting the client-supplied
  // file extension or MIME type.
  const header = Buffer.from(pdfBase64.slice(0, 12), "base64");
  if (!header.subarray(0, 4).equals(Buffer.from("%PDF")))
    return res.status(400).json({ error: "File does not appear to be a valid PDF." });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.json({ transactions: [], warning: "GEMINI_API_KEY not configured" });

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
    const timeout    = setTimeout(() => controller.abort(), 60_000);

    let geminiRes;
    try {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method:  "POST",
          signal:  controller.signal,
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
      logger.error("parse-pdf", "Gemini error", { status: geminiRes.status, body: errText.slice(0, 300) });
      return res.json({ transactions: [] });
    }

    const data    = await geminiRes.json();
    const rawText = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
    const clean   = rawText.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      logger.error("parse-pdf", "JSON parse failed", { body: clean.slice(0, 200) });
      return res.json({ transactions: [] });
    }

    if (!Array.isArray(parsed)) return res.json({ transactions: [] });

    const transactions = parsed
      .filter(t => t.date && t.desc && typeof t.amount === "number")
      .map(t => ({ date: String(t.date).trim(), desc: String(t.desc).trim(), amount: Number(t.amount) }))
      .filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t.date) && t.desc.length > 0 && t.amount !== 0);

    res.json({ transactions });
  } catch (err) {
    if (err.name === "AbortError") {
      logger.error("parse-pdf", "Gemini request timed out");
      return res.status(504).json({ transactions: [], error: "AI parsing timed out. Please try again." });
    }
    logger.error("parse-pdf", err);
    res.json({ transactions: [] });
  }
}

// ── router ────────────────────────────────────────────────────────────────────

export default withErrorHandling(async function handler(req, res) {
  const path = req.url.split("?")[0];

  if (req.method === "POST" && path === "/api/categorize") return categorize(req, res);
  if (req.method === "POST" && path === "/api/parse-pdf")  return parsePdf(req, res);

  res.status(404).json({ error: "Not found" });
});
