# Toncast SDK — React demo

Live demo wiring `@toncast/sdk` + `@toncast/sdk-react` + `@tanstack/react-query` + `@tonconnect/ui-react` into a working app:

- Browse the **active paris feed** (live WS, auto-reconnect, polling fallback) — `useStreamList`
- Open a single pari — `useSubscribe` (live `pari` / `oddsState` / `coefficientHistory`)
- Connect your wallet (TonConnect) — auto-syncs into the SDK via `useTonConnectClient`
- **Place a bet in any wallet coin** — TON or any jetton with a STON.fi route. The picker filters by `viable` and slider clamps to per-coin `minBetTon` / `maxBetTon`. Quote re-runs on every change (`useBetQuote`); `useConfirmBet` re-simulates the swap and hands TonConnect-ready messages.

Stack: Vite 7 + React 19 + Tailwind 4 + Radix UI primitives (button / card / select / slider / tabs / badge), no `next/no Webpack`. ~10 components, fully type-safe.

## Run locally

From the repo root:

```bash
npm install
npm run build --workspace @toncast/sdk
npm run build --workspace @toncast/sdk-react
npm run dev --workspace @toncast/react-app-example
```

Optionally set a toncenter v2 API key (without it the public 1 req/sec limit slows USDT bets — the SDK retries through it):

```bash
echo 'VITE_TONCENTER_API_KEY=your-key' > examples/react-app/.env.local
```

## TonConnect manifest

When you run on `localhost` the demo points TonConnect at the real Toncast manifest (`https://toncast.me/tonconnect-manifest.json`) — wallet apps on phones can't reach your laptop's origin, so this is the only thing that lets the wallet picker work end-to-end.

When you deploy to a real domain it switches to `${origin}/tonconnect-manifest.json` automatically. **Edit `public/tonconnect-manifest.json` before deploying**:

```json
{
  "url": "https://your-domain.tld",
  "name": "Your App Name",
  "iconUrl": "https://your-domain.tld/icon.png"
}
```

The `url` MUST match the page origin (TonConnect rejects mismatches). `iconUrl` should be a square PNG ≥ 180×180.

## Where to look in the code

| Path | What |
|---|---|
| `src/providers.tsx` | `<TonConnectUIProvider>` → `<ToncastProvider>` → `<WalletSync>` (auto `client.userAddress`) |
| `src/pages/ParisList.tsx` | feed via `useStreamList({ feed: "active" })` |
| `src/pages/PariDetail.tsx` | live single pari via `useSubscribe(id)` |
| `src/components/BetCard.tsx` | full bet flow — `useBet` (composes summary stream, coin picker, quote, confirm) → `tc.sendTransaction` |

## Production deploy

```bash
npm run build --workspace @toncast/react-app-example
# → dist/ is a static SPA, drop into any CDN
```

Don't forget to edit `public/tonconnect-manifest.json` (see above) before pushing live.
