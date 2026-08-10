import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { buildTestApp } from "./testApp.js";
import { getDb } from "../api/_lib/db.js";
import { findActiveSessionByToken } from "../api/_lib/session.js";
import { IDLE_SESSION_TTL_MS, ABSOLUTE_SESSION_TTL_MS } from "../api/_lib/cookies.js";
import { _resetForTests as resetRateLimits } from "../api/_lib/ratelimit.js";
import { extractCookie, isCookieCleared, uniqueEmail, uniqueIp, signupUser as signupUserWithApp } from "./helpers.js";
import { MAX_ATTEMPTS_PER_CYCLE, COOLDOWN_MS, RESET_REQUIRED_REPEAT_LIMIT, FREEZE_MS } from "../api/_lib/loginLockout.js";

let app;
let db;

beforeAll(async () => {
  app = buildTestApp();
  db = await getDb();
});

beforeEach(() => {
  resetRateLimits();
});

const signupUser = (email, password) => signupUserWithApp(app, email, password);

// Every call here gets its own fake source IP (via X-Forwarded-For, which
// getClientIp() already reads) so these tests — several of which legitimately
// need more than 10 sequential /api/auth/login calls to drive the account
// through its full escalation timeline — never trip the separate IP-keyed
// login:<ip> rate limiter (covered on its own below). Real attackers can
// rotate source IPs too; that's exactly why the account-level state in
// api/_lib/loginLockout.js, not the IP limiter, is what has to hold the line.
const login = (email, password) =>
  request(app).post("/api/auth/login").set("X-Forwarded-For", uniqueIp()).send({ email, password });

describe("login / signup", () => {
  it("creates a session and sets cookies, never returns a token in the body", async () => {
    const email = uniqueEmail();
    const { res } = await signupUser(email);
    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({ name: "Test User", email });
    expect(res.body.token).toBeUndefined();
    expect(extractCookie(res, "cc_at")).toBeTruthy();
    expect(extractCookie(res, "cc_rt")).toBeTruthy();
    expect(extractCookie(res, "cc_csrf")).toBeTruthy();
  });

  it("logs in with correct credentials and issues a fresh session", async () => {
    const email = uniqueEmail();
    await signupUser(email);
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/login").send({ email, password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    expect(res.body.token).toBeUndefined();
    expect(extractCookie(res, "cc_at")).toBeTruthy();
  });

  it("rejects the wrong password and sets no auth cookies", async () => {
    const email = uniqueEmail();
    await signupUser(email);
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/login").send({ email, password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(extractCookie(res, "cc_at")).toBeNull();
  });

  it("rejects a login with no email or password with 400, not a DB lookup", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "", password: "" });
    expect(res.status).toBe(400);
  });

  it("rejects a nonexistent email with 401 and a distinct message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: uniqueEmail(), password: "password123" });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no account found/i);
  });

  it("rate-limits login attempts from the same IP independent of account lockout", async () => {
    const email = uniqueEmail();
    await signupUser(email);

    // The login:<ip> limiter (10/15min) is keyed on IP, not email — distinct
    // nonexistent emails from the same agent/IP still exhaust it.
    for (let i = 0; i < 10; i++) {
      await request(app).post("/api/auth/login").send({ email: uniqueEmail(), password: "x" });
    }
    const res = await request(app).post("/api/auth/login").send({ email, password: "password123" });
    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBeTruthy();
  });
});

