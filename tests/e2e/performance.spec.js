import { test, expect } from "./fixtures/index.mjs";
import { UploadPage } from "./pages/UploadPage.mjs";

/**
 * Performance smoke tests — see docs/engineering-lessons/phase-6-testing.md's
 * "Smoke tests" section. These don't verify the dashboard's numbers are
 * correct or chase a fine-grained performance budget; they only catch "did
 * the whole thing catch fire" — a build regression that makes a page take
 * 10x longer to load, an accidentally-synchronous blocking call, etc.
 * Thresholds are deliberately generous (this runs against a local built
 * server on a dev machine, not production infrastructure under real
 * network conditions) so this stays a smoke test, not a flaky perf budget.
 */
test.describe("performance smoke tests", () => {
  test("homepage loads within a reasonable time", async ({ page }) => {
    const start = Date.now();
    const response = await page.goto("/");
    await page.getByRole("button", { name: "Sign In" }).first().waitFor({ state: "visible" });
    const elapsedMs = Date.now() - start;

    expect(response.status()).toBe(200);
    expect(elapsedMs, `homepage took ${elapsedMs}ms to become interactive`).toBeLessThan(5000);
  });

  test("dashboard loads within a reasonable time", async ({ authenticatedPage: page }) => {
    const start = Date.now();
    await new UploadPage(page).loadSampleData();
    await page.getByRole("button", { name: "Overview" }).waitFor({ state: "visible" });
    const elapsedMs = Date.now() - start;

    expect(elapsedMs, `dashboard took ${elapsedMs}ms to render after loading sample data`).toBeLessThan(5000);
  });

  test("core API endpoints respond promptly", async ({ authenticatedPage: page }) => {
    const endpoints = ["/api/auth/profile", "/api/files", "/api/categories", "/api/merchant-rules"];
    for (const url of endpoints) {
      const start = Date.now();
      const res = await page.request.get(url);
      const elapsedMs = Date.now() - start;
      expect(res.ok(), `${url} responded ${res.status()}`).toBe(true);
      expect(elapsedMs, `${url} took ${elapsedMs}ms`).toBeLessThan(2000);
    }
  });
});
