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
        {/* Issue ID */}
        <div className="mb-1">
          <span
            className="font-mono text-xs"
            style={{ color: "var(--text-tertiary)" }}
          >
            {issue.id}
          </span>
        </div>

        {/* Title */}
        <p
          className="text-sm font-medium line-clamp-2 mb-2.5"
          style={{ color: "var(--text-primary)" }}
        >
          {issue.title}
        </p>

        {/* Type badge + Priority badge + Assignee avatar */}
        <div className="flex items-center gap-1.5">
          <TypeBadge type={issue.issue_type} />
          <PriorityBadge priority={issue.priority} />
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
