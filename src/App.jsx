import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import * as Papa from "papaparse";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";
import _ from "lodash";
import AuthScreen from "./AuthScreen.jsx";

// ─── CATEGORY ENGINE ───
const DEFAULT_CATEGORIES = {
  "Housing": [
    "rent", "mortgage", "property tax", "hoa", "landlord", "lease payment", "storage unit",
    "renters insurance", "homeowners", "real estate", "apartment",
  ],
  "Groceries": [
    "whole foods", "trader joe", "safeway", "kroger", "walmart supercenter", "walmart grocery",
    "costco", "aldi", "publix", "sprouts", "fresh market", "food 4 less", "grocery outlet",
    "smart & final", "winco", "ralphs", "vons", "h-e-b", "heb", "meijer", "harris teeter",
    "food lion", "stop & shop", "market basket", "lucky supermarket", "giant food", "albertsons",
    "tom thumb", "weis market", "price chopper", "grocery", "supermarket", "instacart", "shipt",
    "amazon fresh", "fresh direct", "peapod", "save-a-lot", "lidl", "piggly wiggly",
  ],
  "Dining": [
    "uber eats", "doordash", "grubhub", "postmates", "caviar delivery",
    "mcdonald", "burger king", "wendy", "taco bell", "chick-fil-a", "popeye", "kfc",
    "in-n-out", "five guys", "shake shack", "whataburger", "culver", "arby", "carl's jr",
    "jack in the box", "sonic drive", "dairy queen", "steak 'n shake", "hardee",
    "domino", "pizza hut", "papa john", "little caesar", "round table pizza",
    "subway sandwich", "jersey mike", "firehouse sub", "potbelly", "which wich",
    "chipotle", "qdoba", "moe's", "del taco", "panda express", "pei wei",
    "panera", "jason's deli", "mcalister", "corner bakery",
    "starbucks", "dunkin", "dutch bros", "peet's coffee", "coffee bean", "caribou coffee",
    "smoothie king", "jamba juice", "tropical smoothie",
    "olive garden", "red lobster", "outback", "chili's", "applebee", "tgi friday",
    "cheesecake factory", "red robin", "buffalo wild wing", "hooters", "texas roadhouse",
    "longhorn steakhouse", "ruth's chris", "ihop", "denny", "cracker barrel", "waffle house",
    "golden corral", "perkins", "bob evans",
    "sushi", "ramen", "poke bowl", "dim sum", "taqueria", "pizzeria",
    "cafe", "diner", "restaurant", "bistro", "eatery", "steakhouse", "boba", "bakery", "deli",
    "wingstop", "raising cane", "zaxby", "bojangle", "el pollo loco",
    "noodle", "brunch", "grille", "kitchen",
  ],
  "Transport": [
    "uber", "lyft",
    "bart", "muni", "caltrain", "amtrak", "metra", "marc train", "septa", "marta", "wmata",
    "via rail", "nj transit", "path train", "chicago transit", "la metro",
    "zipcar", "zip car", "turo rental", "enterprise rent", "hertz car", "avis rental", "budget car",
    "bird scooter", "lime scooter", "spin scooter", "clipper card", "metro card",
    "toll", "e-zpass", "fastrak", "sunpass", "pikepass",
    "parking", "spothero", "parkwhiz", "laz parking",
    "shell", "chevron", "arco", "bp gas", "exxon", "mobil", "sunoco", "speedway",
    "circle k", "quiktrip", "wawa", "casey's", "kwik trip", "racetrac", "pilot flying",
    "fuel", "gas station", "car wash",
    "jiffy lube", "valvoline", "firestone", "pep boys", "autozone", "o'reilly auto",
    "midas", "meineke", "discount tire", "mavis tire", "oil change",
    "delta air", "united air", "southwest air", "american airlines", "jetblue", "alaska air",
    "spirit air", "frontier air", "allegiant", "hawaiian air", "sun country",
    "amtrak ticket", "greyhound bus",
  ],
  "Subscriptions": [
    "netflix", "spotify", "hulu", "disney+", "disney plus", "hbo max", "peacock", "paramount+",
    "apple tv", "youtube premium", "amazon prime", "audible", "kindle unlimited", "crunchyroll",
    "funimation", "vrv subscription", "shudder", "mubi",
    "twitch", "patreon", "substack", "medium membership",
    "dropbox", "adobe", "microsoft 365", "office 365", "google one", "icloud",
    "linkedin premium", "duolingo", "babbel", "rosetta stone",
    "calm app", "headspace", "noom", "weight watchers",
    "nytimes", "washington post", "wsj subscription", "the atlantic", "economist",
    "peloton", "strava", "myfitnesspal", "beachbody",
    "apple.com/bill", "apple music", "itunes",
    "gym membership", "annual membership", "monthly subscription", "annual subscription",
    "planet fitness", "la fitness", "equinox", "24 hour fitness", "gold's gym",
  ],
  "Utilities": [
    "electric bill", "electricity", "water bill", "internet service", "phone bill", "gas bill", "power bill",
    "pg&e", "pge", "sdg&e", "con ed", "coned", "duke energy", "national grid", "xcel energy",
    "dominion energy", "pse&g", "eversource", "ameren", "entergy", "centerpoint energy",
    "comcast", "xfinity", "spectrum", "cox cable", "centurylink", "frontier comm",
    "charter comm", "cox communications",
    "verizon bill", "at&t bill", "t-mobile bill",
    "sewage", "waste management", "republic services", "clean harbors", "sewer",
  ],
  "Shopping": [
    "amazon.com", "ebay", "etsy", "wayfair", "wish.com", "shein", "asos", "revolve",
    "nordstrom", "macy's", "bloomingdale", "neiman marcus", "saks fifth",
    "kohl's", "jcpenney", "belk", "dillard",
    "zara", "h&m", "gap", "old navy", "banana republic", "j.crew", "ann taylor",
    "forever 21", "express clothing", "american eagle", "hollister", "abercrombie",
    "uniqlo", "anthropologie", "urban outfitters", "free people",
    "nike", "adidas", "under armour", "lululemon", "athleta", "fabletics",
    "tj maxx", "marshalls", "ross stores", "burlington coat",
    "ikea", "home depot", "lowe's", "menards", "ace hardware", "true value",
    "best buy", "apple store", "microsoft store", "b&h photo", "adorama", "gamestop", "micro center",
    "target", "walmart", "dollar tree", "dollar general", "five below", "family dollar",
    "bath & body works", "sephora", "ulta", "mac cosmetics", "fenty beauty",
    "petco", "petsmart", "chewy",
    "bed bath", "crate and barrel", "west elm", "pottery barn", "restoration hardware",
    "rei outdoor", "dick's sporting", "academy sports", "bass pro",
  ],
  "Health": [
    "pharmacy", "cvs", "walgreens", "rite aid", "duane reade",
    "doctor", "hospital", "dental", "dentist", "orthodont",
    "optometry", "vision care", "lenscrafters", "pearle vision",
    "medical", "health insurance", "copay", "urgent care", "emergency room",
    "kaiser", "blue cross", "blue shield", "aetna", "cigna", "united health", "humana",
    "lab corp", "quest diagnostic", "blood test", "prescription", "rx",
    "therapy", "counseling", "mental health", "chiropractic", "physical therapy",
    "dermatology", "eye exam", "planned parenthood", "minute clinic",
  ],
  "Entertainment": [
    "amc theatres", "regal cinema", "cinemark", "alamo drafthouse", "movie", "theater",
    "concert", "live music", "ticketmaster", "stubhub", "eventbrite", "live nation", "seat geek",
    "steam", "playstation", "xbox", "nintendo", "roblox", "epic games", "blizzard", "ea games",
    "twitch", "discord nitro",
    "bowling", "escape room", "arcade", "dave & buster", "museum", "zoo", "aquarium",
    "comedy club", "sports ticket", "golf", "mini golf", "laser tag", "go kart",
    "six flags", "universal studio", "disneyland", "disney world", "sea world",
    "nba", "nfl", "mlb", "nhl", "mls ticket",
  ],
  "Income": [
    "payroll", "direct dep", "direct deposit", "salary", "wage",
    "zelle from", "venmo from", "cashapp from",
    "tax refund", "irs treas", "state refund",
    "cashback reward", "cash back", "rebate", "reimbursement",
    "interest payment", "dividend", "transfer from",
  ],
  "Other": [],
};

const PALETTE = ["#1a6b4a","#b02d21","#bfc9c0","#6f7a72","#3f4943","#8e130c","#a0b0a8","#005235","#d4a57a","#c8bfb0","#7a6b5a","#4a7a6a"];

function cleanDesc(desc) {
  return (desc || "").toLowerCase()
    .replace(/\b(card\s+purchase|pos\s+(debit|credit|purchase)|ach\s+(debit|credit|payment|transfer)|online\s+(payment|transfer|banking)|bill\s+pay(ment)?|direct\s+dep(osit)?|wire\s+transfer|check\s+(paid|deposit|crd)|mobile\s+(payment|deposit)|contactless\s+purchase|recurring\s+(charge|payment)|autopay|preauthorized|authorized\s+on|payment\s+to|purchase\s+at|pending|memo|ref\s*#?|tran\s*#?)\b/g, " ")
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, " ")
    .replace(/\b[a-z]{0,3}\d{4,}\b/g, " ")
    .replace(/\s+/g, " ").trim();
}

function categorize(desc, customCats, merchantRules) {
  const cleaned = cleanDesc(desc);

  // User-learned rules take highest priority
  if (merchantRules?.size) {
    const rule = merchantRules.get(cleaned);
    if (rule) return rule;
  }

  const cats = { ...DEFAULT_CATEGORIES, ...customCats };
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
  return "Other";
}

function parseAmount(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const s = String(val).replace(/[$,\s]/g, "");
  const neg = s.startsWith("(") && s.endsWith(")");
  const cleaned = s.replace(/[()]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return neg ? -num : num;
}

function parseDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  const formats = [
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/,
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
  ];
  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const m1 = s.match(formats[0]);
  if (m1) {
    const yr = m1[3].length === 2 ? 2000 + parseInt(m1[3]) : parseInt(m1[3]);
    d = new Date(yr, parseInt(m1[1]) - 1, parseInt(m1[2]));
    if (!isNaN(d.getTime())) return d;
  }
  const m2 = s.match(formats[1]);
  if (m2) {
    d = new Date(parseInt(m2[1]), parseInt(m2[2]) - 1, parseInt(m2[3]));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function detectColumns(headers) {
  const h = headers.map(x => (x || "").toLowerCase().trim());
  let dateCol = h.findIndex(x => /date|posted|trans/.test(x));
  let descCol = h.findIndex(x => /desc|narr|memo|detail|merchant|payee|name/.test(x));
  let amtCol = h.findIndex(x => /amount|sum|total|value/.test(x));
  let debitCol = h.findIndex(x => /debit|withdraw|expense/.test(x));
  let creditCol = h.findIndex(x => /credit|deposit/.test(x));
  if (dateCol === -1) dateCol = 0;
  if (descCol === -1) descCol = Math.min(1, headers.length - 1);
  if (amtCol === -1 && debitCol === -1) amtCol = Math.min(2, headers.length - 1);
  return { dateCol, descCol, amtCol, debitCol, creditCol };
}

// ─── STYLES ───
const font = `'Manrope', sans-serif`;
const fontMono = `'Inter', monospace`;
const fontHeadline = `'Newsreader', serif`;

const theme = {
  bg: "#fbf9f6",
  surface: "#ffffff",
  surfaceHover: "#f5f3f0",
  surfaceContainer: "#efeeeb",
  surfaceContainerLow: "#f5f3f0",
  border: "#efeeeb",
  borderVariant: "rgba(191,201,192,0.2)",
  text: "#1b1c1a",
  textMuted: "#3f4943",
  textSubtle: "#6f7a72",
  primary: "#005235",
  primaryContainer: "#1a6b4a",
  accent: "#b02d21",
  accentSoft: "rgba(176,45,33,0.08)",
  green: "#1a6b4a",
  greenSoft: "rgba(26,107,74,0.08)",
  yellow: "#005235",
  yellowSoft: "rgba(0,82,53,0.08)",
};

// ─── COMPONENTS ───

function StatCard({ label, value, sub, color = theme.primary, onClick }) {
  return (
    <div style={{
      background: theme.surface,
      borderRadius: 8, padding: "20px 24px", flex: "1 1 200px", minWidth: 200,
      borderLeft: `3px solid ${color}`,
      boxShadow: "0 1px 3px rgba(27,28,26,0.07)",
      cursor: onClick ? "pointer" : "default", userSelect: "none",
      transition: "box-shadow 0.2s",
    }}
    onClick={onClick}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = "0 3px 8px rgba(27,28,26,0.12)"; }}
    onMouseLeave={e => { if (onClick) e.currentTarget.style.boxShadow = "0 1px 3px rgba(27,28,26,0.07)"; }}
    >
      <div style={{ fontSize: 11, fontFamily: fontMono, color: theme.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 600, color: theme.text, fontFamily: fontMono, fontFeatureSettings: '"tnum"', letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: color, marginTop: 6, display: "flex", alignItems: "center", gap: 4, fontFamily: font, fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 32 }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          padding: "8px 0",
          border: "none",
          borderBottom: active === t ? `2px solid ${theme.primary}` : "2px solid transparent",
          background: "transparent",
          cursor: "pointer",
          fontFamily: font,
          fontSize: 14,
          fontWeight: active === t ? 600 : 400,
          color: active === t ? theme.primary : theme.textSubtle,
          transition: "all 0.2s",
          letterSpacing: "0.01em",
        }}>{t}</button>
      ))}
    </div>
  );
}

