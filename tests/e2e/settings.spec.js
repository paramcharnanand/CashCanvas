import { test, expect } from "./fixtures/index.mjs";

/**
 * Covers the new `/settings` route (Phase 8.9, `src/pages/SettingsPage.jsx`)
 * — a genuinely new screen (audit finding: no Settings, no Profile screen
 * existed at all). Consolidates account info, the theme toggle, sign out,
 * and delete account — the last two moved off the legacy `Dashboard`/
 * `UploadScreen` header's bare buttons (see ROADMAP.md's Phase 8.9
 * completion note); Delete Account's own full delete flow is covered by
 * `auth.spec.js`'s "account deletion" test, not duplicated here.
 */
test.describe("settings page", () => {
  test("requires authentication — an unauthenticated visitor is redirected to sign in", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows the signed-in user's name and email, read-only", async ({ authenticatedPage: page, testUser }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText(testUser.name).first()).toBeVisible();
    await expect(page.getByText(testUser.email)).toBeVisible();
  });

  test("theme toggle switches the active theme and persists it across a reload", async ({ authenticatedPage: page }) => {
    await page.goto("/settings");
    // exact: true — Header.jsx's own theme-cycle button has an aria-label
    // ("Theme: Dark. Click to change.") that also contains "Dark" as a
    // substring, and getByRole's name matching is substring-based by
    // default.
    const darkButton = page.getByRole("button", { name: "Dark", exact: true });
    await expect(darkButton).toHaveAttribute("aria-pressed", "false");

    await darkButton.click();
    await expect(darkButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.reload();
    await expect(page.getByRole("button", { name: "Dark", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("theme options and session/danger-zone actions are keyboard-reachable via Tab", async ({ authenticatedPage: page }, testInfo) => {
    // WebKit/Safari's default Tab order skips plain <button> elements
    // entirely (falls back to <body>) unless the user has "Full Keyboard
    // Access" enabled system-wide — off by default, and Playwright's
    // bundled WebKit inherits the same default with no API to override it.
    // Confirmed via direct repro (Tab from a focused button lands on <body>,
    // not the next button) — not an app bug: every button here is a real,
    // semantic <button>, independently Enter/Space-operable once focused,
    // same as this project's existing Cmd+U/Cmd+D "browser-reserved in some
    // browsers" precedent (useKeyboardShortcuts.js) for a different
    // engine-level keyboard quirk outside the app's control.
    test.skip(testInfo.project.name === "webkit" || testInfo.project.name === "mobile-safari", "WebKit doesn't Tab-focus plain buttons by default");
    await page.goto("/settings");
    await page.getByRole("button", { name: "Light", exact: true }).focus();
    await page.keyboard.press("Tab"); // Dark
    await page.keyboard.press("Tab"); // System
    await page.keyboard.press("Tab"); // Manage Merchant Rules (the <a>)
    await expect(page.getByRole("link", { name: "Manage Merchant Rules" })).toBeFocused();
    await page.keyboard.press("Tab"); // Manage Merchant Rules (the <button> nested inside the <a>)
    await expect(page.getByRole("button", { name: "Manage Merchant Rules" })).toBeFocused();
    await page.keyboard.press("Tab"); // Sign Out
    await expect(page.getByRole("button", { name: "Sign Out" })).toBeFocused();
  });

  test("the delete-account dialog opens and can be cancelled without deleting anything", async ({ authenticatedPage: page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Delete Account" }).click();
    await expect(page.getByText("Delete your account?")).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Delete your account?")).not.toBeVisible();
    // Still authenticated — reloading doesn't bounce to /login.
    await page.reload();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("Merchant Rules is accessible from Settings", async ({ authenticatedPage: page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Merchant Rules" })).toBeVisible();
    await page.getByRole("link", { name: "Manage Merchant Rules" }).click();
    await expect(page).toHaveURL(/\/merchant-rules$/);
  });

  test("Settings is a real, always-visible nav destination", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("Ctrl+, navigates to Settings", async ({ authenticatedPage: page }) => {
    // useKeyboardShortcuts.js checks e.metaKey || e.ctrlKey, so Control+
    // triggers it identically regardless of OS/browser — no need to
    // simulate both modifiers.
    await page.goto("/dashboard");
    // keyboard.press() has no target element to auto-wait on (unlike
    // .click()), so it can fire before AppShell's useKeyboardShortcuts
    // effect has attached its listener — the same class of fixture-mount
    // race Phase 6 already found and fixed for authenticatedPage itself.
    // Wait for real mounted content first.
    await expect(page.getByRole("button", { name: /try with sample data/i })).toBeVisible();
    await page.keyboard.press("Control+,");
    await expect(page).toHaveURL(/\/settings$/);
  });
});
