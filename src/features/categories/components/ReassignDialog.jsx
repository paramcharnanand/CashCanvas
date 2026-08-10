import { useId, useState } from "react";
import { Dialog } from "../../../components/ui/Dialog.jsx";
import { Button } from "../../../components/ui/Button.jsx";

/**
 * Bulk category-assignment dialog — shared by Categories (Uncategorized
 * Transactions bulk-assign) and Transactions (row-selection bulk reassign).
 * Two actions: pick an existing category, or create a new one inline and
 * apply it in the same step.
 */
export function ReassignDialog({ open, onClose, selectedCount, categories, onReassign, onCreateAndReassign, title = "Reassign Category" }) {
  const [newCatName, setNewCatName] = useState("");
  const inputId = useId();

  const close = () => {
    setNewCatName("");
    onClose();
  };

  const submitNewCategory = () => {
    const name = newCatName.trim();
    if (!name) return;
    onCreateAndReassign(name);
    close();
  };

  return (
    <Dialog open={open} onClose={close} labelledBy="reassign-title" maxWidth={380}>
      <div style={{ padding: "var(--space-6)" }}>
        <h2 id="reassign-title" style={{ font: "var(--text-heading-md)", color: "var(--text)", margin: "0 0 var(--space-2)" }}>
          {title}
        </h2>
        <p style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", margin: "0 0 var(--space-5)" }}>
          {selectedCount} transaction{selectedCount !== 1 ? "s" : ""} will be updated
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxHeight: 280, overflowY: "auto" }}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => { onReassign(cat); close(); }}
              style={{
                padding: "10px 14px", background: "var(--surface-alt)",
                border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                color: "var(--text)", cursor: "pointer", textAlign: "left",
                font: "var(--text-body-sm)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-container, var(--surface-alt))"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ marginTop: "var(--space-4)", borderTop: "1px solid var(--border)", paddingTop: "var(--space-4)" }}>
          <label htmlFor={inputId} style={{ display: "block", font: "var(--text-label)", color: "var(--text-subtle)", marginBottom: "var(--space-2)" }}>
            Create new category
          </label>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start" }}>
            <input
              id={inputId}
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitNewCategory(); }}
              placeholder="e.g. Pet Care, Education..."
              autoComplete="off"
              style={{
                flex: 1, padding: "11px var(--space-4)", boxSizing: "border-box",
                background: "var(--surface-alt)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", color: "var(--text)",
                font: "var(--text-body-md)", fontFamily: "var(--font-body)",
              }}
            />
            <Button variant="primary" size="sm" onClick={submitNewCategory} disabled={!newCatName.trim()}>
              Add
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
