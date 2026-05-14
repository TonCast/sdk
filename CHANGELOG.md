# Changelog

## 0.0.1 — Initial pre-release

> Not yet published to npm; this section is the cumulative **0.0.1** scope. Pin exact versions until `1.0.0`.

- Added `ToncastClient` facade with `categories`, `paris`, `bets`, `coins`, and `betting` resources.
- Added REST reads for categories, paris, odds state, coefficient history, winners, and user bets.
- Added live pari list and per-pari streams with WebSocket reconnect, heartbeat, sequence dedup, gap recovery, and polling fallback.
- Added TON and jetton balance discovery through `TonClient` and toncenter v3 discovery.
- Added betting quote flow: `summary` / `priceCoins` / `quoteFixedBet` / `quoteLimitBet` / `quoteMarketBet` / `confirmQuote`.
- Added explicit financial risk acknowledgement before signable transactions are returned.
- Added typed errors: `ToncastError`, `ToncastApiError`, `ToncastUnauthorizedError`, `ToncastNotFoundError`, `ToncastRateLimitError`, `ToncastWsError`, and `ToncastValidationError`.
- Added injectable HTTP transport for tests, tracing, SSR adapters, and custom fetch policies; re-exported `HttpTransport` types from the package root.
- Added ESM/CJS builds through tsup and conditional `exports` (`import` / `require` with `types`).
- Added `classifyBetFlowError` and `resolveBetSendErrorTranslationKey` in `@toncast/sdk` for confirm / wallet send failures (`toncast`, `wallet_user_rejected`, `wallet_failed`, `network`, `unknown`) plus stable `bet.sendError.*` key paths and a `technicalSummary` string for logging.
- `@toncast/widget`: localized `bet.sendError.*` inline alert with optional technical details, `console.error` (`[ToncastWidget] Bet send failed:`), **Close** (`bet.sendError.dismiss`) to clear the message.
- React demo (`examples/react-app`): same classification and i18n keys; wallet dismissal uses `toast.info`, other failures use `toast.error`; full detail is logged to the console.
- Added CLI example `packages/sdk/examples/02-list-categories.ts` (categories + filter chips).
- Validated `userAddress` in `03-my-bets.ts` via `parseTonAddress`.
- Relaxed USDT detection in `05-bet-on-behalf.ts` (case-insensitive symbol).
- `examples/widget-constructor`: declared `vitest` as a devDependency for reproducible test runs outside the monorepo root.
