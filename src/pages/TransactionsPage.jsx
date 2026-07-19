import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Receipt, Upload as UploadIcon } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { Table } from "../components/ui/Table.jsx";
import { Button } from "../components/ui/Button.jsx";
import { useDebounce } from "../hooks/useDebounce.js";
import { useTransactionsData } from "../features/transactions/hooks/useTransactionsData.js";
import { TransactionsToolbar } from "../features/transactions/components/TransactionsToolbar.jsx";

const fmt = (v) => "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Mounted at "/transactions" (see router.jsx) — a real, always-reachable,
 * bookmarkable route replacing the old "only reachable via a stat-card
 * click" pattern, per docs/frontend/phase-8-migration-plan.md's Phase 6.
 * Search/filter/sort state lives entirely in the URL (`useSearchParams`),
 * satisfying that phase's "sort persists across a page refresh" goal.
 *
 * Deliberately read-only (no reassign-category action) — the migration
 * plan's own Phase 6 scope is "Table primitive, search, category/date-range
 * filters, sort," not a reassignment rebuild; the existing reassign flow
 * stays on the legacy `Dashboard`, unchanged (its own "Expected test
 * changes" note confirms this explicitly). Avoids a real state-consistency
 * risk a rebuild would introduce: `Dashboard`'s per-transaction
 * `txnOverrides` are local component state, never persisted server-side
 * (only the merchant-name rule a reassignment *learns* is) — duplicating
 * that state here would let a reassignment diverge between the two pages
 * until a shared merchant rule resynced them. Out of this phase's scope to
 * fix; tracked in ROADMAP.md.
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
  const { transactions, loading } = useTransactionsData();
  const [searchParams, setSearchParams] = useSearchParams();

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

  if (loading) return null;

  if (transactions.length === 0) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
        <EmptyState
          icon={Receipt}
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
      <p style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", margin: "0 0 var(--space-6)" }}>
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

      <Table
        emptyMessage="No transactions match your filters."
        columns={[
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
    </div>
  );
}
