import { describe, expect, it } from "vitest";

import type {
  NewsImageBackfillCursor,
  NewsImageBackfillRepository,
  NewsImageBackfillTarget,
} from "./image-backfill";
import { backfillMissingNewsImages } from "./image-backfill";

class FakeImageBackfillRepository implements NewsImageBackfillRepository {
  readonly cursors: (NewsImageBackfillCursor | undefined)[] = [];
  readonly updates: { id: string; imageUrl: string }[] = [];

  constructor(
    private readonly targets: readonly NewsImageBackfillTarget[],
    private readonly updateResult = true,
  ) {}

  findMissingNewsImages(input: {
    cursor?: NewsImageBackfillCursor;
    limit: number;
  }) {
    this.cursors.push(input.cursor);
    const startIndex = input.cursor
      ? this.targets.findIndex(
          (target) =>
            target.id === input.cursor?.id &&
            target.publishedAt.getTime() === input.cursor.publishedAt.getTime(),
        ) + 1
      : 0;

    return Promise.resolve(
      this.targets.slice(startIndex, startIndex + input.limit),
    );
  }

  updateMissingNewsImage(input: { id: string; imageUrl: string }) {
    this.updates.push(input);
    return Promise.resolve(this.updateResult);
  }
}

describe("backfillMissingNewsImages", () => {
  it("updates metadata images while skipping unsafe and image-less pages", async () => {
    const repository = new FakeImageBackfillRepository([
      {
        id: "with-image",
        pageUrl: "https://publisher.example/with-image",
        publishedAt: new Date("2026-07-20T05:00:00.000Z"),
      },
      {
        id: "without-image",
        pageUrl: "https://publisher.example/without-image",
        publishedAt: new Date("2026-07-20T04:00:00.000Z"),
      },
      {
        id: "unsafe",
        pageUrl: "http://127.0.0.1/private",
        publishedAt: new Date("2026-07-20T03:00:00.000Z"),
      },
      {
        id: "unsafe-image",
        pageUrl: "https://publisher.example/unsafe-image",
        publishedAt: new Date("2026-07-20T02:00:00.000Z"),
      },
      {
        id: "failed",
        pageUrl: "https://publisher.example/failed",
        publishedAt: new Date("2026-07-20T01:00:00.000Z"),
      },
    ]);
    const fetchedUrls: string[] = [];

    const result = await backfillMissingNewsImages({
      fetchPage: (pageUrl) => {
        fetchedUrls.push(pageUrl);
        if (pageUrl.endsWith("/failed")) {
          return Promise.reject(new Error("request failed"));
        }

        return Promise.resolve({
          html: pageUrl.endsWith("/with-image")
            ? '<meta property="og:image" content="/story.jpg">'
            : pageUrl.endsWith("/unsafe-image")
              ? '<meta property="og:image" content="https://private.example/story.jpg">'
              : "<title>No image</title>",
          pageUrl,
        });
      },
      batchSize: 2,
      isSafeImageUrl: (imageUrl) =>
        Promise.resolve(!imageUrl.includes("private.example")),
      isSafePageUrl: (pageUrl) =>
        Promise.resolve(!pageUrl.includes("127.0.0.1")),
      repository,
    });

    expect(result).toEqual({
      failed: 1,
      failures: [
        {
          id: "failed",
          message: "request failed",
          pageUrl: "https://publisher.example/failed",
        },
      ],
      seen: 5,
      skipped: 3,
      updated: 1,
    });
    expect(repository.cursors).toHaveLength(3);
    expect(fetchedUrls).not.toContain("http://127.0.0.1/private");
    expect(repository.updates).toEqual([
      {
        id: "with-image",
        imageUrl: "https://publisher.example/story.jpg",
      },
    ]);
  });

  it("counts a conditional update race as skipped", async () => {
    const repository = new FakeImageBackfillRepository(
      [
        {
          id: "already-updated",
          pageUrl: "https://publisher.example/story",
          publishedAt: new Date("2026-07-20T01:00:00.000Z"),
        },
      ],
      false,
    );

    const result = await backfillMissingNewsImages({
      fetchPage: (pageUrl) =>
        Promise.resolve({
          html: '<meta property="og:image" content="/story.jpg">',
          pageUrl,
        }),
      isSafePageUrl: () => Promise.resolve(true),
      isSafeImageUrl: () => Promise.resolve(true),
      batchSize: 1,
      repository,
    });

    expect(result).toEqual({
      failed: 0,
      failures: [],
      seen: 1,
      skipped: 1,
      updated: 0,
    });
  });

  it("counts URL resolution failures as failed work", async () => {
    const repository = new FakeImageBackfillRepository([
      {
        id: "dns-failed",
        pageUrl: "https://publisher.example/story",
        publishedAt: new Date("2026-07-20T01:00:00.000Z"),
      },
    ]);

    const result = await backfillMissingNewsImages({
      fetchPage: () => Promise.reject(new Error("fetch should not run")),
      isSafeImageUrl: () => Promise.resolve(true),
      isSafePageUrl: () => Promise.reject(new Error("DNS unavailable")),
      repository,
    });

    expect(result).toEqual({
      failed: 1,
      failures: [
        {
          id: "dns-failed",
          message: "DNS unavailable",
          pageUrl: "https://publisher.example/story",
        },
      ],
      seen: 1,
      skipped: 0,
      updated: 0,
    });
  });
});
