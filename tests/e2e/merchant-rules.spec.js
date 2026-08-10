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

  test("a rule created via reassignment on Categories' uncategorized bulk-assign appears here", async ({ authenticatedPage: page }) => {
    await seedTransactions(page, [
      { date: "2025-01-10", desc: "ZZQX UNMATCHED MERCHANT 42", amount: -19.99 },
      { date: "2025-01-11", desc: "WHOLE FOODS MARKET", amount: -40 },
    ]);
    await page.goto("/categories");
    await page.getByRole("checkbox", { name: "Select transaction" }).check();
    await page.getByRole("button", { name: "Move to Category" }).click();
    await page.getByRole("button", { name: "Groceries", exact: true }).click();

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

  test("a deleted rule stays deleted after a page reload", async ({ authenticatedPage: page }) => {
    const csrf = await getCsrfToken(page);
    await page.request.post("/api/merchant-rules", {
      headers: { "X-CSRF-Token": csrf },
      data: { merchantName: "acme coffee", category: "Dining" },
    });

    await page.goto("/merchant-rules");
    await expect(page.getByRole("cell", { name: "acme coffee", exact: true })).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete rule for acme coffee" }).click();
    await expect(page.getByText("No merchant rules yet")).toBeVisible();

    await page.reload();
    await expect(page.getByText("No merchant rules yet")).toBeVisible();
    await expect(page.getByRole("cell", { name: "acme coffee", exact: true })).not.toBeVisible();
  });

  test("a failed delete rolls back and shows an error, instead of silently disappearing", async ({ authenticatedPage: page }) => {
    const csrf = await getCsrfToken(page);
    await page.request.post("/api/merchant-rules", {
      headers: { "X-CSRF-Token": csrf },
      data: { merchantName: "acme coffee", category: "Dining" },
    });

    await page.goto("/merchant-rules");
    await expect(page.getByRole("cell", { name: "acme coffee", exact: true })).toBeVisible();

    // Simulate a failing DELETE without touching the real backend.
    await page.route("**/api/merchant-rules/*", (route) => {
      if (route.request().method() === "DELETE") return route.fulfill({ status: 500, body: "{}" });
      return route.continue();
    });

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete rule for acme coffee" }).click();

    await expect(page.getByText(/couldn't delete/i)).toBeVisible();
    await expect(page.getByRole("cell", { name: "acme coffee", exact: true })).toBeVisible();
  });

  test("edits a rule's category and it persists after reload", async ({ authenticatedPage: page }) => {
    const csrf = await getCsrfToken(page);
    await page.request.post("/api/merchant-rules", {
      headers: { "X-CSRF-Token": csrf },
      data: { merchantName: "acme coffee", category: "Dining" },
    });

    await page.goto("/merchant-rules");
    await expect(page.getByRole("cell", { name: "acme coffee", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Edit category for acme coffee" }).click();
    await page.getByRole("combobox").selectOption("Groceries");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("cell", { name: "Groceries" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("cell", { name: "Groceries" })).toBeVisible();
  });

  test("Merchant Rules is reached via Settings, not the bottom nav", async ({ authenticatedPage: page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Merchant Rules" })).toHaveCount(0);
    await page.getByRole("link", { name: "Manage Merchant Rules" }).click();
    await expect(page).toHaveURL(/\/merchant-rules$/);
  });
});
