import { Link } from "react-router-dom";
import { BarChart3, Upload as UploadIcon } from "lucide-react";
import { Card } from "../components/ui/Card.jsx";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { Button } from "../components/ui/Button.jsx";
import { useAnalyticsData } from "../features/analytics/hooks/useAnalyticsData.js";
import { SpendingDonut } from "../features/analytics/components/SpendingDonut.jsx";
import { MonthlyBarChart } from "../features/analytics/components/MonthlyBarChart.jsx";
import { CashFlowLine } from "../features/analytics/components/CashFlowLine.jsx";

/**
 * Mounted at "/analytics" (see router.jsx) — the donut/bar/line block
 * split out of the legacy `Dashboard`'s Overview tab (Phase 8.4 left it
 * untouched by design, ADR-025 — "that's Analytics, Phase 8.7, not this
 * phase") onto the standardized chart system, per docs/frontend/
 * phase-8-migration-plan.md's Phase 7. Per that phase's own "Old
 * implementation removed" note, the Charts Row is deleted from `Dashboard`
 * (`App.jsx`) now that it lives here — Overview goes back to being the
 * lightweight summary Phase 8.4 originally described (hero, stats,
 * recurring, recent activity), not a duplicate of this page.
 */
export default function AnalyticsPage() {
  const { transactions, loading, catBreakdown, monthlyData } = useAnalyticsData();

  if (loading) return null;

  if (transactions.length === 0) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
        <EmptyState
          icon={BarChart3}
          headingLevel="h1"
          headline="No data to analyze yet"
          body="Upload a statement to see spending trends and cash flow here."
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
      <h1 style={{ font: "var(--text-display-lg)", color: "var(--text)", margin: "0 0 var(--space-6)" }}>
        Analytics
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)", marginBottom: "var(--space-5)" }}>
        <Card>
          <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: "0 0 var(--space-4)" }}>
            Spending Composition
          </h2>
          <SpendingDonut catBreakdown={catBreakdown} />
        </Card>

        <Card>
          <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: "0 0 var(--space-4)" }}>
            Monthly Overview
          </h2>
          <MonthlyBarChart monthlyData={monthlyData} />
        </Card>
      </div>

      <Card>
        <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: "0 0 var(--space-4)" }}>
          Cash Flow
        </h2>
        <CashFlowLine monthlyData={monthlyData} />
      </Card>
    </div>
  );
}
