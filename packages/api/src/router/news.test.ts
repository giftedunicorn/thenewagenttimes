import { describe, expect, it } from "vitest";

import type { NewsForYouCandidate } from "./news";
import {
  buildNewsReaderProfileResponse,
  NewsFeedInputSchema,
  NewsForYouInputSchema,
  NewsHistoryInputSchema,
  NewsReaderProfileInputSchema,
  NewsRecordInteractionInputSchema,
  NewsSavedInputSchema,
  NewsSearchCandidatesInputSchema,
  NewsUpdateProfileInputSchema,
  selectNewsFeedItems,
  selectNewsForYouItems,
  selectNewsSearchCandidateItems,
  selectUniqueNewsCollectionItems,
  shouldIncludeNewsInteractionAsPositiveFeedback,
  shouldIncludeNewsInteractionInReadingHistory,
  shouldTrainNewsProfileFromInteraction,
  summarizeNewsReaderProfileSignals,
} from "./news";

const baseNewsItem = {
  id: "openai-model-lead",
  title: "OpenAI model lead",
  summary: "OpenAI ships a model release.",
  canonicalUrl: "https://example.com/openai-model-lead",
  imageUrl: null,
  publishedAt: "2026-07-01T08:00:00.000Z",
  category: "model_release",
  tags: ["model", "agent"],
  entities: ["OpenAI"],
  sourceScore: 92,
  trendScore: 90,
  sourceName: "OpenAI News",
  sourceSlug: "openai-news",
  sourceType: "official",
};

const newsCandidateWithOriginalUrl = {
  ...baseNewsItem,
  originalUrl: "https://example.com/openai-model-lead?utm=feed",
} satisfies NewsForYouCandidate;

describe("news router input contracts", () => {
  it("models original URLs on personalized recommendation candidates", () => {
    expect(newsCandidateWithOriginalUrl.originalUrl).toBe(
      "https://example.com/openai-model-lead?utm=feed",
    );
  });

  it("defaults the public feed limit to 20", () => {
    expect(NewsFeedInputSchema.parse({}).limit).toBe(20);
  });

  it("caps public feed page size at 50", () => {
    const result = NewsFeedInputSchema.safeParse({ limit: 51 });

    expect(result.success).toBe(false);
  });

  it("accepts the approved first-stage news categories", () => {
    const result = NewsFeedInputSchema.safeParse({
      category: "yc_ai",
      limit: 10,
    });

    expect(result.success).toBe(true);
  });

  it("requires a non-empty search query after trimming", () => {
    const result = NewsSearchCandidatesInputSchema.safeParse({ q: "   " });

    expect(result.success).toBe(false);
  });

  it("defaults search candidate limit to 10", () => {
    expect(
      NewsSearchCandidatesInputSchema.parse({ q: "agent launch" }).limit,
    ).toBe(10);
  });

  it("defaults personalized for-you feed limit to 20", () => {
    expect(
      NewsForYouInputSchema.parse({ visitorKey: "visitor-test-123" }).limit,
    ).toBe(20);
  });

  it("defaults saved news collection limit to a compact sidebar shelf", () => {
    expect(
      NewsSavedInputSchema.parse({ visitorKey: "visitor-test-123" }).limit,
    ).toBe(6);
  });

  it("caps saved news collection page size", () => {
    const result = NewsSavedInputSchema.safeParse({
      limit: 26,
      visitorKey: "visitor-test-123",
    });

    expect(result.success).toBe(false);
  });

  it("defaults reading history collection limit to a compact sidebar shelf", () => {
    expect(
      NewsHistoryInputSchema.parse({ visitorKey: "visitor-test-123" }).limit,
    ).toBe(6);
  });

  it("caps reading history collection page size", () => {
    const result = NewsHistoryInputSchema.safeParse({
      limit: 26,
      visitorKey: "visitor-test-123",
    });

    expect(result.success).toBe(false);
  });

  it("accepts anonymous reader keys for persisted preference profiles", () => {
    const result = NewsReaderProfileInputSchema.safeParse({
      visitorKey: "visitor-test-123",
    });

    expect(result.success).toBe(true);
  });

  it("requires useful anonymous reader keys before storing interactions", () => {
    const result = NewsRecordInteractionInputSchema.safeParse({
      visitorKey: "short",
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      action: "save",
    });

    expect(result.success).toBe(false);
  });

  it("accepts the personalization interaction actions from the reader UI", () => {
    const result = NewsRecordInteractionInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      action: "click_source",
    });

    expect(result.success).toBe(true);
  });

  it("accepts bounded reading depth metadata for article views", () => {
    const result = NewsRecordInteractionInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      action: "view",
      metadata: {
        readPercent: 0.82,
        surface: "article",
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts bounded home exposure metadata for feed fatigue", () => {
    const result = NewsRecordInteractionInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      action: "view",
      metadata: {
        exposure: true,
        exposureSlot: 4,
        feedMode: "for_you",
        surface: "home",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects out-of-range home exposure slots", () => {
    const result = NewsRecordInteractionInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      action: "view",
      metadata: {
        exposure: true,
        exposureSlot: 51,
        feedMode: "for_you",
        surface: "home",
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects out-of-range reading depth metadata", () => {
    const result = NewsRecordInteractionInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      action: "view",
      metadata: {
        readPercent: 1.4,
        surface: "article",
      },
    });

    expect(result.success).toBe(false);
  });

  it("accepts explicit reader profile updates from preference controls", () => {
    const result = NewsUpdateProfileInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      profile: {
        preferredCategories: ["model_release"],
        preferredSources: ["openai-news"],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1.5,
        recencyBias: 0.5,
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects profile bias values outside the supported ranking range", () => {
    const result = NewsUpdateProfileInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 2.5,
        recencyBias: 1,
      },
    });

    expect(result.success).toBe(false);
  });
});

