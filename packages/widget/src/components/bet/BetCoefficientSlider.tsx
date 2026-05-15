import type { useBet } from "@toncast/sdk-react";
import { useMemo } from "react";
import { useT } from "../../i18n/useT";
import { Slider } from "../ui/Slider";

type Bet = ReturnType<typeof useBet>;

/**
 * Coefficient slider: success fill from the thumb to the track end only in
 * **limit** mode; **fixed** (and any non-limit mode) shows liquidity dots only.
 * Red dots mirror `bet.liquidityMarkers` in all non-market modes.
 */
export function BetCoefficientSlider({ bet }: { bet: Bet }) {
  const t = useT();
  const fillLeftPct = useMemo(() => {
    if (bet.mode !== "limit") return 0;
    const { min, max, value } = bet.oddsSliderProps;
    const range = max - min;
    if (range === 0) return 0;
    return ((value[0] - min) / range) * 100;
  }, [bet.mode, bet.oddsSliderProps]);

  return (
    <div className="tc-coef-slider-wrap">
      <div className="tc-coef-slider-overlay">
        {bet.mode === "limit" && (
          <div className="tc-coef-slider-fill" style={{ left: `${fillLeftPct}%` }} />
        )}
        {bet.liquidityMarkers.map((d) => (
          <span
            key={`liq-${d.yesOdds}-${d.leftPct}`}
            className="tc-coef-slider-marker"
            style={{ left: `${d.leftPct}%` }}
          />
        ))}
      </div>
      <Slider {...bet.oddsSliderProps} hideRange aria-label={t("bet.coefficient")} />
    </div>
  );
}
