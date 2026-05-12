import type { UseBetResult } from "@toncast/sdk-react";
import { useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { useT } from "@/lib/i18n/useT";

export interface BetCardCoefficientSliderProps {
  bet: UseBetResult;
}

/** Limit-mode odds slider with liquidity markers and optional fill bar. */
export function BetCardCoefficientSlider({ bet }: BetCardCoefficientSliderProps) {
  const t = useT();
  const fillLeftPct = useMemo(() => {
    if (bet.mode !== "limit") return 0;
    const sliderPos = bet.oddsSliderProps.value[0];
    return (
      ((sliderPos - bet.oddsSliderProps.min) /
        (bet.oddsSliderProps.max - bet.oddsSliderProps.min)) *
      100
    );
  }, [bet.mode, bet.oddsSliderProps]);

  return (
    <div className="relative">
      {/*
        inset-x-2.5 mirrors Radix Slider's thumb-bounds offset (size-5 thumb = 20px →
        half = 10px = 2.5 * 4px). Within this container leftPct 0 % aligns with the
        thumb center at min value and 100 % aligns with the thumb center at max value,
        so both the fill bar and the liquidity dots stay in sync with the thumb.
      */}
      <div className="pointer-events-none absolute inset-x-2.5 inset-y-0 z-0">
        {bet.mode === "limit" && (
          <div
            className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-success"
            style={{ left: `${fillLeftPct}%`, right: "-10px" }}
          />
        )}
        {bet.liquidityMarkers.map((d) => (
          <span
            key={d.yesOdds}
            className="absolute top-1/2 size-1.5 rounded-full bg-destructive"
            style={{ left: `${d.leftPct}%`, transform: "translate(-50%, -50%)" }}
          />
        ))}
      </div>
      <Slider
        {...bet.oddsSliderProps}
        hideRange
        className="relative z-10"
        aria-label={t("bet.coefficient")}
      />
    </div>
  );
}