describe("shouldIncludeNewsInteractionAsPositiveFeedback", () => {
  it("uses explicit positive actions as recommendation anchors", () => {
    expect(
      shouldIncludeNewsInteractionAsPositiveFeedback({
        action: "save",
        metadata: undefined,
      }),
    ).toBe(true);
    expect(
      shouldIncludeNewsInteractionAsPositiveFeedback({
        action: "share",
        metadata: undefined,
      }),
    ).toBe(true);
    expect(
      shouldIncludeNewsInteractionAsPositiveFeedback({
        action: "click_source",
        metadata: undefined,
      }),
    ).toBe(true);
  });

  it("uses deep article reads as recommendation anchors", () => {
    expect(
      shouldIncludeNewsInteractionAsPositiveFeedback({
        action: "view",
        metadata: { readPercent: 0.8, surface: "article" },
      }),
    ).toBe(true);
  });

  it("keeps home exposures and shallow reads out of recommendation anchors", () => {
    expect(
      shouldIncludeNewsInteractionAsPositiveFeedback({
        action: "view",
        metadata: {
          exposure: true,
          exposureSlot: 3,
          readPercent: 1,
          surface: "home",
        },
      }),
    ).toBe(false);
    expect(
      shouldIncludeNewsInteractionAsPositiveFeedback({
        action: "view",
        metadata: { readPercent: 1, surface: "home" },
      }),
    ).toBe(false);
    expect(
      shouldIncludeNewsInteractionAsPositiveFeedback({
        action: "view",
        metadata: { readPercent: 0.35, surface: "article" },
      }),
    ).toBe(false);
    expect(
      shouldIncludeNewsInteractionAsPositiveFeedback({
        action: "hide",
        metadata: undefined,
      }),
    ).toBe(false);
  });
});

describe("shouldTrainNewsProfileFromInteraction", () => {
  it("does not train the reader profile from home read clicks", () => {
    expect(
      shouldTrainNewsProfileFromInteraction({
        action: "view",
        metadata: { surface: "home" },
      }),
    ).toBe(false);
  });

  it("keeps shallow article opens out of profile training until read depth is meaningful", () => {
    expect(
      shouldTrainNewsProfileFromInteraction({
        action: "view",
        metadata: { readPercent: 0.2, surface: "article" },
      }),
    ).toBe(false);
    expect(
      shouldTrainNewsProfileFromInteraction({
        action: "view",
        metadata: { readPercent: 0.8, surface: "article" },
      }),
    ).toBe(true);
  });

  it("keeps unqualified view events out of profile training", () => {
    expect(
      shouldTrainNewsProfileFromInteraction({
        action: "view",
        metadata: undefined,
      }),
    ).toBe(false);
    expect(
      shouldTrainNewsProfileFromInteraction({
        action: "view",
        metadata: { surface: "article" },
      }),
    ).toBe(false);
  });

  it("keeps explicit feedback actions as training signals", () => {
    expect(
      shouldTrainNewsProfileFromInteraction({
        action: "save",
        metadata: { surface: "home" },
      }),
    ).toBe(true);
  });
});

describe("shouldIncludeNewsInteractionInReadingHistory", () => {
  it("keeps meaningful article reads in history", () => {
    expect(
      shouldIncludeNewsInteractionInReadingHistory({
        action: "view",
        metadata: { readPercent: 0.8, surface: "article" },
      }),
    ).toBe(true);
  });

  it("keeps shallow home clicks and shallow article opens out of reading history", () => {
    expect(
      shouldIncludeNewsInteractionInReadingHistory({
        action: "view",
        metadata: { surface: "home" },
      }),
    ).toBe(false);
    expect(
      shouldIncludeNewsInteractionInReadingHistory({
        action: "view",
        metadata: { readPercent: 0.2, surface: "article" },
      }),
    ).toBe(false);
  });

  it("keeps automatic home exposures out of reading history", () => {
    expect(
      shouldIncludeNewsInteractionInReadingHistory({
        action: "view",
        metadata: {
          exposure: true,
          exposureSlot: 0,
          feedMode: "for_you",
          surface: "home",
        },
      }),
    ).toBe(false);
  });

  it("keeps non-view interactions out of reading history", () => {
    expect(
      shouldIncludeNewsInteractionInReadingHistory({
        action: "save",
        metadata: { surface: "home" },
      }),
    ).toBe(false);
  });
});

describe("selectNewsFeedItems", () => {
  it("deduplicates public feed URL variants before limiting the page", () => {
    const feed = selectNewsFeedItems({
      items: [
        {
          ...baseNewsItem,
          id: "syndicated-openai-model",
          canonicalUrl: "https://mirror.example/openai-model",
          originalUrl: "https://example.com/openai-model?utm=feed",
          sourceScore: 84,
          trendScore: 96,
        },
        {
          ...baseNewsItem,
          id: "trusted-openai-model",
          canonicalUrl: "https://example.com/openai-model",
          originalUrl: "https://example.com/openai-model",
          sourceScore: 96,
          trendScore: 90,
        },
        {
          ...baseNewsItem,
          id: "fresh-agent-story",
          canonicalUrl: "https://example.com/fresh-agent-story",
          originalUrl: "https://example.com/fresh-agent-story",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 88,
          trendScore: 86,
        },
      ],
      limit: 2,
    });

    expect(feed.map((item) => item.id)).toEqual([
      "trusted-openai-model",
      "fresh-agent-story",
    ]);
  });
});

