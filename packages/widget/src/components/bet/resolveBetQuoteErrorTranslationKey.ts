import {
  type BetFlowErrorDescriptor,
  resolveBetQuoteErrorTranslationKey as sdkResolveBetQuoteErrorTranslationKey,
} from "@toncast/sdk";
import type { TranslationKey } from "../../i18n/translations";

/** Maps quote fetch failures to a widget {@link TranslationKey}. */
export function resolveBetQuoteErrorTranslationKey(d: BetFlowErrorDescriptor): TranslationKey {
  return sdkResolveBetQuoteErrorTranslationKey(d) as TranslationKey;
}
