import { useT } from "../../i18n/useT";
import { ConnectPromptCard } from "../ConnectPromptCard";
import { TonDiamond } from "../ui/TonDiamond";

/** Prompt shown inside BetCard when the wallet is not yet connected. */
export function BetConnectPrompt({ onConnect }: { onConnect: () => void }) {
  const t = useT();
  return (
    <ConnectPromptCard
      text={t("bet.connectPrompt")}
      variant="card"
      action={
        <button type="button" className="tc-connect-btn" onClick={onConnect}>
          <TonDiamond />
          {t("wallet.connect")}
        </button>
      }
    />
  );
}
