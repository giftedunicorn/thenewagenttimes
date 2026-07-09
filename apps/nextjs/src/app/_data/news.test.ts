import { describe, expect, it, vi } from "vitest";

import {
  buildNewsHomeCandidateOrderByExpressions,
  buildNewsSearchEditionCondition,
  buildRelatedNewsCondition,
  buildRelatedNewsOrderByExpressions,
  getNewsCollaborativeSignals,
  getNewsDeskStatus,
  getNewsEditionPageData,
  getNewsHomeData,
  getNewsRunSkipDiagnosticsFromMetadata,
  getNewsSchemaReadiness,
  getNewsSemanticSimilarityMatches,
  shouldReadNewsArticleFromDatabase,
} from "./news";

const newsDbMock = vi.hoisted(() => {
  interface QueryResult {
    reject?: Error;
    resolve?: unknown;
  }

  const queuedResults: QueryResult[] = [];

  class MockNewsQuery implements PromiseLike<unknown> {
    constructor(private readonly result: QueryResult) {}

    from() {
      return this;
    }

    groupBy() {
      return this;
    }

    innerJoin() {
      return this;
    }

    leftJoin() {
      return this;
    }

    limit() {
      return this;
    }

    orderBy() {
      return this;
    }

    where() {
      return this;
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?:
        | ((value: unknown) => PromiseLike<TResult1> | TResult1)
        | null,
      onrejected?:
        | ((reason: unknown) => PromiseLike<TResult2> | TResult2)
        | null,
    ) {
      const promise = this.result.reject
        ? Promise.reject(this.result.reject)
        : Promise.resolve(this.result.resolve);

      return promise.then(onfulfilled, onrejected);
    }
  }

  return {
    execute: vi.fn(
      () =>
        queuedResults.shift()?.resolve ?? {
          rows: [],
        },
    ),
    queueResults: (...results: QueryResult[]) => {
      queuedResults.push(...results);
    },
    reset: () => {
      queuedResults.length = 0;
    },
    select: vi.fn(
      () =>
        new MockNewsQuery(
          queuedResults.shift() ?? {
            reject: new Error("missing news_source table"),
          },
        ),
    ),
  };
});

vi.mock("@acme/db/client", () => ({
  db: {
    execute: newsDbMock.execute,
    select: newsDbMock.select,
  },
}));

interface SqlDebugChunk {
  name?: unknown;
  queryChunks?: unknown;
  value?: unknown;
}

const isSqlDebugChunk = (value: unknown): value is SqlDebugChunk =>
  typeof value === "object" && value !== null;

const collectSqlDebugText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (!isSqlDebugChunk(value)) return "";

  const stringValues = Array.isArray(value.value)
    ? value.value
        .filter((entry): entry is string => typeof entry === "string")
        .join(" ")
    : "";
  const name = typeof value.name === "string" ? value.name : "";
  const chunks = Array.isArray(value.queryChunks)
    ? value.queryChunks.map(collectSqlDebugText).join(" ")
    : "";

  return [name, stringValues, chunks].filter(Boolean).join(" ");
};

const liveNewsRow = {
  id: "7c8c33ef-4f20-4f78-93ea-9400c4023902",
  title: "Agent browsers move into daily software workflows",
  summary:
    "Browser agents are being evaluated on repeatable task completion and clean handoffs.",
  canonicalUrl: "https://example.com/agent-browsers",
  clusterKey: "2026-07-01:agent_product:agent-browsers",
  imageUrl: null,
  originalUrl: "https://example.com/agent-browsers",
  publishedAt: new Date("2026-07-01T08:35:00.000Z"),
  category: "agent_product",
  tags: ["agents", "browser"],
  entities: ["Browser Agents"],
  sourceScore: 91,
  trendScore: 89,
  sourceName: "TechCrunch AI",
  sourceSlug: "techcrunch-ai",
  sourceType: "media",
};

