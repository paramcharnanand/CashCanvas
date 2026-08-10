/**
 * Per-account login-failure escalation policy.
 *
 * Pure, DB-free — every function here takes the relevant fields off a
 * `users` document plus the current time and returns a plain description of
 * what to do next. api/auth.js's login() is the only caller; it owns all
 * Mongo reads/writes, this module owns the state-machine decision.
 *
 * State machine (see docs/superpowers/plans for the full writeup):
 *
 *   wrong x4 (1st cycle)  -> 15-minute cooldown
 *   cooldown expires -> wrong x4 again (2nd cycle) -> password reset required
 *   ignoring the reset requirement and resubmitting the login form
 *     RESET_REQUIRED_REPEAT_LIMIT times -> 1-week freeze
 *   a successful password reset clears every field below, at any tier
 *
 * This sits on top of (not instead of) the existing IP-keyed
 * checkRateLimit("login:<ip>", …) in ratelimit.js — that stays unchanged.
 */

export const MAX_ATTEMPTS_PER_CYCLE = 4;
export const COOLDOWN_MS = 15 * 60_000;
// How many times the user may resubmit the login form while a password
// reset is required before the account is frozen. Each such resubmission is
// an attempt to bypass the reset requirement rather than complete it —
// reaching the reset-required tier itself never freezes the account.
export const RESET_REQUIRED_REPEAT_LIMIT = 5;
export const FREEZE_MS = 7 * 24 * 60 * 60_000;

const WRONG_PASSWORD_MESSAGE = "Incorrect password. Please try again.";
const COOLDOWN_MESSAGE = "Too many incorrect attempts. Please try again in 15 minutes.";
const RESET_REQUIRED_MESSAGE = "For your security, please reset your password before trying again.";
const FROZEN_MESSAGE = "For your security, this account is temporarily frozen. Please reset your password to continue.";

/** The `$set` used on both a successful login and a successful password reset. */
export const CLEAR_LOCKOUT_FIELDS = {
  failedLogins: 0,
  lockedUntil: null,
  lockoutCycles: 0,
  passwordResetRequired: false,
  resetRequiredAttempts: 0,
  freezeUntil: null,
};

/**
 * Evaluate account-level lockout state BEFORE any password comparison.
 * Returns `null` if the attempt may proceed to a password check, or
 * `{ status, body, retryAfterSeconds, fields }` if it must be rejected
 * outright — `fields` is always present (possibly `{}`) and should be
 * written to the user document regardless of whether the request is
 * blocked, since e.g. the reset-required counter still needs to persist.
 */
export function checkLoginGate(user, now = new Date()) {
  if (user.freezeUntil && now < new Date(user.freezeUntil)) {
    return {
      status: 423,
      body: { error: FROZEN_MESSAGE, frozen: true },
      retryAfterSeconds: Math.ceil((new Date(user.freezeUntil) - now) / 1000),
      fields: {},
    };
  }

  if (user.passwordResetRequired) {
    const resetRequiredAttempts = (user.resetRequiredAttempts || 0) + 1;
    if (resetRequiredAttempts >= RESET_REQUIRED_REPEAT_LIMIT) {
      const freezeUntil = new Date(now.getTime() + FREEZE_MS);
      return {
        status: 423,
        body: { error: FROZEN_MESSAGE, frozen: true },
        retryAfterSeconds: Math.ceil(FREEZE_MS / 1000),
        fields: { freezeUntil, resetRequiredAttempts },
      };
    }
    return {
      status: 403,
      body: { error: RESET_REQUIRED_MESSAGE, resetRequired: true },
      fields: { resetRequiredAttempts },
    };
  }

  if (user.lockedUntil && now < new Date(user.lockedUntil)) {
    return {
      status: 429,
      body: { error: COOLDOWN_MESSAGE, cooldownUntil: new Date(user.lockedUntil).toISOString() },
      retryAfterSeconds: Math.ceil((new Date(user.lockedUntil) - now) / 1000),
      fields: {},
    };
  }

  return null;
}

/**
 * Called only when checkLoginGate(user, now) returned null. `user` is the
 * same document passed to checkLoginGate — an expired (but not yet cleared)
 * cooldown is detected here from `user.lockedUntil` directly, starting a
 * fresh MAX_ATTEMPTS_PER_CYCLE window.
 */
export function recordLoginResult(user, now, passwordCorrect) {
  if (passwordCorrect) {
    return { status: 200, body: null, fields: { ...CLEAR_LOCKOUT_FIELDS } };
  }

  const cooldownExpired = Boolean(user.lockedUntil) && now >= new Date(user.lockedUntil);
  const baseFailedLogins = cooldownExpired ? 0 : user.failedLogins || 0;
  const failedLogins = baseFailedLogins + 1;

  if (failedLogins < MAX_ATTEMPTS_PER_CYCLE) {
    return {
      status: 401,
      body: { error: WRONG_PASSWORD_MESSAGE },
      fields: { failedLogins, lockedUntil: null, lastFailedAt: now },
    };
  }

  if ((user.lockoutCycles || 0) === 0) {
    const lockedUntil = new Date(now.getTime() + COOLDOWN_MS);
    return {
      status: 429,
      body: { error: COOLDOWN_MESSAGE, cooldownUntil: lockedUntil.toISOString() },
      retryAfterSeconds: Math.ceil(COOLDOWN_MS / 1000),
      fields: { failedLogins, lockedUntil, lockoutCycles: 1, lastFailedAt: now },
    };
  }

  return {
    status: 403,
    body: { error: RESET_REQUIRED_MESSAGE, resetRequired: true },
    fields: {
      failedLogins,
      lockedUntil: null,
      passwordResetRequired: true,
      resetRequiredAttempts: 0,
      lastFailedAt: now,
    },
  };
}
