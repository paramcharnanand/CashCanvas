import { getDb } from "../lib/db.js";
import { signToken } from "../lib/auth.js";
import { verifyRecaptcha } from "../lib/recaptcha.js";
import { checkRateLimit, getClientIp } from "../lib/ratelimit.js";
import bcrypt from "bcryptjs";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS  = 15 * 60_000; // 15 minutes

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // IP-level rate limiting — 10 attempts per IP per 15 minutes
  const ip = getClientIp(req);
  const limit = checkRateLimit(`login:${ip}`, 15 * 60_000, 10);
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    return res.status(429).json({
      error: "Too many login attempts from this device. Please wait 15 minutes and try again.",
    });
  }

  const { email, password, captchaToken } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required." });

  // reCAPTCHA v3
  const captcha = await verifyRecaptcha(captchaToken);
  if (!captcha.ok)
    return res.status(400).json({ error: captcha.error });

  try {
    const db = await getDb();
    const user = await db.collection("users").findOne({ email: email.toLowerCase() });

    if (!user)
      return res.status(401).json({
        error: "No account found with this email. Please sign up first.",
      });

    // Account lockout check
    if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
      const minutesLeft = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60_000);
      return res.status(429).json({
        error: `Account locked after too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.`,
      });
    }

    // Password check
    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      const failedCount  = (user.failedLogins || 0) + 1;
      const shouldLock   = failedCount >= MAX_FAILED_ATTEMPTS;
      const update = {
        failedLogins: failedCount,
        lastFailedAt: new Date(),
        ...(shouldLock ? { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) } : {}),
      };
      await db.collection("users").updateOne({ _id: user._id }, { $set: update });

      const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - failedCount);
      const lockSuffix   = shouldLock
        ? " Account locked for 15 minutes."
        : attemptsLeft === 1
          ? " 1 attempt remaining before lockout."
          : attemptsLeft > 0
            ? ` ${attemptsLeft} attempts remaining.`
            : "";
      return res.status(401).json({
        error: `Incorrect password. Please try again.${lockSuffix}`,
      });
    }

    // Email verification gate
    // `emailVerified === false` (explicit) → blocked. undefined = legacy user → allowed.
    if (user.emailVerified === false) {
      return res.status(403).json({
        error: "Please verify your email address before signing in.",
        emailNotVerified: true,
        email: user.email,
      });
    }

    // Success — reset lockout counters
    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } }
    );

    const token = signToken({
      userId: user._id.toString(),
      email:  user.email,
      name:   user.name,
    });
    res.json({ token, user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ error: "Unable to sign in. Please try again." });
  }
}
