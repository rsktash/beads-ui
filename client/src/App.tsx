import { WsProvider } from "./lib/ws-context";
import { Layout } from "./components/Layout";
import { Board } from "./views/Board";
import { List } from "./views/List";
import { Detail } from "./views/Detail";
import { SearchDialog } from "./components/SearchDialog";

export function App() {
  return (
    <WsProvider>
      <SearchDialog />
      <Layout>
        {(route) => {
          if (route.startsWith("#/detail/")) {
            const id = route.replace("#/detail/", "");
            return <Detail key={id} issueId={id} />;
          }
          if (route.startsWith("#/list")) return <List />;
          if (
            route.startsWith("#/board") ||
            route === "" ||
            route === "#/" ||
            route === "#"
          )
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
