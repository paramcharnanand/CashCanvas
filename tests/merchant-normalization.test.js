import { describe, it, expect } from "vitest";
import { cleanDesc, extractMerchant, extractMerchantToken, matchMerchant } from "../src/utils/merchantNormalization.js";

// The categorization system had two independently-maintained copies of this
// normalization logic (src/utils/categorization.js and
// api/_lib/transaction-cleaner.js) that had already drifted once — the same
// bug fixed twice, separately, in a past session. These tests cover the new
// single shared module both sides now import, plus the real merchant-name
// normalization gaps found while consolidating them: brand detection
// silently failing when punctuation/camelCase splitting fragments a name
// across words ("McDonald's" → "Mc Donald's"), and fuzzy matching being too
// fragile for trailing-word variants ("Starbucks Reserve").

describe("cleanDesc — merchant name variants collapse to the same normalized string", () => {
  it("normalizes Starbucks variants (store numbers, punctuation, case)", () => {
    expect(cleanDesc("STARBUCKS #1234")).toBe("starbucks");
    expect(cleanDesc("Starbucks #928")).toBe("starbucks");
    expect(cleanDesc("Starbucks Store 2045")).toBe("starbucks");
    expect(cleanDesc("STARBUCKS")).toBe("starbucks");
  });

  it("normalizes McDonald's variants — apostrophes, camelCase splits, abbreviations, spacing", () => {
    expect(cleanDesc("McDonald's #214")).toBe("mcdonalds");
    expect(cleanDesc("MCD USA")).toBe("mcdonalds");
    expect(cleanDesc("Mc Donalds")).toBe("mcdonalds");
    expect(cleanDesc("McDonald's 0124")).toBe("mcdonalds");
  });

  it("keeps a trailing location/descriptor word after the brand token", () => {
    expect(cleanDesc("McDonalds Drive Thru")).toBe("mcdonalds drive thru");
    expect(cleanDesc("Starbucks Reserve")).toBe("starbucks reserve");
    expect(cleanDesc("Starbucks Seattle")).toBe("starbucks seattle");
  });

  it("normalizes Walmart, Amazon, Costco, Uber abbreviations", () => {
    expect(cleanDesc("WMT SUPERCENTER #4521")).toBe("walmart supercenter");
    expect(cleanDesc("AMZN Mktp US*2Q4RT")).toContain("amazon");
    expect(cleanDesc("COSTCO WHSE #0123")).toBe("costco wholesale");
    expect(cleanDesc("UBER *TRIP HELP.UBER.COM")).toContain("uber");
  });

  it("keeps a bare 9+ letter merchant name intact (regression, ADR history)", () => {
    expect(cleanDesc("STARBUCKS")).toBe("starbucks");
    expect(cleanDesc("WALGREENS")).toBe("walgreens");
  });

  it("still strips a genuine long alphanumeric reference code", () => {
    expect(cleanDesc("PAYMENT ABC123DEF456GH")).not.toContain("abc123def456gh");
  });
});

describe("extractMerchantToken — first significant word, for exact brand-token matching", () => {
  it("extracts the brand token ignoring trailing location/descriptor words", () => {
    expect(extractMerchantToken(cleanDesc("Starbucks Reserve"))).toBe("starbucks");
    expect(extractMerchantToken(cleanDesc("Starbucks Seattle"))).toBe("starbucks");
    expect(extractMerchantToken(cleanDesc("McDonalds Drive Thru"))).toBe("mcdonalds");
  });
});

describe("matchMerchant — learned merchant rules generalize across real-world variants", () => {
  const starbucksRule = new Map([["starbucks", "Dining"]]);
  const mcdonaldsRule = new Map([["mcdonalds", "Dining"]]);

  it("matches every Starbucks variant to the learned rule, not just the exact string", () => {
    for (const desc of ["STARBUCKS #1234", "Starbucks #928", "Starbucks Store 2045", "STARBUCKS", "Starbucks Reserve", "Starbucks Seattle"]) {
      expect(matchMerchant(cleanDesc(desc), starbucksRule)?.category).toBe("Dining");
    }
  });

  it("matches every McDonald's variant to the learned rule, not just the exact string", () => {
    for (const desc of ["McDonald's #214", "McDonalds Drive Thru", "MCD USA", "Mc Donalds", "McDonald's 0124"]) {
      expect(matchMerchant(cleanDesc(desc), mcdonaldsRule)?.category).toBe("Dining");
    }
  });

  it("does not match an unrelated merchant", () => {
    expect(matchMerchant(cleanDesc("NETFLIX.COM"), starbucksRule)).toBeNull();
  });
});

describe("extractMerchant — unchanged two-word extraction (existing consumers depend on this)", () => {
  it("extracts up to two significant words, skipping stop words", () => {
    expect(extractMerchant("the home depot")).toBe("home depot");
  });
});
