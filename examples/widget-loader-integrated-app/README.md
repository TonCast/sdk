# Toncast widget — Option B (npm loader) + integrated TonConnect

Minimal Vite + React example: [`@toncast/widget-loader`](../../packages/widget-loader) injects the hosted IIFE; TonConnect is supplied by the host via `TonConnectUIProvider` and `tonconnect: { type: 'integrated', instance }`.

**Reference doc:** [INTEGRATION.md](INTEGRATION.md) — minimal production pattern vs demo-only pieces, `dispose()` vs `unmount`, event surfaces, optional integrated `ToncastClient`, and palette bridge.

The UI is split like a real integration:

- **Host header** — branding, **widget theme** segmented control ([`HostThemeSegment`](src/components/HostThemeSegment.tsx)), and a single [`TonConnectButton`](https://github.com/ton-connect/sdk) (no duplicate truncated address). The selected theme is sent to the embed as `ToncastWidgetConfig.widget.theme` and kept in sync via `ToncastWidget.update()` (no script reload). The same choice drives `TonConnectUIProvider` `uiPreferences.theme` so the connect modal matches the host.
- **Panels** — shared card chrome in [`HostPanel`](src/components/HostPanel.tsx); host CSS under [`src/styles/`](src/styles/) (`host.css`). Canonical embed colors: `--tc-widget-palette-*` on `:root` in [`host-tokens.css`](src/styles/host-tokens.css); [`widgetEmbedChrome.ts`](src/widgetEmbedChrome.ts) maps them into `widget.cssVars` (with fallbacks + dev warning if tokens are missing). The **mount node** has no host layout class by default; [`App.tsx`](src/App.tsx) wraps [`ToncastBettingWidget`](src/ToncastBettingWidget.tsx) in `host-widget-surface` so flex sizing stays a host concern. Main area: status pill (`onPhaseChange`), loading overlay, embed (`data-testid="toncast-widget-root"`). Side: “Host · widget events” from `onBet`. Optional `onWidgetError` logs widget `error` events (listener throws).

## Custom CDN URL (e.g. Cloudflare Workers)

Copy [`.env.example`](.env.example) to `.env.local` and set:

```bash
VITE_WIDGET_CDN_URL=https://cdn.example.com/toncast-widget/index.iife.js
```

Restart `npm run dev`. The footer of the main panel shows the resolved URL (or a hint if the default CDN is used). You can also pass `cdnUrl` on `<ToncastBettingWidget cdnUrl="…" />` from any parent.

Optional **`VITE_WIDGET_LANGUAGE`** — default `widget.language` (must be a supported code from `@toncast/widget-loader`; invalid values fall back to `en`). See [`.env.example`](.env.example).

Embed height is fixed in CSS as `--host-widget-viewport-height` (default `min(72svh, 820px)`) on `.host-panel-body` so the host card does not grow when lists inside the widget get longer; scrolling stays inside the widget shell.

## TDD

Tests live next to the embed component (`src/ToncastBettingWidget.test.tsx`). From the monorepo root:

```bash
npm run test --workspace @toncast/widget-loader-integrated-app
npm run test:watch --workspace @toncast/widget-loader-integrated-app
```

Vitest uses jsdom with a `matchMedia` stub and a `fetch` stub so `TonConnectUIProvider` can initialize without a real browser bridge. **`reactStrictMode: false`** in `render()` avoids double-invoking TonConnect-related effects in tests only — keep **StrictMode enabled** in your app unless you have a TonConnect-specific reason not to.

Host styles are imported in [`setupTests.ts`](src/setupTests.ts) so `readToncastWidgetCssVarsFromDocument` sees `--tc-widget-palette-*` in unit tests.

## Run the app

```bash
npm install
npm run dev --workspace @toncast/widget-loader-integrated-app
```

Open the printed local URL. TonConnect `manifestUrl` is resolved like the widget script URL: optional `VITE_TONCONNECT_MANIFEST_URL` in [`.env.example`](.env.example), otherwise an in-memory JSON **blob** whose `url` field is `window.location.origin` (see [`src/viteEnv.ts`](src/viteEnv.ts)) so localhost, `127.0.0.1`, tunnels, and production builds all work without a static manifest file.

## Manual checklist (wallet)

After automated tests pass, confirm in a real browser:

1. **Script tag** — In DevTools → Elements → `<head>`, find `script` with `data-tc-widget-loader="…"` matching your CDN URL (default or `VITE_WIDGET_CDN_URL`).
2. **Widget mount** — The betting UI appears inside the host surface; status shows **Ready** when the bundle has loaded.
3. **TonConnect** — Connect a wallet; integrated mode uses the same TonConnect session as the host header button.
4. **Bet feed** — After a successful bet in the widget, a row should appear in “Host · widget events” (confirms `onBet` / `bet` wiring).
5. **If the wallet or manifest fails** — `http://localhost` and `http://127.0.0.1` are different origins. Some wallets require HTTPS; use a tunnel and, if you host a static manifest, set `VITE_TONCONNECT_MANIFEST_URL` to that HTTPS URL with a matching `url` field inside the JSON. A TonConnect failure is not necessarily a widget-loader failure.

This workspace resolves `@toncast/widget-loader` to **source** via Vite alias (see [`vite.config.ts`](vite.config.ts)) so local changes to the loader are picked up without publishing. For a consumer-style check against the built package only, remove the alias and run `npm run build --workspace @toncast/widget-loader` first.

## Security

This SDK can lead to signed transactions and loss of funds if misused. Read the monorepo [`AGENTS.md`](../../AGENTS.md) before integrating betting flows. Do not swallow `ToncastError` / `ToncastApiError` / `ToncastWsError` when you wire an integrated `ToncastClient`; the widget’s `error` event and `onRenderError` are **not** substitutes for SDK error handling (see [INTEGRATION.md](INTEGRATION.md)).
