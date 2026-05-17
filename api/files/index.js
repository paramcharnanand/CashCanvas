import { getDb } from "../lib/db.js";
import { getUser } from "../lib/auth.js";

export default async function handler(req, res) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const db = await getDb();

  if (req.method === "GET") {
    // Return metadata only (no transactions array) for the list view
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
    if (!fileName || !Array.isArray(transactions)) {
      return res.status(400).json({ error: "fileName and transactions required" });
    }

    const doc = {
      userId: user.userId,
      fileName,
      statementType: statementType || "unknown",
      transactionCount: transactions.length,
      uploadedAt: new Date(),
      transactions, // dates stored as ISO strings by the client
    };
    const result = await db.collection("uploaded_files").insertOne(doc);
    const { transactions: _t, ...meta } = doc;
    return res.status(201).json({ ...meta, _id: result.insertedId });
  }

  res.status(405).end();
}
