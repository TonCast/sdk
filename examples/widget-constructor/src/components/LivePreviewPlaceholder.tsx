import type { Device } from "../types";
import { HEIGHT_BY_DEVICE } from "../utils/deviceLayout";

/** Skeleton shown while the lazy-loaded widget preview chunk downloads. */
export function LivePreviewPlaceholder({ deviceMode }: { deviceMode: Device }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 flex flex-col items-center justify-center gap-3"
      style={{ height: HEIGHT_BY_DEVICE[deviceMode] }}
    >
      <div
        className="h-8 w-8 rounded-full border-2 border-slate-600 border-t-sky-400 animate-spin"
        aria-hidden="true"
      />
      <p className="text-xs text-slate-500">Loading live preview…</p>
    </div>
  );
}
