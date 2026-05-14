import type { CSSProperties, ErrorInfo } from "react";
import { useMemo } from "react";
import {
  BetEmitterProvider,
  ConfigProvider,
  NavProvider,
} from "./context";
import {
  IntegratedProvider,
  StandaloneProvider,
} from "./tc-bridge";
import { buildCssVarStyle } from "./theme/cssVars";
import type { ToncastWidgetConfig } from "./types";
import { cn } from "./utils/cn";
import { stableJsonStringify } from "./utils/stableJsonStringify";
import { usePrefersColorSchemeDark } from "./utils/usePrefersColorSchemeDark";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";
import { WidgetShell } from "./WidgetShell";
import { ToncastLayer } from "./WidgetToncastLayers";

export interface WidgetProps {
  config: ToncastWidgetConfig;
  /** Extra class names applied to the widget root element. */
  className?: string;
  /** Inline styles merged onto the widget root element (after cssVars). */
  style?: CSSProperties;
  /**
   * Called when the user successfully sends a bet transaction. Mirror of the
   * `bet` event on the imperative `ToncastWidget` class — pick whichever entry
   * point matches your integration.
   */
  onBet?: (payload: { pariId: string; amount: bigint; side: "yes" | "no" }) => void;
  /**
   * Called when the widget `ErrorBoundary` catches a render error. Overrides
   * `config.widget.onRenderError` when both are set.
   */
  onRenderError?: (error: Error, info: ErrorInfo) => void;
}

export function Widget({ config, className, style, onBet, onRenderError }: WidgetProps) {
  const configTheme = config.widget?.theme;
  const prefersDark = usePrefersColorSchemeDark({
    enabled: configTheme === "system",
    serverSnapshot: config.widget?.ssrColorScheme === "dark",
  });
  const effectiveTheme: "light" | "dark" =
    configTheme === "system" ? (prefersDark ? "dark" : "light") : (configTheme ?? "light");

  const themeClass = effectiveTheme === "dark" ? "tc-w tc-dark" : "tc-w";
  const cssVarsInput = config.widget?.cssVars;
  const layoutInput = config.widget?.layout;
  const deriveCssVarsInput = config.widget?.deriveCssVars;
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps use stableJsonStringify(...) so inline cssVars object identity does not force rebuild every render; see utils/stableJsonStringify.ts
  const cssVarStyle = useMemo(
    () => buildCssVarStyle(cssVarsInput, effectiveTheme, deriveCssVarsInput, layoutInput),
    [
      stableJsonStringify(cssVarsInput),
      effectiveTheme,
      stableJsonStringify(deriveCssVarsInput),
      stableJsonStringify(layoutInput),
    ],
  );

  // Inject effectiveTheme into config so child components (e.g. WidgetHeader) can read it.
  // `config` identity may change every parent render if the host passes an inline object —
  // we only stabilize against our own `effectiveTheme` flip without deep-equality on `config`.
  const configWithTheme = useMemo<ToncastWidgetConfig>(
    () => ({
      ...config,
      widget: {
        ...config.widget,
        theme: effectiveTheme,
        onRenderError: onRenderError ?? config.widget?.onRenderError,
      },
    }),
    [config, effectiveTheme, onRenderError],
  );

  const inner = (
    <ToncastLayer config={configWithTheme}>
      <ConfigProvider config={configWithTheme}>
        <BetEmitterProvider emit={onBet}>
          <NavProvider>
            <div
              className={cn(themeClass, className)}
              style={cssVarStyle || style ? { ...cssVarStyle, ...style } : undefined}
              suppressHydrationWarning={configTheme === "system"}
            >
              <WidgetErrorBoundary>
                <WidgetShell />
              </WidgetErrorBoundary>
            </div>
          </NavProvider>
        </BetEmitterProvider>
      </ConfigProvider>
    </ToncastLayer>
  );

  if (config.tonconnect.type === "integrated") {
    return (
      <IntegratedProvider instance={config.tonconnect.instance} widgetTheme={config.widget?.theme}>
        {inner}
      </IntegratedProvider>
    );
  }

  return (
    <StandaloneProvider
      domain={config.tonconnect.options.domain}
      widgetTheme={config.widget?.theme}
    >
      {inner}
    </StandaloneProvider>
  );
}
