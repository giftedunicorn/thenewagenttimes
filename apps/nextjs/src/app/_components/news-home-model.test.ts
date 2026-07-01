import { describe, expect, it } from "vitest";

import {
  buildNewsDeskStatus,
  buildNewsHomeFeedInput,
  createDefaultNewsPreferenceProfile,
  getNewsDeskStatusSummary,
  getNewsEditionBriefing,
  getNewsEditionMix,
  getNewsEntityRadar,
  getNewsPersonalizedReadingQueue,
  getNewsReaderMemory,
  getNewsReaderRankingFactors,
  getNewsReaderSignalSummary,
  getNewsRecommendationAudit,
  getNewsRecommendationReasons,
  getNewsSectionFronts,
  getNewsSourceBalance,
  getNewsStoryRankDetails,
  getNewsTopicPulse,
  getNextNewsHomeCursor,
  mergeNewsHomeItems,
  selectHydratedNewsPreferenceProfile,
  selectNewsFeedModeItems,
  selectNewsHomeItems,
  selectVisibleNewsHomeItems,
  shouldAutoLoadMoreNewsHomeItems,
  shouldFetchServerRecommendations,
} from "./news-home-model";

const localItem = {
  id: "local-story",
  title: "Local trend fallback",
  summary: "The fallback story from the server-rendered home payload.",
  canonicalUrl: "https://example.com/local",
  imageUrl: null,
  publishedAt: "2026-07-01T08:00:00.000Z",
  category: "model_release",
  tags: ["model"],
  entities: ["OpenAI"],
  sourceName: "Local Source",
  sourceSlug: "local-source",
  sourceType: "rss",
  sourceScore: 80,
  trendScore: 75,
};

const serverItem = {
  ...localItem,
  id: "server-story",
  title: "Server-ranked recommendation",
};

const olderItem = {
  ...localItem,
  id: "older-story",
  publishedAt: "2026-06-30T08:00:00.000Z",
};

const localProfile = {
  preferredCategories: ["model_release"],
  preferredSources: ["local-source"],
  preferredEntities: ["OpenAI"],
  noveltyBias: 1,
  recencyBias: 1,
};

const persistedProfile = {
  preferredCategories: ["funding"],
  preferredSources: ["venturewire"],
  preferredEntities: ["Series A"],
  noveltyBias: 1.5,
  persisted: true,
  recencyBias: 1.5,
};

describe("createDefaultNewsPreferenceProfile", () => {
  it("creates the starting reader profile for the AI news edition", () => {
    expect(createDefaultNewsPreferenceProfile()).toEqual({
      preferredCategories: ["model_release", "agent_product", "funding"],
      preferredSources: [],
      preferredEntities: [],
      noveltyBias: 1,
      recencyBias: 1,
    });
  });

  it("returns a fresh profile object each time", () => {
    const firstProfile = createDefaultNewsPreferenceProfile();
    const secondProfile = createDefaultNewsPreferenceProfile();

    expect(firstProfile).not.toBe(secondProfile);
    expect(firstProfile.preferredCategories).not.toBe(
      secondProfile.preferredCategories,
    );
    expect(firstProfile.preferredSources).not.toBe(
      secondProfile.preferredSources,
    );
    expect(firstProfile.preferredEntities).not.toBe(
      secondProfile.preferredEntities,
    );
  });
});

describe("selectNewsHomeItems", () => {
  it("prefers server-ranked recommendation items when they are available", () => {
    expect(
      selectNewsHomeItems({
        initialItems: [localItem],
        serverRecommendedItems: [serverItem],
      }).map((item) => item.id),
    ).toEqual(["server-story"]);
  });

  it("falls back to initial items while server recommendations are unavailable", () => {
    expect(
      selectNewsHomeItems({
        initialItems: [localItem],
        serverRecommendedItems: [],
      }).map((item) => item.id),
    ).toEqual(["local-story"]);
  });
});

describe("buildNewsHomeFeedInput", () => {
  it("keeps only meaningful live feed filters in the tRPC query input", () => {
    expect(
      buildNewsHomeFeedInput({
        category: "model_release",
        cursor: "2026-06-30T08:00:00.000Z",
        limit: 20,
        q: "  agents  ",
        sourceSlug: "openai-news",
        visitorKey: "visitor-123",
      }),
    ).toEqual({
      category: "model_release",
      cursor: "2026-06-30T08:00:00.000Z",
      limit: 20,
      q: "agents",
      sourceSlug: "openai-news",
      visitorKey: "visitor-123",
    });
  });

  it("omits blank optional filters before querying the recommendation API", () => {
    expect(
      buildNewsHomeFeedInput({
        category: null,
        cursor: null,
        limit: 30,
        q: "   ",
        sourceSlug: null,
        visitorKey: null,
      }),
    ).toEqual({ limit: 30 });
  });
});

