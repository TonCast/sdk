# Toncast SDK monorepo

TypeScript packages + working demos for building on the Toncast prediction-market protocol:

| Package | Path | What it does |
|---|---|---|
| [**`@toncast/sdk`**](./packages/sdk) | `packages/sdk` | Universal, framework-agnostic SDK: REST, WebSocket streams, betting flow via [`@toncast/tx-sdk`](https://github.com/TonCast/tx-sdk). Browser + Node 20+. |
| [**`@toncast/sdk-react`**](./packages/sdk-react) | `packages/sdk-react` | Thin React wrapper on top of [`@tanstack/react-query`](https://tanstack.com/query/latest): provider + hooks for every read / live / betting endpoint, plus optional `useTonConnectClient` bridge. Supports React 18 + 19. Pattern lifted from [`@ston-fi/omniston-sdk-react`](https://github.com/ston-fi/omniston-sdk). |
| [**`@toncast/widget`**](./packages/widget) | `packages/widget` | Embeddable betting widget with standalone and integrated TonConnect modes, live market views, and white-label CSS variable theming. |
| [**`@toncast/widget-loader`**](./packages/widget-loader) | `packages/widget-loader` | Lightweight CDN loader for apps that want to mount the hosted widget bundle at runtime. |
| [**Demo app**](./examples/react-app) | `examples/react-app` | Vite + React 19 + Tailwind 4 + Radix UI. Browse paris (live), open one (live odds), connect TonConnect, **bet in any wallet coin (TON or any jetton with a STON.fi route)**. |

## Layout

```
.
├── packages/
│   ├── sdk/                     # @toncast/sdk
│   │   ├── src/
│   │   ├── tests/
│   │   ├── scripts/             # smoke tests against the live API
│   │   ├── examples/
│   │   └── README.md            # ← full SDK docs (start here)
│   ├── sdk-react/               # @toncast/sdk-react
│   │   ├── src/
│   │   ├── tests/
│   │   └── README.md            # ← React hooks reference
│   ├── widget/                  # @toncast/widget
│   └── widget-loader/           # @toncast/widget-loader
├── examples/
│   ├── react-app/               # Vite + React 19 demo
│   │   ├── src/                 # pages, components, providers
│   │   ├── public/              # tonconnect-manifest.json
│   │   └── README.md            # ← run + deploy guide
│   └── widget-constructor/      # configure, preview, export widget embeds
├── biome.json                   # shared lint + format config
├── package.json                 # npm workspaces root
└── README.md                    # you are here
```

## Workspaces

The repo is an [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces) monorepo. One install handles both packages:

```bash
npm install
```

Run a script across every workspace:

```bash
npm run typecheck    # tsc --noEmit in each package
npm run build        # tsup → dist/ in each package
npm test             # vitest in each package
npm run lint         # biome over the whole tree
```

Or scope to one package:

```bash
npm run test --workspace @toncast/sdk
npm run build --workspace @toncast/sdk-react
```

## Widget white-label theming

`@toncast/widget` accepts `widget.cssVars` for per-instance visual customization.
Source tokens such as `accent`, `bg`, `success`, `danger`, `warn`, and `density`
are resolved into readable foregrounds, subtle backgrounds, hover/active states,
surface/chrome colors, order-book fills, shadows, borders, and spacing variables.

```ts
const widget = new ToncastWidget({
  tonconnect: { type: "standalone", options: { domain: "https://your-app.com" } },
  widget: {
    theme: "system",
    cssVars: {
      accent: "#7c3aed",
      success: "#10b981",
      danger: "#ef4444",
      warn: "#f59e0b",
      density: "compact",
      light: { bg: "#ffffff" },
      dark: { bg: "#0b1020" },
    },
  },
});
```

Explicit values always win. For example, if you pass `successBg` or
`successFillBg`, the widget keeps that exact value instead of deriving one from
`success`. Set `deriveCssVars: false`
to disable all derivation, or use `deriveCssVars: { colors: false }` /
`{ density: false }` to disable one group.

## Where to read next

- **Building anything?** Start with [`packages/sdk/README.md`](./packages/sdk/README.md) — full API surface, betting flow, advanced jetton discovery.
- **Building a React UI?** Read [`packages/sdk-react/README.md`](./packages/sdk-react/README.md) — quick start + every hook in one page.
- **Want to see it work?** Run the demo: `npm run dev --workspace @toncast/react-app-example`. Source in [`examples/react-app/`](./examples/react-app).

## License

MIT — see `LICENSE`.
