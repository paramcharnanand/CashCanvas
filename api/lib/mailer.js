/**
 * Email sending utility using Nodemailer + Gmail SMTP.
 *
 * Required env vars:
 *   GMAIL_USER          – your Gmail address (e.g. you@gmail.com)
 *   GMAIL_APP_PASSWORD  – 16-char App Password (Google Account → Security → App Passwords)
 *   APP_URL             – public base URL of the app (for verification links)
 *
 * When these vars are not set the mailer is disabled and logs a warning.
 * The app still works — users are auto-verified in that mode.
 */

import nodemailer from "nodemailer";
import crypto from "crypto";

/**
 * Checked at call time (not import time) so env vars loaded via --env-file
 * or Vercel's runtime are always reflected correctly.
 */
export const isEmailVerificationEnabled = () =>
  !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

// Keep the old name as an alias so any code that imported the const still compiles.
// Deprecated — prefer isEmailVerificationEnabled().
export const EMAIL_VERIFICATION_ENABLED = isEmailVerificationEnabled;

const getAppUrl = () => process.env.APP_URL || "http://localhost:5173";

function createTransporter() {
  if (!isEmailVerificationEnabled()) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

/** Generate a cryptographically secure 32-byte hex token. */
export function generateVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

/** Generate a cryptographically secure 6-digit OTP. */
export function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

/** Send a 6-digit OTP to a user's email for login or signup verification. */
export async function sendOtpEmail(toEmail, otp, purpose = "login") {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("[mailer] Email not configured — OTP for", toEmail, "is", otp);
    return;
  }

  const isSignup = purpose === "signup";
  const subject  = isSignup ? "Verify your CashCanvas account" : "Your CashCanvas sign-in code";
  const headline = isSignup ? "Verify your email" : "Sign-in code";
  const subtext  = isSignup
    ? "Enter this code to verify your email and activate your CashCanvas account."
    : "Enter this code to sign in to your CashCanvas account.";

  // Render individual digit boxes — more reliable than letter-spacing across email clients
  const digitBoxes = otp.split("").map(d =>
    `<td style="padding:0 4px;">` +
    `<table cellpadding="0" cellspacing="0"><tr><td style="width:44px;height:52px;background:#f5f3f0;` +
    `border:1.5px solid #d4e5d8;border-radius:8px;text-align:center;vertical-align:middle;">` +
    `<span style="font-size:22px;font-weight:700;color:#005235;font-family:'Courier New',Courier,monospace;">${d}</span>` +
    `</td></tr></table></td>`
  ).join("");

  await transporter.sendMail({
    from: `"CashCanvas" <${process.env.GMAIL_USER}>`,
    to:   toEmail,
    subject,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#fbf9f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background:#fbf9f6;padding:48px 20px;">
    <tr><td align="center">

      <!-- Card -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:480px;background:#ffffff;border-radius:16px;
                    border:1px solid #efeeeb;
                    box-shadow:0 4px 24px rgba(27,28,26,0.07);">

        <!-- Header -->
        <tr>
          <td style="background:#005235;padding:22px 36px;border-radius:16px 16px 0 0;">
            <span style="font-family:Georgia,'Times New Roman',serif;font-style:italic;
                         font-size:24px;font-weight:400;color:#ffffff;letter-spacing:-0.3px;">
              Cash<span style="color:#86efbe;">Canvas</span>
            </span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 28px;">
            <!-- Overline -->
            <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#6f7a72;
                      letter-spacing:0.09em;text-transform:uppercase;">
              ${isSignup ? "Account Verification" : "Sign-In Code"}
            </p>
            <!-- Headline -->
            <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;
                       font-weight:400;font-style:italic;font-size:24px;color:#1b1c1a;">
              ${headline}
            </h1>
            <p style="margin:0 0 32px;font-size:14px;color:#3f4943;line-height:1.7;">
              ${subtext}
            </p>

            <!-- OTP digit boxes -->
            <table cellpadding="0" cellspacing="0" role="presentation"
                   style="margin:0 auto 28px;">
              <tr>${digitBoxes}</tr>
            </table>

            <!-- Expiry note -->
            <table cellpadding="0" cellspacing="0" role="presentation"
                   style="background:#f5f3f0;border-radius:8px;margin:0 auto 8px;width:100%;">
              <tr>
                <td style="padding:12px 16px;text-align:center;">
                  <span style="font-size:13px;color:#6f7a72;">
                    Code expires in&nbsp;
                    <strong style="color:#1b1c1a;">10 minutes</strong>
                    &nbsp;· Single use only
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:0 36px;">
            <div style="height:1px;background:#efeeeb;"></div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-radius:0 0 16px 16px;">
            <p style="margin:0;font-size:12px;color:#6f7a72;line-height:1.6;">
              If you didn't request this code, you can safely ignore this email —
              your account won't be affected.
            </p>
            <p style="margin:12px 0 0;font-size:11px;color:#a0a89e;">
              © 2026 CashCanvas · Your personal finance dashboard
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `${subject}\n\nYour code: ${otp}\n\n${subtext}\n\nExpires in 10 minutes. Single use only.\n\nIf you didn't request this, ignore this email.`,
  });
}

/** Send the email-verification link to a new user. */
export async function sendVerificationEmail(toEmail, token) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("[mailer] Email verification not configured — skipping verification email for", toEmail);
    return;
  }

  const verifyUrl = `${getAppUrl()}/verify?token=${token}`;

  await transporter.sendMail({
    from: `"CashCanvas" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: "Verify your CashCanvas account",
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fbf9f6;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fbf9f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(27,28,26,0.08);">
        <tr>
          <td style="background:#005235;padding:28px 40px;">
            <p style="margin:0;font-family:Georgia,serif;font-style:italic;font-size:26px;color:#ffffff;">CashCanvas</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1b1c1a;font-family:Georgia,serif;font-style:italic;">Verify your email</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#3f4943;line-height:1.7;">
              Thanks for signing up! Click the button below to confirm your email address and activate your CashCanvas account.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="border-radius:8px;background:#005235;">
                  <a href="${verifyUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                    Verify Email Address
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;color:#6f7a72;line-height:1.6;">
              This link expires in <strong>24 hours</strong>. If you didn't create a CashCanvas account, you can safely ignore this email.
            </p>
            <p style="margin:0;font-size:12px;color:#6f7a72;">
              If the button doesn't work, paste this URL into your browser:<br>
              <a href="${verifyUrl}" style="color:#005235;word-break:break-all;">${verifyUrl}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #efeeeb;">
            <p style="margin:0;font-size:11px;color:#6f7a72;">© 2026 CashCanvas — Your personal finance dashboard</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `Verify your CashCanvas account\n\nClick this link to verify your email address:\n${verifyUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't sign up for CashCanvas, ignore this email.`,
  });
}

/** Send a password-reset email (future use — stub prepared). */
export async function sendPasswordResetEmail(toEmail, token) {
  const transporter = createTransporter();
  if (!transporter) return;

  const resetUrl = `${getAppUrl()}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: `"CashCanvas" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: "Reset your CashCanvas password",
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>`,
    text: `Reset your CashCanvas password: ${resetUrl}\nExpires in 1 hour.`,
  });
}
