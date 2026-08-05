import { test, expect, seedTransactions, getCsrfToken } from "./fixtures/index.mjs";

/**
 * End-to-end proof of the "teach once, apply everywhere" merchant-learning
 * requirement: reassigning one merchant's transaction to a category must
 * cause every normalized variant of that merchant to classify the same way
 * on a *future, independent* upload — not just retroactively on the
 * transactions already on screen (that's transactions.spec.js's job) — and
 * that learned mapping must survive a real logout/login, not just in-memory
 * React state.
 */
test.describe("merchant learning", () => {
  test("a merchant rule learned from one variant auto-classifies other variants on a fresh upload, and survives logout/login", async ({ authenticatedPage: page, testUser }) => {
    await seedTransactions(page, [
      { date: "2025-01-05", desc: "STARBUCKS #0142", amount: -6.75 },
    ], "e2e-seed-initial.csv");
    await page.goto("/transactions");

    await page.getByRole("row", { name: /STARBUCKS #0142/ }).getByRole("checkbox", { name: "Select transaction" }).check();
    await page.getByRole("button", { name: "Reassign Category" }).click();
    await page.getByLabel("Create new category").fill("Coffee");
    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.getByRole("row", { name: /STARBUCKS #0142/ }).getByRole("cell", { name: "Coffee" })).toBeVisible();

    // A brand-new, independent upload — no transaction here was ever
    // manually reassigned. Only the persisted merchant_category_rules
    // record from above should drive its categorization.
    await seedTransactions(page, [
      { date: "2025-02-03", desc: "STARBUCKS STORE 532", amount: -5.25 },
      { date: "2025-02-10", desc: "STARBUCKS 1234", amount: -7.1 },
      { date: "2025-02-12", desc: "SHELL OIL", amount: -40.0 }, // unrelated control — must NOT become Coffee
    ], "e2e-seed-followup.csv");
    await page.goto("/transactions");

    await expect(page.getByRole("row", { name: /STARBUCKS STORE 532/ }).getByRole("cell", { name: "Coffee" })).toBeVisible();
    await expect(page.getByRole("row", { name: /STARBUCKS 1234/ }).getByRole("cell", { name: "Coffee" })).toBeVisible();
    await expect(page.getByRole("row", { name: /SHELL OIL/ }).getByRole("cell", { name: "Coffee" })).not.toBeVisible();

    // Persistence across a real logout/login, not just in-memory state.
    const csrf = await getCsrfToken(page);
    await page.request.post("/api/auth/logout", { headers: { "X-CSRF-Token": csrf } });
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Email" }).fill(testUser.email);
    await page.getByRole("textbox", { name: "Password" }).fill(testUser.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/transactions");
    await expect(page.getByRole("row", { name: /STARBUCKS STORE 532/ }).getByRole("cell", { name: "Coffee" })).toBeVisible();
    await expect(page.getByRole("row", { name: /STARBUCKS 1234/ }).getByRole("cell", { name: "Coffee" })).toBeVisible();
  });
});
