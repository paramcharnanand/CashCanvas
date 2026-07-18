export function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-body)",
        color: "var(--text-subtle)",
        fontSize: 14,
      }}
    >
      Loading…
    </div>
  );
}
