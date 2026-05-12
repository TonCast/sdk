import { ToncastTxSdk } from "@toncast/tx-sdk";
import { describe, expect, it, vi } from "vitest";
import { ToncastClient, ToncastError } from "../src";

const SIGNER = "UQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAZAm";
const RECIPIENT = "UQACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfn";
const REFERRAL = "UQADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA5VY";
const PARI_ID = "UQAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBJhl";
const ODDS_STATE = { Yes: Array(49).fill(0), No: Array(49).fill(0) };

const FAKE_PRICED_COIN = {
  address: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c", // TON_ADDRESS
  amount: 100_000_000_000n,
  tonEquivalent: 99_950_000_000n,
  tonEquivalentExpected: 99_950_000_000n,
  gasReserve: 0n,
  route: "direct" as const,
  viable: true,
};

function captureQuoteFixedBet() {
  return vi.spyOn(ToncastTxSdk.prototype, "quoteFixedBet").mockImplementation(async (params) => {
    return {
      mode: "fixed",
      isYes: params.isYes,
      totalCost: 1_000_000_000n,
      bets: [{ yesOdds: params.yesOdds, ticketsCount: params.ticketsCount }],
      breakdown: {
        matched: [
          {
            yesOdds: params.yesOdds,
            tickets: params.ticketsCount,
            cost: 1_000_000_000n,
          },
        ],
        placement: null,
        unmatched: 0n,
      },
      option: { feasible: false, reason: "test" },
      lockedInRate: null,
    } as unknown as Awaited<ReturnType<typeof ToncastTxSdk.prototype.quoteFixedBet>>;
  });
}

