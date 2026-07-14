/**
 * Minimal cookie parsing/serialization — no external dependency.
 * All cookie values we ever store (JWTs, hex tokens) are already restricted
 * to a URL-safe character set, but we still percent-encode/decode
 * defensively so this stays correct if that ever changes.
 *
 * This is the ONLY place that reads `req.headers.cookie` or builds
 * `Set-Cookie` headers — every route goes through the helpers below instead
 * of parsing cookies itself.
 */

export const ACCESS_COOKIE  = "cc_at";
export const REFRESH_COOKIE = "cc_rt";
export const CSRF_COOKIE    = "cc_csrf";

export const ACCESS_TOKEN_TTL_MS  = 15 * 60_000;          // 15 minutes
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60_000; // 30 days

const isProd = () => process.env.NODE_ENV === "production";

/** Parse the raw `Cookie` request header into a plain object. */
export function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

/** Read a single cookie value from a request. */
export function getCookie(req, name) {
  return parseCookies(req)[name];
}

function serializeCookie(name, value, { maxAgeMs, path = "/", httpOnly = true } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${path}`);
  if (maxAgeMs !== undefined) {
    parts.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`);
    parts.push(`Expires=${new Date(Date.now() + maxAgeMs).toUTCString()}`);
  }
  if (httpOnly) parts.push("HttpOnly");
  if (isProd()) parts.push("Secure");
  parts.push("SameSite=Lax");
  return parts.join("; ");
}

/** Append a Set-Cookie header without clobbering ones already queued on this response. */
function appendSetCookie(res, cookieStr) {
  const prev = res.getHeader("Set-Cookie");
  if (!prev) res.setHeader("Set-Cookie", cookieStr);
  else if (Array.isArray(prev)) res.setHeader("Set-Cookie", [...prev, cookieStr]);
  else res.setHeader("Set-Cookie", [prev, cookieStr]);
}

/**
 * Set the three auth cookies on a response.
 * - Access token: HttpOnly, sent on every /api request.
 * - Refresh token: HttpOnly, scoped narrowly to the auth endpoints that need it.
 * - CSRF token: NOT HttpOnly (the frontend must read it) so it can be echoed
 *   back as the X-CSRF-Token header on mutating requests.
 */
export function setAuthCookies(res, { accessToken, refreshToken, csrfToken }) {
  appendSetCookie(res, serializeCookie(ACCESS_COOKIE, accessToken, {
    maxAgeMs: ACCESS_TOKEN_TTL_MS, path: "/api", httpOnly: true,
  }));
  appendSetCookie(res, serializeCookie(REFRESH_COOKIE, refreshToken, {
    maxAgeMs: REFRESH_TOKEN_TTL_MS, path: "/api/auth", httpOnly: true,
  }));
  if (csrfToken) {
    appendSetCookie(res, serializeCookie(CSRF_COOKIE, csrfToken, {
      maxAgeMs: REFRESH_TOKEN_TTL_MS, path: "/", httpOnly: false,
    }));
  }
}

/** Expire all three auth cookies (logout). Paths must match setAuthCookies exactly. */
export function clearAuthCookies(res) {
  appendSetCookie(res, serializeCookie(ACCESS_COOKIE, "", { maxAgeMs: 0, path: "/api", httpOnly: true }));
  appendSetCookie(res, serializeCookie(REFRESH_COOKIE, "", { maxAgeMs: 0, path: "/api/auth", httpOnly: true }));
  appendSetCookie(res, serializeCookie(CSRF_COOKIE, "", { maxAgeMs: 0, path: "/", httpOnly: false }));
}
