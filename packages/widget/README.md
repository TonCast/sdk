# @toncast/widget

Embeddable Toncast betting UI: market lists, pari detail, bet placement (TON or jetton via STON.fi routing), optional TonConnect (standalone or integrated with your app’s `@tonconnect/ui-react`).

- **CDN:** major-versioned IIFE bundle (see root monorepo README for snippet).
- **npm:** ESM/CJS builds plus [`@toncast/widget-loader`](../widget-loader) for runtime script injection.
- **Theming:** CSS variables and density presets — see root README “Widget white-label theming”.

**Status:** 0.0.1 (pre–1.0.0). Pin exact versions until `1.0.0`. The IIFE bundle is large by design (~1.7 MB minified); monitor size on upgrades. See [`docs/PUBLIC_API.md`](../../docs/PUBLIC_API.md) and [`CHANGELOG.md`](../../CHANGELOG.md).

**Security:** the widget prepares transactions for the user’s wallet; it does not hold keys. CDN users should prefer **Subresource Integrity** via the loader’s `integrity` option. See [`AGENTS.md`](../../AGENTS.md) for integrator obligations around `confirmQuote` and addresses.
