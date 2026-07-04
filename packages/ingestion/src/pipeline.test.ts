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
  getActiveHighSignalSourceSlugs,
  getActiveRssSourceSlugs,
  ingestActiveNewsSources,
  ingestActiveRssSources,
  ingestArxivAiSource,
  ingestGitHubTrendingAiSource,
  ingestHackerNewsAiSource,
  ingestRssSource,
  ingestYcAiSource,
  refreshActiveRssSources,
  refreshNewsSources,
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
  upsertResult: "created" | "updated" | "duplicate" = "created";
  sourcesSeeded = 0;
  requestedSourceSlugs: string[] = [];
  runsStarted: {
    id: string;
    sourceId?: string;
    runType: "rss" | "manual_import" | "api" | "crawler" | "backfill";
  }[] = [];
  runsFinished: Parameters<NewsRepository["finishIngestionRun"]>[0][] = [];
  runFinished:
    | {
        runId: string;
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
    if (slug === "github-trending-ai") {
      return Promise.resolve({
        id: sourceId,
        slug,
        feedUrl: null,
        credibility: 76,
      });
    }
    if (slug === "hacker-news-ai") {
      return Promise.resolve({
        id: sourceId,
        slug,
        feedUrl: null,
        credibility: 72,
      });
    }
    if (slug === "yc-ai") {
      return Promise.resolve({
        id: sourceId,
        slug,
        feedUrl: null,
        credibility: 80,
      });
    }
    if (slug === "arxiv-ai-ml") {
      return Promise.resolve({
        id: sourceId,
        slug,
        feedUrl: null,
        credibility: 86,
      });
    }

    return Promise.resolve({
      id: sourceId,
      slug,
      feedUrl: `https://example.com/${slug}.xml`,
      credibility: 95,
    });
  }

  startIngestionRun(input: Parameters<NewsRepository["startIngestionRun"]>[0]) {
    const run = {
      id: `run-${this.runsStarted.length + 1}`,
      ...input,
    };

    this.runsStarted.push(run);
    return Promise.resolve({ id: run.id });
  }

  finishIngestionRun(
    input: Parameters<NewsRepository["finishIngestionRun"]>[0],
  ) {
    this.runFinished = input;
    this.runsFinished.push(input);
    return Promise.resolve();
  }

  upsertNewsItem(item: NewsItemInput) {
    this.upsertedItems.push(item);
    return Promise.resolve(this.upsertResult);
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

const arxivPaper = {
  abstractUrl: "https://arxiv.org/abs/2607.01234v1",
  authors: ["Alice Chen", "Bob Lee", "Maya Patel"],
  categories: ["cs.AI", "cs.LG"],
  comment: "24 pages, 7 figures",
  id: "2607.01234v1",
  pdfUrl: "https://arxiv.org/pdf/2607.01234v1",
  primaryCategory: "cs.AI",
  publishedAt: "2026-07-02T17:03:10Z",
  summary: "We introduce a memory architecture for long-horizon AI agents.",
  title: "Agentic Memory for Long-Horizon AI Systems",
  updatedAt: "2026-07-02T17:03:10Z",
} as const;

describe("seedSources", () => {
  it("passes initial source definitions to the repository", async () => {
    const repository = new FakeRepository();

    await expect(seedSources({ repository })).resolves.toEqual({ created: 24 });
    expect(repository.sourcesSeeded).toBe(24);
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

  it("counts existing database stories as duplicate skips", async () => {
    const repository = new FakeRepository();
    repository.upsertResult = "duplicate";

    await expect(
      ingestRssSource({
        repository,
        sourceSlug: "openai-news",
        fetchFeed: () => Promise.resolve(rssXml),
        now: new Date("2026-07-01T12:00:00.000Z"),
      }),
    ).resolves.toEqual({
      itemsSeen: 1,
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsSkipped: 1,
      skippedByReason: {
        duplicate: 1,
        future: 0,
        irrelevant: 0,
        stale: 0,
      },
    });

    expect(repository.runFinished).toEqual({
      runId: "run-1",
      status: "succeeded",
      itemsSeen: 1,
      itemsCreated: 0,
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
        "product-hunt-ai",
      ]),
    );
  });
});

describe("getActiveHighSignalSourceSlugs", () => {
  it("returns active non-RSS sources with dedicated ingesters", () => {
    expect(getActiveHighSignalSourceSlugs()).toEqual([
      "arxiv-ai-ml",
      "hacker-news-ai",
      "github-trending-ai",
      "yc-ai",
    ]);
  });
});

describe("ingestArxivAiSource", () => {
  it("normalizes arXiv AI papers and records an API ingestion run", async () => {
    const repository = new FakeRepository();

    await expect(
      ingestArxivAiSource({
        fetchPapers: () => Promise.resolve([arxivPaper]),
        now: new Date("2026-07-04T12:00:00.000Z"),
        repository,
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

    expect(repository.runsStarted[0]).toEqual({
      id: "run-1",
      runType: "api",
      sourceId,
    });
    const upsertedItem = repository.upsertedItems[0];

    if (!upsertedItem) throw new Error("Expected arXiv item to be upserted");

    expect(upsertedItem).toMatchObject({
      canonicalUrl: "https://arxiv.org/abs/2607.01234v1",
      category: "research",
      sourceScore: 86,
      title: "arXiv paper: Agentic Memory for Long-Horizon AI Systems",
    });
    expect(upsertedItem.tags).toEqual(
      expect.arrayContaining(["arxiv", "research_paper", "cs_ai"]),
    );
  });
});

describe("ingestHackerNewsAiSource", () => {
  it("normalizes HN AI stories and records an API ingestion run", async () => {
    const repository = new FakeRepository();

    await expect(
      ingestHackerNewsAiSource({
        fetchStories: () =>
          Promise.resolve([
            {
              author: "pg",
              comments: 84,
              discussionUrl: "https://news.ycombinator.com/item?id=123456",
              id: "123456",
              points: 512,
              publishedAt: "2026-07-01T08:00:00Z",
              title: "Show HN: Agent runtime for browser workflows",
              url: "https://example.com/agent-runtime",
            },
          ]),
        now: new Date("2026-07-04T12:00:00.000Z"),
        repository,
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

    expect(repository.runsStarted[0]).toEqual({
      id: "run-1",
      runType: "api",
      sourceId,
    });
    const upsertedItem = repository.upsertedItems[0];

    if (!upsertedItem) throw new Error("Expected HN item to be upserted");

    expect(upsertedItem).toMatchObject({
      canonicalUrl: "https://example.com/agent-runtime",
      category: "agent_product",
      sourceScore: 72,
      title:
        "Hacker News discussion: Show HN: Agent runtime for browser workflows",
    });
    expect(upsertedItem.tags).toEqual(
      expect.arrayContaining(["hacker_news", "community_signal", "agent"]),
    );
  });
});

describe("ingestGitHubTrendingAiSource", () => {
  it("normalizes GitHub AI repositories and records an API ingestion run", async () => {
    const repository = new FakeRepository();

    await expect(
      ingestGitHubTrendingAiSource({
        repository,
        fetchRepositories: () =>
          Promise.resolve([
            {
              description: "A framework for production AI agents.",
              forks: 456,
              fullName: "acme/agent-runtime",
              language: "TypeScript",
              openIssues: 12,
              pushedAt: "2026-07-01T08:00:00Z",
              stars: 12_345,
              topics: ["ai-agents", "llm"],
              url: "https://github.com/acme/agent-runtime",
            },
          ]),
        now: new Date("2026-07-04T12:00:00.000Z"),
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

    expect(repository.runsStarted[0]).toEqual({
      id: "run-1",
      runType: "api",
      sourceId,
    });
    const upsertedItem = repository.upsertedItems[0];

    if (!upsertedItem) throw new Error("Expected GitHub item to be upserted");

    expect(upsertedItem).toMatchObject({
      canonicalUrl: "https://github.com/acme/agent-runtime",
      category: "open_source",
      sourceScore: 76,
      title: "acme/agent-runtime is trending in AI open source",
    });
    expect(upsertedItem.tags).toEqual(
      expect.arrayContaining(["github_repo", "open_source", "typescript"]),
    );
  });
});

describe("ingestYcAiSource", () => {
  it("normalizes YC AI companies and records an API ingestion run", async () => {
    const repository = new FakeRepository();

    await expect(
      ingestYcAiSource({
        fetchCompanies: () =>
          Promise.resolve([
            {
              batch: "Summer 2026",
              description:
                "We are building the communication layer for AI agents.",
              id: "33014",
              industries: ["B2B", "Infrastructure"],
              launchedAt: new Date("2026-07-01T04:53:32.000Z"),
              location: "Boston, MA, USA",
              name: "Inkbox",
              oneLiner:
                "Give your AI agents email, phone, iMessage and an internet address",
              profileUrl: "https://www.ycombinator.com/companies/inkbox",
              slug: "inkbox",
              tags: ["Developer Tools", "Infrastructure", "AI"],
              teamSize: 3,
              websiteUrl: "https://inkbox.ai",
            },
          ]),
        now: new Date("2026-07-04T12:00:00.000Z"),
        repository,
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

    expect(repository.runsStarted[0]).toEqual({
      id: "run-1",
      runType: "api",
      sourceId,
    });
    const upsertedItem = repository.upsertedItems[0];

    if (!upsertedItem) throw new Error("Expected YC item to be upserted");

    expect(upsertedItem).toMatchObject({
      canonicalUrl: "https://www.ycombinator.com/companies/inkbox",
      category: "yc_ai",
      sourceScore: 80,
      title: "Inkbox launched from YC as an AI company",
    });
    expect(upsertedItem.tags).toEqual(
      expect.arrayContaining(["yc", "yc_company", "ai_startup"]),
    );
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

  it("records a source-free aggregate run for partial active RSS refreshes", async () => {
    const repository = new FakeRepository();

    await ingestActiveRssSources({
      repository,
      fetchFeed: (url) => {
        if (url.includes("anthropic-news")) {
          return Promise.reject(new Error("feed unavailable"));
        }

        return Promise.resolve(rssXml);
      },
    });

    const aggregateRun = repository.runsStarted.at(-1);

    expect(aggregateRun).toEqual({
      id: "run-21",
      runType: "rss",
      sourceId: undefined,
    });
    expect(repository.runsFinished.at(-1)).toEqual({
      runId: "run-21",
      status: "partial",
      itemsSeen: 19,
      itemsCreated: 19,
      itemsUpdated: 0,
      errorMessage: "1 source failed",
      metadata: {
        itemsSkipped: 0,
        skippedByReason: {
          duplicate: 0,
          future: 0,
          irrelevant: 0,
          stale: 0,
        },
        sourceHealth: {
          emptySourceSlugs: [],
          failedSourceSlugs: ["anthropic-news"],
          failureMessages: {
            "anthropic-news": "feed unavailable",
          },
          healthySourceSlugs: getActiveRssSourceSlugs().filter(
            (slug) => slug !== "anthropic-news",
          ),
        },
        sourcesAttempted: 20,
        sourcesFailed: 1,
        sourcesSucceeded: 19,
      },
    });
  });
});

describe("ingestActiveNewsSources", () => {
  it("refreshes active RSS and high-signal non-RSS sources in one aggregate run", async () => {
    const repository = new FakeRepository();

    await expect(
      ingestActiveNewsSources({
        repository,
        fetchFeed: () => Promise.resolve(rssXml),
        fetchArxivPapers: () => Promise.resolve([arxivPaper]),
        fetchHackerNewsStories: () =>
          Promise.resolve([
            {
              author: "pg",
              comments: 84,
              discussionUrl: "https://news.ycombinator.com/item?id=123456",
              id: "123456",
              points: 512,
              publishedAt: "2026-07-01T08:00:00Z",
              title: "Show HN: Agent runtime for browser workflows",
              url: "https://example.com/agent-runtime",
            },
          ]),
        fetchGitHubRepositories: () =>
          Promise.resolve([
            {
              description: "A framework for production AI agents.",
              forks: 456,
              fullName: "acme/agent-runtime",
              language: "TypeScript",
              openIssues: 12,
              pushedAt: "2026-07-01T08:00:00Z",
              stars: 12_345,
              topics: ["ai-agents", "llm"],
              url: "https://github.com/acme/agent-runtime",
            },
          ]),
        fetchYcCompanies: () =>
          Promise.resolve([
            {
              batch: "Summer 2026",
              description:
                "We are building the communication layer for AI agents.",
              id: "33014",
              industries: ["B2B", "Infrastructure"],
              launchedAt: new Date("2026-07-01T04:53:32.000Z"),
              location: "Boston, MA, USA",
              name: "Inkbox",
              oneLiner:
                "Give your AI agents email, phone, iMessage and an internet address",
              profileUrl: "https://www.ycombinator.com/companies/inkbox",
              slug: "inkbox",
              tags: ["Developer Tools", "Infrastructure", "AI"],
              teamSize: 3,
              websiteUrl: "https://inkbox.ai",
            },
          ]),
        now: new Date("2026-07-04T12:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      sourcesAttempted: 24,
      sourcesSucceeded: 24,
      sourcesFailed: 0,
      itemsSeen: 24,
      itemsCreated: 24,
      itemsUpdated: 0,
      itemsSkipped: 0,
    });

    expect(repository.requestedSourceSlugs).toContain("arxiv-ai-ml");
    expect(repository.requestedSourceSlugs).toContain("hacker-news-ai");
    expect(repository.requestedSourceSlugs).toContain("github-trending-ai");
    expect(repository.requestedSourceSlugs).toContain("yc-ai");
    expect(repository.runsStarted.at(-1)).toEqual({
      id: "run-25",
      runType: "crawler",
      sourceId: undefined,
    });
    expect(repository.runsFinished.at(-1)).toMatchObject({
      runId: "run-25",
      status: "succeeded",
      metadata: {
        sourceHealth: {
          failedSourceSlugs: [],
          healthySourceSlugs: [
            ...getActiveRssSourceSlugs(),
            "arxiv-ai-ml",
            "hacker-news-ai",
            "github-trending-ai",
            "yc-ai",
          ],
        },
        sourcesAttempted: 24,
        sourcesFailed: 0,
        sourcesSucceeded: 24,
      },
    });
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
      sourcesSeeded: 24,
      sourcesAttempted: 20,
      sourcesSucceeded: 20,
      sourcesFailed: 0,
      itemsCreated: 20,
      itemsSkipped: 0,
    });

    expect(repository.sourcesSeeded).toBe(24);
    expect(repository.requestedSourceSlugs).toContain("openai-news");
  });
});

describe("refreshNewsSources", () => {
  it("seeds sources before refreshing RSS and high-signal sources", async () => {
    const repository = new FakeRepository();

    await expect(
      refreshNewsSources({
        repository,
        fetchFeed: () => Promise.resolve(rssXml),
        fetchArxivPapers: () => Promise.resolve([arxivPaper]),
        fetchHackerNewsStories: () =>
          Promise.resolve([
            {
              author: "pg",
              comments: 84,
              discussionUrl: "https://news.ycombinator.com/item?id=123456",
              id: "123456",
              points: 512,
              publishedAt: "2026-07-01T08:00:00Z",
              title: "Show HN: Agent runtime for browser workflows",
              url: "https://example.com/agent-runtime",
            },
          ]),
        fetchGitHubRepositories: () =>
          Promise.resolve([
            {
              description: "A framework for production AI agents.",
              forks: 456,
              fullName: "acme/agent-runtime",
              language: "TypeScript",
              openIssues: 12,
              pushedAt: "2026-07-01T08:00:00Z",
              stars: 12_345,
              topics: ["ai-agents", "llm"],
              url: "https://github.com/acme/agent-runtime",
            },
          ]),
        fetchYcCompanies: () =>
          Promise.resolve([
            {
              batch: "Summer 2026",
              description:
                "We are building the communication layer for AI agents.",
              id: "33014",
              industries: ["B2B", "Infrastructure"],
              launchedAt: new Date("2026-07-01T04:53:32.000Z"),
              location: "Boston, MA, USA",
              name: "Inkbox",
              oneLiner:
                "Give your AI agents email, phone, iMessage and an internet address",
              profileUrl: "https://www.ycombinator.com/companies/inkbox",
              slug: "inkbox",
              tags: ["Developer Tools", "Infrastructure", "AI"],
              teamSize: 3,
              websiteUrl: "https://inkbox.ai",
            },
          ]),
      }),
    ).resolves.toMatchObject({
      sourcesAttempted: 24,
      sourcesFailed: 0,
      sourcesSeeded: 24,
      sourcesSucceeded: 24,
    });

    expect(repository.sourcesSeeded).toBe(24);
    expect(repository.requestedSourceSlugs).toContain("arxiv-ai-ml");
    expect(repository.requestedSourceSlugs).toContain("hacker-news-ai");
    expect(repository.requestedSourceSlugs).toContain("github-trending-ai");
    expect(repository.requestedSourceSlugs).toContain("yc-ai");
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
