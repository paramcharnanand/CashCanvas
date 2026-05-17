import { getDb } from "./lib/db.js";
import { getUser } from "./lib/auth.js";

export default async function handler(req, res) {
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
    if (!merchantName || !category) return res.status(400).json({ error: "merchantName and category required" });

    await db.collection("merchant_category_rules").updateOne(
      { userId: user.userId, merchantName },
      {
        $set: { category, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    return res.json({ ok: true });
  }

  res.status(405).end();
}
