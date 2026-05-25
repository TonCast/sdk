import {
  DEFAULT_BASE_URL,
  DEFAULT_WS_URL,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@toncast/sdk";
import { parseHttpUrl, stripTrailingSlashes } from "@toncast/widget/url";
import { type ConstructorConfig, resetConfigTabToDefaults } from "../types";
import {
  normalizeApiBaseUrl,
  normalizeApiWsUrl,
  normalizeReferralAddress,
} from "../utils/normalizeConfig";
import { PillButton } from "./ui/PillButton";
import { SegmentedButtonGroup } from "./ui/SegmentedButtonGroup";
import { TextFieldRow } from "./ui/TextFieldRow";

const LANGUAGES: { code: SupportedLanguage; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
  { code: "hi", label: "हिन्दी" },
  { code: "es", label: "Español" },
  { code: "zh", label: "中文" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "fa", label: "فارسی" },
  { code: "ar", label: "العربية" },
];

const SUPPORTED_LANGUAGES_SET = new Set<string>(SUPPORTED_LANGUAGES);

function isSupportedLanguage(v: string): v is SupportedLanguage {
  return SUPPORTED_LANGUAGES_SET.has(v);
}

const LANGUAGE_OPTIONS: ReadonlyArray<{
  value: SupportedLanguage;
  label: string;
}> = LANGUAGES.map((l) => ({ value: l.code, label: l.code.toUpperCase() }));

const REFERRAL_PCT_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  0, 1, 2, 3, 4, 5, 6, 7,
].map((p) => ({ value: p, label: p === 0 ? "Off" : `${p}%` }));

interface Props {
  config: ConstructorConfig;
  onChange: (c: ConstructorConfig) => void;
}

const labelCls = "block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide";

