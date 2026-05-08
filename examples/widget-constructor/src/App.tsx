import { Address } from "@ton/core";
import { useEffect, useState } from "react";
import { ConfigTab } from "./components/ConfigTab";
import { ExportTab } from "./components/ExportTab";
import { LivePreview } from "./components/LivePreview";
import { ThemeTab } from "./components/ThemeTab";
import { type ConstructorConfig, DEFAULT_CONFIG, type Device, type ThemeConfig } from "./types";

type Tab = "theme" | "config" | "export";

const VALID_DENSITIES: ThemeConfig["density"][] = ["compact", "default", "comfortable"];
const VALID_SCHEMES: ThemeConfig["colorScheme"][] = ["light", "dark", "system"];

/** Normalizes constructor domain: trim, require absolute http(s) URL or empty. */
function normalizeDomain(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_CONFIG.domain;
  const s = raw.trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? s : "";
  } catch {
    return "";
  }
}

/** Trim; valid addresses only; normalize to **non-bounceable** user-facing form (typically `UQ…`). */
function normalizeReferralAddress(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";
  try {
    return Address.parse(s).toString({ bounceable: false, urlSafe: true });
  } catch {
    return "";
  }
}

/** Coerces a persisted config into a well-typed, bounded ConstructorConfig. */
function normalizeConfig(parsed: Partial<ConstructorConfig>): ConstructorConfig {
  const t = parsed.theme;
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    // Ensure array fields are actually arrays (null/undefined from corrupt storage crashes .length)
    languages: Array.isArray(parsed.languages) ? parsed.languages : DEFAULT_CONFIG.languages,
    referralPct: Number.isFinite(Number(parsed.referralPct))
      ? Math.min(7, Math.max(0, Number(parsed.referralPct)))
      : DEFAULT_CONFIG.referralPct,
    domain: normalizeDomain(parsed.domain),
    referralAddress: normalizeReferralAddress(parsed.referralAddress),
    theme: {
      ...DEFAULT_CONFIG.theme,
      ...t,
      colorScheme: VALID_SCHEMES.includes(t?.colorScheme as ThemeConfig["colorScheme"])
        ? (t?.colorScheme as ThemeConfig["colorScheme"])
        : DEFAULT_CONFIG.theme.colorScheme,
      density: VALID_DENSITIES.includes(t?.density as ThemeConfig["density"])
        ? (t?.density as ThemeConfig["density"])
        : DEFAULT_CONFIG.theme.density,
      radius: Number.isFinite(Number(t?.radius))
        ? Math.min(64, Math.max(0, Number(t?.radius)))
        : DEFAULT_CONFIG.theme.radius,
      columns: Number.isFinite(Number(t?.columns))
        ? Math.min(4, Math.max(0, Math.round(Number(t?.columns))))
        : DEFAULT_CONFIG.theme.columns,
      light: { ...DEFAULT_CONFIG.theme.light, ...(t?.light ?? {}) },
      dark: { ...DEFAULT_CONFIG.theme.dark, ...(t?.dark ?? {}) },
    },
  };
}

const TABS: { id: Tab; label: string }[] = [
  { id: "theme", label: "Theme" },
  { id: "config", label: "Config" },
  { id: "export", label: "Export" },
];

const DEVICES: { id: Device; label: string; width: string; icon: string; previewLabel: string }[] =
  [
    {
      id: "mobile",
      label: "370px",
      width: "370px",
      icon: "📱",
      previewLabel: "Mobile, 370 pixels wide",
    },
    {
      id: "tablet",
      label: "768px",
      width: "768px",
      icon: "📟",
      previewLabel: "Tablet, 768 pixels wide",
    },
    { id: "desktop", label: "100%", width: "100%", icon: "🖥", previewLabel: "Desktop, full width" },
  ];

const STORAGE_KEY = "tc-constructor-config-v2";

/** Loads config from localStorage, normalizing types to prevent runtime crashes. */
function loadConfig(): ConstructorConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizeConfig(JSON.parse(raw) as Partial<ConstructorConfig>);
    }
  } catch {
    // Corrupted storage — reset silently.
  }
  return DEFAULT_CONFIG;
}

export function App() {
  const [config, setConfig] = useState<ConstructorConfig>(loadConfig);
  const [tab, setTab] = useState<Tab>("theme");
  const [device, setDevice] = useState<Device>("mobile");

  // Persist config changes to localStorage.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // QuotaExceeded / private mode — skip silently.
    }
  }, [config]);

  const handleReset = () => {
    if (window.confirm("Reset all settings to defaults?")) {
      setConfig(DEFAULT_CONFIG);
    }
  };

  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const nextTab = TABS[tabIndex + 1];

  return (
    <div className="flex h-full overflow-hidden bg-slate-950 text-slate-200">
      {/* ── Left: settings panel ── */}
      <aside className="w-72 shrink-0 flex flex-col border-r border-slate-800 bg-slate-950">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="text-sm font-bold text-slate-100 leading-tight">
            Toncast Widget Constructor
          </div>
          <div className="text-xs text-slate-500 mt-0.5">configure · preview · export</div>
        </div>

        {/* Tab bar */}
        <div role="tablist" className="flex border-b border-slate-800 bg-slate-900/50">
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-all ${
                tab === t.id
                  ? "text-sky-400 border-b-2 border-sky-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content — scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-4">
            {tab === "theme" && (
              <ThemeTab
                theme={config.theme}
                onChange={(theme) => setConfig((c) => ({ ...c, theme }))}
              />
            )}
            {tab === "config" && <ConfigTab config={config} onChange={setConfig} />}
            {tab === "export" && <ExportTab config={config} />}
          </div>
        </div>

        {/* Footer nav */}
        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
            title="Reset all settings to defaults"
          >
            Reset
          </button>
          {tab !== "export" ? (
            <button
              type="button"
              onClick={() => {
                const order: Tab[] = ["theme", "config", "export"];
                const next = order[order.indexOf(tab) + 1];
                if (next) setTab(next);
              }}
              className="text-xs text-sky-400 hover:text-sky-300 transition-colors font-medium"
            >
              Next: {nextTab?.label ?? ""} →
            </button>
          ) : (
            <a
              href="https://docs.toncast.app/widget"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-500 hover:text-sky-400 transition-colors"
            >
              Docs →
            </a>
          )}
        </div>
      </aside>

      {/* ── Right: live preview ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Preview toolbar */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-slate-800 bg-slate-950">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Live Preview
          </span>
          <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800">
            {DEVICES.map((d) => (
              <button
                key={d.id}
                type="button"
                aria-label={d.previewLabel}
                onClick={() => setDevice(d.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  device === d.id
                    ? "bg-slate-700 text-slate-100 shadow"
                    : "text-slate-500 hover:text-slate-300"
                }`}
                title={d.label}
              >
                <span aria-hidden="true">{d.icon}</span>
                <span>{d.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Preview canvas */}
        <div className="flex-1 overflow-auto flex items-start justify-center p-8 bg-slate-950/80">
          <div
            style={{
              width: DEVICES.find((d) => d.id === device)?.width ?? "100%",
              maxWidth: "100%",
              transition: "width 0.3s ease",
            }}
          >
            <LivePreview config={config} deviceMode={device} />
          </div>
        </div>
      </div>
    </div>
  );
}
