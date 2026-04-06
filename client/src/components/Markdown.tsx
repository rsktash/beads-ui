import { useEffect, useState, useRef, useCallback } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { codeToHtml } from "shiki";
import { useWs } from "../lib/ws-context";
import type { Issue } from "../lib/types";

let _config: { attachmentBaseUrl: string } | null = null;

async function getConfig(): Promise<{ attachmentBaseUrl: string }> {
  if (_config) return _config;
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    _config = { attachmentBaseUrl: data.fileAttachmentBaseUrl || "" };
  } catch {
    _config = { attachmentBaseUrl: "" };
  }
  return _config;
}

function resolveAttachments(md: string, baseUrl: string): string {
  if (!baseUrl) return md;
  return md.replace(
    /attach:\/\/([^\s)]+)/g,
    (_, path) => `${baseUrl}/${path}`,
  );
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

const renderer = {
  heading({ text, depth }: { text: string; depth: number }) {
    const id = slugify(text);
    const linked = text.replace(
      /#([a-z0-9]+-[a-z0-9]+)/gi,
      (_, issueId) => `<a href="#/detail/${issueId}">#${issueId}</a>`,
    );
    return `<h${depth} id="${id}">${linked}</h${depth}>`;
  },
};

marked.use({ renderer });

function resolveIssueMentions(md: string): string {
  return md
    .split("\n")
    .map((line) => {
      if (/^\s*#{1,6}\s/.test(line)) return line;
      return line.replace(
        /(?<![[\w/])#([a-z0-9]+-[a-z0-9]+)(?![(\]\w])/gi,
        (_, id) => `[#${id}](#/detail/${id})`,
      );
    })
    .join("\n");
}

const issueCache = new Map<string, Issue>();

const statusColors: Record<string, { bg: string; text: string }> = {
  open: { bg: "#dbeafe", text: "#1d4ed8" },
  in_progress: { bg: "#fef3c7", text: "#b45309" },
  blocked: { bg: "#fee2e2", text: "#dc2626" },
  closed: { bg: "#e5e7eb", text: "#4b5563" },
};

function IssuePreview({ issue, style }: { issue: Issue; style: React.CSSProperties }) {
  const colors = statusColors[issue.status] || statusColors.open;
  const date = new Date(issue.updated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const desc = issue.description
    ? issue.description.replace(/[#*`\[\]]/g, "").slice(0, 120) + (issue.description.length > 120 ? "..." : "")
    : "";

  return (
    <div
      className="fixed z-50 rounded-lg shadow-lg pointer-events-none"
      style={{
        ...style,
        width: "320px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
      }}
    >
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: "var(--text-tertiary)" }}>
          <span>{issue.id}</span>
          <span>·</span>
          <span>{date}</span>
        </div>
        <div className="font-semibold text-sm mb-2" style={{ color: "var(--text-primary)", lineHeight: 1.3 }}>
          {issue.title}
        </div>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ background: colors.bg, color: colors.text }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: colors.text }}
          />
          {issue.status.replace("_", " ")}
        </span>
      </div>
      {desc && (
        <div
          className="text-xs px-3.5 py-2.5"
          style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}
        >
          {desc}
        </div>
      )}
      <div
        className="flex items-center gap-2 text-xs px-3.5 py-2"
        style={{ color: "var(--text-tertiary)", borderTop: "1px solid var(--border-subtle)" }}
      >
        <span
          className="px-1.5 py-0.5 rounded font-mono"
          style={{ background: "var(--bg-hover)", fontSize: "11px" }}
        >
          {issue.issue_type}
        </span>
        {issue.assignee && (
          <>
            <span>·</span>
            <span>{issue.assignee}</span>
          </>
        )}
        {issue.priority > 0 && (
          <>
            <span>·</span>
            <span>P{issue.priority}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function Markdown({ content }: { content: string }) {
  const [html, setHtml] = useState("");
  const [preview, setPreview] = useState<{ issue: Issue; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();
  const ws = useWs();

  const handleMouseOver = useCallback(
    (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest?.("a[href*='#/detail/']") as HTMLAnchorElement | null;
      if (!link) return;
      const match = link.getAttribute("href")?.match(/#\/detail\/(.+)/);
      if (!match) return;
      const id = match[1];

      clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(async () => {
        let issue = issueCache.get(id) ?? null;
        if (!issue) {
          issue = await ws.fetchIssue(id);
          if (issue) issueCache.set(id, issue);
        }
        if (issue) {
          const rect = link.getBoundingClientRect();
          setPreview({ issue, x: rect.left, y: rect.bottom + 6 });
        }
      }, 300);
    },
    [ws],
  );

  const handleMouseOut = useCallback((e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest?.("a[href*='#/detail/']");
    if (!link) return;
    clearTimeout(hoverTimer.current);
    setPreview(null);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("mouseover", handleMouseOver);
    el.addEventListener("mouseout", handleMouseOut);
    return () => {
      el.removeEventListener("mouseover", handleMouseOver);
      el.removeEventListener("mouseout", handleMouseOut);
      clearTimeout(hoverTimer.current);
    };
  }, [handleMouseOver, handleMouseOut]);

  useEffect(() => {
    if (!content) {
      setHtml("");
      return;
    }

    let cancelled = false;

    async function render() {
      const cfg = await getConfig();
      let resolved = resolveAttachments(content, cfg.attachmentBaseUrl);
      resolved = resolveIssueMentions(resolved);
      const tokens = marked.lexer(resolved);

      // Collect code blocks for syntax highlighting
      const codeBlocks: Array<{ code: string; lang: string }> = [];
      marked.walkTokens(tokens, (token) => {
        if (token.type === "code") {
          codeBlocks.push({
            code: (token as { text: string }).text,
            lang: (token as { lang?: string }).lang || "text",
          });
        }
      });

      // Highlight all code blocks in parallel
      const highlighted = await Promise.all(
        codeBlocks.map(async (block) => {
          try {
            return await codeToHtml(block.code, {
              lang: block.lang,
              theme: "github-light",
            });
          } catch {
            return `<pre><code>${DOMPurify.sanitize(block.code)}</code></pre>`;
          }
        }),
      );

      // Render markdown and replace code blocks with highlighted versions
      let rendered = marked.parser(tokens) as string;
      let i = 0;
      rendered = rendered.replace(
        /<pre><code[^>]*>[\s\S]*?<\/code><\/pre>/g,
        () => highlighted[i++] || "",
      );

      const sanitized = DOMPurify.sanitize(rendered, {
        ADD_TAGS: ["span"],
        ADD_ATTR: ["style", "class", "id"],
      });

      if (!cancelled) setHtml(sanitized);
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [content]);

  return (
    <>
      <div
        ref={containerRef}
        className="prose prose-stone prose-sm max-w-none
          prose-pre:bg-stone-50 prose-pre:border prose-pre:border-stone-200 prose-pre:rounded
          prose-code:text-sm prose-code:font-mono
          prose-headings:font-semibold prose-headings:text-stone-900
          prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {preview && (
        <IssuePreview issue={preview.issue} style={{ left: preview.x, top: preview.y }} />
      )}
    </>
  );
}
