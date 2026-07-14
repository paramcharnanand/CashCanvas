import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { buildTestApp } from "./testApp.js";
import { getDb } from "../api/_lib/db.js";
import { findActiveSessionByToken } from "../api/_lib/session.js";
import { _resetForTests as resetRateLimits } from "../api/_lib/ratelimit.js";
import { extractCookie, isCookieCleared, uniqueEmail, signupUser as signupUserWithApp } from "./helpers.js";

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
