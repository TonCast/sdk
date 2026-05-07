import { renderHook, waitFor } from "@testing-library/react";
import { ToncastClient } from "@toncast/sdk";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToncastProvider, useCategories } from "../src";

describe("useCategories", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads categories through TanStack Query (data + isLoading + isSuccess)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify([
            { id: 1, title: "Sport" },
            { id: 3, title: "Crypto" },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const client = new ToncastClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ToncastProvider client={client}>{children}</ToncastProvider>
    );
    const { result } = renderHook(() => useCategories(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { name: "All", param: {} },
      { name: "Sport", param: { categoryId: 1 } },
      { name: "Crypto", param: { categoryId: 3 } },
      { name: "Pending result", param: { showPendingResults: true } },
      { name: "Finished", param: { includeInactive: true } },
    ]);
  });

  it("surfaces errors via TanStack Query state", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: "boom" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = new ToncastClient({ maxAttempts: 1 });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ToncastProvider client={client}>{children}</ToncastProvider>
    );
    const { result } = renderHook(() => useCategories({ retry: false }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
