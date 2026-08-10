import { createContext, useCallback, useContext, useState } from "react";
import { apiFetch } from "../api.js";
import { useAuth } from "./AuthContext.jsx";
import { resolveCategory } from "../utils/categorization.js";

const CategoryOverridesContext = createContext(null);

/**
 * Shared cached-AI-guess store, mounted once at AppShell so Dashboard,
 * Categories, and Transactions all read/write the same override cache for
 * the currently-loaded file instead of each independently re-firing
 * POST /api/categorize batches for transactions the other pages already
 * resolved. `registerFile` resets the cache when the active file changes;
 * `runAiPass` is idempotent per file (guarded by an internal `aiDone` flag)
 * so whichever page loads first triggers the batch fetch and the others
 * just observe `overrides` update reactively.
 */
export function CategoryOverridesProvider({ children }) {
  const { auth } = useAuth();
  const [, setFileId] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [aiDone, setAiDone] = useState(false);

  const registerFile = useCallback((id) => {
    setFileId((prev) => {
      if (prev === id) return prev;
      setOverrides({});
      setAiDone(false);
      return id;
    });
  }, []);

  const runAiPass = useCallback((rawTxns, customCats, merchantRules) => {
    if (!auth?.user || aiDone || !rawTxns || rawTxns.length === 0) return;
    const otherTxns = rawTxns.filter(
      (t) => t.amount < 0 && resolveCategory(t.desc, { customCats, merchantRules }) === "Other"
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
        setOverrides((prev) => {
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
  }, [auth?.user, aiDone]);

  return (
    <CategoryOverridesContext.Provider value={{ overrides, registerFile, runAiPass }}>
      {children}
    </CategoryOverridesContext.Provider>
  );
}

export function useCategoryOverrides() {
  const ctx = useContext(CategoryOverridesContext);
  if (!ctx) throw new Error("useCategoryOverrides must be used within a CategoryOverridesProvider");
  return ctx;
}
