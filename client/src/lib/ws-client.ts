import type {
  ReplyEnvelope,
  RequestEnvelope,
  SubscriptionSpec,
  PushEvent,
  UpdateStatusPayload,
  EditTextPayload,
  CreateIssuePayload,
  Issue,
  Comment,
} from "./types";

type PushHandler = (event: PushEvent) => void;
type ConnectionHandler = (connected: boolean) => void;

let counter = 0;
function nextId(): string {
  return `req-${Date.now()}-${++counter}`;
}

export class WsClient {
  private ws: WebSocket | null = null;
  private pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private sendQueue: string[] = [];
  private pushHandlers = new Set<PushHandler>();
  private connectionHandlers = new Set<ConnectionHandler>();
  private activeSubscriptions = new Map<string, SubscriptionSpec>();
  private reconnectDelay = 500;
  private url: string;
  private disposed = false;

  constructor() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    this.url = `${proto}//${location.host}/ws`;
  }

  connect(): void {
    if (this.disposed) return;
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.reconnectDelay = 500;
      // Flush queued messages
      for (const msg of this.sendQueue) {
        this.ws?.send(msg);
      }
      this.sendQueue = [];
      // Resubscribe all active subscriptions
      for (const [, spec] of this.activeSubscriptions) {
        this.rawSend("subscribe-list", spec);
      }
      for (const h of this.connectionHandlers) h(true);
    };
    this.ws.onclose = () => {
      for (const h of this.connectionHandlers) h(false);
      this.scheduleReconnect();
    };
    this.ws.onmessage = (e) => {
      this.handleMessage(JSON.parse(e.data));
    };
  }

  dispose(): void {
    this.disposed = true;
    this.ws?.close();
    this.ws = null;
    for (const [, p] of this.pending) {
      p.reject(new Error("disposed"));
    }
    this.pending.clear();
    this.sendQueue = [];
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;
    setTimeout(() => this.connect(), this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000);
    for (const [id, p] of this.pending) {
      p.reject(new Error("disconnected"));
      this.pending.delete(id);
    }
  }

  private handleMessage(msg: ReplyEnvelope): void {
    if (
      msg.type === "snapshot" ||
      msg.type === "upsert" ||
      msg.type === "delete"
    ) {
      const event = msg.payload as PushEvent;
      for (const handler of this.pushHandlers) handler(event);
      return;
    }
    const pending = this.pending.get(msg.id);
    if (pending) {
      this.pending.delete(msg.id);
      if (msg.ok) pending.resolve(msg.payload);
      else pending.reject(new Error(msg.error?.message || "unknown error"));
    }
  }

  /** Send without promise tracking (used for resubscribe on reconnect) */
  private rawSend(type: string, payload?: unknown): void {
    const id = nextId();
    const envelope: RequestEnvelope = { id, type, payload };
    const msg = JSON.stringify(envelope);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      this.sendQueue.push(msg);
    }
  }

  private send<T = unknown>(type: string, payload?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = nextId();
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      const envelope: RequestEnvelope = { id, type, payload };
      const msg = JSON.stringify(envelope);
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(msg);
      } else {
        this.sendQueue.push(msg);
      }
    });
  }

  onConnection(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  onPush(handler: PushHandler): () => void {
    this.pushHandlers.add(handler);
    return () => this.pushHandlers.delete(handler);
  }

  // Subscriptions — tracked for auto-resubscribe on reconnect
  subscribe(spec: SubscriptionSpec): Promise<{ id: string; key: string }> {
    this.activeSubscriptions.set(spec.id, spec);
    return this.send("subscribe-list", spec);
  }

  unsubscribe(id: string): Promise<void> {
    this.activeSubscriptions.delete(id);
    return this.send("unsubscribe-list", { id });
  }

  // Mutations
  updateStatus(payload: UpdateStatusPayload): Promise<Issue> {
    return this.send("update-status", payload);
  }

  editText(payload: EditTextPayload): Promise<Issue> {
    return this.send("edit-text", payload);
  }

  createIssue(payload: CreateIssuePayload): Promise<{ created: boolean }> {
    return this.send("create-issue", payload);
  }

  updatePriority(id: string, priority: number): Promise<Issue> {
    return this.send("update-priority", { id, priority });
  }

  updateAssignee(id: string, assignee: string): Promise<Issue> {
    return this.send("update-assignee", { id, assignee });
  }

  addLabel(id: string, label: string): Promise<Issue> {
    return this.send("label-add", { id, label });
  }

  removeLabel(id: string, label: string): Promise<Issue> {
    return this.send("label-remove", { id, label });
  }

  deleteIssue(id: string): Promise<{ deleted: boolean; id: string }> {
    return this.send("delete-issue", { id });
  }

  getComments(id: string): Promise<Comment[]> {
    return this.send("get-comments", { id });
  }

  addComment(id: string, text: string): Promise<Comment[]> {
    return this.send("add-comment", { id, text });
  }

  addDep(a: string, b: string): Promise<Issue> {
    return this.send("dep-add", { a, b });
  }

  removeDep(a: string, b: string): Promise<Issue> {
    return this.send("dep-remove", { a, b });
  }

  listWorkspaces(): Promise<unknown> {
    return this.send("list-workspaces");
  }

  getWorkspace(): Promise<unknown> {
    return this.send("get-workspace");
  }

  setWorkspace(path: string, database: string): Promise<unknown> {
    return this.send("set-workspace", { path, database });
  }
}
