import { test, expect, seedTransactions } from "./fixtures/index.mjs";

/**
 * Cross-page responsive-layout regressions — narrow-viewport specific, so
 * scoped to the mobile device projects only (see playwright.config.js's
 * mobile-chrome/mobile-safari projects, matching the pattern
 * settings.spec.js's Tab-order test already uses for viewport-conditional
 * assertions).
 */
test.describe("responsive layout", () => {
  test("StatCard values never visually truncate on a narrow viewport", async ({ authenticatedPage: page }) => {
    const viewport = page.viewportSize();
    test.skip(!viewport || viewport.width >= 768, "StatCard has room to spare above the md breakpoint");

    // Found via a real screenshot audit: at a 390px viewport, "$3,200.00"
    // truncated to "$3,20…" — StatCard's value text always renders at a
    // fixed 30px with overflow:hidden/text-overflow:ellipsis, and two
    // cards per row (flex-basis 160px) left too little width for it.
    await seedTransactions(page, [
      { date: "2025-01-03", desc: "PAYROLL DEPOSIT", amount: 3200.0 },
      { date: "2025-01-05", desc: "RENT PAYMENT", amount: -1800.0 },
    ]);
    await page.goto("/dashboard");
    await expect(page.getByText("Total Income")).toBeVisible();

    const values = page.locator("text=Total Income").locator("xpath=following-sibling::div[1]");
    const box = await values.first().boundingBox();
    const overflowing = await values.first().evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflowing, `StatCard value is clipped (box width ${box?.width})`).toBe(false);
    await expect(values.first()).toHaveText("$3,200.00");
  });

  test("no bottom mobile-nav label wraps to a second line", async ({ authenticatedPage: page }) => {
    const viewport = page.viewportSize();
    test.skip(!viewport || viewport.width >= 1024, "the sidebar, not the bottom nav, renders above the lg breakpoint");

    // Found via a real screenshot audit: "Merchant Rules" wrapped to two
    // lines in the bottom nav while every other (shorter) label stayed on
    // one — an equal-width flex row with 8 items has no room left for a
    // 14-character label at any of its siblings' font size.
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    await expect(nav).toBeVisible();

    const linkCount = await nav.locator("a").count();
    expect(linkCount, "expected the real nav item count, not an empty selector").toBeGreaterThanOrEqual(6);

    // The label is the anchor's last child node regardless of whether it's
    // a bare text node or wrapped in a <span> — selecting it directly (not
    // via a specific tag) keeps this test valid even if that markup detail
    // changes later. Compared by height, not `getClientRects().length`: on
    // some engines a Range over a single line of text still reports two
    // near-identical rects (sub-pixel rounding), so a count-based check
    // false-positives on every item regardless of real wrapping. A wrapped
    // label's range is roughly 2x as tall as an unwrapped one's — compare
    // each to the shortest (a guaranteed-unwrapped reference, since at
    // least one label always fits on one line) rather than parsing
    // computed line-height, which can report "normal" un-parseably.
    const heights = await nav.locator("a").evaluateAll((links) =>
      links.map((a) => {
        // eslint-disable-next-line no-undef -- runs in the browser page, not Node; tests/ is linted with Node-only globals.
        const range = document.createRange();
        range.selectNode(a.lastChild);
        return range.getBoundingClientRect().height;
      })
    );
    const shortest = Math.min(...heights);
    for (const height of heights) {
      expect(height, "a nav label wrapped onto more than one line").toBeLessThan(shortest * 1.5);
    }
  });

  test("adjacent bottom-nav labels never touch", async ({ authenticatedPage: page }) => {
    const viewport = page.viewportSize();
    test.skip(!viewport || viewport.width >= 1024, "the sidebar, not the bottom nav, renders above the lg breakpoint");

    // Found via a real screenshot audit: "Transactions" and "Analytics"
    // rendered with zero visible gap between them ("TransactionsAnalytics")
    // — the nav's flex container had no `gap`, so two labels each sized
    // close to their own column's width had no breathing room between them.
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation", { name: "Primary navigation" });

    const boxes = await nav.locator("a").evaluateAll((links) =>
      links.map((a) => {
        // eslint-disable-next-line no-undef -- runs in the browser page, not Node; tests/ is linted with Node-only globals.
        const range = document.createRange();
        range.selectNode(a.lastChild);
        const r = range.getBoundingClientRect();
        return { left: r.left, right: r.right };
      })
    );
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].left, "two adjacent nav labels touch or overlap").toBeGreaterThan(boxes[i - 1].right);
    }
  });

  test("bottom-nav items meet the 44px minimum touch-target height", async ({ authenticatedPage: page }) => {
    const viewport = page.viewportSize();
    test.skip(!viewport || viewport.width >= 1024, "the sidebar, not the bottom nav, renders above the lg breakpoint");

    await page.goto("/dashboard");
    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    await expect(nav).toBeVisible();

    const heights = await nav.locator("a").evaluateAll((links) => links.map((a) => a.getBoundingClientRect().height));
    for (const height of heights) {
      expect(height, "a bottom-nav item is shorter than the 44px minimum touch target").toBeGreaterThanOrEqual(44);
    }
  });

  test("Analytics' two chart cards stack instead of squeezing side by side on a narrow viewport", async ({ authenticatedPage: page }) => {
    const viewport = page.viewportSize();
    test.skip(!viewport || viewport.width >= 768, "there's room for two columns above the md breakpoint");

    // Found via a real screenshot audit: AnalyticsPage's chart row used a
    // hardcoded `display: grid, gridTemplateColumns: "1fr 1fr"` with no
    // narrow-viewport override, unlike every other two-panel layout in the
    // app (e.g. RecentActivity.jsx's flex+flexWrap). At 390px each card was
    // squeezed to ~155px, and inside it SpendingDonut's/MonthlyBarChart's
    // "space-between" readout row had no room for its own two spans on one
    // line — they wrapped and visually overlapped each other, rendering
    // real dollar amounts illegible.
    await seedTransactions(page, [
      { date: "2025-01-03", desc: "PAYROLL DEPOSIT", amount: 3200.0 },
      { date: "2025-01-05", desc: "WHOLE FOODS MARKET", amount: -87.32 },
      { date: "2025-01-18", desc: "RENT PAYMENT", amount: -1800.0 },
    ]);
    await page.goto("/analytics");
    await expect(page.getByText("Spending Composition")).toBeVisible();

    const donutCard = page.getByText("Spending Composition").locator("xpath=ancestor::div[contains(@style,\"border-radius\")][1]");
    const box = await donutCard.boundingBox();
    const pageWidth = viewport.width;
    expect(box.width, "chart card is squeezed into a side-by-side column instead of stacking").toBeGreaterThan(pageWidth * 0.7);
  });
});
