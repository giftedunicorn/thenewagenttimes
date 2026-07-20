import { describe, expect, it } from "vitest";

import { deriveSourceStatus } from "./sources";

const now = new Date("2026-07-20T12:00:00.000Z");

const healthySource = {
  feedUrl: "https://example.com/feed.xml",
  isActive: true,
  latestCollectedAt: "2026-07-20T10:00:00.000Z",
  latestIngestionStatus: "succeeded",
  sourceType: "rss",
  storyCount: 20,
} as const;

describe("deriveSourceStatus", () => {
  it("handles inactive and missing RSS feeds", () => {
    expect(deriveSourceStatus({ ...healthySource, isActive: false }, now)).toBe(
      "inactive",
    );
    expect(deriveSourceStatus({ ...healthySource, feedUrl: null }, now)).toBe(
      "critical",
    );
  });

  it("handles failures, empty sources, and stale content", () => {
    expect(
      deriveSourceStatus(
        { ...healthySource, latestIngestionStatus: "failed" },
        now,
      ),
    ).toBe("critical");
    expect(deriveSourceStatus({ ...healthySource, storyCount: 0 }, now)).toBe(
      "degraded",
    );
    expect(
      deriveSourceStatus(
        {
          ...healthySource,
          latestCollectedAt: "2026-07-17T11:59:59.000Z",
        },
        now,
      ),
    ).toBe("degraded");
  });

  it("marks active current sources healthy", () => {
    expect(deriveSourceStatus(healthySource, now)).toBe("healthy");
  });
});
