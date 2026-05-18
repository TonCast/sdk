import { useEffect, useState } from "react";
import { ConfigTab } from "./components/ConfigTab";
import { ExportTab } from "./components/ExportTab";
import { LivePreview } from "./components/LivePreview";
import { ThemeTab } from "./components/ThemeTab";
import { type ConstructorConfig, DEFAULT_CONFIG, type Device } from "./types";
import { previewBackdropFromConfig } from "./utils/generateZip";
import { normalizeConfig } from "./utils/normalizeConfig";
import { usePrefersColorSchemeDark } from "./utils/usePrefersColorSchemeDark";

type Tab = "theme" | "config" | "export";

const TABS: { id: Tab; label: string }[] = [
  { id: "theme", label: "Theme" },
  { id: "config", label: "Config" },
  { id: "export", label: "Export" },
];

const DEVICES: {
  id: Device;
  width: string;
  icon: string;
  previewLabel: string;
}[] = [
  {
    id: "mobile",
    width: "370px",
    icon: "📱",
    previewLabel: "Mobile, 370 pixels wide",
  },
  {
    id: "tablet",
    width: "640px",
    icon: "📟",
    previewLabel: "Tablet, 640 pixels wide",
  },
  {
    id: "desktop",
    width: "100%",
    icon: "🖥",
    previewLabel: "Desktop, full width",
  },
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
  const prefersDark = usePrefersColorSchemeDark();
  const previewBackdrop = previewBackdropFromConfig(config, prefersDark);

  // Persist config changes to localStorage.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // QuotaExceeded / private mode — skip silently.
    }
  }, [config]);

  const handleResetAll = () => {
    if (window.confirm("Reset all settings (Theme + Config) to defaults?")) {
      setConfig(DEFAULT_CONFIG);
    }
  };

  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const nextTab = TABS[tabIndex + 1];

  return (
    <div className="flex h-full overflow-hidden bg-slate-950 text-slate-200">
      {/* ── Left: settings panel ── */}
      <aside className="w-88 shrink-0 flex flex-col border-r border-slate-800 bg-slate-950">
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
        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleResetAll}
            className="text-xs font-medium px-2 py-1.5 rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors shrink-0"
            title="Theme, Config, manifest fields, API URLs, referral — full defaults"
          >
            Reset all
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
        <div className="flex flex-col border-b border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-6 py-2.5">
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
                  title={d.width}
                >
                  <span aria-hidden="true">{d.icon}</span>
                  <span>{d.width}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="px-6 pb-2 text-[10px] text-slate-600 leading-snug">
            Card frame (shadow, fixed height) is for this tool only. Exported ZIP and CDN embeds use
            a full-viewport shell without the preview frame.
          </p>
        </div>

        {/* Preview canvas */}
        <div
          className="flex-1 overflow-auto flex items-start justify-center p-8"
          style={{ backgroundColor: previewBackdrop }}
        >
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
