import { useT } from "../i18n/useT";
import { useStandaloneManifestOk, useTcState } from "../tc-bridge";
import { TonDiamond } from "./ui/TonDiamond";

export function ConnectButton() {
  const t = useT();
  const { address, connect, restored } = useTcState();
  const manifestOk = useStandaloneManifestOk();
  const connected = Boolean(address);

  // This button is only for the "not yet connected" prompt — the wallet
  // popover in WidgetHeader handles the connected state. Guard here so a
  // restoration race can't briefly show a stale connected address.
  if (connected) return null;

  const unavailable = !manifestOk;

  return (
    <button
      type="button"
      onClick={unavailable ? undefined : connect}
      className="tc-connect-btn"
      aria-label={unavailable ? t("wallet.unavailable") : t("wallet.connect")}
      title={unavailable ? t("wallet.unavailable") : undefined}
      disabled={!restored || unavailable}
      aria-busy={!restored}
      aria-disabled={unavailable || undefined}
    >
      <TonDiamond />
      <span>{t("wallet.connect")}</span>
    </button>
  );
}