describe("selectHydratedNewsPreferenceProfile", () => {
  it("uses a persisted server profile when one is available", () => {
    expect(
      selectHydratedNewsPreferenceProfile({
        localProfile,
        serverProfile: persistedProfile,
      }),
    ).toEqual({
      preferredCategories: ["funding"],
      preferredSources: ["venturewire"],
      preferredEntities: ["Series A"],
      noveltyBias: 1.5,
      recencyBias: 1.5,
    });
  });

  it("keeps local preferences when the server has no persisted profile yet", () => {
    expect(
      selectHydratedNewsPreferenceProfile({
        localProfile,
        serverProfile: {
          ...persistedProfile,
          persisted: false,
        },
      }),
    ).toBe(localProfile);
    expect(
      selectHydratedNewsPreferenceProfile({
        localProfile,
        serverProfile: undefined,
      }),
    ).toBe(localProfile);
  });

  it("normalizes persisted server profile signals before using them", () => {
    expect(
      selectHydratedNewsPreferenceProfile({
        localProfile,
        serverProfile: {
          preferredCategories: [" model_release ", "MODEL_RELEASE", "funding"],
          preferredSources: [" openai-news ", "OpenAI-News"],
          preferredEntities: [" OpenAI ", "openai", "Anthropic"],
          noveltyBias: 9,
          persisted: true,
          recencyBias: -3,
        },
      }),
    ).toEqual({
      preferredCategories: ["model_release", "funding"],
      preferredSources: ["openai-news"],
      preferredEntities: ["OpenAI", "Anthropic"],
      noveltyBias: 2,
      recencyBias: 0,
    });
  });
});

describe("getNewsReaderSignalSummary", () => {
  it("summarizes compact reader signals for the personalization panel", () => {
    expect(
      getNewsReaderSignalSummary({
        preferredCategories: [
          "model_release",
          "funding",
          "model_release",
          "agent_product",
          "research",
        ],
        preferredSources: ["openai-news", "OpenAI-News", "venturewire"],
        preferredEntities: ["OpenAI", "Anthropic", "OpenAI", "YC", "LangChain"],
        noveltyBias: 1.6,
        recencyBias: 1.4,
      }),
    ).toEqual({
      detail: "10 reader signals are shaping story order.",
      entities: ["OpenAI", "Anthropic", "YC", "LangChain"],
      signalCount: 10,
      sources: ["openai-news", "venturewire"],
      strength: "Focused",
      topics: ["model_release", "funding", "agent_product", "research"],
    });
  });

  it("returns an exploring state when no reader signals exist yet", () => {
    expect(
      getNewsReaderSignalSummary({
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 0,
        recencyBias: 0,
      }),
    ).toEqual({
      detail: "Read, save, or hide stories to train your edition.",
      entities: [],
      signalCount: 0,
      sources: [],
      strength: "Exploring",
      topics: [],
    });
  });
});

describe("getNewsReaderRankingFactors", () => {
  it("explains how active reader signals affect story ranking", () => {
    expect(
      getNewsReaderRankingFactors({
        preferredCategories: [
          "model_release",
          "funding",
          "model_release",
          "research",
          "agent_product",
        ],
        preferredSources: ["openai-news", "venturewire", "OpenAI-News"],
        preferredEntities: ["OpenAI", "Anthropic", "OpenAI", "YC"],
        noveltyBias: 2,
        recencyBias: 0.5,
      }),
    ).toEqual([
      {
        label: "Topics",
        detail: "4 topic signals lift matching stories.",
      },
      {
        label: "Sources",
        detail: "2 source signals lift trusted reporting.",
      },
      {
        label: "Entities",
        detail: "3 entity signals lift related coverage.",
      },
      {
        label: "Bias",
        detail: "Novel stories are weighted above fresh stories.",
      },
    ]);
  });

  it("keeps the cold-start explanation explicit", () => {
    expect(
      getNewsReaderRankingFactors({
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      }),
    ).toEqual([
      {
        label: "Signals",
        detail: "No saved reader signals yet.",
      },
      {
        label: "Bias",
        detail: "Freshness and novelty are balanced.",
      },
    ]);
  });
});

