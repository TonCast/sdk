import { Address } from "@ton/core";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/wallet/jetton-discovery", () => ({
  discoverJettons: vi.fn().mockResolvedValue([]),
}));

import { CoinsResource } from "../src/resources/coins";

const USER = "UQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAZAm";

describe("CoinsResource.invalidate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not let a stale inflight fetch repopulate the cache after invalidate", async () => {
    let releaseBalance!: () => void;
    const balanceGate = new Promise<bigint>((resolve) => {
      releaseBalance = () => resolve(10n ** 9n);
    });

    const getBalance = vi.fn(() => balanceGate);
    const coins = new CoinsResource({
      tonClient: { getBalance } as never,
      logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
      getUserAddress: () => Address.parse(USER).toString(),
      cacheTtlMs: 60_000,
    });

    const first = coins.list({ userAddress: USER });
    coins.invalidate(USER);
    releaseBalance();
    await first;

    expect(getBalance).toHaveBeenCalledTimes(1);

    await coins.list({ userAddress: USER });
    expect(getBalance).toHaveBeenCalledTimes(2);
  });
});
