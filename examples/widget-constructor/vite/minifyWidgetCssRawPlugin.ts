import { readFile } from "node:fs/promises";
import type { Plugin } from "vite";
import { minifyWidgetCss } from "../src/utils/minifyWidgetCss";

const WIDGET_CSS_RAW_RE = /[/\\]widget\.css\?raw$/;

/** Minifies `widget.css?raw` at bundle time so ZIP export stays small in the browser. */
export function minifyWidgetCssRawPlugin(): Plugin {
  return {
    name: "minify-widget-css-raw",
    enforce: "pre",
    async load(id) {
      if (!WIDGET_CSS_RAW_RE.test(id)) return;
      const filePath = id.replace(/\?raw$/, "");
      const css = await readFile(filePath, "utf8");
      return {
        code: `export default ${JSON.stringify(minifyWidgetCss(css))}`,
      };
    },
  };
}
