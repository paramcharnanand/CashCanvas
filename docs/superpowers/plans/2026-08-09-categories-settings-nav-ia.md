# Categories/Settings Navigation & IA Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Transactions and Merchant Rules from the bottom nav, make Categories the primary category-management surface (breakdown → bulk-assignable Uncategorized Transactions → View All Transactions), move Merchant Rules access into a widened Settings page, add an opt-in category-grouped view to the Transactions page, and wire the AI-guess precedence tier into Categories/Transactions via a shared, file-scoped override cache.

**Architecture:** Config-driven nav (`NAV_ITEMS.enabled`) so `BottomNav` needs no changes. `UncategorizedPanel` becomes a presentational multi-select list; `CategoriesPage` owns selection state and reuses `ReassignDialog` (relocated to `features/categories/components/`, since Categories is now the primary category-management surface) for both single- and multi-transaction bulk assignment — the same `POST /api/merchant-rules` persistence path Transactions already uses, no new API. `useCategoriesData`/`useTransactionsData`/`useDashboardData` are refactored to store raw transactions and derive `category` reactively via `resolveCategory(desc, { customCats, merchantRules, override })` every render (matching the pattern `useDashboardData` already used), fed by a new `CategoryOverridesContext` mounted once at `AppShell` that owns the AI-guess (`POST /api/categorize`) fetch/cache so navigating between Dashboard/Categories/Transactions never re-fires duplicate AI calls for the same file.

**Tech Stack:** React 18, React Router, no Tailwind (inline styles + CSS custom properties from `src/styles/tokens.css`), Vitest (unit), Playwright (e2e).

## Global Constraints

- No visual redesign — reuse `Card`/`Button`/`Dialog`/`EmptyState`/`StatCard`/`Table`/`Field` from `src/components/ui/` and existing design tokens throughout. No Tailwind.
- No new backend/API routes. All category persistence continues through `POST /api/merchant-rules` (upsert by cleaned merchant name).
- Do not remove the `/transactions` or `/merchant-rules` routes — only their bottom-nav presence changes.
- Bottom nav order after this change: Overview → Upload → Analytics → Categories → Savings → Settings.
- Transactions page keeps 100% of its current default (flat) behavior — grouping-by-category is an additional opt-in view (`?view=category`), default stays flat. Do not change existing sort/select-all semantics in flat mode.
- **Process deviation from this skill's usual TDD-first convention, per explicit user instruction:** the user requires a working local UI (desktop + mobile screenshots) to visually approve *before* any commit, and wants automated tests updated *after* that approval, not before. Tasks 1–9 therefore implement real, complete code directly (no placeholders — every snippet below is the actual code to write) and end at a hard screenshot/approval checkpoint (Task 10) with **no git commit**. Task 11 (test updates, lint, build) only proceeds after the user approves the layout.
- Every code snippet below is complete and final for its file — no "TODO"/"add logic here" gaps.

---

### Task 1: Remove Transactions & Merchant Rules from the bottom nav

**Files:**
- Modify: `src/layouts/navigation.js`

**Interfaces:**
- Produces: `NAV_ITEMS`/`SIDEBAR_ITEMS` unchanged in shape; only two entries' `enabled` flips to `false`. `BottomNav` (`src/layouts/BottomNav.jsx`) already consumes `SIDEBAR_ITEMS` — no change needed there.

- [ ] **Step 1: Edit `NAV_ITEMS` and its docblock**

Replace the full file:

```js
import { Home, Upload, List, BarChart3, Tag, Store, Target, Settings } from "lucide-react";

/**
 * Single source of truth for primary (bottom) navigation — read by
 * `BottomNav` only (the Command Palette, `features/command-palette/
 * commands.js`, maintains its own independent registry and does not import
 * this file, so disabling an item here does not affect the palette).
 *
 * `mobileLabel` (optional): a shorter label for the compact bottom-nav bar
 * specifically, where equal-width items leave no room for a label as long
 * as "Merchant Rules" without wrapping to a second line. Falls back to
 * `label`.
 *
 * `enabled: false` removes an item from the bottom nav (`SIDEBAR_ITEMS`)
 * while its route stays fully live — used both for planned-but-unbuilt
 * destinations and, as of the Categories/Settings IA rework, for
 * Transactions and Merchant Rules: both are fully functional, reachable via
 * "View All Transactions" on Categories and the Merchant Rules entry on
 * Settings respectively, just intentionally out of the primary nav.
 */
export const NAV_ITEMS = [
  { id: "overview", to: "/dashboard", label: "Overview", icon: Home, enabled: true, phase: null },
  { id: "upload", to: "/upload", label: "Upload", icon: Upload, enabled: true, phase: null },
  { id: "transactions", to: "/transactions", label: "Transactions", icon: List, enabled: false, phase: null },
  { id: "analytics", to: "/analytics", label: "Analytics", icon: BarChart3, enabled: true, phase: null },
  { id: "categories", to: "/categories", label: "Categories", icon: Tag, enabled: true, phase: null },
  { id: "merchant-rules", to: "/merchant-rules", label: "Merchant Rules", mobileLabel: "Rules", icon: Store, enabled: false, phase: null },
  { id: "savings", to: "/savings", label: "Savings", icon: Target, enabled: true, phase: null },
  { id: "settings", to: "/settings", label: "Settings", icon: Settings, enabled: true, phase: null },
];

export const SIDEBAR_ITEMS = NAV_ITEMS.filter((item) => item.enabled);
```