describe("getNewsReaderMemory", () => {
  it("summarizes profile signals with saved and read behavior", () => {
    expect(
      getNewsReaderMemory({
        formatCategory: (category) =>
          category === "funding"
            ? "Funding"
            : category === "agent_product"
              ? "Agents"
              : "Models",
        historyItems: [
          {
            ...localItem,
            id: "read-agent",
            category: "agent_product",
            entities: ["OpenAI", "Agents"],
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
          },
          {
            ...localItem,
            id: "read-model",
            entities: ["OpenAI", "GPT"],
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
          },
        ],
        profile: {
          preferredCategories: ["model_release", "funding"],
          preferredSources: ["openai-news"],
          preferredEntities: ["OpenAI", "Anthropic"],
          noveltyBias: 1.4,
          recencyBias: 1.1,
        },
        savedItems: [
          {
            ...localItem,
            id: "saved-model",
            entities: ["OpenAI", "Agents"],
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
          },
          {
            ...localItem,
            id: "saved-funding",
            category: "funding",
            entities: ["OpenAI", "Series A"],
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
        ],
      }),
    ).toEqual({
      highlights: [
        {
          detail: "Models leads with 2 saved/read stories.",
          label: "Topic memory",
        },
        {
          detail: "OpenAI News is the strongest source signal.",
          label: "Source memory",
        },
        {
          detail: "OpenAI is the strongest entity signal.",
          label: "Entity memory",
        },
      ],
      label: "Strong Memory",
      metrics: [
        { label: "Profile signals", value: "5" },
        { label: "Saved", value: "2" },
        { label: "Read", value: "2" },
        { label: "Top topic", value: "Models" },
      ],
      summary:
        "5 preference signals, 2 saved stories, and 2 reads are shaping the next edition.",
    });
  });

  it("keeps the cold-start memory state explicit", () => {
    expect(
      getNewsReaderMemory({
        formatCategory: (category) => category,
        historyItems: [],
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
        savedItems: [],
      }),
    ).toEqual({
      highlights: [
        {
          detail: "Save, read, or hide stories to build a reader memory.",
          label: "Learning needed",
        },
      ],
      label: "Cold Start",
      metrics: [
        { label: "Profile signals", value: "0" },
        { label: "Saved", value: "0" },
        { label: "Read", value: "0" },
        { label: "Top topic", value: "None" },
      ],
      summary: "Reader memory will appear after you interact with stories.",
    });
  });
});

describe("getNewsTopicPulse", () => {
  it("groups the current edition into ranked topic pulses", () => {
    expect(
      getNewsTopicPulse({
        items: [
          localItem,
          {
            ...localItem,
            id: "model-follow-up",
            publishedAt: "2026-07-01T10:00:00.000Z",
            sourceName: "DeepMind",
            sourceSlug: "deepmind",
            trendScore: 83,
          },
          {
            ...localItem,
            id: "funding-brief",
            category: "funding",
            publishedAt: "2026-07-01T09:00:00.000Z",
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            trendScore: 96,
          },
        ],
        limit: 2,
      }),
    ).toEqual([
      {
        averageTrendScore: 79,
        category: "model_release",
        heatScore: 119,
        latestPublishedAt: "2026-07-01T10:00:00.000Z",
        sources: ["Local Source", "DeepMind"],
        storyCount: 2,
      },
      {
        averageTrendScore: 96,
        category: "funding",
        heatScore: 116,
        latestPublishedAt: "2026-07-01T09:00:00.000Z",
        sources: ["VentureWire"],
        storyCount: 1,
      },
    ]);
  });

  it("returns no topic pulses for an empty edition", () => {
    expect(getNewsTopicPulse({ items: [], limit: 3 })).toEqual([]);
  });
});

describe("getNewsEditionBriefing", () => {
  it("summarizes the current ranked edition into a front-page briefing", () => {
    expect(
      getNewsEditionBriefing({
        entityLimit: 2,
        formatCategory: (category) =>
          category === "funding"
            ? "Funding"
            : category === "agent_product"
              ? "Agents"
              : "Models",
        items: [
          {
            ...localItem,
            matchedSignals: ["category"],
            personalizedScore: 140,
            trendScore: 90,
          },
          {
            ...localItem,
            id: "funding-one",
            category: "funding",
            entities: ["OpenAI", "Series A"],
            matchedSignals: ["entity"],
            personalizedScore: 132,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            trendScore: 96,
          },
          {
            ...localItem,
            id: "agent-one",
            category: "agent_product",
            entities: ["Anthropic", "Agents"],
            matchedSignals: [],
            personalizedScore: 118,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            trendScore: 88,
          },
          {
            ...localItem,
            id: "funding-two",
            category: "funding",
            entities: ["openai", "YC"],
            matchedSignals: ["exploration"],
            personalizedScore: 111,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            trendScore: 82,
          },
        ],
        topicLimit: 2,
      }),
    ).toEqual({
      entities: [
        {
          entity: "OpenAI",
          heatScore: 161,
          sourceCount: 2,
          storyCount: 3,
        },
        {
          entity: "Series A",
          heatScore: 122,
          sourceCount: 1,
          storyCount: 1,
        },
      ],
      headline: "Local trend fallback",
      lead: {
        category: "model_release",
        categoryLabel: "Models",
        personalizedScore: 140,
        sourceName: "Local Source",
        title: "Local trend fallback",
      },
      metrics: [
        { label: "Stories", value: "4" },
        { label: "Sources", value: "3" },
        { label: "Topics", value: "3" },
      ],
      sourceCount: 3,
      storyCount: 4,
      summary:
        "4 stories from 3 sources, led by Funding coverage and OpenAI momentum.",
      topics: [
        {
          averageTrendScore: 89,
          category: "funding",
          heatScore: 129,
          label: "Funding",
          latestPublishedAt: "2026-07-01T08:00:00.000Z",
          sources: ["VentureWire"],
          storyCount: 2,
        },
        {
          averageTrendScore: 90,
          category: "model_release",
          heatScore: 110,
          label: "Models",
          latestPublishedAt: "2026-07-01T08:00:00.000Z",
          sources: ["Local Source"],
          storyCount: 1,
        },
      ],
    });
  });

  it("returns a stable empty briefing before stories load", () => {
    expect(
      getNewsEditionBriefing({
        entityLimit: 2,
        formatCategory: (category) => category,
        items: [],
        topicLimit: 2,
      }),
    ).toEqual({
      entities: [],
      headline: "Today's AI briefing",
      lead: null,
      metrics: [
        { label: "Stories", value: "0" },
        { label: "Sources", value: "0" },
        { label: "Topics", value: "0" },
      ],
      sourceCount: 0,
      storyCount: 0,
      summary: "Briefing will appear as stories load.",
      topics: [],
    });
  });
});

describe("getNewsSectionFronts", () => {
  it("groups the ranked edition into newspaper-style section fronts", () => {
    expect(
      getNewsSectionFronts({
        formatCategory: (category) =>
          category === "funding"
            ? "Funding"
            : category === "agent_product"
              ? "Agents"
              : "Models",
        items: [
          {
            ...localItem,
            matchedSignals: ["category"],
            personalizedScore: 140,
            trendScore: 90,
          },
          {
            ...localItem,
            id: "funding-one",
            category: "funding",
            matchedSignals: ["entity"],
            personalizedScore: 135,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Funding brief",
            trendScore: 96,
          },
          {
            ...localItem,
            id: "model-two",
            matchedSignals: [],
            personalizedScore: 120,
            publishedAt: "2026-07-01T10:00:00.000Z",
            sourceName: "DeepMind",
            sourceSlug: "deepmind",
            title: "Model follow-up",
            trendScore: 70,
          },
          {
            ...localItem,
            id: "agent-one",
            category: "agent_product",
            matchedSignals: [],
            personalizedScore: 118,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Agent launch",
            trendScore: 88,
          },
        ],
        limit: 2,
        storiesPerSection: 3,
      }),
    ).toEqual([
      {
        averageTrendScore: 80,
        category: "model_release",
        heatScore: 244,
        label: "Models",
        latestPublishedAt: "2026-07-01T10:00:00.000Z",
        lead: {
          id: "local-story",
          personalizedScore: 140,
          publishedAt: "2026-07-01T08:00:00.000Z",
          sourceName: "Local Source",
          title: "Local trend fallback",
        },
        sourceCount: 2,
        storyCount: 2,
        summary: "2 stories from 2 sources, led by Local Source.",
        supportingStories: [
          {
            id: "model-two",
            personalizedScore: 120,
            sourceName: "DeepMind",
            title: "Model follow-up",
          },
        ],
      },
      {
        averageTrendScore: 96,
        category: "funding",
        heatScore: 243,
        label: "Funding",
        latestPublishedAt: "2026-07-01T08:00:00.000Z",
        lead: {
          id: "funding-one",
          personalizedScore: 135,
          publishedAt: "2026-07-01T08:00:00.000Z",
          sourceName: "VentureWire",
          title: "Funding brief",
        },
        sourceCount: 1,
        storyCount: 1,
        summary: "1 story from 1 source, led by VentureWire.",
        supportingStories: [],
      },
    ]);
  });

  it("returns no section fronts when the edition is empty", () => {
    expect(
      getNewsSectionFronts({
        formatCategory: (category) => category,
        items: [],
        limit: 4,
        storiesPerSection: 3,
      }),
    ).toEqual([]);
  });
});

describe("getNewsPersonalizedReadingQueue", () => {
  it("builds a three-step reading path from the ranked edition", () => {
    expect(
      getNewsPersonalizedReadingQueue({
        items: [
          {
            ...localItem,
            matchedSignals: ["category"],
            personalizedScore: 150,
            trendScore: 78,
          },
          {
            ...localItem,
            id: "deep-agent-workflow",
            entities: ["OpenAI", "Agents", "Enterprise"],
            matchedSignals: ["source", "entity"],
            personalizedScore: 132,
            sourceName: "Agent Desk",
            sourceScore: 94,
            tags: ["agent", "workflow", "enterprise"],
            title: "Enterprise agents move into workflow control",
            trendScore: 74,
          },
          {
            ...localItem,
            id: "outside-profile",
            category: "funding",
            matchedSignals: ["exploration"],
            personalizedScore: 104,
            sourceName: "VentureWire",
            sourceScore: 82,
            title: "Funding round tests a new AI infra market",
            trendScore: 86,
          },
          {
            ...localItem,
            id: "trend-fallback",
            matchedSignals: [],
            personalizedScore: 96,
            sourceName: "Launch Feed",
            title: "Launch feed spots a new model tool",
            trendScore: 90,
          },
        ],
      }),
    ).toEqual({
      slots: [
        {
          intent: "Fast Brief",
          label: "Start",
          reason: "Highest-ranked story in this edition.",
          story: {
            id: "local-story",
            personalizedScore: 150,
            sourceName: "Local Source",
            title: "Local trend fallback",
          },
        },
        {
          intent: "Deep Dive",
          label: "Go deeper",
          reason: "Dense source-backed story with 3 entities and 3 tags.",
          story: {
            id: "deep-agent-workflow",
            personalizedScore: 132,
            sourceName: "Agent Desk",
            title: "Enterprise agents move into workflow control",
          },
        },
        {
          intent: "Explore",
          label: "Try outside profile",
          reason: "Exploration story keeps the queue from narrowing.",
          story: {
            id: "outside-profile",
            personalizedScore: 104,
            sourceName: "VentureWire",
            title: "Funding round tests a new AI infra market",
          },
        },
      ],
      summary: "3-step queue built from 4 ranked stories.",
    });
  });

  it("returns a stable empty queue before stories load", () => {
    expect(getNewsPersonalizedReadingQueue({ items: [] })).toEqual({
      slots: [],
      summary: "Queue will appear as stories load.",
    });
  });
});

describe("getNewsEditionMix", () => {
  it("summarizes the ranked feed by personalization mode", () => {
    expect(
      getNewsEditionMix({
        items: [
          {
            ...localItem,
            matchedSignals: ["category"],
            personalizedScore: 120,
          },
          {
            ...serverItem,
            matchedSignals: ["source", "entity"],
            personalizedScore: 112,
          },
          {
            ...olderItem,
            matchedSignals: ["exploration"],
            personalizedScore: 98,
          },
          {
            ...localItem,
            id: "trend-only",
            matchedSignals: [],
            personalizedScore: 91,
          },
        ],
      }),
    ).toEqual({
      segments: [
        {
          count: 2,
          detail: "Matched reader signals",
          label: "Personalized",
          percentage: 50,
        },
        {
          count: 1,
          detail: "Outside your usual mix",
          label: "Exploration",
          percentage: 25,
        },
        {
          count: 1,
          detail: "Ranked by heat and freshness",
          label: "Trending",
          percentage: 25,
        },
      ],
      summary: "2 of 4 stories match your reader profile.",
      totalCount: 4,
    });
  });

  it("returns a stable empty edition mix", () => {
    expect(getNewsEditionMix({ items: [] })).toEqual({
      segments: [
        {
          count: 0,
          detail: "Matched reader signals",
          label: "Personalized",
          percentage: 0,
        },
        {
          count: 0,
          detail: "Outside your usual mix",
          label: "Exploration",
          percentage: 0,
        },
        {
          count: 0,
          detail: "Ranked by heat and freshness",
          label: "Trending",
          percentage: 0,
        },
      ],
      summary: "Edition mix will appear as stories load.",
      totalCount: 0,
    });
  });
});

describe("getNewsRecommendationAudit", () => {
  it("summarizes how the For You edition balances personalization, exploration, and source spread", () => {
    expect(
      getNewsRecommendationAudit({
        items: [
          {
            ...localItem,
            matchedSignals: ["category", "source"],
            personalizedScore: 142,
          },
          {
            ...serverItem,
            matchedSignals: ["entity"],
            personalizedScore: 131,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
          },
          {
            ...olderItem,
            id: "explore-story",
            matchedSignals: ["exploration"],
            personalizedScore: 104,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
          {
            ...localItem,
            id: "trend-story",
            matchedSignals: [],
            personalizedScore: 95,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
          },
        ],
        profile: {
          preferredCategories: ["model_release", "funding"],
          preferredSources: ["local-source"],
          preferredEntities: ["OpenAI", "Anthropic"],
          noveltyBias: 1.4,
          recencyBias: 1.2,
        },
      }),
    ).toEqual({
      label: "Balanced For You",
      metrics: [
        { label: "Personalized", value: "50%" },
        { label: "Exploration", value: "25%" },
        { label: "Source spread", value: "4 sources" },
        { label: "Reader signals", value: "5" },
      ],
      notices: [
        {
          detail:
            "Exploration stories are present, so the feed is testing useful AI coverage outside the current profile.",
          label: "Filter-bubble guard",
        },
        {
          detail:
            "No source owns more than half of this edition, keeping the front page diversified.",
          label: "Source diversity",
        },
      ],
      summary:
        "4 stories: 2 personalized, 1 exploratory, and 1 trend-led across 4 sources.",
    });
  });

  it("keeps cold-start recommendation diagnostics explicit before the reader has signals", () => {
    expect(
      getNewsRecommendationAudit({
        items: [
          {
            ...localItem,
            matchedSignals: [],
            personalizedScore: 90,
          },
          {
            ...serverItem,
            matchedSignals: [],
            personalizedScore: 88,
          },
        ],
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      label: "Cold Start",
      metrics: [
        { label: "Personalized", value: "0%" },
        { label: "Exploration", value: "0%" },
        { label: "Source spread", value: "1 source" },
        { label: "Reader signals", value: "0" },
      ],
      notices: [
        {
          detail:
            "Read, save, or hide stories to train the recommendation profile.",
          label: "Learning needed",
        },
        {
          detail:
            "One source dominates this edition; add sources or ingest more stories to broaden coverage.",
          label: "Source concentration",
        },
      ],
      summary:
        "2 stories: 0 personalized, 0 exploratory, and 2 trend-led across 1 source.",
    });
  });
});

describe("selectNewsFeedModeItems", () => {
  const personalizedStory = {
    ...olderItem,
    id: "personalized-lead",
    matchedSignals: ["category"],
    personalizedScore: 150,
    publishedAt: "2026-06-30T08:00:00.000Z",
    trendScore: 70,
  };
  const latestStory = {
    ...localItem,
    id: "latest-lead",
    matchedSignals: [],
    personalizedScore: 90,
    publishedAt: "2026-07-01T12:00:00.000Z",
    trendScore: 65,
  };
  const trendingStory = {
    ...serverItem,
    id: "trending-lead",
    matchedSignals: [],
    personalizedScore: 100,
    publishedAt: "2026-07-01T09:00:00.000Z",
    trendScore: 98,
  };
  const modeItems = [personalizedStory, latestStory, trendingStory];

  it("keeps the personalized recommendation order for For You mode", () => {
    expect(
      selectNewsFeedModeItems({
        items: modeItems,
        mode: "for_you",
      }).map((item) => item.id),
    ).toEqual(["personalized-lead", "latest-lead", "trending-lead"]);
  });

  it("sorts the edition by recency for Latest mode without mutating input", () => {
    expect(
      selectNewsFeedModeItems({
        items: modeItems,
        mode: "latest",
      }).map((item) => item.id),
    ).toEqual(["latest-lead", "trending-lead", "personalized-lead"]);
    expect(modeItems.map((item) => item.id)).toEqual([
      "personalized-lead",
      "latest-lead",
      "trending-lead",
    ]);
  });

  it("sorts the edition by heat for Trending mode", () => {
    expect(
      selectNewsFeedModeItems({
        items: modeItems,
        mode: "trending",
      }).map((item) => item.id),
    ).toEqual(["trending-lead", "personalized-lead", "latest-lead"]);
  });
});

describe("getNewsSourceBalance", () => {
  it("summarizes source diversity for a balanced edition", () => {
    expect(
      getNewsSourceBalance({
        items: [
          localItem,
          serverItem,
          {
            ...localItem,
            id: "deepmind-story",
            sourceName: "DeepMind",
            sourceSlug: "deepmind",
          },
          {
            ...localItem,
            id: "venture-story",
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
        ],
      }),
    ).toEqual({
      concentration: "Balanced",
      dominantSource: {
        count: 2,
        name: "Local Source",
        percentage: 50,
        slug: "local-source",
      },
      summary: "3 sources represented; Local Source leads with 50%.",
      totalCount: 4,
      uniqueSourceCount: 3,
    });
  });

  it("marks the edition concentrated when one source dominates", () => {
    expect(
      getNewsSourceBalance({
        items: [
          localItem,
          serverItem,
          {
            ...localItem,
            id: "local-follow-up",
          },
          {
            ...localItem,
            id: "venture-story",
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
        ],
      }).concentration,
    ).toBe("Concentrated");
  });

  it("returns a stable empty source balance", () => {
    expect(getNewsSourceBalance({ items: [] })).toEqual({
      concentration: "Empty",
      dominantSource: null,
      summary: "Source balance will appear as stories load.",
      totalCount: 0,
      uniqueSourceCount: 0,
    });
  });
});

describe("getNewsEntityRadar", () => {
  it("surfaces repeated entities across the current edition", () => {
    expect(
      getNewsEntityRadar({
        items: [
          localItem,
          {
            ...localItem,
            id: "openai-agent",
            entities: ["OpenAI", "Agents", "YC"],
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
          },
          {
            ...localItem,
            id: "anthropic-agent",
            category: "agent_product",
            entities: ["Anthropic", "Agents"],
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
          },
          {
            ...localItem,
            id: "openai-funding",
            category: "funding",
            entities: ["openai", "Series A"],
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
        ],
        limit: 3,
      }),
    ).toEqual([
      {
        entity: "OpenAI",
        heatScore: 153,
        sourceCount: 3,
        storyCount: 3,
      },
      {
        entity: "Agents",
        heatScore: 121,
        sourceCount: 1,
        storyCount: 2,
      },
      {
        entity: "Anthropic",
        heatScore: 101,
        sourceCount: 1,
        storyCount: 1,
      },
    ]);
  });

  it("returns no entity radar entries for an empty edition", () => {
    expect(getNewsEntityRadar({ items: [], limit: 5 })).toEqual([]);
  });
});

describe("selectVisibleNewsHomeItems", () => {
  it("removes stories hidden during the current feed session", () => {
    expect(
      selectVisibleNewsHomeItems({
        items: [localItem, serverItem],
        hiddenItemIds: ["local-story"],
      }).map((item) => item.id),
    ).toEqual(["server-story"]);
  });

  it("keeps all stories when no local hidden ids are present", () => {
    expect(
      selectVisibleNewsHomeItems({
        items: [localItem, serverItem],
        hiddenItemIds: [],
      }).map((item) => item.id),
    ).toEqual(["local-story", "server-story"]);
  });
});

describe("mergeNewsHomeItems", () => {
  it("appends newly loaded stories without duplicating existing stories", () => {
    expect(
      mergeNewsHomeItems({
        currentItems: [localItem, serverItem],
        nextItems: [serverItem, olderItem],
      }).map((item) => item.id),
    ).toEqual(["local-story", "server-story", "older-story"]);
  });
});

describe("getNextNewsHomeCursor", () => {
  it("uses the oldest story timestamp as the next pagination cursor", () => {
    expect(getNextNewsHomeCursor([localItem, olderItem, serverItem])).toBe(
      "2026-06-30T08:00:00.000Z",
    );
  });

  it("returns null when there are no stories to paginate from", () => {
    expect(getNextNewsHomeCursor([])).toBeNull();
  });
});

describe("shouldAutoLoadMoreNewsHomeItems", () => {
  it("only auto-loads when the live feed end is visible and pagination is ready", () => {
    expect(
      shouldAutoLoadMoreNewsHomeItems({
        cursor: "2026-06-30T08:00:00.000Z",
        hasMoreItems: true,
        isFeedEndVisible: true,
        isLoadingMore: false,
        isPreview: false,
        visitorKey: "visitor-123",
      }),
    ).toBe(true);
  });

  it("does not auto-load for preview, exhausted, loading, anonymous, hidden, or empty-cursor states", () => {
    const readyState = {
      cursor: "2026-06-30T08:00:00.000Z",
      hasMoreItems: true,
      isFeedEndVisible: true,
      isLoadingMore: false,
      isPreview: false,
      visitorKey: "visitor-123",
    };

    expect(
      shouldAutoLoadMoreNewsHomeItems({ ...readyState, isPreview: true }),
    ).toBe(false);
    expect(
      shouldAutoLoadMoreNewsHomeItems({ ...readyState, hasMoreItems: false }),
    ).toBe(false);
    expect(
      shouldAutoLoadMoreNewsHomeItems({ ...readyState, isLoadingMore: true }),
    ).toBe(false);
    expect(
      shouldAutoLoadMoreNewsHomeItems({ ...readyState, visitorKey: null }),
    ).toBe(false);
    expect(
      shouldAutoLoadMoreNewsHomeItems({
        ...readyState,
        isFeedEndVisible: false,
      }),
    ).toBe(false);
    expect(
      shouldAutoLoadMoreNewsHomeItems({ ...readyState, cursor: null }),
    ).toBe(false);
  });
});

describe("shouldFetchServerRecommendations", () => {
  it("only fetches server recommendations for ready live editions with a reader key", () => {
    expect(
      shouldFetchServerRecommendations({
        status: "ready",
        visitorKey: "visitor-123",
      }),
    ).toBe(true);
    expect(
      shouldFetchServerRecommendations({
        status: "unavailable",
        visitorKey: "visitor-123",
      }),
    ).toBe(false);
    expect(
      shouldFetchServerRecommendations({
        status: "ready",
        visitorKey: null,
      }),
    ).toBe(false);
  });
});

describe("getNewsRecommendationReasons", () => {
  it("turns matched ranking signals into reader-facing recommendation reasons", () => {
    expect(
      getNewsRecommendationReasons({
        item: {
          ...localItem,
          matchedSignals: ["category", "source", "entity"],
          personalizedScore: 128,
        },
      }),
    ).toEqual(["Preferred topic", "Trusted source", "Followed entity"]);
  });

  it("falls back to trend and freshness reasons when no preference signals matched", () => {
    expect(
      getNewsRecommendationReasons({
        item: {
          ...localItem,
          matchedSignals: [],
          personalizedScore: 94,
        },
      }),
    ).toEqual(["Trending now", "Recently published"]);
  });

  it("explains exploration stories that sit outside the current reader profile", () => {
    expect(
      getNewsRecommendationReasons({
        item: {
          ...localItem,
          matchedSignals: ["exploration"],
          personalizedScore: 104,
        },
      }),
    ).toEqual(["Outside your usual mix"]);
  });
});

describe("getNewsStoryRankDetails", () => {
  it("explains why a personalized story is high in the edition", () => {
    expect(
      getNewsStoryRankDetails({
        item: {
          ...localItem,
          matchedSignals: ["category", "source", "entity"],
          personalizedScore: 136,
        },
        now: new Date("2026-07-01T10:00:00.000Z"),
      }),
    ).toEqual({
      badges: [
        "Preferred topic",
        "Trusted source",
        "Followed entity",
        "High heat",
        "Fresh",
      ],
      summary:
        "Ranked for your topic, source, and entity signals, with high story heat and fresh publication timing.",
      scoreLabel: "136 score",
    });
  });

  it("explains exploration stories without implying a reader match", () => {
    expect(
      getNewsStoryRankDetails({
        item: {
          ...olderItem,
          matchedSignals: ["exploration"],
          personalizedScore: 101,
          sourceScore: 82,
          trendScore: 69,
        },
        now: new Date("2026-07-01T10:00:00.000Z"),
      }),
    ).toEqual({
      badges: ["Outside your usual mix", "Strong source"],
      summary:
        "Inserted as an exploration story outside your usual mix, supported by source credibility.",
      scoreLabel: "101 score",
    });
  });

  it("falls back to trend and freshness when there are no reader signals", () => {
    expect(
      getNewsStoryRankDetails({
        item: {
          ...localItem,
          matchedSignals: [],
          personalizedScore: 94,
          sourceScore: 55,
          trendScore: 72,
        },
        now: new Date("2026-07-01T10:00:00.000Z"),
      }),
    ).toEqual({
      badges: ["Trending now", "Fresh"],
      summary:
        "Ranked by edition-wide story heat and fresh publication timing.",
      scoreLabel: "94 score",
    });
  });

  it("explains Latest mode as a recency-ranked story", () => {
    expect(
      getNewsStoryRankDetails({
        item: {
          ...localItem,
          matchedSignals: ["category", "source"],
          personalizedScore: 121,
          publishedAt: "2026-07-01T09:30:00.000Z",
          trendScore: 62,
        },
        mode: "latest",
        now: new Date("2026-07-01T10:00:00.000Z"),
      }),
    ).toEqual({
      badges: ["Newest first", "Fresh"],
      summary: "Ranked by publication time, with fresh publication timing.",
      scoreLabel: "121 score",
    });
  });

  it("explains Trending mode as a heat-ranked story", () => {
    expect(
      getNewsStoryRankDetails({
        item: {
          ...localItem,
          matchedSignals: ["category"],
          personalizedScore: 119,
          sourceScore: 82,
          trendScore: 91,
        },
        mode: "trending",
        now: new Date("2026-07-01T20:00:00.000Z"),
      }),
    ).toEqual({
      badges: ["Trending now", "High heat", "Strong source"],
      summary:
        "Ranked by story heat, with high story heat and source credibility.",
      scoreLabel: "119 score",
    });
  });
});

describe("getNewsDeskStatusSummary", () => {
  it("summarizes a live desk with published stories", () => {
    expect(
      getNewsDeskStatusSummary({
        health: "live",
        activeSources: 9,
        totalSources: 12,
        publishedStories: 42,
        latestPublishedAt: "2026-07-01T10:30:00.000Z",
        latestRun: {
          sourceName: "OpenAI",
          status: "succeeded",
          runType: "rss",
          startedAt: "2026-07-01T10:00:00.000Z",
          finishedAt: "2026-07-01T10:01:00.000Z",
          itemsSeen: 12,
          itemsCreated: 4,
          itemsUpdated: 8,
          errorMessage: null,
        },
      }),
    ).toEqual({
      label: "Live edition",
      detail: "42 published stories from 9 active sources.",
    });
  });

  it("summarizes a seeded desk that has not published live stories yet", () => {
    expect(
      getNewsDeskStatusSummary({
        health: "seeded",
        activeSources: 6,
        totalSources: 8,
        publishedStories: 0,
        latestPublishedAt: null,
        latestRun: null,
      }),
    ).toEqual({
      label: "Ready to crawl",
      detail:
        "6 active sources are registered. Run the refresh job to collect stories.",
    });
  });

  it("surfaces a failed refresh run", () => {
    expect(
      getNewsDeskStatusSummary({
        health: "error",
        activeSources: 6,
        totalSources: 8,
        publishedStories: 0,
        latestPublishedAt: null,
        latestRun: {
          sourceName: "Anthropic",
          status: "failed",
          runType: "rss",
          startedAt: "2026-07-01T10:00:00.000Z",
          finishedAt: "2026-07-01T10:01:00.000Z",
          itemsSeen: 0,
          itemsCreated: 0,
          itemsUpdated: 0,
          errorMessage: "Feed request failed: 500",
        },
      }),
    ).toEqual({
      label: "Refresh failed",
      detail: "Anthropic failed: Feed request failed: 500",
    });
  });

  it("explains when the production schema is unavailable", () => {
    expect(
      getNewsDeskStatusSummary({
        health: "unavailable",
        activeSources: 0,
        totalSources: 0,
        publishedStories: 0,
        latestPublishedAt: null,
        latestRun: null,
      }),
    ).toEqual({
      label: "Needs schema",
      detail:
        "News tables are not reachable yet. Apply the database schema before live collection.",
    });
  });
});

describe("buildNewsDeskStatus", () => {
  it("marks the desk live when published stories exist", () => {
    expect(
      buildNewsDeskStatus({
        activeSources: 3,
        totalSources: 4,
        publishedStories: 12,
        latestPublishedAt: "2026-07-01T10:30:00.000Z",
        latestRun: null,
      }).health,
    ).toBe("live");
  });

  it("marks the desk seeded when sources exist but no story is live", () => {
    expect(
      buildNewsDeskStatus({
        activeSources: 3,
        totalSources: 4,
        publishedStories: 0,
        latestPublishedAt: null,
        latestRun: null,
      }).health,
    ).toBe("seeded");
  });

  it("marks the desk unavailable when the schema is not reachable", () => {
    expect(
      buildNewsDeskStatus({
        activeSources: 0,
        totalSources: 0,
        publishedStories: 0,
        latestPublishedAt: null,
        latestRun: null,
        unavailable: true,
      }).health,
    ).toBe("unavailable");
  });

  it("marks the desk empty when the schema is reachable but sources are not seeded", () => {
    expect(
      buildNewsDeskStatus({
        activeSources: 0,
        totalSources: 0,
        publishedStories: 0,
        latestPublishedAt: null,
        latestRun: null,
      }).health,
    ).toBe("empty");
  });

  it("marks the desk in error when the latest refresh failed", () => {
    expect(
      buildNewsDeskStatus({
        activeSources: 3,
        totalSources: 4,
        publishedStories: 12,
        latestPublishedAt: "2026-07-01T10:30:00.000Z",
        latestRun: {
          sourceName: "OpenAI",
          status: "failed",
          runType: "rss",
          startedAt: "2026-07-01T10:00:00.000Z",
          finishedAt: "2026-07-01T10:01:00.000Z",
          itemsSeen: 0,
          itemsCreated: 0,
          itemsUpdated: 0,
          errorMessage: "Feed request failed: 500",
        },
      }).health,
    ).toBe("error");
  });
});
