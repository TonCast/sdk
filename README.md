# Toncast SDK monorepo

TypeScript packages + working demos for building on the Toncast prediction-market protocol:

| Package                                                  | Path                     | What it does                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [**`@toncast/sdk`**](./packages/sdk)                     | `packages/sdk`           | Universal, framework-agnostic SDK: REST, WebSocket streams, betting flow via [`@toncast/tx-sdk`](https://github.com/TonCast/tx-sdk). Browser + Node 20+.                                                                                                                                                                |
| [**`@toncast/sdk-react`**](./packages/sdk-react)         | `packages/sdk-react`     | Thin React wrapper on top of [`@tanstack/react-query`](https://tanstack.com/query/latest): provider + hooks for every read / live / betting endpoint, plus optional `useTonConnectClient` bridge. Supports React 18 + 19. Pattern lifted from [`@ston-fi/omniston-sdk-react`](https://github.com/ston-fi/omniston-sdk). |
| [**`@toncast/widget`**](./packages/widget)               | `packages/widget`        | Embeddable betting widget with standalone and integrated TonConnect modes, live market views, and white-label CSS variable theming.                                                                                                                                                                                     |
| [**`@toncast/widget-loader`**](./packages/widget-loader) | `packages/widget-loader` | Lightweight CDN loader for apps that want to mount the hosted widget bundle at runtime.                                                                                                                                                                                                                                 |
| [**Demo app**](./examples/react-app)                     | `examples/react-app`     | Vite + React 19 + Tailwind 4 + Radix UI. Browse paris (live), open one (live odds), connect TonConnect, **bet in any wallet coin (TON or any jetton with a STON.fi route)**.                                                                                                                                            |

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

## Embedding the betting widget

Two ways to load the same hosted bundle; both expose the `ToncastWidget` class.

1. **Direct CDN script** (no bundler): add one `<script>` tag; in modern browsers the bundle attaches to `window.ToncastWidget`.
2. **npm loader** (`@toncast/widget-loader`): call `load()` to inject the CDN script and receive the constructor — handy for React apps and dynamic import.

CDN URLs are **major-versioned** (`/v0/`, `/v1/`, …): you get non-breaking updates within a major; change the path for breaking releases.

**Option A — CDN**

Host a [TON Connect manifest](https://docs.ton.org/v3/guidelines/ton-connect/creating-manifest) at `{your-domain}/tonconnect-manifest.json`. The widget’s standalone mode uses `tonconnect.options.domain` as that origin (manifest URL = `domain + '/tonconnect-manifest.json'`).

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Toncast widget (CDN)</title>
  </head>
  <body>
    <div id="toncast-widget"></div>

    <script src="https://widget.toncast.app/v0/index.iife.js"></script>
    <script>
      const Widget = window.ToncastWidget.ToncastWidget;
      const widget = new Widget({
        tonconnect: {
          type: "standalone",
          options: { domain: "https://your-app.com" },
        },
      });
      widget.mount(document.getElementById("toncast-widget"));
    </script>
  </body>
</html>
```

**Option B — npm loader (e.g. React + integrated TonConnect)**

```tsx
import { useEffect, useRef } from "react";
import { useTonConnectUI } from "@tonconnect/ui-react";
import ToncastWidgetLoader, {
  type ToncastWidgetInstance,
} from "@toncast/widget-loader";

function ToncastBettingWidget() {
  const [tonconnect] = useTonConnectUI();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<ToncastWidgetInstance | null>(null);

  useEffect(() => {
    let active = true;
    ToncastWidgetLoader.load()
      .then((Widget) => {
        if (!active || !containerRef.current) return;
        widgetRef.current = new Widget({
          tonconnect: { type: "integrated", instance: tonconnect },
        });
        widgetRef.current.mount(containerRef.current);
      })
      .catch((err) => console.error("[ToncastWidget] load failed:", err));
    return () => {
      active = false;
      widgetRef.current?.unmount();
      widgetRef.current = null;
    };
  }, [tonconnect]);

  return <div ref={containerRef} style={{ width: "100%" }} />;
}
```

Wrap your tree in `TonConnectUIProvider` with a valid manifest URL for your domain when using integrated mode from a full app.

For visual setup and exported snippets, use [`examples/widget-constructor/`](./examples/widget-constructor/).

> **Container `id` convention.** `mount(container)` accepts any `Element`. The `#toncast-widget` id used in every snippet above is just a convention: `widget-constructor`’s exported `style.css` scopes per-instance overrides under `#toncast-widget { … }`. Keep that id (or rewrite the CSS scope) when reusing the exported stylesheet.

### Subscribing to `bet` events

The successful-bet event is exposed identically through both surfaces:

- **Class:** `widget.on("bet", ({ pariId, amount, side }) => …)` (and matching `off`).
- **React:** `<Widget onBet={({ pariId, amount, side }) => …} />` from `@toncast/widget/react`.

Both deliver the same payload and fire after the wallet send call resolves. See [`packages/widget/README.md`](./packages/widget/README.md#subscribing-to-bet-events) for the full snippets.

## Widget white-label theming

`@toncast/widget` accepts `widget.cssVars` for per-instance visual customization and
`widget.layout.grid` for responsive market-card columns.
Source tokens such as `accent`, `bg`, `success`, `danger`, `warn`, and `density`
are resolved into readable foregrounds, subtle backgrounds, hover/active states,
surface/chrome colors, order-book fills, shadows, borders, and spacing variables.

```ts
const widget = new ToncastWidget({
  tonconnect: {
    type: "standalone",
    options: { domain: "https://your-app.com" },
  },
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
    layout: {
      grid: {
        mobile: 1,
        tablet: 2,
        desktop: 3,
      },
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
- **Public API & versioning (pre–1.0.0):** see each package `README.md` and root [`CHANGELOG.md`](./CHANGELOG.md).
- **Releases:** [`RELEASING.md`](./RELEASING.md) and [`CHANGELOG.md`](./CHANGELOG.md).
- **Want to see it work?** Run the demo: `npm run dev --workspace @toncast/react-app-example`. Source in [`examples/react-app/`](./examples/react-app).

## License

MIT — see `LICENSE`.
