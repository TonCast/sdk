import type { BetFlowErrorDescriptor } from "@toncast/sdk";
import { useState } from "react";
import { useT } from "../../i18n/useT";
import { resolveBetSendErrorTranslationKey } from "./resolveBetSendErrorTranslationKey";

export interface BetFlowErrorAlertProps {
  descriptor: BetFlowErrorDescriptor;
  /** Clears the inline error (Close). */
  onDismiss: () => void;
}

/**
 * Inline card for bet confirm / wallet send failures: localized copy, optional
 * technical details, and a Close action to clear the alert (see {@link WidgetErrorBoundary} patterns).
 */
export function BetFlowErrorAlert({ descriptor, onDismiss }: BetFlowErrorAlertProps) {
  const t = useT();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const msgKey = resolveBetSendErrorTranslationKey(descriptor);
  const isMuted = descriptor.kind === "wallet_user_rejected";
  const live =
    descriptor.kind === "network" || descriptor.kind === "wallet_failed" ? "assertive" : "polite";

  return (
    <div
      className={`tc-bet-flow-error${isMuted ? " tc-bet-flow-error--muted" : ""}`}
      role="alert"
      aria-live={live}
    >
      <p className="tc-bet-flow-error-msg">{t(msgKey)}</p>
      <div className="tc-bet-flow-error-actions">
        <button type="button" className="tc-btn tc-btn-secondary tc-btn-sm" onClick={onDismiss}>
          {t("bet.sendError.dismiss")}
        </button>
        <button
          type="button"
          className="tc-btn tc-btn-ghost tc-btn-sm"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((o) => !o)}
        >
          {detailsOpen ? t("detail.collapseDescription") : t("bet.sendError.detailsToggle")}
        </button>
      </div>
      {detailsOpen && (
        <pre className="tc-bet-flow-error-details">{descriptor.technicalSummary}</pre>
      )}
    </div>
  );
}
