const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_RE = /^\d{6}$/;
const MIN_PASSWORD_LENGTH = 8;

export function isValidEmail(email) {
  return typeof email === "string" && EMAIL_RE.test(email);
}

export function isValidPassword(password) {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;
}

export function isValidOtpFormat(otp) {
  return typeof otp === "string" && OTP_RE.test(otp);
}

// ── uploads / transactions ──────────────────────────────────────────────────
//
// Bounds are deliberately generous (this app ingests real bank/credit-card
// statements, which can have long merchant descriptors and large one-off
// transactions like mortgage payments) while still rejecting garbage/hostile
// input. See docs/security/threat-model.md for the CSV-injection rationale
// behind sanitizeCsvField.

export const MAX_TRANSACTIONS_PER_UPLOAD = 10_000; // matches the pre-existing limit in api/data.js
export const MAX_DESC_LENGTH = 500;
export const MAX_FILENAME_LENGTH = 255;
export const MAX_CATEGORY_NAME_LENGTH = 100;
export const MAX_MERCHANT_NAME_LENGTH = 255;
export const MAX_TRANSACTION_AMOUNT = 1_000_000_000; // $1B — well above any real personal transaction

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const VALID_STATEMENT_TYPES = new Set(["unknown", "bank", "credit_card"]);

/** Leading characters that spreadsheet software (Excel/Sheets) treats as the start of a formula. */
const FORMULA_INJECTION_RE = /^[=+\-@\t\r]/;

export function isValidTransactionDate(date) {
  if (typeof date !== "string" || !DATE_RE.test(date)) return false;
  // Reject calendar dates that don't exist (e.g. 2025-02-30) — Date normalizes
  // these by rolling forward, so round-trip the parts to detect that.
  const [y, m, d] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return (
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d
  );
}

export function isValidTransactionAmount(amount) {
  return (
    typeof amount === "number" &&
    Number.isFinite(amount) &&
    Math.abs(amount) <= MAX_TRANSACTION_AMOUNT
  );
}

export function isValidTransactionDesc(desc) {
  return typeof desc === "string" && desc.length > 0 && desc.length <= MAX_DESC_LENGTH;
}

/**
 * Neutralizes CSV/formula injection: if a field starts with a character a
 * spreadsheet would interpret as the start of a formula (=, +, -, @, tab, CR),
 * prefix it with a single quote. Excel/Sheets treat a leading `'` as "force
 * text" and strip it on display, so legitimate values round-trip unchanged
 * while a payload like `=cmd|'/c calc'!A1` is defused before it's ever
 * persisted — this app exports user-entered/statement-derived strings
 * (desc, category, merchant) straight into CSV (see downloadCsv in App.jsx).
 */
export function sanitizeCsvField(value) {
  if (typeof value !== "string") return value;
  return FORMULA_INJECTION_RE.test(value) ? `'${value}` : value;
}

export function isValidFileName(name) {
  return typeof name === "string" && name.length > 0 && name.length <= MAX_FILENAME_LENGTH;
}

export function isValidStatementType(type) {
  return VALID_STATEMENT_TYPES.has(type);
}

export function isValidCategoryName(name) {
  return typeof name === "string" && name.trim().length > 0 && name.trim().length <= MAX_CATEGORY_NAME_LENGTH;
}

export function isValidMerchantName(name) {
  return typeof name === "string" && name.trim().length > 0 && name.trim().length <= MAX_MERCHANT_NAME_LENGTH;
}

/** A savings goal's target amount — unlike a transaction amount, must be positive (no debits/credits sign). */
export function isValidSavingsAmount(amount) {
  return (
    typeof amount === "number" &&
    Number.isFinite(amount) &&
    amount > 0 &&
    amount <= MAX_TRANSACTION_AMOUNT
  );
}

export function isValidSavingsGoalName(name) {
  return typeof name === "string" && name.trim().length > 0 && name.trim().length <= MAX_CATEGORY_NAME_LENGTH;
}

/**
 * Validates one transaction and, if valid, returns a sanitized copy with
 * formula-injection defenses applied to the description. Amount/date pass
 * through unchanged (they're already type/range-checked, not free text).
 */
export function validateTransaction(t) {
  if (!t || typeof t !== "object") return { valid: false, error: "Transaction must be an object" };
  if (!isValidTransactionDate(t.date)) return { valid: false, error: "Invalid transaction date" };
  if (!isValidTransactionDesc(t.desc)) return { valid: false, error: "Invalid transaction description" };
  if (!isValidTransactionAmount(t.amount)) return { valid: false, error: "Invalid transaction amount" };

  return {
    valid: true,
    sanitized: { date: t.date, desc: sanitizeCsvField(t.desc), amount: t.amount },
  };
}

/** Validates an entire upload's transaction array. Rejects the whole batch on the first bad entry. */
export function validateTransactionsArray(transactions) {
  if (!Array.isArray(transactions)) return { valid: false, error: "transactions must be an array" };
  if (transactions.length === 0) return { valid: false, error: "transactions must not be empty" };
  if (transactions.length > MAX_TRANSACTIONS_PER_UPLOAD) {
    return { valid: false, error: `Statement exceeds maximum of ${MAX_TRANSACTIONS_PER_UPLOAD} transactions.` };
  }

  const sanitized = [];
  for (let i = 0; i < transactions.length; i++) {
    const result = validateTransaction(transactions[i]);
    if (!result.valid) return { valid: false, error: `Transaction ${i}: ${result.error}` };
    sanitized.push(result.sanitized);
  }

  return { valid: true, sanitized };
}
