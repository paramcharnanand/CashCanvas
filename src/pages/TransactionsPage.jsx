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
