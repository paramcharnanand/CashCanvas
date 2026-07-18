import { Link } from "react-router-dom";
import { Search, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

const THEME_ICON = { light: Sun, dark: Moon, system: Monitor };
const THEME_LABEL = { light: "Light", dark: "Dark", system: "System" };

/**
 * Authenticated-app topbar: logo + command-palette trigger + theme control.
 * See docs/frontend/phase-8-design-system.md § Components > Navigation and
 * § Theme System.
 *
 * The logo is always a real <Link>, never onClick + navigate("...") and
 * never window.location — client-side navigation, no reload, exactly the
 * "logo always clickable" requirement. showBrand is false on >=lg, where
 * the Sidebar already renders the brand — one visible logo at a time, not
 * two competing ones.
 */
export function Header({ onOpenPalette, showBrand = false }) {
  const { preference, cyclePreference } = useTheme();
  const { isAuthenticated } = useAuth();
  const ThemeIcon = THEME_ICON[preference];

  return (
    // Not a real <header> (role=banner): the not-yet-migrated UploadScreen
    // and Dashboard (rendered inside this shell's <Outlet>, see AppShell.jsx)
    // already render their own unconditional <header>, and axe's
    // landmark-no-duplicate-banner rule allows at most one banner landmark
    // per page regardless of naming — a second one always fails, unlike
    // <nav>, where a unique aria-label is enough. role="region" is a
    // landmark that permits multiple uniquely-named instances, so it
    // contains this bar's content (fixing axe's "region" rule) without
    // colliding with the legacy banner. Reconsider once those pages migrate
    // and their own <header> goes away.
    <div
      role="region"
      aria-label="Application header"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-4) var(--space-6)",
        borderBottom: "1px solid var(--border)",
        gap: "var(--space-4)",
      }}
    >
      {showBrand && (
        <Link
          to={isAuthenticated ? "/dashboard" : "/"}
          style={{
            font: "var(--text-heading-md)",
            fontStyle: "italic",
            color: "var(--text)",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          Cash<span style={{ color: "var(--primary)" }}>Canvas</span>
        </Link>
      )}
      <button
        onClick={onOpenPalette}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--surface-alt)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: "7px 12px",
          color: "var(--text-subtle)",
          fontSize: 12,
          fontFamily: "var(--font-body)",
          cursor: "pointer",
          flex: 1,
          maxWidth: 320,
        }}
      >
        <Search size={14} strokeWidth={1.75} aria-hidden="true" />
        Jump to…
        <kbd
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-numeral)",
            fontSize: 10,
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: 4,
            padding: "1px 5px",
          }}
        >
          {navigator.platform?.includes("Mac") ? "⌘K" : "Ctrl+K"}
        </kbd>
      </button>

      <button
        onClick={cyclePreference}
        aria-label={`Theme: ${THEME_LABEL[preference]}. Click to change.`}
        title={`Theme: ${THEME_LABEL[preference]}`}
        style={{
          width: 34,
          height: 34,
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-subtle)",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <ThemeIcon size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}
