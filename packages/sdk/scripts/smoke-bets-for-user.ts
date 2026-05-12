// Real-API smoke for `bets.listForUser` + cursor pagination across all paris.
// Run: USER_ADDRESS=... npx tsx scripts/smoke-bets-for-user.ts [userAddress] [maxPages]
import { ToncastClient } from "../src";

async function main() {
  const userAddress = process.argv[2] ?? requireEnv("USER_ADDRESS");
  const maxPages = Number(process.argv[3] ?? "5");
  const client = new ToncastClient({ language: "en", userAddress });

  const seen = new Set<number>();
  let totalItems = 0;
  let pageNum = 0;
  let cursor: Awaited<ReturnType<typeof client.bets.listForUser>>["nextCursor"] = null;

  console.log(`Fetching up to ${maxPages} pages of bets for ${userAddress}…\n`);

  for (let i = 0; i < maxPages; i++) {
    pageNum = i + 1;
    const t0 = Date.now();
    const page = await client.bets.listForUser({ pageSize: 20, cursor });
    const dt = Date.now() - t0;

    let dupes = 0;
    for (const b of page.items) {
      if (seen.has(b.id)) dupes++;
      seen.add(b.id);
    }
    totalItems += page.items.length;

    console.log(
      `page ${pageNum}: ${page.items.length} items (+${dupes} dupes), hasMore=${page.hasMore}, ${dt}ms`,
    );
    const first = page.items[0];
    const last = page.items[page.items.length - 1];
    if (first && last) {
      console.log(
        `  first: #${first.id}  ${first.isYes ? "YES" : "NO "} @${first.yesOdds}  pari=${first.pariAddress.slice(0, 12)}…  ${first.status}`,
      );
      console.log(
        `  last:  #${last.id}  ${last.isYes ? "YES" : "NO "} @${last.yesOdds}  pari=${last.pariAddress.slice(0, 12)}…  ${last.status}`,
      );
    }
    console.log(`  nextCursor: ${JSON.stringify(page.nextCursor)}`);

    if (!page.hasMore || !page.nextCursor) {
      console.log(`\nreached end at page ${pageNum}.`);
      break;
    }
    cursor = page.nextCursor;
  }

  console.log(
    `\nsummary: pages=${pageNum}, unique items=${seen.size}, total fetched=${totalItems}`,
  );
  if (seen.size !== totalItems) {
    console.warn("WARNING: duplicate(s) across pages — cursor encoding may be wrong.");
    process.exit(1);
  } else {
    console.log("OK: cursor advances correctly, no duplicates.");
  }
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
