import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
} from "react";
import { WsClient } from "./ws-client";

const WsContext = createContext<WsClient | null>(null);

export function WsProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<WsClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new WsClient();
    clientRef.current.connect();
  }
  return (
    <WsContext.Provider value={clientRef.current}>
      {children}
    </WsContext.Provider>
  );
}

export function useWs(): WsClient {
  const client = useContext(WsContext);
  if (!client) throw new Error("useWs must be inside WsProvider");
  return client;
}
