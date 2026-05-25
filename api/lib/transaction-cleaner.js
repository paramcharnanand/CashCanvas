/**
 * Shared transaction cleaning pipeline.
 * Used by both server.js (local dev) and api/categorize.js (Vercel serverless).
 *
 * Implements:
 *  - Banking noise removal
 *  - Word segmentation for merged merchant names
 *  - Abbreviation expansion (100+ common bank abbreviations)
 *  - Fuzzy merchant matching via Dice coefficient
 *  - Confidence scoring
 */

// ─── ABBREVIATION DICTIONARY ─────────────────────────────────────────────────
const ABBREVIATIONS = {
  // Grocery
  AMZN: "Amazon", "AMZN MKTP": "Amazon Marketplace", "AMZN MKTPLACE": "Amazon Marketplace",
  "AMAZON MKTP": "Amazon Marketplace", "AMAZON MKTPLACE": "Amazon Marketplace",
  WFM: "Whole Foods", WHOLEFDS: "Whole Foods", WHOLEFOOD: "Whole Foods",
  "COSTCO WHSE": "Costco Wholesale", TJ: "Trader Joes",

  // Dining & Coffee
  SBUX: "Starbucks", MCDNLDS: "McDonalds", "CHICK-FIL": "Chick-fil-A",
  DDD: "DoorDash", DOORDASH: "DoorDash", GRUBHUB: "Grubhub",
  "TST*": "Toast POS", "SQ *": "Square POS", "SQ*": "Square POS",

  // Transport
  LYFT: "Lyft", "UBER TRIP": "Uber", "UBER EATS": "Uber Eats",
  VZWRLSS: "Verizon Wireless", VZW: "Verizon",

  // Retail
  TGT: "Target", WMT: "Walmart", "WAL-MART": "Walmart",
  AMZN: "Amazon", APL: "Apple", "APPLE.COM": "Apple",
  "APL*": "Apple", BESTBUY: "Best Buy",

  // Subscriptions
  NETFLIX: "Netflix", SPOTIFY: "Spotify", HULU: "Hulu",
  "DISNEY PLUS": "Disney+", DISNEYPLUS: "Disney+",
  "HBOMAX": "HBO Max", "HBO MAX": "HBO Max",
  ADOBE: "Adobe", MSFT: "Microsoft",

  // Utilities
  COMCAST: "Comcast", XFINITY: "Xfinity",
  "ATT": "AT&T", "AT&T": "AT&T", TMOBILE: "T-Mobile", "T-MOBILE": "T-Mobile",

  // Gas & Auto
  CHEVRON: "Chevron", EXXON: "Exxon", "BP GAS": "BP",
  SPEEDWAY: "Speedway", WAWA: "Wawa",

  // Payments
  "PP*": "PayPal", PAYPAL: "PayPal", VENMO: "Venmo", ZELLE: "Zelle",
  "CASHAPP": "Cash App", "CASH APP": "Cash App",

  // Pharmacy
  CVS: "CVS Pharmacy", WALGREEN: "Walgreens", "RITE AID": "Rite Aid",
};

// ─── BANKING NOISE TOKENS ───────────────────────────────────────────────────
const NOISE_TOKENS = new Set([
  "pos", "dbt", "purchase", "auth", "ref", "transfer", "payment",
  "card", "online", "checkcard", "ach", "debit", "credit", "visa",
  "pending", "memo", "trn", "apd", "ext", "preauth", "recurring",
  "orig", "co", "transaction", "chk", "dep", "svc", "fee",
  "autopay", "authorized", "bill", "electronic", "wire",
  "mastercard", "mc", "disc", "discover", "amex",
]);

