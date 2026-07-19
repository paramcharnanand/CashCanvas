import { useState } from "react";
import { useBreakpoint } from "../../hooks/useBreakpoint.js";

/**
 * Design-system StatCard primitive — see docs/frontend/
 * phase-8-design-system.md § Skeleton loaders ("SkeletonStat (matches
 * StatCard)"), which assumes this primitive already exists. Restyled from
 * the pre-Phase-8 `StatCard` (App.jsx) onto design tokens — same left-
 * accent-bar/label/value/sub shape and hover-elevation-on-click affordance,
 * but a real `<button>` when `onClick` is passed instead of a `<div
 * onClick>` with manual boxShadow toggling, so it's keyboard-operable
 * (Tab + Enter/Space) — the original had no keyboard path at all.
 *
 * `tone` maps to a design-token color (`primary`/`positive`/`negative`/
 * `text-subtle`) for the accent bar and `sub` text, rather than accepting
 * an arbitrary hex color, keeping every call site on the token palette.
 */
export function StatCard({ label, value, sub, tone = "primary", onClick }) {
  const [hovered, setHovered] = useState(false);
  const { breakpoint } = useBreakpoint();
  const color = `var(--${tone})`;
  const Tag = onClick ? "button" : "div";

  // Found via a real screenshot audit at a 390px viewport: two cards per
  // row (the "1 1 160px" flex-basis below) left too little width for the
  // value text at its fixed 30px size, and the ellipsis silently clipped
  // it ("$3,200.00" → "$3,20…") — the single most important number on the
  // card, unreadable. Below the sm breakpoint (< 480px, where two cards
  // per row can't fit comfortably) each card takes the full row instead.
  const narrow = breakpoint === "xs";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      onMouseEnter={onClick ? () => setHovered(true) : undefined}
      onMouseLeave={onClick ? () => setHovered(false) : undefined}
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-5) var(--space-6)",
        flex: narrow ? "1 1 100%" : "1 1 160px",
        minWidth: 0,
        textAlign: "left",
        border: "none",
        borderLeft: `3px solid ${color}`,
        boxShadow: hovered ? "var(--elevation-2)" : "var(--elevation-1)",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        fontFamily: "var(--font-body)",
        boxSizing: "border-box",
        transition: `box-shadow var(--duration-fast) var(--ease-standard)`,
      }}
    >
      <div
        style={{
          font: "var(--text-label)",
          color: "var(--text-muted)",
          marginBottom: 6,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: "600 30px/1.2 var(--font-numeral)",
          color: "var(--text)",
          fontFeatureSettings: '"tnum"',
          letterSpacing: "-0.02em",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ font: "var(--text-body-sm)", fontWeight: 500, color, marginTop: 6 }}>
          {sub}
        </div>
      )}
    </Tag>
  );
}
