import { Trash2 } from "lucide-react";
import { Table } from "../../../components/ui/Table.jsx";

/**
 * Restyled onto the `Table` primitive (Phase 8.6, `components/ui/Table.jsx`)
 * — the first list this page has ever had of merchant-category rules, per
 * docs/frontend/phase-8-migration-plan.md's Phase 8 ("new
 * pages/MerchantRulesPage.jsx + features/merchant-rules/ — list + delete").
 */
export function RuleList({ rules, onDelete }) {
  const columns = [
    { key: "merchantName", label: "Merchant" },
    { key: "category", label: "Category" },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (rule) => (
        <button
          type="button"
          onClick={() => {
            if (!confirm(`Delete the rule for "${rule.merchantName}"?`)) return;
            onDelete(rule._id);
          }}
          aria-label={`Delete rule for ${rule.merchantName}`}
          title="Delete rule"
          style={{ background: "none", border: "none", color: "var(--negative)", cursor: "pointer", padding: 4, display: "inline-flex" }}
        >
          <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ),
    },
  ];

  return <Table columns={columns} rows={rules} getRowKey={(r) => r._id} emptyMessage="No merchant rules yet" />;
}
