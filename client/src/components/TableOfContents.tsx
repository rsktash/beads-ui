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

  if (entries.length < 2) return null;

  return (
    <div
      className="sticky top-6"
      style={{ width: "180px", maxHeight: "calc(100vh - 48px)", overflowY: "auto" }}
    >
      <div
        className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: "var(--text-tertiary)" }}
      >
        On this page
      </div>
      <nav className="space-y-0.5">
        {entries.map((entry) => (
          <button
            key={entry.id}
            onClick={() => handleClick(entry.id)}
            className="block w-full text-left text-xs truncate rounded px-1.5 py-1 transition-colors bg-transparent border-none cursor-pointer"
            style={{
              paddingLeft: `${6 + entry.depth * 10}px`,
              color: activeId === entry.id ? "var(--accent)" : "var(--text-tertiary)",
              fontWeight: entry.depth === 0 ? 600 : 400,
              font: "inherit",
              fontSize: "12px",
            }}
            onMouseEnter={(e) => {
              if (activeId !== entry.id) e.currentTarget.style.color = "var(--text-secondary)";
            }}
            onMouseLeave={(e) => {
              if (activeId !== entry.id) e.currentTarget.style.color = "var(--text-tertiary)";
            }}
            title={entry.label}
          >
            {entry.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
