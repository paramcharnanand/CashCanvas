import { StatCard } from "../../../components/ui/StatCard.jsx";

/**
 * Mounted inside the legacy `Dashboard`'s Overview tab (src/App.jsx) — see
 * docs/frontend/phase-8-component-architecture.md's mapping table,
 * "Dashboard's Overview stats/lists (1721–1743, 1832–1926)". Restyled onto
 * `StatCard`/design tokens; the charts row between the stats and
 * `RecentActivity` (1744–1831, the Recharts donut/bar) stays exactly where
 * it is in `Dashboard` — Analytics is its own later phase (8.7), not
 * touched here.
 *
 * Kept as a prop-driven, presentation-only component (all figures already
 * computed by `Dashboard`, e.g. `totalIncome`/`catBreakdown`) rather than
 * recomputing anything, per this session's Phase 8.4 decision to re-host
 * the existing tab bar/Categories/Savings/Transactions behavior unchanged
 * and migrate only the Overview content itself.
 */
export function OverviewHeader({
  userName,
  monthlyCount,
  transactionCount,
  totalIncome,
  totalExpenses,
  netCashflow,
  incomeCount,
  expenseCount,
  fmt,
  onViewTransactions,
}) {
  return (
    <section style={{ marginBottom: "var(--space-8)" }}>
      <h1
        style={{
          font: "var(--text-display-lg)",
          color: "var(--text)",
          margin: "0 0 var(--space-2)",
        }}
      >
        Welcome back, <span style={{ color: "var(--primary)" }}>{userName || "there"}</span>
      </h1>
      <p style={{ font: "var(--text-body-md)", color: "var(--text-subtle)", margin: "0 0 var(--space-6)", maxWidth: 520 }}>
        {monthlyCount > 0
          ? `Showing ${monthlyCount} month${monthlyCount !== 1 ? "s" : ""} of data · ${transactionCount} transactions`
          : "Upload a statement to see your spending breakdown."}
      </p>

      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <StatCard
          label="Total Income"
          value={fmt(totalIncome)}
          sub={`↑ ${incomeCount} transactions`}
          tone="positive"
          onClick={onViewTransactions}
        />
        <StatCard
          label="Total Expenses"
          value={fmt(totalExpenses)}
          sub={`↓ ${expenseCount} transactions`}
          tone="negative"
          onClick={onViewTransactions}
        />
        <StatCard
          label="Net Cashflow"
          value={(netCashflow >= 0 ? "+" : "") + fmt(netCashflow)}
          sub={netCashflow >= 0 ? "Surplus" : "Deficit"}
          tone={netCashflow >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Transactions"
          value={transactionCount}
          sub={`${monthlyCount} months`}
          tone="text-subtle"
          onClick={onViewTransactions}
        />
      </div>
    </section>
  );
}
