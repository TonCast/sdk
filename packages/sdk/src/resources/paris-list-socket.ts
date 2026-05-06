// Shared `wss://…/ws/pari-list` connection.
//
// Why this exists: the backend channel is a single GLOBAL broadcast room —
// every connected client gets every event regardless of category/feed filters.
// Filtering is the client's job. So opening one WS per filter combo (the
// previous design) duplicates traffic for no benefit and means every category
// switch in the UI re-handshakes a fresh socket.
//
// This class wraps `WsClient`, multiplexes one connection across N stream
// consumers, owns the global `lastSequenceId` (gap detection is a property of
// the channel, not the filter), and shuts itself down on a debounce when the
// last listener disconnects.

import type { Logger } from "../client/config";
import { type PariListIncomingMessage, PariListIncomingSchema } from "../ws/pari-list-protocol";
import { WsClient } from "../ws/WsClient";

export type SocketStatus = "connecting" | "live" | "polling";

export interface ParisListSocketDeps {
  wsBaseUrl: string;
  logger: Logger;
}

type BroadcastListener = (msg: PariListIncomingMessage) => void;

type StatusListener = (s: SocketStatus) => void;

/**
 * Called when the shared socket suspects a gap or reconnect drift — each
 * consumer should refetch its filtered first page.
 */
type ResyncListener = () => void;

/**
 * Singleton-per-baseUrl WS facade. Acquire a handle via `acquire()`; release it
 * via `Handle.release()`. The connection stays open while at least one handle
 * is live, plus a small idle window for fast re-subscribes.
 */
export class ParisListSocket {
  private ws: WsClient | null = null;
  private status: SocketStatus = "connecting";
  /** `null` = haven't seen any seq'd message yet. */
  private lastSequenceId: number | null = null;
  private wasEverOpen = false;
  private expectingFirstSyncStatusAfterReconnect = false;

  private readonly broadcastListeners = new Set<BroadcastListener>();
  private readonly statusListeners = new Set<StatusListener>();
  private readonly resyncListeners = new Set<ResyncListener>();

