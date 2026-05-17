import { getDb } from "../lib/db.js";
import { getUser } from "../lib/auth.js";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });

  const db = await getDb();
  const filter = { _id: new ObjectId(id), userId: user.userId };

  if (req.method === "GET") {
    const file = await db.collection("uploaded_files").findOne(filter);
    if (!file) return res.status(404).json({ error: "Not found" });
    return res.json(file);
  }

  if (req.method === "DELETE") {
    await db.collection("uploaded_files").deleteOne(filter);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
