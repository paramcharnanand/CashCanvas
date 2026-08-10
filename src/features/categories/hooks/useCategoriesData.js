import { useEffect, useState, useCallback } from "react";
import _ from "lodash";
import { apiFetch } from "../../../api.js";
import { resolveCategory, DEFAULT_CATEGORIES } from "../../../utils/categorization.js";
import { cleanDesc } from "../../../utils/merchantNormalization.js";
import { useCategoryOverrides } from "../../../contexts/CategoryOverridesContext.jsx";

/**
 * Fetches the most recent uploaded statement + merchant rules/custom
 * categories, storing raw transactions once and deriving `category` fresh
 * every render via `resolveCategory(desc, { customCats, merchantRules,
 * override })` — the same reactive-derivation shape `useDashboardData`
 * already used, adopted here (and by `useTransactionsData`) so cached AI
 * guesses arriving asynchronously from `CategoryOverridesContext` are
 * reflected immediately, and so `bulkAssign` only needs to update
 * `merchantRules` state rather than hand-patching every matching
 * transaction's `category` field.
 */
export function useCategoriesData() {
  const [rawTxns, setRawTxns] = useState(null);
  const [apiCategories, setApiCategories] = useState([]);
  const [merchantRules, setMerchantRules] = useState(new Map());
  const [customCats, setCustomCats] = useState({});
  const [loading, setLoading] = useState(true);
  const { overrides, registerFile, runAiPass } = useCategoryOverrides();

  const fetchAll = useCallback(() => {
    return Promise.all([
      apiFetch("/api/files").then((r) => r.json()),
      apiFetch("/api/merchant-rules").then((r) => r.json()).catch(() => []),
      apiFetch("/api/categories").then((r) => r.json()).catch(() => []),
    ]).then(async ([files, rulesData, catsData]) => {
      const rules = new Map(
        Array.isArray(rulesData) ? rulesData.map((r) => [r.merchantName, r.category]) : []
      );
      setMerchantRules(rules);
      const cats = Array.isArray(catsData) ? catsData : [];
      setApiCategories(cats);
      const customCatsMap = {};
      cats.forEach((c) => { customCatsMap[c.categoryName] = c.keywords || []; });
      setCustomCats(customCatsMap);

      if (!Array.isArray(files) || files.length === 0) {
        setRawTxns([]);
        return;
      }
      const latest = files[0]; // already sorted by uploadedAt desc
      registerFile(latest._id);
      const res = await apiFetch(`/api/files/${latest._id}`);
      const data = await res.json();
      if (!data.transactions) {
        setRawTxns([]);
        return;
      }
      const txns = data.transactions.map((t, i) => {
        const date = typeof t.date === "string" ? new Date(t.date) : t.date;
        return { ...t, id: i, date };
      });
      setRawTxns(txns);
      runAiPass(txns, customCatsMap, rules);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAll().catch(() => {
      if (!cancelled) setRawTxns([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [fetchAll]);

  const transactions = (rawTxns ?? []).map((t) => ({
    ...t,
    category: resolveCategory(t.desc, { customCats, merchantRules, override: overrides[t.id] }),
  }));

  const expenses = transactions.filter((t) => t.amount < 0);
  const otherTxns = expenses.filter((t) => t.category === "Other");
  const categorizedCount = expenses.length - otherTxns.length;
  const categorizedPct = expenses.length > 0 ? Math.round((categorizedCount / expenses.length) * 100) : 0;
  const totalExpenses = Math.abs(_.sumBy(expenses, "amount"));

  const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

  const categoryNameSet = new Set([
    ...Object.keys(DEFAULT_CATEGORIES),
    ...apiCategories.map((c) => c.categoryName),
    ...expenses.map((t) => t.category),
  ]);
  categoryNameSet.delete("Other");
  categoryNameSet.delete("Income");

  const categories = Array.from(categoryNameSet)
    .map((name, i) => {
      const apiCat = apiCategories.find((c) => c.categoryName === name);
      const catTxns = expenses.filter((t) => t.category === name);
      const catTotal = Math.abs(_.sumBy(catTxns, "amount"));
      const keywords = apiCat?.keywords || [];
      return {
        id: apiCat?._id ?? null,
        name,
        icon: apiCat?.icon,
        color: apiCat?.color || CHART_COLORS[i % CHART_COLORS.length],
        keywords,
        count: catTxns.length,
        total: catTotal,
        pct: totalExpenses > 0 ? (catTotal / totalExpenses) * 100 : 0,
      };
    })
    .filter((c) => c.count > 0 || c.keywords.length > 0 || c.id != null)
    .sort((a, b) => b.total - a.total);

  const createCategory = useCallback(({ categoryName, icon, color }) => {
    return apiFetch("/api/categories", {
      method: "POST",
      body: JSON.stringify({ categoryName, icon, color }),
    }).then((r) => r.json()).then((cat) => fetchAll().then(() => cat));
  }, [fetchAll]);

  const deleteCategory = useCallback((id) => {
    return apiFetch(`/api/categories/${id}`, { method: "DELETE" }).then(() => fetchAll());
  }, [fetchAll]);

  const setKeywords = useCallback((category, keywords) => {
    const req = category.id
      ? apiFetch(`/api/categories/${category.id}`, { method: "PUT", body: JSON.stringify({ keywords }) })
      : apiFetch("/api/categories", { method: "POST", body: JSON.stringify({ categoryName: category.name, keywords }) });
    return req.then(() => fetchAll());
  }, [fetchAll]);

  /**
   * Bulk-assigns the given transaction ids to `categoryName` by writing one
   * merchant rule per distinct cleaned merchant name among them, applied
   * optimistically to local `merchantRules` state — `transactions` above
   * re-derives `category` from it automatically, including for any other
   * currently-loaded transaction sharing the same cleaned merchant name.
   */
  const bulkAssign = useCallback((ids, categoryName) => {
    const idSet = new Set(ids);
    const merchantNames = new Set();
    (rawTxns ?? []).filter((t) => idSet.has(t.id)).forEach((t) => {
      const merchantName = cleanDesc(t.desc);
      if (merchantName) merchantNames.add(merchantName);
    });
    setMerchantRules((prev) => {
      const next = new Map(prev);
      merchantNames.forEach((name) => next.set(name, categoryName));
      return next;
    });
    return Promise.all(
      Array.from(merchantNames).map((merchantName) =>
        apiFetch("/api/merchant-rules", {
          method: "POST",
          body: JSON.stringify({ merchantName, category: categoryName }),
        })
      )
    );
  }, [rawTxns]);

  /** Creates a new category, then bulk-assigns the given ids to it. */
  const bulkCreateAndAssign = useCallback((categoryName, ids) => {
    return createCategory({ categoryName }).then(() => bulkAssign(ids, categoryName));
  }, [createCategory, bulkAssign]);

  return {
    transactions,
    loading,
    categories,
    otherTxns,
    categorizedPct,
    categorizedCount,
    totalExpenses,
    createCategory,
    deleteCategory,
    setKeywords,
    bulkAssign,
    bulkCreateAndAssign,
  };
}
