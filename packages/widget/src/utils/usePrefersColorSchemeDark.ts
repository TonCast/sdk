import { useSyncExternalStore } from "react";

/**
 * Subscribes to OS `prefers-color-scheme: dark` media query.
 * SSR-safe: returns `false` on the server.
 */
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
