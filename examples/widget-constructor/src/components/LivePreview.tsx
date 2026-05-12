/**
 * Renders the actual ToncastWidget React component with live Toncast API data.
 * Uses standalone TonConnect with the Toncast dev manifest so wallet connect
 * can be tested right inside the constructor.
 */
import { rgba, safeHexColor } from "@toncast/widget/color-math";
import { Widget } from "@toncast/widget/react";
import { parseHttpUrl } from "@toncast/widget/url";
import { type CSSProperties, useMemo } from "react";
// Widget CSS — imported directly from source; Vite processes it as a stylesheet.
import "@toncast/widget/styles/widget.css";
import { type ConstructorConfig, DEFAULT_ACCENT, type Device, type ThemeConfig } from "../types";
import { buildWidgetConfig } from "../utils/buildWidgetConfig";
import { usePrefersColorSchemeDark } from "../utils/usePrefersColorSchemeDark";

// Dev manifest from the Toncast main domain — works in any environment.
const DEV_DOMAIN = "https://toncast.me";

const heightByDevice: Record<Device, number> = {
  mobile: 680,
  tablet: 720,
  desktop: 760,
};

/** Returns the domain if it's a valid absolute http(s) URL, otherwise DEV_DOMAIN. */
function resolvePreviewDomain(raw: string): string {
  return parseHttpUrl(raw) ? raw : DEV_DOMAIN;
}

interface LivePreviewProps {
  config: ConstructorConfig;
  deviceMode: Device;
}

/** Accent hex for the active color scheme (matches widget effective palette). */
function effectiveAccentHex(theme: ThemeConfig, prefersDark: boolean): string {
  const pick = (raw: string) => safeHexColor(raw.trim());
  if (theme.colorScheme === "dark") {
    return pick(theme.dark.accent) ?? DEFAULT_ACCENT;
  }
  if (theme.colorScheme === "light") {
    return pick(theme.light.accent) ?? DEFAULT_ACCENT;
  }
  const set = prefersDark ? theme.dark : theme.light;
  return pick(set.accent) ?? DEFAULT_ACCENT;
}

export function LivePreview({ config, deviceMode }: LivePreviewProps) {
  const domain = resolvePreviewDomain(config.domain || "");
  const prefersDark = usePrefersColorSchemeDark();
  const accentHex = effectiveAccentHex(config.theme, prefersDark);
  const frameStyle = useMemo(() => {
    const r = Number.isFinite(config.theme.radius)
      ? Math.min(64, Math.max(0, config.theme.radius))
      : 12;
    const accentLift = rgba(accentHex, 0.28) ?? "rgba(0, 152, 234, 0.28)";
    // Explicit elevation: tight key + soft ambient + accent-tinted spread (no border).
    const boxShadow = ["0 8px 24px rgba(0, 0, 0, 0.38)", `0 20px 48px -8px ${accentLift}`].join(
      ", ",
    );
    return {
      height: heightByDevice[deviceMode],
      borderRadius: r,
      overflow: "hidden" as const,
      boxShadow,
    };
  }, [accentHex, config.theme.radius, deviceMode]);

  const widgetConfig = useMemo(() => buildWidgetConfig(config, { domain }), [config, domain]);

  return (
    <div style={frameStyle as CSSProperties}>
      {/* Widget config is plain JSON; cast through unknown is fine here (test-only build). */}
      <Widget config={widgetConfig as unknown as Parameters<typeof Widget>[0]["config"]} />
    </div>
  );
}
