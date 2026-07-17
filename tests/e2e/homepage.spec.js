import { test, expect } from "./fixtures/index.mjs";

test.describe("homepage", () => {
  test("loads and shows the auth screen when signed out", async ({ page }) => {
    const response = await page.goto("/");
    expect(response.status()).toBe(200);
    await expect(page.getByRole("button", { name: "Sign In" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Account" }).first()).toBeVisible();
  });

  test("shows the upload screen instead of the auth screen for an authenticated session", async ({ authenticatedPage }) => {
    // authenticatedPage already navigated to "/" post-signup — proves the
    // fixture itself (Playwright config + e2e-server.mjs + real signup +
    // cookie persistence) works end-to-end, not just that this one
    // assertion passes.
    await expect(authenticatedPage.getByRole("button", { name: /try with sample data/i })).toBeVisible();
    await expect(authenticatedPage.getByRole("button", { name: "Sign Out" })).toBeVisible();
  });
});
