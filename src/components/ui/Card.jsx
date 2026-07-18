/**
 * Design-system Card primitive — see docs/frontend/phase-8-design-system.md
 * § Components > Cards ("the single most duplicated pattern in the app...
 * retyped by hand at ~20+ call sites"). `padding` maps to the 8-point scale
 * (compact/default/spacious); `interactive` adds the hover-elevation +
 * pointer cursor previously done per-callsite via manual onMouseEnter/
 * onMouseLeave boxShadow toggling (e.g. the pre-Phase-8 `StatCard`).
 */
const PADDING = {
  compact: "var(--space-4)",
  default: "var(--space-6)",
  spacious: "var(--space-8)",
};

export function Card({ padding = "default", interactive = false, style, children, ...rest }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-md)",
        padding: PADDING[padding],
        boxShadow: "var(--elevation-1)",
        border: "var(--card-border, none)",
        boxSizing: "border-box",
        transition: `box-shadow var(--duration-fast) var(--ease-standard)`,
        ...style,
      }}
      onMouseEnter={interactive ? (e) => { e.currentTarget.style.boxShadow = "var(--elevation-2)"; } : undefined}
      onMouseLeave={interactive ? (e) => { e.currentTarget.style.boxShadow = "var(--elevation-1)"; } : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}
