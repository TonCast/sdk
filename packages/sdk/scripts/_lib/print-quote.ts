// Pretty-printer for tx-sdk's `BetQuote`. Every economic value comes from
// tx-sdk helpers (`breakdownTotals`, `calcWinnings`, `yesOddsToDecimalOdds`,
// `yesOddsToProbabilityPct`); we don't compute anything here. Unit conversion
// for display is delegated to `@ton/core`'s `fromNano`.

import { fromNano } from "@ton/core";
import {
  type BetQuote,
  breakdownTotals,
  calcWinnings,
  yesOddsToDecimalOdds,
  yesOddsToProbabilityPct,
} from "@toncast/tx-sdk";

const ton = (n: bigint): string => `${fromNano(n)} TON`;

function bigintReplacer(_k: string, v: unknown): unknown {
  return typeof v === "bigint" ? `${v}n` : v;
}

export function printBetQuote(
  label: string,
  quote: BetQuote,
  isYes: boolean,
  referralPct = 0,
): void {
  // `source` is the TON_ADDRESS string for native bets, structured PricedCoin
  // for jetton-funded ones. Show whichever is meaningful.
  const sourceLabel =
    typeof quote.option.source === "string"
      ? quote.option.source
      : ((quote.option.source as { symbol?: string; address?: string }).symbol ??
        (quote.option.source as { address?: string }).address ??
        "?");

  console.log(`\n▸ ${label}`);
  console.log(`  mode=${quote.mode}  source=${sourceLabel}`);
  console.log(`  totalCost (TON-equivalent stake+fee) = ${ton(quote.totalCost)}`);
  console.log(`  feasible=${quote.option.feasible}  estimated=${quote.option.estimated}`);

  if (!quote.option.feasible) {
    console.log(`  reason=${quote.option.reason}`);
    return;
  }
  console.log(
    `  option.breakdown.spend = ${ton(quote.option.breakdown.spend)}  ← TON value carried by the message(s)`,
  );
  console.log(
    `  option.breakdown.gas   = ${ton(quote.option.breakdown.gas)}  txs=${quote.option.txs.length}`,
  );
  if (quote.option.warnings?.length) {
    for (const w of quote.option.warnings) console.log(`  ⚠ ${w}`);
  }

  // tx-sdk's UI helpers — single source of truth for every cost number a UI shows
  const totals = breakdownTotals(quote);
  console.log(`\n  ── breakdownTotals (tx-sdk UI helper) ──`);
  console.log(`    stake (matched ticket cost):     ${ton(totals.matchedTicketCost)}`);
  if (totals.placementTickets > 0) {
    console.log(`    placement ticket cost:           ${ton(totals.placementTicketCost)}`);
  }
  console.log(
    `    execution fee (${quote.bets.length} entries × 0.1 TON): ${ton(totals.executionFee)}`,
  );
  console.log(`    stake + executionFee = total:    ${ton(totals.total)}`);
  // `total` is the TON-equivalent (stake + exec fee). For native-TON bets it
  // matches `option.spend` exactly; for jetton-funded bets `spend` is just the
  // forward fee on the jetton transfer (the swap converts USDT → TON in-flight).
  if (totals.total === quote.option.breakdown.spend) {
    console.log(`    ✓ matches option.spend (native TON bet — sent as-is)`);
  } else {
    console.log(
      `    note: option.spend (${ton(quote.option.breakdown.spend)}) ≠ total because the jetton swap delivers TON in-flight via STON.fi`,
    );
  }

  // calcWinnings: gross net-of-platform-fee payout if `isYes` side wins.
  // To get the wallet's actual net profit we must subtract the FULL outgoing
  // amount (stake + execution fee), not just the stake — the exec fee is
  // unrecoverable on a winning bet, same as on a losing one.
  const win = calcWinnings(quote.bets, referralPct);
  console.log(`\n  ── calcWinnings (referralPct=${referralPct}) ──`);
  console.log(`    if ${isYes ? "YES" : "NO"} wins → payout:   ${ton(win)}`);
  console.log(`    wallet sent (totals.total): ${ton(totals.total)}   (stake + exec fee)`);
  console.log(`    net wallet profit if win:   ${ton(win - totals.total)}`);
  console.log(
    `    note: includes 4% platform fee${referralPct ? ` + ${referralPct}% referral` : ""} on each winning ticket`,
  );

  console.log(`\n  ── per-line bets[] ──`);
  for (const [i, b] of quote.bets.entries()) {
    const decOdds = yesOddsToDecimalOdds(b.yesOdds, isYes);
    const probPct = yesOddsToProbabilityPct(b.yesOdds, isYes);
    const lineWin = calcWinnings([b], referralPct);
    console.log(
      `    [${i}] yesOdds=${b.yesOdds}  ticketsCount=${b.ticketsCount}  ` +
        `decimalOdds=${decOdds.toFixed(2)}  prob≈${probPct.toFixed(0)}%  ` +
        `win-if-resolves=${ton(lineWin)}`,
    );
    const m = b.breakdown?.matched;
    const p = b.breakdown?.placement;
    if (m) console.log(`        matched:   ${JSON.stringify(m, bigintReplacer)}`);
    if (p) console.log(`        placement: ${JSON.stringify(p, bigintReplacer)}`);
  }
}
