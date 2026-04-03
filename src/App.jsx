import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import * as Papa from "papaparse";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";
import _ from "lodash";

// ─── CATEGORY ENGINE ───
const DEFAULT_CATEGORIES = {
  "Housing": ["rent", "mortgage", "property", "hoa", "landlord"],
  "Groceries": ["grocery", "whole foods", "trader joe", "safeway", "kroger", "walmart", "costco", "aldi", "target", "publix"],
  "Dining": ["restaurant", "mcdonald", "starbucks", "uber eats", "doordash", "grubhub", "pizza", "chipotle", "wendys", "dunkin", "cafe", "diner", "burger"],
  "Transport": ["uber", "lyft", "gas", "fuel", "shell", "chevron", "parking", "transit", "metro", "toll"],
  "Subscriptions": ["netflix", "spotify", "hulu", "amazon prime", "disney", "apple", "youtube", "hbo", "gym", "membership"],
  "Utilities": ["electric", "water", "internet", "comcast", "verizon", "at&t", "t-mobile", "phone", "gas bill", "power"],
  "Shopping": ["amazon", "ebay", "etsy", "best buy", "nordstrom", "zara", "h&m", "nike", "adidas", "mall"],
  "Health": ["pharmacy", "cvs", "walgreens", "doctor", "hospital", "dental", "medical", "insurance", "copay"],
  "Entertainment": ["movie", "theater", "concert", "ticket", "gaming", "steam", "playstation", "xbox"],
  "Income": ["payroll", "direct dep", "salary", "wage", "deposit", "transfer in", "refund", "cashback"],
  "Other": []
};

const PALETTE = ["#E8453C","#F4A623","#2EC4B6","#5B5EA6","#9B5DE5","#F15BB5","#00BBF9","#00F5D4","#FEE440","#FF6B6B","#4ECDC4","#45B7D1"];

function categorize(desc, customCats) {
  const d = (desc || "").toLowerCase();
  const cats = { ...DEFAULT_CATEGORIES, ...customCats };
  for (const [cat, keywords] of Object.entries(cats)) {
    if (cat === "Other") continue;
    for (const kw of keywords) {
      if (d.includes(kw.toLowerCase())) return cat;
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
const font = `'DM Sans', 'Satoshi', system-ui, sans-serif`;
const fontMono = `'JetBrains Mono', 'Fira Code', monospace`;

const theme = {
  bg: "#0B0F1A",
  surface: "#131829",
  surfaceHover: "#1A2035",
  border: "#1E2642",
  text: "#E8ECF4",
  textMuted: "#7B8AB8",
  accent: "#E8453C",
  accentSoft: "rgba(232,69,60,0.12)",
  green: "#2EC4B6",
  greenSoft: "rgba(46,196,182,0.12)",
  yellow: "#F4A623",
  yellowSoft: "rgba(244,166,35,0.12)",
};

// ─── COMPONENTS ───

function StatCard({ label, value, sub, color = theme.accent, icon }) {
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 16, padding: "24px 28px", flex: "1 1 200px", minWidth: 200,
      position: "relative", overflow: "hidden",
      transition: "border-color 0.2s",
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = color}
    onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}
    >
      <div style={{
        position: "absolute", top: -20, right: -20, width: 80, height: 80,
        borderRadius: "50%", background: color, opacity: 0.06
      }} />
      <div style={{ fontSize: 13, color: theme.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color, marginTop: 8, fontFamily: fontMono }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, background: theme.surface, borderRadius: 12, padding: 4, border: `1px solid ${theme.border}` }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          padding: "10px 20px", border: "none", borderRadius: 8, cursor: "pointer",
          fontFamily: font, fontSize: 14, fontWeight: 600, letterSpacing: "0.02em",
          background: active === t ? theme.accent : "transparent",
          color: active === t ? "#fff" : theme.textMuted,
          transition: "all 0.2s",
        }}>{t}</button>
      ))}
    </div>
  );
}

