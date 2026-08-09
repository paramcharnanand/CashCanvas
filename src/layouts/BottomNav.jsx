import { NavLink } from "react-router-dom";
import { SIDEBAR_ITEMS } from "./navigation.js";
import { useBreakpoint } from "../hooks/useBreakpoint.js";

/**
 * Primary navigation, bottom-anchored at every viewport width — supersedes
 * the Phase 8 design of a left Sidebar at >= --bp-lg plus this bar only
 * below it (see docs/frontend/phase-8-design-system.md § Responsive Grid,
 * now superseded by that decision). Below --bp-lg this renders the
 * original compact bar (icon over label, tuned for the 44px touch-target
 * minimum — see the mobile-nav touch-target fix), horizontally scrollable
 * so items keep their tuned size instead of being squeezed to fit. At
 * --bp-lg and up it renders a taller, centered bar with side-by-side
 * icon+label items instead of the old full-height left rail.
 */
export function BottomNav() {
  const { atLeast } = useBreakpoint();
  const isSpacious = atLeast("lg");

  return (
    <nav
      aria-label="Primary navigation"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        zIndex: 40,
      }}
    >
      <div
        className={isSpacious ? undefined : "bottom-nav-scroll"}
        style={{
          display: "flex",
          // "center" on the non-scrolling spacious bar; "flex-start" below
          // --bp-lg so an overflowing row starts at item 1 (Overview) fully
          // in view — "center" there would split the overflow evenly on
          // both sides, scrolling the first item half off-screen by default.
          justifyContent: isSpacious ? "center" : "flex-start",
          alignItems: "center",
          gap: isSpacious ? "var(--space-3)" : 8,
          overflowX: isSpacious ? "visible" : "auto",
          padding: isSpacious
            ? "var(--space-3) var(--space-6)"
            : "10px 4px calc(10px + env(safe-area-inset-bottom, 10px))",
        }}
      >
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.to}
              // Full label for the accessible name even when `mobileLabel`
              // shortens the visible text — screen-reader users still get
              // the unambiguous "Merchant Rules", not "Rules" alone. The
              // spacious desktop variant always shows the full label, so
              // it never needs the override.
              aria-label={!isSpacious && item.mobileLabel ? item.label : undefined}
              style={({ isActive }) =>
                isSpacious
                  ? {
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      minHeight: 44,
                      padding: "10px 18px",
                      borderRadius: "var(--radius-md)",
                      fontSize: 13,
                      fontWeight: isActive ? 700 : 500,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                      color: isActive ? "var(--primary)" : "var(--text-subtle)",
                      background: isActive ? "var(--positive-soft)" : "transparent",
                      transition: "background var(--duration-fast), color var(--duration-fast)",
                    }
                  : {
                      flex: "0 0 auto",
                      minWidth: 64,
                      minHeight: 44,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      padding: "6px 4px",
                      fontSize: 9,
                      fontWeight: 600,
                      textDecoration: "none",
                      color: isActive ? "var(--primary)" : "var(--text-subtle)",
                    }
              }
            >
              <Icon size={isSpacious ? 18 : 20} strokeWidth={1.75} aria-hidden="true" />
              <span style={{ whiteSpace: "nowrap" }}>{isSpacious ? item.label : item.mobileLabel || item.label}</span>
            </NavLink>
          );
        })}
      </div>

      {!isSpacious && (
        // Hides the scrollbar for the horizontal-scroll fallback below
        // --bp-lg — inline styles can't target ::-webkit-scrollbar or the
        // Firefox-only scrollbar-width property.
        <style>{`
          .bottom-nav-scroll { scrollbar-width: none; -webkit-overflow-scrolling: touch; }
          .bottom-nav-scroll::-webkit-scrollbar { display: none; }
        `}</style>
      )}
    </nav>
  );
}
