import { describe, expect, it, vi } from "vitest";
import { firstValue, fromPromise, ToncastObservable } from "../src/utils/observable";

describe("ToncastObservable", () => {
  it("subscribe / next / complete", () => {
    const o = new ToncastObservable<number>((s) => {
      s.next(1);
      s.next(2);
      s.complete();
    });
    const next = vi.fn();
    const complete = vi.fn();
    o.subscribe({ next, complete });
    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenNthCalledWith(1, 1);
    expect(next).toHaveBeenNthCalledWith(2, 2);
    expect(complete).toHaveBeenCalledOnce();
  });

  it("error stops emissions and runs teardown", () => {
    const teardown = vi.fn();
    const o = new ToncastObservable<number>((s) => {
      s.next(1);
      s.error(new Error("boom"));
      s.next(2); // should be ignored
      return teardown;
    });
    const next = vi.fn();
    const error = vi.fn();
    o.subscribe({ next, error });
    expect(next).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledOnce();
    expect(teardown).toHaveBeenCalledOnce();
  });

  it("unsubscribe stops further emissions", () => {
    let push: ((v: number) => void) | undefined;
    const o = new ToncastObservable<number>((s) => {
      push = (v) => s.next(v);
    });
    const next = vi.fn();
    const sub = o.subscribe({ next });
    push?.(1);
    sub.unsubscribe();
    push?.(2);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(1);
    expect(sub.closed).toBe(true);
  });

  it("teardown runs on unsubscribe", () => {
    const teardown = vi.fn();
    const o = new ToncastObservable<number>(() => teardown);
    const sub = o.subscribe();
    sub.unsubscribe();
    expect(teardown).toHaveBeenCalledOnce();
  });

  it("Thenable: await yields the first emission", async () => {
    const o = new ToncastObservable<string>((s) => {
      s.next("hello");
      s.next("world"); // ignored — first wins
      s.complete();
    });
    expect(await o).toBe("hello");
  });

  it("Thenable: empty complete rejects", async () => {
    const o = new ToncastObservable<number>((s) => {
      s.complete();
    });
    await expect(Promise.resolve(o)).rejects.toThrow(/without emitting/);
  });

  it("Thenable: error rejects", async () => {
    const o = new ToncastObservable<number>((s) => {
      s.error(new Error("nope"));
    });
    await expect(Promise.resolve(o)).rejects.toThrow("nope");
  });

  it("firstValue is equivalent to await", async () => {
    const o = new ToncastObservable<number>((s) => {
      s.next(42);
      s.complete();
    });
    expect(await firstValue(o)).toBe(42);
  });

  it("fromPromise wraps async values", async () => {
    const o = fromPromise(Promise.resolve("ok"));
    const next = vi.fn();
    const complete = vi.fn();
    await new Promise<void>((resolve) => {
      o.subscribe({
        next,
        complete: () => {
          complete();
          resolve();
        },
      });
    });
    expect(next).toHaveBeenCalledWith("ok");
    expect(complete).toHaveBeenCalledOnce();
  });

  it("fromPromise propagates rejection", async () => {
    const o = fromPromise(Promise.reject(new Error("nope")));
    const error = vi.fn();
    await new Promise<void>((resolve) => {
      o.subscribe({
        error: (e) => {
          error(e);
          resolve();
        },
      });
    });
    expect(error).toHaveBeenCalledOnce();
  });
});