function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 24, fontWeight: 400, fontFamily: fontHeadline, color: theme.text, margin: 0, lineHeight: 1.2 }}>{children}</h2>
      {sub && <p style={{ fontSize: 11, fontFamily: fontMono, color: theme.textSubtle, margin: "4px 0 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>{sub}</p>}
    </div>
  );
}

// ─── PDF PARSING ENGINE ───
const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
let pdfjsLoaded = null;

function loadPdfJs() {
  if (pdfjsLoaded) return pdfjsLoaded;
  pdfjsLoaded = new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const script = document.createElement("script");
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = () => {
      const lib = window.pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      resolve(lib);
    };
    script.onerror = () => reject(new Error("Failed to load PDF.js from CDN"));
    document.head.appendChild(script);
  });
  return pdfjsLoaded;
}

async function extractPdfContent(file) {
  const lib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: arrayBuffer }).promise;

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    pages.push({ items: content.items, width: viewport.width, height: viewport.height });
  }
  return pages;
}

// Group text items into lines using adaptive Y-tolerance
function buildLines(items, yTolerance = 3) {
  if (!items || items.length === 0) return [];
  
  // Collect all items with position
  const positioned = items
    .filter(item => item.str && item.str.trim())
    .map(item => ({
      x: item.transform[4],
      y: Math.round(item.transform[5] * 10) / 10, // keep some precision
      text: item.str,
      width: item.width || 0,
      height: item.height || (item.transform[0] || 10),
    }));
  
  if (positioned.length === 0) return [];

  // Cluster by Y using tolerance
  positioned.sort((a, b) => b.y - a.y); // top to bottom
  const clusters = [];
  let currentCluster = [positioned[0]];
  
  for (let i = 1; i < positioned.length; i++) {
    const prev = currentCluster[currentCluster.length - 1];
    if (Math.abs(positioned[i].y - prev.y) <= yTolerance) {
      currentCluster.push(positioned[i]);
    } else {
      clusters.push(currentCluster);
      currentCluster = [positioned[i]];
    }
  }
  clusters.push(currentCluster);

  // Build line strings — join with appropriate spacing
  return clusters.map(cluster => {
    const sorted = cluster.sort((a, b) => a.x - b.x);
    let lineText = "";
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0) {
        const gap = sorted[i].x - (sorted[i - 1].x + sorted[i - 1].width);
        lineText += gap > 8 ? "  " : (gap > 2 ? " " : "");
      }
      lineText += sorted[i].text;
    }
    return lineText.trim();
  }).filter(l => l.length > 0);
}

// Date patterns ranked by specificity
const DATE_PATTERNS = [
  { re: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/, name: "MM/DD/YYYY" },
  { re: /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/, name: "YYYY-MM-DD" },
  { re: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2})(?!\d)/, name: "MM/DD/YY" },
  { re: /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})/i, name: "Mon DD, YYYY" },
  { re: /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})/i, name: "DD Mon YYYY" },
  { re: /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2})/i, name: "Mon DD" },
];

// Short MM/DD pattern (no year) — used separately so we can infer the year
const SHORT_DATE_RE = /^(\d{1,2})[\/\-](\d{1,2})(?![\/\-\d])/;

function inferYearFromLines(lines) {
  const yearCandidates = [];
  for (const line of lines) {
    const m4 = line.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m4) { yearCandidates.push(parseInt(m4[3])); continue; }
    const m2 = line.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})(?!\d)/);
    if (m2) { yearCandidates.push(2000 + parseInt(m2[3])); continue; }
    const mw = line.match(/(20\d{2})/);
    if (mw) yearCandidates.push(parseInt(mw[1]));
  }
  if (yearCandidates.length > 0) {
    const counts = {};
    yearCandidates.forEach(y => { counts[y] = (counts[y] || 0) + 1; });
    return parseInt(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
  }
  return new Date().getFullYear();
}

// Amount patterns — very generous matching
const AMT_PATTERNS = [
  /[-+]?\$[\d,]+\.\d{2}/,                   // $1,234.56 or -$50.00
  /\([\$]?[\d,]+\.\d{2}\)/,                 // (1,234.56) or ($50.00)
  /[-+]\s+[\d,]+\.\d{2}/,                   // - 8.00 or + 8.00 (space after sign)
  /[-+]?[\d,]+\.\d{2}[-+]?/,               // 1234.56 or 1234.56-
  /[-+]?\$[\d,]+(?!\.\d)/,                  // $1,234 (no cents)
];

function findDate(text, inferredYear = null) {
  for (const { re } of DATE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const d = parseDate(m[1]);
      if (d && d.getFullYear() > 1990 && d.getFullYear() < 2040) {
        return { date: d, str: m[0], index: m.index, endIndex: m.index + m[0].length };
      }
    }
  }
  // Try short MM/DD format if we have an inferred year
  if (inferredYear) {
    const m = text.match(SHORT_DATE_RE);
    if (m) {
      const month = parseInt(m[1]) - 1;
      const day = parseInt(m[2]);
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const d = new Date(inferredYear, month, day);
        if (!isNaN(d.getTime())) {
          return { date: d, str: m[0], index: m.index, endIndex: m.index + m[0].length };
        }
      }
    }
  }
  return null;
}

function findAmounts(text) {
  const results = [];
  const seen = new Set();
  for (const pattern of AMT_PATTERNS) {
    const global = new RegExp(pattern.source, "g");
    let m;
    while ((m = global.exec(text)) !== null) {
      const key = `${m.index}-${m[0]}`;
      if (seen.has(key)) continue;
      // Check that this isn't part of a date
      const before = text.substring(Math.max(0, m.index - 5), m.index);
      const after = text.substring(m.index + m[0].length, m.index + m[0].length + 5);
      if (/[\/\-]\s*$/.test(before) && /^\s*[\/\-]/.test(after)) continue; // skip date parts
      
      let val = parseAmount(m[0]);
      if (m[0].endsWith("-") && val > 0) val = -val;
      if (m[0].endsWith("+") && val < 0) val = -val;
      
      seen.add(key);
      results.push({ raw: m[0], value: val, index: m.index, endIndex: m.index + m[0].length });
    }
  }
  // Deduplicate overlapping matches — keep longest
  results.sort((a, b) => a.index - b.index);
  const deduped = [];
  for (const r of results) {
    if (deduped.length > 0) {
      const last = deduped[deduped.length - 1];
      if (r.index < last.endIndex) {
        // Overlap: keep the one with $ or longer
        if (r.raw.includes("$") && !last.raw.includes("$")) {
          deduped[deduped.length - 1] = r;
        } else if (r.raw.length > last.raw.length) {
          deduped[deduped.length - 1] = r;
        }
        continue;
      }
    }
    deduped.push(r);
  }
  return deduped;
}

function isHeaderLine(line) {
  const l = line.toLowerCase().trim();
  const headerWords = ["date", "description", "amount", "balance", "debit", "credit", "withdrawal", "deposit", "reference", "transaction", "posting", "details"];
  const matches = headerWords.filter(w => l.includes(w));
  return matches.length >= 2;
}

function isJunkLine(line) {
  const l = line.toLowerCase().trim();
  if (l.length < 5) return true;
  if (/^(page\s+\d|continued|statement|account\s+(number|summary)|opening|closing|beginning|ending)/i.test(l)) return true;
  if (/^[-=_*·.]{5,}$/.test(l)) return true; // separator lines
  return false;
}

// ─── STATEMENT TYPE DETECTION ───
function detectStatementType(pages) {
  const allText = pages.flatMap(p => p.items.map(i => i.str || "")).join(" ").toLowerCase();

  const ccSignals = [
    "credit card", "credit limit", "minimum payment", "payment due date",
    "statement balance", "new balance", "previous balance",
    "finance charge", "interest charged", "interest charge",
    "cash advance", "apr ", "annual percentage rate",
    "visa", "mastercard", "american express", "amex", "discover card",
    "rewards points", "cash back rewards", "miles earned",
  ];

  const bankSignals = [
    "checking account", "savings account",
    "beginning balance", "ending balance", "available balance",
    "direct deposit", "overdraft", "routing number",
    "wire transfer", "ach deposit", "service charge",
  ];

  let ccScore = 0;
  let bankScore = 0;
  for (const kw of ccSignals) if (allText.includes(kw)) ccScore++;
  for (const kw of bankSignals) if (allText.includes(kw)) bankScore++;

  if (ccScore > bankScore) return "credit_card";
  if (bankScore > ccScore) return "bank";
  return "unknown";
}

function extractDescFromLine(line, dateEnd, amtStart) {
  // Primary: text between date and first amount
  if (dateEnd < amtStart) {
    let desc = line.substring(dateEnd, amtStart).trim();
    desc = desc.replace(/^[\s\-·|:;,]+/, "").replace(/[\s\-·|:;,]+$/, "").trim();
    if (desc.length >= 2) return desc;
  }
  // Fallback: all non-date, non-amount text
  let desc = line;
  // Remove date-looking things
  for (const { re } of DATE_PATTERNS) {
    desc = desc.replace(re, " ");
  }
  // Remove amount-looking things
  for (const p of AMT_PATTERNS) {
    desc = desc.replace(new RegExp(p.source, "g"), " ");
  }
  desc = desc.replace(/\s+/g, " ").trim();
  desc = desc.replace(/^[\s\-·|:;,#*]+/, "").replace(/[\s\-·|:;,#*]+$/, "").trim();
  return desc.length >= 2 ? desc : null;
}

// Strategy 1: Single-line extraction (date + desc + amount on same line)
function strategySingleLine(lines, inferredYear = null) {
  const txns = [];
  for (const line of lines) {
    if (isJunkLine(line) || isHeaderLine(line)) continue;
    
    const dateResult = findDate(line, inferredYear);
    if (!dateResult) continue;
    
    const amounts = findAmounts(line);
    if (amounts.length === 0) continue;

    const desc = extractDescFromLine(line, dateResult.endIndex, amounts[0].index);
    if (!desc) continue;

    // Pick amount: if multiple amounts, first non-zero is transaction, last may be balance
    let amount;
    if (amounts.length === 1) {
      amount = amounts[0].value;
    } else if (amounts.length === 2) {
      // Could be debit+credit or amount+balance; use the first
      amount = amounts[0].value;
    } else {
      // 3+: first is likely the transaction amount, last is balance
      amount = amounts[0].value;
    }
    
    if (amount === 0) continue;
    txns.push({ date: dateResult.date, desc, amount, originalCategory: null });
  }
  return txns;
}

// Strategy 2: Multi-line extraction (date on one line, desc/amount may follow)
function strategyMultiLine(lines, inferredYear = null) {
  const txns = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    if (isJunkLine(line) || isHeaderLine(line)) { i++; continue; }
    
    const dateResult = findDate(line, inferredYear);
    if (!dateResult) { i++; continue; }
    
    // Collect this line and up to 2 following lines as a transaction block
    let block = line;
    let blockLines = [line];
    let j = i + 1;
    while (j < lines.length && j <= i + 3) {
      const nextLine = lines[j];
      if (isJunkLine(nextLine) || isHeaderLine(nextLine)) break;
      if (findDate(nextLine, inferredYear)) break;
      blockLines.push(nextLine);
      block += "  " + nextLine;
      j++;
    }
    
    const amounts = findAmounts(block);
    if (amounts.length === 0) { i++; continue; }

    // Build description from all text that isn't date or amounts
    let desc = "";
    for (const bl of blockLines) {
      let text = bl;
      for (const { re } of DATE_PATTERNS) text = text.replace(re, " ");
      for (const p of AMT_PATTERNS) text = text.replace(new RegExp(p.source, "g"), " ");
      text = text.replace(/\s+/g, " ").trim();
      if (text.length >= 2) desc += (desc ? " " : "") + text;
    }
    desc = desc.replace(/^[\s\-·|:;,#*]+/, "").replace(/[\s\-·|:;,#*]+$/, "").trim();
    
    if (!desc || desc.length < 2) { i = j; continue; }

    let amount = amounts[0].value;
    if (amount === 0 && amounts.length > 1) amount = amounts[1].value;
    if (amount === 0) { i = j; continue; }

    txns.push({ date: dateResult.date, desc, amount, originalCategory: null });
    i = j;
  }
  return txns;
}

// Strategy 3: AI-powered extraction using Claude API
async function strategyAI(file, statementType = "unknown") {
  try {
    const base64 = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result.split(",")[1]);
      reader.onerror = () => rej(new Error("Read failed"));
      reader.readAsDataURL(file);
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 }
            },
            {
              type: "text",
              text: `Extract ALL transactions from this ${statementType === "credit_card" ? "credit card statement" : "bank statement"}. Return ONLY a JSON array, no markdown, no backticks, no explanation. Each object must have:
- "date": string in "YYYY-MM-DD" format
- "desc": merchant/description string
- "amount": number (negative for expenses/charges/purchases, positive for income/payments/credits/deposits)${statementType === "credit_card" ? "\nIMPORTANT: This is a credit card statement. Purchases and charges must be NEGATIVE. Payments you made to the card must be POSITIVE." : ""}

Example: [{"date":"2025-01-15","desc":"WHOLE FOODS MARKET","amount":-87.32},{"date":"2025-01-14","desc":"PAYROLL DEPOSIT","amount":3200.00}]

Return ONLY the JSON array.`
            }
          ]
        }]
      })
    });

    if (!response.ok) return [];
    const data = await response.json();
    const text = (data.content || []).map(b => b.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(t => t.date && t.desc && typeof t.amount === "number")
      .map(t => ({
        date: new Date(t.date + "T00:00:00"),
        desc: String(t.desc).trim(),
        amount: t.amount,
        originalCategory: null,
      }))
      .filter(t => !isNaN(t.date.getTime()) && t.desc.length > 0 && t.amount !== 0);
  } catch (e) {
    console.warn("AI extraction failed:", e);
    return [];
  }
}

