import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Shared modal primitive — see docs/frontend/phase-8-design-system.md
 * § Components > Dialogs. Escape + overlay-click to close, focus moves into
 * the dialog on open and returns to the trigger on close (a real keyboard
 * requirement, not just a visual one — design-system.md § Accessibility).
 */
export function Dialog({ open, onClose, children, labelledBy, maxWidth = 480, align = "center" }) {
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      const timer = setTimeout(() => {
        const focusable = panelRef.current?.querySelector(
          'input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        (focusable || panelRef.current)?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
    triggerRef.current?.focus?.();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(27,28,26,0.4)",
        display: "flex",
        alignItems: align === "top" ? "flex-start" : "center",
        justifyContent: "center",
        paddingTop: align === "top" ? "12vh" : 0,
        zIndex: 500,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--elevation-4)",
          border: "var(--card-border)",
          width: "100%",
          maxWidth,
          maxHeight: "80vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