- [ ] **Step 2: Manually verify** — run `npm run dev`, log in, confirm the bottom nav shows exactly Overview/Upload/Analytics/Categories/Savings/Settings in that order, and that `/transactions` and `/merchant-rules` still load directly by URL.

- [ ] **Step 3: Commit — SKIP.** Per Global Constraints, no commit until visual approval (Task 10).

---

### Task 2: Create the shared `CategoryOverridesContext`

**Files:**
- Create: `src/contexts/CategoryOverridesContext.jsx`

**Interfaces:**
- Consumes: `apiFetch` (`src/api.js`), `useAuth` (`src/contexts/AuthContext.jsx`), `resolveCategory` (`src/utils/categorization.js`).
- Produces: `CategoryOverridesProvider({ children })` component; `useCategoryOverrides()` hook returning `{ overrides: Record<number, string>, registerFile: (fileId: string) => void, runAiPass: (rawTxns: {id:number, desc:string, amount:number}[], customCats: object, merchantRules: Map<string,string>) => void }`. `overrides` maps a transaction's local `id` (index) to an AI-guessed category string. Consumed by Task 5's `useDashboardData`, Task 6's `useCategoriesData`, Task 8's `useTransactionsData`.

- [ ] **Step 1: Write the context/provider**

```jsx
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
  const [fileId, setFileId] = useState(null);
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
```

- [ ] **Step 2: Mount the provider in `AppShell`**

In `src/layouts/AppShell.jsx`, add the import:

```js
import { CategoryOverridesProvider } from "../contexts/CategoryOverridesContext.jsx";
```

Wrap the existing returned JSX's outer `<div>` with the provider (keep everything else inside identical):

```jsx
  return (
    <CategoryOverridesProvider>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
        <Header onOpenPalette={() => setPaletteOpen(true)} />
        <div style={{ flex: 1, paddingBottom: isSpaciousNav ? 84 : "calc(70px + env(safe-area-inset-bottom, 0px))" }}>
          <Outlet />
        </div>
        <BottomNav />

        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onShowShortcuts={() => {
            setPaletteOpen(false);
            setShortcutsOpen(true);
          }}
        />
        <ShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </div>
    </CategoryOverridesProvider>
  );
```

- [ ] **Step 3: Manually verify** — `npm run dev`, confirm the app still boots with no console error about a missing provider.

---

### Task 3: Move `ReassignDialog` into `features/categories/components/`

**Files:**
- Create: `src/features/categories/components/ReassignDialog.jsx` (identical content to the current `src/features/transactions/components/ReassignDialog.jsx`, only the relative import paths for `Dialog`/`Button` change from `../../../components/ui/` — same depth, no path change actually needed since both files sit at the same nesting depth (`features/<name>/components/`). Copy verbatim.)
- Delete: `src/features/transactions/components/ReassignDialog.jsx`
- Modify: `src/pages/TransactionsPage.jsx` (import path only)

