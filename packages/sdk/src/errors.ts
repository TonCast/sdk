// Base error hierarchy for @toncast/sdk. Mirrors the style of ToncastError from @toncast/tx-sdk
// so consumers can catch both packages uniformly.

/**
 * Base error class for every failure surfaced by `@toncast/sdk`.
 * Subclasses (`ToncastApiError`, `ToncastUnauthorizedError`, `ToncastNotFoundError`,
 * `ToncastRateLimitError`, `ToncastWsError`, `ToncastValidationError`) narrow the
 * kind of failure; `code` is a stable string identifier suitable for switch-cases or telemetry.
 */
export class ToncastError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ToncastError";
  }
}

export interface ToncastApiErrorOptions {
  requestId?: string | undefined;
  cause?: unknown;
  code?: string | undefined;
}

/** HTTP-layer failure: non-2xx response from the Toncast REST API. */
export class ToncastApiError extends ToncastError {
  readonly requestId: string | undefined;

  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string,
    options: ToncastApiErrorOptions = {},
  ) {
    super(message, options.code ?? `API_${status}`, options.cause);
    this.name = "ToncastApiError";
    this.requestId = options.requestId;
  }
}

/** HTTP 401 — authentication required or credentials rejected when the API enforces auth. */
export class ToncastUnauthorizedError extends ToncastApiError {
  constructor(message: string, endpoint: string, options: ToncastApiErrorOptions = {}) {
    super(message, 401, endpoint, { ...options, code: options.code ?? "UNAUTHORIZED" });
    this.name = "ToncastUnauthorizedError";
  }
}

/** HTTP 404 — requested REST path or resource does not exist. */
export class ToncastNotFoundError extends ToncastApiError {
  constructor(message: string, endpoint: string, options: ToncastApiErrorOptions = {}) {
    super(message, 404, endpoint, { ...options, code: options.code ?? "NOT_FOUND" });
    this.name = "ToncastNotFoundError";
  }
}

/** HTTP 429 failure with retry metadata when the API supplies it. */
export class ToncastRateLimitError extends ToncastApiError {
  constructor(
    message: string,
    endpoint: string,
    public readonly retryAfterMs?: number,
    requestId?: string,
    cause?: unknown,
  ) {
    super(message, 429, endpoint, { code: "RATE_LIMIT", requestId, cause });
    this.name = "ToncastRateLimitError";
  }
}

/** WebSocket-layer failure: connect/send/parse error on the WS transport. */
export class ToncastWsError extends ToncastError {
  constructor(message: string, code = "WS_ERROR", cause?: unknown) {
    super(message, code, cause);
    this.name = "ToncastWsError";
  }
}

/** Response did not match the expected zod schema. Indicates a backend contract change. */
export class ToncastValidationError extends ToncastError {
  constructor(message: string, cause?: unknown) {
    super(message, "VALIDATION_FAILED", cause);
    this.name = "ToncastValidationError";
  }
}
