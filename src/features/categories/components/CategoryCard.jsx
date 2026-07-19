import { useState } from "react";
import { X } from "lucide-react";
import { Card } from "../../../components/ui/Card.jsx";

const fmt = (v) => "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Restyled from the legacy `Dashboard`'s Categories-tab card (`App.jsx`)
 * onto `Card`/design tokens — same shape (icon, name, transaction count,
 * total, % of spending, expandable keyword editor) and same two real
 * mutations (delete category, add/remove a keyword), both persisted via
 * `useCategoriesData`'s `deleteCategory`/`setKeywords`.
 */
export function CategoryCard({ category, onDelete, onSetKeywords }) {
  const [editing, setEditing] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw || category.keywords.includes(kw)) return;
    onSetKeywords(category, [...category.keywords, kw]);
    setNewKeyword("");
  };

  const removeKeyword = (kw) => {
    onSetKeywords(category, category.keywords.filter((k) => k !== kw));
  };

  return (
    <Card
      style={{
        flex: "1 1 220px",
        maxWidth: 300,
        borderLeft: `3px solid ${editing ? "var(--primary)" : category.color || "var(--chart-1)"}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
        {category.icon && <span style={{ fontSize: 16 }}>{category.icon}</span>}
        <span style={{ font: "var(--text-body-md)", fontWeight: 600, flex: 1, minWidth: 0, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {category.name}
        </span>
        <span style={{ font: "var(--text-label)", color: "var(--text-subtle)" }}>{category.count}</span>
        {category.id && (
          <button
            type="button"
            onClick={() => {
              if (!confirm(`Delete category "${category.name}"?`)) return;
              onDelete(category.id);
            }}
            title="Delete category"
            aria-label={`Delete category ${category.name}`}
            style={{ background: "none", border: "none", color: "var(--negative)", cursor: "pointer", padding: 2, opacity: 0.7, display: "flex" }}
          >
            <X size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>

      <div style={{ font: "600 22px var(--font-numeral)", color: "var(--text)", marginBottom: "var(--space-3)" }}>
        {fmt(category.total)}
      </div>

      <div style={{ marginBottom: editing ? "var(--space-3)" : 0 }}>
        <div style={{ height: 2, background: "var(--surface-alt)", borderRadius: 1, overflow: "hidden", marginBottom: 4 }}>
          <div style={{ height: "100%", width: `${Math.min(category.pct, 100)}%`, background: category.color || "var(--chart-1)", borderRadius: 1 }} />
        </div>
        <div style={{ font: "var(--text-label)", color: "var(--text-subtle)" }}>{category.pct.toFixed(1)}% of spending</div>
      </div>

      {editing ? (
        <div>
          {category.keywords.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, margin: "var(--space-3) 0 var(--space-2)" }}>
              {category.keywords.map((kw) => (
                <span
                  key={kw}
                  style={{
                    font: "var(--text-label)", padding: "3px 8px", borderRadius: "var(--radius-sm)",
                    background: "var(--positive-soft)", color: "var(--primary)",
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => removeKeyword(kw)}
                    aria-label={`Remove keyword ${kw}`}
                    style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", padding: 0, lineHeight: 1, display: "flex" }}
                  >
                    <X size={11} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, marginTop: "var(--space-3)" }}>
            <input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addKeyword(); }}
              placeholder="Type merchant name..."
              aria-label={`Add a keyword to ${category.name}`}
              autoFocus
              style={{
                flex: 1, padding: "8px var(--space-3)", background: "var(--surface-alt)",
                border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                color: "var(--text)", fontSize: 13, outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => setEditing(false)}
              style={{
                padding: "8px var(--space-4)", background: "var(--primary)", border: "none",
                borderRadius: "var(--radius-sm)", color: "var(--on-primary)", cursor: "pointer", fontSize: 13,
              }}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          style={{
            marginTop: "var(--space-3)", width: "100%", padding: 7, background: "transparent",
            border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-sm)",
            color: "var(--text-subtle)", cursor: "pointer", fontSize: 12,
          }}
        >
          {category.keywords.length > 0 ? `+ ${category.keywords.length} custom keyword${category.keywords.length > 1 ? "s" : ""}` : "+ Add merchant"}
        </button>
      )}
    </Card>
  );
}
