import { test, expect, sampleTransactions, seedTransactions } from "./fixtures/index.mjs";

/**
 * Covers the new `/transactions` route (Phase 8.6, `src/pages/
 * TransactionsPage.jsx`) — a real, bookmarkable route with client-side
 * search/filter/sort, replacing the pre-Phase-8 "only reachable via a
 * stat-card click" pattern, per docs/frontend/phase-8-migration-plan.md's
 * Phase 6. Uses `seedTransactions` (a direct API seed, not driving a real
 * upload) since these tests are about filter/sort/search behavior
 * downstream of upload, not the upload mechanism itself — that's
 * `upload.spec.js`'s job.
 */
test.describe("transactions page", () => {
  test("requires authentication — an unauthenticated visitor is redirected to sign in", async ({ page }) => {
    await page.goto("/transactions");
    await expect(page).toHaveURL(/\/login/);
  });

  test("an authenticated account with no data sees an empty state with an upload CTA", async ({ authenticatedPage: page }) => {
    await page.goto("/transactions");
    await expect(page.getByText("No transactions yet")).toBeVisible();
    await page.getByRole("link", { name: /upload a statement/i }).click();
    await expect(page).toHaveURL(/\/upload$/);
  });

  test("shows every seeded transaction with a real table", async ({ authenticatedPage: page }) => {
    await seedTransactions(page);
    await page.goto("/transactions");

    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByText(`${sampleTransactions.length} of ${sampleTransactions.length} transaction`, { exact: false })).toBeVisible();
    for (const t of sampleTransactions) {
      await expect(page.getByRole("cell", { name: t.desc })).toBeVisible();
    }
  });

  test("search filters results to matching descriptions only", async ({ authenticatedPage: page }) => {
    await seedTransactions(page);
    await page.goto("/transactions");

    await page.getByRole("textbox", { name: "Search transactions" }).fill("netflix");
    await expect(page.getByRole("cell", { name: "NETFLIX.COM" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "WHOLE FOODS MARKET" })).not.toBeVisible();
    await expect(page.getByText("1 of 10 transaction")).toBeVisible();
    // Debounced search still lands in the URL, once settled, for a real
    // bookmarkable/refreshable filtered view.
    await expect(page).toHaveURL(/[?&]q=netflix/);
  });

  test("category filter narrows results to only that category", async ({ authenticatedPage: page }) => {
    await seedTransactions(page);
    await page.goto("/transactions");

    const groceryRow = page.getByRole("row", { name: /WHOLE FOODS MARKET/i });
    // nth(3): select(0)/date(1)/desc(2)/category(3)/amount(4) — the
    // row-selection checkbox column (Phase 10 final cleanup) shifted every
    // column index by one.
    const category = await groceryRow.getByRole("cell").nth(3).innerText();

    await page.getByRole("combobox", { name: "Filter by category" }).selectOption(category);

    const rows = page.getByRole("row").filter({ hasNot: page.getByRole("columnheader") });
    // .selectOption() only waits for the <select>'s change event to fire,
    // not for React's resulting re-render of the filtered table — a bare
    // rows.count() right after it can capture a stale, pre-filter count.
    // toHaveCount() auto-retries until the count actually settles (any
    // value other than the original, unfiltered 10), a deterministic wait
    // instead of a fixed sleep.
    await expect(rows).not.toHaveCount(sampleTransactions.length);
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i).getByRole("cell").nth(3)).toHaveText(category);
    }
  });

  test("search and category filters compose (both narrow the same result set)", async ({ authenticatedPage: page }) => {
    await seedTransactions(page);
    await page.goto("/transactions");

    const groceryRow = page.getByRole("row", { name: /WHOLE FOODS MARKET/i });
    // nth(3): select(0)/date(1)/desc(2)/category(3)/amount(4) — the
    // row-selection checkbox column (Phase 10 final cleanup) shifted every
    // column index by one.
    const category = await groceryRow.getByRole("cell").nth(3).innerText();
    await page.getByRole("combobox", { name: "Filter by category" }).selectOption(category);
    await page.getByRole("textbox", { name: "Search transactions" }).fill("whole foods");

    await expect(page.getByRole("cell", { name: "WHOLE FOODS MARKET" })).toBeVisible();
    await expect(page.getByText("1 of 10 transaction")).toBeVisible();
  });

  test("clearing filters restores the full, unfiltered list", async ({ authenticatedPage: page }) => {
    await seedTransactions(page);
    await page.goto("/transactions");

    await page.getByRole("textbox", { name: "Search transactions" }).fill("netflix");
    await expect(page.getByText("1 of 10 transaction")).toBeVisible();

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText("10 of 10 transaction")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Search transactions" })).toHaveValue("");
  });

  test("sort is a real query param that survives a page refresh", async ({ authenticatedPage: page }) => {
    await seedTransactions(page);
    await page.goto("/transactions");

    await page.getByRole("combobox", { name: "Sort by" }).selectOption("amount-desc");
    await expect(page).toHaveURL(/[?&]sort=amount-desc/);

    // Highest amount in sampleTransactions is the +3200 payroll deposit.
    const firstDataRow = page.getByRole("row").filter({ hasNot: page.getByRole("columnheader") }).first();
    await expect(firstDataRow.getByRole("cell", { name: "PAYROLL DEPOSIT" })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/[?&]sort=amount-desc/);
    await expect(page.getByRole("combobox", { name: "Sort by" })).toHaveValue("amount-desc");
    const firstRowAfterReload = page.getByRole("row").filter({ hasNot: page.getByRole("columnheader") }).first();
    await expect(firstRowAfterReload.getByRole("cell", { name: "PAYROLL DEPOSIT" })).toBeVisible();
  });

  test("reassigning one transaction also updates other loaded transactions from the same merchant, without a reload", async ({ authenticatedPage: page }) => {
    // "STARBUCKS STORE 123" and "STARBUCKS 04891" both clean to the same
    // merchant name — reassigning the selected one should retroactively
    // patch the unselected one too, since the merchant rule now covers both.
    await seedTransactions(page, [
      { date: "2025-01-05", desc: "STARBUCKS STORE 123", amount: -6.75 },
      { date: "2025-01-12", desc: "STARBUCKS 04891", amount: -5.5 },
    ]);
    await page.goto("/transactions");

    const starbucksRow = page.getByRole("row", { name: /STARBUCKS STORE 123/ });
    await starbucksRow.getByRole("checkbox", { name: "Select transaction" }).check();
    await page.getByRole("button", { name: "Reassign Category" }).click();
    await page.getByRole("button", { name: "Housing", exact: true }).click();

    await expect(page.getByRole("row", { name: /STARBUCKS STORE 123/ }).getByRole("cell", { name: "Housing" })).toBeVisible();
    await expect(page.getByRole("row", { name: /STARBUCKS 04891/ }).getByRole("cell", { name: "Housing" })).toBeVisible();
  });

  test("reassigning one transaction recategorizes same-merchant transactions that only match via the fuzzy/prefix tier, without a reload", async ({ authenticatedPage: page }) => {
    // Unlike the test above (both clean to the identical string
    // "starbucks"), these two clean to different full strings ("acme
    // coffee roasters downtown" vs. "...airport") — only the tiered match
    // (2-word/token/prefix/fuzzy) bridges them, not strict equality.
    await seedTransactions(page, [
      { date: "2025-01-10", desc: "ACME COFFEE ROASTERS DOWNTOWN", amount: -6.5 },
      { date: "2025-01-11", desc: "ACME COFFEE ROASTERS AIRPORT", amount: -7.25 },
    ]);
    await page.goto("/transactions");

    const firstRow = page.getByRole("row", { name: /ACME COFFEE ROASTERS DOWNTOWN/ });
    await firstRow.getByRole("checkbox", { name: "Select transaction" }).check();
    await page.getByRole("button", { name: "Reassign Category" }).click();
    await page.getByRole("button", { name: "Dining", exact: true }).click();

    await expect(page.getByRole("row", { name: /ACME COFFEE ROASTERS DOWNTOWN/ }).getByRole("cell", { name: "Dining" })).toBeVisible();
    await expect(page.getByRole("row", { name: /ACME COFFEE ROASTERS AIRPORT/ }).getByRole("cell", { name: "Dining" })).toBeVisible();
  });

  test("\"By Category\" view groups transactions under real category headings, with Other last", async ({ authenticatedPage: page }) => {
    await seedTransactions(page, [
      ...sampleTransactions,
      { date: "2025-01-31", desc: "ZZQX UNMATCHED MERCHANT 42", amount: -19.99 },
    ]);
    await page.goto("/transactions");
    await page.getByRole("button", { name: "By Category" }).click();

    const headingTexts = await page.getByRole("heading", { level: 2 }).allTextContents();
    expect(headingTexts).toContain("Groceries");
    expect(headingTexts).toContain("Housing");
    expect(headingTexts.at(-1)).toBe("Other"); // uncategorized always last, regardless of its total

    const otherGroup = page.getByRole("heading", { name: "Other", exact: true }).locator("xpath=ancestor::div[2]");
    await expect(otherGroup.getByRole("cell", { name: "ZZQX UNMATCHED MERCHANT 42" })).toBeVisible();
  });

  test("\"By Category\" view (?view=category) persists across a page refresh, same as sort", async ({ authenticatedPage: page }) => {
    await seedTransactions(page);
    await page.goto("/transactions");
    await page.getByRole("button", { name: "By Category" }).click();
    await expect(page).toHaveURL(/[?&]view=category/);
    await expect(page.getByRole("heading", { name: "Groceries", exact: true })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/[?&]view=category/);
    await expect(page.getByRole("heading", { name: "Groceries", exact: true })).toBeVisible();

    // Switching back to Flat drops the param and restores the single table
    // (toHaveCount, not toBeVisible — this locator legitimately matches
    // multiple <table>s while the category-grouped view is still mid-render).
    await page.getByRole("button", { name: "Flat", exact: true }).click();
    await expect(page).not.toHaveURL(/[?&]view=category/);
    await expect(page.getByRole("table")).toHaveCount(1);
  });

  test("Transactions is reached via \"View All Transactions\" on Categories, not the bottom nav", async ({ authenticatedPage: page }) => {
    await seedTransactions(page);
    await page.goto("/categories");
    await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Transactions" })).toHaveCount(0);
    await page.getByRole("link", { name: "View All Transactions" }).click();
    await expect(page).toHaveURL(/\/transactions$/);
  });
});
