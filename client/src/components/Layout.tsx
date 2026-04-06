import { useState, useEffect, type ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { useWs } from "../lib/ws-context";

function useRoute(): string {
  const [path, setPath] = useState(window.location.pathname || "/board");
  useEffect(() => {
    const handler = () => setPath(window.location.pathname || "/board");
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
  return path;
}

export function navigate(path: string) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function NavLink({ href, label, icon, active }: { href: string; label: string; icon: ReactNode; active: boolean }) {
  return (
    <a
      href={href}
      onClick={(e) => { e.preventDefault(); navigate(href); }}
      className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors"
      style={{
        background: active ? "var(--bg-hover)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        fontWeight: active ? 500 : 400,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      {icon}
      {label}
    </a>
  );
}

const BoardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1" width="5" height="6" rx="1" />
    <rect x="10" y="1" width="5" height="9" rx="1" />
    <rect x="1" y="9" width="5" height="6" rx="1" />
    <rect x="10" y="12" width="5" height="3" rx="1" />
  </svg>
);

const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="5" y1="4" x2="14" y2="4" />
    <line x1="5" y1="8" x2="14" y2="8" />
    <line x1="5" y1="12" x2="14" y2="12" />
    <circle cx="2" cy="4" r="0.75" fill="currentColor" stroke="none" />
    <circle cx="2" cy="8" r="0.75" fill="currentColor" stroke="none" />
    <circle cx="2" cy="12" r="0.75" fill="currentColor" stroke="none" />
  </svg>
);

export function Layout({
  children,
}: {
  children: (route: string) => ReactNode;
}) {
  const route = useRoute();

  // Intercept internal link clicks to use pushState
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      navigate(href);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);
  const ws = useWs();
  const { user: authUser, authEnabled, logout } = useAuth();
  const [projectName, setProjectName] = useState("");
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    fetch("/api/config").then(r => r.json()).then(data => {
      setAppVersion(data.version || "");
    }).catch(() => {});
  }, []);

  useEffect(() => {
    ws.getWorkspace().then((res: any) => {
      if (res?.db_path) {
        // db_path is like /path/to/project/.beads — parent is the project
        const parts = res.db_path.split("/").filter(Boolean);
        const beadsIdx = parts.lastIndexOf(".beads");
        if (beadsIdx > 0) {
          setProjectName(parts[beadsIdx - 1]);
          return;
        }
      }
      if (res?.root_dir) {
        setProjectName(res.root_dir.split("/").pop() || "");
      }
    }).catch(() => {});
  }, [ws]);

  return (
    <div className="flex h-screen" style={{ background: "var(--bg-base)" }}>
      <nav
        className="flex flex-col"
        style={{
          width: "200px",
          borderRight: "1px solid var(--border-subtle)",
          background: "var(--bg-base)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5">
          <div
            className="flex items-center justify-center rounded-md"
            style={{
              width: "28px",
              height: "28px",
              background: "var(--accent)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
              <circle cx="7" cy="4" r="2.5" />
              <circle cx="4" cy="10" r="2.5" />
              <circle cx="10" cy="10" r="2.5" />
            </svg>
          </div>
          <span
            className="font-bold"
            style={{
              fontSize: "16px",
              color: "var(--text-primary)",
            }}
          >
            Beads
          </span>
        </div>

        {/* Project name */}
        {projectName && (
          <div className="px-4 pb-3 mb-1" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
              {projectName}
            </span>
          </div>
        )}

        {/* Nav links */}
        <div className="px-2 space-y-0.5">
          <NavLink
            href="/board"
            label="Board"
            icon={<BoardIcon />}
            active={route.startsWith("/board") || route === "/"}
          />
          <NavLink
            href="/list"
            label="List"
            icon={<ListIcon />}
            active={route.startsWith("/list")}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Version */}
        {appVersion && (
          <div className="px-4 pb-2 text-center">
            <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>v{appVersion}</span>
          </div>
        )}

        {/* User card */}
        {authUser && (
          <div
            className="mx-3 mb-3 px-3 py-2.5 rounded-md flex items-center gap-2.5"
            style={{
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div
              className="flex items-center justify-center rounded-full text-xs font-bold shrink-0"
              style={{
                width: "28px",
                height: "28px",
                background: "var(--accent)",
                color: "white",
              }}
            >
              {authUser.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{authUser.username}</div>
              {authUser.role && <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{authUser.role}</div>}
            </div>
            {authEnabled && (
              <button
                onClick={logout}
                className="shrink-0 p-1 rounded transition-colors"
                style={{ color: "var(--text-tertiary)" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-tertiary)"}
                title="Sign out"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
                  <path d="M11 11l3-3-3-3" />
                  <line x1="6" y1="8" x2="14" y2="8" />
                </svg>
              </button>
            )}
          </div>
        )}
      </nav>
      <main className="flex-1 overflow-auto">{children(route)}</main>
    </div>
  );
}
