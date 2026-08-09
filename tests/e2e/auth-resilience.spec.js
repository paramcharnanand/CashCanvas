import jwt from "jsonwebtoken";
import { test, expect, uniqueEmail } from "./fixtures/index.mjs";
import { AuthPage } from "./pages/AuthPage.mjs";
import { DashboardPage } from "./pages/DashboardPage.mjs";
import { SettingsPage } from "./pages/SettingsPage.mjs";

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
    // A full page.reload() plus a real refresh-and-retry round trip is
    // heavier than most assertions here; under CI's contended runner
    // (ADR-014/CI-stability class) this occasionally needs more than the
    // default budget. test.slow() (3x timeout) gives real headroom.
    test.slow();
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

  test("concurrent requests against an expired access token share one refresh instead of racing it — the actual root cause of the too-frequent-logout bug", async ({ authenticatedPage: page }) => {
    // Reproduces the real-world trigger directly: most pages here fire
    // several apiFetch() calls in parallel on mount (e.g. Merchant Rules
    // loads /api/merchant-rules and /api/categories together). Before this
    // fix, each one independently 401'd on an expired access token and
    // independently POSTed /api/auth/refresh — api/auth.js's refresh
    // handler rotates the refresh token with an atomic compare-and-swap
    // *by design* (real reuse-detection, still tested and unchanged in
    // tests/auth.test.js), so only the first of those concurrent refresh
    // calls could ever succeed; the rest were treated as reused/compromised
    // tokens and cleared all three auth cookies — sometimes wiping out the
    // session the winning call had just re-established, forcing a full
    // logout (and, since login always requires a fresh OTP, a full
    // password+OTP cycle) in the middle of ordinary active use.
    test.slow();

    // Swap in an expired access token *without* a page.goto()/reload: a
    // full navigation would re-run AuthContext's own mount-time
    // fetchCurrentUser() check first, which would refresh the token all by
    // itself before Merchant Rules' own effect ever runs — serializing
    // away the exact race this test needs to exercise. A client-side nav
    // (clicking the real nav link, same as a user would) leaves
    // AuthContext untouched and lets Merchant Rules' mount effect be the
    // *first* thing to see the expired token, firing its two parallel
    // apiFetch calls (/api/merchant-rules, /api/categories) against it.
    await page.context().addCookies([
      { name: "cc_at", value: forgeExpiredAccessToken(), domain: "localhost", path: "/api", httpOnly: true },
    ]);

    const refreshRequests = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/auth/refresh")) refreshRequests.push(r);
    });

    await page.getByRole("link", { name: "Merchant Rules" }).click();

    // Real proof, not just a lucky outcome: exactly one refresh request
    // should ever have been sent, no matter how many parallel API calls
    // this page fired against the same expired token.
    await expect(page.getByText("No merchant rules yet")).toBeVisible();
    expect(refreshRequests.length).toBe(1);

    // Never bounced to login/OTP — the session survived the concurrent load intact.
    await expect(page).toHaveURL(/\/merchant-rules$/);
    await expect(page.getByRole("button", { name: "Sign In" })).not.toBeVisible();

    // Both of the page's parallel requests actually succeeded (not silently
    // left 401'd) — the empty state above already implies this, but assert
    // the categories fetch (the other parallel call) landed too by
    // confirming a session-scoped, authenticated request still works.
    const profileRes = await page.request.get("/api/auth/profile");
    expect(profileRes.ok()).toBe(true);
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

    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.signOut();
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
    // Regression test for a real bug this test found: AuthContext.jsx's
    // mount-time session check (`fetchCurrentUser().then(...).finally(...)`)
    // had no .catch() — every other apiFetch call site does. Going offline
    // and triggering app activity surfaced an unhandled promise rejection;
    // fixed in AuthContext's initial `useEffect`.
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await context.setOffline(true);
    // "Try with sample data" renders through useDashboardData.js's normal
    // pipeline, which fires several of its own mount-time API calls
    // (merchant-rules, categories, auto-categorize) — exercising the app's
    // error handling broadly while offline, not just one call site.
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.loadSampleData();
    await expect(dashboardPage.welcomeHeading).toBeVisible();

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
    // disabled-attribute race loses. `force: true` is required to actually
    // create that race deterministically: Playwright's default click()
    // waits for the button to be enabled before dispatching, so on a
    // slower runner the first click's React re-render can disable the
    // button before the second click's own actionability check completes —
    // Playwright then retries the second click against a button that will
    // never re-enable (login already succeeded, the app already navigated
    // away), hanging for the full test timeout instead of ever firing it.
    // force: true dispatches both clicks immediately regardless of
    // enabled/visible state, which is what "even if the disabled-attribute
    // race loses" already meant to test.
    await Promise.all([
      submitButton.click({ force: true }),
      submitButton.click({ force: true }),
    ]);

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
    // A real history entry to go back to. Since Phase 8.9, Sign Out lives on
    // /settings (a real, pushed navigation from /dashboard, unlike the old
    // same-URL header button) — post-logout, ProtectedRoute's
    // <Navigate replace> means /settings's entry itself becomes /login, so
    // going back from there lands on the bfcache-restored /dashboard, which
    // ProtectedRoute's own mount-time auth check immediately redirects to
    // /login too (the cleared session is real, not just a stale client
    // guard) — never a phantom authenticated view either way.
    await page.goto("about:blank");
    const user = { name: "Back Button", email: uniqueEmail(), password: "TestPass123!" };
    await page.request.post("/api/auth/signup", { data: user });
    await page.goto("/");
    await expect(page.getByRole("button", { name: /try with sample data/i })).toBeVisible();

    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.signOut();
    await expect(page.getByRole("button", { name: "Sign In" }).first()).toBeVisible();

    await page.goBack();
    // Whatever page.goBack() lands on (bfcache-restored /dashboard, which
    // redirects again, or /login directly), it must never show authenticated
    // content with cleared cookies.
    const sampleDataVisible = await page.getByRole("button", { name: /try with sample data/i }).isVisible().catch(() => false);
    expect(sampleDataVisible).toBe(false);
  });
});
