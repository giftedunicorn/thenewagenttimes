import { describe, expect, it } from "vitest";

import type {
  NewsItemInput,
  NewsItemVectorInput,
  NewsRepository,
  PendingEmbeddingNewsItem,
} from "./types";
import { createFakeEmbeddingProvider } from "./embedding";
import {
  buildNewsSourceHealthSummary,
  embedPendingNewsItems,
  getActiveRssSourceSlugs,
  ingestActiveRssSources,
  ingestRssSource,
  refreshActiveRssSources,
  seedSources,
} from "./pipeline";

const sourceId = "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0";

const noSkipped = () => ({
  itemsSkipped: 0,
  skippedByReason: {
    duplicate: 0,
    future: 0,
    irrelevant: 0,
    stale: 0,
  },
});

class FakeRepository implements NewsRepository {
  sourcesSeeded = 0;
  requestedSourceSlugs: string[] = [];
  runFinished:
    | {
        status: "succeeded" | "failed" | "partial";
        itemsSeen: number;
        itemsCreated: number;
        itemsUpdated: number;
        metadata?: Record<string, unknown>;
      }
    | undefined;
  upsertedItems: NewsItemInput[] = [];
  vectors: (NewsItemVectorInput & { newsItemId: string })[] = [];
  statuses: { id: string; status: string }[] = [];

  constructor(private readonly pendingItems: PendingEmbeddingNewsItem[] = []) {}

  seedSources(sources: Parameters<NewsRepository["seedSources"]>[0]) {
    this.sourcesSeeded = sources.length;
    return Promise.resolve({ created: sources.length });
  }

  findSourceBySlug(slug: string) {
    this.requestedSourceSlugs.push(slug);
    return Promise.resolve({
      id: sourceId,
      slug,
      feedUrl: `https://example.com/${slug}.xml`,
      credibility: 95,
    });
  }

  startIngestionRun() {
    return Promise.resolve({ id: "run-1" });
  }

  finishIngestionRun(
    input: Parameters<NewsRepository["finishIngestionRun"]>[0],
  ) {
    this.runFinished = input;
    return Promise.resolve();
  }

  upsertNewsItem(item: NewsItemInput) {
    this.upsertedItems.push(item);
    return Promise.resolve("created" as const);
  }

  findPendingEmbeddingItems() {
    return Promise.resolve(this.pendingItems);
  }

  insertNewsItemVector(vector: NewsItemVectorInput & { newsItemId: string }) {
    this.vectors.push(vector);
    return Promise.resolve();
  }

  updateEmbeddingStatus(newsItemId: string, status: string) {
    this.statuses.push({ id: newsItemId, status });
    return Promise.resolve();
  }
}

const rssXml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>OpenAI releases a new agent model</title>
      <link>https://example.com/openai-agent</link>
      <description>OpenAI shipped a new model for agentic workflows.</description>
      <pubDate>Sat, 27 Jun 2026 08:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const duplicateRssXml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>OpenAI releases a new agent model</title>
      <link>https://example.com/openai-agent?utm_source=rss</link>
      <description>OpenAI shipped a new model for agentic workflows.</description>
      <pubDate>Sat, 27 Jun 2026 08:00:00 GMT</pubDate>
    </item>
    <item>
      <title>OpenAI releases a new agent model</title>
      <link>https://example.com/openai-agent?utm_campaign=mirror</link>
      <description>OpenAI shipped a new model for agentic workflows.</description>
      <pubDate>Sat, 27 Jun 2026 08:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const mixedFreshnessRssXml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>OpenAI releases a new agent model</title>
      <link>https://example.com/openai-agent</link>
      <description>OpenAI shipped a new model for agentic workflows.</description>
      <pubDate>Sat, 27 Jun 2026 08:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Old benchmark note should stay out of the current edition</title>
      <link>https://example.com/old-benchmark</link>
      <description>A stale benchmark note from an older AI cycle.</description>
      <pubDate>Wed, 01 Apr 2026 08:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Future-dated launch should wait for the right edition</title>
      <link>https://example.com/future-launch</link>
      <description>A feed timestamp points too far into the future.</description>
      <pubDate>Fri, 10 Jul 2026 08:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const mixedRelevanceRssXml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>OpenAI releases a new agent model</title>
      <link>https://example.com/openai-agent</link>
      <description>OpenAI shipped a new model for agentic workflows.</description>
      <pubDate>Sat, 27 Jun 2026 08:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Streaming service adds a sports package</title>
      <link>https://example.com/sports-streaming</link>
      <description>A media company updates its weekend sports bundle.</description>
      <pubDate>Sat, 27 Jun 2026 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

