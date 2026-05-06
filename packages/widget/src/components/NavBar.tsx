import { useNav, type WidgetView } from "../context";
import { useT } from "../i18n/useT";

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3" y="5" width="18" height="2.5" rx="1" fill="currentColor" />
      <rect x="3" y="11" width="18" height="2.5" rx="1" fill="currentColor" />
      <rect x="3" y="17" width="18" height="2.5" rx="1" fill="currentColor" />
    </svg>
  );
}

function BetsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-4M9 3a2 2 0 0 0 4 0M9 3a2 2 0 0 1 4 0"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function isActive(view: WidgetView, name: string): boolean {
  return view.name === name || (name === "list" && view.name === "detail");
}

export function NavBar() {
  const t = useT();
  const { view, navigate } = useNav();

  return (
    <nav className="tc-nav" aria-label="Toncast widget navigation">
      <button
        type="button"
        className={`tc-nav-btn${isActive(view, "list") ? " tc-active" : ""}`}
        onClick={() => navigate({ name: "list" })}
        aria-current={isActive(view, "list") ? "page" : undefined}
      >
        <ListIcon />
        {t("nav.list")}
      </button>
      <button
        type="button"
        className={`tc-nav-btn${isActive(view, "bets") ? " tc-active" : ""}`}
        onClick={() => navigate({ name: "bets" })}
        aria-current={isActive(view, "bets") ? "page" : undefined}
      >
        <BetsIcon />
        {t("nav.bets")}
      </button>
    </nav>
  );
}
