import { describe, expect, it } from "vitest";

import {
  ingestionListInput,
  parseSourceHealthMetadata,
  toSafeIngestionDetail,
} from "./ingestion";

describe("ingestionListInput", () => {
  it("accepts bounded filters and rejects unknown keys", () => {
    expect(
      ingestionListInput.parse({
        page: 0,
        pageSize: 50,
        runType: "rss",
        status: "failed",
      }),
    ).toMatchObject({ page: 0, pageSize: 50 });

    expect(() => ingestionListInput.parse({ page: 0, pageSize: 51 })).toThrow();
    expect(() =>
      ingestionListInput.parse({ page: 0, pageSize: 20, typo: true }),
    ).toThrow();
  });
});

describe("parseSourceHealthMetadata", () => {
  it("fails closed for malformed metadata", () => {
    expect(parseSourceHealthMetadata(null)).toBeNull();
    expect(
      parseSourceHealthMetadata({ sourceHealth: "not-an-object" }),
    ).toBeNull();
  });

  it("returns only bounded diagnostics", () => {
    expect(
      parseSourceHealthMetadata({
        sourceHealth: {
          failed: ["feed-a", 12, "feed-b"],
          notes: {
            sourceA: "Timed out",
            sourceB: 42,
          },
          succeeded: ["feed-c"],
        },
      }),
    ).toEqual({
      failed: ["feed-a", "feed-b"],
      notes: { sourceA: "Timed out" },
      succeeded: ["feed-c"],
    });
  });
});

describe("toSafeIngestionDetail", () => {
  it("omits raw metadata and exposes only parsed source diagnostics", () => {
    const detail = toSafeIngestionDetail({
      errorMessage: "failed",
      finishedAt: new Date("2026-07-20T10:05:00.000Z"),
      id: "run-1",
      metadata: {
        internalToken: "must-not-leak",
        sourceHealth: {
          failed: ["feed-a"],
          notes: { "feed-a": "Timed out" },
          succeeded: [],
        },
      },
      startedAt: new Date("2026-07-20T10:00:00.000Z"),
    });

    expect(detail).not.toHaveProperty("metadata");
    expect(JSON.stringify(detail)).not.toContain("must-not-leak");
    expect(detail.sourceHealth).toEqual({
      failed: ["feed-a"],
      notes: { "feed-a": "Timed out" },
      succeeded: [],
    });
  });
});
