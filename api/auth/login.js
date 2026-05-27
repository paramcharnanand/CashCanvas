import { getDb } from "../lib/db.js";
import { checkRateLimit, getClientIp } from "../lib/ratelimit.js";
import { generateOtp, sendOtpEmail, isEmailVerificationEnabled } from "../lib/mailer.js";
import { signToken } from "../lib/auth.js";
import bcrypt from "bcryptjs";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS  = 15 * 60_000;
const OTP_TTL_MS           = 10 * 60_000; // 10 minutes

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const ip = getClientIp(req);
  const limit = checkRateLimit(`login:${ip}`, 15 * 60_000, 10);
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    return res.status(429).json({
      error: "Too many login attempts from this device. Please wait 15 minutes and try again.",
    });
  }

  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required." });

  try {
    const db   = await getDb();
    const user = await db.collection("users").findOne({ email: email.toLowerCase() });

    if (!user)
      return res.status(401).json({ error: "No account found with this email. Please sign up first." });

    // Account lockout
    if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
      const minutesLeft = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60_000);
      return res.status(429).json({
        error: `Account locked after too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.`,
      });
    }

    // Password check
    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      const failedCount = (user.failedLogins || 0) + 1;
      const shouldLock  = failedCount >= MAX_FAILED_ATTEMPTS;
      await db.collection("users").updateOne({ _id: user._id }, {
        $set: {
          failedLogins: failedCount,
          lastFailedAt: new Date(),
          ...(shouldLock ? { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) } : {}),
        },
      });
      const left = Math.max(0, MAX_FAILED_ATTEMPTS - failedCount);
      const suffix = shouldLock
        ? " Account locked for 15 minutes."
        : left === 1 ? " 1 attempt remaining before lockout."
        : left > 0   ? ` ${left} attempts remaining.`
        : "";
      return res.status(401).json({ error: `Incorrect password. Please try again.${suffix}` });
    }

    // Reset failed count on correct password
    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { failedLogins: 0, lockedUntil: null } }
    );

    // If email not configured: skip OTP, issue JWT directly (dev mode)
    if (!isEmailVerificationEnabled()) {
      await db.collection("users").updateOne(
        { _id: user._id },
        { $set: { lastLoginAt: new Date() } }
      );
      const token = signToken({ userId: user._id.toString(), email: user.email, name: user.name });
      return res.json({ token, user: { name: user.name, email: user.email } });
    }

    // Generate and store OTP
    const otp    = generateOtp();
    const expiry = new Date(Date.now() + OTP_TTL_MS);
    await db.collection("users").updateOne({ _id: user._id }, {
      $set: {
        pendingOtp:         otp,
        pendingOtpExpiry:   expiry,
        pendingOtpAttempts: 0,
        pendingOtpPurpose:  "login",
      },
    });

    sendOtpEmail(user.email, otp, "login").catch(err =>
      console.error("[login] OTP send error:", err.message)
    );

    res.json({ otpRequired: true, email: user.email });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ error: "Unable to sign in. Please try again." });
  }
}
