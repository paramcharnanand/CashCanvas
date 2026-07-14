/**
 * Runs before the test file's own imports are evaluated. Spins up an
 * in-memory MongoDB instance (never the real Atlas cluster) and points
 * MONGODB_URI at it before anything imports api/_lib/db.js.
 */
import { afterAll } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";

// api/_lib/db.js caches its MongoClient on global._mongoClientPromise when
// NODE_ENV !== "production" (a dev-hot-reload optimization) — and the real
// Node `global` object is a process-level singleton that outlives any one
// test file's isolated module registry. When Vitest reuses a worker process
// across multiple test files (which it does, depending on pool scheduling),
// a later file's getDb() would silently reuse an EARLIER file's MongoClient,
// pointing at that file's already-stopped mongodb-memory-server instance —
// this was an intermittent, hard-to-reproduce source of cross-test
// corruption (wrong/missing users, stale sessions) that only showed up in
// full-suite runs, never in single-file isolation. Clearing it before every
// file's setup, and closing whatever was cached, guarantees each file's
// getDb() creates a fresh client bound to *that file's* MONGODB_URI.
if (globalThis._mongoClientPromise) {
  await globalThis._mongoClientPromise.then(c => c.close()).catch(() => {});
  delete globalThis._mongoClientPromise;
}

const mongod = await MongoMemoryServer.create();

process.env.MONGODB_URI = mongod.getUri();
process.env.JWT_SECRET  = "test-secret-do-not-use-outside-tests";
process.env.NODE_ENV    = "test"; // not "production" — cookies aren't Secure-only in tests

// Force the OTP/email/reCAPTCHA paths off so tests exercise the direct
// login/signup → session flow (OTP delivery is covered separately; this
// suite is about cookies, sessions, refresh rotation, and CSRF).
delete process.env.GMAIL_USER;
delete process.env.GMAIL_APP_PASSWORD;
delete process.env.RECAPTCHA_SECRET_KEY;
delete process.env.GEMINI_API_KEY;

globalThis.__MONGOD__ = mongod;

// Stop this file's own in-memory Mongo instance once its tests finish, so a
// later file in the same worker process can't observe it as still "cached"
// and so orphaned mongod processes don't accumulate across a full run.
afterAll(async () => {
  if (globalThis._mongoClientPromise) {
    await globalThis._mongoClientPromise.then(c => c.close()).catch(() => {});
    delete globalThis._mongoClientPromise;
  }
  await mongod.stop();
});
