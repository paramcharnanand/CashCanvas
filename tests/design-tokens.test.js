import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

/**
 * Computes WCAG 2.x contrast ratio directly from the hex values in
 * src/styles/tokens.css, so a future change to a token's color is caught
 * by a fast, deterministic unit test instead of only by an e2e axe scan
 * (which won't catch a ratio that's still >=4.5:1 but has regressed
 * toward the floor from a previously-safer margin).
 */
function relativeLuminance(hex) {
  const [r, g, b] = hex.replace("#", "").match(/.{2}/g).map((h) => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA, hexB) {
  const [l1, l2] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

function readToken(css, name) {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Token ${name} not found in tokens.css`);
  return match[1];
}

describe("design tokens — text-on-background contrast", () => {
  const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
  const bg = readToken(css, "--bg");
  const textMuted = readToken(css, "--text-muted");

  it("--text-muted against --bg clears WCAG AA (4.5:1) with real margin, not just barely", () => {
    expect(contrastRatio(textMuted, bg)).toBeGreaterThanOrEqual(7);
  });
});

describe("Table and Transactions — headers/subtitle use the higher-contrast token", () => {
  const tableSrc = readFileSync(new URL("../src/components/ui/Table.jsx", import.meta.url), "utf8");
  const transactionsSrc = readFileSync(new URL("../src/pages/TransactionsPage.jsx", import.meta.url), "utf8");

  it("Table column headers render with --text-muted", () => {
    const headerBlock = tableSrc.slice(tableSrc.indexOf("<th"), tableSrc.indexOf("</th"));
    expect(headerBlock).toContain("var(--text-muted)");
    expect(headerBlock).not.toContain("var(--text-subtle)");
  });

  it("Transactions subtitle ('N of N transactions') renders with --text-muted", () => {
    const subtitleIndex = transactionsSrc.indexOf("{filtered.length} of {transactions.length}");
    expect(subtitleIndex, "subtitle template string not found — TransactionsPage.jsx markup changed").toBeGreaterThan(-1);
    const subtitleBlock = transactionsSrc.slice(Math.max(0, subtitleIndex - 300), subtitleIndex);
    expect(subtitleBlock).toContain("var(--text-muted)");
  });
});
