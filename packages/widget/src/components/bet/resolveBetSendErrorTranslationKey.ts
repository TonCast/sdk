import {
  type BetFlowErrorDescriptor,
  resolveBetSendErrorTranslationKey as sdkResolveBetSendErrorTranslationKey,
} from "@toncast/sdk";
import type { TranslationKey } from "../../i18n/translations";

/** Maps {@link classifyBetFlowError} output to a widget {@link TranslationKey}. */
export function resolveBetSendErrorTranslationKey(d: BetFlowErrorDescriptor): TranslationKey {
  return sdkResolveBetSendErrorTranslationKey(d) as TranslationKey;
}
