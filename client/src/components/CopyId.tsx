import { useState, useCallback } from "react";

export function CopyId({ id, className, style }: { id: string; className?: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }, [id]);

  return (
    <span
      className={`font-mono cursor-pointer select-none ${className || ""}`}
      style={{
        color: copied ? "var(--accent)" : "var(--text-tertiary)",
        transition: "color 150ms ease",
        ...style,
      }}
      onClick={handleClick}
      title="Click to copy"
    >
      {copied ? "Copied!" : id}
    </span>
  );
}
