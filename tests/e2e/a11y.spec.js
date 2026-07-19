import { injectAxe, getViolations } from "axe-playwright";
import { test, expect, seedTransactions } from "./fixtures/index.mjs";
import { UploadPage } from "./pages/UploadPage.mjs";

/**
 * Accessibility scans via axe-core (Deque's engine, driven through
 * axe-playwright). See docs/engineering-lessons/phase-6-testing.md's
 * "Accessibility tests" section for what this is and isn't testing.
 *
 * Gate: only "critical"-impact violations fail the suite. ROADMAP.md has
 * tracked "zero accessibility attributes across the frontend" as known,
 * scoped-to-Phase-8 debt since the original Phase 1 audit — retroactively
 * rewriting App.jsx/AuthScreen.jsx markup to satisfy axe wholesale here
 * would be exactly the out-of-scope retrofit ADR-016 already declined to do
 * for ESLint's stricter rule set, for the same reason (a large, working,
 * already-shipped frontend that was never written against these rules).
 * "serious"/"moderate"/"minor" violations are still asserted on with a
 * fixed per-page allowlist below — not skipped — so this scan does its
 * actual job (make the known gap measurable, and catch *new* violations
 * beyond today's baseline) without failing CI on Phase 8's own backlog.
 * See ADR-019 in ROADMAP.md.
 */

/** Runs the scan and asserts against a known-violations allowlist by rule id. */
async function checkA11yAgainstBaseline(page, allowedRuleIds) {
  await injectAxe(page);
  const violations = await getViolations(page);

  const critical = violations.filter((v) => v.impact === "critical");
  expect(critical, `critical-impact a11y violations: ${critical.map((v) => v.id).join(", ")}`).toEqual([]);

  const unexpected = violations.filter((v) => !allowedRuleIds.includes(v.id));
  expect(
    unexpected,
    `a11y violations beyond the tracked baseline: ${unexpected.map((v) => `${v.id} (${v.impact})`).join(", ")}`
  ).toEqual([]);
}

test.describe("accessibility", () => {
  // "/" is a real Landing page as of Phase 8.2 (src/pages/LandingPage.jsx),
  // built on the Phase 8 design system's semantic <header>/<main>/<footer>
  // rather than AuthScreen.jsx's pre-Phase-8 markup — checked for real
  // against today's baseline rather than assumed clean.
  test("landing page has no unexpected a11y violations", async ({ page }) => {
    await page.goto("/");
    // LandingPage (like LoginPage/SignupPage) gates on an async authChecked
    // fetch before rendering, briefly showing LoadingScreen's unlabeled
    // <div>Loading…</div> — axe can race ahead of that resolving and flag
    // the transient loading state's own lack of a landmark, a real page
    // never actually shows to a user for more than an instant. Wait for the
    // real content first, same as homepage.spec.js's equivalent assertions.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await checkA11yAgainstBaseline(page, []);
  });

  test("sign-in screen has no unexpected a11y violations", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await checkA11yAgainstBaseline(page, ["color-contrast", "landmark-one-main", "page-has-heading-one", "region"]);
  });

  test("create-account screen has no unexpected a11y violations", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByPlaceholder("Your name")).toBeVisible();
    await checkA11yAgainstBaseline(page, ["color-contrast", "landmark-one-main", "page-has-heading-one", "region"]);
  });

  test("authenticated upload screen has no unexpected a11y violations", async ({ authenticatedPage: page }) => {
    await checkA11yAgainstBaseline(page, ["color-contrast"]);
  });

  test("dashboard (with data loaded) has no unexpected a11y violations", async ({ authenticatedPage: page }) => {
    await new UploadPage(page).loadSampleData();
    await expect(page.getByRole("button", { name: "Overview" })).toBeVisible();
    // As of Phase 8.7, the Recharts donut/bar/line block that used to live
    // here moved to its own /analytics route (see below) — the two
    // chart-specific findings this baseline used to carry (svg-img-alt,
    // scrollable-region-focusable) moved with it, not just gotten smaller
    // by coincidence.
    await checkA11yAgainstBaseline(page, ["color-contrast", "landmark-one-main", "region"]);
  });

  test("analytics page has no unexpected a11y violations", async ({ authenticatedPage: page }) => {
    // seedTransactions, not loadSampleData(): /analytics fetches real,
    // persisted data from /api/files (a separate route/component tree from
    // LegacyWorkspace) — "Try with sample data" is deliberately excluded
    // from server-side persistence (App.jsx's handleData, Phase 8.5), so it
    // would never reach this page. Same fix analytics.spec.js needed.
    await seedTransactions(page);
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    // Restyled onto the standardized chart system this phase — real
    // aria-labels and a keyboard-focusable container on every chart
    // directly fix the svg-img-alt/scrollable-region-focusable findings
    // the old Dashboard-embedded charts carried, rather than re-allowlisting
    // them at the new route. This is the second page in the app (after
    // Landing) whose a11y scan runs with a genuinely empty allowlist for
    // its own new content — "color-contrast"/"landmark-one-main"/"region"
    // are the same pre-existing, tracked shell-level debt every other
    // authenticated page still carries (ADR-019), not something this page
    // introduced.
    await checkA11yAgainstBaseline(page, ["color-contrast", "landmark-one-main", "region"]);
  });

  test("categories page has no unexpected a11y violations", async ({ authenticatedPage: page }) => {
    await seedTransactions(page);
    await page.goto("/categories");
    await expect(page.getByRole("heading", { name: "Categories" })).toBeVisible();
    await checkA11yAgainstBaseline(page, ["color-contrast", "landmark-one-main", "region"]);
  });

  test("merchant rules page has no unexpected a11y violations", async ({ authenticatedPage: page }) => {
    await page.goto("/merchant-rules");
    await expect(page.getByRole("heading", { name: "Merchant Rules" })).toBeVisible();
    await checkA11yAgainstBaseline(page, ["color-contrast", "landmark-one-main", "region"]);
  });
});
