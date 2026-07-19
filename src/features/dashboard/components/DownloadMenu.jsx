import { useEffect, useRef, useState } from "react";
import { Download, Table2, FileText } from "lucide-react";
import { buildTransactionsCsv, buildSummaryCsv, downloadCsv } from "../../../utils/csvExport.js";

/**
 * Restyled from the legacy `Dashboard` header's own download dropdown
 * (`App.jsx`, Phase 10 final cleanup) onto design tokens — same two CSV
 * exports (all transactions with categories; category/monthly summary),
 * same client-only `Blob`-download mechanism, no server round-trip.
 */
export function DownloadMenu({ transactions, catBreakdown, monthlyData, fileName }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKeyDown = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const base = (fileName || "cashcanvas").replace(/\.[^.]+$/, "");

  const options = [
    {
      label: "Transactions CSV",
      desc: "All transactions with categories",
      icon: Table2,
      action: () => downloadCsv(buildTransactionsCsv(transactions), `${base}_transactions.csv`),
    },
    {
      label: "Summary CSV",
      desc: "Category totals + monthly breakdown",
      icon: FileText,
      action: () => downloadCsv(buildSummaryCsv(transactions, catBreakdown, monthlyData), `${base}_summary.csv`),
    },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 14px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          color: "var(--text-subtle)",
          font: "var(--text-body-sm)", fontWeight: 500,
          cursor: "pointer",
        }}
      >
        <Download size={15} strokeWidth={1.75} aria-hidden="true" />
        Download
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Download report"
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
            minWidth: 240, background: "var(--surface)", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)", boxShadow: "var(--elevation-4)", padding: 6,
          }}
        >
          {options.map(({ label, desc, icon: Icon, action }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={() => { action(); setOpen(false); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 10px", background: "none", border: "none", borderRadius: "var(--radius-sm)",
                cursor: "pointer", textAlign: "left",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            >
              <Icon size={17} strokeWidth={1.75} color="var(--primary)" aria-hidden="true" />
              <div>
                <div style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--text)" }}>{label}</div>
                <div style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)" }}>{desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
