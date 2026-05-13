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
 * - `referral` is applied only when both `address` and `pct` are defined; an
 *   absent `widget.referral` does not clear the client (see PR-24 for
 *   standalone clearing).
 * - SDK validation failures (`setLanguage` / `setReferral`) are caught and
 *   logged with `console.warn` so the widget keeps rendering instead of
 *   tripping the error boundary.
 */
export function useSyncClientFromConfig(
  client: ToncastClient,
  widget: ToncastWidgetConfig["widget"],
): void {
  const language = widget?.language;
  useEffect(() => {
    if (language === undefined) return;
    try {
      client.setLanguage(language);
    } catch (err) {
      console.warn("[ToncastWidget] setLanguage failed", err);
    }
  }, [client, language]);

  const referralAddr = widget?.referral?.address;
  const referralPct = widget?.referral?.pct;
  useEffect(() => {
    if (referralAddr === undefined || referralPct === undefined) {
      return;
    }
    try {
      client.setReferral({ address: referralAddr, pct: referralPct });
    } catch (err) {
      console.warn("[ToncastWidget] setReferral failed", err);
    }
  }, [client, referralAddr, referralPct]);
}
