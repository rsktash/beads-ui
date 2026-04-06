import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";

export function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const err = await login(username, password);
    if (err) setError(err);
    setSubmitting(false);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg-base)" }}
    >
      <div
        className="w-full max-w-sm rounded-lg p-8"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div
            className="flex items-center justify-center rounded-md"
            style={{ width: "32px", height: "32px", background: "var(--accent)" }}
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="white">
              <circle cx="7" cy="4" r="2.5" />
              <circle cx="4" cy="10" r="2.5" />
              <circle cx="10" cy="10" r="2.5" />
            </svg>
          </div>
          <span
            className="font-bold text-xl"
            style={{ color: "var(--text-primary)" }}
          >
            Beads
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              className="block text-sm mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-sm outline-none"
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
              autoFocus
            />
          </div>
          <div className="mb-6">
            <label
              className="block text-sm mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-sm outline-none"
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          {error && (
            <div
              className="mb-4 text-sm px-3 py-2 rounded-md"
              style={{ background: "rgba(220,50,47,0.12)", color: "#dc322f" }}
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting || !username || !password}
            className="w-full py-2 rounded-md text-sm font-medium transition-opacity"
            style={{
              background: "var(--accent)",
              color: "white",
              opacity: submitting || !username || !password ? 0.5 : 1,
            }}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
