/**
 * Lightweight in-memory rate limiter, shared by every route handler in both
 * the Vercel serverless deployment and the local Express dev server (which
 * mounts the same handlers — see server.js).
 *
 * NOTE: Each Vercel function instance has its own memory — the store is not
 * shared across instances there. For strict global rate limiting in
 * production, use Upstash Redis with @upstash/ratelimit. This implementation
 * provides a best-effort per-instance defence against bursty abuse.
 */

const store = new Map();

/** Prune entries older than 1 hour to prevent unbounded memory growth. */
function prune() {
  const cutoff = Date.now() - 3_600_000;
  for (const [key, entry] of store) {
    if (entry.start < cutoff) store.delete(key);
  }
}

/**
 * Check and update the rate limit for a given key.
 *
 * @param {string}  key       Unique string per (action, identifier) pair — e.g. "login:1.2.3.4"
 * @param {number}  windowMs  Rolling window in milliseconds
 * @param {number}  max       Maximum allowed requests in the window
 * @returns {{ ok: boolean, remaining: number, retryAfter?: number }}
 */
export function checkRateLimit(key, windowMs = 900_000, max = 10) {
  if (store.size > 10_000) prune();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.start > windowMs) {
    store.set(key, { start: now, count: 1 });
    return { ok: true, remaining: max - 1 };
  }

  entry.count += 1;
  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.start + windowMs - now) / 1000);
    return { ok: false, remaining: 0, retryAfter };
  }

  return { ok: true, remaining: max - entry.count };
}

/**
 * Extract the real client IP, preferring forwarded headers set by Vercel's edge.
 * @param {import("http").IncomingMessage} req
 */
export function getClientIp(req) {
  return (
    req.headers["x-real-ip"] ||
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

/** Test-only: clear all rate-limit state. Never called from application code. */
export function _resetForTests() {
  store.clear();
}
