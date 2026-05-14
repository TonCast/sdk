import { act, renderHook, waitFor } from "@testing-library/react";
import type { Observer, Subscription } from "@toncast/sdk/core";
import { describe, expect, it, vi } from "vitest";
import { useLiveStreamQuery } from "../src";

class FakeStream<T> {
  private observer: Observer<T> | null = null;
  private statusListeners = new Set<(status: string) => void>();
  private status = "loading";
  private error: Error | null = null;

  subscribe(observer: Observer<T>): Subscription {
    this.observer = observer;
    return {
      unsubscribe: vi.fn(() => {
        if (this.observer === observer) this.observer = null;
      }),
      get closed() {
        return false;
      },
    };
  }

  onStatus(listener: (status: string) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  getStatus(): string {
    return this.status;
  }

  getError(): Error | null {
    return this.error;
  }

  emit(value: T): void {
    this.status = "live";
    this.observer?.next?.(value);
    for (const listener of this.statusListeners) listener(this.status);
  }

  fail(error: Error): void {
    this.status = "error";
    this.error = error;
    for (const listener of this.statusListeners) listener(this.status);
  }
}

describe("useLiveStreamQuery", () => {
  it("surfaces stream errors even after the first data emission", async () => {
    const stream = new FakeStream<number>();
    const { result } = renderHook(() =>
      useLiveStreamQuery<number>({
        queryKey: ["fake"],
        requestFn: () => stream,
      }),
    );

    await act(async () => stream.emit(1));
    await waitFor(() => expect(result.current.data).toBe(1));
    expect(result.current.isSuccess).toBe(true);

    await act(async () => stream.fail(new Error("socket down")));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBe(1);
  });
});
