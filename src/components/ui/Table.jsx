/**
 * Design-system Table primitive — see docs/frontend/phase-8-design-system.md
 * § Components > Tables. Replaces the grid-of-divs pattern the pre-Phase-8
 * Transactions view used (no `role="table"` semantics — audit §4, ADR-019's
 * tracked `landmark`/table-structure gap) with a real `<table>`, so screen
 * readers get real row/column navigation for free instead of an unlabeled
 * grid of `<div>`s. Sticky header, `--text-label` column headers, zebra-free
 * (hairline dividers, matching the rest of the app's existing style — not
 * row-banding), row hover = `--surface-alt`.
 *
 * `columns`: `[{ key, label, align, render(row) }]`. `getRowKey(row)`
 * defaults to `row.id`.
 */
export function Table({ columns, rows, getRowKey = (row) => row.id, emptyMessage = "No results" }) {
  return (
    <div style={{ overflowX: "auto", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--surface)" }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={{
                  position: "sticky",
                  top: 0,
                  background: "var(--surface)",
                  textAlign: col.align || "left",
                  padding: "var(--space-3) var(--space-4)",
                  font: "var(--text-label)",
                  color: "var(--text-subtle)",
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: "var(--space-8) var(--space-4)", textAlign: "center", font: "var(--text-body-sm)", color: "var(--text-subtle)" }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={getRowKey(row)}
                style={{ transition: `background var(--duration-fast) var(--ease-standard)` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: "var(--space-3) var(--space-4)",
                      textAlign: col.align || "left",
                      font: "var(--text-body-sm)",
                      color: "var(--text)",
                      borderBottom: "1px solid var(--border)",
                      whiteSpace: col.wrap ? "normal" : "nowrap",
                    }}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
