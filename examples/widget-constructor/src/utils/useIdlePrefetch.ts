import { useEffect } from "react";

/** Runs `task` when the browser is idle; falls back to the next macrotask. Returns cancel. */
function scheduleIdleTask(task: () => void, timeoutMs: number): () => void {
  let cancelled = false;
  const run = () => {
    if (!cancelled) task();
  };

  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(run, { timeout: timeoutMs });
    return () => {
      cancelled = true;
      cancelIdleCallback(id);
    };
  }

  const id = window.setTimeout(run, 0);
  return () => {
    cancelled = true;
    clearTimeout(id);
  };
}

/** Prefetch a code-split chunk after first paint without blocking interaction. */
export function useIdlePrefetch(load: () => Promise<unknown>, timeoutMs = 3000): void {
  useEffect(() => scheduleIdleTask(() => void load(), timeoutMs), [load, timeoutMs]);
}
