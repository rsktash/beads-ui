const PRIORITY_CONFIG: Record<number, { bg: string; text: string }> = {
  0: { bg: "rgba(239,68,68,0.12)", text: "#DC2626" },
  1: { bg: "rgba(249,115,22,0.12)", text: "#EA580C" },
  2: { bg: "rgba(59,130,246,0.12)", text: "#2563EB" },
  3: { bg: "rgba(34,197,94,0.12)", text: "#16A34A" },
  4: { bg: "rgba(156,163,175,0.1)", text: "#9CA3AF" },
};

export function PriorityBadge({ priority }: { priority: number }) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG[4];
  return (
    <span
      className="inline-flex items-center justify-center font-mono font-bold"
      style={{
        fontSize: "11px",
        lineHeight: 1,
        padding: "3px 8px",
        borderRadius: "var(--radius-sm)",
        backgroundColor: config.bg,
        color: config.text,
      }}
    >
      P{priority}
    </span>
  );
}
