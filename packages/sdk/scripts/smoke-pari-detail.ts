// Real-API smoke test for one full pari (all endpoints).
// Run: USER_ADDRESS=... npx tsx scripts/smoke-pari-detail.ts
import { ToncastClient } from "../src";

const PARI_ID = "EQCi1hBngahzphH1L0wknVCUJBVs7a_2LfHzoUwsoJ9biEIK";

async function main() {
  const userAddress = requireEnv("USER_ADDRESS");
  const client = new ToncastClient({ language: "en", userAddress });

  console.log(`▸ paris.get(${PARI_ID.slice(0, 12)}…)`);
  const pari = await client.paris.get(PARI_ID);
  console.log(`  ${pari.name}`);
  console.log(
    `  status=${pari.status} result=${pari.result} version=${pari.version}` +
      `  yesV=${pari.yesVolume} noV=${pari.noVolume}` +
      `  isVisible=${pari.isVisible}`,
  );
  console.log(
    `  bestYes=${pari.bestYesOdds ?? "—"}  bestNo=${pari.bestNoOdds ?? "—"}` +
      `  availableBets entries=${pari.availableBets ? Object.keys(pari.availableBets).length : "null"}`,
  );

  console.log(`\n▸ paris.getOddsState(...)`);
  const odds = await client.paris.getOddsState(PARI_ID);
  console.log(`  Yes.length=${odds.Yes.length}  No.length=${odds.No.length}`);
  const yesNonZero = odds.Yes.map((v, i) => ({ yesOdds: 2 * (i + 1), tickets: v })).filter(
    (p) => p.tickets > 0,
  );
  const noNonZero = odds.No.map((v, i) => ({
    noProb: 2 * (i + 1),
    yesOdds: 100 - 2 * (i + 1),
    tickets: v,
  })).filter((p) => p.tickets > 0);
  console.log(`  YES book:`, yesNonZero);
  console.log(`  NO  book:`, noNonZero);

  console.log(`\n▸ paris.getCoefficientHistory(... timeframe="ALL", limit=500)`);
  const hist = await client.paris.getCoefficientHistory(PARI_ID, { limit: 500, timeframe: "ALL" });
  console.log(`  pariAddress=${hist.pariAddress.slice(0, 12)}…  points=${hist.history.length}`);
  for (const p of hist.history) {
    console.log(`    ts=${p.timestamp}  coef=${p.coefficient}`);
  }

  console.log(`\n▸ paris.getWinners(...)`);
  try {
    const winners = await client.paris.getWinners(PARI_ID);
    console.log(`  winners=${winners.length}`);
    for (const w of winners.slice(0, 5))
      console.log(`    ${w.userAddress.slice(0, 12)}… side=${w.side} win=${w.winAmount}`);
  } catch (err) {
    console.log(
      `  (no winners — pari unresolved, expected for active feed: ${(err as Error).message})`,
    );
  }

  console.log(`\n▸ bets.listForPariByUser(... pageSize=15)`);
  const bets = await client.bets.listForPariByUser({ pariId: PARI_ID, pageSize: 15 });
  console.log(
    `  bets=${bets.items.length}  hasMore=${bets.hasMore}  nextCursor=${JSON.stringify(bets.nextCursor)}`,
  );
  for (const b of bets.items) {
    console.log(
      `    #${b.id}  ${b.isYes ? "YES" : "NO "} @${b.yesOdds}  tickets=${b.ticketsCount}` +
        `  rem=${b.remainingTickets}  matched=${b.matchedTickets}  status=${b.status}` +
        `  amount=${b.amount} nano-TON  cancellable=${b.isCancellable}`,
    );
  }

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
