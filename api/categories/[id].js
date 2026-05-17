import { getDb } from "../lib/db.js";
import { getUser } from "../lib/auth.js";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;
  if (!id || !ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });

  const db = await getDb();
  const filter = { _id: new ObjectId(id), userId: user.userId };

  if (req.method === "PUT") {
    const { categoryName, icon, color, keywords } = req.body || {};
    const update = {};
    if (categoryName !== undefined) update.categoryName = categoryName.trim();
    if (icon !== undefined) update.icon = icon;
    if (color !== undefined) update.color = color;
    if (keywords !== undefined) update.keywords = Array.isArray(keywords) ? keywords : [];
    update.updatedAt = new Date();

    const result = await db.collection("custom_categories").updateOne(filter, { $set: update });
    if (result.matchedCount === 0) return res.status(404).json({ error: "Category not found" });
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    await db.collection("custom_categories").deleteOne(filter);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
