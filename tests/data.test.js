import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { buildTestApp } from "./testApp.js";
import { getDb } from "../api/lib/db.js";
import { cleanTransaction } from "../api/lib/transaction-cleaner.js";
import { _resetForTests as resetRateLimits } from "../api/lib/ratelimit.js";
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
