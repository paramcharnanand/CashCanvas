import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Standardized global keyboard shortcuts. See
 * docs/frontend/phase-8-design-system.md § Motion System / Accessibility
 * and the Phase 8 implementation instructions this responds to. As of
 * Phase 8.9 every documented shortcut has a real destination — no more
 * "coming soon" toast fallback (Settings, the last one, shipped this
 * phase).
 *
 * Note: Ctrl/Cmd+U and Ctrl/Cmd+D are browser-reserved in some browsers
 * (view-source, bookmark) — preventDefault() is called regardless, but
 * whether the browser honors that override for these two specific
 * combinations is outside this app's control.
 */
export function useKeyboardShortcuts({ onOpenPalette, onShowShortcuts }) {
  const navigate = useNavigate();

  useEffect(() => {
    function isTypingTarget(el) {
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    }

    function onKeyDown(e) {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenPalette();
        return;
      }
      if (mod && e.key.toLowerCase() === "u") {
        e.preventDefault();
        navigate("/upload");
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        navigate("/dashboard");
        return;
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        navigate("/analytics");
        return;
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        navigate("/settings");
        return;
      }
      // "?" (Shift+/) opens the shortcuts sheet — but not while typing, so a
      // real "?" character can still be typed into a search/text field.
      if (!mod && e.key === "?" && !isTypingTarget(document.activeElement)) {
        e.preventDefault();
        onShowShortcuts();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navigate, onOpenPalette, onShowShortcuts]);
}
