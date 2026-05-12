import { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { Bet, Page, ToncastClient } from "@toncast/sdk";
import { type ReactNode, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ToncastProvider, useBets } from "../src";

const UQ_USER = "UQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAZAm";

function emptyPage(): Page<Bet> {
  return { items: [], nextCursor: null, hasMore: false };
}

describe("ToncastProvider", () => {
  it("invalidates toncast queries when the client instance changes so hooks refetch", async () => {
    const listA = vi.fn().mockResolvedValue(emptyPage());
    const listB = vi.fn().mockResolvedValue(emptyPage());
    const clientA = { bets: { listForUser: listA } } as unknown as ToncastClient;
    const clientB = { bets: { listForUser: listB } } as unknown as ToncastClient;

    const clientRef = { current: clientA };

    function Wrapper({ children }: { children: ReactNode }) {
      const qcRef = useRef<QueryClient | null>(null);
      if (!qcRef.current) {
        qcRef.current = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      }
      return (
        <ToncastProvider client={clientRef.current} queryClient={qcRef.current}>
          {children}
        </ToncastProvider>
      );
    }

    const { rerender } = renderHook(() => useBets({ userAddress: UQ_USER }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(listA).toHaveBeenCalledTimes(1));
    expect(listB).not.toHaveBeenCalled();

    clientRef.current = clientB;
    rerender();

    await waitFor(() => expect(listB).toHaveBeenCalledTimes(1));
  });
});
