import { describe, expect, it } from "vitest";

import type { NewsItemInput } from "./types";
import {
  getNewsItemRefreshDbUpdateValues,
  getNewsItemRefreshUpdateValues,
  shouldUpdateNewsItemFromRefresh,
} from "./repository";

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
  status: "published",
  summary: "OpenAI shipped a new model for agentic workflows.",
  tags: ["model_release", "model", "agent"],
  title: "OpenAI releases a new agent model",
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
      status: "published",
      summary: "OpenAI shipped a new model for agentic workflows.",
      tags: ["model_release", "model", "agent"],
      title: "OpenAI releases a new agent model",
    });
    expect("dedupeKey" in updateValues).toBe(false);
    expect("embeddingStatus" in updateValues).toBe(false);
    expect("sourceId" in updateValues).toBe(false);
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
});
