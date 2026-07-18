import { useEffect, useState } from "react";

/**
 * Replaces the old single useIsMobile() boolean (window.innerWidth < 768,
 * no tablet step — see docs/frontend/phase-8-audit.md §0) with the real
 * --bp-* scale from tokens.css.
 */
const BREAKPOINTS = { sm: 480, md: 768, lg: 1024, xl: 1280, "2xl": 1600 };

function getBreakpoint(width) {
  if (width >= BREAKPOINTS["2xl"]) return "2xl";
  if (width >= BREAKPOINTS.xl) return "xl";
  if (width >= BREAKPOINTS.lg) return "lg";
  if (width >= BREAKPOINTS.md) return "md";
  if (width >= BREAKPOINTS.sm) return "sm";
  return "xs";
}

const ORDER = ["xs", "sm", "md", "lg", "xl", "2xl"];

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState(() =>
    typeof window !== "undefined" ? getBreakpoint(window.innerWidth) : "xl"
  );

  useEffect(() => {
    const handler = () => setBreakpoint(getBreakpoint(window.innerWidth));
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const atLeast = (bp) => ORDER.indexOf(breakpoint) >= ORDER.indexOf(bp);

  return {
    breakpoint,
    isMobile: !atLeast("md"), // < 768 — matches the old useIsMobile threshold exactly
    isTablet: atLeast("md") && !atLeast("lg"),
    atLeast,
  };
}
