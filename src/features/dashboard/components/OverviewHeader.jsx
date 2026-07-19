import { StatCard } from "../../../components/ui/StatCard.jsx";

/**
 * Mounted directly on `pages/DashboardPage.jsx` as of Phase 10 (final
 * cleanup) — originally built Phase 8.4 inside the legacy `Dashboard`'s
 * Overview tab (`App.jsx`, deleted this phase), unchanged since:
 * a prop-driven, presentation-only component (all figures computed by
 * `features/dashboard/hooks/useDashboardData.js`) rather than recomputing
 * anything itself.
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
