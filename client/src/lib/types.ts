// Issue shape from server
export interface Issue {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "blocked" | "closed";
  priority: number;
  issue_type: string;
  assignee?: string;
  owner?: string;
  created_at: string | number;
  updated_at: string | number;
  closed_at?: string | number | null;
  labels?: string[];
  // Epic fields
  total_children?: number;
  closed_children?: number;
  eligible_for_close?: boolean;
  // Detail fields
  acceptance?: string;
  notes?: string;
  design?: string;
  dependencies?: Array<{ id: string; title: string; status: string }>;
  dependents?: Array<{ id: string; title: string; status: string }>;
  comments?: Comment[];
  parent_id?: string;
  parent_title?: string;
  parent_status?: string;
  parent_type?: string;
}

export interface Comment {
  id: string;
  issue_id: string;
  author: string;
  text: string;
  created_at: number;
  updated_at: number;
}

// Subscription types
export type SubscriptionType =
  | "all-issues"
  | "epics"
  | "blocked-issues"
  | "ready-issues"
  | "in-progress-issues"
  | "closed-issues"
  | "search-issues"
  | "issue-detail";

export interface SubscriptionSpec {
  id: string;
  type: SubscriptionType;
  params?: Record<string, string | number | boolean>;
}

// Message envelopes
export interface RequestEnvelope {
  id: string;
  type: string;
  payload?: unknown;
}

export interface ReplyEnvelope {
  id: string;
  ok: boolean;
  type: string;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
}

// Push event payloads
export interface SnapshotPayload {
  type: "snapshot";
  id: string;
  revision: number;
  issues: Issue[];
  total?: number;
}

export interface UpsertPayload {
  type: "upsert";
  id: string;
  revision: number;
  issue: Issue;
}

export interface DeletePayload {
  type: "delete";
  id: string;
  revision: number;
  issue_id: string;
}

export type PushEvent = SnapshotPayload | UpsertPayload | DeletePayload;

// Mutation payloads
export interface UpdateStatusPayload {
  id: string;
  status: "open" | "in_progress" | "closed";
}

export interface EditTextPayload {
  id: string;
  field: "title" | "description" | "acceptance" | "notes" | "design";
  value: string;
}

export interface CreateIssuePayload {
  title: string;
  type?: string;
  priority?: number;
  description?: string;
}
