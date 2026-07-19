import { useEffect, useState } from "react";
import _ from "lodash";
import { apiFetch } from "../../../api.js";
import { categorize } from "../../../utils/categorization.js";

/**
 * Fetches the most recent uploaded statement + merchant rules/custom
 * categories (same pattern as `features/transactions/hooks/
 * useTransactionsData.js` — a separate route, no shared state with
 * `LegacyWorkspace`) and derives the same `catBreakdown`/`monthlyData`
 * shapes the legacy `Dashboard`'s Charts Row computed, so the extracted
 * chart components render identically to before.
 */
export function useAnalyticsData() {
  const [transactions, setTransactions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiFetch("/api/files").then((r) => r.json()),
      apiFetch("/api/merchant-rules").then((r) => r.json()).catch(() => []),
      apiFetch("/api/categories").then((r) => r.json()).catch(() => []),
    ]).then(async ([files, rulesData, catsData]) => {
      if (cancelled) return;
      if (!Array.isArray(files) || files.length === 0) {
        setTransactions([]);
        return;
      }
      const merchantRules = new Map(
        Array.isArray(rulesData) ? rulesData.map((r) => [r.merchantName, r.category]) : []
      );
      const customCats = {};
      if (Array.isArray(catsData)) {
        catsData.forEach((c) => { customCats[c.categoryName] = c.keywords || []; });
      }

      const latest = files[0];
      const res = await apiFetch(`/api/files/${latest._id}`);
      const data = await res.json();
      if (cancelled || !data.transactions) return;

      const txns = data.transactions.map((t, i) => {
        const date = typeof t.date === "string" ? new Date(t.date) : t.date;
        return { ...t, id: i, date, category: categorize(t.desc, customCats, merchantRules) };
      });
      setTransactions(txns);
    }).catch(() => {
      if (!cancelled) setTransactions([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const expenses = transactions?.filter((t) => t.amount < 0) ?? [];

  const catBreakdown = _.groupBy(expenses, "category");
  const breakdown = Object.entries(catBreakdown)
    .map(([name, txns]) => ({ name, value: Math.abs(_.sumBy(txns, "amount")), count: txns.length }))
    .sort((a, b) => b.value - a.value);

  const byMonth = _.groupBy(transactions ?? [], (t) => `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`);
  const monthlyData = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, txns]) => {
      const exp = Math.abs(_.sumBy(txns.filter((t) => t.amount < 0), "amount"));
      const inc = _.sumBy(txns.filter((t) => t.amount > 0), "amount");
      const [y, m] = month.split("-");
      const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleString("default", { month: "short", year: "numeric" });
      return { month: label, Income: Math.round(inc), Expenses: Math.round(exp), Net: Math.round(inc - exp) };
    });

  return { transactions, loading, catBreakdown: breakdown, monthlyData };
}
