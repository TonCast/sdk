import type { BetOptionFailureReason } from "@toncast/tx-sdk";

export interface BetReasonContext {
  /** Symbol of the source coin used in the bet attempt. Defaults to `"TON"`. */
  sourceSymbol?: string;
}

/**
 * Stable i18n key for a `BetQuote` failure reason. Mirrors the reason code
 * verbatim under a namespaced prefix so callers can build per-locale catalogs:
 *
 * ```ts
 * t(betQuoteReasonKey(reason), { sourceSymbol: "TCAST" });
 * ```
 *
 * Keys are part of the SDK's public API — they will not change across
 * non-major releases.
 */
export function betQuoteReasonKey(reason: BetOptionFailureReason): string {
  return `betQuote.reason.${reason}`;
}

/**
 * Default English message for a `BetQuote` failure reason. Use this when
 * you don't have your own i18n layer wired up — every supported reason
 * code resolves to a user-readable sentence with concrete remediation
 * advice. For multi-language apps wire up your own catalog using
 * {@link betQuoteReasonKey} as the source of truth for keys.
 */
export function formatBetQuoteReason(
  reason: BetOptionFailureReason,
  ctx: BetReasonContext = {},
): string {
  const sym = ctx.sourceSymbol || "TON";
  switch (reason) {
    case "insufficient_balance":
      return `Your ${sym} balance is too low for this bet. Top up the wallet to confirm.`;
    case "insufficient_ton_for_gas":
      return "Not enough TON in the wallet to cover swap gas. Add a bit of TON to confirm.";
    case "slippage_exceeds_limit":
      return "Pool price moved past your slippage limit. Try again or raise the slippage.";
    case "no_route":
      return `No swap route from ${sym} to TON right now. Pick another coin.`;
    case "network_error":
      return "Network hiccup while pricing the route. Try again in a moment.";
    case "ton_client_required":
      return "Wallet is missing — connect a TON wallet to use this coin.";
    case "source_not_viable":
      return `${sym} can't fund this bet (no route or value below swap gas).`;
    case "source_not_in_priced_coins":
      return "Selected coin missing from the price snapshot. Reopen the modal.";
    case "budget_too_small_for_single_entry":
      return "The amount is too small to place even one ticket.";
    default: {
      // Compile-time exhaustiveness check — adding a new failure reason in
      // tx-sdk surfaces here as a TS error.
      const _exhaustive: never = reason;
      void _exhaustive;
      return "This bet won't sign right now.";
    }
  }
}
