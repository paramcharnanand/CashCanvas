import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.jsx";
import { MobileNav } from "./MobileNav.jsx";
import { Header } from "./Header.jsx";
import { useBreakpoint } from "../hooks/useBreakpoint.js";
import { CommandPalette } from "../features/command-palette/CommandPalette.jsx";
import { ShortcutsHelp } from "../features/command-palette/ShortcutsHelp.jsx";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.js";

/**
 * Authenticated-app chrome: Sidebar (>= --bp-lg) or Header+MobileNav (below
 * it), plus the global Command Palette and keyboard-shortcut system. See
 * docs/frontend/phase-8-design-system.md § Responsive Grid "Sidebar
 * behavior" / "Navigation collapse".
 */
export function AppShell() {
  const { atLeast } = useBreakpoint();
  const showSidebar = atLeast("lg");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useKeyboardShortcuts({
    onOpenPalette: () => setPaletteOpen(true),
    onShowShortcuts: () => setShortcutsOpen(true),
  });

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      {showSidebar && <Sidebar />}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Header onOpenPalette={() => setPaletteOpen(true)} showBrand={!showSidebar} />
        {/*
          A plain div, not <main> — the routed page content (still the old
          UploadScreen/Dashboard in Phase 8.1) already owns its own <main>
          landmark in some cases (UploadScreen) and not others (Dashboard,
          a pre-existing, already-tracked gap — see ADR-019's
          landmark-one-main baseline entry). Wrapping in a second <main>
          here produced illegal nested/duplicate main landmarks for the
          former and would still need reconciling for the latter — simplest
          correct fix is for this shell to stay landmark-neutral and let
          each page own its own semantics, exactly as before.
        */}
        <div style={{ flex: 1, paddingBottom: showSidebar ? 0 : "calc(70px + env(safe-area-inset-bottom, 0px))" }}>
          <Outlet />
        </div>
        {!showSidebar && <MobileNav />}
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onShowShortcuts={() => {
          setPaletteOpen(false);
          setShortcutsOpen(true);
        }}
      />
      <ShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
