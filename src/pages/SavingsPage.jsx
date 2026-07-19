import { useState } from "react";
import { Link } from "react-router-dom";
import { Target, Upload as UploadIcon } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { Button } from "../components/ui/Button.jsx";
import { StatCard } from "../components/ui/StatCard.jsx";
import { Card } from "../components/ui/Card.jsx";
import { useSavingsData } from "../features/savings/hooks/useSavingsData.js";
import { GoalForm } from "../features/savings/components/GoalForm.jsx";
import { CutPlanner } from "../features/savings/components/CutPlanner.jsx";

const fmt = (v) => "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Mounted at "/savings" (see router.jsx) — the Savings tab split out of the
 * legacy `Dashboard` (`App.jsx`) onto the standardized component system,
 * per docs/frontend/phase-8-migration-plan.md's Phase 9. Same goal-form/
 * cut-planner logic (the audit's own "best client-side logic in the app" —
 * kept, not rewritten), now actually persisted (`useSavingsData.js`, closes
 * ADR-007) instead of vanishing on reload.
 */
export default function SavingsPage() {
  const {
    transactions, loading, savingsGoal, setSavingsGoal, goalSaved, saveGoal,
    savingsSuggestion, catBreakdown, numMonths,
  } = useSavingsData();
  const [saving, setSaving] = useState(false);

  if (loading) return null;

  if (transactions.length === 0) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
        <EmptyState
          icon={Target}
          headingLevel="h1"
          headline="No data to plan against yet"
          body="Upload a statement so savings suggestions can be based on your real spending."
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

  const handleSave = async () => {
    setSaving(true);
    await saveGoal(savingsGoal);
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
      <h1 style={{ font: "var(--text-display-lg)", color: "var(--text)", margin: "0 0 var(--space-2)" }}>
        Savings Goals
      </h1>
      <p style={{ font: "var(--text-body-md)", color: "var(--text-subtle)", margin: "0 0 var(--space-6)" }}>
        Set a target and get personalized suggestions based on your spending patterns.
      </p>

      <GoalForm goal={savingsGoal} onChange={setSavingsGoal} onSave={handleSave} saving={saving} saved={goalSaved} />

      {savingsSuggestion && (
        <>
          <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", marginBottom: "var(--space-5)" }}>
            <StatCard label="Monthly Target" value={fmt(savingsSuggestion.monthly)} sub={`${savingsSuggestion.monthsLeft} months to go`} tone="primary" />
            <StatCard
              label="Avg Monthly Surplus"
              value={(savingsSuggestion.surplus >= 0 ? "+" : "") + fmt(savingsSuggestion.surplus)}
              sub="Income minus expenses"
              tone={savingsSuggestion.surplus >= 0 ? "positive" : "negative"}
            />
            <StatCard
              label="Feasibility"
              value={savingsSuggestion.feasible ? "On Track" : "Needs Adjustment"}
              sub={savingsSuggestion.feasible ? "Current spending supports this goal" : "You may need to reduce spending"}
              tone={savingsSuggestion.feasible ? "positive" : "negative"}
            />
          </div>

          <Card>
            <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: "0 0 var(--space-4)" }}>
              {savingsSuggestion.goalName ? `Plan: ${savingsSuggestion.goalName}` : "Savings Plan"}
            </h2>
            <div style={{ font: "var(--text-body-md)", lineHeight: 1.8, color: "var(--text-subtle)" }}>
              <p style={{ margin: "0 0 var(--space-3)" }}>
                To save <strong style={{ color: "var(--text)" }}>{fmt(savingsSuggestion.target)}</strong> in{" "}
                <strong style={{ color: "var(--text)" }}>{savingsSuggestion.monthsLeft} months</strong>, you need to set aside{" "}
                <strong style={{ color: "var(--primary)" }}>{fmt(savingsSuggestion.monthly)}/month</strong>.
              </p>
              {savingsSuggestion.feasible ? (
                <p style={{ margin: 0 }}>
                  Your current surplus of <strong style={{ color: "var(--positive)" }}>{fmt(savingsSuggestion.surplus)}/month</strong> covers the savings target.
                </p>
              ) : (
                <p style={{ margin: 0 }}>
                  You'd need to reduce monthly expenses by about{" "}
                  <strong style={{ color: "var(--negative)" }}>{fmt(savingsSuggestion.monthly - Math.max(0, savingsSuggestion.surplus))}</strong> to meet this goal.
                  Use the planner below to choose where to cut.
                </p>
              )}
            </div>
          </Card>

          <CutPlanner catBreakdown={catBreakdown} numMonths={numMonths} savingsSuggestion={savingsSuggestion} />
        </>
      )}
    </div>
  );
}
