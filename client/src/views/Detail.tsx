import { useState } from "react";
import { useSubscription } from "../hooks/use-subscription";
import { useMutation } from "../hooks/use-mutation";
import { StatusBadge } from "../components/StatusBadge";
import { PriorityBadge } from "../components/PriorityBadge";
import { TypeBadge } from "../components/TypeBadge";
import { SectionEditor } from "../components/SectionEditor";
import { getInitials, getAvatarColor } from "../lib/avatar";
import type { Issue } from "../lib/types";

function MetadataCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="px-3 py-2.5 rounded-md"
      style={{ border: "1px solid var(--border-subtle)" }}
    >
      <h3
        className="font-semibold uppercase tracking-wider mb-1.5"
        style={{ fontSize: "11px", color: "var(--text-tertiary)" }}
      >
        {label}
      </h3>
      {children}
    </div>
  );
}

function MetadataSidebar({
  issue,
  onUpdate,
}: {
  issue: Issue;
  onUpdate: ReturnType<typeof useMutation>;
}) {
  const parentId = issue.parent_id || (issue as any).parent;
  const parentTitle = issue.parent_title || (issue as any).parent_title;
  const parentStatus = issue.parent_status || (issue as any).parent_status;
  const ts = new Date(issue.updated_at).toLocaleDateString();

  return (
    <aside
      className="shrink-0 p-4 space-y-3 overflow-y-auto"
      style={{
        width: "280px",
        borderLeft: "1px solid var(--border-subtle)",
        background: "var(--bg-base)",
      }}
    >
      <MetadataCard label="Status">
        <select
          value={issue.status}
          onChange={(e) =>
            onUpdate.updateStatus(
              issue.id,
              e.target.value as "open" | "in_progress" | "closed",
            )
          }
          className="w-full px-2 py-1 text-sm rounded-md outline-none"
          style={{
            border: "1px solid var(--border-default)",
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
          }}
        >
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
      </MetadataCard>

      <MetadataCard label="Priority">
        <select
          value={issue.priority}
          onChange={(e) =>
            onUpdate.updatePriority(issue.id, Number(e.target.value))
          }
          className="w-full px-2 py-1 text-sm rounded-md outline-none"
          style={{
            border: "1px solid var(--border-default)",
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
          }}
        >
          {[0, 1, 2, 3, 4].map((p) => (
            <option key={p} value={p}>P{p}</option>
          ))}
        </select>
      </MetadataCard>

      <MetadataCard label="Type">
        <TypeBadge type={issue.issue_type} />
      </MetadataCard>

      <MetadataCard label="Assignee">
        {issue.assignee ? (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center rounded-full text-[10px] font-bold shrink-0"
              style={{
                width: "24px",
                height: "24px",
                backgroundColor: getAvatarColor(issue.assignee),
                color: "var(--text-inverse)",
              }}
            >
              {getInitials(issue.assignee)}
            </div>
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>{issue.assignee}</span>
          </div>
        ) : (
          <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>Unassigned</span>
        )}
      </MetadataCard>

      <MetadataCard label="Updated">
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{ts}</span>
      </MetadataCard>

      {issue.labels && issue.labels.length > 0 && (
        <MetadataCard label="Labels">
          <div className="flex flex-wrap gap-1">
            {issue.labels.map((l) => (
              <span
                key={l}
                className="px-2 py-0.5 text-xs rounded"
                style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
              >
                {l}
              </span>
            ))}
          </div>
        </MetadataCard>
      )}

      {/* Parent */}
      {parentId && (
        <MetadataCard label="Parent">
          <a
            href={`#/detail/${parentId}`}
            className="block rounded px-1 py-1 -mx-1 transition-colors"
            style={{ color: "var(--text-primary)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              {parentStatus && <StatusBadge status={parentStatus} />}
              <span className="font-mono text-xs" style={{ color: "var(--text-tertiary)" }}>{parentId}</span>
            </div>
            {parentTitle && (
              <p className="text-xs leading-snug pl-0.5 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                {parentTitle}
              </p>
            )}
          </a>
        </MetadataCard>
      )}

      {/* Blocked By */}
      {(() => {
        const blocksDeps = (issue.dependencies || []).filter(
          (dep: any) => dep.type === "blocks" && dep.issue_id === issue.id
        );
        if (blocksDeps.length === 0) return null;
        return (
          <MetadataCard label="Blocked By">
            <div className="space-y-1">
              {blocksDeps.map((dep: any) => (
                <a
                  key={dep.depends_on_id}
                  href={`#/detail/${dep.depends_on_id}`}
                  className="block text-xs font-mono px-1 py-0.5 transition-colors"
                  style={{ color: "var(--accent)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                >
                  {dep.depends_on_id}
                </a>
              ))}
            </div>
          </MetadataCard>
        );
      })()}

      {/* Children / Dependents (sidebar) */}
      {issue.dependents && issue.dependents.length > 0 && (
        <MetadataCard label="Children / Dependents">
          <div className="space-y-1">
            {issue.dependents.map((dep) => (
              <a
                key={dep.id}
                href={`#/detail/${dep.id}`}
                className="block text-xs rounded px-1 py-1.5 -mx-1 transition-colors"
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <StatusBadge status={dep.status} />
                  <span className="font-mono" style={{ color: "var(--text-tertiary)" }}>{dep.id}</span>
                </div>
                {dep.title && (
                  <p className="text-xs leading-snug pl-0.5 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                    {dep.title}
                  </p>
                )}
              </a>
            ))}
          </div>
        </MetadataCard>
      )}
    </aside>
  );
}

function CommentsSection({ issueId }: { issueId: string }) {
  const mutations = useMutation();
  const [newComment, setNewComment] = useState("");

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await mutations.addComment(issueId, newComment.trim());
    setNewComment("");
  };

  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <h3
        className="font-semibold uppercase tracking-wider mb-3"
        style={{ fontSize: "11px", color: "var(--text-tertiary)" }}
      >
        Comments
      </h3>
      <div className="flex gap-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment... (Ctrl+Enter to submit)"
          rows={3}
          className="flex-1 p-2 text-sm rounded-md resize-y outline-none"
          style={{
            border: "1px solid var(--border-default)",
            background: "var(--bg-base)",
            color: "var(--text-primary)",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey))
              handleAddComment();
          }}
        />
      </div>
      <button
        onClick={handleAddComment}
        className="mt-2 px-3 py-1.5 text-sm rounded-md font-medium transition-colors"
        style={{
          background: "var(--bg-hover)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-default)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
      >
        Add Comment
      </button>
    </div>
  );
}

export function Detail({ issueId }: { issueId: string }) {
  const { issues, loading } = useSubscription("issue-detail", { id: issueId });
  const mutations = useMutation();
  const issue = issues[0];

  if (loading) return <div className="p-6" style={{ color: "var(--text-tertiary)" }}>Loading...</div>;
  if (!issue)
    return <div className="p-6" style={{ color: "var(--text-tertiary)" }}>Issue not found</div>;

  return (
    <div className="flex h-full" style={{ background: "var(--bg-base)" }}>
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-tertiary)" }}>
          <a
            href="#/list"
            className="flex items-center gap-1 transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
          >
            &larr; List
          </a>
          <span>/</span>
          <span className="font-mono">{issue.id}</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          {issue.title}
        </h1>

        {/* Description */}
        <SectionEditor
          label="Description"
          value={issue.description || ""}
          onSave={(v) =>
            mutations.editText({
              id: issue.id,
              field: "description",
              value: v,
            })
          }
        />

        {/* Acceptance Criteria */}
        <SectionEditor
          label="Acceptance Criteria"
          value={issue.acceptance || ""}
          placeholder="Add acceptance criteria..."
          onSave={(v) =>
            mutations.editText({
              id: issue.id,
              field: "acceptance",
              value: v,
            })
          }
        />

        {/* Notes */}
        <SectionEditor
          label="Notes"
          value={issue.notes || ""}
          placeholder="Add notes..."
          onSave={(v) =>
            mutations.editText({ id: issue.id, field: "notes", value: v })
          }
        />

        {/* Design */}
        <SectionEditor
          label="Design"
          value={issue.design || ""}
          placeholder="Add design notes..."
          onSave={(v) =>
            mutations.editText({ id: issue.id, field: "design", value: v })
          }
        />

        {/* Children (epics only) */}
        {issue.issue_type === "epic" && issue.dependents && issue.dependents.length > 0 && (
          <div
            className="rounded-lg p-4"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <h3
              className="font-semibold uppercase tracking-wider mb-3"
              style={{ fontSize: "11px", color: "var(--text-tertiary)" }}
            >
              Children ({issue.closed_children ?? 0} / {issue.total_children ?? issue.dependents.length})
            </h3>
            <div className="space-y-0.5">
              {issue.dependents.map((child) => (
                <a
                  key={child.id}
                  href={`#/detail/${child.id}`}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-md transition-colors"
                  style={{ opacity: child.status === "closed" ? 0.6 : 1 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <StatusBadge status={child.status} />
                  <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>{child.id}</span>
                  <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{child.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        <CommentsSection issueId={issue.id} />
      </div>

      {/* Metadata sidebar */}
      <MetadataSidebar issue={issue} onUpdate={mutations} />
    </div>
  );
}
