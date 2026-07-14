import { describe, it, expect } from "vitest";
import { preprocessForAI } from "../api/_lib/transaction-cleaner.js";

describe("preprocessForAI — abbreviation expansion", () => {
  it("expands a bare AMZN abbreviation to Amazon", () => {
    expect(preprocessForAI("AMZN DIGITAL SVC")).toContain("AMAZON");
  });

  it("expands the multi-word AMZN MKTP abbreviation to Amazon Marketplace", () => {
    expect(preprocessForAI("AMZN MKTP US*2A3B4")).toContain("AMAZON MARKETPLACE");
  });
});

// A duplicate `AMZN` key previously existed in the ABBREVIATIONS dictionary
// (api/_lib/transaction-cleaner.js) — harmless here since both mapped to the
// same value, but exactly the class of bug that stays silent at runtime.
// The regression guard for *this* class of bug is ESLint's `no-dupe-keys`
// rule (enabled, blocking in CI — see .github/workflows/ci.yml), not a
// bespoke test: a hand-rolled duplicate-key detector here would just be a
// second, weaker implementation of what the linter already does correctly.
