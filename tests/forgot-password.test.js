import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import request from "supertest";
import nodemailerModule from "nodemailer";
import { buildTestApp } from "./testApp.js";
import { getDb } from "../api/_lib/db.js";
import { logger } from "../api/_lib/logger.js";
import { _resetForTests as resetRateLimits } from "../api/_lib/ratelimit.js";
import { uniqueEmail, signupUser as signupUserWithApp } from "./helpers.js";

let app;
let db;
const ORIGINAL_ENV = { ...process.env };

beforeAll(async () => {
  app = buildTestApp();
  db = await getDb();
});

beforeEach(() => {
  resetRateLimits();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

const signupUser = (email) => signupUserWithApp(app, email);

// Enable the mailer *after* the user is created — signup() itself gates its
// OTP email on isEmailVerificationEnabled(), and signupUser() (via
// helpers.js) assumes the auto-verify-when-disabled path every other auth
// test in this repo relies on. Enabling email before signup would make
// signup itself try to send (and, in the mailer-throws test below, fail).
function enableMailer() {
  process.env.EMAIL_PROVIDER = "gmail";
  process.env.GMAIL_USER = "cashcanvas@gmail.com";
  process.env.GMAIL_APP_PASSWORD = "sixteencharpass1";
  delete process.env.RESEND_API_KEY;
}

describe("POST /api/auth/forgot-password — email delivery", () => {
  it("awaits the reset email send before responding, so the send can't be torn down mid-flight in a serverless invocation", async () => {
    let emailSettled = false;
    const sendMailSpy = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      emailSettled = true;
    });
    vi.spyOn(nodemailerModule, "createTransport").mockReturnValue({ sendMail: sendMailSpy });

    const email = uniqueEmail();
    await signupUser(email);
    enableMailer();

    const res = await request(app).post("/api/auth/forgot-password").send({ email });

    expect(res.status).toBe(200);
    expect(sendMailSpy).toHaveBeenCalledTimes(1);
    expect(emailSettled).toBe(true);
  });

  it("sends to the correct address with a reset link containing the stored token", async () => {
    const sendMailSpy = vi.fn().mockResolvedValue({});
    vi.spyOn(nodemailerModule, "createTransport").mockReturnValue({ sendMail: sendMailSpy });

    const email = uniqueEmail();
    await signupUser(email);
    enableMailer();

    const res = await request(app).post("/api/auth/forgot-password").send({ email });
    expect(res.status).toBe(200);

    expect(sendMailSpy).toHaveBeenCalledTimes(1);
    const call = sendMailSpy.mock.calls[0][0];
    expect(call.to).toBe(email);
    expect(call.subject).toMatch(/reset your cashcanvas password/i);

    const user = await db.collection("users").findOne({ email });
    expect(user.passwordResetToken).toBeTruthy();
    expect(call.html).toContain(`token=${user.passwordResetToken}`);
  });

  it("still responds 200 {ok:true} when the mailer throws, preserving email-enumeration protection, but logs the failure", async () => {
    const sendMailSpy = vi.fn().mockRejectedValue(new Error("SMTP timeout"));
    vi.spyOn(nodemailerModule, "createTransport").mockReturnValue({ sendMail: sendMailSpy });
    const loggerErrorSpy = vi.spyOn(logger, "error");

    const email = uniqueEmail();
    await signupUser(email);
    enableMailer();

    const res = await request(app).post("/api/auth/forgot-password").send({ email });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      "forgot-password",
      "SMTP timeout",
      expect.objectContaining({ context: "Email error" })
    );
  });

  it("still responds 200 {ok:true} for a nonexistent email and never attempts to send", async () => {
    enableMailer();
    const sendMailSpy = vi.fn().mockResolvedValue({});
    vi.spyOn(nodemailerModule, "createTransport").mockReturnValue({ sendMail: sendMailSpy });

    const res = await request(app).post("/api/auth/forgot-password").send({ email: uniqueEmail() });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(sendMailSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/resend-verification — email delivery", () => {
  it("awaits the verification email send before responding", async () => {
    enableMailer();
    let emailSettled = false;
    const sendMailSpy = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      emailSettled = true;
    });
    vi.spyOn(nodemailerModule, "createTransport").mockReturnValue({ sendMail: sendMailSpy });

    // resendVerification looks up `users` directly (not pending_signups) and
    // requires emailVerified === false (api/auth.js:437-440) — insert a user
    // in that state directly rather than going through signup/OTP, since
    // this endpoint serves the link-based (not OTP-based) verification path.
    const email = uniqueEmail();
    await db.collection("users").insertOne({
      name: "Test User",
      email,
      passwordHash: "$2a$10$abcdefghijklmnopqrstuv", // unused by this endpoint
      emailVerified: false,
      failedLogins: 0,
      lockedUntil: null,
      createdAt: new Date(),
    });

    const res = await request(app).post("/api/auth/resend-verification").send({ email });

    expect(res.status).toBe(200);
    expect(sendMailSpy).toHaveBeenCalledTimes(1);
    expect(emailSettled).toBe(true);
  });
});
