/**
 * /api/auth — consolidated auth handler
 * Routes: signup, login, verify-otp, resend-otp, profile,
 *         verify (legacy link), resend-verification (legacy), delete-account
 */
import { getDb }                                               from "./lib/db.js";
import { signToken, getUser }                                  from "./lib/auth.js";
import { generateOtp, sendOtpEmail, isEmailVerificationEnabled,
         generateVerificationToken, sendVerificationEmail }    from "./lib/mailer.js";
import { verifyRecaptcha }                                     from "./lib/recaptcha.js";
import { checkRateLimit, getClientIp }                        from "./lib/ratelimit.js";
import bcrypt                                                  from "bcryptjs";
import { ObjectId }                                            from "mongodb";

const MAX_FAILED = 5;
const LOCKOUT_MS = 15 * 60_000;
const OTP_TTL_MS = 10 * 60_000;

// ── helpers ───────────────────────────────────────────────────────────────────
function qp(req) {
  return new URLSearchParams(req.url.split("?")[1] || "");
}

// ── route handlers ────────────────────────────────────────────────────────────

async function signup(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const ip    = getClientIp(req);
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

  const captcha = await verifyRecaptcha(captchaToken);
  if (!captcha.ok) return res.status(400).json({ error: captcha.error });

  try {
    const db = await getDb();
    const existing = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ error: "This email is already registered. Try signing in instead." });

    const passwordHash = await bcrypt.hash(password, 12);
    const emailEnabled = isEmailVerificationEnabled();

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

    const otp    = generateOtp();
    const expiry = new Date(Date.now() + OTP_TTL_MS);

    await db.collection("pending_signups").updateOne(
      { email: email.toLowerCase() },
      {
        $set: {
          name:        name.trim(),
          email:       email.toLowerCase(),
          passwordHash,
          otp,
          otpExpiry:   expiry,
          otpAttempts: 0,
          createdAt:   new Date(),
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

async function login(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const ip    = getClientIp(req);
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

    if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
      const minutesLeft = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60_000);
      return res.status(429).json({
        error: `Account locked after too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.`,
      });
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      const failedCount = (user.failedLogins || 0) + 1;
      const shouldLock  = failedCount >= MAX_FAILED;
      await db.collection("users").updateOne({ _id: user._id }, {
        $set: {
          failedLogins: failedCount,
          lastFailedAt: new Date(),
          ...(shouldLock ? { lockedUntil: new Date(Date.now() + LOCKOUT_MS) } : {}),
        },
      });
      const left   = Math.max(0, MAX_FAILED - failedCount);
      const suffix = shouldLock
        ? " Account locked for 15 minutes."
        : left === 1 ? " 1 attempt remaining before lockout."
        : left > 0   ? ` ${left} attempts remaining.`
        : "";
      return res.status(401).json({ error: `Incorrect password. Please try again.${suffix}` });
    }

    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { failedLogins: 0, lockedUntil: null } }
    );

    if (!isEmailVerificationEnabled()) {
      await db.collection("users").updateOne(
        { _id: user._id },
        { $set: { lastLoginAt: new Date() } }
      );
      const token = signToken({ userId: user._id.toString(), email: user.email, name: user.name });
      return res.json({ token, user: { name: user.name, email: user.email } });
    }

    const otp    = generateOtp();
    const expiry = new Date(Date.now() + OTP_TTL_MS);
    await db.collection("users").updateOne({ _id: user._id }, {
      $set: { pendingOtp: otp, pendingOtpExpiry: expiry, pendingOtpAttempts: 0, pendingOtpPurpose: "login" },
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

async function verifyOtp(req, res) {
  if (req.method !== "POST") return res.status(405).end();

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
    const db     = await getDb();
    const lEmail = email.toLowerCase();

    const pending = await db.collection("pending_signups").findOne({ email: lEmail });
    if (pending) {
      if (new Date() > new Date(pending.otpExpiry)) {
        await db.collection("pending_signups").deleteOne({ email: lEmail });
        return res.status(400).json({ error: "Code expired. Please request a new one.", expired: true });
      }
      const attempts = (pending.otpAttempts || 0) + 1;
      if (pending.otp !== otp) {
        if (attempts >= 3) {
          await db.collection("pending_signups").deleteOne({ email: lEmail });
          return res.status(400).json({ error: "Too many incorrect attempts. Please request a new code.", expired: true });
        }
        await db.collection("pending_signups").updateOne({ email: lEmail }, { $set: { otpAttempts: attempts } });
        const left = 3 - attempts;
        return res.status(400).json({ error: `Incorrect code. ${left} attempt${left !== 1 ? "s" : ""} remaining.` });
      }
      const result = await db.collection("users").insertOne({
        name:          pending.name,
        email:         lEmail,
        passwordHash:  pending.passwordHash,
        emailVerified: true,
        verifiedAt:    new Date(),
        failedLogins:  0,
        lockedUntil:   null,
        lastLoginAt:   new Date(),
        createdAt:     new Date(),
      });
      await db.collection("pending_signups").deleteOne({ email: lEmail });
      const token = signToken({ userId: result.insertedId.toString(), email: lEmail, name: pending.name });
      return res.json({ token, user: { name: pending.name, email: lEmail } });
    }

    const user = await db.collection("users").findOne({ email: lEmail });
    if (!user || !user.pendingOtp)
      return res.status(400).json({ error: "No verification code found. Please request a new one." });

    if (new Date() > new Date(user.pendingOtpExpiry)) {
      await db.collection("users").updateOne({ email: lEmail },
        { $unset: { pendingOtp: "", pendingOtpExpiry: "", pendingOtpAttempts: "", pendingOtpPurpose: "" } }
      );
      return res.status(400).json({ error: "Code expired. Please request a new one.", expired: true });
    }
    const attempts = (user.pendingOtpAttempts || 0) + 1;
    if (user.pendingOtp !== otp) {
      if (attempts >= 3) {
        await db.collection("users").updateOne({ email: lEmail },
          { $unset: { pendingOtp: "", pendingOtpExpiry: "", pendingOtpAttempts: "", pendingOtpPurpose: "" } }
        );
        return res.status(400).json({ error: "Too many incorrect attempts. Please request a new code.", expired: true });
      }
      await db.collection("users").updateOne({ email: lEmail }, { $set: { pendingOtpAttempts: attempts } });
      const left = 3 - attempts;
      return res.status(400).json({ error: `Incorrect code. ${left} attempt${left !== 1 ? "s" : ""} remaining.` });
    }

    await db.collection("users").updateOne({ email: lEmail }, {
      $set:   { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null },
      $unset: { pendingOtp: "", pendingOtpExpiry: "", pendingOtpAttempts: "", pendingOtpPurpose: "" },
    });
    const token = signToken({ userId: user._id.toString(), email: user.email, name: user.name });
    res.json({ token, user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error("[verify-otp]", err);
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
}

async function resendOtp(req, res) {
  if (req.method !== "POST") return res.status(405).end();

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
    res.json({ ok: true });
  } catch (err) {
    console.error("[resend-otp]", err);
    res.status(500).json({ error: "Unable to resend code. Please try again." });
  }
}

function profile(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  res.json({ name: user.name, email: user.email });
}

async function verifyLink(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const token = qp(req).get("token");
  if (!token || token.length < 32)
    return res.status(400).json({ error: "Invalid verification link." });

  try {
    const db   = await getDb();
    const user = await db.collection("users").findOne({ verificationToken: token });

    if (!user)
      return res.status(400).json({ error: "This verification link is invalid or has already been used." });
    if (new Date() > new Date(user.verificationTokenExpiry))
      return res.status(400).json({ error: "This verification link has expired. Request a new one below.", expired: true, email: user.email });

    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { emailVerified: true, verificationToken: null, verificationTokenExpiry: null, verifiedAt: new Date() } }
    );

    const jwtToken = signToken({ userId: user._id.toString(), email: user.email, name: user.name });
    res.json({ ok: true, token: jwtToken, user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error("[verify]", err);
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
}

async function resendVerification(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const ip    = getClientIp(req);
  const limit = checkRateLimit(`resend:${ip}`, 60 * 60_000, 3);
  if (!limit.ok)
    return res.status(429).json({ error: "Too many resend attempts. Please wait an hour before trying again." });

  if (!isEmailVerificationEnabled())
    return res.status(503).json({ error: "Email verification is not configured on this server." });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email is required." });

  try {
    const db   = await getDb();
    const user = await db.collection("users").findOne({ email: email.toLowerCase() });

    if (!user || user.emailVerified)
      return res.json({ ok: true, message: "If that email is registered and unverified, a new link is on its way." });

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

async function deleteAccount(req, res) {
  if (req.method !== "DELETE") return res.status(405).end();

  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  try {
    const db = await getDb();
    const uid = user.userId;

    await Promise.all([
      db.collection("users").deleteOne({ _id: new ObjectId(uid) }),
      db.collection("uploaded_files").deleteMany({ userId: uid }),
      db.collection("custom_categories").deleteMany({ userId: uid }),
      db.collection("merchant_category_rules").deleteMany({ userId: uid }),
      db.collection("pending_signups").deleteOne({ email: user.email }),
    ]);

    res.json({ ok: true });
  } catch (err) {
    console.error("[delete-account]", err);
    res.status(500).json({ error: "Unable to delete account. Please try again." });
  }
}

// ── router ────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const path = req.url.split("?")[0];

  if (req.method === "POST"   && path === "/api/auth/signup")               return signup(req, res);
  if (req.method === "POST"   && path === "/api/auth/login")                return login(req, res);
  if (req.method === "POST"   && path === "/api/auth/verify-otp")           return verifyOtp(req, res);
  if (req.method === "POST"   && path === "/api/auth/resend-otp")           return resendOtp(req, res);
  if (req.method === "GET"    && path === "/api/auth/profile")              return profile(req, res);
  if (req.method === "GET"    && path === "/api/auth/verify")               return verifyLink(req, res);
  if (req.method === "POST"   && path === "/api/auth/resend-verification")  return resendVerification(req, res);
  if (req.method === "DELETE" && path === "/api/auth/delete-account")       return deleteAccount(req, res);

  res.status(404).json({ error: "Not found" });
}
