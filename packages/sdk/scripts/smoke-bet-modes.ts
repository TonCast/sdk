// Real-API smoke: end-to-end check of all 3 bet modes × 2 funding sources.
//
// Modes:
//   • Fixed  — exact `yesOdds` + `ticketsCount`. Pari contract matches on-chain.
//   • Limit  — buy up to `ticketsCount` at <= `worstYesOdds`, rest as placement.
//   • Market — spend `maxBudgetTon` greedily on the best counter-liquidity.
//
// Sources:
//   • TON   — sync path (computeXxxBets → buildTonBetTx). Zero swap.
//   • USDT  — async path (quoteXxxBet → confirmQuote). STON.fi swap inside.
//
// Run: npx tsx scripts/smoke-bet-modes.ts [pariId] [userAddress]

import { fromNano } from "@ton/core";
import {
  type BetQuote,
  buildTonBetTx,
  calcWinnings,
  computeFixedBets,
  computeLimitBets,
  computeMarketBets,
  createTonClient,
  TONCAST_PROXY_ADDRESS,
  ToncastClient,
} from "../src";
import { findActivePariV3 } from "./_lib/find-pari-v3";
import { tonkeeperDeeplink } from "./_lib/tonkeeper";

const DEFAULT_USER = "UQD7k4QZ7LtO3ZtCnoS1GIy84erPasgjiU70_rgRqNxQwIQN";
const USDT_MASTER = "0:B113A994B5024A16719F69139328EB759596C38A25F59028B146FECDC3621DFE";

// Hardcoded — matches the toncast.me UI flow.
const REFERRAL_PCT = 1; // platform 4% + referral 1% = 5% total fee
const REFERRAL_ADDRESS = TONCAST_PROXY_ADDRESS;
const REFERRAL = REFERRAL_PCT > 0 ? REFERRAL_ADDRESS : null;

const ton = (n: bigint) => `${fromNano(n)} TON`;
const ONE_TON = 1_000_000_000n;

interface RunSummary {
  source: "TON" | "USDT";
  mode: "fixed" | "limit" | "market";
  bets: Array<{ yesOdds: number; ticketsCount: number }>;
  totalCost: bigint;
  payout: bigint;
  amount: string; // wallet message amount in nano
  to: string;
}

