// Real-API smoke for `client.paris.subscribe(pariId)` against production.
// Run: npx tsx scripts/smoke-pari-subscribe.ts [pariId] [seconds]
import { ToncastClient } from "../src";

const DEFAULT_PARI = "EQCi1hBngahzphH1L0wknVCUJBVs7a_2LfHzoUwsoJ9biEIK";

async function main() {
  const pariId = process.argv[2] ?? DEFAULT_PARI;
  const seconds = Number(process.argv[3] ?? "30");
  const client = new ToncastClient({ language: "en" });

  const stream = client.paris.subscribe(pariId);

  let pariUpdates = 0;
  let oddsUpdates = 0;
  let historyUpdates = 0;
  let betEvents = 0;

  stream.onStatus((s) => console.log(`▸ status: ${s}`));

  stream.onPari((p) => {
    pariUpdates++;
    if (pariUpdates === 1) {
      console.log(
        `  pari[1]: status=${p.status} result=${p.result} yes=${p.yesVolume} no=${p.noVolume}`,
      );
    } else {
      console.log(
        `  pari[${pariUpdates}]: status=${p.status} result=${p.result} yes=${p.yesVolume} no=${p.noVolume}`,
      );
    }
  });

  stream.onOddsState((s) => {
    oddsUpdates++;
    const yesNonZero = s.Yes.map((v, i) => ({ odds: 2 * (i + 1), v })).filter((x) => x.v > 0);
    const noNonZero = s.No.map((v, i) => ({ noProb: 2 * (i + 1), v })).filter((x) => x.v > 0);
    console.log(
      `  odds[${oddsUpdates}]: YES ${JSON.stringify(yesNonZero)}  NO ${JSON.stringify(noNonZero)}`,
    );
  });

  stream.onCoefficientHistory((h) => {
    historyUpdates++;
    console.log(`  history[${historyUpdates}]: ${h.length} points`);
  });

  stream.onBetEvent((e) => {
    betEvents++;
    console.log(
      `  bet event #${betEvents}: ${e.newBets.length} new bets, ${e.matchedPairs.length} matched pairs`,
    );
  });

  console.log(`▸ listening for ${seconds}s on ${pariId.slice(0, 12)}…`);
  await new Promise((r) => setTimeout(r, seconds * 1000));

  console.log(`\n=== Summary ===`);
  console.log(`  pari snapshots:     ${pariUpdates}`);
  console.log(`  oddsState updates:  ${oddsUpdates}`);
  console.log(`  history updates:    ${historyUpdates}`);
  console.log(`  bet events:         ${betEvents}`);
  console.log(`  final status:       ${stream.getStatus()}`);

  stream.stop();
  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
