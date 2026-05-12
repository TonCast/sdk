import type { SupportedLanguage } from "@toncast/sdk";
import type { ConstructorConfig } from "../types";

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

interface Props {
  config: ConstructorConfig;
  onChange: (c: ConstructorConfig) => void;
}

const inputCls =
  "w-full h-9 px-3 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-xs focus:outline-none focus:border-sky-500/50 placeholder:text-slate-600";

const labelCls = "block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide";

export function ConfigTab({ config, onChange }: Props) {
  const set = <K extends keyof ConstructorConfig>(key: K, value: ConstructorConfig[K]) =>
    onChange({ ...config, [key]: value });

  const toggleLang = (code: SupportedLanguage) => {
    const current = config.languages;
    const next = current.includes(code) ? current.filter((l) => l !== code) : [...current, code];
    // If the current default language is no longer in the allowed set, clear it
    // so the <select> doesn't become uncontrolled (unmatched controlled value).
    const defaultStillValid =
      !config.language || next.length === 0 || next.includes(config.language);
    onChange({
      ...config,
      languages: next,
      language: defaultStillValid ? config.language : "",
    });
  };

  const allSelected = config.languages.length === 0;

  return (
    <div className="space-y-5">
      {/* Domain */}
      <div>
        <label htmlFor="tc-domain" className={labelCls}>
          App domain
          <span className="ml-1 text-red-400 normal-case font-normal">*</span>
        </label>
        <input
          id="tc-domain"
          type="url"
          value={config.domain}
          onChange={(e) => set("domain", e.target.value)}
          placeholder="https://your-app.com"
          className={inputCls}
        />
        {config.domain &&
          (() => {
            let valid = false;
            try {
              const u = new URL(config.domain);
              valid = u.protocol === "https:" || u.protocol === "http:";
            } catch {
              /* invalid */
            }
            return valid ? (
              <div className="mt-1.5 text-[10px] text-slate-500 bg-slate-800/50 rounded px-2 py-1 font-mono break-all">
                {config.domain.replace(/\/$/, "")}/tonconnect-manifest.json
              </div>
            ) : (
              <p className="mt-1 text-[10px] text-red-400">
                Must be an absolute URL, e.g.{" "}
                <span className="font-mono">https://your-app.com</span>
              </p>
            );
          })()}
        {!config.domain && (
          <p className="mt-1 text-[10px] text-slate-600">
            Leave empty — preview uses Toncast dev manifest.
          </p>
        )}
      </div>

      {/* Toncast API base URL */}
      <div>
        <label htmlFor="tc-api-base-url" className={labelCls}>
          Toncast API base URL
        </label>
        <input
          id="tc-api-base-url"
          type="url"
          value={config.apiBaseUrl}
          onChange={(e) => set("apiBaseUrl", e.target.value)}
          placeholder="https://api.toncast.app"
          className={inputCls}
        />
        <p className="mt-1 text-[10px] text-slate-600">
          Optional. Use only for staging or a custom Toncast API deployment.
        </p>
      </div>

      {/* App name */}
      <div>
        <label htmlFor="tc-app-name" className={labelCls}>
          App name
        </label>
        <input
          id="tc-app-name"
          type="text"
          value={config.appName}
          onChange={(e) => set("appName", e.target.value)}
          placeholder="My App"
          className={inputCls}
        />
        <p className="mt-1 text-[10px] text-slate-600">
          Shown in wallet connection dialogs (tonconnect-manifest.json).
        </p>
      </div>

      {/* Icon URL */}
      <div>
        <label htmlFor="tc-icon-url" className={labelCls}>
          App icon URL
        </label>
        <input
          id="tc-icon-url"
          type="url"
          value={config.iconUrl}
          onChange={(e) => set("iconUrl", e.target.value)}
          placeholder="https://your-app.com/icon-192.png"
          className={inputCls}
        />
        <p className="mt-1 text-[10px] text-slate-600">
          Square PNG ≥ 180×180px for TonConnect wallet dialogs.
        </p>
      </div>

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
          {/* "All" toggle */}
          <button
            type="button"
            onClick={() => set("languages", [])}
            className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
              allSelected
                ? "bg-sky-500/20 text-sky-300 border-sky-500/50"
                : "bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-500"
            }`}
          >
            All
          </button>
          {LANGUAGES.map((l) => {
            const active = !allSelected && config.languages.includes(l.code);
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => toggleLang(l.code)}
                className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
                  active
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/50"
                    : "bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-500"
                }`}
                title={l.label}
              >
                {l.code.toUpperCase()}
              </button>
            );
          })}
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
          onChange={(e) => set("language", e.target.value as SupportedLanguage | "")}
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

      {/* Referral address */}
      <div>
        <label htmlFor="tc-referral-addr" className={labelCls}>
          Referral address
        </label>
        <input
          id="tc-referral-addr"
          type="text"
          value={config.referralAddress}
          onChange={(e) => set("referralAddress", e.target.value)}
          placeholder="EQB_yourTONwalletAddress..."
          className={`${inputCls} font-mono`}
        />
        <p className="mt-1 text-[10px] text-slate-600">
          Your TON wallet — receives a % share of every winner's payout.
        </p>
      </div>

      {/* Referral pct — button row */}
      <div>
        <p className={labelCls}>
          Referral %
          {config.referralPct > 0 && (
            <span className="ml-1.5 text-sky-400 normal-case font-normal">
              {config.referralPct}% of winnings
            </span>
          )}
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((p) => {
            const active = config.referralPct === p;
            const disabled = p > 0 && !config.referralAddress;
            return (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => set("referralPct", p)}
                className={`min-w-[36px] px-2 py-1.5 rounded text-xs font-bold border transition-all disabled:opacity-25 ${
                  active
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/50"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200"
                }`}
              >
                {p === 0 ? "Off" : `${p}%`}
              </button>
            );
          })}
        </div>
        {!config.referralAddress && (
          <p className="mt-1.5 text-[10px] text-slate-600">Enter address above to earn fees.</p>
        )}
        {config.referralAddress && config.referralPct > 0 && (
          <p className="mt-1.5 text-[10px] text-emerald-500">
            ✓ Every winner pays {config.referralPct}% to your wallet.
          </p>
        )}
      </div>
    </div>
  );
}
