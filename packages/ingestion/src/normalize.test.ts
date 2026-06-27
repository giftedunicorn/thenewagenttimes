import { describe, expect, it } from "vitest";

import { CreateNewsItemSchema } from "@acme/db/schema";

import {
  buildDedupeKey,
  canonicalizeUrl,
  extractEntities,
  inferNewsCategory,
  normalizeFeedItem,
  normalizeManualItem,
} from "./normalize";

const sourceId = "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0";

describe("canonicalizeUrl", () => {
  it("removes tracking parameters and hash fragments", () => {
    expect(
      canonicalizeUrl(
        "https://example.com/news?utm_source=rss&utm_campaign=test&id=123#top",
      ),
    ).toBe("https://example.com/news?id=123");
  });
});

describe("buildDedupeKey", () => {
  it("is stable across tracking parameter changes", () => {
    const first = buildDedupeKey({
      sourceId,
      title: "OpenAI releases a new agent model",
      canonicalUrl: "https://example.com/openai?utm_source=rss",
    });
    const second = buildDedupeKey({
      sourceId,
      title: "OpenAI releases a new agent model",
      canonicalUrl: "https://example.com/openai?utm_medium=email",
    });

    expect(first).toBe(second);
  });
});

describe("inferNewsCategory", () => {
  it.each([
    ["Acme raises $20M seed funding for AI agents", "funding"],
    ["New AI workflow agent launches on Product Hunt", "product_hunt"],
    ["OpenAI releases a new model API", "model_release"],
    ["A browser automation agent handles workflows", "agent_product"],
    ["Google announces Gemini agent updates", "big_tech"],
    ["xAI and Elon Musk launch Grok agent tools", "musk_ai"],
    ["YC backs a new AI agent startup", "yc_ai"],
    ["New arXiv paper benchmarks AI agents", "research"],
    ["A new protocol creates a concept for agent memory", "new_concept"],
  ])("classifies %s as %s", (text, expectedCategory) => {
    expect(inferNewsCategory({ text })).toBe(expectedCategory);
  });
});

describe("extractEntities", () => {
  it("extracts known AI companies and people", () => {
    expect(
      extractEntities("OpenAI and Anthropic react to Elon Musk and xAI news"),
    ).toEqual(["OpenAI", "Anthropic", "Elon Musk", "xAI"]);
  });
});

describe("normalizeFeedItem", () => {
  it("creates a valid DB news item payload", () => {
    const result = normalizeFeedItem({
      sourceId,
      sourceSlug: "openai-news",
      item: {
        title: "OpenAI releases a new agent model",
        url: "https://example.com/openai-agent?utm_source=rss",
        summary: "OpenAI shipped a new model for agentic workflows.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(CreateNewsItemSchema.safeParse(result).success).toBe(true);
    expect(result.category).toBe("model_release");
    expect(result.canonicalUrl).toBe("https://example.com/openai-agent");
  });
});

describe("normalizeManualItem", () => {
  it("supports manual Product Hunt and YC discoveries", () => {
    const result = normalizeManualItem({
      sourceId,
      sourceSlug: "product-hunt-ai",
      title: "Product Hunt launch for a YC AI agent",
      url: "https://example.com/product",
      summary: "A YC company launches an AI workflow agent.",
      publishedAt: new Date("2026-06-27T08:00:00.000Z"),
    });

    expect(result.category).toBe("product_hunt");
    expect(result.tags).toEqual(expect.arrayContaining(["product_hunt", "yc"]));
  });
});
