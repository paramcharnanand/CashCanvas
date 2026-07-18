import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../contexts/ToastContext.jsx";

/**
 * Standardized global keyboard shortcuts. See
 * docs/frontend/phase-8-design-system.md § Motion System / Accessibility
 * and the Phase 8 implementation instructions this responds to.
 *
 * Every shortcut listed is bound now, even ones without a real destination
 * yet (Analytics, Settings) — pressing them gives an honest "coming soon"
 * toast instead of either silently doing nothing (which reads as broken for
 * a *documented* shortcut) or navigating somewhere wrong.
 *
 * Note: Ctrl/Cmd+U and Ctrl/Cmd+D are browser-reserved in some browsers
 * (view-source, bookmark) — preventDefault() is called regardless, but
 * whether the browser honors that override for these two specific
 * combinations is outside this app's control.
 */
export function useKeyboardShortcuts({ onOpenPalette, onShowShortcuts }) {
  const navigate = useNavigate();
  const { show } = useToast();

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
        navigate("/dashboard"); // Upload lives at /dashboard until Phase 8.5 gives it its own route.
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        navigate("/dashboard");
        return;
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        show("Analytics is coming in Phase 8.7.", { variant: "info" });
        return;
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        show("Settings is coming in Phase 8.8.", { variant: "info" });
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
  }, [navigate, show, onOpenPalette, onShowShortcuts]);
}
