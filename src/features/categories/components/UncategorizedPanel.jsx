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