describe("account lockout escalation policy (api/_lib/loginLockout.js)", () => {
  /** Directly seeds a password-reset token/OTP, bypassing email delivery (already covered by forgot-password.test.js). */
  async function seedPasswordReset(email) {
    const token = `test-token-${email}`;
    const otp = "654321";
    await db.collection("users").updateOne(
      { email },
      { $set: { passwordResetToken: token, passwordResetOtp: otp, passwordResetExpiry: new Date(Date.now() + 60 * 60_000) } }
    );
    return { token, otp };
  }

  it("failures 1-3 remain usable — plain 401, no lock", async () => {
    const email = uniqueEmail();
    await signupUser(email);

    for (let i = 0; i < MAX_ATTEMPTS_PER_CYCLE - 1; i++) {
      const res = await login(email, "wrong-password");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Incorrect password. Please try again.");
    }

    const user = await db.collection("users").findOne({ email });
    expect(user.lockedUntil).toBeNull();
    expect(user.passwordResetRequired).toBe(false);

    // Still able to log in normally on the 4th attempt if the password is correct.
    const ok = await login(email, "password123");
    expect(ok.status).toBe(200);
  });

  it("the 4th consecutive wrong password starts a server-enforced 15-minute cooldown", async () => {
    const email = uniqueEmail();
    await signupUser(email);

    for (let i = 0; i < MAX_ATTEMPTS_PER_CYCLE - 1; i++) {
      await login(email, "wrong-password");
    }
    const fourth = await login(email, "wrong-password");
    expect(fourth.status).toBe(429);
    expect(fourth.body.error).toBe("Too many incorrect attempts. Please try again in 15 minutes.");
    expect(fourth.headers["retry-after"]).toBeTruthy();

    const user = await db.collection("users").findOne({ email });
    expect(user.lockedUntil).toBeTruthy();
    expect(new Date(user.lockedUntil) - Date.now()).toBeGreaterThan(COOLDOWN_MS - 5000);
    expect(new Date(user.lockedUntil) - Date.now()).toBeLessThanOrEqual(COOLDOWN_MS);

    // Even the *correct* password is rejected during the cooldown.
    const duringCooldown = await login(email, "password123");
    expect(duringCooldown.status).toBe(429);
  });

  it("attempts during cooldown do not extend or bypass it", async () => {
    const email = uniqueEmail();
    await signupUser(email);
    for (let i = 0; i < MAX_ATTEMPTS_PER_CYCLE; i++) await login(email, "wrong-password");

    const userAfterLock = await db.collection("users").findOne({ email });
    const lockedUntilBefore = userAfterLock.lockedUntil;

    await login(email, "wrong-password");
    await login(email, "password123");

    const userAfterMoreAttempts = await db.collection("users").findOne({ email });
    expect(new Date(userAfterMoreAttempts.lockedUntil).getTime()).toBe(new Date(lockedUntilBefore).getTime());
    expect(userAfterMoreAttempts.failedLogins).toBe(userAfterLock.failedLogins);
  });

  it("cooldown expiration permits another attempt window", async () => {
    const email = uniqueEmail();
    await signupUser(email);
    for (let i = 0; i < MAX_ATTEMPTS_PER_CYCLE; i++) await login(email, "wrong-password");

    // Simulate the 15 minutes passing, the same way this file already
    // simulates session-expiry elsewhere — write the expiry directly.
    await db.collection("users").updateOne({ email }, { $set: { lockedUntil: new Date(Date.now() - 1000) } });

    const res = await login(email, "wrong-password");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Incorrect password. Please try again.");

    const user = await db.collection("users").findOne({ email });
    expect(user.failedLogins).toBe(1);
    expect(user.lockoutCycles).toBe(1); // still remembers this is the 2nd cycle
  });

  it("a second 4-strike cycle requires a password reset instead of a second cooldown", async () => {
    const email = uniqueEmail();
    await signupUser(email);
    for (let i = 0; i < MAX_ATTEMPTS_PER_CYCLE; i++) await login(email, "wrong-password");
    await db.collection("users").updateOne({ email }, { $set: { lockedUntil: new Date(Date.now() - 1000) } });

    let last;
    for (let i = 0; i < MAX_ATTEMPTS_PER_CYCLE; i++) last = await login(email, "wrong-password");

    expect(last.status).toBe(403);
    expect(last.body.error).toBe("For your security, please reset your password before trying again.");
    expect(last.body.resetRequired).toBe(true);

    const user = await db.collection("users").findOne({ email });
    expect(user.passwordResetRequired).toBe(true);
    expect(user.freezeUntil).toBeNull(); // reaching it once never freezes

    // The correct password no longer works either — a reset is mandatory.
    const withCorrectPassword = await login(email, "password123");
    expect(withCorrectPassword.status).toBe(403);
  });

  it("a successful password reset clears the escalation state and restores normal login", async () => {
    const email = uniqueEmail();
    await signupUser(email);
    for (let i = 0; i < MAX_ATTEMPTS_PER_CYCLE; i++) await login(email, "wrong-password");
    await db.collection("users").updateOne({ email }, { $set: { lockedUntil: new Date(Date.now() - 1000) } });
    for (let i = 0; i < MAX_ATTEMPTS_PER_CYCLE; i++) await login(email, "wrong-password");

    const gated = await db.collection("users").findOne({ email });
    expect(gated.passwordResetRequired).toBe(true);

    const { token, otp } = await seedPasswordReset(email);
    const resetRes = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, otp, newPassword: "brand-new-password1" });
    expect(resetRes.status).toBe(200);

    const cleared = await db.collection("users").findOne({ email });
    expect(cleared.failedLogins).toBe(0);
    expect(cleared.lockedUntil).toBeNull();
    expect(cleared.lockoutCycles).toBe(0);
    expect(cleared.passwordResetRequired).toBe(false);
    expect(cleared.resetRequiredAttempts).toBe(0);
    expect(cleared.freezeUntil).toBeNull();

    const loggedIn = await login(email, "brand-new-password1");
    expect(loggedIn.status).toBe(200);
  });

  it("ignoring the reset requirement RESET_REQUIRED_REPEAT_LIMIT times escalates to a 1-week freeze", async () => {
    const email = uniqueEmail();
    await signupUser(email);
    for (let i = 0; i < MAX_ATTEMPTS_PER_CYCLE; i++) await login(email, "wrong-password");
    await db.collection("users").updateOne({ email }, { $set: { lockedUntil: new Date(Date.now() - 1000) } });
    for (let i = 0; i < MAX_ATTEMPTS_PER_CYCLE; i++) await login(email, "wrong-password");

    let last;
    for (let i = 0; i < RESET_REQUIRED_REPEAT_LIMIT; i++) last = await login(email, "wrong-password");

    expect(last.status).toBe(423);
    expect(last.body.frozen).toBe(true);

    const user = await db.collection("users").findOne({ email });
    expect(user.freezeUntil).toBeTruthy();
    expect(new Date(user.freezeUntil) - Date.now()).toBeGreaterThan(FREEZE_MS - 5000);

    // A password reset is still the escape hatch, even while frozen.
    const { token, otp } = await seedPasswordReset(email);
    const resetRes = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, otp, newPassword: "brand-new-password2" });
    expect(resetRes.status).toBe(200);

    const cleared = await db.collection("users").findOne({ email });
    expect(cleared.freezeUntil).toBeNull();

    const loggedIn = await login(email, "brand-new-password2");
    expect(loggedIn.status).toBe(200);
  });

  it("successful login clears failedLogins after some (non-locking) wrong attempts", async () => {
    const email = uniqueEmail();
    await signupUser(email);
    await login(email, "wrong-password");
    await login(email, "wrong-password");

    const ok = await login(email, "password123");
    expect(ok.status).toBe(200);

    const user = await db.collection("users").findOne({ email });
    expect(user.failedLogins).toBe(0);
  });

  it("account/user isolation — one user's failed attempts never affect another user", async () => {
    const emailA = uniqueEmail();
    const emailB = uniqueEmail();
    await signupUser(emailA);
    await signupUser(emailB);

    for (let i = 0; i < MAX_ATTEMPTS_PER_CYCLE; i++) await login(emailA, "wrong-password");

    const userA = await db.collection("users").findOne({ email: emailA });
    expect(userA.lockedUntil).toBeTruthy();

    const userBLogin = await login(emailB, "password123");
    expect(userBLogin.status).toBe(200);

    const userB = await db.collection("users").findOne({ email: emailB });
    expect(userB.lockedUntil).toBeNull();
    expect(userB.failedLogins).toBe(0);
  });
});

