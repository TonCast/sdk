# @toncast/widget

Embeddable Toncast betting UI: market lists, pari detail, bet placement (TON or jetton via STON.fi routing), optional TonConnect (standalone or integrated with your app’s `@tonconnect/ui-react`).

- **CDN:** major-versioned IIFE bundle (see root monorepo README for snippet).
- **npm:** ESM/CJS builds plus [`@toncast/widget-loader`](../widget-loader) for runtime script injection.
- **Theming:** CSS variables and density presets — see root README “Widget white-label theming”.

**Status:** 0.0.1 (pre–1.0.0). Pin exact versions until `1.0.0`. The IIFE bundle is large by design (~1.7 MB minified); monitor size on upgrades. See [`CHANGELOG.md`](../../CHANGELOG.md).

**Security:** the widget prepares transactions for the user’s wallet; it does not hold keys. CDN users should prefer **Subresource Integrity** via the loader’s `integrity` option. See [`AGENTS.md`](../../AGENTS.md) for integrator obligations around `confirmQuote` and addresses.

## Subscribing to bet events

Two surfaces, one event. Pick the one that matches how you mounted the widget — both deliver the same `{ pariId, amount, side }` payload after a bet transaction is sent.

**React component (`<Widget>` / `@toncast/widget/react`)**

```tsx
import { Widget } from "@toncast/widget/react";

<Widget
  config={config}
  onBet={({ pariId, amount, side }) => {
    analytics.track("bet_sent", { pariId, amount: amount.toString(), side });
  }}
/>;
```

The prop is forwarded through a stable context, so an inline arrow doesn’t re-render descendants.

**Imperative class (`ToncastWidget` / CDN bundle)**

```ts
import { ToncastWidget } from "@toncast/widget";

const widget = new ToncastWidget(config);
widget.on("bet", ({ pariId, amount, side }) => {
  // …
});
widget.mount(document.getElementById("toncast-widget")!);
```

Also exposes `mount`, `unmount`, and `error` events, plus a **`dispose()`** method for full teardown. Listeners that throw fire the `error` event instead of bubbling.

When you discard the imperative instance entirely, call **`dispose()`** — it unmounts if needed and clears all `on()` listeners. `unmount()` alone keeps listeners so a remount reuses the same handlers; use `off()` to remove individual listeners without disposing.

> **Removed in 0.0.1:** the legacy `widget.onBet` config callback. Use one of the two channels above — they are functionally identical.

## Render error hook

For host-side logging or analytics, set **`widget.onRenderError`** on the config object, or pass **`onRenderError`** on `<Widget />` from `@toncast/widget/react` (the prop overrides `config.widget.onRenderError` when both are set). It is invoked from the internal `ErrorBoundary` after a render error is caught — the inline retry card is still shown to the user.

## Bet amount input (locales)

In locales where the decimal separator is a **comma** (e.g. German), a lone **dot** with exactly three digits after it (e.g. `35.572`) is treated as **ambiguous** (English-style fraction vs. thousands). The amount field shows a hint and does not apply the value until the user uses the locale’s decimal mark (e.g. `35,572` for thirty-five point five seven two).

## Language: config vs in-widget picker

Two layers can set the language; they coexist by design.

| Source                             | When applied                                                                                                                                       | Wins on conflict                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `config.widget.language` (host)    | Every render where the value changes — pushed via `client.setLanguage()`, the `ToncastClient` is **not** recreated and WS subscriptions stay alive | Yes — the host’s preference always trumps a stale picker selection because it is reapplied every render |
| In-widget language picker (header) | User clicks a flag — calls the SDK’s `setLanguage` directly                                                                                        | Wins until the host changes `config.widget.language` again                                              |

**To lock the language entirely** (no picker drift): pass `config.widget.language` and never change it. The picker still allows the user to switch locally, but any host-driven re-render with the same `config.widget.language` will snap it back.

**To let the user choose freely**: omit `config.widget.language`. The widget then honours the SDK’s persisted choice, falling back to `navigator.language` and finally `"en"`.

`widget.referral` follows the same model — pushed via `client.setReferral()` on change. In **standalone** mode (you don’t pass a `client.instance`), removing `widget.referral` from config also clears it on the SDK client. In **integrated** mode (you pass your own `ToncastClient`), an absent `widget.referral` is treated as “host manages this directly” and is never cleared by the widget.