async function parsePDF(file, onProgress = () => {}) {
  let pages;
  let extractionError = null;
  try {
    onProgress("Reading PDF...");
    pages = await extractPdfContent(file);
    onProgress(`Extracted ${pages.length} page(s), analyzing layout...`);
  } catch (e) {
    console.error("PDF.js extraction failed:", e);
    extractionError = e;
    pages = [];
  }

  // Detect statement type from raw page text
  const statementType = pages.length > 0 ? detectStatementType(pages) : "unknown";
  onProgress(`Detected: ${statementType === "credit_card" ? "Credit Card Statement" : statementType === "bank" ? "Bank Statement" : "Statement"}`);

  // Build lines with multiple Y-tolerances
  let bestTxns = [];
  let inferredYear = null;

  for (const tolerance of [2, 4, 6, 8]) {
    let allLines = [];
    for (const page of pages) {
      const lines = buildLines(page.items, tolerance);
      allLines = allLines.concat(lines);
    }

    if (allLines.length === 0) continue;

    if (!inferredYear) inferredYear = inferYearFromLines(allLines);

    // Try single-line strategy
    let txns = strategySingleLine(allLines, inferredYear);
    if (txns.length > bestTxns.length) bestTxns = txns;

    // Try multi-line strategy
    txns = strategyMultiLine(allLines, inferredYear);
    if (txns.length > bestTxns.length) bestTxns = txns;
  }

  // Credit card statements show charges as positive — flip signs so expenses are negative
  if (statementType === "credit_card" && bestTxns.length > 0) {
    bestTxns = bestTxns.map(t => ({ ...t, amount: -t.amount }));
  }

  onProgress(`Found ${bestTxns.length} transactions via text extraction...`);

  // If text-based extraction found enough, use it
  if (bestTxns.length >= 3) {
    bestTxns.sort((a, b) => b.date - a.date);
    return { txns: bestTxns, statementType };
  }

  // Fallback: use Claude AI to read the PDF directly
  onProgress("Using AI to read the statement...");
  const aiTxns = await strategyAI(file, statementType);
  if (aiTxns.length > bestTxns.length) {
    aiTxns.sort((a, b) => b.date - a.date);
    return { txns: aiTxns, statementType };
  }

  bestTxns.sort((a, b) => b.date - a.date);
  return { txns: bestTxns, statementType };
}

// ─── UPLOAD SCREEN ───
function UploadScreen({ onData }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const inputRef = useRef();

  const handleFile = useCallback((file) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "csv" || ext === "tsv") {
      Papa.parse(file, {
        complete: (results) => {
          try {
            const rows = results.data.filter(r => r.some(c => c && c.trim()));
            if (rows.length < 2) throw new Error("File appears empty");
            const headers = rows[0];
            const { dateCol, descCol, amtCol, debitCol, creditCol } = detectColumns(headers);
            const transactions = [];
            for (let i = 1; i < rows.length; i++) {
              const r = rows[i];
              if (!r[dateCol] && !r[descCol]) continue;
              const date = parseDate(r[dateCol]);
              const desc = (r[descCol] || "").trim();
              let amount;
              if (amtCol !== -1) {
                amount = parseAmount(r[amtCol]);
              } else {
                const debit = debitCol !== -1 ? parseAmount(r[debitCol]) : 0;
                const credit = creditCol !== -1 ? parseAmount(r[creditCol]) : 0;
                amount = credit > 0 ? credit : -Math.abs(debit);
              }
              if (date && desc) {
                transactions.push({ date, desc, amount, originalCategory: null });
              }
            }
            if (transactions.length === 0) throw new Error("No valid transactions found");
            onData(transactions, file.name, "bank");
          } catch (e) {
            setError(e.message);
          }
          setLoading(false);
        },
        error: () => { setError("Failed to parse CSV"); setLoading(false); }
      });
    } else if (ext === "pdf") {
      setLoadingMsg("Reading PDF...");
      parsePDF(file, (msg) => setLoadingMsg(msg)).then(({ txns, statementType }) => {
        if (txns.length === 0) {
          setError("No transactions found in PDF. This can happen with scanned/image-based PDFs. Try exporting a CSV from your bank's website instead.");
          setLoading(false);
          setLoadingMsg("");
          return;
        }
        onData(txns, file.name, statementType);
        setLoading(false);
        setLoadingMsg("");
      }).catch(e => {
        console.error("PDF parse error:", e);
        setError("Failed to read PDF: " + (e.message || "Unknown error") + ". Try a CSV export from your bank instead.");
        setLoading(false);
        setLoadingMsg("");
      });
    } else {
      setError("Unsupported file type. Please upload a CSV or PDF file.");
      setLoading(false);
    }
  }, [onData]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const featureBadges = [
    { icon: "encrypted", title: "Private", desc: "Client-side processing only" },
    { icon: "auto_awesome", title: "Visual insights", desc: "Categorized spend patterns" },
    { icon: "track_changes", title: "Savings goals", desc: "Automated milestone tracking" },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: theme.bg, fontFamily: font, color: theme.text }}>
      {/* Nav */}
      <header style={{ background: theme.bg, borderBottom: `1px solid ${theme.surfaceContainerLow}`, padding: "20px 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 22, fontFamily: fontHeadline, fontStyle: "italic", color: theme.text }}>CashCanvas</div>
      </header>

      {/* Main */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 48px 0", maxWidth: 1000, margin: "0 auto", width: "100%" }}>
        {/* Hero */}
        <section style={{ textAlign: "center", marginBottom: 48 }}>
          <h1 style={{ fontSize: 56, fontFamily: fontHeadline, fontWeight: 400, color: theme.text, lineHeight: 1.1, margin: "0 0 16px", letterSpacing: "-0.02em" }}>
            Cash<span style={{ fontStyle: "italic" }}>Canvas</span>
          </h1>
          <p style={{ fontFamily: fontHeadline, fontStyle: "italic", fontSize: 18, color: theme.textMuted, margin: 0 }}>
            The <span style={{ fontFamily: fontMono, fontStyle: "normal", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.2em", color: theme.primary }}>Atelier</span> of your personal finance.
          </p>
        </section>

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 48, width: "100%", alignItems: "start" }}>
          {/* Left: Drop zone */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              style={{
                background: dragging ? theme.greenSoft : theme.surface,
                border: `1px dashed ${dragging ? theme.primary : "#d0d0d0"}`,
                borderRadius: 8,
                height: 320,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.25s",
              }}
            >
              <div style={{
                width: 56, height: 56,
                background: dragging ? theme.greenSoft : theme.surfaceContainerLow,
                borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 20, transition: "background 0.2s",
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: theme.primary, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>cloud_upload</span>
              </div>
              <p style={{ fontFamily: fontHeadline, fontStyle: "italic", fontSize: 18, color: theme.textMuted, margin: "0 0 8px" }}>
                {loading ? (loadingMsg || "Parsing your statement...") : "Drop your bank statement"}
              </p>
              <p style={{ fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: theme.textSubtle, margin: 0 }}>
                CSV, PDF or OFX files accepted
              </p>
              <input ref={inputRef} type="file" accept=".csv,.tsv,.pdf" style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files[0])} />
            </div>
            {error && (
              <div style={{
                padding: "12px 16px", background: "rgba(176,45,33,0.06)",
                border: `1px solid rgba(176,45,33,0.2)`, borderRadius: 6, color: theme.accent,
                fontSize: 13, fontFamily: font,
              }}>{error}</div>
            )}
          </div>

          {/* Right: Badges + image */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32, paddingTop: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {featureBadges.map(b => (
                <div key={b.title} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: theme.surfaceContainerLow,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: theme.textSubtle, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>{b.icon}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: theme.text, marginBottom: 2 }}>{b.title}</div>
                    <div style={{ fontSize: 12, color: theme.textSubtle }}>{b.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Decorative panel */}
            <div style={{
              background: theme.surfaceContainerLow,
              borderRadius: 8, aspectRatio: "4/3",
              display: "flex", alignItems: "flex-end", padding: 20,
              overflow: "hidden", position: "relative",
            }}>
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(135deg, #efeeeb 0%, #e0ddd8 100%)",
              }} />
              <p style={{ position: "relative", fontFamily: fontMono, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em", color: theme.textSubtle }}>Editorial Finance</p>
            </div>
          </div>
        </div>

        {/* Sample data CTA */}
        <div style={{ marginTop: 48, textAlign: "center" }}>
          <button onClick={() => {
            const sample = generateSampleData();
            onData(sample, "sample_data.csv", "bank");
          }} style={{
            background: "transparent", border: "none",
            color: theme.text, cursor: "pointer", fontFamily: font, fontSize: 14, fontWeight: 500,
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 0", borderBottom: `1px solid transparent`,
            transition: "border-color 0.2s",
          }}
          onMouseEnter={e => e.currentTarget.style.borderBottomColor = theme.text}
          onMouseLeave={e => e.currentTarget.style.borderBottomColor = "transparent"}
          >
            Try with sample data
            <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>arrow_forward</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ background: theme.surfaceContainerLow, marginTop: 64, padding: "40px 48px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 32 }}>
          <div style={{ maxWidth: 240 }}>
            <p style={{ fontFamily: fontHeadline, fontStyle: "italic", fontSize: 18, color: theme.text, marginBottom: 10 }}>The Financial Atelier</p>
            <p style={{ fontSize: 13, color: theme.textSubtle, lineHeight: 1.6, margin: 0 }}>Personal finance is a craft. We provide the tools to refine your spending habits into a masterpiece of wealth preservation.</p>
          </div>
          <div style={{ display: "flex", gap: 48 }}>
            <div>
              <p style={{ fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: theme.textSubtle, marginBottom: 12 }}>Platform</p>
              {["Security", "Privacy"].map(l => <div key={l} style={{ fontSize: 13, color: theme.textSubtle, marginBottom: 8 }}>{l}</div>)}
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 1000, margin: "32px auto 0", paddingTop: 20, borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.textSubtle }}>© 2025 CashCanvas</span>
          <span style={{ fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.textSubtle }}>All data processed locally</span>
        </div>
      </footer>
    </div>
  );
}

function generateSampleData() {
  const txns = [];
  const now = new Date();
  const merchants = [
    { desc: "WHOLE FOODS MARKET", min: -40, max: -150 },
    { desc: "STARBUCKS COFFEE", min: -4, max: -12 },
    { desc: "UBER TRIP", min: -8, max: -35 },
    { desc: "NETFLIX SUBSCRIPTION", min: -15.99, max: -15.99 },
    { desc: "SPOTIFY PREMIUM", min: -9.99, max: -9.99 },
    { desc: "RENT PAYMENT", min: -1800, max: -1800 },
    { desc: "COMCAST INTERNET", min: -79.99, max: -79.99 },
    { desc: "SHELL GAS STATION", min: -30, max: -65 },
    { desc: "AMAZON.COM", min: -15, max: -200 },
    { desc: "CHIPOTLE MEXICAN GRILL", min: -10, max: -18 },
    { desc: "CVS PHARMACY", min: -8, max: -45 },
    { desc: "PAYROLL DIRECT DEPOSIT", min: 3200, max: 3200 },
    { desc: "TARGET STORE", min: -20, max: -120 },
    { desc: "DOORDASH DELIVERY", min: -15, max: -45 },
    { desc: "GYM MEMBERSHIP", min: -49.99, max: -49.99 },
    { desc: "ELECTRIC COMPANY", min: -90, max: -160 },
    { desc: "MOVIE THEATER", min: -12, max: -25 },
    { desc: "BEST BUY ELECTRONICS", min: -30, max: -300 },
  ];

  for (let m = 5; m >= 0; m--) {
    const baseDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const daysInMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
    // Payroll on 1st and 15th
    txns.push({ date: new Date(baseDate.getFullYear(), baseDate.getMonth(), 1), desc: "PAYROLL DIRECT DEPOSIT", amount: 3200 });
    txns.push({ date: new Date(baseDate.getFullYear(), baseDate.getMonth(), 15), desc: "PAYROLL DIRECT DEPOSIT", amount: 3200 });
    // Rent on 1st
    txns.push({ date: new Date(baseDate.getFullYear(), baseDate.getMonth(), 1), desc: "RENT PAYMENT", amount: -1800 });
    // Subscriptions
    txns.push({ date: new Date(baseDate.getFullYear(), baseDate.getMonth(), 5), desc: "NETFLIX SUBSCRIPTION", amount: -15.99 });
    txns.push({ date: new Date(baseDate.getFullYear(), baseDate.getMonth(), 8), desc: "SPOTIFY PREMIUM", amount: -9.99 });
    txns.push({ date: new Date(baseDate.getFullYear(), baseDate.getMonth(), 10), desc: "GYM MEMBERSHIP", amount: -49.99 });
    txns.push({ date: new Date(baseDate.getFullYear(), baseDate.getMonth(), 12), desc: "COMCAST INTERNET", amount: -79.99 });
    // Random transactions
    const numRandom = 15 + Math.floor(Math.random() * 10);
    for (let i = 0; i < numRandom; i++) {
      const day = 1 + Math.floor(Math.random() * daysInMonth);
      const merchant = merchants[Math.floor(Math.random() * merchants.length)];
      if (merchant.desc.includes("PAYROLL") || merchant.desc.includes("RENT") || merchant.desc.includes("NETFLIX") || merchant.desc.includes("SPOTIFY") || merchant.desc.includes("GYM") || merchant.desc.includes("COMCAST")) continue;
      const amount = merchant.min === merchant.max ? merchant.min : merchant.min + Math.random() * (merchant.max - merchant.min);
      txns.push({
        date: new Date(baseDate.getFullYear(), baseDate.getMonth(), Math.min(day, daysInMonth)),
        desc: merchant.desc,
        amount: Math.round(amount * 100) / 100,
      });
    }
  }
  txns.sort((a, b) => b.date - a.date);
  return txns;
}

// ─── CUSTOM TOOLTIP ───
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: theme.surface,
      borderRadius: 6, padding: "10px 14px", fontSize: 13, fontFamily: font,
      boxShadow: "0 8px 24px rgba(27,28,26,0.1)",
      border: `1px solid ${theme.border}`,
    }}>
      <div style={{ color: theme.textSubtle, marginBottom: 6, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontMono }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || theme.text, fontWeight: 600, fontFamily: fontMono, fontFeatureSettings: '"tnum"' }}>
          {p.name}: ${Math.abs(p.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ))}
    </div>
  );
}

