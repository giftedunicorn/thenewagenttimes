import { afterEach, describe, expect, it, vi } from "vitest";

import { startCronExecutionWatchdog } from "./watchdog";

describe("startCronExecutionWatchdog", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires when the cron process exceeds its hard deadline", () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();

    startCronExecutionWatchdog({
      onTimeout,
      timeoutMs: 60_000,
    });
    vi.advanceTimersByTime(60_000);

    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it("can be cleared after the database connection closes", () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();

    const stop = startCronExecutionWatchdog({
      onTimeout,
      timeoutMs: 60_000,
    });
    stop();
    vi.advanceTimersByTime(60_000);

    expect(onTimeout).not.toHaveBeenCalled();
  });
});
