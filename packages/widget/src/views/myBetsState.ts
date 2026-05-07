import type { Bet, Cursor } from "@toncast/sdk";

export const MAX_RENDERED_BETS = 200;

export function cursorKey(c: Cursor | null): string {
  return c === null ? "__initial__" : JSON.stringify(c);
}

export function appendBetsPage(
  previous: Bet[],
  items: Bet[],
  options: { reset: boolean; max?: number },
): Bet[] {
  const max = options.max ?? MAX_RENDERED_BETS;
  const next = options.reset ? items : [...previous, ...items];
  return next.slice(0, max);
}
