import { type OddsState, orderBookLadder } from "@toncast/sdk";
import { useT } from "../i18n/useT";
import { Skeleton } from "./ui/Skeleton";

type Bucket = ReturnType<typeof orderBookLadder>[number];

export function OrderBook({ oddsState }: { oddsState: OddsState | null }) {
  const t = useT();

  if (!oddsState) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={String(i)} style={{ height: 28, width: "100%" }} />
        ))}
      </div>
    );
  }

  const buckets = orderBookLadder(oddsState);
  const visible = buckets.filter((b) => b.yesDepth > 0 || b.noDepth > 0);

  if (visible.length === 0) {
    return <div className="tc-text-muted tc-text-sm">{t("orderBook.empty")}</div>;
  }

  const yesMax = Math.max(1, ...visible.map((b) => b.yesDepth));
  const noMax = Math.max(1, ...visible.map((b) => b.noDepth));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div className="tc-ob-header">
        <div className="tc-ob-yes-label">{t("orderBook.buyYes")}</div>
        <div style={{ textAlign: "center" }}>{t("orderBook.price")}</div>
        <div className="tc-ob-no-label">{t("orderBook.buyNo")}</div>
      </div>
      {/* One ladder row per `yesOdds` — stable unique key without index. */}
      {visible.map((r) => (
        <Row key={`ob-${r.yesOdds}`} bucket={r} yesMax={yesMax} noMax={noMax} />
      ))}
    </div>
  );
}

function Row({ bucket: r, yesMax, noMax }: { bucket: Bucket; yesMax: number; noMax: number }) {
  const yesPct = r.yesDepth > 0 ? (r.yesDepth / yesMax) * 100 : 0;
  const noPct = r.noDepth > 0 ? (r.noDepth / noMax) * 100 : 0;

  return (
    <div className="tc-ob-row">
      <div className="tc-ob-bar tc-ob-bar-yes">
        <div className="tc-ob-bar-fill tc-ob-bar-fill-yes" style={{ width: `${yesPct}%` }} />
        {r.yesDepth > 0 && (
          <div className="tc-ob-bar-text tc-ob-bar-text-yes">
            <span className="tc-font-semibold">{r.yesDepth}</span>
            <span className="tc-text-muted">×{r.yesPayout.toFixed(2)}</span>
          </div>
        )}
      </div>
      <div className="tc-ob-price">
        <div className="tc-ob-price-yes">{r.yesOdds}%</div>
        <div className="tc-ob-price-no">{100 - r.yesOdds}%</div>
      </div>
      <div className="tc-ob-bar tc-ob-bar-no">
        <div className="tc-ob-bar-fill tc-ob-bar-fill-no" style={{ width: `${noPct}%` }} />
        {r.noDepth > 0 && (
          <div className="tc-ob-bar-text tc-ob-bar-text-no">
            <span className="tc-text-muted">×{r.noPayout.toFixed(2)}</span>
            <span className="tc-font-semibold">{r.noDepth}</span>
          </div>
        )}
      </div>
    </div>
  );
}
