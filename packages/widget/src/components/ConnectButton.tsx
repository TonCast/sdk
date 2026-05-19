import { useT } from "../i18n/useT";
import { useTcState } from "../tc-bridge";
import { shortAddr } from "../utils/format";
import { TonDiamond } from "./ui/TonDiamond";

export function ConnectButton() {
  const t = useT();
  const { address, connect, restored } = useTcState();
  const connected = Boolean(address);

  return (
    <button
      type="button"
      onClick={connect}
      className="tc-connect-btn"
      aria-label={connected ? t("wallet.options") : t("wallet.connect")}
      disabled={!restored}
      aria-busy={!restored}
    >
      <TonDiamond />
      <span>{connected ? shortAddr(address) : t("wallet.connect")}</span>
    </button>
  );
}
