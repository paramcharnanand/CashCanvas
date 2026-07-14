import jwt from "jsonwebtoken";
import { getCookie, ACCESS_COOKIE, ACCESS_TOKEN_TTL_MS } from "./cookies.js";

// Fail fast in production: the fallback below is well-known (it's in this
// source file) — silently signing/verifying real sessions with it would let
// anyone forge a valid access token. Only ever acceptable for local dev.
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is not set. Refusing to start in production " +
    "with the default development secret."
  );
}

const SECRET = process.env.JWT_SECRET || "cashcanvas-dev-secret-change-in-prod";

/** Sign a short-lived (15 min) access token carrying { userId, email, name }. */
export function generateAccessToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000) });
}

/** Verify and decode an access token. Throws if invalid or expired. */
export function verifyAccessToken(token) {
  return jwt.verify(token, SECRET);
}

/**
 * Extract and verify the access token from the HttpOnly cookie.
 * Returns null if absent or invalid — never reads Authorization headers or
 * any other client-supplied source; the access token never touches
 * browser-accessible storage.
 */
export function getUser(req) {
  const token = getCookie(req, ACCESS_COOKIE);
  if (!token) return null;
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}
