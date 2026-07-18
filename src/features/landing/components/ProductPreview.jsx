const SLICES = [
  { label: "Groceries", pct: 32, color: "var(--chart-1)" },
  { label: "Dining", pct: 24, color: "var(--chart-4)" },
  { label: "Transport", pct: 26, color: "var(--chart-3)" },
  { label: "Subscriptions", pct: 18, color: "var(--chart-2)" },
];

const ROWS = [
  { desc: "Whole Foods", cat: "Groceries", amount: "-$89.40", color: "var(--chart-1)" },
  { desc: "Payroll deposit", cat: "Income", amount: "+$3,200.00", color: "var(--positive)" },
  { desc: "Netflix", cat: "Subscriptions", amount: "-$15.99", color: "var(--chart-2)" },
];

function conicGradient() {
  let acc = 0;
  const stops = SLICES.map(({ pct, color }) => {
    const start = acc;
    acc += pct;
    return `${color} ${start}% ${acc}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

/**
 * Illustrative, static mockup of the categorized-spending view — CSS only
 * (no recharts/chart-library weight on a page whose whole job is to load
 * fast), using the real --chart-* palette so it reads as "this app,"
 * not stock art. Labeled "Sample view" so nothing here is mistaken for a
 * real user's data.
 */
export function ProductPreview() {
  return (
    <section style={{ maxWidth: 880, margin: "0 auto", padding: "0 var(--space-4) var(--space-16)" }}>
      <div
        style={{
          background: "var(--surface)",
          border: "var(--card-border, 1px solid var(--border))",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--elevation-2)",
          padding: "var(--space-8)",
          display: "grid",
          gridTemplateColumns: "minmax(200px, 260px) 1fr",
          gap: "var(--space-8)",
          alignItems: "center",
        }}
        className="landing-preview-grid"
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" }}>
          <span style={{ font: "var(--text-label)", color: "var(--text-subtle)" }}>Sample view</span>
          <div
            style={{
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: conicGradient(),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 116,
                height: 116,
                borderRadius: "50%",
                background: "var(--surface)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ font: "600 22px/1.2 var(--font-numeral)", color: "var(--text)" }}>$2,480</span>
              <span style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)" }}>this month</span>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", justifyContent: "center" }}>
            {SLICES.map((s) => (
              <span
                key={s.label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  font: "var(--text-body-sm)",
                  color: "var(--text-subtle)",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} aria-hidden="true" />
                {s.label}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div style={{ font: "var(--text-label)", color: "var(--text-subtle)", marginBottom: "var(--space-3)" }}>
            Recent transactions
          </div>
          {ROWS.map((row) => (
            <div
              key={row.desc}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                padding: "var(--space-3) 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: row.color, flexShrink: 0 }} aria-hidden="true" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "var(--text-body-md)", fontWeight: 600, color: "var(--text)" }}>{row.desc}</div>
                <div style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)" }}>{row.cat}</div>
              </div>
              <div
                style={{
                  font: "600 14px/1.4 var(--font-numeral)",
                  fontVariantNumeric: "tabular-nums",
                  color: row.amount.startsWith("+") ? "var(--positive)" : "var(--text)",
                  flexShrink: 0,
                }}
              >
                {row.amount}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .landing-preview-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
