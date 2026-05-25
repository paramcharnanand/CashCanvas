import { getDb } from "../lib/db.js";
import { signToken } from "../lib/auth.js";
import { verifyRecaptcha } from "../lib/recaptcha.js";
import {
  isEmailVerificationEnabled,
  generateVerificationToken,
  sendVerificationEmail,
} from "../lib/mailer.js";
import { checkRateLimit, getClientIp } from "../lib/ratelimit.js";
import bcrypt from "bcryptjs";

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

  // Basic validation
  if (!name?.trim() || !email || !password)
    return res.status(400).json({ error: "Name, email and password are required." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "Please enter a valid email address." });
  if (password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters." });

  // reCAPTCHA v3
  const captcha = await verifyRecaptcha(captchaToken);
  if (!captcha.ok)
    return res.status(400).json({ error: captcha.error });

  try {
    const db = await getDb();

    // Prevent duplicate accounts
    const existing = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({
        error: "This email is already registered. Try signing in instead.",
      });

    const passwordHash = await bcrypt.hash(password, 12);

    // Evaluate at request time so --env-file / Vercel runtime values are current
    const emailEnabled = isEmailVerificationEnabled();

    // Email verification setup
    const verificationToken = emailEnabled ? generateVerificationToken() : null;
    const verificationTokenExpiry = emailEnabled
      ? new Date(Date.now() + 24 * 60 * 60_000) // 24 h
      : null;

    const result = await db.collection("users").insertOne({
      name:  name.trim(),
      email: email.toLowerCase(),
      passwordHash,
      emailVerified:            !emailEnabled, // auto-verified in dev mode
      verificationToken,
      verificationTokenExpiry,
      failedLogins:  0,
      lockedUntil:   null,
      createdAt:     new Date(),
    });

    if (emailEnabled) {
      // Fire-and-forget — don't block the response
      sendVerificationEmail(email.toLowerCase(), verificationToken).catch(err =>
        console.error("[signup] Email send error:", err.message)
      );
      return res.status(201).json({
        verificationRequired: true,
        message: "Account created! Check your email for a verification link.",
      });
    }

    // Dev mode: auto sign-in immediately
    const token = signToken({
      userId: result.insertedId.toString(),
      email:  email.toLowerCase(),
      name:   name.trim(),
    });
    res.status(201).json({ token, user: { name: name.trim(), email: email.toLowerCase() } });
  } catch (err) {
    console.error("[signup]", err);
    res.status(500).json({ error: "Unable to create your account. Please try again." });
  }
}
