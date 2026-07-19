/**
 * Server-side transaction cleaning — thin re-export over the shared
 * normalization module (src/utils/merchantNormalization.js), which is also
 * what the client-side categorizer (src/utils/categorization.js) uses.
 *
 * Previously this file had its own, independently-maintained copy of the
 * cleaning/matching logic — it had already drifted from the client's copy
 * once (the same "9+ letter merchant name gets wiped to nothing" bug had
 * to be found and fixed here separately, see git history). One shared
 * module, imported by both sides, closes that class of bug by construction.
 */
import {
  segmentWords,
  cleanDesc,
  preprocessForAI,
  extractMerchant,
  diceCoefficient,
  matchMerchant,
} from "../../src/utils/merchantNormalization.js";

export { segmentWords, preprocessForAI, extractMerchant, diceCoefficient };

/** @deprecated alias for `cleanDesc` — kept for existing call sites. */
export const cleanTransaction = cleanDesc;

/** @deprecated alias for `matchMerchant` — kept for existing call sites. */
export const fuzzyMatchMerchant = matchMerchant;
