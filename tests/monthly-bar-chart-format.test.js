import { describe, it, expect } from "vitest";
import { formatYAxisTick } from "../src/features/analytics/components/MonthlyBarChart.jsx";

// Found while visually auditing the Analytics page in dark mode: Recharts'
// auto-generated Y-axis ticks aren't always round thousands (e.g. a $3,200
// max produced ticks at 0/800/1600/2400/3200) — the old formatter
// (`${(v / 1000).toFixed(0)}k`) rounded both 1600 and 2400 to "$2k",
// showing two identical labels on the axis. Not dark-mode-specific (the
// same duplicate renders in light mode) — found via the dark-mode
// screenshots, not hypothetical.
describe("formatYAxisTick — never produces two identical labels for distinct tick values", () => {
  it("keeps a decimal when the value isn't a round thousand", () => {
    expect(formatYAxisTick(1600)).toBe("$1.6k");
    expect(formatYAxisTick(2400)).toBe("$2.4k");
    expect(formatYAxisTick(1600)).not.toBe(formatYAxisTick(2400));
  });

  it("drops the decimal for round-thousand values", () => {
    expect(formatYAxisTick(0)).toBe("$0k");
    expect(formatYAxisTick(1000)).toBe("$1k");
    expect(formatYAxisTick(3200)).toBe("$3.2k");
  });

  it("produces unique labels across a realistic 5-tick axis", () => {
    const ticks = [0, 800, 1600, 2400, 3200];
    const labels = ticks.map(formatYAxisTick);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
