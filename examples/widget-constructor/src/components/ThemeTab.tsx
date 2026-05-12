import { RADIUS_DEFAULT, RADIUS_MAX } from "@toncast/widget/constants";
import {
  DEFAULT_ACCENT,
  DEFAULT_DARK_COLORS,
  DEFAULT_LIGHT_COLORS,
  type ThemeColorSet,
  type ThemeConfig,
} from "../types";
import { ColorField } from "./ui/ColorField";
import { SegmentedButtonGroup } from "./ui/SegmentedButtonGroup";

interface Props {
  theme: ThemeConfig;
  onChange: (t: ThemeConfig) => void;
}

const sectionLabelCls = "text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide";

const COLOR_SCHEME_OPTIONS = [
  { value: "light", label: "Light", icon: "☀️" },
  { value: "dark", label: "Dark", icon: "🌙" },
  { value: "system", label: "System", icon: "🖥️" },
] as const;

const RADIUS_OPTIONS = [
  { value: 0, label: "0" },
  { value: 6, label: "6" },
  { value: RADIUS_DEFAULT, label: String(RADIUS_DEFAULT) },
  { value: 16, label: "16" },
  { value: 24, label: "24" },
] as const;

const DENSITY_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "default", label: "Default" },
  { value: "comfortable", label: "Comfort" },
] as const;

const GRID_DEVICES = [
  { key: "mobile", label: "Mobile" },
  { key: "tablet", label: "Tablet" },
  { key: "desktop", label: "Desktop" },
] as const;

const GRID_COLUMN_OPTIONS = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
  { value: 6, label: "6" },
] as const;

/** Reusable color set editor (brand + semantic colors). */
function ColorSetEditor({
  label,
  value,
  onChange,
  defaults,
}: {
  label: string;
  value: ThemeColorSet;
  onChange: (v: ThemeColorSet) => void;
  defaults: ThemeColorSet;
}) {
  const set = (key: keyof ThemeColorSet, val: string) => onChange({ ...value, [key]: val });

  return (
    <div className="min-w-0 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 space-y-3">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>

      <ColorField
        label="Accent"
        value={value.accent}
        defaultValue={DEFAULT_ACCENT}
        onChange={(v) => set("accent", v)}
      />
      <ColorField
        label="Background"
        value={value.bg ?? ""}
        placeholderHint={defaults.bg ?? "#ffffff"}
        onChange={(v) => set("bg", v)}
      />
      <ColorField
        label="Positive"
        value={value.success}
        defaultValue={defaults.success}
        onChange={(v) => set("success", v)}
      />
      <ColorField
        label="Negative"
        value={value.danger}
        defaultValue={defaults.danger}
        onChange={(v) => set("danger", v)}
      />
      <ColorField
        label="Warning"
        value={value.warn}
        defaultValue={defaults.warn}
        onChange={(v) => set("warn", v)}
      />
    </div>
  );
}

export function ThemeTab({ theme, onChange }: Props) {
  const set = <K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]) =>
    onChange({ ...theme, [key]: value });
  const setGrid = (key: keyof ThemeConfig["grid"], value: number) =>
    set("grid", { ...theme.grid, [key]: value });

  const showLight = theme.colorScheme === "light" || theme.colorScheme === "system";
  const showDark = theme.colorScheme === "dark" || theme.colorScheme === "system";

  return (
    <div className="space-y-5">
      {/* Color scheme */}
      <div>
        <p className={sectionLabelCls}>Color scheme</p>
        <SegmentedButtonGroup
          value={theme.colorScheme}
          onChange={(v) => set("colorScheme", v)}
          options={COLOR_SCHEME_OPTIONS}
          size="lg"
        />
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
            defaults={DEFAULT_LIGHT_COLORS}
          />
        )}
        {showDark && (
          <ColorSetEditor
            label="Dark mode"
            value={theme.dark}
            onChange={(v) => set("dark", v)}
            defaults={DEFAULT_DARK_COLORS}
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
        <div className="mb-2">
          <SegmentedButtonGroup
            value={theme.radius}
            onChange={(v) => set("radius", v)}
            options={RADIUS_OPTIONS}
            mono
            itemAriaLabel={(o) => `Border radius ${o.label} pixels`}
          />
        </div>
        <input
          id="tc-radius-range"
          type="range"
          min={0}
          max={RADIUS_MAX}
          value={theme.radius}
          onChange={(e) => set("radius", Number(e.target.value))}
          className="w-full accent-sky-500"
        />
        <p className="mt-1.5 text-[10px] text-slate-600">
          0–{RADIUS_MAX} px (matches export clamp).
        </p>
      </div>

      {/* Responsive grid columns */}
      <div>
        <p className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
          Responsive grid
          <span className="text-slate-500 normal-case font-normal">
            {theme.grid.mobile}/{theme.grid.tablet}/{theme.grid.desktop}
          </span>
        </p>
        <div className="space-y-2">
          {GRID_DEVICES.map(({ key, label }) => (
            <div key={key} className="grid grid-cols-[64px_1fr] items-center gap-2">
              <span className="text-[11px] text-slate-500">{label}</span>
              <SegmentedButtonGroup
                value={theme.grid[key]}
                onChange={(v) => setGrid(key, v)}
                options={GRID_COLUMN_OPTIONS}
                itemAriaLabel={(o) => `${label} grid ${o.label} columns`}
              />
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-slate-600">
          Used at &lt;480px, 480–759px, and 760px+ respectively.
        </p>
      </div>

      {/* Density */}
      <div>
        <p className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
          Density
          <span className="text-slate-500 normal-case font-normal">{theme.density}</span>
        </p>
        <SegmentedButtonGroup
          value={theme.density}
          onChange={(v) => set("density", v)}
          options={DENSITY_OPTIONS}
          itemAriaLabel={(o) => `Density ${o.label}`}
        />
        <p className="mt-1.5 text-[10px] text-slate-600">
          Changes core widget spacing while keeping the layout stable.
        </p>
      </div>

      {/* Width note */}
      <div className="rounded-lg bg-sky-900/20 border border-sky-800/40 px-3 py-2.5 text-xs text-sky-400">
        <strong>Width:</strong> responsive by default (<code>100%</code>, min 0). Constrain via the
        container you pass to <code>mount()</code>.
      </div>
    </div>
  );
}
