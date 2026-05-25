import { ToncastError } from "../errors";

/** On-chain ticket counts are uint32 — mirror tx-sdk limits before calling it. */
export const MAX_UINT32_TICKETS = 4_294_967_295;

/** Validates a ticket count before quote / tx-sdk calls. */
export function assertPositiveUint32TicketCount(count: number, field = "ticketsCount"): void {
  if (!Number.isInteger(count) || count <= 0) {
    throw new ToncastError(
      `${field} must be a positive integer, got ${count}`,
      "INVALID_TICKETS_COUNT",
    );
  }
  if (count > MAX_UINT32_TICKETS) {
    throw new ToncastError(
      `${field} must be at most ${MAX_UINT32_TICKETS}, got ${count}`,
      "INVALID_TICKETS_COUNT",
    );
  }
}
