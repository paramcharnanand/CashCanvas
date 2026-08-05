import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Reproduces a real production incident: a cold serverless container's
 * first MongoDB connection attempt timed out (MongoServerSelectionError),
 * and getDb() used to cache that rejected promise for the rest of the
 * container's lifetime — every subsequent request would replay the same
 * failure forever instead of just the unlucky first one. mongodb-memory-
 * server (what every other test file uses) always connects successfully,
 * so a real connection failure can only be reproduced by mocking the
 * driver itself.
 */
describe("getDb() connection retry", () => {
  const realMongoUri = process.env.MONGODB_URI;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("mongodb");
    process.env.MONGODB_URI = realMongoUri;
    delete global._mongoClientPromise;
  });

  it("a failed first connection does not permanently wedge later calls", async () => {
    let connectCallCount = 0;
    vi.doMock("mongodb", () => ({
      MongoClient: class {
        connect() {
          connectCallCount += 1;
          if (connectCallCount === 1) {
            return Promise.reject(new Error("Server selection timed out after 30000 ms"));
          }
          return Promise.resolve({
            db: () => ({ collection: () => ({ createIndex: () => Promise.resolve() }) }),
            close: () => Promise.resolve(),
          });
        }
      },
    }));

    process.env.MONGODB_URI = "mongodb://fake-uri-for-this-test";
    const { getDb } = await import("../api/_lib/db.js");

    await expect(getDb()).rejects.toThrow("Server selection timed out");
    // The bug: this second call used to await the same already-rejected
    // promise and fail identically, even though nothing about the
    // underlying connection issue was still true.
    const db = await getDb();
    expect(db).toBeTruthy();
    expect(connectCallCount).toBe(2);
  });
});
