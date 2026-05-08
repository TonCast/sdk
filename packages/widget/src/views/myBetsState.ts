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
  if (options.reset) return items.slice(0, max);
  // Deduplicate by bet ID before appending — guards against overlapping cursor
  // pages that an API bug or race condition could produce.
  const seen = new Set(previous.map((b) => b.id));
  const fresh = items.filter((b) => !seen.has(b.id));
  return [...previous, ...fresh].slice(0, max);
}
