import crypto from "crypto";

export const OTP_TTL_MS = 10 * 60_000;
export const MAX_OTP_ATTEMPTS = 3;

/** Generate a cryptographically secure 6-digit OTP. */
export function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

/** Compute the expiry Date for a freshly generated OTP. */
export function otpExpiry() {
  return new Date(Date.now() + OTP_TTL_MS);
}

/** Whether an OTP expiry Date has already passed. */
export function isOtpExpired(expiry) {
  return new Date() > new Date(expiry);
}
