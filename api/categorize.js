import { getUser } from "./lib/auth.js";

const VALID_CATEGORIES = new Set([
  "Housing", "Groceries", "Dining", "Transport", "Subscriptions",
  "Utilities", "Shopping", "Health", "Entertainment", "Income", "Other",
]);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { transactions } = req.body || {};
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.json({ results: [] });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
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
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Categorize these bank transactions. Reply with ONLY the number and category name, one per line (e.g. "1. Dining"). Use exactly these categories: Housing, Groceries, Dining, Transport, Subscriptions, Utilities, Shopping, Health, Entertainment, Income, Other.\n\n${descriptions}`,
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
  } catch {
    res.json({ results: [] });
  }
}
