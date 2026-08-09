/**
 * Refresh-token sessions.
 *
 * A session is created on every login and represents one logged-in device.
 * The raw refresh token is never stored — only its SHA-256 hash — so a
 * database leak does not expose usable tokens. Refresh tokens are opaque
 * random values (not JWTs): this lets a session be revoked instantly by
 * flipping a flag in Mongo, with no JWT-blocklist needed.
 */
import crypto from "crypto";
import { IDLE_SESSION_TTL_MS, ABSOLUTE_SESSION_TTL_MS } from "./cookies.js";

/** Generate a cryptographically secure opaque refresh token. */
export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Create a new session (one per login) and return the full session document. */
export async function createSession(db, { userId, refreshToken, userAgent, ip }) {
  const now = new Date();
  const doc = {
    userId,
    refreshTokenHash: hashToken(refreshToken),
    userAgent: userAgent || "unknown",
    ip: ip || "unknown",
    createdAt: now,
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + IDLE_SESSION_TTL_MS),
    revoked: false,
    revokedAt: null,
  };
  const result = await db.collection("sessions").insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

/**
 * Find the active session matching a raw refresh token, or null if it's
 * missing, revoked, idle-expired, or past the absolute lifetime cap.
 *
 * Two independent expiry checks, both required: `expiresAt` is the sliding
 * idle window (resets on every rotation — see rotateSession), while
 * `createdAt` is fixed at login and never moves, so it's what enforces
 * ABSOLUTE_SESSION_TTL_MS as a hard ceiling an actively-refreshed session
 * can't slide past.
 */
export async function findActiveSessionByToken(db, rawToken) {
  const session = await db.collection("sessions").findOne({
    refreshTokenHash: hashToken(rawToken),
    revoked: false,
  });
  if (!session) return null;
  const now = new Date();
  if (now > new Date(session.expiresAt)) return null;
  if (now - new Date(session.createdAt) > ABSOLUTE_SESSION_TTL_MS) return null;
  return session;
}

/**
 * Atomically rotate a session onto a new refresh token.
 *
 * The filter includes the session's *current* hash, so this is a
 * compare-and-swap: if two requests race to refresh the same token
 * concurrently, only the first update matches and returns the rotated
 * document. The second gets `null` back and must be treated as an
 * invalid/reused refresh token — this is what makes reuse-after-rotation
 * (and concurrent refresh races) rejected by construction rather than by
 * an extra locking layer.
 */
export async function rotateSession(db, session, newRefreshToken) {
  const now = new Date();
  return db.collection("sessions").findOneAndUpdate(
    { _id: session._id, refreshTokenHash: session.refreshTokenHash, revoked: false },
    {
      $set: {
        refreshTokenHash: hashToken(newRefreshToken),
        lastUsedAt: now,
        expiresAt: new Date(now.getTime() + IDLE_SESSION_TTL_MS),
      },
    },
    { returnDocument: "after" }
  );
}

/** Revoke a single session by its raw refresh token (logout — current device). */
export async function revokeSessionByToken(db, rawToken) {
  await db.collection("sessions").updateOne(
    { refreshTokenHash: hashToken(rawToken) },
    { $set: { revoked: true, revokedAt: new Date() } }
  );
}

/** Revoke every active session for a user (logout — all devices). */
export async function revokeAllSessionsForUser(db, userId) {
  await db.collection("sessions").updateMany(
    { userId, revoked: false },
    { $set: { revoked: true, revokedAt: new Date() } }
  );
}
