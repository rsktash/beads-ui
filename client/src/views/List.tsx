import { useState, useMemo, useEffect, useRef } from "react";
import { useSubscription } from "../hooks/use-subscription";
import { StatusBadge } from "../components/StatusBadge";
import { PriorityBadge } from "../components/PriorityBadge";
import { TypeBadge } from "../components/TypeBadge";
import { getInitials, getAvatarColor } from "../lib/avatar";
import type { Issue } from "../lib/types";

const PAGE_SIZE = 20;

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="7" cy="7" r="5" />
    <line x1="11" y1="11" x2="14" y2="14" />
  </svg>
);

function SkeletonRow() {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      <div className="w-36 h-3 rounded skeleton-shimmer" />
      <div className="w-20 h-5 rounded-full skeleton-shimmer" />
      <div className="w-8 h-5 rounded skeleton-shimmer" />
      <div className="flex-1 h-3 rounded skeleton-shimmer" />
      <div className="w-14 h-5 rounded skeleton-shimmer" />
      <div className="w-24 h-5 rounded skeleton-shimmer" />
      <div className="w-16 h-3 rounded skeleton-shimmer" />
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <circle cx="10" cy="10" r="8" stroke="var(--border-default)" strokeWidth="2" />
      <path
        d="M10 2a8 8 0 0 1 8 8"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Toolbar({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
}: {
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 mb-4 px-4 py-3 rounded-lg"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="relative flex-1 max-w-xs">
        <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }}>
          <SearchIcon />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search issues..."
          className="w-full pl-9 pr-3 py-1.5 text-sm rounded-md outline-none"
          style={{
            border: "1px solid var(--border-default)",
            background: "var(--bg-base)",
            color: "var(--text-primary)",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
        />
      </div>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="px-3 py-1.5 text-sm rounded-md"
        style={{
          border: "1px solid var(--border-default)",
          background: "var(--bg-base)",
          color: "var(--text-primary)",
        }}
      >
        <option value="all">All statuses</option>
        <option value="open">Open</option>
        <option value="in_progress">In Progress</option>
        <option value="blocked">Blocked</option>
        <option value="closed">Closed</option>
      </select>
      <select
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
        className="px-3 py-1.5 text-sm rounded-md"
        style={{
          border: "1px solid var(--border-default)",
          background: "var(--bg-base)",
          color: "var(--text-primary)",
        }}
      >
        <option value="all">All types</option>
        <option value="epic">Epic</option>
        <option value="feature">Feature</option>
        <option value="task">Task</option>
        <option value="bug">Bug</option>
        <option value="chore">Chore</option>
      </select>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <div className="flex items-center justify-between px-1 py-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
      <span>
        {total > 0 ? `${from}\u2013${to} of ${total}` : "0 issues"}
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={page === 0}
          onClick={() => onPageChange(0)}
          className="px-2 py-1 rounded disabled:opacity-30"
          style={{ border: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}
        >
          &laquo;&laquo;
        </button>
        <button
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          className="px-2 py-1 rounded disabled:opacity-30"
          style={{ border: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}
        >
          &laquo;
        </button>
        <span className="px-2">
          {page + 1} / {totalPages || 1}
        </span>
        <button
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
          className="px-2 py-1 rounded disabled:opacity-30"
          style={{ border: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}
        >
          &raquo;
        </button>
        <button
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(totalPages - 1)}
          className="px-2 py-1 rounded disabled:opacity-30"
          style={{ border: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}
        >
          &raquo;&raquo;
        </button>
      </div>
    </div>
  );
}

function IssueRow({
  issue,
  selected,
  onClick,
}: {
  issue: Issue;
  selected: boolean;
  onClick: () => void;
}) {
  const ts = new Date(issue.updated_at).toLocaleDateString();

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
      style={{
        borderBottom: "1px solid var(--border-subtle)",
        background: selected ? "var(--bg-hover)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "transparent";
      }}
    >
      <span className="font-mono text-xs w-36 shrink-0 text-left" style={{ color: "var(--text-tertiary)" }}>
        {issue.id}
      </span>
      <span className="w-28 shrink-0">
        <StatusBadge status={issue.status} />
      </span>
      <span className="w-12 shrink-0">
        <PriorityBadge priority={issue.priority} />
      </span>
      <span className="flex-1 text-left truncate" style={{ color: "var(--text-primary)" }}>
        {issue.title}
        {issue.issue_type === "epic" && issue.total_children != null && (
          <span
            className="ml-2 text-xs px-1.5 py-0.5 rounded"
            style={{ background: "rgba(0,0,0,0.04)", color: "var(--text-tertiary)" }}
          >
            {issue.total_children} sub
          </span>
        )}
      </span>
      <span className="w-16 shrink-0">
        <TypeBadge type={issue.issue_type} />
      </span>
      <span className="w-28 shrink-0 flex items-center gap-1.5 justify-end">
        {issue.assignee ? (
          <>
            <div
              className="flex items-center justify-center rounded-full text-[9px] font-bold shrink-0"
              style={{
                width: "20px",
                height: "20px",
                backgroundColor: getAvatarColor(issue.assignee),
                color: "var(--text-inverse)",
              }}
            >
              {getInitials(issue.assignee)}
            </div>
            <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
              {issue.assignee}
            </span>
          </>
        ) : (
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>&mdash;</span>
        )}
      </span>
      <span className="text-xs w-20 text-right shrink-0" style={{ color: "var(--text-tertiary)" }}>
        {ts}
      </span>
    </button>
  );
}

export function List() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Build server-side subscription params
  const subParams = useMemo(() => {
    const params: Record<string, string | number | boolean> = {};
    if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
    if (statusFilter !== "all") params.status = statusFilter;
    if (typeFilter !== "all") params.type = typeFilter;
    return params;
  }, [debouncedSearch, statusFilter, typeFilter]);

  // Server-side search+filter via search-issues subscription
  const { issues: allFiltered, loading, refreshing, total } = useSubscription(
    "search-issues",
    subParams,
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Client-side pagination of server-filtered results
  const paginatedIssues = useMemo(() => {
    const start = page * PAGE_SIZE;
    return allFiltered.slice(start, start + PAGE_SIZE);
  }, [allFiltered, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
    setSelectedIndex(-1);
  }, [statusFilter, typeFilter, search]);

  // Reset selection on page change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [page]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (e.key === "j")
        setSelectedIndex((i) => Math.min(i + 1, paginatedIssues.length - 1));
      if (e.key === "k") setSelectedIndex((i) => Math.max(i - 1, -1));
      if (e.key === "Enter" && paginatedIssues[selectedIndex]) {
        window.location.hash = `#/detail/${paginatedIssues[selectedIndex].id}`;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [paginatedIssues, selectedIndex]);

  return (
    <div className="p-6 h-full flex flex-col" style={{ background: "var(--bg-base)" }}>
      <div className="mb-4">
        <h1
          className="text-xl font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Issues
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-tertiary)" }}>
          {loading ? "\u00A0" : `${total} issues`}
        </p>
      </div>

      <Toolbar
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
      />

      {/* Table header */}
      <div
        className="rounded-t-lg overflow-hidden"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          borderBottom: "none",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div
          className="flex items-center gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wider"
          style={{
            color: "var(--text-tertiary)",
            borderBottom: "1px solid var(--border-subtle)",
            fontSize: "11px",
          }}
        >
          <span className="w-36 shrink-0">ID</span>
          <span className="w-28 shrink-0">Status</span>
          <span className="w-12 shrink-0">Priority</span>
          <span className="flex-1">Title</span>
          <span className="w-16 shrink-0">Type</span>
          <span className="w-28 shrink-0 text-right">Assignee</span>
          <span className="w-20 shrink-0 text-right">Date</span>
        </div>
      </div>

      {/* Table body */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto rounded-b-lg relative"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          borderTop: "none",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Initial load: skeleton shimmer */}
        {loading && (
          <>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </>
        )}

        {/* Refresh overlay: dim existing list + centered spinner */}
        {refreshing && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center"
            style={{
              background: "rgba(253,251,247,0.6)",
              backdropFilter: "blur(1px)",
            }}
          >
            <Spinner />
          </div>
        )}

        {/* Data rows */}
        {!loading && (
          paginatedIssues.length === 0 ? (
            <p className="text-sm p-8 text-center" style={{ color: "var(--text-tertiary)" }}>
              No issues match your filters
            </p>
          ) : (
            paginatedIssues.map((issue, index) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                selected={index === selectedIndex}
                onClick={() => {
                  setSelectedIndex(index);
                  window.location.hash = `#/detail/${issue.id}`;
                }}
              />
            ))
          )
        )}
      </div>

      {!loading && totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
