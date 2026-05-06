import { createTonClient, ToncastClient } from "@toncast/sdk";
import { ToncastProvider, useTonConnectClient } from "@toncast/sdk-react";
import { TonConnectUIProvider, useTonAddress } from "@tonconnect/ui-react";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { ThemeProvider } from "@/lib/theme";

// @tonconnect/ui-react was built against React 18 types. React 19 expanded
// ReactNode to include `undefined`, so FunctionComponent (and ComponentType)
// now return ReactNode — which TypeScript rejects as a JSX element. Casting
// to an explicit (props) => ReactElement signature satisfies JSX's requirement
// of Element | null without losing any prop-type safety.
const TonConnectUIProviderCompat = TonConnectUIProvider as (
  props: ComponentProps<typeof TonConnectUIProvider>,
) => ReactElement;

const TONCENTER_ENDPOINT = "https://toncenter.com/api/v2/jsonRPC";
const TONCENTER_API_KEY = import.meta.env.VITE_TONCENTER_API_KEY ?? "";

// ─── Referral attribution ────────────────────────────────────────────────
// THIS is how an integrator earns: every bet placed through `client.betting.*`
// auto-attaches your wallet + commission share (0..7 % of winnings) and the
// on-chain contract pays it directly to you. Configure once here — no per-call
// boilerplate.
//
// 👉 REPLACE the address with YOUR own wallet (mainnet, the one that will
//    receive the commission) and bump `referralPct` to 1..7. `0` keeps the
//    referral feature disabled — the default for the example so a fresh
//    clone never accidentally pays commission to a placeholder wallet.
const referralAddress = "UQAYY83O3nd8vECKKBvlK_FXVMYdx65XU9ebhZ65pzZm7Lif";
const referralPct = 0; // % of winnings — integer 0..7 (`0` = off)

/**
 * TonConnect requires `manifestUrl` to be a publicly reachable JSON whose
 * `url` field matches the page origin.
 *
 * - **Local dev** (`localhost` / `127.0.0.1` / `*.local`) — wallet apps on
 *   phones can't reach your laptop's origin, so we point at the production
 *   Toncast manifest as a stand-in. Convenient default for trying the demo.
 *
 * - **Real deployment** — we serve `public/tonconnect-manifest.json` from
 *   the same origin. EDIT THAT FILE before going live: replace the `url`
 *   with your domain, the `name` with your app's display name, and the
 *   `iconUrl` with a square PNG ≥ 180×180 hosted on your origin.
 */
const FALLBACK_DEV_MANIFEST = "https://toncast.me/tonconnect-manifest.json";

function buildTonConnectManifestUrl(): string {
  if (typeof window === "undefined") return FALLBACK_DEV_MANIFEST;
  const { hostname, origin } = window.location;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".localhost");
  return isLocal ? FALLBACK_DEV_MANIFEST : `${origin}/tonconnect-manifest.json`;
}

const TONCONNECT_MANIFEST_URL = buildTonConnectManifestUrl();

// Module-level singleton — a `useMemo`/`useRef` inside a component would be
// re-instantiated by React StrictMode (which mounts/unmounts components twice
// in development), creating two ToncastClient instances and doubling every
// network request. Top-of-module init evaluates exactly once per page load.
//
// `createTonClient` (vs `new TonClient`) wraps the axios transport with a
// retry adapter that survives 429/5xx from the public toncenter endpoint —
// crucial without an API key. STON.fi-aware too.
const tonClient = createTonClient({
  endpoint: TONCENTER_ENDPOINT,
  apiKey: TONCENTER_API_KEY || undefined,
});
// `language` left undefined so the SDK reads its persisted choice from
// `localStorage` (key `"toncast.language"`), falling back to the browser's
// preferred language. Explicit `language: "en"` here would overwrite that.
const toncastClient = new ToncastClient({
  tonClient,
  referral:
    referralAddress && referralPct > 0
      ? { address: referralAddress, pct: referralPct }
      : undefined,
});

/** Bridge between TonConnect's address and `client.userAddress`. */
function WalletSync() {
  useTonConnectClient(useTonAddress() || null);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TonConnectUIProviderCompat
        manifestUrl={TONCONNECT_MANIFEST_URL}
        // Disable TonConnect's built-in analytics — they ping a Tonkeeper
        // telemetry endpoint on every wallet event and noisily log
        // `[TON_CONNECT_SDK] Sending analytics events…` to the console.
        // Pass `mode: "telemetry"` (the default) if you want them on.
        analytics={{ mode: "off" }}
      >
        <ToncastProvider client={toncastClient}>
          <I18nProvider>
            <WalletSync />
            {children}
          </I18nProvider>
        </ToncastProvider>
      </TonConnectUIProviderCompat>
    </ThemeProvider>
  );
}
