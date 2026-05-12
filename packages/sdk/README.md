# @toncast/sdk

Universal, transport-agnostic SDK for the Toncast prediction-market protocol. Reads paris (markets), categories, bets, and **builds** ready-to-sign bet transactions via [`@toncast/tx-sdk`](https://github.com/TonCast/tx-sdk) (TON or any jetton routed through STON.fi). The integrator hands the prepared transactions to whichever wallet bridge they use — TonConnect, custom signer, server-side wallet, anything.

> **Status: 0.0.1 · pre-release.** Public REST + WebSocket surfaces are wired against the live API. A browser-side widget (with TonConnect built in) is planned separately.

---

## Scope

- **`categories`** — raw list (`{ id, title }`) plus UI-ready filters
- **`paris`** — list (`active` / `finished` / `pending` feeds, cursor pagination), get, oddsState, coefficient history, winners
- **`paris.streamList`** — live, paginated, self-managing list of paris (WS broadcast + automatic polling fallback, sequenceId dedup, gap recovery, `pari_created` localization — all internal)
- **`bets`** — list by pari, list by user (cursor pagination)
- **`coins`** — TON + jetton balances of a wallet via `TonClient`
- **`betting`** — `priceCoins` → `quoteFixed/Limit/MarketBet` → `confirmQuote` → ready-to-sign messages, plus `summary(pariId)` for UI sliders. **`confirmQuote` is required before every send. The SDK does not sign or send.**
- **`paris.subscribe(pariId)`** — live, self-managing view of one pari (initial fetch + per-pari WS + polling fallback). Surfaces snapshots of `Pari` / `OddsState` / `CoefficientHistoryPoint[]` and one-shot `BetEvent`s.

## Install

```bash
npm install @toncast/sdk
```

`@toncast/tx-sdk`, `@ton/ton`, `@ston-fi/api`, `@ston-fi/sdk` are pulled in automatically as hard dependencies — no betting flow works without them.

The SDK is wallet-bridge-agnostic: it produces transaction payloads in two ready-to-use shapes (`TxParams[]` and `TonConnectMessage[]`). Whatever signs them — `@tonconnect/sdk`, `@tonconnect/ui`, a server-side wallet, anything — is not the SDK's concern.

## Quick start

A few terms used below:
- **Pari** — a single prediction market (e.g. *"Will ETH be above $2,500 on April 25?"*). YES wins if the answer is true, NO if false.
- **Tickets** — units bet on a side. Each YES ticket costs `yesOdds / 1000` TON (i.e. `yesOdds × 0.001 TON`); each NO ticket costs `(100 − yesOdds) / 1000` TON. Use `ticketCost(yesOdds, isYes)` from `@toncast/tx-sdk` for exact bigint values.
- **`yesOdds`** — integer 2..98 (even). Reflects the implied YES probability in percent (so `60` ≈ 60 % chance). Lower `yesOdds` = cheaper YES tickets.
- **`isYes`** — which side you're betting on.
- **TON amounts** are bigints in **nano-TON** (1 TON = `1_000_000_000n`).

Realistic flow: read paris first (no wallet), then set the user address once it's known — from a TonConnect-bound wallet, an env var on a server, anywhere.

```ts
import { TON_ADDRESS, TonClient, ToncastClient } from "@toncast/sdk";

// === Phase 1 — public reads, no wallet needed ===

// RPC client for on-chain reads (jetton balances, STON.fi route discovery)
const tonClient = new TonClient({
  endpoint: "https://toncenter.com/api/v2/jsonRPC",
});

const client = new ToncastClient({
  tonClient,                                                       // required for betting
  // referral is OPTIONAL — set it once and every bet attributes a share to your wallet.
  referral: { address: "UQMyIntegratorWallet…", pct: 5 },          // 0..7
  // userAddress is OPTIONAL here — set it later, when the wallet is known.
  // prefetch defaults to false: construction does not touch the network.
});

// `coins.list()` discovers TON + every jetton the user holds — zero config.
// If `tonClient` points at toncenter, the SDK automatically uses toncenter v3
// (`…/api/v3/jetton/wallets`) with the same API key. Otherwise (or on failure)
// it falls back to public `https://tonapi.io` — no key required.

// 1. Browse paris
const page = await client.paris.list({ limit: 20 });
const pari = page.items[0];                  // Pari shape — see "Reading data"

// === Phase 2 — user wallet is known (TonConnect connected, server-side signer, etc.) ===

// `userAddress` is whatever your wallet bridge gives you (TonConnect: connector.account.address;
// server signer: an address from your config). The SDK only stores it — never asks for a private key.
client.setUserAddress(userAddress);

// 2. Read pari info + odds + user's funding options in ONE call.
//    Internally runs `paris.get`, `paris.getOddsState`, and `priceCoins` in
//    parallel; `priceCoins` itself fetches `coins.list` + STON.fi simulations.
const summary = await client.betting.summary(pari.id);

// summary.capacities — every coin in the user's wallet annotated with viability.
// Use this for a coin-picker UI (skip `!feasible` rows = dust).
//
// summary.capacities ≈ [
//   { source: { address: TON_ADDRESS, amount: 1_597_450_000_000n },
//     feasible: true,  route: "direct", minBetTon: 102_000_000n, maxBetTon: 1_597_450_000_000n },
//   { source: { address: USDT_MASTER, symbol: "USDT", decimals: 6, amount: 100_000_000n },
//     feasible: true,  route: "direct", minBetTon: 102_000_000n, maxBetTon: 99_500_000_000n },
//   { source: { address: SOMETOKEN,    symbol: "DUST", amount: 5n },
//     feasible: false, reason: "tonEquivalent ≤ gasReserve", ... },
// ]
// Pick the funding source. Defaults to TON; swap the predicate to use a jetton:
//   const usdt = summary.capacities.find((c) => c.source.symbol === "USDT" && c.feasible);
//   const picked = usdt ?? summary.capacities.find((c) => c.source.address === TON_ADDRESS && c.feasible);
const picked = summary.capacities.find((c) => c.source.address === TON_ADDRESS && c.feasible);
if (!picked) throw new Error("no viable funding source");

// 3. Build a market bet on YES (spends greedily on best counter-side liquidity).
//    `maxBudgetTon` is always in TON — the SDK converts to source units (jettons swap via STON.fi).
//    Bound it by the picker's capacity to avoid `insufficient_balance`:
//      picked.minBetTon ≤ maxBudgetTon ≤ picked.maxBetTon
const maxBudgetTon =
  picked.maxBetTon < 5_000_000_000n ? picked.maxBetTon : 5_000_000_000n;   // 5 TON cap, or whatever fits

const quoteParams = {
  pariId: pari.id,
  isYes: true,                                  // YES side; flip to false for NO
  maxBudgetTon,
  source: picked.source.address,                // TON_ADDRESS or a jetton master address

  // Pricing context. Optional — the SDK fetches them itself if omitted, but
  // reusing what summary already loaded saves two HTTP round-trips.
  pricedCoins: summary.pricedCoins,             // TON valuations of every wallet coin
  oddsState: summary.oddsState,                 // current order book on this pari
  financialRiskAcknowledged: true,              // required before signable txs are returned
};

const quote = await client.betting.quoteMarketBet(quoteParams);

// `quote` already contains everything the UI needs. Re-call `quoteMarketBet`
// on every slider tick — it's CPU-only for TON, and a linear extrapolation
// from the cached pricedCoins for jettons (no network).
//
// quote ≈ {
//   mode: "market",
//   isYes: true,
//   totalCost: 4_952_000_000n,                // exact TON the bet consumes on Pari
//   bets: [
//     { yesOdds: 60, ticketsCount: 42 },     // 42 YES tickets at implied 60 %
//     { yesOdds: 62, ticketsCount: 36 },     // 36 YES tickets at implied 62 %
//   ],
//   breakdown: { matched: [...], placement: [...], unmatched: ... },
//   option: {
//     feasible: true,                        // false → render error from `option.reason`
//     estimated: true,                       // true until confirmQuote runs (jetton); ignore for TON
//     source: { address, symbol?, decimals? },
//     breakdown: { spend: bigint, gas: bigint }, // `spend` in source units (UI: "Total"),
//                                                // `gas` in TON (UI: "Swap fee")
//     warnings?: ["insufficient_balance …"], // only when allowInsufficientBalance: true
//   },
//   lockedInRate: { ... } | null,
// }
//
// What the UI reads:
//   Total in source units   → quote.option.breakdown.spend (format with picked.source.decimals)
//   Total in TON            → quote.totalCost
//   Swap fee                → quote.option.breakdown.gas (TON; 0 for TON sources)
//   Win if side wins        → sum(quote.bets, b => BigInt(b.ticketsCount) * 100_000_000n)  // 0.1 TON / ticket
//   Bet items breakdown     → quote.bets ("you'll buy 42 tickets at 60, 36 at 62 …")
//   Disable Place Bet       → !quote.option.feasible

// 4. User clicks "Place Bet" → REQUIRED re-simulation + tx build.
//    Pass the acknowledged params so the SDK can return signable transactions.
const confirmed = await client.betting.confirmQuote(quote, quoteParams);

// confirmed ≈ {
//   quote:    /* same shape as above, option.estimated === false now */,
//   txs:      [ { to: <Address>, value: 5_152_000_000n, body: <Cell> } ],          // raw tx-sdk
//   messages: [ { address: "EQA…", amount: "5152000000", payload: "te6ccgEBAg…" } ], // TonConnect
// }

// 5. Hand off to your wallet bridge of choice. The SDK does not sign or send.
//    e.g. confirmed.messages → @tonconnect/sdk; confirmed.txs → server-side signer.
```

See the [Reading data](#reading-data) and [Preparing a bet](#preparing-a-bet) sections for the full surface.

## Reading data

```ts
// Categories — raw domain data, cached forever per language
const categories = await client.categories.list();        // Array<{ id: number; title: string }>
const filters = await client.categories.listFilters();    // Array<{ name: string; param: StreamListParams }>

// Paris — three feeds, free-text search, category filter
const active = await client.paris.list({ categoryId: 3, limit: 20 });
const finished = await client.paris.list({ feed: "finished" });           // resolved markets
const pending = await client.paris.list({ feed: "pending" });             // ended, awaiting oracle
const search = await client.paris.list({ search: "ETH price" });

// Single pari + sub-resources
const pari = await client.paris.get(pariId);
const odds = await client.paris.getOddsState(pariId);                     // tx-sdk-compatible OddsState
const history = await client.paris.getCoefficientHistory(pariId, { timeframe: "ALL" });
const winners = await client.paris.getWinners(pariId);                    // empty until resolved

// User bets — across all paris, or for one pari
const userBets = await client.bets.listForUser({ pageSize: 20 });
for await (const b of client.bets.iterateForUser()) console.log(b);
const onPari = await client.bets.listForPariByUser({ pariId, pageSize: 15 });

// Wallet balances (TON + known jettons) — used by `betting.summary` and `priceCoins`
const myCoins = await client.coins.list();
```

## Live updates — `paris.streamList`

Self-managing live list of paris. The integrator only sees `Pari[]` snapshots — the SDK handles the WS connection, ping/pong, sequence dedup, gap detection, reconnect, polling fallback, and `pari_created` localization. Same `Pari` shape as `paris.list`.

```ts
const stream = client.paris.streamList({
  feed: "active",        // "active" (default) | "finished" | "pending"
  categoryId: 3,         // optional
  search: undefined,     // if set → polling-only mode (broadcast doesn't carry search-filtered events)
  pageSize: 20,          // default 20
  // pollIntervalMs: 5000  — fallback poll tick (default 5000)
});

// Subscribe to snapshot updates. Listener fires immediately with current state,
// then on every change (pari_created, coefficient/volume update, paused/resolved,
// initial fetch, gap recovery).
const unsub = stream.onSnapshot((paris) => {
  setUiState(paris);
});

// Status: "loading" | "live" | "polling" | "stopped"
stream.onStatus((s) => console.log("WS status:", s));

// Pagination
await stream.loadMore();
stream.hasMore;

// Synchronous read of current state (no listener)
stream.snapshot();

// Tear down — closes WS, stops polling. `dispose()` is an explicit alias.
stream.dispose();
```

**What the SDK does internally** (so the integrator doesn't have to):

- Initial `paris.list` fetch + connect to `wss://toncast.me/ws/pari-list`
- On open: sends `checkSync({lastSeen})`. If server replies `isLatest: false` → re-fetches first page (transparent).
- Ping every 5 s, 2 missed pongs → reconnect (matches the production frontend's watchdog).
- Sequence dedup: `seq <= last` skipped, `seq > last + 1` triggers a refetch.
- On every broadcast: applies the right delta to internal state (coefficient, volume, paused/resolved, new pari) and emits a fresh snapshot.
- `pari_created` carries every translation (`name_en`, `name_ru`, …); SDK picks the one matching `client.getLanguage()`.
- 3 failed reconnects → starts HTTP polling every 5 s while still trying to reconnect in the background. Status flips to `"polling"`.
- When `search` is set, polling-only mode (broadcast doesn't translate search filters).

## Live updates — `paris.subscribe(pariId)`

Self-managing view of a single pari. Initial parallel fetch (`paris.get` + `getOddsState` + `getCoefficientHistory`), then per-pari WS at `wss://toncast.me/ws/<pariId>` pushes incremental updates. Same ping/pong watchdog, sequenceId dedup, gap recovery, and polling fallback as `streamList`.

```ts
const stream = client.paris.subscribe(pariId, {
  // Initial coefficient-history fetch params (default: limit=100, timeframe="ALL")
  // coefficientHistory: { limit: 500, timeframe: "1D" },
  // pollIntervalMs: 5000,
});

// Reactive snapshots — re-emit on change (initial + every relevant broadcast)
stream.onPari((pari) => setPari(pari));               // status / result / yesVolume / noVolume
stream.onOddsState((odds) => setOdds(odds));          // current order book
stream.onCoefficientHistory((points) => setHistory(points));

// One-shot events
stream.onBetEvent((event) => {
  // event: { newBets: [...], matchedPairs: [...], timestamp }
  // Filter newBets by userAddress to detect "my new bet" if needed.
});

stream.onStatus((s) => {});   // "loading" | "live" | "polling" | "stopped"
stream.snapshot();             // { pari, oddsState, coefficientHistory } sync read
stream.dispose();
```

**Per-broadcast effect** (all internal):

| Event | Effect |
|---|---|
| `pari_updated` | `pari.yesVolume += fromNano(deltaYes)` (delta arrives in nanotons; SDK converts via `@ton/core`'s `fromNano`) |
| `pari_result_set` | `pari.status = "inactive"`, `pari.result = …` |
| `pari_paused` | `pari.status = "paused"` |
| `bet_placed_with_odds` | `oddsState` replaced; `onBetEvent` fires with `newBets` + `matchedPairs` |
| `coefficient_changed` | new point appended to `coefficientHistory` (broadcast `timestamp` is in ms; converted to seconds to match the existing history shape) |
| `comment_added` | silently ignored — comments will land in a later iteration |

Reconnect-aware sync: on the **first** open the loader data is fresh, so `syncStatus.isLatest === false` is treated as "we're starting from scratch". On a **reconnect** the same `isLatest === false` triggers a transparent re-fetch (we may have missed events while the socket was down).

## Client lifecycle and defaults

`new ToncastClient()` is intentionally pure by default: it does not prefetch categories, wallet coins, or STON.fi markets. Opt in deliberately:

```ts
const client = new ToncastClient({
  tonClient,
  prefetch: { categories: true, coins: false, swapMarkets: false },
  requestTimeoutMs: 15_000,      // default
  streamIdleTimeoutMs: 30_000,   // 0 = stop immediately, false = advanced/manual lifetime
});
```

Every `streamList` / `subscribe` consumer is ref-counted. Unsubscribing the last `onSnapshot`, `onPari`, `onOddsState`, `onCoefficientHistory`, `onBetEvent`, or `onStatus` listener schedules idle cleanup; React hooks only unsubscribe, the SDK owns socket/polling teardown. For long-lived Node processes, route transitions, tests, or widget unmounts, call:

```ts
client.paris.dispose();  // all pari/list streams + shared list socket
client.dispose();        // all SDK-owned live resources and listeners
```

## Preparing a bet

The SDK builds a ready-to-sign transaction; **you** sign and send it.

### Three roles in every bet

| Role | Field | Default | Notes |
|---|---|---|---|
| **Signer** (funds & signs) | `senderAddress` | `client.userAddress` | The wallet that pays gas + jetton/TON. For jetton sources, STON.fi derives the source jetton-wallet from this address — wrong value means the swap fails on the first hop. |
| **Beneficiary** (owns tickets, receives payout) | `beneficiary` | `senderAddress` (= self-bet) | The on-chain owner of the placed tickets. |
| **Referral** (earns `referralPct` of winnings) | `referral` + `referralPct` | `client.referral` (SDK-level option) | Per-bet override is supported — useful when a specific partner brought this user in and the integrator wants to attribute *this* bet to them, not to the default integrator wallet. Pass `referral: null` to opt out for one bet. |

### Coins, viability, and the dust filter

The SDK reads the user's TON + jetton balances via `coins.list()`, then `tx-sdk`'s `priceCoins` annotates each one with a TON valuation and a **`viable`** flag.

**`viable: false`** means the swap cost (gas) alone is bigger than the TON the coin can deliver — i.e. dust. Such a coin is unusable as a `source`. **Always filter by `viable` before passing a jetton as `source`** — `tx-sdk` will refuse the bet otherwise (`source_not_viable`).

A `PricedCoin` also carries `route` (`"direct" | { intermediate } | null`), `tonEquivalent` (pessimistic TON delivery, slippage-adjusted), `tonEquivalentExpected` (optimistic), and `reason` when not viable. `betting.summary(pariId)` exposes the same data + per-coin `minBetTon`/`maxBetTon` capacities, ready for UI sliders.

> **Every bet has three implicit roles** — see the table above. The simple examples below rely on the defaults (signer = beneficiary = `client.userAddress`, referral = SDK-level option). Override any of them per call by passing `senderAddress` / `beneficiary` / `referral` + `referralPct`.

### Two paths: TON-direct (sync) vs Jetton-funded (async)

The cost of preparing a bet depends entirely on the **source**. TON bets are sync, in-memory, no network beyond a single `getOddsState` read; jetton bets need STON.fi swap simulation and a confirmation pass.

**A) TON path — fully synchronous, no STON.fi:**

```ts
import {
  buildTonBetTx,
  computeMarketBets,        // also computeFixedBets / computeLimitBets
  ToncastClient,
  type TxParams,
} from "@toncast/sdk";

// 1. Single REST read (cheap)
const oddsState = await client.paris.getOddsState(pari.id);

// 2. Pure-CPU strategy — pick how many tickets to buy at which odds
const result = computeMarketBets({ oddsState, isYes: true, maxBudgetTon: 1_000_000_000n });
if (!result.feasible) throw new Error(result.reason);
// result.totalCost is the EXACT amount the wallet sends (stake + executionFee × N entries)

// 3. Build the TON-direct tx — no swap, no proxy, message goes straight to Pari
const tx: TxParams = buildTonBetTx({
  pariAddress: pari.id,
  beneficiary: userAddress,
  isYes: true,
  bets: result.bets,
  referral: null,
  referralPct: 0,
});

// 4. Hand to your wallet bridge
const message = {
  address: tx.to.toString(),
  amount: tx.value.toString(),                  // === result.totalCost
  payload: tx.body?.toBoc().toString("base64"),
};
```

That's the whole TON flow. **No `quote → confirmQuote` cycle needed** — it's deterministic, the wallet's "Sent" line matches `totalCost` byte-for-byte.

**B) Jetton path — async, STON.fi-backed:**

```ts
const quote = await client.betting.quoteMarketBet({
  pariId: pari.id,
  isYes: true,
  source: USDT_MASTER,                         // jetton master address
  maxBudgetTon,                                 // TON-equivalent budget
  pricedCoins: summary.pricedCoins,             // from priceCoins()
  oddsState: summary.oddsState,
  financialRiskAcknowledged: true,
});
if (!quote.option.feasible) throw new Error(quote.option.reason);

// `confirmQuote` re-simulates STON.fi at the current rate (catches slippage drift)
// and rebuilds the tx. Required for jettons, never skip.
const confirmed = await client.betting.confirmQuote(quote, {
  pariId: pari.id,
  isYes: true,
  source: USDT_MASTER,
  maxBudgetTon,
  pricedCoins: summary.pricedCoins,
  oddsState: summary.oddsState,
  financialRiskAcknowledged: true,
});
const messages = confirmed.messages;            // ready for connector.sendTransaction
```

**Why the difference?** TON is the platform's native unit — Pari accepts it directly (`buildTonBetTx` writes the `BatchPlaceBetsForWithRef` opcode). Jetton bets transit jetton-wallet → STON.fi router → swap → forward to Pari, with rates that drift second to second; the confirm pass catches that drift before the user signs.

> **iOS hint:** the jetton path makes async network calls (`quoteXxx`, `confirmQuote`) before `sendTransaction`. If you're using `@tonconnect/ui` from a Safari WebView, pass `{ skipRedirectToWallet: 'ios' }` to `sendTransaction` — otherwise iOS may close the WebView before the wallet bridge picks up the request.

`betting.summary(pariId)` reads pari + odds + balances in parallel; pass `pricedCoins` / `oddsState` back to `quote*` (or to `computeMarketBets` directly) to skip the re-fetch. Re-quoting on every slider tick is cheap.

> **Address resolution + risk acknowledgement**: `confirmQuote` can re-use params from the `quote*` call that produced `quote`, but production code should pass the acknowledged params explicitly: `confirmQuote(quote, { ...quoteParams, financialRiskAcknowledged: true })`. The SDK refuses to return signable transactions without that acknowledgement.

### Market mode — most common UI flow

User picks a side and a budget; SDK spends greedily on the best counter-side liquidity, parks the residual on the cheapest matched odds.

```ts
import { TON_ADDRESS } from "@toncast/sdk";

const summary = await client.betting.summary(pariId);

const quoteParams = {
  pariId,
  isYes: true,
  maxBudgetTon: 5_000_000_000n,   // 5 TON in nano
  source: TON_ADDRESS,
  pricedCoins: summary.pricedCoins,
  oddsState: summary.oddsState,

  // Role defaults (uncomment any to override):
  // senderAddress: agentSignerWallet,         // who signs/funds. Default: client.userAddress
  // beneficiary:   recipientWallet,           // who owns the tickets. Default: senderAddress (= self-bet)
  // referral:      partnerWallet,             // per-bet attribution. Default: client.referral
  // referralPct:   5,                         // 0..7. Default: client.referral.pct
  financialRiskAcknowledged: true,
};

const quote = await client.betting.quoteMarketBet(quoteParams);

// Required before signing — re-simulates the swap, verifies the quote, returns
// { quote, txs, messages } ready for the wallet bridge. Auto-uses the params
// captured at quote-time, but pass the acknowledged params explicitly.
const confirmed = await client.betting.confirmQuote(quote, quoteParams);
//   confirmed.messages — TonConnect-shaped
//   confirmed.txs      — raw tx-sdk TxParams[]
```

### Limit mode

Match available counter-side up to `worstYesOdds`, place the remainder as a new limit at `worstYesOdds`.

```ts
import { TON_ADDRESS } from "@toncast/sdk";

const quoteParams = {
  pariId,
  isYes: true,
  worstYesOdds: 56,    // 2..98, even
  ticketsCount: 300,
  source: TON_ADDRESS,
  financialRiskAcknowledged: true,
  // senderAddress, beneficiary, referral, referralPct — same overrides as market mode
};

const quote = await client.betting.quoteLimitBet(quoteParams);
const confirmed = await client.betting.confirmQuote(quote, quoteParams);
```

### Fixed mode

One specific `yesOdds`, one `ticketsCount`. Ignores current liquidity.

```ts
import { TON_ADDRESS } from "@toncast/sdk";

const quoteParams = {
  pariId,
  isYes: true,
  yesOdds: 56,
  ticketsCount: 10,
  source: TON_ADDRESS,
  financialRiskAcknowledged: true,
  // senderAddress, beneficiary, referral, referralPct
};

const quote = await client.betting.quoteFixedBet(quoteParams);
const confirmed = await client.betting.confirmQuote(quote, quoteParams);
```

### All three addresses overridden + jetton source

Concierge / partner-attribution flow.

```ts
// Get the user's coins + viability in one call
const summary = await client.betting.summary(pariId);

// Pick a viable jetton source (filters dust by inspecting `feasible`)
const usdt = summary.capacities.find((c) => c.source.symbol === "USDT" && c.feasible);
if (!usdt) throw new Error("user has no viable USDT balance");

const quoteParams = {
  pariId,
  isYes: true,
  maxBudgetTon: 5_000_000_000n,
  source: usdt.source.address,
  pricedCoins: summary.pricedCoins,
  oddsState: summary.oddsState,

  // 1. Signer: funds + signs. Defaults to client.userAddress.
  //    For jetton sources, STON.fi derives the source jetton-wallet from this address.
  senderAddress: agentSignerWallet,

  // 2. Beneficiary: who owns the resulting tickets (and receives the payout).
  beneficiary: recipientWallet,

  // 3. Referral: pass `referral: null` to skip referral for one bet.
  referral: partnerWallet,
  referralPct: 5, // 0..7, validated on-chain as uint3
  financialRiskAcknowledged: true,
};

const quote = await client.betting.quoteMarketBet(quoteParams);

// Required for jetton sources — re-simulates the STON.fi route right before signing.
// Address resolution is auto-tracked from the quote call.
const confirmed = await client.betting.confirmQuote(quote, quoteParams);
// Sign confirmed.messages (TonConnect) or confirmed.txs (raw) — the SDK does not.
```

See `examples/05-bet-on-behalf.ts` for a runnable end-to-end version.

## User wallet address

Three levels of override:

1. **Constructor** — `new ToncastClient({ userAddress })`.
2. **Runtime swap** — `client.setUserAddress(addr)` / `clearUserAddress()`.
3. **Per-call** — `client.bets.listForUser({ userAddress: other })`.

Personal methods (`bets.listForUser`, `coins.list`, `betting.*`) throw `ToncastError("USER_ADDRESS_REQUIRED")` if not set anywhere.

## Languages

`Accept-Language` is sent on every HTTP request. Supported: `en`, `ru`, `hi`, `es`, `zh`, `fr`, `de`, `pt`, `fa`, `ar`.

Resolution order:

1. **Explicit `language` option** — if provided, always wins. Unsupported tag → falls back to `en` (NOT to `navigator.language`).
2. **`navigator.language`** / `navigator.languages` — only when no explicit option is set (browser).
3. Otherwise **`en`**.

```ts
const client = new ToncastClient({ language: "ru-RU" });   // → "ru"
client.setLanguage("zh-Hans-CN");                          // → "zh"
client.setLanguage("ja");                                   // → "en" (unsupported, navigator ignored)
```

`client.categories.list()` is cached **forever per language** (switching languages fetches the new translation once and keeps both warm). `client.categories.clearCache()` drops entries.

## Pagination

Cursor-based with object cursors. Pass `nextCursor` back as-is.

```ts
let page = await client.paris.list({ feed: "finished", limit: 20 });
while (page.hasMore && page.nextCursor) {
  page = await client.paris.list({ feed: "finished", cursor: page.nextCursor });
}

// Async iterator — handles cursor for you
for await (const pari of client.paris.iterate({ feed: "finished" })) { /* ... */ }
```

`/v1/paris` cursor: `{sortValue, address}` → split into `cursorSortValue` + `cursorAddress`.
`/v1/bets/...` cursor: `{createdAt, id}` → JSON-encoded as `cursor`.

## Architecture

```
src/
├── client/ToncastClient.ts       facade · userAddress / language / referral state
├── http/HttpClient.ts            fetch + retry + zod validation + Accept-Language
├── ws/
│   ├── WsClient.ts               reconnect + heartbeat (ping/pong watchdog)
│   ├── pari-list-protocol.ts     wire types + localisePariCreated
│   └── pari-protocol.ts          per-pari wire types (BetEvent, etc.)
├── resources/
│   ├── categories.ts             cached per language
│   ├── paris.ts                  list / get / oddsState / coefficientHistory / winners + streamList + subscribe
│   ├── paris-stream.ts           ParisListStream (WS + polling fallback + state)
│   ├── pari-stream.ts            PariStream (per-pari WS + polling fallback + state)
│   ├── bets.ts                   listForPariByUser / listForUser
│   └── coins.ts                  TON + jetton balances via TonClient
├── betting/placeBet.ts           wraps @toncast/tx-sdk (priceCoins → quote → confirmQuote → toTonConnectMessages)
├── wallet/                       createTonClient · auto-routed jetton discovery (toncenter v3 → tonapi.io)
├── i18n/languages.ts             SUPPORTED_LANGUAGES + resolveLanguage
├── types/                        zod-backed DTOs
└── errors.ts                     ToncastError / ApiError / WsError / ValidationError
```

## Pending

- **Comments resource** — `comment_added` broadcast is recognised but currently silently ignored (no Comment type, no `comments.list` endpoint). Coming in a later iteration.
- **`/v1/paris/:id`** confirmation that the response shape matches the list-item shape (it does in practice; types reflect that, but flagged for safety).

## Advanced: jetton discovery override

For 99% of integrations no config is needed — pass the standard toncenter `tonClient` (the one everyone uses) and `coins.list()` discovers every jetton the wallet owns:

```ts
const tonClient = new TonClient({
  endpoint: "https://toncenter.com/api/v2/jsonRPC",
  apiKey: process.env.TONCENTER_API_KEY,
});
const client = new ToncastClient({ tonClient });
// Done. Missing `decimals` are filled per TEP-74 (default 9) so output is
// consistent regardless of whether the jetton master publishes the field.
```

> Implementation note: the SDK reads jettons from toncenter's index endpoint
> (`…/api/v3/jetton/wallets`), auto-derived from your v2 RPC URL with the same
> API key. Both v2 and v3 live under `https://toncenter.com` — you only configure
> v2 (the RPC), the SDK figures out v3 internally.

Skip the rest unless you have a private toncenter gateway, a paid plan with a different URL, or your `tonClient` is pointed at a non-toncenter RPC (custom node, etc.) and you still want jetton discovery.

**Same host, custom credentials** — minimal override, e.g. paid plan:

```ts
const client = new ToncastClient({
  tonClient,                                            // v2 RPC: public toncenter
  jettonDiscovery: {
    toncenter: {
      endpoint: "https://toncenter.com/api/v3",         // same host, just v3
      apiKey: process.env.TONCENTER_PAID_KEY,           // separate paid key
    },
  },
});
```

**Different hosts for v2 RPC and v3 index** — most common "power-user" setup. The two services are independent: a public v2 endpoint can coexist with a private/dedicated v3 cluster (with its own key):

```ts
const tonClient = new TonClient({
  endpoint: "https://toncenter.com/api/v2/jsonRPC",     // v2 RPC: public toncenter
  apiKey: process.env.TONCENTER_API_KEY,
});

const client = new ToncastClient({
  tonClient,
  jettonDiscovery: {
    toncenter: {
      endpoint: "https://my-private-index.example/api/v3",  // dedicated v3 index
      apiKey: process.env.PRIVATE_INDEX_KEY,                // separate key
    },
  },
});
```

**Self-hosted ton-index-go** — bypasses toncenter entirely for jettons:

```ts
const client = new ToncastClient({
  tonClient,                                            // public toncenter v2 RPC
  jettonDiscovery: {
    toncenter: { endpoint: "http://localhost:8081/api/v3" },
  },
});
```

**Per-call override** — useful for one-off batched scans, key rotation, etc.:

```ts
await client.coins.list({
  jettonDiscovery: { toncenter: { endpoint: "...", apiKey: "..." } },
});
```

Resolution order on every call:
1. `opts.toncenter` if set → use it (per-call wins over client-level)
2. else auto-derive from `tonClient` (`/api/v2/jsonRPC` → `/api/v3`, same key)
3. if neither is available, or the request fails → `[]` + a warning is logged; the call still returns the user's TON balance.

## Scripts

```bash
npm run build       # tsup → dist/ (ESM + CJS + .d.ts)
npm run test        # vitest
npm run typecheck   # tsc --noEmit
npm run lint        # biome
npm run lint:fix    # biome with autofix
npm run check       # lint + typecheck + test + build
```

Live smoke-tests against production (read-only):

```bash
npx tsx scripts/smoke-paris-pagination.ts        # finished-paris, exhausts the feed
npx tsx scripts/smoke-bets-for-user.ts           # all bets for a user, exhausts cursor
npx tsx scripts/smoke-pari-detail.ts             # paris.get / oddsState / coefficientHistory / winners + bets.listForPariByUser
npx tsx scripts/smoke-betting-summary.ts         # betting.summary + 3 quote modes (no signing)
npx tsx scripts/smoke-paris-stream.ts            # paris.streamList live + status
npx tsx scripts/smoke-pari-subscribe.ts          # paris.subscribe(id) live + status
```

Signing/deeplink smoke scripts require explicit inputs:

```bash
TONCAST_FINANCIAL_RISK_ACK=1 USER_ADDRESS=... npx tsx scripts/smoke-bet-1ton.ts [pariId]
TONCAST_FINANCIAL_RISK_ACK=1 USER_ADDRESS=... npx tsx scripts/smoke-bet-1usdt.ts [pariId]
```

## Production checklist

- Pin exact package versions until `1.0.0`.
- Never hardcode or invent `userAddress`, `senderAddress`, or `beneficiary`; read them from the connected wallet or verified server config.
- Require explicit developer/user acknowledgement before returning signable bet transactions (`financialRiskAcknowledged: true`).
- For jetton-funded bets, always run `quote*Bet` through `confirmQuote` immediately before signing; this is where fresh STON.fi simulation catches slippage drift.
- Surface `ToncastError`, `ToncastApiError`, and `ToncastWsError` to the caller/UI. Do not turn them into silent empty states.
- Mainnet smoke-test production integrations with minimal amounts before increasing limits.
- Call `client.dispose()` / stream `.dispose()` during widget unmounts, server shutdown, and tests.

## Migration notes

- Replace `includeInactive: true` with `feed: "finished"`.
- Replace `showPendingResults: true` with `feed: "pending"`.
- `client.categories.list()` now returns raw `{ id, title }` domain categories. For UI chips, use `client.categories.listFilters()` or React's `useCategoryFilters()`.
- `cursor` for `paris.list` is `ParisCursor | null`; pass `page.nextCursor` back as-is.
- `prefetch` no longer defaults to eager network work. Use `prefetch: true` for legacy warm-up or `{ categories, coins, swapMarkets }` for explicit behavior.
- `confirmQuote` refuses to return signable transactions unless acknowledged params include `financialRiskAcknowledged: true`.

## License

MIT — see `LICENSE`.
