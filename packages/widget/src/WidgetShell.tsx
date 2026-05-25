import { useQueryClient } from "@tanstack/react-query";
import { sameTonAddress } from "@toncast/sdk";
import { useTonConnectClient } from "@toncast/sdk-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { NavBar } from "./components/NavBar";
import { WidgetHeader } from "./components/WidgetHeader";
import { useNav } from "./context";
import { useT } from "./i18n/useT";
import { useStandaloneManifestOk, useTcState } from "./tc-bridge";
import { MyBetsView } from "./views/MyBets";
import { PariDetailView } from "./views/PariDetail";
import { ParisListView } from "./views/ParisList";

/** Inline alert when standalone `tonconnect.options.domain` is missing or not an absolute http(s) URL. */
function StandaloneDomainWarning() {
  const t = useT();
  return (
    <div role="alert" className="tc-standalone-domain-warning">
      {t("error.invalidStandaloneDomain")}
    </div>
  );
}

/** Internal router — syncs wallet state and renders the active view. */
export function WidgetShell() {
  const { view } = useNav();
  const { address } = useTcState();
  const standaloneManifestOk = useStandaloneManifestOk();
  const queryClient = useQueryClient();
  const contentRef = useRef<HTMLDivElement>(null);

  // delegate address→client sync to the canonical SDK hook (avoids duplication).
  useTonConnectClient(address || null);

  // Flush only user-scoped caches when the wallet changes. Public data
  // (paris list, categories, pari details) is wallet-agnostic and should
  // NOT be invalidated — doing so causes a visible blank-then-refetch cycle.
  const prevAddrRef = useRef<string | undefined>(address);
  useEffect(() => {
    const prev = prevAddrRef.current;
    if (prev === address || (prev && address && sameTonAddress(prev, address))) return;
    prevAddrRef.current = address;
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["toncast", "betting"] }),
      queryClient.invalidateQueries({ queryKey: ["toncast", "coins"] }),
    ]);
  }, [address, queryClient]);

  // Reset scroll position immediately before the browser paints so the new
  // view always starts at the top (no flash of the previous scroll position).
  // biome-ignore lint/correctness/useExhaustiveDependencies: view.name is an intentional trigger, not a consumed value
  useLayoutEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [view.name]);

  return (
    <div className="tc-shell">
      {!standaloneManifestOk && <StandaloneDomainWarning />}
      <WidgetHeader />
      <div ref={contentRef} className="tc-content">
        {view.name === "list" && <ParisListView />}
        {view.name === "detail" && <PariDetailView view={view} />}
        {view.name === "bets" && <MyBetsView />}
      </div>
      <NavBar />
    </div>
  );
}