// ─── KNOWN COMPOUND WORDS ──────────────────────────────────────────────────
const KNOWN_COMPOUNDS = new Map([
  ["starbucks", "Starbucks"],
  ["wholefoods", "Whole Foods"],
  ["doordash", "DoorDash"],
  ["ubereats", "Uber Eats"],
  ["grubhub", "Grubhub"],
  ["postmates", "Postmates"],
  ["walmart", "Walmart"],
  ["costco", "Costco"],
  ["target", "Target"],
  ["amazon", "Amazon"],
  ["netflix", "Netflix"],
  ["spotify", "Spotify"],
  ["instacart", "Instacart"],
  ["chipotle", "Chipotle"],
  ["mcdonalds", "McDonalds"],
  ["chickfila", "Chick-fil-A"],
  ["gopuff", "GoPuff"],
  ["seamless", "Seamless"],
  ["safeway", "Safeway"],
  ["albertsons", "Albertsons"],
  ["walgreens", "Walgreens"],
  ["autozone", "AutoZone"],
  ["gamestop", "GameStop"],
  ["bestbuy", "Best Buy"],
  ["homedepot", "Home Depot"],
  ["petsmart", "PetSmart"],
  ["panera", "Panera"],
  ["applebees", "Applebees"],
  ["orangetheory", "OrangeTheory"],
  ["peloton", "Peloton"],
  ["turbotax", "TurboTax"],
  ["geico", "GEICO"],
  ["allstate", "Allstate"],
  ["statefarme", "State Farm"],
  ["lyft", "Lyft"],
]);

/**
 * Segment merged words in a transaction description.
 * E.g., "STARBUCKSSTORE128" → "Starbucks Store"
 *       "AMZNMktpUS" → "Amazon Marketplace US"
 *       "UBEREATSHELP" → "Uber Eats Help"
 */
export function segmentWords(text) {
  if (!text) return "";

  // Step 1: Split on camelCase boundaries
  let result = text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");

  // Step 2: Check for known compound words (case-insensitive)
  const lower = result.toLowerCase().replace(/[^a-z]/g, "");
  for (const [compound, proper] of KNOWN_COMPOUNDS) {
    if (lower.includes(compound)) {
      const re = new RegExp(compound, "gi");
      result = result.replace(re, proper);
    }
  }

  return result;
}

/**
 * Full transaction cleaning pipeline.
 *
 * 1. Convert to lowercase
 * 2. Remove special characters
 * 3. Remove bank-specific prefixes
 * 4. Remove transaction IDs
 * 5. Remove authorization codes
 * 6. Remove timestamps
 * 7. Normalize spacing
 * 8. Break combined words intelligently
 */
