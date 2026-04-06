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
    return `<h${depth} id="${id}">${text}</h${depth}>`;
  },
};

marked.use({ renderer });

function resolveIssueMentions(md: string): string {
  return md.replace(
    /(?<![[\w/])#([a-z0-9]+-[a-z0-9]+)(?![(\]\w])/gi,
    (_, id) => `[#${id}](#/detail/${id})`,
  );
}

const issueCache = new Map<string, Issue>();

function IssuePreview({ issue, style }: { issue: Issue; style: React.CSSProperties }) {
  return (
    <div
      className="fixed z-50 rounded-lg shadow-lg text-sm max-w-xs pointer-events-none"
      style={{
        ...style,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        padding: "10px 12px",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block w-2 h-2 rounded-full shrink-0"
          style={{
            background:
              issue.status === "closed" ? "#8b8b8b"
              : issue.status === "in_progress" ? "#f59e0b"
              : issue.status === "blocked" ? "#ef4444"
              : "#3b82f6",
          }}
        />
        <span className="font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {issue.title}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
        <span>{issue.issue_type}</span>
        <span>·</span>
        <span>{issue.status.replace("_", " ")}</span>
        {issue.assignee && (
          <>
            <span>·</span>
            <span>{issue.assignee}</span>
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
