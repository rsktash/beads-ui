import { useState, useEffect, useRef } from "react";
import { useSubscription } from "../hooks/use-subscription";
import { useSearch } from "../hooks/use-search";
import { StatusBadge } from "./StatusBadge";
import { PriorityBadge } from "./PriorityBadge";

export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const { issues } = useSubscription("all-issues");
  const { query, setQuery, results } = useSearch(issues);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K to open, Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "k" && (e.metaKey || e.ctrlKey) && tag !== "TEXTAREA") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        setQuery("");
        setSelectedIndex(0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setQuery]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Reset selection when results change
  useEffect(() => setSelectedIndex(0), [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const shown = results.slice(0, 20);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, shown.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && shown[selectedIndex]) {
      window.location.hash = `#/detail/${shown[selectedIndex].id}`;
      setOpen(false);
      setQuery("");
    }
  };

  if (!open) return null;

  const shown = results.slice(0, 20);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => {
        setOpen(false);
        setQuery("");
      }}
    >
      <div className="absolute inset-0" style={{ background: "var(--bg-overlay)" }} />
      <div
        className="relative w-full max-w-lg overflow-hidden"
        style={{
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search issues..."
          className="w-full px-4 py-3 text-sm outline-none"
          style={{
            borderBottom: "1px solid var(--border-subtle)",
            background: "transparent",
            color: "var(--text-primary)",
          }}
        />
        <div className="max-h-80 overflow-y-auto">
          {shown.length === 0 && query && (
            <div className="px-4 py-6 text-sm text-center" style={{ color: "var(--text-tertiary)" }}>
              No results
            </div>
          )}
          {shown.map((issue, i) => (
            <button
              key={issue.id}
              onClick={() => {
                window.location.hash = `#/detail/${issue.id}`;
                setOpen(false);
                setQuery("");
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
              style={{
                background: i === selectedIndex ? "var(--bg-hover)" : "transparent",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = i === selectedIndex ? "var(--bg-hover)" : "transparent"; }}
            >
              <span className="font-mono text-xs w-28 shrink-0" style={{ color: "var(--text-tertiary)" }}>
                {issue.id}
              </span>
              <StatusBadge status={issue.status} />
              <span className="flex-1 truncate" style={{ color: "var(--text-primary)" }}>{issue.title}</span>
              <PriorityBadge priority={issue.priority} />
            </button>
          ))}
        </div>
        <div
          className="px-4 py-2 text-xs"
          style={{
            color: "var(--text-tertiary)",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          &uarr;&darr; navigate &middot; &crarr; open &middot; esc close
        </div>
      </div>
    </div>
  );
}