describe("authenticated requests / invalid & missing cookies", () => {
  it("profile succeeds with a valid access-token cookie", async () => {
    const email = uniqueEmail();
    const { agent } = await signupUser(email);
    const res = await agent.get("/api/auth/profile");
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });

  it("rejects requests with no cookies at all", async () => {
    const res = await request(app).get("/api/auth/profile");
    expect(res.status).toBe(401);
  });

  it("rejects requests with an invalid/garbage access-token cookie", async () => {
    const res = await request(app).get("/api/auth/profile").set("Cookie", "cc_at=not-a-real-jwt");
    expect(res.status).toBe(401);
  });
});

describe("CSRF protection", () => {
  it("rejects a mutating request with no CSRF header", async () => {
    const email = uniqueEmail();
    const { agent } = await signupUser(email);
    const res = await agent.post("/api/categories").send({ categoryName: "Test Cat A" });
    expect(res.status).toBe(403);
  });

  it("rejects a mutating request with a wrong CSRF header", async () => {
    const email = uniqueEmail();
    const { agent } = await signupUser(email);
    const res = await agent
      .post("/api/categories")
      .set("X-CSRF-Token", "totally-wrong-value")
      .send({ categoryName: "Test Cat B" });
    expect(res.status).toBe(403);
  });

  it("accepts a mutating request with the correct CSRF header", async () => {
    const email = uniqueEmail();
    const { agent, csrf } = await signupUser(email);
    const res = await agent
      .post("/api/categories")
      .set("X-CSRF-Token", csrf)
      .send({ categoryName: "Test Cat C" });
    expect(res.status).toBe(201);
  });
});

