import { transform } from "lightningcss";

/** Minifies widget stylesheet for `index.iife.css` in exported ZIP (Node / Vite only). */
export function minifyWidgetCss(css: string): string {
  const result = transform({
    filename: "index.iife.css",
    code: Buffer.from(css),
    minify: true,
  });
  return result.code.toString();
}
