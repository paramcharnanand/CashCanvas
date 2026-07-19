import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "../../../contexts/ThemeContext.jsx";
import { Card } from "../../../components/ui/Card.jsx";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * The Theme System's first real settings-page control (Phase 8.9) — until
 * now the only way to change theme was `Header.jsx`'s single cycling
 * button. A real tri-state choice, not a cycle: `aria-pressed` marks the
 * active option directly instead of requiring a screen-reader user to
 * infer state from a single button's changing label.
 */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <Card style={{ marginBottom: "var(--space-5)" }}>
      <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: "0 0 var(--space-4)" }}>Theme</h2>
      <div role="group" aria-label="Theme preference" style={{ display: "flex", gap: "var(--space-2)" }}>
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = preference === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setPreference(value)}
              aria-pressed={active}
              style={{
                flex: 1,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                padding: "var(--space-4)",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                background: active ? "var(--positive-soft)" : "var(--surface-alt)",
                color: active ? "var(--primary)" : "var(--text-subtle)",
                cursor: "pointer",
              }}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              <span style={{ font: "var(--text-body-sm)", fontWeight: active ? 700 : 500 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
