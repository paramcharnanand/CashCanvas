import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI environment variable is not set");

let client;
let clientPromise;

if (process.env.NODE_ENV !== "production") {
  // In dev, reuse connection across hot reloads
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

/**
 * Index definitions for every collection this app actually uses. See
 * docs/backend/database.md for the query each index supports and why.
 * createIndex() is a no-op if the index already exists, so this is safe to
 * run on every getDb() call — cheap, and keeps a fresh Atlas cluster or a
 * fresh mongodb-memory-server test instance self-provisioning.
 */
function ensureIndexes(db) {
  // ── pending_signups — every doc here is inherently temporary; TTL is safe. ──
  db.collection("pending_signups")
    .createIndex({ otpExpiry: 1 }, { expireAfterSeconds: 0 })
    .catch(() => {});

  // ── sessions ──────────────────────────────────────────────────────────────
  db.collection("sessions").createIndex({ refreshTokenHash: 1 }, { unique: true }).catch(() => {});
  db.collection("sessions").createIndex({ userId: 1 }).catch(() => {});
  db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});

  // ── users ─────────────────────────────────────────────────────────────────
  // email: the hottest query in the app (every login/signup/OTP/reset touches
  // it) had zero index until now — was a full collection scan on every call.
  db.collection("users").createIndex({ email: 1 }, { unique: true }).catch(() => {});
  // verificationToken / passwordResetToken: sparse because only a small
  // fraction of users have either field set at any time (most users have
  // neither). NOT a TTL index — these fields sit on a document that also
  // holds permanent account data (name, passwordHash); a TTL index deletes
  // the whole document once the field's Date has passed, which would delete
  // real accounts the moment their reset link expired. See database.md.
  db.collection("users")
    .createIndex({ verificationToken: 1 }, { unique: true, sparse: true })
    .catch(() => {});
  db.collection("users")
    .createIndex({ passwordResetToken: 1 }, { unique: true, sparse: true })
    .catch(() => {});

  // ── uploaded_files ────────────────────────────────────────────────────────
  // Matches the file-history query exactly: find({userId}).sort({uploadedAt:-1}).
  // The compound index covers both the filter and the sort — no in-memory sort.
  db.collection("uploaded_files").createIndex({ userId: 1, uploadedAt: -1 }).catch(() => {});
  // Unique per (userId, contentHash) — backs the duplicate-upload check in
  // api/data.js (SHA-256 of the sanitized transaction set). Catches the
  // insert-race the app-level pre-check can't, same pattern as
  // custom_categories below.
  db.collection("uploaded_files").createIndex({ userId: 1, contentHash: 1 }, { unique: true, sparse: true }).catch(() => {});

  // ── custom_categories ─────────────────────────────────────────────────────
  // Unique per user, case-insensitive (matches the app's "no duplicate
  // category name regardless of case" rule) — replaces an app-level regex
  // duplicate-check race with a real DB constraint. The collation must be
  // passed on the query too (see api/data.js) for MongoDB to use it for a
  // case-insensitive match rather than just a case-sensitive one.
  db.collection("custom_categories")
    .createIndex(
      { userId: 1, categoryName: 1 },
      { unique: true, collation: { locale: "en", strength: 2 } }
    )
    .catch(() => {});
  // Supports find({userId}).sort({createdAt:1}).
  db.collection("custom_categories").createIndex({ userId: 1, createdAt: 1 }).catch(() => {});

  // ── merchant_category_rules ───────────────────────────────────────────────
  // Unique per (userId, merchantName) — matches the upsert's implicit
  // invariant (one learned rule per merchant per user) and supports the
  // find({userId}) list query via its prefix.
  db.collection("merchant_category_rules")
    .createIndex({ userId: 1, merchantName: 1 }, { unique: true })
    .catch(() => {});
}

export async function getDb() {
  const c  = await clientPromise;
  const db = c.db("cashcanvas");
  ensureIndexes(db);
  return db;
}
