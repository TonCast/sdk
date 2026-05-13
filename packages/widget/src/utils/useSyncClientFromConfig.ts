import type { ToncastClient } from "@toncast/sdk";
import { useEffect } from "react";
import type { ToncastWidgetConfig } from "../types";

/**
 * Pushes the host-controllable bits of `widget.{language,referral}` into the
 * given `ToncastClient` whenever they change.
 *
 * Lets the widget honour `widget.language` / `widget.referral` for **both**
 * standalone (where we own the client) and integrated (where the host owns it)
 * without rebuilding the client every time — recreating a client wipes the
 * SDK's WS subscriptions and the TanStack-Query cache, which is the visible
 * "blank-then-refetch" symptom we want to avoid.
 *
 * Behaviour:
 * - `language` is applied only when defined; we never silently overwrite the
 *   host's preference with `undefined`.
 * - `referral` is applied (or cleared with `undefined`) only after it has been
 *   set at least once via this hook — so an integrator that manages referral
 *   directly on the client is not stomped by an absent `widget.referral`.
 */
export function useSyncClientFromConfig(
  client: ToncastClient,
  widget: ToncastWidgetConfig["widget"],
): void {
  const language = widget?.language;
  useEffect(() => {
    if (language === undefined) return;
    client.setLanguage(language);
  }, [client, language]);

  const referralAddr = widget?.referral?.address;
  const referralPct = widget?.referral?.pct;
  useEffect(() => {
    if (referralAddr === undefined || referralPct === undefined) {
      return;
    }
    client.setReferral({ address: referralAddr, pct: referralPct });
  }, [client, referralAddr, referralPct]);
}
