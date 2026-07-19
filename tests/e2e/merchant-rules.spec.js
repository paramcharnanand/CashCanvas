import { test, expect, seedTransactions, getCsrfToken } from "./fixtures/index.mjs";

/**
 * Covers the new `/merchant-rules` route (Phase 8.8, `src/pages/
 * MerchantRulesPage.jsx`) — a genuinely new management screen (approved
 * scope addition, per docs/frontend/phase-8-migration-plan.md's Phase 8)
 * for data that already existed (`POST /api/merchant-rules`, written by
 * every category reassignment since well before Phase 8) with no way to
 * view or remove it until now.
 */
test.describe("merchant rules page", () => {
  test("requires authentication — an unauthenticated visitor is redirected to sign in", async ({ page }) => {
    await page.goto("/merchant-rules");
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows an empty state when no rules exist yet", async ({ authenticatedPage: page }) => {
    await page.goto("/merchant-rules");
    await expect(page.getByText("No merchant rules yet")).toBeVisible();
  });

  test("a rule created via reassignment on Categories' uncategorized quick-fix appears here", async ({ authenticatedPage: page }) => {
    await seedTransactions(page, [
      { date: "2025-01-10", desc: "ZZQX UNMATCHED MERCHANT 42", amount: -19.99 },
      { date: "2025-01-11", desc: "WHOLE FOODS MARKET", amount: -40 },
    ]);
    await page.goto("/categories");
    await page.getByRole("button", { name: "Groceries" }).click();

    await page.goto("/merchant-rules");
    await expect(page.getByRole("cell", { name: "zzqx unmatched merchant 42", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Groceries" })).toBeVisible();
  });

  test("deletes a rule", async ({ authenticatedPage: page }) => {
    const csrf = await getCsrfToken(page);
    await page.request.post("/api/merchant-rules", {
      headers: { "X-CSRF-Token": csrf },
      data: { merchantName: "acme coffee", category: "Dining" },
    });

    await page.goto("/merchant-rules");
    // "acme coffee" matches both the merchant-name cell and (via its
    // accessible name) the delete button's own enclosing cell — scope to
    // an exact match on the plain text cell specifically.
    await expect(page.getByRole("cell", { name: "acme coffee", exact: true })).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete rule for acme coffee" }).click();

    await expect(page.getByText("No merchant rules yet")).toBeVisible();
  });

  test("Merchant Rules is a real, always-visible nav destination", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Merchant Rules" }).click();
    await expect(page).toHaveURL(/\/merchant-rules$/);
  });
});
