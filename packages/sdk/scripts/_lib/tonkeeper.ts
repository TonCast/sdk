// Helpers to convert SDK output (TonConnectMessage[]) into wallet-bridge URIs.
//
// Tonkeeper supports two surfaces:
//   1) `https://app.tonkeeper.com/transfer/<dest>?amount=<nano>&bin=<base64url>`
//      → single-tx deeplink (works on mobile + desktop). One per message; if the
//      bet route has multiple txs (jetton swap), each gets its own URL.
//   2) TonConnect protocol — required for atomic batch signing of multi-tx
//      flows. The integrator passes `messages` straight to `connector.sendTransaction`.
//
// For smoke purposes we print:
//   - the raw TonConnect-shaped messages (drop into any TonConnect bridge)
//   - per-message Tonkeeper deeplinks (open in browser → Tonkeeper picks up)

import type { TonConnectMessage } from "../../src";

/** Convert standard base64 to URL-safe base64 (RFC 4648 §5). */
function base64ToBase64Url(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Single-tx Tonkeeper deeplink. Works for any message — TON transfer or
 * jetton-wallet `transfer{forward_payload}` — Tonkeeper signs whatever
 * payload you put in `bin`.
 */
export function tonkeeperDeeplink(msg: TonConnectMessage): string {
  const params = new URLSearchParams();
  params.set("amount", msg.amount);
  if (msg.payload) params.set("bin", base64ToBase64Url(msg.payload));
  if (msg.stateInit) params.set("init", base64ToBase64Url(msg.stateInit));
  return `https://app.tonkeeper.com/transfer/${msg.address}?${params.toString()}`;
}

/** Pretty-print a confirmed bet's messages for a smoke script. */
export function printForTonkeeper(messages: TonConnectMessage[]): void {
  console.log(`\n▸ TonConnect messages (drop into connector.sendTransaction):`);
  console.log(JSON.stringify(messages, null, 2));

  console.log(`\n▸ Tonkeeper deeplinks (one per message):`);
  for (const [i, m] of messages.entries()) {
    console.log(`  [${i + 1}/${messages.length}] ${tonkeeperDeeplink(m)}`);
  }
  if (messages.length > 1) {
    console.log(
      `\n  Note: multi-tx routes (jetton → STON.fi swap → bet) are NOT atomic via deeplinks.`,
    );
    console.log(
      `  Use TonConnect (\`sendTransaction({ messages, validUntil })\`) for one-shot signing.`,
    );
  }
}
