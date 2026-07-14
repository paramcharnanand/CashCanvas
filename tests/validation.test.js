import { describe, it, expect } from "vitest";
import {
  isValidEmail,
  isValidPassword,
  isValidOtpFormat,
  isValidTransactionDate,
  isValidTransactionAmount,
  isValidTransactionDesc,
  validateTransaction,
  validateTransactionsArray,
  isValidFileName,
  isValidStatementType,
  isValidCategoryName,
  isValidMerchantName,
  sanitizeCsvField,
  MAX_TRANSACTIONS_PER_UPLOAD,
} from "../api/lib/validation.js";

describe("isValidTransactionDate", () => {
  it("accepts a real calendar date in YYYY-MM-DD", () => {
    expect(isValidTransactionDate("2025-01-15")).toBe(true);
  });
  it("rejects a non-existent calendar date", () => {
    expect(isValidTransactionDate("2025-02-30")).toBe(false);
  });
  it("rejects wrong format", () => {
    expect(isValidTransactionDate("01/15/2025")).toBe(false);
  });
  it("rejects non-string input", () => {
    expect(isValidTransactionDate(20250115)).toBe(false);
  });
});

describe("isValidTransactionAmount", () => {
  it("accepts a normal negative amount", () => {
    expect(isValidTransactionAmount(-87.32)).toBe(true);
  });
  it("accepts a normal positive amount", () => {
    expect(isValidTransactionAmount(3200)).toBe(true);
  });
  it("rejects NaN", () => {
    expect(isValidTransactionAmount(NaN)).toBe(false);
  });
  it("rejects Infinity", () => {
    expect(isValidTransactionAmount(Infinity)).toBe(false);
  });
  it("rejects amounts beyond a sane bound", () => {
    expect(isValidTransactionAmount(1e12)).toBe(false);
  });
  it("rejects non-number types", () => {
    expect(isValidTransactionAmount("87.32")).toBe(false);
  });
});

describe("isValidTransactionDesc", () => {
  it("accepts a normal description", () => {
    expect(isValidTransactionDesc("WHOLE FOODS MARKET")).toBe(true);
  });
  it("rejects an empty description", () => {
    expect(isValidTransactionDesc("")).toBe(false);
  });
  it("rejects a description over the max length", () => {
    expect(isValidTransactionDesc("x".repeat(501))).toBe(false);
  });
  it("accepts a description at the max length", () => {
    expect(isValidTransactionDesc("x".repeat(500))).toBe(true);
  });
});

describe("sanitizeCsvField — formula injection defense", () => {
  it("neutralizes a leading equals sign", () => {
    expect(sanitizeCsvField("=cmd|'/c calc'!A1")).toBe("'=cmd|'/c calc'!A1");
  });
  it("neutralizes a leading plus sign", () => {
    expect(sanitizeCsvField("+1+1")).toBe("'+1+1");
  });
  it("neutralizes a leading minus sign", () => {
    expect(sanitizeCsvField("-1+1")).toBe("'-1+1");
  });
  it("neutralizes a leading @ sign", () => {
    expect(sanitizeCsvField("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
  });
  it("neutralizes a leading tab", () => {
    expect(sanitizeCsvField("\t=1+1")).toBe("'\t=1+1");
  });
  it("leaves an ordinary merchant description untouched", () => {
    expect(sanitizeCsvField("WHOLE FOODS MARKET")).toBe("WHOLE FOODS MARKET");
  });
  it("passes through non-string values unchanged", () => {
    expect(sanitizeCsvField(42)).toBe(42);
  });
});

describe("validateTransaction", () => {
  it("accepts a well-formed transaction", () => {
    const result = validateTransaction({ date: "2025-01-15", desc: "WHOLE FOODS", amount: -87.32 });
    expect(result.valid).toBe(true);
  });
  it("rejects a transaction with a bad date", () => {
    const result = validateTransaction({ date: "not-a-date", desc: "WHOLE FOODS", amount: -87.32 });
    expect(result.valid).toBe(false);
  });
  it("rejects a transaction with a missing desc", () => {
    const result = validateTransaction({ date: "2025-01-15", amount: -87.32 });
    expect(result.valid).toBe(false);
  });
  it("rejects a transaction with a non-finite amount", () => {
    const result = validateTransaction({ date: "2025-01-15", desc: "X", amount: Infinity });
    expect(result.valid).toBe(false);
  });
  it("sanitizes a formula-injection payload in desc instead of rejecting it", () => {
    const result = validateTransaction({ date: "2025-01-15", desc: "=cmd|calc", amount: -1 });
    expect(result.valid).toBe(true);
    expect(result.sanitized.desc).toBe("'=cmd|calc");
  });
});

describe("validateTransactionsArray", () => {
  it("accepts a small valid array", () => {
    const result = validateTransactionsArray([{ date: "2025-01-15", desc: "A", amount: -1 }]);
    expect(result.valid).toBe(true);
    expect(result.sanitized).toHaveLength(1);
  });
  it("rejects a non-array", () => {
    const result = validateTransactionsArray("not-an-array");
    expect(result.valid).toBe(false);
  });
  it("rejects an array over the max size", () => {
    const huge = Array.from({ length: MAX_TRANSACTIONS_PER_UPLOAD + 1 }, () => ({
      date: "2025-01-15", desc: "A", amount: -1,
    }));
    const result = validateTransactionsArray(huge);
    expect(result.valid).toBe(false);
  });
  it("rejects the whole array if any single transaction is malformed", () => {
    const result = validateTransactionsArray([
      { date: "2025-01-15", desc: "A", amount: -1 },
      { date: "garbage", desc: "B", amount: -2 },
    ]);
    expect(result.valid).toBe(false);
  });
});

describe("isValidFileName", () => {
  it("accepts a normal filename", () => {
    expect(isValidFileName("chase_statement_jan.csv")).toBe(true);
  });
  it("rejects an empty filename", () => {
    expect(isValidFileName("")).toBe(false);
  });
  it("rejects a filename over the max length", () => {
    expect(isValidFileName("x".repeat(256))).toBe(false);
  });
});

describe("isValidStatementType", () => {
  it("accepts known statement types", () => {
    expect(isValidStatementType("bank")).toBe(true);
    expect(isValidStatementType("credit_card")).toBe(true);
    expect(isValidStatementType("unknown")).toBe(true);
  });
  it("rejects an arbitrary string", () => {
    expect(isValidStatementType("<script>")).toBe(false);
  });
});

describe("isValidCategoryName / isValidMerchantName", () => {
  it("accepts a normal category name", () => {
    expect(isValidCategoryName("Groceries")).toBe(true);
  });
  it("rejects an empty category name", () => {
    expect(isValidCategoryName("   ")).toBe(false);
  });
  it("rejects an over-length merchant name", () => {
    expect(isValidMerchantName("x".repeat(256))).toBe(false);
  });
});

describe("existing auth validators still work (regression)", () => {
  it("isValidEmail", () => expect(isValidEmail("a@b.com")).toBe(true));
  it("isValidPassword", () => expect(isValidPassword("password123")).toBe(true));
  it("isValidOtpFormat", () => expect(isValidOtpFormat("123456")).toBe(true));
});
