import { useEffect, useState } from "react";
import { FileText, X } from "lucide-react";
import { apiFetch } from "../../../api.js";
import { Card } from "../../../components/ui/Card.jsx";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";

/**
 * Restyled from the legacy `UploadScreen`'s "Previous Uploads" section
 * (`App.jsx`) onto design tokens — real file history (never the fake
 * "Recent transactions" panel this phase removes), same year-filter and
 * delete behavior.
 *
 * Deliberately view + delete only here, not click-to-reactivate: the
 * legacy gate's `onLoadFile` can set a clicked file as the active
 * `transactions` state directly because `UploadScreen`/`Dashboard` share
 * one parent (`LegacyWorkspace`). This page is a separate route with no
 * such shared state (per this session's Phase 8.4 ADR-025, `LegacyWorkspace`
 * itself wasn't restructured), and `LegacyWorkspace`'s own auto-restore
 * always loads the *most recent* file, not a user-picked older one — making
 * an older file "active" again would need either a backend field to bump
 * (e.g. `lastAccessedAt`) or lifting state out of `LegacyWorkspace`, both
 * genuinely out of this phase's scope (a new route + a keyboard-accessible
 * drop zone). Reactivating an older upload is still fully possible via the
 * unchanged legacy gate in the meantime — nothing regresses.
 */
export function PreviousUploads() {
  const [fileHistory, setFileHistory] = useState([]);
  const [yearFilter, setYearFilter] = useState("all");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiFetch("/api/files")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setFileHistory(data); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const handleDelete = (id) => {
    if (!confirm("Remove this upload from history?")) return;
    apiFetch(`/api/files/${id}`, { method: "DELETE" }).catch(() => {});
    setFileHistory((prev) => prev.filter((f) => f._id !== id));
  };

  if (!loaded || fileHistory.length === 0) {
    return loaded ? (
      <EmptyState icon={FileText} body="No previous uploads yet" />
    ) : null;
  }

  const availableYears = [...new Set(
    fileHistory.map((f) => f.detectedYear || (f.uploadedAt ? new Date(f.uploadedAt).getFullYear() : null)).filter(Boolean)
  )].sort((a, b) => b - a);

  const visibleFiles = yearFilter === "all"
    ? fileHistory
    : fileHistory.filter((f) => {
        const y = f.detectedYear || (f.uploadedAt ? new Date(f.uploadedAt).getFullYear() : null);
        return String(y) === String(yearFilter);
      });

  return (
    <section style={{ marginTop: "var(--space-12)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-5)", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <div>
          <div style={{ font: "var(--text-label)", color: "var(--text-subtle)", marginBottom: 4 }}>Previous Uploads</div>
          <div style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)" }}>Your upload history.</div>
        </div>
        {availableYears.length > 1 && (
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {["all", ...availableYears].map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYearFilter(String(y))}
                style={{
                  padding: "5px 12px",
                  borderRadius: "var(--radius-full)",
                  border: `1px solid ${String(yearFilter) === String(y) ? "var(--primary)" : "var(--border)"}`,
                  background: String(yearFilter) === String(y) ? "var(--primary)" : "transparent",
                  color: String(yearFilter) === String(y) ? "var(--on-primary)" : "var(--text-subtle)",
                  font: "var(--text-label)",
                  cursor: "pointer",
                }}
              >
                {y === "all" ? "All" : y}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "var(--space-4)" }}>
        {visibleFiles.map((f) => (
          <Card key={f._id} padding="compact">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
                <FileText size={18} strokeWidth={1.75} color="var(--primary)" aria-hidden="true" style={{ flexShrink: 0 }} />
                <span style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.fileName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(f._id)}
                aria-label={`Remove ${f.fileName} from history`}
                style={{ background: "none", border: "none", color: "var(--text-subtle)", cursor: "pointer", padding: 2, flexShrink: 0, display: "flex" }}
              >
                <X size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            <div style={{ display: "flex", gap: "var(--space-4)" }}>
              <div>
                <div style={{ font: "var(--text-label)", color: "var(--text-subtle)", marginBottom: 2 }}>Transactions</div>
                <div style={{ font: "600 15px var(--font-numeral)", color: "var(--text)" }}>{f.transactionCount}</div>
              </div>
              <div>
                <div style={{ font: "var(--text-label)", color: "var(--text-subtle)", marginBottom: 2 }}>Uploaded</div>
                <div style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)" }}>
                  {new Date(f.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
