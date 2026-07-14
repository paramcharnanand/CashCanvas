import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendOtpEmail, sendPasswordResetEmail } from "../api/lib/mailer.js";

// GMAIL_USER/GMAIL_APP_PASSWORD are unset in the test env (tests/vitest.setup.js
// disables email), so createTransporter() returns null and these functions hit
// their "email not configured" fallback branch — the one that must never log
// the raw secret.

describe("mailer — never logs secrets when email is not configured", () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("does not log the raw OTP code", async () => {
    const otp = "739284";
    await sendOtpEmail("victim@example.test", otp, "login");

    expect(warnSpy).toHaveBeenCalled();
    const loggedText = warnSpy.mock.calls.map(args => args.join(" ")).join("\n");
    expect(loggedText).not.toContain(otp);
  });

  it("does not log the raw password-reset token or OTP", async () => {
    const token = "a".repeat(64);
    const otp = "551209";
    await sendPasswordResetEmail("victim@example.test", token, otp);

    expect(warnSpy).toHaveBeenCalled();
    const loggedText = warnSpy.mock.calls.map(args => args.join(" ")).join("\n");
    expect(loggedText).not.toContain(token);
    expect(loggedText).not.toContain(otp);
  });
});
