import { describe, expect, it } from "vitest";

import type { OverviewSnapshot } from "./overview";
import { buildOverviewHealth } from "./overview";

const now = new Date("2026-07-20T12:00:00.000Z");

const healthySnapshot: OverviewSnapshot = {
  activeSourceCount: 8,
  daily: [],
  ingestion: {
    finishedAt: "2026-07-20T11:35:00.000Z",
    itemsCreated: 12,
    itemsSeen: 30,
    itemsUpdated: 4,
    startedAt: "2026-07-20T11:30:00.000Z",
    status: "succeeded",
  },
  jobs: {
    expiredLeaseCount: 0,
    failed: 0,
    oldestDueQueuedAt: null,
    queued: 0,
    running: 0,
    succeeded: 24,
  },
  news: {
    collected24h: 120,
    embeddedPublishedTotal: 480,
    latestPublishedAt: "2026-07-20T10:00:00.000Z",
    published24h: 80,
    publishedTotal: 500,
  },
  sourceCount: 10,
};

describe("buildOverviewHealth", () => {
  it("marks a fresh snapshot without operational findings healthy", () => {
    expect(buildOverviewHealth(healthySnapshot, now)).toEqual({
      findings: [],
      state: "healthy",
    });
  });

  it("reports content older than 72 hours as critical", () => {
    const health = buildOverviewHealth(
      {
        ...healthySnapshot,
        news: {
          ...healthySnapshot.news,
          latestPublishedAt: "2026-07-17T11:59:59.000Z",
        },
      },
      now,
    );

    expect(health.findings).toContainEqual(
      expect.objectContaining({
        code: "stale-content",
        severity: "critical",
      }),
    );
    expect(health.state).toBe("critical");
  });

  it("reports terminal jobs", () => {
    const health = buildOverviewHealth(
      {
        ...healthySnapshot,
        jobs: {
          ...healthySnapshot.jobs,
          failed: 3,
        },
      },
      now,
    );

    expect(health.findings).toContainEqual(
      expect.objectContaining({ code: "terminal-jobs" }),
    );
    expect(health.state).toBe("degraded");
  });

  it("reports expired running-job leases as critical", () => {
    const health = buildOverviewHealth(
      {
        ...healthySnapshot,
        jobs: {
          ...healthySnapshot.jobs,
          expiredLeaseCount: 2,
          running: 2,
        },
      },
      now,
    );

    expect(health.findings).toContainEqual(
      expect.objectContaining({
        code: "expired-job-lease",
        severity: "critical",
      }),
    );
  });

  it("reports due jobs queued for more than two hours", () => {
    const health = buildOverviewHealth(
      {
        ...healthySnapshot,
        jobs: {
          ...healthySnapshot.jobs,
          oldestDueQueuedAt: "2026-07-20T09:59:59.000Z",
          queued: 1,
        },
      },
      now,
    );

    expect(health.findings).toContainEqual(
      expect.objectContaining({
        code: "overdue-jobs",
        severity: "warning",
      }),
    );
  });
});
