// One-off check: reproduce the UI screenshot's USDT market bet (1.66 USDT ≈ 1.168 TON budget).
//
// Expected (from UI):
//   Сумма (USDT₮)     : 1.66 USDT
//   Итого             : 1.168 TON
//   Комиссия свопа    : 0.05 TON – 0.3 TON (STON.fi simulator range)
//   Выигрыш           : 1.52 TON
//
// Run: npx tsx scripts/smoke-bet-1usdt-match-ui.ts

import { fromNano } from "@ton/core";
import { calcWinnings, createTonClient, TONCAST_PROXY_ADDRESS, ToncastClient } from "../src";
import { findActivePariV3 } from "./_lib/find-pari-v3";
import { tonkeeperDeeplink } from "./_lib/tonkeeper";

const USER = "UQD7k4QZ7LtO3ZtCnoS1GIy84erPasgjiU70_rgRqNxQwIQN";
const USDT_MASTER = "0:B113A994B5024A16719F69139328EB759596C38A25F59028B146FECDC3621DFE";
const REFERRAL_PCT = 1;
const REFERRAL = TONCAST_PROXY_ADDRESS;

// 1.66 USDT ≈ 1.168 TON, what the UI screenshot shows.
const BUDGET_TON = 1_168_000_000n;

const ton = (n: bigint) => `${fromNano(n)} TON`;

async function main() {
  const tonClient = createTonClient({ apiKey: process.env.TONCENTER_API_KEY });
  const client = new ToncastClient({ tonClient, userAddress: USER });

  const pari = await findActivePariV3(client);
  console.log(`▸ pari: ${pari.id}`);
  console.log(`  ${pari.name}`);

  const oddsState = await client.paris.getOddsState(pari.id);
  const priced = await client.betting.priceCoins();
  const usdt = priced.find((c) => c.address.toLowerCase() === USDT_MASTER.toLowerCase());
  if (!usdt?.viable) throw new Error(`USDT not viable: ${usdt?.reason ?? "missing"}`);

  console.log(`\n▸ USDT priced via STON.fi:`);
  console.log(`  raw amount: ${usdt.amount}n  decimals=${usdt.decimals}`);
  console.log(`  TON-equivalent (full balance): ${fromNano(usdt.tonEquivalent)} TON`);
  console.log(`  → budget for this bet: ${fromNano(BUDGET_TON)} TON  (≈ 1.66 USDT)`);

  const quote = await client.betting.quoteMarketBet({
    pariId: pari.id,
    isYes: true,
    source: USDT_MASTER,
    pricedCoins: priced,
    oddsState,
    maxBudgetTon: BUDGET_TON,
    referral: REFERRAL,
    referralPct: REFERRAL_PCT,
    allowInsufficientBalance: true,
  });
  if (!quote.option.feasible) throw new Error(`infeasible: ${quote.option.reason}`);

  const payout = calcWinnings(quote.bets, REFERRAL_PCT);
  console.log(`\n▸ quoteMarketBet:`);
  console.log(`  bets:        ${JSON.stringify(quote.bets)}`);
  console.log(`  totalCost:   ${ton(quote.totalCost)}  (Pari-side TON)`);
  console.log(
    `  swap fee:    ${ton(quote.option.breakdown.gas)}  (this is what the UI calls "Комиссия свопа")`,
  );
  console.log(`  payout (5%): ${ton(payout)}  ← if YES wins, after platform 4% + referral 1%`);
  console.log(`  net profit:  ${ton(payout - quote.totalCost)}`);

  console.log(`\n▸ UI vs SDK comparison:`);
  console.log(
    `  UI         : Итого 1.168 TON   |  Выигрыш 1.52 TON   |  Комиссия свопа 0.05–0.3 TON`,
  );
  console.log(
    `  SDK quote  : ${ton(quote.totalCost).padEnd(11)}  |  ${ton(payout).padEnd(13)}  |  gas ${ton(quote.option.breakdown.gas)}`,
  );

  const confirmed = await client.betting.confirmQuote(quote);
  console.log(`\n▸ confirmed: ${confirmed.txs.length} tx ready to sign`);
  for (const m of confirmed.messages) {
    console.log(`  Tonkeeper: ${tonkeeperDeeplink(m)}`);
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
