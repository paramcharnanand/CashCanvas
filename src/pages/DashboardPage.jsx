import { Home, Upload as UploadIcon, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { Button } from "../components/ui/Button.jsx";
import { useDashboardData } from "../features/dashboard/hooks/useDashboardData.js";
import { OverviewHeader } from "../features/dashboard/components/OverviewHeader.jsx";
import { RecentActivity } from "../features/dashboard/components/RecentActivity.jsx";
import { DownloadMenu } from "../features/dashboard/components/DownloadMenu.jsx";

const fmt = (v) => "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Mounted at "/dashboard" (see router.jsx) — the real authenticated landing
 * as of Phase 10 (final cleanup), per docs/frontend/
 * phase-8-component-architecture.md's routing architecture: "`/dashboard`
 * always exists; a user with no data sees `DashboardPage` render its
 * `EmptyState`... rather than being routed to a categorically different
 * page." Replaces the legacy `LegacyWorkspace`/`UploadScreen`/`Dashboard`
 * two-screen gate pattern (`App.jsx`, deleted this phase) outright — see
 * ROADMAP.md's Phase 10 completion note for the full list of what moved
 * where and the two product decisions made explicitly before this cutover
 * (rebuilding "Try with sample data" here, porting the bulk reassign-
 * category flow onto `/transactions`).
 */
export default function DashboardPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const {
    loading, isSample, fileName, transactions,
    totalIncome, totalExpenses, netCashflow,
    catBreakdown, monthlyData, recurring, recentTransactions,
    loadSampleData,
  } = useDashboardData();

  if (loading) return null;

  const onViewTransactions = () => navigate("/transactions");

  if (transactions.length === 0) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
        <EmptyState
          icon={Home}
          headingLevel="h1"
          headline="Welcome to CashCanvas"
          body="Upload a statement to see your spending breakdown, or try it out with sample data first."
          action={
            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center", flexWrap: "wrap" }}>
              <Link to="/upload" style={{ textDecoration: "none" }}>
                <Button variant="primary" size="sm">
                  <UploadIcon size={16} strokeWidth={1.75} aria-hidden="true" />
                  Upload a statement
                </Button>
              </Link>
              <Button variant="secondary" size="sm" onClick={loadSampleData}>
                <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />
                Try with sample data
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-4)" }}>
        {isSample && (
          <div
            style={{
              flex: 1, display: "flex", alignItems: "center", gap: "var(--space-2)",
              font: "var(--text-body-sm)", color: "var(--text-subtle)",
            }}
          >
            <Sparkles size={15} strokeWidth={1.75} aria-hidden="true" />
            You&apos;re viewing sample data —{" "}
            <Link to="/upload" style={{ color: "var(--primary)", fontWeight: 600 }}>upload a real statement</Link>{" "}
            any time.
          </div>
        )}
        <DownloadMenu transactions={transactions} catBreakdown={catBreakdown} monthlyData={monthlyData} fileName={fileName} />
      </div>

      <OverviewHeader
        userName={auth?.user?.name?.split(" ")[0]}
        monthlyCount={monthlyData.length}
        transactionCount={transactions.length}
        totalIncome={totalIncome}
        totalExpenses={totalExpenses}
        netCashflow={netCashflow}
        incomeCount={transactions.filter((t) => t.amount > 0).length}
        expenseCount={transactions.filter((t) => t.amount < 0).length}
        fmt={fmt}
        onViewTransactions={onViewTransactions}
      />

      <RecentActivity
        recurring={recurring}
        recentTransactions={recentTransactions}
        fmt={fmt}
        onViewTransactions={onViewTransactions}
      />
    </div>
  );
}