describe("seedSources", () => {
  it("passes initial source definitions to the repository", async () => {
    const repository = new FakeRepository();

    await expect(seedSources({ repository })).resolves.toEqual({ created: 23 });
    expect(repository.sourcesSeeded).toBe(23);
  });
});

describe("ingestRssSource", () => {
  it("normalizes RSS items and records run counts", async () => {
    const repository = new FakeRepository();

    await expect(
      ingestRssSource({
        repository,
        sourceSlug: "openai-news",
        fetchFeed: () => Promise.resolve(rssXml),
        now: new Date("2026-07-01T12:00:00.000Z"),
      }),
    ).resolves.toEqual({
      itemsSeen: 1,
      itemsCreated: 1,
      itemsUpdated: 0,
      itemsSkipped: 0,
      skippedByReason: {
        duplicate: 0,
        future: 0,
        irrelevant: 0,
        stale: 0,
      },
    });

    expect(repository.upsertedItems[0]?.category).toBe("model_release");
    expect(repository.upsertedItems[0]?.sourceScore).toBe(95);
    expect(repository.upsertedItems[0]?.trendScore).toBeGreaterThan(0);
    expect(repository.runFinished).toEqual({
      runId: "run-1",
      status: "succeeded",
      itemsSeen: 1,
      itemsCreated: 1,
      itemsUpdated: 0,
      errorMessage: undefined,
    });
  });

  it("upserts duplicate feed items once while preserving raw seen counts", async () => {
    const repository = new FakeRepository();

    await expect(
      ingestRssSource({
        repository,
        sourceSlug: "openai-news",
        fetchFeed: () => Promise.resolve(duplicateRssXml),
      }),
    ).resolves.toEqual({
      itemsSeen: 2,
      itemsCreated: 1,
      itemsUpdated: 0,
      itemsSkipped: 1,
      skippedByReason: {
        duplicate: 1,
        future: 0,
        irrelevant: 0,
        stale: 0,
      },
    });

    expect(repository.upsertedItems).toHaveLength(1);
    expect(repository.runFinished).toEqual({
      runId: "run-1",
      status: "succeeded",
      itemsSeen: 2,
      itemsCreated: 1,
      itemsUpdated: 0,
      metadata: {
        itemsSkipped: 1,
        skippedByReason: {
          duplicate: 1,
          future: 0,
          irrelevant: 0,
          stale: 0,
        },
      },
      errorMessage: undefined,
    });
  });

  it("keeps stale and far-future RSS entries out of the current edition", async () => {
    const repository = new FakeRepository();

    await expect(
      ingestRssSource({
        repository,
        sourceSlug: "openai-news",
        fetchFeed: () => Promise.resolve(mixedFreshnessRssXml),
        now: new Date("2026-07-01T12:00:00.000Z"),
      }),
    ).resolves.toEqual({
      itemsSeen: 3,
      itemsCreated: 1,
      itemsUpdated: 0,
      itemsSkipped: 2,
      skippedByReason: {
        duplicate: 0,
        future: 1,
        irrelevant: 0,
        stale: 1,
      },
    });

    expect(repository.upsertedItems.map((item) => item.canonicalUrl)).toEqual([
      "https://example.com/openai-agent",
    ]);
    expect(repository.runFinished).toEqual({
      runId: "run-1",
      status: "succeeded",
      itemsSeen: 3,
      itemsCreated: 1,
      itemsUpdated: 0,
      metadata: {
        itemsSkipped: 2,
        skippedByReason: {
          duplicate: 0,
          future: 1,
          irrelevant: 0,
          stale: 1,
        },
      },
      errorMessage: undefined,
    });
  });

  it("keeps clearly non-AI RSS entries out of the current edition", async () => {
    const repository = new FakeRepository();

    await expect(
      ingestRssSource({
        repository,
        sourceSlug: "techcrunch-ai",
        fetchFeed: () => Promise.resolve(mixedRelevanceRssXml),
        now: new Date("2026-07-01T12:00:00.000Z"),
      }),
    ).resolves.toEqual({
      itemsSeen: 2,
      itemsCreated: 1,
      itemsUpdated: 0,
      itemsSkipped: 1,
      skippedByReason: {
        duplicate: 0,
        future: 0,
        irrelevant: 1,
        stale: 0,
      },
    });

    expect(repository.upsertedItems.map((item) => item.canonicalUrl)).toEqual([
      "https://example.com/openai-agent",
    ]);
  });
});

