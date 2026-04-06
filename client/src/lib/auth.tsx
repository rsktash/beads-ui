import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface AuthState {
  loading: boolean;
  authEnabled: boolean;
  token: string | null;
  user: { username: string; role: string } | null;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>(null!);

export function useAuth() {
  return useContext(AuthContext);
}

/** Get stored token — also used by ws-client for WebSocket auth */
export function getToken(): string | null {
  return localStorage.getItem("bd-ui-token");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [token, setToken] = useState<string | null>(getToken);
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);

  // Check if auth is enabled and validate existing token
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/config");
        const data = await res.json();
        if (!data.authEnabled) {
          setAuthEnabled(false);
          setLoading(false);
          return;
        }
        setAuthEnabled(true);
        // Validate existing token
        const stored = getToken();
        if (stored) {
          const me = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${stored}` },
          });
          const meData = await me.json();
          if (meData.ok && meData.user) {
            setUser(meData.user);
            setToken(stored);
            setLoading(false);
            return;
          }
        }
        // No valid token
        localStorage.removeItem("bd-ui-token");
        setToken(null);
        setUser(null);
      } catch {
        setAuthEnabled(false);
      }
      setLoading(false);
    }
    check();
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!data.ok) return data.error || "Login failed";
      localStorage.setItem("bd-ui-token", data.token);
      setToken(data.token);
      setUser(data.user);
      return null;
    } catch {
      return "Network error";
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("bd-ui-token");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ loading, authEnabled, token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