**Interfaces:**
- Produces: `ReassignDialog({ open, onClose, selectedCount, categories, onReassign, onCreateAndReassign, title = "Reassign Category" })` — same props as before plus an optional `title` (defaults to the exact original heading text, so Transactions' call site needs zero changes and its existing test `getByRole("button", { name: "Reassign Category" })` keeps passing). Categories' call site (Task 8) passes `title="Move to Category"` to match its own trigger button's wording.

- [ ] **Step 1: Create the new file with identical content**

```jsx
import { useId, useState } from "react";
import { Dialog } from "../../../components/ui/Dialog.jsx";
import { Button } from "../../../components/ui/Button.jsx";

/**
 * Bulk category-assignment dialog — shared by Categories (Uncategorized
 * Transactions bulk-assign) and Transactions (row-selection bulk reassign).
 * Two actions: pick an existing category, or create a new one inline and
 * apply it in the same step.
 */
export function ReassignDialog({ open, onClose, selectedCount, categories, onReassign, onCreateAndReassign, title = "Reassign Category" }) {
  const [newCatName, setNewCatName] = useState("");
  const inputId = useId();

  const close = () => {
    setNewCatName("");
    onClose();
  };

  const submitNewCategory = () => {
    const name = newCatName.trim();
    if (!name) return;
    onCreateAndReassign(name);
    close();
  };

  return (
    <Dialog open={open} onClose={close} labelledBy="reassign-title" maxWidth={380}>
      <div style={{ padding: "var(--space-6)" }}>
        <h2 id="reassign-title" style={{ font: "var(--text-heading-md)", color: "var(--text)", margin: "0 0 var(--space-2)" }}>
          {title}
        </h2>
        <p style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", margin: "0 0 var(--space-5)" }}>
          {selectedCount} transaction{selectedCount !== 1 ? "s" : ""} will be updated
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxHeight: 280, overflowY: "auto" }}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => { onReassign(cat); close(); }}
              style={{
                padding: "10px 14px", background: "var(--surface-alt)",
                border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                color: "var(--text)", cursor: "pointer", textAlign: "left",
                font: "var(--text-body-sm)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-container, var(--surface-alt))"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ marginTop: "var(--space-4)", borderTop: "1px solid var(--border)", paddingTop: "var(--space-4)" }}>
          <label htmlFor={inputId} style={{ display: "block", font: "var(--text-label)", color: "var(--text-subtle)", marginBottom: "var(--space-2)" }}>
            Create new category
          </label>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start" }}>
            <input
              id={inputId}
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitNewCategory(); }}
              placeholder="e.g. Pet Care, Education..."
              autoComplete="off"
              style={{
                flex: 1, padding: "11px var(--space-4)", boxSizing: "border-box",
                background: "var(--surface-alt)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", color: "var(--text)",
                font: "var(--text-body-md)", fontFamily: "var(--font-body)",
              }}
            />
            <Button variant="primary" size="sm" onClick={submitNewCategory} disabled={!newCatName.trim()}>
              Add
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
```

(Note: heading is now a `title` prop defaulting to "Reassign Category" — Transactions' call site is unaffected; Categories passes `title="Move to Category"` in Task 8. No existing test text changes needed for this rename.)

- [ ] **Step 2: Delete the old file**

```bash
rm src/features/transactions/components/ReassignDialog.jsx
```

- [ ] **Step 3: Update `TransactionsPage.jsx`'s import**

In `src/pages/TransactionsPage.jsx`, change:
```js
import { ReassignDialog } from "../features/transactions/components/ReassignDialog.jsx";
```
to:
```js
import { ReassignDialog } from "../features/categories/components/ReassignDialog.jsx";
```

- [ ] **Step 4: Manually verify** — `npm run dev`, confirm `/transactions` still renders with no import error.

---

### Task 4: Refactor `useCategoriesData` — reactive category derivation, `bulkAssign`/`bulkCreateAndAssign`

**Files:**
- Modify: `src/features/categories/hooks/useCategoriesData.js`

**Interfaces:**
- Consumes: `useCategoryOverrides()` (Task 2), `resolveCategory`/`DEFAULT_CATEGORIES` (`src/utils/categorization.js`), `cleanDesc` (`src/utils/merchantNormalization.js`).
- Produces: same shape as before minus `quickFix`, plus `bulkAssign(ids: number[], categoryName: string): Promise`, `bulkCreateAndAssign(categoryName: string, ids: number[]): Promise`. Consumed by Task 7's `CategoriesPage`.

- [ ] **Step 1: Replace the full file**

```js
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
```

- [ ] **Step 2: Manually verify** — `npm run dev`, seed/upload a statement, confirm `/categories` still renders category cards and totals identically to before.

---

### Task 5: Refactor `useDashboardData` to use the shared override context

**Files:**
- Modify: `src/features/dashboard/hooks/useDashboardData.js`

**Interfaces:**
- Consumes: `useCategoryOverrides()` (Task 2).
- Produces: same return shape as before (unchanged).

- [ ] **Step 1: Replace the full file**

```js
import { useCallback, useEffect, useState } from "react";
import _ from "lodash";
import { apiFetch } from "../../../api.js";
import { useAuth } from "../../../contexts/AuthContext.jsx";
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
  const { auth } = useAuth();
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
```

- [ ] **Step 2: Manually verify** — `npm run dev`, load `/dashboard`, confirm stats render as before, and "Try with sample data" still works.

---

### Task 6: Refactor `useTransactionsData` — reactive category derivation, AI overrides

**Files:**
- Modify: `src/features/transactions/hooks/useTransactionsData.js`

**Interfaces:**
- Consumes: `useCategoryOverrides()` (Task 2).
- Produces: same shape as before (`transactions`, `loading`, `allCategories`, `reassign`, `createCategory`) — `reassign`'s external behavior is unchanged, just implemented via reactive `merchantRules` state instead of manual per-transaction patching.

- [ ] **Step 1: Replace the full file**

```js
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
```

- [ ] **Step 2: Manually verify** — `npm run dev`, `/transactions`, confirm the table, search/filter/sort, and "Reassign Category" (now labelled "Move to Category" per Task 3) all behave exactly as before.

---

### Task 7: Rewrite `UncategorizedPanel` for multi-select

**Files:**
- Modify: `src/features/categories/components/UncategorizedPanel.jsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `UncategorizedPanel({ transactions, selectedIds: Set<number>, onToggleSelect: (id) => void, onToggleSelectAll: () => void })` — replaces the old `{ transactions, categoryNames, onQuickFix }` props. Consumed by Task 9's `CategoriesPage`.

- [ ] **Step 1: Replace the full file**

```jsx
import { Card } from "../../../components/ui/Card.jsx";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";
import { CheckCircle2 } from "lucide-react";

const fmt = (v) => "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Multi-select list of "Other"-category transactions. Selection is owned by
 * `CategoriesPage`, which renders the bulk-assign toolbar and
 * `ReassignDialog` above this panel — this component is purely
 * presentational.
 */
export function UncategorizedPanel({ transactions, selectedIds, onToggleSelect, onToggleSelectAll }) {
  if (transactions.length === 0) {
    return (
      <Card>
        <EmptyState icon={CheckCircle2} headline="Everything's categorized" body="No uncategorized transactions right now." />
      </Card>
    );
  }

  const allSelected = transactions.length > 0 && transactions.every((t) => selectedIds.has(t.id));

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: 0 }}>Uncategorized Transactions</h2>
        <span style={{
          padding: "3px 10px", background: "var(--negative-soft)", borderRadius: "var(--radius-sm)",
          font: "700 10px var(--font-numeral)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--negative)",
        }}>
          Action Required
        </span>
      </div>
      <p style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", margin: "0 0 var(--space-4)" }}>
        {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} couldn't be auto-categorized. Select one or more, then move them into a category.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-2) 0", borderBottom: "1px solid var(--border)", marginBottom: "var(--space-1)" }}>
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onToggleSelectAll}
          aria-label="Select all uncategorized transactions"
          style={{ cursor: "pointer", accentColor: "var(--primary)" }}
        />
        <span style={{ font: "var(--text-label)", color: "var(--text-subtle)" }}>Select all</span>
      </div>

      <div>
        {transactions.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap",
              padding: "var(--space-3) 0", borderBottom: "1px solid var(--border)",
            }}
          >
            <input
              type="checkbox"
              checked={selectedIds.has(t.id)}
              onChange={() => onToggleSelect(t.id)}
              aria-label="Select transaction"
              style={{ cursor: "pointer", accentColor: "var(--primary)" }}
            />
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.desc}
              </div>
              <div style={{ font: "var(--text-label)", color: "var(--text-subtle)", marginTop: 2 }}>
                {t.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </div>
            <div style={{ font: "600 13px var(--font-numeral)", color: "var(--negative)", minWidth: 70, textAlign: "right" }}>
              {fmt(t.amount)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

---

### Task 8: Wire selection state, bulk toolbar, and "View All Transactions" into `CategoriesPage`

**Files:**
- Modify: `src/pages/CategoriesPage.jsx`

**Interfaces:**
- Consumes: `bulkAssign`/`bulkCreateAndAssign` (Task 4), `ReassignDialog` (Task 3), `UncategorizedPanel` (Task 7).

- [ ] **Step 1: Replace the full file**

```jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Tag, Upload as UploadIcon, List } from "lucide-react";
import { Card } from "../components/ui/Card.jsx";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { Button } from "../components/ui/Button.jsx";
import { StatCard } from "../components/ui/StatCard.jsx";
import { useCategoriesData } from "../features/categories/hooks/useCategoriesData.js";
import { CategoryGrid } from "../features/categories/components/CategoryGrid.jsx";
import { NewCategoryDialog } from "../features/categories/components/NewCategoryDialog.jsx";
import { UncategorizedPanel } from "../features/categories/components/UncategorizedPanel.jsx";
import { ReassignDialog } from "../features/categories/components/ReassignDialog.jsx";

const fmt = (v) => "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Mounted at "/categories" — the primary category-based transaction
 * management surface: breakdown → Uncategorized Transactions (bulk
 * multi-select assign) → View All Transactions.
 */
export default function CategoriesPage() {
  const {
    transactions, loading, categories, otherTxns, categorizedPct, categorizedCount,
    totalExpenses, createCategory, deleteCategory, setKeywords, bulkAssign, bulkCreateAndAssign,
  } = useCategoriesData();
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [reassignOpen, setReassignOpen] = useState(false);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allUncategorizedSelected = otherTxns.length > 0 && otherTxns.every((t) => selectedIds.has(t.id));
  const toggleSelectAllUncategorized = () => {
    setSelectedIds(allUncategorizedSelected ? new Set() : new Set(otherTxns.map((t) => t.id)));
  };

  const handleBulkAssign = (categoryName) => {
    bulkAssign(Array.from(selectedIds), categoryName);
    setSelectedIds(new Set());
  };

  const handleBulkCreateAndAssign = (categoryName) => {
    bulkCreateAndAssign(categoryName, Array.from(selectedIds)).finally(() => setSelectedIds(new Set()));
  };

  if (loading) return null;

  if (transactions.length === 0) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
        <EmptyState
          icon={Tag}
          headingLevel="h1"
          headline="No data to categorize yet"
          body="Upload a statement to start organizing your spending by category."
          action={
            <Link to="/upload" style={{ textDecoration: "none" }}>
              <Button variant="primary" size="sm">
                <UploadIcon size={16} strokeWidth={1.75} aria-hidden="true" />
                Upload a statement
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const expenseCount = categorizedCount + otherTxns.length;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
      <h1 style={{ font: "var(--text-display-lg)", color: "var(--text)", margin: "0 0 var(--space-6)" }}>
        Categories
      </h1>

      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", marginBottom: "var(--space-6)" }}>
        <StatCard label="Categorized" value={`${categorizedPct}%`} sub={`${categorizedCount} of ${expenseCount} transactions`} tone="positive" />
        <StatCard
          label="Needs attention"
          value={String(otherTxns.length)}
          sub={otherTxns.length > 0 ? "uncategorized" : "all set"}
          tone={otherTxns.length > 0 ? "negative" : "positive"}
        />
      </div>

      {categories.length > 0 && (
        <Card style={{ marginBottom: "var(--space-6)" }}>
          <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: "0 0 var(--space-4)" }}>
            Category breakdown
          </h2>
          {categories.map((c) => (
            <div key={c.name} style={{ marginBottom: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                <span style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--text)" }}>{c.name}</span>
                <span style={{ font: "13px var(--font-numeral)", color: "var(--text-subtle)" }}>{fmt(c.total)}</span>
              </div>
              <div style={{ height: 3, background: "var(--surface-alt)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0}%`, background: c.color, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </Card>
      )}

      <div style={{ marginBottom: "var(--space-6)" }}>
        <CategoryGrid
          categories={categories}
          onDelete={deleteCategory}
          onSetKeywords={setKeywords}
          onNewCategory={() => setNewCatOpen(true)}
        />
      </div>

      {selectedIds.size > 0 && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)", marginBottom: "var(--space-3)",
            background: "var(--positive-soft)", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--positive)",
          }}
        >
          <span style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--primary)" }}>
            {selectedIds.size} selected
          </span>
          <Button variant="primary" size="sm" onClick={() => setReassignOpen(true)}>
            Move to Category
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <UncategorizedPanel
        transactions={otherTxns}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelected}
        onToggleSelectAll={toggleSelectAllUncategorized}
      />

      <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--space-6)" }}>
        <Link to="/transactions" style={{ textDecoration: "none" }}>
          <Button variant="secondary">
            <List size={16} strokeWidth={1.75} aria-hidden="true" />
            View All Transactions
          </Button>
        </Link>
      </div>

      <NewCategoryDialog
        open={newCatOpen}
        onClose={() => setNewCatOpen(false)}
        onCreate={createCategory}
      />

      <ReassignDialog
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        selectedCount={selectedIds.size}
        categories={categories.map((c) => c.name)}
        onReassign={handleBulkAssign}
        onCreateAndReassign={handleBulkCreateAndAssign}
        title="Move to Category"
      />
    </div>
  );
}
```

- [ ] **Step 2: Manually verify** — `npm run dev`, seed transactions with at least one unmatched merchant, go to `/categories`, select multiple uncategorized rows, click "Move to Category", assign to an existing category — confirm the panel updates immediately and the "Needs attention" stat decreases. Repeat with "Create new category". Confirm "View All Transactions" navigates to `/transactions`.

---

### Task 9: Widen Settings and add the Merchant Rules entry

**Files:**
- Create: `src/features/settings/components/MerchantRulesSection.jsx`
- Modify: `src/pages/SettingsPage.jsx`

**Interfaces:**
- Produces: `MerchantRulesSection()` — a `Card` linking to `/merchant-rules`.

- [ ] **Step 1: Create `MerchantRulesSection.jsx`**

```jsx
import { Link } from "react-router-dom";
import { Store } from "lucide-react";
import { Card } from "../../../components/ui/Card.jsx";
import { Button } from "../../../components/ui/Button.jsx";

