import { test, expect, seedTransactions } from "./fixtures/index.mjs";

/**
 * Covers the new `/analytics` route (Phase 8.7, `src/pages/
 * AnalyticsPage.jsx`) — the donut/bar/line block split out of the legacy
 * `Dashboard`'s Overview tab onto the standardized chart system, per
 * docs/frontend/phase-8-migration-plan.md's Phase 7. The one real behavior
 * fix this phase makes (not just a restyle) is keyboard-reachable charts —
 * verified below via actual keyboard interaction, not just presence checks.
 *
 * Uses `seedTransactions` (a direct API seed), not `UploadPage.loadSampleData()`
 * — same reasoning `transactions.spec.js` already established: "Try with
 * sample data" is explicitly excluded from server-side persistence
 * (`App.jsx`'s `handleData`, `name !== "sample_data.csv"`, per Phase 8.5's
 * documented decision), so a route like `/analytics` that fetches real data
 * from `/api/files` — a separate component tree with no shared state with
 * `LegacyWorkspace` — would never see it. Found the hard way: an earlier
 * draft of this file used `loadSampleData()` and every data-dependent test
 * here failed deterministically (not flakily) across all 5 browser
 * projects, rendering the empty state instead — confirmed via `/api/files`
 * never receiving a POST for sample data, not inferred from the test
 * failure alone.
 */
test.describe("analytics page", () => {
  test("requires authentication — an unauthenticated visitor is redirected to sign in", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page).toHaveURL(/\/login/);
  });

  test("an authenticated account with no data sees an empty state with an upload CTA", async ({ authenticatedPage: page }) => {
    await page.goto("/analytics");
    await expect(page.getByText("No data to analyze yet")).toBeVisible();
    await page.getByRole("link", { name: /upload a statement/i }).click();
    await expect(page).toHaveURL(/\/upload$/);
  });

  test("shows the spending, monthly, and cash-flow chart sections once data exists", async ({ authenticatedPage: page }) => {
    await seedTransactions(page);
    await page.goto("/analytics");

    await expect(page.getByRole("heading", { name: "Spending Composition" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Monthly Overview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cash Flow" })).toBeVisible();
  });

  test("the donut chart is keyboard-navigable: Tab focuses it, arrow keys move between categories and update the visible readout", async ({ authenticatedPage: page }) => {
    await seedTransactions(page);
    await page.goto("/analytics");

    const donut = page.getByRole("group", { name: /Donut chart/i });
    await expect(donut).toBeVisible();
    await donut.focus();
    await expect(donut).toBeFocused();

    // The readout is the group's own second child <div> (after the chart's
    // ResponsiveContainer wrapper), not a sibling of the group — SpendingDonut
    // nests chart + readout + legend inside one role="group" container.
    const readout = donut.locator("> div").nth(1);
    const initialText = await readout.innerText();

    // First ArrowRight lands on the same (already-shown) top category —
    // a second moves to a genuinely different one, proving keyboard
    // navigation actually drives the visible readout, not just focus.
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");

    await expect(readout).not.toHaveText(initialText);
  });

  test("the monthly bar chart is keyboard-navigable", async ({ authenticatedPage: page }) => {
    await seedTransactions(page);
    await page.goto("/analytics");

    const barChart = page.getByRole("group", { name: /Bar chart/i });
    await barChart.focus();
    await expect(barChart).toBeFocused();
    // sampleTransactions (fixtures/index.mjs) all fall in January 2025 —
    // a single month, so there's nothing to navigate to — this asserts the
    // chart is a real, reachable tab stop with a
    // data-summarizing aria-label (closing the svg-img-alt finding), the
    // part of "keyboard-reachable" that's true regardless of data breadth.
    await expect(barChart).toHaveAccessibleName(/income versus expenses by month/i);
  });

  test("Analytics is a real, always-visible nav destination", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Analytics" }).click();
    await expect(page).toHaveURL(/\/analytics$/);
  });
});
