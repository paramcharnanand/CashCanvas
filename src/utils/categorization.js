// Client-side transaction categorization — rule-based keyword matching plus
// user-learned merchant rules (exact/prefix/fuzzy). Extracted from App.jsx
// (Phase 10 final cleanup, docs/frontend/phase-8-component-architecture.md's
// utils/categorization.js) — logic unchanged, moved verbatim.

export const DEFAULT_CATEGORIES = {
  "Housing": [
    "rent", "mortgage", "property tax", "hoa", "landlord", "lease payment", "storage unit",
    "renters insurance", "homeowners", "real estate", "apartment", "sublease", "leasing",
    "extra space", "public storage", "life storage", "u-haul storage", "cubesmart",
  ],
  "Groceries": [
    "whole foods", "wholefds", "wfm", "trader joe", "safeway", "kroger",
    "walmart supercenter", "walmart grocery", "walmart neighborhood",
    "costco", "costco whse", "aldi", "publix", "sprouts", "fresh market", "food 4 less",
    "grocery outlet", "smart & final", "winco", "ralphs", "vons", "h-e-b", "heb",
    "meijer", "harris teeter", "food lion", "stop & shop", "market basket",
    "lucky supermarket", "giant food", "albertsons", "tom thumb", "weis market",
    "price chopper", "grocery", "supermarket", "instacart", "shipt",
    "amazon fresh", "fresh direct", "peapod", "save-a-lot", "lidl", "piggly wiggly",
    "wegmans", "fresh thyme", "earth fare", "natural grocers", "coborn", "jewel osco",
    "king soopers", "fry's food", "smith's food", "pick n save", "festival foods",
    "hy-vee", "brookshire", "bi-lo", "stater bros", "food basics", "hannaford",
    "giant eagle", "winn-dixie",
  ],
  "Dining": [
    "uber eats", "doordash", "grubhub", "postmates", "caviar delivery",
    "seamless", "delivery.com", "gopuff",
    "mcdonald", "burger king", "wendy", "taco bell", "chick-fil-a", "popeye", "kfc",
    "in-n-out", "five guys", "shake shack", "whataburger", "culver", "arby", "carl's jr",
    "jack in the box", "sonic drive", "dairy queen", "steak 'n shake", "hardee",
    "domino", "pizza hut", "papa john", "little caesar", "round table pizza", "papa murphy",
    "subway", "jersey mike", "firehouse sub", "potbelly", "which wich", "jimmy john",
    "chipotle", "qdoba", "moe's", "del taco", "panda express", "pei wei",
    "panera", "jason's deli", "mcalister", "corner bakery",
    "starbucks", "dunkin", "dutch bros", "peet's coffee", "coffee bean", "caribou coffee",
    "smoothie king", "jamba juice", "tropical smoothie", "biggby", "coffee",
    "olive garden", "red lobster", "outback", "chili's", "applebee", "tgi friday",
    "cheesecake factory", "red robin", "buffalo wild wing", "hooters", "texas roadhouse",
    "longhorn steakhouse", "ruth's chris", "ihop", "denny", "cracker barrel", "waffle house",
    "golden corral", "perkins", "bob evans",
    "sushi", "ramen", "poke bowl", "dim sum", "taqueria", "pizzeria",
    "cafe", "diner", "restaurant", "bistro", "eatery", "steakhouse", "boba", "bakery", "deli",
    "wingstop", "raising cane", "zaxby", "bojangle", "el pollo loco",
    "noodle", "brunch", "grille", "kitchen", "grill", "bar & grill", "gastropub",
    "first watch", "eggs up", "the breakfast", "black bear diner",
    "moe's southwest", "habit burger", "smashburger", "freddys",
    "captain d", "long john silver", "popeyes", "church's chicken",
    "waba grill", "yoshinoya", "flame broiler", "l&l hawaiian",
  ],
  "Transport": [
    "uber", "lyft", "waymo", "via ride", "curb taxi", "yellow cab", "taxi",
    "bart", "muni", "caltrain", "amtrak", "metra", "marc train", "septa", "marta", "wmata",
    "via rail", "nj transit", "path train", "chicago transit", "la metro", "metro transit",
    "zipcar", "turo", "enterprise rent", "hertz", "avis", "budget car", "national car",
    "alamo car", "dollar car", "thrifty car",
    "bird scooter", "lime scooter", "spin scooter", "clipper card", "metro card", "orca card",
    "toll", "e-zpass", "fastrak", "sunpass", "pikepass", "peach pass",
    "parking", "spothero", "parkwhiz", "laz parking", "sp plus", "ace parking",
    "shell", "chevron", "arco", "bp gas", "exxon", "mobil", "sunoco", "speedway",
    "circle k", "quiktrip", "wawa", "casey's", "kwik trip", "racetrac", "pilot flying",
    "buc-ee", "loves travel", "flying j", "petro", "ta travel",
    "fuel", "gas station", "car wash", "gasoline",
    "jiffy lube", "valvoline", "firestone", "pep boys", "autozone", "o'reilly auto",
    "midas", "meineke", "discount tire", "mavis tire", "oil change", "jiffy",
    "advance auto", "napa auto", "take 5 oil",
    "delta air", "united air", "southwest air", "american airlines", "jetblue", "alaska air",
    "spirit air", "frontier air", "allegiant", "hawaiian air", "sun country",
    "greyhound", "megabus", "flixbus", "peter pan bus",
  ],
  "Subscriptions": [
    "netflix", "spotify", "hulu", "disney+", "disney plus", "hbo max", "hbomax",
    "peacock", "paramount+", "paramount plus", "apple tv", "apple tv+",
    "youtube premium", "youtube tv", "amazon prime", "prime video", "prime membership",
    "audible", "kindle unlimited", "crunchyroll", "funimation", "vrv", "shudder", "mubi",
    "twitch", "patreon", "substack", "medium membership", "masterclass",
    "dropbox", "adobe", "creative cloud", "microsoft 365", "office 365",
    "google one", "google storage", "icloud", "apple one", "setapp",
    "linkedin premium", "duolingo", "babbel", "rosetta stone", "busuu",
    "calm", "headspace", "noom", "weight watchers", "ww.com",
    "nytimes", "new york times", "washington post", "wsj", "the atlantic", "economist",
    "peloton", "strava", "myfitnesspal", "beachbody", "openfit",
    "apple.com/bill", "apple music", "itunes", "apl*",
    "gym membership", "annual membership", "monthly subscription", "annual subscription",
    "planet fitness", "la fitness", "equinox", "24 hour fitness", "gold's gym",
    "anytime fitness", "orange theory", "orangetheory", "solidcore",
    "dashlane", "1password", "lastpass", "nordvpn", "expressvpn",
    "canva", "figma", "notion", "airtable", "monday.com", "asana",
    "github", "heroku", "digitalocean", "aws", "google cloud", "azure",
    "zoom", "slack", "docusign",
  ],
  "Utilities": [
    "electric bill", "electricity", "water bill", "internet service", "phone bill",
    "gas bill", "power bill", "utility", "utilities",
    "pg&e", "pge", "sdg&e", "con ed", "coned", "duke energy", "national grid", "xcel energy",
    "dominion energy", "pse&g", "eversource", "ameren", "entergy", "centerpoint energy",
    "southern california gas", "soCalgas", "nicor gas", "peoples gas", "spire energy",
    "comcast", "xfinity", "spectrum", "cox cable", "centurylink", "frontier comm",
    "charter comm", "cox communications", "att internet", "optimum", "altice", "earthlink",
    "verizon", "at&t", "t-mobile", "sprint", "metro pcs", "cricket wireless", "boost mobile",
    "us cellular", "mint mobile", "google fi",
    "sewage", "waste management", "republic services", "clean harbors", "sewer",
    "trash collection", "water service",
  ],
  "Shopping": [
    "amazon.com", "amzn", "amzn mktp", "amazon mktp", "amazon digital",
    "ebay", "etsy", "wayfair", "wish.com", "shein", "asos", "revolve", "temu", "aliexpress",
    "nordstrom", "macy's", "bloomingdale", "neiman marcus", "saks fifth",
    "kohl's", "jcpenney", "belk", "dillard",
    "zara", "h&m", "gap", "old navy", "banana republic", "j.crew", "ann taylor",
    "forever 21", "express clothing", "american eagle", "hollister", "abercrombie",
    "uniqlo", "anthropologie", "urban outfitters", "free people", "mango",
    "nike", "adidas", "under armour", "lululemon", "athleta", "fabletics", "vuori",
    "tj maxx", "marshalls", "ross stores", "burlington coat",
    "ikea", "home depot", "lowe's", "menards", "ace hardware", "true value",
    "best buy", "apple store", "apple retail", "microsoft store",
    "b&h photo", "adorama", "gamestop", "micro center", "newegg",
    "target", "walmart", "dollar tree", "dollar general", "five below", "family dollar",
    "bath & body works", "sephora", "ulta", "mac cosmetics", "fenty beauty",
    "petco", "petsmart", "chewy",
    "bed bath", "crate and barrel", "west elm", "pottery barn", "restoration hardware",
    "rei outdoor", "dick's sporting", "academy sports", "bass pro",
    "overstock", "build-a-bear", "world market", "cost plus",
    "michaels", "joann", "hobby lobby", "craft store",
    "auto parts", "napa", "advance auto",
    "container store", "tuesday morning", "homegoods", "at home store",
  ],
  "Health": [
    "pharmacy", "cvs", "walgreens", "rite aid", "duane reade", "good rx",
    "doctor", "hospital", "dental", "dentist", "orthodont", "oral surgeon",
    "optometry", "vision care", "lenscrafters", "pearle vision", "warby parker",
    "medical", "health insurance", "copay", "urgent care", "emergency room", "er visit",
    "kaiser", "blue cross", "blue shield", "aetna", "cigna", "united health", "humana",
    "lab corp", "quest diagnostic", "blood test", "prescription", "rx",
    "therapy", "counseling", "mental health", "chiropractic", "physical therapy",
    "dermatology", "eye exam", "planned parenthood", "minute clinic",
    "teladoc", "mdlive", "zocdoc",
    "vitamin shoppe", "gnc", "supplement",
    "hims", "ro health", "noom",
  ],
  "Entertainment": [
    "amc theatres", "regal cinema", "cinemark", "alamo drafthouse", "movie", "theater",
    "concert", "live music", "ticketmaster", "stubhub", "eventbrite", "live nation", "seat geek",
    "steam", "playstation", "playstation network", "xbox", "nintendo", "roblox",
    "epic games", "blizzard", "ea games", "valve", "humble bundle",
    "twitch sub", "discord nitro",
    "bowling", "escape room", "arcade", "dave & buster", "museum", "zoo", "aquarium",
    "comedy club", "sports ticket", "golf", "mini golf", "laser tag", "go kart", "topgolf",
    "six flags", "universal studio", "disneyland", "disney world", "sea world",
    "nba", "nfl", "mlb", "nhl", "mls ticket",
    "book of the month", "audible", "kindle",
    "national park", "state park", "trampoline park",
  ],
  "Income": [
    "payroll", "direct dep", "direct deposit", "salary", "wage", "paycheck",
    "zelle from", "venmo from", "cashapp from", "cash app from",
    "tax refund", "irs treas", "state refund", "federal refund",
    "cashback reward", "cash back", "rebate", "reimbursement",
    "interest payment", "dividend", "transfer from",
    "freelance", "consulting", "commission", "bonus deposit",
  ],
  "Other": [],
};

