import "./browser-globals";

export type { SupportedLanguage } from "@toncast/sdk";
export { ToncastWidget } from "./ToncastWidget";
export type { DensitySpacingPick } from "./theme/densityPresets";
export { densityPresetToCssCustomProperties, WIDGET_DENSITY_PRESETS } from "./theme/densityPresets";
export type {
  ClientDescriptor,
  TcIntegratedDescriptor,
  TcStandaloneDescriptor,
  TonConnectDescriptor,
  ToncastWidgetConfig,
  ToncastWidgetCssVars,
  ToncastWidgetCssVarsBase,
  ToncastWidgetDensity,
  ToncastWidgetDerivedCssVarsOptions,
  ToncastWidgetEventMap,
} from "./types";
