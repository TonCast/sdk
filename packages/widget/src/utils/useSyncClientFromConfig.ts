import type { ToncastClient } from "@toncast/sdk";
import { useEffect, useRef } from "react";
import type { ToncastWidgetConfig } from "../types";

interface SyncOptions {
  /**
   * Standalone widget owns the `ToncastClient`, so removing `widget.referral`
   * from config legitimately means "drop the referral". Integrated widget
   * shares the client with the host, so an absent `widget.referral` must
   * **not** stomp whatever the host configured directly on the client.
   */
  ownsClient: boolean;
}

/**
 * Pushes the host-controllable bits of `widget.{language,referral}` into the
 * given `ToncastClient` whenever they change.
 *
 * Lets the widget honour `widget.language` / `widget.referral` for **both**
 * standalone (we own the client) and integrated (host owns it) without
 * rebuilding the client every time — recreating a client wipes the SDK's WS
 * subscriptions and the TanStack-Query cache, which is the visible
 * "blank-then-refetch" symptom we want to avoid.
 *
 * Behaviour:
 * - `language` is applied only when defined; we never silently overwrite the
 *   host's preference with `undefined`.
 * - `referral`:
 *   - `ownsClient: true` (standalone): applied on mount, on change, and
 *     **cleared** with `setReferral(undefined)` once it has been set at
 *     least once via this hook and is then removed from config.
 *   - `ownsClient: false` (integrated): applied only when both `address`
 *     and `pct` are defined — an absent `widget.referral` is treated as
 *     "host manages this directly" and is not touched.
 * - SDK validation failures (`setLanguage` / `setReferral`) are caught and
 *   logged with `console.warn` so the widget keeps rendering instead of
 *   tripping the error boundary.
 */
export function useSyncClientFromConfig(
  client: ToncastClient,
  widget: ToncastWidgetConfig["widget"],
  { ownsClient }: SyncOptions,
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
  // `hadReferralRef` gates standalone clearing: we only call setReferral(undefined)
  // after the hook itself has set a real value at least once. Without this, an
  // initial render with `widget.referral === undefined` would needlessly call
  // setReferral(undefined) on every standalone mount.
  const hadReferralRef = useRef(false);
  useEffect(() => {
    const hasReferral = referralAddr !== undefined && referralPct !== undefined;
    if (hasReferral) {
      try {
        client.setReferral({ address: referralAddr, pct: referralPct });
        hadReferralRef.current = true;
      } catch (err) {
        console.warn("[ToncastWidget] setReferral failed", err);
      }
      return;
    }
    if (ownsClient && hadReferralRef.current) {
      try {
        client.setReferral(undefined);
        hadReferralRef.current = false;
      } catch (err) {
        console.warn("[ToncastWidget] setReferral(undefined) failed", err);
      }
    }
  }, [client, ownsClient, referralAddr, referralPct]);
}
