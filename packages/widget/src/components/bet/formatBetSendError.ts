import { ToncastError } from "@toncast/sdk";

/** User-visible send/confirm failure — includes Toncast `code` when available. */
export function formatBetSendError(err: unknown): string {
  if (err instanceof ToncastError) {
    return `${err.code}: ${err.message}`;
  }
  if (err instanceof Error) {
    const code = (err as Error & { code?: unknown }).code;
    if (typeof code === "string" && code.length > 0) {
      return `${code}: ${err.message}`;
    }
    return err.message;
  }
  if (err !== null && typeof err === "object") {
    const o = err as Record<string, unknown>;
    const msg = o.message;
    const code = o.code;
    if (typeof msg === "string" && msg.length > 0) {
      if (typeof code === "string" && code.length > 0) return `${code}: ${msg}`;
      return msg;
    }
  }
  return String(err);
}
