import { Store } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { useMerchantRulesData } from "../features/merchant-rules/hooks/useMerchantRulesData.js";
import { RuleList } from "../features/merchant-rules/components/RuleList.jsx";

/**
 * Mounted at "/merchant-rules" (see router.jsx) — a genuinely new screen
 * (approved scope addition, per docs/frontend/phase-8-migration-plan.md's
 * Phase 8) for a mechanism that already existed with no way to view or
 * manage it: every category reassignment (legacy `Dashboard`'s Transactions
 * tab, and now `CategoriesPage`'s uncategorized quick-fix) has always
 * written a merchant → category rule via `POST /api/merchant-rules`, but
 * until this page there was no way to see the list or remove a rule that
 * was no longer wanted.
 */
export default function MerchantRulesPage() {
  const { rules, loading, deleteRule } = useMerchantRulesData();

  if (loading) return null;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
      <h1 style={{ font: "var(--text-display-lg)", color: "var(--text)", margin: "0 0 var(--space-2)" }}>
        Merchant Rules
      </h1>
      <p style={{ font: "var(--text-body-md)", color: "var(--text-subtle)", margin: "0 0 var(--space-6)" }}>
        Categories learned from reassigning a transaction. Future transactions from these merchants
        are categorized automatically.
      </p>

      {rules.length === 0 ? (
        <EmptyState
          icon={Store}
          headline="No merchant rules yet"
          body="Reassign a transaction's category — on Transactions or the Categories quick-fix — and the rule will show up here."
        />
      ) : (
        <RuleList rules={rules} onDelete={deleteRule} />
      )}
    </div>
  );
}
