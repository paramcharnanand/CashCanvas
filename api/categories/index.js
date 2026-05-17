import { getDb } from "../lib/db.js";
import { getUser } from "../lib/auth.js";

export default async function handler(req, res) {
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
    return res.status(201).json({ ...doc, _id: result.insertedId });
  }

  res.status(405).end();
}
