// Shared merchant-name normalization and fuzzy matching — the single
// source of truth for both the client-side categorizer
// (src/utils/categorization.js) and the server-side AI-categorization
// pipeline (api/_lib/transaction-cleaner.js). Previously these were two
// independently-maintained copies of the same logic that had already
// drifted once (the same "9+ letter merchant name gets wiped to nothing"
// bug had to be found and fixed twice, separately). One module, imported
// by both sides, closes that class of bug by construction.

// ─── ABBREVIATIONS (multi-word, matched as a phrase) ───────────────────────
const ABBREVIATIONS = {
  "AMZN MKTP": "Amazon Marketplace", "AMZN MKTPLACE": "Amazon Marketplace",
  "AMAZON MKTP": "Amazon Marketplace", "AMAZON MKTPLACE": "Amazon Marketplace",
  WFM: "Whole Foods", WHOLEFDS: "Whole Foods", WHOLEFOOD: "Whole Foods",
  "COSTCO WHSE": "Costco Wholesale", TJ: "Trader Joes",
  SBUX: "Starbucks", MCDNLDS: "McDonalds", "CHICK-FIL": "Chick-fil-A",
  DDD: "DoorDash", DOORDASH: "DoorDash", GRUBHUB: "Grubhub",
  "TST*": "Toast POS", "SQ *": "Square POS", "SQ*": "Square POS",
  LYFT: "Lyft", "UBER TRIP": "Uber", "UBER EATS": "Uber Eats",
  VZWRLSS: "Verizon Wireless", VZW: "Verizon",
  TGT: "Target", WMT: "Walmart Supercenter", "WAL-MART": "Walmart",
  AMZN: "Amazon", APL: "Apple", "APPLE.COM": "Apple", "APL*": "Apple",
  BESTBUY: "Best Buy",
  NETFLIX: "Netflix", SPOTIFY: "Spotify", HULU: "Hulu",
  "DISNEY PLUS": "Disney+", DISNEYPLUS: "Disney+",
  HBOMAX: "HBO Max", "HBO MAX": "HBO Max",
  ADOBE: "Adobe", MSFT: "Microsoft",
  COMCAST: "Comcast", XFINITY: "Xfinity",
  ATT: "AT&T", "AT&T": "AT&T", TMOBILE: "T-Mobile", "T-MOBILE": "T-Mobile",
  CHEVRON: "Chevron", EXXON: "Exxon", "BP GAS": "BP",
  SPEEDWAY: "Speedway", WAWA: "Wawa",
  "PP*": "PayPal", PAYPAL: "PayPal", VENMO: "Venmo", ZELLE: "Zelle",
  CASHAPP: "Cash App", "CASH APP": "Cash App",
  CVS: "CVS Pharmacy", WALGREEN: "Walgreens", "RITE AID": "Rite Aid",
};

// Single-token abbreviations/misspellings that stand in for one brand word.
// Applied per-word during cleaning, before compound-word merging — closes a
// real gap found while consolidating the old client/server normalizers:
// "MCD" (a common statement abbreviation for McDonald's) had no expansion
// anywhere, so "MCD USA" never normalized to the same string as "McDonalds".
const WORD_ALIASES = new Map([
  ["mcd", "mcdonalds"], ["mcds", "mcdonalds"],
  ["sbux", "starbucks"],
  ["wmt", "walmart"], ["wm", "walmart"],
  ["amzn", "amazon"],
  ["tgt", "target"],
  ["cvs", "cvspharmacy"],
  ["whse", "wholesale"], ["whs", "wholesale"],
]);

