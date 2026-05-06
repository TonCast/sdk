import type { Logger } from "../client/config";

export type WsStatus = "connecting" | "open" | "closed";

export interface WsClientOptions {
  url: string;
  logger: Logger;
  /** Heartbeat interval (ms). Default 5000 (matches frontend). */
  heartbeatMs?: number;
  /** Consecutive missed pongs before forcing reconnect. Default 2. */
  maxMissedPongs?: number;
  /** Reconnect backoff start (ms). Default 1000. */
  reconnectInitialMs?: number;
  /** Reconnect backoff cap (ms). Default 30_000. */
  reconnectMaxMs?: number;
  onOpen?: (send: (data: unknown) => void) => void;
  onMessage?: (data: unknown) => void;
  onPong?: () => void;
  /** Fired after consecutive failed reconnects exceeds threshold (default: 3). */
  onPersistentlyDown?: (attempts: number) => void;
  /** Required attempts before `onPersistentlyDown` fires. Default 3. */
  persistentDownAfter?: number;
  /** Fired on transport-level errors (logged but doesn't halt the loop). */
  onError?: (err: unknown) => void;
  /** Fired on every status transition. */
  onStatus?: (status: WsStatus) => void;
}

/**
 * Auto-reconnecting WebSocket transport with heartbeat watchdog.
 *
 * Cloudflare-aware: the server uses `setWebSocketAutoResponse({type:"ping"} ↔ {type:"pong"})`,
 * so client pings never reach the server's JS handler — the runtime auto-replies.
 * Our job: send `{type:"ping"}` on a tick, count missed `{type:"pong"}` replies,
 * force reconnect after `maxMissedPongs`.
 */
export class WsClient {
  private socket: WebSocket | null = null;
  private status: WsStatus = "closed";
  private reconnectAttempts = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private missedPongs = 0;
  private stopped = false;
  private downReported = false;

  constructor(private readonly opts: WsClientOptions) {}

  connect(): void {
    if (this.socket || (this.stopped === false && this.status === "connecting")) return;
    this.stopped = false;
    // A pending reconnect timer would race the user-triggered open() and create
    // a duplicate socket a few seconds later. Cancel it.
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.open();
  }

  close(): void {
    this.stopped = true;
    this.clearHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this.setStatus("closed");
  }

  send(payload: unknown): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    try {
      this.socket.send(JSON.stringify(payload));
    } catch (err) {
      this.opts.logger.warn("ws send failed", err);
    }
  }

  getStatus(): WsStatus {
    return this.status;
  }

  private open(): void {
    this.setStatus("connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.opts.url);
    } catch (err) {
      this.opts.logger.warn("ws constructor threw", err);
      this.opts.onError?.(err);
      // Reset to "closed" so a subsequent `connect()` call can retry —
      // otherwise the early-return guard in `connect()` (status === "connecting")
      // would block all manual reconnects until the scheduled timer fires.
      this.setStatus("closed");
      this.scheduleReconnect();
      return;
    }
    this.socket = ws;

    ws.addEventListener("open", () => {
      this.reconnectAttempts = 0;
      this.downReported = false;
      this.missedPongs = 0;
      this.setStatus("open");
      this.startHeartbeat();
      this.opts.logger.debug("ws open", this.opts.url);
      try {
        this.opts.onOpen?.((data) => this.send(data));
      } catch (err) {
        this.opts.onError?.(err);
      }
    });

    ws.addEventListener("message", (ev: MessageEvent) => {
      let data: unknown;
      try {
        data = JSON.parse(String(ev.data));
      } catch (err) {
        this.opts.logger.warn("ws parse error", err);
        return;
      }
      // Reset watchdog on any pong
      if (
        typeof data === "object" &&
        data !== null &&
        (data as { type?: string }).type === "pong"
      ) {
        this.missedPongs = 0;
        this.opts.onPong?.();
        return;
      }
      try {
        this.opts.onMessage?.(data);
      } catch (err) {
        this.opts.onError?.(err);
      }
    });

    ws.addEventListener("close", () => {
      this.clearHeartbeat();
      this.socket = null;
      this.setStatus("closed");
      if (!this.stopped) this.scheduleReconnect();
    });

    ws.addEventListener("error", (err: Event) => {
      this.opts.logger.warn("ws error", err);
      this.opts.onError?.(err);
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectAttempts++;
    const after = this.opts.persistentDownAfter ?? 3;
    if (!this.downReported && this.reconnectAttempts >= after) {
      this.downReported = true;
      this.opts.onPersistentlyDown?.(this.reconnectAttempts);
    }
    const init = this.opts.reconnectInitialMs ?? 1000;
    const max = this.opts.reconnectMaxMs ?? 30_000;
    const delay = Math.min(max, init * 2 ** Math.min(this.reconnectAttempts, 10));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.stopped) this.open();
    }, delay);
  }

  private startHeartbeat(): void {
    const ms = this.opts.heartbeatMs ?? 5000;
    const max = this.opts.maxMissedPongs ?? 2;
    this.heartbeatTimer = setInterval(() => {
      this.missedPongs++;
      if (this.missedPongs > max) {
        this.opts.logger.warn(`ws ${max} missed pongs — forcing reconnect`);
        this.missedPongs = 0;
        this.socket?.close();
        return;
      }
      this.send({ type: "ping" });
    }, ms);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private setStatus(s: WsStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.opts.onStatus?.(s);
  }
}
