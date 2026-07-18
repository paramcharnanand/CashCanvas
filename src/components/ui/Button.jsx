import { forwardRef } from "react";
import { Spinner } from "./Spinner.jsx";

const VARIANT_STYLES = {
  primary: {
    background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)",
    color: "var(--on-primary)",
    border: "1px solid transparent",
  },
  secondary: {
    background: "transparent",
    color: "var(--text-muted)",
    border: "1px solid var(--border-strong)",
  },
  danger: {
    background: "transparent",
    color: "var(--negative)",
    border: "1px solid var(--negative)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-subtle)",
    border: "1px solid transparent",
  },
};

const SIZE_STYLES = {
  sm: { height: 32, padding: "0 var(--space-4)", fontSize: 12 },
  md: { height: 40, padding: "0 var(--space-5)", fontSize: 13 },
  lg: { height: 48, padding: "0 var(--space-6)", fontSize: 14 },
};

/**
 * Design-system Button primitive — see docs/frontend/phase-8-design-system.md
 * § Components > Button. Replaces the dozens of hand-rolled inline
 * `<button style={{...}}>` variants across the pre-Phase-8 codebase.
 */
export const Button = forwardRef(function Button(
  { variant = "primary", size = "md", disabled = false, loading = false, style, children, ...rest },
  ref
) {
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      style={{
        fontFamily: "var(--font-body)",
        fontWeight: 600,
        borderRadius: "var(--radius-md)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        transition: `background ${"var(--duration-fast)"} var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard), opacity var(--duration-fast)`,
        ...sizeStyle,
        ...(disabled || loading
          ? { background: "var(--surface-alt)", color: "var(--text-subtle)", border: "1px solid var(--border)" }
          : variantStyle),
        ...style,
      }}
      {...rest}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
});
