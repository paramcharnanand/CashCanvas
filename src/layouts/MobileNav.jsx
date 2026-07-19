import { NavLink } from "react-router-dom";
import { SIDEBAR_ITEMS } from "./navigation.js";

/**
 * Bottom-anchored nav (< --bp-md), replacing the sidebar rather than hiding
 * behind a hamburger — see design-system.md § Responsive Grid "Navigation
 * collapse". Grows automatically as SIDEBAR_ITEMS gains entries each phase,
 * no changes needed here.
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
        padding: "8px 4px calc(8px + env(safe-area-inset-bottom, 8px))",
        zIndex: 40,
      }}
    >
      {SIDEBAR_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.id}
            to={item.to}
            style={({ isActive }) => ({
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "4px 0",
              fontSize: 9,
              fontWeight: 600,
              textDecoration: "none",
              color: isActive ? "var(--primary)" : "var(--text-subtle)",
            })}
          >
            <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
