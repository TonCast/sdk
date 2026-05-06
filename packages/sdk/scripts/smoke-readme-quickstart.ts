// Real-API smoke test executing the README Quick start scenario verbatim.
// No signing — just reads + builds the quote and confirms.
//
// Run: npx tsx scripts/smoke-readme-quickstart.ts
import { TON_ADDRESS, TonClient, ToncastClient } from "../src";

const TEST_USER = "UQD7k4QZ7LtO3ZtCnoS1GIy84erPasgjiU70_rgRqNxQwIQN";
const TEST_PARI = "EQCi1hBngahzphH1L0wknVCUJBVs7a_2LfHzoUwsoJ9biEIK"; // active pari with odds

async function main() {
  console.log("▸ Phase 1 — public reads, no wallet");

  const tonClient = new TonClient({
    endpoint: "https://toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.TONCENTER_API_KEY,
  });

  const client = new ToncastClient({
    tonClient,
    // Use a DIFFERENT address than the user — referral must not equal beneficiary.
    referral: { address: "UQAREREREREREREREREREREREREREREREREREREREREREbvW", pct: 5 },
  });

  // Use a known active pari instead of "first from list" since list ordering may
  // pick a market that has no liquidity → quote would still work but be uninteresting.
  const pariId = TEST_PARI;
  console.log(`  using pari ${pariId.slice(0, 12)}…\n`);

  console.log("▸ Phase 2 — wallet known");
  client.setUserAddress(TEST_USER);

  console.log("▸ Step 2 — betting.summary()");
  const t0 = Date.now();
  const summary = await client.betting.summary(pariId);
  console.log(`  ${Date.now() - t0}ms  pari="${summary.pari.name.slice(0, 60)}…"`);
  console.log(`  capacities: ${summary.capacities.length}`);
  for (const c of summary.capacities) {
    console.log(
      `    ${(c.source.symbol ?? "TON").padEnd(6)}  feasible=${c.feasible}  ` +
        `min=${c.minBetTon} max=${c.maxBetTon} route=${typeof c.route === "string" ? c.route : JSON.stringify(c.route)}`,
    );
  }

  console.log("\n▸ Step 3 — pick TON, build quote");
  const picked = summary.capacities.find((c) => c.source.address === TON_ADDRESS && c.feasible);
  if (!picked) throw new Error("no viable funding source");

  const maxBudgetTon = picked.maxBetTon < 5_000_000_000n ? picked.maxBetTon : 5_000_000_000n;

  const quoteParams = {
    pariId,
    isYes: true,
    maxBudgetTon,
    source: picked.source.address,
    pricedCoins: summary.pricedCoins,
    oddsState: summary.oddsState,
  };

  const quote = await client.betting.quoteMarketBet(quoteParams);

  // Verify all README-claimed fields exist
  const checks: Record<string, unknown> = {
    "quote.mode": quote.mode,
    "quote.isYes": quote.isYes,
    "quote.totalCost": quote.totalCost,
    "quote.bets": quote.bets,
    "quote.option.feasible": quote.option.feasible,
  };
  if (quote.option.feasible) {
    checks["quote.option.estimated"] = quote.option.estimated;
    checks["quote.option.source"] = quote.option.source;
    checks["quote.option.breakdown.spend"] = quote.option.breakdown.spend;
    checks["quote.option.breakdown.gas"] = quote.option.breakdown.gas;
  }
  console.log("  README-claimed quote fields:");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`    ${k.padEnd(30)} = ${typeof v === "bigint" ? `${v}n` : JSON.stringify(v)}`);
  }

  // Verify the README Win-calc snippet works
  const totalWinNano = quote.bets.reduce(
    (acc, b) => acc + BigInt(b.ticketsCount) * 100_000_000n,
    0n,
  );
  console.log(
    `  Win if YES wins (README formula): ${totalWinNano}n  (${Number(totalWinNano) / 1e9} TON)`,
  );

  console.log("\n▸ Step 4 — confirmQuote(quote) — params auto-tracked");
  const confirmed = await client.betting.confirmQuote(quote);
  console.log(
    `  confirmed.txs=${confirmed.txs.length}  confirmed.messages=${confirmed.messages.length}`,
  );
  const m0 = confirmed.messages[0];
  if (m0) {
    console.log(`  messages[0].address: ${m0.address}`);
    console.log(`  messages[0].amount:  ${m0.amount}`);
    console.log(`  messages[0].payload: ${m0.payload?.slice(0, 40)}…`);
  }

  console.log("\nALL OK — README Quick start works end-to-end on prod.");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
