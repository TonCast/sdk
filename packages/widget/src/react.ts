/**
 * React component entry point — safe to import in Vite/webpack builds.
 * Does NOT include ToncastWidget class (which embeds CSS as text string
 * via esbuild loader and is only safe in IIFE/CDN builds).
 */
export { Widget } from "./Widget";
export type { ToncastWidgetConfig, TonConnectDescriptor, ClientDescriptor } from "./types";
