/**
 * Design-system Spinner primitive — see docs/frontend/phase-8-design-system.md
 * § Motion System ("Spinners... keep their current `1s linear infinite`
 * rotation — no change needed, it was already correct"). `currentColor` so
 * it always matches the text color of whatever button/context it's used
 * inside, without a separate color prop to keep in sync.
 */
export function Spinner({ size = 14 }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        opacity: 0.9,
        borderRadius: "50%",
        animation: "cc-spin 1s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}
