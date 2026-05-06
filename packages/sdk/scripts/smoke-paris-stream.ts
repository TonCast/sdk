// Real-API smoke for `client.paris.streamList(...)` against production.
// Subscribes for ~30s, prints status + snapshot deltas.
//
// Run: npx tsx scripts/smoke-paris-stream.ts [seconds]
import { ToncastClient } from "../src";

async function main() {
  const seconds = Number(process.argv[2] ?? "30");
  const client = new ToncastClient({ language: "en" });

  const stream = client.paris.streamList({ feed: "active", pageSize: 10 });

  let snapshotCount = 0;
  stream.onStatus((s) => console.log(`▸ status: ${s}`));
  stream.onSnapshot((paris) => {
    snapshotCount++;
    console.log(`  snapshot #${snapshotCount}: ${paris.length} items, hasMore=${stream.hasMore}`);
    if (snapshotCount === 1) {
      console.log("  first 3:");
      for (const p of paris.slice(0, 3)) {
        console.log(
          `    [${p.id.slice(0, 8)}…] yes=${p.yesVolume} no=${p.noVolume} odds=${p.bestYesOdds}/${p.bestNoOdds}`,
        );
      }
    }
  });

  await new Promise((r) => setTimeout(r, 5000));
  console.log("\n▸ loadMore()");
  await stream.loadMore();
  console.log(`  after loadMore: ${stream.snapshot().length} items, hasMore=${stream.hasMore}`);

  console.log(`\n▸ listening for ${seconds - 5}s more…`);
  await new Promise((r) => setTimeout(r, (seconds - 5) * 1000));

  console.log(`\n=== Summary ===`);
  console.log(`  total snapshots emitted: ${snapshotCount}`);
  console.log(`  final size: ${stream.snapshot().length}`);
  console.log(`  final status: ${stream.getStatus()}`);

  stream.stop();
  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