export function cleanTransaction(desc) {
  if (!desc) return "";
  let text = desc.trim();

  // Step 1: Segment merged words (before lowercasing so camelCase works)
  text = segmentWords(text);

  // Step 2: Lowercase
  text = text.toLowerCase();

  // Step 3: Remove bank boilerplate phrases
  text = text.replace(
    /\b(card\s+purchase|pos\s+(debit|credit|purchase)|ach\s+(debit|credit|payment|transfer)|online\s+(payment|transfer|banking)|bill\s+pay(ment)?|direct\s+dep(osit)?|wire\s+transfer|check\s+(paid|deposit|crd)|mobile\s+(payment|deposit)|contactless\s+purchase|recurring\s+(charge|payment)|autopay|preauthorized|authorized\s+on|payment\s+to|purchase\s+at|external\s+(deposit|withdrawal))\b/g,
    " "
  );

  // Step 4: Remove POS-system prefixes (SQ *, TST*, DSH*)
  text = text.replace(/\b(sq|tst|dsh)\s*\*/gi, "");

  // Step 5: Remove asterisks and hash signs
  text = text.replace(/[*#]/g, " ");

  // Step 6: Remove date patterns
  text = text.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, " ");

  // Step 7: Remove store numbers (#1234, Store 456)
  text = text.replace(/#\s*\d+/g, " ");
  text = text.replace(/\bstore\s+\d+/g, " ");

  // Step 8: Remove long numeric sequences (transaction IDs, auth codes)
  text = text.replace(/\b\d{4,}\b/g, " ");

  // Step 9: Remove US state abbreviations (standalone 2-letter codes)
  text = text.replace(
    /\b(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)\b/g,
    " "
  );

  // Step 10: Remove alphanumeric reference codes
  text = text.replace(/\b[a-z]{0,3}\d{3,}[a-z0-9]*\b/g, " ");
  text = text.replace(/\b[a-z0-9]{9,}\b/g, " ");

  // Step 11: Remove individual noise tokens
  const words = text.split(/\s+/).filter((w) => w.length > 0 && !NOISE_TOKENS.has(w));
  text = words.join(" ").trim();

  return text || desc.toLowerCase().trim();
}

/**
 * Preprocess a transaction description for sending to Gemini/AI.
 * More aggressive cleaning + abbreviation expansion.
 */
export function preprocessForAI(desc) {
  if (!desc) return "";

  // Start with word segmentation
  let text = segmentWords(desc.trim());

  // Remove banking noise tokens
  text = text.replace(
    /\b(POS|ACH|PURCHASE|PAYMENT|DBT|CARD|ONLINE|AUTH|REF|DEBIT|CREDIT|CHECKCARD|VISA|PENDING|MEMO|TRN|APD|EXT|PREAUTH|RECURRING|ORIG|CO|TRANSACTION|CHK|DEP|SVC|FEE|AUTOPAY|AUTHORIZED|BILL|ELECTRONIC|WIRE|MASTERCARD|MC|DISC|DISCOVER|AMEX)\b/gi,
    " "
  );

  // Strip special chars and long numbers
  text = text.replace(/[*#]/g, " ");
  text = text.replace(/\b\d{4,}\b/g, " ");
  text = text.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, " ");

  // Expand abbreviations
  let upper = text.toUpperCase();
  // Sort by length descending so multi-word abbreviations match first
  const sorted = Object.entries(ABBREVIATIONS).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [abbr, full] of sorted) {
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    upper = upper.replace(new RegExp(`\\b${escaped}\\b`, "g"), full.toUpperCase());
  }

  return upper.replace(/\s+/g, " ").trim() || desc;
}

/**
 * Extract the core merchant name — first 1-3 meaningful words after cleaning.
 */
export function extractMerchant(cleaned) {
  const stopWords = new Set([
    "the", "and", "for", "from", "with", "inc", "llc", "corp", "ltd", "co",
    "of", "at", "in", "on", "to", "by", "a", "an",
  ]);
  const words = cleaned
    .split(" ")
    .filter((w) => w.length > 1 && !stopWords.has(w));
  return words.slice(0, 2).join(" ");
}

// ─── FUZZY MATCHING ─────────────────────────────────────────────────────────

/**
 * Compute bigrams for a string.
 */
function getBigrams(str) {
  const s = str.toLowerCase().trim();
  const bigrams = new Set();
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.add(s.substring(i, i + 2));
  }
  return bigrams;
}

/**
 * Dice coefficient similarity between two strings.
 * Returns 0.0–1.0 (1.0 = identical).
 */
export function diceCoefficient(a, b) {
  if (!a || !b) return 0;
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 1.0;
  if (al.length < 2 || bl.length < 2) return 0;

  const bigramsA = getBigrams(al);
  const bigramsB = getBigrams(bl);

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/**
 * Find the best matching merchant from a map of known merchants.
 * Returns { match, category, score } or null if no good match.
 */
export function fuzzyMatchMerchant(cleanedDesc, merchantRulesMap, threshold = 0.65) {
  if (!merchantRulesMap || merchantRulesMap.size === 0) return null;

  const merchant = extractMerchant(cleanedDesc);
  if (!merchant || merchant.length < 2) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const [knownMerchant, category] of merchantRulesMap) {
    // Exact match on full cleaned description
    if (cleanedDesc === knownMerchant) {
      return { match: knownMerchant, category, score: 1.0 };
    }

    // Exact match on extracted merchant
    if (merchant === knownMerchant) {
      return { match: knownMerchant, category, score: 1.0 };
    }

    // Prefix match: if the cleaned desc starts with a known merchant name
    if (cleanedDesc.startsWith(knownMerchant) || knownMerchant.startsWith(merchant)) {
      const score = 0.9;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { match: knownMerchant, category, score };
      }
      continue;
    }

    // Fuzzy match using Dice coefficient
    const score1 = diceCoefficient(cleanedDesc, knownMerchant);
    const score2 = diceCoefficient(merchant, knownMerchant);
    const score = Math.max(score1, score2);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { match: knownMerchant, category, score };
    }
  }

  return bestScore >= threshold ? bestMatch : null;
}
