# Changelog

## 0.0.1 - Initial pre-release

- Added `ToncastClient` facade with `categories`, `paris`, `bets`, `coins`, and `betting` resources.
- Added REST reads for categories, paris, odds state, coefficient history, winners, and user bets.
- Added live pari list and per-pari streams with WebSocket reconnect, heartbeat, sequence dedup, gap recovery, and polling fallback.
- Added TON and jetton balance discovery through `TonClient` and toncenter v3 discovery.
- Added betting quote flow: `summary` / `priceCoins` / `quoteFixedBet` / `quoteLimitBet` / `quoteMarketBet` / `confirmQuote`.
- Added explicit financial risk acknowledgement before signable transactions are returned.
- Added typed errors: `ToncastError`, `ToncastApiError`, `ToncastRateLimitError`, `ToncastWsError`, and `ToncastValidationError`.
- Added injectable HTTP transport for tests, tracing, SSR adapters, and custom fetch policies.
- Added ESM/CJS builds through tsup and npm package exports.

> Pre-1.0.0: pin exact versions until the API reaches `1.0.0`.
