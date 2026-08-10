import { useCallback, useEffect, useState } from "react";
import _ from "lodash";
import { apiFetch } from "../../../api.js";
import { resolveCategory } from "../../../utils/categorization.js";
import { generateSampleData } from "../../../utils/sampleData.js";
import { useCategoryOverrides } from "../../../contexts/CategoryOverridesContext.jsx";

/**
 * Fetches the most recent uploaded statement plus merchant rules/custom
 * categories and derives the same stats the Overview tab always computed:
 * totalIncome/totalExpenses/netCashflow/catBreakdown/monthlyData/recurring/
 * recentTransactions.
 *
 * AI auto-categorization of remaining "Other" transactions is now owned by
 * `CategoryOverridesContext` (shared with Categories/Transactions) rather
 * than local state — this hook just registers the loaded file and triggers
 * the pass once.
 */
export function useDashboardData() {
  const [rawTxns, setRawTxns] = useState(null); // null = loading, [] = no data
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSample, setIsSample] = useState(false);
  const [customCats, setCustomCats] = useState({});
  const [merchantRules, setMerchantRules] = useState(new Map());
  const { overrides, registerFile, runAiPass } = useCategoryOverrides();

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiFetch("/api/files").then((r) => r.json()),
      apiFetch("/api/merchant-rules").then((r) => r.json()).catch(() => []),
      apiFetch("/api/categories").then((r) => r.json()).catch(() => []),
    ]).then(async ([files, rulesData, catsData]) => {
      if (cancelled) return;
      const rules = new Map(
        Array.isArray(rulesData) ? rulesData.map((r) => [r.merchantName, r.category]) : []
      );
      setMerchantRules(rules);
      const customCatsMap = {};
      if (Array.isArray(catsData)) {
        catsData.forEach((c) => { customCatsMap[c.categoryName] = c.keywords || []; });
      }
      setCustomCats(customCatsMap);

      if (!Array.isArray(files) || files.length === 0) {
        setRawTxns([]);
        return;
      }
      const latest = files[0];
      registerFile(latest._id);
      const res = await apiFetch(`/api/files/${latest._id}`);
      const data = await res.json();
      if (cancelled || !data.transactions) {
        setRawTxns([]);
        return;
      }
      const txns = data.transactions.map((t, i) => ({
        ...t,
        id: i,
        date: typeof t.date === "string" ? new Date(t.date) : t.date,
      }));
      setRawTxns(txns);
      setFileName(data.fileName || latest.fileName || "");
      runAiPass(txns, customCatsMap, rules);
    }).catch(() => {
      if (!cancelled) setRawTxns([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSampleData = useCallback(() => {
    const sample = generateSampleData().map((t, i) => ({ ...t, id: i }));
    registerFile("sample");
    setRawTxns(sample);
    setFileName("sample_data.csv");
    setIsSample(true);
  }, [registerFile]);

  const transactions = (rawTxns ?? []).map((t) => ({
    ...t,
    category: resolveCategory(t.desc, { customCats, merchantRules, override: overrides[t.id] }),
  }));

  const expenses = transactions.filter((t) => t.amount < 0);
  const income = transactions.filter((t) => t.amount > 0);
  const totalExpenses = Math.abs(_.sumBy(expenses, "amount"));
  const totalIncome = _.sumBy(income, "amount");
  const netCashflow = totalIncome - totalExpenses;

  const catBreakdown = Object.entries(_.groupBy(expenses, "category"))
    .map(([name, txns]) => ({ name, value: Math.abs(_.sumBy(txns, "amount")), count: txns.length }))
    .sort((a, b) => b.value - a.value);

  const byMonth = _.groupBy(transactions, (t) => `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`);
  const monthlyData = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, txns]) => {
      const exp = Math.abs(_.sumBy(txns.filter((t) => t.amount < 0), "amount"));
      const inc = _.sumBy(txns.filter((t) => t.amount > 0), "amount");
      const [y, m] = month.split("-");
      const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleString("default", { month: "short", year: "numeric" });
      return { month: label, Income: Math.round(inc), Expenses: Math.round(exp), Net: Math.round(inc - exp) };
    });

  const recurring = Object.entries(_.groupBy(expenses, (t) => t.desc.toUpperCase().trim()))
    .filter(([, txns]) => txns.length >= 2)
    .map(([desc, txns]) => {
      const amounts = txns.map((t) => Math.abs(t.amount));
      const avg = _.mean(amounts);
      const stdDev = Math.sqrt(_.mean(amounts.map((a) => (a - avg) ** 2)));
      return { desc, count: txns.length, avg, isFixed: stdDev / avg < 0.05, total: _.sum(amounts), category: txns[0].category };
    })
    .sort((a, b) => b.total - a.total);

  const recentTransactions = [...transactions].sort((a, b) => b.date - a.date).slice(0, 3);

  return {
    loading,
    isSample,
    fileName,
    transactions,
    totalIncome,
    totalExpenses,
    netCashflow,
    catBreakdown,
    monthlyData,
    recurring,
    recentTransactions,
    loadSampleData,
  };
}
