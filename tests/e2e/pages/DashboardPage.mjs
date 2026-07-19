/**
 * Page object for /dashboard (src/pages/DashboardPage.jsx) — the real
 * authenticated landing as of Phase 10 (final cleanup): always reachable,
 * renders an empty state with an upload CTA and "Try with sample data"
 * when no data exists yet, or the Overview stats/recent-activity view once
 * it does. Replaces the pre-Phase-10 two-screen UploadScreen/Dashboard gate
 * pattern (`App.jsx`, deleted this phase).
 */
export class DashboardPage {
  constructor(page) {
    this.page = page;
    this.sampleDataButton = page.getByRole("button", { name: /try with sample data/i });
    this.uploadLink = page.getByRole("link", { name: "Upload a statement" });
    this.welcomeHeading = page.getByText("Welcome back", { exact: false });
  }

  async loadSampleData() {
    await this.sampleDataButton.click();
  }
}
