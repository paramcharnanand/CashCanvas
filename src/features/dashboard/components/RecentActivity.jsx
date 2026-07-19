import { Repeat, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "../../../components/ui/Card.jsx";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";

/**
 * Mounted inside the legacy `Dashboard`'s Overview tab (src/App.jsx),
 * directly below the charts row — see docs/frontend/
 * phase-8-component-architecture.md's mapping table, "Dashboard's Overview
 * stats/lists (1721–1743, 1832–1926)". Restyled onto `Card`/`EmptyState`/
 * design tokens; same two-panel (Recurring Payments, Recent Transactions)
 * layout and data as the original.
 */
function RecurringRow({ desc, avg, category, isFixed, fmt }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3) 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--radius-sm)",
          flexShrink: 0,
          background: "var(--surface-alt)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          font: "700 12px var(--font-numeral)",
          color: "var(--text-subtle)",
        }}
      >
        {desc[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {desc.length > 22 ? desc.slice(0, 22).trim() + "…" : desc}
        </div>
        <div style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", marginTop: 2 }}>
          {category} · {isFixed ? "Fixed" : "Variable"}
        </div>
      </div>
      <div style={{ font: "600 13px var(--font-numeral)", color: "var(--text)", whiteSpace: "nowrap", flexShrink: 0 }}>
        {fmt(avg)}<span style={{ color: "var(--text-subtle)", fontWeight: 400 }}>/mo</span>
      </div>
    </div>
  );
}

function TransactionRow({ id, desc, date, category, amount, fmt }) {
  const isIncome = amount >= 0;
  return (
    <div
      key={id}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3) 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "var(--radius-sm)",
          flexShrink: 0,
          background: isIncome ? "var(--positive-soft)" : "var(--surface-alt)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isIncome
          ? <ArrowDownRight size={18} strokeWidth={1.75} color="var(--positive)" aria-hidden="true" />
          : <ArrowUpRight size={18} strokeWidth={1.75} color="var(--text-subtle)" aria-hidden="true" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {desc}
        </div>
        <div style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", marginTop: 2 }}>
          {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {category}
        </div>
      </div>
      <div style={{ font: "700 14px var(--font-numeral)", color: isIncome ? "var(--positive)" : "var(--text)", whiteSpace: "nowrap", flexShrink: 0 }}>
        {isIncome ? "+" : ""}{fmt(amount)}
      </div>
    </div>
  );
}

export function RecentActivity({ recurring, recentTransactions, fmt, onViewTransactions }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-5)", flexWrap: "wrap" }}>
      <Card style={{ flex: "1 1 400px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
          <div>
            <div style={{ font: "var(--text-heading-sm)", color: "var(--text)" }}>Recurring Payments</div>
            <div style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", marginTop: 2 }}>Regular charges detected</div>
          </div>
          <Repeat size={20} strokeWidth={1.75} color="var(--text-subtle)" aria-hidden="true" />
        </div>
        {recurring.length === 0 ? (
          <EmptyState icon={Repeat} body="No recurring payments detected" />
        ) : (
          // tabIndex makes this real scroll container keyboard-reachable
          // (axe scrollable-region-focusable) — found in Phase 8.7 once
          // Analytics' chart removal stopped masking it under the same
          // rule ID in the a11y allowlist; a real, pre-existing Phase 8.4
          // gap, not something this list introduced.
          <div tabIndex={0} style={{ maxHeight: 300, overflowY: "auto" }}>
            {recurring.slice(0, 8).map((r) => <RecurringRow key={r.desc} {...r} fmt={fmt} />)}
          </div>
        )}
      </Card>

      <Card style={{ flex: "1 1 400px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
          <div>
            <div style={{ font: "var(--text-heading-sm)", color: "var(--text)" }}>Recent Transactions</div>
            <div style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", marginTop: 2 }}>Last 3 transactions</div>
          </div>
          <button
            type="button"
            onClick={onViewTransactions}
            style={{
              font: "var(--text-body-sm)", fontWeight: 600, color: "var(--primary)",
              background: "none", border: "none", cursor: "pointer", padding: 0, whiteSpace: "nowrap",
            }}
          >
            View All Transactions
          </button>
        </div>
        {recentTransactions.length === 0 ? (
          <EmptyState icon={ArrowUpRight} body="No transactions yet" />
        ) : (
          recentTransactions.map((t) => <TransactionRow key={t.id} {...t} fmt={fmt} />)
        )}
      </Card>
    </div>
  );
}
