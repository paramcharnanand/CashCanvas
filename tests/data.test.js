import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { buildTestApp } from "./testApp.js";
import { getDb } from "../api/_lib/db.js";
import { cleanTransaction } from "../api/_lib/transaction-cleaner.js";
import { _resetForTests as resetRateLimits } from "../api/_lib/ratelimit.js";
import { uniqueEmail, signupUser as signupUserWithApp } from "./helpers.js";

let app;

beforeAll(async () => {
  app = buildTestApp();
  await getDb(); // ensures indexes exist before these tests run
});

beforeEach(() => {
  resetRateLimits();
});

const signupUser = (email, password) => signupUserWithApp(app, email, password);

describe("category duplicate handling (unique collation index)", () => {
  it("rejects a duplicate category name regardless of case", async () => {
    const { agent, csrf } = await signupUser(uniqueEmail());

    const first = await agent.post("/api/categories").set("X-CSRF-Token", csrf).send({ categoryName: "Groceries" });
    expect(first.status).toBe(201);

    const dup = await agent.post("/api/categories").set("X-CSRF-Token", csrf).send({ categoryName: "GROCERIES" });
    expect(dup.status).toBe(409);
  });

  it("allows the same category name for two different users", async () => {
    const { agent: agentA, csrf: csrfA } = await signupUser(uniqueEmail());
    const { agent: agentB, csrf: csrfB } = await signupUser(uniqueEmail());

    const resA = await agentA.post("/api/categories").set("X-CSRF-Token", csrfA).send({ categoryName: "Pets" });
    const resB = await agentB.post("/api/categories").set("X-CSRF-Token", csrfB).send({ categoryName: "Pets" });
    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
  });
});

describe("signup duplicate-email race (unique index safety net)", () => {
  it("only one of two concurrent signups with the same email succeeds", async () => {
    const email = uniqueEmail();
    const fire = () =>
      request(app).post("/api/auth/signup").send({ name: "Racer", email, password: "password123" });

    const [a, b] = await Promise.all([fire(), fire()]);
    const statuses = [a.status, b.status].sort();
    // Whichever loses the race gets a clean 409, never an unhandled 500 from
    // the raw duplicate-key error escaping the unique-index safety net.
    expect(statuses).toEqual([201, 409]);
  });
});

describe("/api/categorize — merchant-rule fuzzy match short-circuits Gemini", () => {
  it("resolves a taught merchant without needing GEMINI_API_KEY", async () => {
    const { agent, csrf } = await signupUser(uniqueEmail());
    const desc = "ACME COFFEE SHOP #4471";
    const cleanedMerchant = cleanTransaction(desc);

    const ruleRes = await agent
      .post("/api/merchant-rules")
      .set("X-CSRF-Token", csrf)
      .send({ merchantName: cleanedMerchant, category: "Dining" });
    expect(ruleRes.status).toBe(200);

    const res = await agent
      .post("/api/categorize")
      .set("X-CSRF-Token", csrf)
      .send({ transactions: [{ desc, amount: -12.5 }] });

    expect(res.status).toBe(200);
    expect(res.body.warning).toBeUndefined(); // never reached the "no API key" branch
    expect(res.body.results).toEqual([{ idx: 0, category: "Dining", confidence: 100 }]);
  });

  it("falls back to the GEMINI_API_KEY warning only for transactions with no matching rule", async () => {
    const { agent, csrf } = await signupUser(uniqueEmail());
    const res = await agent
      .post("/api/categorize")
      .set("X-CSRF-Token", csrf)
      .send({ transactions: [{ desc: "SOME UNKNOWN MERCHANT XYZ", amount: -5 }] });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.warning).toBe("GEMINI_API_KEY not configured"); // test env has no key set
  });
});

describe("DELETE /api/merchant-rules/:id (Phase 8.8, Merchant Rules management screen)", () => {
  it("deletes a rule the caller owns, and it no longer appears in the list", async () => {
    const { agent, csrf } = await signupUser(uniqueEmail());
    await agent.post("/api/merchant-rules").set("X-CSRF-Token", csrf)
      .send({ merchantName: "acme coffee", category: "Dining" });

    const before = await agent.get("/api/merchant-rules");
    expect(before.body).toHaveLength(1);
    const id = before.body[0]._id;

    const del = await agent.delete(`/api/merchant-rules/${id}`).set("X-CSRF-Token", csrf);
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ ok: true });

    const after = await agent.get("/api/merchant-rules");
    expect(after.body).toHaveLength(0);
  });

  it("does not delete another user's rule (userId-scoped filter, not just a global ID lookup)", async () => {
    const { agent: owner, csrf: ownerCsrf } = await signupUser(uniqueEmail());
    await owner.post("/api/merchant-rules").set("X-CSRF-Token", ownerCsrf)
      .send({ merchantName: "acme coffee", category: "Dining" });
    const ownerId = (await owner.get("/api/merchant-rules")).body[0]._id;

    const { agent: intruder, csrf: intruderCsrf } = await signupUser(uniqueEmail());
    const del = await intruder.delete(`/api/merchant-rules/${ownerId}`).set("X-CSRF-Token", intruderCsrf);
    // deleteOne on a non-matching filter succeeds with deletedCount: 0, not a 404 —
    // same behavior categoryById's DELETE already has (no existence leak either way).
    expect(del.status).toBe(200);

    const stillThere = await owner.get("/api/merchant-rules");
    expect(stillThere.body).toHaveLength(1);
  });

  it("rejects a malformed ID with 400, not a 500 from an invalid ObjectId cast", async () => {
    const { agent, csrf } = await signupUser(uniqueEmail());
    const res = await agent.delete("/api/merchant-rules/not-a-valid-id").set("X-CSRF-Token", csrf);
    expect(res.status).toBe(400);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await request(app).delete("/api/merchant-rules/507f1f77bcf86cd799439011");
    expect(res.status).toBe(401);
  });

  it("rejects a request with no CSRF token with 403", async () => {
    const { agent } = await signupUser(uniqueEmail());
    const res = await agent.delete("/api/merchant-rules/507f1f77bcf86cd799439011");
    expect(res.status).toBe(403);
  });
});
