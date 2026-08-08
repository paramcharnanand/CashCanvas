import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "../../../api.js";
import { DEFAULT_CATEGORIES } from "../../../utils/categorization.js";

/**
 * Lists, edits, and deletes merchant-category rules — the persisted-teaching
 * mechanism every reassignment (Transactions, Categories' uncategorized
 * quick-fix) writes to via `POST /api/merchant-rules`. This page is the
 * only real *management* surface for that data.
 */
export function useMerchantRulesData() {
  const [rules, setRules] = useState(null);
  const [customCats, setCustomCats] = useState({});
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    return apiFetch("/api/merchant-rules")
      .then((r) => r.json())
      .then((data) => setRules(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      refetch(),
      apiFetch("/api/categories").then((r) => r.json()).then((data) => {
        if (cancelled) return;
        const map = {};
        if (Array.isArray(data)) data.forEach((c) => { map[c.categoryName] = c.keywords || []; });
        setCustomCats(map);
      }).catch(() => {}),
    ]).catch(() => {
      if (!cancelled) setRules([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [refetch]);

  const allCategories = Array.from(
    new Set([...Object.keys(DEFAULT_CATEGORIES), ...Object.keys(customCats)])
  ).filter((c) => c !== "Income" && c !== "Other");

  const deleteRule = useCallback((id) => {
    const previous = rules;
    setRules((prev) => (prev ?? []).filter((r) => r._id !== id));
    return apiFetch(`/api/merchant-rules/${id}`, { method: "DELETE" }).then((res) => {
      if (!res.ok) throw new Error(`Failed to delete rule (${res.status})`);
      return res;
    }).catch((err) => {
      setRules(previous);
      throw err;
    });
  }, [rules]);

  const updateRule = useCallback((id, category) => {
    const previous = rules;
    setRules((prev) => (prev ?? []).map((r) => (r._id === id ? { ...r, category } : r)));
    return apiFetch(`/api/merchant-rules/${id}`, {
      method: "PUT",
      body: JSON.stringify({ category }),
    }).then((res) => {
      if (!res.ok) throw new Error(`Failed to update rule (${res.status})`);
      return res;
    }).catch((err) => {
      setRules(previous);
      throw err;
    });
  }, [rules]);

  return { rules, allCategories, loading, deleteRule, updateRule };
}
