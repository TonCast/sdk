import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@toncast/sdk";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWidgetConfig } from "../context";
import { useI18n } from "../i18n/I18nProvider";
import { useT } from "../i18n/useT";
import { useTcState } from "../tc-bridge";
import { copyToClipboard } from "../utils/copyToClipboard";
import { shortAddr } from "../utils/format";
import { TonDiamond } from "./ui/TonDiamond";

function CopyIcon() {
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

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
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [copied, setCopied] = useState<"idle" | "ok" | "err">("idle");
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties | null>(null);
  const walletRef = useRef<HTMLDivElement>(null);
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

  /**
   * Calculates the viewport-relative position for the popover and stores it
   * as CSS custom properties so the `position:fixed` popover appears directly
   * below the wallet button regardless of any overflow:hidden ancestor.
   */
  const openPopover = useCallback(() => {
    if (walletRef.current) {
      const rect = walletRef.current.getBoundingClientRect();
      const POPOVER_MIN_W = 180;
      const GAP = 6;
      const left = Math.max(4, rect.right - POPOVER_MIN_W);
      setPopoverStyle({
        "--tc-wallet-popover-top": `${rect.bottom + GAP}px`,
        "--tc-wallet-popover-left": `${left}px`,
      } as React.CSSProperties);
    }
    setPopoverOpen(true);
  }, []);

  useEffect(() => {
    if (!popoverOpen) return;
    const close = () => setPopoverOpen(false);
    const onMouseDown = (e: MouseEvent) => {
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    // Close on any scroll or resize so the fixed popover doesn't drift.
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [popoverOpen]);

  const handleCopy = useCallback(() => {
    copyToClipboard(address).then((ok) => {
      setCopied(ok ? "ok" : "err");
      setTimeout(() => setCopied("idle"), 1500);
    });
  }, [address]);

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

      {/* Wallet connect / wallet popover */}
      <div className="tc-wallet-wrapper" ref={walletRef}>
        <button
          type="button"
          onClick={connected ? (popoverOpen ? () => setPopoverOpen(false) : openPopover) : connect}
          className={`tc-header-connect${connected ? " tc-header-connected" : ""}`}
          aria-label={connected ? t("wallet.options") : undefined}
          aria-expanded={connected ? popoverOpen : undefined}
          aria-haspopup={connected ? "dialog" : undefined}
          disabled={!restored}
          aria-busy={!restored}
        >
          {!connected && <TonDiamond size={16} />}
          <span>{connected ? shortAddr(address) : t("wallet.connect")}</span>
        </button>

        {connected && popoverOpen && (
          <div
            className="tc-wallet-popover"
            role="dialog"
            aria-label={t("wallet.options")}
            style={popoverStyle ?? undefined}
          >
            <div className="tc-wallet-popover-addr">
              <span className="tc-wallet-popover-addr-text" title={address}>
                {shortAddr(address)}
              </span>
              <button
                type="button"
                className="tc-wallet-popover-copy"
                aria-label={t("wallet.copyAddress")}
                onClick={handleCopy}
              >
                {copied === "ok" ? "✓" : copied === "err" ? "✗" : <CopyIcon />}
              </button>
            </div>
            <button
              type="button"
              className="tc-wallet-popover-disconnect"
              onClick={() => {
                disconnect();
                setPopoverOpen(false);
              }}
            >
              {t("wallet.disconnect")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
