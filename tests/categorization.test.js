import { describe, it, expect } from "vitest";
import { cleanDesc, categorize } from "../src/App.jsx";

// Found while building Phase 8.8 (Categories, src/features/categories/):
// cleanDesc's "remove long codes" step stripped *any* bare 9+ character
// token, including plain one-word merchant names, not just the
// alphanumeric reference/transaction codes it was meant for — so
// categorize() had no text left to match a category's keyword list
// against and silently fell through to "Other". Reproduced directly
// (`cleanDesc("STARBUCKS")` returned "") before concluding it was a real
// bug, not inferred from a failing e2e assertion alone. The identical bug
// and identical fix exist in api/_lib/transaction-cleaner.js's
// cleanTransaction (see tests/transaction-cleaner.test.js).
describe("cleanDesc — long-code stripping doesn't eat plain merchant names", () => {
  it("keeps a bare 9+ letter merchant name intact", () => {
    expect(cleanDesc("STARBUCKS")).toBe("starbucks");
    expect(cleanDesc("WALGREENS")).toBe("walgreens");
  });

  it("still strips a genuine long alphanumeric reference code", () => {
    expect(cleanDesc("PAYMENT ABC123DEF456GH")).not.toContain("abc123def456gh");
  });
});

describe("categorize — real-world merchant descriptions land in their expected category", () => {
  it("categorizes a bare STARBUCKS description as Dining, not Other", () => {
    // The exact failure this bug caused: before the fix, this returned
    // "Other" because cleanDesc("STARBUCKS") had already wiped the
    // description to "", leaving nothing for keyword/fuzzy matching.
    expect(categorize("STARBUCKS", {}, new Map())).toBe("Dining");
  });

  it("categorizes WHOLE FOODS MARKET as Groceries", () => {
    expect(categorize("WHOLE FOODS MARKET", {}, new Map())).toBe("Groceries");
  });

  it("still falls through to Other for a genuinely unrecognized merchant", () => {
    expect(categorize("ZZQX UNMATCHED MERCHANT 42", {}, new Map())).toBe("Other");
  });
});
