// Real-API smoke test: paginates the finished-paris feed and verifies
// the SDK's cursor handling on production.
// Run: npx tsx scripts/smoke-paris-pagination.ts [maxPages]
import { ToncastClient } from "../src";

const PAGE_LIMIT = 20;

async function main() {
  const maxPages = Number(process.argv[2] ?? "5");
  const client = new ToncastClient({ language: "en" });

  const seen = new Set<string>();
  let totalItems = 0;
  let pageNum = 0;
  let cursor: Awaited<ReturnType<typeof client.paris.list>>["nextCursor"] = null;

  console.log(`Fetching up to ${maxPages} pages of finished paris (limit=${PAGE_LIMIT})…\n`);

  for (let i = 0; i < maxPages; i++) {
    pageNum = i + 1;
    const t0 = Date.now();
    const page = await client.paris.list({
      feed: "finished",
      limit: PAGE_LIMIT,
      cursor,
    });
    const dt = Date.now() - t0;

    let dupesOnThisPage = 0;
    for (const pari of page.items) {
      if (seen.has(pari.id)) dupesOnThisPage++;
      seen.add(pari.id);
    }
    totalItems += page.items.length;

    const first = page.items[0];
    const last = page.items[page.items.length - 1];
    console.log(
      `page ${pageNum}: ${page.items.length} items (+${dupesOnThisPage} dupes), ` +
        `hasMore=${page.hasMore}, ${dt}ms`,
    );
    if (first && last) {
      console.log(
        `  first: ${first.id.slice(0, 12)}…  endTime=${first.endTime}  result=${first.result}`,
      );
      console.log(
        `  last:  ${last.id.slice(0, 12)}…  endTime=${last.endTime}  result=${last.result}`,
      );
    }
    console.log(`  nextCursor: ${JSON.stringify(page.nextCursor)}`);

    if (!page.hasMore || !page.nextCursor) {
      console.log(`\nreached end of feed at page ${pageNum}.`);
      break;
    }
    cursor = page.nextCursor;
  }

  console.log(
    `\nsummary: pages=${pageNum}, unique items=${seen.size}, total fetched=${totalItems}`,
  );
  if (seen.size !== totalItems) {
    console.warn(
      `WARNING: ${totalItems - seen.size} duplicate(s) across pages — cursor may be off.`,
    );
  } else {
    console.log("OK: no duplicates between pages — cursor advances correctly.");
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
