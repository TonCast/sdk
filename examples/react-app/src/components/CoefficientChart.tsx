// Inline-SVG coefficient history chart. Mobile-first: full-width by
// default, fixed aspect via height utility. No external chart library
// (recharts/d3) — keeps the demo bundle lean and the rendering work
// in the same React render the parent already does.
//
// Always renders the FULL history. Timeframe pills are intentionally
// omitted: backend only persists a coefficient sample on a *change
// event*, so most paris have 0..a-handful of points. Slicing by a
// window would just produce empty charts; "ALL" is always the most
// informative view.

import type { CoefficientHistoryPoint } from "@toncast/sdk";
import { useT } from "@/lib/i18n/useT";

interface Props {
  history: CoefficientHistoryPoint[];
}

const VIEW_W = 600;
const VIEW_H = 200;
const PAD_X = 8;
const PAD_Y = 16;

export function CoefficientChart({ history }: Props) {
  const last = history.at(-1);
  const first = history[0];
  const delta = last && first ? last.coefficient - first.coefficient : 0;
  const trendUp = delta >= 0;
  // `coefficient` IS the YES probability in % (2..98) — no conversion needed.
  const lastPct = last?.coefficient ?? null;
  // Three rendering modes:
  //   - 2+ points → full polyline.
  //   - 1 point  → flat dashed line at that coefficient (current
  //                value with no movement to plot).
  //   - 0 points → empty-state copy.
  const t = useT();
  const points = history.length > 1 ? buildPath(history) : null;
  const flatY =
    !points && history.length === 1 && history[0]
      ? PAD_Y + ((100 - history[0].coefficient) / 100) * (VIEW_H - 2 * PAD_Y)
      : null;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-medium">{t("chart.title")}</h3>
        {lastPct !== null ? (
          <span className="text-xs font-mono text-muted-foreground">{lastPct.toFixed(0)}%</span>
        ) : null}
        {history.length > 1 ? (
          <span className={`text-xs font-mono ${trendUp ? "text-success" : "text-destructive"}`}>
            {trendUp ? t("chart.trendUp") : t("chart.trendDown")} {Math.abs(delta)}
          </span>
        ) : null}
      </div>

      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="h-24 w-full sm:h-28"
          role="img"
          aria-label={t("chart.title")}
        >
          <title>{t("chart.title")}</title>
          {/* Horizontal gridlines at 0/25/50/75/100 % yesOdds — cheap visual
              anchor without the cost of a full chart axis. */}
          {[0, 25, 50, 75, 100].map((p) => {
            const y = PAD_Y + ((100 - p) / 100) * (VIEW_H - 2 * PAD_Y);
            return (
              <line
                key={p}
                x1={PAD_X}
                x2={VIEW_W - PAD_X}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity={p === 50 ? 0.18 : 0.08}
                strokeDasharray={p === 50 ? "4 4" : undefined}
              />
            );
          })}
          {points ? (
            <>
              {/* Filled area under the curve — pure visual flair; opacity is
                  low enough to keep dark-mode bg readable. */}
              <path
                d={`${points.path} L ${VIEW_W - PAD_X},${VIEW_H - PAD_Y} L ${PAD_X},${VIEW_H - PAD_Y} Z`}
                fill={trendUp ? "var(--color-success)" : "var(--color-destructive)"}
                opacity={0.12}
              />
              <path
                d={points.path}
                fill="none"
                stroke={trendUp ? "var(--color-success)" : "var(--color-destructive)"}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Highlight the most recent point so the live "current value"
                  stays anchored even when the line is short / nearly flat. */}
              <circle
                cx={points.lastX}
                cy={points.lastY}
                r={3}
                fill={trendUp ? "var(--color-success)" : "var(--color-destructive)"}
              />
            </>
          ) : flatY !== null ? (
            <>
              {/* Single sample: render a flat line at the current value
                  + a marker on the right edge so the user sees that
                  "the probability hasn't moved during this window". */}
              <line
                x1={PAD_X}
                x2={VIEW_W - PAD_X}
                y1={flatY}
                y2={flatY}
                stroke="var(--color-success)"
                strokeWidth={1.5}
                strokeDasharray="6 6"
                opacity={0.7}
              />
              <circle cx={VIEW_W - PAD_X} cy={flatY} r={3} fill="var(--color-success)" />
            </>
          ) : null}
        </svg>
        {/* "no trades yet" lives outside the SVG so preserveAspectRatio="none"
            doesn't stretch it. Centered via absolute overlay. */}
        {history.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">{t("chart.noTrades")}</span>
          </div>
        )}
        {/* Y-axis labels — pinned to the EXACT y of the matching SVG
            gridline. The SVG has internal `PAD_Y` padding, so a naive
            `flex justify-between` approach drifts at non-default
            heights (the 100% label ends up above the 100% line). We
            compute each label's position as a percentage of the
            container, mirroring `PAD_Y + ((100 - p) / 100) * plotH`. */}
        <div className="pointer-events-none absolute inset-x-0 inset-y-0 text-[10px] font-mono text-muted-foreground">
          {[100, 50, 0].map((p) => {
            const yPct = ((PAD_Y + ((100 - p) / 100) * (VIEW_H - 2 * PAD_Y)) / VIEW_H) * 100;
            return (
              <span
                key={p}
                className="absolute left-1 -translate-y-1/2"
                style={{ top: `${yPct}%` }}
              >
                {p}%
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Build SVG path commands + last-point coordinates for a circle marker. */
function buildPath(history: CoefficientHistoryPoint[]) {
  const xs = history.map((p) => p.timestamp);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const xRange = maxX - minX || 1;
  let path = "";
  let lastX = 0;
  let lastY = 0;
  history.forEach((p, i) => {
    const x = PAD_X + ((p.timestamp - minX) / xRange) * (VIEW_W - 2 * PAD_X);
    const y = PAD_Y + ((100 - p.coefficient) / 100) * (VIEW_H - 2 * PAD_Y);
    path += `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)} `;
    lastX = x;
    lastY = y;
  });
  return { path, lastX, lastY };
}
