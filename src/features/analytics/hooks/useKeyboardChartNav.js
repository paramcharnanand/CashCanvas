import { useState } from "react";

/**
 * Shared keyboard-navigation state for chart containers — see
 * docs/frontend/phase-8-design-system.md § Charts ("keyboard-reachable
 * tooltips: Tab to a data point, tooltip appears on focus"). Recharts
 * doesn't render individually-focusable DOM nodes per data point, so the
 * pattern here is the same one the pre-existing `OtpInput` already uses for
 * its own left/right arrow navigation: one real tab stop (the chart
 * container, `tabIndex={0}`), then Left/Right (and Home/End) arrow keys
 * move an `activeIndex` cursor through the data, driving the exact same
 * "brighten the active point, dim the rest to ~30% opacity" visual state
 * hover already produces — so a keyboard user reaches the identical
 * information a mouse user does, not a lesser view.
 */
export function useKeyboardChartNav(itemCount) {
  const [activeIndex, setActiveIndex] = useState(null);

  const onKeyDown = (e) => {
    if (itemCount === 0) return;
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        setActiveIndex((i) => (i === null ? 0 : Math.min(i + 1, itemCount - 1)));
        break;
      case "ArrowLeft":
        e.preventDefault();
        setActiveIndex((i) => (i === null ? itemCount - 1 : Math.max(i - 1, 0)));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(itemCount - 1);
        break;
      default:
        break;
    }
  };

  return { activeIndex, setActiveIndex, onKeyDown };
}
