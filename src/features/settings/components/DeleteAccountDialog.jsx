import { useState } from "react";
import { Dialog } from "../../../components/ui/Dialog.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { apiFetch } from "../../../api.js";

/**
 * Rebuilt from the legacy `DeleteAccountModal` (`App.jsx`, used identically
 * in both `UploadScreen` and `Dashboard`'s header) onto the `Dialog`
 * primitive — same logic (`DELETE /api/auth/delete-account`, `onLogout()`
 * on success), per docs/frontend/phase-8-component-architecture.md's
 * mapping table.
 */
export function DeleteAccountDialog({ open, onClose, onLogout }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/auth/delete-account", { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      onLogout();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} labelledBy="delete-account-title" maxWidth={420}>
      <div style={{ padding: "var(--space-6)" }}>
        <h2 id="delete-account-title" style={{ font: "var(--text-heading-md)", color: "var(--text)", margin: "0 0 var(--space-3)" }}>
          Delete your account?
        </h2>
        <p style={{ font: "var(--text-body-md)", color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 var(--space-5)" }}>
          This will permanently delete your account and all your data — uploaded statements, categories,
          and saved rules. <strong style={{ color: "var(--text)" }}>This cannot be undone.</strong>
        </p>
        {error && (
          <div style={{
            font: "var(--text-body-sm)", color: "var(--negative)", background: "var(--negative-soft)",
            borderRadius: "var(--radius-sm)", padding: "var(--space-3) var(--space-4)", marginBottom: "var(--space-4)",
          }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} loading={loading}>
            {loading ? "Deleting…" : "Delete Account"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
