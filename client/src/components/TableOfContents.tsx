import { useState, useEffect, useRef, useCallback } from "react";

interface TocEntry {
  id: string;
  label: string;
  depth: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function buildToc(issue: {
  description?: string;
  acceptance?: string;
  notes?: string;
  design?: string;
}): TocEntry[] {
  const entries: TocEntry[] = [];
  const sections = [
    { label: "Description", id: "description", content: issue.description },
    { label: "Acceptance Criteria", id: "acceptance-criteria", content: issue.acceptance },
    { label: "Notes", id: "notes", content: issue.notes },
    { label: "Design", id: "design", content: issue.design },
  ];

  for (const section of sections) {
    if (!section.content) continue;
    entries.push({ id: section.id, label: section.label, depth: 0 });
    // Extract markdown headings from content
    const lines = section.content.split("\n");
    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)/);
      if (!match) continue;
      const depth = match[1].length;
      const text = match[2].replace(/[#*`\[\]]/g, "").trim();
      entries.push({ id: slugify(text), label: text, depth });
    }
  }
  return entries;
}

export function TableOfContents({
  issue,
  scrollContainer,
}: {
  issue: { description?: string; acceptance?: string; notes?: string; design?: string };
  scrollContainer: HTMLElement | null;
}) {
  const entries = buildToc(issue);
  const [activeId, setActiveId] = useState("");
  const clicking = useRef(false);

  // Track active section via IntersectionObserver
  useEffect(() => {
    if (!scrollContainer || entries.length === 0) return;
    const ids = entries.map((e) => e.id);
    const elements = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (obs) => {
        if (clicking.current) return;
        for (const entry of obs) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { root: scrollContainer, rootMargin: "-10% 0px -80% 0px", threshold: 0 },
    );
    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [scrollContainer, entries]);

  const handleClick = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      clicking.current = true;
      setActiveId(id);
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => { clicking.current = false; }, 800);
    },
    [],
  );

  // Only show top-level sections (depth 0) in the horizontal bar
  const topEntries = entries.filter((e) => e.depth === 0);
  if (topEntries.length < 2) return null;

  return (
    <div
      className="shrink-0 flex items-center gap-1 px-6 py-2 overflow-x-auto"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      {topEntries.map((entry) => (
        <button
          key={entry.id}
          onClick={() => handleClick(entry.id)}
          className="shrink-0 text-xs rounded-full px-3 py-1 transition-colors bg-transparent border-none cursor-pointer"
          style={{
            color: activeId === entry.id ? "var(--accent)" : "var(--text-tertiary)",
            background: activeId === entry.id ? "var(--accent-soft)" : "transparent",
            fontWeight: activeId === entry.id ? 600 : 400,
            font: "inherit",
            fontSize: "12px",
          }}
          onMouseEnter={(e) => {
            if (activeId !== entry.id) {
              e.currentTarget.style.color = "var(--text-secondary)";
              e.currentTarget.style.background = "var(--bg-hover)";
            }
          }}
          onMouseLeave={(e) => {
            if (activeId !== entry.id) {
              e.currentTarget.style.color = "var(--text-tertiary)";
              e.currentTarget.style.background = "transparent";
            }
          }}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}
