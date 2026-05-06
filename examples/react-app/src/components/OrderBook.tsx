// Order book — same data, two orientations:
//
//   • Mobile  — vertical central-spine ladder. Rows stacked top-to-
//               bottom. YES depth bar grows leftward, NO grows
//               rightward, prices in the centre column.
//
//   • Desktop — same idea rotated 90°. Bars grow vertically: YES
//               UP from a horizontal baseline, NO DOWN. Price
//               labels sit on the central horizontal spine (yesOdds
//               on top half, noOdds on bottom half).
//
// Same data shape powers both — only the axis orientation flips at
// `lg`. No SVG, no log-scale gymnastics; per-side bar heights are
// linear and locally normalised so neither side gets visually
// crushed when the other is much deeper.
//
import { type OddsState, orderBookLadder } from "@toncast/sdk";
import { useT } from "@/lib/i18n/useT";

interface Props {
  oddsState: OddsState | null;
}

type Bucket = ReturnType<typeof orderBookLadder>[number];

export function OrderBook({ oddsState }: Props) {
  const t = useT();
  if (!oddsState) {
    return <Skeleton />;
  }

  const buckets = orderBookLadder(oddsState);
  const visible = buckets.filter((b) => b.yesDepth > 0 || b.noDepth > 0);
  if (visible.length === 0) {
    return <div className="text-sm text-muted-foreground">{t("orderBook.empty")}</div>;
  }

  // Mobile uses the compact list of non-zero buckets only — saves
  // vertical space. Desktop uses ALL 49 yesOdds buckets so the
  // price axis is uniformly spaced — empty columns are part of the
  // information ("no liquidity here").
  const yesMax = Math.max(1, ...visible.map((b) => b.yesDepth));
  const noMax = Math.max(1, ...visible.map((b) => b.noDepth));

  // Same vertical central-spine ladder on every viewport — keeps the
  // visual consistent across mobile / tablet / desktop. The card
  // stretches to the canvas width; long books just become tall lists.
  return <VerticalSpine rows={visible} yesMax={yesMax} noMax={noMax} t={t} />;
}

// ─── Mobile: rows stacked top-to-bottom, bars horizontal. ─────────

function VerticalSpine({
  rows,
  yesMax,
  noMax,
  t,
}: {
  rows: Bucket[];
  yesMax: number;
  noMax: number;
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[1fr_5rem_1fr] items-center gap-2 px-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <div className="text-right text-success">{t("orderBook.buyYes")}</div>
        <div className="text-center">{t("orderBook.price")}</div>
        <div className="text-left text-destructive">{t("orderBook.buyNo")}</div>
      </div>
      {rows.map((r) => (
        <div key={r.yesOdds} className="grid grid-cols-[1fr_5rem_1fr] items-center gap-2 text-xs">
          <HBar side="yes" depth={r.yesDepth} max={yesMax} payout={r.yesPayout} />
          <div className="text-center font-mono leading-tight">
            <div className="text-[11px] text-success">{r.yesOdds}%</div>
            <div className="text-[11px] text-destructive">{100 - r.yesOdds}%</div>
          </div>
          <HBar side="no" depth={r.noDepth} max={noMax} payout={r.noPayout} />
        </div>
      ))}
    </div>
  );
}

function HBar({
  side,
  depth,
  max,
  payout,
}: {
  side: "yes" | "no";
  depth: number;
  max: number;
  payout: number;
}) {
  const isYes = side === "yes";
  const widthPct = depth > 0 ? (depth / max) * 100 : 0;
  return (
    <div
      className={`relative h-7 overflow-hidden rounded-md ${
        isYes ? "bg-success/10" : "bg-destructive/10"
      }`}
    >
      <div
        className={`absolute top-0 bottom-0 ${
          isYes ? "right-0 bg-success/40" : "left-0 bg-destructive/40"
        }`}
        style={{ width: `${widthPct}%` }}
      />
      {depth > 0 ? (
        <div
          className={`absolute inset-y-0 ${
            isYes ? "left-2" : "right-2"
          } flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-foreground`}
        >
          {isYes ? (
            <>
              <span className="font-semibold">{depth}</span>
              <span className="text-muted-foreground">×{payout.toFixed(2)}</span>
            </>
          ) : (
            <>
              <span className="text-muted-foreground">×{payout.toFixed(2)}</span>
              <span className="font-semibold">{depth}</span>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder rows.
          key={i}
          className="h-7 animate-pulse rounded-md bg-muted/30"
        />
      ))}
    </div>
  );
}

