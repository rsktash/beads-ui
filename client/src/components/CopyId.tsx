import { useState, useCallback } from "react";

const CopyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="5" width="9" height="9" rx="1.5" />
    <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8.5l3.5 3.5 6.5-7" />
  </svg>
);

export function CopyId({ id, className, style }: { id: string; className?: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

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
      className={`font-mono cursor-pointer select-none inline-flex items-center gap-1 ${className || ""}`}
      style={{
        color: copied ? "var(--accent)" : hovered ? "var(--text-secondary)" : "var(--text-tertiary)",
        transition: "color 150ms ease",
        ...style,
      }}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Click to copy"
    >
      {id}
      <span style={{ opacity: copied || hovered ? 1 : 0, transition: "opacity 150ms ease" }}>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </span>
    </span>
  );
}
