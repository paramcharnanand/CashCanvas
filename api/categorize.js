import { getUser } from "./lib/auth.js";
import { preprocessForAI } from "./lib/transaction-cleaner.js";

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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { transactions } = req.body || {};
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.json({ results: [] });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.json({ results: [], warning: "GEMINI_API_KEY not configured" });
  }

  const batch = transactions.slice(0, 100);
  const descriptions = batch
    .map((t, i) => `${i + 1}. "${preprocessForAI(t.desc)}" ($${Math.abs(t.amount || 0).toFixed(2)})`)
    .join("\n");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
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

    if (!response.ok) return res.json({ results: [] });

    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");

    const results = text
      .trim()
      .split("\n")
      .map((line) => {
        const m = line.match(/^(\d+)\.\s+(.+?)(?::(\d+))?$/);
        if (!m) return null;
        const idx = parseInt(m[1]) - 1;
        const category = m[2].trim();
        const confidence = m[3] ? parseInt(m[3]) : 75;
        return {
          idx,
          category: VALID_CATEGORIES.has(category) ? category : "Other",
          confidence,
        };
      })
      .filter((r) => r !== null && r.idx >= 0 && r.idx < batch.length);

    res.json({ results });
  } catch {
    res.json({ results: [] });
  }
}
