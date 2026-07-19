import { useState } from "react";
import { Dialog } from "../../../components/ui/Dialog.jsx";
import { Field } from "../../../components/ui/Field.jsx";
import { Button } from "../../../components/ui/Button.jsx";

// The reconciled chart palette (`--chart-1..6`, `tokens.css`) — replaces the
// legacy Categories tab's own hardcoded 8-color array, which was a second,
// independent palette from the Dashboard's category-breakdown `PALETTE`
// (audit §5's "two-palette problem"). Both the donut chart (Phase 8.7's
// `SpendingDonut.jsx`) and this picker now draw from the same source.
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

const initialForm = { name: "", icon: "🏷️", color: COLORS[0] };

export function NewCategoryDialog({ open, onClose, onCreate }) {
  const [form, setForm] = useState(initialForm);

  const close = () => {
    setForm(initialForm);
    onClose();
  };

  const submit = () => {
    if (!form.name.trim()) return;
    onCreate({ categoryName: form.name.trim(), icon: form.icon, color: form.color });
    close();
  };

  return (
    <Dialog open={open} onClose={close} labelledBy="new-category-title" maxWidth={380}>
      <div style={{ padding: "var(--space-6)" }}>
        <h2 id="new-category-title" style={{ font: "var(--text-heading-md)", color: "var(--text)", margin: "0 0 var(--space-5)" }}>
          New Category
        </h2>

        <Field
          label="Name"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="e.g. Pet Care, Education..."
          autoComplete="off"
        />

        <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", font: "var(--text-label)", color: "var(--text-subtle)", marginBottom: "var(--space-2)" }}>
              Icon / Emoji
            </label>
            <input
              value={form.icon}
              onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
              placeholder="🏷️"
              style={{
                width: "100%", padding: "10px", boxSizing: "border-box", textAlign: "center",
                background: "var(--surface-alt)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 20, outline: "none",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", font: "var(--text-label)", color: "var(--text-subtle)", marginBottom: "var(--space-2)" }}>
              Color
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 6 }}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, color: c }))}
                  aria-label={`Color ${c}`}
                  aria-pressed={form.color === c}
                  style={{
                    width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer",
                    border: form.color === c ? "3px solid var(--text)" : "2px solid transparent",
                    boxSizing: "border-box", padding: 0,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <Button variant="secondary" style={{ flex: 1 }} onClick={close}>Cancel</Button>
          <Button variant="primary" style={{ flex: 2 }} onClick={submit} disabled={!form.name.trim()}>
            Create Category
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