  /** Active acquired handles. The connection sticks around while > 0. */
  private refCount = 0;
  private idleStopTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly deps: ParisListSocketDeps,
    /** Idle window before tearing down the WS after the last `release()`. */
    private readonly idleTimeoutMs = 30_000,
  ) {}

  /**
   * Subscribe to the shared connection. The first acquire opens the WS; the
   * last release schedules a debounced shutdown. Returns a handle the caller
   * holds for the lifetime of its interest in this channel.
   */
  acquire(): SocketHandle {
    this.refCount++;
    if (this.idleStopTimer) {
      clearTimeout(this.idleStopTimer);
      this.idleStopTimer = null;
    }
    if (!this.ws) this.openWs();

    let released = false;
    return {
      currentStatus: () => this.status,
      onMessage: (fn) => addAndReturnRemover(this.broadcastListeners, fn),
      onStatus: (fn) => {
        // Replay the current status once, like the per-stream API used to.
        fn(this.status);
        return addAndReturnRemover(this.statusListeners, fn);
      },
      onResync: (fn) => addAndReturnRemover(this.resyncListeners, fn),
      release: () => {
        if (released) return;
        released = true;
        this.refCount--;
        if (this.refCount === 0) this.scheduleIdleStop();
      },
    };
  }

  /** Total broadcast listeners currently attached — exposed for tests/diagnostics. */
  get refs(): number {
    return this.refCount;
  }

  // ─── internals ─────────────────────────────────────────────────────────────

  private openWs(): void {
    const url = `${this.deps.wsBaseUrl.replace(/\/+$/, "")}/ws/pari-list`;
    this.status = "connecting";
    this.ws = new WsClient({
      url,
      logger: this.deps.logger,
      onOpen: (send) => {
        const wasReconnect = this.wasEverOpen;
        this.wasEverOpen = true;
        this.expectingFirstSyncStatusAfterReconnect = wasReconnect;
        send({ type: "checkSync", lastSeen: this.lastSequenceId ?? 0 });
      },
      onMessage: (raw) => this.handleMessage(raw),
      onStatus: (s) => {
        if (s === "open") this.setStatus("live");
      },
      onPersistentlyDown: () => this.setStatus("polling"),
    });
    this.ws.connect();
  }

  private handleMessage(raw: unknown): void {
    const parsed = PariListIncomingSchema.safeParse(raw);
    if (!parsed.success) {
      this.deps.logger.warn("ws unknown message", raw);
      return;
    }
    const msg = parsed.data;

    if (msg.type === "syncStatus") {
      if (typeof msg.currentSequence === "number") this.lastSequenceId = msg.currentSequence;

      const isReconnect = this.expectingFirstSyncStatusAfterReconnect;
      this.expectingFirstSyncStatusAfterReconnect = false;

      // Initial connect: streams just fetched their initial pages — nothing to do.
      if (!isReconnect) return;

      // If the backend's counter reset (DO cleanup) it returns isLatest:true with
      // no `currentSequence` because our `lastSeen > 0 ≥ counter`. Reset locally
      // so subsequent broadcasts aren't dropped as "duplicates".
      const counterMayHaveReset =
        msg.isLatest === true &&
        typeof msg.currentSequence !== "number" &&
        this.lastSequenceId !== null;

      if (msg.isLatest === false || counterMayHaveReset) {
        if (counterMayHaveReset) this.lastSequenceId = null;
        this.broadcastResync();
      }
      return;
    }

    if (msg.type === "pong") return;

    // Sequence dedup + gap detection — global, shared by every consumer.
    const seq = msg.sequenceId;
    if (this.lastSequenceId === null) {
      this.lastSequenceId = seq;
    } else if (seq <= this.lastSequenceId) {
      return; // duplicate
    } else if (seq > this.lastSequenceId + 1) {
      this.lastSequenceId = seq;
      this.broadcastResync();
      return;
    } else {
      this.lastSequenceId = seq;
    }

    for (const fn of this.broadcastListeners) {
      try {
        fn(msg);
      } catch (err) {
        this.deps.logger.warn("paris-list listener threw", err);
      }
    }
  }

  private broadcastResync(): void {
    for (const fn of this.resyncListeners) {
      try {
        fn();
      } catch (err) {
        this.deps.logger.warn("paris-list resync listener threw", err);
      }
    }
  }

  private setStatus(s: SocketStatus): void {
    if (this.status === s) return;
    this.status = s;
    for (const fn of this.statusListeners) {
      try {
        fn(s);
      } catch (err) {
        this.deps.logger.warn("paris-list status listener threw", err);
      }
    }
  }

  private scheduleIdleStop(): void {
    if (this.idleStopTimer) return;
    this.idleStopTimer = setTimeout(() => {
      this.idleStopTimer = null;
      if (this.refCount === 0) this.shutdownTransport();
    }, this.idleTimeoutMs);
  }

  /**
   * Tear down the underlying WS but keep the instance reusable — a future
   * `acquire()` will simply open a fresh socket. Listener sets are cleared
   * because they all belonged to released handles by definition.
   */
  private shutdownTransport(): void {
    this.ws?.close();
    this.ws = null;
    this.wasEverOpen = false;
    this.expectingFirstSyncStatusAfterReconnect = false;
    this.lastSequenceId = null;
    this.broadcastListeners.clear();
    this.statusListeners.clear();
    this.resyncListeners.clear();
    this.status = "connecting";
  }
}

export interface SocketHandle {
  currentStatus(): SocketStatus;
  onMessage(fn: BroadcastListener): () => void;
  onStatus(fn: StatusListener): () => void;
  onResync(fn: ResyncListener): () => void;
  /** Release this consumer; the connection closes after a short idle window
   * if no other handles remain. Idempotent. */
  release(): void;
}

function addAndReturnRemover<T>(set: Set<T>, value: T): () => void {
  set.add(value);
  return () => {
    set.delete(value);
  };
}
