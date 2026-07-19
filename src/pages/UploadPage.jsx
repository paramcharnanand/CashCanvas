import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api.js";
import { toDateOnlyString } from "../utils/csv.js";
import { DropZone } from "../features/upload/components/DropZone.jsx";
import { PreviousUploads } from "../features/upload/components/PreviousUploads.jsx";
import { useFileUpload } from "../features/upload/hooks/useFileUpload.js";

/**
 * Mounted at "/upload" (see router.jsx), inside `AppShell`/`ProtectedRoute` —
 * a normal, always-reachable route per `docs/frontend/
 * phase-8-component-architecture.md`'s routing architecture ("`/upload`
 * becomes a normal, always-reachable route... not a gate"), restyled from
 * `App.jsx`'s `UploadScreen` onto design-system primitives. The fake
 * "Recent transactions" preview panel (never real data) is dropped, per
 * `docs/frontend/phase-8-migration-plan.md`'s Phase 5.
 *
 * This is *additive*, not a replacement of the legacy gate: per this
 * session's Phase 8.4 decision (ADR-025), the unauthenticated-data gate
 * inside `LegacyWorkspace` still shows the unchanged `UploadScreen` — this
 * page is a second, independent entry point for uploading another
 * statement any time, matching the target architecture's stated end state.
 * A successful upload here POSTs to `/api/files` then navigates to
 * `/dashboard`, which already picks it up via `LegacyWorkspace`'s existing
 * auto-restore-most-recent-file effect — no change to that effect needed.
 * "Try with sample data" is deliberately not offered here (see
 * `features/upload/components/PreviousUploads.jsx`'s docblock for the same
 * class of reasoning: sample data is never persisted, so this page has no
 * way to hand it to `/dashboard` without restructuring `LegacyWorkspace`,
 * out of this phase's scope) — it's still fully available on the unchanged
 * legacy gate.
 */
export default function UploadPage() {
  const navigate = useNavigate();
  const [saveError, setSaveError] = useState("");

  const handleData = useCallback(async (txns, name, statementType) => {
    setSaveError("");
    try {
      const res = await apiFetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: name,
          statementType,
          // toDateOnlyString: the backend requires a bare YYYY-MM-DD, no
          // time component (api/_lib/validation.js's DATE_RE) — see
          // utils/csv.js's toDateOnlyString docblock and ROADMAP.md's ADR-026.
          transactions: txns.map((t) => ({ ...t, date: t.date instanceof Date ? toDateOnlyString(t.date) : t.date })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || "Failed to save this upload. Please try again.");
        return;
      }
      navigate("/dashboard");
    } catch {
      setSaveError("Cannot connect to the server. Please try again.");
    }
  }, [navigate]);

  const { dragging, setDragging, error, loading, loadingMsg, handleFile, onDrop } = useFileUpload(handleData);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
      <h1 style={{ font: "var(--text-display-lg)", color: "var(--text)", margin: "0 0 var(--space-2)" }}>
        Upload a statement
      </h1>
      <p style={{ font: "var(--text-body-md)", color: "var(--text-subtle)", margin: "0 0 var(--space-8)" }}>
        CSV or PDF, from any bank or card.
      </p>

      <DropZone
        dragging={dragging}
        setDragging={setDragging}
        loading={loading}
        loadingMsg={loadingMsg}
        onDrop={onDrop}
        onFile={handleFile}
      />

      {(error || saveError) && (
        <div
          style={{
            marginTop: "var(--space-4)",
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            background: "var(--negative-soft)",
            border: "1px solid var(--negative)",
            font: "var(--text-body-sm)",
            color: "var(--negative)",
          }}
        >
          {error || saveError}
        </div>
      )}

      <PreviousUploads />
    </div>
  );
}
