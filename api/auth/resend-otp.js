/**
 * POST /api/auth/resend-otp
 * Body: { email }
 *
 * Regenerates and resends a 6-digit OTP.
 * Checks `pending_signups` first (signup flow), then `users` (login flow).
 */
import { getDb } from "../lib/db.js";
import { generateOtp, sendOtpEmail, isEmailVerificationEnabled } from "../lib/mailer.js";
import { checkRateLimit, getClientIp } from "../lib/ratelimit.js";

const OTP_TTL_MS = 10 * 60_000;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Rate limit: 3 resends per IP per hour
  const ip    = getClientIp(req);
  const limit = checkRateLimit(`resend-otp:${ip}`, 60 * 60_000, 3);
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    return res.status(429).json({ error: "Too many resend attempts. Please wait before trying again." });
  }

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email is required." });

  if (!isEmailVerificationEnabled())
    return res.status(503).json({ error: "Email is not configured on this server." });

  try {
    const db     = await getDb();
    const lEmail = email.toLowerCase();
    const otp    = generateOtp();
    const expiry = new Date(Date.now() + OTP_TTL_MS);

    // Check pending_signups first (signup flow)
    const pending = await db.collection("pending_signups").findOne({ email: lEmail });
    if (pending) {
      await db.collection("pending_signups").updateOne(
        { email: lEmail },
        { $set: { otp, otpExpiry: expiry, otpAttempts: 0 } }
      );
      sendOtpEmail(lEmail, otp, "signup").catch(err =>
        console.error("[resend-otp] Email error:", err.message)
      );
      return res.json({ ok: true });
    }

    // Fallback: login OTP stored on user document
    const user = await db.collection("users").findOne({ email: lEmail });
    if (user) {
      await db.collection("users").updateOne(
        { email: lEmail },
        { $set: { pendingOtp: otp, pendingOtpExpiry: expiry, pendingOtpAttempts: 0 } }
      );
      sendOtpEmail(lEmail, otp, user.pendingOtpPurpose || "login").catch(err =>
        console.error("[resend-otp] Email error:", err.message)
      );
    }

    // Always return ok — don't reveal whether the address is registered
    res.json({ ok: true });
  } catch (err) {
    console.error("[resend-otp]", err);
    res.status(500).json({ error: "Unable to resend code. Please try again." });
  }
}
