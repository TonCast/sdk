import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@toncast/sdk";
import { useEffect, useMemo } from "react";
import { useWidgetConfig } from "../context";
import { useI18n } from "../i18n/I18nProvider";
import { useT } from "../i18n/useT";
import { useTcState } from "../tc-bridge";
import { shortAddr } from "../utils/format";

function GlobeIcon() {
  return (
    <svg
      width="13"
      height="13"
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

function TonDiamondSmall() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.1839 17.7069C13.6405 18.6507 13.3688 19.1226 13.0591 19.348C12.4278 19.8074 11.5723 19.8074 10.941 19.348C10.6312 19.1226 10.3595 18.6507 9.81613 17.7069L5.52066 10.2464C4.76864 8.94024 4.39263 8.28717 4.33762 7.75894C4.2255 6.68236 4.81894 5.65591 5.80788 5.21589C6.29309 5 7.04667 5 8.55383 5H15.4462C16.9534 5 17.7069 5 18.1922 5.21589C19.1811 5.65591 19.7745 6.68236 19.6624 7.75894C19.6074 8.28717 19.2314 8.94024 18.4794 10.2464L14.1839 17.7069ZM11.1 16.3412L6.56139 8.48002C6.31995 8.06185 6.19924 7.85276 6.18146 7.68365C6.14523 7.33896 6.33507 7.01015 6.65169 6.86919C6.80703 6.80002 7.04847 6.80002 7.53133 6.80002H7.53134L11.1 6.80002V16.3412ZM12.9 16.3412L17.4387 8.48002C17.6801 8.06185 17.8008 7.85276 17.8186 7.68365C17.8548 7.33896 17.665 7.01015 17.3484 6.86919C17.193 6.80002 16.9516 6.80002 16.4687 6.80002L12.9 6.80002V16.3412Z"
        fill="white"
      />
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
  const { address, connect, disconnect } = useTcState();
  const config = useWidgetConfig();
  const connected = Boolean(address);

  // Derive stable array — memoised to prevent the useEffect below firing on every render.
  // widget.languages === [] → hide picker entirely.
  // widget.languages === undefined → show all.
  const configuredLangs = config.widget?.languages;
  const availableLangs: SupportedLanguage[] = useMemo(
    () =>
      configuredLangs !== undefined
        ? configuredLangs
        : (SUPPORTED_LANGUAGES as unknown as SupportedLanguage[]),
    [configuredLangs],
  );

  const showPicker = availableLangs.length > 1;

  // Auto-reset to first available language if current is not in the list.
  useEffect(() => {
    const first = availableLangs[0];
    if (first && !availableLangs.includes(lang)) {
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
            onChange={(e) => setLang(e.target.value as SupportedLanguage)}
            aria-label="Language"
            style={{ paddingLeft: 22 }}
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

      {/* Wallet connect */}
      <button
        type="button"
        onClick={connected ? disconnect : connect}
        className={`tc-header-connect${connected ? " tc-header-connected" : ""}`}
      >
        {!connected && <TonDiamondSmall />}
        <span>{connected ? shortAddr(address) : t("wallet.connect")}</span>
      </button>
    </div>
  );
}
