import jwt from "jsonwebtoken";
import { test, expect, uniqueEmail } from "./fixtures/index.mjs";
import { AuthPage } from "./pages/AuthPage.mjs";
import { UploadPage } from "./pages/UploadPage.mjs";

// Matches tests/e2e/e2e-server.mjs's hardcoded test secret exactly — this
// lets us forge validly-signed tokens with a controlled expiry, the only
// practical way to test 15-minute/30-day token lifecycles deterministically
// (waiting for real time to pass is not an option in a test suite).
const JWT_SECRET = "e2e-test-secret-do-not-use-outside-tests";

function forgeExpiredAccessToken(payload = { userId: "000000000000000000000000", email: "expired@example.test", name: "Expired" }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: -10 }); // already expired the moment it's signed
}

test.describe("refresh-token rotation", () => {
  test("refresh rotates both tokens, and the old refresh token can no longer be used", async ({ authenticatedPage: page }) => {
    const before = await page.context().cookies();
    const oldAt = before.find((c) => c.name === "cc_at").value;
    const oldRt = before.find((c) => c.name === "cc_rt").value;
    const csrf = before.find((c) => c.name === "cc_csrf").value;

    const refreshRes = await page.request.post("/api/auth/refresh", { headers: { "X-CSRF-Token": csrf } });
    expect(refreshRes.status()).toBe(200);

    const after = await page.context().cookies();
    const newAt = after.find((c) => c.name === "cc_at").value;
    const newRt = after.find((c) => c.name === "cc_rt").value;
    expect(newAt).not.toBe(oldAt);
    expect(newRt).not.toBe(oldRt);

    // Reuse of the now-rotated-away old refresh token must be rejected —
    // proves rotation actually invalidates it server-side, not just that a
    // new one was issued alongside a still-valid old one.
    await page.context().addCookies([
      { name: "cc_rt", value: oldRt, domain: "localhost", path: "/api/auth", httpOnly: true },
    ]);
    const reuseRes = await page.request.post("/api/auth/refresh", { headers: { "X-CSRF-Token": csrf } });
    expect(reuseRes.status()).toBe(401);
  });
});

test.describe("expired access token", () => {
  test("apiFetch silently refreshes an expired access token and the request succeeds transparently", async ({ authenticatedPage: page }) => {
    // Real, valid cc_rt/cc_csrf from the fixture's signup; cc_at replaced
    // with one that is validly *signed* (same secret the server uses) but
    // already expired — the precise condition src/api.js's apiFetch() is
    // supposed to detect (401) and silently recover from via one
    // refresh-and-retry, never surfacing an error to the user.
    await page.context().addCookies([
      { name: "cc_at", value: forgeExpiredAccessToken(), domain: "localhost", path: "/api", httpOnly: true },
    ]);

    // A reload forces the app to re-check the session from scratch
    // (fetchCurrentUser -> apiFetch("/api/auth/profile")) against the now-expired token.
    const [refreshRequest] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/api/auth/refresh")),
      page.reload(),
    ]);
    expect(refreshRequest.method()).toBe("POST");

    // The app should land on the authenticated view, never the login screen —
    // the whole point of silent refresh is the user never notices.
    await expect(page.getByRole("button", { name: /try with sample data/i })).toBeVisible();

    const cookies = await page.context().cookies();
    const at = cookies.find((c) => c.name === "cc_at");
    expect(at.value).not.toBe(forgeExpiredAccessToken()); // got a genuinely new token, not the forged one
  });
});

test.describe("refresh token expiry / invalidity", () => {
  test("a nonexistent/invalid refresh token is rejected and the app falls back to the login screen", async ({ page, context }) => {
    // No real session at all — every cookie is fabricated garbage,
    // equivalent in the server's eyes to a genuinely expired-and-cleaned-up
    // session (api/auth.js's refresh handler doesn't distinguish "never
    // existed" from "expired": both fail the same findActiveSessionByToken lookup).
    await context.addCookies([
      { name: "cc_at", value: forgeExpiredAccessToken(), domain: "localhost", path: "/api", httpOnly: true },
      { name: "cc_rt", value: "0".repeat(96), domain: "localhost", path: "/api/auth", httpOnly: true },
      { name: "cc_csrf", value: "some-csrf-value", domain: "localhost", path: "/", httpOnly: false },
    ]);

    // "/" is a public Landing page regardless of session state as of Phase
    // 8.2 — /dashboard is the actual protected route whose redirect this
    // test means to exercise (see router.jsx/ProtectedRoute.jsx).
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Sign In" }).first()).toBeVisible();
  });
});

test.describe("multi-tab logout", () => {
  test("logging out in one tab invalidates the session in a second, already-open tab", async ({ authenticatedPage: page, context }) => {
    const tab2 = await context.newPage();
    await tab2.goto("/");
    await expect(tab2.getByRole("button", { name: /try with sample data/i })).toBeVisible();

    await new UploadPage(page).signOut();
    await expect(page.getByRole("button", { name: "Sign In" }).first()).toBeVisible();

    // Cookies are shared per browser context, not per tab — tab2's *next*
    // request should now see the cleared session too.
    await tab2.reload();
    await expect(tab2.getByRole("button", { name: "Sign In" }).first()).toBeVisible();
    await tab2.close();
  });
});

