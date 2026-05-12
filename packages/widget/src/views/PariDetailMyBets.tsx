import type { Bet } from "@toncast/sdk";
import { useInfiniteBets } from "@toncast/sdk-react";
import { BetRowBadges, BetRowBetSummary } from "../components/bet/BetRowDisplay";
import { Button } from "../components/ui/Button";
import { SkeletonList } from "../components/ui/SkeletonList";
import { useT } from "../i18n/useT";
import { MAX_RENDERED_BETS } from "./myBetsState";

/** One card: only bet fields (side, status, stake, date). */
function PariDetailBetCard({ bet }: { bet: Bet }) {
  return (
    <div className="tc-card">
      <div className="tc-card-body">
        <div className="tc-bet-row">
          <div className="tc-bet-row-body">
            <BetRowBadges bet={bet} />
            <BetRowBetSummary bet={bet} />
          </div>
        </div>
      </div>
    </div>
  );
}

type PariDetailMyBetsProps = { pariId: string; userAddress: string };

/** User bets on the open pari; parent mounts only when `userAddress` is set. */
export function PariDetailMyBets({ pariId, userAddress }: PariDetailMyBetsProps) {
  const t = useT();
  const query = useInfiniteBets(
    { userAddress, pariId },
    { enabled: Boolean(userAddress && pariId) },
  );
  const all = query.data?.pages.flatMap((page) => page.items).slice(0, MAX_RENDERED_BETS) ?? [];
  const hasMore = Boolean(query.hasNextPage && all.length < MAX_RENDERED_BETS);
  const isInitialLoading = query.isLoading && all.length === 0;
  const isLoadingMore = query.isFetchingNextPage;

  return (
    <div className="tc-card">
      <div className="tc-card-header">
        <div className="tc-card-title">{t("page.paris.detail.myBetsTitle")}</div>
      </div>
      <div className="tc-card-body">
        {query.isError && all.length === 0 ? (
          <div className="tc-error">
            {t("page.paris.detail.myBetsLoadFailed", {
              error: query.error instanceof Error ? query.error.message : String(query.error),
            })}
          </div>
        ) : isInitialLoading ? (
          <SkeletonList count={3} itemStyle={{ height: 72 }} />
        ) : all.length === 0 ? (
          <div className="tc-empty">{t("page.paris.detail.myBetsEmpty")}</div>
        ) : (
          <>
            <div className="tc-form-col-sm">
              {all.map((bet) => (
                <PariDetailBetCard key={bet.id} bet={bet} />
              ))}
            </div>
            {isLoadingMore && <SkeletonList count={2} itemStyle={{ height: 72 }} />}
            {query.isError && all.length > 0 && (
              <div className="tc-error-sm">
                {t("page.paris.detail.myBetsLoadFailed", {
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
    </div>
  );
}
