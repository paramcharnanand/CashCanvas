import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer } from "recharts";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";
import { BarChart3 } from "lucide-react";
import { useKeyboardChartNav } from "../hooks/useKeyboardChartNav.js";

const fmt = (v) => "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Restyled from the legacy `Dashboard`'s "Monthly Overview" bar chart
 * (`App.jsx`) — see docs/frontend/phase-8-design-system.md § Charts. Same
 * keyboard pattern as `SpendingDonut.jsx`: one tab stop, Left/Right arrows
 * move a month cursor, a visible readout shows that month's Income/
 * Expenses (previously only in a mouse-only Recharts tooltip). Direct
 * axis-tick labeling instead of a separate legend (≤3 series — matches the
 * design system's stated preference for direct-over-indirect labeling).
 */
export function MonthlyBarChart({ monthlyData }) {
  const { activeIndex, setActiveIndex, onKeyDown } = useKeyboardChartNav(monthlyData.length);

  if (monthlyData.length === 0) {
    return <EmptyState icon={BarChart3} body="Not enough data available for monthly analytics." />;
  }

  const shown = activeIndex !== null ? monthlyData[activeIndex] : monthlyData[monthlyData.length - 1];
  const ariaLabel = `Bar chart: income versus expenses by month, ${monthlyData.length} month${monthlyData.length !== 1 ? "s" : ""} shown. Most recent: ${shown.month}, income ${fmt(shown.Income)}, expenses ${fmt(shown.Expenses)}.`;

  return (
    <div role="group" tabIndex={0} aria-label={ariaLabel} onKeyDown={onKeyDown} style={{ outline: "none" }}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={monthlyData} barGap={3} barSize={10}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: "var(--text-subtle)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--text-subtle)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Bar dataKey="Income" radius={[2, 2, 0, 0]} onMouseEnter={(_d, i) => setActiveIndex(i)} onMouseLeave={() => setActiveIndex(null)}>
            {monthlyData.map((_m, i) => (
              <Cell key={i} fill="var(--positive)" fillOpacity={activeIndex === null || activeIndex === i ? 1 : 0.3} />
            ))}
          </Bar>
          <Bar dataKey="Expenses" radius={[2, 2, 0, 0]} onMouseEnter={(_d, i) => setActiveIndex(i)} onMouseLeave={() => setActiveIndex(null)}>
            {monthlyData.map((_m, i) => (
              <Cell key={i} fill="var(--negative)" fillOpacity={activeIndex === null || activeIndex === i ? 1 : 0.3} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-3) var(--space-4)", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
        <span style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--text)" }}>{shown.month}</span>
        <span style={{ font: "var(--text-body-sm)", color: "var(--positive)" }}>Income {fmt(shown.Income)}</span>
        <span style={{ font: "var(--text-body-sm)", color: "var(--negative)" }}>Expenses {fmt(shown.Expenses)}</span>
      </div>
    </div>
  );
}