/**
 * Links out to the existing standalone `/merchant-rules` page rather than
 * inlining its CRUD UI — Merchant Rules moved out of the bottom nav into
 * Settings as of the Categories/Settings IA rework, keeping the page itself
 * unchanged.
 */
export function MerchantRulesSection() {
  return (
    <Card style={{ marginBottom: "var(--space-5)" }}>
      <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: "0 0 var(--space-2)" }}>Merchant Rules</h2>
      <p style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", margin: "0 0 var(--space-4)" }}>
        Manage the merchant-to-category rules that power automatic categorization.
      </p>
      <Link to="/merchant-rules" style={{ textDecoration: "none" }}>
        <Button variant="secondary">
          <Store size={16} strokeWidth={1.75} aria-hidden="true" />
          Manage Merchant Rules
        </Button>
      </Link>
    </Card>
  );
}
```

- [ ] **Step 2: Replace `SettingsPage.jsx`**

```jsx
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useBreakpoint } from "../hooks/useBreakpoint.js";
import { ProfileSection } from "../features/settings/components/ProfileSection.jsx";
import { ThemeToggle } from "../features/settings/components/ThemeToggle.jsx";
import { MerchantRulesSection } from "../features/settings/components/MerchantRulesSection.jsx";
import { DeleteAccountDialog } from "../features/settings/components/DeleteAccountDialog.jsx";

