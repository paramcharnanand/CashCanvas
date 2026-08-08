/**
 * /api/auth — consolidated auth handler
 * Routes: signup, login, verify-otp, resend-otp, refresh, logout, logout-all,
 *         profile, verify (legacy link), resend-verification (legacy),
 *         delete-account, forgot-password, reset-password
 *
 * Auth state lives entirely in HttpOnly cookies (see api/_lib/cookies.js) —
 * no route in this file ever puts a JWT or refresh token in a JSON response.
 */
import { getDb }                                               from "./_lib/db.js";
import { generateAccessToken, getUser }                        from "./_lib/jwt.js";
import { hashPassword, comparePassword }                       from "./_lib/password.js";
import { isValidEmail, isValidPassword, isValidOtpFormat }      from "./_lib/validation.js";
import { generateOtp, otpExpiry, isOtpExpired, MAX_OTP_ATTEMPTS } from "./_lib/otp.js";
import { sendOtpEmail, isEmailVerificationEnabled,
         generateVerificationToken, sendVerificationEmail,
         sendPasswordResetEmail }                              from "./_lib/mailer.js";
import { verifyRecaptcha }                                     from "./_lib/recaptcha.js";
import { checkRateLimit, getClientIp }                        from "./_lib/ratelimit.js";
import { getCookie, setAuthCookies, clearAuthCookies,
         REFRESH_COOKIE }                                      from "./_lib/cookies.js";
import { generateRefreshToken, createSession, findActiveSessionByToken,
         rotateSession, revokeSessionByToken, revokeAllSessionsForUser } from "./_lib/session.js";
import { generateCsrfToken, requireCsrf }                      from "./_lib/csrf.js";
import { withErrorHandling }                                   from "./_lib/http.js";
import { logger }                                              from "./_lib/logger.js";
import { ObjectId }                                            from "mongodb";

const MAX_FAILED = 5;
const LOCKOUT_MS = 15 * 60_000;

// ── helpers ───────────────────────────────────────────────────────────────────
function qp(req) {
  return new URLSearchParams(req.url.split("?")[1] || "");
}

/**
 * Issue a new session for a freshly authenticated user: creates the
 * refresh-token session record in Mongo and sets all three auth cookies.
 * Never returns a token — callers respond with `{ user }` only.
 */
