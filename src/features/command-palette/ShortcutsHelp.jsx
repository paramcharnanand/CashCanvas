import { Dialog } from "../../components/ui/Dialog.jsx";

const isMac = typeof navigator !== "undefined" && navigator.platform?.includes("Mac");
const MOD = isMac ? "⌘" : "Ctrl";

const SHORTCUTS = [
  { keys: `${MOD}K`, label: "Open Command Palette", available: true },
  { keys: `${MOD}U`, label: "Upload a statement", available: true },
  { keys: `${MOD}D`, label: "Go to Dashboard", available: true },
  { keys: `${MOD}A`, label: "Go to Analytics", available: true },
  { keys: `${MOD},`, label: "Go to Settings", available: false, comingIn: "8.9" },
  { keys: "Esc", label: "Close dialogs", available: true },
  { keys: "?", label: "Open this shortcuts sheet", available: true },
];

export function ShortcutsHelp({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="shortcuts-title" maxWidth={420}>
      <div style={{ padding: "var(--space-6)" }}>
        <h2 id="shortcuts-title" style={{ font: "var(--text-heading-md)", color: "var(--text)", margin: "0 0 var(--space-5)" }}>
          Keyboard shortcuts
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {SHORTCUTS.map((s) => (
            <div key={s.keys} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", opacity: s.available ? 1 : 0.5 }}>
              <span style={{ fontSize: 13, color: "var(--text)" }}>
                {s.label}
                {!s.available && (
                  <span style={{ fontSize: 10, color: "var(--text-subtle)", marginLeft: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Phase {s.comingIn}
                  </span>
                )}
              </span>
              <kbd
                style={{
                  fontFamily: "var(--font-numeral)",
                  fontSize: 11,
                  fontWeight: 600,
                  background: "var(--surface-alt)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 4,
                  padding: "3px 8px",
                }}
              >
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
