// PDF bank/credit-card statement parsing — text extraction (pdf.js, CDN-
// loaded), line-clustering, date/amount pattern matching, two heuristic
// extraction strategies, and an AI fallback via the backend proxy
// (/api/parse-pdf). Extracted from App.jsx (Phase 10 final cleanup) — kept
// as one cohesive file rather than the target architecture's full pdf/
// subfolder split (loadPdfJs/lineBuilder/dateAmount/statementType/strategies
// as five separate files): these functions are tightly interdependent
// (shared DATE_PATTERNS/AMT_PATTERNS, strategies calling the same
// line-builder/date-finder helpers), and splitting working, dense regex-
// based parsing logic into five files for organizational purity alone —
// with no functional benefit and real risk of a transcription error in
// something this easy to get subtly wrong — isn't worth it without a
// concrete trigger, matching ADR-016's precedent.
import { apiFetch } from "../api.js";
import { parseDate, parseAmount } from "./csv.js";

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

// Strategy 3: AI-powered extraction via secure backend proxy (/api/parse-pdf).
// The Anthropic API key lives only on the server — never in the browser bundle.
async function strategyAI(file, statementType = "unknown") {
  try {
    const base64 = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result.split(",")[1]);
      reader.onerror = () => rej(new Error("Read failed"));
      reader.readAsDataURL(file);
    });

    const response = await apiFetch("/api/parse-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfBase64: base64, statementType }),
    });

    if (!response.ok) return [];
    const data = await response.json();
    const txns = data.transactions || [];

    return txns
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

export async function parsePDF(file, onProgress = () => {}) {
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