// Multi-word merchant names that must collapse to one canonical token
// regardless of how the source text happened to split/punctuate them
// (concatenation-matched, not substring-matched — see mergeKnownCompounds).
const KNOWN_COMPOUNDS = new Map([
  ["mcdonalds", "mcdonalds"], ["mcdonald", "mcdonalds"],
  ["wholefoods", "whole foods"], ["wholefood", "whole foods"],
  ["doordash", "doordash"], ["ubereats", "uber eats"],
  ["grubhub", "grubhub"], ["postmates", "postmates"],
  ["walmart", "walmart"], ["costco", "costco wholesale"],
  ["target", "target"], ["amazon", "amazon"],
  ["netflix", "netflix"], ["spotify", "spotify"],
  ["instacart", "instacart"], ["chipotle", "chipotle"],
  ["chickfila", "chick-fil-a"], ["gopuff", "gopuff"],
  ["seamless", "seamless"], ["safeway", "safeway"],
  ["albertsons", "albertsons"], ["walgreens", "walgreens"],
  ["autozone", "autozone"], ["gamestop", "gamestop"],
  ["bestbuy", "best buy"], ["homedepot", "home depot"],
  ["petsmart", "petsmart"], ["panera", "panera"],
  ["applebees", "applebees"], ["orangetheory", "orangetheory"],
  ["peloton", "peloton"], ["turbotax", "turbotax"],
  ["geico", "geico"], ["allstate", "allstate"],
  ["statefarme", "state farm"], ["lyft", "lyft"],
  ["cvspharmacy", "cvs pharmacy"], ["starbucks", "starbucks"],
]);

// ─── NOISE TOKENS ───────────────────────────────────────────────────────────
// "mc" is deliberately excluded: it's the standalone-token form of the
// "Mc" brand prefix (McDonald's) once "McDonald's" gets camelCase-split
// or apostrophe-stripped — filtering it here would delete it before
// mergeKnownCompounds ever gets a chance to re-merge it with "donalds".
const NOISE_TOKENS = new Set([
  "pos", "dbt", "purchase", "auth", "ref", "transfer", "payment",
  "card", "online", "checkcard", "ach", "debit", "credit", "visa",
  "pending", "memo", "trn", "apd", "ext", "preauth", "recurring",
  "orig", "co", "transaction", "chk", "dep", "svc", "fee",
  "autopay", "authorized", "bill", "electronic", "wire",
  "mastercard", "disc", "discover", "amex", "usa", "us",
]);

const STOP_WORDS = new Set([
  "the", "and", "for", "from", "with", "inc", "llc", "corp", "ltd", "co",
  "of", "at", "in", "on", "to", "by", "a", "an",
]);

/**
 * Segment merged/camelCase words, e.g. "STARBUCKSSTORE128" → "Starbucks Store".
 * A brand name can end up fragmented across two tokens by this heuristic
 * (e.g. "McDonald's" → "Mc Donald's", the "c"→"D" boundary misfiring) —
 * mergeKnownCompounds (applied later, on the fully-cleaned word list) is
 * what repairs that, not this step.
 */
