import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/** Hash a plaintext password for storage. */
export function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** Compare a plaintext password against a stored bcrypt hash. */
export function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}
