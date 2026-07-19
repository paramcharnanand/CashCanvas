import { Link, NavLink } from "react-router-dom";
import { SIDEBAR_ITEMS } from "./navigation.js";
import { useAuth } from "../contexts/AuthContext.jsx";

/**
 * Desktop primary nav (>= --bp-lg). See docs/frontend/phase-8-design-system.md
 * § Responsive Grid "Sidebar behavior" and phase-8-component-architecture.md.
 * Active state is driven by NavLink off the real URL, not component state —
 * unlike the pre-Phase-8 TabBar's `tab === "X"` comparison, this survives a
 * page refresh.
 *
 * The identity block links to /settings (Phase 8.9) — the account-actions
 * "user menu" this comment used to describe as deferred. Sign Out/Delete
 * Account live on that page now, not as controls here directly, since the
 * legacy Dashboard header's own copies of both were removed the same phase
 * (see ROADMAP.md's Phase 8.9 completion note) — no more duplicate-control
 * risk from having both live at once.
 */
export function Sidebar() {
  const { auth } = useAuth();
  const initial = (auth?.user?.name || "?").trim().charAt(0).toUpperCase();

  return (
    <aside
      style={{
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        padding: "var(--space-5) var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
        width: 240,
        flexShrink: 0,
        height: "100%",
      }}
    >
      <Link
        to="/dashboard"
        style={{
          font: "var(--text-heading-md)",
          fontStyle: "italic",
          color: "var(--text)",
          textDecoration: "none",
          padding: "0 var(--space-2)",
        }}
      >
        Cash<span style={{ color: "var(--primary)" }}>Canvas</span>
      </Link>

      <nav aria-label="Primary navigation" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.to}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                textDecoration: "none",
                color: isActive ? "var(--primary)" : "var(--text-subtle)",
                background: isActive ? "var(--positive-soft)" : "transparent",
                transition: "background var(--duration-fast), color var(--duration-fast)",
              })}
            >
              <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <Link
        to="/settings"
        style={{
          marginTop: "auto",
          borderTop: "1px solid var(--border)",
          paddingTop: "var(--space-4)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "var(--primary)",
            color: "var(--on-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {initial}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {auth?.user?.name}
          </div>
        </div>
      </Link>
    </aside>
  );
}