async function establishSession(req, res, db, { userId, email, name }) {
  const accessToken  = generateAccessToken({ userId, email, name });
  const refreshToken = generateRefreshToken();
  const csrfToken     = generateCsrfToken();

  await createSession(db, {
    userId,
    refreshToken,
    userAgent: req.headers["user-agent"],
    ip: getClientIp(req),
  });

  setAuthCookies(res, { accessToken, refreshToken, csrfToken });
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
  if (!isValidEmail(email))
    return res.status(400).json({ error: "Please enter a valid email address." });
  if (!isValidPassword(password))
    return res.status(400).json({ error: "Password must be at least 8 characters." });

  const captcha = await verifyRecaptcha(captchaToken);
  if (!captcha.ok) return res.status(400).json({ error: captcha.error });

  try {
    const db = await getDb();
    const existing = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ error: "This email is already registered. Try signing in instead." });

    const passwordHash = await hashPassword(password);
    const emailEnabled = isEmailVerificationEnabled();

    if (!emailEnabled) {
      let result;
      try {
        result = await db.collection("users").insertOne({
          name:          name.trim(),
          email:         email.toLowerCase(),
          passwordHash,
          emailVerified: true,
          failedLogins:  0,
          lockedUntil:   null,
          createdAt:     new Date(),
        });
      } catch (err) {
        // The findOne pre-check above can't catch a concurrent signup with
        // the same email — the unique index on users.email is what actually
        // makes this race-safe.
        if (err.code === 11000)
          return res.status(409).json({ error: "This email is already registered. Try signing in instead." });
        throw err;
      }
      await establishSession(req, res, db, {
        userId: result.insertedId.toString(),
        email:  email.toLowerCase(),
        name:   name.trim(),
      });
      return res.status(201).json({ user: { name: name.trim(), email: email.toLowerCase() } });
    }

    const otp    = generateOtp();
    const expiry = otpExpiry();

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

    try {
      await sendOtpEmail(email.toLowerCase(), otp, "signup");
    } catch (err) {
      logger.error("signup", err.message, { context: "OTP send error" });
      return res.status(502).json({ error: "Couldn't send the verification email. Please try again in a moment." });
    }

    res.status(201).json({ otpRequired: true, email: email.toLowerCase() });
  } catch (err) {
    logger.error("signup", err);
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

    const passwordOk = await comparePassword(password, user.passwordHash);
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
      const suffix = shouldLock ? " Account locked for 15 minutes." : "";
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
      await establishSession(req, res, db, { userId: user._id.toString(), email: user.email, name: user.name });
      return res.json({ user: { name: user.name, email: user.email } });
    }

    const otp    = generateOtp();
    const expiry = otpExpiry();
    await db.collection("users").updateOne({ _id: user._id }, {
      $set: { pendingOtp: otp, pendingOtpExpiry: expiry, pendingOtpAttempts: 0, pendingOtpPurpose: "login" },
    });

    try {
      await sendOtpEmail(user.email, otp, "login");
    } catch (err) {
      logger.error("login", err.message, { context: "OTP send error" });
      return res.status(502).json({ error: "Couldn't send the sign-in code. Please try again in a moment." });
    }

    res.json({ otpRequired: true, email: user.email });
  } catch (err) {
    logger.error("login", err);
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
  if (!isValidOtpFormat(otp))
    return res.status(400).json({ error: "Code must be 6 digits." });

  try {
    const db     = await getDb();
    const lEmail = email.toLowerCase();

    const pending = await db.collection("pending_signups").findOne({ email: lEmail });
    if (pending) {
      if (isOtpExpired(pending.otpExpiry)) {
        await db.collection("pending_signups").deleteOne({ email: lEmail });
        return res.status(400).json({ error: "Code expired. Please request a new one.", expired: true });
      }
      const attempts = (pending.otpAttempts || 0) + 1;
      if (pending.otp !== otp) {
        if (attempts >= MAX_OTP_ATTEMPTS) {
          await db.collection("pending_signups").deleteOne({ email: lEmail });
          return res.status(400).json({ error: "Too many incorrect attempts. Please request a new code.", expired: true });
        }
        await db.collection("pending_signups").updateOne({ email: lEmail }, { $set: { otpAttempts: attempts } });
        const left = MAX_OTP_ATTEMPTS - attempts;
        return res.status(400).json({ error: `Incorrect code. ${left} attempt${left !== 1 ? "s" : ""} remaining.` });
      }
      let result;
      try {
        result = await db.collection("users").insertOne({
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
      } catch (err) {
        // Two devices racing the same pending signup's OTP could both reach
        // here — the unique index on users.email is the real guard.
        if (err.code === 11000) {
          await db.collection("pending_signups").deleteOne({ email: lEmail });
          return res.status(409).json({ error: "This email is already registered. Try signing in instead." });
        }
        throw err;
      }
      await db.collection("pending_signups").deleteOne({ email: lEmail });
      await establishSession(req, res, db, { userId: result.insertedId.toString(), email: lEmail, name: pending.name });
      return res.json({ user: { name: pending.name, email: lEmail } });
    }

    const user = await db.collection("users").findOne({ email: lEmail });
    if (!user || !user.pendingOtp)
      return res.status(400).json({ error: "No verification code found. Please request a new one." });

    if (isOtpExpired(user.pendingOtpExpiry)) {
      await db.collection("users").updateOne({ email: lEmail },
        { $unset: { pendingOtp: "", pendingOtpExpiry: "", pendingOtpAttempts: "", pendingOtpPurpose: "" } }
      );
      return res.status(400).json({ error: "Code expired. Please request a new one.", expired: true });
    }
    const attempts = (user.pendingOtpAttempts || 0) + 1;
    if (user.pendingOtp !== otp) {
      if (attempts >= MAX_OTP_ATTEMPTS) {
        await db.collection("users").updateOne({ email: lEmail },
          { $unset: { pendingOtp: "", pendingOtpExpiry: "", pendingOtpAttempts: "", pendingOtpPurpose: "" } }
        );
        return res.status(400).json({ error: "Too many incorrect attempts. Please request a new code.", expired: true });
      }
      await db.collection("users").updateOne({ email: lEmail }, { $set: { pendingOtpAttempts: attempts } });
      const left = MAX_OTP_ATTEMPTS - attempts;
      return res.status(400).json({ error: `Incorrect code. ${left} attempt${left !== 1 ? "s" : ""} remaining.` });
    }

    await db.collection("users").updateOne({ email: lEmail }, {
      $set:   { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null },
      $unset: { pendingOtp: "", pendingOtpExpiry: "", pendingOtpAttempts: "", pendingOtpPurpose: "" },
    });
    await establishSession(req, res, db, { userId: user._id.toString(), email: user.email, name: user.name });
    res.json({ user: { name: user.name, email: user.email } });
  } catch (err) {
    logger.error("verify-otp", err);
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
    const expiry = otpExpiry();

    const pending = await db.collection("pending_signups").findOne({ email: lEmail });
    if (pending) {
      await db.collection("pending_signups").updateOne(
        { email: lEmail },
        { $set: { otp, otpExpiry: expiry, otpAttempts: 0 } }
      );
      try {
        await sendOtpEmail(lEmail, otp, "signup");
      } catch (err) {
        logger.error("resend-otp", err.message, { context: "Email error" });
        return res.status(502).json({ error: "Couldn't send the code. Please try again in a moment." });
      }
      return res.json({ ok: true });
    }

    const user = await db.collection("users").findOne({ email: lEmail });
    if (user) {
      await db.collection("users").updateOne(
        { email: lEmail },
        { $set: { pendingOtp: otp, pendingOtpExpiry: expiry, pendingOtpAttempts: 0 } }
      );
      try {
        await sendOtpEmail(lEmail, otp, user.pendingOtpPurpose || "login");
      } catch (err) {
        logger.error("resend-otp", err.message, { context: "Email error" });
        return res.status(502).json({ error: "Couldn't send the code. Please try again in a moment." });
      }
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error("resend-otp", err);
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

    await establishSession(req, res, db, { userId: user._id.toString(), email: user.email, name: user.name });
    res.json({ ok: true, user: { name: user.name, email: user.email } });
  } catch (err) {
    logger.error("verify", err);
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

    try {
      await sendVerificationEmail(user.email, token);
    } catch (err) {
      logger.error("resend", err.message, { context: "Email error" });
    }

    res.json({ ok: true, message: "A new verification link has been sent to your inbox." });
  } catch (err) {
    logger.error("resend", err);
    res.status(500).json({ error: "Unable to resend verification email. Please try again." });
  }
}

async function deleteAccount(req, res) {
  if (req.method !== "DELETE") return res.status(405).end();

  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!requireCsrf(req, res)) return;

  try {
    const db = await getDb();
    const uid = user.userId;

    await Promise.all([
      db.collection("users").deleteOne({ _id: new ObjectId(uid) }),
      db.collection("uploaded_files").deleteMany({ userId: uid }),
      db.collection("custom_categories").deleteMany({ userId: uid }),
      db.collection("merchant_category_rules").deleteMany({ userId: uid }),
      db.collection("pending_signups").deleteOne({ email: user.email }),
      db.collection("sessions").deleteMany({ userId: uid }),
    ]);

    clearAuthCookies(res);
    res.json({ ok: true });
  } catch (err) {
    logger.error("delete-account", err);
    res.status(500).json({ error: "Unable to delete account. Please try again." });
  }
}

async function forgotPassword(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const ip    = getClientIp(req);
  const limit = checkRateLimit(`forgot-password:${ip}`, 60 * 60_000, 5);
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    return res.status(429).json({ error: "Too many requests. Please wait before trying again." });
  }

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email is required." });

  if (!isEmailVerificationEnabled())
    return res.status(503).json({ error: "Password reset is not available at the moment." });

  try {
    const db   = await getDb();
    const user = await db.collection("users").findOne({ email: email.toLowerCase() });

    if (user) {
      const token  = generateVerificationToken();
      const otp    = generateOtp();
      const expiry = new Date(Date.now() + 60 * 60_000);

      await db.collection("users").updateOne({ _id: user._id }, {
        $set: { passwordResetToken: token, passwordResetOtp: otp, passwordResetExpiry: expiry },
      });

      try {
        await sendPasswordResetEmail(user.email, token, otp);
      } catch (err) {
        logger.error("forgot-password", err.message, { context: "Email error" });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error("forgot-password", err);
    res.status(500).json({ error: "Unable to process request. Please try again." });
  }
}

async function resetPassword(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const ip    = getClientIp(req);
  const limit = checkRateLimit(`reset-password:${ip}`, 15 * 60_000, 5);
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    return res.status(429).json({ error: "Too many attempts. Please wait before trying again." });
  }

  const { token, otp, newPassword } = req.body || {};
  if (!token || !otp || !newPassword)
    return res.status(400).json({ error: "All fields are required." });
  if (!isValidPassword(newPassword))
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  if (!isValidOtpFormat(otp))
    return res.status(400).json({ error: "Code must be 6 digits." });

  try {
    const db   = await getDb();
    const user = await db.collection("users").findOne({ passwordResetToken: token });

    if (!user)
      return res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });

    if (isOtpExpired(user.passwordResetExpiry))
      return res.status(400).json({ error: "This reset link has expired. Please request a new one.", expired: true });

    if (user.passwordResetOtp !== otp)
      return res.status(400).json({ error: "Incorrect code. Please check your email and try again." });

    const passwordHash = await hashPassword(newPassword);
    await db.collection("users").updateOne({ _id: user._id }, {
      $set:   { passwordHash, failedLogins: 0, lockedUntil: null },
      $unset: { passwordResetToken: "", passwordResetOtp: "", passwordResetExpiry: "" },
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error("reset-password", err);
    res.status(500).json({ error: "Unable to reset password. Please try again." });
  }
}

/**
 * POST /api/auth/refresh
 *
 * Reads the refresh token from its HttpOnly cookie, rotates it, and issues
 * a new access token. Rotation is atomic (see rotateSession) — presenting
 * an already-rotated (reused) token, a revoked token, or racing two
 * concurrent refresh calls with the same token all fail the same way:
 * the old cookie is cleared and the caller must log in again.
 */
async function refresh(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const ip    = getClientIp(req);
  const limit = checkRateLimit(`refresh:${ip}`, 15 * 60_000, 30);
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    return res.status(429).json({ error: "Too many refresh attempts. Please wait before trying again." });
  }

  if (!requireCsrf(req, res)) return;

  const rawToken = getCookie(req, REFRESH_COOKIE);
  if (!rawToken) return res.status(401).json({ error: "Not authenticated." });

  try {
    const db      = await getDb();
    const session = await findActiveSessionByToken(db, rawToken);
    if (!session) {
      clearAuthCookies(res);
      return res.status(401).json({ error: "Session expired or invalid. Please sign in again." });
    }

    const newRefreshToken = generateRefreshToken();
    const rotated = await rotateSession(db, session, newRefreshToken);
    if (!rotated) {
      // Lost the compare-and-swap race, or the token was already rotated
      // elsewhere (reuse) — either way, treat as compromised and reject.
      clearAuthCookies(res);
      return res.status(401).json({ error: "Session expired or invalid. Please sign in again." });
    }

    const user = await db.collection("users").findOne({ _id: new ObjectId(rotated.userId) });
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({ error: "Account no longer exists." });
    }

    const accessToken = generateAccessToken({ userId: user._id.toString(), email: user.email, name: user.name });
    setAuthCookies(res, { accessToken, refreshToken: newRefreshToken });
    res.json({ ok: true });
  } catch (err) {
    logger.error("refresh", err);
    res.status(500).json({ error: "Unable to refresh session. Please sign in again." });
  }
}

