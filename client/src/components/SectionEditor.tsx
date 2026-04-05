import { useState, useCallback, useEffect } from "react";
import { Markdown } from "./Markdown";

interface SectionEditorProps {
  label: string;
  value: string;
  placeholder?: string;
  onSave: (value: string) => Promise<unknown>;
}

export function SectionEditor({
  label,
  value,
  placeholder,
  onSave,
}: SectionEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);

  // Sync draft with external value when not editing
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
      setTab("edit");
    } finally {
      setSaving(false);
    }
  }, [draft, onSave]);

  const handleCancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
    setTab("edit");
  }, [value]);

  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel],
  );

  if (!editing) {
    return (
      <div
        className="group rounded-lg p-4"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <h3
            className="font-semibold uppercase tracking-wider"
            style={{ fontSize: "11px", color: "var(--text-tertiary)" }}
          >
            {label}
          </h3>
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: "var(--text-tertiary)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
            title={`Edit ${label}`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
        </div>
        {value ? (
          <Markdown content={value} />
        ) : (
          <p className="text-sm italic" style={{ color: "var(--text-tertiary)" }}>
            {placeholder || `Add ${label.toLowerCase()}...`}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--accent)",
        boxShadow: "var(--shadow-card)",
      }}
      onKeyDown={handleEditorKeyDown}
    >
      <div className="flex items-center justify-between mb-2">
        <h3
          className="font-semibold uppercase tracking-wider"
          style={{ fontSize: "11px", color: "var(--text-tertiary)" }}
        >
          {label}
        </h3>
        <div
          className="flex overflow-hidden text-xs rounded-md"
          style={{ border: "1px solid var(--border-default)" }}
        >
          <button
            onClick={() => setTab("edit")}
            className="px-2.5 py-1 font-medium"
            style={{
              background: tab === "edit" ? "var(--bg-hover)" : "var(--bg-elevated)",
              color: tab === "edit" ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            Edit
          </button>
          <button
            onClick={() => setTab("preview")}
            className="px-2.5 py-1 font-medium"
            style={{
              background: tab === "preview" ? "var(--bg-hover)" : "var(--bg-elevated)",
              color: tab === "preview" ? "var(--text-primary)" : "var(--text-secondary)",
              borderLeft: "1px solid var(--border-default)",
            }}
          >
            Preview
          </button>
        </div>
      </div>
      {tab === "edit" ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={10}
          className="w-full p-3 text-sm font-mono rounded-md resize-y outline-none"
          style={{
            border: "1px solid var(--border-default)",
            background: "var(--bg-base)",
            color: "var(--text-primary)",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
          autoFocus
        />
      ) : (
        <div
          className="p-3 rounded-md min-h-[160px]"
          style={{
            border: "1px solid var(--border-default)",
            background: "var(--bg-base)",
          }}
        >
          <Markdown content={draft} />
        </div>
      )}
      <div className="flex items-center justify-end gap-2 mt-3">
        <span className="text-xs mr-auto" style={{ color: "var(--text-tertiary)" }}>
          Cmd+S to save, Esc to cancel
        </span>
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 text-sm rounded-md transition-colors"
          style={{
            color: "var(--text-secondary)",
            border: "1px solid var(--border-default)",
            background: "var(--bg-elevated)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 text-sm rounded-md font-medium disabled:opacity-50 transition-colors"
          style={{
            background: "var(--accent)",
            color: "white",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
