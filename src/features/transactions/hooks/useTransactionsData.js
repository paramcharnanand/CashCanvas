import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../api.js";
import { categorize, cleanDesc, DEFAULT_CATEGORIES } from "../../../utils/categorization.js";

/**
 * Fetches the most recent uploaded statement (same "latest file" auto-
 * restore semantics `LegacyWorkspace` used to use, ported here since this
 * is a separate route with no shared state) plus merchant rules/custom
 * categories, and returns the same categorized transaction list the
 * dashboard shows.
 *
 * `reassign`/`createCategory` (Phase 10 final cleanup) port the legacy
 * `Dashboard`'s hidden "Transactions" tab bulk reassign-category flow —
 * deliberately kept there through Phase 8.6 (this page was read-only by
 * design, avoiding a state-consistency risk: a second, independent
 * `txnOverrides` here could have drifted from the legacy one until a
 * shared merchant rule resynced them). That risk is moot now that the
 * legacy component is deleted outright — this is the only remaining place
 * reassignment can live, so it lives here, using the same "persist a
 * merchant rule, apply locally without a refetch" pattern `useCategoriesData
 * .js`'s `quickFix` already established in Phase 8.8.
 */
export function useTransactionsData() {
  const [transactions, setTransactions] = useState(null);
  const [customCats, setCustomCats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiFetch("/api/files").then((r) => r.json()),
      apiFetch("/api/merchant-rules").then((r) => r.json()).catch(() => []),
      apiFetch("/api/categories").then((r) => r.json()).catch(() => []),
    ]).then(async ([files, rulesData, catsData]) => {
      if (cancelled) return;
      const merchantRules = new Map(
        Array.isArray(rulesData) ? rulesData.map((r) => [r.merchantName, r.category]) : []
      );
      const customCatsMap = {};
      if (Array.isArray(catsData)) {
        catsData.forEach((c) => { customCatsMap[c.categoryName] = c.keywords || []; });
      }
      setCustomCats(customCatsMap);

      if (!Array.isArray(files) || files.length === 0) {
        setTransactions([]);
        return;
      }
      const latest = files[0]; // already sorted by uploadedAt desc
      const res = await apiFetch(`/api/files/${latest._id}`);
      const data = await res.json();
      if (cancelled || !data.transactions) {
        setTransactions([]);
        return;
      }

      const txns = data.transactions.map((t, i) => {
        const date = typeof t.date === "string" ? new Date(t.date) : t.date;
        return { ...t, id: i, date, category: categorize(t.desc, customCatsMap, merchantRules) };
      });
      setTransactions(txns);
    }).catch(() => {
      if (!cancelled) setTransactions([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const allCategories = Array.from(
    new Set([...Object.keys(DEFAULT_CATEGORIES), ...Object.keys(customCats)])
  ).filter((c) => c !== "Income" && c !== "Other");

  /**
   * Reassigns every selected transaction to `categoryName`, learning a
   * merchant→category rule per distinct cleaned description (the same
   * mechanism the legacy Dashboard's reassign modal and Categories'
   * quick-fix both already use) — applied locally immediately, not waiting
   * on a refetch, since the write is fire-and-forget from the UI's
   * perspective (matching quickFix's own pattern).
   */
  const reassign = useCallback((ids, categoryName) => {
    setTransactions((prev) => {
      if (!prev) return prev;
      const idSet = new Set(ids);
      return prev.map((t) => (idSet.has(t.id) ? { ...t, category: categoryName } : t));
    });
    const merchantNames = new Set();
    (transactions ?? [])
      .filter((t) => ids.includes(t.id))
      .forEach((t) => {
        const merchantName = cleanDesc(t.desc);
        if (merchantName) merchantNames.add(merchantName);
      });
    return Promise.all(
      Array.from(merchantNames).map((merchantName) =>
        apiFetch("/api/merchant-rules", {
          method: "POST",
          body: JSON.stringify({ merchantName, category: categoryName }),
        })
      )
    );
  }, [transactions]);

  /** Creates a new category server-side, then makes it immediately available to `reassign`. */
  const createCategory = useCallback((categoryName) => {
    setCustomCats((prev) => ({ ...prev, [categoryName]: prev[categoryName] || [] }));
    return apiFetch("/api/categories", {
      method: "POST",
      body: JSON.stringify({ categoryName }),
    });
  }, []);

  return { transactions, loading, allCategories, reassign, createCategory };
}
