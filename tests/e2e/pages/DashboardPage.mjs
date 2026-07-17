/** Page object for the post-upload dashboard (src/App.jsx's Dashboard). */
export class DashboardPage {
  constructor(page) {
    this.page = page;
    this.overviewTab = page.getByRole("button", { name: "Overview" });
    this.categoriesTab = page.getByRole("button", { name: "Categories" });
    this.savingsTab = page.getByRole("button", { name: "Savings" });
    // "Transactions" isn't in the visible tab bar — it's only reachable by
    // clicking a stat card (see App.jsx's StatCard onClick), matching the
    // real user path rather than a URL/state shortcut.
    this.transactionsStatCard = page.getByText("Transactions", { exact: true }).first();
    this.newUploadButton = page.getByRole("button", { name: /new upload/i });
    this.signOutButton = page.getByRole("button", { name: "Sign Out" });
    this.deleteAccountButton = page.getByRole("button", { name: "Delete Account" });
  }

  async goToTransactions() {
    await this.transactionsStatCard.click();
  }

  /** See UploadPage.signOut() — same rationale, same fix, both screens have their own Sign Out button. */
  async signOut() {
    const [response] = await Promise.all([
      this.page.waitForResponse((r) => r.url().includes("/api/auth/logout") && r.request().method() === "POST"),
      this.signOutButton.click(),
    ]);
    return response;
  }
}
