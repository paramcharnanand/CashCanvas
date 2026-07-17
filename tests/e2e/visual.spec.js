import { test, expect } from "./fixtures/index.mjs";

/**
 * Visual regression (snapshot testing) — see docs/engineering-lessons/phase-6-testing.md's
 * "Visual regression" section for what this is and isn't for.
 *
 * Deliberately scoped to structurally stable pages only (sign-in, create
 * account, the authenticated app shell before any data is loaded) — never
 * transaction lists, dashboard numbers, or the Recharts pie chart, all of
 * which either contain real dates/amounts that vary by run or animate on
 * mount, exactly the kind of content phase-6-testing.md calls out as a bad
 * fit for pixel snapshots.
 *
 * Chromium-only: running the same snapshot across 5 browser engines would
 * multiply baseline images 5x for a check whose entire value is "did *our*
 * markup/CSS change," not "do different rendering engines anti-alias fonts
 * identically" — cross-engine font/subpixel differences would be constant
 * false positives, not real regressions. `animations: "disabled"` removes
 * CSS-transition timing as another source of flakiness.
 */
test.describe("visual regression", () => {
  // browserName is "chromium" for both the "chromium" *and* "mobile-chrome"
  // projects (same engine, different viewport/device emulation) — project
  // name, not browserName, is what actually pins this to one baseline set.
  // The describe-level callback form of test.skip only receives fixtures,
  // not testInfo, so the project-name check has to run in a beforeEach
  // instead, where testInfo is a real argument.
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Visual snapshots run on the chromium project only — see file header.");
  });

  test("sign-in screen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Sign In" }).first()).toBeVisible();
    await expect(page).toHaveScreenshot("auth-sign-in.png", { animations: "disabled" });
  });

  test("create-account screen", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Create Account" }).first().click();
    await expect(page.getByPlaceholder("Your name")).toBeVisible();
    await expect(page).toHaveScreenshot("auth-create-account.png", { animations: "disabled" });
  });

  test("authenticated app shell, no data loaded", async ({ authenticatedPage: page }) => {
    await expect(page).toHaveScreenshot("app-shell-empty.png", { animations: "disabled" });
  });
});
