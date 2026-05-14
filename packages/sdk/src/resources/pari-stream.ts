import type { Logger } from "../client/config";
import type { CoefficientHistoryPoint } from "../types/coefficient-history";
import type { OddsState } from "../types/odds-state";
import type { Pari } from "../types/pari";
import type { Observer, Subscription } from "../utils/observable";
import { type BetEvent, type PariIncomingMessage, PariIncomingSchema } from "../ws/pari-protocol";
import { WsClient } from "../ws/WsClient";
import type { CoefficientHistoryParams, ParisResource } from "./paris";

export interface SubscribePariParams {
  /** Initial coefficient-history fetch params. Defaults: `limit=100, timeframe="ALL"`. */
  coefficientHistory?: CoefficientHistoryParams | undefined;
  /** Polling tick when WS is unreachable (ms). Default 5000. */
  pollIntervalMs?: number | undefined;
}

/**
 * Recommended `useSubscribe` / `subscribe` params for a chart-driven pari
 * detail page — pulls the full history (`timeframe: "ALL"`) up to 1000
 * points so the coefficient chart renders without sampling gaps.
 *
 * Stable reference, safe to pass directly to React hooks: `useSubscribe(id, DEFAULT_PARI_CHART_PARAMS)`.
 */
export const DEFAULT_PARI_CHART_PARAMS: SubscribePariParams = {
  coefficientHistory: { timeframe: "ALL", limit: 1000 },
};

export type PariStreamStatus =
  /** Initial fetch hasn't completed yet. */
  | "loading"
  /** WS connected and pushing realtime updates. */
  | "live"
  /** Falling back to HTTP polling (WS unreachable). */
  | "polling"
  /** Initial fetch failed (e.g. pari hidden / not found). Inspect `getError()`. */
  | "error"
  /** `stop()` was called. */
  | "stopped";

export interface PariStreamSnapshot {
  pari: Pari | null;
  oddsState: OddsState | null;
  coefficientHistory: CoefficientHistoryPoint[];
}

export interface PariStreamDeps {
  paris: ParisResource;
  wsBaseUrl: string;
  logger: Logger;
  streamIdleTimeoutMs: number | false;
  onDispose?: () => void;
}

type PariListener = (pari: Pari) => void;
type OddsStateListener = (state: OddsState) => void;
type HistoryListener = (history: CoefficientHistoryPoint[]) => void;
type BetEventListener = (event: BetEvent) => void;
type StatusListener = (s: PariStreamStatus) => void;

/**
 * Live, self-managing view of one pari. Internal: fetches initial state,
 * connects per-pari WS, applies broadcasts, polling fallback, sequenceId dedup,
 * gap recovery. Integrator subscribes to whichever `on*` channels they need.
 */
export class PariStream {
  private status: PariStreamStatus = "loading";
  private lastError: Error | null = null;
  private pari: Pari | null = null;
  private oddsState: OddsState | null = null;
  private coefficientHistory: CoefficientHistoryPoint[] = [];

  private pariListeners = new Set<PariListener>();
  private oddsListeners = new Set<OddsStateListener>();
  private historyListeners = new Set<HistoryListener>();
  private betEventListeners = new Set<BetEventListener>();
  private statusListeners = new Set<StatusListener>();

  private ws: WsClient | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private idleStopTimer: ReturnType<typeof setTimeout> | null = null;
  private activeConsumers = 0;
  private stopped = false;
  /** sequenceId tracking. `null` = haven't seen any seq'd message yet (so 0 is a valid first value). */
  private lastSequenceId: number | null = null;
  /** True once WS has been opened at least once — helps distinguish initial connect from reconnect. */
  private wasEverOpen = false;
  /** Suppress duplicate gap-invalidations within this window (ms). */
  private gapTimeoutMs = 1000;
  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  private gapInProgress = false;
  /** Set during onOpen, cleared after the first syncStatus is processed. */
  private expectingFirstSyncStatusAfterReconnect = false;

  constructor(
    private readonly deps: PariStreamDeps,
    private readonly pariId: string,
    private readonly params: SubscribePariParams = {},
  ) {
    void this.bootstrap();
  }

  // ─── Subscriptions ───────────────────────────────────────────────────────

  /**
   * Subscribe to `Pari` snapshots — fires immediately with the current value
   * (if loaded) and then on every relevant broadcast (`pari_updated`,
   * `pari_result_set`, `pari_paused`). Returns an unsubscribe function.
   */
  onPari(fn: PariListener): () => void {
    this.retain();
    let closed = false;
    this.pariListeners.add(fn);
    if (this.pari) fn(this.pari);
    return () => {
      if (closed) return;
      closed = true;
      this.pariListeners.delete(fn);
      this.release();
    };
  }