/**
 * Mounted at "/settings". Widened from a single 640px column to an 840px,
 * two-column-on-desktop layout (Account/Appearance | Merchant Rules/Session)
 * as of the Categories/Settings IA rework — the previous single-column width
 * left large unused margins on desktop viewports. Delete Account stays
 * full-width and visually separated as a destructive action.
 */
export default function SettingsPage() {
  const { auth, logout } = useAuth();
  const { atLeast } = useBreakpoint();
  const twoColumn = atLeast("md");
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div style={{ maxWidth: 840, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
      <h1 style={{ font: "var(--text-display-lg)", color: "var(--text)", margin: "0 0 var(--space-6)" }}>
        Settings
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: twoColumn ? "1fr 1fr" : "1fr", gap: "0 var(--space-5)" }}>
        <div>
          <ProfileSection user={auth?.user} />
          <ThemeToggle />
        </div>
        <div>
          <MerchantRulesSection />
          <Card style={{ marginBottom: "var(--space-5)" }}>
            <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: "0 0 var(--space-4)" }}>Session</h2>
            <Button variant="secondary" onClick={logout}>
              <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
              Sign Out
            </Button>
          </Card>
        </div>
      </div>

      <Card>
        <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: "0 0 var(--space-2)" }}>Delete Account</h2>
        <p style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", margin: "0 0 var(--space-4)" }}>
          Permanently delete your account and all associated data.
        </p>
        <Button variant="danger" onClick={() => setDeleteOpen(true)}>Delete Account</Button>
      </Card>

      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onLogout={logout} />
    </div>
  );
}
```

- [ ] **Step 3: Manually verify** — `npm run dev`, `/settings` at a desktop width, confirm two columns render with Account/Appearance on the left and Merchant Rules/Session on the right, Delete Account full-width below; at a mobile width confirm single column, no overlap; click "Manage Merchant Rules" and confirm it navigates to `/merchant-rules`.

---

### Task 10: Add the opt-in category-grouped view to `TransactionsPage`

**Files:**
- Modify: `src/pages/TransactionsPage.jsx`

**Interfaces:**
- Produces: a `?view=flat|category` URL param (default `flat`, unchanged existing behavior). No changes to `useTransactionsData`'s public shape beyond what Task 6 already did.

- [ ] **Step 1: Replace the full file**

```jsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import _ from "lodash";
import { Receipt, Upload as UploadIcon } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { Table } from "../components/ui/Table.jsx";
import { Button } from "../components/ui/Button.jsx";
import { useDebounce } from "../hooks/useDebounce.js";
import { useTransactionsData } from "../features/transactions/hooks/useTransactionsData.js";
import { TransactionsToolbar } from "../features/transactions/components/TransactionsToolbar.jsx";
import { ReassignDialog } from "../features/categories/components/ReassignDialog.jsx";

