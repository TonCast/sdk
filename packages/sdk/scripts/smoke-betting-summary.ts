// Real-API smoke for betting.summary — does NOT sign or send anything.
// Run: USER_ADDRESS=... npx tsx scripts/smoke-betting-summary.ts [pariId] [userAddress]
import { fromNano } from "@ton/core";
import { TON_ADDRESS } from "@toncast/tx-sdk";
import { createTonClient, ToncastClient } from "../src";
import { printBetQuote } from "./_lib/print-quote";

const DEFAULT_PARI = "EQCi1hBngahzphH1L0wknVCUJBVs7a_2LfHzoUwsoJ9biEIK";

const fmtTon = (nano: bigint): string => fromNano(nano);

async function main() {
  const pariId = process.argv[2] ?? DEFAULT_PARI;
  const userAddress = process.argv[3] ?? requireEnv("USER_ADDRESS");

  const tonClient = createTonClient({ apiKey: process.env.TONCENTER_API_KEY });
  const client = new ToncastClient({ language: "en", userAddress, tonClient });

  console.log(`▸ betting.summary(${pariId.slice(0, 12)}…) for ${userAddress.slice(0, 12)}…\n`);
  const t0 = Date.now();
  const summary = await client.betting.summary(pariId);
  const dt = Date.now() - t0;
  console.log(`(fetched in ${dt}ms)\n`);

  console.log(`Pari: ${summary.pari.name}`);
  console.log(`  status=${summary.pari.status}  result=${summary.pari.result}`);
  console.log(`  yesV=${summary.pari.yesVolume} TON  noV=${summary.pari.noVolume} TON\n`);

  console.log(`Order book non-zero levels:`);
  const yesLines = summary.oddsState.Yes.map((v, i) => ({
    yesOdds: 2 * (i + 1),
    tickets: v,
  })).filter((l) => l.tickets);
  const noLines = summary.oddsState.No.map((v, i) => ({
    yesOdds: 100 - 2 * (i + 1),
    tickets: v,
  })).filter((l) => l.tickets);
  console.log(`  YES @ ${yesLines.map((l) => `${l.yesOdds}:${l.tickets}`).join("  ")}`);
  console.log(`  NO  @ ${noLines.map((l) => `${l.yesOdds}:${l.tickets}`).join("  ")}\n`);

  console.log(`Coins (priceCoins via tx-sdk):`);
  for (const cap of summary.capacities) {
    const sym = cap.source.symbol ?? (cap.source.address.length > 30 ? "TON" : cap.source.address);
    const route =
      cap.route === null
        ? "no-route"
        : typeof cap.route === "object"
          ? `via ${cap.route.intermediate.slice(0, 8)}…`
          : (cap.route ?? "—");
    console.log(
      `  ${sym.padEnd(6)}  feasible=${cap.feasible}  ` +
        `min=${fmtTon(cap.minBetTon)} TON  max=${fmtTon(cap.maxBetTon)} TON` +
        `  route=${route}` +
        (cap.reason ? `  reason=${cap.reason}` : ""),
    );
  }
  console.log(
    `\nuniversal floor minBet=${fmtTon(summary.minBetTon)} TON  pariFee=${fmtTon(summary.perBetExecutionFeeTon)} TON`,
  );

  console.log(
    `\n▸ betting.quoteFixedBet(yesOdds=56, ticketsCount=10, source=TON) — preview, not sent\n`,
  );
  const tonCoin = summary.pricedCoins.find((c) => c.address === TON_ADDRESS);
  if (!tonCoin) throw new Error("no TON coin in pricedCoins");
  const quote = await client.betting.quoteFixedBet({
    pariId,
    isYes: true,
    yesOdds: 56,
    ticketsCount: 10,
    source: tonCoin.address,
    pricedCoins: summary.pricedCoins,
    allowInsufficientBalance: true,
  });
  printBetQuote("quoteFixedBet(yesOdds=56, ticketsCount=10, source=TON)", quote, true);

  const limit = await client.betting.quoteLimitBet({
    pariId,
    isYes: true,
    worstYesOdds: 56,
    ticketsCount: 300,
    source: tonCoin.address,
    pricedCoins: summary.pricedCoins,
    oddsState: summary.oddsState,
    allowInsufficientBalance: true,
  });
  printBetQuote("quoteLimitBet(worstYesOdds=56, ticketsCount=300)", limit, true);

  const market = await client.betting.quoteMarketBet({
    pariId,
    isYes: true,
    maxBudgetTon: 5_000_000_000n,
    source: tonCoin.address,
    pricedCoins: summary.pricedCoins,
    oddsState: summary.oddsState,
    allowInsufficientBalance: true,
  });
  printBetQuote("quoteMarketBet(maxBudgetTon=5 TON)", market, true);

  console.log(`\nALL OK`);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}
