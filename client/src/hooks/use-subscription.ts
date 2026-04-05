import { useEffect, useState, useRef } from "react";
import { useWs } from "../lib/ws-context";
import type { Issue, SubscriptionType, PushEvent } from "../lib/types";
import { WsClient } from "../lib/ws-client";

/**
 * Shared subscription cache. Multiple useSubscription() calls with the same
 * type+params share a single server-side subscription. The cache lives on
 * the WsClient instance (via WeakMap) so it's scoped to the connection.
 */

interface SharedSub {
  refCount: number;
  subId: string;
  items: Map<string, Issue>;
  listeners: Set<() => void>;
  loading: boolean;
  total: number;
  cleanupPush: (() => void) | null;
}

const clientCaches = new WeakMap<WsClient, Map<string, SharedSub>>();

function getCache(ws: WsClient): Map<string, SharedSub> {
  let cache = clientCaches.get(ws);
  if (!cache) {
    cache = new Map();
    clientCaches.set(ws, cache);
  }
  return cache;
}

function cacheKey(
  type: SubscriptionType,
  params?: Record<string, string | number | boolean>,
): string {
  return params ? `${type}:${JSON.stringify(params)}` : type;
}

function acquireSubscription(
  ws: WsClient,
  type: SubscriptionType,
  params?: Record<string, string | number | boolean>,
): SharedSub {
  const cache = getCache(ws);
  const key = cacheKey(type, params);

  let shared = cache.get(key);
  if (shared) {
    shared.refCount++;
    return shared;
  }

  const subId = `sub-${type}-${Date.now()}`;
  shared = {
    refCount: 1,
    subId,
    items: new Map(),
    listeners: new Set(),
    loading: true,
    total: 0,
    cleanupPush: null,
  };

  const notify = () => {
    for (const listener of shared!.listeners) listener();
  };

  shared.cleanupPush = ws.onPush((event: PushEvent) => {
    if (event.id !== subId) return;

    if (event.type === "snapshot") {
      shared!.items = new Map();
      for (const issue of event.issues) shared!.items.set(issue.id, issue);
      shared!.loading = false;
      if (typeof event.total === "number") {
        shared!.total = event.total;
      } else {
        shared!.total = event.issues.length;
      }
      notify();
    } else if (event.type === "upsert") {
      shared!.items.set(event.issue.id, event.issue);
      notify();
    } else if (event.type === "delete") {
      shared!.items.delete(event.issue_id);
      notify();
    }
  });

  ws.subscribe({ id: subId, type, params });
  cache.set(key, shared);
  return shared;
}

function releaseSubscription(
  ws: WsClient,
  type: SubscriptionType,
  params?: Record<string, string | number | boolean>,
): void {
  const cache = getCache(ws);
  const key = cacheKey(type, params);
  const shared = cache.get(key);
  if (!shared) return;

  shared.refCount--;
  if (shared.refCount <= 0) {
    shared.cleanupPush?.();
    ws.unsubscribe(shared.subId);
    cache.delete(key);
  }
}

export function useSubscription(
  type: SubscriptionType,
  params?: Record<string, string | number | boolean>,
): { issues: Issue[]; loading: boolean; refreshing: boolean; total: number } {
  const ws = useWs();
  const paramsKey = params ? JSON.stringify(params) : "";
  const sharedRef = useRef<SharedSub | null>(null);

  // Track whether we've ever received data (initial load vs refresh)
  const hasLoadedOnceRef = useRef(false);
  const [staleIssues, setStaleIssues] = useState<Issue[]>([]);
  const [staleTotal, setStaleTotal] = useState(0);

  // Acquire/release shared subscription on mount/unmount
  useEffect(() => {
    const shared = acquireSubscription(ws, type, params);
    sharedRef.current = shared;
    return () => {
      releaseSubscription(ws, type, params);
      sharedRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, type, paramsKey]);

  // Subscribe to changes
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const shared = sharedRef.current;
    if (!shared) return;

    const currentIssues = Array.from(shared.items.values());
    setIssues(currentIssues);
    setLoading(shared.loading);
    setTotal(shared.total);

    // When new data arrives, save it as stale for next transition
    if (!shared.loading && currentIssues.length > 0) {
      hasLoadedOnceRef.current = true;
      setStaleIssues(currentIssues);
      setStaleTotal(shared.total);
    }

    const listener = () => {
      const items = Array.from(shared.items.values());
      setIssues(items);
      setLoading(shared.loading);
      setTotal(shared.total);

      if (!shared.loading && items.length > 0) {
        hasLoadedOnceRef.current = true;
        setStaleIssues(items);
        setStaleTotal(shared.total);
      }
    };
    shared.listeners.add(listener);
    return () => {
      shared.listeners.delete(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, type, paramsKey]);

  const isInitialLoad = loading && !hasLoadedOnceRef.current;
  const isRefreshing = loading && hasLoadedOnceRef.current;

  return {
    issues: isRefreshing ? staleIssues : issues,
    loading: isInitialLoad,
    refreshing: isRefreshing,
    total: isRefreshing ? staleTotal : total,
  };
}