export function ConfigTab({ config, onChange }: Props) {
  const set = <K extends keyof ConstructorConfig>(key: K, value: ConstructorConfig[K]) =>
    onChange({ ...config, [key]: value });

  /**
   * Toggling a language preserves the default-language selection only while
   * that language is still part of the allowed set; otherwise the controlled
   * <select> would mismatch.
   */
  const onLanguagesChange = (next: SupportedLanguage[]) => {
    const defaultStillValid =
      !config.language || next.length === 0 || next.includes(config.language);
    onChange({
      ...config,
      languages: next,
      language: defaultStillValid ? config.language : "",
    });
  };

  const allSelected = config.languages.length === 0;
  const domainValid = parseHttpUrl(config.domain) !== null;

  const apiBaseUrlInvalid =
    config.apiBaseUrl.trim() !== "" && !normalizeApiBaseUrl(config.apiBaseUrl);
  const apiWsUrlInvalid = config.apiWsUrl.trim() !== "" && !normalizeApiWsUrl(config.apiWsUrl);
  const iconUrlInvalid = config.iconUrl.trim() !== "" && !parseHttpUrl(config.iconUrl);
  const referralAddressValid =
    config.referralAddress.trim() !== "" && normalizeReferralAddress(config.referralAddress) !== "";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-800/80">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">
          Config
        </span>
        <button
          type="button"
          onClick={() => {
            if (
              !window.confirm(
                "Reset Config (domain, API URLs, manifest, languages, referral) to defaults? Theme is unchanged.",
              )
            ) {
              return;
            }
            onChange(resetConfigTabToDefaults(config));
          }}
          className="text-[10px] font-medium px-2 py-1 rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
          title="Domain, API URLs, manifest, languages, referral — theme is unchanged"
        >
          Reset section
        </button>
      </div>

      <TextFieldRow
        id="tc-domain"
        label="App domain"
        type="url"
        value={config.domain}
        onChange={(v) => set("domain", v)}
        placeholder="https://your-app.com"
        required
        hint={
          config.domain && domainValid ? (
            <div className="bg-slate-800/50 rounded px-2 py-1 font-mono break-all text-slate-500">
              {stripTrailingSlashes(config.domain)}/tonconnect-manifest.json
            </div>
          ) : config.domain ? (
            <span className="text-red-400">
              Must be an absolute URL, e.g. <span className="font-mono">https://your-app.com</span>
            </span>
          ) : (
            "Leave empty — preview uses Toncast dev manifest."
          )
        }
      />

      <TextFieldRow
        id="tc-api-base-url"
        label="Toncast API base URL"
        type="url"
        value={config.apiBaseUrl}
        onChange={(v) => set("apiBaseUrl", v)}
        placeholder={DEFAULT_BASE_URL}
        hint={
          apiBaseUrlInvalid ? (
            <span className="text-red-400">
              Must be an absolute https:// URL, e.g.{" "}
              <span className="font-mono">{DEFAULT_BASE_URL}</span>
            </span>
          ) : (
            "Leave empty for the public Toncast API. Override only for staging or self-hosted API."
          )
        }
      />

      <TextFieldRow
        id="tc-api-ws-url"
        label="Toncast WebSocket origin (optional)"
        type="url"
        value={config.apiWsUrl}
        onChange={(v) => set("apiWsUrl", v)}
        placeholder={DEFAULT_WS_URL}
        hint={
          apiWsUrlInvalid ? (
            <span className="text-red-400">
              Must be an absolute wss:// URL, e.g.{" "}
              <span className="font-mono">{DEFAULT_WS_URL}</span>
            </span>
          ) : (
            `Leave empty — WS is derived from the API URL (e.g. ${DEFAULT_BASE_URL} → ${DEFAULT_WS_URL}). Override only if streams live on another host.`
          )
        }
      />

      <TextFieldRow
        id="tc-app-name"
        label="App name"
        value={config.appName}
        onChange={(v) => set("appName", v)}
        placeholder="My App"
        hint="Shown in wallet connection dialogs (tonconnect-manifest.json)."
      />

      <TextFieldRow
        id="tc-icon-url"
        label="App icon URL"
        type="url"
        value={config.iconUrl}
        onChange={(v) => set("iconUrl", v)}
        placeholder="https://your-app.com/icon-192.png"
        hint={
          iconUrlInvalid ? (
            <span className="text-red-400">
              Must be an absolute https:// URL, e.g.{" "}
              <span className="font-mono">https://your-app.com/icon-192.png</span>
            </span>
          ) : (
            "Square PNG ≥ 180×180px for TonConnect wallet dialogs."
          )
        }
      />

      {/* Available languages */}
      <div>
        <p className={labelCls}>Available languages</p>
        <p className="text-[10px] text-slate-600 mb-2">
          Select which languages appear in the widget picker. All = show all.
          {config.languages.length === 1 ? (
            <span className="block mt-1 text-amber-500/90">
              One language hides the in-widget picker — add more to show the selector again.
            </span>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <PillButton active={allSelected} compact onClick={() => set("languages", [])}>
            All
          </PillButton>
          <SegmentedButtonGroup<SupportedLanguage>
            multi
            options={LANGUAGE_OPTIONS}
            value={allSelected ? [] : config.languages}
            onChange={onLanguagesChange}
            compact
            wrap
            itemAriaLabel={(o) => LANGUAGES.find((l) => l.code === o.value)?.label ?? o.label}
          />
        </div>
      </div>

      {/* Default language */}
      <div>
        <label htmlFor="tc-language" className={labelCls}>
          Default language
        </label>
        <select
          id="tc-language"
          value={config.language}
          onChange={(e) => {
            const v = e.target.value;
            set("language", isSupportedLanguage(v) ? v : "");
          }}
          className="w-full h-9 px-3 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-xs focus:outline-none focus:border-sky-500/50"
        >
          <option value="">Auto-detect (navigator.language)</option>
          {(config.languages.length > 0
            ? LANGUAGES.filter((l) => config.languages.includes(l.code))
            : LANGUAGES
          ).map((l) => (
            <option key={l.code} value={l.code}>
              {l.label} ({l.code})
            </option>
          ))}
        </select>
      </div>

      <TextFieldRow
        id="tc-referral-addr"
        label="Referral address"
        value={config.referralAddress}
        onChange={(v) => set("referralAddress", v)}
        placeholder="EQB_yourTONwalletAddress..."
        mono
        hint="Your TON wallet — receives a % share of every winner's payout."
      />

      {/* Referral pct */}
      <div>
        <p className={labelCls}>
          Referral %
          {config.referralPct > 0 && (
            <span className="ml-1.5 text-sky-400 normal-case font-normal">
              {config.referralPct}% of winnings
            </span>
          )}
        </p>
        <SegmentedButtonGroup
          options={REFERRAL_PCT_OPTIONS}
          value={config.referralPct}
          onChange={(v) => set("referralPct", v)}
          mono
          compact
          wrap
          isDisabled={(o) => o.value > 0 && !config.referralAddress}
          itemAriaLabel={(o) => (o.value === 0 ? "Disable referral" : `${o.value}% referral`)}
        />
        {!config.referralAddress && (
          <p className="mt-1.5 text-[10px] text-slate-600">Enter address above to earn fees.</p>
        )}
        {config.referralAddress && !referralAddressValid && (
          <p className="mt-1.5 text-[10px] text-red-400">
            Invalid TON address — referral will not be included in export.
          </p>
        )}
        {referralAddressValid && config.referralPct > 0 && (
          <p className="mt-1.5 text-[10px] text-emerald-500">
            ✓ Every winner pays {config.referralPct}% to your wallet.
          </p>
        )}
      </div>
    </div>
  );
}
