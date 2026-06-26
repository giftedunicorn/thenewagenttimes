import { describe, expect, it } from "vitest";

import {
  CreateNewsItemSchema,
  CreateNewsItemVectorSchema,
  newsCategoryValues,
  newsEmbeddingStatusValues,
  newsSourceTypeValues,
} from "./schema";

const sourceId = "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0";

describe("AI news schema contracts", () => {
  it("covers the editorial categories from the product brief", () => {
    expect(newsCategoryValues).toEqual(
      expect.arrayContaining([
        "funding",
        "product_hunt",
        "model_release",
        "new_concept",
        "hot_take",
        "agent_product",
        "big_tech",
        "musk_ai",
        "yc_ai",
      ]),
    );
  });

  it("covers source types needed by the first ingestion targets", () => {
    expect(newsSourceTypeValues).toEqual(
      expect.arrayContaining([
        "publication",
        "rss",
        "product_hunt",
        "hacker_news",
        "github",
        "yc",
        "vendor_blog",
        "research",
      ]),
    );
  });

  it("accepts a normalized published model-release news item", () => {
    const result = CreateNewsItemSchema.safeParse({
      sourceId,
      title: "OpenAI releases a new agent model",
      summary: "A short summary for feed cards and internal trend review.",
      canonicalUrl: "https://example.com/openai-agent-model",
      originalUrl: "https://example.com/openai-agent-model?utm_source=test",
      publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      status: "published",
      category: "model_release",
      tags: ["agent", "model"],
      entities: ["OpenAI"],
      dedupeKey: "openai-releases-a-new-agent-model",
      embeddingStatus: "pending",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid news categories", () => {
    const result = CreateNewsItemSchema.safeParse({
      sourceId,
      title: "A generic launch",
      summary: "A short summary for feed cards and internal trend review.",
      canonicalUrl: "https://example.com/generic-launch",
      originalUrl: "https://example.com/generic-launch",
      publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      status: "published",
      category: "generic_ai_news",
      dedupeKey: "generic-launch",
    });

    expect(result.success).toBe(false);
  });

  it("accepts portable vector metadata before a final vector store is chosen", () => {
    const result = CreateNewsItemVectorSchema.safeParse({
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      provider: "openai",
      model: "text-embedding-3-small",
      dimension: 1536,
      contentHash: "sha256:normalized-news-text",
      vectorRef: "news/a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      embedding: [0.01, -0.02, 0.03],
    });

    expect(result.success).toBe(true);
  });

  it("keeps explicit embedding lifecycle states", () => {
    expect(newsEmbeddingStatusValues).toEqual([
      "pending",
      "embedded",
      "failed",
      "skipped",
    ]);
  });
});
