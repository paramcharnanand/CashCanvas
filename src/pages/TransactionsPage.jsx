import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Receipt, Upload as UploadIcon } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { Table } from "../components/ui/Table.jsx";
import { Button } from "../components/ui/Button.jsx";
import { useDebounce } from "../hooks/useDebounce.js";
import { useTransactionsData } from "../features/transactions/hooks/useTransactionsData.js";
import { TransactionsToolbar } from "../features/transactions/components/TransactionsToolbar.jsx";
import { ReassignDialog } from "../features/transactions/components/ReassignDialog.jsx";

const fmt = (v) => "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Mounted at "/transactions" (see router.jsx) — a real, always-reachable,
 * bookmarkable route replacing the old "only reachable via a stat-card
 * click" pattern, per docs/frontend/phase-8-migration-plan.md's Phase 6.
 * Search/filter/sort state lives entirely in the URL (`useSearchParams`),
 * satisfying that phase's "sort persists across a page refresh" goal.
 *
 * Row selection + bulk "Reassign Category" (Phase 10 final cleanup) ports
 * the legacy `Dashboard`'s hidden "Transactions" tab — deliberately kept
 * off this page through Phase 8.6 to avoid a second, independent
 * `txnOverrides` drifting from the legacy one before a shared merchant
 * rule resynced them. That risk is moot now that the legacy component is
 * deleted outright; see `useTransactionsData.js`'s docblock and
 * ROADMAP.md's Phase 10 completion note.
 *
 * Filtering/sorting is client-side, not a `GET /api/files` query-param
 * round trip, despite the migration plan's "backend note" suggesting one:
 * the whole active file's transactions are already fetched in full (today's
 * architecture caps at 10,000/file, already in memory) — adding server-side
 * search here would be real backend surface with no functional need yet,
 * the same "don't build it speculatively ahead of a real requirement"
 * reasoning ROADMAP.md's Phase 4 tech debt note already applied to
 * pagination. Revisit if the data model ever moves off "one embedded array
 * per file."
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

  const allFilteredSelected = filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach((t) => next.delete(t.id));
        return next;
      }
      return new Set([...prev, ...filtered.map((t) => t.id)]);
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

      <Table
        emptyMessage="No transactions match your filters."
        columns={[
          {
            key: "select",
            label: (
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAll}
                aria-label="Select all visible transactions"
                style={{ cursor: "pointer", accentColor: "var(--primary)" }}
              />
            ),
            render: (t) => (
              <input
                type="checkbox"
                checked={selectedIds.has(t.id)}
                onChange={() => toggleSelected(t.id)}
                // Deliberately not `Select transaction: ${t.desc}` — that
                // embeds the description as a literal substring, which
                // collides with every getByRole("cell", { name: desc })
                // assertion elsewhere in this suite (Playwright's default
                // substring matching means the checkbox cell itself would
                // also match). A generic per-row label is standard practice
                // for table row-selection checkboxes; a screen-reader user
                // navigating the table already gets row context from the
                // adjacent cells' own content.
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
        ]}
        rows={filtered}
      />

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