async function main() {
  const userAddress = process.argv[3] ?? DEFAULT_USER;
  const tonClient = createTonClient({ apiKey: process.env.TONCENTER_API_KEY });
  const client = new ToncastClient({ tonClient, userAddress });

  const pari = process.argv[2]
    ? await client.paris.get(process.argv[2])
    : await findActivePariV3(client);
  if (pari.version !== "v3") throw new Error(`pari ${pari.id} is ${pari.version}, want v3`);

  console.log(`▸ pari: ${pari.id}`);
  console.log(`  ${pari.name}`);
  console.log(`  status=${pari.status}  yesV=${pari.yesVolume}  noV=${pari.noVolume}`);
  console.log(`  referral=${REFERRAL ?? "none"} pct=${REFERRAL_PCT}\n`);

  const oddsState = await client.paris.getOddsState(pari.id);
  const isYes = true;
  const summaries: RunSummary[] = [];

  // ─── TON path (sync, no swap) ─────────────────────────────────────────
  console.log("━━━ TON path (sync) ━━━");

  // Fixed: 10 tickets at yesOdds=60 (cost = 10 × 0.06 + 0.1 fee = 0.7 TON)
  {
    const r = computeFixedBets({ yesOdds: 60, ticketsCount: 10, isYes });
    const tx = buildTonBetTx({
      pariAddress: pari.id,
      beneficiary: userAddress,
      isYes,
      bets: r.bets,
      referral: REFERRAL,
      referralPct: REFERRAL_PCT,
    });
    summaries.push(
      rec("TON", "fixed", r.bets, r.totalCost, calcWinnings(r.bets, REFERRAL_PCT), tx),
    );
  }

  // Limit: 30 tickets, worstYesOdds=64 → matches greedy then places remainder
  {
    const r = computeLimitBets({ oddsState, isYes, worstYesOdds: 64, ticketsCount: 30 });
    const tx = buildTonBetTx({
      pariAddress: pari.id,
      beneficiary: userAddress,
      isYes,
      bets: r.bets,
      referral: REFERRAL,
      referralPct: REFERRAL_PCT,
    });
    summaries.push(
      rec("TON", "limit", r.bets, r.totalCost, calcWinnings(r.bets, REFERRAL_PCT), tx),
    );
  }

  // Market: 1 TON budget
  {
    const r = computeMarketBets({ oddsState, isYes, maxBudgetTon: ONE_TON });
    if (!r.feasible) throw new Error(`market infeasible: ${r.reason}`);
    const tx = buildTonBetTx({
      pariAddress: pari.id,
      beneficiary: userAddress,
      isYes,
      bets: r.bets,
      referral: REFERRAL,
      referralPct: REFERRAL_PCT,
    });
    summaries.push(
      rec("TON", "market", r.bets, r.totalCost, calcWinnings(r.bets, REFERRAL_PCT), tx),
    );
  }

  // ─── USDT path (async, STON.fi) ───────────────────────────────────────
  console.log("\n━━━ USDT path (async via STON.fi) ━━━");
  if (!process.env.TONCENTER_API_KEY) {
    console.log("  ⚠ no TONCENTER_API_KEY — retry adapter handles 429s but this will be slow");
  }

  const priced = await client.betting.priceCoins();
  const usdt = priced.find((c) => c.address.toLowerCase() === USDT_MASTER.toLowerCase());
  if (!usdt?.viable) throw new Error(`USDT not viable: ${usdt?.reason ?? "not found"}`);

  // For USDT we use the quoteXxx → confirmQuote API. quoteFixedBet doesn't need
  // oddsState; quoteLimitBet/quoteMarketBet do (we pass cached one).
  // Smaller params for USDT — dev wallet has ~1.74 USDT (~1.2 TON-equivalent),
  // not enough for the 30-ticket limit case used on the TON side.
  const usdtCommon = {
    pariId: pari.id,
    isYes,
    source: USDT_MASTER,
    pricedCoins: priced,
    referral: REFERRAL,
    referralPct: REFERRAL_PCT,
    // Don't fail the smoke if the wallet can't cover; the *quote* is still
    // valid — only signing/sending would actually fail. We only print, never sign.
    allowInsufficientBalance: true,
  };

  // Fixed (5 @ 60)
  {
    const q = await client.betting.quoteFixedBet({
      ...usdtCommon,
      yesOdds: 60,
      ticketsCount: 5,
    });
    summaries.push(await confirmAndRecord(client, q, "USDT", "fixed"));
  }

  // Limit (10 tickets, worstYesOdds=64)
  {
    const q = await client.betting.quoteLimitBet({
      ...usdtCommon,
      worstYesOdds: 64,
      ticketsCount: 10,
      oddsState,
    });
    summaries.push(await confirmAndRecord(client, q, "USDT", "limit"));
  }

  // Market (0.7 TON-equivalent ≈ 1 USDT)
  {
    const q = await client.betting.quoteMarketBet({
      ...usdtCommon,
      maxBudgetTon: 700_000_000n,
      oddsState,
    });
    summaries.push(await confirmAndRecord(client, q, "USDT", "market"));
  }

  // ─── Summary table ───────────────────────────────────────────────────
  console.log("\n━━━ Summary (referral 1%, platform 4% = 5% total fee) ━━━");
  console.log(
    `  ${"src".padEnd(5)} ${"mode".padEnd(7)} ${"bets[]".padEnd(28)} ${"totalCost".padEnd(12)} ${"payout".padEnd(12)} ${"net profit".padEnd(12)} amount(nano) → to`,
  );
  for (const s of summaries) {
    const betsStr = s.bets.map((b) => `${b.ticketsCount}@${b.yesOdds}`).join("+");
    const profit = s.payout - s.totalCost;
    console.log(
      `  ${s.source.padEnd(5)} ${s.mode.padEnd(7)} ${betsStr.padEnd(28)} ${ton(s.totalCost).padEnd(12)} ${ton(s.payout).padEnd(12)} ${ton(profit).padEnd(12)} ${s.amount} → ${s.to.slice(0, 12)}…`,
    );
  }

  console.log(`\n✓ ${summaries.length} mode×source combos validated.`);
  console.log(`  Tonkeeper deeplinks printed inline above (per row).`);
}

function rec(
  source: RunSummary["source"],
  mode: RunSummary["mode"],
  bets: RunSummary["bets"],
  totalCost: bigint,
  payout: bigint,
  tx: { to: { toString(): string }; value: bigint; body?: { toBoc(): Buffer } },
): RunSummary {
  const message = {
    address: tx.to.toString(),
    amount: tx.value.toString(),
    payload: tx.body?.toBoc().toString("base64"),
  };
  console.log(
    `  ${mode.padEnd(7)} bets=${JSON.stringify(bets)}  totalCost=${ton(totalCost)}  payout=${ton(payout)}`,
  );
  console.log(`           tonkeeper: ${tonkeeperDeeplink(message)}`);
  return { source, mode, bets, totalCost, payout, amount: message.amount, to: message.address };
}

async function confirmAndRecord(
  client: ToncastClient,
  quote: BetQuote,
  source: RunSummary["source"],
  mode: RunSummary["mode"],
): Promise<RunSummary> {
  if (!quote.option.feasible) {
    throw new Error(`${source} ${mode} infeasible: ${quote.option.reason}`);
  }
  const confirmed = await client.betting.confirmQuote(quote);
  const tx = confirmed.txs[0];
  if (!tx) throw new Error(`${source} ${mode} confirmed has no txs`);
  const payout = calcWinnings(quote.bets, REFERRAL_PCT);
  return rec(source, mode, quote.bets, quote.totalCost, payout, {
    to: tx.to,
    value: tx.value,
    body: tx.body ?? undefined,
  });
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
