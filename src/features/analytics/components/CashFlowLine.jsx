import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer } from "recharts";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";
import { TrendingUp } from "lucide-react";
import { useKeyboardChartNav } from "../hooks/useKeyboardChartNav.js";

const fmt = (v) => "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Restyled from the legacy `Dashboard`'s "Cash Flow" line chart
 * (`App.jsx`) — see docs/frontend/phase-8-design-system.md § Charts. Same
 * keyboard pattern as the other two Analytics charts: one tab stop,
 * Left/Right arrows move a month cursor, a visible readout shows that
 * month's net figure.
 */
export function CashFlowLine({ monthlyData }) {
  const { activeIndex, setActiveIndex, onKeyDown } = useKeyboardChartNav(monthlyData.length);

  if (monthlyData.length < 2) {
    return <EmptyState icon={TrendingUp} body="Upload statements from multiple months to see cash flow trends." />;
  }

  const shown = activeIndex !== null ? monthlyData[activeIndex] : monthlyData[monthlyData.length - 1];
  const ariaLabel = `Line chart: net cash flow by month, ${monthlyData.length} months shown. Most recent: ${shown.month}, net ${shown.Net >= 0 ? "surplus" : "deficit"} of ${fmt(shown.Net)}.`;

  return (
    <div role="group" tabIndex={0} aria-label={ariaLabel} onKeyDown={onKeyDown} style={{ outline: "none" }}>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={monthlyData} onMouseMove={(s) => setActiveIndex(s?.activeTooltipIndex ?? null)} onMouseLeave={() => setActiveIndex(null)}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: "var(--text-subtle)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: "var(--text-subtle)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v.toLocaleString()}`}
            domain={[(dataMin) => Math.min(0, dataMin), (dataMax) => Math.max(0, dataMax)]}
          />
          <ReferenceLine y={0} stroke="var(--border-strong)" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="Net"
            stroke="var(--primary)"
            strokeWidth={2.5}
            dot={(props) => {
              const isActive = activeIndex === props.index;
              return <circle key={props.index} cx={props.cx} cy={props.cy} r={isActive ? 5 : 3} fill="var(--primary)" opacity={activeIndex === null || isActive ? 1 : 0.3} />;
            }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-3) var(--space-4)", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
        <span style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--text)" }}>{shown.month}</span>
        <span style={{ font: "600 13px var(--font-numeral)", color: shown.Net >= 0 ? "var(--positive)" : "var(--negative)" }}>
          {shown.Net >= 0 ? "+" : ""}{fmt(shown.Net)} net
        </span>
      </div>
    </div>
  );
}
