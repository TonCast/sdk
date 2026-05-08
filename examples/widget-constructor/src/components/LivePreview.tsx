/**
 * Renders the actual ToncastWidget React component with live Toncast API data.
 * Uses standalone TonConnect with the Toncast dev manifest so wallet connect
 * can be tested right inside the constructor.
 */
import type { SupportedLanguage } from "@toncast/sdk";
import { Widget } from "@toncast/widget/react";
// Widget CSS — imported directly from source; Vite processes it as a stylesheet.
import "@toncast/widget/styles/widget.css";
import type { ConstructorConfig, Device } from "../types";
import { buildCssVarsConfig } from "../utils/generateZip";

// Dev manifest from the Toncast main domain — works in any environment.
const DEV_DOMAIN = "https://toncast.me";

/** Returns the domain if it's a valid absolute http(s) URL, otherwise DEV_DOMAIN. */
function resolvePreviewDomain(raw: string): string {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? raw : DEV_DOMAIN;
  } catch {
    return DEV_DOMAIN;
  }
}

interface LivePreviewProps {
  config: ConstructorConfig;
  deviceMode: Device;
}

export function LivePreview({ config, deviceMode }: LivePreviewProps) {
  const domain = resolvePreviewDomain(config.domain || "");
  const cssVars = buildCssVarsConfig(config);

  const widgetConfig = {
    tonconnect: {
      type: "standalone" as const,
      options: { domain },
    },
    widget: {
      theme: config.theme.colorScheme as "light" | "dark" | "system",
      ...(cssVars ? { cssVars } : {}),
      ...(config.language ? { language: config.language as SupportedLanguage } : {}),
      ...(config.referralAddress && config.referralPct > 0
        ? { referral: { address: config.referralAddress, pct: config.referralPct } }
        : {}),
      ...(config.languages.length > 0
        ? { languages: config.languages as SupportedLanguage[] }
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
      <Widget config={widgetConfig} />
    </div>
  );
}
