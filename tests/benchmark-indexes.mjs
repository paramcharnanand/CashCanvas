/**
 * One-off benchmark: seeds synthetic data into an isolated in-memory MongoDB
 * instance (never the real Atlas cluster) and runs explain("executionStats")
 * on the app's real query shapes before and after the indexes in
 * api/lib/db.js exist, to get real COLLSCAN-vs-IXSCAN numbers rather than
 * hand-wavy estimates.
 *
 * Not part of the Vitest suite (this is a diagnostic report generator, not a
 * pass/fail test). Run with: node tests/benchmark-indexes.mjs
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";

const USER_COUNT = 200_000;
const FILE_USER_COUNT = 5_000;
const FILES_PER_USER = 10;
const RULE_USER_COUNT = 10_000;
const RULES_PER_USER = 10;

function fmt(stats) {
  return {
    stage: stats.executionStages.stage,
    docsExamined: stats.totalDocsExamined,
    keysExamined: stats.totalKeysExamined,
    nReturned: stats.nReturned,
    millis: stats.executionTimeMillis,
  };
}

async function main() {
  const mongod = await MongoMemoryServer.create();
  const client = new MongoClient(mongod.getUri());
  await client.connect();
  const db = client.db("benchmark");

  console.log(`Seeding ${USER_COUNT.toLocaleString()} users...`);
  {
    const batch = [];
    for (let i = 0; i < USER_COUNT; i++) {
      batch.push({
        name: `User ${i}`,
        email: `user${i}@example.com`,
        passwordHash: "x",
        failedLogins: 0,
        createdAt: new Date(),
      });
      if (batch.length === 5000) {
        await db.collection("users").insertMany(batch, { ordered: false });
        batch.length = 0;
      }
    }
    if (batch.length) await db.collection("users").insertMany(batch, { ordered: false });
  }

  const targetEmail = `user${USER_COUNT - 1}@example.com`; // worst case: last document

  console.log("\n=== users.findOne({ email }) — BEFORE index ===");
  const before = await db.collection("users")
    .find({ email: targetEmail })
    .explain("executionStats");
  console.log(fmt(before.executionStats));

  await db.collection("users").createIndex({ email: 1 }, { unique: true });

  console.log("\n=== users.findOne({ email }) — AFTER unique index ===");
  const after = await db.collection("users")
    .find({ email: targetEmail })
    .explain("executionStats");
  console.log(fmt(after.executionStats));

  // ── uploaded_files ──────────────────────────────────────────────────────
  console.log(`\nSeeding ${(FILE_USER_COUNT * FILES_PER_USER).toLocaleString()} uploaded_files docs...`);
  {
    const batch = [];
    for (let u = 0; u < FILE_USER_COUNT; u++) {
      for (let f = 0; f < FILES_PER_USER; f++) {
        batch.push({
          userId: `user-${u}`,
          fileName: `statement-${f}.csv`,
          uploadedAt: new Date(Date.now() - f * 86_400_000),
          transactionCount: 42,
        });
      }
      if (batch.length >= 5000) {
        await db.collection("uploaded_files").insertMany(batch, { ordered: false });
        batch.length = 0;
      }
    }
    if (batch.length) await db.collection("uploaded_files").insertMany(batch, { ordered: false });
  }

  const targetUser = "user-2500";

  console.log("\n=== uploaded_files.find({userId}).sort({uploadedAt:-1}).limit(20) — BEFORE compound index ===");
  const filesBefore = await db.collection("uploaded_files")
    .find({ userId: targetUser })
    .sort({ uploadedAt: -1 })
    .limit(20)
    .explain("executionStats");
  console.log(fmt(filesBefore.executionStats));

  await db.collection("uploaded_files").createIndex({ userId: 1, uploadedAt: -1 });

  console.log("\n=== uploaded_files.find({userId}).sort({uploadedAt:-1}).limit(20) — AFTER compound index ===");
  const filesAfter = await db.collection("uploaded_files")
    .find({ userId: targetUser })
    .sort({ uploadedAt: -1 })
    .limit(20)
    .explain("executionStats");
  console.log(fmt(filesAfter.executionStats));

  // ── merchant_category_rules ─────────────────────────────────────────────
  console.log(`\nSeeding ${(RULE_USER_COUNT * RULES_PER_USER).toLocaleString()} merchant_category_rules docs...`);
  {
    const batch = [];
    for (let u = 0; u < RULE_USER_COUNT; u++) {
      for (let r = 0; r < RULES_PER_USER; r++) {
        batch.push({ userId: `user-${u}`, merchantName: `merchant ${r}`, category: "Dining", createdAt: new Date() });
      }
      if (batch.length >= 5000) {
        await db.collection("merchant_category_rules").insertMany(batch, { ordered: false });
        batch.length = 0;
      }
    }
    if (batch.length) await db.collection("merchant_category_rules").insertMany(batch, { ordered: false });
  }

  const targetRuleUser = "user-9000";

  console.log("\n=== merchant_category_rules.find({userId}) — BEFORE unique compound index ===");
  const rulesBefore = await db.collection("merchant_category_rules")
    .find({ userId: targetRuleUser })
    .explain("executionStats");
  console.log(fmt(rulesBefore.executionStats));

  await db.collection("merchant_category_rules").createIndex({ userId: 1, merchantName: 1 }, { unique: true });

  console.log("\n=== merchant_category_rules.find({userId}) — AFTER unique compound index ===");
  const rulesAfter = await db.collection("merchant_category_rules")
    .find({ userId: targetRuleUser })
    .explain("executionStats");
  console.log(fmt(rulesAfter.executionStats));

  await client.close();
  await mongod.stop();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
