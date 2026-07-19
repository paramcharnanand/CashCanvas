/** Page object for the upload/landing screen shown after login (src/App.jsx's UploadScreen). */
export class UploadPage {
  constructor(page) {
    this.page = page;
    // The visible dropzone is a div (onClick triggers the hidden input) —
    // the input itself is what Playwright's setInputFiles targets, and
    // works even though it's display:none (a standard, supported Playwright
    // capability for file inputs specifically).
    this.fileInput = page.locator('input[type="file"]');
    this.sampleDataButton = page.getByRole("button", { name: /try with sample data/i });
    // Sign Out/Delete Account moved off this screen's header onto /settings
    // in Phase 8.9 — see SettingsPage.mjs.
    this.errorBanner = (substring) => page.getByText(substring, { exact: false });
    this.fileHistoryCard = (fileName) => page.locator("div").filter({ hasText: fileName }).last();
  }

  async uploadFile(filePath) {
    await this.fileInput.setInputFiles(filePath);
  }

  async loadSampleData() {
    await this.sampleDataButton.click();
  }

  /** Clicks a file's "Remove" (×) button and accepts the native confirm() dialog. */
  async deleteFileFromHistory(fileName) {
    this.page.once("dialog", (dialog) => dialog.accept());
    const card = this.page.locator("div", { hasText: fileName }).filter({ has: this.page.locator('button[title="Remove"]') }).first();
    await card.locator('button[title="Remove"]').click();
  }
}
