import { ToncastError } from "./errors";

/**
 * High-level bucket for failures during confirm + wallet send.
 * UI maps each kind to localized copy; `technicalSummary` is for logs only.
 */
export type BetFlowErrorKind =
  | "toncast"
  | "wallet_user_rejected"
  | "wallet_failed"
  | "network"
  | "unknown";

export interface BetFlowErrorDescriptor {
  kind: BetFlowErrorKind;
  /** Present when `kind === "toncast"` — stable Toncast error code. */
  toncastCode?: string;
  /** Short slice of wallet/SDK message for heuristics / debugging (not for end users). */
  walletMessageSnippet?: string;
  /** Full line for `console.error` / support tickets. */
  technicalSummary: string;
}

function buildTechnicalSummary(message: string, name?: string, code?: string): string {
  const namePart = name && name !== "Error" ? name : "";
  const codePart = code ? ` code=${code}` : "";
  const head = namePart ? `${namePart}: ${message}` : message;
  return `${head}${codePart}`;
}

/** True when the message suggests the user closed the wallet or declined signing. */
function looksLikeWalletUserRejection(message: string, name?: string): boolean {
  const m = message.toLowerCase();
  const n = (name ?? "").toLowerCase();

  if (m.includes("transaction was not sent")) return true;
  if (m.includes("user rejected")) return true;
  if (m.includes("user denied")) return true;
  if (m.includes("user cancelled") || m.includes("user canceled")) return true;
  if (m.includes("rejected by user")) return true;
  if (m.includes("request rejected")) return true;
  if (m.includes("cancelled by user") || m.includes("canceled by user")) return true;
  if (m.includes("closed the window") || m.includes("modal closed")) return true;
  if (m.includes("aborted") || n.includes("aborterror")) return true;

  if (m.includes("[ton_connect_sdk_error]") && m.includes("not sent")) return true;
  if (m.includes("_tonconnectuierror") && m.includes("not sent")) return true;

  return false;
}

function looksLikeNetworkFailure(message: string): boolean {
  const m = message.toLowerCase();
  if (
    m.includes("failed to fetch") ||
    m.includes("network error") ||
    m.includes("network request failed") ||
    m.includes("load failed") ||
    m.includes("econnreset") ||
    m.includes("enotfound") ||
    m.includes("etimedout") ||
    m.includes("err_network") ||
    m.includes("request timeout") ||
    m.includes("connection timed out") ||
    m.includes("timed out")
  ) {
    return true;
  }
  // Avoid bare "timeout" — too many unrelated errors mention it.
  if (m.includes("timeout")) {
    return (
      m.includes("network") ||
      m.includes("fetch") ||
      m.includes("connection") ||
      m.includes("socket")
    );
  }
  return false;
}

/**
 * Classifies any thrown value from `confirmQuote` / `sendTransaction` so UIs can
 * show friendly copy and log {@link BetFlowErrorDescriptor.technicalSummary}.
 *
 * TonConnect message strings depend on `@tonconnect/ui-react` version — keep
 * {@link looksLikeWalletUserRejection} updated when upgrading the wallet UI stack.
 */
export function classifyBetFlowError(err: unknown): BetFlowErrorDescriptor {
  if (err instanceof ToncastError) {
    return {
      kind: "toncast",
      toncastCode: err.code,
      technicalSummary: buildTechnicalSummary(err.message, err.name, err.code),
    };
  }

  if (err instanceof Error) {
    const code =
      typeof (err as Error & { code?: unknown }).code === "string"
        ? ((err as Error & { code?: string }).code as string)
        : undefined;
    const msg = err.message ?? "";
    const name = err.name;

    if (code === "ERR_NETWORK" || looksLikeNetworkFailure(msg)) {
      return {
        kind: "network",
        technicalSummary: buildTechnicalSummary(msg, name, code),
      };
    }

    if (looksLikeWalletUserRejection(msg, name)) {
      return {
        kind: "wallet_user_rejected",
        walletMessageSnippet: msg.slice(0, 200),
        technicalSummary: buildTechnicalSummary(msg, name, code),
      };
    }

    const isLikelyWallet =
      msg.includes("TON_CONNECT") ||
      msg.includes("TonConnect") ||
      msg.includes("tonconnect") ||
      name.includes("TonConnect");

    return {
      kind: isLikelyWallet ? "wallet_failed" : "unknown",
      walletMessageSnippet: msg.slice(0, 200),
      technicalSummary: buildTechnicalSummary(msg, name, code),
    };
  }

  if (err !== null && typeof err === "object") {
    const o = err as Record<string, unknown>;
    const msg = typeof o.message === "string" ? o.message : "";
    const name = typeof o.name === "string" ? o.name : undefined;
    const code = typeof o.code === "string" ? o.code : undefined;

    if (msg) {
      if (looksLikeNetworkFailure(msg)) {
        return {
          kind: "network",
          technicalSummary: buildTechnicalSummary(msg, name, code),
        };
      }
      if (looksLikeWalletUserRejection(msg, name)) {
        return {
          kind: "wallet_user_rejected",
          walletMessageSnippet: msg.slice(0, 200),
          technicalSummary: buildTechnicalSummary(msg, name, code),
        };
      }
      const isLikelyWallet =
        msg.includes("TON_CONNECT") || msg.includes("TonConnect") || msg.includes("tonconnect");
      return {
        kind: isLikelyWallet ? "wallet_failed" : "unknown",
        walletMessageSnippet: msg.slice(0, 200),
        technicalSummary: buildTechnicalSummary(msg, name, code),
      };
    }
  }

  const fallback = String(err);
  return {
    kind: "unknown",
    technicalSummary: fallback,
  };
}

/** Toncast codes with app-defined `bet.sendError.toncast.<CODE>` catalog entries. */
const TONCAST_SEND_TRANSLATION_CODES: readonly string[] = [
  "SLIPPAGE_DRIFTED",
  "QUOTE_INFEASIBLE",
  "QUOTE_NOT_READY",
  "QUOTE_PARAMS_MISSING",
  "FINANCIAL_RISK_ACK_REQUIRED",
  "USER_ADDRESS_REQUIRED",
  "NO_LIQUIDITY",
  "INVALID_MARKET_TICKETS",
  "INVALID_ADDRESS",
];

/**
 * Stable i18n key path for bet confirm / wallet send failures (same string in
 * `@toncast/widget` and host apps). Map with your `t()` / catalog.
 */
export function resolveBetSendErrorTranslationKey(d: BetFlowErrorDescriptor): string {
  switch (d.kind) {
    case "wallet_user_rejected":
      return "bet.sendError.walletRejected";
    case "wallet_failed":
      return "bet.sendError.walletFailed";
    case "network":
      return "bet.sendError.network";
    case "unknown":
      return "bet.sendError.unknown";
    case "toncast": {
      const code = d.toncastCode ?? "";
      if (TONCAST_SEND_TRANSLATION_CODES.includes(code)) {
        return `bet.sendError.toncast.${code}`;
      }
      return "bet.sendError.toncast.generic";
    }
    default:
      return "bet.sendError.unknown";
  }
}
