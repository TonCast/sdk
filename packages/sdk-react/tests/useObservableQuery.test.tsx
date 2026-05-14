// useObservableQuery — adapter test against a fake Observable, no real SDK
// streams. Covers: every emission updates `data`, `useSyncExternalStore` wakes
// React on each push (no batching), unsubscribe on unmount.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ToncastObservable } from "@toncast/sdk/core";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useObservableQuery } from "../src";

function wrap(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("useObservableQuery", () => {
  it("emits → data updates per push", async () => {
    let emit: ((value: number) => void) | null = null;
    const observable = new ToncastObservable<number>((s) => {
      emit = (v) => s.next(v);
    });
    const qc = new QueryClient();
    const { result } = renderHook(
      () =>
        useObservableQuery<number>({
          queryKey: ["fake", "obs"],
          requestFn: () => observable,
        }),
      { wrapper: wrap(qc) },
    );

    await act(async () => {
      emit?.(1);
    });
    await waitFor(() => expect(result.current.data).toBe(1));

    await act(async () => {
      emit?.(2);
    });
    await waitFor(() => expect(result.current.data).toBe(2));

    await act(async () => {
      emit?.(3);
    });
    await waitFor(() => expect(result.current.data).toBe(3));
  });

  it("unsubscribes on unmount", async () => {
    const teardown = vi.fn();
    const observable = new ToncastObservable<number>((s) => {
      s.next(42);
      return teardown;
    });
    const qc = new QueryClient();
    const { unmount } = renderHook(
      () => useObservableQuery<number>({ queryKey: ["fake", "td"], requestFn: () => observable }),
      { wrapper: wrap(qc) },
    );

    unmount();
    // teardown runs in a setTimeout to dodge StrictMode churn — wait one tick.
    await new Promise((r) => setTimeout(r, 10));
    expect(teardown).toHaveBeenCalled();
  });
});
