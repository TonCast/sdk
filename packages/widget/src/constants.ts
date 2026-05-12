/**
 * Centralised tunables — keep magic numbers out of components/views so they're
 * easy to audit and adjust.
 */

/** Bet TX `validUntil` window — 5 minutes ahead of `Date.now()`. */
export const BET_TX_VALID_FOR_SECONDS = 5 * 60;

/** Delay (ms) after a successful bet before refetching paris/bets queries. */
export const BET_REFRESH_DELAY_MS = 8_000;

/** Periodic re-render tick used by countdown/PariCard to refresh "time left". */
export const MINUTE_TICK_MS = 60_000;

/** Truncation length for the pari description preview shown in the detail view. */
export const DESCRIPTION_PREVIEW_CHARS = 160;

/** Maximum allowed `--tc-radius` value (px) for the constructor + theme inputs. */
export const RADIUS_MAX = 64;

/** Default `--tc-radius` (px) when omitted or when a non-finite radius is coerced. */
export const RADIUS_DEFAULT = 12;
