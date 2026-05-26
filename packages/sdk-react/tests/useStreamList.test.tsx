import { act, renderHook, waitFor } from "@testing-library/react";
import type { Pari } from "@toncast/sdk";
import type { Observer, Subscription } from "@toncast/sdk/core";
import { describe, expect, it, vi } from "vitest";
import { useStreamList } from "../src/hooks/useStreamList";

const pari = (id: string): Pari =>
  ({
    id,
    name: id,
    description: "",
    endTime: 9_999_999_999,
    image: "",
    yesVolume: 0,
    noVolume: 0,
    status: "active",
    result: "pending",
    createdAt: 0,
    isVisible: true,
    bestYesOdds: 50,
    bestNoOdds: 50,
    version: "v2",
    availableBets: null,
  }) as Pari;

const { fakeStream } = vi.hoisted(() => {
  class FakeParisListStream {
    private observer: Observer<Pari[]> | null = null;
    private statusListeners = new Set<(status: string) => void>();
    private status = "loading";
    private hasMoreFlag = false;
    private loadMoreError: Error | null = null;
    private loadMoreImpl: (() => Promise<void>) | null = null;
    private items: Pari[] = [];

    subscribe(observer: Observer<Pari[]>): Subscription {
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
      return null;
    }

    get hasMore(): boolean {
      return this.hasMoreFlag;
    }

    getLoadMoreError(): Error | null {
      return this.loadMoreError;
    }

    setLoadMoreHandler(fn: () => Promise<void>): void {
      this.loadMoreImpl = fn;
    }

    async loadMore(): Promise<void> {
      if (this.loadMoreImpl) await this.loadMoreImpl();
    }

    async refresh(): Promise<void> {
      this.emit(this.items, this.hasMoreFlag);
    }

    emit(items: Pari[], hasMore = false): void {
      this.items = items;
      this.hasMoreFlag = hasMore;
      this.loadMoreError = null;
      this.status = "live";
      this.observer?.next?.([...items]);
      for (const listener of this.statusListeners) listener(this.status);
    }

    failLoadMore(error: Error): void {
      this.loadMoreError = error;
      this.observer?.next?.([...this.items]);
      for (const listener of this.statusListeners) listener(this.status);
    }
  }

  return { fakeStream: new FakeParisListStream() };
});

vi.mock("../src/client/useToncastClient", () => ({
  useToncastClient: () => ({
    paris: {
      streamList: () => fakeStream,
    },
  }),
}));

describe("useStreamList", () => {
  it("resets data when params change and keepPreviousData is false", async () => {
    const { result, rerender } = renderHook(
      ({ feed }: { feed: "active" | "finished" }) =>
        useStreamList({ feed }, { keepPreviousData: false }),
      { initialProps: { feed: "active" as const } },
    );

    await act(async () => fakeStream.emit([pari("A1")], true));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    rerender({ feed: "finished" });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    await act(async () => fakeStream.emit([pari("F1")], false));
    await waitFor(() => expect(result.current.data?.[0]?.id).toBe("F1"));
  });

  it("keeps previous data when keepPreviousData is true (default)", async () => {
    const { result, rerender } = renderHook(
      ({ feed }: { feed: "active" | "finished" }) => useStreamList({ feed }),
      { initialProps: { feed: "active" as const } },
    );

    await act(async () => fakeStream.emit([pari("A1")], true));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    rerender({ feed: "finished" });
    expect(result.current.data).toHaveLength(1);

    await act(async () => fakeStream.emit([pari("F1")], false));
    await waitFor(() => expect(result.current.data?.[0]?.id).toBe("F1"));
  });

  it("fetchNextPage appends via stream loadMore and surfaces loadMore errors", async () => {
    const { result } = renderHook(() => useStreamList({ feed: "active" }));

    await act(async () => fakeStream.emit([pari("P1")], true));
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    fakeStream.setLoadMoreHandler(async () => {
      fakeStream.emit([pari("P1"), pari("P2")], false);
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);

    await act(async () => {
      fakeStream.emit([pari("P1")], true);
    });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    fakeStream.setLoadMoreHandler(async () => {
      fakeStream.failLoadMore(new Error("network"));
    });
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.fetchNextPageError).toBeInstanceOf(Error));
  });
});
