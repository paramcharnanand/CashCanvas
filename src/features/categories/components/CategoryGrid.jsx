import { Tag, Plus } from "lucide-react";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { CategoryCard } from "./CategoryCard.jsx";

/**
 * Restyled from the legacy `Dashboard`'s Categories-tab card grid
 * (`App.jsx`) — same visibility rule (only categories with real
 * transactions or configured keywords render a card), now onto `Card`/
 * `EmptyState`/design tokens instead of hand-typed inline styles.
 */
export function CategoryGrid({ categories, onDelete, onSetKeywords, onNewCategory }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <div style={{ font: "var(--text-label)", color: "var(--text-subtle)" }}>Categories</div>
        <Button variant="secondary" size="sm" onClick={onNewCategory}>
          <Plus size={14} strokeWidth={2} aria-hidden="true" />
          New Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState icon={Tag} headline="No categories yet" body="Categories appear here once transactions are auto-categorized, or you create one." />
      ) : (
        <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
          {categories.map((category) => (
            <CategoryCard key={category.name} category={category} onDelete={onDelete} onSetKeywords={onSetKeywords} />
          ))}
        </div>
      )}
    </div>
  );
}