describe("betting address resolution", () => {
  it("self-bet: senderAddress and beneficiary both default to client.userAddress", async () => {
    const spy = captureQuoteFixedBet();
    const client = new ToncastClient({ userAddress: SIGNER });

    await client.betting.quoteFixedBet({
      pariId: PARI_ID,
      isYes: true,
      yesOdds: 56,
      ticketsCount: 10,
      source: FAKE_PRICED_COIN.address,
      pricedCoins: [FAKE_PRICED_COIN],
      oddsState: ODDS_STATE,
    });

    const arg = spy.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(arg?.beneficiary).toBe(SIGNER);
    expect(arg?.senderAddress).toBe(SIGNER);
    expect(arg?.referral).toBeNull();
    expect(arg?.referralPct).toBe(0);
    spy.mockRestore();
  });

  it("bet-on-behalf: senderAddress stays at client.userAddress when beneficiary is overridden", async () => {
    const spy = captureQuoteFixedBet();
    const client = new ToncastClient({ userAddress: SIGNER });

    await client.betting.quoteFixedBet({
      pariId: PARI_ID,
      isYes: true,
      yesOdds: 56,
      ticketsCount: 10,
      source: FAKE_PRICED_COIN.address,
      pricedCoins: [FAKE_PRICED_COIN],
      oddsState: ODDS_STATE,
      beneficiary: RECIPIENT,
    });

    const arg = spy.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(arg?.beneficiary).toBe(RECIPIENT);
    // CRITICAL: senderAddress must remain the signer, not silently fall through to beneficiary.
    expect(arg?.senderAddress).toBe(SIGNER);
    spy.mockRestore();
  });

  it("explicit senderAddress override wins over client.userAddress", async () => {
    const spy = captureQuoteFixedBet();
    const client = new ToncastClient({ userAddress: SIGNER });
    const otherSigner = "UQAFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZra";

    await client.betting.quoteFixedBet({
      pariId: PARI_ID,
      isYes: true,
      yesOdds: 56,
      ticketsCount: 10,
      source: FAKE_PRICED_COIN.address,
      pricedCoins: [FAKE_PRICED_COIN],
      oddsState: ODDS_STATE,
      senderAddress: otherSigner,
      beneficiary: RECIPIENT,
    });

    const arg = spy.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(arg?.senderAddress).toBe(otherSigner);
    expect(arg?.beneficiary).toBe(RECIPIENT);
    spy.mockRestore();
  });

  it("referral params are passed through unchanged", async () => {
    const spy = captureQuoteFixedBet();
    const client = new ToncastClient({ userAddress: SIGNER });

    await client.betting.quoteFixedBet({
      pariId: PARI_ID,
      isYes: true,
      yesOdds: 56,
      ticketsCount: 10,
      source: FAKE_PRICED_COIN.address,
      pricedCoins: [FAKE_PRICED_COIN],
      oddsState: ODDS_STATE,
      beneficiary: RECIPIENT,
      referral: REFERRAL,
      referralPct: 5,
    });

    const arg = spy.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(arg?.referral).toBe(REFERRAL);
    expect(arg?.referralPct).toBe(5);
    spy.mockRestore();
  });

  it("throws when no userAddress is set and no senderAddress is provided", async () => {
    const client = new ToncastClient();
    await expect(
      client.betting.quoteFixedBet({
        pariId: PARI_ID,
        isYes: true,
        yesOdds: 56,
        ticketsCount: 10,
        source: FAKE_PRICED_COIN.address,
        pricedCoins: [FAKE_PRICED_COIN],
        oddsState: ODDS_STATE,
      }),
    ).rejects.toBeInstanceOf(ToncastError);
  });

  it("uses SDK-level referral as default for every bet", async () => {
    const spy = captureQuoteFixedBet();
    const client = new ToncastClient({
      userAddress: SIGNER,
      referral: { address: REFERRAL, pct: 5 },
    });

    await client.betting.quoteFixedBet({
      pariId: PARI_ID,
      isYes: true,
      yesOdds: 56,
      ticketsCount: 10,
      source: FAKE_PRICED_COIN.address,
      pricedCoins: [FAKE_PRICED_COIN],
      oddsState: ODDS_STATE,
    });

    const arg = spy.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(arg?.referral).toBe(REFERRAL);
    expect(arg?.referralPct).toBe(5);
    spy.mockRestore();
  });

  it("per-call referral overrides the SDK-level default", async () => {
    const spy = captureQuoteFixedBet();
    const client = new ToncastClient({
      userAddress: SIGNER,
      referral: { address: REFERRAL, pct: 5 },
    });
    const otherReferral = "UQAGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBp0b";

    await client.betting.quoteFixedBet({
      pariId: PARI_ID,
      isYes: true,
      yesOdds: 56,
      ticketsCount: 10,
      source: FAKE_PRICED_COIN.address,
      pricedCoins: [FAKE_PRICED_COIN],
      oddsState: ODDS_STATE,
      referral: otherReferral,
      referralPct: 3,
    });

    const arg = spy.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(arg?.referral).toBe(otherReferral);
    expect(arg?.referralPct).toBe(3);
    spy.mockRestore();
  });

  it("explicit `referral: null` disables the SDK-level default", async () => {
    const spy = captureQuoteFixedBet();
    const client = new ToncastClient({
      userAddress: SIGNER,
      referral: { address: REFERRAL, pct: 5 },
    });

    await client.betting.quoteFixedBet({
      pariId: PARI_ID,
      isYes: true,
      yesOdds: 56,
      ticketsCount: 10,
      source: FAKE_PRICED_COIN.address,
      pricedCoins: [FAKE_PRICED_COIN],
      oddsState: ODDS_STATE,
      referral: null,
    });

    const arg = spy.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(arg?.referral).toBeNull();
    expect(arg?.referralPct).toBe(0);
    spy.mockRestore();
  });

  it("setReferral swaps the default at runtime", async () => {
    const spy = captureQuoteFixedBet();
    const client = new ToncastClient({ userAddress: SIGNER });
    client.setReferral({ address: REFERRAL, pct: 7 });
    expect(client.getReferral()).toEqual({ address: REFERRAL, pct: 7 });

    await client.betting.quoteFixedBet({
      pariId: PARI_ID,
      isYes: true,
      yesOdds: 56,
      ticketsCount: 10,
      source: FAKE_PRICED_COIN.address,
      pricedCoins: [FAKE_PRICED_COIN],
      oddsState: ODDS_STATE,
    });

    const arg = spy.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(arg?.referral).toBe(REFERRAL);
    expect(arg?.referralPct).toBe(7);

    client.setReferral(undefined);
    expect(client.getReferral()).toBeUndefined();
    spy.mockRestore();
  });

  it("rejects invalid referral.pct at construction", () => {
    expect(() => new ToncastClient({ referral: { address: REFERRAL, pct: 8 } })).toThrow(
      ToncastError,
    );
    expect(() => new ToncastClient({ referral: { address: REFERRAL, pct: -1 } })).toThrow(
      ToncastError,
    );
    expect(() => new ToncastClient({ referral: { address: "", pct: 5 } })).toThrow(ToncastError);
  });
});
