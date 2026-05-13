import { type Bet, pariCoverUrl } from "@toncast/sdk";
import { useInfiniteBets } from "@toncast/sdk-react";
import { BetRowBadges, BetRowBetSummary } from "../components/bet/BetRowDisplay";
import { ConnectButton } from "../components/ConnectButton";
import { ConnectPromptCard } from "../components/ConnectPromptCard";
import { Button } from "../components/ui/Button";
import { SkeletonList } from "../components/ui/SkeletonList";
import { useNav } from "../context";
import { useT } from "../i18n/useT";
import { useTcState } from "../tc-bridge";
import { useReliablePariCoverUrl } from "../utils/useReliablePariCoverUrl";
import { MAX_RENDERED_BETS } from "./myBetsState";

function BetRow({ bet }: { bet: Bet }) {
  const { navigate } = useNav();
  const thumb = pariCoverUrl(bet.pariImage, "w=128,h=128,fit=cover,format=webp,quality=80");
  const { displaySrc, onImgError } = useReliablePariCoverUrl(thumb);

  return (
    <div className="tc-card">
      <div className="tc-card-body">
        <div className="tc-bet-row">
          <button
            type="button"
            className="tc-bet-row-thumb tc-bet-row-thumb-btn"
            onClick={() => navigate({ name: "detail", pariId: bet.pariAddress })}
          >
            {displaySrc ? (
              <img src={displaySrc} alt="" loading="lazy" onError={onImgError} />
            ) : (
              <div className="tc-bet-row-thumb-placeholder" />
            )}
          </button>
          <div className="tc-bet-row-body">
            <BetRowBadges bet={bet} />
            {bet.pariName ? (
              <button
                type="button"
                className="tc-bet-row-name tc-bet-row-name-btn"
                onClick={() => navigate({ name: "detail", pariId: bet.pariAddress })}
              >
                {bet.pariName}
              </button>
            ) : (
              <div className="tc-bet-row-meta tc-bet-row-meta-mono">{bet.pariAddress}</div>
            )}
            <BetRowBetSummary bet={bet} />
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
    <div className="tc-form-col-sm">
      {canGoBack && (
        <button type="button" className="tc-back-btn" onClick={back}>
          {t("page.paris.detail.back")}
        </button>
      )}
      <h2 className="tc-page-title">{t("page.bets.title")}</h2>

      {!address ? (
        <ConnectPromptCard text={t("page.bets.connectPrompt")} action={<ConnectButton />} />
      ) : query.isError && all.length === 0 ? (
        <div className="tc-error">
          {t("page.bets.loadFailed", {
            error: query.error instanceof Error ? query.error.message : String(query.error),
          })}
        </div>
      ) : isInitialLoading ? (
        <SkeletonList count={5} itemStyle={{ height: 80 }} />
      ) : all.length === 0 ? (
        <div className="tc-empty">{t("page.bets.empty")}</div>
      ) : (
        <>
          <div className="tc-form-col-sm">
            {all.map((bet) => (
              <BetRow key={bet.id} bet={bet} />
            ))}
          </div>
          {isLoadingMore && <SkeletonList count={3} itemStyle={{ height: 80 }} />}
          {query.isError && all.length > 0 && (
            <div className="tc-error-sm">
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
                {t("pagination.loadMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