export function segmentWords(text) {
  if (!text) return "";
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

/**
 * Merge adjacent word tokens that concatenate into a known compound brand
 * name, regardless of how upstream steps happened to split or punctuate
 * them. Operates on already-cleaned, punctuation-free, lowercase tokens —
 * concatenation-matching here (rather than a regex replace against the
 * original, still-punctuated string) is what makes this robust to inputs
 * like "mc" + "donalds" (from "McDonald's" after apostrophe stripping) or
 * "mc" + "donald" + "s" (a stray extra split).
 */
function mergeKnownCompounds(words) {
  // Resolve single-token aliases first ("wmt" → "walmart", "whse" →
  // "wholesale") so compound-span matching below sees canonical words,
  // not bank abbreviations.
  const aliased = words.map((w) => WORD_ALIASES.get(w) || w);
  const out = [];
  let i = 0;
  while (i < aliased.length) {
    let merged = false;
    for (const span of [3, 2]) {
      if (i + span <= aliased.length) {
        const candidate = aliased.slice(i, i + span).join("");
        if (KNOWN_COMPOUNDS.has(candidate)) {
          out.push(KNOWN_COMPOUNDS.get(candidate));
          i += span;
          merged = true;
          break;
        }
      }
    }
    if (!merged) {
      out.push(aliased[i]);
      i++;
    }
  }
  return out;
}

/**
 * Full transaction-description cleaning pipeline. Real-world merchant name
 * variants (store numbers, punctuation, camelCase-merged words, common
 * bank abbreviations, trailing city/state) collapse to the same normalized
 * string so a single learned merchant rule generalizes across all of them.
 */
export function cleanDesc(desc) {
  if (!desc) return "";
  let text = segmentWords(desc.trim());
  text = text.toLowerCase();

  // Apostrophes/smart quotes: "mcdonald's" → "mcdonalds", no stray space.
  text = text.replace(/['’]/g, "");

  // Bank boilerplate phrases.
  text = text.replace(
    /\b(card\s+purchase|pos\s+(debit|credit|purchase)|ach\s+(debit|credit|payment|transfer)|online\s+(payment|transfer|banking)|bill\s+pay(ment)?|direct\s+dep(osit)?|wire\s+transfer|check\s+(paid|deposit|crd)|mobile\s+(payment|deposit)|contactless\s+purchase|recurring\s+(charge|payment)|autopay|preauthorized|authorized\s+on|payment\s+to|purchase\s+at|external\s+(deposit|withdrawal)|pending|memo|ref\s*#?|tran\s*#?|checkcard|visa\s+debit|visa\s+credit|ext\s+credit|ext\s+debit)\b/g,
    " "
  );

  // POS-system prefixes (SQ *, TST*, DSH*).
  text = text.replace(/\b(sq|tst|dsh)\s*\*/gi, "");

  // Dates.
  text = text.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, " ");

  // Store numbers ("#1234", "Store 456") — must run before the blanket
  // asterisk/hash strip below, or the bare "#" gets turned into a space
  // first and this pattern never matches, leaving the digits behind.
  text = text.replace(/#\s*\d+/g, " ");
  text = text.replace(/\bstore\s+\d+/g, " ");

  // Remaining asterisks/hashes.
  text = text.replace(/[*#]/g, " ");

  // Long numeric sequences (transaction IDs, auth codes).
  text = text.replace(/\b\d{4,}\b/g, " ");

  // US state abbreviations (standalone 2-letter codes).
  text = text.replace(
    /\b(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)\b/g,
    " "
  );

  // Alphanumeric reference codes — requires at least one digit (a real
  // reference/transaction code), not just any 9+ character token: without
  // that requirement this used to wipe plain merchant names 9+ letters
  // long (e.g. "starbucks", "walgreens") down to nothing.
  text = text.replace(/\b(?=[a-z0-9]*\d)[a-z0-9]{9,}\b/g, " ");

  // Noise-token removal, then known-compound merge (brand-name repair —
  // must run after all the punctuation/digit stripping above so it sees
  // clean, single-purpose word tokens). If removing noise tokens would
  // leave nothing at all, keep the pre-filter words instead of falling
  // through to the raw, uncleaned description below — a description that's
  // ONLY noise words plus a reference code (e.g. "PAYMENT ABC123DEF456GH")
  // should end up as "payment" (the closest thing to real content), not
  // silently un-strip the reference code it just removed.
  const allWords = text.split(/\s+/).filter((w) => w.length > 0);
  const withoutNoise = allWords.filter((w) => !NOISE_TOKENS.has(w));
  const words = mergeKnownCompounds(withoutNoise.length > 0 ? withoutNoise : allWords);
  text = words.join(" ").trim();

  return text || desc.toLowerCase().trim();
}

/** Extract the core merchant name — first 1-2 meaningful words after cleaning. */
export function extractMerchant(cleaned) {
  const words = cleaned.split(" ").filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  return words.slice(0, 2).join(" ");
}

/**
 * Extract just the single leading brand token — deliberately shorter than
 * `extractMerchant` (which keeps up to two words). This is what lets a
 * learned rule for a bare brand name ("starbucks") match every trailing-word
 * variant ("Starbucks Reserve", "Starbucks Seattle") via an exact-string
 * comparison in `matchMerchant`, instead of depending on a fuzzy-similarity
 * threshold to bridge the gap.
 */
export function extractMerchantToken(cleaned) {
  const words = cleaned.split(" ").filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  return words[0] || "";
}

function getBigrams(str) {
  const s = str.toLowerCase().trim();
  const bigrams = new Set();
  for (let i = 0; i < s.length - 1; i++) bigrams.add(s.substring(i, i + 2));
  return bigrams;
}

/** Dice coefficient similarity between two strings. Returns 0.0–1.0. */
export function diceCoefficient(a, b) {
  if (!a || !b) return 0;
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 1.0;
  if (al.length < 2 || bl.length < 2) return 0;

  const bigramsA = getBigrams(al);
  const bigramsB = getBigrams(bl);
  let intersection = 0;
  for (const bg of bigramsA) if (bigramsB.has(bg)) intersection++;
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/**
 * Match a cleaned transaction description against a user's learned
 * merchant → category rules. Tiered, most-confident first:
 *   1. exact match on the full cleaned description
 *   2. exact match on the 2-word extracted merchant
 *   3. exact match on the single leading brand token (handles trailing
 *      location/descriptor words without relying on fuzzy similarity)
 *   4. prefix match
 *   5. fuzzy match (Dice coefficient ≥ threshold)
 * Returns `{ match, category, score }` or `null`.
 */
export function matchMerchant(cleanedDesc, merchantRulesMap, threshold = 0.65) {
  if (!merchantRulesMap || merchantRulesMap.size === 0) return null;

  const merchant2 = extractMerchant(cleanedDesc);
  const merchant1 = extractMerchantToken(cleanedDesc);
  if (!merchant1) return null;

  if (merchantRulesMap.has(cleanedDesc)) {
    return { match: cleanedDesc, category: merchantRulesMap.get(cleanedDesc), score: 1.0 };
  }
  if (merchant2 && merchantRulesMap.has(merchant2)) {
    return { match: merchant2, category: merchantRulesMap.get(merchant2), score: 1.0 };
  }
  if (merchant1.length >= 3 && merchantRulesMap.has(merchant1)) {
    return { match: merchant1, category: merchantRulesMap.get(merchant1), score: 0.97 };
  }

  let bestMatch = null;
  let bestScore = 0;
  for (const [knownMerchant, category] of merchantRulesMap) {
    if (
      (cleanedDesc.startsWith(knownMerchant) || knownMerchant.startsWith(merchant2)) &&
      knownMerchant.length >= 3
    ) {
      const score = 0.9;
      if (score > bestScore) { bestScore = score; bestMatch = { match: knownMerchant, category, score }; }
      continue;
    }
    const score = Math.max(
      diceCoefficient(cleanedDesc, knownMerchant),
      diceCoefficient(merchant2, knownMerchant),
      diceCoefficient(merchant1, knownMerchant)
    );
    if (score > bestScore) { bestScore = score; bestMatch = { match: knownMerchant, category, score }; }
  }

  return bestScore >= threshold ? bestMatch : null;
}

/**
 * Preprocess a transaction description for sending to Gemini/AI — more
 * aggressive cleaning + phrase-level abbreviation expansion than `cleanDesc`
 * needs for local matching.
 */
export function preprocessForAI(desc) {
  if (!desc) return "";
  let text = segmentWords(desc.trim());

  text = text.replace(
    /\b(POS|ACH|PURCHASE|PAYMENT|DBT|CARD|ONLINE|AUTH|REF|DEBIT|CREDIT|CHECKCARD|VISA|PENDING|MEMO|TRN|APD|EXT|PREAUTH|RECURRING|ORIG|CO|TRANSACTION|CHK|DEP|SVC|FEE|AUTOPAY|AUTHORIZED|BILL|ELECTRONIC|WIRE|MASTERCARD|MC|DISC|DISCOVER|AMEX)\b/gi,
    " "
  );
  text = text.replace(/[*#]/g, " ");
  text = text.replace(/\b\d{4,}\b/g, " ");
  text = text.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, " ");

  let upper = text.toUpperCase();
  const sorted = Object.entries(ABBREVIATIONS).sort((a, b) => b[0].length - a[0].length);
  for (const [abbr, full] of sorted) {
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    upper = upper.replace(new RegExp(`\\b${escaped}\\b`, "g"), full.toUpperCase());
  }

  return upper.replace(/\s+/g, " ").trim() || desc;
}
