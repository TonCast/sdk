import type { Observer, Subscribable, Subscription } from "@toncast/sdk/core";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { serializeKey } from "../utils/serializeKey";

export type LiveQueryStatus = "pending" | "success" | "error";

export interface LiveStream<T> extends Subscribable<T> {
  getStatus?(): string;
  getError?(): Error | null;
  onStatus?(listener: (status: string) => void): () => void;
  refresh?(): Promise<void> | void;
}

/** `paris.streamList()` streams — cursor pagination via `loadMore()`. */
export interface PaginatedLiveStream<T> extends LiveStream<T> {
  readonly hasMore: boolean;
  loadMore(): Promise<void>;
  getLoadMoreError?(): Error | null;
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
  /** True while the stream is fetching a fresh snapshot (including category switches). */
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPageError: unknown;
  refetch: () => Promise<void>;
  fetchNextPage: () => Promise<void>;
}

interface LiveState<T> {
  data: T | undefined;
  error: unknown;
  status: LiveQueryStatus;
  streamStatus: string | undefined;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPageError: unknown;
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

function isPaginatedStream<T>(stream: LiveStream<T>): stream is PaginatedLiveStream<T> {
  return typeof (stream as PaginatedLiveStream<T>).loadMore === "function" && "hasMore" in stream;
}

function readHasNextPage<T>(stream: LiveStream<T>): boolean {
  return isPaginatedStream(stream) ? stream.hasMore : false;
}

function readLoadMoreError<T>(stream: LiveStream<T>): Error | null {
  return isPaginatedStream(stream) ? (stream.getLoadMoreError?.() ?? null) : null;
}

const emptyPagination = {
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPageError: undefined as unknown,
};

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
        ...emptyPagination,
      }),
    };
  }

  const store = storeRef.current.store;
  const currentStreamRef = useRef<LiveStream<T> | null>(null);

  useEffect(() => {
    if (!enabled) {
      currentStreamRef.current = null;
      store.set({
        error: undefined,
        status: "pending",
        streamStatus: undefined,
        ...emptyPagination,
      });
      return;
    }

    let closed = false;
    const stream = requestFnRef.current();
    currentStreamRef.current = stream;

    const syncStatus = (streamStatus = stream.getStatus?.()) => {
      if (closed) return;
      const error =
        streamStatus === "error" ? (stream.getError?.() ?? new Error("Stream error")) : undefined;
      const snap = store.getSnapshot();
      store.set({
        error,
        streamStatus,
        status: error ? "error" : snap.data === undefined ? "pending" : "success",
        hasNextPage: readHasNextPage(stream),
      });
    };

    const subscription: Subscription = stream.subscribe({
      next: (value: T) => {
        if (closed) return;
        const loadMoreError = readLoadMoreError(stream);
        store.set({
          data: value,
          error: undefined,
          status: "success",
          streamStatus: stream.getStatus?.(),
          hasNextPage: readHasNextPage(stream),
          fetchNextPageError: loadMoreError ?? undefined,
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

  const fetchNextPage = useCallback(async () => {
    const stream = currentStreamRef.current;
    if (!stream || !isPaginatedStream(stream) || !stream.hasMore) return;
    const current = store.getSnapshot();
    if (current.isFetchingNextPage) return;

    store.set({ isFetchingNextPage: true, fetchNextPageError: undefined });
    try {
      await stream.loadMore();
      const loadMoreError = readLoadMoreError(stream);
      store.set({
        hasNextPage: readHasNextPage(stream),
        fetchNextPageError: loadMoreError ?? undefined,
      });
    } finally {
      store.set({ isFetchingNextPage: false });
    }
  }, [store]);

  const refetch = useCallback(async () => {
    await currentStreamRef.current?.refresh?.();
  }, []);

  return {
    ...snapshot,
    isLoading: snapshot.status === "pending",
    isFetching: snapshot.streamStatus === "loading" || snapshot.status === "pending",
    isError: snapshot.status === "error",
    isSuccess: snapshot.status === "success",
    refetch,
    fetchNextPage,
  };
}