function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: theme.text, margin: 0 }}>{children}</h2>
      {sub && <p style={{ fontSize: 14, color: theme.textMuted, margin: "4px 0 0" }}>{sub}</p>}
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
async function strategyAI(file) {
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
              text: `Extract ALL transactions from this bank statement. Return ONLY a JSON array, no markdown, no backticks, no explanation. Each object must have:
- "date": string in "YYYY-MM-DD" format
- "desc": merchant/description string
- "amount": number (negative for expenses/debits, positive for income/credits/deposits)

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

  onProgress(`Found ${bestTxns.length} transactions via text extraction...`);

  // If text-based extraction found enough, use it
  if (bestTxns.length >= 3) {
    bestTxns.sort((a, b) => b.date - a.date);
    return bestTxns;
  }

  // Fallback: use Claude AI to read the PDF directly
  onProgress("Using AI to read the statement...");
  const aiTxns = await strategyAI(file);
  if (aiTxns.length > bestTxns.length) {
    aiTxns.sort((a, b) => b.date - a.date);
    return aiTxns;
  }

  bestTxns.sort((a, b) => b.date - a.date);
  return bestTxns;
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
            onData(transactions, file.name);
          } catch (e) {
            setError(e.message);
          }
          setLoading(false);
        },
        error: () => { setError("Failed to parse CSV"); setLoading(false); }
      });
    } else if (ext === "pdf") {
      setLoadingMsg("Reading PDF...");
      parsePDF(file, (msg) => setLoadingMsg(msg)).then(transactions => {
        if (transactions.length === 0) {
          setError("No transactions found in PDF. This can happen with scanned/image-based PDFs. Try exporting a CSV from your bank's website instead.");
          setLoading(false);
          setLoadingMsg("");
          return;
        }
        onData(transactions, file.name);
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

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", background: theme.bg, fontFamily: font, color: theme.text,
      padding: 32,
    }}>
      <div style={{ textAlign: "center", maxWidth: 600, width: "100%" }}>
        <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          <span style={{ color: theme.accent }}>Cash</span>Canvas
        </div>
        <p style={{ color: theme.textMuted, fontSize: 17, margin: "12px 0 40px", lineHeight: 1.6 }}>
          Upload your bank statement to visualize spending patterns, track expenses, and reach your savings goals.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? theme.accent : theme.border}`,
            borderRadius: 20, padding: "60px 40px", cursor: "pointer",
            background: dragging ? theme.accentSoft : theme.surface,
            transition: "all 0.3s",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>
            {loading ? (loadingMsg || "Parsing your statement...") : "Drop your bank statement here"}
          </div>
          <div style={{ fontSize: 14, color: theme.textMuted }}>
            Supports CSV and PDF files · All data stays in your browser
          </div>
          <input ref={inputRef} type="file" accept=".csv,.tsv,.pdf" style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])} />
        </div>

        {error && (
          <div style={{
            marginTop: 20, padding: "14px 20px", background: theme.accentSoft,
            border: `1px solid ${theme.accent}`, borderRadius: 12, color: theme.accent,
            fontSize: 14, textAlign: "left"
          }}>{error}</div>
        )}

        <div style={{ marginTop: 48, display: "flex", gap: 32, justifyContent: "center", flexWrap: "wrap" }}>
          {["🔒 Private", "📈 Visual insights", "🎯 Savings goals"].map(t => (
            <div key={t} style={{ fontSize: 14, color: theme.textMuted, fontWeight: 500 }}>{t}</div>
          ))}
        </div>

        <button onClick={() => {
          const sample = generateSampleData();
          onData(sample, "sample_data.csv");
        }} style={{
          marginTop: 32, padding: "12px 28px", background: "transparent",
          border: `1px solid ${theme.border}`, borderRadius: 10, color: theme.textMuted,
          cursor: "pointer", fontFamily: font, fontSize: 14, fontWeight: 500,
          transition: "all 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = theme.accent; e.currentTarget.style.color = theme.text; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.textMuted; }}
        >
          Try with sample data
        </button>
      </div>
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
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 10, padding: "10px 14px", fontSize: 13, fontFamily: font,
    }}>
      <div style={{ color: theme.textMuted, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || theme.text, fontWeight: 600 }}>
          {p.name}: ${Math.abs(p.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ))}
    </div>
  );
}

