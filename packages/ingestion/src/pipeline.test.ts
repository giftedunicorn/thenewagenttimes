import { describe, expect, it } from "vitest";

import type {
  NewsItemInput,
  NewsItemVectorInput,
  NewsRepository,
  PendingEmbeddingNewsItem,
} from "./types";
import { createFakeEmbeddingProvider } from "./embedding";
import {
  embedPendingNewsItems,
  ingestRssSource,
  seedSources,
} from "./pipeline";

const sourceId = "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0";

class FakeRepository implements NewsRepository {
  sourcesSeeded = 0;
  runFinished:
    | {
        status: "succeeded" | "failed" | "partial";
        itemsSeen: number;
        itemsCreated: number;
        itemsUpdated: number;
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

  findSourceBySlug() {
    return Promise.resolve({
      id: sourceId,
      slug: "openai-news",
      feedUrl: "https://example.com/rss.xml",
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

describe("seedSources", () => {
  it("passes initial source definitions to the repository", async () => {
    const repository = new FakeRepository();

    await expect(seedSources({ repository })).resolves.toEqual({ created: 12 });
    expect(repository.sourcesSeeded).toBe(12);
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
      }),
    ).resolves.toEqual({
      itemsSeen: 1,
      itemsCreated: 1,
      itemsUpdated: 0,
    });

    expect(repository.upsertedItems[0]?.category).toBe("model_release");
    expect(repository.runFinished).toEqual({
      runId: "run-1",
      status: "succeeded",
      itemsSeen: 1,
      itemsCreated: 1,
      itemsUpdated: 0,
      errorMessage: undefined,
    });
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
