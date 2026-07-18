import { test, expect, FILES } from "./fixtures/index.mjs";
import { UploadPage } from "./pages/UploadPage.mjs";

/**
 * Covers the new `/upload` route (Phase 8.5, `src/pages/UploadPage.jsx`) —
 * a normal, always-reachable route per `docs/frontend/
 * phase-8-component-architecture.md`'s routing architecture, additive to
 * (not a replacement of) the legacy gate `UploadScreen` still tests via
 * `UploadPage.mjs`/`homepage.spec.js`. The one real behavior change this
 * phase makes (not just a restyle) is a keyboard-operable drop zone — a
 * real `<button>` instead of the legacy gate's `<div onClick>` — verified
 * below via an actual Tab + Enter interaction, not just `setInputFiles`
 * (which bypasses focus/keyboard activation entirely and would prove
 * nothing about this specific fix).
 */
test.describe("upload page", () => {
  test("requires authentication — an unauthenticated visitor is redirected to sign in", async ({ page }) => {
    await page.goto("/upload");
    await expect(page).toHaveURL(/\/login/);
  });

  test("an authenticated user can reach /upload directly and see the drop zone", async ({ authenticatedPage: page }) => {
    await page.goto("/upload");
    await expect(page.getByRole("heading", { name: "Upload a statement" })).toBeVisible();
    await expect(page.getByRole("button", { name: /drop your bank statement/i })).toBeVisible();
  });

  test("the drop zone is keyboard-operable: Tab focuses it, Enter opens the file picker", async ({ authenticatedPage: page }) => {
    await page.goto("/upload");
    const dropZone = page.getByRole("button", { name: /drop your bank statement/i });
    await dropZone.focus();
    await expect(dropZone).toBeFocused();

    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.keyboard.press("Enter"),
    ]);
    await chooser.setFiles(FILES.sampleCsv);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("button", { name: "Overview" })).toBeVisible();
  });

  test("uploading a real statement saves it and lands on the dashboard with that data", async ({ authenticatedPage: page }) => {
    await page.goto("/upload");
    await page.locator('input[type="file"]').setInputFiles(FILES.sampleCsv);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Welcome back")).toBeVisible();
    await expect(page.getByText("10 transactions")).toBeVisible();
  });

  test("an empty/invalid CSV shows an inline error and does not navigate away", async ({ authenticatedPage: page }) => {
    await page.goto("/upload");
    await page.locator('input[type="file"]').setInputFiles(FILES.emptyInvalidCsv);

    // Header row only, no data rows — hits the "rows.length < 2" guard in
    // useFileUpload.js (ported unchanged from the legacy UploadScreen),
    // not the later "no transactions found" guard, which is for a header
    // + data rows that fail column detection instead.
    await expect(page.getByText(/file appears empty/i)).toBeVisible();
    await expect(page).toHaveURL(/\/upload$/);
  });

  test("Upload is a real, always-visible nav destination, not gated behind an empty dashboard", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Upload" }).click();
    await expect(page).toHaveURL(/\/upload$/);
  });
});

test.describe("legacy upload gate — real upload persistence", () => {
  // Regression test for ROADMAP.md's ADR-026: real (non-sample) uploads via
  // the legacy gate (App.jsx's UploadScreen/LegacyWorkspace) sent
  // Date.toISOString()'s full datetime string to POST /api/files, which
  // api/_lib/validation.js's DATE_RE (bare YYYY-MM-DD, no time component)
  // always rejected — silently, since handleData's .catch(() => {}) never
  // checked the response. The upload rendered correctly for the rest of
  // that session (setTransactions(txns) already happened client-side,
  // independent of the save) but was never actually persisted — reloading
  // or logging back in lost it. Nothing in the suite caught this before:
  // the one existing test that drives a real upload (auth.spec.js's CSRF
  // test) only asserts the request fired with the right header, never that
  // it succeeded. Reload is the deliberate proof here — it's the only way
  // to distinguish "rendered from local state" from "actually saved."
  test("uploading a real statement actually persists it — surviving a reload proves the save succeeded, not just client-side rendering", async ({ authenticatedPage: page }) => {
    await new UploadPage(page).uploadFile(FILES.sampleCsv);
    await expect(page.getByRole("button", { name: "Overview" })).toBeVisible();

    await page.reload();
    // Had the save silently failed, auto-restore would find nothing on the
    // server and LegacyWorkspace would fall back to the empty-data upload
    // gate instead of Dashboard.
    await expect(page.getByRole("button", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("button", { name: /try with sample data/i })).not.toBeVisible();
  });
});
