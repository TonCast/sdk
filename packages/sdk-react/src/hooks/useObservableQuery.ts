// TanStack Query adapter for `@toncast/sdk`'s mini-Observable.
//
// Critical invariants we encode here:
//
//  1. **Subscribe on every mount.** Streams are long-lived (`Subscribable<T>`)
//     and we MUST hold an active subscription while the component is mounted,
//     otherwise live broadcasts are received by no one and the cached snapshot
//     goes stale silently. With `staleTime: Infinity` (the obvious default for
//     "never want to refetch") TanStack would skip queryFn on remount and we'd
//     never re-subscribe — that's the bug. So we use `staleTime: 0` and let
//     queryFn re-run on every fresh mount; the SDK's own pool guarantees the
//     same stream object across mounts (no extra HTTP, no extra WS).
//
//  2. **Resolve on first emission; reject on early `complete()`.** Streams
//     almost never complete — `complete()` would mean "stream is done
//     forever", which is never true for /ws/pari-list and friends. Resolving
//     on first `next` flips React Query out of `pending`. If `complete()`
//     fires before any `next`, we reject so the query enters error state
//     rather than silently returning `undefined` typed as `T`.
//
//  3. **Don't invalidate the query on unmount.** Earlier we used the
//     `invalidateQueries({ refetchType: "none" })` trick to mark fresh — but
//     that interfered with the re-subscribe-on-mount semantics above. The
//     right behaviour is to simply unsubscribe and let the SDK pool keep the
//     stream warm; the next mount will re-acquire it.
//
//  4. **Force-render on every emission.** TanStack batches `setQueryData`,
//     so multi-emit microtasks would collapse into a single render and lose
//     intermediate values. `useSyncExternalStore` gives us per-emit wakeups.

import {
  type QueryFunctionContext,
  type UseQueryOptions,
  type UseQueryResult,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Observer, Subscribable, Subscription } from "@toncast/sdk";
import { useRef, useSyncExternalStore } from "react";

export interface UseObservableQueryOptions<T, TError = unknown>
  extends Omit<UseQueryOptions<T, TError, T>, "queryFn" | "staleTime" | "retry"> {
  /**
   * Produces the subscription source for this query. Anything implementing
   * `Subscribable<T>` works — pure `ToncastObservable<T>` returned by REST
   * methods, or stateful stream objects (`ParisListStream`, `PariStream`)
   * that expose the same `subscribe(observer)` shape.
   *
   * For streams, the SDK pools them by params — calling `requestFn` on every
   * mount is cheap (returns the same warm stream, no extra fetch/WS).
   */
  requestFn: (ctx: QueryFunctionContext) => Subscribable<T>;
}

export type UseObservableQueryResult<T, TError = unknown> = UseQueryResult<T, TError>;

const FORCE_UPDATE = "force-update";

interface RunDeps<T> {
  requestFn: (ctx: QueryFunctionContext) => Subscribable<T>;
  ctx: QueryFunctionContext;
  onData: (value: T) => void;
}

/**
 * Subscribe to the source, push every emission through `onData`, resolve the
 * host Promise on the FIRST emission so `useQuery` exits its pending state.
 * The subscription stays alive after the promise settles — broadcasts keep
 * flowing into `onData`. `error()` rejects the promise. `signal.abort()`
 * (component unmount, params change) tears down the subscription.
 */
function runObservable<T>(deps: RunDeps<T>): Promise<T> {
  const { requestFn, ctx, onData } = deps;
  return new Promise<T>((resolve, reject) => {
    let resolved = false;
    let sub: Subscription | undefined;

    const onAbort = () => {
      // Defer one tick to absorb React StrictMode's dev-only mount/unmount
      // dance — the immediate-then-mounted-again sequence keeps the SDK
      // pool's subscriber count stable across the bounce.
      setTimeout(() => sub?.unsubscribe(), 0);
    };

    try {
      sub = requestFn(ctx).subscribe({
        next: (value) => {
          onData(value);
          if (!resolved) {
            resolved = true;
            resolve(value);
          }
        },
        error: (err) => {
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        },
        // Streams almost never complete. If one does before emitting a
        // single value, put the query into error state — returning
        // `undefined as T` would be a type lie that silently crashes
        // consumers who dereference fields on the result.
        complete: () => {
          if (!resolved) {
            resolved = true;
            reject(new Error("Stream completed without emitting any values"));
          }
        },
      } satisfies Observer<T>);
    } catch (err) {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    }

    if (ctx.signal.aborted) onAbort();
    else ctx.signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * `useQuery` for any Observable from `@toncast/sdk` (e.g. `paris.streamList()`,
 * `paris.subscribe(id)`). For one-shot REST methods just use TanStack's
 * `useQuery({ queryKey, queryFn: () => client.paris.list(...) })` — the SDK
 * methods are still Promise-returning (and Thenable Observables).
 */
export function useObservableQuery<T, TError = unknown>({
  queryKey,
  requestFn,
  enabled,
  ...rest
}: UseObservableQueryOptions<T, TError>): UseObservableQueryResult<T, TError> {
  const queryClient = useQueryClient();
  const updateEmitter = useRef<EventTarget>(new EventTarget());

  useSyncExternalStore(
    (cb) => {
      const target = updateEmitter.current;
      target.addEventListener(FORCE_UPDATE, cb);
      return () => target.removeEventListener(FORCE_UPDATE, cb);
    },
    () => queryClient.getQueryData<T>(queryKey),
    () => queryClient.getQueryData<T>(queryKey),
  );

  return useQuery<T, TError, T>({
    ...rest,
    queryKey,
    enabled,
    queryFn: (ctx) =>
      runObservable<T>({
        requestFn,
        ctx,
        onData: (value) => {
          queryClient.setQueryData<T>(queryKey, value);
          updateEmitter.current.dispatchEvent(new Event(FORCE_UPDATE));
        },
      }),
    // Default 0: forces TanStack to call queryFn on every fresh mount, which
    // is how we re-subscribe to the SDK pool. The SDK pool itself dedupes —
    // re-subscribing returns the warm stream synchronously without any HTTP
    // or WS reconnect.
    staleTime: 0,
    // Don't auto-refetch on focus/reconnect — broadcasts keep us live.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: true,
    retry: false,
    // Disable structural sharing — TanStack's deep equality on nested arrays
    // (e.g. `oddsState.{Yes,No}: number[]`) sometimes returns the OLD object
    // reference even when a slot at index N changed. Downstream components
    // memo'd on `snap.oddsState` then never re-render. Snapshots from streams
    // are already snapshot-shaped (fresh top-level wrapper per emit) so we
    // hand them straight through.
    structuralSharing: false,
  });
}
