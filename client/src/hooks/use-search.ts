import { useState, useMemo } from "react";
import type { Issue } from "../lib/types";

export function useSearch(issues: Issue[]) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return issues;
    const q = query.toLowerCase();
    return issues.filter(
      (i) =>
        i.id.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q) ||
        (i.description || "").toLowerCase().includes(q),
    );
  }, [issues, query]);

  return { query, setQuery, results };
}