describe("refresh", () => {
  it("rotates the refresh token and issues a new access token", async () => {
    const email = uniqueEmail();
    const { agent, csrf, res: loginRes } = await signupUser(email);
    const oldRt = extractCookie(loginRes, "cc_rt");

    const refreshRes = await agent.post("/api/auth/refresh").set("X-CSRF-Token", csrf);
    expect(refreshRes.status).toBe(200);
    const newRt = extractCookie(refreshRes, "cc_rt");
    expect(newRt).toBeTruthy();
    expect(newRt).not.toBe(oldRt);

    const profileRes = await agent.get("/api/auth/profile");
    expect(profileRes.status).toBe(200);
  });

  it("rejects a request with a missing refresh-token cookie", async () => {
    const email = uniqueEmail();
    const { csrf } = await signupUser(email);
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `cc_csrf=${csrf}`)
      .set("X-CSRF-Token", csrf);
    expect(res.status).toBe(401);
  });

  it("rejects reuse of an already-rotated (old) refresh token", async () => {
    const email = uniqueEmail();
    const { agent, csrf, res: loginRes } = await signupUser(email);
    const oldRt = extractCookie(loginRes, "cc_rt");

    await agent.post("/api/auth/refresh").set("X-CSRF-Token", csrf); // rotates via the agent

    const replay = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `cc_rt=${oldRt}; cc_csrf=${csrf}`)
      .set("X-CSRF-Token", csrf);
    expect(replay.status).toBe(401);
  });

  it("rejects a refresh token whose session has expired", async () => {
    const email = uniqueEmail();
    const { csrf, res: loginRes } = await signupUser(email);
    const rt = extractCookie(loginRes, "cc_rt");

    const session = await findActiveSessionByToken(db, rt);
    await db.collection("sessions").updateOne(
      { _id: session._id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `cc_rt=${rt}; cc_csrf=${csrf}`)
      .set("X-CSRF-Token", csrf);
    expect(res.status).toBe(401);
  });

  it("stays authenticated across several refreshes spaced out under the 1-hour idle window — a sliding session, not a fixed one", async () => {
    const email = uniqueEmail();
    const { csrf, res: loginRes } = await signupUser(email);
    let rt = extractCookie(loginRes, "cc_rt");

    // Each refresh simulates activity right before the idle window would
    // have expired — proves the window really slides forward on use,
    // rather than being a fixed countdown from login.
    for (let i = 0; i < 3; i++) {
      const session = await findActiveSessionByToken(db, rt);
      await db.collection("sessions").updateOne(
        { _id: session._id },
        { $set: { expiresAt: new Date(Date.now() + 1000) } } // "about to go idle-expired"
      );
      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", `cc_rt=${rt}; cc_csrf=${csrf}`)
        .set("X-CSRF-Token", csrf);
      expect(res.status).toBe(200);
      rt = extractCookie(res, "cc_rt");
    }

    expect((await findActiveSessionByToken(db, rt)).expiresAt.getTime()).toBeGreaterThan(
      Date.now() + IDLE_SESSION_TTL_MS - 5000
    );
  });

  it("rejects a refresh token whose session has gone idle-expired (no activity for the ~1-hour window)", async () => {
    const email = uniqueEmail();
    const { csrf, res: loginRes } = await signupUser(email);
    const rt = extractCookie(loginRes, "cc_rt");

    const session = await findActiveSessionByToken(db, rt);
    await db.collection("sessions").updateOne(
      { _id: session._id },
      { $set: { expiresAt: new Date(Date.now() - IDLE_SESSION_TTL_MS) } }
    );

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `cc_rt=${rt}; cc_csrf=${csrf}`)
      .set("X-CSRF-Token", csrf);
    expect(res.status).toBe(401);
  });

  it("rejects a session past the absolute lifetime cap even though it kept sliding (idle window still valid)", async () => {
    const email = uniqueEmail();
    const { csrf, res: loginRes } = await signupUser(email);
    const rt = extractCookie(loginRes, "cc_rt");

    // Simulates a session that's been refreshed every hour, forever — the
    // idle window (expiresAt) is still comfortably valid, but the account
    // "logged in" 31 days ago and never had to fully re-authenticate since.
    const session = await findActiveSessionByToken(db, rt);
    await db.collection("sessions").updateOne(
      { _id: session._id },
      {
        $set: {
          createdAt: new Date(Date.now() - (ABSOLUTE_SESSION_TTL_MS + 60_000)),
          expiresAt: new Date(Date.now() + IDLE_SESSION_TTL_MS), // still "active" by idle standards
        },
      }
    );

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `cc_rt=${rt}; cc_csrf=${csrf}`)
      .set("X-CSRF-Token", csrf);
    expect(res.status).toBe(401);
  });

  it("does not reject a long-lived session that is still within the absolute cap", async () => {
    const email = uniqueEmail();
    const { csrf, res: loginRes } = await signupUser(email);
    const rt = extractCookie(loginRes, "cc_rt");

    const session = await findActiveSessionByToken(db, rt);
    await db.collection("sessions").updateOne(
      { _id: session._id },
      { $set: { createdAt: new Date(Date.now() - (ABSOLUTE_SESSION_TTL_MS - 60_000)) } }
    );

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `cc_rt=${rt}; cc_csrf=${csrf}`)
      .set("X-CSRF-Token", csrf);
    expect(res.status).toBe(200);
  });

  it("rejects a refresh token whose session has been revoked", async () => {
    const email = uniqueEmail();
    const { csrf, res: loginRes } = await signupUser(email);
    const rt = extractCookie(loginRes, "cc_rt");

    const session = await findActiveSessionByToken(db, rt);
    await db.collection("sessions").updateOne(
      { _id: session._id },
      { $set: { revoked: true, revokedAt: new Date() } }
    );

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `cc_rt=${rt}; cc_csrf=${csrf}`)
      .set("X-CSRF-Token", csrf);
    expect(res.status).toBe(401);
  });

  it("under concurrent refresh attempts with the same token, exactly one succeeds", async () => {
    const email = uniqueEmail();
    const { csrf, res: loginRes } = await signupUser(email);
    const rt = extractCookie(loginRes, "cc_rt");

    const fire = () =>
      request(app)
        .post("/api/auth/refresh")
        .set("Cookie", `cc_rt=${rt}; cc_csrf=${csrf}`)
        .set("X-CSRF-Token", csrf);

    const [a, b] = await Promise.all([fire(), fire()]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 401]);
  });
});

