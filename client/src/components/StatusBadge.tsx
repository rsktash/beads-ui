const STATUS_CONFIG: Record<string, { dot: string; bg: string; text: string; border: string; label: string }> = {
  open: {
    dot: "var(--status-open)",
    bg: "rgba(59,130,246,0.08)",
    text: "#2563EB",
    border: "rgba(59,130,246,0.2)",
    label: "Open",
  },
  in_progress: {
    dot: "var(--status-in-progress)",
    bg: "rgba(245,158,11,0.08)",
    text: "#D97706",
    border: "rgba(245,158,11,0.2)",
    label: "In Progress",
  },
  blocked: {
    dot: "var(--status-blocked)",
    bg: "rgba(239,68,68,0.08)",
    text: "#DC2626",
    border: "rgba(239,68,68,0.2)",
    label: "Blocked",
  },
  closed: {
    dot: "var(--status-closed)",
    bg: "rgba(34,197,94,0.08)",
    text: "#16A34A",
    border: "rgba(34,197,94,0.2)",
    label: "Closed",
  },
};

const DEFAULT_CONFIG = {
  dot: "#9CA3AF",
  bg: "rgba(156,163,175,0.08)",
  text: "#6B7280",
  border: "rgba(156,163,175,0.2)",
  label: "",
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || DEFAULT_CONFIG;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 font-semibold"
      style={{
        fontSize: "11px",
        borderRadius: "20px",
        backgroundColor: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
      }}
    >
      <span
        className="rounded-full shrink-0"
        style={{
          width: "6px",
          height: "6px",
          backgroundColor: config.dot,
        }}
      />
      {config.label || status}
    </span>
  );
}
