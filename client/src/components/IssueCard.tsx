import { CopyId } from "./CopyId";
import { PriorityBadge } from "./PriorityBadge";
import { TypeBadge } from "./TypeBadge";
import { getInitials, getAvatarColor } from "../lib/avatar";
import type { Issue } from "../lib/types";

const TYPE_BORDER_COLORS: Record<string, string> = {
  epic: "#7C3AED",
  feature: "#6366F1",
  bug: "#EF4444",
  task: "#16A34A",
  chore: "#78716C",
};

export function IssueCard({
  issue,
  onClick,
  dimmed = false,
}: {
  issue: Issue;
  onClick: () => void;
  dimmed?: boolean;
}) {
  const borderColor = TYPE_BORDER_COLORS[issue.issue_type] ?? "#78716C";

  return (
    <button
      onClick={onClick}
      className={`issue-card group w-full text-left relative cursor-pointer ${dimmed ? "issue-card--dimmed" : ""}`}
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <div className="px-3.5 py-3">
        {/* Issue ID + parent breadcrumb */}
        <div className="flex items-center gap-1 mb-1">
          {issue.parent_id && (
            <span
              className="text-[10px]"
              style={{ color: "var(--text-tertiary)", opacity: 0.7 }}
              title={issue.parent_title || issue.parent_id}
            >
              {issue.parent_id} ›
            </span>
          )}
          <CopyId id={issue.id} className="text-xs" />
        </div>

        {/* Title */}
        <p
          className="text-sm font-medium line-clamp-2 mb-2.5"
          style={{ color: "var(--text-primary)" }}
        >
          {issue.title}
        </p>

        {/* Blocked by */}
        {issue.blocked_by && issue.blocked_by.length > 0 && (
          <div className="flex items-center gap-1 mb-2 flex-wrap">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ color: "var(--status-blocked)", flexShrink: 0 }}>
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            {issue.blocked_by.map((b) => (
              <span
                key={b.id}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  background: "rgba(220,50,47,0.08)",
                  color: "var(--status-blocked)",
                }}
                title={b.title}
              >
                {b.id}
              </span>
            ))}
          </div>
        )}

        {/* Type badge + Priority badge + Children count + Assignee avatar */}
        <div className="flex items-center gap-1.5">
          <TypeBadge type={issue.issue_type} />
          <PriorityBadge priority={issue.priority} />
          {issue.total_children != null && issue.total_children > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "rgba(0,0,0,0.04)", color: "var(--text-tertiary)" }}
              title={`${issue.closed_children ?? 0}/${issue.total_children} closed`}
            >
              {issue.closed_children ?? 0}/{issue.total_children}
            </span>
          )}
          <div className="flex-1" />
          {issue.assignee && (
            <div
              className="flex items-center justify-center rounded-full text-[10px] font-bold shrink-0"
              style={{
                width: "24px",
                height: "24px",
                backgroundColor: getAvatarColor(issue.assignee),
                color: "var(--text-inverse)",
              }}
              title={issue.assignee}
            >
              {getInitials(issue.assignee)}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
