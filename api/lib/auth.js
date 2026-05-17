import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "cashcanvas-dev-secret-change-in-prod";

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

export function getUser(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    return verifyToken(auth.slice(7));
  } catch {
    return null;
  }
}
