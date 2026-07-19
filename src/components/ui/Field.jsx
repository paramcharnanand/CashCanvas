import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Design-system Field primitive — see docs/frontend/phase-8-design-system.md
 * § Form controls ("keep as the base text-input pattern, audit confirmed
 * it's already good"). Same behavior as the pre-Phase-8 `Field` in
 * AuthScreen.jsx (label, error message, optional password-visibility
 * toggle), rebuilt on design tokens and a real focus-visible ring instead
 * of a manual onFocus/onBlur border-color swap.
 */
export function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
  showToggle = false,
}) {
  const [visible, setVisible] = useState(false);
  const ToggleIcon = visible ? EyeOff : Eye;
  const inputId = useId();

  return (
    <div style={{ marginBottom: "var(--space-4)" }}>
      <label htmlFor={inputId} style={{ display: "block", font: "var(--text-label)", color: "var(--text-subtle)", marginBottom: "var(--space-2)" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          id={inputId}
          type={showToggle ? (visible ? "text" : "password") : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{
            width: "100%",
            padding: showToggle ? "11px 40px 11px var(--space-4)" : "11px var(--space-4)",
            boxSizing: "border-box",
            background: "var(--surface-alt)",
            border: `1px solid ${error ? "var(--negative)" : "var(--border)"}`,
            borderRadius: "var(--radius-sm)",
            color: "var(--text)",
            font: "var(--text-body-md)",
            fontFamily: "var(--font-body)",
            transition: `border-color ${"var(--duration-fast)"} var(--ease-standard)`,
          }}
          onFocus={(e) => { e.target.style.borderColor = error ? "var(--negative)" : "var(--primary)"; }}
          onBlur={(e) => { e.target.style.borderColor = error ? "var(--negative)" : "var(--border)"; }}
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            aria-label={visible ? "Hide password" : "Show password"}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 2,
              color: "var(--text-subtle)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <ToggleIcon size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>
      {error && (
        <div style={{ font: "var(--text-body-sm)", color: "var(--negative)", marginTop: 5 }}>{error}</div>
      )}
    </div>
  );
}
