import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../api.js";
import { resolveCategory, DEFAULT_CATEGORIES } from "../../../utils/categorization.js";
import { cleanDesc } from "../../../utils/merchantNormalization.js";
import { useCategoryOverrides } from "../../../contexts/CategoryOverridesContext.jsx";

/**
 * Fetches the most recent uploaded statement plus merchant rules/custom
 * categories, storing raw transactions once and deriving `category` fresh
 * every render via `resolveCategory` (same reactive shape as
 * `useCategoriesData`/`useDashboardData`) so cached AI guesses from
 * `CategoryOverridesContext` are reflected without a refetch.
 */
export function useTransactionsData() {
  const [rawTxns, setRawTxns] = useState(null);
  const [customCats, setCustomCats] = useState({});
  const [merchantRules, setMerchantRules] = useState(new Map());
  const [loading, setLoading] = useState(true);
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

      const txns = data.transactions.map((t, i) => {
        const date = typeof t.date === "string" ? new Date(t.date) : t.date;
        return { ...t, id: i, date };
      });
      setRawTxns(txns);
      runAiPass(txns, customCatsMap, rules);
    }).catch(() => {
      if (!cancelled) setRawTxns([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transactions = (rawTxns ?? []).map((t) => ({
    ...t,
    category: resolveCategory(t.desc, { customCats, merchantRules, override: overrides[t.id] }),
  }));

  const allCategories = Array.from(
    new Set([...Object.keys(DEFAULT_CATEGORIES), ...Object.keys(customCats)])
  ).filter((c) => c !== "Income" && c !== "Other");

  /**
   * Reassigns the given transaction ids to `categoryName` by writing one
   * merchant rule per distinct cleaned description, applied optimistically
   * to local `merchantRules` state — `transactions` above re-derives
   * `category` automatically, including for any other currently-loaded
   * transaction sharing the same cleaned merchant name.
   */
  const reassign = useCallback((ids, categoryName) => {
    const idSet = new Set(ids);
    const merchantNames = new Set();
    (rawTxns ?? [])
      .filter((t) => idSet.has(t.id))
      .forEach((t) => {
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
