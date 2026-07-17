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
    this.signOutButton = page.getByRole("button", { name: "Sign Out" });
    this.deleteAccountButton = page.getByRole("button", { name: "Delete Account" });
    this.errorBanner = (substring) => page.getByText(substring, { exact: false });
    this.fileHistoryCard = (fileName) => page.locator("div").filter({ hasText: fileName }).last();
  }

  async uploadFile(filePath) {
    await this.fileInput.setInputFiles(filePath);
  }

  async loadSampleData() {
    await this.sampleDataButton.click();
  }

  /**
   * Signs out and waits for the actual server round-trip to finish, not
   * just the click event — App.jsx's handleLogout does
   * `await apiLogout(); setAuth(null);` (the network call completes before
   * local UI state updates), so any code that clicks Sign Out and
   * immediately navigates/asserts without waiting for this response races
   * against still-authenticated state. This is the deterministic-wait
   * equivalent of an arbitrary sleep() — wait for the thing that actually
   * has to finish, not a fixed amount of time.
   */
  async signOut() {
    const [response] = await Promise.all([
      this.page.waitForResponse((r) => r.url().includes("/api/auth/logout") && r.request().method() === "POST"),
      this.signOutButton.click(),
    ]);
    return response;
  }

  /** Clicks a file's "Remove" (×) button and accepts the native confirm() dialog. */
  async deleteFileFromHistory(fileName) {
    this.page.once("dialog", (dialog) => dialog.accept());
    const card = this.page.locator("div", { hasText: fileName }).filter({ has: this.page.locator('button[title="Remove"]') }).first();
    await card.locator('button[title="Remove"]').click();
  }
}
