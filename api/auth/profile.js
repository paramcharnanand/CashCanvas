import { getUser } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  res.json({ name: user.name, email: user.email });
}