  /**
   * Subscribe to order-book (`OddsState`) snapshots — fires immediately with
   * the current value (if loaded) and then on every `bet_placed_with_odds`
   * broadcast. Returns an unsubscribe function.
   */
  onOddsState(fn: OddsStateListener): () => void {
    this.retain();
    let closed = false;
    this.oddsListeners.add(fn);
    if (this.oddsState) fn(this.oddsState);
    return () => {
      if (closed) return;
      closed = true;
      this.oddsListeners.delete(fn);
      this.release();
    };
  }

  /**
   * Subscribe to YES-coefficient time-series snapshots — fires immediately
   * after the initial fetch and then on every `coefficient_changed` broadcast.
   * Returns an unsubscribe function.
   */
  onCoefficientHistory(fn: HistoryListener): () => void {
    this.retain();
    let closed = false;
    this.historyListeners.add(fn);
    if (this.coefficientHistory.length > 0 || this.status !== "loading")
      fn([...this.coefficientHistory]);
    return () => {
      if (closed) return;
      closed = true;
      this.historyListeners.delete(fn);
      this.release();
    };
  }

  /**
   * Subscribe to one-shot `BetEvent`s (newly placed bets + matched pairs)
   * derived from `bet_placed_with_odds` broadcasts. Unlike the other channels,
   * this is fire-and-forget — there's no "current value" to replay.
   */
  onBetEvent(fn: BetEventListener): () => void {
    this.retain();
    let closed = false;
    this.betEventListeners.add(fn);
    return () => {
      if (closed) return;
      closed = true;
      this.betEventListeners.delete(fn);
      this.release();
    };
  }

  /**
   * Subscribe to status transitions (`loading | live | polling | error |
   * stopped`). Fires immediately with the current status. Returns an
   * unsubscribe function.
   */
  onStatus(fn: StatusListener): () => void {
    this.retain();
    let closed = false;
    this.statusListeners.add(fn);
    fn(this.status);
    return () => {
      if (closed) return;
      closed = true;
      this.statusListeners.delete(fn);
      this.release();
    };
  }

  snapshot(): PariStreamSnapshot {
    return {
      pari: this.pari,
      oddsState: this.oddsState,
      coefficientHistory: [...this.coefficientHistory],
    };
  }

  /**
   * Observable contract — emits a full {@link PariStreamSnapshot} on every
   * relevant change (new pari data, oddsState update, history point added).
   *
   * Why a single multi-channel snapshot instead of separate observables per
   * channel: the React live adapter expects one snapshot source per hook. The
   * integrator destructures the snapshot (`const { pari, oddsState, history } =
   * data`) — same data exposed through `onPari`, `onOddsState`,
   * `onCoefficientHistory`, just unified.
   *
   * `BetEvent`s are intentionally excluded — they're one-shot fire-and-forget
   * and don't fit a "current state snapshot" model. Use `onBetEvent` for those.
   */
  subscribe(observer: Observer<PariStreamSnapshot> = {}): Subscription {
    let closed = false;
    const emit = () => {
      if (closed) return;
      observer.next?.(this.snapshot());
    };
    const offs = [this.onPari(emit), this.onOddsState(emit), this.onCoefficientHistory(emit)];
    return {
      unsubscribe: () => {
        if (closed) return;
        closed = true;
        for (const off of offs) off();
      },
      get closed() {
        return closed;
      },
    };
  }

  getStatus(): PariStreamStatus {
    return this.status;
  }

  /** The error that caused `status === "error"`, if any. */
  getError(): Error | null {
    return this.lastError;
  }

  /** Has `stop()` been called? Used by `paris.subscribe` to decide whether to re-use. */
  isStopped(): boolean {
    return this.stopped;
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.idleStopTimer) {
      clearTimeout(this.idleStopTimer);
      this.idleStopTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.stopPolling();
    if (this.gapTimer) clearTimeout(this.gapTimer);
    this.setStatus("stopped");
    this.pariListeners.clear();
    this.oddsListeners.clear();
    this.historyListeners.clear();
    this.betEventListeners.clear();
    this.statusListeners.clear();
    this.deps.onDispose?.();
  }

  dispose(): void {
    this.stop();
  }

  /**
   * Re-run the initial REST fetch (`pari` + `oddsState` + `history`) with the
   * current language. Used by `ToncastClient.setLanguage()` to refresh
   * pari titles / descriptions on every active subscription without
   * dropping the WS connection.
   */
  async refresh(): Promise<void> {
    if (this.stopped) return;
    await this.refetchAll();
  }

  // ─── Bootstrap ───────────────────────────────────────────────────────────