// ─── DASHBOARD ───
function Dashboard({ auth, onLogout, transactions: rawTxns, fileName, statementType = "unknown", onReset }) {
  const [tab, setTab] = useState("Overview");
  const [customCats, setCustomCats] = useState({});
  const [apiCategories, setApiCategories] = useState([]); // full objects with _id for API ops
  const [merchantRules, setMerchantRules] = useState(new Map());
  const [savingsGoal, setSavingsGoal] = useState({ amount: "", deadline: "", name: "" });
  const [editingCat, setEditingCat] = useState(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [reassignTxn, setReassignTxn] = useState(null);
  const [txnOverrides, setTxnOverrides] = useState({});
  const [newCatName, setNewCatName] = useState("");
  const [selectedTxns, setSelectedTxns] = useState(new Set());
  const [cutSelections, setCutSelections] = useState({});
  const [showPlan, setShowPlan] = useState(false);
  const [newCatModal, setNewCatModal] = useState(false);
  const [newCatForm, setNewCatForm] = useState({ name: "", icon: "🏷️", color: "#6f7a72" });
  const [aiDone, setAiDone] = useState(false);

  // ── API helper ──
  const authFetch = useCallback(async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${auth?.token}`,
        ...(options.headers || {}),
      },
    });
    if (res.status === 401) { onLogout(); return {}; }
    return res.json();
  }, [auth?.token, onLogout]);

  // ── Load merchant rules + custom categories on mount ──
  useEffect(() => {
    if (!auth?.token) return;

    authFetch("/api/merchant-rules").then(data => {
      if (Array.isArray(data)) {
        setMerchantRules(new Map(data.map(r => [r.merchantName, r.category])));
      }
    }).catch(() => {});

    authFetch("/api/categories").then(data => {
      if (Array.isArray(data)) {
        setApiCategories(data);
        const catMap = {};
        data.forEach(c => { catMap[c.categoryName] = c.keywords || []; });
        setCustomCats(catMap);
      }
    }).catch(() => {});
  }, [auth?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI categorization — fires once after merchant rules load ──
  useEffect(() => {
    if (aiDone || !auth?.token) return;
    const otherTxns = rawTxns
      .map((t, i) => ({ ...t, id: i }))
      .filter(t => t.amount < 0 && !txnOverrides[t.id] && categorize(t.desc, customCats, merchantRules) === "Other");
    if (otherTxns.length === 0) { setAiDone(true); return; }
    setAiDone(true);
    authFetch("/api/categorize", {
      method: "POST",
      body: JSON.stringify({ transactions: otherTxns.slice(0, 100).map(t => ({ desc: t.desc, amount: t.amount })) }),
    }).then(data => {
      if (Array.isArray(data.results)) {
        setTxnOverrides(prev => {
          const next = { ...prev };
          data.results.forEach(({ idx, category }) => {
            if (category && category !== "Other") {
              const id = otherTxns[idx]?.id;
              if (id !== undefined && !next[id]) next[id] = category;
            }
          });
          return next;
        });
      }
    }).catch(() => {});
  }, [merchantRules, aiDone]); // eslint-disable-line react-hooks/exhaustive-deps

  const transactions = useMemo(() => {
    return rawTxns.map((t, i) => ({
      ...t,
      id: i,
      category: txnOverrides[i] || categorize(t.desc, customCats, merchantRules),
    }));
  }, [rawTxns, customCats, txnOverrides, merchantRules]);

  const expenses = useMemo(() => transactions.filter(t => t.amount < 0), [transactions]);
  const income = useMemo(() => transactions.filter(t => t.amount > 0), [transactions]);
  const totalExpenses = useMemo(() => Math.abs(_.sumBy(expenses, "amount")), [expenses]);
  const totalIncome = useMemo(() => _.sumBy(income, "amount"), [income]);
  const netCashflow = totalIncome - totalExpenses;

  // Category breakdown
  const catBreakdown = useMemo(() => {
    const grouped = _.groupBy(expenses, "category");
    return Object.entries(grouped).map(([cat, txns]) => ({
      name: cat,
      value: Math.abs(_.sumBy(txns, "amount")),
      count: txns.length,
    })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Monthly trends
  const monthlyData = useMemo(() => {
    const byMonth = _.groupBy(transactions, t => {
      const d = t.date;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, txns]) => {
        const exp = Math.abs(_.sumBy(txns.filter(t => t.amount < 0), "amount"));
        const inc = _.sumBy(txns.filter(t => t.amount > 0), "amount");
        const [y, m] = month.split("-");
        const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleString("default", { month: "short", year: "2-digit" });
        return { month: label, Expenses: Math.round(exp), Income: Math.round(inc), Net: Math.round(inc - exp) };
      });
  }, [transactions]);

  // Recurring payments
  const recurring = useMemo(() => {
    const grouped = _.groupBy(expenses, t => t.desc.toUpperCase().trim());
    return Object.entries(grouped)
      .filter(([, txns]) => txns.length >= 2)
      .map(([desc, txns]) => {
        const amounts = txns.map(t => Math.abs(t.amount));
        const avg = _.mean(amounts);
        const stdDev = Math.sqrt(_.mean(amounts.map(a => (a - avg) ** 2)));
        const isFixed = stdDev / avg < 0.05;
        return { desc, count: txns.length, avg, isFixed, total: _.sum(amounts), category: txns[0].category };
      })
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  // Top merchants
  const topMerchants = useMemo(() => {
    const grouped = _.groupBy(expenses, t => t.desc.toUpperCase().trim());
    return Object.entries(grouped)
      .map(([desc, txns]) => ({
        desc, total: Math.abs(_.sumBy(txns, "amount")), count: txns.length,
        category: txns[0].category,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [expenses]);

  // Savings calculation
  const savingsSuggestion = useMemo(() => {
    if (!savingsGoal.amount || !savingsGoal.deadline) return null;
    const target = parseFloat(savingsGoal.amount);
    const deadline = new Date(savingsGoal.deadline);
    const today = new Date();
    const monthsLeft = Math.max(1, (deadline.getFullYear() - today.getFullYear()) * 12 + deadline.getMonth() - today.getMonth());
    const monthly = target / monthsLeft;
    const avgMonthlyIncome = totalIncome / Math.max(1, monthlyData.length);
    const avgMonthlyExpense = totalExpenses / Math.max(1, monthlyData.length);
    const surplus = avgMonthlyIncome - avgMonthlyExpense;
    const feasible = surplus >= monthly;
    const suggestedBudget = avgMonthlyExpense - (monthly - Math.max(0, surplus));
    return { target, monthsLeft, monthly, avgMonthlyIncome, avgMonthlyExpense, surplus, feasible, suggestedBudget, goalName: savingsGoal.name };
  }, [savingsGoal, totalIncome, totalExpenses, monthlyData]);

  const allCategories = useMemo(() => {
    const cats = new Set(Object.keys(DEFAULT_CATEGORIES));
    Object.keys(customCats).forEach(c => cats.add(c));
    return Array.from(cats);
  }, [customCats]);

  const fmt = (v) => "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, fontFamily: font, color: theme.text }}>
      {/* Header */}
      <header style={{ background: theme.bg, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 22, fontFamily: fontHeadline, fontStyle: "italic", color: theme.text }}>CashCanvas</span>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontSize: 10, fontFamily: fontMono, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.textSubtle, background: theme.surfaceContainerLow, padding: "4px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 5 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>file_present</span>
                  {fileName}
                </span>
                {statementType !== "unknown" && (
                  <span style={{ fontSize: 10, fontFamily: fontMono, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.textSubtle, background: theme.surfaceContainerLow, padding: "4px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 5 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>account_balance</span>
                    {statementType === "credit_card" ? "Credit Card" : "Bank Statement"}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {auth?.user && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: theme.textSubtle, fontFamily: fontMono }}>{auth.user.name}</span>
                  <button onClick={onLogout} style={{
                    padding: "7px 14px", background: "none",
                    border: `1px solid ${theme.border}`, borderRadius: 6,
                    color: theme.textSubtle, cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 500,
                  }}>Sign Out</button>
                </div>
              )}
              <button onClick={onReset} style={{
                padding: "9px 20px",
                background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryContainer} 100%)`,
                border: "none", borderRadius: 6, color: "#fff",
                cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>add</span>
                New Upload
              </button>
            </div>
          </div>
          <nav style={{ marginTop: 12 }}>
            <TabBar tabs={["Overview", "Categories", "Savings"]} active={tab} onChange={setTab} />
          </nav>
        </div>
        <div style={{ height: 1, background: theme.surfaceContainerLow }} />
      </header>

      <div style={{ padding: "40px 40px", maxWidth: 1280, margin: "0 auto" }}>
        {/* ─── OVERVIEW TAB ─── */}
        {tab === "Overview" && (
          <div>
            {/* Hero */}
            <section style={{ marginBottom: 36 }}>
              <h1 style={{ fontSize: 48, fontFamily: fontHeadline, fontWeight: 400, color: theme.text, margin: "0 0 8px", lineHeight: 1.1 }}>
                The <span style={{ fontStyle: "italic", color: theme.primary }}>Canvas</span> of your wealth
              </h1>
              <p style={{ fontSize: 15, color: theme.textSubtle, margin: 0, maxWidth: 520, lineHeight: 1.6 }}>
                A curated perspective of your financial movement. Calculated with surgical precision.
              </p>
            </section>

            {/* Stats Row */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
              <StatCard label="Total Income" value={fmt(totalIncome)} color={theme.green} sub={`↑ ${income.length} transactions`} onClick={() => setTab("Transactions")} />
              <StatCard label="Total Expenses" value={fmt(totalExpenses)} color={theme.accent} sub={`↓ ${expenses.length} transactions`} onClick={() => setTab("Transactions")} />
              <StatCard label="Net Cashflow" value={(netCashflow >= 0 ? "+" : "") + fmt(netCashflow)} color={netCashflow >= 0 ? theme.green : theme.accent} sub={netCashflow >= 0 ? "Surplus" : "Deficit"} />
              <StatCard label="Transactions" value={transactions.length} color={theme.textSubtle} sub={`${monthlyData.length} months`} onClick={() => setTab("Transactions")} />
            </div>

            {/* Charts Row */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 20, marginBottom: 24 }}>
              {/* Spending Composition Donut */}
              <div style={{
                background: theme.surface, borderRadius: 8, padding: "28px 32px",
                boxShadow: "0 1px 3px rgba(27,28,26,0.06)",
              }}>
                <SectionTitle sub="By Category">Spending Composition</SectionTitle>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={catBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} strokeWidth={0}>
                      {catBreakdown.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", marginTop: 8 }}>
                  {catBreakdown.slice(0, 6).map((c, i) => (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: theme.textSubtle, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fiscal Trajectory Bar */}
              <div style={{
                background: theme.surface, borderRadius: 8, padding: "28px 32px",
                boxShadow: "0 1px 3px rgba(27,28,26,0.06)",
              }}>
                <SectionTitle sub={`Income vs Expenses · Last ${monthlyData.length} Months`}>Fiscal Trajectory</SectionTitle>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyData} barGap={3} barSize={10}>
                    <CartesianGrid stroke={theme.surfaceContainerLow} strokeDasharray="0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: theme.textSubtle, fontSize: 11, fontFamily: fontMono }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: theme.textSubtle, fontSize: 11, fontFamily: fontMono }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="Income" fill={`${theme.green}33`} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Expenses" fill={`${theme.accent}55`} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Net Cashflow Line */}
            <div style={{
              background: theme.surface,
              borderRadius: 8, padding: "28px 32px", marginBottom: 24,
              boxShadow: "0 1px 3px rgba(27,28,26,0.06)",
            }}>
              <SectionTitle sub="Net cashflow trajectory">Net Flow Dynamics</SectionTitle>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyData}>
                  <CartesianGrid stroke={theme.surfaceContainerLow} strokeDasharray="0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: theme.textSubtle, fontSize: 11, fontFamily: fontMono }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: theme.textSubtle, fontSize: 11, fontFamily: fontMono }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toLocaleString()}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="Net" stroke={theme.primary} strokeWidth={2.5} dot={{ r: 4, fill: theme.primary, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Recurring + Top Merchants */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{
                flex: "1 1 400px", background: theme.surface,
                borderRadius: 8, padding: "28px 32px",
                boxShadow: "0 1px 3px rgba(27,28,26,0.06)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                  <SectionTitle sub="Regular charges detected">Recurring Payments</SectionTitle>
                  <span className="material-symbols-outlined" style={{ color: theme.textSubtle, opacity: 0.4, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>repeat</span>
                </div>
                {recurring.length === 0 ? (
                  <div style={{ color: theme.textSubtle, fontSize: 14 }}>No recurring payments detected</div>
                ) : (
                  <div style={{ maxHeight: 300, overflowY: "auto" }}>
                    {recurring.slice(0, 8).map(r => (
                      <div key={r.desc} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                        padding: "14px 0", borderBottom: `1px solid ${theme.surfaceContainer}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 4, flexShrink: 0,
                            background: theme.surfaceContainerLow,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700, color: theme.textSubtle, fontFamily: fontMono,
                          }}>{r.desc[0].toUpperCase()}</div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{r.desc}</div>
                            <div style={{ fontSize: 10, color: theme.textSubtle, fontFamily: fontMono, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>
                              {r.category} · {r.isFixed ? "Fixed" : "Variable"}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontFamily: fontMono, fontWeight: 600, fontSize: 14, color: theme.text, fontFeatureSettings: '"tnum"', whiteSpace: "nowrap" }}>
                          {fmt(r.avg)}<span style={{ color: theme.textSubtle, fontSize: 11, fontWeight: 400 }}>/mo</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{
                flex: "1 1 400px", background: theme.surface,
                borderRadius: 8, padding: "28px 32px",
                boxShadow: "0 1px 3px rgba(27,28,26,0.06)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                  <SectionTitle sub="Highest total spend">Top Merchants</SectionTitle>
                  <span className="material-symbols-outlined" style={{ color: theme.textSubtle, opacity: 0.4, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>storefront</span>
                </div>
                {topMerchants.map((m, i) => (
                  <div key={m.desc} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 0", borderBottom: `1px solid ${theme.surfaceContainer}`,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 4, flexShrink: 0,
                      background: theme.surfaceContainerLow,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color: theme.textSubtle, fontFamily: fontMono,
                    }}>{m.desc[0].toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: theme.text }}>{m.desc}</div>
                      <div style={{ fontSize: 10, color: theme.textSubtle, fontFamily: fontMono, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{m.count} transactions · {m.category}</div>
                    </div>
                    <div style={{ fontFamily: fontMono, fontWeight: 600, fontSize: 14, color: theme.text, fontFeatureSettings: '"tnum"', whiteSpace: "nowrap" }}>{fmt(m.total)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── TRANSACTIONS TAB ─── */}
        {tab === "Transactions" && (
          <div>
            <SectionTitle sub={`${transactions.length} transactions found`}>All Transactions</SectionTitle>

            {selectedTxns.size > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 12, marginBottom: 12,
                padding: "10px 16px", background: theme.greenSoft, borderRadius: 6,
                border: `1px solid ${theme.green}33`,
              }}>
                <span style={{ fontSize: 14, color: theme.primary, fontWeight: 600 }}>{selectedTxns.size} selected</span>
                <button onClick={() => setReassignTxn(true)} style={{
                  padding: "6px 14px", background: theme.primary, border: "none",
                  borderRadius: 4, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  fontFamily: "inherit",
                }}>Reassign Category</button>
                <button onClick={() => setSelectedTxns(new Set())} style={{
                  padding: "6px 14px", background: "none", border: `1px solid ${theme.primary}44`,
                  borderRadius: 4, color: theme.primary, cursor: "pointer", fontSize: 13, fontWeight: 600,
                  fontFamily: "inherit",
                }}>Clear</button>
              </div>
            )}

            <div style={{
              background: theme.surface,
              borderRadius: 8, overflow: "hidden",
              boxShadow: "0 1px 3px rgba(27,28,26,0.06)",
            }}>
              <div style={{
                display: "grid", gridTemplateColumns: "40px 120px 1fr 140px 140px",
                padding: "12px 20px", borderBottom: `1px solid ${theme.surfaceContainer}`,
                fontSize: 10, fontWeight: 600, color: theme.textSubtle, textTransform: "uppercase", letterSpacing: "0.1em",
                fontFamily: fontMono, alignItems: "center",
              }}>
                <div>
                  <input type="checkbox"
                    checked={selectedTxns.size === transactions.length && transactions.length > 0}
                    onChange={e => setSelectedTxns(e.target.checked ? new Set(transactions.map(t => t.id)) : new Set())}
                    style={{ cursor: "pointer", accentColor: theme.primary }}
                  />
                </div>
                <div>Date</div><div>Description</div><div>Category</div><div style={{ textAlign: "right" }}>Amount</div>
              </div>
              <div style={{ maxHeight: 600, overflowY: "auto" }}>
                {transactions.map(t => (
                  <div key={t.id} style={{
                    display: "grid", gridTemplateColumns: "40px 120px 1fr 140px 140px",
                    padding: "12px 20px", borderBottom: `1px solid ${theme.surfaceContainer}`,
                    fontSize: 13, alignItems: "center",
                    transition: "background 0.12s",
                    background: selectedTxns.has(t.id) ? theme.greenSoft : "transparent",
                  }}
                  onMouseEnter={e => { if (!selectedTxns.has(t.id)) e.currentTarget.style.background = theme.surfaceContainerLow; }}
                  onMouseLeave={e => { if (!selectedTxns.has(t.id)) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div>
                      <input type="checkbox"
                        checked={selectedTxns.has(t.id)}
                        onChange={e => setSelectedTxns(prev => {
                          const next = new Set(prev);
                          e.target.checked ? next.add(t.id) : next.delete(t.id);
                          return next;
                        })}
                        style={{ cursor: "pointer", accentColor: theme.primary }}
                      />
                    </div>
                    <div style={{ color: theme.textSubtle, fontSize: 12, fontFamily: fontMono }}>
                      {t.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                    </div>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12, fontWeight: 500 }}>{t.desc}</div>
                    <div>
                      <span style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 4, fontFamily: fontMono,
                        background: theme.surfaceContainerLow, color: theme.textSubtle,
                      }}>{t.category}</span>
                    </div>
                    <div style={{
                      textAlign: "right", fontFamily: fontMono, fontWeight: 600, fontSize: 13,
                      color: t.amount >= 0 ? theme.green : theme.text,
                      fontFeatureSettings: '"tnum"', cursor: "default", userSelect: "none",
                    }}>
                      {t.amount >= 0 ? "+" : "-"}{fmt(t.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reassign modal */}
            {reassignTxn !== null && (
              <div style={{
                position: "fixed", inset: 0, background: "rgba(27,28,26,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
                backdropFilter: "blur(4px)",
              }} onClick={() => { setReassignTxn(null); setNewCatName(""); }}>
                <div style={{
                  background: theme.surface,
                  borderRadius: 8, padding: 28, width: 360, maxHeight: "80vh", overflowY: "auto",
                  boxShadow: "0 24px 48px rgba(27,28,26,0.12)",
                }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 400, fontFamily: fontHeadline }}>Reassign Category</h3>
                  <p style={{ fontSize: 13, color: theme.textSubtle, margin: "0 0 16px" }}>
                    {selectedTxns.size} transaction{selectedTxns.size !== 1 ? "s" : ""} will be updated
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {allCategories.filter(c => c !== "Income").map(cat => (
                      <button key={cat} onClick={() => {
                        setTxnOverrides(prev => {
                          const next = { ...prev };
                          selectedTxns.forEach(id => { next[id] = cat; });
                          return next;
                        });
                        // Learn merchant→category mapping for each selected transaction
                        selectedTxns.forEach(id => {
                          const txn = rawTxns[id];
                          if (!txn) return;
                          const merchantName = cleanDesc(txn.desc);
                          if (!merchantName) return;
                          setMerchantRules(prev => new Map([...prev, [merchantName, cat]]));
                          authFetch("/api/merchant-rules", {
                            method: "POST",
                            body: JSON.stringify({ merchantName, category: cat }),
                          }).catch(() => {});
                        });
                        setSelectedTxns(new Set());
                        setReassignTxn(null);
                        setNewCatName("");
                      }} style={{
                        padding: "10px 14px", background: theme.surfaceContainerLow,
                        border: `1px solid ${theme.border}`,
                        borderRadius: 4, color: theme.text, cursor: "pointer", textAlign: "left",
                        fontFamily: font, fontSize: 13, transition: "background 0.1s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = theme.surfaceContainer}
                      onMouseLeave={e => e.currentTarget.style.background = theme.surfaceContainerLow}
                      >{cat}</button>
                    ))}
                    {/* Create new category */}
                    <div style={{ marginTop: 8, borderTop: `1px solid ${theme.surfaceContainer}`, paddingTop: 12 }}>
                      <div style={{ fontSize: 10, color: theme.textSubtle, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: fontMono }}>Create new category</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          value={newCatName}
                          onChange={e => setNewCatName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && newCatName.trim()) {
                              const name = newCatName.trim();
                              setCustomCats(prev => ({ ...prev, [name]: prev[name] || [] }));
                              authFetch("/api/categories", { method: "POST", body: JSON.stringify({ categoryName: name }) })
                                .then(cat => { if (cat?._id) setApiCategories(prev => [...prev, cat]); })
                                .catch(() => {});
                              setTxnOverrides(prev => {
                                const next = { ...prev };
                                selectedTxns.forEach(id => { next[id] = name; });
                                return next;
                              });
                              setSelectedTxns(new Set());
                              setReassignTxn(null);
                              setNewCatName("");
                            }
                          }}
                          placeholder="e.g. Pet Care, Education..."
                          style={{
                            flex: 1, padding: "9px 12px", background: theme.surfaceContainerLow,
                            border: `1px solid ${theme.border}`, borderRadius: 4,
                            color: theme.text, fontFamily: font, fontSize: 13, outline: "none",
                          }}
                        />
                        <button onClick={() => {
                          if (!newCatName.trim()) return;
                          const name = newCatName.trim();
                          setCustomCats(prev => ({ ...prev, [name]: prev[name] || [] }));
                          authFetch("/api/categories", { method: "POST", body: JSON.stringify({ categoryName: name }) })
                            .then(cat => { if (cat?._id) setApiCategories(prev => [...prev, cat]); })
                            .catch(() => {});
                          setTxnOverrides(prev => {
                            const next = { ...prev };
                            selectedTxns.forEach(id => { next[id] = name; });
                            return next;
                          });
                          setSelectedTxns(new Set());
                          setReassignTxn(null);
                          setNewCatName("");
                        }} style={{
                          padding: "9px 14px", background: newCatName.trim() ? theme.primary : theme.surfaceContainer,
                          border: "none",
                          borderRadius: 4, color: newCatName.trim() ? "#fff" : theme.textSubtle,
                          cursor: newCatName.trim() ? "pointer" : "default",
                          fontFamily: font, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                        }}>+ Add</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── CATEGORIES TAB ─── */}
        {tab === "Categories" && (() => {
          const otherTxns = expenses.filter(t => t.category === "Other");
          const categorizedTxns = expenses.filter(t => t.category !== "Other");
          const categorizedPct = expenses.length > 0 ? Math.round((categorizedTxns.length / expenses.length) * 100) : 0;
          const topCats = allCategories.filter(c => c !== "Other" && c !== "Income");

          return (
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <SectionTitle sub="Customize how transactions are categorized">Manage Categories</SectionTitle>
              <button onClick={() => setNewCatModal(true)} style={{
                padding: "9px 18px", background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryContainer} 100%)`,
                border: "none", borderRadius: 6, color: "#fff",
                cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
              }}>
                <span style={{ fontSize: 16 }}>+</span> New Category
              </button>
            </div>

            {/* New Category Modal */}
            {newCatModal && (
              <div style={{
                position: "fixed", inset: 0, background: "rgba(27,28,26,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
                backdropFilter: "blur(4px)",
              }} onClick={() => { setNewCatModal(false); setNewCatForm({ name: "", icon: "🏷️", color: "#6f7a72" }); }}>
                <div style={{
                  background: theme.surface, borderRadius: 10, padding: 32, width: 380,
                  boxShadow: "0 24px 48px rgba(27,28,26,0.12)",
                }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 400, fontFamily: fontHeadline }}>New Category</h3>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, color: theme.textSubtle, display: "block", marginBottom: 6, fontFamily: fontMono, textTransform: "uppercase", letterSpacing: "0.08em" }}>Name</label>
                    <input
                      value={newCatForm.name}
                      onChange={e => setNewCatForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Pet Care, Education..."
                      autoFocus
                      style={{ width: "100%", padding: "10px 12px", boxSizing: "border-box", background: theme.surfaceContainerLow, border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.text, fontFamily: font, fontSize: 14, outline: "none" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: theme.textSubtle, display: "block", marginBottom: 6, fontFamily: fontMono, textTransform: "uppercase", letterSpacing: "0.08em" }}>Icon / Emoji</label>
                      <input
                        value={newCatForm.icon}
                        onChange={e => setNewCatForm(p => ({ ...p, icon: e.target.value }))}
                        placeholder="🏷️"
                        style={{ width: "100%", padding: "10px 12px", boxSizing: "border-box", background: theme.surfaceContainerLow, border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.text, fontFamily: font, fontSize: 20, outline: "none", textAlign: "center" }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: theme.textSubtle, display: "block", marginBottom: 6, fontFamily: fontMono, textTransform: "uppercase", letterSpacing: "0.08em" }}>Color</label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {["#005235","#b02d21","#6f7a72","#3f4943","#a07040","#1a6b4a","#7a3f8a","#3a6aa0"].map(c => (
                          <div key={c} onClick={() => setNewCatForm(p => ({ ...p, color: c }))} style={{
                            width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer",
                            border: newCatForm.color === c ? `3px solid ${theme.text}` : "2px solid transparent",
                            boxSizing: "border-box", transition: "transform 0.1s",
                          }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => { setNewCatModal(false); setNewCatForm({ name: "", icon: "🏷️", color: "#6f7a72" }); }} style={{
                      flex: 1, padding: "10px", background: "none", border: `1px solid ${theme.border}`,
                      borderRadius: 6, cursor: "pointer", fontFamily: font, fontSize: 13, color: theme.textSubtle,
                    }}>Cancel</button>
                    <button onClick={async () => {
                      if (!newCatForm.name.trim()) return;
                      const name = newCatForm.name.trim();
                      setCustomCats(prev => ({ ...prev, [name]: [] }));
                      setNewCatModal(false);
                      setNewCatForm({ name: "", icon: "🏷️", color: "#6f7a72" });
                      authFetch("/api/categories", {
                        method: "POST",
                        body: JSON.stringify({ categoryName: name, icon: newCatForm.icon, color: newCatForm.color }),
                      }).then(cat => { if (cat?._id) setApiCategories(prev => [...prev, cat]); }).catch(() => {});
                    }} style={{
                      flex: 2, padding: "10px",
                      background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryContainer} 100%)`,
                      border: "none", borderRadius: 6, cursor: "pointer",
                      fontFamily: font, fontSize: 13, fontWeight: 600, color: "#fff",
                    }}>Create Category</button>
                  </div>
                </div>
              </div>
            )}

            {/* Summary bar */}
            <div style={{
              background: theme.surface,
              borderRadius: 8, padding: "20px 28px", marginBottom: 24,
              display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap",
              boxShadow: "0 1px 3px rgba(27,28,26,0.06)",
            }}>
              <div>
                <div style={{ fontSize: 10, color: theme.textSubtle, fontFamily: fontMono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Categorized</div>
                <div style={{ fontSize: 30, fontWeight: 600, color: theme.green, fontFamily: fontMono, fontFeatureSettings: '"tnum"' }}>{categorizedPct}%</div>
                <div style={{ fontSize: 12, color: theme.textSubtle, marginTop: 4 }}>{categorizedTxns.length} of {expenses.length} transactions</div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: theme.textSubtle, marginBottom: 8, fontFamily: fontMono }}>
                  <span>Categorized</span>
                  <span>{otherTxns.length} uncategorized</span>
                </div>
                <div style={{ height: 4, background: theme.surfaceContainerLow, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${categorizedPct}%`, background: theme.green, borderRadius: 2, transition: "width 0.4s" }} />
                </div>
              </div>
              {otherTxns.length > 0 && (
                <div style={{
                  padding: "6px 14px", background: "rgba(176,45,33,0.06)", border: `1px solid rgba(176,45,33,0.2)`,
                  borderRadius: 4, fontSize: 12, color: theme.accent, fontWeight: 600, fontFamily: fontMono,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  {otherTxns.length} need attention
                </div>
              )}
            </div>

            {/* Spending breakdown bars */}
            <div style={{
              background: theme.surface,
              borderRadius: 8, padding: "24px 28px", marginBottom: 24,
              boxShadow: "0 1px 3px rgba(27,28,26,0.06)",
            }}>
              <SectionTitle sub="by category">Category breakdown</SectionTitle>
              {allCategories.filter(c => c !== "Other" && c !== "Income").map((cat, ci) => {
                const catTotal = Math.abs(_.sumBy(expenses.filter(t => t.category === cat), "amount"));
                const pct = totalExpenses > 0 ? (catTotal / totalExpenses) * 100 : 0;
                if (catTotal === 0) return null;
                return (
                  <div key={cat} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: theme.text }}>{cat}</span>
                      <span style={{ fontFamily: fontMono, color: theme.textSubtle, fontSize: 13, fontFeatureSettings: '"tnum"' }}>
                        {fmt(catTotal)}
                      </span>
                    </div>
                    <div style={{ height: 3, background: theme.surfaceContainerLow, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: PALETTE[ci % PALETTE.length], borderRadius: 2, transition: "width 0.4s" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Category cards */}
            <div style={{ fontSize: 11, fontFamily: fontMono, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: theme.textSubtle, marginBottom: 16 }}>Categories</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
              {allCategories.map((cat, ci) => {
                const customKws = customCats[cat] || [];
                const isEditing = editingCat === cat;
                const catTxns = expenses.filter(t => t.category === cat);
                const catTotal = Math.abs(_.sumBy(catTxns, "amount"));
                const pct = totalExpenses > 0 ? (catTotal / totalExpenses) * 100 : 0;
                const apiCat = apiCategories.find(c => c.categoryName === cat);
                const isCustom = !!customCats[cat] || !!apiCat;
                const catColor = apiCat?.color || PALETTE[ci % PALETTE.length];
                const catIcon = apiCat?.icon;

                return (
                  <div key={cat} style={{
                    flex: "1 1 220px", maxWidth: 300, background: theme.surface,
                    borderLeft: `3px solid ${isEditing ? theme.primary : catColor}`,
                    borderRadius: 8, padding: "16px 20px",
                    boxShadow: "0 1px 3px rgba(27,28,26,0.06)",
                    transition: "box-shadow 0.2s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      {catIcon && <span style={{ fontSize: 16 }}>{catIcon}</span>}
                      <span style={{ fontSize: 14, fontWeight: 600, flex: 1, color: theme.text }}>{cat}</span>
                      <span style={{ fontFamily: fontMono, fontSize: 11, color: theme.textSubtle }}>{catTxns.length}</span>
                      {apiCat && (
                        <button onClick={async () => {
                          if (!confirm(`Delete category "${cat}"?`)) return;
                          setCustomCats(prev => { const n = { ...prev }; delete n[cat]; return n; });
                          setApiCategories(prev => prev.filter(c => c.categoryName !== cat));
                          authFetch(`/api/categories/${apiCat._id}`, { method: "DELETE" }).catch(() => {});
                        }} style={{
                          background: "none", border: "none", color: theme.accent, cursor: "pointer",
                          fontSize: 15, padding: "0 2px", lineHeight: 1, opacity: 0.6,
                        }} title="Delete category">×</button>
                      )}
                    </div>

                    <div style={{ fontSize: 22, fontWeight: 600, fontFamily: fontMono, fontFeatureSettings: '"tnum"', color: theme.text, marginBottom: 10, letterSpacing: "-0.02em" }}>
                      {fmt(catTotal)}
                    </div>

                    <div style={{ marginBottom: isEditing ? 12 : 0 }}>
                      <div style={{ height: 2, background: theme.surfaceContainerLow, borderRadius: 1, overflow: "hidden", marginBottom: 4 }}>
                        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: PALETTE[ci % PALETTE.length], borderRadius: 1 }} />
                      </div>
                      <div style={{ fontSize: 11, color: theme.textSubtle, fontFamily: fontMono }}>{pct.toFixed(1)}% of spending</div>
                    </div>

                    {/* Show custom keywords only when editing */}
                    {isEditing && (
                      <div>
                        {customKws.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, margin: "10px 0 8px" }}>
                            {customKws.map(kw => (
                              <span key={kw} style={{
                                fontSize: 11, padding: "3px 8px", borderRadius: 4,
                                background: theme.greenSoft, color: theme.primary, border: `1px solid ${theme.primary}22`,
                                display: "flex", alignItems: "center", gap: 5,
                              }}>
                                {kw}
                                <button onClick={() => {
                                  const newKws = (customCats[cat] || []).filter(k => k !== kw);
                                  setCustomCats(prev => ({ ...prev, [cat]: newKws }));
                                  const id = apiCategories.find(c => c.categoryName === cat)?._id;
                                  if (id) authFetch(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify({ keywords: newKws }) }).catch(() => {});
                                }} style={{ background: "none", border: "none", color: theme.primary, cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                          <input
                            value={newKeyword}
                            onChange={e => setNewKeyword(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" && newKeyword.trim()) {
                                const kw = newKeyword.trim().toLowerCase();
                                const newKws = [...(customCats[cat] || []), kw];
                                setCustomCats(prev => ({ ...prev, [cat]: newKws }));
                                const id = apiCategories.find(c => c.categoryName === cat)?._id;
                                if (id) authFetch(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify({ keywords: newKws }) }).catch(() => {});
                                setNewKeyword("");
                              }
                            }}
                            placeholder="Type merchant name..."
                            style={{
                              flex: 1, padding: "8px 12px", background: theme.surfaceContainerLow,
                              border: `1px solid ${theme.border}`, borderRadius: 4,
                              color: theme.text, fontFamily: font, fontSize: 13, outline: "none",
                            }}
                            autoFocus
                          />
                          <button onClick={() => { setEditingCat(null); setNewKeyword(""); }} style={{
                            padding: "8px 14px", background: theme.primary, border: "none",
                            borderRadius: 4, color: "#fff", cursor: "pointer", fontSize: 13, fontFamily: font,
                          }}>Done</button>
                        </div>
                      </div>
                    )}

                    {!isEditing && (
                      <button onClick={() => setEditingCat(cat)} style={{
                        marginTop: 12, width: "100%", padding: "7px", background: "transparent",
                        border: `1px dashed ${theme.outlineVariant || "#bfc9c0"}`, borderRadius: 4,
                        color: theme.textSubtle, cursor: "pointer", fontSize: 12, fontFamily: font,
                      }}>
                        {customKws.length > 0 ? `+ ${customKws.length} custom keyword${customKws.length > 1 ? "s" : ""}` : "+ Add merchant"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Uncategorized transactions quick-fix */}
            {otherTxns.length > 0 && (
              <div style={{ background: theme.surface, borderRadius: 8, padding: "24px 28px", boxShadow: "0 1px 3px rgba(27,28,26,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 20, fontWeight: 400, fontFamily: fontHeadline, color: theme.text }}>Uncategorized Transactions</div>
                  <span style={{ padding: "3px 10px", background: "rgba(176,45,33,0.08)", borderRadius: 4, fontSize: 10, fontFamily: fontMono, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: theme.accent }}>Action Required</span>
                </div>
                <div style={{ fontSize: 13, color: theme.textSubtle, marginBottom: 20 }}>
                  {otherTxns.length} transactions couldn't be auto-categorized. Click a category to assign.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {otherTxns.map(t => (
                    <div key={t.id} style={{
                      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                      padding: "14px 0", borderBottom: `1px solid ${theme.surfaceContainer}`,
                    }}>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: theme.text }}>{t.desc}</div>
                        <div style={{ fontSize: 11, color: theme.textSubtle, marginTop: 2, fontFamily: fontMono }}>
                          {t.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                      </div>
                      <div style={{ fontFamily: fontMono, fontSize: 13, fontWeight: 600, color: theme.accent, minWidth: 70, textAlign: "right", fontFeatureSettings: '"tnum"' }}>
                        {fmt(t.amount)}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {topCats.slice(0, 6).map(cat => (
                          <button key={cat} onClick={() => {
                            setTxnOverrides(prev => ({ ...prev, [t.id]: cat }));
                          }} style={{
                            padding: "4px 10px", background: theme.surfaceContainerLow, border: "none",
                            borderRadius: 4, color: theme.textSubtle, cursor: "pointer", fontSize: 11,
                            fontFamily: font, transition: "all 0.12s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = theme.surfaceContainer; e.currentTarget.style.color = theme.text; }}
                          onMouseLeave={e => { e.currentTarget.style.background = theme.surfaceContainerLow; e.currentTarget.style.color = theme.textSubtle; }}
                          >{cat}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* ─── SAVINGS TAB ─── */}
        {tab === "Savings" && (
          <div style={{ maxWidth: 820, margin: "0 auto" }}>
            <section style={{ marginBottom: 32, textAlign: "center" }}>
              <h1 style={{ fontSize: 40, fontFamily: fontHeadline, fontWeight: 400, color: theme.text, margin: "0 0 8px" }}>
                Savings <span style={{ fontStyle: "italic", color: theme.primary }}>Goals</span>
              </h1>
              <p style={{ fontSize: 14, color: theme.textSubtle, margin: 0 }}>Set a target and get personalized suggestions based on your spending patterns.</p>
            </section>

            <div style={{
              background: theme.surface,
              borderRadius: 8, padding: 28, marginBottom: 24,
              boxShadow: "0 1px 3px rgba(27,28,26,0.06)",
            }}>
              <h3 style={{ fontSize: 18, fontWeight: 400, fontFamily: fontHeadline, margin: "0 0 20px", color: theme.text }}>Set Your Goal</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, color: theme.textSubtle, display: "block", marginBottom: 6, fontFamily: fontMono, textTransform: "uppercase", letterSpacing: "0.08em" }}>Goal Name</label>
                  <input value={savingsGoal.name} onChange={e => setSavingsGoal(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Emergency fund, Vacation, New car"
                    style={{
                      width: "100%", padding: "10px 14px", background: theme.surfaceContainerLow,
                      border: `1px solid ${theme.border}`, borderRadius: 4,
                      color: theme.text, fontFamily: font, fontSize: 14, outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: theme.textSubtle, display: "block", marginBottom: 6, fontFamily: fontMono, textTransform: "uppercase", letterSpacing: "0.08em" }}>Target Amount ($)</label>
                    <input value={savingsGoal.amount} onChange={e => setSavingsGoal(p => ({ ...p, amount: e.target.value }))}
                      type="number" placeholder="5000"
                      style={{
                        width: "100%", padding: "10px 14px", background: theme.surfaceContainerLow,
                        border: `1px solid ${theme.border}`, borderRadius: 4,
                        color: theme.text, fontFamily: font, fontSize: 14, outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: theme.textSubtle, display: "block", marginBottom: 6, fontFamily: fontMono, textTransform: "uppercase", letterSpacing: "0.08em" }}>Target Date</label>
                    <input value={savingsGoal.deadline} onChange={e => setSavingsGoal(p => ({ ...p, deadline: e.target.value }))}
                      type="date"
                      style={{
                        width: "100%", padding: "10px 14px", background: theme.surfaceContainerLow,
                        border: `1px solid ${theme.border}`, borderRadius: 4,
                        color: theme.text, fontFamily: font, fontSize: 14, outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {savingsSuggestion && (
              <div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
                  <StatCard
                    label="Monthly Target"
                    value={fmt(savingsSuggestion.monthly)}
                    color={theme.primary}
                    sub={`${savingsSuggestion.monthsLeft} months to go`}
                  />
                  <StatCard
                    label="Avg Monthly Surplus"
                    value={(savingsSuggestion.surplus >= 0 ? "+" : "") + fmt(savingsSuggestion.surplus)}
                    color={savingsSuggestion.surplus >= 0 ? theme.green : theme.accent}
                    sub="Income minus expenses"
                  />
                  <StatCard
                    label="Feasibility"
                    value={savingsSuggestion.feasible ? "On Track" : "Needs Adjustment"}
                    color={savingsSuggestion.feasible ? theme.green : theme.accent}
                    sub={savingsSuggestion.feasible ? "Current spending supports this goal" : "You may need to reduce spending"}
                  />
                </div>

                <div style={{
                  background: theme.surface,
                  borderRadius: 8, padding: 28,
                  boxShadow: "0 1px 3px rgba(27,28,26,0.06)",
                }}>
                  <h3 style={{ fontSize: 20, fontWeight: 400, fontFamily: fontHeadline, margin: "0 0 16px", color: theme.text }}>
                    {savingsSuggestion.goalName ? `Plan: ${savingsSuggestion.goalName}` : "Savings Plan"}
                  </h3>
                  <div style={{ fontSize: 14, lineHeight: 1.8, color: theme.textSubtle }}>
                    <p style={{ margin: "0 0 12px" }}>
                      To save <strong style={{ color: theme.text, fontFamily: fontMono }}>{fmt(savingsSuggestion.target)}</strong> in{" "}
                      <strong style={{ color: theme.text }}>{savingsSuggestion.monthsLeft} months</strong>, you need to set aside{" "}
                      <strong style={{ color: theme.primary, fontFamily: fontMono }}>{fmt(savingsSuggestion.monthly)}/month</strong>.
                    </p>
                    <p style={{ margin: "0 0 12px" }}>
                      Your average monthly income is <strong style={{ color: theme.green, fontFamily: fontMono }}>{fmt(savingsSuggestion.avgMonthlyIncome)}</strong> and
                      average expenses are <strong style={{ color: theme.accent, fontFamily: fontMono }}>{fmt(savingsSuggestion.avgMonthlyExpense)}</strong>.
                    </p>
                    {savingsSuggestion.feasible ? (
                      <p style={{ margin: 0 }}>
                        Your current surplus of <strong style={{ color: theme.green, fontFamily: fontMono }}>{fmt(savingsSuggestion.surplus)}/month</strong> covers
                        the savings target. Keep your spending under <strong style={{ color: theme.text, fontFamily: fontMono }}>{fmt(savingsSuggestion.avgMonthlyIncome - savingsSuggestion.monthly)}/month</strong> to stay on track.
                      </p>
                    ) : (
                      <p style={{ margin: 0 }}>
                        You'd need to reduce monthly expenses by about{" "}
                        <strong style={{ color: theme.accent, fontFamily: fontMono }}>{fmt(savingsSuggestion.monthly - Math.max(0, savingsSuggestion.surplus))}</strong> to meet this goal.
                        Use the planner below to choose where to cut.
                      </p>
                    )}
                  </div>
                </div>

                {/* ─── INTERACTIVE CUT PLANNER ─── */}
                {(() => {
                  const numMonths = Math.max(1, monthlyData.length);
                  const cuttable = catBreakdown.filter(c => c.name !== "Income" && c.name !== "Housing");
                  const totalCutPerMonth = cuttable.reduce((sum, c) => {
                    const sel = cutSelections[c.name];
                    if (!sel?.selected) return sum;
                    const monthlyAvg = c.value / numMonths;
                    return sum + (monthlyAvg * (sel.percent || 25) / 100);
                  }, 0);
                  const selectedCount = cuttable.filter(c => cutSelections[c.name]?.selected).length;
                  const newMonthlyExpense = savingsSuggestion.avgMonthlyExpense - totalCutPerMonth;
                  const newSurplus = savingsSuggestion.avgMonthlyIncome - newMonthlyExpense;
                  const planFeasible = newSurplus >= savingsSuggestion.monthly;

                  return (
                    <div style={{
                      background: theme.surface,
                      borderRadius: 8, padding: 28, marginTop: 20,
                      boxShadow: "0 1px 3px rgba(27,28,26,0.06)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <h3 style={{ fontSize: 20, fontWeight: 400, fontFamily: fontHeadline, margin: 0, color: theme.text }}>Where can you cut back?</h3>
                        {selectedCount > 0 && (
                          <span style={{
                            fontSize: 12, padding: "4px 12px", borderRadius: 4, fontFamily: fontMono,
                            background: planFeasible ? theme.greenSoft : theme.yellowSoft,
                            color: planFeasible ? theme.green : theme.primary, fontWeight: 600,
                          }}>
                            {planFeasible ? "Goal achievable!" : `Saving ${fmt(totalCutPerMonth)}/mo so far`}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: theme.textSubtle, margin: "0 0 20px", lineHeight: 1.6 }}>
                        Pick 2–3 categories you're willing to reduce. Adjust the slider to set how much you can cut from each.
                      </p>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                        {cuttable.map((c, i) => {
                          const monthlyAvg = c.value / numMonths;
                          const sel = cutSelections[c.name] || { selected: false, percent: 25 };
                          const saving = monthlyAvg * sel.percent / 100;

                          return (
                            <div key={c.name} style={{
                              background: sel.selected ? theme.greenSoft : theme.surfaceContainerLow,
                              borderLeft: `3px solid ${sel.selected ? theme.green : theme.outlineVariant || "#bfc9c0"}`,
                              borderRadius: 4, padding: "12px 16px",
                              transition: "all 0.2s",
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                {/* Checkbox */}
                                <div
                                  onClick={() => {
                                    setCutSelections(prev => ({
                                      ...prev,
                                      [c.name]: { ...sel, selected: !sel.selected, percent: sel.percent || 25 }
                                    }));
                                    setShowPlan(false);
                                  }}
                                  style={{
                                    width: 20, height: 20, borderRadius: 4, flexShrink: 0, cursor: "pointer",
                                    border: `2px solid ${sel.selected ? theme.green : theme.outlineVariant || "#bfc9c0"}`,
                                    background: sel.selected ? theme.green : "transparent",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    transition: "all 0.2s",
                                  }}
                                >
                                  {sel.selected && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{c.name}</span>
                                    <span style={{ fontSize: 13, fontFamily: fontMono, color: theme.textSubtle, fontFeatureSettings: '"tnum"' }}>
                                      {fmt(monthlyAvg)}<span style={{ fontSize: 11 }}>/mo</span>
                                    </span>
                                  </div>

                                  {sel.selected && (
                                    <div style={{ marginTop: 10 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <span style={{ fontSize: 11, color: theme.textSubtle, minWidth: 30, fontFamily: fontMono }}>Cut</span>
                                        <input
                                          type="range" min="10" max="80" step="5"
                                          value={sel.percent}
                                          onChange={e => {
                                            setCutSelections(prev => ({
                                              ...prev,
                                              [c.name]: { ...sel, percent: parseInt(e.target.value) }
                                            }));
                                            setShowPlan(false);
                                          }}
                                          style={{ flex: 1, accentColor: theme.green, cursor: "pointer" }}
                                        />
                                        <span style={{
                                          fontSize: 14, fontWeight: 700, color: theme.green,
                                          fontFamily: fontMono, minWidth: 40, textAlign: "right",
                                        }}>{sel.percent}%</span>
                                      </div>
                                      <div style={{ fontSize: 13, color: theme.green, marginTop: 6, fontWeight: 500 }}>
                                        Save {fmt(saving)}/mo → keep {fmt(monthlyAvg - saving)}/mo for {c.name.toLowerCase()}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Summary + Generate Plan */}
                      {selectedCount > 0 && (
                        <div>
                          <div style={{
                            background: theme.surfaceContainerLow, borderRadius: 6, padding: "16px 20px",
                            marginBottom: 16,
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                              <span style={{ fontSize: 13, color: theme.textSubtle }}>Monthly savings from cuts</span>
                              <span style={{ fontSize: 15, fontWeight: 600, fontFamily: fontMono, color: theme.green, fontFeatureSettings: '"tnum"' }}>+{fmt(totalCutPerMonth)}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                              <span style={{ fontSize: 13, color: theme.textSubtle }}>New monthly expense</span>
                              <span style={{ fontSize: 13, fontFamily: fontMono, color: theme.text, fontFeatureSettings: '"tnum"' }}>{fmt(newMonthlyExpense)}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                              <span style={{ fontSize: 13, color: theme.textSubtle }}>New monthly surplus</span>
                              <span style={{ fontSize: 13, fontFamily: fontMono, color: newSurplus >= savingsSuggestion.monthly ? theme.green : theme.primary, fontFeatureSettings: '"tnum"' }}>
                                {newSurplus >= 0 ? "+" : ""}{fmt(newSurplus)}
                              </span>
                            </div>
                            <div style={{
                              height: 3, borderRadius: 2, background: theme.surfaceContainer, marginTop: 12, overflow: "hidden",
                            }}>
                              <div style={{
                                height: "100%", borderRadius: 2, transition: "width 0.4s ease",
                                width: `${Math.min(100, (newSurplus / savingsSuggestion.monthly) * 100)}%`,
                                background: planFeasible ? theme.green : theme.primary,
                              }} />
                            </div>
                            <div style={{ fontSize: 11, color: theme.textSubtle, marginTop: 6, textAlign: "right", fontFamily: fontMono }}>
                              {planFeasible
                                ? `Surplus covers your ${fmt(savingsSuggestion.monthly)}/mo target`
                                : `Need ${fmt(savingsSuggestion.monthly - Math.max(0, newSurplus))} more/mo`
                              }
                            </div>
                          </div>

                          <button onClick={() => setShowPlan(true)} style={{
                            width: "100%", padding: "12px 20px", borderRadius: 6,
                            background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryContainer} 100%)`,
                            border: "none", color: "#fff",
                            fontSize: 14, fontWeight: 600, fontFamily: font, cursor: "pointer",
                            transition: "opacity 0.2s",
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
                          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                          >
                            Generate My Savings Plan
                          </button>
                        </div>
                      )}

                      {/* Generated Plan */}
                      {showPlan && selectedCount > 0 && (() => {
                        const selectedCats = cuttable.filter(c => cutSelections[c.name]?.selected);
                        const tips = {
                          "Groceries": ["Try meal prepping on Sundays to reduce impulse buys", "Switch to store-brand items for staples", "Use a grocery list and stick to it — avoid shopping hungry"],
                          "Dining": ["Cook at home 2 extra nights a week", "Limit food delivery to once a week as a treat", "Bring lunch to work — saves ~$10-15/day"],
                          "Transport": ["Combine errands into fewer trips", "Use public transit or carpool 2-3 days/week", "Walk or bike for trips under 2 miles"],
                          "Subscriptions": ["Audit and cancel unused subscriptions", "Share family plans with friends or roommates", "Rotate streaming services monthly instead of paying for all"],
                          "Utilities": ["Switch to LED bulbs and smart power strips", "Adjust thermostat by 2°F — saves ~5-10% on bills", "Use off-peak hours for laundry and dishwasher"],
                          "Shopping": ["Implement a 48-hour rule before non-essential purchases", "Unsubscribe from store marketing emails", "Set a monthly 'fun money' budget and stick to it"],
                          "Health": ["Ask your doctor about generic medication alternatives", "Use in-network providers and preventive care", "Compare pharmacy prices — they vary widely"],
                          "Entertainment": ["Look for free local events and activities", "Host game nights instead of going out", "Use your library for books, movies, and more"],
                          "Other": ["Review each 'Other' expense — some might be unnecessary", "Set up automatic transfers to savings on payday", "Track daily spending for a week to find hidden leaks"],
                        };

                        return (
                          <div style={{
                            marginTop: 20, background: theme.surfaceContainerLow, borderRadius: 6,
                            overflow: "hidden",
                          }}>
                            <div style={{
                              padding: "16px 20px", borderBottom: `1px solid ${theme.surfaceContainer}`,
                              background: planFeasible ? theme.greenSoft : theme.yellowSoft,
                            }}>
                              <div style={{ fontSize: 15, fontWeight: 600, fontFamily: fontHeadline, color: theme.text, marginBottom: 4 }}>
                                {planFeasible ? "Your plan is on track" : "Your Action Plan"}
                              </div>
                              <div style={{ fontSize: 13, color: theme.textSubtle }}>
                                {planFeasible
                                  ? `By cutting ${fmt(totalCutPerMonth)}/mo across ${selectedCount} categories, you'll save ${fmt(savingsSuggestion.target)} in ${savingsSuggestion.monthsLeft} months with ${fmt(newSurplus - savingsSuggestion.monthly)}/mo to spare.`
                                  : `These cuts save ${fmt(totalCutPerMonth)}/mo. You'll need to find ${fmt(savingsSuggestion.monthly - Math.max(0, newSurplus))} more or adjust your timeline.`
                                }
                              </div>
                            </div>

                            {selectedCats.map((c, idx) => {
                              const sel = cutSelections[c.name];
                              const monthlyAvg = c.value / numMonths;
                              const saving = monthlyAvg * sel.percent / 100;
                              const catTips = tips[c.name] || tips["Other"];

                              return (
                                <div key={c.name} style={{
                                  padding: "16px 20px",
                                  borderBottom: idx < selectedCats.length - 1 ? `1px solid ${theme.surfaceContainer}` : "none",
                                }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                    <div>
                                      <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{c.name}</span>
                                      <span style={{ fontSize: 12, color: theme.textSubtle, marginLeft: 8, fontFamily: fontMono }}>
                                        {fmt(monthlyAvg)}/mo → {fmt(monthlyAvg - saving)}/mo
                                      </span>
                                    </div>
                                    <span style={{
                                      fontSize: 13, fontWeight: 600, fontFamily: fontMono,
                                      color: theme.green, background: theme.greenSoft,
                                      padding: "3px 8px", borderRadius: 4, fontFeatureSettings: '"tnum"',
                                    }}>-{fmt(saving)}/mo</span>
                                  </div>
                                  <div style={{ fontSize: 13, color: theme.textSubtle, lineHeight: 1.7 }}>
                                    <div style={{ fontWeight: 600, color: theme.text, fontSize: 10, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: fontMono }}>How to do it:</div>
                                    {catTips.map((tip, ti) => (
                                      <div key={ti} style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                                        <span style={{ color: theme.primary, flexShrink: 0, fontWeight: 700 }}>→</span>
                                        <span>{tip}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Weekly breakdown */}
                            <div style={{
                              padding: "16px 20px", borderTop: `1px solid ${theme.surfaceContainer}`,
                              background: theme.surface,
                            }}>
                              <div style={{ fontSize: 10, color: theme.textSubtle, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontFamily: fontMono, fontWeight: 600 }}>
                                Your new weekly budget
                              </div>
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                {selectedCats.map(c => {
                                  const sel = cutSelections[c.name];
                                  const monthlyAvg = c.value / numMonths;
                                  const newMonthly = monthlyAvg * (1 - sel.percent / 100);
                                  const weekly = newMonthly / 4.33;
                                  return (
                                    <div key={c.name} style={{
                                      flex: "1 1 120px", background: theme.surfaceContainerLow, borderRadius: 4,
                                      padding: "12px 14px",
                                      textAlign: "center",
                                    }}>
                                      <div style={{ fontSize: 11, color: theme.textSubtle, marginBottom: 4, fontFamily: fontMono }}>{c.name}</div>
                                      <div style={{ fontSize: 17, fontWeight: 600, fontFamily: fontMono, color: theme.text, fontFeatureSettings: '"tnum"' }}>
                                        {fmt(weekly)}<span style={{ fontSize: 10, color: theme.textSubtle }}>/wk</span>
                                      </div>
                                    </div>
                                  );
                                })}
                                <div style={{
                                  flex: "1 1 120px", background: theme.greenSoft, borderRadius: 4,
                                  padding: "12px 14px",
                                  textAlign: "center",
                                }}>
                                  <div style={{ fontSize: 11, color: theme.green, marginBottom: 4, fontFamily: fontMono }}>To Savings</div>
                                  <div style={{ fontSize: 17, fontWeight: 600, fontFamily: fontMono, color: theme.green, fontFeatureSettings: '"tnum"' }}>
                                    {fmt(savingsSuggestion.monthly / 4.33)}<span style={{ fontSize: 10, opacity: 0.7 }}>/wk</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* Projection chart */}
                {(() => {
                  const numMonths2 = Math.max(1, monthlyData.length);
                  const totalCut2 = catBreakdown.filter(c => c.name !== "Income" && c.name !== "Housing").reduce((sum, c) => {
                    const sel = cutSelections[c.name];
                    if (!sel?.selected) return sum;
                    return sum + ((c.value / numMonths2) * (sel.percent || 25) / 100);
                  }, 0);
                  const adjustedMonthly = Math.min(savingsSuggestion.monthly, savingsSuggestion.surplus + totalCut2);
                  const effectiveMonthly = Math.max(0, adjustedMonthly);

                  return (
                    <div style={{
                      background: theme.surface,
                      borderRadius: 8, padding: "28px 32px", marginTop: 20,
                      boxShadow: "0 1px 3px rgba(27,28,26,0.06)",
                    }}>
                      <SectionTitle sub="Projected savings over time">Savings Projection</SectionTitle>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={Array.from({ length: savingsSuggestion.monthsLeft + 1 }, (_, i) => ({
                          month: `Mo ${i}`,
                          "With Cuts": Math.round(effectiveMonthly * i),
                          "No Changes": Math.round(Math.max(0, savingsSuggestion.surplus) * i),
                          Goal: savingsSuggestion.target,
                        }))}>
                          <CartesianGrid stroke={theme.surfaceContainerLow} strokeDasharray="0" vertical={false} />
                          <XAxis dataKey="month" tick={{ fill: theme.textSubtle, fontSize: 11, fontFamily: fontMono }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(savingsSuggestion.monthsLeft / 8))} />
                          <YAxis tick={{ fill: theme.textSubtle, fontSize: 11, fontFamily: fontMono }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
                          <Tooltip content={<CustomTooltip />} />
                          <Line type="monotone" dataKey="With Cuts" stroke={theme.green} strokeWidth={2.5} dot={false} />
                          <Line type="monotone" dataKey="No Changes" stroke={theme.outlineVariant || "#bfc9c0"} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                          <Line type="monotone" dataKey="Goal" stroke={theme.accent} strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                          <Legend wrapperStyle={{ fontSize: 11, color: theme.textSubtle, fontFamily: fontMono }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ marginTop: 64, borderTop: `1px solid ${theme.surfaceContainerLow}`, padding: "24px 40px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontFamily: fontHeadline, fontStyle: "italic", fontSize: 15, color: theme.textSubtle, margin: 0 }}>Crafted with intentionality by CashCanvas.</p>
          <p style={{ fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: theme.textSubtle, margin: 0 }}>All data processed locally</p>
        </div>
      </footer>
    </div>
  );
}

// ─── APP ROOT ───
export default function App() {
  const [transactions, setTransactions] = useState(null);
  const [fileName, setFileName] = useState("");
  const [statementType, setStatementType] = useState("unknown");
  const [auth, setAuth] = useState(() => {
    try {
      const stored = localStorage.getItem("cc_auth");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const handleAuth = useCallback((authData) => {
    setAuth(authData);
    if (authData) {
      localStorage.setItem("cc_auth", JSON.stringify(authData));
    } else {
      localStorage.removeItem("cc_auth");
    }
  }, []);

  const handleData = useCallback((txns, name, type = "unknown") => {
    setTransactions(txns);
    setFileName(name);
    setStatementType(type);
  }, []);

  if (!auth) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  if (!transactions) {
    return <UploadScreen onData={handleData} />;
  }

  return (
    <Dashboard
      auth={auth}
      onLogout={() => { handleAuth(null); setTransactions(null); setFileName(""); setStatementType("unknown"); }}
      transactions={transactions}
      fileName={fileName}
      statementType={statementType}
      onReset={() => { setTransactions(null); setFileName(""); setStatementType("unknown"); }}
    />
  );
}
