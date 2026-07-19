// CSV-import parsing helpers + the timezone-safe local-date formatter
// (App.jsx's toDateOnlyString, ADR-026). Extracted from App.jsx (Phase 10
// final cleanup) — logic unchanged, moved verbatim.

export function toDateOnlyString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseAmount(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const s = String(val).replace(/[$,\s]/g, "");
  const neg = s.startsWith("(") && s.endsWith(")");
  const cleaned = s.replace(/[()]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return neg ? -num : num;
}

export function parseDate(val) {
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

export function detectColumns(headers) {
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
