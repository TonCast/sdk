import { useT } from "../i18n/useT";
import { useTcState } from "../tc-bridge";
import { shortAddr } from "../utils/format";
import { TonDiamond } from "./ui/TonDiamond";

export function ConnectButton() {
  const t = useT();
  const { address, connect, disconnect } = useTcState();
  const connected = Boolean(address);

  return (
    <button
      type="button"
      onClick={connected ? disconnect : connect}
      className="tc-connect-btn"
      aria-label={connected ? t("wallet.disconnect") : t("wallet.connect")}
    >
      <TonDiamond />
      <span>{connected ? shortAddr(address) : t("wallet.connect")}</span>
    </button>
  );
}
