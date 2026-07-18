import { Upload, Tag, BarChart3, ShieldCheck } from "lucide-react";

const FEATURES = [
  {
    icon: Upload,
    title: "Upload any statement",
    body: "CSV or PDF, from any bank or card. No manual data entry.",
  },
  {
    icon: Tag,
    title: "Categorized automatically",
    body: "Merchant rules and AI sort every transaction the moment your statement lands.",
  },
  {
    icon: BarChart3,
    title: "See it, don't guess it",
    body: "Spending broken down by category and month, with trends over time.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    body: "Your data stays private — no selling, no sharing.",
  },
];

export function FeatureGrid() {
  return (
    <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 var(--space-4) var(--space-24)" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "var(--space-6)",
        }}
      >
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            style={{
              padding: "var(--space-6)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--radius-md)",
                background: "var(--positive-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "var(--space-4)",
              }}
            >
              <Icon size={20} strokeWidth={1.75} color="var(--primary)" aria-hidden="true" />
            </div>
            <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: "0 0 var(--space-2)" }}>
              {title}
            </h2>
            <p style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", margin: 0, lineHeight: 1.6 }}>
              {body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
