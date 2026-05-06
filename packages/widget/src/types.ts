import type { SupportedLanguage, ToncastClient } from "@toncast/sdk";
import type { TonConnectUI } from "@tonconnect/ui-react";

export type TcStandaloneDescriptor = {
  type: "standalone";
  options: {
    /** Your app domain — widget builds manifestUrl = domain + '/tonconnect-manifest.json' */
    domain: string;
  };
};

export type TcIntegratedDescriptor = {
  type: "integrated";
  /** Existing TonConnectUI instance from your React app */
  instance: TonConnectUI;
};

export type TonConnectDescriptor = TcStandaloneDescriptor | TcIntegratedDescriptor;

export type ClientStandaloneDescriptor = {
  type: "standalone";
};

export type ClientIntegratedDescriptor = {
  type: "integrated";
  /** Existing ToncastClient instance */
  instance: ToncastClient;
};

export type ClientDescriptor = ClientStandaloneDescriptor | ClientIntegratedDescriptor;

export interface ToncastWidgetConfig {
  tonconnect: TonConnectDescriptor;
  /** Omit to create an internal ToncastClient with default API/WS URLs */
  client?: ClientDescriptor;
  widget?: {
    language?: SupportedLanguage;
    theme?: "light" | "dark";
    referral?: {
      /** TON wallet address receiving the referral share */
      address: string;
      /** Integer 1..7 — percent of winnings, validated on-chain as uint3 */
      pct: number;
    };
    /**
     * Languages shown in the in-widget language picker.
     * Omit (or pass undefined) to show all supported languages.
     * Pass an empty array [] to hide the picker entirely.
     */
    languages?: SupportedLanguage[];
  };
}

export type ToncastWidgetEventMap = {
  mount: { container: Element };
  unmount: undefined;
  error: unknown;
  bet: { pariId: string; amount: bigint; side: "yes" | "no" };
};
