import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from "@tanstack/react-query";
import type { BetQuote, ConfirmedQuote, QuoteCommon } from "@toncast/sdk";
import { useToncastClient } from "../client/useToncastClient";

interface ConfirmBetVariables {
  quote: BetQuote;
  /** Override the original quote params (rare — only when the quote was built manually with tx-sdk). */
  params?: QuoteCommon;
}

/**
 * `betting.confirmQuote` as a TanStack mutation. Trigger right before the user
 * signs (button click, modal confirm). Re-simulates the STON.fi swap for
 * jetton sources and returns ready-to-send TonConnect messages.
 *
 * Use the standard mutation API: `mutation.mutate({ quote })` or
 * `mutation.mutateAsync({ quote })`. `mutation.reset()` clears state for the
 * next bet.
 */
export function useConfirmBet(
  options?: UseMutationOptions<ConfirmedQuote, Error, ConfirmBetVariables>,
): UseMutationResult<ConfirmedQuote, Error, ConfirmBetVariables> {
  const client = useToncastClient();
  return useMutation<ConfirmedQuote, Error, ConfirmBetVariables>({
    ...options,
    mutationFn: ({ quote, params }) => client.betting.confirmQuote(quote, params),
  });
}
