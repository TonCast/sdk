import { type Bet, type BetStatus, pariCoverUrl } from "@toncast/sdk";
import { useInfiniteBets } from "@toncast/sdk-react";
import { ConnectButton } from "../components/ConnectButton";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { useNav } from "../context";
import type { TranslationKey } from "../i18n/translations";
import { useT } from "../i18n/useT";
import { useTcState } from "../tc-bridge";
import { MAX_RENDERED_BETS } from "./myBetsState";

const STATUS_CLASS: Record<BetStatus, string> = {
  placed: "tc-badge-placed",
  matched: "tc-badge-matched",
  won: "tc-badge-won",
  won_yes: "tc-badge-won",
  won_no: "tc-badge-won",
  lost: "tc-badge-lost",
  cancelled: "tc-badge-cancelled",
  refunded: "tc-badge-refunded",
};

function BetRow({ bet }: { bet: Bet }) {
  const t = useT();
  const { navigate } = useNav();
  const thumb = pariCoverUrl(bet.pariImage, "w=128,h=128,fit=cover,format=webp,quality=80");
  const amountTon = (bet.amount / 1e9).toFixed(2);
  const date = new Date(bet.createdAt * 1000).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="tc-card">
      <div className="tc-card-body">
        <div className="tc-bet-row">
          <button
            type="button"
            className="tc-bet-row-thumb"
            style={{ border: "none", cursor: "pointer", padding: 0, background: "none" }}
            onClick={() => navigate({ name: "detail", pariId: bet.pariAddress })}
          >
            {thumb ? (
              <img src={thumb} alt="" loading="lazy" />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "var(--tc-bg-muted)" }} />
            )}
          </button>
          <div className="tc-bet-row-body">
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span className={`tc-badge ${bet.isYes ? "tc-badge-yes" : "tc-badge-no"}`}>
                {t(bet.isYes ? "side.yes" : "side.no")}
              </span>
              <span className={`tc-badge ${STATUS_CLASS[bet.status]}`}>
                {t(`bet.status.${bet.status}` as TranslationKey)}
              </span>
            </div>
            {bet.pariName ? (
              <button
                type="button"
                className="tc-bet-row-name"
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  padding: 0,
                }}
                onClick={() => navigate({ name: "detail", pariId: bet.pariAddress })}
              >
                {bet.pariName}
              </button>
            ) : (
              <div className="tc-bet-row-meta" style={{ fontFamily: "monospace", fontSize: 11 }}>
                {bet.pariAddress}
              </div>
            )}
            <div className="tc-bet-row-meta">
              {t("bet.ticketsCount", { n: bet.ticketsCount })} · {amountTon} TON · {date}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MyBetsView() {
  const t = useT();
  const { address } = useTcState();
  const { back, canGoBack } = useNav();

  // userAddress must be part of the params so it is included in the TanStack Query
  // cache key — prevents stale data from a previous user flashing when a new wallet connects.
  const query = useInfiniteBets({ userAddress: address }, { enabled: Boolean(address) });
  const all = query.data?.pages.flatMap((page) => page.items).slice(0, MAX_RENDERED_BETS) ?? [];
  const hasMore = Boolean(query.hasNextPage && all.length < MAX_RENDERED_BETS);

  const isInitialLoading = query.isLoading && all.length === 0;
  const isLoadingMore = query.isFetchingNextPage;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {canGoBack && (
        <button type="button" className="tc-back-btn" onClick={back}>
          {t("page.paris.detail.back")}
        </button>
      )}
      <h2 className="tc-page-title">{t("page.bets.title")}</h2>

      {!address ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "32px 0",
          }}
        >
          <p className="tc-text-sm tc-text-muted" style={{ textAlign: "center" }}>
            {t("page.bets.connectPrompt")}
          </p>
          <ConnectButton />
        </div>
      ) : query.isError && all.length === 0 ? (
        <div className="tc-error">
          {t("page.bets.loadFailed", {
            error: query.error instanceof Error ? query.error.message : String(query.error),
          })}
        </div>
      ) : isInitialLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={String(i)} style={{ height: 80 }} />
          ))}
        </div>
      ) : all.length === 0 ? (
        <div className="tc-empty">{t("page.bets.empty")}</div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {all.map((bet) => (
              <BetRow key={bet.id} bet={bet} />
            ))}
          </div>
          {isLoadingMore && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={String(i)} style={{ height: 80 }} />
              ))}
            </div>
          )}
          {query.isError && all.length > 0 && (
            <div className="tc-error" style={{ fontSize: 12 }}>
              {t("page.bets.loadFailed", {
                error: query.error instanceof Error ? query.error.message : String(query.error),
              })}
            </div>
          )}
          {hasMore && !isLoadingMore && (
            <div className="tc-load-more-row">
              <Button
                variant="secondary"
                onClick={() => void query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {t("common.showMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
