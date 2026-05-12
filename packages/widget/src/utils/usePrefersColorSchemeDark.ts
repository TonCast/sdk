import { useSyncExternalStore } from "react";

export type UsePrefersColorSchemeDarkOptions = {
  /**
   * When false, the hook always returns false and does not subscribe (use when
   * the widget theme is not `"system"`).
   */
  enabled?: boolean;
  /** Value returned from `getServerSnapshot` while `theme === "system"`. */
  serverSnapshot?: boolean;
};

/**
 * Subscribes to OS `prefers-color-scheme: dark` when `enabled` is true.
 * SSR: when enabled, uses `serverSnapshot`; when disabled, returns false on the server.
 */
export function usePrefersColorSchemeDark(opts?: UsePrefersColorSchemeDarkOptions): boolean {
  const enabled = opts?.enabled ?? true;
  const serverSnapshot = opts?.serverSnapshot ?? false;

  return useSyncExternalStore(
    (onStoreChange) => {
      if (!enabled || typeof window === "undefined") {
        return () => {};
      }
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => {
      if (!enabled || typeof window === "undefined") {
        return false;
      }
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    },
    () => (enabled ? serverSnapshot : false),
  );
}