export function cleanDesc(desc) {
  if (!desc) return "";
  // Segment merged/camelCase words before lowercasing (e.g. "AMZNMktpUS" → "AMZN Mktp US")
  let text = desc.trim()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return text.toLowerCase()
    // Bank boilerplate prefixes/suffixes
    .replace(/\b(card\s+purchase|pos\s+(debit|credit|purchase)|ach\s+(debit|credit|payment|transfer)|online\s+(payment|transfer|banking)|bill\s+pay(ment)?|direct\s+dep(osit)?|wire\s+transfer|check\s+(paid|deposit|crd)|mobile\s+(payment|deposit)|contactless\s+purchase|recurring\s+(charge|payment)|autopay|preauthorized|authorized\s+on|payment\s+to|purchase\s+at|pending|memo|ref\s*#?|tran\s*#?|checkcard|visa\s+debit|visa\s+credit|ext\s+credit|ext\s+debit)\b/g, " ")
    // POS-system prefixes
    .replace(/\b(sq|tst|dsh)\s*\*/gi, "")
    // Replace asterisks
    .replace(/\*/g, " ")
    // Remove date patterns
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, " ")
    // Remove #StoreNumber and bare store numbers
    .replace(/#\s*\d+/g, " ")
    .replace(/\bstore\s+\d+/g, " ")
    .replace(/\b\d{4,}\b/g, " ")
    // Remove US state abbreviations (standalone 2-letter codes)
    .replace(/\b(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)\b/g, " ")
    // Remove alphanumeric reference codes
    .replace(/\b[a-z]{0,3}\d{3,}[a-z0-9]*\b/g, " ")
    // Remove long codes — requires at least one digit (a real reference/
    // transaction code), not just any 9+ character token: this same regex
    // without that requirement used to strip plain merchant names that
    // happen to be one word of 9+ letters (e.g. "starbucks", "walgreens")
    // down to nothing, so categorize() had no text left to match against
    // and silently fell through to "Other" — a real bug, found via a direct
    // reproduction (`cleanDesc("STARBUCKS")` returned ""), not inferred.
    .replace(/\b(?=[a-z0-9]*\d)[a-z0-9]{9,}\b/g, " ")
    .replace(/\s+/g, " ").trim();
}

// Dice-coefficient similarity (0–1). Used for fuzzy merchant matching in categorize().
function diceCoefficient(a, b) {
  if (!a || !b) return 0;
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 1.0;
  if (al.length < 2 || bl.length < 2) return 0;
  const bigrams = (s) => {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i++) set.add(s.substring(i, i + 2));
    return set;
  };
  const bigramsA = bigrams(al);
  const bigramsB = bigrams(bl);
  let intersection = 0;
  for (const bg of bigramsA) { if (bigramsB.has(bg)) intersection++; }
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

// Extract the core merchant name — first 1-3 meaningful words after cleaning
function extractMerchant(cleaned) {
  const stopWords = new Set(["the", "and", "for", "from", "with", "inc", "llc", "corp", "ltd", "co"]);
  const words = cleaned.split(" ").filter(w => w.length > 1 && !stopWords.has(w));
  return words.slice(0, 2).join(" ");
}

export function categorize(desc, customCats, merchantRules) {
  const cleaned = cleanDesc(desc);
  const merchant = extractMerchant(cleaned);

  // User-learned rules — exact, prefix, then fuzzy (dice ≥ 0.65)
  if (merchantRules?.size) {
    if (merchantRules.has(cleaned)) return merchantRules.get(cleaned);
    if (merchant && merchantRules.has(merchant)) return merchantRules.get(merchant);
    // Prefix match
    for (const [key, cat] of merchantRules) {
      if (merchant && key.startsWith(merchant)) return cat;
    }
    // Fuzzy match via Dice coefficient
    let bestScore = 0;
    let bestCat = null;
    for (const [key, cat] of merchantRules) {
      const score = Math.max(diceCoefficient(cleaned, key), diceCoefficient(merchant, key));
      if (score > bestScore) { bestScore = score; bestCat = cat; }
    }
    if (bestScore >= 0.65) return bestCat;
  }

  const cats = { ...DEFAULT_CATEGORIES, ...customCats };

  // First pass: match against full cleaned description
  for (const [cat, keywords] of Object.entries(cats)) {
    if (cat === "Other") continue;
    for (const kw of keywords) {
      const k = kw.toLowerCase();
      if (k.includes(" ")) {
        if (cleaned.includes(k)) return cat;
      } else {
        const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`(?:^|[^a-z])${escaped}(?:[^a-z]|$)`).test(cleaned)) return cat;
      }
    }
  }

  // Second pass: match against extracted merchant name only (shorter = less noise)
  if (merchant && merchant !== cleaned) {
    for (const [cat, keywords] of Object.entries(cats)) {
      if (cat === "Other") continue;
      for (const kw of keywords) {
        const k = kw.toLowerCase();
        if (k.includes(" ")) {
          if (merchant.includes(k)) return cat;
        } else {
          const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          if (new RegExp(`(?:^|[^a-z])${escaped}(?:[^a-z]|$)`).test(merchant)) return cat;
        }
      }
    }
  }

  return "Other";
}
