import { describe, expect, it } from "vitest";

import { buildJobTiming, jobsListInput } from "./jobs";

const now = new Date("2026-07-20T12:00:00.000Z");

describe("jobsListInput", () => {
  it("accepts bounded filters and rejects invalid pages", () => {
    expect(
      jobsListInput.parse({
        jobType: "news_refresh",
        page: 0,
        pageSize: 50,
        status: "queued",
      }),
    ).toMatchObject({ page: 0, pageSize: 50 });
    expect(() => jobsListInput.parse({ page: -1, pageSize: 20 })).toThrow();
    expect(() => jobsListInput.parse({ page: 0, pageSize: 100 })).toThrow();
  });
});

describe("buildJobTiming", () => {
  it("derives queue and execution durations", () => {
    expect(
      buildJobTiming(
        {
          attempts: 1,
          completedAt: "2026-07-20T10:04:00.000Z",
          createdAt: "2026-07-20T10:00:00.000Z",
          lockExpiresAt: null,
          maxAttempts: 3,
          nextRunAt: "2026-07-20T10:00:00.000Z",
          startedAt: "2026-07-20T10:01:00.000Z",
          status: "succeeded",
        },
        now,
      ),
    ).toMatchObject({
      executionMs: 180_000,
      queueWaitMs: 60_000,
      state: "complete",
    });
  });

  it("identifies retries, overdue queues, and expired leases", () => {
    expect(
      buildJobTiming(
        {
          attempts: 1,
          completedAt: null,
          createdAt: "2026-07-20T08:00:00.000Z",
          lockExpiresAt: null,
          maxAttempts: 3,
          nextRunAt: "2026-07-20T09:00:00.000Z",
          startedAt: null,
          status: "queued",
        },
        now,
      ).state,
    ).toBe("retrying");
    expect(
      buildJobTiming(
        {
          attempts: 0,
          completedAt: null,
          createdAt: "2026-07-20T08:00:00.000Z",
          lockExpiresAt: null,
          maxAttempts: 3,
          nextRunAt: "2026-07-20T09:00:00.000Z",
          startedAt: null,
          status: "queued",
        },
        now,
      ).state,
    ).toBe("overdue");
    expect(
      buildJobTiming(
        {
          attempts: 1,
          completedAt: null,
          createdAt: "2026-07-20T08:00:00.000Z",
          lockExpiresAt: "2026-07-20T11:59:59.000Z",
          maxAttempts: 3,
          nextRunAt: "2026-07-20T09:00:00.000Z",
          startedAt: "2026-07-20T11:00:00.000Z",
          status: "running",
        },
        now,
      ).state,
    ).toBe("expired");
  });

  it("handles missing timing fields", () => {
    expect(
      buildJobTiming(
        {
          attempts: 0,
          completedAt: null,
          createdAt: "2026-07-20T10:00:00.000Z",
          lockExpiresAt: null,
          maxAttempts: 3,
          nextRunAt: "2026-07-20T13:00:00.000Z",
          startedAt: null,
          status: "queued",
        },
        now,
      ),
    ).toMatchObject({
      executionMs: null,
      queueWaitMs: null,
      state: "scheduled",
    });
  });
});
