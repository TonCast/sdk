import { describe, expect, it } from "vitest";
import { ToncastClient, ToncastError } from "../src";

describe("ToncastClient", () => {
  it("constructs without userAddress and exposes resources", () => {
    const client = new ToncastClient();
    expect(client.paris).toBeDefined();
    expect(client.categories).toBeDefined();
    expect(client.bets).toBeDefined();
    expect(client.coins).toBeDefined();
    expect(client.betting).toBeDefined();
    expect(client.getUserAddress()).toBeUndefined();
  });

  it("persists and swaps userAddress", () => {
    const client = new ToncastClient({ userAddress: "UQA1" });
    expect(client.getUserAddress()).toBe("UQA1");
    client.setUserAddress("UQA2");
    expect(client.getUserAddress()).toBe("UQA2");
    client.clearUserAddress();
    expect(client.getUserAddress()).toBeUndefined();
  });

  it("throws USER_ADDRESS_REQUIRED on personal methods when no address set", async () => {
    const client = new ToncastClient();
    await expect(client.bets.listForPariByUser({ pariId: "EQX" })).rejects.toBeInstanceOf(
      ToncastError,
    );
    await expect(client.coins.list()).rejects.toBeInstanceOf(ToncastError);
  });
});
