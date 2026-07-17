import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. See tests/e2e/e2e-server.mjs for why this runs against a
 * same-origin production-build server (not the Vite dev server) and
 * docs/engineering-lessons/phase-6-testing.md for the reasoning behind the
 * rest of these choices.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // a stray .only committed by accident shouldn't silently skip the rest of the suite in CI
  retries: process.env.CI ? 2 : 0, // retry flaky-looking failures in CI's noisier environment; fail fast locally so you see it immediately
  workers: process.env.CI ? 2 : undefined, // undefined = Playwright's own default (~half the machine's cores) locally
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: `http://localhost:${process.env.E2E_PORT || 3100}`,
    trace: "on-first-retry", // full trace only when something actually needed a retry — cheap by default, detailed when it matters
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
  ],

  // Builds the production bundle, then starts the same-origin E2E server
  // (tests/e2e/e2e-server.mjs) against it. reuseExistingServer means a dev
  // running tests repeatedly locally doesn't pay the build+boot cost every
  // time — only CI (and the first local run) does.
  webServer: {
    command: "npm run build && node tests/e2e/e2e-server.mjs",
    url: `http://localhost:${process.env.E2E_PORT || 3100}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
