/**
 * Same-origin server for Playwright E2E tests.
 *
 * Why same-origin (not Vite dev server + Express on separate ports, the way
 * `npm run dev:full` works): this app's entire auth model is HttpOnly
 * cross-origin-sensitive cookies (see docs/backend/authentication.md).
 * Serving the frontend and API from two different localhost ports makes
 * cookie behavior differ from production in ways that would make E2E tests
 * either unreliable or not actually representative. Production
 * (cash-canvas-sigma.vercel.app) serves everything from one origin — so
 * does this harness, using the exact same route handlers
 * (api/auth.js/api/data.js/api/ai.js) server.js and Vercel both use (see
 * ROADMAP.md ADR-001), plus the *production build* (dist/) for the
 * frontend, with a catch-all fallback to index.html mirroring vercel.json's
 * `/(.*) -> /index.html` rewrite.
 *
 * MongoDB: a fresh mongodb-memory-server instance, same pattern as
 * tests/vitest.setup.js — never the real Atlas cluster. Must be created and
 * MONGODB_URI set *before* importing any api/*.js module, since
 * api/_lib/db.js reads process.env.MONGODB_URI at import time, not lazily.
 */
import { MongoMemoryServer } from "mongodb-memory-server";

const mongod = await MongoMemoryServer.create();

process.env.MONGODB_URI = mongod.getUri();
process.env.JWT_SECRET = "e2e-test-secret-do-not-use-outside-tests";
process.env.NODE_ENV = "test"; // not "production" — cookies aren't Secure-only, matching plain http://localhost

// Same rationale as tests/vitest.setup.js: force the OTP/email/reCAPTCHA/Gemini
// paths off so E2E tests exercise the deterministic direct signup/login →
// session flow. reCAPTCHA already has dedicated *production* verification
// (see CHECKPOINT.md) proving it blocks non-browser/headless traffic —
// re-proving that here would just make every E2E test flaky against a live
// external service for no additional signal.
delete process.env.GMAIL_USER;
delete process.env.GMAIL_APP_PASSWORD;
delete process.env.RECAPTCHA_SECRET_KEY;
delete process.env.GEMINI_API_KEY;

const { default: express } = await import("express");
const { default: authHandler } = await import("../../api/auth.js");
const { default: dataHandler } = await import("../../api/data.js");
const { default: aiHandler } = await import("../../api/ai.js");
const { securityHeaders } = await import("../../api/_lib/security-headers.js");
const { _resetForTests: resetRateLimits } = await import("../../api/_lib/ratelimit.js");
const path = await import("node:path");
const { fileURLToPath } = await import("node:url");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../../dist");

const app = express();
app.use(securityHeaders);
app.use(express.json({ limit: "10mb" }));

app.all("/api/auth/*", authHandler);
app.all(
  ["/api/files", "/api/files/*", "/api/categories", "/api/categories/*", "/api/merchant-rules"],
  dataHandler
);
app.all(["/api/categorize", "/api/parse-pdf"], aiHandler);

/**
 * Test-only escape hatch, not a route that exists in api/*.js or production:
 * unlike Vitest (fresh in-memory rate-limit store per test file, reset in
 * `beforeEach` — see tests/*.test.js), every E2E test shares this ONE
 * long-lived server process and therefore ONE shared rate-limit store for
 * the whole run. Without a way to reset it, tests that legitimately create
 * several accounts (a real, working, intentional Phase 4 security feature —
 * 5 signups/15min/IP) start tripping 429s against *each other*, not against
 * anything actually being tested. This endpoint gives the Playwright side a
 * way to reset that shared state between tests, the same way `beforeEach`
 * does for Vitest — see tests/e2e/fixtures/index.mjs's autouse fixture.
 */
app.post("/__e2e__/reset-rate-limits", (req, res) => {
  resetRateLimits();
  res.json({ ok: true });
});

app.use(express.static(distDir));
// SPA catch-all, mirroring vercel.json's `{ "source": "/(.*)", "destination": "/index.html" }`.
app.get(/.*/, (req, res) => res.sendFile(path.join(distDir, "index.html")));

const port = process.env.E2E_PORT || 3100;
app.listen(port, () => {
  console.log(`E2E server ready → http://localhost:${port}`);
});
