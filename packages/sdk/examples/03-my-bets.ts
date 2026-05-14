// Usage: tsx examples/03-my-bets.ts <pariId> <userAddress>
import { parseTonAddress, ToncastClient } from "../src";

async function main() {
  const pariId = process.argv[2];
  const userAddressRaw = process.argv[3];
  if (!pariId || !userAddressRaw) {
    throw new Error("usage: tsx examples/03-my-bets.ts <pariId> <userAddress>");
  }
  const userAddress = parseTonAddress(userAddressRaw, "userAddress");

  const client = new ToncastClient({
    baseUrl: process.env.TONCAST_API_URL,
    userAddress,
  });

  const page = await client.bets.listForPariByUser({ pariId, pageSize: 15 });
  console.log(`bets for ${userAddress} on ${pariId}: ${page.items.length}`);
  for (const bet of page.items) {
    console.log(
      `  #${bet.id} ${bet.isYes ? "YES" : "NO"} @ ${bet.yesOdds}` +
        `  tickets=${bet.ticketsCount}  amount=${bet.amount}  status=${bet.status}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
