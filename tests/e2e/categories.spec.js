import { test, expect, seedTransactions, getCsrfToken } from "./fixtures/index.mjs";

/**
 * Covers the new `/categories` route (Phase 8.8, `src/pages/
 * CategoriesPage.jsx`) — the Categories tab split out of the legacy
 * `Dashboard` onto the standardized component system, per docs/frontend/
 * phase-8-migration-plan.md's Phase 8. Uses `seedTransactions` (a direct
 * API seed), not `UploadPage.loadSampleData()` — the exact trap Phase 8.7
 * found and fixed for /analytics: "Try with sample data" is excluded from
 * server-side persistence, so a route that fetches real data from
 * /api/files would never see it.
 */
test.describe("categories page", () => {
  test("requires authentication — an unauthenticated visitor is redirected to sign in", async ({ page }) => {
    await page.goto("/categories");
    await expect(page).toHaveURL(/\/login/);
  });

  test("an authenticated account with no data sees an empty state with an upload CTA", async ({ authenticatedPage: page }) => {
    await page.goto("/categories");
    await expect(page.getByText("No data to categorize yet")).toBeVisible();
    await page.getByRole("link", { name: /upload a statement/i }).click();
    await expect(page).toHaveURL(/\/upload$/);
  });

  test("auto-categorized transactions appear as category cards with correct totals", async ({ authenticatedPage: page }) => {
    await seedTransactions(page);
    await page.goto("/categories");

    // sampleTransactions' "WHOLE FOODS MARKET" -87.32 matches the built-in
    // Groceries keyword list (App.jsx's DEFAULT_CATEGORIES) — this proves
    // the built-in categories render as real cards, not just user-created
    // ones (the real gap found and fixed while building this hook: see
    // useCategoriesData.js's docblock).
    const groceries = page.getByText("Groceries", { exact: true }).first();
    await expect(groceries).toBeVisible();
    await expect(page.getByText("$87.32", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("100%", { exact: false })).toBeVisible(); // fully auto-categorized, 0 "Other"
  });

  test("creates a new category, persisted server-side and visible immediately", async ({ authenticatedPage: page }) => {
    await seedTransactions(page);
    await page.goto("/categories");

    await page.getByRole("button", { name: "New Category" }).click();
    await page.getByPlaceholder("e.g. Pet Care, Education...").fill("Pet Care");
    await page.getByRole("button", { name: "Create Category" }).click();

    // A brand-new category has no transactions or keywords yet, but it was
    // explicitly created by the user — it must render a card immediately,
    // with no refresh, so there's a way to add a keyword to it at all.
    // (Real bug found: the visibility rule that hides never-used *default*
    // categories from cluttering the grid was also hiding user-created
    // ones, which by definition start empty — a dead end, since the card
    // is the only UI that can ever add a keyword to it.)
    await expect(page.getByText("Pet Care", { exact: true })).toBeVisible();
    await expect(page.getByText("Pet Care", { exact: true })).toHaveCount(1);

    // The card is real, not just a label — a keyword can be added to it
    // immediately, closing the dead end the bug caused. Scoped to the
    // card itself (`CategoryCard` sets a distinguishing `border-left`
    // style on its `Card` wrapper) since "+ Add merchant" also repeats
    // once per pre-existing default-category card.
    const petCareCard = page.locator('div[style*="border-left"]', { hasText: "Pet Care" });
    await petCareCard.getByRole("button", { name: "+ Add merchant" }).click();
    await page.getByLabel("Add a keyword to Pet Care").fill("petsmart");
    await page.keyboard.press("Enter");
    await expect(petCareCard.getByText("petsmart", { exact: true })).toBeVisible();

    await expect.poll(async () => {
      const res = await page.request.get("/api/categories");
      const cats = await res.json();
      return cats.some((c) => c.categoryName === "Pet Care");
    }).toBe(true);
  });

  test("deletes a category", async ({ authenticatedPage: page }) => {
    // A built-in DEFAULT_CATEGORIES category (e.g. "Groceries") has no
    // apiCategories `_id` and, correctly, no delete button — only
    // user-created categories can be deleted (matches the legacy
    // Dashboard's own `{apiCat && <button>}` guard exactly). Create a real,
    // user-owned category with a keyword that matches a seeded transaction
    // so it renders as a visible, deletable card.
    const csrf = await getCsrfToken(page);
    await page.request.post("/api/categories", {
      headers: { "X-CSRF-Token": csrf },
      data: { categoryName: "Pet Care", keywords: ["zzqx"] },
    });
    await seedTransactions(page, [
      { date: "2025-01-10", desc: "ZZQX UNMATCHED MERCHANT 42", amount: -19.99 },
    ]);
    await page.goto("/categories");

    await expect(page.getByText("Pet Care", { exact: true }).first()).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete category Pet Care" }).click();

    await expect(page.getByText("Pet Care", { exact: true })).toHaveCount(0);
  });

  test("adds and removes a keyword on an existing category", async ({ authenticatedPage: page }) => {
    await seedTransactions(page);
    await page.goto("/categories");

    await page.getByRole("button", { name: "+ Add merchant" }).first().click();
    const input = page.getByPlaceholder("Type merchant name...");
    await input.fill("costco");
    await input.press("Enter");
    await expect(page.getByText("costco", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Remove keyword costco" }).click();
    await expect(page.getByText("costco", { exact: true })).not.toBeVisible();
  });

  test("bulk-assigning an uncategorized transaction persists a merchant rule, visible on the Merchant Rules page", async ({ authenticatedPage: page }) => {
    // One transaction matches a built-in category and one matches no
    // DEFAULT_CATEGORIES keyword at all, guaranteeing it lands in "Other"
    // (uncategorized) — the only row with a "Select transaction" checkbox.
    await seedTransactions(page, [
      { date: "2025-01-10", desc: "ZZQX UNMATCHED MERCHANT 42", amount: -19.99 },
      { date: "2025-01-11", desc: "WHOLE FOODS MARKET", amount: -40 },
    ]);
    await page.goto("/categories");

    await expect(page.getByText("Uncategorized Transactions")).toBeVisible();
    await expect(page.getByText("ZZQX UNMATCHED MERCHANT 42")).toBeVisible();

    await page.getByRole("checkbox", { name: "Select transaction" }).check();
    await page.getByRole("button", { name: "Move to Category" }).click();
    await page.getByRole("button", { name: "Groceries", exact: true }).click();
    await expect(page.getByText("ZZQX UNMATCHED MERCHANT 42")).not.toBeVisible();

    await page.goto("/merchant-rules");
    await expect(page.getByRole("cell", { name: "zzqx unmatched merchant 42", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Groceries" })).toBeVisible();
  });

  test("a learned merchant rule generalizes to real-world variants of the same merchant, not just the exact string", async ({ authenticatedPage: page }) => {
    // Teach the system "ZZQX BREW CO" → Groceries via the same bulk-assign
    // flow as the test above.
    await seedTransactions(page, [
      { date: "2025-01-10", desc: "ZZQX BREW CO #4521", amount: -19.99 },
      { date: "2025-01-11", desc: "WHOLE FOODS MARKET", amount: -40 },
    ]);
    await page.goto("/categories");
    await page.getByRole("checkbox", { name: "Select transaction" }).check();
    await page.getByRole("button", { name: "Move to Category" }).click();
    await page.getByRole("button", { name: "Groceries", exact: true }).click();
    await expect(page.getByText("ZZQX BREW CO #4521")).not.toBeVisible();

    // A later statement with real-world formatting variants of the same
    // merchant — different store number, different case, a trailing
    // descriptor word, and no store number at all — none of these are an
    // exact string match for the rule learned above ("zzqx brew co").
    // Every one should still land in Groceries automatically, with no
    // further quick-fix action, the moment the file is uploaded.
    await seedTransactions(page, [
      { date: "2025-02-01", desc: "Zzqx Brew Co #9081", amount: -12.5 },
      { date: "2025-02-02", desc: "ZZQX BREW CO", amount: -8.25 },
      { date: "2025-02-03", desc: "Zzqx Brew Co Reserve", amount: -15.0 },
    ], "second-statement.csv");

    await page.goto("/transactions");
    const rows = page.getByRole("row").filter({ hasNot: page.getByRole("columnheader") });
    await expect(rows).toHaveCount(3);
    for (const desc of ["Zzqx Brew Co #9081", "ZZQX BREW CO", "Zzqx Brew Co Reserve"]) {
      const row = rows.filter({ has: page.getByRole("cell", { name: desc, exact: true }) });
      await expect(row.getByRole("cell", { name: "Groceries", exact: true })).toBeVisible();
    }
  });

  test("selecting multiple uncategorized transactions and bulk-assigning them updates the panel and the Needs attention count", async ({ authenticatedPage: page }) => {
    await seedTransactions(page, [
      { date: "2025-01-10", desc: "ZZQX UNMATCHED MERCHANT 42", amount: -19.99 },
      { date: "2025-01-11", desc: "QWERTY LOCAL SHOP 7781", amount: -12.5 },
      { date: "2025-01-12", desc: "WHOLE FOODS MARKET", amount: -40 },
    ]);
    await page.goto("/categories");

    const checkboxes = page.getByRole("checkbox", { name: "Select transaction" });
    await expect(checkboxes).toHaveCount(2);
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await expect(page.getByText("2 selected")).toBeVisible();

    await page.getByRole("button", { name: "Move to Category" }).click();
    await page.getByRole("button", { name: "Groceries", exact: true }).click();

    await expect(page.getByText("ZZQX UNMATCHED MERCHANT 42")).not.toBeVisible();
    await expect(page.getByText("QWERTY LOCAL SHOP 7781")).not.toBeVisible();
    await expect(page.getByText("Everything's categorized")).toBeVisible();
  });

  test("creating a new category from the bulk-assign dialog assigns the selected transactions and persists after reload", async ({ authenticatedPage: page }) => {
    await seedTransactions(page, [
      { date: "2025-01-10", desc: "ZZQX UNMATCHED MERCHANT 42", amount: -19.99 },
      { date: "2025-01-11", desc: "WHOLE FOODS MARKET", amount: -40 },
    ]);
    await page.goto("/categories");

    await page.getByRole("checkbox", { name: "Select transaction" }).check();
    await page.getByRole("button", { name: "Move to Category" }).click();
    await page.getByPlaceholder("e.g. Pet Care, Education...").fill("Pet Care");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page.getByText("ZZQX UNMATCHED MERCHANT 42")).not.toBeVisible();
    await expect(page.getByText("Pet Care", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText("Pet Care", { exact: true })).toBeVisible();
    await expect(page.getByText("ZZQX UNMATCHED MERCHANT 42")).not.toBeVisible();
  });

  test("Categories is a real, always-visible nav destination", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Categories" }).click();
    await expect(page).toHaveURL(/\/categories$/);
  });
});
