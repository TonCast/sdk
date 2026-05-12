// Real-API smoke: prepare a ~1 TON YES bet on a v3 pari, native-TON path.
//
// CANONICAL TON FLOW (no STON.fi, no swap, no async quote/confirm):
//   1. Read oddsState from REST          ← only network call
//   2. computeMarketBets(...) → bets[]   ← LOCAL, sync
//   3. buildTonBetTx({ bets, ... }) → tx ← LOCAL, sync
//   4. Serialise to TonConnect / Tonkeeper
//
// `tx.value` from buildTonBetTx is the EXACT amount the wallet sends — it
// equals the strategy's `totalCost`, so the deeplink amount and Tonkeeper's
// "Sent" line match item-for-item.
//
// Run:
//   TONCAST_FINANCIAL_RISK_ACK=1 USER_ADDRESS=... npx tsx scripts/smoke-bet-1ton.ts [pariId]

import { toNano } from "@ton/core";
import {
  buildTonBetTx,
  calcWinnings,
  computeMarketBets,
  createTonClient,
  TONCAST_PROXY_ADDRESS,
  ToncastClient,
} from "../src";
import { findActivePariV3 } from "./_lib/find-pari-v3";
import { tonkeeperDeeplink } from "./_lib/tonkeeper";

const BUDGET_TON = toNano(process.env.BUDGET_TON ?? "0.2");
const REFERRAL_PCT = 1; // platform 4% + referral 1% = 5% total fee
const REFERRAL_ADDRESS = TONCAST_PROXY_ADDRESS; // any mainnet address ≠ beneficiary
const fmt = (nano: bigint): string =>
  `${(Number(nano) / 1e9).toLocaleString("en", { maximumFractionDigits: 9 })} TON`;

async function main() {
  if (process.env.TONCAST_FINANCIAL_RISK_ACK !== "1") {
    throw new Error("Set TONCAST_FINANCIAL_RISK_ACK=1 before generating a signable transaction.");
  }
  const userAddress = process.argv[3] ?? requireEnv("USER_ADDRESS");
  const tonClient = createTonClient({ apiKey: process.env.TONCENTER_API_KEY });
  const client = new ToncastClient({ tonClient, userAddress });

  const pari = process.argv[2]
    ? await client.paris.get(process.argv[2])
    : await findActivePariV3(client);
  if (pari.version !== "v3") throw new Error(`Pari ${pari.id} is ${pari.version}, want v3`);
  console.log(`▸ pari: ${pari.id}`);
  console.log(`  ${pari.name}`);
  console.log(`  status=${pari.status}  yesV=${pari.yesVolume}  noV=${pari.noVolume}\n`);

  // 1. Single REST read — current order book
  const oddsState = await client.paris.getOddsState(pari.id);

  // 2. Compute bets locally (no network)
  const isYes = true;
  const result = computeMarketBets({ oddsState, isYes, maxBudgetTon: BUDGET_TON });
  if (!result.feasible) throw new Error(`computeMarketBets infeasible: ${result.reason}`);
  console.log(`▸ computeMarketBets(maxBudgetTon=${fmt(BUDGET_TON)}, isYes=${isYes}) — local sync`);
  console.log(`  totalCost = ${fmt(result.totalCost)}  ← exact wallet outflow`);
  for (const b of result.bets) {
    console.log(`  bet: yesOdds=${b.yesOdds}  ticketsCount=${b.ticketsCount}`);
  }
  const referral = REFERRAL_PCT > 0 ? REFERRAL_ADDRESS : null;

  const winIfYes = calcWinnings(result.bets, REFERRAL_PCT);
  console.log(
    `  if YES wins → payout: ${fmt(winIfYes)}  (4% platform + ${REFERRAL_PCT}% referral)`,
  );
  console.log(`  net wallet profit if win: ${fmt(winIfYes - result.totalCost)}\n`);

  // 3. Build TON-direct TX locally (no network, no proxy, no swap)
  const tx = buildTonBetTx({
    pariAddress: pari.id,
    beneficiary: userAddress,
    isYes,
    bets: result.bets,
    referral,
    referralPct: REFERRAL_PCT,
  });
  console.log(`▸ buildTonBetTx → TxParams (local)`);
  console.log(`  to    = ${tx.to.toString()}`);
  console.log(`  value = ${tx.value}n  (${fmt(tx.value)})`);
  console.log(`  body  = ${tx.body ? `${tx.body.toBoc().length}B BoC` : "—"}\n`);

  // 4. Serialise to TonConnect / Tonkeeper
  const message = {
    address: tx.to.toString(),
    amount: tx.value.toString(),
    payload: tx.body?.toBoc().toString("base64"),
  };
  console.log(`▸ TonConnect message:`);
  console.log(JSON.stringify(message, null, 2));
  console.log(`\n▸ Tonkeeper deeplink:`);
  console.log(`  ${tonkeeperDeeplink(message)}`);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required; do not use placeholder addresses.`);
  return value;
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
