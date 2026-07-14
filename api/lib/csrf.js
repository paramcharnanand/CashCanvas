/**
 * CSRF protection — double-submit cookie pattern.
 *
 * On login/signup completion, a random token is set in a non-HttpOnly
 * cookie (CSRF_COOKIE). The frontend reads it and echoes it back as the
 * `X-CSRF-Token` header on every mutating (POST/PUT/DELETE) request. A
 * cross-site attacker can trick a browser into *sending* the auth cookies,
 * but cannot read cookie *values* on our domain to also set that header —
 * so requests missing/mismatching the header are rejected.
 *
 * This is defense-in-depth on top of `SameSite=Lax`, which already blocks
 * cross-site browsers from attaching our cookies to non-GET requests in
 * modern browsers.
 */
import crypto from "crypto";
import { getCookie, CSRF_COOKIE } from "./cookies.js";

const HEADER_NAME = "x-csrf-token";

/** Generate a random CSRF token (not tied to the session — see docs for rationale). */
export function generateCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Verify the X-CSRF-Token header matches the CSRF cookie.
 * Returns true/false — callers are responsible for responding with 403.
 */
export function verifyCsrfToken(req) {
  const cookieValue = getCookie(req, CSRF_COOKIE);
  const headerValue = req.headers[HEADER_NAME];
  if (!cookieValue || !headerValue || typeof headerValue !== "string") return false;
  if (cookieValue.length !== headerValue.length) return false;
  return crypto.timingSafeEqual(Buffer.from(cookieValue), Buffer.from(headerValue));
}

/** Verify CSRF for a request, writing a 403 and returning false if it fails. */
export function requireCsrf(req, res) {
  if (verifyCsrfToken(req)) return true;
  res.status(403).json({ error: "Invalid or missing CSRF token." });
  return false;
}
