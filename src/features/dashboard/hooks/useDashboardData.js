import { useCallback, useEffect, useState } from "react";
import _ from "lodash";
import { apiFetch } from "../../../api.js";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { resolveCategory } from "../../../utils/categorization.js";
import { generateSampleData } from "../../../utils/sampleData.js";

/**
 * Fetches the most recent uploaded statement plus merchant rules/custom
 * categories (same "separate route" pattern as every other Phase 8.6+
 * hook — the legacy `LegacyWorkspace`/`Dashboard` this replaces is deleted
 * outright in Phase 10) and derives the same stats the legacy Dashboard's
 * Overview tab always computed: totalIncome/totalExpenses/netCashflow/
 * catBreakdown/monthlyData/recurring/recentTransactions.
 *
 * Also ports two behaviors that only existed on the legacy component,
 * rather than dropping them (see ROADMAP.md's Phase 10 completion note —
 * both were explicit product decisions, not silently carried over):
 * - AI auto-categorization of remaining "Other" transactions on load
 *   (`POST /api/categorize` in batches). Ephemeral, same as before — the
 *   only thing that persists server-side is a real user reassignment
 *   (which writes a merchant rule), not this pass.
 * - "Try with sample data" (`loadSampleData`): `generateSampleData()`,
 *   rendered through the exact same stat pipeline as real data, never
 *   sent to the server.
 */
export function useDashboardData() {
  const { auth } = useAuth();
  const [rawTxns, setRawTxns] = useState(null); // null = loading, [] = no data
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSample, setIsSample] = useState(false);
  const [customCats, setCustomCats] = useState({});
  const [merchantRules, setMerchantRules] = useState(new Map());
  const [txnOverrides, setTxnOverrides] = useState({});
  const [aiDone, setAiDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiFetch("/api/files").then((r) => r.json()),
      apiFetch("/api/merchant-rules").then((r) => r.json()).catch(() => []),
      apiFetch("/api/categories").then((r) => r.json()).catch(() => []),
    ]).then(async ([files, rulesData, catsData]) => {
      if (cancelled) return;
      setMerchantRules(new Map(
        Array.isArray(rulesData) ? rulesData.map((r) => [r.merchantName, r.category]) : []
      ));
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
    }).catch(() => {
      if (!cancelled) setRawTxns([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const loadSampleData = useCallback(() => {
    const sample = generateSampleData().map((t, i) => ({ ...t, id: i }));
    setRawTxns(sample);
    setFileName("sample_data.csv");
    setIsSample(true);
    setAiDone(true); // sample data is fake — nothing real to send the AI categorizer
  }, []);

  // AI categorization of remaining "Other" transactions — fires once per
  // real (non-sample) dataset, mirroring the legacy Dashboard's own effect.
  useEffect(() => {
    if (!auth?.user || isSample || aiDone || !rawTxns || rawTxns.length === 0) return;
    const otherTxns = rawTxns.filter(
      (t) => t.amount < 0 && !txnOverrides[t.id] && resolveCategory(t.desc, { customCats, merchantRules, override: txnOverrides[t.id] }) === "Other"
    );
    if (otherTxns.length === 0) { setAiDone(true); return; }
    setAiDone(true);

    const BATCH_SIZE = 100;
    const sendBatch = (batch) => apiFetch("/api/categorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: batch.map((t) => ({ desc: t.desc, amount: t.amount })) }),
    }).then((r) => r.json()).then((data) => {
      if (Array.isArray(data.results)) {
        setTxnOverrides((prev) => {
          const next = { ...prev };
          data.results.forEach(({ idx, category }) => {
            if (category && category !== "Other") {
              const id = batch[idx]?.id;
              if (id !== undefined && !next[id]) next[id] = category;
            }
          });
          return next;
        });
      }
    }).catch(() => {});

    for (let i = 0; i < otherTxns.length; i += BATCH_SIZE) {
      sendBatch(otherTxns.slice(i, i + BATCH_SIZE));
    }
  }, [auth?.user, isSample, aiDone, rawTxns, customCats, merchantRules]); // eslint-disable-line react-hooks/exhaustive-deps

  const transactions = (rawTxns ?? []).map((t) => ({
    ...t,
    category: resolveCategory(t.desc, { customCats, merchantRules, override: txnOverrides[t.id] }),
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
