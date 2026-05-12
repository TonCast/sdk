/**
 * Shared hex color parsing and derivation for runtime cssVars and static exports (ZIP).
 * Hex-only: non-hex CSS values are not interpreted here.
 */

export function parseHexColor(value: string): [number, number, number] | null {
  const hex = value.trim();
  const short = /^#([\da-fA-F])([\da-fA-F])([\da-fA-F])$/.exec(hex);
  if (short) {
    return [
      Number.parseInt(`${short[1]}${short[1]}`, 16),
      Number.parseInt(`${short[2]}${short[2]}`, 16),
      Number.parseInt(`${short[3]}${short[3]}`, 16),
    ];
  }

  const full = /^#([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})$/.exec(hex);
  if (!full) return null;
  return [
    Number.parseInt(full[1] ?? "0", 16),
    Number.parseInt(full[2] ?? "0", 16),
    Number.parseInt(full[3] ?? "0", 16),
  ];
}

/** Accepts only 3- or 6-digit hex (#rgb / #rrggbb) — same set {@link parseHexColor} handles. */
export function safeHexColor(value: string): string | null {
  const trimmed = value.trim();
  return /^#([\da-fA-F]{3}|[\da-fA-F]{6})$/.test(trimmed) ? trimmed : null;
}

export function rgba(value: string, alpha: number): string | null {
  const rgb = parseHexColor(value);
  if (!rgb) return null;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Whether `value` reads as a light surface (luminance > 0.55).
 * **Hex-only:** returns `false` when the string is not `#rgb` / `#rrggbb`.
 */
export function isLightColor(value: string): boolean {
  const rgb = parseHexColor(value);
  if (!rgb) return false;
  return relativeLuminance(rgb) > 0.55;
}

export function readableFg(
  value: string,
  lightFg = "#0f172a",
  darkFg = "#ffffff",
): string | null {
  const rgb = parseHexColor(value);
  if (!rgb) return null;
  return relativeLuminance(rgb) > 0.55 ? lightFg : darkFg;
}

export function mix(
  value: string,
  target: [number, number, number],
  weight: number,
): string | null {
  const rgb = parseHexColor(value);
  if (!rgb) return null;
  const mixed = rgb.map((channel, i) => {
    const targetChannel = target[i] ?? 0;
    return Math.round(channel * (1 - weight) + targetChannel * weight);
  });
  return `#${mixed.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}