describe("logout", () => {
  it("revokes the session and clears cookies; the old refresh token can no longer refresh", async () => {
    const email = uniqueEmail();
    const { agent, csrf, res: loginRes } = await signupUser(email);
    const rt = extractCookie(loginRes, "cc_rt");

    const logoutRes = await agent.post("/api/auth/logout").set("X-CSRF-Token", csrf);
    expect(logoutRes.status).toBe(200);
    expect(isCookieCleared(logoutRes, "cc_at")).toBe(true);
    expect(isCookieCleared(logoutRes, "cc_rt")).toBe(true);

    const sessionAfterLogout = await findActiveSessionByToken(db, rt);
    expect(sessionAfterLogout).toBeNull();

    const refreshAttempt = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `cc_rt=${rt}; cc_csrf=${csrf}`)
      .set("X-CSRF-Token", csrf);
    expect(refreshAttempt.status).toBe(401);
  });
});

describe("multiple devices / logout-all", () => {
  it("supports two simultaneous sessions for the same user", async () => {
    const email = uniqueEmail();
    const { agent: deviceA } = await signupUser(email);
    const deviceB = request.agent(app);
    await deviceB.post("/api/auth/login").send({ email, password: "password123" });

    expect((await deviceA.get("/api/auth/profile")).status).toBe(200);
    expect((await deviceB.get("/api/auth/profile")).status).toBe(200);

    const user = await db.collection("users").findOne({ email });
    const activeSessions = await db
      .collection("sessions")
      .find({ userId: user._id.toString(), revoked: false })
      .toArray();
    expect(activeSessions.length).toBe(2);
  });

  it("logout-all revokes every session for the user, not just the current device", async () => {
    const email = uniqueEmail();
    const { agent: deviceA, csrf: csrfA } = await signupUser(email);
    const deviceB = request.agent(app);
    const loginB = await deviceB.post("/api/auth/login").send({ email, password: "password123" });
    const rtB = extractCookie(loginB, "cc_rt");
    const csrfB = extractCookie(loginB, "cc_csrf");

    const logoutAllRes = await deviceA.post("/api/auth/logout-all").set("X-CSRF-Token", csrfA);
    expect(logoutAllRes.status).toBe(200);

    const refreshB = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `cc_rt=${rtB}; cc_csrf=${csrfB}`)
      .set("X-CSRF-Token", csrfB);
    expect(refreshB.status).toBe(401);

    const user = await db.collection("users").findOne({ email });
    const stillActive = await db
      .collection("sessions")
      .find({ userId: user._id.toString(), revoked: false })
      .toArray();
    expect(stillActive.length).toBe(0);
  });
});

