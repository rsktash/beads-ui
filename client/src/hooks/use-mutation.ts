import { useCallback } from "react";
import { useWs } from "../lib/ws-context";
import type {
  EditTextPayload,
  CreateIssuePayload,
} from "../lib/types";

export function useMutation() {
  const ws = useWs();

  return {
    updateStatus: useCallback(
      (id: string, status: "open" | "in_progress" | "closed") =>
        ws.updateStatus({ id, status }),
      [ws],
    ),
    editText: useCallback(
      (payload: EditTextPayload) => ws.editText(payload),
      [ws],
    ),
    createIssue: useCallback(
      (payload: CreateIssuePayload) => ws.createIssue(payload),
      [ws],
    ),
    updatePriority: useCallback(
      (id: string, priority: number) => ws.updatePriority(id, priority),
      [ws],
    ),
    updateAssignee: useCallback(
      (id: string, assignee: string) => ws.updateAssignee(id, assignee),
      [ws],
    ),
    addLabel: useCallback(
      (id: string, label: string) => ws.addLabel(id, label),
      [ws],
    ),
    removeLabel: useCallback(
      (id: string, label: string) => ws.removeLabel(id, label),
      [ws],
    ),
    deleteIssue: useCallback((id: string) => ws.deleteIssue(id), [ws]),
    addComment: useCallback(
      (id: string, text: string) => ws.addComment(id, text),
      [ws],
    ),
    addDep: useCallback(
      (a: string, b: string) => ws.addDep(a, b),
      [ws],
    ),
    removeDep: useCallback(
      (a: string, b: string) => ws.removeDep(a, b),
      [ws],
    ),
  };
}
