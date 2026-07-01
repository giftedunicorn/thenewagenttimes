import { describe, expect, it } from "vitest";

import {
  getNewsArticleDigest,
  getNewsArticleReadingPath,
  getNewsArticleSourceLens,
} from "./news-article-model";

const article = {
  id: "article-openai-agents",
  title: "OpenAI releases a new agent stack",
  summary: "OpenAI ships a new agent platform for enterprise teams.",
  bodyText: "OpenAI ships a new agent platform.",
  canonicalUrl: "https://example.com/openai-agents",
  originalUrl: "https://source.example/openai-agents",
  imageUrl: null,
  authorName: "News Desk",
  publishedAt: "2026-07-01T08:00:00.000Z",
  collectedAt: "2026-07-01T08:02:00.000Z",
  category: "model_release",
  tags: ["model", "agent"],
  entities: ["OpenAI", "Agents"],
  sourceName: "OpenAI News",
  sourceSlug: "openai-news",
  sourceType: "rss",
  sourceScore: 92,
  trendScore: 90,
};

const relatedItem = {
  id: "related-openai-workflow",
  title: "OpenAI agent workflows reach more developers",
  summary: "More teams are adopting OpenAI agent workflows.",
  canonicalUrl: "https://example.com/related-openai",
  imageUrl: null,
  publishedAt: "2026-07-01T09:00:00.000Z",
  category: "agent_product",
  tags: ["agent", "workflow"],
  entities: ["OpenAI", "Agents"],
  sourceName: "Agent Desk",
  sourceSlug: "agent-desk",
  sourceType: "rss",
  sourceScore: 80,
  trendScore: 88,
  matchedSignals: ["entity"],
  personalizedScore: 108,
};

describe("getNewsArticleReadingPath", () => {
  it("ranks related stories by article overlap before reader score", () => {
    expect(
      getNewsArticleReadingPath({
        article,
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "funding"
              ? "Funding"
              : category === "agent_product"
                ? "Agents"
                : category,
        limit: 3,
        relatedItems: [
          {
            ...relatedItem,
            personalizedScore: 108,
          },
          {
            ...relatedItem,
            id: "same-topic",
            title: "Model releases keep accelerating",
            category: "model_release",
            tags: ["model"],
            entities: ["Anthropic"],
            personalizedScore: 112,
            sourceName: "Model Lab",
            sourceSlug: "model-lab",
          },
          {
            ...relatedItem,
            id: "same-source",
            title: "OpenAI expands its startup program",
            category: "funding",
            tags: ["startup"],
            entities: ["Series A"],
            personalizedScore: 113,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
          },
          {
            ...relatedItem,
            id: "reader-only",
            title: "A reader signal story with no article overlap",
            category: "funding",
            tags: ["funding"],
            entities: ["YC"],
            personalizedScore: 130,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
        ],
      }),
    ).toEqual({
      context: [
        { label: "Topic", value: "Models" },
        { label: "Source", value: "OpenAI News" },
        { label: "Entities", value: "OpenAI, Agents" },
        { label: "Tags", value: "model, agent" },
      ],
      recommendations: [
        {
          id: "related-openai-workflow",
          reason: "OpenAI thread",
          signalCount: 3,
          scoreLabel: "3 signals / 108 score",
          title: "OpenAI agent workflows reach more developers",
        },
        {
          id: "same-topic",
          reason: "Same topic",
          signalCount: 2,
          scoreLabel: "2 signals / 112 score",
          title: "Model releases keep accelerating",
        },
        {
          id: "same-source",
          reason: "Same source",
          signalCount: 1,
          scoreLabel: "1 signal / 113 score",
          title: "OpenAI expands its startup program",
        },
      ],
      summary:
        "3 follow-ups ranked by article overlap, shared entities, and reader signals.",
    });
  });

  it("keeps the article context useful when no related stories are available", () => {
    expect(
      getNewsArticleReadingPath({
        article: {
          ...article,
          entities: [],
          tags: [],
        },
        formatCategory: (category) => category,
        limit: 3,
        relatedItems: [],
      }),
    ).toEqual({
      context: [
        { label: "Topic", value: "model_release" },
        { label: "Source", value: "OpenAI News" },
        { label: "Entities", value: "None" },
        { label: "Tags", value: "None" },
      ],
      recommendations: [],
      summary: "Reading path will appear as related stories load.",
    });
  });
});

describe("getNewsArticleDigest", () => {
  it("builds a fast brief with reading time, facts, and key entities", () => {
    expect(
      getNewsArticleDigest({
        article: {
          ...article,
          bodyText: [
            "OpenAI ships a new agent platform for enterprise teams.",
            "The system connects planning, tool use, and review loops for production workflows.",
            "OpenAI says the launch is aimed at developers who need safer automation.",
          ].join("\n\n"),
          entities: ["OpenAI", "Agents", "OpenAI", "Enterprise"],
          tags: ["agent", "workflow", "automation", "workflow"],
        },
      }),
    ).toEqual({
      entities: ["OpenAI", "Agents", "Enterprise"],
      facts: [
        "OpenAI ships a new agent platform for enterprise teams.",
        "The system connects planning, tool use, and review loops for production workflows.",
        "OpenAI says the launch is aimed at developers who need safer automation.",
      ],
      readTimeLabel: "1 min read",
      sourceLine: "OpenAI News / Models",
      tags: ["agent", "workflow", "automation"],
    });
  });

  it("falls back to summary text when the article body is empty", () => {
    expect(
      getNewsArticleDigest({
        article: {
          ...article,
          bodyText: "   ",
          entities: [],
          tags: [],
        },
      }),
    ).toEqual({
      entities: [],
      facts: ["OpenAI ships a new agent platform for enterprise teams."],
      readTimeLabel: "1 min read",
      sourceLine: "OpenAI News / Models",
      tags: [],
    });
  });
});

describe("getNewsArticleSourceLens", () => {
  it("summarizes provenance, heat, and signal density for an article", () => {
    expect(
      getNewsArticleSourceLens({
        article: {
          ...article,
          entities: ["OpenAI", "Agents", "Enterprise"],
          tags: ["model", "agent", "workflow"],
          sourceScore: 92,
          sourceType: "official",
          trendScore: 88,
        },
      }),
    ).toEqual({
      lines: [
        { label: "Source", value: "OpenAI News" },
        { label: "Type", value: "official" },
        { label: "Credibility", value: "92/100" },
        { label: "Heat", value: "88/100" },
        { label: "Signals", value: "3 entities / 3 tags" },
      ],
      summary:
        "High-credibility official source with strong edition heat and dense entity coverage.",
      tone: "High confidence",
    });
  });

  it("keeps low-signal provenance explicit", () => {
    expect(
      getNewsArticleSourceLens({
        article: {
          ...article,
          entities: [],
          tags: [],
          sourceScore: 45,
          sourceType: "rss",
          trendScore: 32,
        },
      }),
    ).toEqual({
      lines: [
        { label: "Source", value: "OpenAI News" },
        { label: "Type", value: "rss" },
        { label: "Credibility", value: "45/100" },
        { label: "Heat", value: "32/100" },
        { label: "Signals", value: "0 entities / 0 tags" },
      ],
      summary:
        "Lower-confidence rss source with quieter edition heat and sparse entity coverage.",
      tone: "Watch",
    });
  });
});
