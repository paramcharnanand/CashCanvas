import { test, expect, seedTransactions, getCsrfToken } from "./fixtures/index.mjs";

/**
 * Covers the new `/savings` route (Phase 8.9, `src/pages/SavingsPage.jsx`) —
 * the legacy `Dashboard`'s Savings tab split out onto the standardized
 * component system, with the goal itself now actually persisted
 * (`GET/PUT/DELETE /api/savings`, closing ADR-007) instead of vanishing on
 * reload. The goal-form/cut-planner *logic* is unchanged from the legacy
 * tab (kept, not rewritten) — this suite exercises the one real behavior
 * change: persistence.
 */
test.describe("savings page", () => {
  test("requires authentication — an unauthenticated visitor is redirected to sign in", async ({ page }) => {
    await page.goto("/savings");
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows an empty state when no data has been uploaded yet", async ({ authenticatedPage: page }) => {
    await page.goto("/savings");
    await expect(page.getByText("No data to plan against yet")).toBeVisible();
  });

  test("clicking the Goal Name label focuses its input — regression test for an unassociated <label>", async ({ authenticatedPage: page }) => {
    // Field.jsx's <label> had no htmlFor/id pairing with its <input> until
    // this phase (found while writing this suite's own getByLabel() calls,
    // which don't resolve at all without a real programmatic association —
    // a real, pre-existing WCAG 4.1.2 gap affecting every form built on this
    // primitive since Phase 8.3, not just this page). Fixed at the source
    // via React's useId(); this proves the fix directly rather than relying
    // on getByLabel() elsewhere in this file to fail loudly if it regresses.
    await seedTransactions(page);
    await page.goto("/savings");
    await page.getByText("Goal Name", { exact: true }).click();
    await expect(page.getByPlaceholder("e.g., Emergency fund, Vacation, New car")).toBeFocused();
  });

  test("saving a goal persists it across a reload — the fix this phase makes", async ({ authenticatedPage: page }) => {
    await seedTransactions(page);
    await page.goto("/savings");
    await expect(page.getByRole("heading", { name: "Savings Goals" })).toBeVisible();

    await page.getByLabel("Goal Name").fill("Emergency fund");
    await page.getByLabel("Target Amount ($)").fill("5000");
    await page.getByLabel("Target Date").fill("2027-01-01");

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/savings") && r.request().method() === "PUT"),
      page.getByRole("button", { name: "Save Goal" }).click(),
    ]);
    expect(response.status()).toBe(200);
    await expect(page.getByText("Saved")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Goal Name")).toHaveValue("Emergency fund");
    await expect(page.getByLabel("Target Amount ($)")).toHaveValue("5000");
    await expect(page.getByLabel("Target Date")).toHaveValue("2027-01-01");
    await expect(page.getByText("Saved")).toBeVisible();
  });

  test("saving a goal again replaces the previous one, not just locally but on the server", async ({ authenticatedPage: page }) => {
    await seedTransactions(page);
    const csrf = await getCsrfToken(page);
    await page.request.put("/api/savings", {
      headers: { "X-CSRF-Token": csrf },
      data: { name: "Vacation", amount: 2000, deadline: "2026-06-01" },
    });

    await page.goto("/savings");
    await expect(page.getByLabel("Goal Name")).toHaveValue("Vacation");

    await page.getByLabel("Goal Name").fill("New car");
    await page.getByLabel("Target Amount ($)").fill("15000");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/savings") && r.request().method() === "PUT"),
      page.getByRole("button", { name: "Save Goal" }).click(),
    ]);

    await page.reload();
    await expect(page.getByLabel("Goal Name")).toHaveValue("New car");
    await expect(page.getByLabel("Target Amount ($)")).toHaveValue("15000");
  });

  test("shows the savings suggestion panel once a goal and real spending data both exist", async ({ authenticatedPage: page }) => {
    await seedTransactions(page);
    await page.goto("/savings");

    await page.getByLabel("Goal Name").fill("Emergency fund");
    await page.getByLabel("Target Amount ($)").fill("5000");
    await page.getByLabel("Target Date").fill("2027-01-01");
    await page.getByRole("button", { name: "Save Goal" }).click();

    await expect(page.getByText("Monthly Target")).toBeVisible();
    await expect(page.getByText("Avg Monthly Surplus")).toBeVisible();
    await expect(page.getByText("Feasibility")).toBeVisible();
  });

  test("Savings is a real, always-visible nav destination", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Savings" }).click();
    await expect(page).toHaveURL(/\/savings$/);
  });
});
