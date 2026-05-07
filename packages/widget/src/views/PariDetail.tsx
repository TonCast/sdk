import { DEFAULT_PARI_CHART_PARAMS, type Pari, pariCoverUrl } from "@toncast/sdk";
import { useSubscribe } from "@toncast/sdk-react";
import { useState } from "react";
import { BetCard } from "../components/BetCard";
import { CoefficientChart } from "../components/CoefficientChart";
import { OrderBook } from "../components/OrderBook";
import { Skeleton } from "../components/ui/Skeleton";
import { useNav, useOnBet, type WidgetView } from "../context";
import { useT } from "../i18n/useT";

function isSettledOutcome(pari: Pari): boolean {
  const r = pari.result.trim().toLowerCase();
  return r === "yes" || r === "no" || r === "draw";
}

function ExpandableDescription({ text }: { text: string }) {
  const t = useT();
  const PREVIEW = 160;
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > PREVIEW;

  return (
    <div>
      <p className="tc-detail-desc">
        {needsTruncation && !expanded ? `${text.slice(0, PREVIEW).trimEnd()}…` : text}
      </p>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 4,
            fontSize: 12,
            color: "var(--tc-accent)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {expanded ? t("common.showLess") : t("common.showMore")}
        </button>
      )}
    </div>
  );
}

function OutcomeBanner({ pari }: { pari: Pari }) {
  const t = useT();
  const raw = pari.result.trim();
  const r = raw === "" ? "pending" : raw.toLowerCase();

  if (r === "yes" || r === "no" || r === "draw") {
    const label =
      r === "yes" ? t("pari.result.yes") : r === "no" ? t("pari.result.no") : t("pari.result.draw");
    const cls = r === "yes" ? "tc-outcome-yes" : r === "no" ? "tc-outcome-no" : "tc-outcome-muted";
    return (
      <div className={cls}>
        <div className="tc-outcome-title">{t("pari.result.title")}</div>
        <div className="tc-outcome-value">{label}</div>
      </div>
    );
  }

  if (r === "pending" && pari.status === "inactive") {
    return (
      <div className="tc-outcome-muted" style={{ fontSize: 12 }}>
        {t("pari.result.pendingInactive")}
      </div>
    );
  }

  if (r !== "pending") {
    return (
      <div className="tc-outcome-muted" style={{ fontSize: 12 }}>
        {t("pari.result.unknown", { result: raw })}
      </div>
    );
  }

  return null;
}

export function PariDetailView({ view }: { view: Extract<WidgetView, { name: "detail" }> }) {
  const t = useT();
  const { back } = useNav();
  const onBet = useOnBet();
  const {
    data: snap,
    isLoading,
    isError,
    error,
  } = useSubscribe(view.pariId, DEFAULT_PARI_CHART_PARAMS);

  if (isError) {
    return (
      <div>
        <button type="button" className="tc-back-btn" onClick={back}>
          {t("page.paris.detail.back")}
        </button>
        <div className="tc-error">
          {t("page.paris.detail.failed", { error: (error as Error).message })}
        </div>
      </div>
    );
  }

  const img = snap?.pari
    ? pariCoverUrl(snap.pari.image, "w=600,h=600,fit=contain,format=webp,quality=90")
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <button type="button" className="tc-back-btn" onClick={back}>
        {t("page.paris.detail.back")}
      </button>

      {/* Hero card */}
      {isLoading || !snap?.pari ? (
        <Skeleton style={{ height: 220, borderRadius: "var(--tc-radius)" }} />
      ) : (
        <div className="tc-card">
          {img && (
            <div className="tc-detail-img-wrapper">
              <div className="tc-detail-img-blur" style={{ backgroundImage: `url(${img})` }} />
              <img src={img} alt="" loading="eager" className="tc-detail-img" />
            </div>
          )}
          <div
            className="tc-card-body"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <h2 className="tc-detail-title">{snap.pari.name}</h2>
              <span className="tc-badge tc-badge-default" style={{ flexShrink: 0 }}>
                {snap.pari.status}
              </span>
            </div>
            <ExpandableDescription text={snap.pari.description} />
            <div className="tc-detail-meta">
              <span>
                YES vol <strong>{snap.pari.yesVolume.toFixed(2)} TON</strong>
              </span>
              <span>
                NO vol <strong>{snap.pari.noVolume.toFixed(2)} TON</strong>
              </span>
              {snap.pari.bestYesOdds !== null && (
                <span>
                  best YES <strong>{snap.pari.bestYesOdds}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {snap?.pari ? <OutcomeBanner pari={snap.pari} /> : null}

      {/* Bet card */}
      {snap?.pari && isSettledOutcome(snap.pari) ? (
        <div className="tc-notice tc-notice-muted">{t("pari.bettingClosed")}</div>
      ) : (
        <div className="tc-card">
          <BetCard
          pariId={view.pariId}
          initialSide={view.initialSide}
          onBetSent={onBet}
        />
        </div>
      )}

      {/* Chart */}
      <div className="tc-card tc-card-body">
        <CoefficientChart history={snap?.coefficientHistory ?? []} />
      </div>

      {/* Order book */}
      <div className="tc-card">
        <div className="tc-card-header">
          <div className="tc-card-title">{t("orderBook.title")}</div>
        </div>
        <div className="tc-card-body">
          <OrderBook oddsState={snap?.oddsState ?? null} />
        </div>
      </div>
    </div>
  );
}
