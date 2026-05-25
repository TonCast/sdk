import type { Logger } from "../client/config";
import type { SupportedLanguage } from "../i18n/languages";
import type { Pari } from "../types/pari";
import type { Observer, Subscription } from "../utils/observable";
import { localisePariCreated, type PariListIncomingMessage } from "../ws/pari-list-protocol";
import type { ParisFeed, ParisResource } from "./paris";
import type { ParisListSocket, SocketHandle } from "./paris-list-socket";

export interface StreamListParams {
  /** Which mutually-exclusive feed to return. Default: `"active"`. */
  feed?: ParisFeed | undefined;
  /** Filter by category. Default: all. */
  categoryId?: number | undefined;
  /** Free-text search. **Forces polling-only mode** (broadcast doesn't carry search-filtered events). */
  search?: string | undefined;
  /** Page size. Default 20. */
  pageSize?: number | undefined;
  /** Polling tick when WS is down or `search` is set. Default 5000. */
  pollIntervalMs?: number | undefined;
}

export type ParisStreamStatus =
  /** Initial fetch hasn't completed yet. */
  | "loading"
  /** WS is connected and pushing realtime updates. */
  | "live"
  /** Falling back to HTTP polling (WS unreachable, or `search` is set). */
  | "polling"
  /** Initial fetch failed. Inspect `getError()`. */
  | "error"
  /** `stop()` was called. */
  | "stopped";

export interface ParisStreamDeps {
  paris: ParisResource;
  /** Shared WS connection — multiplexed across every list-stream. */
  socket: ParisListSocket;
  getLanguage: () => SupportedLanguage;
  logger: Logger;
  streamIdleTimeoutMs: number | false;
  onDispose?: (() => void) | undefined;
}

/** Active subscription for `onSnapshot`. */
type Listener = (paris: Pari[]) => void;

/**
 * Live, self-managed paginated paris list. The integrator only sees current
 * `Pari[]` snapshots — sequenceId, ping/pong, reconnects, polling fallback,
 * and `pari_created` localization are all internal.
 */
export class ParisListStream {
  private status: ParisStreamStatus = "loading";
  private lastError: Error | null = null;
  private items: Pari[] = [];
  private nextCursor: { sortValue: number; address: string } | null = null;
  private hasMoreFlag = false;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<(s: ParisStreamStatus) => void>();
  /** Handle into the shared `ParisListSocket`. `null` until bootstrap acquires it. */
  private socketHandle: SocketHandle | null = null;
  private socketOffMessage: (() => void) | null = null;
  private socketOffStatus: (() => void) | null = null;
  private socketOffResync: (() => void) | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private idleStopTimer: ReturnType<typeof setTimeout> | null = null;
  private activeConsumers = 0;
  private stopped = false;
  private inflightLoadMore: Promise<void> | null = null;
  /** Bumps on each first-page fetch so stale responses are ignored after param changes. */
  private fetchGeneration = 0;

  constructor(
    private readonly deps: ParisStreamDeps,
    private readonly params: StreamListParams,
  ) {
    void this.bootstrap();
  }

  // ─── public API ──────────────────────────────────────────────────────────

  /** Subscribe to snapshot updates. Returns an unsubscribe fn. */
  onSnapshot(listener: Listener): () => void {
    this.retain();
    let closed = false;
    this.listeners.add(listener);
    // Always emit the current state synchronously so the integrator gets a baseline.
    if (this.items.length > 0 || this.status !== "loading") listener([...this.items]);
    return () => {
      if (closed) return;
      closed = true;
      this.listeners.delete(listener);
      this.release();
    };
  }

  /**
   * Observable contract — emits a `Pari[]` snapshot for every change. Never
   * `complete()`s during normal operation (the stream is long-lived); errors
   * surface through `getError()` + status `"error"` rather than `error()`.
   *
   * This powers `useStreamList` in `@toncast/sdk-react` and also works as a
   * drop-in for any rxjs-style adapter expecting `subscribe(observer)`.
   */
  subscribe(observer: Observer<Pari[]> = {}): Subscription {
    let closed = false;
    const off = this.onSnapshot((snap) => {
      if (closed) return;
      observer.next?.(snap);
    });
    return {
      unsubscribe: () => {
        if (closed) return;
        closed = true;
        off();
      },
      get closed() {
        return closed;
      },
    };
  }

