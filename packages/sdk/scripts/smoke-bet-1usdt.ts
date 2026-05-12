// Real-API smoke: prepare a ~1 USDT bet via STON.fi (USDT → TON swap → bet).
// Targets the first active v3 pari. Read-only — no signing, no broadcasting.
//
// "1 USDT" here means: spend exactly 1 USDT on the swap input. The TON-side
// budget (`maxBudgetTon`) is calculated from a STON.fi simulation so the bet
// consumes ~1 USDT worth (minus swap slippage / wallet reserve).
//
// Run:
//   TONCAST_FINANCIAL_RISK_ACK=1 USER_ADDRESS=... npx tsx scripts/smoke-bet-1usdt.ts [pariId] [userAddress]

import { fromNano } from "@ton/core";
import { createTonClient, ToncastClient } from "../src";
import { findActivePariV3 } from "./_lib/find-pari-v3";
import { printBetQuote } from "./_lib/print-quote";
import { printForTonkeeper } from "./_lib/tonkeeper";

const USDT_MASTER = "0:B113A994B5024A16719F69139328EB759596C38A25F59028B146FECDC3621DFE";
const ONE_USDT = 1_000_000n; // USDT decimals = 6

async function main() {
  requireFinancialRiskAck();
  const userAddress = process.argv[3] ?? requireEnv("USER_ADDRESS");

  // createTonClient bakes in axios retry-on-429/5xx; without an API key the
  // confirmQuote round-trip will be slow (public toncenter caps 1 req/sec) but
  // it WILL succeed instead of crashing.
  const tonClient = createTonClient({ apiKey: process.env.TONCENTER_API_KEY });
  const client = new ToncastClient({ tonClient, userAddress });

  if (!process.env.TONCENTER_API_KEY) {
    console.warn(
      "⚠ TONCENTER_API_KEY is not set. The USDT flow makes ~6+ STON.fi RPC calls;\n" +
        "  retry-on-429 will keep going but each call may take a few seconds.\n" +
        "  Get a free key from @tonapibot in Telegram for instant runs.\n",
    );
  }

  const pari = process.argv[2]
    ? await client.paris.get(process.argv[2])
    : await findActivePariV3(client);
  if (pari.version !== "v3") throw new Error(`Pari ${pari.id} is ${pari.version}, want v3`);

  console.log(`▸ pari: ${pari.id}`);
  console.log(`  ${pari.name}`);
  console.log(`  status=${pari.status}  yesV=${pari.yesVolume}  noV=${pari.noVolume}`);

  // priceCoins → USDT/TON rate from STON.fi simulation
  const priced = await client.betting.priceCoins();
  const usdt = priced.find((c) => c.address.toLowerCase() === USDT_MASTER.toLowerCase());
  if (!usdt) throw new Error(`USDT not found in priced coins for ${userAddress}`);
  if (!usdt.viable) throw new Error(`USDT route infeasible: ${usdt.reason}`);

  // Format USDT amount using the jetton's own `decimals` (no hardcoded 1e6).
  const usdtScale = 10n ** BigInt(usdt.decimals ?? 0);
  console.log(`\n▸ USDT priced via STON.fi:`);
  console.log(
    `  raw amount: ${usdt.amount}n  (~${Number(usdt.amount) / Number(usdtScale)} ${usdt.symbol ?? "USDT"})`,
  );
  console.log(`  TON-equivalent: ${fromNano(usdt.tonEquivalent)} TON`);

  // Scale tonEquivalent (which corresponds to full USDT balance) down to 1 USDT.
  const oneUsdtInTon = (BigInt(usdt.tonEquivalent) * ONE_USDT) / BigInt(usdt.amount);
  console.log(`  → budget for 1 USDT ≈ ${fromNano(oneUsdtInTon)} TON`);

  const quoteParams = {
    pariId: pari.id,
    isYes: true,
    maxBudgetTon: oneUsdtInTon,
    source: USDT_MASTER,
    pricedCoins: priced,
    financialRiskAcknowledged: true as const,
  };
  const quote = await client.betting.quoteMarketBet(quoteParams);
  printBetQuote("quoteMarketBet(~1 USDT-equiv via STON.fi, source=USDT, isYes=true)", quote, true);

  if (!quote.option.feasible) throw new Error(`quote infeasible: ${quote.option.reason}`);

  // Retry adapter saves us from 429 here automatically. confirmQuote re-simulates
  // the STON.fi swap at the current rate, so the user signs a fresh tx.
  const confirmed = await client.betting.confirmQuote(quote, quoteParams);
  console.log(`\n▸ confirmed: ${confirmed.txs.length} tx(s) ready to sign`);
  console.log(`  (jetton bets typically pack into 1 tx: jetton transfer → STON.fi → bet)`);
  printForTonkeeper(confirmed.messages);
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