// ─── DASHBOARD ───
function Dashboard({ transactions: rawTxns, fileName, onReset }) {
  const [tab, setTab] = useState("Overview");
  const [customCats, setCustomCats] = useState({});
  const [savingsGoal, setSavingsGoal] = useState({ amount: "", deadline: "", name: "" });
  const [editingCat, setEditingCat] = useState(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [reassignTxn, setReassignTxn] = useState(null);
  const [txnOverrides, setTxnOverrides] = useState({});
  const [newCatName, setNewCatName] = useState("");
  const [selectedTxns, setSelectedTxns] = useState(new Set());
  const [cutSelections, setCutSelections] = useState({});  // { categoryName: { selected: bool, percent: number } }
  const [showPlan, setShowPlan] = useState(false);

  const transactions = useMemo(() => {
    return rawTxns.map((t, i) => ({
      ...t,
      id: i,
      category: txnOverrides[i] || categorize(t.desc, customCats),
    }));
  }, [rawTxns, customCats, txnOverrides]);

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
      <div style={{
        padding: "16px 32px", borderBottom: `1px solid ${theme.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: theme.surface, position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
            <span style={{ color: theme.accent }}>Cash</span>Canvas
          </span>
          <span style={{ fontSize: 13, color: theme.textMuted, background: theme.bg, padding: "4px 10px", borderRadius: 6 }}>
            {fileName}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <TabBar tabs={["Overview", "Transactions", "Categories", "Savings"]} active={tab} onChange={setTab} />
          <button onClick={onReset} style={{
            padding: "10px 18px", background: "transparent", border: `1px solid ${theme.border}`,
            borderRadius: 8, color: theme.textMuted, cursor: "pointer", fontFamily: font, fontSize: 13,
          }}>New Upload</button>
        </div>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 1280, margin: "0 auto" }}>
        {/* ─── OVERVIEW TAB ─── */}
        {tab === "Overview" && (
          <div>
            {/* Stats Row */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
              <StatCard label="Total Income" value={fmt(totalIncome)} color={theme.green} sub={`${income.length} transactions`} />
              <StatCard label="Total Expenses" value={fmt(totalExpenses)} color={theme.accent} sub={`${expenses.length} transactions`} />
              <StatCard label="Net Cashflow" value={(netCashflow >= 0 ? "+" : "-") + fmt(netCashflow)} color={netCashflow >= 0 ? theme.green : theme.accent} sub={netCashflow >= 0 ? "Surplus" : "Deficit"} />
              <StatCard label="Transactions" value={transactions.length} color={theme.yellow} sub={`${monthlyData.length} months`} />
            </div>

            {/* Charts Row */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 28 }}>
              {/* Spending by Category Pie */}
              <div style={{
                flex: "1 1 380px", background: theme.surface, border: `1px solid ${theme.border}`,
                borderRadius: 16, padding: 24, minWidth: 340,
              }}>
                <SectionTitle sub="Where your money goes">Spending by Category</SectionTitle>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <ResponsiveContainer width="50%" height={240}>
                    <PieChart>
                      <Pie data={catBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2} strokeWidth={0}>
                        {catBreakdown.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1, fontSize: 13 }}>
                    {catBreakdown.slice(0, 7).map((c, i) => (
                      <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                        <span style={{ color: theme.textMuted, flex: 1 }}>{c.name}</span>
                        <span style={{ fontFamily: fontMono, fontWeight: 600 }}>{fmt(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Monthly Trend Bar */}
              <div style={{
                flex: "1 1 480px", background: theme.surface, border: `1px solid ${theme.border}`,
                borderRadius: 16, padding: 24, minWidth: 400,
              }}>
                <SectionTitle sub="Income vs expenses over time">Monthly Trends</SectionTitle>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyData} barGap={4}>
                    <CartesianGrid stroke={theme.border} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: theme.textMuted, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: theme.textMuted, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="Income" fill={theme.green} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" fill={theme.accent} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Net Cashflow Line */}
            <div style={{
              background: theme.surface, border: `1px solid ${theme.border}`,
              borderRadius: 16, padding: 24, marginBottom: 28,
            }}>
              <SectionTitle sub="Monthly net savings trajectory">Net Cashflow Trend</SectionTitle>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyData}>
                  <CartesianGrid stroke={theme.border} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: theme.textMuted, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: theme.textMuted, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toLocaleString()}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="Net" stroke={theme.yellow} strokeWidth={3} dot={{ r: 5, fill: theme.yellow }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Recurring + Top Merchants */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{
                flex: "1 1 400px", background: theme.surface, border: `1px solid ${theme.border}`,
                borderRadius: 16, padding: 24,
              }}>
                <SectionTitle sub="Regular charges detected">Recurring Payments</SectionTitle>
                {recurring.length === 0 ? (
                  <div style={{ color: theme.textMuted, fontSize: 14 }}>No recurring payments detected</div>
                ) : (
                  <div style={{ maxHeight: 300, overflowY: "auto" }}>
                    {recurring.slice(0, 8).map(r => (
                      <div key={r.desc} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 0", borderBottom: `1px solid ${theme.border}`,
                      }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{r.desc}</div>
                          <div style={{ fontSize: 12, color: theme.textMuted }}>
                            {r.count}x · {r.category} {r.isFixed && <span style={{ color: theme.green }}>· Fixed</span>}
                          </div>
                        </div>
                        <div style={{ fontFamily: fontMono, fontWeight: 600, color: theme.accent }}>
                          ~{fmt(r.avg)}<span style={{ color: theme.textMuted, fontSize: 11 }}>/mo</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{
                flex: "1 1 400px", background: theme.surface, border: `1px solid ${theme.border}`,
                borderRadius: 16, padding: 24,
              }}>
                <SectionTitle sub="Highest total spend">Top Merchants</SectionTitle>
                {topMerchants.map((m, i) => (
                  <div key={m.desc} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 0", borderBottom: `1px solid ${theme.border}`,
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                      background: PALETTE[i % PALETTE.length] + "22", color: PALETTE[i % PALETTE.length],
                      fontSize: 13, fontWeight: 700, flexShrink: 0,
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.desc}</div>
                      <div style={{ fontSize: 12, color: theme.textMuted }}>{m.count} transactions · {m.category}</div>
                    </div>
                    <div style={{ fontFamily: fontMono, fontWeight: 600, color: theme.accent }}>{fmt(m.total)}</div>
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
                padding: "10px 16px", background: theme.accentSoft, borderRadius: 10,
                border: `1px solid ${theme.accent}`,
              }}>
                <span style={{ fontSize: 14, color: theme.accent, fontWeight: 600 }}>{selectedTxns.size} selected</span>
                <button onClick={() => setReassignTxn(true)} style={{
                  padding: "6px 14px", background: theme.accent, border: "none",
                  borderRadius: 7, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  fontFamily: "inherit",
                }}>Reassign Category</button>
                <button onClick={() => setSelectedTxns(new Set())} style={{
                  padding: "6px 14px", background: "none", border: `1px solid ${theme.accent}`,
                  borderRadius: 7, color: theme.accent, cursor: "pointer", fontSize: 13, fontWeight: 600,
                  fontFamily: "inherit",
                }}>Clear</button>
              </div>
            )}

            <div style={{
              background: theme.surface, border: `1px solid ${theme.border}`,
              borderRadius: 16, overflow: "hidden",
            }}>
              <div style={{
                display: "grid", gridTemplateColumns: "40px 120px 1fr 140px 140px",
                padding: "14px 20px", borderBottom: `1px solid ${theme.border}`,
                fontSize: 12, fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em",
                alignItems: "center",
              }}>
                <div>
                  <input type="checkbox"
                    checked={selectedTxns.size === transactions.length && transactions.length > 0}
                    onChange={e => setSelectedTxns(e.target.checked ? new Set(transactions.map(t => t.id)) : new Set())}
                    style={{ cursor: "pointer", accentColor: "var(--accent, #6366f1)" }}
                  />
                </div>
                <div>Date</div><div>Description</div><div>Category</div><div style={{ textAlign: "right" }}>Amount</div>
              </div>
              <div style={{ maxHeight: 600, overflowY: "auto" }}>
                {transactions.map(t => (
                  <div key={t.id} style={{
                    display: "grid", gridTemplateColumns: "40px 120px 1fr 140px 140px",
                    padding: "12px 20px", borderBottom: `1px solid ${theme.border}`,
                    fontSize: 14, alignItems: "center",
                    transition: "background 0.15s",
                    background: selectedTxns.has(t.id) ? theme.accentSoft : "transparent",
                  }}
                  onMouseEnter={e => { if (!selectedTxns.has(t.id)) e.currentTarget.style.background = theme.surfaceHover; }}
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
                        style={{ cursor: "pointer", accentColor: "var(--accent, #6366f1)" }}
                      />
                    </div>
                    <div style={{ color: theme.textMuted, fontSize: 13 }}>
                      {t.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                    </div>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>{t.desc}</div>
                    <div>
                      <span style={{
                        fontSize: 12, padding: "3px 10px", borderRadius: 6,
                        background: theme.bg, color: theme.textMuted, fontWeight: 500,
                      }}>{t.category}</span>
                    </div>
                    <div style={{
                      textAlign: "right", fontFamily: fontMono, fontWeight: 600,
                      color: t.amount >= 0 ? theme.green : theme.text,
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
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
              }} onClick={() => { setReassignTxn(null); setNewCatName(""); }}>
                <div style={{
                  background: theme.surface, border: `1px solid ${theme.border}`,
                  borderRadius: 16, padding: 28, width: 360, maxHeight: "80vh", overflowY: "auto",
                }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>Reassign Category</h3>
                  <p style={{ fontSize: 14, color: theme.textMuted, margin: "0 0 16px" }}>
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
                        setSelectedTxns(new Set());
                        setReassignTxn(null);
                        setNewCatName("");
                      }} style={{
                        padding: "10px 16px", background: theme.bg,
                        border: `1px solid ${theme.border}`,
                        borderRadius: 8, color: theme.text, cursor: "pointer", textAlign: "left",
                        fontFamily: font, fontSize: 14,
                      }}>{cat}</button>
                    ))}
                    {/* Create new category */}
                    <div style={{ marginTop: 8, borderTop: `1px solid ${theme.border}`, paddingTop: 12 }}>
                      <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Create new category</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          value={newCatName}
                          onChange={e => setNewCatName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && newCatName.trim()) {
                              const name = newCatName.trim();
                              setCustomCats(prev => ({ ...prev, [name]: prev[name] || [] }));
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
                            flex: 1, padding: "10px 14px", background: theme.bg,
                            border: `1px solid ${theme.border}`, borderRadius: 8,
                            color: theme.text, fontFamily: font, fontSize: 14, outline: "none",
                          }}
                        />
                        <button onClick={() => {
                          if (!newCatName.trim()) return;
                          const name = newCatName.trim();
                          setCustomCats(prev => ({ ...prev, [name]: prev[name] || [] }));
                          setTxnOverrides(prev => {
                            const next = { ...prev };
                            selectedTxns.forEach(id => { next[id] = name; });
                            return next;
                          });
                          setSelectedTxns(new Set());
                          setReassignTxn(null);
                          setNewCatName("");
                        }} style={{
                          padding: "10px 16px", background: newCatName.trim() ? theme.accent : theme.bg,
                          border: `1px solid ${newCatName.trim() ? theme.accent : theme.border}`,
                          borderRadius: 8, color: newCatName.trim() ? "#fff" : theme.textMuted,
                          cursor: newCatName.trim() ? "pointer" : "default",
                          fontFamily: font, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap",
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
        {tab === "Categories" && (
          <div>
            <SectionTitle sub="Customize how transactions are categorized">Manage Categories</SectionTitle>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {allCategories.map((cat, ci) => {
                const keywords = [...(DEFAULT_CATEGORIES[cat] || []), ...(customCats[cat] || [])];
                const isEditing = editingCat === cat;
                const catTxns = expenses.filter(t => t.category === cat);
                const catTotal = Math.abs(_.sumBy(catTxns, "amount"));

                return (
                  <div key={cat} style={{
                    flex: "1 1 280px", maxWidth: 360, background: theme.surface,
                    border: `1px solid ${isEditing ? theme.accent : theme.border}`,
                    borderRadius: 16, padding: 20, transition: "border-color 0.2s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 12, height: 12, borderRadius: 4,
                          background: PALETTE[ci % PALETTE.length],
                        }} />
                        <span style={{ fontSize: 16, fontWeight: 700 }}>{cat}</span>
                      </div>
                      <span style={{ fontFamily: fontMono, fontSize: 14, color: theme.textMuted }}>
                        {fmt(catTotal)} · {catTxns.length}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                      {keywords.map(kw => (
                        <span key={kw} style={{
                          fontSize: 12, padding: "4px 10px", borderRadius: 6,
                          background: theme.bg, color: theme.textMuted, border: `1px solid ${theme.border}`,
                          display: "flex", alignItems: "center", gap: 6,
                        }}>
                          {kw}
                          {(customCats[cat] || []).includes(kw) && (
                            <button onClick={() => {
                              setCustomCats(prev => ({
                                ...prev,
                                [cat]: (prev[cat] || []).filter(k => k !== kw)
                              }));
                            }} style={{
                              background: "none", border: "none", color: theme.accent,
                              cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1,
                            }}>×</button>
                          )}
                        </span>
                      ))}
                    </div>

                    {isEditing ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          value={newKeyword}
                          onChange={e => setNewKeyword(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && newKeyword.trim()) {
                              setCustomCats(prev => ({
                                ...prev,
                                [cat]: [...(prev[cat] || []), newKeyword.trim().toLowerCase()]
                              }));
                              setNewKeyword("");
                            }
                          }}
                          placeholder="Add keyword..."
                          style={{
                            flex: 1, padding: "8px 12px", background: theme.bg,
                            border: `1px solid ${theme.border}`, borderRadius: 8,
                            color: theme.text, fontFamily: font, fontSize: 13, outline: "none",
                          }}
                        />
                        <button onClick={() => { setEditingCat(null); setNewKeyword(""); }} style={{
                          padding: "8px 14px", background: theme.accent, border: "none",
                          borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 13, fontFamily: font,
                        }}>Done</button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingCat(cat)} style={{
                        width: "100%", padding: "8px", background: "transparent",
                        border: `1px dashed ${theme.border}`, borderRadius: 8,
                        color: theme.textMuted, cursor: "pointer", fontSize: 13, fontFamily: font,
                      }}>+ Add keywords</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── SAVINGS TAB ─── */}
        {tab === "Savings" && (
          <div>
            <SectionTitle sub="Set a goal and get personalized suggestions">Savings Goals</SectionTitle>

            <div style={{
              background: theme.surface, border: `1px solid ${theme.border}`,
              borderRadius: 16, padding: 28, marginBottom: 24, maxWidth: 560,
            }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 20px" }}>Set Your Goal</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, color: theme.textMuted, display: "block", marginBottom: 6 }}>Goal Name</label>
                  <input value={savingsGoal.name} onChange={e => setSavingsGoal(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Emergency fund, Vacation, New car"
                    style={{
                      width: "100%", padding: "12px 16px", background: theme.bg,
                      border: `1px solid ${theme.border}`, borderRadius: 10,
                      color: theme.text, fontFamily: font, fontSize: 15, outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 13, color: theme.textMuted, display: "block", marginBottom: 6 }}>Target Amount ($)</label>
                    <input value={savingsGoal.amount} onChange={e => setSavingsGoal(p => ({ ...p, amount: e.target.value }))}
                      type="number" placeholder="5000"
                      style={{
                        width: "100%", padding: "12px 16px", background: theme.bg,
                        border: `1px solid ${theme.border}`, borderRadius: 10,
                        color: theme.text, fontFamily: font, fontSize: 15, outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 13, color: theme.textMuted, display: "block", marginBottom: 6 }}>Target Date</label>
                    <input value={savingsGoal.deadline} onChange={e => setSavingsGoal(p => ({ ...p, deadline: e.target.value }))}
                      type="date"
                      style={{
                        width: "100%", padding: "12px 16px", background: theme.bg,
                        border: `1px solid ${theme.border}`, borderRadius: 10,
                        color: theme.text, fontFamily: font, fontSize: 15, outline: "none",
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
                    color={theme.yellow}
                    sub={`${savingsSuggestion.monthsLeft} months to go`}
                  />
                  <StatCard
                    label="Avg Monthly Surplus"
                    value={(savingsSuggestion.surplus >= 0 ? "+" : "-") + fmt(savingsSuggestion.surplus)}
                    color={savingsSuggestion.surplus >= 0 ? theme.green : theme.accent}
                    sub="Income minus expenses"
                  />
                  <StatCard
                    label="Feasibility"
                    value={savingsSuggestion.feasible ? "On Track ✓" : "Needs Adjustment"}
                    color={savingsSuggestion.feasible ? theme.green : theme.accent}
                    sub={savingsSuggestion.feasible ? "Current spending supports this goal" : "You may need to reduce spending"}
                  />
                </div>

                <div style={{
                  background: theme.surface, border: `1px solid ${theme.border}`,
                  borderRadius: 16, padding: 28,
                }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 16px" }}>
                    {savingsSuggestion.goalName ? `Plan: ${savingsSuggestion.goalName}` : "Savings Plan"}
                  </h3>
                  <div style={{ fontSize: 15, lineHeight: 1.8, color: theme.textMuted }}>
                    <p style={{ margin: "0 0 12px" }}>
                      To save <strong style={{ color: theme.text }}>{fmt(savingsSuggestion.target)}</strong> in{" "}
                      <strong style={{ color: theme.text }}>{savingsSuggestion.monthsLeft} months</strong>, you need to set aside{" "}
                      <strong style={{ color: theme.yellow }}>{fmt(savingsSuggestion.monthly)}/month</strong>.
                    </p>
                    <p style={{ margin: "0 0 12px" }}>
                      Your average monthly income is <strong style={{ color: theme.green }}>{fmt(savingsSuggestion.avgMonthlyIncome)}</strong> and
                      average expenses are <strong style={{ color: theme.accent }}>{fmt(savingsSuggestion.avgMonthlyExpense)}</strong>.
                    </p>
                    {savingsSuggestion.feasible ? (
                      <p style={{ margin: 0 }}>
                        Your current surplus of <strong style={{ color: theme.green }}>{fmt(savingsSuggestion.surplus)}/month</strong> covers
                        the savings target. Keep your spending under <strong style={{ color: theme.text }}>{fmt(savingsSuggestion.avgMonthlyIncome - savingsSuggestion.monthly)}/month</strong> to stay on track.
                      </p>
                    ) : (
                      <p style={{ margin: 0 }}>
                        You'd need to reduce monthly expenses by about{" "}
                        <strong style={{ color: theme.accent }}>{fmt(savingsSuggestion.monthly - Math.max(0, savingsSuggestion.surplus))}</strong> to meet this goal.
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
                      background: theme.surface, border: `1px solid ${theme.border}`,
                      borderRadius: 16, padding: 28, marginTop: 20,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Where can you cut back?</h3>
                        {selectedCount > 0 && (
                          <span style={{
                            fontSize: 13, padding: "4px 12px", borderRadius: 20,
                            background: planFeasible ? theme.greenSoft : theme.yellowSoft,
                            color: planFeasible ? theme.green : theme.yellow, fontWeight: 600,
                          }}>
                            {planFeasible ? "Goal achievable!" : `Saving ${fmt(totalCutPerMonth)}/mo so far`}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 14, color: theme.textMuted, margin: "0 0 20px", lineHeight: 1.5 }}>
                        Pick 2–3 categories you're willing to reduce. Adjust the slider to set how much you can cut from each.
                      </p>

                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                        {cuttable.map((c, i) => {
                          const monthlyAvg = c.value / numMonths;
                          const sel = cutSelections[c.name] || { selected: false, percent: 25 };
                          const saving = monthlyAvg * sel.percent / 100;

                          return (
                            <div key={c.name} style={{
                              background: sel.selected ? (theme.bg) : theme.bg,
                              border: `1px solid ${sel.selected ? theme.green : theme.border}`,
                              borderRadius: 12, padding: "14px 18px",
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
                                    width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: "pointer",
                                    border: `2px solid ${sel.selected ? theme.green : theme.border}`,
                                    background: sel.selected ? theme.green : "transparent",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    transition: "all 0.2s",
                                  }}
                                >
                                  {sel.selected && <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{c.name}</span>
                                    <span style={{ fontSize: 13, fontFamily: fontMono, color: theme.textMuted }}>
                                      {fmt(monthlyAvg)}<span style={{ fontSize: 11 }}>/mo</span>
                                    </span>
                                  </div>

                                  {sel.selected && (
                                    <div style={{ marginTop: 10 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <span style={{ fontSize: 12, color: theme.textMuted, minWidth: 30 }}>Cut</span>
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
                            background: theme.bg, borderRadius: 12, padding: "18px 20px",
                            border: `1px solid ${theme.border}`, marginBottom: 16,
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                              <span style={{ fontSize: 14, color: theme.textMuted }}>Monthly savings from cuts</span>
                              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: fontMono, color: theme.green }}>+{fmt(totalCutPerMonth)}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                              <span style={{ fontSize: 14, color: theme.textMuted }}>New monthly expense</span>
                              <span style={{ fontSize: 14, fontFamily: fontMono, color: theme.text }}>{fmt(newMonthlyExpense)}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                              <span style={{ fontSize: 14, color: theme.textMuted }}>New monthly surplus</span>
                              <span style={{ fontSize: 14, fontFamily: fontMono, color: newSurplus >= savingsSuggestion.monthly ? theme.green : theme.yellow }}>
                                {newSurplus >= 0 ? "+" : "-"}{fmt(newSurplus)}
                              </span>
                            </div>
                            <div style={{
                              height: 6, borderRadius: 3, background: theme.border, marginTop: 12, overflow: "hidden",
                            }}>
                              <div style={{
                                height: "100%", borderRadius: 3, transition: "width 0.4s ease",
                                width: `${Math.min(100, (newSurplus / savingsSuggestion.monthly) * 100)}%`,
                                background: planFeasible ? theme.green : theme.yellow,
                              }} />
                            </div>
                            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 6, textAlign: "right" }}>
                              {planFeasible
                                ? `Surplus covers your ${fmt(savingsSuggestion.monthly)}/mo target`
                                : `Need ${fmt(savingsSuggestion.monthly - Math.max(0, newSurplus))} more/mo — try cutting more or extending your deadline`
                              }
                            </div>
                          </div>

                          <button onClick={() => setShowPlan(true)} style={{
                            width: "100%", padding: "14px 20px", borderRadius: 10,
                            background: theme.accent, border: "none", color: "#fff",
                            fontSize: 15, fontWeight: 700, fontFamily: font, cursor: "pointer",
                            transition: "opacity 0.2s",
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
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
                            marginTop: 20, background: theme.bg, borderRadius: 14,
                            border: `1px solid ${theme.border}`, overflow: "hidden",
                          }}>
                            <div style={{
                              padding: "18px 22px", borderBottom: `1px solid ${theme.border}`,
                              background: planFeasible ? theme.greenSoft : theme.yellowSoft,
                            }}>
                              <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, marginBottom: 4 }}>
                                {planFeasible ? "🎯 Your plan is on track!" : "📋 Your Action Plan"}
                              </div>
                              <div style={{ fontSize: 14, color: theme.textMuted }}>
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
                                  padding: "18px 22px",
                                  borderBottom: idx < selectedCats.length - 1 ? `1px solid ${theme.border}` : "none",
                                }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                    <div>
                                      <span style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{c.name}</span>
                                      <span style={{ fontSize: 13, color: theme.textMuted, marginLeft: 8 }}>
                                        {fmt(monthlyAvg)}/mo → {fmt(monthlyAvg - saving)}/mo
                                      </span>
                                    </div>
                                    <span style={{
                                      fontSize: 14, fontWeight: 700, fontFamily: fontMono,
                                      color: theme.green, background: theme.greenSoft,
                                      padding: "4px 10px", borderRadius: 6,
                                    }}>-{fmt(saving)}/mo</span>
                                  </div>
                                  <div style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.7 }}>
                                    <div style={{ fontWeight: 600, color: theme.text, fontSize: 13, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>How to do it:</div>
                                    {catTips.map((tip, ti) => (
                                      <div key={ti} style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                                        <span style={{ color: theme.green, flexShrink: 0, fontWeight: 700 }}>→</span>
                                        <span>{tip}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Weekly breakdown */}
                            <div style={{
                              padding: "18px 22px", borderTop: `1px solid ${theme.border}`,
                              background: theme.surface,
                            }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
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
                                      flex: "1 1 120px", background: theme.bg, borderRadius: 10,
                                      padding: "12px 16px", border: `1px solid ${theme.border}`,
                                      textAlign: "center",
                                    }}>
                                      <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>{c.name}</div>
                                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fontMono, color: theme.text }}>
                                        {fmt(weekly)}<span style={{ fontSize: 11, color: theme.textMuted }}>/wk</span>
                                      </div>
                                    </div>
                                  );
                                })}
                                <div style={{
                                  flex: "1 1 120px", background: theme.greenSoft, borderRadius: 10,
                                  padding: "12px 16px", border: `1px solid ${theme.green}33`,
                                  textAlign: "center",
                                }}>
                                  <div style={{ fontSize: 12, color: theme.green, marginBottom: 4 }}>To Savings</div>
                                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fontMono, color: theme.green }}>
                                    {fmt(savingsSuggestion.monthly / 4.33)}<span style={{ fontSize: 11, opacity: 0.7 }}>/wk</span>
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
                      background: theme.surface, border: `1px solid ${theme.border}`,
                      borderRadius: 16, padding: 24, marginTop: 20,
                    }}>
                      <SectionTitle sub="Projected savings over time">Savings Projection</SectionTitle>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={Array.from({ length: savingsSuggestion.monthsLeft + 1 }, (_, i) => ({
                          month: `Mo ${i}`,
                          "With Cuts": Math.round(effectiveMonthly * i),
                          "No Changes": Math.round(Math.max(0, savingsSuggestion.surplus) * i),
                          Goal: savingsSuggestion.target,
                        }))}>
                          <CartesianGrid stroke={theme.border} strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(savingsSuggestion.monthsLeft / 8))} />
                          <YAxis tick={{ fill: theme.textMuted, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
                          <Tooltip content={<CustomTooltip />} />
                          <Line type="monotone" dataKey="With Cuts" stroke={theme.green} strokeWidth={3} dot={false} />
                          <Line type="monotone" dataKey="No Changes" stroke={theme.textMuted} strokeWidth={2} strokeDasharray="4 4" dot={false} />
                          <Line type="monotone" dataKey="Goal" stroke={theme.accent} strokeWidth={2} strokeDasharray="6 3" dot={false} />
                          <Legend wrapperStyle={{ fontSize: 12, color: theme.textMuted }} />
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
      <div style={{
        padding: "20px 32px", borderTop: `1px solid ${theme.border}`,
        textAlign: "center", fontSize: 13, color: theme.textMuted, marginTop: 40,
      }}>
        CashCanvas · All data processed locally in your browser · No data sent to any server
      </div>
    </div>
  );
}

// ─── APP ROOT ───
export default function App() {
  const [transactions, setTransactions] = useState(null);
  const [fileName, setFileName] = useState("");

  const handleData = useCallback((txns, name) => {
    setTransactions(txns);
    setFileName(name);
  }, []);

  if (!transactions) {
    return <UploadScreen onData={handleData} />;
  }

  return (
    <Dashboard
      transactions={transactions}
      fileName={fileName}
      onReset={() => { setTransactions(null); setFileName(""); }}
    />
  );
}
