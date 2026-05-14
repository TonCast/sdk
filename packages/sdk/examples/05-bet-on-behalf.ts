// Bet-on-behalf: signer ≠ beneficiary, with optional self-referral.
//
// Three roles for every bet:
//   1. SIGNER       (= client.userAddress)  — wallet that funds & signs.
//   2. BENEFICIARY  (= params.beneficiary)  — wallet that owns the tickets
//                                              and receives any payout.
//   3. REFERRAL     (= params.referral)     — optional 3rd party that earns
//                                              `referralPct` (0..7) of winnings.
//                                              Can equal the SIGNER (self-refer).
//                                              Must NOT equal the BENEFICIARY.
//
// Flow: quoteFixedBet → confirmQuote (required, returns both formats)
//
// Usage: tsx examples/05-bet-on-behalf.ts
import { TonClient, ToncastClient } from "../src";

async function main() {
  const signerAddress = requireEnv("SIGNER_ADDRESS");
  const pariId = requireEnv("PARI_ID");
  const beneficiary = requireEnv("RECIPIENT_ADDRESS");
  const tonClient = new TonClient({
    endpoint: process.env.TON_ENDPOINT ?? "https://toncenter.com/api/v2/jsonRPC",
    ...(process.env.TONCENTER_API_KEY ? { apiKey: process.env.TONCENTER_API_KEY } : {}),
  });

  const client = new ToncastClient({
    baseUrl: process.env.TONCAST_API_URL,
    userAddress: signerAddress, // the SIGNER (TonConnect-bound wallet)
    tonClient,
  });

  // Discover the SIGNER's coins via TonAPI (configured on `new ToncastClient({ tonApi })`).
  // Without `tonApi`, only TON balance is reported.
  const coins = await client.coins.list();
  const usdt = coins.find((c) => (c.symbol ?? "").toUpperCase() === "USDT");
  if (!usdt) throw new Error("signer wallet has no USDT");

  const quoteParams = {
    pariId,
    isYes: true,
    yesOdds: 56,
    ticketsCount: 10,
    source: usdt.address,
    // senderAddress auto-defaults to client.userAddress (the SIGNER) — override only if you have a separate signer.
    beneficiary,
    referral: process.env.REFERRAL_ADDRESS ?? null, // can equal SIGNER for agent self-referral
    referralPct: 5, // 0..7
    financialRiskAcknowledged: true as const,
  };

  const quote = await client.betting.quoteFixedBet(quoteParams);

  // Re-simulates the swap and rebuilds the tx — required before signing (critical for jetton sources).
  // Returns { quote, txs, messages }; auto-uses the params from the matching quote* call.
  const confirmed = await client.betting.confirmQuote(quote, quoteParams);

  console.log("messages ready for TonConnect:", JSON.stringify(confirmed.messages, null, 2));
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
