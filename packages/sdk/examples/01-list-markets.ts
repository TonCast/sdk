// Usage:
//   tsx examples/01-list-markets.ts                # active paris (default)
//   tsx examples/01-list-markets.ts finished       # resolved paris
//   tsx examples/01-list-markets.ts pending        # awaiting oracle
//   tsx examples/01-list-markets.ts category 3     # active paris in category 3
import { type ParisFeed, ToncastClient } from "../src";

async function main() {
  const arg = process.argv[2];
  const feed: ParisFeed | undefined =
    arg === "finished" || arg === "pending" || arg === "active" ? arg : undefined;
  const categoryId = arg === "category" ? Number(process.argv[3]) : undefined;
  const client = new ToncastClient({ language: process.env.LANG?.split(/[._]/)[0] });

  const page = await client.paris.list({ feed, categoryId, limit: 20 });
  console.log(
    `fetched ${page.items.length} paris (hasMore=${page.hasMore}, nextCursor=${JSON.stringify(page.nextCursor)})`,
  );
  for (const pari of page.items) {
    const tag =
      pari.status === "inactive"
        ? `[${pari.result}]`
        : `${pari.bestYesOdds ?? "—"}/${pari.bestNoOdds ?? "—"}`;
    console.log(`- ${tag.padEnd(10)} ${pari.id.slice(0, 8)}…  ${pari.name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
