import type { ThemeConfig } from "../types";

interface Props {
  theme: ThemeConfig;
  onChange: (t: ThemeConfig) => void;
}

export function ThemeTab({ theme, onChange }: Props) {
  const set = <K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]) =>
    onChange({ ...theme, [key]: value });

  return (
    <div className="space-y-5">
      {/* Color scheme */}
      <div>
        <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
          Color scheme
        </p>
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set("colorScheme", s)}
              className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all ${
                theme.colorScheme === s
                  ? "bg-sky-500/20 text-sky-300 border-sky-500/50"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
              }`}
            >
              {s === "light" ? "☀️ Light" : s === "dark" ? "🌙 Dark" : "🖥️ System"}
            </button>
          ))}
        </div>
      </div>

      {/* Accent color */}
      <div>
        <label
          htmlFor="tc-accent-color"
          className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide"
        >
          Accent color
          <span className="font-mono text-slate-500 normal-case">{theme.accent}</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            id="tc-accent-color"
            type="color"
            value={theme.accent}
            onChange={(e) => set("accent", e.target.value)}
            className="w-9 h-9 rounded-lg border border-slate-700 cursor-pointer bg-slate-800 p-0.5 shrink-0"
            aria-label="Accent color picker"
          />
          <input
            id="tc-accent-text"
            type="text"
            value={theme.accent}
            onChange={(e) => set("accent", e.target.value)}
            placeholder="#0098ea"
            className="flex-1 h-9 px-3 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:border-sky-500/50 focus:bg-slate-900"
          />
          <button
            type="button"
            onClick={() => set("accent", "#0098ea")}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors whitespace-nowrap"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Background color */}
      <div>
        <label
          htmlFor="tc-bg-text"
          className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide"
        >
          Background
          <span className="text-slate-600 normal-case font-normal">optional</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={theme.bg || (theme.colorScheme === "dark" ? "#0f172a" : "#ffffff")}
            onChange={(e) => set("bg", e.target.value)}
            className="w-9 h-9 rounded-lg border border-slate-700 cursor-pointer bg-slate-800 p-0.5 shrink-0"
            aria-label="Background color picker"
          />
          <input
            id="tc-bg-text"
            type="text"
            value={theme.bg}
            onChange={(e) => set("bg", e.target.value)}
            placeholder={theme.colorScheme === "dark" ? "#0f172a" : theme.colorScheme === "system" ? "auto" : "#ffffff"}
            className="flex-1 h-9 px-3 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:border-sky-500/50"
          />
          {theme.bg && (
            <button
              type="button"
              onClick={() => set("bg", "")}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Border radius */}
      <div>
        <label
          htmlFor="tc-radius-range"
          className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide"
        >
          Border radius
          <span className="font-mono text-slate-500 normal-case">{theme.radius}px</span>
        </label>
        <div className="flex gap-1.5 mb-2">
          {[
            { v: 0, label: "0" },
            { v: 6, label: "6" },
            { v: 12, label: "12" },
            { v: 16, label: "16" },
            { v: 24, label: "24" },
          ].map(({ v, label }) => (
            <button
              key={v}
              type="button"
              onClick={() => set("radius", v)}
              className={`flex-1 py-1.5 text-xs rounded border font-mono font-medium transition-all ${
                theme.radius === v
                  ? "bg-sky-500/20 text-sky-300 border-sky-500/50"
                  : "bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          id="tc-radius-range"
          type="range"
          min={0}
          max={24}
          value={theme.radius}
          onChange={(e) => set("radius", Number(e.target.value))}
          className="w-full accent-sky-500"
        />
      </div>

      {/* Width note */}
      <div className="rounded-lg bg-sky-900/20 border border-sky-800/40 px-3 py-2.5 text-xs text-sky-400">
        <strong>Width:</strong> responsive by default (<code>100%</code>, min 320px).
        Constrain via the container you pass to <code>mount()</code>.
      </div>
    </div>
  );
}
