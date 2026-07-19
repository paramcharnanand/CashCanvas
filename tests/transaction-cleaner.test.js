import { describe, it, expect } from "vitest";
import { preprocessForAI, cleanTransaction } from "../api/_lib/transaction-cleaner.js";

describe("preprocessForAI — abbreviation expansion", () => {
  it("expands a bare AMZN abbreviation to Amazon", () => {
    expect(preprocessForAI("AMZN DIGITAL SVC")).toContain("AMAZON");
  });

  it("expands the multi-word AMZN MKTP abbreviation to Amazon Marketplace", () => {
    expect(preprocessForAI("AMZN MKTP US*2A3B4")).toContain("AMAZON MARKETPLACE");
  });
});

// Found while building Phase 8.8 (Categories): cleanTransaction's "remove
// long codes" step stripped *any* bare 9+ character token, including plain
// one-word merchant names, not just alphanumeric reference/transaction
// codes — its actual intent. Usually masked here by the `|| desc...`
// fallback when the whole string empties out, but not when a long merchant
// word is wiped while other words in the same description survive (a
// silent, partial mis-clean rather than a visible failure). The identical
// bug and identical fix (require a digit in the stripped token) were found
// in src/utils/categorization.js's cleanDesc, the frontend's own copy of this logic.
describe("cleanTransaction — long-code stripping doesn't eat plain merchant names", () => {
  it("keeps a bare 9+ letter merchant name intact", () => {
    expect(cleanTransaction("STARBUCKS")).toBe("starbucks");
    expect(cleanTransaction("WALGREENS")).toBe("walgreens");
  });

  it("still strips a genuine long alphanumeric reference code", () => {
    expect(cleanTransaction("STARBUCKS ABC123DEF456GH")).toBe("starbucks");
  });

  it("keeps a long merchant word even when other words in the same description survive", () => {
    // Regression case for the *partial*-wipe failure mode specifically —
    // "coffee"/"downtown" alone surviving would mask the bug in some cases,
    // so assert the merchant word itself, not just that something remains.
    expect(cleanTransaction("STARBUCKS DOWNTOWN LOCATION")).toContain("starbucks");
  });
});

// A duplicate `AMZN` key previously existed in the ABBREVIATIONS dictionary
// (api/_lib/transaction-cleaner.js) — harmless here since both mapped to the
// same value, but exactly the class of bug that stays silent at runtime.
// The regression guard for *this* class of bug is ESLint's `no-dupe-keys`
// rule (enabled, blocking in CI — see .github/workflows/ci.yml), not a
// bespoke test: a hand-rolled duplicate-key detector here would just be a
// second, weaker implementation of what the linter already does correctly.
