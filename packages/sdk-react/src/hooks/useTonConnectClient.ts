import { useEffect } from "react";
import { useToncastClient } from "../client/useToncastClient";

/**
 * Mirror an external wallet-bridge address (e.g. `useTonAddress()` from
 * `@tonconnect/ui-react`) into `client.userAddress`. Optional — without
 * TonConnect just call `client.setUserAddress(...)` from your own auth flow.
 *
 * `@tonconnect/ui-react` is a peer dep we never import here — keeps the SDK
 * wallet-bridge-agnostic.
 *
 * ```tsx
 * import { useTonAddress } from "@tonconnect/ui-react";
 * import { useTonConnectClient } from "@toncast/sdk-react";
 *
 * function WalletSync() {
 *   useTonConnectClient(useTonAddress());
 *   return null;
 * }
 * ```
 */
export function useTonConnectClient(userAddress: string | null | undefined): void {
  const client = useToncastClient();
  useEffect(() => {
    if (userAddress) {
      client.setUserAddress(userAddress);
    } else {
      client.clearUserAddress();
    }
  }, [client, userAddress]);
}
