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

/**
 * Fetch wrapper for all API calls. On a 401 from a route that requires an
 * access token, transparently attempts one silent refresh and retries the
 * original request once — this is what lets a 15-minute access token renew
 * itself mid-session without the user noticing.
 */
export async function apiFetch(url, options = {}) {
  const res = await rawRequest(url, options);
  if (res.status !== 401 || NO_REFRESH_RETRY.includes(url)) return res;

  const refreshRes = await rawRequest("/api/auth/refresh", { method: "POST" });
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
