import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Regression coverage for a bug class the rest of the test suite is
 * structurally blind to: DELETE/PUT /api/merchant-rules/:id worked in
 * every local/CI run (server.js and tests/e2e/e2e-server.mjs both wire
 * "/api/merchant-rules/*" straight to api/data.js's Express handler) but
 * 404/405'd in production, because vercel.json — the *only* thing that
 * decides routing on Vercel, where each api/*.js file is an independent
 * serverless function — had a rewrite for the bare "/api/merchant-rules"
 * collection route but none for its "/:id" sub-routes. Unmatched, they fell
 * through to the final catch-all ("/(.*)" -> "/index.html"), so the
 * request never reached api/data.js at all. Fixed by adding the missing
 * "/api/merchant-rules/:path*" rewrite, mirroring the pattern
 * "/api/files/:path*" and "/api/categories/:path*" already used for the
 * exact same shape of collection+:id routes in the same file.
 *
 * The same audit found "/api/savings" (GET/PUT/DELETE, no :id — a single
 * per-user document, see api/data.js's savings() handler) had *no* rewrite
 * at all, bare or wildcard — the entire Savings feature was unreachable in
 * production. Fixed with the bare-only entry that matches its actual
 * (id-less) route shape, same as "/api/categorize"/"/api/parse-pdf".
 *
 * This test doesn't spin up a server — it reads vercel.json and replicates
 * Vercel's own rewrite matching (first source pattern that matches wins),
 * so it catches this class of bug at the layer it actually lives in. The
 * table below is exhaustive against api/data.js's own routes docblock, not
 * just the two instances found so far — it's meant to catch the *class*,
 * not just these two endpoints.
 */
const vercelConfigPath = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../vercel.json");
const vercelConfig = JSON.parse(readFileSync(vercelConfigPath, "utf8"));

/** Vercel's rewrite `source` is path-to-regexp-ish (":name*") except the
 * literal catch-all "/(.*)", which is already a regex. */
function sourceToRegExp(source) {
  if (source === "/(.*)") return /^\/.*$/;
  const pattern = source.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/:\w+\*/g, ".*");
  return new RegExp(`^${pattern}$`);
}

/** First matching rewrite wins — same semantics Vercel uses. */
function destinationFor(pathname) {
  const rule = vercelConfig.rewrites.find((r) => sourceToRegExp(r.source).test(pathname));
  return rule?.destination;
}

describe("vercel.json rewrites route every real API call the frontend makes", () => {
  it.each([
    ["/api/merchant-rules", "GET/POST — list and create"],
    ["/api/merchant-rules/507f1f77bcf86cd799439011", "DELETE/PUT — the bug: this fell through to /index.html"],
  ])("%s (%s) reaches /api/data, not the SPA catch-all", (pathname) => {
    expect(destinationFor(pathname)).toBe("/api/data");
  });

  it("/api/savings (GET/PUT/DELETE — no rewrite existed at all) reaches /api/data, not the SPA catch-all", () => {
    expect(destinationFor("/api/savings")).toBe("/api/data");
  });

  // Every route api/data.js actually implements (see its own routes
  // docblock) — exhaustive, not just the two paths this bug happened to
  // hit, so a *new* dynamic-id route added later without a matching
  // rewrite fails here instead of shipping broken to production.
  it.each([
    ["/api/files"],
    ["/api/files/507f1f77bcf86cd799439011"],
    ["/api/categories"],
    ["/api/categories/507f1f77bcf86cd799439011"],
    ["/api/merchant-rules"],
    ["/api/merchant-rules/507f1f77bcf86cd799439011"],
    ["/api/savings"],
  ])("%s reaches /api/data", (pathname) => {
    expect(destinationFor(pathname)).toBe("/api/data");
  });

  it.each([
    ["/api/categorize"],
    ["/api/parse-pdf"],
  ])("%s reaches /api/ai", (pathname) => {
    expect(destinationFor(pathname)).toBe("/api/ai");
  });

  it.each([
    ["/api/auth/login"],
    ["/api/auth/signup"],
    ["/api/auth/refresh"],
  ])("%s reaches /api/auth", (pathname) => {
    expect(destinationFor(pathname)).toBe("/api/auth");
  });
});
