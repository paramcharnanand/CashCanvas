import { getDb } from "../lib/db.js";
import { signToken } from "../lib/auth.js";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
    const db = await getDb();
    const existing = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.collection("users").insertOne({
      name,
      email: email.toLowerCase(),
      passwordHash,
      createdAt: new Date(),
    });

    const token = signToken({ userId: result.insertedId.toString(), email: email.toLowerCase(), name });
    res.status(201).json({ token, user: { name, email: email.toLowerCase() } });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
}