/** POST /api/auth/logout — revoke the current device's session. */
async function logout(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!requireCsrf(req, res)) return;

  const rawToken = getCookie(req, REFRESH_COOKIE);
  try {
    if (rawToken) {
      const db = await getDb();
      await revokeSessionByToken(db, rawToken);
    }
  } catch (err) {
    logger.error("logout", err);
    // Fall through and clear cookies regardless — the client should end up
    // logged out even if the session-revocation write failed.
  }
  clearAuthCookies(res);
  res.json({ ok: true });
}

/** POST /api/auth/logout-all — revoke every active session for this user. */
async function logoutAll(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!requireCsrf(req, res)) return;

  try {
    const db = await getDb();
    await revokeAllSessionsForUser(db, user.userId);
  } catch (err) {
    logger.error("logout-all", err);
  }
  clearAuthCookies(res);
  res.json({ ok: true });
}

// ── router ────────────────────────────────────────────────────────────────────

export default withErrorHandling(async function handler(req, res) {
  const path = req.url.split("?")[0];

  if (req.method === "POST"   && path === "/api/auth/signup")               return signup(req, res);
  if (req.method === "POST"   && path === "/api/auth/login")                return login(req, res);
  if (req.method === "POST"   && path === "/api/auth/verify-otp")           return verifyOtp(req, res);
  if (req.method === "POST"   && path === "/api/auth/resend-otp")           return resendOtp(req, res);
  if (req.method === "POST"   && path === "/api/auth/refresh")              return refresh(req, res);
  if (req.method === "POST"   && path === "/api/auth/logout")               return logout(req, res);
  if (req.method === "POST"   && path === "/api/auth/logout-all")           return logoutAll(req, res);
  if (req.method === "GET"    && path === "/api/auth/profile")              return profile(req, res);
  if (req.method === "GET"    && path === "/api/auth/verify")               return verifyLink(req, res);
  if (req.method === "POST"   && path === "/api/auth/resend-verification")  return resendVerification(req, res);
  if (req.method === "DELETE" && path === "/api/auth/delete-account")       return deleteAccount(req, res);
  if (req.method === "POST"   && path === "/api/auth/forgot-password")       return forgotPassword(req, res);
  if (req.method === "POST"   && path === "/api/auth/reset-password")        return resetPassword(req, res);

  res.status(404).json({ error: "Not found" });
});
