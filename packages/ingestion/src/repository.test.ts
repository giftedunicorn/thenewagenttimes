import { describe, expect, it } from "vitest";

import type { NewsItemInput } from "./types";
import {
  buildEmbeddingQueueCondition,
  getIngestionRunFinishUpdateValues,
  getNewsItemRefreshDbUpdateValues,
  getNewsItemRefreshUpdateValues,
  shouldResetNewsItemEmbeddingFromRefresh,
  shouldUpdateNewsItemFromRefresh,
} from "./repository";

interface SqlDebugChunk {
  name?: unknown;
  queryChunks?: unknown;
  value?: unknown;
}

const isSqlDebugChunk = (value: unknown): value is SqlDebugChunk =>
  typeof value === "object" && value !== null;

const collectSqlDebugText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(collectSqlDebugText).join(" ");
  if (!isSqlDebugChunk(value)) return "";

  const stringValues =
    typeof value.value === "string"
      ? value.value
      : Array.isArray(value.value)
        ? value.value.map(collectSqlDebugText).join(" ")
        : "";
  const name = typeof value.name === "string" ? value.name : "";
  const chunks = Array.isArray(value.queryChunks)
    ? value.queryChunks.map(collectSqlDebugText).join(" ")
    : "";

  return [name, stringValues, chunks].filter(Boolean).join(" ");
};

const publishedAt = new Date("2026-07-01T08:00:00.000Z");

const newsItem = {
  canonicalUrl: "https://example.com/openai-agent",
  category: "model_release",
  dedupeKey: "openai-agent-model",
  embeddingStatus: "pending",
  entities: ["OpenAI"],
  originalUrl: "https://example.com/openai-agent?utm_source=rss",
  publishedAt,
  sourceId: "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0",
  sourceScore: 95,
  status: "published",
  summary: "OpenAI shipped a new model for agentic workflows.",
  tags: ["model_release", "model", "agent"],
  title: "OpenAI releases a new agent model",
  trendScore: 72,
} satisfies NewsItemInput;

describe("getNewsItemRefreshUpdateValues", () => {
  it("keeps refresh updates scoped to mutable story fields", () => {
    const updateValues = getNewsItemRefreshUpdateValues(newsItem);

    expect(updateValues).toMatchObject({
      authorName: null,
      bodyText: null,
      category: "model_release",
      entities: ["OpenAI"],
      imageUrl: null,
      language: "en",
      originalUrl: "https://example.com/openai-agent?utm_source=rss",
      publishedAt,
      sourceScore: 95,
      status: "published",
      summary: "OpenAI shipped a new model for agentic workflows.",
      tags: ["model_release", "model", "agent"],
      title: "OpenAI releases a new agent model",
      trendScore: 72,
    });
    expect("dedupeKey" in updateValues).toBe(false);
    expect("embeddingStatus" in updateValues).toBe(false);
    expect("sourceId" in updateValues).toBe(false);
  });
});

describe("buildEmbeddingQueueCondition", () => {
  it("queues pending and failed stories so transient embedding failures can recover", () => {
    const sqlText = collectSqlDebugText(buildEmbeddingQueueCondition());

    expect(sqlText).toContain("embeddingStatus");
    expect(sqlText).toContain("pending");
    expect(sqlText).toContain("failed");
    expect(sqlText).not.toContain("embedded");
    expect(sqlText).not.toContain("skipped");
  });
});

describe("getIngestionRunFinishUpdateValues", () => {
  it("keeps skipped diagnostics in ingestion run metadata", () => {
    expect(
      getIngestionRunFinishUpdateValues({
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
      }),
    ).toMatchObject({
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
    });
  });
});

describe("getNewsItemRefreshDbUpdateValues", () => {
  it("marks refreshed content for re-embedding without changing immutable identity fields", () => {
    const updateValues = getNewsItemRefreshDbUpdateValues(newsItem);

    expect(updateValues).toMatchObject({
      embeddingStatus: "pending",
      summary: "OpenAI shipped a new model for agentic workflows.",
      title: "OpenAI releases a new agent model",
    });
    expect("dedupeKey" in updateValues).toBe(false);
    expect("sourceId" in updateValues).toBe(false);
  });

  it("keeps score-only refreshes out of the embedding queue", () => {
    const updateValues = getNewsItemRefreshDbUpdateValues(newsItem, {
      resetEmbedding: false,
    });

    expect("embeddingStatus" in updateValues).toBe(false);
    expect(updateValues).toMatchObject({
      sourceScore: 95,
      trendScore: 72,
    });
  });
});

describe("shouldUpdateNewsItemFromRefresh", () => {
  it("does not update when only the raw original URL changes", () => {
    const existing = getNewsItemRefreshUpdateValues(newsItem);
    const incoming = getNewsItemRefreshUpdateValues({
      ...newsItem,
      originalUrl: "https://example.com/openai-agent?utm_campaign=mirror",
    });

    expect(shouldUpdateNewsItemFromRefresh(existing, incoming)).toBe(false);
  });

  it("updates when the collected story content changes", () => {
    const existing = getNewsItemRefreshUpdateValues(newsItem);
    const incoming = getNewsItemRefreshUpdateValues({
      ...newsItem,
      summary: "OpenAI shipped an updated model release for agents.",
    });

    expect(shouldUpdateNewsItemFromRefresh(existing, incoming)).toBe(true);
  });

  it("updates when source trust or trend heat changes during refresh", () => {
    const existing = getNewsItemRefreshUpdateValues({
      ...newsItem,
      sourceScore: 50,
      trendScore: 0,
    });
    const incoming = getNewsItemRefreshUpdateValues(newsItem);

    expect(shouldUpdateNewsItemFromRefresh(existing, incoming)).toBe(true);
  });
});

describe("shouldResetNewsItemEmbeddingFromRefresh", () => {
  it("does not reset embeddings when only source trust or trend heat changes", () => {
    const existing = getNewsItemRefreshUpdateValues({
      ...newsItem,
      sourceScore: 50,
      trendScore: 0,
    });
    const incoming = getNewsItemRefreshUpdateValues(newsItem);

    expect(shouldResetNewsItemEmbeddingFromRefresh(existing, incoming)).toBe(
      false,
    );
  });

  it("resets embeddings when embedding input fields change", () => {
    const existing = getNewsItemRefreshUpdateValues(newsItem);
    const incoming = getNewsItemRefreshUpdateValues({
      ...newsItem,
      summary: "OpenAI shipped an updated model release for agents.",
    });

    expect(shouldResetNewsItemEmbeddingFromRefresh(existing, incoming)).toBe(
      true,
    );
  });
});