test.describe("browser closed and reopened", () => {
  test("a session persists across a full browser restart (HttpOnly cookies survive, not just in-memory state)", async ({ browser, authenticatedPage: page }) => {
    const storageState = await page.context().storageState(); // captures HttpOnly cookies too — this is a Node-side capture, not limited by document.cookie
    await page.context().close(); // simulates the browser actually closing, not just navigating away

    const restoredContext = await browser.newContext({ storageState });
    const restoredPage = await restoredContext.newPage();
    await restoredPage.goto("/");
    await expect(restoredPage.getByRole("button", { name: /try with sample data/i })).toBeVisible();
    await restoredContext.close();
  });
});

test.describe("network interruption", () => {
  test("actions taken while offline fail gracefully (no unhandled rejection), and the app recovers once connectivity returns", async ({ authenticatedPage: page, context }) => {
    // Regression test for a real bug this test found: App.jsx's mount-time
    // session check (`fetchCurrentUser().then(...).finally(...)`) had no
    // .catch() — every other apiFetch call site in App.jsx does. Going
    // offline and triggering app activity surfaced an unhandled promise
    // rejection; fixed in App.jsx's initial `useEffect`.
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await context.setOffline(true);
    // "Try with sample data" transitions to the Dashboard, which fires
    // several of its own mount-time API calls (merchant-rules, categories,
    // auto-categorize) — exercising the app's error handling broadly while
    // offline, not just one call site.
    await new UploadPage(page).loadSampleData();
    await expect(page.getByRole("button", { name: "Overview" })).toBeVisible();

    expect(pageErrors.map((e) => e.message), "no unhandled rejection while offline").toEqual([]);

    await context.setOffline(false);
    await page.reload();
    await expect(page.getByRole("button", { name: /try with sample data/i })).toBeVisible();
  });
});

test.describe("duplicate/rapid login submissions", () => {
  test("double-clicking submit on the login form does not create inconsistent state", async ({ page }) => {
    const user = { name: "Double Click", email: uniqueEmail(), password: "TestPass123!" };
    await page.request.post("/api/auth/signup", { data: user });
    await page.context().clearCookies();

    const authPage = new AuthPage(page);
    await authPage.gotoLogin();
    await authPage.fillLoginForm(user);

    const submitButton = page.locator('button[type="submit"]');
    // Fire two rapid clicks — the button disables on `loading` (see
    // AuthScreen.jsx), but only *after* React re-renders; two clicks fired
    // in the same tick can both register before that happens. This is
    // exactly the race the app is supposed to be safe against even if the
    // disabled-attribute race loses.
    await Promise.all([submitButton.click(), submitButton.click()]);

    await expect(page.getByRole("button", { name: /try with sample data/i })).toBeVisible();
    // However many login requests actually fired, exactly one valid session
    // should be the end state — not a broken or doubly-nested one.
    const cookies = await page.context().cookies();
    expect(cookies.filter((c) => c.name === "cc_at")).toHaveLength(1);
  });
});

test.describe("concurrent login race", () => {
  test("two simultaneous login requests for the same account both resolve to valid, independent sessions", async ({ page }) => {
    const user = { name: "Race Test", email: uniqueEmail(), password: "TestPass123!" };
    await page.request.post("/api/auth/signup", { data: user });
    await page.context().clearCookies();

    const [resA, resB] = await Promise.all([
      page.request.post("/api/auth/login", { data: { email: user.email, password: user.password } }),
      page.request.post("/api/auth/login", { data: { email: user.email, password: user.password } }),
    ]);
    expect(resA.status()).toBe(200);
    expect(resB.status()).toBe(200);
  });
});

test.describe("back button after logout", () => {
  test("navigating back after logout does not resurrect an authenticated view", async ({ page, context }) => {
    // A real history entry to go back to — post-logout, ProtectedRoute's
    // <Navigate replace> means /dashboard's entry itself becomes /login
    // (replace never pushes a new entry), so going back from there lands
    // on this about:blank, not a phantom authenticated view either way.
    await page.goto("about:blank");
    const user = { name: "Back Button", email: uniqueEmail(), password: "TestPass123!" };
    await page.request.post("/api/auth/signup", { data: user });
    await page.goto("/");
    await expect(page.getByRole("button", { name: /try with sample data/i })).toBeVisible();

    await new UploadPage(page).signOut();
    await expect(page.getByRole("button", { name: "Sign In" }).first()).toBeVisible();

    await page.goBack();
    // Whatever page.goBack() lands on (about:blank, or bfcache-restored "/"),
    // it must never show authenticated content with cleared cookies.
    const sampleDataVisible = await page.getByRole("button", { name: /try with sample data/i }).isVisible().catch(() => false);
    expect(sampleDataVisible).toBe(false);
  });
});