describe("selectNewsSearchCandidateItems", () => {
  it("deduplicates search result URL variants before limiting candidates", () => {
    const candidates = selectNewsSearchCandidateItems({
      items: [
        {
          ...baseNewsItem,
          id: "search-syndicated-model",
          canonicalUrl: "https://mirror.example/openai-model",
          originalUrl: "https://example.com/openai-model?utm=search",
          sourceScore: 82,
          trendScore: 95,
        },
        {
          ...baseNewsItem,
          id: "search-official-model",
          canonicalUrl: "https://example.com/openai-model",
          originalUrl: "https://example.com/openai-model",
          sourceScore: 96,
          trendScore: 88,
        },
        {
          ...baseNewsItem,
          id: "search-agent-story",
          canonicalUrl: "https://example.com/search-agent-story",
          originalUrl: "https://example.com/search-agent-story",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 88,
          trendScore: 84,
        },
      ],
      limit: 2,
    });

    expect(candidates.map((item) => item.id)).toEqual([
      "search-official-model",
      "search-agent-story",
    ]);
  });
});

describe("summarizeNewsReaderProfileSignals", () => {
  it("explains the positive signals that trained a reader profile", () => {
    expect(
      summarizeNewsReaderProfileSignals({
        interactions: [
          {
            action: "save",
            category: "agent_product",
            entities: ["OpenAI", "Operator"],
            tags: ["agents", "browser"],
            metadata: {},
            occurredAt: "2026-07-01T09:00:00.000Z",
            sourceSlug: "openai-news",
          },
          {
            action: "share",
            category: "agent_product",
            entities: ["OpenAI"],
            tags: ["agents"],
            metadata: {},
            occurredAt: "2026-07-01T08:00:00.000Z",
            sourceSlug: "openai-news",
          },
          {
            action: "view",
            category: "model_release",
            entities: ["Anthropic"],
            tags: ["model"],
            metadata: { readPercent: 0.9, surface: "article" },
            occurredAt: "2026-07-01T07:00:00.000Z",
            sourceSlug: "anthropic-news",
          },
        ],
        profile: {
          noveltyBias: 1.5,
          preferredCategories: ["agent_product", "model_release"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["openai-news"],
          recencyBias: 1.2,
        },
      }),
    ).toEqual({
      ignoredSignalCount: 0,
      negativeSignalCount: 0,
      positiveSignalCount: 3,
      summary:
        "Profile leans toward agent_product and model_release, led by openai-news and OpenAI.",
      topCategories: [
        { key: "agent_product", count: 2 },
        { key: "model_release", count: 1 },
      ],
      topEntities: [
        { key: "OpenAI", count: 2 },
        { key: "Operator", count: 1 },
        { key: "Anthropic", count: 1 },
      ],
      topSources: [
        { key: "openai-news", count: 2 },
        { key: "anthropic-news", count: 1 },
      ],
      topTags: [
        { key: "agents", count: 2 },
        { key: "browser", count: 1 },
        { key: "model", count: 1 },
      ],
      trainedSignalCount: 3,
    });
  });

  it("separates ignored exposure signals and negative feedback from training", () => {
    expect(
      summarizeNewsReaderProfileSignals({
        interactions: [
          {
            action: "view",
            category: "funding",
            entities: ["Series A"],
            tags: ["startup"],
            metadata: { exposure: true, surface: "home" },
            occurredAt: "2026-07-01T09:00:00.000Z",
            sourceSlug: "venturewire",
          },
          {
            action: "view",
            category: "funding",
            entities: ["Series A"],
            tags: ["startup"],
            metadata: { readPercent: 0.2, surface: "article" },
            occurredAt: "2026-07-01T08:00:00.000Z",
            sourceSlug: "venturewire",
          },
          {
            action: "hide",
            category: "hot_take",
            entities: ["Rumor"],
            tags: ["rumor"],
            metadata: {},
            occurredAt: "2026-07-01T07:00:00.000Z",
            sourceSlug: "hot-takes",
          },
        ],
        profile: {
          noveltyBias: 1,
          preferredCategories: [],
          preferredEntities: [],
          preferredSources: [],
          recencyBias: 1,
        },
      }),
    ).toMatchObject({
      ignoredSignalCount: 2,
      negativeSignalCount: 1,
      positiveSignalCount: 0,
      summary:
        "Profile is still learning; recent signals are mostly exposure or low-depth reads.",
      topCategories: [],
      topEntities: [],
      topSources: [],
      topTags: [],
      trainedSignalCount: 0,
    });
  });
});

describe("buildNewsReaderProfileResponse", () => {
  it("returns the default learning audit for an anonymous reader without a persisted profile", () => {
    expect(
      buildNewsReaderProfileResponse({
        interactions: [],
        persisted: false,
        profile: {
          noveltyBias: 1,
          preferredCategories: ["model_release", "agent_product", "funding"],
          preferredEntities: [],
          preferredSources: [],
          recencyBias: 1,
        },
      }),
    ).toEqual({
      audit: {
        ignoredSignalCount: 0,
        negativeSignalCount: 0,
        positiveSignalCount: 0,
        summary:
          "Profile is still learning from the next meaningful read, save, share, or source click.",
        topCategories: [],
        topEntities: [],
        topSources: [],
        topTags: [],
        trainedSignalCount: 0,
      },
      noveltyBias: 1,
      persisted: false,
      preferredCategories: ["model_release", "agent_product", "funding"],
      preferredEntities: [],
      preferredSources: [],
      recencyBias: 1,
    });
  });

  it("attaches the reader signal audit to a persisted profile response", () => {
    expect(
      buildNewsReaderProfileResponse({
        interactions: [
          {
            action: "save",
            category: "agent_product",
            entities: ["OpenAI"],
            tags: ["agents"],
            metadata: {},
            occurredAt: "2026-07-01T09:00:00.000Z",
            sourceSlug: "openai-news",
          },
          {
            action: "view",
            category: "funding",
            entities: ["Series A"],
            tags: ["startup"],
            metadata: { exposure: true, surface: "home" },
            occurredAt: "2026-07-01T08:00:00.000Z",
            sourceSlug: "venturewire",
          },
        ],
        persisted: true,
        profile: {
          noveltyBias: 1.4,
          preferredCategories: ["agent_product"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["openai-news"],
          recencyBias: 1.1,
        },
      }),
    ).toMatchObject({
      audit: {
        ignoredSignalCount: 1,
        positiveSignalCount: 1,
        summary:
          "Profile leans toward agent_product, led by openai-news and OpenAI.",
        topCategories: [{ key: "agent_product", count: 1 }],
        topSources: [{ key: "openai-news", count: 1 }],
        topTags: [{ key: "agents", count: 1 }],
        trainedSignalCount: 1,
      },
      persisted: true,
      preferredCategories: ["agent_product"],
      preferredEntities: ["OpenAI"],
      preferredSources: ["openai-news"],
    });
  });
});

describe("selectNewsForYouItems", () => {
  it("applies hidden, dedupe, ranking, diversity, and fatigue balancing for server feeds", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: ["hidden-rumor"],
      hiddenNewsItems: [
        {
          ...baseNewsItem,
          id: "hidden-rumor",
          canonicalUrl: "https://example.com/hidden-rumor",
          title: "Hidden rumor should not appear",
          category: "hot_take",
          sourceName: "Rumor Desk",
          sourceSlug: "rumor-desk",
        },
      ],
      items: [
        {
          ...baseNewsItem,
          id: "openai-model-lead",
        },
        {
          ...baseNewsItem,
          id: "openai-funding-follow",
          title: "OpenAI backs new agent startups",
          canonicalUrl: "https://example.com/openai-funding",
          category: "funding",
          tags: ["funding"],
          entities: ["OpenAI", "Series A"],
          sourceScore: 86,
          trendScore: 84,
        },
        {
          ...baseNewsItem,
          id: "anthropic-model-follow",
          title: "Anthropic model notes arrive",
          canonicalUrl: "https://example.com/model-follow",
          entities: ["Anthropic"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 84,
          trendScore: 82,
        },
        {
          ...baseNewsItem,
          id: "agent-product-alternate",
          title: "Agent workflow launch gains traction",
          canonicalUrl: "https://example.com/agent-product",
          category: "agent_product",
          tags: ["workflow"],
          entities: ["Agents"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 80,
          trendScore: 95,
        },
        {
          ...baseNewsItem,
          id: "duplicate-weaker",
          canonicalUrl: "https://example.com/openai-model-lead?utm=feed",
          sourceScore: 70,
          trendScore: 60,
        },
        {
          ...baseNewsItem,
          id: "hidden-rumor",
          canonicalUrl: "https://example.com/hidden-rumor",
          title: "Hidden rumor should not appear",
          category: "hot_take",
          sourceName: "Rumor Desk",
          sourceSlug: "rumor-desk",
        },
      ],
      limit: 4,
      now: new Date("2026-07-01T09:00:00.000Z"),
      profile: {
        preferredCategories: ["model_release", "funding"],
        preferredSources: ["openai-news"],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1.2,
        recencyBias: 1.1,
      },
      negativeFeedbackItems: [],
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "openai-model-lead",
      "agent-product-alternate",
      "openai-funding-follow",
      "anthropic-model-follow",
    ]);
    expect(feed.map((item) => item.id)).not.toContain("duplicate-weaker");
    expect(feed.map((item) => item.id)).not.toContain("hidden-rumor");
  });

  it("returns an empty server feed when every candidate is hidden", () => {
    expect(
      selectNewsForYouItems({
        hiddenNewsItemIds: ["openai-model-lead"],
        items: [baseNewsItem],
        limit: 4,
        now: new Date("2026-07-01T09:00:00.000Z"),
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
        hiddenNewsItems: [baseNewsItem],
        negativeFeedbackItems: [],
        viewedNewsItemIds: [],
      }),
    ).toEqual([]);
  });

  it("moves viewed server recommendations behind unseen candidates", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "read-model",
          canonicalUrl: "https://example.com/read-model",
          trendScore: 95,
        },
        {
          ...baseNewsItem,
          id: "fresh-agent",
          canonicalUrl: "https://example.com/fresh-agent",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          trendScore: 85,
        },
        {
          ...baseNewsItem,
          id: "fresh-funding",
          canonicalUrl: "https://example.com/fresh-funding",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          trendScore: 80,
        },
      ],
      limit: 3,
      now: new Date("2026-07-01T09:00:00.000Z"),
      profile: {
        preferredCategories: ["model_release"],
        preferredSources: ["openai-news"],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1,
        recencyBias: 1,
      },
      negativeFeedbackItems: [],
      viewedNewsItemIds: ["read-model"],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "fresh-agent",
      "fresh-funding",
      "read-model",
    ]);
  });

  it("moves server recommendations with viewed canonical or original URLs behind unseen candidates", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "viewed-syndicated-model",
          canonicalUrl: "https://mirror.example/openai-model",
          originalUrl: "https://example.com/openai-model?utm=feed",
          sourceScore: 88,
          trendScore: 95,
        },
        {
          ...baseNewsItem,
          id: "fresh-agent",
          canonicalUrl: "https://example.com/fresh-agent",
          originalUrl: "https://example.com/fresh-agent",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 84,
          trendScore: 85,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      profile: {
        preferredCategories: ["model_release"],
        preferredSources: ["openai-news"],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: ["viewed-model"],
      viewedNewsItems: [
        {
          canonicalUrl: "https://example.com/openai-model",
          category: "model_release",
          entities: ["OpenAI"],
          originalUrl: "https://example.com/openai-model",
          sourceSlug: "openai-news",
        },
      ],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "fresh-agent",
      "viewed-syndicated-model",
    ]);
  });

  it("cools down server recommendations matching recent reading exposure", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "same-source-follow-up",
          canonicalUrl: "https://example.com/same-source-follow-up",
          sourceScore: 82,
          trendScore: 84,
        },
        {
          ...baseNewsItem,
          id: "same-entity-analysis",
          canonicalUrl: "https://example.com/same-entity-analysis",
          entities: ["OpenAI", "Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 88,
          trendScore: 82,
        },
        {
          ...baseNewsItem,
          id: "fresh-market-angle",
          canonicalUrl: "https://example.com/fresh-market-angle",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          trendScore: 78,
        },
      ],
      limit: 3,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
      viewedNewsItems: [
        {
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
        },
      ],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "fresh-market-angle",
      "same-source-follow-up",
      "same-entity-analysis",
    ]);
    expect(feed[1]?.matchedSignals).toContain("exposure_cooldown");
  });

  it("cools down server recommendations matching recent reading exposure tags", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "same-agent-angle",
          canonicalUrl: "https://example.com/same-agent-angle",
          category: "research",
          entities: ["Benchmarks"],
          sourceName: "Research Lab",
          sourceSlug: "research-lab",
          tags: ["agents"],
          trendScore: 86,
        },
        {
          ...baseNewsItem,
          id: "fresh-market-angle",
          canonicalUrl: "https://example.com/fresh-market-angle",
          category: "market_map",
          entities: ["AI market"],
          sourceName: "Market Map",
          sourceSlug: "market-map",
          tags: ["enterprise"],
          trendScore: 76,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: ["agents"],
        noveltyBias: 0,
        recencyBias: 0,
      },
      viewedNewsItemIds: [],
      viewedNewsItems: [
        {
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
          tags: ["agents"],
        },
      ],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "fresh-market-angle",
      "same-agent-angle",
    ]);
    expect(feed[1]?.matchedSignals).toContain("exposure_cooldown");
  });

  it("does not cool down server recommendations from stale reading exposure", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "same-source-return",
          canonicalUrl: "https://example.com/same-source-return",
          sourceScore: 90,
          trendScore: 86,
        },
        {
          ...baseNewsItem,
          id: "fresh-market-angle",
          canonicalUrl: "https://example.com/fresh-market-angle",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          trendScore: 80,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2999-01-02T01:00:00.000Z"),
      positiveFeedbackItems: [],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
      viewedNewsItems: [
        {
          category: "model_release",
          entities: ["OpenAI"],
          occurredAt: "2999-01-01T00:00:00.000Z",
          sourceSlug: "openai-news",
        },
      ],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "same-source-return",
      "fresh-market-angle",
    ]);
    expect(feed[0]?.matchedSignals).not.toContain("exposure_cooldown");
  });

  it("keeps deep preference server matches ahead of generic fresh angles", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "deep-preference-model-follow-up",
          canonicalUrl: "https://example.com/deep-preference-model-follow-up",
          sourceScore: 92,
          trendScore: 86,
        },
        {
          ...baseNewsItem,
          id: "fresh-but-unmatched-market-angle",
          canonicalUrl: "https://example.com/fresh-but-unmatched-market-angle",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          trendScore: 80,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [],
      profile: {
        preferredCategories: ["model_release"],
        preferredSources: ["openai-news"],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
      viewedNewsItems: [
        {
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
        },
      ],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "deep-preference-model-follow-up",
      "fresh-but-unmatched-market-angle",
    ]);
    expect(feed[0]?.matchedSignals).toContain("deep_preference");
  });

  it("promotes high-trust breaking server stories before ordinary recommendations", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "ordinary-ranked-lead",
          canonicalUrl: "https://example.com/ordinary-ranked-lead",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          trendScore: 82,
        },
        {
          ...baseNewsItem,
          id: "breaking-model-update",
          canonicalUrl: "https://example.com/breaking-model-update",
          publishedAt: "2026-07-01T08:45:00.000Z",
          sourceScore: 94,
          trendScore: 97,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [],
      profile: {
        preferredCategories: ["funding"],
        preferredSources: ["venturewire"],
        preferredEntities: ["Series A"],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
      viewedNewsItems: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "breaking-model-update",
      "ordinary-ranked-lead",
    ]);
    expect(feed[0]?.matchedSignals).toContain("breaking_news");
  });

  it("inserts a discovery story near the top of an over-personalized server feed", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "matched-model-lead",
          canonicalUrl: "https://example.com/matched-model-lead",
          sourceScore: 86,
          trendScore: 86,
        },
        {
          ...baseNewsItem,
          id: "matched-funding-lead",
          canonicalUrl: "https://example.com/matched-funding-lead",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 85,
          trendScore: 84,
        },
        {
          ...baseNewsItem,
          id: "matched-agent-lead",
          canonicalUrl: "https://example.com/matched-agent-lead",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 84,
          trendScore: 82,
        },
        {
          ...baseNewsItem,
          id: "matched-research-lead",
          canonicalUrl: "https://example.com/matched-research-lead",
          category: "research",
          entities: ["Benchmarks"],
          sourceName: "Research Lab",
          sourceSlug: "research-lab",
          sourceScore: 83,
          trendScore: 80,
        },
        {
          ...baseNewsItem,
          id: "matched-market-map-lead",
          canonicalUrl: "https://example.com/matched-market-map-lead",
          category: "market_map",
          entities: ["YC"],
          sourceName: "Market Map",
          sourceSlug: "market-map",
          sourceScore: 82,
          trendScore: 78,
        },
        {
          ...baseNewsItem,
          id: "qualified-discovery-story",
          canonicalUrl: "https://example.com/qualified-discovery-story",
          category: "open_source",
          entities: ["OSS"],
          sourceName: "OSS Radar",
          sourceSlug: "oss-radar",
          sourceScore: 88,
          trendScore: 74,
        },
      ],
      limit: 6,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [],
      profile: {
        preferredCategories: [
          "model_release",
          "funding",
          "agent_product",
          "research",
          "market_map",
        ],
        preferredSources: [
          "openai-news",
          "venturewire",
          "agent-desk",
          "research-lab",
          "market-map",
        ],
        preferredEntities: ["OpenAI", "Series A", "Agents", "Benchmarks"],
        noveltyBias: 1.5,
        recencyBias: 1.5,
      },
      viewedNewsItemIds: [],
      viewedNewsItems: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "matched-model-lead",
      "matched-funding-lead",
      "matched-agent-lead",
      "qualified-discovery-story",
      "matched-research-lead",
      "matched-market-map-lead",
    ]);
    expect(feed[3]?.matchedSignals).toContain("discovery_slot");
  });

  it("moves server recommendations similar to hidden feedback behind unrelated candidates", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: ["hidden-openai-model"],
      hiddenNewsItems: [
        {
          ...baseNewsItem,
          id: "hidden-openai-model",
        },
      ],
      items: [
        {
          ...baseNewsItem,
          id: "same-source-follow-up",
          canonicalUrl: "https://example.com/same-source-follow-up",
          entities: ["Anthropic"],
          trendScore: 95,
        },
        {
          ...baseNewsItem,
          id: "unrelated-agent-story",
          canonicalUrl: "https://example.com/unrelated-agent-story",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          trendScore: 84,
        },
        {
          ...baseNewsItem,
          id: "shared-entity-follow-up",
          canonicalUrl: "https://example.com/shared-entity-follow-up",
          category: "funding",
          entities: ["OpenAI", "Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          trendScore: 90,
        },
      ],
      limit: 3,
      negativeFeedbackItems: [
        {
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
        },
      ],
      now: new Date("2026-07-01T09:00:00.000Z"),
      profile: {
        preferredCategories: ["model_release", "funding"],
        preferredSources: ["openai-news"],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "unrelated-agent-story",
      "same-source-follow-up",
      "shared-entity-follow-up",
    ]);
  });

  it("moves server recommendations sharing hidden tags behind unrelated candidates", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: ["hidden-agent-angle"],
      hiddenNewsItems: [
        {
          ...baseNewsItem,
          id: "hidden-agent-angle",
          tags: ["agents"],
        },
      ],
      items: [
        {
          ...baseNewsItem,
          id: "shared-agent-angle",
          canonicalUrl: "https://example.com/shared-agent-angle",
          category: "research",
          entities: ["Benchmarks"],
          sourceName: "Research Lab",
          sourceSlug: "research-lab",
          tags: ["agents"],
          trendScore: 96,
        },
        {
          ...baseNewsItem,
          id: "fresh-market-angle",
          canonicalUrl: "https://example.com/fresh-market-angle",
          category: "market_map",
          entities: ["AI market"],
          sourceName: "Market Map",
          sourceSlug: "market-map",
          tags: ["enterprise"],
          trendScore: 78,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [
        {
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
          tags: ["agents"],
        },
      ],
      now: new Date("2026-07-01T09:00:00.000Z"),
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: ["agents"],
        noveltyBias: 0,
        recencyBias: 0,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "fresh-market-angle",
      "shared-agent-angle",
    ]);
    expect(feed[1]?.matchedSignals).toContain("negative_feedback");
  });

  it("does not suppress server recommendations from stale hidden feedback", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "same-source-follow-up",
          canonicalUrl: "https://example.com/same-source-follow-up",
          entities: ["Anthropic"],
          trendScore: 84,
        },
        {
          ...baseNewsItem,
          id: "unrelated-agent-story",
          canonicalUrl: "https://example.com/unrelated-agent-story",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          trendScore: 82,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [
        {
          category: "model_release",
          entities: ["OpenAI"],
          occurredAt: "2026-05-01T09:00:00.000Z",
          sourceSlug: "openai-news",
        },
      ],
      now: new Date("2026-07-01T09:00:00.000Z"),
      profile: {
        preferredCategories: ["model_release"],
        preferredSources: ["openai-news"],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "same-source-follow-up",
      "unrelated-agent-story",
    ]);
    expect(feed[0]?.matchedSignals).not.toContain("negative_feedback");
  });

  it("moves low-trust high-heat server recommendations behind trusted candidates", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "viral-low-trust-claim",
          canonicalUrl: "https://example.com/viral-low-trust-claim",
          title: "Unverified agent claim surges across social feeds",
          category: "hot_take",
          entities: ["Agents"],
          sourceName: "Rumor Desk",
          sourceSlug: "rumor-desk",
          sourceScore: 45,
          trendScore: 100,
        },
        {
          ...baseNewsItem,
          id: "trusted-model-analysis",
          canonicalUrl: "https://example.com/trusted-model-analysis",
          title: "Verified model analysis lands from a trusted source",
          sourceScore: 90,
          trendScore: 80,
        },
        {
          ...baseNewsItem,
          id: "trusted-funding-context",
          canonicalUrl: "https://example.com/trusted-funding-context",
          title: "Trusted funding context explains the agent market",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          trendScore: 76,
        },
      ],
      limit: 3,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed[0]?.id).toBe("trusted-model-analysis");
    expect(feed.findIndex((item) => item.id === "viral-low-trust-claim")).toBe(
      2,
    );
  });

  it("anchors server recommendations around saved or shared reader signals", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "unrelated-high-trend-funding",
          canonicalUrl: "https://example.com/unrelated-high-trend-funding",
          title: "Broad AI funding story gets market attention",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          trendScore: 100,
        },
        {
          ...baseNewsItem,
          id: "saved-agent-follow-up",
          canonicalUrl: "https://example.com/saved-agent-follow-up",
          title: "Agent workflow follow-up matches a saved story",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 88,
          trendScore: 74,
        },
        {
          ...baseNewsItem,
          id: "saved-entity-analysis",
          canonicalUrl: "https://example.com/saved-entity-analysis",
          title: "OpenAI analysis extends a saved entity thread",
          entities: ["OpenAI", "Agents"],
          sourceScore: 90,
          trendScore: 72,
        },
      ],
      limit: 3,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [
        {
          category: "agent_product",
          entities: ["Agents"],
          sourceSlug: "agent-desk",
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed[0]?.id).toBe("saved-agent-follow-up");
    expect(feed[1]?.id).toBe("saved-entity-analysis");
    expect(feed[0]?.matchedSignals).toContain("positive_feedback");
  });

  it("anchors server recommendations around saved tag signals", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "unrelated-market-story",
          canonicalUrl: "https://example.com/unrelated-market-story",
          title: "Broad AI market story gets attention",
          category: "market_map",
          entities: ["AI market"],
          sourceName: "Market Map",
          sourceSlug: "market-map",
          tags: ["enterprise"],
          trendScore: 86,
        },
        {
          ...baseNewsItem,
          id: "saved-agent-angle",
          canonicalUrl: "https://example.com/saved-agent-angle",
          title: "Agent workflow follow-up matches a saved angle",
          category: "research",
          entities: ["Benchmarks"],
          sourceName: "Research Lab",
          sourceSlug: "research-lab",
          tags: ["agents"],
          trendScore: 70,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [
        {
          action: "save",
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
          tags: ["agents"],
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "saved-agent-angle",
      "unrelated-market-story",
    ]);
    expect(feed[0]?.matchedSignals).toContain("positive_feedback");
  });

  it("anchors server source-click feedback without boosting topic or entity matches", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "same-topic-only",
          canonicalUrl: "https://example.com/same-topic-only",
          category: "model_release",
          entities: ["Anthropic"],
          sourceName: "Lab Notes",
          sourceSlug: "lab-notes",
          sourceScore: 86,
          title: "Model release topic match should not anchor source clicks",
          trendScore: 82,
        },
        {
          ...baseNewsItem,
          id: "same-source-follow-up",
          canonicalUrl: "https://example.com/same-source-follow-up",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 84,
          title: "Same source follow-up should anchor source clicks",
          trendScore: 72,
        },
        {
          ...baseNewsItem,
          id: "same-entity-only",
          canonicalUrl: "https://example.com/same-entity-only",
          category: "funding",
          entities: ["OpenAI"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 83,
          title: "Entity match should not anchor source clicks",
          trendScore: 80,
        },
      ],
      limit: 3,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [
        {
          action: "click_source",
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "same-source-follow-up",
      "same-topic-only",
      "same-entity-only",
    ]);
    expect(feed[0]?.matchedSignals).toContain("positive_feedback");
    expect(feed[1]?.matchedSignals).not.toContain("positive_feedback");
    expect(feed[2]?.matchedSignals).not.toContain("positive_feedback");
  });

  it("does not anchor server recommendations from stale source-click feedback", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "unrelated-market-story",
          canonicalUrl: "https://example.com/unrelated-market-story",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          title: "Unrelated market story keeps the ranked lead",
          trendScore: 88,
        },
        {
          ...baseNewsItem,
          id: "stale-source-click-follow-up",
          canonicalUrl: "https://example.com/stale-source-click-follow-up",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 84,
          title: "Old source click should not keep anchoring this source",
          trendScore: 70,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [
        {
          action: "click_source",
          category: "model_release",
          entities: ["OpenAI"],
          occurredAt: "2026-06-01T09:00:00.000Z",
          sourceSlug: "openai-news",
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "unrelated-market-story",
      "stale-source-click-follow-up",
    ]);
    expect(feed[1]?.matchedSignals).not.toContain("positive_feedback");
  });

  it("orders server shared feedback ahead of weaker source-click feedback", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "source-click-follow-up",
          canonicalUrl: "https://example.com/source-click-follow-up",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 84,
          title: "Source click follow-up should not outrank a shared topic",
          trendScore: 84,
        },
        {
          ...baseNewsItem,
          id: "shared-topic-follow-up",
          canonicalUrl: "https://example.com/shared-topic-follow-up",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 83,
          title: "Shared funding topic should train the feed more strongly",
          trendScore: 72,
        },
        {
          ...baseNewsItem,
          id: "unrelated-research-story",
          canonicalUrl: "https://example.com/unrelated-research-story",
          category: "research",
          entities: ["Benchmarks"],
          sourceName: "Research Lab",
          sourceSlug: "research-lab",
          sourceScore: 82,
          title: "Unrelated research story stays behind feedback matches",
          trendScore: 82,
        },
      ],
      limit: 3,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [
        {
          action: "click_source",
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
        },
        {
          action: "share",
          category: "funding",
          entities: ["Series A"],
          sourceSlug: "venturewire",
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "shared-topic-follow-up",
      "source-click-follow-up",
      "unrelated-research-story",
    ]);
    expect(feed[0]?.matchedSignals).toContain("positive_feedback");
    expect(feed[1]?.matchedSignals).toContain("positive_feedback");
  });

  it("orders newer server positive feedback ahead of older same-strength feedback", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "old-share-follow-up",
          canonicalUrl: "https://example.com/old-share-follow-up",
          category: "model_release",
          entities: ["OpenAI"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 84,
          title: "Old shared topic should not permanently lead",
          trendScore: 84,
        },
        {
          ...baseNewsItem,
          id: "recent-share-follow-up",
          canonicalUrl: "https://example.com/recent-share-follow-up",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 83,
          title: "Recent shared topic should lead same-strength matches",
          trendScore: 72,
        },
        {
          ...baseNewsItem,
          id: "unrelated-research-story",
          canonicalUrl: "https://example.com/unrelated-research-story",
          category: "research",
          entities: ["Benchmarks"],
          sourceName: "Research Lab",
          sourceSlug: "research-lab",
          sourceScore: 82,
          title: "Unrelated research story stays behind feedback matches",
          trendScore: 82,
        },
      ],
      limit: 3,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [
        {
          action: "share",
          category: "model_release",
          entities: ["OpenAI"],
          occurredAt: "2026-06-01T09:00:00.000Z",
          sourceSlug: "openai-news",
        },
        {
          action: "share",
          category: "funding",
          entities: ["Series A"],
          occurredAt: "2026-07-01T09:00:00.000Z",
          sourceSlug: "venturewire",
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "recent-share-follow-up",
      "old-share-follow-up",
      "unrelated-research-story",
    ]);
    expect(feed[0]?.matchedSignals).toContain("positive_feedback");
    expect(feed[1]?.matchedSignals).toContain("positive_feedback");
  });

  it("removes server recommendations that duplicate hidden stories by canonical URL", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: ["hidden-openai-model"],
      hiddenNewsItems: [
        {
          ...baseNewsItem,
          id: "hidden-openai-model",
          canonicalUrl: "https://example.com/openai-model",
        },
      ],
      items: [
        {
          ...baseNewsItem,
          id: "hidden-openai-model",
          canonicalUrl: "https://example.com/openai-model",
        },
        {
          ...baseNewsItem,
          id: "syndicated-openai-model",
          canonicalUrl: "https://example.com/openai-model?utm=feed",
          sourceName: "Syndication Desk",
          sourceSlug: "syndication-desk",
          trendScore: 99,
        },
        {
          ...baseNewsItem,
          id: "fresh-agent-story",
          canonicalUrl: "https://example.com/fresh-agent-story",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          trendScore: 80,
        },
      ],
      limit: 3,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      profile: {
        preferredCategories: ["model_release"],
        preferredSources: ["openai-news"],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual(["fresh-agent-story"]);
  });
});

