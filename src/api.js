/**
 * Shared fetch helper for talking to the API.
 *
 * Auth state lives entirely in HttpOnly cookies now — this file never reads,
 * stores, or decodes a JWT. Every request goes through here so that
 * `credentials: "include"` (send/receive cookies), the CSRF header, and
 * `Content-Type: application/json` (for any string `body`) are never
 * forgotten on a call site.
 *
 * The `Content-Type` default was added in Phase 8.8, found via a real,
 * reproduced failure: every existing `apiFetch` POST call site up to that
 * point (the four auth forms) happened to set it manually, so the gap
 * stayed invisible — Transactions/Analytics only ever used `apiFetch` for
 * GETs (no body), and the real file-upload POST went through `App.jsx`'s
 * separate `authFetch` wrapper, which already added this header itself.
 * `features/categories/hooks/useCategoriesData.js` was the first caller to
 * POST/PUT a JSON body through `apiFetch` directly without also setting the
 * header — Express's `express.json()` body parser only parses a request
 * body when `Content-Type` says so, so `req.body` came back empty server-
 * side and every write silently 400'd. Fixed at the shared source (this
 * file), not by teaching each new call site to remember the header itself
 * — the same reasoning ADR-024 already used for a design-token bug: fixing
 * the one shared place closes the gap for every caller, present and future,
 * rather than leaving the same mistake available to make again.
 */

// Endpoints that happen before a session exists (or the refresh endpoint
// itself) — a 401 from these should never trigger a refresh-and-retry.
const NO_REFRESH_RETRY = [
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/verify-otp",
  "/api/auth/resend-otp",
  "/api/auth/refresh",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/logout",
];

/** Read the CSRF token the server set in a (non-HttpOnly) cookie at login. */
function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)cc_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function buildHeaders(method, existing, body) {
  const headers = new Headers(existing || {});
  if (method !== "GET" && method !== "HEAD") {
    headers.set("X-CSRF-Token", getCsrfToken());
  }
  // Only for a plain string body (every call site here passes
  // JSON.stringify(...)) — never for FormData, which needs the browser to
  // set its own multipart boundary automatically.
  if (typeof body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

async function rawRequest(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  return fetch(url, {
    ...options,
    method,
    credentials: "include",
    headers: buildHeaders(method, options.headers, options.body),
  });
}

// The one in-flight `POST /api/auth/refresh` request, shared by every
// concurrent apiFetch() caller — see refreshSession() below for why this
// exists. null whenever no refresh is currently in progress.
let refreshInFlight = null;

/**
 * Perform (at most) one real refresh request at a time, no matter how many
 * apiFetch() calls hit a 401 simultaneously.
 *
 * Without this, a page that loads several resources in parallel (most do —
 * e.g. Merchant Rules fires GET /api/merchant-rules and GET /api/categories
 * together) would have *each* of those calls independently see the same
 * expired access token and independently POST /api/auth/refresh at the same
 * moment. api/auth.js's refresh handler rotates the refresh token with an
 * atomic compare-and-swap *by design* (see api/_lib/session.js's
 * rotateSession and tests/auth.test.js's "under concurrent refresh attempts
 * ... exactly one succeeds") — a real, intentional defense against a stolen
 * token being replayed. But that same defense can't tell "two requests
 * racing because of theft" apart from "two requests racing because this
 * page made two fetch calls" — every refresh call but the first one loses
 * the compare-and-swap and is treated as reuse of an already-rotated token,
 * which clears all three auth cookies. Depending on which response's
 * Set-Cookie the browser applies last, that can wipe out the session that
 * the *winning* refresh call just legitimately re-established, forcing a
 * full logout (and, since login always requires a fresh OTP, a full
 * password+OTP cycle) in the middle of ordinary active use — this was the
 * actual root cause of "logged out too often."
 *
 * Coalescing every concurrent caller onto one shared promise means the
 * browser only ever sends one refresh request per expiry, so this race
 * never has a chance to start. The backend's reuse-detection is unchanged
 * and still does its job against a genuinely stolen/replayed token.
 */
function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = rawRequest("/api/auth/refresh", { method: "POST" }).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * Fetch wrapper for all API calls. On a 401 from a route that requires an
 * access token, transparently attempts one silent refresh and retries the
 * original request once — this is what lets a 15-minute access token renew
 * itself mid-session without the user noticing.
 */
export async function apiFetch(url, options = {}) {
  const res = await rawRequest(url, options);
  if (res.status !== 401 || NO_REFRESH_RETRY.includes(url)) return res;

  const refreshRes = await refreshSession();
  if (!refreshRes.ok) return res;

  return rawRequest(url, options);
}

/** Resolve the current user from the session cookie, or null if not logged in. */
export async function fetchCurrentUser() {
  const res = await apiFetch("/api/auth/profile");
  if (!res.ok) return null;
  return res.json();
}

/** Log out the current device: revokes the session and clears cookies server-side. */
export async function logout() {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Network failure — the access token will still expire within 15 minutes.
  }
}

/** Log out every device: revokes all of this user's sessions. */
export async function logoutAllDevices() {
  try {
    await apiFetch("/api/auth/logout-all", { method: "POST" });
  } catch {
    // Network failure — the access token will still expire within 15 minutes.
  }
}
