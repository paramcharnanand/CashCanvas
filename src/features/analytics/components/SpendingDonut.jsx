import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";
import { PieChart as PieChartIcon } from "lucide-react";
import { useKeyboardChartNav } from "../hooks/useKeyboardChartNav.js";

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
const fmt = (v) => "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Restyled from the legacy `Dashboard`'s "Spending Composition" donut
 * (`App.jsx`) onto the standardized chart system — see docs/frontend/
 * phase-8-design-system.md § Charts. Real keyboard support: the container
 * is one tab stop (`tabIndex={0}`), Left/Right arrows move a cursor through
 * categories (`useKeyboardChartNav`), and a visible readout below the
 * chart shows whichever category is active/hovered — the keyboard
 * equivalent of Recharts' mouse-only `<Tooltip>`, not a lesser experience.
 * `aria-label` summarizes the data directly (closes ADR-019's tracked
 * `svg-img-alt` finding), not a static placeholder string.
 */
export function SpendingDonut({ catBreakdown }) {
  const total = catBreakdown.reduce((sum, c) => sum + c.value, 0);
  const { activeIndex, setActiveIndex, onKeyDown } = useKeyboardChartNav(catBreakdown.length);

  if (catBreakdown.length === 0) {
    return <EmptyState icon={PieChartIcon} body="No spending data to break down yet." />;
  }

  const shown = activeIndex !== null ? catBreakdown[activeIndex] : catBreakdown[0];
  const shownPct = total > 0 ? Math.round((shown.value / total) * 100) : 0;

  const ariaLabel = `Donut chart: spending by category. ${catBreakdown[0].name} is the largest at ${Math.round((catBreakdown[0].value / total) * 100)}%, ${fmt(catBreakdown[0].value)}. ${catBreakdown.length} categories total.`;

  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      style={{ outline: "none" }}
    >
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={catBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} strokeWidth={0}>
            {catBreakdown.map((c, i) => (
              <Cell
                key={i}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                fillOpacity={activeIndex === null || activeIndex === i ? 1 : 0.3}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
                // Recharts' Sector.js hard-codes role="img" on every pie-slice
                // <path> with no accessible name of its own (a real,
                // browser-dependent axe finding — surfaced on firefox, not
                // chromium/webkit, in this project's own scan). aria-label is
                // in Recharts' own SVGElementPropKeys passthrough list, so
                // this renders straight onto the <path>, giving each slice a
                // real name instead of suppressing/hiding the finding.
                aria-label={`${c.name}: ${fmt(c.value)}, ${total > 0 ? Math.round((c.value / total) * 100) : 0}%`}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-3) var(--space-4)", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-3)" }}>
        <span style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--text)" }}>{shown.name}</span>
        <span style={{ font: "600 13px var(--font-numeral)", color: "var(--text)" }}>{fmt(shown.value)} · {shownPct}%</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px var(--space-4)" }}>
        {catBreakdown.slice(0, 6).map((c, i) => (
          <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
            <span style={{ font: "var(--text-label)", color: "var(--text-subtle)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
