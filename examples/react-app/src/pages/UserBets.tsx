// Flat list of every bet the connected user has ever placed, newest first.
// Uses cursor pagination: first page via `useBets()`, subsequent pages via
// the same hook with the `nextCursor` threaded through local state.
//
// Duplicate-append guard: once a cursor key has been processed we skip it,
// so TanStack window-focus refetches don't double-push items.

import { type Bet, type BetStatus, type Cursor, pariCoverUrl } from "@toncast/sdk";
import { useBets } from "@toncast/sdk-react";
import { useTonAddress } from "@tonconnect/ui-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n/useT";
import type { TranslationKey } from "@/lib/i18n/translations";
import { ConnectButton } from "@/components/ConnectButton";

function cursorKey(c: Cursor | null): string {
  return c === null ? "__initial__" : JSON.stringify(c);
}

export function UserBetsPage() {
  const t = useT();
  const userAddress = useTonAddress();

  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [all, setAll] = useState<Bet[]>([]);
  const [nextCursor, setNextCursor] = useState<Cursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  // Tracks which cursors have already been appended — prevents duplicate rows
  // on TanStack refetches (window focus, reconnect) of the same page.
  const appendedRef = useRef(new Set<string>());

  const query = useBets(cursor !== null ? { cursor } : {}, {
    enabled: Boolean(userAddress),
  });

  useEffect(() => {
    if (!query.data) return;
    const key = cursorKey(cursor);
    if (appendedRef.current.has(key)) return;
    appendedRef.current.add(key);
    setNextCursor(query.data.nextCursor);
    setHasMore(query.data.hasMore);
    setAll((prev) => (cursor === null ? query.data!.items : [...prev, ...query.data!.items]));
  }, [query.data, cursor]);

  // Reset everything when the wallet switches.
  const prevAddrRef = useRef(userAddress);
  useEffect(() => {
    if (prevAddrRef.current === userAddress) return;
    prevAddrRef.current = userAddress;
    setCursor(null);
    setAll([]);
    setNextCursor(null);
    setHasMore(false);
    appendedRef.current.clear();
  }, [userAddress]);

  if (!userAddress) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("page.bets.title")}</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">{t("page.bets.connectPrompt")}</p>
            <ConnectButton />
          </CardContent>
        </Card>
      </div>
    );
  }

  const isInitialLoading = query.isLoading && all.length === 0;
  const isLoadingMore = query.isFetching && all.length > 0;

  if (query.isError && all.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("page.bets.title")}</h1>
        <Card>
          <CardContent className="pt-6 text-destructive">
            {t("page.bets.loadFailed", {
              error: query.error instanceof Error ? query.error.message : String(query.error),
            })}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("page.bets.title")}</h1>

      {isInitialLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={String(i)} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : all.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("page.bets.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {all.map((bet) => (
            <BetRow key={bet.id} bet={bet} />
          ))}

          {isLoadingMore && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={String(i)} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          )}

          {hasMore && !isLoadingMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setCursor(nextCursor)}
                disabled={query.isFetching}
              >
                {t("common.showMore")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const BET_ROW_THUMB_VARIANT = "w=128,h=128,fit=cover,format=webp,quality=80";

function BetRow({ bet }: { bet: Bet }) {
  const t = useT();
  const isYes = bet.isYes;
  const amountTon = (bet.amount / 1e9).toFixed(2);
  const date = new Date(bet.createdAt * 1000).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const thumbSrc = pariCoverUrl(bet.pariImage, BET_ROW_THUMB_VARIANT);
  const pariPath = `/p/${encodeURIComponent(bet.pariAddress)}`;

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-3 px-3 py-3 sm:px-4">
        {/* Cover thumbnail */}
        <Link
          to={pariPath}
          className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={bet.pariName ?? bet.pariAddress}
        >
          {thumbSrc ? (
            <img src={thumbSrc} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <div className="size-full bg-muted" />
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isYes
                  ? "bg-success/15 text-success"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              {t(isYes ? "side.yes" : "side.no")}
            </span>
          </div>
          {bet.pariName ? (
            <Link
              to={pariPath}
              className="mt-1 block text-sm font-medium leading-snug hover:underline line-clamp-3"
            >
              {bet.pariName}
            </Link>
          ) : (
            <span className="mt-1 block font-mono text-xs text-muted-foreground line-clamp-3">
              {bet.pariAddress}
            </span>
          )}
          <div className="mt-1 text-xs text-muted-foreground">
            {bet.ticketsCount} {bet.ticketsCount === 1 ? "ticket" : "tickets"} · {amountTon} TON · {date}
          </div>
        </div>

        <div className="shrink-0">
          <StatusBadge status={bet.status} />
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_STYLES: Record<BetStatus, string> = {
  placed: "bg-muted text-muted-foreground",
  matched: "bg-primary/15 text-primary",
  won: "bg-success/15 text-success",
  won_yes: "bg-success/15 text-success",
  won_no: "bg-success/15 text-success",
  lost: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
};

function StatusBadge({ status }: { status: BetStatus }) {
  const t = useT();
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {t(`bet.status.${status}` as TranslationKey)}
    </span>
  );
}
