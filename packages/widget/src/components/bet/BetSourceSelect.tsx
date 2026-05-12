import { TON_ADDRESS } from "@toncast/sdk";
import type { useBet } from "@toncast/sdk-react";
import { useT } from "../../i18n/useT";
import { formatRaw } from "../../utils/format";
import { NativeSelect } from "../ui/Select";
import { Skeleton } from "../ui/Skeleton";

type Bet = ReturnType<typeof useBet>;

/** Source-coin picker with a skeleton fallback while balances load. */
export function BetSourceSelect({ bet }: { bet: Bet }) {
  const t = useT();

  if (!bet.summary.data) {
    return (
      <div>
        <div className="tc-label">{t("bet.sourceCoin")}</div>
        <Skeleton style={{ height: 40 }} />
      </div>
    );
  }

  const options = bet.coins.map((cap) => {
    const sym = cap.source.symbol ?? (cap.source.address === TON_ADDRESS ? "TON" : "?");
    const decimals = cap.source.decimals ?? 9;
    const native = `${formatRaw(cap.source.amount, decimals, 4)} ${sym}`;
    const pricing = cap.reason === "pricing_in_progress";
    return {
      value: cap.source.address,
      label: pricing
        ? `${sym} — ${t("bet.loadingPrice")}`
        : !cap.feasible
          ? `${sym} (${cap.reason ?? t("bet.notViable")})`
          : native,
      disabled: !cap.feasible,
    };
  });

  return (
    <div>
      <div className="tc-label">{t("bet.sourceCoin")}</div>
      <NativeSelect
        value={bet.source ?? ""}
        onChange={(e) => bet.setSource(e.target.value)}
        options={options}
        placeholder={t("bet.sourceCoin.placeholder")}
      />
    </div>
  );
}
