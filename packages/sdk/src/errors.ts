// Base error hierarchy for @toncast/sdk. Mirrors the style of ToncastError from @toncast/tx-sdk
// so consumers can catch both packages uniformly.

/**
 * Base error class for every failure surfaced by `@toncast/sdk`.
 * Subclasses (`ToncastApiError`, `ToncastWsError`, `ToncastValidationError`)
 * narrow the kind of failure; `code` is a stable string identifier suitable
 * for switch-cases or telemetry.
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

/** HTTP-layer failure: non-2xx response from the Toncast REST API. */
export class ToncastApiError extends ToncastError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string,
    cause?: unknown,
  ) {
    super(message, `API_${status}`, cause);
    this.name = "ToncastApiError";
  }
}

/** HTTP 429 failure with retry metadata when the API supplies it. */
export class ToncastRateLimitError extends ToncastApiError {
  constructor(
    message: string,
    endpoint: string,
    public readonly retryAfterMs?: number,
    cause?: unknown,
  ) {
    super(message, 429, endpoint, cause);
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
