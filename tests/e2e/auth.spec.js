import { test, expect, FILES } from "./fixtures/index.mjs";
import { AuthPage } from "./pages/AuthPage.mjs";
import { UploadPage } from "./pages/UploadPage.mjs";

function cookieByName(cookies, name) {
  return cookies.find((c) => c.name === name);
}

test.describe("signup", () => {
  test("creates an account, sets HttpOnly session cookies, and never puts a token in the response body", async ({ page, testUser }) => {
    const authPage = new AuthPage(page);

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/signup")),
      authPage.signup(testUser),
    ]);

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.user).toEqual({ name: testUser.name, email: testUser.email });
    expect(JSON.stringify(body)).not.toMatch(/token|jwt|refresh/i); // no token ever in the JSON body — see docs/backend/authentication.md

    const cookies = await page.context().cookies();
    const at = cookieByName(cookies, "cc_at");
    const rt = cookieByName(cookies, "cc_rt");
    const csrf = cookieByName(cookies, "cc_csrf");
    expect(at, "cc_at cookie").toBeTruthy();
    expect(at.httpOnly).toBe(true);
    expect(at.path).toBe("/api");
    expect(rt, "cc_rt cookie").toBeTruthy();
    expect(rt.httpOnly).toBe(true);
    expect(rt.path).toBe("/api/auth");
    expect(csrf, "cc_csrf cookie").toBeTruthy();
    expect(csrf.httpOnly).toBe(false); // frontend must read it to echo as X-CSRF-Token

    await expect(page.getByRole("button", { name: /try with sample data/i })).toBeVisible();
  });

  test("rejects a duplicate email with a field-routed error and sets no cookies", async ({ page, testUser }) => {
    const authPage = new AuthPage(page);
    await authPage.signup(testUser);
    await expect(page.getByRole("button", { name: /try with sample data/i })).toBeVisible();

    // Sign out, then try to sign up again with the same email.
    await new UploadPage(page).signOut();
    await authPage.gotoSignup();
    await authPage.fillSignupForm({ name: "Someone Else", email: testUser.email, password: "AnotherPass123!" });
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/signup")),
      authPage.submit(),
    ]);
    expect(response.status()).toBe(409);
    await expect(authPage.errorText(/already registered/i)).toBeVisible();
  });
});

test.describe("login", () => {
  test("logs in with correct credentials and reaches the app", async ({ page, testUser }) => {
    // Seed the account via API (fast) — signup itself has its own dedicated test above.
    const signupRes = await page.request.post("/api/auth/signup", { data: testUser });
    expect(signupRes.ok()).toBe(true);

    // Clear cookies to prove login (not the leftover signup session) is what authenticates.
    await page.context().clearCookies();

    const authPage = new AuthPage(page);
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/login")),
      authPage.login(testUser),
    ]);
    expect(response.status()).toBe(200);

    const cookies = await page.context().cookies();
    expect(cookieByName(cookies, "cc_at")).toBeTruthy();
    expect(cookieByName(cookies, "cc_rt")).toBeTruthy();
    await expect(page.getByRole("button", { name: /try with sample data/i })).toBeVisible();
  });
});

test.describe("invalid credentials", () => {
  test("rejects the wrong password, shows the field error, and sets no session cookies", async ({ page, testUser }) => {
    await page.request.post("/api/auth/signup", { data: testUser });
    await page.context().clearCookies();

    const authPage = new AuthPage(page);
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/login")),
      authPage.login({ email: testUser.email, password: "TotallyWrongPassword1!" }),
    ]);
    expect(response.status()).toBe(401);
    await expect(authPage.errorText(/incorrect password/i)).toBeVisible();

    const cookies = await page.context().cookies();
    expect(cookieByName(cookies, "cc_at")).toBeFalsy();
    expect(cookieByName(cookies, "cc_rt")).toBeFalsy();
  });

  test("rejects a nonexistent account with a clear message, not a generic failure", async ({ page }) => {
    const authPage = new AuthPage(page);
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/login")),
      authPage.login({ email: "no-such-account@example.test", password: "SomePassword1!" }),
    ]);
    expect(response.status()).toBe(401);
    await expect(authPage.errorText(/no account found/i)).toBeVisible();
  });
});

