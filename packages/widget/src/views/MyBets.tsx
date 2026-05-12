import { type Bet, type BetStatus, pariCoverUrl } from "@toncast/sdk";
import { useInfiniteBets } from "@toncast/sdk-react";
import { ConnectButton } from "../components/ConnectButton";
import { ConnectPromptCard } from "../components/ConnectPromptCard";
import { Button } from "../components/ui/Button";
import { SkeletonList } from "../components/ui/SkeletonList";
import { useNav } from "../context";
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
            className="tc-bet-row-thumb tc-bet-row-thumb-btn"
            onClick={() => navigate({ name: "detail", pariId: bet.pariAddress })}
          >
            {thumb ? (
              <img src={thumb} alt="" loading="lazy" />
            ) : (
              <div className="tc-bet-row-thumb-placeholder" />
            )}
          </button>
          <div className="tc-bet-row-body">
            <div className="tc-bet-row-badges">
              <span className={`tc-badge ${bet.isYes ? "tc-badge-yes" : "tc-badge-no"}`}>
                {t(bet.isYes ? "side.yes" : "side.no")}
              </span>
              <span className={`tc-badge ${STATUS_CLASS[bet.status]}`}>
                {t(`bet.status.${bet.status}`)}
              </span>
            </div>
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
                {t("common.showMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
