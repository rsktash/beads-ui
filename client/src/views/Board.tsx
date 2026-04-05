import { useMemo, useState, useRef, useEffect } from "react";
import { useSubscription } from "../hooks/use-subscription";
import { IssueCard } from "../components/IssueCard";
import type { SubscriptionType } from "../lib/types";

const COLUMN_PAGE_SIZE = 20;

const STATUS_COLORS: Record<string, string> = {
  open: "var(--status-open)",
  in_progress: "var(--status-in-progress)",
  blocked: "var(--status-blocked)",
  closed: "var(--status-closed)",
};

function Column({
  title,
  subscriptionType,
  statusKey,
  onCardClick,
  isClosed = false,
}: {
  title: string;
  subscriptionType: SubscriptionType;
  statusKey: string;
  onCardClick: (id: string) => void;
  isClosed?: boolean;
}) {
  const [limit, setLimit] = useState(COLUMN_PAGE_SIZE);
  const params = useMemo(() => ({ limit, offset: 0 }), [limit]);
  const { issues, loading, total } = useSubscription(subscriptionType, params);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  const hasMore = total > issues.length;
  const remaining = total - issues.length;
  const dotColor = STATUS_COLORS[statusKey] ?? "var(--text-tertiary)";

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setHasOverflow(el.scrollHeight > el.clientHeight);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [issues.length]);

  return (
    <div className="flex-1 min-w-[280px] max-w-[360px] flex flex-col self-start">
      {/* Column header */}
      <div
        className="flex items-center gap-2.5 px-1 pb-3 mb-3"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div
          className="rounded-full shrink-0"
          style={{
            width: "10px",
            height: "10px",
            backgroundColor: dotColor,
            boxShadow: `0 0 0 3px ${dotColor}33`,
          }}
        />
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h2>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full ml-auto"
          style={{
            backgroundColor: "rgba(0,0,0,0.05)",
            color: "var(--text-tertiary)",
            fontSize: "11px",
          }}
        >
          {loading ? "\u2026" : isClosed && total > issues.length ? `${issues.length} / ${total}` : total}
        </span>
      </div>

      {/* Card list */}
      <div
        ref={scrollRef}
        className="space-y-2 overflow-y-auto flex-1 pr-1 relative"
        style={{
          maxHeight: "calc(100vh - 160px)",
          maskImage: hasOverflow
            ? "linear-gradient(to bottom, transparent 0px, black 8px, black calc(100% - 8px), transparent 100%)"
            : undefined,
          WebkitMaskImage: hasOverflow
            ? "linear-gradient(to bottom, transparent 0px, black 8px, black calc(100% - 8px), transparent 100%)"
            : undefined,
        }}
      >
        {loading && issues.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              Loading&hellip;
            </p>
          </div>
        )}

        {!loading && issues.length === 0 && (
          <div
            className="py-8 text-center"
            style={{
              border: "2px dashed var(--border-default)",
              borderRadius: "var(--radius-md)",
              minHeight: "100px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              No items
            </p>
          </div>
        )}

        {issues.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            onClick={() => onCardClick(issue.id)}
            dimmed={isClosed}
          />
        ))}

        {hasMore && (
          <button
            onClick={() => setLimit((l) => l + COLUMN_PAGE_SIZE)}
            className="w-full text-xs py-2"
            style={{
              color: "var(--text-secondary)",
              transition: "color 120ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            Show {remaining} more&hellip;
          </button>
        )}
      </div>
    </div>
  );
}

export function Board() {
  const { total: totalIssues } = useSubscription("all-issues", { limit: 1, offset: 0 });
  const { total: totalEpics } = useSubscription("epics", { limit: 1, offset: 0 });

  const navigateToDetail = (id: string) => {
    window.location.hash = `#/detail/${id}`;
  };

  return (
    <div className="p-6" style={{ background: "var(--bg-base)" }}>
      <div className="mb-6">
        <h1
          className="text-xl font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Board
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-tertiary)" }}>
          {totalIssues} issues across {totalEpics} epics
        </p>
      </div>
      <div className="flex gap-4 overflow-x-auto items-start">
        <Column
          title="Open"
          subscriptionType="ready-issues"
          statusKey="open"
          onCardClick={navigateToDetail}
        />
        <Column
          title="In Progress"
          subscriptionType="in-progress-issues"
          statusKey="in_progress"
          onCardClick={navigateToDetail}
        />
        <Column
          title="Blocked"
          subscriptionType="blocked-issues"
          statusKey="blocked"
          onCardClick={navigateToDetail}
        />
        <Column
          title="Closed"
          subscriptionType="closed-issues"
          statusKey="closed"
          onCardClick={navigateToDetail}
          isClosed
        />
      </div>
    </div>
  );
}
