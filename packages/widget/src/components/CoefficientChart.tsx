import type { CoefficientHistoryPoint } from "@toncast/sdk";
import { useI18n } from "../i18n/I18nProvider";
import { useT } from "../i18n/useT";

const VIEW_W = 600;
const VIEW_H = 200;
const PAD_X = 8;
const PAD_Y = 16;

/** Maps coefficient history into SVG path coordinates for the sparkline. */
function buildPath(history: readonly CoefficientHistoryPoint[]) {
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

/**
 * YES-probability sparkline with KPI readout.
 * Wide cards: KPI column + full-width sparkline (`@container` in `_chart.css`).
 */
export function CoefficientChart({ history }: { history: readonly CoefficientHistoryPoint[] }) {
  const t = useT();
  const { fmt } = useI18n();
  const last = history.at(-1);
  const first = history[0];
  const delta = last && first ? last.coefficient - first.coefficient : 0;
  const trendUp = delta >= 0;
  const lastPct = last?.coefficient ?? null;
  const points = history.length > 1 ? buildPath(history) : null;
  const flatY =
    !points && history.length === 1 && history[0]
      ? PAD_Y + ((100 - history[0].coefficient) / 100) * (VIEW_H - 2 * PAD_Y)
      : null;

  const successColor = "var(--tc-success)";
  const dangerColor = "var(--tc-danger)";
  const lineColor = trendUp ? successColor : dangerColor;
  const mutedColor = "var(--tc-fg-muted)";

  const ariaLabel =
    lastPct !== null
      ? `${t("chart.title")}: ${fmt.decimal(lastPct, { maximumFractionDigits: 0 })}%`
      : t("chart.title");

  return (
    <div className="tc-chart">
      <div className="tc-chart-kpi">
        <div className="tc-chart-kpi-title">{t("chart.title")}</div>
        {(lastPct !== null || history.length > 1) && (
          <div className="tc-chart-kpi-row">
            {lastPct !== null && (
              <span className="tc-chart-kpi-value">
                {fmt.decimal(lastPct, { maximumFractionDigits: 0 })}%
              </span>
            )}
            {history.length > 1 && (
              <span
                className={
                  trendUp
                    ? "tc-chart-trend-chip tc-chart-trend-chip--up"
                    : "tc-chart-trend-chip tc-chart-trend-chip--down"
                }
              >
                {trendUp ? t("chart.trendUp") : t("chart.trendDown")}{" "}
                {fmt.decimal(Math.abs(delta), { maximumFractionDigits: 0 })}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="tc-chart-canvas">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid slice"
          className="tc-chart-svg"
          role="img"
          aria-label={ariaLabel}
        >
          <title>{ariaLabel}</title>
          {[0, 25, 50, 75, 100].map((p) => {
            const y = PAD_Y + ((100 - p) / 100) * (VIEW_H - 2 * PAD_Y);
            return (
              <line
                key={p}
                x1={PAD_X}
                x2={VIEW_W - PAD_X}
                y1={y}
                y2={y}
                stroke={mutedColor}
                strokeOpacity={p === 50 ? 0.2 : 0.08}
                strokeDasharray={p === 50 ? "4 4" : undefined}
              />
            );
          })}
          {points ? (
            <>
              <path
                className="tc-chart-area"
                d={`${points.path} L ${VIEW_W - PAD_X},${VIEW_H - PAD_Y} L ${PAD_X},${VIEW_H - PAD_Y} Z`}
                fill={lineColor}
              />
              <path
                d={points.path}
                fill="none"
                stroke={lineColor}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={points.lastX} cy={points.lastY} r={3} fill={lineColor} />
            </>
          ) : flatY !== null ? (
            <>
              <line
                x1={PAD_X}
                x2={VIEW_W - PAD_X}
                y1={flatY}
                y2={flatY}
                stroke={successColor}
                strokeWidth={1.5}
                strokeDasharray="6 6"
                opacity={0.7}
              />
              <circle cx={VIEW_W - PAD_X} cy={flatY} r={3} fill={successColor} />
            </>
          ) : null}
        </svg>
        {history.length === 0 && (
          <div className="tc-chart-empty-overlay">
            <span className="tc-text-sm tc-text-muted">{t("chart.noTrades")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
