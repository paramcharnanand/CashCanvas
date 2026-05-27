import { getDb } from "../lib/db.js";
import { signToken } from "../lib/auth.js";
import { checkRateLimit, getClientIp } from "../lib/ratelimit.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Tight rate limit: 5 attempts per IP per 15 minutes
  const ip    = getClientIp(req);
  const limit = checkRateLimit(`verify-otp:${ip}`, 15 * 60_000, 5);
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    return res.status(429).json({ error: "Too many attempts. Please wait before trying again." });
  }

  const { email, otp } = req.body || {};
  if (!email || !otp)
    return res.status(400).json({ error: "Email and code are required." });
  if (!/^\d{6}$/.test(otp))
    return res.status(400).json({ error: "Code must be 6 digits." });

  try {
    const db   = await getDb();
    const user = await db.collection("users").findOne({ email: email.toLowerCase() });

    if (!user || !user.pendingOtp)
      return res.status(400).json({ error: "No verification code found. Please request a new one." });

    // Expiry check
    if (new Date() > new Date(user.pendingOtpExpiry)) {
      await db.collection("users").updateOne(
        { _id: user._id },
        { $unset: { pendingOtp: "", pendingOtpExpiry: "", pendingOtpAttempts: "", pendingOtpPurpose: "" } }
      );
      return res.status(400).json({ error: "Code expired. Please request a new one.", expired: true });
    }

    // Max attempts (3 wrong tries invalidates the OTP)
    const attempts = (user.pendingOtpAttempts || 0) + 1;
    if (user.pendingOtp !== otp) {
      if (attempts >= 3) {
        await db.collection("users").updateOne(
          { _id: user._id },
          { $unset: { pendingOtp: "", pendingOtpExpiry: "", pendingOtpAttempts: "", pendingOtpPurpose: "" } }
        );
        return res.status(400).json({ error: "Too many incorrect attempts. Please request a new code.", expired: true });
      }
      await db.collection("users").updateOne(
        { _id: user._id },
        { $set: { pendingOtpAttempts: attempts } }
      );
      const left = 3 - attempts;
      return res.status(400).json({ error: `Incorrect code. ${left} attempt${left !== 1 ? "s" : ""} remaining.` });
    }

    // OTP is correct — clear it and issue JWT
    const isSignup = user.pendingOtpPurpose === "signup";
    await db.collection("users").updateOne(
      { _id: user._id },
      {
        $set: {
          ...(isSignup ? { emailVerified: true, verifiedAt: new Date() } : {}),
          lastLoginAt: new Date(),
          failedLogins: 0,
          lockedUntil: null,
        },
        $unset: {
          pendingOtp: "",
          pendingOtpExpiry: "",
          pendingOtpAttempts: "",
          pendingOtpPurpose: "",
        },
      }
    );

    const token = signToken({ userId: user._id.toString(), email: user.email, name: user.name });
    res.json({ token, user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error("[verify-otp]", err);
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
}
