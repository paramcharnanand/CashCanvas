import { useState } from "react";
import { Link } from "react-router-dom";
import { Tag, Upload as UploadIcon } from "lucide-react";
import { Card } from "../components/ui/Card.jsx";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { Button } from "../components/ui/Button.jsx";
import { StatCard } from "../components/ui/StatCard.jsx";
import { useCategoriesData } from "../features/categories/hooks/useCategoriesData.js";
import { CategoryGrid } from "../features/categories/components/CategoryGrid.jsx";
import { NewCategoryDialog } from "../features/categories/components/NewCategoryDialog.jsx";
import { UncategorizedPanel } from "../features/categories/components/UncategorizedPanel.jsx";

const fmt = (v) => "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Mounted at "/categories" (see router.jsx) — the Categories tab split out
 * of the legacy `Dashboard` (`App.jsx`) onto the standardized component
 * system, per docs/frontend/phase-8-migration-plan.md's Phase 8. Same
 * "separate route, no shared state with `LegacyWorkspace`" pattern as
 * Transactions/Analytics.
 */
export default function CategoriesPage() {
  const {
    transactions, loading, categories, otherTxns, categorizedPct, categorizedCount,
    totalExpenses, createCategory, deleteCategory, setKeywords, quickFix,
  } = useCategoriesData();
  const [newCatOpen, setNewCatOpen] = useState(false);

  if (loading) return null;

  if (transactions.length === 0) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
        <EmptyState
          icon={Tag}
          headingLevel="h1"
          headline="No data to categorize yet"
          body="Upload a statement to start organizing your spending by category."
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

  const expenseCount = categorizedCount + otherTxns.length;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
      <h1 style={{ font: "var(--text-display-lg)", color: "var(--text)", margin: "0 0 var(--space-6)" }}>
        Categories
      </h1>

      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", marginBottom: "var(--space-6)" }}>
        <StatCard label="Categorized" value={`${categorizedPct}%`} sub={`${categorizedCount} of ${expenseCount} transactions`} tone="positive" />
        <StatCard
          label="Needs attention"
          value={String(otherTxns.length)}
          sub={otherTxns.length > 0 ? "uncategorized" : "all set"}
          tone={otherTxns.length > 0 ? "negative" : "positive"}
        />
      </div>

      {categories.length > 0 && (
        <Card style={{ marginBottom: "var(--space-6)" }}>
          <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: "0 0 var(--space-4)" }}>
            Category breakdown
          </h2>
          {categories.map((c) => (
            <div key={c.name} style={{ marginBottom: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                <span style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--text)" }}>{c.name}</span>
                <span style={{ font: "13px var(--font-numeral)", color: "var(--text-subtle)" }}>{fmt(c.total)}</span>
              </div>
              <div style={{ height: 3, background: "var(--surface-alt)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0}%`, background: c.color, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </Card>
      )}

      <div style={{ marginBottom: "var(--space-6)" }}>
        <CategoryGrid
          categories={categories}
          onDelete={deleteCategory}
          onSetKeywords={setKeywords}
          onNewCategory={() => setNewCatOpen(true)}
        />
      </div>

      <UncategorizedPanel
        transactions={otherTxns}
        categoryNames={categories.map((c) => c.name)}
        onQuickFix={quickFix}
      />

      <NewCategoryDialog
        open={newCatOpen}
        onClose={() => setNewCatOpen(false)}
        onCreate={createCategory}
      />
    </div>
  );
}
