import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { Bet, Page, ToncastClient } from "@toncast/sdk";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ToncastProvider, useInfiniteBets } from "../src";

function page(id: string, nextCursor: Page<Bet>["nextCursor"] = null): Page<Bet> {
  return {
    items: [{ id, pariAddress: `pari-${id}` } as unknown as Bet],
    nextCursor,
    hasMore: nextCursor !== null,
  };
}

function wrapper(client: ToncastClient) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ToncastProvider client={client}>{children}</ToncastProvider>
    </QueryClientProvider>
  );
}

describe("useInfiniteBets", () => {
  it("uses the backend cursor as the next infinite-query page param", async () => {
    const firstCursor = { offset: 1 };
    const listForUser = vi
      .fn()
      .mockResolvedValueOnce(page("first", firstCursor))
      .mockResolvedValueOnce(page("second"));
    const client = { bets: { listForUser } } as unknown as ToncastClient;

    const { result } = renderHook(() => useInfiniteBets({ userAddress: "UQ_USER" }), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

    expect(listForUser).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ userAddress: "UQ_USER", cursor: null }),
    );
    expect(listForUser).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ userAddress: "UQ_USER", cursor: firstCursor }),
    );
  });
});
