import { Link } from "react-router-dom";
import { Store } from "lucide-react";
import { Card } from "../../../components/ui/Card.jsx";
import { Button } from "../../../components/ui/Button.jsx";

/**
 * Links out to the existing standalone `/merchant-rules` page rather than
 * inlining its CRUD UI — Merchant Rules moved out of the bottom nav into
 * Settings as of the Categories/Settings IA rework, keeping the page itself
 * unchanged.
 */
export function MerchantRulesSection() {
  return (
    <Card style={{ marginBottom: "var(--space-5)" }}>
      <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: "0 0 var(--space-2)" }}>Merchant Rules</h2>
      <p style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", margin: "0 0 var(--space-4)" }}>
        Manage the merchant-to-category rules that power automatic categorization.
      </p>
      <Link to="/merchant-rules" style={{ textDecoration: "none" }}>
        <Button variant="secondary">
          <Store size={16} strokeWidth={1.75} aria-hidden="true" />
          Manage Merchant Rules
        </Button>
      </Link>
    </Card>
  );
}