describe("getActiveRssSourceSlugs", () => {
  it("returns only active RSS-backed source slugs", () => {
    expect(getActiveRssSourceSlugs()).toEqual(
      expect.arrayContaining([
        "openai-news",
        "anthropic-news",
        "google-ai-blog",
        "deepmind-blog",
      ]),
    );
    expect(getActiveRssSourceSlugs()).not.toContain("product-hunt-ai");
  });
});

describe("ingestActiveRssSources", () => {
  it("ingests every active RSS source and summarizes partial failures", async () => {
    const repository = new FakeRepository();

    await expect(
      ingestActiveRssSources({
        repository,
        fetchFeed: (url) => {
          if (url.includes("anthropic-news")) {
            return Promise.reject(new Error("feed unavailable"));
          }

          return Promise.resolve(rssXml);
        },
      }),
    ).resolves.toMatchObject({
      sourcesAttempted: 20,
      sourcesSucceeded: 19,
      sourcesFailed: 1,
      itemsSeen: 19,
      itemsCreated: 19,
      itemsUpdated: 0,
      itemsSkipped: 0,
    });

    expect(repository.requestedSourceSlugs).toEqual(
      expect.arrayContaining(["openai-news", "anthropic-news"]),
    );
  });
});

describe("buildNewsSourceHealthSummary", () => {
  it("summarizes failed and empty source refresh results for deployment diagnostics", () => {
    expect(
      buildNewsSourceHealthSummary([
        {
          sourceSlug: "openai-news",
          status: "succeeded",
          itemsSeen: 3,
          itemsCreated: 2,
          itemsUpdated: 1,
          ...noSkipped(),
        },
        {
          sourceSlug: "anthropic-news",
          status: "succeeded",
          itemsSeen: 0,
          itemsCreated: 0,
          itemsUpdated: 0,
          ...noSkipped(),
        },
        {
          sourceSlug: "deepmind-blog",
          status: "failed",
          itemsSeen: 0,
          itemsCreated: 0,
          itemsUpdated: 0,
          ...noSkipped(),
          errorMessage: "feed unavailable",
        },
      ]),
    ).toEqual({
      healthySourceSlugs: ["openai-news"],
      emptySourceSlugs: ["anthropic-news"],
      failedSourceSlugs: ["deepmind-blog"],
      failureMessages: {
        "deepmind-blog": "feed unavailable",
      },
    });
  });
});

describe("refreshActiveRssSources", () => {
  it("seeds the source registry before active RSS ingestion", async () => {
    const repository = new FakeRepository();

    await expect(
      refreshActiveRssSources({
        repository,
        fetchFeed: () => Promise.resolve(rssXml),
      }),
    ).resolves.toMatchObject({
      sourcesSeeded: 23,
      sourcesAttempted: 20,
      sourcesSucceeded: 20,
      sourcesFailed: 0,
      itemsCreated: 20,
      itemsSkipped: 0,
    });

    expect(repository.sourcesSeeded).toBe(23);
    expect(repository.requestedSourceSlugs).toContain("openai-news");
  });
});

describe("embedPendingNewsItems", () => {
  it("stores vectors and marks successfully embedded items", async () => {
    const repository = new FakeRepository([
      {
        id: "news-1",
        title: "OpenAI releases a new agent model",
        summary: "A short summary.",
        bodyText: null,
        category: "model_release",
        tags: ["agent"],
        entities: ["OpenAI"],
      },
    ]);

    await expect(
      embedPendingNewsItems({
        repository,
        provider: createFakeEmbeddingProvider({ dimension: 3 }),
        limit: 10,
      }),
    ).resolves.toEqual({ embedded: 1, failed: 0 });

    expect(repository.vectors[0]).toMatchObject({
      newsItemId: "news-1",
      provider: "fake",
      model: "fake-embedding",
      dimension: 3,
      embedding: [0.03, 0.04, 0.05],
    });
    expect(repository.statuses).toEqual([{ id: "news-1", status: "embedded" }]);
  });
});
