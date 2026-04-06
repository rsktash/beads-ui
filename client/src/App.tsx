import { AuthProvider, useAuth } from "./lib/auth";
import { WsProvider } from "./lib/ws-context";
import { Layout } from "./components/Layout";
import { Login } from "./components/Login";
import { Board } from "./views/Board";
import { List } from "./views/List";
import { Detail } from "./views/Detail";
import { SearchDialog } from "./components/SearchDialog";

function Main() {
  const { loading, authEnabled, token } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading...</div>
      </div>
    );
  }

  if (authEnabled && !token) {
    return <Login />;
  }

  return (
    <WsProvider>
      <SearchDialog />
      <Layout>
        {(route) => {
          if (route.startsWith("/detail/")) {
            const id = route.replace("/detail/", "");
            return <Detail key={id} issueId={id} />;
          }
          if (route.startsWith("/list")) return <List />;
          if (route.startsWith("/board") || route === "/")
            return <Board />;
          return (
            <div className="p-6 text-stone-400">
              View not implemented yet
            </div>
          );
        }}
      </Layout>
    </WsProvider>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Main />
    </AuthProvider>
  );
}
