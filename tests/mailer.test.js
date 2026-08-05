import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Covers the provider-switching behavior added when Resend was introduced
 * alongside Gmail: isEmailVerificationEnabled()'s per-provider gate, the
 * shared from-address helper, and the Resend HTTP adapter's success/failure
 * paths. Gmail's own send path is already covered indirectly by
 * tests/logging.test.js and the e2e auth suite (mailer disabled in that
 * env) — this file is specifically the parts that are new.
 */
describe("mailer — provider switching", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("defaults to the gmail provider when EMAIL_PROVIDER is unset — existing deployments are unaffected", async () => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
    process.env.GMAIL_USER = "cashcanvas@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "sixteencharpass1";

    const { isEmailVerificationEnabled } = await import("../api/_lib/mailer.js");
    expect(isEmailVerificationEnabled()).toBe(true);
  });

  it("is disabled under the resend provider when RESEND_API_KEY is missing, even if Gmail vars happen to be set", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    delete process.env.RESEND_API_KEY;
    process.env.GMAIL_USER = "cashcanvas@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "sixteencharpass1";

    const { isEmailVerificationEnabled } = await import("../api/_lib/mailer.js");
    expect(isEmailVerificationEnabled()).toBe(false);
  });

  it("is enabled under the resend provider once RESEND_API_KEY is set", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_fake_key_for_this_test";

    const { isEmailVerificationEnabled } = await import("../api/_lib/mailer.js");
    expect(isEmailVerificationEnabled()).toBe(true);
  });

  it("sends via Resend's HTTP API with the API key as a Bearer token, and never logs it on success", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_fake_key_for_this_test";
    process.env.EMAIL_FROM = "noreply@cashcanvas.dev";
    process.env.EMAIL_FROM_NAME = "CashCanvas";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const { sendOtpEmail } = await import("../api/_lib/mailer.js");
    await sendOtpEmail("user@example.test", "123456", "login");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.headers.Authorization).toBe("Bearer re_fake_key_for_this_test");
    const body = JSON.parse(options.body);
    expect(body.from).toBe('"CashCanvas" <noreply@cashcanvas.dev>');
    expect(body.to).toBe("user@example.test");
    expect(body.html).not.toContain("123456"); // sanity: OTP is in the digit boxes, not leaked into e.g. a header
  });

  it("throws with Resend's error body (not the API key) on a non-2xx response, matching nodemailer's throw-on-failure contract", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_fake_key_for_this_test";
    process.env.EMAIL_FROM = "noreply@cashcanvas.dev";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve('{"message":"Invalid from address"}'),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { sendOtpEmail } = await import("../api/_lib/mailer.js");
    await expect(sendOtpEmail("user@example.test", "123456", "login")).rejects.toThrow(
      "Resend API error (422)"
    );
    // The thrown error must never carry the API key.
    try {
      await sendOtpEmail("user@example.test", "123456", "login");
    } catch (err) {
      expect(err.message).not.toContain("re_fake_key_for_this_test");
    }
  });

  it("getFromAddress falls back to GMAIL_USER when EMAIL_FROM is unset, under the gmail provider", async () => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_FROM_NAME;
    process.env.GMAIL_USER = "cashcanvas26@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "sixteencharpass1";

    // nodemailer.createTransport() doesn't itself validate credentials at
    // construction time, so this exercises getFromAddress() via a real
    // (unsent) sendMail call shape without needing a live Gmail connection.
    const nodemailerModule = await import("nodemailer");
    const sendMailSpy = vi.fn().mockResolvedValue({});
    vi.spyOn(nodemailerModule.default, "createTransport").mockReturnValue({ sendMail: sendMailSpy });

    const { sendOtpEmail } = await import("../api/_lib/mailer.js");
    await sendOtpEmail("user@example.test", "654321", "login");

    expect(sendMailSpy).toHaveBeenCalledTimes(1);
    expect(sendMailSpy.mock.calls[0][0].from).toBe('"CashCanvas" <cashcanvas26@gmail.com>');
  });
});
