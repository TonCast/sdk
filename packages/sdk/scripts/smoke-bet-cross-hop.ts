// Smoke for the cross-hop fix shipped in @toncast/tx-sdk@0.1.3.
//
// Picks the first viable cross-hop priced coin in the wallet (route =
// `{ intermediate }`), runs a `quoteMarketBet` preview, then `confirmQuote`,
// and prints offerUnits side-by-side so we can confirm there is NO double
// slippage cushion (preview ≈ wallet-side request).
//
// Run:
//   TONCAST_FINANCIAL_RISK_ACK=1 USER_ADDRESS=... npx tsx scripts/smoke-bet-cross-hop.ts [userAddress]

import { fromNano } from "@ton/core";
import { createTonClient, TONCAST_PROXY_ADDRESS, ToncastClient } from "../src";
import { findActivePariV3 } from "./_lib/find-pari-v3";
import { tonkeeperDeeplink } from "./_lib/tonkeeper";

const REFERRAL_PCT = 1;
const REFERRAL = TONCAST_PROXY_ADDRESS;

const ton = (n: bigint) => `${fromNano(n)} TON`;

async function main() {
  requireFinancialRiskAck();
  const userAddress = process.argv[2] ?? requireEnv("USER_ADDRESS");
  const tonClient = createTonClient({ apiKey: process.env.TONCENTER_API_KEY });
  const client = new ToncastClient({ tonClient, userAddress });

  const pari = await findActivePariV3(client);
  console.log(`▸ pari: ${pari.id}`);
  console.log(`  ${pari.name}`);

  const oddsState = await client.paris.getOddsState(pari.id);
  const priced = await client.betting.priceCoins();

  const cross = priced.find(
    (c) => c.viable && typeof c.route === "object" && c.route?.intermediate,
  );
  if (!cross) {
    console.warn(
      "\n⚠ No viable cross-hop coin in the test wallet — fund it with a non-direct jetton (e.g. TCAST) and retry.",
    );
    return;
  }
  const intermediate = typeof cross.route === "object" ? cross.route.intermediate : "?";
  console.log(`\n▸ cross-hop coin: ${cross.symbol ?? cross.address}`);
  console.log(`  via intermediate: ${intermediate}`);
  console.log(`  raw amount: ${cross.amount}n  decimals=${cross.decimals}`);
  console.log(`  tonEquivalent (worst):    ${fromNano(cross.tonEquivalent)} TON`);
  console.log(`  tonEquivalentExpected:    ${fromNano(cross.tonEquivalentExpected)} TON`);

  // Aim ~30% of capacity to make sure we exercise the cross-hop path.
  const budget = (cross.tonEquivalent * 30n) / 100n;
  console.log(`\n▸ quoteMarketBet budget: ${ton(budget)}`);

  const quoteParams = {
    pariId: pari.id,
    isYes: true,
    source: cross.address,
    pricedCoins: priced,
    oddsState,
    maxBudgetTon: budget,
    referral: REFERRAL,
    referralPct: REFERRAL_PCT,
    allowInsufficientBalance: true,
    financialRiskAcknowledged: true as const,
  };
  const quote = await client.betting.quoteMarketBet(quoteParams);
  if (!quote.option.feasible) {
    throw new Error(`infeasible: ${quote.option.reason}`);
  }

  const previewOffer = quote.option.source.kind === "jetton" ? quote.option.source.offerUnits : 0n;
  console.log(`  preview totalCost (TON):  ${ton(quote.totalCost)}`);
  console.log(`  preview offerUnits (jetton, raw): ${previewOffer}n`);
  console.log(`  preview gas / swap fee:           ${ton(quote.option.breakdown.gas)}`);

  const confirmed = await client.betting.confirmQuote(quote, quoteParams);
  const confirmedOffer =
    confirmed.txs[0]?.body && "offerUnits" in (confirmed.txs[0] as object)
      ? // biome-ignore lint/suspicious/noExplicitAny: probing builder output
        (confirmed.txs[0] as any).offerUnits
      : undefined;

  console.log(`\n▸ confirmed: ${confirmed.txs.length} tx ready to sign`);
  if (confirmedOffer !== undefined) {
    console.log(`  signed offerUnits (jetton, raw): ${confirmedOffer}n`);
    if (previewOffer > 0n && typeof confirmedOffer === "bigint") {
      const diffPct = Number(((confirmedOffer - previewOffer) * 10000n) / previewOffer) / 100;
      console.log(`  diff vs preview: ${diffPct.toFixed(2)}%  (≤ ~1% = OK; double-slippage gone)`);
    }
  }
  for (const m of confirmed.messages) {
    console.log(`  Tonkeeper: ${tonkeeperDeeplink(m)}`);
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});

function requireFinancialRiskAck(): void {
  if (process.env.TONCAST_FINANCIAL_RISK_ACK !== "1") {
    throw new Error(
      "Set TONCAST_FINANCIAL_RISK_ACK=1 after acknowledging this script prepares signable mainnet transactions.",
    );
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}
