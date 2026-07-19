import { useEffect, useState, useCallback } from "react";
import _ from "lodash";
import { apiFetch } from "../../../api.js";
import { categorize, cleanDesc, DEFAULT_CATEGORIES } from "../../../utils/categorization.js";

/**
 * Fetches the most recent uploaded statement + merchant rules/custom
 * categories (same "separate route, no shared state with `LegacyWorkspace`"
 * pattern as `features/transactions/hooks/useTransactionsData.js` and
 * `features/analytics/hooks/useAnalyticsData.js`), plus the full
 * `apiCategories` list (with `_id`s) needed for create/delete/keyword-edit.
 *
 * Unlike Transactions (Phase 8.6, deliberately read-only — see its own
 * scope decision), this hook's "quick-fix an uncategorized transaction"
 * action *does* write: it calls `POST /api/merchant-rules`, the same
 * persistence path the legacy `Dashboard`'s "Reassign Category" flow
 * already uses. This is a deliberate improvement over the legacy
 * `Dashboard`'s own Categories-tab quick-fix, which only ever set a local,
 * non-persisted `txnOverrides` entry (confirmed by reading `App.jsx` before
 * porting this) — reproducing that ephemeral-only behavior on a second,
 * independent route would have recreated the exact cross-page divergence
 * risk Phase 8.6 already flagged and declined for Transactions. Persisting
 * via the same merchant-rules mechanism the Transactions reassign flow
 * already uses avoids that risk instead of reproducing it.
 */
