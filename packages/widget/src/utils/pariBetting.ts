import type { Pari } from "@toncast/sdk";

export function isSettledOutcome(pari: Pari): boolean {
  const r = pari.result.trim().toLowerCase();
  return r === "yes" || r === "no" || r === "draw";
}

/**
 * True when placing a new bet is no longer possible:
 * - the outcome is already settled (yes / no / draw), OR
 * - the pari is inactive (awaiting oracle, cancelled, etc.), OR
 * - the betting window has closed (`endTime` is in the past).
 */
export function isBettingClosed(pari: Pari, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (isSettledOutcome(pari)) return true;
  if (pari.status === "inactive") return true;
  if (pari.endTime > 0 && pari.endTime <= nowSec) return true;
  return false;
}
