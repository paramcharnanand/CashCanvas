/**
 * POST /api/auth/signup
 *
 * Validates the signup form, runs reCAPTCHA v3, then stores the pending
 * signup (with hashed password + OTP) in the `pending_signups` collection.
 * The actual `users` document is NOT created until the OTP is verified.
 */
import { getDb } from "../lib/db.js";
import { signToken } from "../lib/auth.js";
import { generateOtp, sendOtpEmail, isEmailVerificationEnabled } from "../lib/mailer.js";
import { verifyRecaptcha } from "../lib/recaptcha.js";
import { checkRateLimit, getClientIp } from "../lib/ratelimit.js";
import bcrypt from "bcryptjs";

const OTP_TTL_MS = 10 * 60_000;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Rate limiting — 5 sign-ups per IP per 15 minutes
  const ip = getClientIp(req);
  const limit = checkRateLimit(`signup:${ip}`, 15 * 60_000, 5);
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    return res.status(429).json({
      error: "Too many sign-up attempts from this device. Please wait 15 minutes and try again.",
    });
  }

  const { name, email, password, captchaToken } = req.body || {};

  if (!name?.trim() || !email || !password)
    return res.status(400).json({ error: "Name, email and password are required." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "Please enter a valid email address." });
  if (password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters." });

  // reCAPTCHA v3 — skipped gracefully if RECAPTCHA_SECRET_KEY is not set
  const captcha = await verifyRecaptcha(captchaToken);
  if (!captcha.ok)
    return res.status(400).json({ error: captcha.error });

  try {
    const db = await getDb();

    // Block if email is already a fully-created account
    const existing = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ error: "This email is already registered. Try signing in instead." });

    const passwordHash = await bcrypt.hash(password, 12);
    const emailEnabled = isEmailVerificationEnabled();

    // Dev mode — no email configured: create user directly and sign in
    if (!emailEnabled) {
      const result = await db.collection("users").insertOne({
        name:          name.trim(),
        email:         email.toLowerCase(),
        passwordHash,
        emailVerified: true,
        failedLogins:  0,
        lockedUntil:   null,
        createdAt:     new Date(),
      });
      const token = signToken({
        userId: result.insertedId.toString(),
        email:  email.toLowerCase(),
        name:   name.trim(),
      });
      return res.status(201).json({ token, user: { name: name.trim(), email: email.toLowerCase() } });
    }

    // Generate OTP and store as pending signup (user account not created yet)
    const otp    = generateOtp();
    const expiry = new Date(Date.now() + OTP_TTL_MS);

    await db.collection("pending_signups").updateOne(
      { email: email.toLowerCase() },
      {
        $set: {
          name:         name.trim(),
          email:        email.toLowerCase(),
          passwordHash,
          otp,
          otpExpiry:    expiry,
          otpAttempts:  0,
          createdAt:    new Date(),
        },
      },
      { upsert: true }
    );

    sendOtpEmail(email.toLowerCase(), otp, "signup").catch(err =>
      console.error("[signup] OTP send error:", err.message)
    );

    res.status(201).json({ otpRequired: true, email: email.toLowerCase() });
  } catch (err) {
    console.error("[signup]", err);
    res.status(500).json({ error: "Unable to create your account. Please try again." });
  }
}
