import { NavLink } from "react-router-dom";
import { SIDEBAR_ITEMS } from "./navigation.js";

/**
 * Bottom-anchored nav (< --bp-md), replacing the sidebar rather than hiding
 * behind a hamburger — see design-system.md § Responsive Grid "Navigation
 * collapse". Grows automatically as SIDEBAR_ITEMS gains entries each phase,
 * no layout changes needed here — but a new item whose label is long
 * ("Merchant Rules", added Phase 8.8) can still wrap to a second line in
 * this bar's equal-width columns; give it a `mobileLabel` in
 * navigation.js if that happens (see that file's docblock), not a change
 * here.
 */
export function MobileNav() {
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
        display: "flex",
        gap: 8,
        padding: "10px 4px calc(10px + env(safe-area-inset-bottom, 10px))",
        zIndex: 40,
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
            // the unambiguous "Merchant Rules", not "Rules" alone.
            aria-label={item.mobileLabel ? item.label : undefined}
            style={({ isActive }) => ({
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "6px 0",
              fontSize: 9,
              fontWeight: 600,
              textDecoration: "none",
              color: isActive ? "var(--primary)" : "var(--text-subtle)",
            })}
          >
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            <span style={{ whiteSpace: "nowrap" }}>{item.mobileLabel || item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