  private async bootstrap(): Promise<void> {
    const ok = await this.refetchAll({ initial: true });
    if (this.stopped) return;
    // Don't connect WS if initial fetch failed — broadcasts would arrive against
    // a null pari and be dropped silently. Surface the error to the integrator
    // via the `error` status so they can show retry UI / unsubscribe.
    if (!ok) return;
    this.connectWs();
  }

  private retain(): void {
    if (this.stopped) return;
    this.activeConsumers++;
    if (this.idleStopTimer) {
      clearTimeout(this.idleStopTimer);
      this.idleStopTimer = null;
    }
  }

  private release(): void {
    if (this.stopped) return;
    this.activeConsumers = Math.max(0, this.activeConsumers - 1);
    if (this.activeConsumers > 0) return;
    this.scheduleIdleStop();
  }

  private scheduleIdleStop(): void {
    const timeout = this.deps.streamIdleTimeoutMs;
    if (timeout === false) return;
    if (timeout <= 0) {
      this.stop();
      return;
    }
    if (this.idleStopTimer) return;
    this.idleStopTimer = setTimeout(() => {
      this.idleStopTimer = null;
      if (this.activeConsumers === 0) this.stop();
    }, timeout);
  }

  /** Returns true on success, false on failure (status transitioned to "error"). */
  private async refetchAll({ initial = false } = {}): Promise<boolean> {
    try {
      const [pari, oddsState, history] = await Promise.all([
        this.deps.paris.get(this.pariId),
        this.deps.paris.getOddsState(this.pariId),
        this.deps.paris.getCoefficientHistory(this.pariId, {
          limit: this.params.coefficientHistory?.limit ?? 100,
          timeframe: this.params.coefficientHistory?.timeframe ?? "ALL",
        }),
      ]);
      if (this.stopped) return false;
      this.pari = pari;
      this.oddsState = oddsState;
      this.coefficientHistory = [...history.history];
      this.emitPari();
      this.emitOddsState();
      this.emitHistory();
      return true;
    } catch (err) {
      this.deps.logger.warn("paris.subscribe fetch failed", err);
      // Only fail the stream on the *initial* fetch. Mid-stream refetches (gap
      // recovery / polling) are best-effort — the WS keeps pushing fresh data.
      if (initial) {
        this.lastError = err instanceof Error ? err : new Error(String(err));
        this.setStatus("error");
      }
      return false;
    }
  }

  // ─── WebSocket ───────────────────────────────────────────────────────────

  private connectWs(): void {
    const url = `${this.deps.wsBaseUrl.replace(/\/+$/, "")}/ws/${this.pariId}`;
    this.ws = new WsClient({
      url,
      logger: this.deps.logger,
      onOpen: (send) => {
        const wasReconnect = this.wasEverOpen;
        this.wasEverOpen = true;
        const lastSeen = this.lastSequenceId ?? 0;
        send({ type: "checkSync", lastSeen });
        // For first-ever connect, the loader data is fresh — no need to invalidate
        // even if syncStatus says we're behind. Only on RECONNECT do we re-fetch.
        // Stash the flag so handleWsMessage can read it on syncStatus.
        this.expectingFirstSyncStatusAfterReconnect = wasReconnect;
      },
      onMessage: (raw) => this.handleWsMessage(raw),
      onStatus: (s) => {
        if (s === "open") {
          this.stopPolling();
          this.setStatus("live");
        }
      },
      onPersistentlyDown: () => {
        this.startPolling();
        this.setStatus("polling");
      },
    });
    this.ws.connect();
  }

