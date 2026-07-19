/**
 * Page object for /settings (src/pages/SettingsPage.jsx). Sign Out and Delete
 * Account moved here in Phase 8.9 — they used to be page objects owned by
 * UploadPage/DashboardPage (the legacy gate/workspace headers), removed once
 * both headers' own copies were deleted (see ROADMAP.md's Phase 8.9
 * completion note).
 */
export class SettingsPage {
  constructor(page) {
    this.page = page;
    this.signOutButton = page.getByRole("button", { name: "Sign Out" });
    this.deleteAccountButton = page.getByRole("button", { name: "Delete Account" }).first();
    this.confirmDeleteAccountButton = page.getByRole("button", { name: "Delete Account" }).last();
  }

  async goto() {
    await this.page.goto("/settings");
  }

  /**
   * Signs out and waits for the actual server round-trip to finish, not just
   * the click event — AuthContext's logout() does `await apiLogout();
   * setAuth(null)` (the network call completes before local UI state
   * updates), so any code that clicks Sign Out and immediately
   * navigates/asserts without waiting for this response races against
   * still-authenticated state. Same rationale as the pre-Phase-8.9
   * UploadPage/DashboardPage.signOut() this replaces.
   */
  async signOut() {
    const [response] = await Promise.all([
      this.page.waitForResponse((r) => r.url().includes("/api/auth/logout") && r.request().method() === "POST"),
      this.signOutButton.click(),
    ]);
    return response;
  }
}
