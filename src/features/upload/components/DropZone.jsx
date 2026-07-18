import { useRef } from "react";
import { UploadCloud } from "lucide-react";
import { Spinner } from "../../../components/ui/Spinner.jsx";

/**
 * Restyled from the legacy `UploadScreen`'s drop target (`App.jsx`) onto
 * design tokens — the one real behavior fix this phase makes, not just a
 * restyle: the original was a `<div onClick>` with no keyboard path at all
 * (`docs/frontend/phase-8-audit.md` §2). This is a real `<button>`, so
 * Tab focuses it and Enter/Space opens the file picker via the browser's
 * native button activation — no custom key handler needed — while still
 * accepting drag-and-drop (drop events work on any element, button
 * included, as long as `dragover` calls `preventDefault()`).
 */
export function DropZone({ dragging, setDragging, loading, loadingMsg, onDrop, onFile }) {
  const inputRef = useRef(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        disabled={loading}
        style={{
          background: dragging ? "var(--positive-soft)" : "var(--surface)",
          border: `1px dashed ${dragging ? "var(--primary)" : "var(--border-strong)"}`,
          borderRadius: "var(--radius-md)",
          height: 280,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: loading ? "wait" : "pointer",
          fontFamily: "var(--font-body)",
          transition: `background var(--duration-base) var(--ease-standard), border-color var(--duration-base) var(--ease-standard)`,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            background: dragging ? "var(--positive-soft)" : "var(--surface-alt)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "var(--space-5)",
          }}
        >
          {loading
            ? <Spinner size={24} />
            : <UploadCloud size={28} strokeWidth={1.75} color="var(--primary)" aria-hidden="true" />}
        </div>
        <p style={{ font: "var(--text-display-md)", color: "var(--text-muted)", margin: "0 0 var(--space-2)" }}>
          {loading ? (loadingMsg || "Parsing your statement…") : "Drop your bank statement"}
        </p>
        <p style={{ font: "var(--text-label)", color: "var(--text-subtle)", margin: 0 }}>
          CSV OR PDF FILES ACCEPTED
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.pdf"
          style={{ display: "none" }}
          onChange={(e) => onFile(e.target.files[0])}
        />
      </button>
    </div>
  );
}
