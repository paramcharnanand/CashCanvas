import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildTestApp } from "./testApp.js";
import { getDb } from "../api/lib/db.js";
import { _resetForTests as resetRateLimits } from "../api/lib/ratelimit.js";
import { uniqueEmail, signupUser as signupUserWithApp } from "./helpers.js";

let app;

beforeAll(async () => {
  app = buildTestApp();
  await getDb();
});

beforeEach(() => {
  resetRateLimits();
});

const signupUser = (email, password) => signupUserWithApp(app, email, password);
const validTxns = [{ date: "2025-01-15", desc: "WHOLE FOODS MARKET", amount: -87.32 }];

describe("rate limiting — POST /api/files", () => {
  it("allows uploads under the limit and rejects once it's exceeded", async () => {
    const { agent, csrf } = await signupUser(uniqueEmail());

    // Send a few extra past the 20/15min limit (rather than exactly one) so
    // a single incidental non-counting response (e.g. a transient 401)
    // under CI/parallel-test load can't make this test flaky.
    const responses = [];
    for (let i = 0; i < 25; i++) {
      responses.push(
        await agent
          .post("/api/files")
          .set("X-CSRF-Token", csrf)
          .send({ fileName: `statement-${i}.csv`, transactions: validTxns })
      );
    }
    const limited = responses.filter(r => r.status === 429);
    expect(limited.length).toBeGreaterThan(0);
    expect(limited[0].headers["retry-after"]).toBeDefined();
  });
});

describe("rate limiting — POST /api/categorize", () => {
  it("rejects requests once the per-user limit is exceeded", async () => {
    const { agent, csrf } = await signupUser(uniqueEmail());

    // Same margin-past-the-limit approach as the /api/files test above.
    const responses = [];
    for (let i = 0; i < 160; i++) {
      responses.push(
        await agent
          .post("/api/categorize")
          .set("X-CSRF-Token", csrf)
          .send({ transactions: [{ desc: `MERCHANT ${i}`, amount: -1 }] })
      );
    }
    expect(responses.some(r => r.status === 429)).toBe(true);
  });
});

describe("input validation — POST /api/files", () => {
  it("rejects a transaction with an invalid date", async () => {
    const { agent, csrf } = await signupUser(uniqueEmail());
    const res = await agent
      .post("/api/files")
      .set("X-CSRF-Token", csrf)
      .send({ fileName: "bad.csv", transactions: [{ date: "not-a-date", desc: "X", amount: -1 }] });
    expect(res.status).toBe(400);
  });

  it("rejects a transaction with a non-finite amount", async () => {
    const { agent, csrf } = await signupUser(uniqueEmail());
    const res = await agent
      .post("/api/files")
      .set("X-CSRF-Token", csrf)
      .send({ fileName: "bad.csv", transactions: [{ date: "2025-01-15", desc: "X", amount: "not-a-number" }] });
    expect(res.status).toBe(400);
  });

  it("rejects an oversized fileName", async () => {
    const { agent, csrf } = await signupUser(uniqueEmail());
    const res = await agent
      .post("/api/files")
      .set("X-CSRF-Token", csrf)
      .send({ fileName: "x".repeat(300), transactions: validTxns });
    expect(res.status).toBe(400);
  });

  it("rejects an unrecognized statementType", async () => {
    const { agent, csrf } = await signupUser(uniqueEmail());
    const res = await agent
      .post("/api/files")
      .set("X-CSRF-Token", csrf)
      .send({ fileName: "ok.csv", statementType: "<script>alert(1)</script>", transactions: validTxns });
    expect(res.status).toBe(400);
  });

  it("rejects an upload exceeding the max transaction count", async () => {
    const { agent, csrf } = await signupUser(uniqueEmail());
    const huge = Array.from({ length: 10001 }, (_, i) => ({
      date: "2025-01-15", desc: `T${i}`, amount: -1,
    }));
    const res = await agent
      .post("/api/files")
      .set("X-CSRF-Token", csrf)
      .send({ fileName: "huge.csv", transactions: huge });
    expect(res.status).toBe(400);
  });
});

describe("CSV/formula injection sanitization", () => {
  it("neutralizes a formula-injection payload in a transaction description before storing", async () => {
    const { agent, csrf } = await signupUser(uniqueEmail());
    const upload = await agent
      .post("/api/files")
      .set("X-CSRF-Token", csrf)
      .send({ fileName: "evil.csv", transactions: [{ date: "2025-01-15", desc: "=cmd|'/c calc'!A1", amount: -1 }] });
    expect(upload.status).toBe(201);

    const stored = await agent.get(`/api/files/${upload.body._id}`);
    expect(stored.body.transactions[0].desc.startsWith("'=")).toBe(true);
  });
});

describe("duplicate upload detection", () => {
  it("rejects re-uploading the exact same statement twice", async () => {
    const { agent, csrf } = await signupUser(uniqueEmail());
    const payload = { fileName: "dup.csv", transactions: validTxns };

    const first = await agent.post("/api/files").set("X-CSRF-Token", csrf).send(payload);
    expect(first.status).toBe(201);

    const second = await agent.post("/api/files").set("X-CSRF-Token", csrf).send(payload);
    expect(second.status).toBe(409);
  });
});

describe("upload hardening — POST /api/parse-pdf", () => {
  it("rejects a base64 payload that isn't actually a PDF (renamed/mismatched file)", async () => {
    const { agent, csrf } = await signupUser(uniqueEmail());
    const fakePdf = Buffer.from("this is actually a csv,not,a,pdf").toString("base64");
    const res = await agent
      .post("/api/parse-pdf")
      .set("X-CSRF-Token", csrf)
      .send({ pdfBase64: fakePdf, statementType: "bank" });
    expect(res.status).toBe(400);
  });
});

describe("unauthorized access — api/data.js", () => {
  it("rejects GET /api/files with no session", async () => {
    const request = (await import("supertest")).default;
    const res = await request(app).get("/api/files");
    expect(res.status).toBe(401);
  });

  it("rejects POST /api/files with no CSRF header even when authenticated", async () => {
    const { agent } = await signupUser(uniqueEmail());
    const res = await agent.post("/api/files").send({ fileName: "x.csv", transactions: validTxns });
    expect(res.status).toBe(403);
  });
});