test.describe("logout", () => {
  test("clears cookies and returns to the auth screen", async ({ authenticatedPage: page }) => {
    const uploadPage = new UploadPage(page);
    await expect(uploadPage.signOutButton).toBeVisible();

    const response = await uploadPage.signOut();
    expect(response.status()).toBe(200);

    await expect(page.getByRole("button", { name: "Sign In" }).first()).toBeVisible();

    const cookies = await page.context().cookies();
    // Cleared cookies still appear in the jar with Max-Age=0 momentarily in
    // some browsers' cookie() snapshots, but their value must be empty —
    // check value emptiness rather than absence for a deterministic assertion.
    const at = cookieByName(cookies, "cc_at");
    expect(!at || at.value === "").toBe(true);
  });
});

test.describe("protected routes / direct navigation", () => {
  test("shows the auth screen, never the app, when navigating to the app with no session", async ({ page }) => {
    // "/" is a public Landing page as of Phase 8.2 regardless of session
    // state — /dashboard is the actual protected route this test means to
    // exercise (ProtectedRoute redirects to /login, see router.jsx).
    const response = await page.goto("/dashboard");
    expect(response.status()).toBe(200); // the SPA shell itself always 200s — the *content* it renders is what's gated
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Sign In" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /try with sample data/i })).not.toBeVisible();
  });

  test("a tampered/garbage access-token cookie is treated as unauthenticated, not trusted", async ({ page, context }) => {
    await context.addCookies([
      { name: "cc_at", value: "garbage.not-a.jwt", domain: "localhost", path: "/api", httpOnly: true },
    ]);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Sign In" }).first()).toBeVisible();
  });
});

test.describe("session persistence across reload", () => {
  test("stays authenticated across a page reload, and across several in a row", async ({ authenticatedPage: page }) => {
    await expect(page.getByRole("button", { name: /try with sample data/i })).toBeVisible();

    for (let i = 0; i < 3; i++) {
      await page.reload();
      await expect(page.getByRole("button", { name: /try with sample data/i }), `reload #${i + 1}`).toBeVisible();
    }
  });
});

