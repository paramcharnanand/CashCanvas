import { test, expect } from "./fixtures/index.mjs";

test.describe("homepage", () => {
  // As of Phase 8.2, "/" is a real marketing Landing page, not the login
  // form directly (see src/pages/LandingPage.jsx) — this replaces the old
  // assertion here. The actual "an unauthenticated visitor can reach the
  // sign-in form" intent that assertion covered is exercised by the two
  // tests below instead (clicking through, and the direct /login route).
  test("loads and shows the landing page when signed out", async ({ page }) => {
    const response = await page.goto("/");
    expect(response.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Both CTAs appear twice by design — once in the top nav, once again as
    // the hero's own primary/secondary actions — same "first of several
    // identically-labeled controls" pattern already used throughout
    // auth.spec.js for the Sign In/Create Account tab+submit-button pair.
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Get started" }).first()).toBeVisible();
  });

  test("clicking Sign in from the landing page reaches the real sign-in form", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Sign in" }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Sign In" }).first()).toBeVisible();
  });

  test("/login and /signup work as direct deep links, not just via the landing page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();

    await page.goto("/signup");
    await expect(page.getByPlaceholder("Your name")).toBeVisible();
  });

  test("shows the upload screen instead of the auth screen for an authenticated session", async ({ authenticatedPage }) => {
    // authenticatedPage already navigated to "/" post-signup — proves the
    // fixture itself (Playwright config + e2e-server.mjs + real signup +
    // cookie persistence) works end-to-end, not just that this one
    // assertion passes. (This used to also assert the header's own Sign Out
    // button was visible — that control moved to /settings in Phase 8.9,
    // see ROADMAP.md's Phase 8.9 completion note, and its replacement,
    // identity-only display, is conditionally hidden below the --bp-md
    // breakpoint, so it isn't a reliable assertion across all 5 browser
    // projects here; "logout"/tests/e2e/auth.spec.js covers Sign Out
    // itself.)
    await expect(authenticatedPage.getByRole("button", { name: /try with sample data/i })).toBeVisible();
  });
});
