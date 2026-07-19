import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "../../../api.js";

/**
 * Lists + deletes merchant-category rules — the persisted-teaching
 * mechanism every reassignment (legacy `Dashboard`'s Transactions tab,
 * and now `CategoriesPage`'s uncategorized quick-fix) writes to via
 * `POST /api/merchant-rules`. This page is the first, and only, real
 * *management* surface for that data — a rule previously had no way to be
 * viewed or removed once created, per docs/frontend/
 * phase-8-migration-plan.md's Phase 8 ("new pages/MerchantRulesPage.jsx —
 * list + delete, the management screen approved earlier").
 */
export function useMerchantRulesData() {
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    return apiFetch("/api/merchant-rules")
      .then((r) => r.json())
      .then((data) => setRules(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    refetch().catch(() => {
      if (!cancelled) setRules([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [refetch]);

  const deleteRule = useCallback((id) => {
    setRules((prev) => (prev ?? []).filter((r) => r._id !== id));
    return apiFetch(`/api/merchant-rules/${id}`, { method: "DELETE" });
  }, []);

  return { rules, loading, deleteRule };
}
