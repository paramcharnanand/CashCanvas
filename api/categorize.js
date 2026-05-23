import { getUser } from "./lib/auth.js";

const VALID_CATEGORIES = new Set([
  "Housing", "Groceries", "Dining", "Transport", "Subscriptions",
  "Utilities", "Shopping", "Health", "Entertainment", "Income", "Other",
]);

const SYSTEM_PROMPT = `You are an expert bank transaction categorizer. Your job is to assign EVERY transaction to a specific category. NEVER use "Other" unless the transaction is literally an ATM withdrawal, a bank fee, or a person-to-person transfer with no merchant context.

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

Bank statement abbreviations:
- AMZN / AMZN MKTP / AMAZON MKTP → Shopping
- WFM / WHOLEFDS → Groceries (Whole Foods)
- SQ * → Square POS terminal (categorize by what follows)
- TST* → Toast restaurant POS → Dining
- APL* / APPLE.COM → Subscriptions
- VZWRLSS / VZW → Utilities (Verizon)
- COMCAST / XFINITY → Utilities
- DDD / DOORDASH → Dining
- TWC / SPECTRUM → Utilities
- PP* / PAYPAL → Shopping (usually)
- COSTCO WHSE → Groceries

CRITICAL RULE: If you cannot confidently identify the merchant, make your BEST guess based on context clues. Only use "Other" for ATM withdrawals, unexplained bank fees, or pure person-to-person transfers.`;

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
    .map((t, i) => `${i + 1}. "${t.desc}" ($${Math.abs(t.amount || 0).toFixed(2)})`)
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
              text: `Categorize each transaction. Reply with ONLY the line number and category, one per line. Format: "1. Dining"\n\n${descriptions}`,
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
        const m = line.match(/^(\d+)\.\s+(.+)$/);
        if (!m) return null;
        const idx = parseInt(m[1]) - 1;
        const category = m[2].trim();
        return { idx, category: VALID_CATEGORIES.has(category) ? category : "Other" };
      })
      .filter((r) => r !== null && r.idx >= 0 && r.idx < batch.length);

    res.json({ results });
  } catch {
    res.json({ results: [] });
  }
}
