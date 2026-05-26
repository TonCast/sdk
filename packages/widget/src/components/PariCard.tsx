import type { Pari } from "@toncast/sdk";
import { pariCoverUrl, yesOddsToDecimalOdds } from "@toncast/sdk";
import { ODDS_MAX, ODDS_MIN } from "@toncast/sdk/betting";
import { useEffect, useReducer } from "react";
import { MINUTE_TICK_MS } from "../constants";
import { useNav } from "../context";
import { useI18n } from "../i18n/I18nProvider";
import { useT } from "../i18n/useT";
import { formatTimeLeft } from "../utils/format";
import { isBettingClosed } from "../utils/pariBetting";
import { useReliablePariCoverUrl } from "../utils/useReliablePariCoverUrl";
import { Button } from "./ui/Button";

/**
 * Shared minute-tick clock — single setInterval shared across all PariCard instances.
 */
const minuteTickListeners = new Set<() => void>();
let minuteTickInterval: ReturnType<typeof setInterval> | null = null;

function subscribeMinuteTick(cb: () => void): () => void {
  minuteTickListeners.add(cb);
  if (!minuteTickInterval && typeof setInterval !== "undefined") {
    minuteTickInterval = setInterval(() => {
      for (const listener of minuteTickListeners) listener();
    }, MINUTE_TICK_MS);
  }
  return () => {
    minuteTickListeners.delete(cb);
    if (minuteTickListeners.size === 0 && minuteTickInterval !== null) {
      clearInterval(minuteTickInterval);
      minuteTickInterval = null;
    }
  };
}

/** Triggers a re-render on every 60-second tick. */
function useMinuteTick() {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribeMinuteTick(tick), []);
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function PariCard({ pari }: { pari: Pari }) {
  const t = useT();
  const { fmt } = useI18n();
  const { navigate } = useNav();
  const img = pariCoverUrl(pari.image);
  const { displaySrc, onImgError } = useReliablePariCoverUrl(img);
  const showImage = Boolean(displaySrc);

  useMinuteTick();

  const yesOdds = pari.bestYesOdds;
  const oddsOk =
    yesOdds !== null &&
    Number.isInteger(yesOdds) &&
    yesOdds >= ODDS_MIN &&
    yesOdds <= ODDS_MAX &&
    yesOdds % 2 === 0;
  const yesDecimal = oddsOk ? fmt.decimal(yesOddsToDecimalOdds(yesOdds, true)) : null;
  const noDecimal = oddsOk ? fmt.decimal(yesOddsToDecimalOdds(yesOdds, false)) : null;
  const timeLeft = formatTimeLeft(pari.endTime, t as Parameters<typeof formatTimeLeft>[1]);
  const bettingClosed = isBettingClosed(pari);

  const goDetail = () => navigate({ name: "detail", pariId: pari.id });

  return (
    <div className="tc-pari-card">
      <button type="button" className="tc-pari-cover-link" onClick={goDetail}>
        {showImage ? (
          <img
            src={displaySrc ?? ""}
            alt={pari.name}
            loading="lazy"
            className="tc-pari-cover"
            onError={onImgError}
          />
        ) : (
          <div className="tc-pari-cover-placeholder" />
        )}
        <div className="tc-pari-body">
          <div className="tc-pari-name">{pari.name}</div>
          <div className="tc-pari-meta">
            <span className="tc-pari-meta-item">
              <ClockIcon />
              {timeLeft}
            </span>
            <span className="tc-pari-meta-item tc-pari-meta-volume">
              {fmt.decimal(pari.yesVolume + pari.noVolume, { maximumFractionDigits: 1 })} TON
            </span>
          </div>
        </div>
      </button>
      {!bettingClosed ? (
        <div className="tc-pari-btns">
          <Button
            variant="yes"
            size="sm"
            onClick={() => navigate({ name: "detail", pariId: pari.id, initialSide: "yes" })}
          >
            {t("side.yes")}
            {yesDecimal ? ` ×${yesDecimal}` : ""}
          </Button>
          <Button
            variant="no"
            size="sm"
            onClick={() => navigate({ name: "detail", pariId: pari.id, initialSide: "no" })}
          >
            {t("side.no")}
            {noDecimal ? ` ×${noDecimal}` : ""}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
