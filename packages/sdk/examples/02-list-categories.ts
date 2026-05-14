// Usage: tsx examples/02-list-categories.ts
//
// Fetches localised market categories (same data the demo chips use before
// `paris.list({ categoryId })`). Complements `01-list-markets.ts`.
import { ToncastClient } from "../src";

async function main() {
  const client = new ToncastClient({ language: process.env.LANG?.split(/[._]/)[0] });

  const categories = await client.categories.list();
  console.log(`categories (${categories.length}):`);
  for (const c of categories) {
    console.log(`  id=${c.id}  ${c.title}`);
  }

  const filters = await client.categories.listFilters();
  console.log(`\nlistFilters (${filters.length}) — use .param with paris.streamList / list:`);
  for (const f of filters) {
    console.log(`  ${JSON.stringify(f.name)} → ${JSON.stringify(f.param)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
