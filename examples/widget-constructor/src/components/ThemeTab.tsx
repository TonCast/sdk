import { safeHexColor } from "@toncast/widget/color-math";
import { RADIUS_DEFAULT, RADIUS_MAX } from "@toncast/widget/constants";
import { useMemo, useState } from "react";
import {
  DEFAULT_ACCENT,
  DEFAULT_DARK_COLORS,
  DEFAULT_LIGHT_COLORS,
  type ThemeColorSet,
  type ThemeConfig,
} from "../types";
import { type ContrastLevel, checkAccentOnBg } from "../utils/contrastRatio";
import { effectiveAdvancedColors } from "../utils/effectiveAdvancedColors";
import { WIDGET_SHELL_BG } from "../utils/themeDefaults";
import {
  type ConstructorThemeChoice,
  colorSchemeToThemeSelection,
  GRID_COLUMN_OPTIONS_BY_DEVICE,
  selectionToColorScheme,
  toggleThemeSelection,
} from "../utils/themeRules";
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
] as const satisfies ReadonlyArray<{
  value: ConstructorThemeChoice;
  label: string;
  icon: string;
}>;

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

const GRID_COLUMN_OPTIONS_BY_DEVICE_UI = {
  mobile: GRID_COLUMN_OPTIONS_BY_DEVICE.mobile.map((value) => ({ value, label: String(value) })),
  tablet: GRID_COLUMN_OPTIONS_BY_DEVICE.tablet.map((value) => ({ value, label: String(value) })),
  desktop: GRID_COLUMN_OPTIONS_BY_DEVICE.desktop.map((value) => ({ value, label: String(value) })),
} as const;

const CONTRAST_BADGE: Record<ContrastLevel, string> = {
  pass: "bg-emerald-900/30 text-emerald-400 border-emerald-700/50",
  warn: "bg-amber-900/30 text-amber-400 border-amber-700/50",
  fail: "bg-red-900/30 text-red-400 border-red-700/50",
};

function ContrastBadge({ accent, bg }: { accent: string; bg: string }) {
  const check = checkAccentOnBg(accent, bg);
  if (check.ratio === null) return null;
  const label =
    check.level === "pass"
      ? `Contrast OK (${check.ratio.toFixed(1)}:1)`
      : check.level === "warn"
        ? `Low contrast (${check.ratio.toFixed(1)}:1, aim ≥4.5:1)`
        : `Poor contrast (${check.ratio.toFixed(1)}:1)`;
  return (
    <p
      className={`text-[10px] px-2 py-1 rounded border ${CONTRAST_BADGE[check.level]}`}
      role="status"
    >
      {label}
    </p>
  );
}

/** Reusable color set editor (brand + semantic colors). */
function ColorSetEditor({
  label,
  value,
  onChange,
  defaults,
  mode,
}: {
  label: string;
  value: ThemeColorSet;
  onChange: (v: ThemeColorSet) => void;
  defaults: ThemeColorSet;
  mode: "light" | "dark";
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const set = (key: keyof ThemeColorSet, val: string) => onChange({ ...value, [key]: val });
  const shellBg = (value.bg?.trim() && safeHexColor(value.bg)) || WIDGET_SHELL_BG[mode];
  const effective = useMemo(() => effectiveAdvancedColors(value, mode), [value, mode]);

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
        placeholderHint={defaults.bg || WIDGET_SHELL_BG[mode]}
        onChange={(v) => set("bg", v)}
      />
      <ContrastBadge accent={value.accent} bg={shellBg} />
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

      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300"
        >
          Advanced {advancedOpen ? "▾" : "▸"}
        </button>
        {advancedOpen && (
          <div className="mt-2 space-y-3 pt-2 border-t border-slate-700/60">
            <ColorField
              label="Text"
              value={value.fg ?? ""}
              previewColor={effective.fg}
              placeholderHint="Derived from background"
              onChange={(v) => set("fg", v)}
            />
            <ColorField
              label="Muted text"
              value={value.fgMuted ?? ""}
              previewColor={effective.fgMuted}
              placeholderHint="Derived from background"
              onChange={(v) => set("fgMuted", v)}
            />
            <ColorField
              label="Border"
              value={value.border ?? ""}
              previewColor={effective.border}
              placeholderHint="Derived from background"
              onChange={(v) => set("border", v)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function ThemeTab({ theme, onChange }: Props) {
  const set = <K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]) =>
    onChange({ ...theme, [key]: value });
  const setGrid = (key: keyof ThemeConfig["grid"], value: number) =>
    set("grid", { ...theme.grid, [key]: value });

  const themeSelection = colorSchemeToThemeSelection(theme.colorScheme);
  const activeThemeChoices = COLOR_SCHEME_OPTIONS.filter(
    (option) => themeSelection[option.value],
  ).map((option) => option.value);
  const showLight = theme.colorScheme === "light" || theme.colorScheme === "system";
  const showDark = theme.colorScheme === "dark" || theme.colorScheme === "system";

  return (
    <div className="space-y-5">
      {/* Color scheme */}
      <div>
        <p className={sectionLabelCls}>Color scheme</p>
        <SegmentedButtonGroup
          multi
          value={activeThemeChoices}
          onChange={(values) => {
            const toggled = COLOR_SCHEME_OPTIONS.reduce(
              (selection, option) =>
                selection[option.value] === values.includes(option.value)
                  ? selection
                  : toggleThemeSelection(selection, option.value),
              themeSelection,
            );
            set("colorScheme", selectionToColorScheme(toggled));
          }}
          options={COLOR_SCHEME_OPTIONS}
          size="lg"
        />
        {theme.colorScheme === "system" && (
          <p className="mt-1.5 text-[10px] text-slate-600">
            Auto-switches between both palettes with prefers-color-scheme.
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
            mode="light"
          />
        )}
        {showDark && (
          <ColorSetEditor
            label="Dark mode"
            value={theme.dark}
            onChange={(v) => set("dark", v)}
            defaults={DEFAULT_DARK_COLORS}
            mode="dark"
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
            <div key={key} className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2">
              <span className="text-[11px] text-slate-500">{label}</span>
              <SegmentedButtonGroup
                value={theme.grid[key]}
                onChange={(v) => setGrid(key, v)}
                options={GRID_COLUMN_OPTIONS_BY_DEVICE_UI[key]}
                itemAriaLabel={(o) => `${label} grid ${o.label} columns`}
              />
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-slate-600">
          Used at &lt;480px, 480–759px, and 760px+ respectively.
        </p>
        <p className="mt-1 text-[10px] text-slate-600 leading-snug">
          With <strong>2–3 columns on Mobile</strong>, YES/NO buttons on each card stack in a single
          column (widget sets{" "}
          <code className="text-slate-500">--tc-pari-mobile-actions-columns</code>
          ).
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
