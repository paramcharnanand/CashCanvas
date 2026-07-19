import { Card } from "../../../components/ui/Card.jsx";
import { Field } from "../../../components/ui/Field.jsx";
import { Button } from "../../../components/ui/Button.jsx";

/**
 * Restyled from the legacy `Dashboard`'s Savings-tab goal form (`App.jsx`)
 * onto `Card`/`Field`/design tokens. One real behavior change, not just a
 * restyle: an explicit "Save Goal" action, since the goal now actually
 * persists (`PUT /api/savings`, Phase 8.9, closes ADR-007) instead of only
 * ever living in component state — the live preview below still updates
 * reactively on every keystroke exactly as before, independent of whether
 * it's been saved yet.
 */
export function GoalForm({ goal, onChange, onSave, saving, saved }) {
  return (
    <Card style={{ marginBottom: "var(--space-6)" }}>
      <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: "0 0 var(--space-5)" }}>
        Set Your Goal
      </h2>
      <Field
        label="Goal Name"
        value={goal.name}
        onChange={(e) => onChange({ ...goal, name: e.target.value })}
        placeholder="e.g., Emergency fund, Vacation, New car"
        autoComplete="off"
      />
      <div style={{ display: "flex", gap: "var(--space-4)" }}>
        <div style={{ flex: 1 }}>
          <Field
            label="Target Amount ($)"
            type="number"
            value={goal.amount}
            onChange={(e) => onChange({ ...goal, amount: e.target.value })}
            placeholder="5000"
          />
        </div>
        <div style={{ flex: 1 }}>
          <Field
            label="Target Date"
            type="date"
            value={goal.deadline}
            onChange={(e) => onChange({ ...goal, deadline: e.target.value })}
          />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          loading={saving}
          disabled={!goal.name.trim() || !goal.amount || !goal.deadline}
        >
          Save Goal
        </Button>
        {saved && (
          <span style={{ font: "var(--text-body-sm)", color: "var(--positive)" }}>Saved</span>
        )}
      </div>
    </Card>
  );
}
