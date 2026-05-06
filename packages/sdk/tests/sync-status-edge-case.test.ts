// Verifies the SDK survives a backend DO-counter reset (storage cleanup after pari endTime).
// Pure-logic test of the syncStatus branch — no real WS / no async timers.

import { describe, expect, it } from "vitest";

/**
 * Reproduces the decision logic for `syncStatus` handling in PariStream / ParisListStream.
 * The streams themselves are too WS-heavy for unit isolation; this captures the rule
 * so any regression in the streams will diverge from this expectation.
 */
function decideSyncAction(
  msg: { type: "syncStatus"; isLatest: boolean; currentSequence?: number },
  state: { lastSequenceId: number | null; isReconnect: boolean },
): { refetch: boolean; resetLocalSeq: boolean } {
  // syncStatus on initial connect — loader data is fresh, do nothing.
  if (!state.isReconnect) return { refetch: false, resetLocalSeq: false };

  // Backend says we're behind → refetch.
  if (msg.isLatest === false) return { refetch: true, resetLocalSeq: false };

  // Backend says we're "latest" but doesn't echo currentSequence.
  // If we have a non-null local sequence, the only way this is consistent is if
  // the backend's counter wrapped/reset to 0 (lastSeen >= 0 always true).
  // Defensive: drop our state and refetch so future broadcasts won't be filtered.
  const counterMayHaveReset =
    msg.isLatest === true &&
    typeof msg.currentSequence !== "number" &&
    state.lastSequenceId !== null;

  return { refetch: counterMayHaveReset, resetLocalSeq: counterMayHaveReset };
}

describe("syncStatus decision logic", () => {
  it("first connect (not reconnect) — never refetches even with isLatest:false", () => {
    expect(
      decideSyncAction(
        { type: "syncStatus", isLatest: false, currentSequence: 168 },
        { lastSequenceId: null, isReconnect: false },
      ),
    ).toEqual({ refetch: false, resetLocalSeq: false });
  });

  it("reconnect + isLatest:false → refetch (no reset, currentSequence is authoritative)", () => {
    expect(
      decideSyncAction(
        { type: "syncStatus", isLatest: false, currentSequence: 200 },
        { lastSequenceId: 100, isReconnect: true },
      ),
    ).toEqual({ refetch: true, resetLocalSeq: false });
  });

  it("reconnect + isLatest:true + we never saw a seq → no refetch (truly nothing happened)", () => {
    expect(
      decideSyncAction(
        { type: "syncStatus", isLatest: true },
        { lastSequenceId: null, isReconnect: true },
      ),
    ).toEqual({ refetch: false, resetLocalSeq: false });
  });

  it("reconnect + isLatest:true + had a seq → counter reset suspected → refetch + reset", () => {
    // This is the DO-cleanup edge case: backend storage was wiped, counter is 0,
    // our lastSequenceId=50, server replies `50 >= 0` → isLatest:true (no currentSequence).
    expect(
      decideSyncAction(
        { type: "syncStatus", isLatest: true },
        { lastSequenceId: 50, isReconnect: true },
      ),
    ).toEqual({ refetch: true, resetLocalSeq: true });
  });

  it("reconnect + isLatest:true + currentSequence echoed → trusts the server, no refetch", () => {
    // Backend echoed currentSequence even with isLatest:true — explicit signal, trust it.
    expect(
      decideSyncAction(
        { type: "syncStatus", isLatest: true, currentSequence: 50 },
        { lastSequenceId: 50, isReconnect: true },
      ),
    ).toEqual({ refetch: false, resetLocalSeq: false });
  });
});
