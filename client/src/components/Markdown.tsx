import { useEffect, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { codeToHtml } from "shiki";

let _attachmentBaseUrl: string | null = null;

async function getAttachmentBaseUrl(): Promise<string> {
  if (_attachmentBaseUrl !== null) return _attachmentBaseUrl;
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    _attachmentBaseUrl = data.fileAttachmentBaseUrl || "";
  } catch {
    _attachmentBaseUrl = "";
  }
  return _attachmentBaseUrl;
}

function resolveAttachments(md: string, baseUrl: string): string {
  if (!baseUrl) return md;
  return md.replace(
    /attach:\/\/([^\s)]+)/g,
    (_, path) => `${baseUrl}/${path}`,
  );
}

export function Markdown({ content }: { content: string }) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    if (!content) {
      setHtml("");
      return;
    }

    let cancelled = false;

    async function render() {
      const baseUrl = await getAttachmentBaseUrl();
      const resolved = resolveAttachments(content, baseUrl);
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
        ADD_ATTR: ["style", "class"],
      });

      if (!cancelled) setHtml(sanitized);
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [content]);

  return (
    <div
      className="prose prose-stone prose-sm max-w-none
        prose-pre:bg-stone-50 prose-pre:border prose-pre:border-stone-200 prose-pre:rounded
        prose-code:text-sm prose-code:font-mono
        prose-headings:font-semibold prose-headings:text-stone-900
        prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
