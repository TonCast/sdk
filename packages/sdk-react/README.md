# @toncast/sdk-react

React hooks for [`@toncast/sdk`](../sdk) — built on top of [`@tanstack/react-query`](https://tanstack.com/query/latest). REST methods become `useQuery` queries.

**Two live-data paths:** WS-backed list and single-pari snapshots (`paris.streamList`, `paris.subscribe`) use `useLiveStreamQuery` (`useSyncExternalStore`) so post-initial errors and updates stay live without treating the stream as a one-shot promise. Observable-style resources such as `betting.subscribeSummary` use `useObservableQuery` (TanStack cache + forced per-emission renders). Pick the hook the SDK already exposes; only reach for the low-level adapters when composing custom streams.

Use **`toncastQueryKeys`** for every `prefetchQuery`, `setQueryData`, and targeted `invalidateQueries` so keys match the built-in hooks exactly (including `serializeKey` for params with `bigint`).

> **Status: 0.0.1 (pre–1.0.0).** Pin exact versions until `1.0.0`. See [CHANGELOG.md](../../CHANGELOG.md) and repository [`AGENTS.md`](../../AGENTS.md) for betting and address handling.

> Pattern lifted from [`@ston-fi/omniston-sdk-react`](https://github.com/ston-fi/omniston-sdk) — thin wrappers around TanStack Query, single Observable adapter for streaming endpoints.

The SDK layer does not sign transactions; hooks surface errors from the client — do not swallow `ToncastError` / `ToncastApiError` / `ToncastWsError` in production UIs.

## Install

```bash
npm install @toncast/sdk @toncast/sdk-react @tanstack/react-query
# Optional, only if you use TonConnect for wallet auth:
npm install @tonconnect/ui-react
```

Peer dependencies: `react ^18 || ^19`, `@tanstack/react-query ^5`.

## Quick start

```tsx
import { TonClient, ToncastClient } from "@toncast/sdk";
import { ToncastProvider, useStreamList } from "@toncast/sdk-react";

const tonClient = new TonClient({
  endpoint: "https://toncenter.com/api/v2/jsonRPC",
  apiKey: import.meta.env.VITE_TONCENTER_API_KEY,
});
const client = new ToncastClient({ tonClient });

function App() {
  return (
    <ToncastProvider client={client}>
      <ParisFeed />
    </ToncastProvider>
  );
}

function ParisFeed() {
  const { data, isLoading } = useStreamList({ feed: "active" });
  // `data` is the latest `Pari[]` snapshot (re-emitted on every WS update)
  if (isLoading) return <p>Loading…</p>;
  return data?.map((p) => <div key={p.id}>{p.name}</div>);
}
```

`<ToncastProvider>` creates an internal `QueryClient` automatically. Pass `queryClient={appQueryClient}` to share with an existing TanStack-Query app.

```tsx
import { toncastQueryKeys } from "@toncast/sdk-react";

// Prefetch must use the same builders as the hooks
void queryClient.prefetchQuery({
  queryKey: toncastQueryKeys.paris.detail(pariId),
  queryFn: ({ signal }) => client.paris.get(pariId, signal),
});
```

## Hooks

### Provider
- **`<ToncastProvider client={...} queryClient?={...}>`** — wires both clients into context.
- **`useToncastClient()`** — read the SDK client (throws outside a provider).

### High-level (recommended)
- **`useBet(params)`** — all-in-one hook for the full bet flow: summary stream, coin picker, quote, confirm. Returns `{ summary, coins, quote, confirm, side, mode, tickets, … }`. Use this unless you need fine-grained control.

### Read (REST → `useQuery`)
| Hook | Wraps | Notes |
|---|---|---|
| `useParis(params)` | `paris.list` | Single page (cursor-paginated). |
| `usePari(id)` | `paris.get` | Disabled when `id` is falsy. |
| `useBets(params)` | `bets.listForUser` / `listForPariByUser` | `pariId` optional → cross-pari history. |
| `useCategories()` | `categories.list` | Raw `{ id, title }` categories, `staleTime: Infinity`. |
| `useCategoryFilters()` | `categories.listFilters` | UI-ready chips whose `param` goes into `useStreamList`. |
| `useCoins(opts)` | `coins.list` | TON + jettons via toncenter v3. Requires `tonClient`. |
| `useBetQuote(params \| null)` | `betting.quoteFixedBet/quoteLimitBet/quoteMarketBet` | Auto re-quotes on params change. |

Pass any TanStack `UseQueryOptions` (`enabled`, `staleTime`, `select`, `refetchInterval`, …) as a second arg to any read hook.

### Live (`useSyncExternalStore`)
- **`useStreamList(params)`** — wraps `paris.streamList`. `data` is the latest `Pari[]` snapshot; updates on every WS broadcast (`pari_created`, `coefficient_update`, `volume_update`, `pari_paused`, `pari_result_set`). Returns live `{ data, status, error, isLoading, isError, isSuccess, refetch }`.
- **`useSubscribe(pariId)`** — wraps `paris.subscribe`. `data` is the latest `PariStreamSnapshot` (`{ pari, oddsState, coefficientHistory }`). Returns the same live state shape as `useStreamList`.
- **`useBetSummary(pariId)`** — wraps `betting.subscribeSummary`. Emits two phases: TON-only (~200 ms) then full jetton pricing (STON.fi, warm: instant / cold: 3–8 s). Uses `useObservableQuery` internally, not a simple `useQuery`.

### Mutations
- **`useConfirmBet()`** — TanStack `useMutation` for `betting.confirmQuote`. Trigger right before signing and pass acknowledged params: `mutateAsync({ quote, params: { ...quoteParams, financialRiskAcknowledged: true } })`.

### TonConnect bridge (optional peer-dep)
- **`useTonConnectClient(userAddress)`** — mirrors any wallet-bridge address into `client.userAddress`. With `@tonconnect/ui-react`:

```tsx
import { useTonAddress } from "@tonconnect/ui-react";
function WalletSync() {
  useTonConnectClient(useTonAddress()); // "" when disconnected
  return null;
}
```

### Custom Observables
If you build your own Observable on top of the SDK (e.g. transformed `paris.streamList`), wrap it via the low-level adapter:

- **`useObservableQuery({ queryKey, requestFn })`** — same shape as `useQuery`, but `requestFn` returns a `Subscribable<T>` (anything with `subscribe(observer)`). Each `next()` updates `data` and forces a re-render via `useSyncExternalStore` (so you don't lose intermediate values to TanStack's microtask batching).

## End-to-end bet flow

The simplest approach — use `useBet`, which composes summary, quote, and confirm into one ergonomic API:

```tsx
import { useBet } from "@toncast/sdk-react";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";

function BetCard({ pariId }: { pariId: string }) {
  const userAddress = useTonAddress();
  const [tc] = useTonConnectUI();
  const bet = useBet({ pariId: userAddress ? pariId : null, defaultSide: "yes" });

  return (
    <button
      disabled={!bet.quote.isFeasible || bet.confirm.isPending}
      onClick={async () => {
        const confirmed = await bet.confirmCurrent({ financialRiskAcknowledged: true });
        if (!confirmed) return;
        await tc.sendTransaction({
          messages: confirmed.messages,
          validUntil: Math.floor(Date.now() / 1000) + 5 * 60,
        });
      }}
    >
      Bet {bet.side.toUpperCase()}
    </button>
  );
}
```

For advanced use-cases (custom UI, partial control) you can compose the lower-level hooks directly — `useBetSummary` → `useBetQuote` → `useConfirmBet`. See the example app's `BetCard.tsx` for a full reference implementation using `useBet`.

## License

MIT — see [`LICENSE`](../../LICENSE).