describe("buildRelatedNewsCondition", () => {
  it("recalls related article candidates that share fine-grained tags", () => {
    const condition = buildRelatedNewsCondition({
      article: {
        category: "agent_product",
        entities: ["OpenAI"],
        tags: ["agents"],
      },
      articleId: "current-article",
    });

    const sqlText = collectSqlDebugText(condition);

    expect(sqlText).toContain("tags");
    expect(sqlText).toContain("&&");
  });

  it("casts related entity and tag recall values as Postgres text arrays", () => {
    const condition = buildRelatedNewsCondition({
      article: {
        category: "agent_product",
        entities: ["OpenAI", "Agents"],
        tags: ["browser_agent", "model_ops"],
      },
      articleId: "current-article",
    });

    const sqlText = collectSqlDebugText(condition);

    expect(sqlText).toContain("entities");
    expect(sqlText).toContain("tags");
    expect(sqlText.match(/array\[/g) ?? []).toHaveLength(2);
    expect(sqlText.match(/::text\[\]/g) ?? []).toHaveLength(2);
  });
});

describe("buildRelatedNewsOrderByExpressions", () => {
  it("ranks same-cluster article candidates ahead of broader related recalls", () => {
    const orderText = buildRelatedNewsOrderByExpressions({
      article: {
        clusterKey: "2026-07-01:model_release:openai:gpt-6",
      },
    })
      .map(collectSqlDebugText)
      .join(" ");

    expect(orderText.indexOf("clusterKey")).toBeGreaterThanOrEqual(0);
    expect(orderText.indexOf("clusterKey")).toBeLessThan(
      orderText.indexOf("trendScore"),
    );
    expect(orderText.indexOf("trendScore")).toBeLessThan(
      orderText.indexOf("publishedAt"),
    );
  });
});

describe("buildNewsHomeCandidateOrderByExpressions", () => {
  it("recalls fresh homepage candidates before heat-only ordering", () => {
    const orderText = buildNewsHomeCandidateOrderByExpressions()
      .map(collectSqlDebugText)
      .join(" ");

    expect(orderText.indexOf("publishedAt")).toBeLessThan(
      orderText.indexOf("trendScore"),
    );
  });
});

describe("buildNewsSearchEditionCondition", () => {
  it("searches published story, source, tag, and entity text", () => {
    const condition = buildNewsSearchEditionCondition("browser agents");
    const sqlText = collectSqlDebugText(condition);

    expect(sqlText).toContain("status");
    expect(sqlText).toContain("title");
    expect(sqlText).toContain("summary");
    expect(sqlText).toContain("category");
    expect(sqlText).toContain("name");
    expect(sqlText).toContain("slug");
    expect(sqlText).toContain("entities");
    expect(sqlText).toContain("tags");
    expect(sqlText.match(/ilike/g) ?? []).not.toHaveLength(0);
  });
});

describe("shouldReadNewsArticleFromDatabase", () => {
  it("skips database article lookup for preview ids", () => {
    expect(shouldReadNewsArticleFromDatabase("preview-desk")).toBe(false);
    expect(
      shouldReadNewsArticleFromDatabase("7c8c33ef-4f20-4f78-93ea-9400c4023902"),
    ).toBe(true);
  });
});

describe("getNewsHomeData", () => {
  it("serves the preview edition while a connected database has no published stories", async () => {
    newsDbMock.reset();
    newsDbMock.queueResults(
      { resolve: [] },
      {
        resolve: [
          {
            activeSources: 6,
            totalSources: 8,
          },
        ],
      },
      {
        resolve: [
          {
            embeddedStories: 0,
            latestPublishedAt: null,
            publishedStories: 0,
            unembeddedStories: 0,
          },
        ],
      },
      { resolve: [] },
    );

    const data = await getNewsHomeData();

    expect(data.status).toBe("empty");
    expect(data.deskStatus.health).toBe("seeded");
    expect(data.deskStatus.activeSources).toBe(6);
    expect(data.items).toHaveLength(12);
    expect(data.items[0]?.id).toBe("preview-model-shift");
  });

  it("serves the preview edition without reporting a console error", async () => {
    newsDbMock.reset();
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const data = await getNewsHomeData();

    expect(data.status).toBe("unavailable");
    expect(data.deskStatus.health).toBe("unavailable");
    expect(data.deskStatus.publishedStories).toBe(0);
    expect(
      data.items.some(
        (item) =>
          item.id === "preview-model-shift" &&
          item.title ===
            "Model releases shift from benchmark wins to agent reliability",
      ),
    ).toBe(true);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "Unable to load news homepage data",
      "missing news_source table",
    );

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe("getNewsSemanticSimilarityMatches", () => {
  it("skips vector lookup for preview ids that cannot exist in the database", async () => {
    newsDbMock.reset();
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    await expect(
      getNewsSemanticSimilarityMatches({
        feedbackItems: [
          {
            action: "save",
            newsItemId: "preview-saved-story",
            occurredAt: "2026-07-06T09:30:00.000Z",
          },
        ],
        items: [
          {
            canonicalUrl: "https://thenewagenttimes.test/preview-story",
            clusterKey: "preview-story",
            id: "preview-story",
            originalUrl: null,
          },
        ],
      }),
    ).resolves.toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("builds semantic matches from the latest stored vectors", async () => {
    const genericStoryId = "7c8c33ef-4f20-4f78-93ea-9400c4023902";
    const semanticStoryId = "8c8c33ef-4f20-4f78-93ea-9400c4023902";
    const savedStoryId = "9c8c33ef-4f20-4f78-93ea-9400c4023902";

    newsDbMock.reset();
    newsDbMock.queueResults({
      resolve: [
        {
          createdAt: new Date("2026-07-06T10:00:00.000Z"),
          embedding: [1, 0],
          newsItemId: semanticStoryId,
        },
        {
          createdAt: new Date("2026-07-06T10:00:00.000Z"),
          embedding: [0, 1],
          newsItemId: genericStoryId,
        },
        {
          createdAt: new Date("2026-07-06T09:30:00.000Z"),
          embedding: [1, 0],
          newsItemId: savedStoryId,
        },
      ],
    });

    await expect(
      getNewsSemanticSimilarityMatches({
        feedbackItems: [
          {
            action: "save",
            canonicalUrl: "https://example.com/saved-policy-story",
            newsItemId: savedStoryId,
            occurredAt: "2026-07-06T09:30:00.000Z",
            originalUrl: null,
          },
        ],
        items: [
          {
            canonicalUrl: "https://example.com/generic-agent-story",
            clusterKey: "generic-agent-story",
            id: genericStoryId,
            originalUrl: null,
          },
          {
            canonicalUrl: "https://example.com/semantic-follow-up",
            clusterKey: "semantic-follow-up",
            id: semanticStoryId,
            originalUrl: null,
          },
        ],
      }),
    ).resolves.toEqual([
      {
        newsItemId: semanticStoryId,
        occurredAt: "2026-07-06T09:30:00.000Z",
        similarity: 1,
        strength: 2,
      },
    ]);
  });
});

describe("getNewsCollaborativeSignals", () => {
  it("skips reader-interaction lookup for preview ids that cannot exist in the database", async () => {
    newsDbMock.reset();
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    await expect(
      getNewsCollaborativeSignals({
        items: [
          {
            category: "agent_product",
            clusterKey: "preview-agent-story",
            entities: ["OpenAI"],
            id: "preview-agent-story",
            sourceSlug: "preview-agent-desk",
            tags: ["agents"],
          },
        ],
      }),
    ).resolves.toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("builds collaborative signals from recent reader interactions", async () => {
    const crowdStoryId = "7c8c33ef-4f20-4f78-93ea-9400c4023902";
    const thinStoryId = "8c8c33ef-4f20-4f78-93ea-9400c4023902";

    newsDbMock.reset();
    newsDbMock.queueResults({
      resolve: [
        {
          canonicalUrl: "https://example.com/crowd-agent-story",
          category: "agent_product",
          clusterKey: "crowd-agent-story",
          deepReadCount: 1,
          entities: ["OpenAI"],
          hideCount: 0,
          newsItemId: crowdStoryId,
          originalUrl: "https://source.example.com/crowd-agent-story",
          readerCount: 2,
          saveCount: 1,
          shareCount: 0,
          sourceClickCount: 1,
          sourceSlug: "agent-desk",
          tags: ["browser agents"],
        },
        {
          canonicalUrl: "https://example.com/thin-agent-story",
          category: "agent_product",
          clusterKey: "thin-agent-story",
          deepReadCount: 0,
          entities: ["OpenAI"],
          hideCount: 0,
          newsItemId: thinStoryId,
          originalUrl: "https://source.example.com/thin-agent-story",
          readerCount: 1,
          saveCount: 1,
          shareCount: 0,
          sourceClickCount: 0,
          sourceSlug: "agent-desk",
          tags: ["browser agents"],
        },
      ],
    });

    await expect(
      getNewsCollaborativeSignals({
        items: [
          {
            category: "agent_product",
            clusterKey: "crowd-agent-story",
            entities: ["OpenAI"],
            id: crowdStoryId,
            sourceSlug: "agent-desk",
            tags: ["browser agents"],
          },
          {
            category: "agent_product",
            clusterKey: "thin-agent-story",
            entities: ["OpenAI"],
            id: thinStoryId,
            sourceSlug: "agent-desk",
            tags: ["browser agents"],
          },
        ],
      }),
    ).resolves.toEqual([
      {
        canonicalUrl: "https://example.com/crowd-agent-story",
        category: "agent_product",
        clusterKey: "crowd-agent-story",
        entities: ["OpenAI"],
        newsItemId: crowdStoryId,
        originalUrl: "https://source.example.com/crowd-agent-story",
        score: 5,
        sourceSlug: "agent-desk",
        tags: ["browser agents"],
      },
    ]);
  });
});

describe("getNewsEditionPageData", () => {
  it("returns live topic edition stories filtered by category", async () => {
    newsDbMock.reset();
    newsDbMock.queueResults({ resolve: [liveNewsRow] });

    const data = await getNewsEditionPageData({
      kind: "topic",
      value: "agent_product",
    });

    expect(data.status).toBe("ready");
    expect(data.filter).toEqual({
      kind: "topic",
      title: "Agents",
      value: "agent_product",
    });
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({
      category: "agent_product",
      sourceSlug: "techcrunch-ai",
      title: "Agent browsers move into daily software workflows",
    });
  });

  it("returns live source edition stories filtered by source slug", async () => {
    newsDbMock.reset();
    newsDbMock.queueResults({ resolve: [liveNewsRow] });

    const data = await getNewsEditionPageData({
      kind: "source",
      value: "techcrunch-ai",
    });

    expect(data.status).toBe("ready");
    expect(data.filter).toEqual({
      kind: "source",
      title: "TechCrunch AI",
      value: "techcrunch-ai",
    });
    expect(data.items.map((item) => item.sourceSlug)).toEqual([
      "techcrunch-ai",
    ]);
  });

  it("returns live search edition stories with a shareable search filter", async () => {
    newsDbMock.reset();
    newsDbMock.queueResults({ resolve: [liveNewsRow] });

    const data = await getNewsEditionPageData({
      kind: "search",
      value: " browser agents ",
    });

    expect(data.status).toBe("ready");
    expect(data.filter).toEqual({
      kind: "search",
      title: "Search: browser agents",
      value: "browser agents",
    });
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({
      id: "7c8c33ef-4f20-4f78-93ea-9400c4023902",
      title: "Agent browsers move into daily software workflows",
    });
  });

  it("serves filtered preview topic stories while the connected database has no matching edition stories", async () => {
    newsDbMock.reset();
    newsDbMock.queueResults({ resolve: [] });

    const data = await getNewsEditionPageData({
      kind: "topic",
      value: "agent_product",
    });

    expect(data.status).toBe("empty");
    expect(data.filter).toEqual({
      kind: "topic",
      title: "Agents",
      value: "agent_product",
    });
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((item) => item.category === "agent_product")).toBe(
      true,
    );
  });

  it("serves canonical preview topic stories for hyphenated topic URLs", async () => {
    newsDbMock.reset();
    newsDbMock.queueResults({ resolve: [] });

    const data = await getNewsEditionPageData({
      kind: "topic",
      value: "agent-product",
    });

    expect(data.status).toBe("empty");
    expect(data.filter).toEqual({
      kind: "topic",
      title: "Agents",
      value: "agent_product",
    });
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((item) => item.category === "agent_product")).toBe(
      true,
    );
  });

  it("serves filtered preview source stories while the connected database has no matching edition stories", async () => {
    newsDbMock.reset();
    newsDbMock.queueResults({ resolve: [] });

    const data = await getNewsEditionPageData({
      kind: "source",
      value: "preview-recommendation-desk",
    });

    expect(data.status).toBe("empty");
    expect(data.filter).toEqual({
      kind: "source",
      title: "Recommendation Desk",
      value: "preview-recommendation-desk",
    });
    expect(data.items.map((item) => item.sourceSlug)).toEqual([
      "preview-recommendation-desk",
    ]);
  });

  it("serves filtered preview entity stories while the connected database has no matching edition stories", async () => {
    newsDbMock.reset();
    newsDbMock.queueResults({ resolve: [] });

    const data = await getNewsEditionPageData({
      kind: "entity" as never,
      value: "OpenAI",
    });

    expect(data.status).toBe("empty");
    expect(data.filter).toEqual({
      kind: "entity",
      title: "OpenAI",
      value: "OpenAI",
    });
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((item) => item.entities.includes("OpenAI"))).toBe(
      true,
    );
  });

  it("serves filtered preview search stories while the connected database has no matching search stories", async () => {
    newsDbMock.reset();
    newsDbMock.queueResults({ resolve: [] });

    const data = await getNewsEditionPageData({
      kind: "search",
      value: "Recommendation Engine",
    });

    expect(data.status).toBe("empty");
    expect(data.filter).toEqual({
      kind: "search",
      title: "Search: Recommendation Engine",
      value: "Recommendation Engine",
    });
    expect(data.items.map((item) => item.id)).toEqual([
      "preview-recommendations",
    ]);
  });

  it("serves filtered preview search stories for hyphenated topic queries", async () => {
    newsDbMock.reset();
    newsDbMock.queueResults({ resolve: [] });

    const data = await getNewsEditionPageData({
      kind: "search",
      value: "model-release",
    });

    expect(data.status).toBe("empty");
    expect(data.filter).toEqual({
      kind: "search",
      title: "Search: model-release",
      value: "model-release",
    });
    expect(data.items.map((item) => item.id)).toContain("preview-model-shift");
  });

  it("falls back to filtered preview topic stories when the news database is unavailable", async () => {
    newsDbMock.reset();

    const data = await getNewsEditionPageData({
      kind: "topic",
      value: "agent_product",
    });

    expect(data.status).toBe("unavailable");
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((item) => item.category === "agent_product")).toBe(
      true,
    );
  });
});

describe("getNewsDeskStatus", () => {
  it("normalizes raw aggregate timestamp strings returned by the database driver", async () => {
    newsDbMock.reset();
    newsDbMock.queueResults(
      {
        resolve: [
          {
            activeSources: 21,
            totalSources: 24,
          },
        ],
      },
      {
        resolve: [
          {
            embeddedStories: 390,
            latestPublishedAt: "2026-07-04T10:00:00.000Z",
            publishedStories: 390,
            unembeddedStories: 0,
          },
        ],
      },
      { resolve: [] },
    );

    await expect(getNewsDeskStatus()).resolves.toMatchObject({
      health: "live",
      latestPublishedAt: "2026-07-04T10:00:00.000Z",
      publishedStories: 390,
    });
  });
});

describe("getNewsSchemaReadiness", () => {
  it("marks a nullable cluster key column incomplete until predeploy finishes", async () => {
    newsDbMock.reset();
    newsDbMock.queueResults({
      resolve: {
        rows: [
          {
            isNullable: "YES",
          },
        ],
      },
    });

    await expect(getNewsSchemaReadiness()).resolves.toEqual({
      newsItemClusterKey: "incomplete",
    });
  });
});

describe("getNewsRunSkipDiagnosticsFromMetadata", () => {
  it("extracts persisted skipped feed diagnostics from run metadata", () => {
    expect(
      getNewsRunSkipDiagnosticsFromMetadata({
        itemsSkipped: 5,
        skippedByReason: {
          duplicate: 1,
          future: 1,
          irrelevant: 2,
          low_quality: 0,
          stale: 1,
        },
      }),
    ).toEqual({
      itemsSkipped: 5,
      skippedByReason: {
        duplicate: 1,
        future: 1,
        irrelevant: 2,
        low_quality: 0,
        stale: 1,
      },
    });
  });

  it("extracts persisted aggregate source health diagnostics from run metadata", () => {
    expect(
      getNewsRunSkipDiagnosticsFromMetadata({
        sourceHealth: {
          emptySourceSlugs: ["google-ai-blog"],
          failedSourceSlugs: ["anthropic-news"],
          failureMessages: {
            "anthropic-news": "feed unavailable",
          },
          healthySourceSlugs: ["openai-news", "deepmind-blog"],
        },
      }),
    ).toMatchObject({
      sourceHealth: {
        emptySourceSlugs: ["google-ai-blog"],
        failedSourceSlugs: ["anthropic-news"],
        failureMessages: {
          "anthropic-news": "feed unavailable",
        },
        healthySourceSlugs: ["openai-news", "deepmind-blog"],
      },
    });
  });

  it("falls back to zero diagnostics for older ingestion runs", () => {
    expect(getNewsRunSkipDiagnosticsFromMetadata({})).toEqual({
      itemsSkipped: 0,
      skippedByReason: {
        duplicate: 0,
        future: 0,
        irrelevant: 0,
        low_quality: 0,
        stale: 0,
      },
    });
  });
});
