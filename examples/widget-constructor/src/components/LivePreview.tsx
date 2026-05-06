/**
 * Renders the actual ToncastWidget React component with live Toncast API data.
 * Uses standalone TonConnect with the Toncast dev manifest so wallet connect
 * can be tested right inside the constructor.
 */
import { Widget } from "@toncast/widget/react";
// Widget CSS — imported directly from source; Vite processes it as a stylesheet.
import "@toncast/widget/styles/widget.css";
import type { ConstructorConfig } from "../types";
import type { Device } from "../types";

// Dev manifest from the Toncast main domain — works in any environment.
const DEV_DOMAIN = "https://toncast.me";

interface LivePreviewProps {
  config: ConstructorConfig;
  deviceMode: Device;
}

export function LivePreview({ config, deviceMode }: LivePreviewProps) {
  const domain = config.domain || DEV_DOMAIN;

  const widgetConfig = {
    tonconnect: {
      type: "standalone" as const,
      options: { domain },
    },
    widget: {
      theme: config.theme.colorScheme,
      ...(config.language ? { language: config.language as "en" } : {}),
      ...(config.referralAddress && config.referralPct > 0
        ? { referral: { address: config.referralAddress, pct: config.referralPct } }
        : {}),
      // languages: [] means show all; otherwise pass the selected subset
      ...(config.languages.length > 0
        ? { languages: config.languages as "en"[] }
        : {}),
    },
  };

  const heightByDevice: Record<Device, number> = {
    mobile: 680,
    tablet: 720,
    desktop: 760,
  };

  return (
    <div
      style={{
        height: heightByDevice[deviceMode],
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(51,65,85,0.8)",
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)",
      }}
    >
      <Widget
        // Key by theme so it remounts (re-applies CSS class) when theme toggles
        key={config.theme.colorScheme}
        config={widgetConfig}
      />
    </div>
  );
}
