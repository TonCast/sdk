// Tiny Observable<T> implementation tailored for the SDK. ~80 lines, zero deps,
// rxjs-compatible enough for `@tanstack/react-query` adapters in `@toncast/sdk-react`.
//
// Why we ship our own instead of pulling in rxjs:
//  - rxjs is ~30 KB min+gz and we use a fraction of its surface (subscribe / next /
//    error / complete). Most React-side adapters (omniston-sdk-react, etc.) only
//    need the same fraction.
//  - We also want every Observable to be **Thenable**, so that `await
//    client.paris.list(...)` keeps working in Node smoke / server scripts written
//    against the previous Promise-based API. rxjs Observables are NOT thenable —
//    you have to call `firstValueFrom()`. That breaks every existing caller.
//
// Subscription model is single-callback per channel (next/error/complete) — no
// operators, no Subjects, no schedulers. If a caller needs more, `firstValue()`
// converts to a Promise and they pipe through whatever they want.

export interface Observer<T> {
  next?: (value: T) => void;
  error?: (err: unknown) => void;
  complete?: () => void;
}

export interface Subscription {
  unsubscribe(): void;
  readonly closed: boolean;
}

/**
 * The minimal contract every "observable-like" thing in the SDK satisfies —
 * `ToncastObservable`, `ParisListStream`, `PariStream`, anything that exposes
 * `subscribe(observer)`. React adapters (`useObservableQuery`) accept this
 * shape so they can consume both pure Observables and stateful stream objects
 * without an extra `.asObservable()` step.
 */
export interface Subscribable<T> {
  subscribe(observer: Observer<T>): Subscription;
}

// biome-ignore lint/suspicious/noConfusingVoidType: producers commonly return nothing — `void` is the natural type
export type TeardownLogic = (() => void) | void;

/**
 * Producer function. Called every time `subscribe()` is invoked — there is no
 * shared state between subscribers (each gets its own producer run). For
 * shared/cached emissions, the resource layer wraps producers explicitly.
 */
export type SubscribeFn<T> = (subscriber: SafeObserver<T>) => TeardownLogic;

class SafeObserver<T> implements Subscription {
  private _closed = false;
  private teardown: TeardownLogic = undefined;

  constructor(private readonly observer: Observer<T>) {}

  next(value: T): void {
    if (this._closed) return;
    this.observer.next?.(value);
  }
  error(err: unknown): void {
    if (this._closed) return;
    this._closed = true;
    this.observer.error?.(err);
    this.runTeardown();
  }
  complete(): void {
    if (this._closed) return;
    this._closed = true;
    this.observer.complete?.();
    this.runTeardown();
  }
  unsubscribe(): void {
    if (this._closed) return;
    this._closed = true;
    this.runTeardown();
  }
  get closed(): boolean {
    return this._closed;
  }
  /** Producer registers cleanup via the return value of the SubscribeFn. */
  setTeardown(fn: TeardownLogic): void {
    this.teardown = fn;
    if (this._closed) this.runTeardown();
  }
  private runTeardown(): void {
    const t = this.teardown;
    this.teardown = undefined;
    try {
      if (typeof t === "function") t();
    } catch {
      // Swallow teardown errors — propagating would mask the original error.
    }
  }
}

/**
 * Thenable Observable: supports both reactive `subscribe(...)` and one-shot
 * `await observable` (resolves with the FIRST emitted value, rejects on error
 * or empty completion).
 *
 * The Thenable side is what lets all existing Promise-based callers
 * (`await client.paris.list(...)`) keep working unchanged after the SDK switches
 * to Observable returns.
 */
export class ToncastObservable<T> implements PromiseLike<T> {
  constructor(private readonly producer: SubscribeFn<T>) {}

  subscribe(observer: Observer<T> = {}): Subscription {
    const safe = new SafeObserver<T>(observer);
    try {
      const teardown = this.producer(safe);
      safe.setTeardown(teardown);
    } catch (err) {
      safe.error(err);
    }
    return safe;
  }

  /**
   * PromiseLike contract — resolves with the first emitted value. Disabled
   * lint here intentionally: the whole point is to be `await`-able.
   */
  // biome-ignore lint/suspicious/noThenProperty: Thenable is the explicit design — supports `await observable`
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return firstValue(this).then(onfulfilled, onrejected);
  }
}

/**
 * Convert an Observable into a Promise that resolves with the FIRST emitted
 * value (then unsubscribes), or rejects on error / empty completion.
 *
 * Equivalent to rxjs's `firstValueFrom`. Use it when you want to be explicit
 * about taking just one emission instead of relying on the implicit Thenable.
 */
export function firstValue<T>(observable: ToncastObservable<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let resolved = false;
    const sub = observable.subscribe({
      next: (value) => {
        if (resolved) return;
        resolved = true;
        resolve(value);
        sub.unsubscribe();
      },
      error: reject,
      complete: () => {
        if (!resolved) reject(new Error("Observable completed without emitting a value"));
      },
    });
  });
}

/** Wrap a Promise (or async function) into an Observable that emits once and completes. */
export function fromPromise<T>(
  promiseOrFactory: Promise<T> | (() => Promise<T>),
): ToncastObservable<T> {
  return new ToncastObservable<T>((subscriber) => {
    const promise = typeof promiseOrFactory === "function" ? promiseOrFactory() : promiseOrFactory;
    let cancelled = false;
    promise.then(
      (value) => {
        if (cancelled) return;
        subscriber.next(value);
        subscriber.complete();
      },
      (err) => {
        if (cancelled) return;
        subscriber.error(err);
      },
    );
    return () => {
      cancelled = true;
    };
  });
}
