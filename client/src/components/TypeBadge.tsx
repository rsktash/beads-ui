const TYPE_CONFIG: Record<string, { bg: string; text: string }> = {
  epic: { bg: "rgba(124,58,237,0.1)", text: "#7C3AED" },
  feature: { bg: "rgba(99,102,241,0.1)", text: "#6366F1" },
  bug: { bg: "rgba(239,68,68,0.1)", text: "#DC2626" },
  task: { bg: "rgba(22,163,74,0.1)", text: "#16A34A" },
  chore: { bg: "rgba(120,113,108,0.1)", text: "#78716C" },
};

const DEFAULT = { bg: "rgba(120,113,108,0.1)", text: "#78716C" };

export function TypeBadge({ type }: { type: string }) {
  const config = TYPE_CONFIG[type] || DEFAULT;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 font-semibold capitalize"
      style={{
        fontSize: "11px",
        borderRadius: "var(--radius-sm)",
        backgroundColor: config.bg,
        color: config.text,
      }}
    >
      {type}
    </span>
  );
}