  private handleWsMessage(raw: unknown): void {
    const parsed = PariIncomingSchema.safeParse(raw);
    if (!parsed.success) {
      // Log the validation error AND the raw payload so backend / SDK schema
      // mismatches are diagnosable from the browser console without diving
      // into network frames.
      this.deps.logger.warn("ws message failed validation", {
        issues: parsed.error.issues,
        raw,
      });
      return;
    }
    const msg = parsed.data;

    if (msg.type === "syncStatus") {
      if (typeof msg.currentSequence === "number") this.lastSequenceId = msg.currentSequence;

      const isReconnect = this.expectingFirstSyncStatusAfterReconnect;
      this.expectingFirstSyncStatusAfterReconnect = false;

      if (!isReconnect) return; // Initial connect — loader data is fresh.

      // Backend lost our sequence (DO cleanup after pari endTime, deploy, etc.):
      // we have a non-null lastSequenceId, but the server returns `isLatest: true`
      // without `currentSequence` — meaning its counter is now ≤ our lastSeen.
      // Defensive: reset our state and refetch so we don't drop future broadcasts
      // as "duplicates" against the stale lastSequenceId.
      const counterMayHaveReset =
        msg.isLatest === true &&
        typeof msg.currentSequence !== "number" &&
        this.lastSequenceId !== null;

      if (msg.isLatest === false || counterMayHaveReset) {
        if (counterMayHaveReset) this.lastSequenceId = null;
        void this.refetchAll();
      }
      return;
    }

    if (msg.type === "pong") return;
    if (msg.type === "comment_added") return; // silently ignored, see protocol notes

    // Sequence dedup + gap detection. `0` is a valid first sequenceId.
    const seq = msg.sequenceId;
    if (typeof seq === "number") {
      if (this.lastSequenceId === null) {
        this.lastSequenceId = seq;
      } else if (seq <= this.lastSequenceId) {
        return; // duplicate
      } else if (seq > this.lastSequenceId + 1) {
        // Gap — refetch and adopt the new sequence as authoritative. Suppress
        // duplicate gap-recoveries within a 1s window.
        this.lastSequenceId = seq;
        if (!this.gapInProgress) {
          this.gapInProgress = true;
          this.gapTimer = setTimeout(() => {
            this.gapInProgress = false;
            this.gapTimer = null;
          }, this.gapTimeoutMs);
          void this.refetchAll();
          return;
        }
      } else {
        this.lastSequenceId = seq;
      }
    }

    this.applyBroadcast(msg);
  }

  private applyBroadcast(msg: PariIncomingMessage): void {
    switch (msg.type) {
      case "bet_placed_with_odds": {
        this.oddsState = msg.data.oddsState;
        this.emitOddsState();
        const event: BetEvent = {
          newBets: msg.data.newBets,
          matchedPairs: msg.data.matchedPairs ?? [],
          timestamp: msg.timestamp,
        };
        for (const fn of this.betEventListeners) {
          try {
            fn(event);
          } catch (err) {
            this.deps.logger.warn("onBetEvent listener threw", err);
          }
        }
        break;
      }
      case "pari_updated": {
        if (!this.pari) break;
        // Backend ships deltas in nanotons. Convert to TON-units to match `Pari.yesVolume`.
        const dYes = nanoToTon(msg.data.deltaYesVolume);
        const dNo = nanoToTon(msg.data.deltaNoVolume);
        this.pari = {
          ...this.pari,
          yesVolume: this.pari.yesVolume + dYes,
          noVolume: this.pari.noVolume + dNo,
        };
        this.emitPari();
        break;
      }
      case "pari_result_set": {
        if (!this.pari) break;
        this.pari = { ...this.pari, status: msg.data.status, result: msg.data.result };
        this.emitPari();
        break;
      }
      case "pari_paused": {
        if (!this.pari) break;
        this.pari = { ...this.pari, status: msg.data.status };
        this.emitPari();
        break;
      }
      case "coefficient_changed": {
        // Broadcast `timestamp` is in ms; CoefficientHistoryPoint.timestamp is in seconds.
        const point: CoefficientHistoryPoint = {
          timestamp: Math.floor(msg.timestamp / 1000),
          coefficient: msg.data.yesCoefficient,
        };
        this.coefficientHistory = [...this.coefficientHistory, point];
        this.emitHistory();
        break;
      }
    }
  }

  // ─── Polling fallback ────────────────────────────────────────────────────

  private startPolling(): void {
    if (this.pollTimer) return;
    const ms = this.params.pollIntervalMs ?? 5000;
    this.pollTimer = setInterval(() => {
      void this.refetchAll();
    }, ms);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ─── Emit helpers ────────────────────────────────────────────────────────

  private emitPari(): void {
    if (this.pari) this.notify(this.pariListeners, this.pari, "onPari");
  }

  private emitOddsState(): void {
    if (this.oddsState) this.notify(this.oddsListeners, this.oddsState, "onOddsState");
  }

  private emitHistory(): void {
    this.notify(this.historyListeners, [...this.coefficientHistory], "onCoefficientHistory");
  }

  private setStatus(s: PariStreamStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.notify(this.statusListeners, s, "onStatus");
  }

  /** Single iterate-and-call helper: catches/logs each listener so one bad
   * subscriber can't break the rest. Used by `emit*` and `setStatus`. */
  private notify<T>(listeners: Set<(value: T) => void>, value: T, label: string): void {
    for (const fn of listeners) {
      try {
        fn(value);
      } catch (err) {
        this.deps.logger.warn(`${label} listener threw`, err);
      }
    }
  }
}

/** Convert integer nanotons to TON float (UI volumes). Inlined to avoid pulling `@ton/core` into the `streams` entry (tree-shaken otherwise). */
function nanoToTon(nano: number): number {
  return Math.trunc(nano) / 1_000_000_000;
}
