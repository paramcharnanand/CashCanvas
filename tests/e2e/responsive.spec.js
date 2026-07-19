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
    test.skip(!viewport || viewport.width >= 768, "the sidebar, not the bottom nav, renders above the md breakpoint");

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
});
