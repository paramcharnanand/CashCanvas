import { getDb } from "../lib/db.js";
import { signToken } from "../lib/auth.js";
import { generateOtp, sendOtpEmail, isEmailVerificationEnabled } from "../lib/mailer.js";
import { checkRateLimit, getClientIp } from "../lib/ratelimit.js";
import bcrypt from "bcryptjs";

const OTP_TTL_MS = 10 * 60_000;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const ip = getClientIp(req);
  const limit = checkRateLimit(`signup:${ip}`, 15 * 60_000, 5);
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    return res.status(429).json({
      error: "Too many sign-up attempts from this device. Please wait 15 minutes and try again.",
    });
  }

  const { name, email, password } = req.body || {};

  if (!name?.trim() || !email || !password)
    return res.status(400).json({ error: "Name, email and password are required." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "Please enter a valid email address." });
  if (password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters." });

  try {
    const db = await getDb();
    const existing = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ error: "This email is already registered. Try signing in instead." });

    const passwordHash = await bcrypt.hash(password, 12);
    const emailEnabled = isEmailVerificationEnabled();
    const otp          = emailEnabled ? generateOtp() : null;
    const otpExpiry    = emailEnabled ? new Date(Date.now() + OTP_TTL_MS) : null;

    const result = await db.collection("users").insertOne({
      name:  name.trim(),
      email: email.toLowerCase(),
      passwordHash,
      emailVerified:      !emailEnabled, // auto-verified in dev mode
      pendingOtp:         otp,
      pendingOtpExpiry:   otpExpiry,
      pendingOtpAttempts: 0,
      pendingOtpPurpose:  "signup",
      failedLogins:       0,
      lockedUntil:        null,
      createdAt:          new Date(),
    });

    if (emailEnabled) {
      sendOtpEmail(email.toLowerCase(), otp, "signup").catch(err =>
        console.error("[signup] OTP send error:", err.message)
      );
      return res.status(201).json({ otpRequired: true, email: email.toLowerCase() });
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
