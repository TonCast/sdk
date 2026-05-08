import { DEFAULT_ACCENT, type ThemeColorSet, type ThemeConfig } from "../types";

interface Props {
  theme: ThemeConfig;
  onChange: (t: ThemeConfig) => void;
}

const sectionLabelCls =
  "text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide";

/** Reusable color set editor (accent + background). */
function ColorSetEditor({
  label,
  value,
  onChange,
  defaultBg,
}: {
  label: string;
  value: ThemeColorSet;
  onChange: (v: ThemeColorSet) => void;
  defaultBg: string;
}) {
  const set = (key: keyof ThemeColorSet, val: string) =>
    onChange({ ...value, [key]: val });

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 space-y-3">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>

      {/* Accent */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-400">Accent</span>
          <span className="font-mono text-[10px] text-slate-500">{value.accent}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value.accent}
            onChange={(e) => set("accent", e.target.value)}
            className="w-8 h-8 rounded-md border border-slate-700 cursor-pointer bg-slate-800 p-0.5 shrink-0"
            aria-label={`${label} accent color`}
          />
          <input
            type="text"
            value={value.accent}
            onChange={(e) => set("accent", e.target.value)}
            placeholder={DEFAULT_ACCENT}
            className="flex-1 h-8 px-2.5 rounded-md border border-slate-700 bg-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:border-sky-500/50"
          />
          {value.accent !== DEFAULT_ACCENT && (
            <button
              type="button"
              onClick={() => set("accent", DEFAULT_ACCENT)}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Background */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-400">Background</span>
          <span className="text-[10px] text-slate-600">optional</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value.bg || defaultBg}
            onChange={(e) => set("bg", e.target.value)}
            className="w-8 h-8 rounded-md border border-slate-700 cursor-pointer bg-slate-800 p-0.5 shrink-0"
            aria-label={`${label} background color`}
          />
          <input
            type="text"
            value={value.bg}
            onChange={(e) => set("bg", e.target.value)}
            placeholder={defaultBg}
            className="flex-1 h-8 px-2.5 rounded-md border border-slate-700 bg-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:border-sky-500/50"
          />
          {value.bg && (
            <button
              type="button"
              onClick={() => set("bg", "")}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ThemeTab({ theme, onChange }: Props) {
  const set = <K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]) =>
    onChange({ ...theme, [key]: value });

  const showLight = theme.colorScheme === "light" || theme.colorScheme === "system";
  const showDark = theme.colorScheme === "dark" || theme.colorScheme === "system";

  return (
    <div className="space-y-5">
      {/* Color scheme */}
      <div>
        <p className={sectionLabelCls}>Color scheme</p>
        <div className="flex gap-2">
          {(
            [
              { value: "light", label: "Light", emoji: "☀️" },
              { value: "dark", label: "Dark", emoji: "🌙" },
              { value: "system", label: "System", emoji: "🖥️" },
            ] as const
          ).map(({ value, label, emoji }) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={theme.colorScheme === value}
              onClick={() => set("colorScheme", value)}
              className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all ${
                theme.colorScheme === value
                  ? "bg-sky-500/20 text-sky-300 border-sky-500/50"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
              }`}
            >
              {emoji} {label}
            </button>
          ))}
        </div>
        {theme.colorScheme === "system" && (
          <p className="mt-1.5 text-[10px] text-slate-600">
            Configure colors for each mode independently below.
          </p>
        )}
      </div>

      {/* Per-theme color editors */}
      <div className="space-y-3">
        {showLight && (
          <ColorSetEditor
            label="Light mode"
            value={theme.light}
            onChange={(v) => set("light", v)}
            defaultBg="#ffffff"
          />
        )}
        {showDark && (
          <ColorSetEditor
            label="Dark mode"
            value={theme.dark}
            onChange={(v) => set("dark", v)}
            defaultBg="#0f172a"
          />
        )}
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

      {/* Grid columns */}
      <div>
        <p className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
          Grid columns
          <span className="text-slate-500 normal-case font-normal">
            {theme.columns === 0 ? "auto" : `${theme.columns} col`}
          </span>
        </p>
        <div className="flex gap-1.5">
          {[
            { v: 0, label: "Auto" },
            { v: 1, label: "1" },
            { v: 2, label: "2" },
            { v: 3, label: "3" },
            { v: 4, label: "4" },
          ].map(({ v, label }) => (
            <button
              key={v}
              type="button"
              onClick={() => set("columns", v)}
              className={`flex-1 py-1.5 text-xs rounded border font-medium transition-all ${
                theme.columns === v
                  ? "bg-sky-500/20 text-sky-300 border-sky-500/50"
                  : "bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-slate-600">
          Auto adapts to container width. Fixed columns override responsive layout.
        </p>
      </div>

      {/* Width note */}
      <div className="rounded-lg bg-sky-900/20 border border-sky-800/40 px-3 py-2.5 text-xs text-sky-400">
        <strong>Width:</strong> responsive by default (<code>100%</code>, min 320px).
        Constrain via the container you pass to <code>mount()</code>.
      </div>
    </div>
  );
}
