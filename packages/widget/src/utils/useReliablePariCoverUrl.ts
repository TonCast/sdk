import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_MAX_RETRIES = 3;
const BASE_DELAY_MS = 280;
const JITTER_MS = 120;

export type ReliableImageStatus = "idle" | "retrying" | "failed";

export interface ReliablePariCoverUrlResult {
  displaySrc: string | null;
  onImgError: () => void;
  isRetrying: boolean;
  status: ReliableImageStatus;
  attempt: number;
}

function normalizeMaxRetries(maxRetries: number): number {
  if (!Number.isFinite(maxRetries)) return DEFAULT_MAX_RETRIES;
  return Math.max(0, Math.floor(maxRetries));
}

/**
 * Adds or replaces a cache-busting query param.
 * Handles existing query params and hash fragments correctly.
 */
function withRetryParam(url: string, retryIndex: number): string {
  if (retryIndex <= 0) return url;

  const hashIndex = url.indexOf("#");
  const hasHash = hashIndex !== -1;

  const urlWithoutHash = hasHash ? url.slice(0, hashIndex) : url;
  const hash = hasHash ? url.slice(hashIndex) : "";

  const separator = urlWithoutHash.includes("?") ? "&" : "?";

  return `${urlWithoutHash}${separator}_tcr=${retryIndex}${hash}`;
}

/**
 * Stable pari cover URL with retry support.
 *
 * Useful for transient image loading failures such as CDN connection resets.
 */
export function useReliablePariCoverUrl(
  baseSrc: string | null,
  maxRetries: number = DEFAULT_MAX_RETRIES,
): ReliablePariCoverUrlResult {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<ReliableImageStatus>("idle");

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const versionRef = useRef(0);

  attemptRef.current = attempt;

  const safeMaxRetries = useMemo(() => normalizeMaxRetries(maxRetries), [maxRetries]);

  const clearRetryTimer = useCallback(() => {
    if (timerRef.current === null) return;

    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `baseSrc` must reset retry state when the cover URL changes; Biome incorrectly flags it as redundant.
  useEffect(() => {
    versionRef.current += 1;

    clearRetryTimer();
    setAttempt(0);
    setStatus("idle");

    return clearRetryTimer;
  }, [baseSrc, clearRetryTimer]);

  const displaySrc = useMemo(() => {
    if (!baseSrc || status === "failed") return null;

    return withRetryParam(baseSrc, attempt);
  }, [baseSrc, attempt, status]);

  const onImgError = useCallback(() => {
    if (!baseSrc) return;

    clearRetryTimer();

    const currentAttempt = attemptRef.current;

    if (currentAttempt >= safeMaxRetries) {
      setStatus("failed");
      return;
    }

    const currentVersion = versionRef.current;
    const delay = BASE_DELAY_MS * 2 ** currentAttempt + Math.floor(Math.random() * JITTER_MS);

    setStatus("retrying");

    timerRef.current = setTimeout(() => {
      if (versionRef.current !== currentVersion) return;

      timerRef.current = null;
      setAttempt((previousAttempt) => previousAttempt + 1);
      setStatus("idle");
    }, delay);
  }, [baseSrc, safeMaxRetries, clearRetryTimer]);

  return {
    displaySrc,
    onImgError,
    isRetrying: status === "retrying",
    status,
    attempt,
  };
}
