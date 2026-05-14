// Build a ready-to-sign bet transaction. The SDK does NOT sign or send —
// the integrator hands the result to TonConnect (or any other wallet bridge).
//
// Flow: quoteFixedBet → confirmQuote (required, returns both formats)
//
// Usage: tsx examples/04-place-bet.ts
import { TON_ADDRESS, TonClient, ToncastClient } from "../src";

async function main() {
  const userAddress = requireEnv("USER_ADDRESS");
  const pariId = requireEnv("PARI_ID");
  const tonClient = new TonClient({
    endpoint: process.env.TON_ENDPOINT ?? "https://toncenter.com/api/v2/jsonRPC",
    ...(process.env.TONCENTER_API_KEY ? { apiKey: process.env.TONCENTER_API_KEY } : {}),
  });

  const client = new ToncastClient({
    userAddress,
    tonClient,
  });

  // Store the params once and reuse for both quote and confirmQuote — keeps
  // beneficiary / senderAddress / referral consistent end-to-end.
  const quoteParams = {
    pariId,
    isYes: true,
    yesOdds: 56,
    ticketsCount: 10,
    source: TON_ADDRESS,
    financialRiskAcknowledged: true as const,
  };

  const quote = await client.betting.quoteFixedBet(quoteParams);

  // Re-simulates the swap and rebuilds the tx — REQUIRED before signing.
  // Address resolution is auto-tracked from the matching quote* call.
  // Returns { quote, txs, messages } — both raw and TonConnect formats.
  const confirmed = await client.betting.confirmQuote(quote, quoteParams);

  console.log("totalCost:", confirmed.quote.totalCost, "nano-TON");
  console.log("messages to sign:", confirmed.messages.length);

  // Hand off to your wallet bridge of choice. Examples:
  //
  //   // Browser app via @tonconnect/ui:
  //   await tonConnectUI.sendTransaction({
  //     validUntil: Math.floor(Date.now() / 1000) + 600,
  //     messages: confirmed.messages,
  //   });
  //
  //   // Server-side signer with raw tx-sdk transactions:
  //   for (const tx of confirmed.txs) await myServerSigner.send(tx);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required; do not use placeholder addresses.`);
  return value;
}
