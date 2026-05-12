import { useSyncExternalStore } from "react";

/** Tracks OS dark mode (for System color scheme in preview / backdrop). */
export function usePrefersColorSchemeDark(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
}
