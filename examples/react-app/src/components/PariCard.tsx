import type { Pari } from "@toncast/sdk";
import { pariCoverUrl, yesOddsToDecimalOdds } from "@toncast/sdk";
import { ODDS_MAX, ODDS_MIN } from "@toncast/sdk/betting";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatTimeLeft } from "@/lib/format";

export interface PariCardProps {
  pari: Pari;
  /** Click on YES/NO opens the bet dialog with this side preselected. */
  onPickSide: (pari: Pari, side: "yes" | "no") => void;
}

/**
 * Compact pari tile: square cover + countdown + two side-buttons that
 * surface the current best decimal odds. Tapping the body navigates to the
 * full detail page; tapping a side opens the bet dialog directly.
 */
export function PariCard({ pari, onPickSide }: PariCardProps) {
  const img = pariCoverUrl(pari.image);
  // Refresh countdown every minute — cheap, prevents stale "5h 12m" lingering.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const yesOdds = pari.bestYesOdds;
  // `yesOddsToDecimalOdds` asserts YES odds are an even int in [ODDS_MIN, ODDS_MAX].
  // Finished / empty-book paris often ship 0, 100, or odd values — calling the helper
  // would throw and break the whole grid (no error boundary on the list).
  const oddsOk =
    yesOdds !== null &&
    Number.isInteger(yesOdds) &&
    yesOdds >= ODDS_MIN &&
    yesOdds <= ODDS_MAX &&
    yesOdds % 2 === 0;
  const yesDecimal = oddsOk ? yesOddsToDecimalOdds(yesOdds, true).toFixed(2) : null;
  const noDecimal = oddsOk ? yesOddsToDecimalOdds(yesOdds, false).toFixed(2) : null;
  const timeLeft = formatTimeLeft(pari.endTime);
  const ended = timeLeft === "ended";

  return (
    <Card className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden">
      <Link
        to={`/p/${encodeURIComponent(pari.id)}`}
        className="flex min-h-0 flex-1 flex-col text-foreground no-underline outline-none transition-opacity hover:opacity-95 focus-visible:opacity-95"
      >
        {img ? (
          <img
            src={img}
            alt=""
            loading="lazy"
            className="w-full aspect-square object-cover shrink-0 bg-muted"
          />
        ) : (
          <div className="w-full aspect-square shrink-0 bg-muted" />
        )}
        <div className="flex flex-1 flex-col p-3 space-y-2">
          <div className="text-sm font-medium leading-snug line-clamp-3 min-h-15">{pari.name}</div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-auto">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {timeLeft}
            </span>
            <span>vol {(pari.yesVolume + pari.noVolume).toFixed(1)} TON</span>
          </div>
        </div>
      </Link>
      <div className="grid grid-cols-2 gap-2 p-3 pt-0">
        <Button
          size="sm"
          variant="secondary"
          disabled={ended}
          onClick={(e) => {
            e.stopPropagation();
            onPickSide(pari, "yes");
          }}
          className="bg-success/15 text-success hover:bg-success/25 font-semibold"
        >
          YES{yesDecimal ? ` ×${yesDecimal}` : ""}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={ended}
          onClick={(e) => {
            e.stopPropagation();
            onPickSide(pari, "no");
          }}
          className="bg-destructive/15 text-destructive hover:bg-destructive/25 font-semibold"
        >
          NO{noDecimal ? ` ×${noDecimal}` : ""}
        </Button>
      </div>
    </Card>
  );
}