  /** Subscribe to status changes (`loading | live | polling | stopped`). */
  onStatus(listener: (s: ParisStreamStatus) => void): () => void {
    this.retain();
    let closed = false;
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      if (closed) return;
      closed = true;
      this.statusListeners.delete(listener);
      this.release();
    };
  }

  /** Synchronous read of the current list. */
  snapshot(): Pari[] {
    return [...this.items];
  }

  get hasMore(): boolean {
    return this.hasMoreFlag;
  }

  getStatus(): ParisStreamStatus {
    return this.status;
  }

  /** The error that caused `status === "error"`, if any. */
  getError(): Error | null {
    return this.lastError;
  }

  /** Has `stop()` been called? Used by `paris.streamList` to decide whether to re-use. */
  isStopped(): boolean {
    return this.stopped;
  }

  /** Fetches the next page if any. Idempotent during in-flight calls. */
  async loadMore(): Promise<void> {
    if (this.inflightLoadMore) return this.inflightLoadMore;
    if (!this.hasMoreFlag || this.stopped) return;
    this.inflightLoadMore = this.fetchNextPage().finally(() => {
      this.inflightLoadMore = null;
    });
    return this.inflightLoadMore;
  }

  /** Detaches from the shared WS, stops polling, releases all listeners. */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.idleStopTimer) {
      clearTimeout(this.idleStopTimer);
      this.idleStopTimer = null;
    }
    this.detachFromSocket();
    this.stopPolling();
    this.setStatus("stopped");
    this.listeners.clear();
    this.statusListeners.clear();
    this.deps.onDispose?.();
  }

  dispose(): void {
    this.stop();
  }

  /**
   * Re-run the initial REST fetch with the current language / params. Used
   * by `ToncastClient.setLanguage()` to surface freshly-localised pari titles
   * on every active stream without dropping the WS subscription.
   */
  async refresh(): Promise<void> {
    if (this.stopped) return;
    await this.refetchFirstPage();
  }

  // ─── lifecycle ───────────────────────────────────────────────────────────

  private async bootstrap(): Promise<void> {
    const ok = await this.refetchFirstPage({ initial: true });
    if (this.stopped) return;
    // Don't acquire the shared WS / start polling if the initial fetch failed —
    // it almost certainly means the next call would fail too. Surface the error
    // via the `error` status so the integrator can show retry UI.
    if (!ok) return;
    if (this.params.search) {
      // search-mode: broadcast doesn't carry filtered events → polling only.
      this.startPolling();
      this.setStatus("polling");
    } else {
      this.attachToSocket();
    }
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

  /** Returns true on success, false on failure. */
  private async refetchFirstPage({ initial = false } = {}): Promise<boolean> {
    const generation = ++this.fetchGeneration;
    try {
      const page = await this.deps.paris.list({
        feed: this.params.feed,
        categoryId: this.params.categoryId,
        search: this.params.search,
        limit: this.params.pageSize,
      });
      if (this.stopped || generation !== this.fetchGeneration) return false;
      this.items = [...page.items];
      this.nextCursor = (page.nextCursor as { sortValue: number; address: string } | null) ?? null;
      this.hasMoreFlag = page.hasMore;
      this.emit();
      return true;
    } catch (err) {
      if (generation !== this.fetchGeneration) return false;
      this.deps.logger.warn("paris.streamList fetch failed", err);
      // Only fail the stream on the initial fetch — mid-stream refetches are
      // best-effort (the WS keeps pushing fresh state).
      if (initial) {
        this.lastError = err instanceof Error ? err : new Error(String(err));
        this.setStatus("error");
      }
      return false;
    }
  }

  private async fetchNextPage(): Promise<void> {
    if (!this.nextCursor) return;
    try {
      const page = await this.deps.paris.list({
        feed: this.params.feed,
        categoryId: this.params.categoryId,
        search: this.params.search,
        limit: this.params.pageSize,
        cursor: this.nextCursor,
      });
      if (this.stopped) return;
      // Append, deduping by id (ws may have inserted some already).
      const existing = new Set(this.items.map((p) => p.id));
      for (const p of page.items) if (!existing.has(p.id)) this.items.push(p);
      this.nextCursor = (page.nextCursor as { sortValue: number; address: string } | null) ?? null;
      this.hasMoreFlag = page.hasMore;
      this.emit();
    } catch (err) {
      this.deps.logger.warn("paris.streamList loadMore failed", err);
    }
  }

  // ─── WebSocket layer ─────────────────────────────────────────────────────

  /** Plug into the shared `ParisListSocket`. Sequence dedup and gap detection
   * live on the socket — this stream just filters broadcasts by its own params. */
  private attachToSocket(): void {
    const handle = this.deps.socket.acquire();
    this.socketHandle = handle;
    this.socketOffMessage = handle.onMessage((msg) => this.applyBroadcast(msg));
    this.socketOffResync = handle.onResync(() => void this.refetchFirstPage());
    this.socketOffStatus = handle.onStatus((s) => {
      if (this.stopped) return;
      if (s === "live") {
        this.stopPolling();
        this.setStatus("live");
      } else if (s === "polling") {
        this.startPolling();
        this.setStatus("polling");
      }
      // 'connecting' is a brief transitional state — don't start polling for
      // it (would fire a wasteful refetch ~5 s later just before the socket
      // opens). Stay optimistic; if the socket ends up persistently down the
      // 'polling' branch above takes over.
    });
    // Initial fetch already populated `items`; promote status out of
    // "loading" optimistically so the UI doesn't display a spinner while
    // the socket finishes its handshake.
    if (this.status !== "live" && this.status !== "polling") {
      this.setStatus("live");
    }
  }

  private detachFromSocket(): void {
    this.socketOffMessage?.();
    this.socketOffStatus?.();
    this.socketOffResync?.();
    this.socketOffMessage = null;
    this.socketOffStatus = null;
    this.socketOffResync = null;
    this.socketHandle?.release();
    this.socketHandle = null;
  }

  private applyBroadcast(msg: PariListIncomingMessage): void {
    // Socket already filtered out syncStatus/pong; everything else is a
    // sequenced broadcast we can apply.
    if (msg.type === "syncStatus" || msg.type === "pong") return;
    const feed = this.params.feed ?? "active";
    let changed = false;
    switch (msg.type) {
      case "coefficient_update": {
        const yes = msg.data.bestYesOdds;
        const idx = this.items.findIndex((p) => p.id === msg.data.pariAddress);
        if (idx !== -1) {
          // Replace, never mutate — keeps snapshots immutable for React/zustand/etc.
          // biome-ignore lint/style/noNonNullAssertion: idx came from findIndex
          const prev = this.items[idx]!;
          this.items[idx] = {
            ...prev,
            bestYesOdds: yes,
            bestNoOdds: yes !== null ? 100 - yes : null,
          };
          changed = true;
        }
        break;
      }
      case "volume_update": {
        // NOTE: pari-list channel sends deltas in TON-units (no conversion).
        // The per-pari channel (`pari_updated` in pari-protocol.ts) sends
        // them in nanotons and converts via `nanoToTon`. Keep both in sync
        // with the backend contract — see VolumeUpdateData JSDoc.
        // Sanity check: a single bet rarely moves >1k TON in volume; values
        // larger than that are almost certainly nano arriving where TON is
        // expected (i.e. backend regression).
        if (
          Math.abs(msg.data.deltaYesVolume) > 1_000_000 ||
          Math.abs(msg.data.deltaNoVolume) > 1_000_000
        ) {
          this.deps.logger.warn(
            "volume_update delta looks like nanotons (backend regression?)",
            msg.data,
          );
        }
        const idx = this.items.findIndex((p) => p.id === msg.data.pariAddress);
        if (idx !== -1) {
          // biome-ignore lint/style/noNonNullAssertion: idx came from findIndex
          const prev = this.items[idx]!;
          this.items[idx] = {
            ...prev,
            yesVolume: prev.yesVolume + msg.data.deltaYesVolume,
            noVolume: prev.noVolume + msg.data.deltaNoVolume,
          };
          changed = true;
        }
        break;
      }
      case "pari_created": {
        // Hidden paris are never exposed.
        if (!msg.data.isVisible) break;
        // Newly-created paris only show up in the active feed.
        if (feed !== "active") break;
        if (this.params.categoryId !== undefined && msg.data.categoryId !== this.params.categoryId)
          break;
        const localised = localisePariCreated(msg.data, this.deps.getLanguage());
        if (this.items.some((p) => p.id === localised.id)) break; // already there
        this.items.unshift(localised);
        changed = true;
        break;
      }
      case "pari_result_set": {
        // Active and pending feeds: remove the pari once a result is set.
        if (feed !== "finished") {
          const idx = this.items.findIndex((p) => p.id === msg.data.pariAddress);
          if (idx !== -1) {
            this.items.splice(idx, 1);
            changed = true;
          }
        }
        // Finished feed: broadcast doesn't carry full Pari payload — refetch so
        // the resolved pari shows up at the top.
        if (feed === "finished") {
          void this.refetchFirstPage();
        }
        break;
      }
      case "pari_paused": {
        if (feed === "active") {
          const idx = this.items.findIndex((p) => p.id === msg.data.pariAddress);
          if (idx !== -1) {
            this.items.splice(idx, 1);
            changed = true;
          }
        }
        if (feed === "pending") {
          void this.refetchFirstPage();
        }
        break;
      }
    }
    if (changed) this.emit();
  }

  // ─── Polling fallback ────────────────────────────────────────────────────

  private startPolling(): void {
    if (this.pollTimer) return;
    const ms = this.params.pollIntervalMs ?? 5000;
    this.pollTimer = setInterval(() => {
      void this.refetchFirstPage();
    }, ms);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ─── emit ────────────────────────────────────────────────────────────────

  private emit(): void {
    this.notify(this.listeners, [...this.items], "onSnapshot");
  }

  private setStatus(s: ParisStreamStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.notify(this.statusListeners, s, "onStatus");
  }

  /** Single iterate-and-call helper: catches/logs each listener so one bad
   * subscriber can't break the rest. */
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
