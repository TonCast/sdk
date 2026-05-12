import { THEME, type Theme } from "@tonconnect/ui-react";

/** Maps widget `widget.theme` to TonConnect modal `uiPreferences.theme`. */
export function tonConnectThemeFromWidget(theme: "light" | "dark" | "system" | undefined): Theme {
  switch (theme) {
    case "dark":
      return THEME.DARK;
    case "system":
      return "SYSTEM";
    default:
      return THEME.LIGHT;
  }
}
