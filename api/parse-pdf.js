/**
 * /api/parse-pdf — Secure backend proxy for Anthropic PDF extraction.
 *
 * The frontend sends the raw PDF as base64; this endpoint calls the Anthropic
 * API using the secret key stored only on the server and returns the parsed
 * transactions. No credentials are ever exposed to the browser.
 *
 * Rate limited to 10 requests per user per hour (PDF parsing is expensive).
 */
import { getUser } from "./lib/auth.js";
import { checkRateLimit, getClientIp } from "./lib/ratelimit.js";

// Vercel: allow up to 10 MB request bodies (a 7.5 MB base64 payload ≈ 5.6 MB PDF)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // ── Authentication ──────────────────────────────────────────────────────────
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  // ── Rate limiting: 10 requests per user per hour ────────────────────────────
  const ip = getClientIp(req);
  const rateKey = `parse-pdf:${user.userId}:${ip}`;
  const rate = checkRateLimit(rateKey, 60 * 60_000, 10);
  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfter));
    return res
      .status(429)
      .json({ error: "Too many PDF parsing requests. Please wait before trying again." });
  }

  // ── Input validation ────────────────────────────────────────────────────────
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

  // ── API key guard ───────────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.json({ transactions: [], warning: "ANTHROPIC_API_KEY not configured" });
  }

  // ── Build extraction prompt ─────────────────────────────────────────────────
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
    // ── Call Anthropic API server-side (key never sent to browser) ──────────
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000); // 60 s timeout

    let anthropicRes;
    try {
      anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "pdfs-2024-09-25",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
                },
                { type: "text", text: prompt },
              ],
            },
          ],
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!anthropicRes.ok) {
      // Log internally; never leak provider error details to the client
      const errText = await anthropicRes.text().catch(() => "");
      console.error("[parse-pdf] Anthropic error:", anthropicRes.status, errText.slice(0, 300));
      return res.json({ transactions: [] });
    }

    const data = await anthropicRes.json();
    const rawText = (data.content || []).map((b) => b.text || "").join("");
    const cleanText = rawText.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch {
      console.error("[parse-pdf] JSON parse failed:", cleanText.slice(0, 200));
      return res.json({ transactions: [] });
    }

    if (!Array.isArray(parsed)) return res.json({ transactions: [] });

    // ── Sanitize output before returning ───────────────────────────────────
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
    console.error("[parse-pdf] Unexpected error:", err.message);
    res.json({ transactions: [] });
  }
}
