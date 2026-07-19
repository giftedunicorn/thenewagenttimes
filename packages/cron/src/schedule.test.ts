import { describe, expect, it, vi } from "vitest";

import {
  enqueueScheduledNewsRefresh,
  getNewsRefreshScheduleWindow,
} from "./schedule";

describe("getNewsRefreshScheduleWindow", () => {
  it("floors an odd UTC hour to the preceding even hour", () => {
    const window = getNewsRefreshScheduleWindow(
      new Date("2026-07-19T09:47:32.456Z"),
    );

    expect(window.toISOString()).toBe("2026-07-19T08:00:00.000Z");
  });

  it("zeros minutes, seconds, and milliseconds in an even UTC hour", () => {
    const window = getNewsRefreshScheduleWindow(
      new Date("2026-07-19T10:59:59.999Z"),
    );

    expect(window.toISOString()).toBe("2026-07-19T10:00:00.000Z");
  });
});

describe("enqueueScheduledNewsRefresh", () => {
  it("enqueues one news refresh for the current two-hour window", async () => {
    const now = new Date("2026-07-19T09:47:32.456Z");
    const enqueue = vi.fn().mockResolvedValue({
      job: { id: "job-1" },
      status: "queued",
    });

    const result = await enqueueScheduledNewsRefresh({
      enqueue,
      now: () => now,
    });

    expect(enqueue).toHaveBeenCalledOnce();
    expect(enqueue).toHaveBeenCalledWith({
      dedupeKey: "news-refresh:2026-07-19T08:00:00.000Z",
      jobType: "news_refresh",
      payload: {
        requestedAt: "2026-07-19T09:47:32.456Z",
        trigger: "cron",
      },
    });
    expect(result).toEqual({
      dedupeKey: "news-refresh:2026-07-19T08:00:00.000Z",
      jobId: "job-1",
      status: "queued",
      window: "2026-07-19T08:00:00.000Z",
    });
  });

  it("returns duplicate metadata as a successful no-op", async () => {
    const enqueue = vi.fn().mockResolvedValue({
      job: { id: "existing-job" },
      status: "duplicate",
    });

    const result = await enqueueScheduledNewsRefresh({
      enqueue,
      now: () => new Date("2026-07-19T11:01:00.000Z"),
    });

    expect(result).toEqual({
      dedupeKey: "news-refresh:2026-07-19T10:00:00.000Z",
      jobId: "existing-job",
      status: "duplicate",
      window: "2026-07-19T10:00:00.000Z",
    });
  });
});
