import { useState } from "react";
import { Link } from "react-router-dom";
import { Tag, Upload as UploadIcon, List } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { Button } from "../components/ui/Button.jsx";
import { StatCard } from "../components/ui/StatCard.jsx";
import { useCategoriesData } from "../features/categories/hooks/useCategoriesData.js";
import { CategoryGrid } from "../features/categories/components/CategoryGrid.jsx";
import { NewCategoryDialog } from "../features/categories/components/NewCategoryDialog.jsx";
import { UncategorizedPanel } from "../features/categories/components/UncategorizedPanel.jsx";
import { ReassignDialog } from "../features/categories/components/ReassignDialog.jsx";

/**
 * Mounted at "/categories" — the primary category-based transaction
 * management surface: category cards → Uncategorized Transactions (bulk
 * multi-select assign) → View All Transactions.
 */
export default function CategoriesPage() {
  const {
    transactions, loading, categories, otherTxns, categorizedPct, categorizedCount,
    createCategory, deleteCategory, setKeywords, bulkAssign, bulkCreateAndAssign,
  } = useCategoriesData();
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [reassignOpen, setReassignOpen] = useState(false);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allUncategorizedSelected = otherTxns.length > 0 && otherTxns.every((t) => selectedIds.has(t.id));
  const toggleSelectAllUncategorized = () => {
    setSelectedIds(allUncategorizedSelected ? new Set() : new Set(otherTxns.map((t) => t.id)));
  };

  const handleBulkAssign = (categoryName) => {
    bulkAssign(Array.from(selectedIds), categoryName);
    setSelectedIds(new Set());
  };

  const handleBulkCreateAndAssign = (categoryName) => {
    bulkCreateAndAssign(categoryName, Array.from(selectedIds)).finally(() => setSelectedIds(new Set()));
  };

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

      <div style={{ marginBottom: "var(--space-6)" }}>
        <CategoryGrid
          categories={categories}
          onDelete={deleteCategory}
          onSetKeywords={setKeywords}
          onNewCategory={() => setNewCatOpen(true)}
        />
      </div>

      {selectedIds.size > 0 && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)", marginBottom: "var(--space-3)",
            background: "var(--positive-soft)", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--positive)",
          }}
        >
          <span style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--primary)" }}>
            {selectedIds.size} selected
          </span>
          <Button variant="primary" size="sm" onClick={() => setReassignOpen(true)}>
            Move to Category
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <UncategorizedPanel
        transactions={otherTxns}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelected}
        onToggleSelectAll={toggleSelectAllUncategorized}
      />

      <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--space-6)" }}>
        <Link to="/transactions" style={{ textDecoration: "none" }}>
          <Button variant="secondary">
            <List size={16} strokeWidth={1.75} aria-hidden="true" />
            View All Transactions
          </Button>
        </Link>
      </div>

      <NewCategoryDialog
        open={newCatOpen}
        onClose={() => setNewCatOpen(false)}
        onCreate={createCategory}
      />

      <ReassignDialog
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        selectedCount={selectedIds.size}
        categories={categories.map((c) => c.name)}
        onReassign={handleBulkAssign}
        onCreateAndReassign={handleBulkCreateAndAssign}
        title="Move to Category"
      />
    </div>
  );
}
