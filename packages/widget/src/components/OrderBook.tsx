import { type OddsState, orderBookLadder } from "@toncast/sdk";
import { type NumberFormatters, useI18n } from "../i18n/I18nProvider";
import { useT } from "../i18n/useT";
import { SkeletonList } from "./ui/SkeletonList";

type Bucket = ReturnType<typeof orderBookLadder>[number];

export function OrderBook({ oddsState }: { oddsState: OddsState | null }) {
  const t = useT();
  const { fmt } = useI18n();

  if (!oddsState) {
    return (
      <div className="tc-ob" aria-hidden="true">
        <div className="tc-ob-header">
          <div className="tc-ob-yes-label">{t("orderBook.buyYes")}</div>
          <div className="tc-ob-price-label">{t("orderBook.price")}</div>
          <div className="tc-ob-no-label">{t("orderBook.buyNo")}</div>
        </div>
        <SkeletonList count={6} gap={4} itemStyle={{ height: 28, width: "100%" }} />
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
    <div className="tc-ob">
      <div className="tc-ob-header">
        <div className="tc-ob-yes-label">{t("orderBook.buyYes")}</div>
        <div className="tc-ob-price-label">{t("orderBook.price")}</div>
        <div className="tc-ob-no-label">{t("orderBook.buyNo")}</div>
      </div>
      {/* `fmt` lifted to the parent so each row reuses one context read instead
          of N (one per `<Row>`). Identity is stable per `lang`. */}
      {visible.map((r) => (
        <Row key={`ob-${r.yesOdds}`} bucket={r} yesMax={yesMax} noMax={noMax} fmt={fmt} />
      ))}
    </div>
  );
}

function Row({
  bucket: r,
  yesMax,
  noMax,
  fmt,
}: {
  bucket: Bucket;
  yesMax: number;
  noMax: number;
  fmt: NumberFormatters;
}) {
  const yesPct = r.yesDepth > 0 ? (r.yesDepth / yesMax) * 100 : 0;
  const noPct = r.noDepth > 0 ? (r.noDepth / noMax) * 100 : 0;

  return (
    <div className="tc-ob-row">
      <div className="tc-ob-bar tc-ob-bar-yes">
        <div className="tc-ob-bar-fill tc-ob-bar-fill-yes" style={{ width: `${yesPct}%` }} />
        {r.yesDepth > 0 && (
          <div className="tc-ob-bar-text tc-ob-bar-text-yes">
            <span className="tc-font-semibold">{r.yesDepth}</span>
            <span className="tc-text-muted">×{fmt.decimal(r.yesPayout)}</span>
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
            <span className="tc-text-muted">×{fmt.decimal(r.noPayout)}</span>
            <span className="tc-font-semibold">{r.noDepth}</span>
          </div>
        )}
      </div>
    </div>
  );
}
