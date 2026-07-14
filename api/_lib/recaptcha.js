/**
 * Google reCAPTCHA v3 server-side verification.
 *
 * Set RECAPTCHA_SECRET_KEY in environment variables.
 * If the key is absent the check is skipped — safe for local development.
 * Min score threshold is configurable via RECAPTCHA_MIN_SCORE (default 0.5).
 */

const MIN_SCORE = parseFloat(process.env.RECAPTCHA_MIN_SCORE ?? "0.5");

/**
 * Verify a reCAPTCHA v3 token from the client.
 * @param {string|null|undefined} token
 * @returns {Promise<{ok: boolean, score?: number, error?: string, skipped?: boolean}>}
 */
export async function verifyRecaptcha(token) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;

  // Not configured — skip gracefully (dev mode)
  if (!secret) return { ok: true, skipped: true };

  if (!token) {
    return { ok: false, error: "Security check token missing. Please refresh and try again." };
  }

  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
    });

    const data = await response.json();

    if (!data.success) {
      return { ok: false, error: "Verification failed. Please refresh and try again." };
    }
    if (data.score < MIN_SCORE) {
      return {
        ok: false,
        score: data.score,
        error: "Your request was flagged as suspicious. Please refresh the page and try again.",
      };
    }

    return { ok: true, score: data.score };
  } catch {
    // reCAPTCHA unreachable — don't block legitimate users
    return { ok: true, skipped: true };
  }
}
