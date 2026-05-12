// Real-API smoke: jetton discovery via toncenter.
//
// You pass the standard v2 RPC `tonClient` (which everyone already uses); the
// SDK internally hits toncenter's index endpoint `…/api/v3/jetton/wallets`
// with the same API key. Missing `decimals` are filled per TEP-74 spec
// (default 9) so output is consistent across all jettons.
//
// Run: USER_ADDRESS=... npx tsx scripts/smoke-coins-tonapi.ts [userAddress]
import { TonClient, ToncastClient } from "../src";

async function main() {
  const userAddress = process.argv[2] ?? requireEnv("USER_ADDRESS");

  const tonClient = new TonClient({
    endpoint: "https://toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.TONCENTER_API_KEY,
  });
  const client = new ToncastClient({ tonClient, userAddress });

  console.log(
    `▸ coins.list() — tonClient @ toncenter${process.env.TONCENTER_API_KEY ? "  with API key" : "  no key (1 req/sec public limit)"}\n`,
  );
  const t0 = Date.now();
  const coins = await client.coins.list();
  const dt = Date.now() - t0;

  console.log(
    `  ${"symbol".padEnd(8)} ${"amount (raw)".padEnd(20)} ${"decimals".padEnd(10)} master`,
  );
  console.log(`  ${"─".repeat(8)} ${"─".repeat(20)} ${"─".repeat(10)} ${"─".repeat(20)}`);
  for (const c of coins) {
    const sym = (c.symbol ?? "TON").padEnd(8);
    const amt = `${c.amount}n`.padEnd(20);
    const dec = `${c.decimals ?? "—"}`.padEnd(10);
    console.log(`  ${sym} ${amt} ${dec} ${c.address.slice(0, 18)}…`);
  }

  console.log(
    `\n✓ ${coins.length} coins (TON + ${coins.length - 1} jettons) in ${dt}ms via toncenter.`,
  );
  console.log(
    `  decimals are TEP-74 spec-compliant (default 9 when master doesn't publish the field).`,
  );
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