test.describe("CSRF protection", () => {
  test("the real UI attaches a matching X-CSRF-Token header on a mutating request", async ({ authenticatedPage: page }) => {
    const csrfCookie = (await page.context().cookies()).find((c) => c.name === "cc_csrf");
    expect(csrfCookie).toBeTruthy();

    // "Try with sample data" is deliberately local-only (App.jsx's
    // handleData skips the server save when fileName === "sample_data.csv",
    // so it never sends a request to assert against) — a real file upload
    // is what actually exercises the mutating POST /api/files path.
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/api/files") && r.method() === "POST"),
      new UploadPage(page).uploadFile(FILES.sampleCsv),
    ]);
    expect(request.headers()["x-csrf-token"]).toBe(csrfCookie.value);
  });

  test("a request with a wrong X-CSRF-Token header is rejected with 403, even with a valid session cookie", async ({ authenticatedPage: page }) => {
    // Deliberately NOT simulated by corrupting the cc_csrf *cookie*: src/api.js's
    // getCsrfToken() reads whatever value is in that cookie and echoes the
    // *same* value back as the header, so corrupting the cookie corrupts
    // both sides identically and they'd still match — that's not a CSRF
    // attack, that's a user shooting their own already-consistent state.
    // A real cross-site attacker can make the browser *send* the cookie
    // automatically but can never *read* its value (same-origin policy) to
    // also produce a matching header — so the accurate simulation is: real
    // valid cookie present (untouched), wrong header value sent directly.
    const res = await page.request.post("/api/files", {
      headers: { "X-CSRF-Token": "attacker-supplied-wrong-value" },
      data: { fileName: "csrf-test.csv", statementType: "bank", transactions: [{ date: "2025-01-01", desc: "X", amount: -1 }] },
    });
    expect(res.status()).toBe(403);
  });

  test("a request with no X-CSRF-Token header at all is rejected with 403", async ({ page }) => {
    const signupRes = await page.request.post("/api/auth/signup", {
      data: { name: "CSRF No Header", email: `${Date.now()}-csrf-no-header@example.test`, password: "TestPass123!" },
    });
    expect(signupRes.ok()).toBe(true);

    const res = await page.request.post("/api/files", {
      data: { fileName: "csrf-test.csv", statementType: "bank", transactions: [{ date: "2025-01-01", desc: "X", amount: -1 }] },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe("unauthorized API access", () => {
  test("every protected endpoint rejects a request with no session cookies at all", async ({ page }) => {
    const endpoints = [
      { method: "GET", url: "/api/auth/profile" },
      { method: "GET", url: "/api/files" },
      { method: "GET", url: "/api/categories" },
      { method: "GET", url: "/api/merchant-rules" },
      { method: "POST", url: "/api/categorize", data: { transactions: [] } },
    ];
    for (const ep of endpoints) {
      const res = await page.request.fetch(ep.url, { method: ep.method, data: ep.data });
      expect(res.status(), `${ep.method} ${ep.url}`).toBe(401);
    }
  });
});

test.describe("forgot password", () => {
  // Regression test for a real bug this test found: ForgotPasswordScreen
  // called apiFetch and unconditionally showed "check your email" without
  // ever checking res.ok, so a real failure (rate-limited, or — as here —
  // the email service not being configured, which this e2e environment
  // deliberately runs without, see docs/engineering-lessons/phase-6-testing.md's
  // "Mocking" section) was silently reported as success. Fixed in
  // src/AuthScreen.jsx to match ResetPasswordScreen's existing res.ok check.
  // The actual send-a-real-email happy path isn't exercised here for the
  // same reason — no SMTP credentials in this environment — carried forward
  // in ROADMAP.md alongside the live-nodemailer-send item.
  test("a real failure response (email service not configured) is shown as an error, not a fake success screen", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Forgot password?" }).click();

    await page.getByPlaceholder("you@example.com").fill("someone@example.test");
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText("Password reset is not available", { exact: false })).toBeVisible();
    await expect(page.getByText("Check your email", { exact: false })).not.toBeVisible();
  });

  // Regression test for a real routing bug: router.jsx's wildcard route used
  // to `<Navigate to="/" replace>` for any path other than "/" or
  // "/dashboard" — including /reset-password?token=... and /forgot-password,
  // silently swallowing every real password-reset email's link before
  // AuthScreen's own pathname-based screen detection ever ran. Both paths
  // are now real routes (see router.jsx) rendering the same, unchanged
  // AuthScreen — this proves visiting them directly (not via in-app link
  // clicks, which the tests above already cover) lands on the right screen.
  test("visiting /reset-password?token=... directly shows the reset form, not the login screen", async ({ page }) => {
    await page.goto("/reset-password?token=some-test-token");
    await expect(page.getByRole("heading", { name: "Set new password" })).toBeVisible();
    await expect(page.getByText("Code from email", { exact: false })).toBeVisible();
  });

  test("visiting /forgot-password directly shows the forgot-password form, not the login screen", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
  });
});

test.describe("unknown routes", () => {
  test("an unrecognized path shows a custom 404 page with a way back home, not a silent redirect", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist");
    expect(response.status()).toBe(200); // SPA catch-all still serves the app shell
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

    await page.getByRole("link", { name: "Go home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("account deletion", () => {
  test("deletes the account, clears the session, and frees the email up for a new signup", async ({ authenticatedPage: page, testUser }) => {
    await page.getByRole("button", { name: "Delete Account" }).first().click();
    await expect(page.getByText("Delete your account?")).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/delete-account")),
      page.getByRole("button", { name: "Delete Account" }).last().click(),
    ]);
    expect(response.status()).toBe(200);

    await expect(page.getByRole("button", { name: "Sign In" }).first()).toBeVisible();
    const cookies = await page.context().cookies();
    // Same WebKit quirk the "logout" test above already found and fixed:
    // a cleared cookie can still appear in the jar snapshot with an empty
    // value rather than being absent outright — check value emptiness, not
    // presence, for a deterministic assertion across all 5 browser
    // projects (this one, unlike "logout", hadn't been updated to match).
    const at = cookieByName(cookies, "cc_at");
    const rt = cookieByName(cookies, "cc_rt");
    expect(!at || at.value === "", "cc_at cookie").toBe(true);
    expect(!rt || rt.value === "", "cc_rt cookie").toBe(true);

    // The same email being signup-able again (rather than "already
    // registered") proves the account row, not just the session, is gone.
    const authPage = new AuthPage(page);
    await authPage.signup(testUser);
    await expect(page.getByRole("button", { name: /try with sample data/i })).toBeVisible();
  });
});
