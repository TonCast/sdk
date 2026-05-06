import { createTonClient, ToncastClient } from "@toncast/sdk";
import { ToncastProvider } from "@toncast/sdk-react";
import { useRef } from "react";
import { NavBar } from "./components/NavBar";
import { WidgetHeader } from "./components/WidgetHeader";
import { ConfigProvider, NavProvider, useNav } from "./context";
import { I18nProvider } from "./i18n/I18nProvider";
import { IntegratedProvider, StandaloneProvider } from "./tc-bridge";
import type { ToncastWidgetConfig } from "./types";
import { MyBetsView } from "./views/MyBets";
import { PariDetailView } from "./views/PariDetail";
import { ParisListView } from "./views/ParisList";

// Internal router — renders the active view
function WidgetShell() {
  const { view } = useNav();

  return (
    <div className="tc-shell">
      <WidgetHeader />
      <div className="tc-content">
        {view.name === "list" && <ParisListView />}
        {view.name === "detail" && <PariDetailView view={view} />}
        {view.name === "bets" && <MyBetsView />}
      </div>
      <NavBar />
    </div>
  );
}

// Wraps with ToncastProvider + I18n
function ToncastLayer({
  config,
  children,
}: {
  config: ToncastWidgetConfig;
  children: React.ReactNode;
}) {
  // Module-level singleton for standalone mode
  const clientRef = useRef<ToncastClient | null>(null);

  let client: ToncastClient;
  if (config.client?.type === "integrated") {
    client = config.client.instance;
  } else {
    if (!clientRef.current) {
      clientRef.current = new ToncastClient({
        tonClient: createTonClient({ endpoint: "https://toncenter.com/api/v2/jsonRPC" }),
        referral: config.widget?.referral,
        language: config.widget?.language,
      });
    }
    client = clientRef.current;
  }

  return (
    <ToncastProvider client={client}>
      <I18nProvider>{children}</I18nProvider>
    </ToncastProvider>
  );
}

export function Widget({ config }: { config: ToncastWidgetConfig }) {
  const themeClass = config.widget?.theme === "dark" ? "tc-w tc-dark" : "tc-w";

  const inner = (
    <ToncastLayer config={config}>
      <ConfigProvider config={config}>
        <NavProvider>
          <div className={themeClass}>
            <WidgetShell />
          </div>
        </NavProvider>
      </ConfigProvider>
    </ToncastLayer>
  );

  if (config.tonconnect.type === "integrated") {
    return <IntegratedProvider instance={config.tonconnect.instance}>{inner}</IntegratedProvider>;
  }

  return <StandaloneProvider domain={config.tonconnect.options.domain}>{inner}</StandaloneProvider>;
}
