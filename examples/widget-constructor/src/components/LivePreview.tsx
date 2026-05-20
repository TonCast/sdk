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
import { type ConstructorConfig, DEFAULT_ACCENT, type ThemeConfig } from "../types";
import { buildWidgetConfig } from "../utils/buildWidgetConfig";
import { HEIGHT_BY_DEVICE } from "../utils/deviceLayout";
import { clampRadius } from "../utils/normalizeConfig";
import { usePrefersColorSchemeDark } from "../utils/usePrefersColorSchemeDark";

// Dev manifest from the Toncast main domain — works in any environment.
const DEV_DOMAIN = "https://toncast.me";

/** Returns the domain if it's a valid absolute http(s) URL, otherwise DEV_DOMAIN. */
function resolvePreviewDomain(raw: string): string {
  return parseHttpUrl(raw) ? raw : DEV_DOMAIN;
}

interface LivePreviewProps {
  config: ConstructorConfig;
  deviceMode: keyof typeof HEIGHT_BY_DEVICE;
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

export default function LivePreview({ config, deviceMode }: LivePreviewProps) {
  const domain = resolvePreviewDomain(config.domain || "");
  const prefersDark = usePrefersColorSchemeDark();
  const accentHex = effectiveAccentHex(config.theme, prefersDark);
  const frameStyle = useMemo(() => {
    const r = clampRadius(config.theme.radius);
    const accentLift = rgba(accentHex, 0.28) ?? "rgba(0, 152, 234, 0.28)";
    // Explicit elevation: tight key + soft ambient + accent-tinted spread (no border).
    const boxShadow = ["0 8px 24px rgba(0, 0, 0, 0.38)", `0 20px 48px -8px ${accentLift}`].join(
      ", ",
    );
    return {
      height: HEIGHT_BY_DEVICE[deviceMode],
      borderRadius: r,
      /*
       * clip-path instead of overflow:hidden — achieves the same visual
       * border-radius clipping without creating an overflow scroll container,
       * so position:fixed descendants (wallet popover) can escape the frame.
       */
      clipPath: `inset(0 round ${r})`,
      boxShadow,
    };
  }, [accentHex, config.theme.radius, deviceMode]);

  const widgetConfig = useMemo(() => buildWidgetConfig(config, { domain }), [config, domain]);

  return (
    <div style={frameStyle as CSSProperties}>
      <Widget config={widgetConfig} />
    </div>
  );
}