const fmt = (v) => "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Mounted at "/transactions" — reached via "View All Transactions" on
 * Categories rather than the bottom nav as of the Categories/Settings IA
 * rework. Default view stays the original flat, sortable table (all
 * existing search/filter/sort/bulk-reassign behavior unchanged); `?view=
 * category` is an additional opt-in view grouping the same filtered/sorted
 * rows into per-category sections, ordered by descending group total with
 * "Other" (uncategorized) always last.
 */
export default function TransactionsPage() {
  const { transactions, loading, allCategories, reassign, createCategory } = useTransactionsData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [reassignOpen, setReassignOpen] = useState(false);

  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  const debouncedSearch = useDebounce(searchInput, 250);

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedSearch) next.set("q", debouncedSearch); else next.delete("q");
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const category = searchParams.get("category") || "";
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const sort = searchParams.get("sort") || "date-desc";
  const view = searchParams.get("view") || "flat";

  const setParam = (key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    });
  };

  const categories = useMemo(() => {
    if (!transactions) return [];
    return [...new Set(transactions.map((t) => t.category))].sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    if (!transactions) return [];
    let list = transactions;
    if (debouncedSearch) {
      const needle = debouncedSearch.toLowerCase();
      list = list.filter((t) => t.desc.toLowerCase().includes(needle));
    }
    if (category) list = list.filter((t) => t.category === category);
    if (dateFrom) {
      const from = new Date(dateFrom);
      list = list.filter((t) => t.date >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((t) => t.date <= to);
    }
    return [...list].sort((a, b) => {
      switch (sort) {
        case "date-asc": return a.date - b.date;
        case "amount-desc": return b.amount - a.amount;
        case "amount-asc": return a.amount - b.amount;
        default: return b.date - a.date;
      }
    });
  }, [transactions, debouncedSearch, category, dateFrom, dateTo, sort]);

  const groupedByCategory = useMemo(() => {
    if (view !== "category") return null;
    const groups = new Map();
    filtered.forEach((t) => {
      if (!groups.has(t.category)) groups.set(t.category, []);
      groups.get(t.category).push(t);
    });
    return Array.from(groups.entries())
      .map(([name, txns]) => ({ name, txns, total: Math.abs(_.sumBy(txns, "amount")) }))
      .sort((a, b) => {
        if (a.name === "Other") return 1;
        if (b.name === "Other") return -1;
        return b.total - a.total;
      });
  }, [filtered, view]);

  const hasActiveFilters = !!(searchInput || category || dateFrom || dateTo || (sort && sort !== "date-desc"));

  const clearFilters = () => {
    setSearchInput("");
    setSearchParams({});
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectGroup = (rows) => {
    const groupSelected = rows.length > 0 && rows.every((t) => selectedIds.has(t.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (groupSelected) rows.forEach((t) => next.delete(t.id));
      else rows.forEach((t) => next.add(t.id));
      return next;
    });
  };

  const handleReassign = (categoryName) => {
    reassign(Array.from(selectedIds), categoryName);
    setSelectedIds(new Set());
  };

  const handleCreateAndReassign = (name) => {
    createCategory(name).finally(() => handleReassign(name));
  };

  if (loading) return null;

  if (transactions.length === 0) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
        <EmptyState
          icon={Receipt}
          headingLevel="h1"
          headline="No transactions yet"
          body="Upload a statement to see your transactions here."
          action={
            <Link to="/upload" style={{ textDecoration: "none" }}>
              <Button variant="primary" size="sm">
                <UploadIcon size={16} strokeWidth={1.75} aria-hidden="true" />
                Upload a statement
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const buildColumns = (rowsInScope) => [
    {
      key: "select",
      label: (
        <input
          type="checkbox"
          checked={rowsInScope.length > 0 && rowsInScope.every((t) => selectedIds.has(t.id))}
          onChange={() => toggleSelectGroup(rowsInScope)}
          aria-label="Select all visible transactions"
          style={{ cursor: "pointer", accentColor: "var(--primary)" }}
        />
      ),
      render: (t) => (
        <input
          type="checkbox"
          checked={selectedIds.has(t.id)}
          onChange={() => toggleSelected(t.id)}
          aria-label="Select transaction"
          style={{ cursor: "pointer", accentColor: "var(--primary)" }}
        />
      ),
    },
    { key: "date", label: "Date", render: (t) => t.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) },
    { key: "desc", label: "Description", wrap: true },
    { key: "category", label: "Category" },
    {
      key: "amount", label: "Amount", align: "right",
      render: (t) => (
        <span style={{ font: "600 13px var(--font-numeral)", color: t.amount >= 0 ? "var(--positive)" : "var(--text)" }}>
          {t.amount >= 0 ? "+" : "-"}{fmt(t.amount)}
        </span>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
      <h1 style={{ font: "var(--text-display-lg)", color: "var(--text)", margin: "0 0 var(--space-1)" }}>
        Transactions
      </h1>
      <p style={{ font: "var(--text-body-sm)", color: "var(--text-muted)", margin: "0 0 var(--space-6)" }}>
        {filtered.length} of {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
      </p>

      <TransactionsToolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        category={category}
        onCategoryChange={(v) => setParam("category", v)}
        categories={categories}
        dateFrom={dateFrom}
        onDateFromChange={(v) => setParam("dateFrom", v)}
        dateTo={dateTo}
        onDateToChange={(v) => setParam("dateTo", v)}
        sort={sort}
        onSortChange={(v) => setParam("sort", v)}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <div role="group" aria-label="Transaction view" style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
        <Button variant={view === "flat" ? "primary" : "secondary"} size="sm" onClick={() => setParam("view", null)}>
          Flat
        </Button>
        <Button variant={view === "category" ? "primary" : "secondary"} size="sm" onClick={() => setParam("view", "category")}>
          By Category
        </Button>
      </div>

      {selectedIds.size > 0 && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)", marginBottom: "var(--space-3)",
            background: "var(--positive-soft)", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--positive)",
          }}
        >
          <span style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--primary)" }}>
            {selectedIds.size} selected
          </span>
          <Button variant="primary" size="sm" onClick={() => setReassignOpen(true)}>
            Reassign Category
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {view === "category" ? (
        groupedByCategory.map((group) => (
          <div key={group.name} style={{ marginBottom: "var(--space-6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
              <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: 0 }}>{group.name}</h2>
              <span style={{ font: "13px var(--font-numeral)", color: "var(--text-subtle)" }}>
                {group.txns.length} · {fmt(group.total)}
              </span>
            </div>
            <Table columns={buildColumns(group.txns)} rows={group.txns} emptyMessage="No transactions" />
          </div>
        ))
      ) : (
        <Table
          emptyMessage="No transactions match your filters."
          columns={buildColumns(filtered)}
          rows={filtered}
        />
      )}

      <ReassignDialog
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        selectedCount={selectedIds.size}
        categories={allCategories}
        onReassign={handleReassign}
        onCreateAndReassign={handleCreateAndReassign}
      />
    </div>
  );
}
```

- [ ] **Step 2: Manually verify** — `npm run dev`, `/transactions`: confirm default (`view` param absent) renders identically to before (flat table, sort/search/filter/select-all/reassign all working). Click "By Category" — confirm sections per category appear, "Other" last, each with its own select-all-in-group checkbox that only affects that group's rows. Confirm switching back to "Flat" restores the single table.

---

### Task 11: Local dev server verification — desktop & mobile screenshots (HARD STOP for approval)

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Log in (or create a test account) and seed representative data** — upload a real statement or use "Try with sample data" on the Dashboard so Categories/Transactions have both categorized and uncategorized rows to show.

- [ ] **Step 3: Capture desktop screenshots (~1440px wide or the project's standard desktop viewport)**
  - `/categories` — category breakdown, Uncategorized Transactions with the select-all row, View All Transactions below it.
  - `/categories` with 2+ rows selected — the bulk toolbar and an open "Move to Category" dialog.
  - `/settings` — two-column layout.
  - `/transactions` in both Flat and "By Category" views.
  - The bottom nav (desktop spacious bar) — confirm exactly Overview/Upload/Analytics/Categories/Savings/Settings.

- [ ] **Step 4: Capture mobile screenshots (~390px wide)**
  - `/categories` — confirm the panel and toolbar stack without overflow.
  - `/settings` — confirm single column, no cramping.
  - The bottom nav (compact scrollable bar) — confirm no wrapped labels, no touching labels (mirrors the existing `responsive.spec.js` assertions).

- [ ] **Step 5: STOP.** Present all screenshots to the user. **Do not run Task 12, do not run lint/build/tests beyond what's needed to get the dev server running, and do not commit or push anything** until the user explicitly approves the layout. If they request changes, make them, re-screenshot, and stop again.

---

### Task 12 (post-approval only): Update tests, lint, unit tests, e2e, build

**Do not start this task until the user has approved the screenshots from Task 11.**

**Files:**
- Modify: `tests/e2e/categories.spec.js`, `tests/e2e/transactions.spec.js`, `tests/e2e/settings.spec.js`, `tests/e2e/merchant-rules.spec.js`, `tests/e2e/responsive.spec.js`.

- [ ] **Step 1: Fix nav-destination tests that assumed Transactions/Merchant Rules were in the bottom nav**
  - `tests/e2e/transactions.spec.js`: replace `"Transactions is a real, always-visible nav destination"` (navigates from `/dashboard` clicking a "Transactions" nav link) with a test that goes `/categories` → clicks "View All Transactions" → asserts `toHaveURL(/\/transactions$/)`.
  - `tests/e2e/merchant-rules.spec.js`: replace `"Merchant Rules is a real, always-visible nav destination"` (line 116) with a test that goes `/settings` → clicks "Manage Merchant Rules" → asserts `toHaveURL(/\/merchant-rules$/)`.
  - `tests/e2e/categories.spec.js` and `settings.spec.js`'s own nav-destination tests are unaffected (Categories and Settings stay in the bottom nav) — no change needed.

- [ ] **Step 2: Update the `UncategorizedPanel`/quick-fix tests in `categories.spec.js`**
  - `"quick-fixing an uncategorized transaction persists a merchant rule..."` (line 117) used a per-row category chip button that no longer exists. Rewrite to: check the transaction's row checkbox (`aria-label="Select transaction"` scoped within the row containing its description), click the bulk toolbar's "Move to Category" button, click the target category name inside the `ReassignDialog`, then assert as before (chip removed from the panel, rule visible on `/merchant-rules`).
  - `"a learned merchant rule generalizes..."` (line 138) uses the same chip-click pattern at line 146 — update identically.
  - Add a new test: select 2+ uncategorized transactions, bulk-assign via "Move to Category" → an existing category, assert both rows leave the panel and the "Needs attention" `StatCard` count decreases by 2.
  - Add a new test: select 1+ uncategorized transactions, use the dialog's "Create new category" flow, assert the new category appears in the breakdown/grid and the selected transaction(s) are gone from the panel, and persist after `page.reload()`.

- [ ] **Step 3: Add "By Category" view coverage in `transactions.spec.js`**
  - New test: seed transactions spanning 2+ categories plus at least one uncategorized, go to `/transactions`, click "By Category", assert each real category name renders as a heading with its transactions underneath, and an "Other" section renders last.
  - New test: confirm `?view=category` survives a reload (URL-driven, matching the existing sort-persistence test's pattern).
  - Existing tests (search/filter/sort/select/reassign) should require no changes since default `view` stays `"flat"` — run them to confirm.

- [ ] **Step 4: Update `settings.spec.js`**
  - Add a test: `/settings` shows a "Merchant Rules" heading and a "Manage Merchant Rules" button that navigates to `/merchant-rules`.

- [ ] **Step 5: Update `responsive.spec.js`**
  - The existing `linkCount >= 6` assertion (line 48) still holds (6 items remain) — no change required, but add an explicit test: bottom nav does **not** contain a "Transactions" or "Merchant Rules" link (`expect(nav.getByRole("link", { name: "Transactions" })).toHaveCount(0)`, same for "Merchant Rules"/"Rules").

- [ ] **Step 6: Run the full verification suite**

```bash
npm run lint
npm test
npx playwright test
npm run build
```

Fix any failures before proceeding. Do not skip or weaken a test to make it pass — if a test's *assumption* is genuinely outdated (per the changes above), update the assumption; if a test catches a real regression, fix the code.

- [ ] **Step 7: Report results to the user and ask before committing.** Per Global Constraints, no commit or push happens without explicit user approval even after tests are green.

---

## Self-review notes

- **Spec coverage:** nav reorder (Task 1), Categories bulk-assign + View All Transactions (Tasks 3, 4, 7, 8), Settings widen + Merchant Rules entry (Task 9), Transactions grouped view as opt-in (Task 10), AI-guess tier (Tasks 2, 4, 5, 6), screenshot/approval gate (Task 11), test updates (Task 12) — all spec sections have a task.
- **Type consistency:** `bulkAssign(ids, categoryName)` / `bulkCreateAndAssign(categoryName, ids)` signatures match between Task 4's `useCategoriesData` and Task 8's `CategoriesPage` call sites. `useCategoryOverrides()`'s `{ overrides, registerFile, runAiPass }` shape matches across Tasks 2, 4, 5, 6. `ReassignDialog`'s prop names (`onReassign`, `onCreateAndReassign`, `selectedCount`, `categories`) are unchanged from the original and match both call sites (Task 8, Task 10).
- **No placeholders:** every task's code block is complete, runnable code, not a description.
