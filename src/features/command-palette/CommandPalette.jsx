import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Dialog } from "../../components/ui/Dialog.jsx";
import { useCommands } from "./commands.js";

/**
 * ⌘K / Ctrl+K command palette. See docs/frontend/phase-8-inspiration.md's
 * "Patterns applied to CashCanvas" table (Linear/Raycast/Vercel/Notion) —
 * scoped as a secondary accelerator alongside the sidebar, not a
 * keyboard-only replacement for it (this app isn't Raycast).
 */
export function CommandPalette({ open, onClose, onShowShortcuts }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const commands = useCommands({ onShowShortcuts });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.keywords?.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const run = (cmd) => {
    if (!cmd || cmd.enabled === false) return;
    onClose();
    cmd.action?.();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(filtered[activeIndex]);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} labelledBy="cmdk-label" maxWidth={560} align="top">
      <div style={{ padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--border)" }}>
        <span id="cmdk-label" style={{ display: "none" }}>Command palette</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Search size={16} strokeWidth={1.75} style={{ color: "var(--text-subtle)", flexShrink: 0 }} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search anything… upload a statement, toggle dark mode, transactions"
            aria-label="Search commands"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "none",
              fontFamily: "var(--font-body)",
              fontSize: 15,
              color: "var(--text)",
            }}
          />
        </div>
      </div>

      <div role="listbox" aria-label="Commands" style={{ overflowY: "auto", padding: "var(--space-2)" }}>
        {filtered.length === 0 && (
          <div style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--text-subtle)", fontSize: 13 }}>
            No matching commands.
          </div>
        )}
        {filtered.map((cmd, i) => {
          const Icon = cmd.icon;
          const active = i === activeIndex;
          const disabled = cmd.enabled === false;
          return (
            <div
              key={cmd.id}
              role="option"
              aria-selected={active}
              aria-disabled={disabled}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => run(cmd)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: "var(--radius-sm)",
                cursor: disabled ? "default" : "pointer",
                background: active && !disabled ? "var(--positive-soft)" : "transparent",
                opacity: disabled ? 0.45 : 1,
              }}
            >
              <Icon size={17} strokeWidth={1.75} style={{ color: active && !disabled ? "var(--primary)" : "var(--text-subtle)", flexShrink: 0 }} aria-hidden="true" />
              <span style={{ fontSize: 13, fontWeight: active && !disabled ? 700 : 500, flex: 1 }}>{cmd.label}</span>
              {disabled && (
                <span style={{ fontFamily: "var(--font-numeral)", fontSize: 10, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Phase {cmd.comingIn}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
