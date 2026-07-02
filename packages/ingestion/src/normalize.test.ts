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

  it.each([
    [
      "The White House issues AI safety policy guidance for frontier models",
      "policy",
    ],
    [
      "Researchers disclose an AI agent prompt injection vulnerability",
      "security",
    ],
    [
      "Open source AI model weights ship under an Apache license on GitHub",
      "open_source",
    ],
    [
      "A new market map tracks AI infrastructure startups and GPU clouds",
      "market_map",
    ],
    ["A contrarian hot take argues AI agents are overhyped", "hot_take"],
  ])("classifies channel-specific AI coverage %s as %s", (text, expected) => {
    expect(inferNewsCategory({ text })).toBe(expected);
  });

  it("uses source context when feed titles do not carry explicit category words", () => {
    expect(
      inferNewsCategory({
        sourceSlug: "arxiv-ai-ml",
        text: "A new transformer architecture for temporal reasoning",
      }),
    ).toBe("research");
    expect(
      inferNewsCategory({
        sourceSlug: "github-trending-ai",
        text: "Repository releases local model weights for developers",
      }),
    ).toBe("open_source");
  });

  it("does not classify ordinary success language as startup funding", () => {
    expect(
      inferNewsCategory({
        text: "America's scientific success depends on university leadership.",
      }),
    ).toBe("other");
  });

  it("does not classify ordinary big-tech product news as AI news", () => {
    expect(
      inferNewsCategory({
        text: "Google launches a new Pixel phone camera update.",
      }),
    ).toBe("other");
    expect(
      inferNewsCategory({
        text: "Microsoft refreshes Windows desktop wallpapers.",
      }),
    ).toBe("other");
  });
});

describe("extractEntities", () => {
  it("extracts known AI companies and people", () => {
    expect(
      extractEntities("OpenAI and Anthropic react to Elon Musk and xAI news"),
    ).toEqual(["OpenAI", "Anthropic", "Elon Musk", "xAI"]);
  });

  it("does not match entity names inside unrelated words", () => {
    expect(
      extractEntities(
        "A cardiometabolic benchmark studies policy and technology adoption.",
      ),
    ).toEqual([]);
  });

  it("extracts common AI product, lab, and infrastructure entities", () => {
    expect(
      extractEntities(
        "Claude, Gemini, Mistral, Perplexity, SpaceX, and Cloudflare shape the AI week.",
      ),
    ).toEqual([
      "SpaceX",
      "Cloudflare",
      "Claude",
      "Gemini",
      "Mistral",
      "Perplexity",
    ]);
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

  it("keeps arXiv research tags and entities clean from substring matches", () => {
    const result = normalizeFeedItem({
      sourceId,
      sourceSlug: "arxiv-ai-ml",
      item: {
        title:
          "Accelerometry-Derived Digital Biomarkers for Cardiometabolic Risk",
        url: "https://arxiv.org/abs/2606.31500",
        summary:
          "A population-representative tabular benchmark with uncertainty quantification.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(result.category).toBe("research");
    expect(result.tags).toEqual(["research"]);
    expect(result.entities).toEqual([]);
  });

  it("keeps ordinary big-tech product feed items outside AI categories", () => {
    const result = normalizeFeedItem({
      sourceId,
      sourceSlug: "techcrunch-ai",
      item: {
        title: "Google launches a new Pixel phone camera update",
        url: "https://example.com/google-pixel-camera",
        summary: "The phone update improves weekend sports photography.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(result.category).toBe("other");
    expect(result.tags).toEqual(["other"]);
  });

  it("extracts fine-grained recommendation tags from security and market-map coverage", () => {
    const securityResult = normalizeFeedItem({
      sourceId,
      sourceSlug: "security-ai",
      item: {
        title: "AI agent prompt injection vulnerability disclosed",
        url: "https://example.com/prompt-injection",
        summary:
          "Researchers red team a browser agent exploit and publish mitigations.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });
    const marketMapResult = normalizeFeedItem({
      sourceId,
      sourceSlug: "market-map-ai",
      item: {
        title: "AI infrastructure market map tracks GPU cloud startups",
        url: "https://example.com/gpu-cloud-map",
        summary:
          "The landscape compares inference platforms, GPU clouds, and developer tooling.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(securityResult.tags).toEqual(
      expect.arrayContaining([
        "security",
        "agent",
        "prompt_injection",
        "red_team",
      ]),
    );
    expect(marketMapResult.tags).toEqual(
      expect.arrayContaining(["market_map", "gpu_cloud", "infrastructure"]),
    );
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
