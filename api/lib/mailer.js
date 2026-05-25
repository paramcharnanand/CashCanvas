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

export const EMAIL_VERIFICATION_ENABLED =
  !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

const APP_URL = process.env.APP_URL || "http://localhost:5173";

function createTransporter() {
  if (!EMAIL_VERIFICATION_ENABLED) return null;
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

/** Send the email-verification link to a new user. */
export async function sendVerificationEmail(toEmail, token) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("[mailer] Email verification not configured — skipping verification email for", toEmail);
    return;
  }

  const verifyUrl = `${APP_URL}/verify?token=${token}`;

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

  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: `"CashCanvas" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: "Reset your CashCanvas password",
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>`,
    text: `Reset your CashCanvas password: ${resetUrl}\nExpires in 1 hour.`,
  });
}