describe("refresh-token/session ownership across users", () => {
  it("each user's session is independent — refreshing one never yields, extends, or touches the other's identity or session", async () => {
    const emailA = uniqueEmail();
    const emailB = uniqueEmail();
    const { csrf: csrfA, res: loginA } = await signupUser(emailA);
    const { csrf: csrfB, res: loginB } = await signupUser(emailB);
    const rtA = extractCookie(loginA, "cc_rt");
    const rtB = extractCookie(loginB, "cc_rt");
    expect(rtA).not.toBe(rtB);

    const refreshA = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `cc_rt=${rtA}; cc_csrf=${csrfA}`)
      .set("X-CSRF-Token", csrfA);
    expect(refreshA.status).toBe(200);

    // The identity behind A's new access token is still A, never B.
    const profileAfterRefresh = await request(app)
      .get("/api/auth/profile")
      .set("Cookie", `cc_at=${extractCookie(refreshA, "cc_at")}`);
    expect(profileAfterRefresh.body.email).toBe(emailA);

    // B's own (untouched) refresh token still works independently and
    // still resolves to B — A's refresh didn't rotate, revoke, or
    // otherwise affect B's session document.
    const refreshB = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `cc_rt=${rtB}; cc_csrf=${csrfB}`)
      .set("X-CSRF-Token", csrfB);
    expect(refreshB.status).toBe(200);
    const profileB = await request(app)
      .get("/api/auth/profile")
      .set("Cookie", `cc_at=${extractCookie(refreshB, "cc_at")}`);
    expect(profileB.body.email).toBe(emailB);

    // The two session documents are genuinely distinct records.
    const sessionA = await findActiveSessionByToken(db, extractCookie(refreshA, "cc_rt"));
    const sessionB = await findActiveSessionByToken(db, extractCookie(refreshB, "cc_rt"));
    expect(sessionA._id.toString()).not.toBe(sessionB._id.toString());
    expect(sessionA.userId).not.toBe(sessionB.userId);
  });

  it("mixing user A's CSRF token with user B's refresh-token cookie still only ever resolves to B, never A", async () => {
    const emailB = uniqueEmail();
    const { csrf: csrfA } = await signupUser(uniqueEmail());
    const { res: loginB } = await signupUser(emailB);
    const rtB = extractCookie(loginB, "cc_rt");

    // The double-submit CSRF check only proves "cookie == header", not
    // whose account either belongs to — session identity is determined
    // solely by which refresh token is presented (cc_rt), never by the
    // CSRF token. Passing CSRF with a mismatched-user token pair must
    // still resolve to B's identity (the account rtB actually belongs to),
    // and must never leak or grant A's.
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `cc_rt=${rtB}; cc_csrf=${csrfA}`)
      .set("X-CSRF-Token", csrfA);
    expect(res.status).toBe(200);

    const profile = await request(app)
      .get("/api/auth/profile")
      .set("Cookie", `cc_at=${extractCookie(res, "cc_at")}`);
    expect(profile.body.email).toBe(emailB);
  });
});

