/**
 * POST /api/auth/resend-verification
 * Body: { email: string }
 *
 * Generates a fresh 24-hour verification token and emails it to the user.
 * Always returns 200 OK — never reveals whether the email is registered.
 */
import { getDb } from "../lib/db.js";
import {
  isEmailVerificationEnabled,
  generateVerificationToken,
  sendVerificationEmail,
} from "../lib/mailer.js";
import { checkRateLimit, getClientIp } from "../lib/ratelimit.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Rate limiting — 3 resends per IP per hour
  const ip    = getClientIp(req);
  const limit = checkRateLimit(`resend:${ip}`, 60 * 60_000, 3);
  if (!limit.ok) {
    return res.status(429).json({
      error: "Too many resend attempts. Please wait an hour before trying again.",
    });
  }

  if (!isEmailVerificationEnabled()) {
    return res.status(503).json({
      error: "Email verification is not configured on this server.",
    });
  }

  const { email } = req.body || {};
  if (!email)
    return res.status(400).json({ error: "Email is required." });

  try {
    const db   = await getDb();
    const user = await db.collection("users").findOne({ email: email.toLowerCase() });

    // Don't reveal whether the address is registered
    if (!user || user.emailVerified) {
      return res.json({
        ok:      true,
        message: "If that email is registered and unverified, a new link is on its way.",
      });
    }

    const token  = generateVerificationToken();
    const expiry = new Date(Date.now() + 24 * 60 * 60_000);

    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { verificationToken: token, verificationTokenExpiry: expiry } }
    );

    sendVerificationEmail(user.email, token).catch(err =>
      console.error("[resend] Email error:", err.message)
    );

    res.json({ ok: true, message: "A new verification link has been sent to your inbox." });
  } catch (err) {
    console.error("[resend]", err);
    res.status(500).json({ error: "Unable to resend verification email. Please try again." });
  }
}
