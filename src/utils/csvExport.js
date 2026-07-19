// CSV export helpers for the dashboard's "Download" action (transactions
// with categories, or a category/monthly summary) plus the browser-download
// trigger. Extracted from App.jsx (Phase 10 final cleanup) — logic
// unchanged, moved verbatim.

export function buildTransactionsCsv(transactions) {
  const header = "Date,Description,Category,Amount,Type";
  const rows = transactions.map(t => {
    const date = t.date instanceof Date ? t.date.toLocaleDateString("en-US") : "";
    const desc = `"${(t.desc || "").replace(/"/g, '""')}"`;
    const category = `"${(t.category || "").replace(/"/g, '""')}"`;
    const amount = Math.abs(t.amount).toFixed(2);
    const type = t.amount >= 0 ? "Income" : "Expense";
    return `${date},${desc},${category},${amount},${type}`;
  });
  return [header, ...rows].join("\n");
}

export function buildSummaryCsv(transactions, catBreakdown, monthlyData) {
  const sections = [];

  sections.push("CATEGORY SUMMARY");
  sections.push("Category,Total Spent,Transaction Count,% of Spending");
  const totalSpend = catBreakdown.filter(c => c.name !== "Income").reduce((s, c) => s + c.value, 0);
  catBreakdown.forEach(c => {
    const pct = totalSpend > 0 ? ((c.value / totalSpend) * 100).toFixed(1) : "0.0";
    sections.push(`"${c.name}",${c.value.toFixed(2)},${c.count},${pct}%`);
  });

  sections.push("");
  sections.push("MONTHLY BREAKDOWN");
  sections.push("Month,Income,Expenses,Net");
  monthlyData.forEach(m => {
    sections.push(`"${m.month}",${m.Income},${m.Expenses},${m.Net}`);
  });

  return sections.join("\n");
}

export function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
