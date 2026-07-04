import { describe, expect, it, vi } from "vitest";

import {
  buildNewsHomeCandidateOrderByExpressions,
  buildRelatedNewsCondition,
  getNewsDeskStatus,
  getNewsHomeData,
  getNewsRunSkipDiagnosticsFromMetadata,
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
