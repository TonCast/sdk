import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@toncast/sdk";
import { useEffect, useMemo } from "react";
import { useWidgetConfig } from "../context";
import { useI18n } from "../i18n/I18nProvider";
import { useT } from "../i18n/useT";
import { useTcState } from "../tc-bridge";
import { shortAddr } from "../utils/format";
import { TonDiamond } from "./ui/TonDiamond";

function GlobeIcon() {
  return (
    <svg
      className="tc-lang-globe-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

const LANG_LABELS: Partial<Record<SupportedLanguage, string>> = {
  en: "EN",
  ru: "RU",
  hi: "HI",
  es: "ES",
  zh: "中文",
  pt: "PT",
  fr: "FR",
  de: "DE",
  fa: "FA",
  ar: "AR",
};

export function WidgetHeader() {
  const { lang, setLang } = useI18n();
  const t = useT();
  const { address, connect, disconnect, restored } = useTcState();
  const config = useWidgetConfig();
  const connected = Boolean(address);

  // Derive stable array — memoised to prevent the useEffect below firing on every render.
  // widget.languages === [] → hide picker entirely.
  // widget.languages === undefined → show all.
  const configuredLangs = config.widget?.languages;
  /** Stable key so inline `languages={[...]}` from the host does not retrigger effects every render. */
  const languagesKey =
    configuredLangs === undefined ? "__all__" : configuredLangs.slice().join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `languagesKey` fingerprints list contents so inline `languages={[...]}` from the host does not reallocate `availableLangs` every render; listing `configuredLangs` would defeat that.
  const availableLangs: SupportedLanguage[] = useMemo(
    () =>
      configuredLangs !== undefined
        ? configuredLangs
        : ([...SUPPORTED_LANGUAGES] as SupportedLanguage[]),
    [languagesKey],
  );

  const showPicker = availableLangs.length > 1;

  // Auto-reset to first available language if current is not in the list.
  useEffect(() => {
    const first = availableLangs[0];
    if (first && !availableLangs.includes(lang) && first !== lang) {
      setLang(first);
    }
  }, [availableLangs, lang, setLang]);

  return (
    <div className="tc-header">
      {/* Language picker */}
      {showPicker ? (
        <div className="tc-lang-wrapper">
          <GlobeIcon />
          <select
            className="tc-lang-select"
            value={lang}
            onChange={(e) => {
              const value = e.target.value as SupportedLanguage;
              if (availableLangs.includes(value)) setLang(value);
            }}
            aria-label={t("header.language")}
          >
            {availableLangs.map((l) => (
              <option key={l} value={l}>
                {LANG_LABELS[l] ?? l.toUpperCase()}
              </option>
            ))}
          </select>
          <svg
            className="tc-lang-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      ) : (
        <div />
      )}

      {/* Wallet connect — disabled while TonConnect restores session from localStorage */}
      <button
        type="button"
        onClick={connected ? disconnect : connect}
        className={`tc-header-connect${connected ? " tc-header-connected" : ""}`}
        disabled={!restored}
        aria-busy={!restored}
      >
        {!connected && <TonDiamond size={16} />}
        <span>{connected ? shortAddr(address) : t("wallet.connect")}</span>
      </button>
    </div>
  );
}
