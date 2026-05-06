import { renderHook } from "@testing-library/react";
import { ToncastClient } from "@toncast/sdk";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ToncastProvider, useToncastClient } from "../src";

describe("ToncastProvider / useToncastClient", () => {
  it("returns the client passed to the provider", () => {
    const client = new ToncastClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ToncastProvider client={client}>{children}</ToncastProvider>
    );
    const { result } = renderHook(() => useToncastClient(), { wrapper });
    expect(result.current).toBe(client);
  });

  it("throws when used outside the provider", () => {
    expect(() => renderHook(() => useToncastClient())).toThrow(/no ToncastProvider in tree/);
  });
});