export function useCategoriesData() {
  const [transactions, setTransactions] = useState(null);
  const [apiCategories, setApiCategories] = useState([]);
  const [, setMerchantRules] = useState(new Map());
  const [loading, setLoading] = useState(true);

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
      const customCats = {};
      cats.forEach((c) => { customCats[c.categoryName] = c.keywords || []; });

      if (!Array.isArray(files) || files.length === 0) {
        setTransactions([]);
        return;
      }
      const latest = files[0]; // already sorted by uploadedAt desc
      const res = await apiFetch(`/api/files/${latest._id}`);
      const data = await res.json();
      if (!data.transactions) {
        setTransactions([]);
        return;
      }
      const txns = data.transactions.map((t, i) => {
        const date = typeof t.date === "string" ? new Date(t.date) : t.date;
        return { ...t, id: i, date, category: categorize(t.desc, customCats, rules) };
      });
      setTransactions(txns);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAll().catch(() => {
      if (!cancelled) setTransactions([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [fetchAll]);

  const expenses = (transactions ?? []).filter((t) => t.amount < 0);
  const otherTxns = expenses.filter((t) => t.category === "Other");
  const categorizedCount = expenses.length - otherTxns.length;
  const categorizedPct = expenses.length > 0 ? Math.round((categorizedCount / expenses.length) * 100) : 0;
  const totalExpenses = Math.abs(_.sumBy(expenses, "amount"));

  const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

  // The full category universe is DEFAULT_CATEGORIES (built-in keyword
  // sets, no `_id`, no delete/edit affordance beyond adding a keyword —
  // categorize() already knows them) union apiCategories (user-created,
  // with a real `_id`) — matches the legacy Dashboard's own `allCategories`
  // derivation (App.jsx) exactly. A category not in either source can still
  // appear here transiently right after quickFix() assigns it, so the
  // union always includes every category any transaction is currently
  // showing.
  const categoryNameSet = new Set([
    ...Object.keys(DEFAULT_CATEGORIES),
    ...apiCategories.map((c) => c.categoryName),
    ...expenses.map((t) => t.category),
  ]);
  categoryNameSet.delete("Other");
  categoryNameSet.delete("Income");

  // Categories with real transactions, configured keywords, or a real
  // server-side record (`apiCat` — the user explicitly created it via "New
  // Category") are shown. Only never-used *default* categories (no id, no
  // transactions, no keywords) are hidden, to avoid cluttering the grid
  // with all of DEFAULT_CATEGORIES. A user-created category necessarily
  // starts with zero transactions and zero keywords, so excluding it too
  // (the legacy Dashboard's original rule, ported unchanged into Phase 8.8)
  // was a real bug: its card is the only UI that can ever add a keyword to
  // it, so a brand-new category had no path to ever become visible.
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

  /**
   * create/delete/setKeywords all refetch (`fetchAll()`) after their write
   * completes, rather than optimistically patching `apiCategories` alone.
   * Found while testing: `transactions` is categorized once, at fetch time,
   * via `categorize(desc, customCats, rules)` — patching `apiCategories`
   * locally left already-fetched transactions' `category` field stale
   * (e.g. a deleted category's card would keep reappearing, still showing
   * the transaction that used to match its keyword, because `expenses`
   * still had `category: "<deleted name>"` recorded on it). The legacy
   * Dashboard avoided this because its `transactions` was a `useMemo`
   * reactively depending on `customCats`, recomputing automatically on
   * every edit — replicating that same reactivity here would mean hand-
   * duplicating `categorize()`'s call graph in a second place. A full
   * refetch after each (infrequent, deliberate) category edit is simpler
   * and always correct — the same "re-derive from server truth" choice
   * this hook already makes for everything else.
   */
  const createCategory = useCallback(({ categoryName, icon, color }) => {
    return apiFetch("/api/categories", {
      method: "POST",
      body: JSON.stringify({ categoryName, icon, color }),
    }).then((r) => r.json()).then((cat) => fetchAll().then(() => cat));
  }, [fetchAll]);

  const deleteCategory = useCallback((id) => {
    return apiFetch(`/api/categories/${id}`, { method: "DELETE" }).then(() => fetchAll());
  }, [fetchAll]);

  /**
   * `category.id` is `null` for a built-in `DEFAULT_CATEGORIES` category
   * with no `apiCategories` record yet (categorize() already recognizes it
   * by name; nothing has ever been persisted for it). The legacy
   * Dashboard's equivalent handler (`App.jsx`'s Categories tab, pre-Phase-8)
   * had a real, evidenced bug here: it only called the PUT-keywords API
   * when an `_id` already existed, silently updating local state only
   * otherwise — so a keyword added to a default category (the common case:
   * most categories a user interacts with *are* the built-in ones) worked
   * for the rest of that session and then silently vanished on reload,
   * never persisted. Root-caused by reading the legacy handler's
   * `if (id) ...` guard, not observed via a failing test. Fixed here, not
   * reproduced: when there's no existing category document, create one
   * (with the new keyword list included in the same POST) instead of
   * updating state that has nothing to persist to.
   */
  const setKeywords = useCallback((category, keywords) => {
    const req = category.id
      ? apiFetch(`/api/categories/${category.id}`, { method: "PUT", body: JSON.stringify({ keywords }) })
      : apiFetch("/api/categories", { method: "POST", body: JSON.stringify({ categoryName: category.name, keywords }) });
    return req.then(() => fetchAll());
  }, [fetchAll]);

  /**
   * Persists merchantName → category (the same "reassignment learns a
   * rule" mechanism the legacy Dashboard's Transactions tab already uses),
   * then re-derives every transaction's category locally so the fix is
   * reflected immediately without a full refetch.
   */
  const quickFix = useCallback((txn, categoryName) => {
    const merchantName = cleanDesc(txn.desc);
    if (!merchantName) return Promise.resolve();
    setMerchantRules((prev) => new Map([...prev, [merchantName, categoryName]]));
    setTransactions((prev) =>
      (prev ?? []).map((t) => (cleanDesc(t.desc) === merchantName ? { ...t, category: categoryName } : t))
    );
    return apiFetch("/api/merchant-rules", {
      method: "POST",
      body: JSON.stringify({ merchantName, category: categoryName }),
    });
  }, []);

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
    quickFix,
  };
}
