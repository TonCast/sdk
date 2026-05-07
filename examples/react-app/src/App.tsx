import { useEffect } from "react";
import { Link, Route, BrowserRouter as Router, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { HeaderMenu } from "./components/HeaderMenu";
import { useT } from "./lib/i18n/useT";
import { useTheme } from "./lib/theme";
import { PariDetailPage } from "./pages/PariDetail";
import { ParisListPage } from "./pages/ParisList";
import { UserBetsPage } from "./pages/UserBets";
import { Providers } from "./providers";

export function App() {
  return (
    <Providers>
      <Router>
        <Shell />
      </Router>
    </Providers>
  );
}

/** Inner shell — needs to live under `<Providers>` because `useTheme`
 *  reads from the ThemeProvider context. Toaster picks up the active
 *  theme too so its surface matches the rest of the UI. */
function Shell() {
  const { theme } = useTheme();
  const t = useT();
  return (
    // `overflow-x-hidden` on the root is a defensive belt-and-
    // suspenders: any rogue child with implicit min-width (long pari
    // titles, the slider primitive, the SVG chart on narrow viewports)
    // won't push the page wider than the viewport.
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
      <ScrollToTopOnNavigate />
      <header className="sticky top-0 z-40 border-b border-border/40 backdrop-blur-xl bg-background/60">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 py-3">
          <Link
            to="/"
            className="truncate min-w-0 bg-linear-to-r from-primary to-foreground bg-clip-text text-lg font-semibold tracking-tight text-transparent"
          >
            {t("header.title")}
          </Link>
          <HeaderMenu />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 min-w-0 px-2 py-4 sm:px-4 sm:py-6">
        <Routes>
          <Route path="/" element={<ParisListPage />} />
          <Route path="/p/:pariId" element={<PariDetailPage />} />
          <Route path="/bets" element={<UserBetsPage />} />
        </Routes>
      </main>
      <Toaster theme={theme} position="bottom-right" richColors />
    </div>
  );
}

/** SPA navigations preserve scroll by default — react-router doesn't reset it.
 *  This effect snaps the window back to the top whenever the route pathname
 *  changes (but not on hash-only changes, which would break in-page anchors). */
function ScrollToTopOnNavigate() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}