describe("selectUniqueNewsCollectionItems", () => {
  it("deduplicates saved or history URL variants while keeping the collection slot", () => {
    const items = selectUniqueNewsCollectionItems([
      {
        ...baseNewsItem,
        id: "recent-syndicated-model",
        canonicalUrl: "https://mirror.example/openai-model",
        originalUrl: "https://example.com/openai-model?utm=sidebar",
        savedAt: "2026-07-01T09:00:00.000Z",
        sourceScore: 84,
        trendScore: 91,
      },
      {
        ...baseNewsItem,
        id: "trusted-official-model",
        canonicalUrl: "https://example.com/openai-model",
        originalUrl: "https://example.com/openai-model",
        savedAt: "2026-07-01T08:00:00.000Z",
        sourceScore: 96,
        trendScore: 88,
      },
      {
        ...baseNewsItem,
        id: "fresh-agent-story",
        canonicalUrl: "https://example.com/fresh-agent-story",
        originalUrl: "https://example.com/fresh-agent-story",
        category: "agent_product",
        entities: ["Agents"],
        savedAt: "2026-07-01T07:00:00.000Z",
        sourceName: "Agent Desk",
        sourceSlug: "agent-desk",
        sourceScore: 88,
        trendScore: 86,
      },
    ]);

    expect(items.map((item) => item.id)).toEqual([
      "trusted-official-model",
      "fresh-agent-story",
    ]);
  });
});
