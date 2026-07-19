import { afterEach, describe, expect, it, vi } from "vitest";

import { sleep } from "./sleep";

describe("sleep", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after the duration and removes its abort listener", async () => {
    vi.useFakeTimers();
    const signal = new AbortController().signal;
    const removeListener = vi.spyOn(signal, "removeEventListener");

    const result = sleep(1_000, signal);

    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(result).resolves.toBeUndefined();

    expect(removeListener).toHaveBeenCalledOnce();
    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects with AbortError and clears its timer and listener", async () => {
    vi.useFakeTimers();
    const abortController = new AbortController();
    const removeListener = vi.spyOn(
      abortController.signal,
      "removeEventListener",
    );

    const result = sleep(1_000, abortController.signal);
    abortController.abort();

    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(removeListener).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects immediately when the signal is already aborted", async () => {
    vi.useFakeTimers();
    const abortController = new AbortController();
    abortController.abort();

    await expect(sleep(1_000, abortController.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
