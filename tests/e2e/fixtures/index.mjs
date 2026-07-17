import { test as base, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute paths to the small, committed sample files under fixtures/files/. */
export const FILES = {
  sampleCsv: path.join(__dirname, "files/sample-transactions.csv"),
  largeCsv: path.join(__dirname, "files/large-transactions.csv"), // 500 rows, ~17KB — bulk-data path, still well under limits
  emptyInvalidCsv: path.join(__dirname, "files/empty-invalid.csv"), // header only, no data rows
  invalidPdf: path.join(__dirname, "files/invalid-not-really-pdf.pdf"), // .pdf extension, not real PDF bytes
  validEmptyPdf: path.join(__dirname, "files/valid-no-transactions.pdf"), // real PDF, no statement-like text
};

/**
 * Programmatic transaction data — same shape POST /api/files expects,
 * mirroring fixtures/files/sample-transactions.csv's content. Used by tests
 * that need seeded data fast (via page.request, bypassing the upload UI)
 * because they're testing something *downstream* of upload (dashboard
 * rendering, categorization) rather than the upload mechanism itself, which
 * has its own dedicated tests in upload.spec.js.
 */
export const sampleTransactions = [
  { date: "2025-01-03", desc: "PAYROLL DEPOSIT", amount: 3200.0 },
  { date: "2025-01-05", desc: "WHOLE FOODS MARKET", amount: -87.32 },
  { date: "2025-01-07", desc: "NETFLIX.COM", amount: -15.49 },
  { date: "2025-01-09", desc: "SHELL OIL", amount: -42.1 },
  { date: "2025-01-12", desc: "STARBUCKS", amount: -6.75 },
  { date: "2025-01-15", desc: "AMAZON MKTP US", amount: -54.2 },
  { date: "2025-01-18", desc: "RENT PAYMENT", amount: -1800.0 },
  { date: "2025-01-20", desc: "UBER TRIP", amount: -18.4 },
  { date: "2025-01-22", desc: "CVS PHARMACY", amount: -23.15 },
  { date: "2025-01-28", desc: "SPOTIFY", amount: -11.99 },
];

let userCounter = 0;
/** Same pattern as tests/helpers.js's uniqueEmail() — one counter per worker process is fine since each Playwright worker is its own Node process. */
export function uniqueEmail() {
  userCounter += 1;
  return `e2e-${userCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

/**
 * Shared Playwright fixtures. Every test file should import `test`/`expect`
 * from here, never from "@playwright/test" directly — that's what makes
 * `authenticatedPage` (and any future shared fixture) available everywhere
 * without re-deriving login logic per file. See
 * docs/engineering-lessons/phase-6-testing.md, "Fixtures".
 */
export const test = base.extend({
  /**
   * Runs before every test, automatically (`auto: true` — no test needs to
   * request it by name). Resets the E2E server's shared, in-memory
   * rate-limit store via the test-only endpoint in tests/e2e/e2e-server.mjs.
   * Without this, tests that each create a real account (signup) exhaust
   * the real, intentional 5-signups/15min/IP limit against *each other*,
   * since — unlike Vitest, which gets a fresh store per test file — every
   * E2E test shares one long-lived server process for the whole run.
   */
  resetRateLimits: [
    async ({ page }, use) => {
      await page.request.post("/__e2e__/reset-rate-limits").catch(() => {});
      await use();
    },
    { auto: true },
  ],

  /** A fresh, unique set of signup credentials — one per test. */
  testUser: async ({}, use) => {
    await use({
      name: "E2E Test User",
      email: uniqueEmail(),
      password: "TestPass123!",
    });
  },

  /**
   * A `page` that is already signed in as a fresh user by the time the test
   * body runs. Signs up via a direct API request (page.request shares the
   * browser context's cookie jar, so the session this establishes is real
   * and immediately usable by the page) rather than driving the signup
   * *form* — the signup form itself has its own dedicated test
   * (auth.spec.js); re-driving it as setup for every other test would be
   * both slower and duplicated logic, exactly what this fixture exists to
   * avoid.
   */
  authenticatedPage: async ({ page, testUser }, use) => {
    const res = await page.request.post("/api/auth/signup", {
      data: { name: testUser.name, email: testUser.email, password: testUser.password },
    });
    if (!res.ok()) {
      throw new Error(`authenticatedPage fixture: signup failed (${res.status()}): ${await res.text()}`);
    }
    await page.goto("/");
    // The signup cookie being set doesn't mean the app has caught up: App.jsx
    // still runs its own mount-time fetchCurrentUser() check in a useEffect,
    // independent of navigation's "load" event. Returning right after goto()
    // handed back control before that check resolved, so a test that acted
    // immediately (e.g. going offline) could race it — on a slightly slower
    // device profile (found on the "mobile-chrome" project specifically,
    // deterministically) the in-flight check would fail *because* the test
    // had already gone offline, and the app's offline fail-safe then
    // rendered the signed-out screen despite a perfectly valid session.
    // Waiting for a definitively-authenticated element closes that race and
    // makes good on this fixture's own contract: "already signed in by the
    // time the test body runs."
    await page.getByRole("button", { name: /try with sample data/i }).waitFor({ state: "visible" });
    await use(page);
  },
});

/** Reads the (non-HttpOnly, by design — see docs/backend/authentication.md) CSRF cookie out of the page's browser context. */
export async function getCsrfToken(page) {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === "cc_csrf")?.value || "";
}

/**
 * Seeds an uploaded-statement document via a direct API call (same request
 * shape the real upload flow sends), for tests whose focus is *downstream*
 * of upload (dashboard, categorization) rather than the upload mechanism
 * itself. Requires an already-authenticated `page` (see `authenticatedPage`
 * fixture above) — reuses its session cookies and reads the real CSRF
 * cookie rather than bypassing CSRF protection.
 */
export async function seedTransactions(page, transactions = sampleTransactions, fileName = `e2e-seed-${Date.now()}.csv`) {
  const csrf = await getCsrfToken(page);
  const res = await page.request.post("/api/files", {
    headers: { "X-CSRF-Token": csrf },
    data: { fileName, statementType: "bank", transactions },
  });
  if (!res.ok()) {
    throw new Error(`seedTransactions: upload failed (${res.status()}): ${await res.text()}`);
  }
  return res.json();
}

export { expect };
