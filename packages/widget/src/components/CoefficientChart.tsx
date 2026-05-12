import type { CoefficientHistoryPoint } from "@toncast/sdk";
import { useT } from "../i18n/useT";

const VIEW_W = 600;
const VIEW_H = 200;
const PAD_X = 8;
const PAD_Y = 16;

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

export function CoefficientChart({ history }: { history: CoefficientHistoryPoint[] }) {
  const t = useT();
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

  return (
    <div>
      <div className="tc-chart-header">
        <span>{t("chart.title")}</span>
        {lastPct !== null && <span className="tc-chart-meta">{lastPct.toFixed(0)}%</span>}
        {history.length > 1 && (
          <span className={trendUp ? "tc-chart-trend-up" : "tc-chart-trend-down"}>
            {trendUp ? t("chart.trendUp") : t("chart.trendDown")} {Math.abs(delta)}
          </span>
        )}
      </div>
      <div className="tc-chart-canvas">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="tc-chart-svg"
          role="img"
          aria-label={t("chart.title")}
        >
          <title>{t("chart.title")}</title>
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
                d={`${points.path} L ${VIEW_W - PAD_X},${VIEW_H - PAD_Y} L ${PAD_X},${VIEW_H - PAD_Y} Z`}
                fill={lineColor}
                opacity={0.12}
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
            <span className="tc-text-xs tc-text-muted">{t("chart.noTrades")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
