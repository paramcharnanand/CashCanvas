import { Card } from "../../../components/ui/Card.jsx";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";
import { CheckCircle2 } from "lucide-react";

const fmt = (v) => "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Restyled from the legacy `Dashboard`'s "Uncategorized Transactions"
 * panel. Clicking a category chip calls `useCategoriesData`'s `quickFix`,
 * which persists a real merchant rule — unlike the legacy version, which
 * only ever set an ephemeral, non-persisted local override (see
 * `useCategoriesData.js`'s docblock for the full reasoning behind this
 * deliberate behavior change).
 */
export function UncategorizedPanel({ transactions, categoryNames, onQuickFix }) {
  if (transactions.length === 0) {
    return (
      <Card>
        <EmptyState icon={CheckCircle2} headline="Everything's categorized" body="No uncategorized transactions right now." />
      </Card>
    );
  }

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
      <p style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", margin: "0 0 var(--space-5)" }}>
        {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} couldn't be auto-categorized. Click a category to assign it — this teaches the app to recognize the merchant next time.
      </p>
      <div>
        {transactions.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap",
              padding: "var(--space-3) 0", borderBottom: "1px solid var(--border)",
            }}
          >
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
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {categoryNames.slice(0, 6).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onQuickFix(t, name)}
                  style={{
                    padding: "4px 10px", background: "var(--surface-alt)", border: "none",
                    borderRadius: "var(--radius-sm)", color: "var(--text-subtle)", cursor: "pointer", fontSize: 11,
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
