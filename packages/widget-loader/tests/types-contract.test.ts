/**
 * Compile-time contract: widget-loader's locally-duplicated public types must
 * stay structurally equivalent to `@toncast/widget`'s exports. If this file
 * fails to typecheck, sync `src/widgetTypes.ts` with the widget package in the
 * same release.
 *
 * `ToncastWidgetConfig` is intentionally excluded — the loader's version is
 * generic over `TonConnectInstance` / `ToncastClientInstance` (defaults to
 * `unknown`) so it stays decoupled from `@tonconnect/ui-react`. Compatibility
 * for the `widget` sub-shape is checked field-by-field below instead.
 */

import type {
  ToncastWidgetConfig as WidgetConfig,
  ToncastWidgetCssVars as WidgetCssVars,
  ToncastWidgetCssVarsBase as WidgetCssVarsBase,
  ToncastWidgetDensity as WidgetDensity,
  ToncastWidgetDerivedCssVarsOptions as WidgetDerivedCssVarsOptions,
  ToncastWidgetEventMap as WidgetEventMap,
  ToncastWidgetGridLayout as WidgetGridLayout,
  ToncastWidgetLayout as WidgetLayout,
  SupportedLanguage as WidgetSupportedLanguage,
} from "@toncast/widget";
import { describe, expectTypeOf, it } from "vitest";
import type {
  ToncastWidgetConfig as LoaderConfig,
  ToncastWidgetCssVars as LoaderCssVars,
  ToncastWidgetCssVarsBase as LoaderCssVarsBase,
  ToncastWidgetDensity as LoaderDensity,
  ToncastWidgetDerivedCssVarsOptions as LoaderDerivedCssVarsOptions,
  ToncastWidgetEventMap as LoaderEventMap,
  ToncastWidgetGridLayout as LoaderGridLayout,
  ToncastWidgetLayout as LoaderLayout,
  SupportedLanguage as LoaderSupportedLanguage,
} from "../src/widgetTypes";

describe("widget-loader / @toncast/widget type contract", () => {
  it("SupportedLanguage union is identical", () => {
    expectTypeOf<LoaderSupportedLanguage>().toEqualTypeOf<WidgetSupportedLanguage>();
  });

  it("ToncastWidgetDensity union is identical", () => {
    expectTypeOf<LoaderDensity>().toEqualTypeOf<WidgetDensity>();
  });

  it("ToncastWidgetGridLayout shape is identical", () => {
    expectTypeOf<LoaderGridLayout>().toEqualTypeOf<WidgetGridLayout>();
  });

  it("ToncastWidgetLayout shape is identical", () => {
    expectTypeOf<LoaderLayout>().toEqualTypeOf<WidgetLayout>();
  });

  it("ToncastWidgetDerivedCssVarsOptions shape is identical", () => {
    expectTypeOf<LoaderDerivedCssVarsOptions>().toEqualTypeOf<WidgetDerivedCssVarsOptions>();
  });

  it("ToncastWidgetCssVarsBase fields are identical", () => {
    expectTypeOf<LoaderCssVarsBase>().toEqualTypeOf<WidgetCssVarsBase>();
  });

  it("ToncastWidgetCssVars fields are identical (incl. light/dark sub-objects)", () => {
    expectTypeOf<LoaderCssVars>().toEqualTypeOf<WidgetCssVars>();
  });

  it("ToncastWidgetEventMap is identical", () => {
    expectTypeOf<LoaderEventMap>().toEqualTypeOf<WidgetEventMap>();
  });

  it("ToncastWidgetConfig.widget shape is bidirectionally compatible", () => {
    type LoaderWidgetField = NonNullable<LoaderConfig["widget"]>;
    type WidgetWidgetField = NonNullable<WidgetConfig["widget"]>;
    expectTypeOf<LoaderWidgetField>().toEqualTypeOf<WidgetWidgetField>();
  });
});
