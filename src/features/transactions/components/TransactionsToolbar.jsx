import { Search, X } from "lucide-react";

/**
 * Search + category + date-range + sort controls for `/transactions`. All
 * state lives in the URL (`useSearchParams`, owned by `TransactionsPage`) —
 * not component state — so sort/filters survive a refresh and the page is
 * genuinely bookmarkable/shareable, per docs/frontend/
 * phase-8-migration-plan.md's Phase 6 ("sort persists across a page
 * refresh — it's a real query param").
 */
export function TransactionsToolbar({ search, onSearchChange, category, onCategoryChange, categories, dateFrom, onDateFromChange, dateTo, onDateToChange, sort, onSortChange, onClear, hasActiveFilters }) {
  const inputStyle = {
    padding: "9px 12px",
    background: "var(--surface-alt)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text)",
    font: "var(--text-body-sm)",
    fontFamily: "var(--font-body)",
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-5)", alignItems: "center" }}>
      <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
        <Search size={16} strokeWidth={1.75} color="var(--text-subtle)" aria-hidden="true" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search transactions…"
          aria-label="Search transactions"
          style={{ ...inputStyle, width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px" }}
        />
      </div>

      <select aria-label="Filter by category" value={category} onChange={(e) => onCategoryChange(e.target.value)} style={inputStyle}>
        <option value="">All categories</option>
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <input type="date" aria-label="From date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} style={inputStyle} />
      <input type="date" aria-label="To date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} style={inputStyle} />

      <select aria-label="Sort by" value={sort} onChange={(e) => onSortChange(e.target.value)} style={inputStyle}>
        <option value="date-desc">Newest first</option>
        <option value="date-asc">Oldest first</option>
        <option value="amount-desc">Amount: high to low</option>
        <option value="amount-asc">Amount: low to high</option>
      </select>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClear}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "none", border: "none", color: "var(--text-subtle)",
            font: "var(--text-body-sm)", cursor: "pointer", padding: "9px 4px",
          }}
        >
          <X size={14} strokeWidth={1.75} aria-hidden="true" />
          Clear filters
        </button>
      )}
    </div>
  );
}
