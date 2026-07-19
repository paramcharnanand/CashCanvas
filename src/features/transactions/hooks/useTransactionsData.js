import { useEffect, useState } from "react";
import { apiFetch } from "../../../api.js";
import { categorize } from "../../../App.jsx";

/**
 * Fetches the most recent uploaded statement (same "latest file" auto-
 * restore semantics `LegacyWorkspace` already uses, ported here since this
 * is a separate route with no shared state) plus merchant rules/custom
 * categories, and returns the same categorized transaction list `Dashboard`
 * would show. Read-only: no reassignment here — per
 * docs/frontend/phase-8-migration-plan.md's Phase 6, reassignment isn't
 * part of this phase's stated scope (it stays on the legacy `Dashboard`,
 * unchanged), so this hook doesn't need to duplicate `Dashboard`'s
 * `txnOverrides` state or risk it drifting out of sync across two
 * independent component trees.
 */
export function useTransactionsData() {
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

      const latest = files[0]; // already sorted by uploadedAt desc
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

  return { transactions, loading };
}
