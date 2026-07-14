/**
 * Shared fetch helper for talking to the API.
 *
 * Auth state lives entirely in HttpOnly cookies now — this file never reads,
 * stores, or decodes a JWT. Every request goes through here so that
 * `credentials: "include"` (send/receive cookies) and the CSRF header are
 * never forgotten on a call site.
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

function buildHeaders(method, existing) {
  const headers = new Headers(existing || {});
  if (method !== "GET" && method !== "HEAD") {
    headers.set("X-CSRF-Token", getCsrfToken());
  }
  return headers;
}

async function rawRequest(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  return fetch(url, {
    ...options,
    method,
    credentials: "include",
    headers: buildHeaders(method, options.headers),
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
