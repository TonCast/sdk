import type { Pari } from "@toncast/sdk";
import { ODDS_MAX, ODDS_MIN, pariCoverUrl, yesOddsToDecimalOdds } from "@toncast/sdk";
import { useEffect, useReducer } from "react";
import { useNav } from "../context";
import { useT } from "../i18n/useT";
import { formatTimeLeft } from "../utils/format";
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
    }, 60_000);
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
  const { navigate } = useNav();
  const img = pariCoverUrl(pari.image);

  useMinuteTick();

  const yesOdds = pari.bestYesOdds;
  const oddsOk =
    yesOdds !== null &&
    Number.isInteger(yesOdds) &&
    yesOdds >= ODDS_MIN &&
    yesOdds <= ODDS_MAX &&
    yesOdds % 2 === 0;
  const yesDecimal = oddsOk ? yesOddsToDecimalOdds(yesOdds, true).toFixed(2) : null;
  const noDecimal = oddsOk ? yesOddsToDecimalOdds(yesOdds, false).toFixed(2) : null;
  const timeLeft = formatTimeLeft(pari.endTime, t as Parameters<typeof formatTimeLeft>[1]);
  const ended = pari.endTime - Date.now() / 1000 <= 0;

  const goDetail = () => navigate({ name: "detail", pariId: pari.id });

  return (
    <div className="tc-pari-card">
      <button type="button" onClick={goDetail} style={{ all: "unset", display: "contents" }}>
        {img ? (
          <img src={img} alt="" loading="lazy" className="tc-pari-cover" />
        ) : (
          <div className="tc-pari-cover-placeholder" />
        )}
        <div className="tc-pari-body">
          <div className="tc-pari-name">{pari.name}</div>
          <div className="tc-pari-meta">
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              <ClockIcon />
              {timeLeft}
            </span>
            <span>{(pari.yesVolume + pari.noVolume).toFixed(1)} TON</span>
          </div>
        </div>
      </button>
      <div className="tc-pari-btns">
        <Button
          variant="yes"
          size="sm"
          disabled={ended}
          onClick={() => navigate({ name: "detail", pariId: pari.id, initialSide: "yes" })}
        >
          {t("side.yes")}
          {yesDecimal ? ` ×${yesDecimal}` : ""}
        </Button>
        <Button
          variant="no"
          size="sm"
          disabled={ended}
          onClick={() => navigate({ name: "detail", pariId: pari.id, initialSide: "no" })}
        >
          {t("side.no")}
          {noDecimal ? ` ×${noDecimal}` : ""}
        </Button>
      </div>
    </div>
  );
}
