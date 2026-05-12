// biome-ignore-all lint/suspicious/noExplicitAny: stub objects mimicking tx-sdk shapes for tests
import { ToncastTxSdk } from "@toncast/tx-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToncastClient } from "../src";

const SIGNER = "UQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAZAm";
const RECIPIENT = "UQACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfn";
const PARI_ID = "UQADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA5VY";
const ODDS_STATE = { Yes: Array(49).fill(0), No: Array(49).fill(0) };

const FAKE_PRICED_COIN = {
  address: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
  amount: 100_000_000_000n,
  tonEquivalent: 99_950_000_000n,
  tonEquivalentExpected: 99_950_000_000n,
  gasReserve: 0n,
  route: "direct" as const,
  viable: true,
};

function feasibleConfirmedQuote(params: { source: string }) {
  return {
    mode: "fixed",
    isYes: true,
    totalCost: 100_000_000n,
    bets: [{ yesOdds: 56, ticketsCount: 10 }],
    breakdown: { matched: [], placement: [], unmatched: 0n } as any,
    option: {
      feasible: true as const,
      estimated: false,
      source: params.source,
      txs: [
        {
          to: { toString: () => "EQDest" } as any,
          value: 100_000_000n,
          body: { toBoc: () => Buffer.from("payload") } as any,
        },
      ],
      breakdown: { spend: 100_000_000n, gas: 0n },
    },
    lockedInRate: null,
  } as any;
}

describe("confirmQuote auto-tracks params", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("auto-retrieves params when quote was made by quoteFixedBet", async () => {
    vi.spyOn(ToncastTxSdk.prototype, "quoteFixedBet").mockImplementation(async (p) =>
      feasibleConfirmedQuote({ source: p.source }),
    );
    const confirmSpy = vi
      .spyOn(ToncastTxSdk.prototype, "confirmQuote")
      .mockImplementation(async (_q, p) =>
        feasibleConfirmedQuote({ source: (p as any).pariAddress }),
      );

    const client = new ToncastClient({ userAddress: SIGNER });

    const quoteParams = {
      pariId: PARI_ID,
      isYes: true,
      yesOdds: 56,
      ticketsCount: 10,
      source: FAKE_PRICED_COIN.address,
      pricedCoins: [FAKE_PRICED_COIN],
      oddsState: ODDS_STATE,
      beneficiary: RECIPIENT, // explicit override
      financialRiskAcknowledged: true as const,
    };

    const quote = await client.betting.quoteFixedBet(quoteParams);

    // The whole point: no second arg needed.
    const confirmed = await client.betting.confirmQuote(quote);

    expect(confirmed.txs).toHaveLength(1);
    expect(confirmed.messages).toHaveLength(1);

    // confirmQuote at the tx-sdk layer must have received the SAME beneficiary
    // we passed at quote time (not the SDK userAddress fallback).
    const confirmCallArg = confirmSpy.mock.calls[0]?.[1] as Record<string, unknown> | undefined;
    expect(confirmCallArg?.beneficiary).toBe(RECIPIENT);
    expect(confirmCallArg?.senderAddress).toBe(SIGNER);
    expect(confirmCallArg?.pariAddress).toBe(PARI_ID);
  });

  it("explicit params override the auto-tracked ones", async () => {
    vi.spyOn(ToncastTxSdk.prototype, "quoteFixedBet").mockImplementation(async (p) =>
      feasibleConfirmedQuote({ source: p.source }),
    );
    const confirmSpy = vi
      .spyOn(ToncastTxSdk.prototype, "confirmQuote")
      .mockImplementation(async (_q, _p) => feasibleConfirmedQuote({ source: "x" }));

    const client = new ToncastClient({ userAddress: SIGNER });
    const quoteParams = {
      pariId: PARI_ID,
      isYes: true,
      yesOdds: 56,
      ticketsCount: 10,
      source: FAKE_PRICED_COIN.address,
      pricedCoins: [FAKE_PRICED_COIN],
      oddsState: ODDS_STATE,
      financialRiskAcknowledged: true as const,
    };
    const quote = await client.betting.quoteFixedBet(quoteParams);

    // Override beneficiary at confirm time (rare but allowed).
    const otherRecipient = "UQAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBJhl";
    await client.betting.confirmQuote(quote, {
      ...quoteParams,
      beneficiary: otherRecipient,
      financialRiskAcknowledged: true,
    });

    const arg = confirmSpy.mock.calls[0]?.[1] as Record<string, unknown> | undefined;
    expect(arg?.beneficiary).toBe(otherRecipient);
  });

  it("throws QUOTE_PARAMS_MISSING for foreign quotes without explicit params", async () => {
    const client = new ToncastClient({ userAddress: SIGNER });
    // Quote not produced by this SDK — no entry in the WeakMap.
    const foreignQuote = feasibleConfirmedQuote({ source: "x" });
    await expect(client.betting.confirmQuote(foreignQuote)).rejects.toMatchObject({
      name: "ToncastError",
      code: "QUOTE_PARAMS_MISSING",
    });
  });

  it("requires explicit financial risk acknowledgement before returning signable txs", async () => {
    vi.spyOn(ToncastTxSdk.prototype, "quoteFixedBet").mockImplementation(async (p) =>
      feasibleConfirmedQuote({ source: p.source }),
    );

    const client = new ToncastClient({ userAddress: SIGNER });
    const quote = await client.betting.quoteFixedBet({
      pariId: PARI_ID,
      isYes: true,
      yesOdds: 56,
      ticketsCount: 10,
      source: FAKE_PRICED_COIN.address,
      pricedCoins: [FAKE_PRICED_COIN],
      oddsState: ODDS_STATE,
    });

    await expect(client.betting.confirmQuote(quote)).rejects.toMatchObject({
      name: "ToncastError",
      code: "FINANCIAL_RISK_ACK_REQUIRED",
    });
  });
});
