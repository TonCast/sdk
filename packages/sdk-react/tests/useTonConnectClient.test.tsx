import { renderHook } from "@testing-library/react";
import { ToncastClient } from "@toncast/sdk";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ToncastProvider, useTonConnectClient } from "../src";

const TEST_ADDR = "UQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAZAm";

describe("useTonConnectClient", () => {
  it("sets userAddress when address is non-empty", () => {
    const client = new ToncastClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ToncastProvider client={client}>{children}</ToncastProvider>
    );
    renderHook(() => useTonConnectClient(TEST_ADDR), { wrapper });
    expect(client.getUserAddress()).toBe(TEST_ADDR);
  });

  it("clears userAddress when address becomes null", () => {
    const client = new ToncastClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ToncastProvider client={client}>{children}</ToncastProvider>
    );
    const { rerender } = renderHook(({ a }: { a: string | null }) => useTonConnectClient(a), {
      wrapper,
      initialProps: { a: TEST_ADDR as string | null },
    });
    expect(client.getUserAddress()).toBe(TEST_ADDR);
    rerender({ a: null });
    expect(client.getUserAddress()).toBeUndefined();
  });

  it("treats empty string as disconnected", () => {
    const client = new ToncastClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ToncastProvider client={client}>{children}</ToncastProvider>
    );
    renderHook(() => useTonConnectClient(""), { wrapper });
    expect(client.getUserAddress()).toBeUndefined();
  });
});
