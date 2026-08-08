import { useState } from "react";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { Table } from "../../../components/ui/Table.jsx";
import { useToast } from "../../../contexts/ToastContext.jsx";

const iconButtonStyle = (color) => ({
  background: "none", border: "none", color, cursor: "pointer", padding: 4, display: "inline-flex",
});

export function RuleList({ rules, allCategories, onDelete, onUpdate }) {
  const [editingId, setEditingId] = useState(null);
  const [draftCategory, setDraftCategory] = useState("");
  const { show } = useToast();

  const startEdit = (rule) => {
    setEditingId(rule._id);
    setDraftCategory(rule.category);
  };

  const saveEdit = (rule) => {
    const category = draftCategory;
    setEditingId(null);
    onUpdate(rule._id, category).catch(() => {
      show("Couldn't update the rule. Please try again.", { variant: "negative" });
    });
  };

  const columns = [
    { key: "merchantName", label: "Merchant" },
    {
      key: "category",
      label: "Category",
      render: (rule) =>
        editingId === rule._id ? (
          <select
            value={draftCategory}
            onChange={(e) => setDraftCategory(e.target.value)}
            autoFocus
            style={{
              font: "var(--text-body-sm)", color: "var(--text)", background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "2px 6px",
            }}
          >
            {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          rule.category
        ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (rule) =>
        editingId === rule._id ? (
          <span style={{ display: "inline-flex", gap: 4 }}>
            <button type="button" onClick={() => saveEdit(rule)} aria-label="Save" title="Save" style={iconButtonStyle("var(--positive)")}>
              <Check size={15} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setEditingId(null)} aria-label="Cancel editing" title="Cancel" style={iconButtonStyle("var(--text-subtle)")}>
              <X size={15} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </span>
        ) : (
          <span style={{ display: "inline-flex", gap: 4 }}>
            <button type="button" onClick={() => startEdit(rule)} aria-label={`Edit category for ${rule.merchantName}`} title="Edit rule" style={iconButtonStyle("var(--text-subtle)")}>
              <Pencil size={15} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirm(`Delete the rule for "${rule.merchantName}"?`)) return;
                onDelete(rule._id).catch(() => {
                  show("Couldn't delete the rule. Please try again.", { variant: "negative" });
                });
              }}
              aria-label={`Delete rule for ${rule.merchantName}`}
              title="Delete rule"
              style={iconButtonStyle("var(--negative)")}
            >
              <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </span>
        ),
    },
  ];

  return <Table columns={columns} rows={rules} getRowKey={(r) => r._id} emptyMessage="No merchant rules yet" />;
}
