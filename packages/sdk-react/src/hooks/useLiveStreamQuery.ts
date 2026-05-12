import type { Observer, Subscribable, Subscription } from "@toncast/sdk";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { serializeKey } from "../utils/serializeKey";

export type LiveQueryStatus = "pending" | "success" | "error";

export interface LiveStream<T> extends Subscribable<T> {
  getStatus?(): string;
  getError?(): Error | null;
  onStatus?(listener: (status: string) => void): () => void;
  refresh?(): Promise<void> | void;
}

export interface UseLiveStreamQueryOptions<T> {
  queryKey: readonly unknown[];
  requestFn: () => LiveStream<T>;
  enabled?: boolean;
  keepPreviousData?: boolean;
}

export interface UseLiveStreamQueryResult<T> {
  data: T | undefined;
  error: unknown;
  status: LiveQueryStatus;
  streamStatus: string | undefined;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => Promise<void>;
}

interface LiveState<T> {
  data: T | undefined;
  error: unknown;
  status: LiveQueryStatus;
  streamStatus: string | undefined;
}

class LiveStore<T> {
  private listeners = new Set<() => void>();

  constructor(private state: LiveState<T>) {}

  getSnapshot = (): LiveState<T> => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  set(next: Partial<LiveState<T>>): void {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }
}

export function useLiveStreamQuery<T>({
  queryKey,
  requestFn,
  enabled = true,
  keepPreviousData = false,
}: UseLiveStreamQueryOptions<T>): UseLiveStreamQueryResult<T> {
  const stableKey = useMemo(() => JSON.stringify(serializeKey(queryKey)), [queryKey]);
  const requestFnRef = useRef(requestFn);
  requestFnRef.current = requestFn;

  const storeRef = useRef<{ key: string; store: LiveStore<T> } | null>(null);
  const previous = storeRef.current?.store.getSnapshot();
  if (!storeRef.current || storeRef.current.key !== stableKey) {
    storeRef.current = {
      key: stableKey,
      store: new LiveStore<T>({
        data: keepPreviousData ? previous?.data : undefined,
        error: undefined,
        status: keepPreviousData && previous?.data !== undefined ? "success" : "pending",
        streamStatus: undefined,
      }),
    };
  }

  const store = storeRef.current.store;
  const currentStreamRef = useRef<LiveStream<T> | null>(null);

  useEffect(() => {
    if (!enabled) {
      currentStreamRef.current = null;
      store.set({ error: undefined, status: "pending", streamStatus: undefined });
      return;
    }

    let closed = false;
    const stream = requestFnRef.current();
    currentStreamRef.current = stream;

    const syncStatus = (streamStatus = stream.getStatus?.()) => {
      if (closed) return;
      const error =
        streamStatus === "error" ? (stream.getError?.() ?? new Error("Stream error")) : undefined;
      store.set({
        error,
        streamStatus,
        status: error ? "error" : store.getSnapshot().data === undefined ? "pending" : "success",
      });
    };

    const subscription: Subscription = stream.subscribe({
      next: (value: T) => {
        if (closed) return;
        store.set({
          data: value,
          error: undefined,
          status: "success",
          streamStatus: stream.getStatus?.(),
        });
      },
      error: (error: unknown) => {
        if (closed) return;
        store.set({
          error,
          status: "error",
          streamStatus: stream.getStatus?.() ?? "error",
        });
      },
    } satisfies Observer<T>);
    const offStatus = stream.onStatus?.(syncStatus);
    syncStatus();

    return () => {
      closed = true;
      offStatus?.();
      subscription.unsubscribe();
      if (currentStreamRef.current === stream) currentStreamRef.current = null;
    };
  }, [enabled, store]);

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  return {
    ...snapshot,
    isLoading: snapshot.status === "pending",
    isError: snapshot.status === "error",
    isSuccess: snapshot.status === "success",
    refetch: async () => {
      await currentStreamRef.current?.refresh?.();
    },
  };
}