describe("cookie security attributes", () => {
  it("access/refresh/csrf cookies keep HttpOnly, SameSite, and Path scoping on login", async () => {
    const { res: loginRes } = await signupUser(uniqueEmail());
    const setCookie = [].concat(loginRes.headers["set-cookie"] || []);

    const at = setCookie.find((c) => c.startsWith("cc_at="));
    const rt = setCookie.find((c) => c.startsWith("cc_rt="));
    const csrf = setCookie.find((c) => c.startsWith("cc_csrf="));

    expect(at).toMatch(/HttpOnly/);
    expect(at).toMatch(/Path=\/api(?!\/auth)/); // "/api", not "/api/auth"
    expect(rt).toMatch(/HttpOnly/);
    expect(rt).toMatch(/Path=\/api\/auth/);
    expect(csrf).not.toMatch(/HttpOnly/); // deliberately readable by the frontend

    for (const cookie of [at, rt, csrf]) {
      expect(cookie).toMatch(/SameSite=Lax/);
    }
  });

  it("access/refresh cookies keep HttpOnly and SameSite on refresh too, not just login", async () => {
    const { csrf, res: loginRes } = await signupUser(uniqueEmail());
    const rt = extractCookie(loginRes, "cc_rt");

    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `cc_rt=${rt}; cc_csrf=${csrf}`)
      .set("X-CSRF-Token", csrf);
    const setCookie = [].concat(refreshRes.headers["set-cookie"] || []);

    const at = setCookie.find((c) => c.startsWith("cc_at="));
    const newRt = setCookie.find((c) => c.startsWith("cc_rt="));
    expect(at).toMatch(/HttpOnly/);
    expect(at).toMatch(/SameSite=Lax/);
    expect(newRt).toMatch(/HttpOnly/);
    expect(newRt).toMatch(/SameSite=Lax/);
  });
});
