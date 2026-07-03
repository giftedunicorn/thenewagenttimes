import { describe, expect, it } from "vitest";

import type { NewsHomeItem } from "./news-home-model";
import {
  buildNewsDeskStatus,
  buildNewsHomeFeedInput,
  buildNewsHomeInteractionMetadata,
  buildNewsHomeReaderInteraction,
  createDefaultNewsPreferenceProfile,
  getNewsAggregationIntake,
  getNewsAlertRouting,
  getNewsAnglePreferenceOptions,
  getNewsBriefingPack,
  getNewsChannelComparison,
  getNewsChannelRail,
  getNewsChannelStrategy,
  getNewsClaimTracker,
  getNewsCollaborativeSignals,
  getNewsConsensusBoard,
  getNewsContinuationRail,
  getNewsCoverageThreads,
  getNewsDeskStatusSummary,
  getNewsDiscoveryLadder,
  getNewsDistributionQueue,
  getNewsEditionBriefing,
  getNewsEditionMix,
  getNewsEditionQualityGate,
  getNewsEditionSchedule,
  getNewsEditorialGuardrails,
  getNewsEntityRadar,
  getNewsExperimentAllocation,
  getNewsExplorationSlots,
  getNewsFeedbackCoach,
  getNewsFeedbackCoachActionState,
  getNewsFeedbackTrainingUpdate,
  getNewsFeedFatigueReport,
  getNewsFeedGovernor,
  getNewsFeedRecipe,
  getNewsFilterBubbleReport,
  getNewsFrontPageLayout,
  getNewsFrontPageSlotMix,
  getNewsGuardrailShelf,
  getNewsHomeReaderMemoryResetCacheScopes,
  getNewsHomeStoryActionPanel,
  getNewsHotBoard,
  getNewsInterestDrift,
  getNewsInterestGraph,
  getNewsLiveWire,
  getNewsMissedCoverageShelf,
  getNewsNextRefreshPlan,
  getNewsPersonalizationMix,
  getNewsPersonalizedPushQueue,
  getNewsPersonalizedReadingQueue,
  getNewsPreferenceControlPanel,
  getNewsPreferencePresets,
  getNewsPreferenceStarter,
  getNewsPreferenceTuningPlan,
  getNewsProductionReadinessChecklist,
  getNewsProfileImpactPreview,
  getNewsProfileSignalLedger,
  getNewsRankingPipeline,
  getNewsReaderCohorts,
  getNewsReaderDaypartPlan,
  getNewsReaderDigest,
  getNewsReaderJourneyMap,
  getNewsReaderLearningLoop,
  getNewsReaderMemory,
  getNewsReaderMemoryResetPersistence,
  getNewsReaderMemoryResetTrainingUpdate,
  getNewsReaderRankingFactors,
  getNewsReaderScorecards,
  getNewsReaderSignalSummary,
  getNewsReaderWatchlist,
  getNewsRecommendationAudit,
  getNewsRecommendationReasons,
  getNewsRecommendationRotationQueue,
  getNewsRecommendationTrace,
  getNewsRefreshSimulation,
  getNewsSearchTrends,
  getNewsSectionFronts,
  getNewsServerProfileAuditDisplay,
  getNewsSessionIntent,
  getNewsSourceBalance,
  getNewsSourceClusters,
  getNewsSourceFilterOptions,
  getNewsSourceTrustLedger,
  getNewsStoryProofStrip,
  getNewsStoryQuickTuneActions,
  getNewsStoryRankDetails,
  getNewsStoryTimeline,
  getNewsTasteCalibration,
  getNewsTopicMatchMatrix,
  getNewsTopicPulse,
  getNextNewsHomeCursor,
  getPreviewNewsArticleData,
  getPreviewNewsHomeItems,
  isNewsHomePreviewEdition,
  mergeNewsHomeItems,
  mergeNewsHomePositiveFeedbackItems,
  mergeNewsReaderMemoryItems,
  selectFeedFatigueBalancedNewsHomeItems,
  selectHydratedNewsPreferenceProfile,
  selectInitialNewsHomeItems,
  selectNegativeFeedbackAdjustedNewsHomeItems,
  selectNewsFeedModeItems,
  selectNewsHomeExposureRecords,
  selectNewsHomeItems,
  selectNewsHomePositiveFeedbackAnchors,
  selectReaderFreshNewsHomeItems,
  selectRelatedNewsHomeItems,
  selectSessionIntentNewsHomeItems,
  selectSourceCorroboratedNewsHomeItems,
  selectStoredNewsReaderMemoryItems,
  selectVisibleNewsHomeItems,
  shouldAutoLoadMoreNewsHomeItems,
  shouldFetchServerRecommendations,
  shouldTrainNewsHomeProfileFromAction,
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

const newsHomeItemWithOriginalUrl = {
  ...localItem,
  originalUrl: "https://example.com/local?utm=feed",
} satisfies NewsHomeItem;

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

describe("NewsHomeItem", () => {
  it("models original URLs for local duplicate suppression", () => {
    expect(newsHomeItemWithOriginalUrl.originalUrl).toBe(
      "https://example.com/local?utm=feed",
    );
  });
});

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

describe("preview news fallback", () => {
  it("returns a complete AI news preview edition when live crawl data is unavailable", () => {
    const previewItems = getPreviewNewsHomeItems();

    expect(previewItems).toHaveLength(12);
    expect(new Set(previewItems.map((item) => item.sourceSlug)).size).toBe(12);
    expect(new Set(previewItems.map((item) => item.category))).toEqual(
      new Set([
        "agent_product",
        "funding",
        "market_map",
        "model_release",
        "open_source",
        "policy",
        "product_hunt",
        "research",
        "security",
        "yc_ai",
      ]),
    );
    expect(
      previewItems.every((item) =>
        item.imageUrl?.startsWith("https://picsum.photos/seed/new-ai-times-"),
      ),
    ).toBe(true);

    const previewArticle = getPreviewNewsArticleData("preview-agent-browsers");

    expect(previewArticle.article).toMatchObject({
      imageUrl:
        "https://picsum.photos/seed/new-ai-times-agent-browsers/1200/820",
      id: "preview-agent-browsers",
      sourceName: "Agent Product Desk",
      title: "Agent browsers move from demos into daily software workflows",
    });
    expect(previewArticle.article?.bodyText).toContain(
      "This sample story keeps the empty-database edition readable while live crawl data warms up.",
    );
    expect(previewArticle.related).toHaveLength(11);
  });

  it("returns an empty article fallback for unknown preview ids", () => {
    expect(getPreviewNewsArticleData("missing-story")).toEqual({
      article: null,
      related: [],
    });
  });
});

describe("getNewsHomeStoryActionPanel", () => {
  it("keeps preview stories locally trainable without server persistence", () => {
    expect(
      getNewsHomeStoryActionPanel({
        hasSourceUrl: false,
        isPreview: true,
      }),
    ).toEqual({
      actions: [
        { action: "view", label: "Read", type: "read" },
        { action: "save", label: "Save", type: "button" },
        { action: "share", label: "Share", type: "button" },
        { action: "hide", label: "Less", type: "button" },
      ],
      canPersistToServer: false,
      helperText:
        "Preview actions train this device only. Live stories will sync once production news IDs are available.",
    });
  });

  it("adds source clicks to live stories with canonical URLs", () => {
    expect(
      getNewsHomeStoryActionPanel({
        hasSourceUrl: true,
        isPreview: false,
      }).actions,
    ).toEqual([
      { action: "view", label: "Read", type: "read" },
      { action: "save", label: "Save", type: "button" },
      { action: "share", label: "Share", type: "button" },
      { action: "hide", label: "Less", type: "button" },
      { action: "click_source", label: "Source", type: "source" },
    ]);
  });
});

describe("isNewsHomePreviewEdition", () => {
  it("detects the server-rendered preview edition when live data is unavailable", () => {
    expect(
      isNewsHomePreviewEdition({
        hasExploreFilters: false,
        initialItems: getPreviewNewsHomeItems(),
        serverRecommendedItems: [],
        status: "unavailable",
      }),
    ).toBe(true);
  });

  it("keeps live editions out of preview mode", () => {
    expect(
      isNewsHomePreviewEdition({
        hasExploreFilters: false,
        initialItems: [localItem],
        serverRecommendedItems: [],
        status: "ready",
      }),
    ).toBe(false);
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

describe("selectInitialNewsHomeItems", () => {
  it("deduplicates server-rendered homepage URL variants before limiting", () => {
    expect(
      selectInitialNewsHomeItems({
        items: [
          {
            ...localItem,
            canonicalUrl: "https://mirror.example/openai-model",
            id: "syndicated-openai-model",
            originalUrl: "https://example.com/openai-model?utm=home",
            sourceScore: 84,
            trendScore: 96,
          },
          {
            ...serverItem,
            canonicalUrl: "https://example.com/openai-model",
            id: "official-openai-model",
            originalUrl: "https://example.com/openai-model",
            sourceScore: 96,
            trendScore: 88,
          },
          {
            ...olderItem,
            canonicalUrl: "https://example.com/fresh-home-story",
            id: "fresh-home-story",
            originalUrl: "https://example.com/fresh-home-story",
          },
        ],
        limit: 2,
      }).map((item) => item.id),
    ).toEqual(["official-openai-model", "fresh-home-story"]);
  });
});

describe("getNewsSourceFilterOptions", () => {
  it("uses readable source names while preserving source slugs for filtering", () => {
    expect(
      getNewsSourceFilterOptions({
        items: [
          {
            ...localItem,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
          },
          {
            ...serverItem,
            sourceName: "OpenAI Blog Mirror",
            sourceSlug: "openai-news",
          },
          {
            ...olderItem,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
        ],
        limit: 8,
      }),
    ).toEqual([
      { label: "OpenAI News", slug: "openai-news" },
      { label: "VentureWire", slug: "venturewire" },
    ]);
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
        readerLocalHour: 21,
        sourceSlug: "openai-news",
        visitorKey: "visitor-123",
      }),
    ).toEqual({
      category: "model_release",
      cursor: "2026-06-30T08:00:00.000Z",
      limit: 20,
      q: "agents",
      readerLocalHour: 21,
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
        readerLocalHour: null,
        sourceSlug: null,
        visitorKey: null,
      }),
    ).toEqual({ limit: 30 });
  });
});

describe("buildNewsHomeInteractionMetadata", () => {
  it("keeps home ranking context with reader feedback", () => {
    expect(
      buildNewsHomeInteractionMetadata({
        feedMode: "for_you",
        item: {
          ...localItem,
          matchedSignals: ["category", "semantic_feedback", "category"],
          personalizedScore: 147,
        },
        rankSlot: 2,
      }),
    ).toEqual({
      feedMode: "for_you",
      matchedSignals: ["category", "semantic_feedback"],
      personalizedScore: 147,
      rankSlot: 2,
      surface: "home",
    });
  });
});

describe("buildNewsHomeReaderInteraction", () => {
  it("keeps rank slot context for local profile training", () => {
    expect(
      buildNewsHomeReaderInteraction({
        action: "save",
        rankSlot: 7.8,
      }),
    ).toEqual({
      action: "save",
      rankSlot: 7,
    });
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
      angles: [],
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
      angles: [],
      detail: "Read, save, or hide stories to train your edition.",
      entities: [],
      signalCount: 0,
      sources: [],
      strength: "Exploring",
      topics: [],
    });
  });

  it("separates followed angles from named entities", () => {
    expect(
      getNewsReaderSignalSummary({
        preferredCategories: ["security"],
        preferredSources: [],
        preferredEntities: [
          "OpenAI",
          "prompt_injection",
          "red_team",
          "OpenAI",
          "benchmarks",
        ],
        noveltyBias: 1,
        recencyBias: 1,
      }),
    ).toEqual({
      angles: ["prompt injection", "red team", "benchmarks"],
      detail: "5 reader signals are shaping story order.",
      entities: ["OpenAI"],
      signalCount: 5,
      sources: [],
      strength: "Learning",
      topics: ["security"],
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

  it("explains followed angle signals separately from entities", () => {
    expect(
      getNewsReaderRankingFactors({
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [
          "OpenAI",
          "prompt_injection",
          "red_team",
          "benchmarks",
        ],
        noveltyBias: 1,
        recencyBias: 1,
      }),
    ).toEqual([
      {
        label: "Entities",
        detail: "1 entity signal lifts related coverage.",
      },
      {
        label: "Angles",
        detail: "3 angle signals lift stories with matching angles.",
      },
      {
        label: "Bias",
        detail: "Freshness and novelty are balanced.",
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

describe("getNewsReaderDigest", () => {
  it("summarizes the personalized ranked feed for the reader", () => {
    expect(
      getNewsReaderDigest({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category === "funding"
                ? "Funding"
                : category,
        items: [
          {
            ...localItem,
            id: "reader-lead",
            category: "model_release",
            entities: ["OpenAI", "GPT-6"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 168,
            sourceName: "Model Desk",
            sourceScore: 94,
            sourceSlug: "model-desk",
            title: "OpenAI model launch matches your profile",
            trendScore: 88,
          },
          {
            ...serverItem,
            id: "reader-explore",
            category: "agent_product",
            entities: ["Agents"],
            matchedSignals: ["exploration"],
            personalizedScore: 124,
            sourceName: "Agent Scout",
            sourceScore: 82,
            sourceSlug: "agent-scout",
            title: "Agent startup tests a workflow memory layer",
            trendScore: 84,
          },
          {
            ...olderItem,
            id: "reader-market",
            category: "funding",
            entities: ["Series A", "OpenAI"],
            matchedSignals: [],
            personalizedScore: 116,
            sourceName: "VentureWire",
            sourceScore: 79,
            sourceSlug: "venturewire",
            title: "Funding heat follows model tooling",
            trendScore: 95,
          },
        ],
        profile: {
          preferredCategories: ["model_release"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["model-desk"],
          noveltyBias: 1.5,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      headline: "OpenAI model launch matches your profile",
      label: "Digest Ready",
      metrics: [
        { label: "Stories", value: "3" },
        { label: "Reader matches", value: "1" },
        { label: "Explore", value: "1" },
        { label: "Signals", value: "3" },
      ],
      nextReads: [
        {
          categoryLabel: "Agents",
          id: "reader-explore",
          reason: "Exploration story tests Agents outside your profile.",
          scoreLabel: "124 score",
          sourceName: "Agent Scout",
          title: "Agent startup tests a workflow memory layer",
        },
        {
          categoryLabel: "Funding",
          id: "reader-market",
          reason: "Trend-led story adds market heat without a profile match.",
          scoreLabel: "95 heat",
          sourceName: "VentureWire",
          title: "Funding heat follows model tooling",
        },
      ],
      notices: [
        {
          detail:
            "Models and OpenAI are driving the lead recommendation from Model Desk.",
          label: "Why this leads",
        },
        {
          detail:
            "Novelty bias is higher than recency, so the digest keeps exploration visible.",
          label: "Bias posture",
        },
      ],
      summary:
        "3 ranked stories produce 1 reader-matched lead, 1 exploration option, and 1 trend-led fallback.",
    });
  });

  it("keeps a counterpoint next read when one lead entity would dominate the digest", () => {
    const digest = getNewsReaderDigest({
      formatCategory: (category) =>
        category === "model_release"
          ? "Models"
          : category === "research"
            ? "Research"
            : category,
      items: [
        {
          ...localItem,
          id: "digest-lead",
          category: "model_release",
          entities: ["OpenAI", "GPT-6"],
          matchedSignals: ["category", "entity"],
          personalizedScore: 170,
          sourceName: "Model Desk",
          sourceSlug: "model-desk",
          title: "OpenAI model launch leads the digest",
          trendScore: 92,
        },
        {
          ...serverItem,
          id: "digest-openai-follow",
          category: "model_release",
          entities: ["OpenAI", "GPT-6"],
          matchedSignals: ["category", "entity"],
          personalizedScore: 164,
          sourceName: "Model Desk",
          sourceSlug: "model-desk",
          title: "OpenAI follow-up keeps the same thread hot",
          trendScore: 90,
        },
        {
          ...olderItem,
          id: "digest-anthropic-counterpoint",
          category: "research",
          entities: ["Anthropic", "Claude"],
          matchedSignals: ["category"],
          personalizedScore: 142,
          sourceName: "Research Wire",
          sourceSlug: "research-wire",
          title: "Anthropic research gives the digest a counterpoint",
          trendScore: 82,
        },
      ],
      profile: {
        preferredCategories: ["model_release", "research"],
        preferredEntities: ["OpenAI"],
        preferredSources: ["model-desk"],
        noveltyBias: 1,
        recencyBias: 1,
      },
    });

    expect(digest.nextReads.map((item) => item.id)).toEqual([
      "digest-anthropic-counterpoint",
      "digest-openai-follow",
    ]);
  });

  it("keeps the reader digest stable before ranked stories arrive", () => {
    expect(
      getNewsReaderDigest({
        formatCategory: (category) => category,
        items: [],
        profile: localProfile,
      }),
    ).toEqual({
      headline: "Your AI briefing is learning",
      label: "Digest Waiting",
      metrics: [
        { label: "Stories", value: "0" },
        { label: "Reader matches", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Signals", value: "3" },
      ],
      nextReads: [],
      notices: [
        {
          detail: "Ranked stories will turn your topics into a digest.",
          label: "Waiting for feed",
        },
      ],
      summary: "Reader digest will appear after stories are ranked.",
    });
  });
});

describe("getNewsReaderDaypartPlan", () => {
  it("plans the midday recommendation lanes from ranked AI stories", () => {
    expect(
      getNewsReaderDaypartPlan({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "research"
              ? "Research"
              : category === "agent_product"
                ? "Agents"
                : category === "funding"
                  ? "Funding"
                  : category,
        generatedAt: "2026-07-01T13:15:00.000Z",
        items: [
          {
            ...localItem,
            id: "daypart-lead",
            category: "model_release",
            entities: ["OpenAI", "GPT-6"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 170,
            sourceName: "Model Desk",
            sourceScore: 94,
            sourceSlug: "model-desk",
            title: "OpenAI model launch leads the midday brief",
            trendScore: 88,
          },
          {
            ...serverItem,
            id: "daypart-pulse",
            category: "research",
            entities: ["Benchmarks"],
            matchedSignals: [],
            personalizedScore: 122,
            sourceName: "Research Wire",
            sourceScore: 90,
            sourceSlug: "research-wire",
            title: "Benchmark story accelerates during the workday",
            trendScore: 96,
          },
          {
            ...olderItem,
            id: "daypart-explore",
            category: "agent_product",
            entities: ["Agents"],
            matchedSignals: ["exploration"],
            personalizedScore: 118,
            sourceName: "Agent Scout",
            sourceScore: 82,
            sourceSlug: "agent-scout",
            title: "Agent workflow startup tests a memory layer",
            trendScore: 84,
          },
          {
            ...olderItem,
            id: "daypart-context",
            category: "funding",
            entities: ["OpenAI", "Series A"],
            matchedSignals: ["entity"],
            personalizedScore: 114,
            sourceName: "VentureWire",
            sourceScore: 76,
            sourceSlug: "venturewire",
            title: "Funding context follows model tooling",
            trendScore: 78,
          },
        ],
        profile: {
          preferredCategories: ["model_release"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["model-desk"],
          noveltyBias: 1.25,
          recencyBias: 1.5,
        },
      }),
    ).toEqual({
      cadenceLabel: "Refresh every 15 min",
      intent: "Catch fast-moving AI updates without burying reader context.",
      label: "Midday Scan",
      lanes: [
        {
          categoryLabel: "Models",
          id: "daypart-lead",
          key: "lead",
          label: "Reader Lead",
          reason:
            "Highest personalized score keeps the active AI brief anchored.",
          scoreLabel: "170 score",
          sourceName: "Model Desk",
          title: "OpenAI model launch leads the midday brief",
        },
        {
          categoryLabel: "Research",
          id: "daypart-pulse",
          key: "pulse",
          label: "Live Pulse",
          reason:
            "Midday scan promotes the highest-heat update for faster refresh.",
          scoreLabel: "96 heat",
          sourceName: "Research Wire",
          title: "Benchmark story accelerates during the workday",
        },
        {
          categoryLabel: "Agents",
          id: "daypart-explore",
          key: "explore",
          label: "Explore",
          reason:
            "Exploration tests Agents outside the active profile while the feed is moving.",
          scoreLabel: "118 score",
          sourceName: "Agent Scout",
          title: "Agent workflow startup tests a memory layer",
        },
      ],
      metrics: [
        { label: "Stories", value: "4" },
        { label: "Lanes", value: "3" },
        { label: "Heat", value: "96" },
        { label: "Signals", value: "3" },
      ],
      summary:
        "Midday Scan uses 3 lanes across 4 ranked stories with a 15 min refresh cadence.",
    });
  });

  it("keeps the daypart plan stable before ranked stories arrive", () => {
    expect(
      getNewsReaderDaypartPlan({
        formatCategory: (category) => category,
        generatedAt: "2026-07-01T02:00:00.000Z",
        items: [],
        profile: localProfile,
      }),
    ).toEqual({
      cadenceLabel: "Refresh pauses until stories rank",
      intent: "Daypart planning will start after the feed has ranked stories.",
      label: "Daypart Waiting",
      lanes: [],
      metrics: [
        { label: "Stories", value: "0" },
        { label: "Lanes", value: "0" },
        { label: "Heat", value: "0" },
        { label: "Signals", value: "3" },
      ],
      summary: "Reader daypart plan will appear after stories are ranked.",
    });
  });
});

describe("getNewsReaderScorecards", () => {
  it("explains the recommendation score contributions for ranked stories", () => {
    expect(
      getNewsReaderScorecards({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category,
        items: [
          {
            ...localItem,
            id: "scorecard-lead",
            category: "model_release",
            entities: ["OpenAI", "GPT-6"],
            matchedSignals: ["category", "source", "entity"],
            personalizedScore: 176,
            publishedAt: "2026-07-01T08:00:00.000Z",
            sourceName: "Model Desk",
            sourceScore: 94,
            sourceSlug: "model-desk",
            tags: ["model", "launch", "eval"],
            title: "OpenAI model release explains the reader score",
            trendScore: 88,
          },
          {
            ...serverItem,
            id: "scorecard-explore",
            category: "agent_product",
            entities: ["Agents"],
            matchedSignals: ["exploration"],
            personalizedScore: 111,
            publishedAt: "2026-06-29T10:00:00.000Z",
            sourceName: "Agent Scout",
            sourceScore: 54,
            sourceSlug: "agent-scout",
            tags: ["agents"],
            title: "Agent workflow story tests exploration",
            trendScore: 79,
          },
        ],
        limit: 2,
        now: new Date("2026-07-01T10:00:00.000Z"),
        profile: {
          preferredCategories: ["model_release"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["model-desk"],
          noveltyBias: 1.25,
          recencyBias: 1.5,
        },
      }),
    ).toEqual({
      label: "Scorecards Ready",
      metrics: [
        { label: "Stories", value: "2" },
        { label: "Reader signals", value: "1" },
        { label: "Explore", value: "1" },
        { label: "Penalties", value: "1" },
      ],
      scorecards: [
        {
          categoryLabel: "Models",
          components: [
            {
              detail: "Story heat contributes the base ranking signal.",
              label: "Trend heat",
              tone: "base",
              valueLabel: "+88",
            },
            {
              detail: "Matches Models.",
              label: "Topic",
              tone: "boost",
              valueLabel: "+28",
            },
            {
              detail: "Matches Model Desk.",
              label: "Source",
              tone: "boost",
              valueLabel: "+16",
            },
            {
              detail: "Matches OpenAI.",
              label: "Entity",
              tone: "boost",
              valueLabel: "+18",
            },
            {
              detail: "Published 2h ago.",
              label: "Freshness",
              tone: "boost",
              valueLabel: "+23",
            },
            {
              detail: "3 tags add novelty lift.",
              label: "Novelty",
              tone: "boost",
              valueLabel: "+8",
            },
          ],
          id: "scorecard-lead",
          scoreLabel: "176 score",
          sourceName: "Model Desk",
          summary:
            "Reader score combines 3 reader signals, heat, freshness, novelty, and source trust.",
          title: "OpenAI model release explains the reader score",
        },
        {
          categoryLabel: "Agents",
          components: [
            {
              detail: "Story heat contributes the base ranking signal.",
              label: "Trend heat",
              tone: "base",
              valueLabel: "+79",
            },
            {
              detail: "Inserted to test a story outside the active profile.",
              label: "Exploration",
              tone: "boost",
              valueLabel: "slot",
            },
            {
              detail: "Published 48h ago.",
              label: "Freshness",
              tone: "boost",
              valueLabel: "0",
            },
            {
              detail: "1 tag adds novelty lift.",
              label: "Novelty",
              tone: "boost",
              valueLabel: "+3",
            },
            {
              detail: "Agent Scout carries 54 source trust.",
              label: "Source trust",
              tone: "boost",
              valueLabel: "+5",
            },
            {
              detail: "Source score below 60 reduces confidence.",
              label: "Trust penalty",
              tone: "penalty",
              valueLabel: "-2",
            },
          ],
          id: "scorecard-explore",
          scoreLabel: "111 score",
          sourceName: "Agent Scout",
          summary:
            "Reader score uses exploration, heat, freshness, novelty, and source trust.",
          title: "Agent workflow story tests exploration",
        },
      ],
      summary:
        "2 scorecards explain 1 reader-signal story, 1 exploration story, and 1 penalty.",
    });
  });

  it("keeps scorecards empty before ranked stories arrive", () => {
    expect(
      getNewsReaderScorecards({
        formatCategory: (category) => category,
        items: [],
        limit: 2,
        now: new Date("2026-07-01T10:00:00.000Z"),
        profile: localProfile,
      }),
    ).toEqual({
      label: "Scorecards Waiting",
      metrics: [
        { label: "Stories", value: "0" },
        { label: "Reader signals", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Penalties", value: "0" },
      ],
      scorecards: [],
      summary: "Reader scorecards will appear after stories are ranked.",
    });
  });
});

describe("getNewsRecommendationRotationQueue", () => {
  it("interleaves reader, exploration, market, and trust slots with source diversity", () => {
    expect(
      getNewsRecommendationRotationQueue({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category === "funding"
                ? "Funding"
                : category === "research"
                  ? "Research"
                  : category,
        items: [
          {
            ...localItem,
            id: "reader-fit",
            category: "model_release",
            matchedSignals: ["category", "entity"],
            personalizedScore: 172,
            sourceName: "Model Desk",
            sourceScore: 84,
            sourceSlug: "model-desk",
            title: "OpenAI model launch matches your profile",
            trendScore: 84,
          },
          {
            ...localItem,
            id: "same-source-hot",
            category: "funding",
            matchedSignals: [],
            personalizedScore: 126,
            sourceName: "Model Desk",
            sourceScore: 82,
            sourceSlug: "model-desk",
            title: "Funding story from a repeated source",
            trendScore: 99,
          },
          {
            ...localItem,
            id: "explore-adjacent",
            category: "agent_product",
            matchedSignals: ["exploration"],
            personalizedScore: 132,
            sourceName: "Agent Scout",
            sourceScore: 78,
            sourceSlug: "agent-scout",
            title: "Agent startup tests workflow memory",
            trendScore: 88,
          },
          {
            ...localItem,
            id: "market-hot",
            category: "funding",
            matchedSignals: [],
            personalizedScore: 119,
            sourceName: "VentureWire",
            sourceScore: 76,
            sourceSlug: "venturewire",
            title: "Funding heat follows model tooling",
            trendScore: 96,
          },
          {
            ...localItem,
            id: "trusted-analysis",
            category: "research",
            matchedSignals: [],
            personalizedScore: 121,
            sourceName: "Research Review",
            sourceScore: 97,
            sourceSlug: "research-review",
            title: "Independent lab checks agent benchmarks",
            trendScore: 74,
          },
        ],
        limit: 4,
        profile: {
          preferredCategories: ["model_release"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["model-desk"],
          noveltyBias: 1.5,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      entries: [
        {
          categoryLabel: "Models",
          id: "reader-fit",
          label: "Reader Match",
          reason: "Profile signals make this the safest next story.",
          scoreLabel: "172 score",
          sourceName: "Model Desk",
          title: "OpenAI model launch matches your profile",
        },
        {
          categoryLabel: "Agents",
          id: "explore-adjacent",
          label: "Exploration",
          reason: "Adjacent coverage tests what the reader may want next.",
          scoreLabel: "88 heat",
          sourceName: "Agent Scout",
          title: "Agent startup tests workflow memory",
        },
        {
          categoryLabel: "Funding",
          id: "market-hot",
          label: "Market Heat",
          reason: "High trend keeps the edition connected to the live market.",
          scoreLabel: "96 heat",
          sourceName: "VentureWire",
          title: "Funding heat follows model tooling",
        },
        {
          categoryLabel: "Research",
          id: "trusted-analysis",
          label: "Source Trust",
          reason: "High-trust coverage stabilizes the recommendation mix.",
          scoreLabel: "97 trust",
          sourceName: "Research Review",
          title: "Independent lab checks agent benchmarks",
        },
      ],
      label: "Rotation Ready",
      metrics: [
        { label: "Slots", value: "4" },
        { label: "Reader", value: "1" },
        { label: "Explore", value: "1" },
        { label: "Sources", value: "4" },
      ],
      summary:
        "4 rotation slots blend reader fit, exploration, market heat, and source trust across 4 sources.",
    });
  });

  it("keeps the queue explicit while ranked stories are unavailable", () => {
    expect(
      getNewsRecommendationRotationQueue({
        formatCategory: (category) => category,
        items: [],
        limit: 4,
        profile: createDefaultNewsPreferenceProfile(),
      }),
    ).toEqual({
      entries: [],
      label: "Rotation Waiting",
      metrics: [
        { label: "Slots", value: "0" },
        { label: "Reader", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Sources", value: "0" },
      ],
      summary: "Recommendation rotation will appear after stories are ranked.",
    });
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

  it("summarizes saved and read angle memory from story tags", () => {
    expect(
      getNewsReaderMemory({
        formatCategory: () => "Security",
        historyItems: [
          {
            ...localItem,
            id: "read-prompt-injection",
            category: "security",
            entities: ["Red Team Lab"],
            sourceName: "Security Lab",
            sourceSlug: "security-lab",
            tags: ["prompt-injection"],
          },
        ],
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
        savedItems: [
          {
            ...localItem,
            id: "saved-prompt-injection",
            category: "security",
            entities: ["Red Team Lab"],
            sourceName: "Security Lab",
            sourceSlug: "security-lab",
            tags: ["agents", "prompt_injection"],
          },
        ],
      }).highlights,
    ).toContainEqual({
      detail: "prompt injection leads with 2 saved/read stories.",
      label: "Angle memory",
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

describe("mergeNewsReaderMemoryItems", () => {
  it("merges local article reads ahead of server history and removes duplicate ids", () => {
    expect(
      mergeNewsReaderMemoryItems({
        limit: 3,
        localItems: [
          {
            ...localItem,
            id: "local-meaningful-read",
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            viewedAt: "2026-07-01T10:00:00.000Z",
          },
          {
            ...serverItem,
            viewedAt: "2026-07-01T09:30:00.000Z",
          },
        ],
        serverItems: [
          {
            ...serverItem,
            viewedAt: "2026-07-01T09:00:00.000Z",
          },
          {
            ...olderItem,
            viewedAt: "2026-07-01T08:00:00.000Z",
          },
          {
            ...localItem,
            id: "old-server-read",
            viewedAt: "2026-07-01T07:00:00.000Z",
          },
        ],
      }).map((item) => ({
        id: item.id,
        viewedAt: item.viewedAt,
      })),
    ).toEqual([
      {
        id: "local-meaningful-read",
        viewedAt: "2026-07-01T10:00:00.000Z",
      },
      {
        id: "server-story",
        viewedAt: "2026-07-01T09:30:00.000Z",
      },
      {
        id: "older-story",
        viewedAt: "2026-07-01T08:00:00.000Z",
      },
    ]);
  });

  it("merges local saved stories ahead of server saved stories", () => {
    expect(
      mergeNewsReaderMemoryItems({
        limit: 2,
        localItems: [
          {
            ...localItem,
            id: "local-save",
            savedAt: "2026-07-01T11:00:00.000Z",
          },
        ],
        serverItems: [
          {
            ...serverItem,
            savedAt: "2026-07-01T10:00:00.000Z",
          },
        ],
      }).map((item) => ({
        id: item.id,
        savedAt: item.savedAt,
      })),
    ).toEqual([
      {
        id: "local-save",
        savedAt: "2026-07-01T11:00:00.000Z",
      },
      {
        id: "server-story",
        savedAt: "2026-07-01T10:00:00.000Z",
      },
    ]);
  });
});

describe("selectStoredNewsReaderMemoryItems", () => {
  it("keeps only valid local reader-memory entries from storage", () => {
    expect(
      selectStoredNewsReaderMemoryItems([
        {
          category: "model_release",
          entities: ["OpenAI", 42, "Agents"],
          id: "local-meaningful-read",
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          title: "OpenAI releases a new agent stack",
          viewedAt: "2026-07-01T10:00:00.000Z",
        },
        {
          category: "new_concept",
          entities: ["Recommendation Engine"],
          hiddenAt: "2026-07-01T11:00:00.000Z",
          id: "local-guardrail",
          sourceName: "Recommendation Desk",
          sourceSlug: "recommendation-desk",
          title: "Too much recommendation coverage",
        },
        {
          category: "market_map",
          entities: ["Anthropic"],
          id: "local-save",
          savedAt: "2026-07-01T10:30:00.000Z",
          sourceName: "Source Desk",
          sourceSlug: "source-desk",
          title: "Source registry covers labs",
        },
        {
          category: "agent_product",
          entities: ["Agents"],
          id: "",
          sourceName: "Broken",
          sourceSlug: "broken",
          title: "Missing id",
          viewedAt: "2026-07-01T09:00:00.000Z",
        },
        null,
      ]),
    ).toEqual([
      {
        category: "model_release",
        entities: ["OpenAI", "Agents"],
        id: "local-meaningful-read",
        sourceName: "OpenAI News",
        sourceSlug: "openai-news",
        title: "OpenAI releases a new agent stack",
        viewedAt: "2026-07-01T10:00:00.000Z",
      },
      {
        category: "new_concept",
        entities: ["Recommendation Engine"],
        hiddenAt: "2026-07-01T11:00:00.000Z",
        id: "local-guardrail",
        sourceName: "Recommendation Desk",
        sourceSlug: "recommendation-desk",
        title: "Too much recommendation coverage",
      },
      {
        category: "market_map",
        entities: ["Anthropic"],
        id: "local-save",
        savedAt: "2026-07-01T10:30:00.000Z",
        sourceName: "Source Desk",
        sourceSlug: "source-desk",
        title: "Source registry covers labs",
      },
    ]);
  });
});

describe("getNewsGuardrailShelf", () => {
  it("summarizes recent Less feedback as a visible guardrail shelf", () => {
    expect(
      getNewsGuardrailShelf({
        formatCategory: (category) =>
          category === "hot_take" ? "Hot Takes" : "Funding",
        guardrailItems: [
          {
            ...localItem,
            category: "hot_take",
            hiddenAt: "2026-07-01T11:00:00.000Z",
            id: "hidden-hot-take",
            sourceName: "Rumor Feed",
            sourceSlug: "rumor-feed",
            tags: ["rumor", "opinion"],
            title: "Hidden rumor story",
          },
          {
            ...olderItem,
            category: "funding",
            hiddenAt: "2026-07-01T09:00:00.000Z",
            id: "hidden-funding",
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            tags: ["funding"],
            title: "Hidden funding story",
          },
        ],
        limit: 1,
      }),
    ).toEqual({
      items: [
        {
          categoryLabel: "Hot Takes",
          hiddenAt: "2026-07-01T11:00:00.000Z",
          id: "hidden-hot-take",
          sourceName: "Rumor Feed",
          title: "Hidden rumor story",
        },
      ],
      label: "2 active",
      metrics: [
        { label: "Guardrails", value: "2" },
        { label: "Top topic", value: "Hot Takes" },
        { label: "Top source", value: "Rumor Feed" },
      ],
      summary:
        "Less feedback is damping 2 recent stories, led by Hot Takes from Rumor Feed.",
    });
  });

  it("keeps the guardrail shelf explicit before Less feedback exists", () => {
    expect(
      getNewsGuardrailShelf({
        formatCategory: (category) => category,
        guardrailItems: [],
      }),
    ).toEqual({
      items: [],
      label: "0 active",
      metrics: [
        { label: "Guardrails", value: "0" },
        { label: "Top topic", value: "None" },
        { label: "Top source", value: "None" },
      ],
      summary:
        "Press Less on stories to hide them and dampen similar topics, sources, and entities.",
    });
  });
});

describe("getNewsReaderJourneyMap", () => {
  it("connects profile, impression, memory, saved, and guardrail steps", () => {
    expect(
      getNewsReaderJourneyMap({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category === "funding"
                ? "Funding"
                : category,
        historyItems: [
          {
            ...localItem,
            id: "read-agent",
            category: "agent_product",
            entities: ["Agents"],
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Agent workflow memory gets read",
          },
        ],
        items: [
          {
            ...localItem,
            id: "journey-lead",
            entities: ["OpenAI", "Agents"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 168,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            title: "OpenAI ships an urgent agent runtime",
            trendScore: 96,
          },
        ],
        limit: 5,
        negativeFeedbackItems: [
          {
            ...localItem,
            id: "less-funding",
            category: "funding",
            entities: ["YC"],
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Funding rumor receives less feedback",
          },
        ],
        profile: localProfile,
        savedItems: [
          {
            ...localItem,
            id: "saved-model",
            entities: ["OpenAI", "GPT-6"],
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            title: "Saved model analysis",
          },
        ],
      }),
    ).toEqual({
      label: "Journey Active",
      metrics: [
        { label: "Steps", value: "5" },
        { label: "Profile", value: "3 signals" },
        { label: "Memory", value: "2" },
        { label: "Guardrails", value: "1" },
      ],
      steps: [
        {
          detail: "3 active signals shape the starting edition.",
          key: "profile",
          label: "Profile seed",
          signalLabel: "Models / OpenAI / local-source",
          statusLabel: "Active",
          title: "Reader profile",
        },
        {
          detail: "Top ranked story opens the session with 2 reader signals.",
          id: "journey-lead",
          key: "impression",
          label: "First impression",
          signalLabel: "168 score / 96 heat",
          sourceName: "OpenAI News",
          statusLabel: "For You",
          title: "OpenAI ships an urgent agent runtime",
        },
        {
          detail:
            "Agents read history keeps this topic eligible for follow-up.",
          id: "read-agent",
          key: "read",
          label: "Read memory",
          signalLabel: "Agents",
          sourceName: "Agent Desk",
          statusLabel: "Learned",
          title: "Agent workflow memory gets read",
        },
        {
          detail: "Saved Models coverage becomes durable memory.",
          id: "saved-model",
          key: "save",
          label: "Saved signal",
          signalLabel: "Models",
          sourceName: "OpenAI News",
          statusLabel: "Pinned",
          title: "Saved model analysis",
        },
        {
          detail: "Funding feedback dampens matching future stories.",
          id: "less-funding",
          key: "guardrail",
          label: "Less feedback",
          signalLabel: "Funding",
          sourceName: "VentureWire",
          statusLabel: "Guarded",
          title: "Funding rumor receives less feedback",
        },
      ],
      summary:
        "5 journey steps connect 1 ranked story, 1 read, 1 save, and 1 guardrail.",
    });
  });

  it("keeps the reader journey empty before signals arrive", () => {
    expect(
      getNewsReaderJourneyMap({
        formatCategory: (category) => category,
        historyItems: [],
        items: [],
        limit: 5,
        negativeFeedbackItems: [],
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
      label: "Journey Waiting",
      metrics: [
        { label: "Steps", value: "0" },
        { label: "Profile", value: "0 signals" },
        { label: "Memory", value: "0" },
        { label: "Guardrails", value: "0" },
      ],
      steps: [],
      summary: "Reader journey will appear after profile or behavior signals.",
    });
  });
});

describe("getNewsReaderWatchlist", () => {
  it("builds active and suggested watchlist signals from the ranked edition", () => {
    expect(
      getNewsReaderWatchlist({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category === "funding"
                ? "Funding"
                : category,
        items: [
          {
            ...localItem,
            id: "watch-openai-lead",
            category: "model_release",
            entities: ["OpenAI", "GPT-6"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 150,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            title: "OpenAI GPT-6 rollout leads the watchlist",
            trendScore: 88,
          },
          {
            ...serverItem,
            id: "watch-openai-follow",
            category: "model_release",
            entities: ["OpenAI", "GPT-6"],
            matchedSignals: ["entity"],
            personalizedScore: 132,
            sourceName: "Research Wire",
            sourceSlug: "research-wire",
            title: "Researchers benchmark OpenAI GPT-6",
            trendScore: 84,
          },
          {
            ...olderItem,
            id: "watch-agent-suggested",
            category: "agent_product",
            entities: ["Agents", "Browser"],
            matchedSignals: ["exploration"],
            personalizedScore: 111,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Browser agent launch heats up",
            trendScore: 94,
          },
          {
            ...olderItem,
            id: "watch-funding-market",
            category: "funding",
            entities: ["Runway"],
            matchedSignals: [],
            personalizedScore: 104,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Runway funding searches rise",
            trendScore: 82,
          },
        ],
        limit: 4,
        profile: {
          preferredCategories: ["model_release"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["openai-news"],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      entries: [
        {
          key: "entity:openai",
          kind: "Entity",
          reason: "Already in your profile and active in the edition.",
          score: 172,
          signal: "OpenAI",
          sourceNames: ["OpenAI News", "Research Wire"],
          statusLabel: "Watching",
          supportLabel: "2 stories / 2 sources",
          topStory: {
            id: "watch-openai-lead",
            sourceName: "OpenAI News",
            title: "OpenAI GPT-6 rollout leads the watchlist",
          },
        },
        {
          key: "topic:model_release",
          kind: "Topic",
          reason: "Already in your profile and active in the edition.",
          score: 172,
          signal: "Models",
          sourceNames: ["OpenAI News", "Research Wire"],
          statusLabel: "Watching",
          supportLabel: "2 stories / 2 sources",
          topStory: {
            id: "watch-openai-lead",
            sourceName: "OpenAI News",
            title: "OpenAI GPT-6 rollout leads the watchlist",
          },
        },
        {
          key: "source:openai-news",
          kind: "Source",
          reason: "Already in your profile and active in the edition.",
          score: 146,
          signal: "OpenAI News",
          sourceNames: ["OpenAI News"],
          statusLabel: "Watching",
          supportLabel: "1 story / 1 source",
          topStory: {
            id: "watch-openai-lead",
            sourceName: "OpenAI News",
            title: "OpenAI GPT-6 rollout leads the watchlist",
          },
        },
        {
          key: "topic:agent_product",
          kind: "Topic",
          reason: "High heat suggests adding this signal to the watchlist.",
          score: 132,
          signal: "Agents",
          sourceNames: ["Agent Desk"],
          statusLabel: "Suggested",
          supportLabel: "1 story / 1 source",
          topStory: {
            id: "watch-agent-suggested",
            sourceName: "Agent Desk",
            title: "Browser agent launch heats up",
          },
        },
      ],
      label: "Watchlist Active",
      metrics: [
        { label: "Signals", value: "4" },
        { label: "Watching", value: "3" },
        { label: "Suggested", value: "1" },
        { label: "Coverage", value: "6" },
      ],
      summary:
        "4 watchlist signals track 6 story matches across 3 active and 1 suggested signal.",
    });
  });

  it("suggests an emerging entity when high-heat coverage appears across sources", () => {
    const watchlist = getNewsReaderWatchlist({
      formatCategory: (category) =>
        category === "research"
          ? "Research"
          : category === "funding"
            ? "Funding"
            : category,
      items: [
        {
          ...localItem,
          id: "watch-anthropic-lab",
          category: "research",
          entities: ["Anthropic"],
          matchedSignals: [],
          personalizedScore: 128,
          sourceName: "Lab Wire",
          sourceSlug: "lab-wire",
          title: "Anthropic research gains lab momentum",
          trendScore: 96,
        },
        {
          ...serverItem,
          id: "watch-anthropic-market",
          category: "funding",
          entities: ["Anthropic"],
          matchedSignals: [],
          personalizedScore: 126,
          sourceName: "Market Desk",
          sourceSlug: "market-desk",
          title: "Anthropic funding chatter spreads across investors",
          trendScore: 92,
        },
      ],
      limit: 2,
      profile: {
        preferredCategories: ["model_release"],
        preferredEntities: ["OpenAI"],
        preferredSources: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
    });

    expect(watchlist.entries[0]).toEqual({
      key: "entity:anthropic",
      kind: "Entity",
      reason: "High heat suggests adding this signal to the watchlist.",
      score: 160,
      signal: "Anthropic",
      sourceNames: ["Lab Wire", "Market Desk"],
      statusLabel: "Suggested",
      supportLabel: "2 stories / 2 sources",
      topStory: {
        id: "watch-anthropic-lab",
        sourceName: "Lab Wire",
        title: "Anthropic research gains lab momentum",
      },
    });
  });

  it("keeps watchlist empty before stories are ranked", () => {
    expect(
      getNewsReaderWatchlist({
        formatCategory: (category) => category,
        items: [],
        limit: 4,
        profile: createDefaultNewsPreferenceProfile(),
      }),
    ).toEqual({
      entries: [],
      label: "Watchlist Waiting",
      metrics: [
        { label: "Signals", value: "0" },
        { label: "Watching", value: "0" },
        { label: "Suggested", value: "0" },
        { label: "Coverage", value: "0" },
      ],
      summary: "Reader watchlist will appear after stories are ranked.",
    });
  });
});

describe("getNewsReaderCohorts", () => {
  it("classifies explicit and behavioral signals into reader cohorts", () => {
    expect(
      getNewsReaderCohorts({
        formatCategory: (category) =>
          category === "agent_product"
            ? "Agents"
            : category === "open_source"
              ? "Open Source"
              : category === "funding"
                ? "Funding"
                : category === "hot_take"
                  ? "Hot Takes"
                  : "Models",
        historyItems: [
          {
            ...localItem,
            id: "read-agent",
            category: "agent_product",
            entities: ["Agents", "OpenAI"],
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
          },
          {
            ...localItem,
            id: "read-funding",
            category: "funding",
            entities: ["Series A", "YC"],
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
        ],
        limit: 3,
        negativeFeedbackItems: [
          {
            ...olderItem,
            id: "hidden-hot-take",
            category: "hot_take",
            entities: ["Rumor"],
            sourceName: "Rumor Feed",
            sourceSlug: "rumor-feed",
          },
        ],
        profile: {
          preferredCategories: ["agent_product", "open_source", "funding"],
          preferredSources: ["agent-desk"],
          preferredEntities: ["Agents", "LangChain"],
          noveltyBias: 1.3,
          recencyBias: 1,
        },
        savedItems: [
          {
            ...localItem,
            id: "saved-agent",
            category: "agent_product",
            entities: ["Agents", "LangChain"],
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
          },
          {
            ...localItem,
            id: "saved-oss",
            category: "open_source",
            entities: ["LangChain"],
            sourceName: "OSS Desk",
            sourceSlug: "oss-desk",
          },
        ],
      }),
    ).toEqual({
      cohorts: [
        {
          confidenceLabel: "10 signals",
          detail:
            "Agent products, open-source tools, and builder platforms are leading the profile.",
          evidence: ["Agents", "Open Source", "LangChain"],
          guardrailCount: 0,
          label: "Builder Watch",
          nextAction:
            "Keep builder coverage high and test one adjacent lab story.",
          score: 10,
        },
        {
          confidenceLabel: "2 signals",
          detail:
            "Funding, startup, and market-map signals point to dealflow coverage.",
          evidence: ["Funding", "VentureWire"],
          guardrailCount: 0,
          label: "Market Scanner",
          nextAction:
            "Mix funding stories with product proof so the feed stays useful.",
          score: 2,
        },
        {
          confidenceLabel: "0 signals",
          detail:
            "Policy, security, and hot-take signals are being treated as risk coverage.",
          evidence: ["Hot Takes", "Rumor Feed"],
          guardrailCount: 1,
          label: "Risk Desk",
          nextAction:
            "Keep risk coverage present but avoid over-weighting noisy sources.",
          score: 0,
        },
      ],
      label: "3 Cohorts",
      metrics: [
        { label: "Top cohort", value: "Builder Watch" },
        { label: "Weighted signals", value: "12" },
        { label: "Guardrails", value: "1" },
        { label: "Bias", value: "Discovery" },
      ],
      summary:
        "Reader profile leans Builder Watch with 12 weighted signals across 2 active cohorts.",
    });
  });

  it("keeps cold-start cohorts explicit before preference and behavior signals exist", () => {
    expect(
      getNewsReaderCohorts({
        formatCategory: (category) => category,
        historyItems: [],
        limit: 3,
        negativeFeedbackItems: [],
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
      cohorts: [],
      label: "Cold Cohorts",
      metrics: [
        { label: "Top cohort", value: "None" },
        { label: "Weighted signals", value: "0" },
        { label: "Guardrails", value: "0" },
        { label: "Bias", value: "Balanced" },
      ],
      summary:
        "Reader cohorts will appear after preferences or behavior arrive.",
    });
  });
});

describe("getNewsCollaborativeSignals", () => {
  it("turns active reader cohorts into collaborative story lift signals", () => {
    expect(
      getNewsCollaborativeSignals({
        formatCategory: (category) =>
          category === "agent_product"
            ? "Agents"
            : category === "model_release"
              ? "Models"
              : category === "hot_take"
                ? "Hot Takes"
                : category,
        historyItems: [
          {
            ...localItem,
            id: "read-model",
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            title: "Read model analysis",
          },
        ],
        items: [
          {
            ...localItem,
            id: "openai-model",
            matchedSignals: ["category", "source", "entity"],
            personalizedScore: 152,
            sourceName: "OpenAI News",
            sourceScore: 94,
            sourceSlug: "openai-news",
            title: "OpenAI ships a new reasoning model",
            trendScore: 92,
          },
          {
            ...localItem,
            category: "agent_product",
            entities: ["Agents"],
            id: "agent-memory",
            matchedSignals: ["exploration"],
            personalizedScore: 126,
            sourceName: "Agent Desk",
            sourceScore: 82,
            sourceSlug: "agent-desk",
            title: "Agent teams test shared memory",
            trendScore: 88,
          },
          {
            ...localItem,
            category: "funding",
            entities: ["Series A"],
            id: "funding-brief",
            matchedSignals: [],
            personalizedScore: 101,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "AI startup raises a new round",
            trendScore: 81,
          },
        ],
        limit: 2,
        negativeFeedbackItems: [
          {
            ...olderItem,
            category: "hot_take",
            entities: ["Rumor"],
            id: "hidden-rumor",
            sourceName: "Rumor Feed",
            sourceSlug: "rumor-feed",
            title: "Hidden rumor story",
          },
        ],
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: ["openai-news"],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1.2,
          recencyBias: 1,
        },
        savedItems: [
          {
            ...localItem,
            category: "agent_product",
            entities: ["Agents"],
            id: "saved-agent",
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Saved agent workflow",
          },
        ],
      }),
    ).toEqual({
      label: "Cohort Lift",
      metrics: [
        { label: "Active cohorts", value: "2" },
        { label: "Candidate stories", value: "2" },
        { label: "Crowd heat", value: "2" },
        { label: "Guardrails", value: "1" },
      ],
      signals: [
        {
          action:
            "Pair frontier model updates with independent evaluation coverage.",
          detail: "Lab Watch can lift 1 ranked story from similar readers.",
          label: "Lab Watch",
          liftLabel: "High lift",
          stories: [
            {
              id: "openai-model",
              reason: "Cohort match on Models with 92 trend.",
              scoreLabel: "17 lift",
              sourceName: "OpenAI News",
              title: "OpenAI ships a new reasoning model",
            },
          ],
        },
        {
          action: "Keep builder coverage high and test one adjacent lab story.",
          detail: "Builder Watch can lift 1 ranked story from similar readers.",
          label: "Builder Watch",
          liftLabel: "Medium lift",
          stories: [
            {
              id: "agent-memory",
              reason: "Cohort match on Agents with 88 trend.",
              scoreLabel: "11 lift",
              sourceName: "Agent Desk",
              title: "Agent teams test shared memory",
            },
          ],
        },
      ],
      summary:
        "2 cohort signals can lift 2 stories; Lab Watch leads with 17 lift.",
    });
  });

  it("keeps collaborative signals cold before stories or cohorts exist", () => {
    expect(
      getNewsCollaborativeSignals({
        formatCategory: (category) => category,
        historyItems: [],
        items: [],
        limit: 2,
        negativeFeedbackItems: [],
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
      label: "Cold Signals",
      metrics: [
        { label: "Active cohorts", value: "0" },
        { label: "Candidate stories", value: "0" },
        { label: "Crowd heat", value: "0" },
        { label: "Guardrails", value: "0" },
      ],
      signals: [],
      summary:
        "Collaborative signals will appear after reader cohorts and ranked stories exist.",
    });
  });
});

describe("getNewsSessionIntent", () => {
  it("infers the current reading session from recent behavior and ranked candidates", () => {
    expect(
      getNewsSessionIntent({
        formatCategory: (category) =>
          category === "agent_product"
            ? "Agents"
            : category === "open_source"
              ? "Open Source"
              : category === "hot_take"
                ? "Hot Takes"
                : "Models",
        historyItems: [
          {
            ...localItem,
            id: "read-oss",
            category: "open_source",
            entities: ["LangChain"],
            sourceName: "OSS Desk",
            sourceSlug: "oss-desk",
            title: "Read open-source story",
          },
        ],
        items: [
          {
            ...localItem,
            id: "agent-candidate",
            category: "agent_product",
            entities: ["Agents"],
            matchedSignals: ["category"],
            personalizedScore: 150,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Agent workflow candidate",
            trendScore: 80,
          },
          {
            ...localItem,
            id: "oss-candidate",
            category: "open_source",
            entities: ["LangChain"],
            matchedSignals: ["entity"],
            personalizedScore: 132,
            sourceName: "OSS Desk",
            sourceSlug: "oss-desk",
            title: "Open-source candidate",
            trendScore: 72,
          },
          {
            ...localItem,
            id: "model-candidate",
            category: "model_release",
            entities: ["Anthropic"],
            matchedSignals: [],
            personalizedScore: 120,
            sourceName: "Model Wire",
            sourceSlug: "model-wire",
            title: "Model release candidate",
            trendScore: 92,
          },
        ],
        limit: 3,
        negativeFeedbackItems: [
          {
            ...olderItem,
            id: "hidden-rumor",
            category: "hot_take",
            entities: ["Rumor"],
            sourceName: "Rumor Feed",
            sourceSlug: "rumor-feed",
            title: "Hidden rumor story",
          },
        ],
        profile: {
          preferredCategories: ["agent_product", "open_source"],
          preferredSources: ["agent-desk"],
          preferredEntities: ["LangChain"],
          noveltyBias: 1.3,
          recencyBias: 1,
        },
        savedItems: [
          {
            ...localItem,
            id: "saved-agent",
            category: "agent_product",
            entities: ["Agents", "LangChain"],
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Saved agent workflow",
          },
        ],
      }),
    ).toEqual({
      intents: [
        {
          candidateCount: 2,
          evidence: ["Agents", "Open Source", "agent-desk", "LangChain"],
          guardrailCount: 0,
          label: "Builder Run",
          leadStory: {
            id: "agent-candidate",
            sourceName: "Agent Desk",
            title: "Agent workflow candidate",
          },
          nextAction:
            "Lead with practical builder stories and keep one lab follow-up nearby.",
          score: 11,
        },
        {
          candidateCount: 0,
          evidence: ["Hot Takes", "Rumor Feed"],
          guardrailCount: 1,
          label: "Risk Check",
          leadStory: null,
          nextAction:
            "Keep risk coverage visible without amplifying noisy sources.",
          score: 0,
        },
      ],
      label: "Builder Session",
      metrics: [
        { label: "Primary intent", value: "Builder Run" },
        { label: "Strength", value: "11" },
        { label: "Candidate stories", value: "2" },
        { label: "Guardrails", value: "1" },
      ],
      summary:
        "Session intent is Builder Run with 11 signals, 2 candidate stories, and 1 guardrail.",
    });
  });

  it("keeps a cold session visible before reader behavior exists", () => {
    expect(
      getNewsSessionIntent({
        formatCategory: (category) => category,
        historyItems: [],
        items: [],
        limit: 3,
        negativeFeedbackItems: [],
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
      intents: [],
      label: "Cold Session",
      metrics: [
        { label: "Primary intent", value: "None" },
        { label: "Strength", value: "0" },
        { label: "Candidate stories", value: "0" },
        { label: "Guardrails", value: "0" },
      ],
      summary:
        "Session intent will appear after preference or behavior signals arrive.",
    });
  });
});

describe("getNewsProfileSignalLedger", () => {
  it("explains the explicit, behavioral, guardrail, and bias signals behind personalization", () => {
    expect(
      getNewsProfileSignalLedger({
        formatCategory: (category) =>
          category === "agent_product"
            ? "Agents"
            : category === "open_source"
              ? "Open Source"
              : category === "funding"
                ? "Funding"
                : category === "hot_take"
                  ? "Hot Takes"
                  : "Models",
        historyItems: [
          {
            ...localItem,
            id: "read-agent",
            category: "agent_product",
            entities: ["Agents", "OpenAI"],
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Read agent workflow story",
          },
          {
            ...localItem,
            id: "read-funding",
            category: "funding",
            entities: ["Series A", "YC"],
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Read funding story",
          },
        ],
        negativeFeedbackItems: [
          {
            ...olderItem,
            id: "hidden-hot-take",
            category: "hot_take",
            entities: ["Rumor"],
            sourceName: "Rumor Feed",
            sourceSlug: "rumor-feed",
            title: "Hidden rumor story",
          },
        ],
        profile: {
          preferredCategories: ["agent_product", "open_source", "funding"],
          preferredSources: ["agent-desk"],
          preferredEntities: ["Agents", "LangChain"],
          noveltyBias: 1.3,
          recencyBias: 1,
        },
        savedItems: [
          {
            ...localItem,
            id: "saved-agent",
            category: "agent_product",
            entities: ["Agents", "LangChain"],
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Saved agent builder story",
          },
          {
            ...localItem,
            id: "saved-oss",
            category: "open_source",
            entities: ["LangChain"],
            sourceName: "OSS Desk",
            sourceSlug: "oss-desk",
            title: "Saved open-source story",
          },
        ],
      }),
    ).toEqual({
      entries: [
        {
          count: 6,
          detail: "3 topics, 1 source, and 2 entities are active.",
          effect: "Boosts matching stories",
          label: "Explicit profile",
          signals: ["Agents", "Open Source", "Funding", "agent-desk"],
          source: "Reader controls",
        },
        {
          count: 4,
          detail: "2 saved stories and 2 reads are feeding the profile.",
          effect: "Raises related coverage",
          label: "Positive behavior",
          signals: [
            "Saved agent builder story",
            "Saved open-source story",
            "Read agent workflow story",
            "Read funding story",
          ],
          source: "Reads and saves",
        },
        {
          count: 1,
          detail: "1 hidden story is acting as a guardrail.",
          effect: "Demotes similar coverage",
          label: "Negative feedback",
          signals: ["Hidden rumor story", "Hot Takes", "Rumor Feed"],
          source: "Less feedback",
        },
        {
          count: 2,
          detail: "Novelty is weighted above recency.",
          effect: "Tunes ranking balance",
          label: "Bias tuning",
          signals: ["Novelty 1.3", "Recency 1"],
          source: "Ranking sliders",
        },
      ],
      label: "Transparent Ledger",
      metrics: [
        { label: "Explicit", value: "6" },
        { label: "Positive behavior", value: "4" },
        { label: "Guardrails", value: "1" },
        { label: "Bias", value: "Discovery" },
      ],
      summary:
        "Profile ledger has 6 explicit signals, 4 positive behavior signals, and 1 guardrail.",
    });
  });

  it("keeps a cold ledger visible before profile signals exist", () => {
    expect(
      getNewsProfileSignalLedger({
        formatCategory: (category) => category,
        historyItems: [],
        negativeFeedbackItems: [],
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
      entries: [
        {
          count: 0,
          detail: "No explicit topics, sources, entities, or angles are active.",
          effect: "No direct boost yet",
          label: "Explicit profile",
          signals: [],
          source: "Reader controls",
        },
        {
          count: 0,
          detail: "No saves or reads have been recorded in this session.",
          effect: "No behavior lift yet",
          label: "Positive behavior",
          signals: [],
          source: "Reads and saves",
        },
        {
          count: 0,
          detail: "No Less feedback is currently guarding the feed.",
          effect: "No demotion guard yet",
          label: "Negative feedback",
          signals: [],
          source: "Less feedback",
        },
        {
          count: 2,
          detail: "Freshness and novelty are balanced.",
          effect: "Tunes ranking balance",
          label: "Bias tuning",
          signals: ["Novelty 1", "Recency 1"],
          source: "Ranking sliders",
        },
      ],
      label: "Cold Ledger",
      metrics: [
        { label: "Explicit", value: "0" },
        { label: "Positive behavior", value: "0" },
        { label: "Guardrails", value: "0" },
        { label: "Bias", value: "Balanced" },
      ],
      summary:
        "Profile ledger is waiting for explicit preferences or behavior signals.",
    });
  });

  it("separates explicit angle signals from entity signals", () => {
    expect(
      getNewsProfileSignalLedger({
        formatCategory: (category) =>
          category === "security" ? "Security" : category,
        historyItems: [],
        negativeFeedbackItems: [],
        profile: {
          preferredCategories: ["security"],
          preferredSources: ["security-desk"],
          preferredEntities: ["OpenAI", "prompt_injection", "red_team"],
          noveltyBias: 1,
          recencyBias: 1,
        },
        savedItems: [],
      }).entries[0],
    ).toEqual({
      count: 5,
      detail: "1 topic, 1 source, 1 entity, and 2 angles are active.",
      effect: "Boosts matching stories",
      label: "Explicit profile",
      signals: ["Security", "security-desk", "OpenAI", "prompt injection"],
      source: "Reader controls",
    });
  });
});

describe("getNewsInterestDrift", () => {
  it("summarizes positive drift and guarded signals from recent behavior", () => {
    expect(
      getNewsInterestDrift({
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
            entities: ["Agents", "Anthropic"],
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
          },
          {
            ...localItem,
            id: "read-agent-openai",
            category: "agent_product",
            entities: ["Agents", "OpenAI"],
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
          },
        ],
        negativeFeedbackItems: [
          {
            ...olderItem,
            id: "hidden-funding",
            category: "funding",
            entities: ["Series A", "OpenAI"],
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
        ],
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: ["openai-news"],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1.2,
          recencyBias: 1,
        },
        savedItems: [
          {
            ...localItem,
            id: "saved-agent",
            category: "agent_product",
            entities: ["Agents", "Anthropic"],
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
          },
        ],
      }),
    ).toEqual({
      label: "Drifting",
      metrics: [
        { label: "Active signals", value: "3" },
        { label: "Positive drift", value: "3" },
        { label: "Guarded signals", value: "3" },
        { label: "Direction", value: "Agents" },
      ],
      notices: [
        {
          detail:
            "Agents leads recent saves and reads with 3 weighted signals.",
          label: "Topic drift",
        },
        {
          detail:
            "Agent Desk is gaining weight from 3 saved/read interactions.",
          label: "Source drift",
        },
        {
          detail: "Less feedback is guarding against Funding from VentureWire.",
          label: "Guardrail",
        },
      ],
      summary:
        "Recent behavior is pulling the profile toward Agents while guarding 3 negative signals.",
    });
  });

  it("keeps cold-start drift explicit before behavior arrives", () => {
    expect(
      getNewsInterestDrift({
        formatCategory: (category) => category,
        historyItems: [],
        negativeFeedbackItems: [],
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
      label: "No Drift",
      metrics: [
        { label: "Active signals", value: "0" },
        { label: "Positive drift", value: "0" },
        { label: "Guarded signals", value: "0" },
        { label: "Direction", value: "None" },
      ],
      notices: [
        {
          detail:
            "Save, read, or press Less to create a measurable profile drift.",
          label: "No behavior yet",
        },
      ],
      summary: "Interest drift will appear after reader behavior arrives.",
    });
  });
});

describe("getNewsReaderLearningLoop", () => {
  it("turns reader behavior into reinforce, explore, dampen, and balance actions", () => {
    expect(
      getNewsReaderLearningLoop({
        formatCategory: (category) =>
          category === "agent_product"
            ? "Agents"
            : category === "robotics"
              ? "Robotics"
              : category === "funding"
                ? "Funding"
                : "Models",
        historyItems: [
          {
            ...localItem,
            id: "read-agent-one",
            category: "agent_product",
            entities: ["Agents"],
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
          },
          {
            ...localItem,
            id: "read-agent-two",
            category: "agent_product",
            entities: ["Agents", "Anthropic"],
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
          },
        ],
        items: [
          {
            ...localItem,
            id: "learning-explore",
            category: "robotics",
            entities: ["Figure"],
            matchedSignals: ["exploration"],
            personalizedScore: 119,
            sourceName: "Robotics Desk",
            sourceScore: 92,
            sourceSlug: "robotics-desk",
            title: "Robotics agent startup tests the explore lane",
            trendScore: 90,
          },
        ],
        negativeFeedbackItems: [
          {
            ...olderItem,
            id: "less-funding",
            category: "funding",
            entities: ["YC"],
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
        ],
        profile: localProfile,
        savedItems: [
          {
            ...localItem,
            id: "saved-model",
            entities: ["OpenAI", "GPT-6"],
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
          },
        ],
      }),
    ).toEqual({
      actions: [
        {
          detail: "2 reads/saves are teaching the feed to lift Agents.",
          key: "reinforce",
          label: "Reinforce",
          signalLabel: "2 positive signals",
          statusLabel: "Lift",
          title: "Agents",
        },
        {
          detail: "Exploration candidate tests adjacent reader interest.",
          key: "explore",
          label: "Explore",
          signalLabel: "90 heat / 92 trust",
          statusLabel: "Test",
          title: "Robotics",
        },
        {
          detail: "Less feedback guards against similar Funding stories.",
          key: "dampen",
          label: "Dampen",
          signalLabel: "1 guardrail",
          statusLabel: "Guard",
          title: "Funding",
        },
        {
          detail: "3 explicit signals keep the ranking anchored.",
          key: "balance",
          label: "Balance",
          signalLabel: "novelty 1 / recency 1",
          statusLabel: "Anchor",
          title: "Profile balance",
        },
      ],
      label: "Learning Loop Active",
      metrics: [
        { label: "Positive", value: "3" },
        { label: "Guardrails", value: "1" },
        { label: "Explore", value: "1" },
        { label: "Profile", value: "3 signals" },
      ],
      summary:
        "4 learning actions combine 3 positive signals, 1 guardrail, and 1 exploration candidate.",
    });
  });

  it("keeps the learning loop empty before behavior or ranked stories arrive", () => {
    expect(
      getNewsReaderLearningLoop({
        formatCategory: (category) => category,
        historyItems: [],
        items: [],
        negativeFeedbackItems: [],
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
      actions: [],
      label: "Learning Loop Waiting",
      metrics: [
        { label: "Positive", value: "0" },
        { label: "Guardrails", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Profile", value: "0 signals" },
      ],
      summary:
        "Reader learning loop will appear after behavior or ranked stories.",
    });
  });
});

describe("getNewsServerProfileAuditDisplay", () => {
  it("turns server profile audit data into a compact learning display", () => {
    expect(
      getNewsServerProfileAuditDisplay({
        averageHomeRankSlot: 2.3,
        ignoredSignalCount: 2,
        negativeSignalCount: 1,
        positiveSignalCount: 3,
        summary:
          "Profile leans toward agent_product and model_release, led by openai-news and OpenAI.",
        topCategories: [
          { count: 2, key: "agent_product" },
          { count: 1, key: "model_release" },
        ],
        topEntities: [
          { count: 2, key: "OpenAI" },
          { count: 1, key: "Operator" },
        ],
        topFeedModes: [
          { count: 2, key: "for_you" },
          { count: 1, key: "latest" },
        ],
        topMatchedSignals: [
          { count: 2, key: "category" },
          { count: 1, key: "semantic_feedback" },
        ],
        topSources: [{ count: 2, key: "openai-news" }],
        topTags: [
          { count: 2, key: "agents" },
          { count: 1, key: "browser" },
        ],
        trainedSignalCount: 3,
      }),
    ).toEqual({
      chips: [
        "agent_product 2",
        "model_release 1",
        "openai-news 2",
        "agents 2",
        "category 2",
      ],
      label: "Server Learned",
      metrics: [
        { label: "Trained", value: "3" },
        { label: "Ignored", value: "2" },
        { label: "Hidden", value: "1" },
        { label: "Avg slot", value: "2.3" },
      ],
      summary:
        "Profile leans toward agent_product and model_release, led by openai-news and OpenAI.",
    });
  });

  it("keeps the server audit display in a waiting state until an audit is available", () => {
    expect(getNewsServerProfileAuditDisplay(undefined)).toEqual({
      chips: [],
      label: "Server Waiting",
      metrics: [
        { label: "Trained", value: "0" },
        { label: "Ignored", value: "0" },
        { label: "Hidden", value: "0" },
      ],
      summary:
        "Server-side profile learning will appear after saved stories, reads, source clicks, or Less feedback sync.",
    });
  });
});

describe("getNewsFeedbackTrainingUpdate", () => {
  it("summarizes positive feedback as newly learned reader signals", () => {
    expect(
      getNewsFeedbackTrainingUpdate({
        action: "save",
        afterProfile: {
          preferredCategories: ["model_release", "agent_product"],
          preferredSources: ["agent-desk"],
          preferredEntities: ["OpenAI", "Agents", "Anthropic"],
          noveltyBias: 1.3,
          recencyBias: 1.3,
        },
        beforeProfile: {
          preferredCategories: ["model_release"],
          preferredSources: [],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1,
          recencyBias: 1,
        },
        formatCategory: (category) =>
          category === "agent_product" ? "Agents" : "Models",
        item: {
          ...localItem,
          category: "agent_product",
          entities: ["Agents", "Anthropic"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          title: "Agent desk story",
        },
      }),
    ).toEqual({
      label: "Positive Signal",
      metrics: [
        { label: "New topics", value: "1" },
        { label: "New sources", value: "1" },
        { label: "New entities", value: "2" },
        { label: "New angles", value: "0" },
        { label: "Bias shift", value: "+0.6" },
      ],
      notices: [
        {
          detail: "Future stories matching these signals will rank higher.",
          label: "Profile memory",
        },
      ],
      signals: [
        { label: "Topic", value: "Agents" },
        { label: "Source", value: "Agent Desk" },
        { label: "Entities", value: "Agents, Anthropic" },
      ],
      summary: "Save trained the feed toward Agents from Agent Desk.",
    });
  });

  it("marks shared stories as stronger positive feedback", () => {
    expect(
      getNewsFeedbackTrainingUpdate({
        action: "share",
        afterProfile: {
          preferredCategories: ["model_release", "agent_product"],
          preferredSources: ["agent-desk"],
          preferredEntities: ["OpenAI", "Agents", "Anthropic"],
          noveltyBias: 1.6,
          recencyBias: 1.6,
        },
        beforeProfile: {
          preferredCategories: ["model_release"],
          preferredSources: [],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1,
          recencyBias: 1,
        },
        formatCategory: (category) =>
          category === "agent_product" ? "Agents" : "Models",
        item: {
          ...localItem,
          category: "agent_product",
          entities: ["Agents", "Anthropic"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          title: "Agent desk story",
        },
      }),
    ).toMatchObject({
      label: "Strong Signal",
      notices: [
        {
          detail:
            "Shared stories carry stronger future ranking weight than a simple save.",
          label: "Profile boost",
        },
      ],
      summary: "Share strongly trained the feed toward Agents from Agent Desk.",
    });
  });

  it("summarizes hide feedback as removed reader signals", () => {
    expect(
      getNewsFeedbackTrainingUpdate({
        action: "hide",
        afterProfile: {
          preferredCategories: ["funding"],
          preferredSources: [],
          preferredEntities: ["Anthropic"],
          noveltyBias: 0.8,
          recencyBias: 0.8,
        },
        beforeProfile: {
          preferredCategories: ["model_release", "funding"],
          preferredSources: ["local-source"],
          preferredEntities: ["OpenAI", "Anthropic"],
          noveltyBias: 1,
          recencyBias: 1,
        },
        formatCategory: (category) =>
          category === "model_release" ? "Models" : "Funding",
        item: localItem,
      }),
    ).toEqual({
      label: "Negative Signal",
      metrics: [
        { label: "Removed topics", value: "1" },
        { label: "Removed sources", value: "1" },
        { label: "Removed entities", value: "1" },
        { label: "Removed angles", value: "0" },
        { label: "Bias shift", value: "-0.4" },
      ],
      notices: [
        {
          detail: "Stories matching removed signals will be dampened.",
          label: "Profile guard",
        },
      ],
      signals: [
        { label: "Topic", value: "Models" },
        { label: "Source", value: "Local Source" },
        { label: "Entities", value: "OpenAI" },
      ],
      summary: "Less trained the feed away from Models from Local Source.",
    });
  });

  it("separates learned angle feedback from learned entities", () => {
    expect(
      getNewsFeedbackTrainingUpdate({
        action: "save",
        afterProfile: {
          preferredCategories: ["security"],
          preferredSources: ["security-desk"],
          preferredEntities: ["OpenAI", "Agent Security", "prompt_injection"],
          noveltyBias: 1.2,
          recencyBias: 1.2,
        },
        beforeProfile: {
          preferredCategories: ["security"],
          preferredSources: [],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1,
          recencyBias: 1,
        },
        formatCategory: (category) =>
          category === "security" ? "Security" : category,
        item: {
          ...localItem,
          category: "security",
          entities: ["Agent Security"],
          sourceName: "Security Desk",
          sourceSlug: "security-desk",
          tags: ["prompt_injection"],
          title: "Prompt injection defense story",
        },
      }),
    ).toEqual({
      label: "Positive Signal",
      metrics: [
        { label: "New topics", value: "0" },
        { label: "New sources", value: "1" },
        { label: "New entities", value: "1" },
        { label: "New angles", value: "1" },
        { label: "Bias shift", value: "+0.4" },
      ],
      notices: [
        {
          detail: "Future stories matching these signals will rank higher.",
          label: "Profile memory",
        },
      ],
      signals: [
        { label: "Source", value: "Security Desk" },
        { label: "Entities", value: "Agent Security" },
        { label: "Angles", value: "prompt injection" },
      ],
      summary: "Save trained the feed toward Security from Security Desk.",
    });
  });
});

describe("getNewsReaderMemoryResetTrainingUpdate", () => {
  it("explains that reset clears persisted reader memory and restarts training", () => {
    expect(getNewsReaderMemoryResetTrainingUpdate()).toEqual({
      label: "Memory Reset",
      metrics: [
        { label: "Profile", value: "Default" },
        { label: "Saved", value: "Cleared" },
        { label: "History", value: "Cleared" },
        { label: "Guardrails", value: "Cleared" },
      ],
      notices: [
        {
          detail:
            "For You will restart from default AI topics and learn again from new reads, saves, source clicks, and Less feedback.",
          label: "Fresh training loop",
        },
      ],
      signals: [
        { label: "Topics", value: "Models, Agents, Funding" },
        { label: "Sources", value: "No saved sources" },
        { label: "Entities", value: "No saved entities" },
      ],
      summary:
        "Reader memory was reset across profile, saved stories, reading history, and feedback guardrails.",
    });
  });

  it("keeps reset feedback honest when only local reader memory can be cleared", () => {
    expect(
      getNewsReaderMemoryResetTrainingUpdate({ persisted: false }),
    ).toEqual({
      label: "Local Reset",
      metrics: [
        { label: "Profile", value: "Default" },
        { label: "Saved", value: "Not synced" },
        { label: "History", value: "Not synced" },
        { label: "Guardrails", value: "Local only" },
      ],
      notices: [
        {
          detail:
            "This device profile was reset locally. Server memory will clear once a reader key and live API are available.",
          label: "Local training loop",
        },
      ],
      signals: [
        { label: "Topics", value: "Models, Agents, Funding" },
        { label: "Sources", value: "No local sources" },
        { label: "Entities", value: "No local entities" },
      ],
      summary:
        "Local reader memory was reset; persisted saved stories, reading history, and feedback guardrails were not contacted.",
    });
  });
});

describe("getNewsReaderMemoryResetPersistence", () => {
  it("only treats reset feedback as persisted when server memory can be cleared", () => {
    expect(
      getNewsReaderMemoryResetPersistence({
        canPersistProfile: true,
        resetFailed: false,
        visitorKey: "visitor-123",
      }),
    ).toBe(true);
    expect(
      getNewsReaderMemoryResetPersistence({
        canPersistProfile: true,
        resetFailed: false,
        visitorKey: null,
      }),
    ).toBe(false);
    expect(
      getNewsReaderMemoryResetPersistence({
        canPersistProfile: false,
        resetFailed: false,
        visitorKey: "visitor-123",
      }),
    ).toBe(false);
    expect(
      getNewsReaderMemoryResetPersistence({
        canPersistProfile: true,
        resetFailed: true,
        visitorKey: "visitor-123",
      }),
    ).toBe(false);
  });
});

describe("getNewsPreferenceStarter", () => {
  it("suggests new preference signals from active story coverage", () => {
    expect(
      getNewsPreferenceStarter({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "funding"
              ? "Funding"
              : category === "agent_product"
                ? "Agents"
                : category,
        items: [
          {
            ...localItem,
            matchedSignals: ["category"],
            personalizedScore: 122,
          },
          {
            ...serverItem,
            category: "agent_product",
            entities: ["Anthropic", "Agents"],
            matchedSignals: [],
            personalizedScore: 108,
            sourceName: "OpenAI News",
            sourceScore: 90,
            sourceSlug: "openai-news",
            trendScore: 82,
          },
          {
            ...olderItem,
            category: "funding",
            entities: ["Series A", "OpenAI"],
            matchedSignals: ["exploration"],
            personalizedScore: 104,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            trendScore: 92,
          },
          {
            ...olderItem,
            id: "funding-follow-up",
            category: "funding",
            entities: ["Series A"],
            matchedSignals: [],
            personalizedScore: 99,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            trendScore: 76,
          },
        ],
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: ["local-source"],
          preferredEntities: ["OpenAI", "model"],
          noveltyBias: 1.2,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      groups: [
        {
          label: "Topics",
          suggestions: [
            {
              actionLabel: "Follow topic",
              kind: "category",
              label: "Funding",
              reason: "2 stories from 2 sources are active in Funding.",
              signal: "funding",
            },
            {
              actionLabel: "Follow topic",
              kind: "category",
              label: "Agents",
              reason: "1 story from 1 source is active in Agents.",
              signal: "agent_product",
            },
          ],
        },
        {
          label: "Sources",
          suggestions: [
            {
              actionLabel: "Follow source",
              kind: "source",
              label: "OpenAI News",
              reason: "2 stories across 2 topics are coming from OpenAI News.",
              signal: "openai-news",
            },
            {
              actionLabel: "Follow source",
              kind: "source",
              label: "VentureWire",
              reason: "1 story across 1 topic is coming from VentureWire.",
              signal: "venturewire",
            },
          ],
        },
        {
          label: "Entities",
          suggestions: [
            {
              actionLabel: "Follow entity",
              kind: "entity",
              label: "Series A",
              reason: "2 stories from 2 sources mention Series A.",
              signal: "Series A",
            },
            {
              actionLabel: "Follow entity",
              kind: "entity",
              label: "Anthropic",
              reason: "1 story from 1 source mentions Anthropic.",
              signal: "Anthropic",
            },
          ],
        },
      ],
      label: "Starter Picks",
      metrics: [
        { label: "Suggestions", value: "6" },
        { label: "New topics", value: "2" },
        { label: "New sources", value: "2" },
        { label: "New entities", value: "2" },
        { label: "New angles", value: "0" },
      ],
      summary:
        "6 preference starters can seed the For You model from 4 ranked stories.",
    });
  });

  it("keeps the starter state stable while stories are unavailable", () => {
    expect(
      getNewsPreferenceStarter({
        formatCategory: (category) => category,
        items: [],
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      groups: [],
      label: "Waiting",
      metrics: [
        { label: "Suggestions", value: "0" },
        { label: "New topics", value: "0" },
        { label: "New sources", value: "0" },
        { label: "New entities", value: "0" },
        { label: "New angles", value: "0" },
      ],
      summary: "Preference starter will appear as stories load.",
    });
  });

  it("suggests fine-grained angle tags as preference starters", () => {
    expect(
      getNewsPreferenceStarter({
        formatCategory: (category) => category,
        items: [
          {
            ...localItem,
            entities: ["OpenAI"],
            matchedSignals: [],
            personalizedScore: 126,
            sourceSlug: "openai-news",
            tags: ["agents", "prompt_injection", "benchmarks"],
            trendScore: 90,
          },
          {
            ...serverItem,
            entities: ["Anthropic"],
            matchedSignals: [],
            personalizedScore: 118,
            sourceSlug: "research-lab",
            tags: ["agents", "prompt_injection"],
            trendScore: 86,
          },
        ],
        profile: {
          preferredCategories: ["model_release", "research"],
          preferredSources: ["openai-news", "research-lab"],
          preferredEntities: ["OpenAI", "Anthropic"],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      groups: [
        {
          label: "Angles",
          suggestions: [
            {
              actionLabel: "Follow angle",
              kind: "tag",
              label: "prompt injection",
              reason:
                "2 stories from 2 sources carry the prompt injection angle.",
              signal: "prompt_injection",
            },
            {
              actionLabel: "Follow angle",
              kind: "tag",
              label: "benchmarks",
              reason: "1 story from 1 source carries the benchmarks angle.",
              signal: "benchmarks",
            },
          ],
        },
      ],
      label: "Starter Picks",
      metrics: [
        { label: "Suggestions", value: "2" },
        { label: "New topics", value: "0" },
        { label: "New sources", value: "0" },
        { label: "New entities", value: "0" },
        { label: "New angles", value: "2" },
      ],
      summary:
        "2 preference starters can seed the For You model from 2 ranked stories.",
    });
  });
});

describe("getNewsPreferenceControlPanel", () => {
  it("turns the active reader profile into manual tuning controls", () => {
    expect(
      getNewsPreferenceControlPanel({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category,
        profile: {
          preferredCategories: ["model_release", "agent_product"],
          preferredSources: ["openai-news"],
          preferredEntities: ["OpenAI", "Agents"],
          noveltyBias: 1.5,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      biasControls: [
        {
          detail: "Ranks newer stories higher.",
          key: "recencyBias",
          label: "Fresh",
          value: "1/2",
        },
        {
          detail: "Keeps adjacent topics in the feed.",
          key: "noveltyBias",
          label: "Novel",
          value: "1.5/2",
        },
      ],
      groups: [
        {
          emptyLabel: "No topics followed",
          key: "categories",
          label: "Topics",
          signals: [
            {
              kind: "category",
              label: "Models",
              signal: "model_release",
            },
            {
              kind: "category",
              label: "Agents",
              signal: "agent_product",
            },
          ],
        },
        {
          emptyLabel: "No sources followed",
          key: "sources",
          label: "Sources",
          signals: [
            {
              kind: "source",
              label: "openai-news",
              signal: "openai-news",
            },
          ],
        },
        {
          emptyLabel: "No entities followed",
          key: "entities",
          label: "Entities",
          signals: [
            {
              kind: "entity",
              label: "OpenAI",
              signal: "OpenAI",
            },
            {
              kind: "entity",
              label: "Agents",
              signal: "Agents",
            },
          ],
        },
        {
          emptyLabel: "No angles followed",
          key: "angles",
          label: "Angles",
          signals: [],
        },
      ],
      label: "Manual Controls",
      metrics: [
        { label: "Signals", value: "5" },
        { label: "Topics", value: "2" },
        { label: "Sources", value: "1" },
        { label: "Bias", value: "Discovery" },
      ],
      summary:
        "Manual controls expose 5 active preference signals with Discovery ranking bias.",
    });
  });

  it("keeps manual tuning useful for a cold profile", () => {
    expect(
      getNewsPreferenceControlPanel({
        formatCategory: (category) => category,
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      biasControls: [
        {
          detail: "Ranks newer stories higher.",
          key: "recencyBias",
          label: "Fresh",
          value: "1/2",
        },
        {
          detail: "Keeps adjacent topics in the feed.",
          key: "noveltyBias",
          label: "Novel",
          value: "1/2",
        },
      ],
      groups: [
        {
          emptyLabel: "No topics followed",
          key: "categories",
          label: "Topics",
          signals: [],
        },
        {
          emptyLabel: "No sources followed",
          key: "sources",
          label: "Sources",
          signals: [],
        },
        {
          emptyLabel: "No entities followed",
          key: "entities",
          label: "Entities",
          signals: [],
        },
        {
          emptyLabel: "No angles followed",
          key: "angles",
          label: "Angles",
          signals: [],
        },
      ],
      label: "Control Ready",
      metrics: [
        { label: "Signals", value: "0" },
        { label: "Topics", value: "0" },
        { label: "Sources", value: "0" },
        { label: "Bias", value: "Balanced" },
      ],
      summary:
        "Manual controls are ready. Follow topics, sources, or entities to steer For You.",
    });
  });

  it("separates manual angle controls from entity controls", () => {
    expect(
      getNewsPreferenceControlPanel({
        formatCategory: (category) =>
          category === "security" ? "Security" : category,
        profile: {
          preferredCategories: ["security"],
          preferredSources: [],
          preferredEntities: ["OpenAI", "prompt_injection", "red_team"],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }).groups,
    ).toEqual([
      {
        emptyLabel: "No topics followed",
        key: "categories",
        label: "Topics",
        signals: [
          {
            kind: "category",
            label: "Security",
            signal: "security",
          },
        ],
      },
      {
        emptyLabel: "No sources followed",
        key: "sources",
        label: "Sources",
        signals: [],
      },
      {
        emptyLabel: "No entities followed",
        key: "entities",
        label: "Entities",
        signals: [
          {
            kind: "entity",
            label: "OpenAI",
            signal: "OpenAI",
          },
        ],
      },
      {
        emptyLabel: "No angles followed",
        key: "angles",
        label: "Angles",
        signals: [
          {
            kind: "tag",
            label: "prompt injection",
            signal: "prompt_injection",
          },
          {
            kind: "tag",
            label: "red team",
            signal: "red_team",
          },
        ],
      },
    ]);
  });
});

describe("getNewsAnglePreferenceOptions", () => {
  it("formats specific story tags into reusable angle preference options", () => {
    expect(
      getNewsAnglePreferenceOptions({
        items: [
          {
            ...localItem,
            id: "security-lead",
            tags: ["agents", "prompt_injection", "red_team", "research"],
          },
          {
            ...serverItem,
            id: "security-follow",
            tags: ["prompt-injection", "gpu_cloud", "open_source"],
          },
          {
            ...olderItem,
            id: "evals-follow",
            tags: ["red_team", "benchmarks", "security"],
          },
        ],
        limit: 4,
      }),
    ).toEqual([
      {
        label: "prompt injection",
        signal: "prompt_injection",
      },
      {
        label: "red team",
        signal: "red_team",
      },
      {
        label: "gpu cloud",
        signal: "gpu_cloud",
      },
      {
        label: "benchmarks",
        signal: "benchmarks",
      },
    ]);
  });
});

describe("getNewsStoryQuickTuneActions", () => {
  it("builds story-level preference actions for unfollowed topic, source, and entity signals", () => {
    expect(
      getNewsStoryQuickTuneActions({
        formatCategory: (category) =>
          category === "agent_product" ? "Agents" : category,
        item: {
          ...localItem,
          category: "agent_product",
          entities: ["OpenAI", "Automation"],
          sourceName: "Agent Product Desk",
          sourceSlug: "agent-product-desk",
        },
        profile: {
          preferredCategories: ["model_release"],
          preferredEntities: ["OpenAI"],
          preferredSources: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      actions: [
        {
          actionLabel: "Follow topic",
          kind: "category",
          label: "Agents",
          signal: "agent_product",
        },
        {
          actionLabel: "Follow source",
          kind: "source",
          label: "Agent Product Desk",
          signal: "agent-product-desk",
        },
        {
          actionLabel: "Follow entity",
          kind: "entity",
          label: "Automation",
          signal: "Automation",
        },
      ],
      label: "Tune this story",
      summary:
        "Add topic, source, entity, or angle signals from this story to retrain For You.",
    });
  });

  it("keeps quick tuning quiet when the story is already covered by the profile", () => {
    expect(
      getNewsStoryQuickTuneActions({
        formatCategory: (category) =>
          category === "agent_product" ? "Agents" : category,
        item: {
          ...localItem,
          category: "agent_product",
          entities: ["Automation"],
          sourceName: "Agent Product Desk",
          sourceSlug: "agent-product-desk",
        },
        profile: {
          preferredCategories: ["agent_product"],
          preferredEntities: ["Automation"],
          preferredSources: ["agent-product-desk"],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      actions: [],
      label: "Story covered",
      summary: "This story's main signals are already in your profile.",
    });
  });

  it("offers a story-level angle action for specific unfollowed tags", () => {
    expect(
      getNewsStoryQuickTuneActions({
        formatCategory: (category) =>
          category === "security" ? "Security" : category,
        item: {
          ...localItem,
          category: "security",
          entities: ["Agent Security"],
          sourceName: "Security Desk",
          sourceSlug: "security-desk",
          tags: ["agents", "prompt_injection", "red_team"],
        },
        profile: {
          preferredCategories: ["security"],
          preferredEntities: ["Agent Security"],
          preferredSources: ["security-desk"],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      actions: [
        {
          actionLabel: "Follow angle",
          kind: "tag",
          label: "prompt injection",
          signal: "prompt_injection",
        },
      ],
      label: "Tune this story",
      summary:
        "Add topic, source, entity, or angle signals from this story to retrain For You.",
    });
  });
});

describe("getNewsPreferencePresets", () => {
  it("builds one-click preference bundles from the ranked AI news mix", () => {
    expect(
      getNewsPreferencePresets({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "research"
              ? "Research"
              : category === "agent_product"
                ? "Agents"
                : category === "funding"
                  ? "Funding"
                  : category,
        items: [
          {
            ...localItem,
            id: "openai-model",
            title: "OpenAI ships a model update",
            category: "model_release",
            entities: ["OpenAI", "GPT-5"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 160,
            sourceName: "OpenAI News",
            sourceScore: 94,
            sourceSlug: "openai-news",
            trendScore: 95,
          },
          {
            ...localItem,
            id: "research-transformer",
            title: "Research lab publishes transformer routing work",
            category: "research",
            entities: ["Transformers"],
            matchedSignals: [],
            personalizedScore: 124,
            sourceName: "Research Lab",
            sourceScore: 88,
            sourceSlug: "research-lab",
            trendScore: 72,
          },
          {
            ...localItem,
            id: "agent-workflow",
            title: "Agent workflow platform adds memory",
            category: "agent_product",
            entities: ["Agents", "LangChain"],
            matchedSignals: ["exploration"],
            personalizedScore: 118,
            sourceName: "Agent Desk",
            sourceScore: 82,
            sourceSlug: "agent-desk",
            trendScore: 84,
          },
          {
            ...localItem,
            id: "funding-yc",
            title: "YC AI startup raises a seed round",
            category: "funding",
            entities: ["YC", "Series A"],
            matchedSignals: [],
            personalizedScore: 111,
            sourceName: "VentureWire",
            sourceScore: 79,
            sourceSlug: "venturewire",
            trendScore: 80,
          },
        ],
        limit: 3,
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: ["openai-news"],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      label: "Preset Ready",
      metrics: [
        { label: "Presets", value: "3" },
        { label: "Stories", value: "4" },
        { label: "New signals", value: "11" },
        { label: "Active signals", value: "3" },
      ],
      presets: [
        {
          actionLabel: "Apply preset",
          coverageLabel: "2 stories",
          key: "frontier_labs",
          label: "Frontier Labs",
          newSignalCount: 3,
          signals: [
            {
              active: true,
              kind: "category",
              label: "Models",
              signal: "model_release",
            },
            {
              active: false,
              kind: "category",
              label: "Research",
              signal: "research",
            },
            {
              active: true,
              kind: "source",
              label: "OpenAI News",
              signal: "openai-news",
            },
            {
              active: true,
              kind: "entity",
              label: "OpenAI",
              signal: "OpenAI",
            },
            {
              active: false,
              kind: "entity",
              label: "GPT-5",
              signal: "GPT-5",
            },
            {
              active: false,
              kind: "entity",
              label: "Transformers",
              signal: "Transformers",
            },
          ],
          summary:
            "Follow frontier model and research coverage from OpenAI News.",
        },
        {
          actionLabel: "Apply preset",
          coverageLabel: "1 story",
          key: "builder_watch",
          label: "Builder Watch",
          newSignalCount: 4,
          signals: [
            {
              active: false,
              kind: "category",
              label: "Agents",
              signal: "agent_product",
            },
            {
              active: false,
              kind: "source",
              label: "Agent Desk",
              signal: "agent-desk",
            },
            {
              active: false,
              kind: "entity",
              label: "Agents",
              signal: "Agents",
            },
            {
              active: false,
              kind: "entity",
              label: "LangChain",
              signal: "LangChain",
            },
          ],
          summary: "Follow agent products and builder tooling signals.",
        },
        {
          actionLabel: "Apply preset",
          coverageLabel: "1 story",
          key: "market_signals",
          label: "Market Signals",
          newSignalCount: 4,
          signals: [
            {
              active: false,
              kind: "category",
              label: "Funding",
              signal: "funding",
            },
            {
              active: false,
              kind: "source",
              label: "VentureWire",
              signal: "venturewire",
            },
            {
              active: false,
              kind: "entity",
              label: "YC",
              signal: "YC",
            },
            {
              active: false,
              kind: "entity",
              label: "Series A",
              signal: "Series A",
            },
          ],
          summary: "Follow funding, startup, and AI market movement.",
        },
      ],
      summary:
        "3 one-click preference presets can reshape the For You model from 4 ranked stories.",
    });
  });

  it("keeps preference presets empty before ranked stories arrive", () => {
    expect(
      getNewsPreferencePresets({
        formatCategory: (category) => category,
        items: [],
        limit: 3,
        profile: localProfile,
      }),
    ).toEqual({
      label: "Preset Waiting",
      metrics: [
        { label: "Presets", value: "0" },
        { label: "Stories", value: "0" },
        { label: "New signals", value: "0" },
        { label: "Active signals", value: "3" },
      ],
      presets: [],
      summary: "Preference presets will appear after stories are ranked.",
    });
  });
});

describe("getNewsPreferenceTuningPlan", () => {
  it("turns reader behavior and guardrails into concrete preference tuning suggestions", () => {
    expect(
      getNewsPreferenceTuningPlan({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category === "hot_take"
                ? "Hot Takes"
                : category,
        historyItems: [
          {
            ...localItem,
            category: "agent_product",
            entities: ["Agents"],
            id: "read-agent-analysis",
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Read agent analysis",
          },
        ],
        items: [
          {
            ...localItem,
            matchedSignals: ["category", "source", "entity"],
            personalizedScore: 150,
            title: "OpenAI model launch",
          },
          {
            ...localItem,
            category: "agent_product",
            entities: ["Agents", "Anthropic"],
            id: "agent-workflow",
            matchedSignals: ["exploration"],
            personalizedScore: 132,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Agent workflow gains memory",
          },
          {
            ...localItem,
            category: "hot_take",
            entities: ["StealthAI"],
            id: "rumor-story",
            matchedSignals: [],
            personalizedScore: 94,
            sourceName: "Rumor Feed",
            sourceScore: 52,
            sourceSlug: "rumor-feed",
            title: "Rumor feed claims a model leak",
          },
        ],
        limit: 4,
        negativeFeedbackItems: [
          {
            ...localItem,
            category: "hot_take",
            entities: ["StealthAI"],
            id: "hidden-rumor",
            sourceName: "Rumor Feed",
            sourceSlug: "rumor-feed",
            title: "Hidden rumor feed story",
          },
        ],
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: ["local-source"],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1,
          recencyBias: 1,
        },
        savedItems: [
          {
            ...localItem,
            category: "agent_product",
            entities: ["Agents", "Anthropic"],
            id: "saved-agent-workflow",
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Saved agent workflow",
          },
          {
            ...localItem,
            category: "agent_product",
            entities: ["Agents"],
            id: "saved-agent-launch",
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Saved agent launch",
          },
        ],
      }),
    ).toEqual({
      label: "Ready to Tune",
      metrics: [
        { label: "Active signals", value: "3" },
        { label: "Behavior", value: "3" },
        { label: "Guardrails", value: "1" },
        { label: "Suggestions", value: "4" },
      ],
      suggestions: [
        {
          action: "keep",
          actionLabel: "Keep topic",
          detail: "Models still appears in 1 ranked story.",
          evidence: ["OpenAI model launch"],
          kind: "category",
          label: "Keep Models",
          signal: "model_release",
        },
        {
          action: "add",
          actionLabel: "Add topic",
          detail: "3 saved/read signals point to Agents.",
          evidence: [
            "Saved agent workflow",
            "Saved agent launch",
            "Read agent analysis",
          ],
          kind: "category",
          label: "Add Agents",
          signal: "agent_product",
        },
        {
          action: "add",
          actionLabel: "Add source",
          detail: "3 saved/read signals point to Agent Desk.",
          evidence: [
            "Saved agent workflow",
            "Saved agent launch",
            "Read agent analysis",
          ],
          kind: "source",
          label: "Add Agent Desk",
          signal: "agent-desk",
        },
        {
          action: "reduce",
          actionLabel: "Reduce source",
          detail: "1 Less signal is guarding Rumor Feed.",
          evidence: ["Hidden rumor feed story"],
          kind: "source",
          label: "Reduce Rumor Feed",
          signal: "rumor-feed",
        },
      ],
      summary:
        "4 tuning suggestions from 3 active signals, 3 behavior signals, and 1 guardrail.",
    });
  });

  it("keeps the tuning plan empty before the reader has signals or behavior", () => {
    expect(
      getNewsPreferenceTuningPlan({
        formatCategory: (category) => category,
        historyItems: [],
        items: [],
        limit: 4,
        negativeFeedbackItems: [],
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
      label: "Cold Start",
      metrics: [
        { label: "Active signals", value: "0" },
        { label: "Behavior", value: "0" },
        { label: "Guardrails", value: "0" },
        { label: "Suggestions", value: "0" },
      ],
      suggestions: [],
      summary:
        "Preference tuning will appear after profile signals or reader behavior arrive.",
    });
  });

  it("suggests specific angle signals learned from saved and read tags", () => {
    expect(
      getNewsPreferenceTuningPlan({
        formatCategory: (category) =>
          category === "security" ? "Security" : category,
        historyItems: [
          {
            ...localItem,
            category: "security",
            entities: ["OpenAI"],
            id: "read-prompt-defense",
            sourceName: "Security Desk",
            sourceSlug: "security-desk",
            tags: ["prompt_injection", "agents"],
            title: "Read prompt defense",
          },
        ],
        items: [],
        limit: 3,
        negativeFeedbackItems: [],
        profile: {
          preferredCategories: ["security"],
          preferredSources: ["security-desk"],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1.4,
          recencyBias: 1,
        },
        savedItems: [
          {
            ...localItem,
            category: "security",
            entities: ["OpenAI"],
            id: "saved-prompt-defense",
            sourceName: "Security Desk",
            sourceSlug: "security-desk",
            tags: ["prompt_injection", "research"],
            title: "Saved prompt defense",
          },
        ],
      }),
    ).toEqual({
      label: "Ready to Tune",
      metrics: [
        { label: "Active signals", value: "3" },
        { label: "Behavior", value: "2" },
        { label: "Guardrails", value: "0" },
        { label: "Suggestions", value: "1" },
      ],
      suggestions: [
        {
          action: "add",
          actionLabel: "Add angle",
          detail: "2 saved/read signals point to prompt injection.",
          evidence: ["Saved prompt defense", "Read prompt defense"],
          kind: "tag",
          label: "Add prompt injection",
          signal: "prompt_injection",
        },
      ],
      summary:
        "1 tuning suggestion from 3 active signals, 2 behavior signals, and 0 guardrails.",
    });
  });

  it("suggests angle guardrails learned from Less feedback tags", () => {
    expect(
      getNewsPreferenceTuningPlan({
        formatCategory: (category) =>
          category === "security" ? "Security" : category,
        historyItems: [],
        items: [],
        limit: 3,
        negativeFeedbackItems: [
          {
            ...localItem,
            category: "security",
            entities: ["OpenAI"],
            id: "hidden-prompt-defense",
            sourceName: "Security Desk",
            sourceSlug: "security-desk",
            tags: ["prompt_injection", "agents"],
            title: "Hidden prompt defense",
          },
          {
            ...localItem,
            category: "security",
            entities: ["Anthropic"],
            id: "hidden-jailbreak-report",
            sourceName: "Security Desk",
            sourceSlug: "security-desk",
            tags: ["prompt_injection", "research"],
            title: "Hidden jailbreak report",
          },
        ],
        profile: {
          preferredCategories: ["security"],
          preferredSources: ["security-desk"],
          preferredEntities: ["prompt_injection"],
          noveltyBias: 1,
          recencyBias: 1.2,
        },
        savedItems: [],
      }),
    ).toEqual({
      label: "Ready to Tune",
      metrics: [
        { label: "Active signals", value: "3" },
        { label: "Behavior", value: "0" },
        { label: "Guardrails", value: "2" },
        { label: "Suggestions", value: "2" },
      ],
      suggestions: [
        {
          action: "reduce",
          actionLabel: "Reduce source",
          detail: "2 Less signals are guarding Security Desk.",
          evidence: ["Hidden prompt defense", "Hidden jailbreak report"],
          kind: "source",
          label: "Reduce Security Desk",
          signal: "security-desk",
        },
        {
          action: "reduce",
          actionLabel: "Reduce angle",
          detail: "2 Less signals are guarding prompt injection.",
          evidence: ["Hidden prompt defense", "Hidden jailbreak report"],
          kind: "tag",
          label: "Reduce prompt injection",
          signal: "prompt_injection",
        },
      ],
      summary:
        "2 tuning suggestions from 3 active signals, 0 behavior signals, and 2 guardrails.",
    });
  });
});

describe("getNewsProfileImpactPreview", () => {
  it("previews which stories the current profile will boost, explore, and dampen", () => {
    expect(
      getNewsProfileImpactPreview({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category === "hot_take"
                ? "Hot Takes"
                : category,
        items: [
          {
            ...localItem,
            id: "profile-model",
            matchedSignals: ["category", "source", "entity"],
            personalizedScore: 156,
            title: "OpenAI model launch",
          },
          {
            ...localItem,
            category: "agent_product",
            entities: ["Agents"],
            id: "explore-agent",
            matchedSignals: ["exploration"],
            personalizedScore: 121,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Agent workflow gains memory",
          },
          {
            ...localItem,
            category: "hot_take",
            entities: ["StealthAI"],
            id: "dampened-rumor",
            matchedSignals: [],
            personalizedScore: 91,
            sourceName: "Rumor Feed",
            sourceSlug: "rumor-feed",
            title: "Rumor feed claims model leak",
          },
        ],
        limit: 2,
        negativeFeedbackItems: [
          {
            ...localItem,
            category: "hot_take",
            entities: ["StealthAI"],
            id: "hidden-rumor",
            sourceName: "Rumor Feed",
            sourceSlug: "rumor-feed",
            title: "Hidden rumor feed story",
          },
        ],
        profile: localProfile,
      }),
    ).toEqual({
      label: "Profile Impact",
      lanes: [
        {
          count: 1,
          key: "boosted",
          label: "Boosted",
          stories: [
            {
              id: "profile-model",
              reason: "Matches Models, Local Source, and OpenAI.",
              sourceName: "Local Source",
              title: "OpenAI model launch",
            },
          ],
          summary: "Profile signals lift 1 ranked story.",
        },
        {
          count: 1,
          key: "explore",
          label: "Exploration",
          stories: [
            {
              id: "explore-agent",
              reason: "Explores Agents outside the active profile.",
              sourceName: "Agent Desk",
              title: "Agent workflow gains memory",
            },
          ],
          summary: "1 story tests adjacent coverage outside the profile.",
        },
        {
          count: 1,
          key: "dampened",
          label: "Dampened",
          stories: [
            {
              id: "dampened-rumor",
              reason: "Matches hidden source Rumor Feed.",
              sourceName: "Rumor Feed",
              title: "Rumor feed claims model leak",
            },
          ],
          summary: "1 story is held back by negative feedback.",
        },
      ],
      metrics: [
        { label: "Active signals", value: "3" },
        { label: "Boosted", value: "1" },
        { label: "Explore", value: "1" },
        { label: "Dampened", value: "1" },
      ],
      summary:
        "Current profile lifts 1 story, explores 1 adjacent story, and dampens 1 story.",
    });
  });

  it("keeps the impact preview cold before stories and profile signals exist", () => {
    expect(
      getNewsProfileImpactPreview({
        formatCategory: (category) => category,
        items: [],
        limit: 2,
        negativeFeedbackItems: [],
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      label: "Cold Impact",
      lanes: [],
      metrics: [
        { label: "Active signals", value: "0" },
        { label: "Boosted", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Dampened", value: "0" },
      ],
      summary:
        "Profile impact preview will appear after stories and reader signals arrive.",
    });
  });

  it("explains active and hidden angle matches in profile impact lanes", () => {
    expect(
      getNewsProfileImpactPreview({
        formatCategory: (category) =>
          category === "security" ? "Security" : "Safety",
        items: [
          {
            ...localItem,
            category: "security",
            entities: ["OpenAI"],
            id: "boosted-angle",
            matchedSignals: [],
            personalizedScore: 134,
            sourceName: "Security Desk",
            sourceSlug: "security-desk",
            tags: ["prompt_injection"],
            title: "Prompt injection defense playbook",
          },
          {
            ...localItem,
            category: "safety",
            entities: ["Anthropic"],
            id: "dampened-angle",
            matchedSignals: [],
            personalizedScore: 101,
            sourceName: "Safety Lab",
            sourceSlug: "safety-lab",
            tags: ["jailbreaks"],
            title: "Jailbreak benchmark controversy",
          },
        ],
        limit: 2,
        negativeFeedbackItems: [
          {
            ...localItem,
            category: "model_release",
            entities: ["Mistral"],
            id: "hidden-jailbreak",
            sourceName: "Model Wire",
            sourceSlug: "model-wire",
            tags: ["jailbreaks"],
            title: "Hidden jailbreak story",
          },
        ],
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: ["prompt_injection"],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      label: "Profile Impact",
      lanes: [
        {
          count: 1,
          key: "boosted",
          label: "Boosted",
          stories: [
            {
              id: "boosted-angle",
              reason: "Matches prompt injection.",
              sourceName: "Security Desk",
              title: "Prompt injection defense playbook",
            },
          ],
          summary: "Profile signals lift 1 ranked story.",
        },
        {
          count: 0,
          key: "explore",
          label: "Exploration",
          stories: [],
          summary: "0 stories test adjacent coverage outside the profile.",
        },
        {
          count: 1,
          key: "dampened",
          label: "Dampened",
          stories: [
            {
              id: "dampened-angle",
              reason: "Matches hidden angle jailbreaks.",
              sourceName: "Safety Lab",
              title: "Jailbreak benchmark controversy",
            },
          ],
          summary: "1 story is held back by negative feedback.",
        },
      ],
      metrics: [
        { label: "Active signals", value: "1" },
        { label: "Boosted", value: "1" },
        { label: "Explore", value: "0" },
        { label: "Dampened", value: "1" },
      ],
      summary:
        "Current profile lifts 1 story, explores 0 adjacent stories, and dampens 1 story.",
    });
  });
});

describe("getNewsInterestGraph", () => {
  it("maps reader preferences and ranked stories into topic, entity, source, and angle lanes", () => {
    expect(
      getNewsInterestGraph({
        formatCategory: (category) =>
          category === "funding"
            ? "Funding"
            : category === "agent_product"
              ? "Agents"
              : "Models",
        items: [
          {
            ...localItem,
            entities: ["OpenAI", "Agents"],
            matchedSignals: ["category", "source", "entity"],
            personalizedScore: 140,
            sourceName: "OpenAI News",
            sourceScore: 92,
            sourceSlug: "openai-news",
            tags: ["agent_memory"],
            trendScore: 90,
          },
          {
            ...localItem,
            id: "funding-openai",
            category: "funding",
            entities: ["OpenAI", "Series A"],
            matchedSignals: ["entity"],
            personalizedScore: 122,
            sourceName: "VentureWire",
            sourceScore: 84,
            sourceSlug: "venturewire",
            tags: ["seed_round"],
            trendScore: 96,
          },
          {
            ...localItem,
            id: "agent-anthropic",
            category: "agent_product",
            entities: ["Agents", "Anthropic"],
            matchedSignals: ["exploration"],
            personalizedScore: 104,
            sourceName: "Agent Desk",
            sourceScore: 78,
            sourceSlug: "agent-desk",
            tags: ["agent_memory"],
            trendScore: 88,
          },
        ],
        limit: 2,
        profile: {
          preferredCategories: ["model_release", "funding"],
          preferredSources: ["openai-news"],
          preferredEntities: ["OpenAI", "Agents"],
          noveltyBias: 1.2,
          recencyBias: 1.1,
        },
      }),
    ).toEqual({
      label: "Adaptive Profile",
      lanes: [
        {
          key: "topics",
          label: "Topics",
          nodes: [
            {
              activeSignal: true,
              label: "Models",
              score: 63,
              storyCount: 1,
            },
            {
              activeSignal: true,
              label: "Funding",
              score: 62,
              storyCount: 1,
            },
          ],
        },
        {
          key: "entities",
          label: "Entities",
          nodes: [
            {
              activeSignal: true,
              label: "OpenAI",
              score: 76,
              storyCount: 2,
            },
            {
              activeSignal: true,
              label: "Agents",
              score: 74,
              storyCount: 2,
            },
          ],
        },
        {
          key: "sources",
          label: "Sources",
          nodes: [
            {
              activeSignal: true,
              label: "OpenAI News",
              score: 56,
              storyCount: 1,
            },
            {
              activeSignal: false,
              label: "VentureWire",
              score: 18,
              storyCount: 1,
            },
          ],
        },
        {
          key: "angles",
          label: "Angles",
          nodes: [
            {
              activeSignal: false,
              label: "agent memory",
              score: 36,
              storyCount: 2,
            },
            {
              activeSignal: false,
              label: "seed round",
              score: 18,
              storyCount: 1,
            },
          ],
        },
      ],
      metrics: [
        { label: "Active signals", value: "5" },
        { label: "Topic nodes", value: "2" },
        { label: "Entity nodes", value: "2" },
        { label: "Source nodes", value: "2" },
        { label: "Angle nodes", value: "2" },
      ],
      notices: [
        {
          detail:
            "Exploration stories are feeding the graph, so the profile can keep broadening.",
          label: "Adaptive learning",
        },
        {
          detail: "OpenAI leads the graph with a 76 interest score.",
          label: "Strongest interest",
        },
      ],
      summary:
        "5 reader signals map to 8 interest nodes across 3 ranked stories.",
    });
  });

  it("keeps followed angle signals out of the entity lane", () => {
    expect(
      getNewsInterestGraph({
        formatCategory: (category) =>
          category === "security" ? "Security" : category,
        items: [
          {
            ...localItem,
            category: "security",
            entities: ["OpenAI", "Agent Security"],
            matchedSignals: ["tag"],
            personalizedScore: 144,
            sourceName: "Security Desk",
            sourceScore: 88,
            sourceSlug: "security-desk",
            tags: ["agents", "prompt-injection", "red_team"],
            trendScore: 90,
          },
          {
            ...serverItem,
            category: "security",
            entities: ["Browser Agents"],
            matchedSignals: ["tag"],
            personalizedScore: 132,
            sourceName: "Research Wire",
            sourceScore: 84,
            sourceSlug: "research-wire",
            tags: ["prompt_injection", "mitigation"],
            trendScore: 86,
          },
        ],
        limit: 3,
        profile: {
          preferredCategories: ["security"],
          preferredSources: [],
          preferredEntities: ["OpenAI", "prompt_injection"],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }).lanes,
    ).toEqual([
      {
        key: "topics",
        label: "Topics",
        nodes: [
            {
              activeSignal: true,
              label: "Security",
              score: 85,
              storyCount: 2,
            },
        ],
      },
      {
        key: "entities",
        label: "Entities",
        nodes: [
          {
            activeSignal: true,
            label: "OpenAI",
            score: 58,
            storyCount: 1,
          },
          {
            activeSignal: false,
            label: "Agent Security",
            score: 20,
            storyCount: 1,
          },
          {
            activeSignal: false,
            label: "Browser Agents",
            score: 18,
            storyCount: 1,
          },
        ],
      },
      {
        key: "sources",
        label: "Sources",
        nodes: [
          {
            activeSignal: false,
            label: "Security Desk",
            score: 21,
            storyCount: 1,
          },
          {
            activeSignal: false,
            label: "Research Wire",
            score: 19,
            storyCount: 1,
          },
        ],
      },
      {
        key: "angles",
        label: "Angles",
        nodes: [
          {
            activeSignal: true,
            label: "prompt injection",
            score: 76,
            storyCount: 2,
          },
          {
            activeSignal: false,
            label: "red team",
            score: 20,
            storyCount: 1,
          },
          {
            activeSignal: false,
            label: "mitigation",
            score: 18,
            storyCount: 1,
          },
        ],
      },
    ]);
  });

  it("keeps the cold-start graph empty before preferences or stories exist", () => {
    expect(
      getNewsInterestGraph({
        formatCategory: (category) => category,
        items: [],
        limit: 3,
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
      lanes: [
        { key: "topics", label: "Topics", nodes: [] },
        { key: "entities", label: "Entities", nodes: [] },
        { key: "sources", label: "Sources", nodes: [] },
        { key: "angles", label: "Angles", nodes: [] },
      ],
      metrics: [
        { label: "Active signals", value: "0" },
        { label: "Topic nodes", value: "0" },
        { label: "Entity nodes", value: "0" },
        { label: "Source nodes", value: "0" },
        { label: "Angle nodes", value: "0" },
      ],
      notices: [
        {
          detail:
            "Read, save, or hide stories to start building an interest graph.",
          label: "Learning needed",
        },
      ],
      summary: "Interest graph will appear as stories and reader signals load.",
    });
  });
});

describe("getNewsLiveWire", () => {
  it("builds a live aggregation wire from ranked stories", () => {
    expect(
      getNewsLiveWire({
        formatCategory: (category) =>
          category === "funding"
            ? "Funding"
            : category === "agent_product"
              ? "Agents"
              : category === "research"
                ? "Research"
                : "Models",
        items: [
          {
            ...localItem,
            matchedSignals: ["category"],
            personalizedScore: 140,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            trendScore: 88,
          },
          {
            ...localItem,
            id: "heat-spike",
            category: "funding",
            matchedSignals: [],
            personalizedScore: 117,
            publishedAt: "2026-07-01T09:30:00.000Z",
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Funding heat jumps around AI infra",
            trendScore: 96,
          },
          {
            ...localItem,
            id: "explore-update",
            category: "agent_product",
            matchedSignals: ["exploration"],
            personalizedScore: 101,
            publishedAt: "2026-07-01T10:15:00.000Z",
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "A new agent workflow lands outside the profile",
            trendScore: 84,
          },
          {
            ...localItem,
            id: "research-match",
            category: "research",
            matchedSignals: ["entity"],
            personalizedScore: 132,
            publishedAt: "2026-07-01T09:00:00.000Z",
            sourceName: "Research Wire",
            sourceSlug: "research-wire",
            title: "Researchers map the agent evaluation gap",
            trendScore: 78,
          },
        ],
        limit: 3,
      }),
    ).toEqual({
      label: "Breaking Wire",
      metrics: [
        { label: "Live stories", value: "4" },
        { label: "Sources", value: "4" },
        { label: "Topics", value: "4" },
        { label: "Hot updates", value: "1" },
      ],
      notices: [
        {
          detail:
            "Funding heat jumps around AI infra is leading live heat at 96.",
          label: "Heat spike",
        },
        {
          detail:
            "A new agent workflow lands outside the profile is the newest update from Agent Desk.",
          label: "Latest arrival",
        },
      ],
      summary: "4 live updates from 4 sources across 4 topics.",
      updates: [
        {
          categoryLabel: "Agents",
          id: "explore-update",
          personalizedScore: 101,
          publishedAt: "2026-07-01T10:15:00.000Z",
          signal: "Explore",
          sourceName: "Agent Desk",
          title: "A new agent workflow lands outside the profile",
          trendScore: 84,
        },
        {
          categoryLabel: "Funding",
          id: "heat-spike",
          personalizedScore: 117,
          publishedAt: "2026-07-01T09:30:00.000Z",
          signal: "Breaking",
          sourceName: "VentureWire",
          title: "Funding heat jumps around AI infra",
          trendScore: 96,
        },
        {
          categoryLabel: "Research",
          id: "research-match",
          personalizedScore: 132,
          publishedAt: "2026-07-01T09:00:00.000Z",
          signal: "For You",
          sourceName: "Research Wire",
          title: "Researchers map the agent evaluation gap",
          trendScore: 78,
        },
      ],
    });
  });

  it("keeps the live wire empty before stories load", () => {
    expect(
      getNewsLiveWire({
        formatCategory: (category) => category,
        items: [],
        limit: 3,
      }),
    ).toEqual({
      label: "Cold Wire",
      metrics: [
        { label: "Live stories", value: "0" },
        { label: "Sources", value: "0" },
        { label: "Topics", value: "0" },
        { label: "Hot updates", value: "0" },
      ],
      notices: [
        {
          detail: "Live wire will appear after stories are ranked.",
          label: "Waiting for crawl",
        },
      ],
      summary: "Live wire will appear as stories load.",
      updates: [],
    });
  });
});

describe("getNewsHotBoard", () => {
  it("ranks the edition into a personalized hot board", () => {
    expect(
      getNewsHotBoard({
        formatCategory: (category) =>
          category === "funding"
            ? "Funding"
            : category === "agent_product"
              ? "Agents"
              : category === "research"
                ? "Research"
                : "Models",
        items: [
          {
            ...localItem,
            matchedSignals: ["category"],
            personalizedScore: 140,
            sourceName: "OpenAI News",
            sourceScore: 90,
            sourceSlug: "openai-news",
            title: "Agent platform ranks first",
            trendScore: 88,
          },
          {
            ...localItem,
            id: "heat-story",
            category: "funding",
            matchedSignals: [],
            personalizedScore: 117,
            publishedAt: "2026-07-01T09:30:00.000Z",
            sourceName: "VentureWire",
            sourceScore: 74,
            sourceSlug: "venturewire",
            title: "Funding heat jumps around AI infra",
            trendScore: 96,
          },
          {
            ...localItem,
            id: "research-match",
            category: "research",
            matchedSignals: ["entity"],
            personalizedScore: 132,
            publishedAt: "2026-07-01T09:00:00.000Z",
            sourceName: "Research Wire",
            sourceScore: 85,
            sourceSlug: "research-wire",
            title: "Researchers map the agent evaluation gap",
            trendScore: 78,
          },
          {
            ...localItem,
            id: "explore-update",
            category: "agent_product",
            matchedSignals: ["exploration"],
            personalizedScore: 101,
            publishedAt: "2026-07-01T10:15:00.000Z",
            sourceName: "Agent Desk",
            sourceScore: 78,
            sourceSlug: "agent-desk",
            title: "A new agent workflow lands outside the profile",
            trendScore: 84,
          },
        ],
        limit: 4,
      }),
    ).toEqual({
      entries: [
        {
          categoryLabel: "Models",
          heatScore: 133,
          id: "local-story",
          label: "For You Hot",
          rank: "01",
          reason: "Reader signals lift this story above market heat.",
          scoreBreakdown: [
            { label: "Trend", value: "88" },
            { label: "Reader", value: "140" },
            { label: "Trust", value: "90" },
          ],
          sourceName: "OpenAI News",
          title: "Agent platform ranks first",
        },
        {
          categoryLabel: "Funding",
          heatScore: 126,
          id: "heat-story",
          label: "Market Hot",
          rank: "02",
          reason: "Market heat leads before the reader profile catches up.",
          scoreBreakdown: [
            { label: "Trend", value: "96" },
            { label: "Reader", value: "117" },
            { label: "Trust", value: "74" },
          ],
          sourceName: "VentureWire",
          title: "Funding heat jumps around AI infra",
        },
        {
          categoryLabel: "Research",
          heatScore: 121,
          id: "research-match",
          label: "For You Hot",
          rank: "03",
          reason: "Reader signals lift this story above market heat.",
          scoreBreakdown: [
            { label: "Trend", value: "78" },
            { label: "Reader", value: "132" },
            { label: "Trust", value: "85" },
          ],
          sourceName: "Research Wire",
          title: "Researchers map the agent evaluation gap",
        },
        {
          categoryLabel: "Agents",
          heatScore: 117,
          id: "explore-update",
          label: "Explore Hot",
          rank: "04",
          reason: "Exploration keeps a hot adjacent story in the feed.",
          scoreBreakdown: [
            { label: "Trend", value: "84" },
            { label: "Reader", value: "101" },
            { label: "Trust", value: "78" },
          ],
          sourceName: "Agent Desk",
          title: "A new agent workflow lands outside the profile",
        },
      ],
      label: "Personalized Hot Board",
      metrics: [
        { label: "Entries", value: "4" },
        { label: "For you", value: "2" },
        { label: "Market", value: "1" },
        { label: "Explore", value: "1" },
      ],
      summary:
        "4 hot-board entries mix 2 reader-matched, 1 market-led, and 1 exploration story.",
    });
  });

  it("keeps the hot board empty before stories load", () => {
    expect(
      getNewsHotBoard({
        formatCategory: (category) => category,
        items: [],
        limit: 4,
      }),
    ).toEqual({
      entries: [],
      label: "Hot Board Waiting",
      metrics: [
        { label: "Entries", value: "0" },
        { label: "For you", value: "0" },
        { label: "Market", value: "0" },
        { label: "Explore", value: "0" },
      ],
      summary: "Hot board will appear after stories are ranked.",
    });
  });
});

describe("getNewsSearchTrends", () => {
  it("turns ranked stories into personalized search trends", () => {
    expect(
      getNewsSearchTrends({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "funding"
              ? "Funding"
              : category === "agent_product"
                ? "Agents"
                : category,
        items: [
          {
            ...localItem,
            category: "model_release",
            entities: ["OpenAI", "GPT-6"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 140,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            title: "OpenAI GPT-6 rollout drives model searches",
            trendScore: 88,
          },
          {
            ...serverItem,
            category: "model_release",
            entities: ["OpenAI", "GPT-6"],
            matchedSignals: ["entity"],
            personalizedScore: 130,
            sourceName: "Research Wire",
            sourceSlug: "research-wire",
            title: "Researchers benchmark OpenAI GPT-6",
            trendScore: 84,
          },
          {
            ...olderItem,
            category: "funding",
            entities: ["Runway"],
            matchedSignals: [],
            personalizedScore: 117,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Runway funding search heat jumps",
            trendScore: 96,
          },
          {
            ...olderItem,
            id: "agent-search",
            category: "agent_product",
            entities: ["Agents", "Browser"],
            matchedSignals: ["exploration"],
            personalizedScore: 101,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Browser agent searches rise after launch",
            trendScore: 84,
          },
        ],
        limit: 4,
        profile: {
          preferredCategories: ["model_release"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["openai-news"],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      label: "Search Trends Ready",
      metrics: [
        { label: "Queries", value: "4" },
        { label: "Reader", value: "3" },
        { label: "Rising", value: "1" },
        { label: "Market", value: "0" },
      ],
      summary:
        "4 search trends connect 4 stories across reader, rising, and market demand.",
      trends: [
        {
          key: "entity:openai",
          kind: "Entity",
          label: "Reader Search",
          query: "OpenAI",
          reason: "Matches your profile and is rising across the edition.",
          score: 148,
          sourceNames: ["OpenAI News", "Research Wire"],
          supportLabel: "2 stories / 2 sources",
          topStory: {
            id: "local-story",
            sourceName: "OpenAI News",
            title: "OpenAI GPT-6 rollout drives model searches",
          },
        },
        {
          key: "topic:model_release",
          kind: "Topic",
          label: "Reader Search",
          query: "Models",
          reason: "Matches your profile and is rising across the edition.",
          score: 148,
          sourceNames: ["OpenAI News", "Research Wire"],
          supportLabel: "2 stories / 2 sources",
          topStory: {
            id: "local-story",
            sourceName: "OpenAI News",
            title: "OpenAI GPT-6 rollout drives model searches",
          },
        },
        {
          key: "source:openai-news",
          kind: "Source",
          label: "Reader Search",
          query: "OpenAI News",
          reason: "Matches your profile and is rising across the edition.",
          score: 129,
          sourceNames: ["OpenAI News"],
          supportLabel: "1 story / 1 source",
          topStory: {
            id: "local-story",
            sourceName: "OpenAI News",
            title: "OpenAI GPT-6 rollout drives model searches",
          },
        },
        {
          key: "entity:gpt-6",
          kind: "Entity",
          label: "Rising Search",
          query: "GPT-6",
          reason: "Multiple stories are pushing this query up the search rail.",
          score: 128,
          sourceNames: ["OpenAI News", "Research Wire"],
          supportLabel: "2 stories / 2 sources",
          topStory: {
            id: "local-story",
            sourceName: "OpenAI News",
            title: "OpenAI GPT-6 rollout drives model searches",
          },
        },
      ],
    });
  });

  it("turns preferred sources into clickable search trends", () => {
    expect(
      getNewsSearchTrends({
        formatCategory: (category) =>
          category === "model_release" ? "Models" : category,
        items: [
          {
            ...localItem,
            category: "model_release",
            entities: ["OpenAI"],
            matchedSignals: ["source"],
            personalizedScore: 132,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            title: "OpenAI ships a new agent runtime",
            trendScore: 87,
          },
        ],
        limit: 3,
        profile: {
          preferredCategories: [],
          preferredEntities: [],
          preferredSources: ["openai-news"],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }).trends,
    ).toContainEqual({
      key: "source:openai-news",
      kind: "Source",
      label: "Reader Search",
      query: "OpenAI News",
      reason: "Matches your profile and is rising across the edition.",
      score: 128,
      sourceNames: ["OpenAI News"],
      supportLabel: "1 story / 1 source",
      topStory: {
        id: "local-story",
        sourceName: "OpenAI News",
        title: "OpenAI ships a new agent runtime",
      },
    });
  });

  it("turns repeated story tags into clickable angle search trends", () => {
    expect(
      getNewsSearchTrends({
        formatCategory: (category) =>
          category === "security" ? "Security" : category,
        items: [
          {
            ...localItem,
            category: "security",
            entities: ["Agent Security"],
            matchedSignals: ["tag"],
            personalizedScore: 142,
            sourceName: "Security Desk",
            sourceSlug: "security-desk",
            tags: ["prompt_injection", "red_team"],
            title: "Prompt injection exploits hit browser agents",
            trendScore: 91,
          },
          {
            ...serverItem,
            category: "security",
            entities: ["Browser Agents"],
            matchedSignals: ["tag"],
            personalizedScore: 133,
            sourceName: "Research Wire",
            sourceSlug: "research-wire",
            tags: ["prompt_injection", "mitigation"],
            title: "Researchers test prompt injection mitigations",
            trendScore: 87,
          },
        ],
        limit: 4,
        profile: createDefaultNewsPreferenceProfile(),
      }).trends,
    ).toContainEqual({
      key: "tag:prompt_injection",
      kind: "Angle",
      label: "Rising Search",
      query: "prompt injection",
      reason: "Multiple stories are pushing this query up the search rail.",
      score: 131,
      sourceNames: ["Security Desk", "Research Wire"],
      supportLabel: "2 stories / 2 sources",
      topStory: {
        id: "local-story",
        sourceName: "Security Desk",
        title: "Prompt injection exploits hit browser agents",
      },
    });
  });

  it("keeps search trends empty before the edition has stories", () => {
    expect(
      getNewsSearchTrends({
        formatCategory: (category) => category,
        items: [],
        limit: 4,
        profile: createDefaultNewsPreferenceProfile(),
      }),
    ).toEqual({
      label: "Search Trends Waiting",
      metrics: [
        { label: "Queries", value: "0" },
        { label: "Reader", value: "0" },
        { label: "Rising", value: "0" },
        { label: "Market", value: "0" },
      ],
      summary: "Search trends will appear after stories are ranked.",
      trends: [],
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

describe("getNewsTopicMatchMatrix", () => {
  it("maps topics by reader fit and market heat", () => {
    expect(
      getNewsTopicMatchMatrix({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "funding"
              ? "Funding"
              : category === "research"
                ? "Research"
                : category === "agent_product"
                  ? "Agents"
                  : category,
        items: [
          {
            ...localItem,
            category: "model_release",
            matchedSignals: ["category"],
            personalizedScore: 145,
            sourceName: "Model Desk",
            sourceSlug: "model-desk",
            title: "Models stay close to the reader profile",
            trendScore: 80,
          },
          {
            ...serverItem,
            id: "funding-heat",
            category: "funding",
            matchedSignals: ["exploration"],
            personalizedScore: 110,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Funding heat is outside the profile",
            trendScore: 97,
          },
          {
            ...olderItem,
            id: "research-watch",
            category: "research",
            matchedSignals: [],
            personalizedScore: 90,
            sourceName: "Research Desk",
            sourceSlug: "research-desk",
            title: "Research heat needs monitoring",
            trendScore: 91,
          },
          {
            ...localItem,
            id: "agent-cooldown",
            category: "agent_product",
            matchedSignals: [],
            personalizedScore: 115,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Agent coverage is quieter now",
            trendScore: 60,
          },
        ],
        limit: 4,
        profile: {
          preferredCategories: ["model_release", "agent_product"],
          preferredEntities: [],
          preferredSources: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      label: "4 Topics",
      metrics: [
        { label: "Follow", value: "1" },
        { label: "Explore", value: "1" },
        { label: "Watch", value: "1" },
        { label: "Cooldown", value: "1" },
      ],
      rows: [
        {
          category: "model_release",
          heatLabel: "80 heat",
          label: "Models",
          lead: {
            id: "local-story",
            sourceName: "Model Desk",
            title: "Models stay close to the reader profile",
          },
          mode: "Follow",
          readerLabel: "2 signals",
          reason: "Reader signal and enough heat.",
          storyCount: 1,
        },
        {
          category: "funding",
          heatLabel: "97 heat",
          label: "Funding",
          lead: {
            id: "funding-heat",
            sourceName: "VentureWire",
            title: "Funding heat is outside the profile",
          },
          mode: "Explore",
          readerLabel: "0 signals",
          reason: "High heat outside the current profile.",
          storyCount: 1,
        },
        {
          category: "research",
          heatLabel: "91 heat",
          label: "Research",
          lead: {
            id: "research-watch",
            sourceName: "Research Desk",
            title: "Research heat needs monitoring",
          },
          mode: "Watch",
          readerLabel: "0 signals",
          reason: "High heat without a reader signal yet.",
          storyCount: 1,
        },
        {
          category: "agent_product",
          heatLabel: "60 heat",
          label: "Agents",
          lead: {
            id: "agent-cooldown",
            sourceName: "Agent Desk",
            title: "Agent coverage is quieter now",
          },
          mode: "Cooldown",
          readerLabel: "1 signal",
          reason: "Reader signal is present, but heat is lower right now.",
          storyCount: 1,
        },
      ],
      summary: "4 topics mapped across reader fit and market heat.",
    });
  });

  it("returns a stable empty matrix before stories load", () => {
    expect(
      getNewsTopicMatchMatrix({
        formatCategory: (category) => category,
        items: [],
        limit: 3,
        profile: createDefaultNewsPreferenceProfile(),
      }),
    ).toEqual({
      label: "Waiting",
      metrics: [
        { label: "Follow", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Watch", value: "0" },
        { label: "Cooldown", value: "0" },
      ],
      rows: [],
      summary: "Topic match matrix will appear as stories load.",
    });
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

describe("getNewsBriefingPack", () => {
  it("packages the ranked edition into lead, latest, heat, and exploration slots", () => {
    expect(
      getNewsBriefingPack({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "funding"
              ? "Funding"
              : category === "research"
                ? "Research"
                : category === "agent_product"
                  ? "Agents"
                  : category,
        items: [
          {
            ...olderItem,
            id: "for-you-lead",
            category: "model_release",
            matchedSignals: ["category"],
            personalizedScore: 160,
            publishedAt: "2026-06-30T08:00:00.000Z",
            sourceName: "Model Desk",
            sourceSlug: "model-desk",
            title: "Personalized model story leads the pack",
            trendScore: 72,
          },
          {
            ...localItem,
            id: "latest-story",
            category: "funding",
            matchedSignals: [],
            personalizedScore: 105,
            publishedAt: "2026-07-01T12:00:00.000Z",
            sourceName: "Launch Feed",
            sourceSlug: "launch-feed",
            title: "Fresh funding launch hits the wire",
            trendScore: 65,
          },
          {
            ...serverItem,
            id: "heat-story",
            category: "research",
            matchedSignals: [],
            personalizedScore: 112,
            publishedAt: "2026-07-01T09:00:00.000Z",
            sourceName: "Heat Wire",
            sourceSlug: "heat-wire",
            title: "Research story is climbing fast",
            trendScore: 98,
          },
          {
            ...olderItem,
            id: "explore-story",
            category: "agent_product",
            matchedSignals: ["exploration"],
            personalizedScore: 96,
            publishedAt: "2026-07-01T07:00:00.000Z",
            sourceName: "Agent Scout",
            sourceSlug: "agent-scout",
            title: "Agent startup broadens the brief",
            trendScore: 81,
          },
        ],
      }),
    ).toEqual({
      label: "4 Slots",
      metrics: [
        { label: "Slots", value: "4" },
        { label: "Sources", value: "4" },
        { label: "Categories", value: "4" },
      ],
      slots: [
        {
          categoryLabel: "Models",
          id: "for-you-lead",
          label: "Lead",
          reason: "Highest-ranked For You story.",
          scoreLabel: "160 score",
          sourceName: "Model Desk",
          title: "Personalized model story leads the pack",
        },
        {
          categoryLabel: "Funding",
          id: "latest-story",
          label: "Latest",
          reason: "Freshest story in the current edition.",
          scoreLabel: "2026-07-01 12:00",
          sourceName: "Launch Feed",
          title: "Fresh funding launch hits the wire",
        },
        {
          categoryLabel: "Research",
          id: "heat-story",
          label: "Heat",
          reason: "Highest heat story still rising.",
          scoreLabel: "98 heat",
          sourceName: "Heat Wire",
          title: "Research story is climbing fast",
        },
        {
          categoryLabel: "Agents",
          id: "explore-story",
          label: "Explore",
          reason: "Exploration keeps the brief from narrowing.",
          scoreLabel: "96 score",
          sourceName: "Agent Scout",
          title: "Agent startup broadens the brief",
        },
      ],
      summary: "4 briefing slots from 4 sources across 4 categories.",
    });
  });

  it("returns a stable empty briefing pack before stories load", () => {
    expect(
      getNewsBriefingPack({
        formatCategory: (category) => category,
        items: [],
      }),
    ).toEqual({
      label: "Waiting",
      metrics: [
        { label: "Slots", value: "0" },
        { label: "Sources", value: "0" },
        { label: "Categories", value: "0" },
      ],
      slots: [],
      summary: "Briefing pack will appear as stories load.",
    });
  });
});

describe("getNewsFrontPageLayout", () => {
  it("composes ranked AI stories into an A1-style front page layout", () => {
    expect(
      getNewsFrontPageLayout({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "research"
              ? "Research"
              : category === "funding"
                ? "Funding"
                : category === "agent_product"
                  ? "Agents"
                  : category,
        items: [
          {
            ...localItem,
            id: "a1-lead",
            category: "model_release",
            entities: ["OpenAI", "GPT-6"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 170,
            sourceName: "Model Desk",
            sourceScore: 92,
            sourceSlug: "model-desk",
            title: "OpenAI model launch anchors the AI cycle",
            trendScore: 88,
          },
          {
            ...serverItem,
            id: "analysis-story",
            category: "research",
            entities: ["OpenAI", "GPT-6", "Evaluation"],
            matchedSignals: ["entity"],
            personalizedScore: 143,
            sourceName: "Research Review",
            sourceScore: 95,
            sourceSlug: "research-review",
            title: "Evaluation teams unpack the model launch",
            trendScore: 78,
          },
          {
            ...olderItem,
            id: "market-brief",
            category: "funding",
            entities: ["Series B"],
            matchedSignals: [],
            personalizedScore: 118,
            sourceName: "VentureWire",
            sourceScore: 76,
            sourceSlug: "venturewire",
            title: "Funding heat rises around model tooling",
            trendScore: 96,
          },
          {
            ...olderItem,
            id: "watch-story",
            category: "agent_product",
            entities: ["Agents"],
            matchedSignals: ["exploration"],
            personalizedScore: 101,
            sourceName: "Agent Scout",
            sourceScore: 82,
            sourceSlug: "agent-scout",
            title: "Agent workflow startup tests a new channel",
            trendScore: 84,
          },
        ],
      }),
    ).toEqual({
      label: "A1 Ready",
      metrics: [
        { label: "Sections", value: "4" },
        { label: "Sources", value: "4" },
        { label: "Categories", value: "4" },
      ],
      sections: [
        {
          categoryLabel: "Models",
          id: "a1-lead",
          label: "A1 Lead",
          reason: "Highest-ranked story anchors the front page.",
          scoreLabel: "170 score",
          sourceName: "Model Desk",
          title: "OpenAI model launch anchors the AI cycle",
          treatment: "Lead headline",
        },
        {
          categoryLabel: "Research",
          id: "analysis-story",
          label: "Analysis",
          reason: "Entity-dense follow-up gives the lead story context.",
          scoreLabel: "3 entities",
          sourceName: "Research Review",
          title: "Evaluation teams unpack the model launch",
          treatment: "Context column",
        },
        {
          categoryLabel: "Funding",
          id: "market-brief",
          label: "Brief",
          reason:
            "Highest-heat remaining story gives the page a live market note.",
          scoreLabel: "96 heat",
          sourceName: "VentureWire",
          title: "Funding heat rises around model tooling",
          treatment: "News brief",
        },
        {
          categoryLabel: "Agents",
          id: "watch-story",
          label: "Watch",
          reason: "Exploration story keeps a discovery lane on the front page.",
          scoreLabel: "101 score",
          sourceName: "Agent Scout",
          title: "Agent workflow startup tests a new channel",
          treatment: "Watch rail",
        },
      ],
      summary: "4 front-page sections from 4 sources across 4 categories.",
    });
  });

  it("keeps the front page layout explicit before ranked stories arrive", () => {
    expect(
      getNewsFrontPageLayout({
        formatCategory: (category) => category,
        items: [],
      }),
    ).toEqual({
      label: "Waiting",
      metrics: [
        { label: "Sections", value: "0" },
        { label: "Sources", value: "0" },
        { label: "Categories", value: "0" },
      ],
      sections: [],
      summary: "Front page layout will appear after stories are ranked.",
    });
  });
});

describe("getNewsFrontPageSlotMix", () => {
  it("assigns ranked stories to recommendation slots for the front page", () => {
    expect(
      getNewsFrontPageSlotMix({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "research"
              ? "Research"
              : category === "agent_product"
                ? "Agents"
                : category === "funding"
                  ? "Funding"
                  : category,
        items: [
          {
            ...localItem,
            id: "lead-model",
            category: "model_release",
            entities: ["OpenAI", "GPT-6"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 170,
            sourceName: "Model Desk",
            sourceScore: 94,
            sourceSlug: "model-desk",
            title: "OpenAI model launch anchors the edition",
            trendScore: 89,
          },
          {
            ...serverItem,
            id: "follow-research",
            category: "research",
            entities: ["OpenAI", "Evaluation"],
            matchedSignals: ["entity"],
            personalizedScore: 142,
            sourceName: "Research Review",
            sourceScore: 91,
            sourceSlug: "research-review",
            title: "Evaluation teams explain the launch",
            trendScore: 78,
          },
          {
            ...olderItem,
            id: "explore-agent",
            category: "agent_product",
            entities: ["Agents"],
            matchedSignals: ["exploration"],
            personalizedScore: 118,
            sourceName: "Agent Scout",
            sourceScore: 82,
            sourceSlug: "agent-scout",
            title: "Agent workflow startup tests memory",
            trendScore: 84,
          },
          {
            ...olderItem,
            id: "cooldown-funding",
            category: "funding",
            entities: ["Series A"],
            matchedSignals: [],
            personalizedScore: 104,
            sourceName: "VentureWire",
            sourceScore: 76,
            sourceSlug: "venturewire",
            title: "Funding heat cools around AI infra",
            trendScore: 93,
          },
        ],
        profile: {
          preferredCategories: ["model_release"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["model-desk"],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      label: "Slot Mix Ready",
      metrics: [
        { label: "Slots", value: "4" },
        { label: "Reader-led", value: "2" },
        { label: "Exploration", value: "1" },
        { label: "Cooldown", value: "1" },
      ],
      slots: [
        {
          categoryLabel: "Models",
          id: "lead-model",
          key: "lead",
          label: "Lead",
          reason:
            "Highest personalized score leads because 2 reader signals are active.",
          scoreLabel: "170 score",
          sourceName: "Model Desk",
          title: "OpenAI model launch anchors the edition",
          treatment: "Top story",
        },
        {
          categoryLabel: "Research",
          id: "follow-research",
          key: "follow_up",
          label: "Follow-up",
          reason:
            "Shares OpenAI with the lead and keeps the reader in context.",
          scoreLabel: "1 shared entity",
          sourceName: "Research Review",
          title: "Evaluation teams explain the launch",
          treatment: "Context slot",
        },
        {
          categoryLabel: "Agents",
          id: "explore-agent",
          key: "explore",
          label: "Explore",
          reason: "Exploration signal tests Agents outside the active profile.",
          scoreLabel: "118 score",
          sourceName: "Agent Scout",
          title: "Agent workflow startup tests memory",
          treatment: "Discovery slot",
        },
        {
          categoryLabel: "Funding",
          id: "cooldown-funding",
          key: "cooldown",
          label: "Cooldown",
          reason:
            "No active reader signal, so the story stays below stronger matches.",
          scoreLabel: "93 heat",
          sourceName: "VentureWire",
          title: "Funding heat cools around AI infra",
          treatment: "Market slot",
        },
      ],
      summary:
        "4 front-page slots balance 2 reader-led stories, 1 exploration story, and 1 cooldown candidate.",
    });
  });

  it("uses active angle preferences to select front-page follow-up stories", () => {
    expect(
      getNewsFrontPageSlotMix({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "security"
              ? "Security"
              : category === "agent_product"
                ? "Agents"
                : "Markets",
        items: [
          {
            ...localItem,
            category: "model_release",
            entities: ["OpenAI"],
            id: "lead-model",
            matchedSignals: [],
            personalizedScore: 168,
            sourceName: "Model Desk",
            sourceSlug: "model-desk",
            title: "Model launch leads the edition",
            trendScore: 92,
          },
          {
            ...localItem,
            category: "security",
            entities: ["Anthropic"],
            id: "angle-follow-up",
            matchedSignals: [],
            personalizedScore: 127,
            sourceName: "Security Desk",
            sourceSlug: "security-desk",
            tags: ["prompt_injection"],
            title: "Prompt injection defenses follow the model launch",
            trendScore: 86,
          },
          {
            ...olderItem,
            category: "agent_product",
            entities: ["Agents"],
            id: "explore-agent",
            matchedSignals: ["exploration"],
            personalizedScore: 118,
            sourceName: "Agent Scout",
            sourceSlug: "agent-scout",
            title: "Agent workflow startup tests memory",
            trendScore: 84,
          },
          {
            ...olderItem,
            category: "market_map",
            entities: ["GPU Cloud"],
            id: "cooldown-market",
            matchedSignals: [],
            personalizedScore: 101,
            sourceName: "Market Wire",
            sourceSlug: "market-wire",
            title: "GPU cloud market cools",
            trendScore: 91,
          },
        ],
        profile: {
          preferredCategories: [],
          preferredEntities: ["prompt_injection"],
          preferredSources: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      label: "Slot Mix Ready",
      metrics: [
        { label: "Slots", value: "4" },
        { label: "Reader-led", value: "2" },
        { label: "Exploration", value: "1" },
        { label: "Cooldown", value: "1" },
      ],
      slots: [
        {
          categoryLabel: "Models",
          id: "lead-model",
          key: "lead",
          label: "Lead",
          reason:
            "Highest personalized score leads because 0 reader signals are active.",
          scoreLabel: "168 score",
          sourceName: "Model Desk",
          title: "Model launch leads the edition",
          treatment: "Top story",
        },
        {
          categoryLabel: "Security",
          id: "angle-follow-up",
          key: "follow_up",
          label: "Follow-up",
          reason: "Matches the active profile and keeps the reader in context.",
          scoreLabel: "1 reader signal",
          sourceName: "Security Desk",
          title: "Prompt injection defenses follow the model launch",
          treatment: "Context slot",
        },
        {
          categoryLabel: "Agents",
          id: "explore-agent",
          key: "explore",
          label: "Explore",
          reason: "Exploration signal tests Agents outside the active profile.",
          scoreLabel: "118 score",
          sourceName: "Agent Scout",
          title: "Agent workflow startup tests memory",
          treatment: "Discovery slot",
        },
        {
          categoryLabel: "Markets",
          id: "cooldown-market",
          key: "cooldown",
          label: "Cooldown",
          reason:
            "No active reader signal, so the story stays below stronger matches.",
          scoreLabel: "91 heat",
          sourceName: "Market Wire",
          title: "GPU cloud market cools",
          treatment: "Market slot",
        },
      ],
      summary:
        "4 front-page slots balance 2 reader-led stories, 1 exploration story, and 1 cooldown candidate.",
    });
  });

  it("keeps the slot mix empty before ranked stories arrive", () => {
    expect(
      getNewsFrontPageSlotMix({
        formatCategory: (category) => category,
        items: [],
        profile: localProfile,
      }),
    ).toEqual({
      label: "Slot Mix Waiting",
      metrics: [
        { label: "Slots", value: "0" },
        { label: "Reader-led", value: "0" },
        { label: "Exploration", value: "0" },
        { label: "Cooldown", value: "0" },
      ],
      slots: [],
      summary: "Front-page slot mix will appear after stories are ranked.",
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

describe("getNewsSourceClusters", () => {
  it("clusters same-event AI coverage across multiple sources", () => {
    expect(
      getNewsSourceClusters({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category,
        items: [
          {
            ...localItem,
            id: "cluster-openai-lead",
            category: "model_release",
            entities: ["OpenAI", "GPT-6"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 168,
            sourceName: "Model Desk",
            sourceScore: 94,
            sourceSlug: "model-desk",
            title: "OpenAI GPT-6 model release sets new coding mark",
            trendScore: 90,
          },
          {
            ...serverItem,
            id: "cluster-openai-source",
            category: "model_release",
            entities: ["OpenAI", "GPT-6"],
            matchedSignals: ["entity"],
            personalizedScore: 142,
            sourceName: "Research Wire",
            sourceScore: 88,
            sourceSlug: "research-wire",
            title: "Researchers benchmark OpenAI GPT-6 coding release",
            trendScore: 84,
          },
          {
            ...olderItem,
            id: "cluster-openai-market",
            category: "model_release",
            entities: ["OpenAI", "GPT-6", "Developers"],
            matchedSignals: [],
            personalizedScore: 118,
            sourceName: "Developer News",
            sourceScore: 82,
            sourceSlug: "developer-news",
            title: "Developers test OpenAI GPT-6 model release",
            trendScore: 82,
          },
          {
            ...olderItem,
            id: "cluster-agent-lead",
            category: "agent_product",
            entities: ["Agents", "Browser"],
            matchedSignals: ["exploration"],
            personalizedScore: 134,
            sourceName: "Agent Scout",
            sourceScore: 78,
            sourceSlug: "agent-scout",
            title: "Browser agent startup launches memory workflow",
            trendScore: 83,
          },
          {
            ...olderItem,
            id: "cluster-agent-source",
            category: "agent_product",
            entities: ["Agents", "Browser"],
            matchedSignals: [],
            personalizedScore: 111,
            sourceName: "Product Hunt",
            sourceScore: 69,
            sourceSlug: "product-hunt",
            title: "Browser agent memory workflow climbs launch charts",
            trendScore: 77,
          },
        ],
        limit: 2,
        storiesPerCluster: 3,
      }),
    ).toEqual({
      clusters: [
        {
          averageTrustScore: 88,
          categoryLabel: "Models",
          commonSignals: ["OpenAI", "GPT-6"],
          heatScore: 320,
          key: "model_release:openai:gpt-6",
          lead: {
            id: "cluster-openai-lead",
            personalizedScore: 168,
            sourceName: "Model Desk",
            title: "OpenAI GPT-6 model release sets new coding mark",
          },
          sourceCount: 3,
          storyCount: 3,
          summary: "3 reports from 3 sources converge on OpenAI and GPT-6.",
          supportingStories: [
            {
              id: "cluster-openai-source",
              sourceName: "Research Wire",
              sourceScore: 88,
              title: "Researchers benchmark OpenAI GPT-6 coding release",
            },
            {
              id: "cluster-openai-market",
              sourceName: "Developer News",
              sourceScore: 82,
              title: "Developers test OpenAI GPT-6 model release",
            },
          ],
        },
        {
          averageTrustScore: 74,
          categoryLabel: "Agents",
          commonSignals: ["Agents", "Browser"],
          heatScore: 258,
          key: "agent_product:agents:browser",
          lead: {
            id: "cluster-agent-lead",
            personalizedScore: 134,
            sourceName: "Agent Scout",
            title: "Browser agent startup launches memory workflow",
          },
          sourceCount: 2,
          storyCount: 2,
          summary: "2 reports from 2 sources converge on Agents and Browser.",
          supportingStories: [
            {
              id: "cluster-agent-source",
              sourceName: "Product Hunt",
              sourceScore: 69,
              title: "Browser agent memory workflow climbs launch charts",
            },
          ],
        },
      ],
      label: "Source Clusters Ready",
      metrics: [
        { label: "Clusters", value: "2" },
        { label: "Stories", value: "5" },
        { label: "Sources", value: "5" },
        { label: "Avg trust", value: "83" },
      ],
      summary: "2 source clusters consolidate 5 stories from 5 sources.",
    });
  });

  it("keeps source clusters empty before stories cluster", () => {
    expect(
      getNewsSourceClusters({
        formatCategory: (category) => category,
        items: [],
        limit: 2,
        storiesPerCluster: 3,
      }),
    ).toEqual({
      clusters: [],
      label: "Source Clusters Waiting",
      metrics: [
        { label: "Clusters", value: "0" },
        { label: "Stories", value: "0" },
        { label: "Sources", value: "0" },
        { label: "Avg trust", value: "0" },
      ],
      summary: "Source clusters will appear after related stories are ranked.",
    });
  });
});

describe("getNewsClaimTracker", () => {
  it("tracks corroborated and developing AI claims across sources", () => {
    expect(
      getNewsClaimTracker({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category,
        items: [
          {
            ...localItem,
            id: "claim-openai-lead",
            category: "model_release",
            entities: ["OpenAI", "GPT-6"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 168,
            sourceName: "Model Desk",
            sourceScore: 94,
            sourceSlug: "model-desk",
            title: "OpenAI GPT-6 model release sets new coding mark",
            trendScore: 90,
          },
          {
            ...serverItem,
            id: "claim-openai-source",
            category: "model_release",
            entities: ["OpenAI", "GPT-6"],
            matchedSignals: ["entity"],
            personalizedScore: 142,
            sourceName: "Research Wire",
            sourceScore: 88,
            sourceSlug: "research-wire",
            title: "Researchers benchmark OpenAI GPT-6 coding release",
            trendScore: 84,
          },
          {
            ...olderItem,
            id: "claim-openai-market",
            category: "model_release",
            entities: ["OpenAI", "GPT-6", "Developers"],
            matchedSignals: [],
            personalizedScore: 118,
            sourceName: "Developer News",
            sourceScore: 82,
            sourceSlug: "developer-news",
            title: "Developers test OpenAI GPT-6 model release",
            trendScore: 82,
          },
          {
            ...olderItem,
            id: "claim-agent-lead",
            category: "agent_product",
            entities: ["Agents", "Browser"],
            matchedSignals: ["exploration"],
            personalizedScore: 134,
            sourceName: "Agent Scout",
            sourceScore: 78,
            sourceSlug: "agent-scout",
            title: "Browser agent startup launches memory workflow",
            trendScore: 83,
          },
          {
            ...olderItem,
            id: "claim-agent-source",
            category: "agent_product",
            entities: ["Agents", "Browser"],
            matchedSignals: [],
            personalizedScore: 111,
            sourceName: "Product Hunt",
            sourceScore: 69,
            sourceSlug: "product-hunt",
            title: "Browser agent memory workflow climbs launch charts",
            trendScore: 77,
          },
        ],
        limit: 2,
        storiesPerClaim: 3,
      }),
    ).toEqual({
      claims: [
        {
          categoryLabel: "Models",
          claim: "OpenAI and GPT-6 are the claim focus across model coverage.",
          confidenceLabel: "High confidence",
          evidence: [
            {
              id: "claim-openai-lead",
              signalLabel: "OpenAI / GPT-6",
              sourceName: "Model Desk",
              title: "OpenAI GPT-6 model release sets new coding mark",
            },
            {
              id: "claim-openai-source",
              signalLabel: "OpenAI / GPT-6",
              sourceName: "Research Wire",
              title: "Researchers benchmark OpenAI GPT-6 coding release",
            },
            {
              id: "claim-openai-market",
              signalLabel: "OpenAI / GPT-6",
              sourceName: "Developer News",
              title: "Developers test OpenAI GPT-6 model release",
            },
          ],
          key: "model_release:openai:gpt-6",
          label: "Corroborated",
          lead: {
            id: "claim-openai-lead",
            sourceName: "Model Desk",
            title: "OpenAI GPT-6 model release sets new coding mark",
          },
          sourceNames: ["Model Desk", "Research Wire", "Developer News"],
          supportLabel: "3 sources / 3 reports",
        },
        {
          categoryLabel: "Agents",
          claim:
            "Agents and Browser are the claim focus across agent coverage.",
          confidenceLabel: "Medium confidence",
          evidence: [
            {
              id: "claim-agent-lead",
              signalLabel: "Agents / Browser",
              sourceName: "Agent Scout",
              title: "Browser agent startup launches memory workflow",
            },
            {
              id: "claim-agent-source",
              signalLabel: "Agents / Browser",
              sourceName: "Product Hunt",
              title: "Browser agent memory workflow climbs launch charts",
            },
          ],
          key: "agent_product:agents:browser",
          label: "Developing",
          lead: {
            id: "claim-agent-lead",
            sourceName: "Agent Scout",
            title: "Browser agent startup launches memory workflow",
          },
          sourceNames: ["Agent Scout", "Product Hunt"],
          supportLabel: "2 sources / 2 reports",
        },
      ],
      label: "Claim Tracker Ready",
      metrics: [
        { label: "Claims", value: "2" },
        { label: "Corroborated", value: "1" },
        { label: "Developing", value: "1" },
        { label: "Single source", value: "0" },
      ],
      summary:
        "2 tracked claims: 1 corroborated, 1 developing, and 0 single-source.",
    });
  });

  it("returns a waiting state before claim evidence clusters", () => {
    expect(
      getNewsClaimTracker({
        formatCategory: (category) => category,
        items: [],
        limit: 2,
        storiesPerClaim: 3,
      }),
    ).toEqual({
      claims: [],
      label: "Claim Tracker Waiting",
      metrics: [
        { label: "Claims", value: "0" },
        { label: "Corroborated", value: "0" },
        { label: "Developing", value: "0" },
        { label: "Single source", value: "0" },
      ],
      summary: "Claim tracker will appear after story evidence clusters.",
    });
  });
});

describe("getNewsStoryTimeline", () => {
  it("orders the edition into a chronological story timeline", () => {
    expect(
      getNewsStoryTimeline({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category === "funding"
                ? "Funding"
                : category === "research"
                  ? "Research"
                  : category,
        items: [
          {
            ...localItem,
            id: "timeline-model-lead",
            category: "model_release",
            entities: ["OpenAI", "GPT-6"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 168,
            publishedAt: "2026-07-01T09:30:00.000Z",
            sourceName: "Model Desk",
            sourceSlug: "model-desk",
            title: "OpenAI GPT-6 model release sets new coding mark",
            trendScore: 89,
          },
          {
            ...serverItem,
            id: "timeline-research-follow",
            category: "research",
            entities: ["OpenAI", "GPT-6", "Evaluation"],
            matchedSignals: ["entity"],
            personalizedScore: 142,
            publishedAt: "2026-07-01T08:45:00.000Z",
            sourceName: "Research Wire",
            sourceSlug: "research-wire",
            title: "Researchers benchmark OpenAI GPT-6 coding release",
            trendScore: 78,
          },
          {
            ...olderItem,
            id: "timeline-market-reaction",
            category: "funding",
            entities: ["Series B"],
            matchedSignals: [],
            personalizedScore: 118,
            publishedAt: "2026-07-01T10:00:00.000Z",
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Funding heat rises around AI model tooling",
            trendScore: 96,
          },
          {
            ...olderItem,
            id: "timeline-agent-context",
            category: "agent_product",
            entities: ["Agents"],
            matchedSignals: ["exploration"],
            personalizedScore: 121,
            publishedAt: "2026-07-01T10:15:00.000Z",
            sourceName: "Agent Scout",
            sourceSlug: "agent-scout",
            title: "Agent workflow startup tests a new channel",
            trendScore: 84,
          },
        ],
        limit: 4,
      }),
    ).toEqual({
      events: [
        {
          categoryLabel: "Agents",
          entities: ["Agents"],
          heatLabel: "84 heat / 121 score",
          id: "timeline-agent-context",
          rank: "01",
          reason:
            "Exploration keeps adjacent developments in the reader edition.",
          signalLabel: "Context update",
          sourceName: "Agent Scout",
          timeLabel: "Jul 1, 10:15",
          title: "Agent workflow startup tests a new channel",
        },
        {
          categoryLabel: "Funding",
          entities: ["Series B"],
          heatLabel: "96 heat / 118 score",
          id: "timeline-market-reaction",
          rank: "02",
          reason: "Trend heat is moving faster than the reader profile.",
          signalLabel: "Market reaction",
          sourceName: "VentureWire",
          timeLabel: "Jul 1, 10:00",
          title: "Funding heat rises around AI model tooling",
        },
        {
          categoryLabel: "Models",
          entities: ["OpenAI", "GPT-6"],
          heatLabel: "89 heat / 168 score",
          id: "timeline-model-lead",
          rank: "03",
          reason:
            "Reader signals put this development at the center of the story.",
          signalLabel: "Lead development",
          sourceName: "Model Desk",
          timeLabel: "Jul 1, 09:30",
          title: "OpenAI GPT-6 model release sets new coding mark",
        },
        {
          categoryLabel: "Research",
          entities: ["OpenAI", "GPT-6"],
          heatLabel: "78 heat / 142 score",
          id: "timeline-research-follow",
          rank: "04",
          reason: "Earlier coverage adds context to the timeline.",
          signalLabel: "Follow-up",
          sourceName: "Research Wire",
          timeLabel: "Jul 1, 08:45",
          title: "Researchers benchmark OpenAI GPT-6 coding release",
        },
      ],
      label: "Story Timeline Ready",
      metrics: [
        { label: "Events", value: "4" },
        { label: "Sources", value: "4" },
        { label: "Topics", value: "4" },
        { label: "Latest", value: "Jul 1, 10:15" },
      ],
      summary:
        "4 timeline events show how 4 stories developed across 4 sources.",
    });
  });

  it("keeps the timeline empty before ranked stories arrive", () => {
    expect(
      getNewsStoryTimeline({
        formatCategory: (category) => category,
        items: [],
        limit: 4,
      }),
    ).toEqual({
      events: [],
      label: "Story Timeline Waiting",
      metrics: [
        { label: "Events", value: "0" },
        { label: "Sources", value: "0" },
        { label: "Topics", value: "0" },
        { label: "Latest", value: "None" },
      ],
      summary: "Story timeline will appear after ranked stories are available.",
    });
  });
});

describe("getNewsCoverageThreads", () => {
  it("groups multi-source coverage around repeated AI entities", () => {
    expect(
      getNewsCoverageThreads({
        items: [
          {
            ...localItem,
            entities: ["OpenAI", "Agents"],
            matchedSignals: ["category"],
            personalizedScore: 150,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            title: "OpenAI agent platform sets the lead",
            trendScore: 88,
          },
          {
            ...localItem,
            id: "openai-funding",
            category: "funding",
            entities: ["OpenAI", "Series A"],
            matchedSignals: ["entity"],
            personalizedScore: 128,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Investors chase OpenAI agent startups",
            trendScore: 82,
          },
          {
            ...localItem,
            id: "openai-research",
            category: "research",
            entities: ["openai", "Evaluation"],
            matchedSignals: [],
            personalizedScore: 118,
            sourceName: "Research Wire",
            sourceSlug: "research-wire",
            title: "Researchers test OpenAI agent reliability",
            trendScore: 76,
          },
          {
            ...localItem,
            id: "anthropic-agent",
            category: "agent_product",
            entities: ["Anthropic", "Agents"],
            matchedSignals: ["exploration"],
            personalizedScore: 122,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Anthropic agent tooling gets a new wrapper",
            trendScore: 84,
          },
          {
            ...localItem,
            id: "solo-launch",
            category: "open_source",
            entities: ["LangChain"],
            matchedSignals: [],
            personalizedScore: 110,
            sourceName: "OSS Desk",
            sourceSlug: "oss-desk",
            title: "LangChain ships a single open source update",
            trendScore: 79,
          },
        ],
        limit: 2,
        storiesPerThread: 3,
      }),
    ).toEqual({
      summary: "2 coverage threads from 5 ranked stories.",
      threads: [
        {
          entity: "OpenAI",
          heatScore: 184,
          lead: {
            category: "model_release",
            id: "local-story",
            personalizedScore: 150,
            sourceName: "OpenAI News",
            title: "OpenAI agent platform sets the lead",
          },
          sourceCount: 3,
          storyCount: 3,
          summary: "3 stories from 3 sources connect around OpenAI.",
          supportingStories: [
            {
              category: "funding",
              id: "openai-funding",
              personalizedScore: 128,
              sourceName: "VentureWire",
              title: "Investors chase OpenAI agent startups",
            },
            {
              category: "research",
              id: "openai-research",
              personalizedScore: 118,
              sourceName: "Research Wire",
              title: "Researchers test OpenAI agent reliability",
            },
          ],
          verificationLabel: "Verified thread",
          verificationSummary:
            "3 independent sources with 80 average trust support this thread.",
        },
        {
          entity: "Agents",
          heatScore: 154,
          lead: {
            category: "model_release",
            id: "local-story",
            personalizedScore: 150,
            sourceName: "OpenAI News",
            title: "OpenAI agent platform sets the lead",
          },
          sourceCount: 2,
          storyCount: 2,
          summary: "2 stories from 2 sources connect around Agents.",
          supportingStories: [
            {
              category: "agent_product",
              id: "anthropic-agent",
              personalizedScore: 122,
              sourceName: "Agent Desk",
              title: "Anthropic agent tooling gets a new wrapper",
            },
          ],
          verificationLabel: "Verified thread",
          verificationSummary:
            "2 independent sources with 80 average trust support this thread.",
        },
      ],
    });
  });

  it("marks repeated single-source coverage as developing instead of verified", () => {
    expect(
      getNewsCoverageThreads({
        items: [
          {
            ...localItem,
            entities: ["LangChain"],
            matchedSignals: [],
            personalizedScore: 130,
            sourceName: "Agent Desk",
            sourceScore: 82,
            sourceSlug: "agent-desk",
            title: "LangChain ships an agent runtime update",
            trendScore: 82,
          },
          {
            ...olderItem,
            entities: ["LangChain"],
            id: "langchain-follow-up",
            matchedSignals: [],
            personalizedScore: 120,
            sourceName: "Agent Desk",
            sourceScore: 82,
            sourceSlug: "agent-desk",
            title: "LangChain runtime update gets developer examples",
            trendScore: 78,
          },
        ],
        limit: 1,
        storiesPerThread: 2,
      }).threads[0],
    ).toEqual(
      expect.objectContaining({
        entity: "LangChain",
        sourceCount: 1,
        storyCount: 2,
        verificationLabel: "Developing thread",
        verificationSummary:
          "2 reports from Agent Desk are still waiting for independent confirmation.",
      }),
    );
  });

  it("returns an empty coverage state when no entity repeats", () => {
    expect(
      getNewsCoverageThreads({
        items: [
          {
            ...localItem,
            entities: ["OpenAI"],
            matchedSignals: [],
            personalizedScore: 100,
          },
          {
            ...localItem,
            id: "anthropic-story",
            entities: ["Anthropic"],
            matchedSignals: [],
            personalizedScore: 98,
          },
        ],
        limit: 3,
        storiesPerThread: 3,
      }),
    ).toEqual({
      summary: "Coverage threads will appear as stories cluster.",
      threads: [],
    });
  });
});

describe("getNewsConsensusBoard", () => {
  it("labels verified, single-source, and high-risk AI news threads", () => {
    expect(
      getNewsConsensusBoard({
        items: [
          {
            ...localItem,
            entities: ["OpenAI, Inc.", "Agents"],
            matchedSignals: ["category"],
            personalizedScore: 150,
            sourceName: "OpenAI News",
            sourceScore: 92,
            sourceSlug: "openai-news",
            title: "OpenAI ships agent update",
            trendScore: 90,
          },
          {
            ...serverItem,
            entities: ["OpenAI, Inc."],
            matchedSignals: ["entity"],
            personalizedScore: 132,
            sourceName: "Model Lab",
            sourceScore: 84,
            sourceSlug: "model-lab",
            title: "Analysts unpack OpenAI agent update",
            trendScore: 86,
          },
          {
            ...olderItem,
            category: "funding",
            entities: ["YC"],
            matchedSignals: [],
            personalizedScore: 108,
            sourceName: "VentureWire",
            sourceScore: 74,
            sourceSlug: "venturewire",
            title: "YC startup raises seed round",
            trendScore: 82,
          },
          {
            ...olderItem,
            category: "hot_take",
            entities: ["Runway"],
            id: "low-trust-heat",
            matchedSignals: ["exploration"],
            personalizedScore: 95,
            sourceName: "Rumor Feed",
            sourceScore: 45,
            sourceSlug: "rumor-feed",
            title: "Runway rumor spreads fast",
            trendScore: 94,
          },
        ],
        limit: 3,
        storiesPerThread: 2,
      }),
    ).toEqual({
      label: "3 Threads",
      metrics: [
        { label: "Verified", value: "1" },
        { label: "Single-source", value: "2" },
        { label: "High-risk", value: "1" },
      ],
      summary:
        "3 consensus threads: 1 verified, 2 single-source, and 1 high-risk.",
      threads: [
        {
          confidenceLabel: "2 sources / 88 trust",
          entity: "OpenAI, Inc.",
          label: "Verified",
          reason: "Multiple credible sources are covering this thread.",
          stories: [
            {
              id: "local-story",
              sourceName: "OpenAI News",
              title: "OpenAI ships agent update",
            },
            {
              id: "server-story",
              sourceName: "Model Lab",
              title: "Analysts unpack OpenAI agent update",
            },
          ],
        },
        {
          confidenceLabel: "1 source / 45 trust",
          entity: "Runway",
          label: "High-risk",
          reason: "High heat is coming from a lower-trust single source.",
          stories: [
            {
              id: "low-trust-heat",
              sourceName: "Rumor Feed",
              title: "Runway rumor spreads fast",
            },
          ],
        },
        {
          confidenceLabel: "1 source / 74 trust",
          entity: "YC",
          label: "Single-source",
          reason: "Only one source is covering this thread so far.",
          stories: [
            {
              id: "older-story",
              sourceName: "VentureWire",
              title: "YC startup raises seed round",
            },
          ],
        },
      ],
    });
  });

  it("returns a waiting state before stories cluster", () => {
    expect(
      getNewsConsensusBoard({
        items: [],
        limit: 3,
        storiesPerThread: 2,
      }),
    ).toEqual({
      label: "Waiting",
      metrics: [
        { label: "Verified", value: "0" },
        { label: "Single-source", value: "0" },
        { label: "High-risk", value: "0" },
      ],
      summary: "Consensus board will appear as stories cluster.",
      threads: [],
    });
  });
});

describe("getNewsPersonalizedReadingQueue", () => {
  it("places a reader-memory follow-up after the lead when a read anchor overlaps", () => {
    const queue = getNewsPersonalizedReadingQueue({
      formatCategory: (category) =>
        category === "model_release" ? "Models" : category,
      historyItems: [
        {
          ...localItem,
          id: "read-openai-agent",
          entities: ["OpenAI"],
          sourceName: "Model Desk",
          sourceSlug: "model-desk",
          title: "Read OpenAI agent setup",
        },
      ],
      items: [
        {
          ...localItem,
          id: "openai-lead",
          entities: ["OpenAI"],
          matchedSignals: ["category", "entity"],
          personalizedScore: 170,
          sourceName: "Model Desk",
          title: "OpenAI leads the morning model brief",
          trendScore: 96,
        },
        {
          ...localItem,
          id: "anthropic-depth",
          category: "research",
          entities: ["Anthropic", "Claude", "Safety", "Evals"],
          matchedSignals: [],
          personalizedScore: 148,
          sourceName: "Research Notes",
          sourceScore: 96,
          tags: ["research", "safety", "eval", "benchmark"],
          title: "Anthropic safety analysis is the densest deep dive",
          trendScore: 88,
        },
        {
          ...localItem,
          id: "openai-follow-up",
          entities: ["OpenAI", "Agents"],
          matchedSignals: ["entity"],
          personalizedScore: 126,
          sourceName: "Agent Desk",
          sourceScore: 82,
          tags: ["agent"],
          title: "OpenAI agent workflow gets a deployment follow-up",
          trendScore: 82,
        },
      ],
      negativeFeedbackItems: [],
      savedItems: [],
    });

    expect(queue.slots[1]).toEqual({
      intent: "Follow Interest",
      label: "Continue thread",
      reason: "OpenAI from your reading history anchors this follow-up.",
      story: {
        id: "openai-follow-up",
        personalizedScore: 126,
        sourceName: "Agent Desk",
        title: "OpenAI agent workflow gets a deployment follow-up",
      },
    });
  });

  it("keeps stories matching Less feedback out of the reading queue", () => {
    const queue = getNewsPersonalizedReadingQueue({
      items: [
        {
          ...localItem,
          matchedSignals: ["category"],
          personalizedScore: 150,
          trendScore: 78,
        },
        {
          ...localItem,
          id: "hidden-funding-follow-up",
          category: "funding",
          entities: ["YC", "Series A"],
          matchedSignals: [],
          personalizedScore: 148,
          sourceName: "VentureWire",
          sourceScore: 98,
          sourceSlug: "venturewire",
          tags: ["funding", "venture", "round"],
          title: "YC funding rumor would otherwise be a deep dive",
          trendScore: 92,
        },
        {
          ...localItem,
          id: "safe-agent-follow-up",
          category: "agent_product",
          entities: ["LangChain", "Agents"],
          matchedSignals: [],
          personalizedScore: 124,
          sourceName: "Agent Desk",
          sourceScore: 86,
          sourceSlug: "agent-desk",
          tags: ["agent", "workflow"],
          title: "Agent workflow story stays eligible for the queue",
          trendScore: 81,
        },
      ],
      negativeFeedbackItems: [
        {
          ...localItem,
          id: "hidden-funding",
          category: "funding",
          entities: ["YC"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          title: "Hidden YC funding rumor",
        },
      ],
    });

    expect(queue.slots.map((slot) => slot.story.id)).not.toContain(
      "hidden-funding-follow-up",
    );
  });

  it("chooses a counterpoint deep dive when the strongest depth candidate repeats the lead entity", () => {
    expect(
      getNewsPersonalizedReadingQueue({
        items: [
          {
            ...localItem,
            id: "openai-lead",
            entities: ["OpenAI"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 170,
            sourceName: "Model Desk",
            title: "OpenAI leads the morning model brief",
            trendScore: 96,
          },
          {
            ...localItem,
            id: "openai-depth",
            entities: ["OpenAI", "GPT-6", "Agents", "Enterprise"],
            matchedSignals: ["entity"],
            personalizedScore: 150,
            sourceName: "Platform Brief",
            sourceScore: 96,
            tags: ["model", "agent", "enterprise", "workflow"],
            title: "OpenAI platform analysis has the densest overlap",
            trendScore: 90,
          },
          {
            ...localItem,
            id: "anthropic-depth",
            entities: ["Anthropic", "Claude", "Safety"],
            matchedSignals: ["exploration"],
            personalizedScore: 132,
            sourceName: "Research Notes",
            sourceScore: 92,
            tags: ["research", "safety", "eval"],
            title: "Anthropic safety analysis broadens the reading path",
            trendScore: 86,
          },
          {
            ...localItem,
            id: "mistral-explore",
            category: "open_source",
            entities: ["Mistral"],
            matchedSignals: ["exploration"],
            personalizedScore: 110,
            sourceName: "Open Source Desk",
            sourceScore: 84,
            title: "Mistral release gives the queue an explore option",
            trendScore: 82,
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
            id: "openai-lead",
            personalizedScore: 170,
            sourceName: "Model Desk",
            title: "OpenAI leads the morning model brief",
          },
        },
        {
          intent: "Deep Dive",
          label: "Go deeper",
          reason: "Dense source-backed story with 3 entities and 3 tags.",
          story: {
            id: "anthropic-depth",
            personalizedScore: 132,
            sourceName: "Research Notes",
            title: "Anthropic safety analysis broadens the reading path",
          },
        },
        {
          intent: "Explore",
          label: "Try outside profile",
          reason: "Exploration story keeps the queue from narrowing.",
          story: {
            id: "mistral-explore",
            personalizedScore: 110,
            sourceName: "Open Source Desk",
            title: "Mistral release gives the queue an explore option",
          },
        },
      ],
      summary: "3-step queue built from 4 ranked stories.",
    });
  });

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

describe("getNewsMissedCoverageShelf", () => {
  it("prioritizes counterpoint tail coverage when the front page is already entity-heavy", () => {
    expect(
      getNewsMissedCoverageShelf({
        frontPageCount: 2,
        historyItems: [],
        items: [
          {
            ...localItem,
            id: "openai-lead",
            entities: ["OpenAI"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 190,
            sourceName: "Model Desk",
            title: "OpenAI owns the lead stack",
            trendScore: 96,
          },
          {
            ...localItem,
            id: "openai-second",
            entities: ["OpenAI", "GPT-6"],
            matchedSignals: ["entity"],
            personalizedScore: 178,
            sourceName: "Platform Brief",
            title: "OpenAI also owns the second slot",
            trendScore: 91,
          },
          {
            ...localItem,
            id: "openai-tail-hot",
            entities: ["OpenAI", "Agents"],
            matchedSignals: ["entity"],
            personalizedScore: 138,
            sourceName: "Agent Desk",
            sourceScore: 92,
            title: "OpenAI tail follow-up is hotter before balancing",
            trendScore: 96,
          },
          {
            ...localItem,
            id: "anthropic-tail-counterpoint",
            entities: ["Anthropic", "Claude"],
            matchedSignals: ["exploration"],
            personalizedScore: 132,
            sourceName: "Research Notes",
            sourceScore: 90,
            title: "Anthropic tail story broadens missed coverage",
            trendScore: 92,
          },
          {
            ...localItem,
            id: "mistral-tail",
            entities: ["Mistral"],
            matchedSignals: [],
            personalizedScore: 96,
            sourceName: "Open Source Desk",
            sourceScore: 82,
            title: "Mistral tail item stays behind stronger catches",
            trendScore: 82,
          },
        ],
        limit: 2,
      }),
    ).toEqual({
      label: "2 Unread",
      metrics: [
        { label: "Scanned", value: "3" },
        { label: "Unread", value: "3" },
        { label: "Top score", value: "233" },
      ],
      stories: [
        {
          id: "anthropic-tail-counterpoint",
          reason: "Counterpoint catch-up",
          scoreLabel: "233 score",
          sourceName: "Research Notes",
          title: "Anthropic tail story broadens missed coverage",
        },
        {
          id: "openai-tail-hot",
          reason: "High heat",
          scoreLabel: "213 score",
          sourceName: "Agent Desk",
          title: "OpenAI tail follow-up is hotter before balancing",
        },
      ],
      summary:
        "2 unread stories outside the lead stack are worth a second look.",
    });
  });

  it("resurfaces hot unread stories outside the front-page lead positions", () => {
    expect(
      getNewsMissedCoverageShelf({
        frontPageCount: 3,
        historyItems: [{ id: "read-story" }],
        items: [
          {
            ...localItem,
            id: "lead-story",
            matchedSignals: ["category"],
            personalizedScore: 190,
            trendScore: 95,
          },
          {
            ...serverItem,
            id: "secondary-story",
            matchedSignals: ["entity"],
            personalizedScore: 180,
            trendScore: 88,
          },
          {
            ...olderItem,
            id: "third-story",
            matchedSignals: [],
            personalizedScore: 170,
            trendScore: 83,
          },
          {
            ...localItem,
            id: "read-story",
            matchedSignals: ["category"],
            personalizedScore: 160,
            trendScore: 98,
          },
          {
            ...serverItem,
            id: "missed-high-heat",
            category: "model_release",
            entities: ["OpenAI"],
            matchedSignals: ["entity"],
            personalizedScore: 110,
            sourceName: "OpenAI News",
            sourceScore: 90,
            sourceSlug: "openai-news",
            title: "OpenAI launches a late briefing",
            trendScore: 98,
          },
          {
            ...olderItem,
            id: "missed-exploration",
            category: "agent_product",
            entities: ["Figure"],
            matchedSignals: ["exploration"],
            personalizedScore: 105,
            sourceName: "Robotics Desk",
            sourceScore: 82,
            sourceSlug: "robotics-desk",
            title: "New robotics startup breaks out",
            trendScore: 86,
          },
          {
            ...olderItem,
            id: "low-priority-tail",
            category: "funding",
            entities: ["YC"],
            matchedSignals: [],
            personalizedScore: 80,
            sourceName: "VentureWire",
            sourceScore: 70,
            sourceSlug: "venturewire",
            title: "Quiet market note",
            trendScore: 55,
          },
        ],
        limit: 2,
      }),
    ).toEqual({
      label: "2 Unread",
      metrics: [
        { label: "Scanned", value: "4" },
        { label: "Unread", value: "3" },
        { label: "Top score", value: "199" },
      ],
      stories: [
        {
          id: "missed-exploration",
          reason: "Counterpoint catch-up",
          scoreLabel: "199 score",
          sourceName: "Robotics Desk",
          title: "New robotics startup breaks out",
        },
        {
          id: "missed-high-heat",
          reason: "High heat",
          scoreLabel: "187 score",
          sourceName: "OpenAI News",
          title: "OpenAI launches a late briefing",
        },
      ],
      summary:
        "2 unread stories outside the lead stack are worth a second look.",
    });
  });

  it("keeps the shelf empty when no unread tail stories are available", () => {
    expect(
      getNewsMissedCoverageShelf({
        frontPageCount: 3,
        historyItems: [{ id: "tail-read" }],
        items: [
          {
            ...localItem,
            matchedSignals: ["category"],
            personalizedScore: 120,
          },
          {
            ...serverItem,
            matchedSignals: ["entity"],
            personalizedScore: 110,
          },
          {
            ...olderItem,
            matchedSignals: [],
            personalizedScore: 100,
          },
          {
            ...olderItem,
            id: "tail-read",
            matchedSignals: [],
            personalizedScore: 90,
          },
        ],
        limit: 3,
      }),
    ).toEqual({
      label: "Caught Up",
      metrics: [
        { label: "Scanned", value: "1" },
        { label: "Unread", value: "0" },
        { label: "Top score", value: "0" },
      ],
      stories: [],
      summary: "No unread tail coverage is waiting behind the lead stack.",
    });
  });
});

describe("getNewsContinuationRail", () => {
  it("keeps a counterpoint follow-up when one read entity would fill the rail", () => {
    expect(
      getNewsContinuationRail({
        formatCategory: (category) =>
          category === "model_release" ? "Models" : category,
        historyItems: [
          {
            ...localItem,
            id: "read-openai-model",
            category: "model_release",
            entities: ["OpenAI"],
            sourceName: "Model Desk",
            sourceSlug: "model-desk",
            title: "Read OpenAI model story",
          },
        ],
        items: [
          {
            ...localItem,
            id: "openai-direct-thread",
            category: "funding",
            entities: ["OpenAI", "Agents"],
            matchedSignals: ["entity"],
            personalizedScore: 152,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "OpenAI direct thread continues the read",
          },
          {
            ...localItem,
            id: "openai-second-thread",
            category: "big_tech",
            entities: ["OpenAI", "Azure"],
            matchedSignals: ["entity"],
            personalizedScore: 148,
            sourceName: "Platform Brief",
            sourceSlug: "platform-brief",
            title: "OpenAI second thread would otherwise fill the rail",
          },
          {
            ...localItem,
            id: "anthropic-counterpoint",
            category: "model_release",
            entities: ["Anthropic", "Claude"],
            matchedSignals: ["exploration"],
            personalizedScore: 132,
            sourceName: "Research Notes",
            sourceSlug: "research-notes",
            title: "Anthropic counterpoint continues the model theme",
          },
        ],
        limit: 2,
      }),
    ).toEqual({
      anchor: {
        categoryLabel: "Models",
        id: "read-openai-model",
        sourceName: "Model Desk",
        title: "Read OpenAI model story",
      },
      followUps: [
        {
          id: "openai-direct-thread",
          reason: "OpenAI thread",
          scoreLabel: "3 signals / 152 score",
          sourceName: "Agent Desk",
          title: "OpenAI direct thread continues the read",
        },
        {
          id: "anthropic-counterpoint",
          reason: "Models follow-up",
          scoreLabel: "2 signals / 132 score",
          sourceName: "Research Notes",
          title: "Anthropic counterpoint continues the model theme",
        },
      ],
      label: "Active Trail",
      metrics: [
        { label: "Read anchors", value: "1" },
        { label: "Follow-ups", value: "2" },
        { label: "Top thread", value: "OpenAI" },
      ],
      notices: [
        {
          detail:
            "OpenAI thread has the strongest overlap with your latest read.",
          label: "Thread match",
        },
      ],
      summary:
        "2 follow-ups continue your latest read: Read OpenAI model story.",
    });
  });

  it("recommends follow-ups connected to the latest read story", () => {
    expect(
      getNewsContinuationRail({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "funding"
              ? "Funding"
              : category === "agent_product"
                ? "Agents"
                : category,
        historyItems: [
          {
            ...localItem,
            id: "read-openai-agent",
            title: "Read OpenAI agent story",
            category: "model_release",
            entities: ["OpenAI", "Agents"],
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
          },
        ],
        items: [
          {
            ...localItem,
            id: "read-openai-agent",
            matchedSignals: ["category"],
            personalizedScore: 190,
          },
          {
            ...serverItem,
            id: "openai-funding-follow",
            category: "funding",
            entities: ["OpenAI", "Series A"],
            matchedSignals: ["entity"],
            personalizedScore: 120,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "OpenAI funding follows agents",
          },
          {
            ...olderItem,
            id: "model-release-follow",
            category: "model_release",
            entities: ["Anthropic"],
            matchedSignals: ["category"],
            personalizedScore: 150,
            sourceName: "Model Lab",
            sourceSlug: "model-lab",
            title: "Model releases keep accelerating",
          },
          {
            ...olderItem,
            id: "unrelated-high-score",
            category: "funding",
            entities: ["YC"],
            matchedSignals: [],
            personalizedScore: 220,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Unrelated funding brief",
          },
        ],
        limit: 2,
      }),
    ).toEqual({
      anchor: {
        categoryLabel: "Models",
        id: "read-openai-agent",
        sourceName: "OpenAI News",
        title: "Read OpenAI agent story",
      },
      followUps: [
        {
          id: "openai-funding-follow",
          reason: "OpenAI thread",
          scoreLabel: "3 signals / 120 score",
          sourceName: "VentureWire",
          title: "OpenAI funding follows agents",
        },
        {
          id: "model-release-follow",
          reason: "Models follow-up",
          scoreLabel: "2 signals / 150 score",
          sourceName: "Model Lab",
          title: "Model releases keep accelerating",
        },
      ],
      label: "Active Trail",
      metrics: [
        { label: "Read anchors", value: "1" },
        { label: "Follow-ups", value: "2" },
        { label: "Top thread", value: "OpenAI" },
      ],
      notices: [
        {
          detail:
            "OpenAI thread has the strongest overlap with your latest read.",
          label: "Thread match",
        },
      ],
      summary:
        "2 follow-ups continue your latest read: Read OpenAI agent story.",
    });
  });

  it("keeps the continuation rail empty before reading history exists", () => {
    expect(
      getNewsContinuationRail({
        formatCategory: (category) => category,
        historyItems: [],
        items: [],
        limit: 3,
      }),
    ).toEqual({
      anchor: null,
      followUps: [],
      label: "No Trail",
      metrics: [
        { label: "Read anchors", value: "0" },
        { label: "Follow-ups", value: "0" },
        { label: "Top thread", value: "None" },
      ],
      notices: [
        {
          detail: "Open stories to build a continuation trail.",
          label: "No reading history",
        },
      ],
      summary: "Continuation rail will appear after you read a story.",
    });
  });
});

describe("getNewsEditionSchedule", () => {
  it("uses a counterpoint heat story after a lead entity starts the day", () => {
    expect(
      getNewsEditionSchedule({
        items: [
          {
            ...localItem,
            id: "openai-lead",
            entities: ["OpenAI"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 172,
            sourceName: "Model Desk",
            title: "OpenAI leads the morning edition",
            trendScore: 96,
          },
          {
            ...localItem,
            id: "openai-hottest",
            entities: ["OpenAI", "GPT-6"],
            matchedSignals: ["entity"],
            personalizedScore: 150,
            publishedAt: "2026-07-01T09:00:00.000Z",
            sourceName: "Platform Brief",
            sourceScore: 92,
            title: "OpenAI follow-up is the hottest remaining story",
            trendScore: 99,
          },
          {
            ...localItem,
            id: "anthropic-counterpoint",
            entities: ["Anthropic", "Claude"],
            matchedSignals: ["exploration"],
            personalizedScore: 132,
            publishedAt: "2026-07-01T08:30:00.000Z",
            sourceName: "Research Notes",
            sourceScore: 90,
            title: "Anthropic counterpoint keeps midday broad",
            trendScore: 93,
          },
          {
            ...localItem,
            id: "mistral-latest",
            entities: ["Mistral"],
            matchedSignals: [],
            personalizedScore: 118,
            publishedAt: "2026-07-01T12:45:00.000Z",
            sourceName: "Open Source Desk",
            sourceScore: 84,
            title: "Mistral latest release fills the evening slot",
            trendScore: 82,
          },
        ],
      }),
    ).toEqual({
      slots: [
        {
          intent: "Start with the lead story.",
          label: "Morning Brief",
          reason: "Highest-ranked story in the personalized edition.",
          story: {
            id: "openai-lead",
            personalizedScore: 172,
            sourceName: "Model Desk",
            title: "OpenAI leads the morning edition",
          },
          timeLabel: "08:00",
        },
        {
          intent: "Track what is gaining heat.",
          label: "Midday Watch",
          reason: "Counterpoint heat story at 93 trend after OpenAI.",
          story: {
            id: "anthropic-counterpoint",
            personalizedScore: 132,
            sourceName: "Research Notes",
            title: "Anthropic counterpoint keeps midday broad",
          },
          timeLabel: "12:00",
        },
        {
          intent: "Catch the newest movement.",
          label: "Evening Catch-Up",
          reason: "Newest remaining story from Open Source Desk.",
          story: {
            id: "mistral-latest",
            personalizedScore: 118,
            sourceName: "Open Source Desk",
            title: "Mistral latest release fills the evening slot",
          },
          timeLabel: "18:00",
        },
        {
          intent: "Save time for context.",
          label: "Deep Read",
          reason: "Strong source with 2 entities and 1 tag.",
          story: {
            id: "openai-hottest",
            personalizedScore: 150,
            sourceName: "Platform Brief",
            title: "OpenAI follow-up is the hottest remaining story",
          },
          timeLabel: "21:00",
        },
      ],
      summary: "4 timed edition slots from 4 ranked stories.",
    });
  });

  it("builds timed edition slots from the ranked story mix", () => {
    expect(
      getNewsEditionSchedule({
        items: [
          {
            ...localItem,
            matchedSignals: ["category"],
            personalizedScore: 150,
            sourceScore: 82,
            trendScore: 74,
          },
          {
            ...localItem,
            id: "high-heat",
            category: "funding",
            matchedSignals: ["exploration"],
            personalizedScore: 109,
            sourceName: "VentureWire",
            sourceScore: 79,
            title: "Funding heat climbs around AI infra",
            trendScore: 97,
          },
          {
            ...localItem,
            id: "latest-story",
            category: "agent_product",
            matchedSignals: [],
            personalizedScore: 103,
            publishedAt: "2026-07-01T12:30:00.000Z",
            sourceName: "Agent Desk",
            sourceScore: 76,
            title: "A fresh agent launch hits the desk",
            trendScore: 64,
          },
          {
            ...localItem,
            id: "deep-read",
            category: "research",
            entities: ["OpenAI", "Agents", "Enterprise"],
            matchedSignals: ["entity"],
            personalizedScore: 124,
            sourceName: "Research Wire",
            sourceScore: 96,
            tags: ["agent", "workflow", "evaluation"],
            title: "Research teams map agent evaluation gaps",
            trendScore: 70,
          },
          {
            ...localItem,
            id: "unused-story",
            matchedSignals: [],
            personalizedScore: 94,
            sourceName: "Launch Feed",
            title: "Launch feed adds another AI tool",
            trendScore: 73,
          },
        ],
      }),
    ).toEqual({
      slots: [
        {
          intent: "Start with the lead story.",
          label: "Morning Brief",
          reason: "Highest-ranked story in the personalized edition.",
          story: {
            id: "local-story",
            personalizedScore: 150,
            sourceName: "Local Source",
            title: "Local trend fallback",
          },
          timeLabel: "08:00",
        },
        {
          intent: "Track what is gaining heat.",
          label: "Midday Watch",
          reason: "Highest heat story remaining at 97 trend.",
          story: {
            id: "high-heat",
            personalizedScore: 109,
            sourceName: "VentureWire",
            title: "Funding heat climbs around AI infra",
          },
          timeLabel: "12:00",
        },
        {
          intent: "Catch the newest movement.",
          label: "Evening Catch-Up",
          reason: "Newest remaining story from Agent Desk.",
          story: {
            id: "latest-story",
            personalizedScore: 103,
            sourceName: "Agent Desk",
            title: "A fresh agent launch hits the desk",
          },
          timeLabel: "18:00",
        },
        {
          intent: "Save time for context.",
          label: "Deep Read",
          reason: "Strong source with 3 entities and 3 tags.",
          story: {
            id: "deep-read",
            personalizedScore: 124,
            sourceName: "Research Wire",
            title: "Research teams map agent evaluation gaps",
          },
          timeLabel: "21:00",
        },
      ],
      summary: "4 timed edition slots from 5 ranked stories.",
    });
  });

  it("returns a stable empty schedule before stories load", () => {
    expect(getNewsEditionSchedule({ items: [] })).toEqual({
      slots: [],
      summary: "Edition schedule will appear as stories load.",
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

describe("shouldTrainNewsHomeProfileFromAction", () => {
  it("keeps home Read clicks out of local profile training", () => {
    expect(shouldTrainNewsHomeProfileFromAction("view")).toBe(false);
  });

  it("keeps explicit home feedback actions as local profile training", () => {
    expect(shouldTrainNewsHomeProfileFromAction("click_source")).toBe(true);
    expect(shouldTrainNewsHomeProfileFromAction("save")).toBe(true);
    expect(shouldTrainNewsHomeProfileFromAction("share")).toBe(true);
    expect(shouldTrainNewsHomeProfileFromAction("hide")).toBe(true);
  });
});

describe("getNewsPersonalizationMix", () => {
  it("summarizes the active recommendation objectives and tuning actions", () => {
    expect(
      getNewsPersonalizationMix({
        items: [
          {
            ...localItem,
            id: "reader-topic",
            matchedSignals: ["category"],
            personalizedScore: 148,
            sourceScore: 78,
            trendScore: 74,
          },
          {
            ...serverItem,
            id: "reader-entity",
            matchedSignals: ["entity"],
            personalizedScore: 139,
            sourceName: "OpenAI News",
            sourceScore: 82,
            sourceSlug: "openai-news",
            trendScore: 70,
          },
          {
            ...olderItem,
            id: "explore-story",
            matchedSignals: ["exploration"],
            personalizedScore: 116,
            sourceName: "Agent Scout",
            sourceScore: 76,
            sourceSlug: "agent-scout",
            trendScore: 80,
          },
          {
            ...olderItem,
            id: "heat-story",
            matchedSignals: [],
            personalizedScore: 108,
            sourceName: "Market Heat",
            sourceScore: 74,
            sourceSlug: "market-heat",
            trendScore: 94,
          },
          {
            ...olderItem,
            id: "trust-story",
            matchedSignals: [],
            personalizedScore: 102,
            sourceName: "Primary Lab",
            sourceScore: 92,
            sourceSlug: "primary-lab",
            trendScore: 64,
          },
        ],
        profile: {
          preferredCategories: ["model_release", "agent_product"],
          preferredSources: ["local-source"],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      actions: [
        {
          detail:
            "Reader matches are leading the mix; keep saving useful matches and hide stale repeats.",
          label: "Tune reader match",
        },
        {
          detail:
            "Exploration is present; save useful surprises or hide weak ones to train adjacent coverage.",
          label: "Tune exploration",
        },
        {
          detail:
            "Trend heat is available; use Trending mode when market movement matters more than fit.",
          label: "Tune heat",
        },
        {
          detail:
            "Source-trust fallback is present; follow high-trust sources to stabilize thin topics.",
          label: "Tune trust",
        },
      ],
      label: "Balanced Mix",
      metrics: [
        { label: "Reader match", value: "40%" },
        { label: "Exploration", value: "20%" },
        { label: "Heat", value: "20%" },
        { label: "Bias", value: "Balanced" },
      ],
      objectives: [
        {
          count: 2,
          detail: "Known-interest stories from explicit reader signals.",
          label: "Reader Match",
          shareLabel: "40%",
        },
        {
          count: 1,
          detail:
            "Outside-profile stories used to discover adjacent interests.",
          label: "Exploration",
          shareLabel: "20%",
        },
        {
          count: 1,
          detail:
            "High-trend stories that keep the feed connected to the live AI market.",
          label: "Trend Heat",
          shareLabel: "20%",
        },
        {
          count: 1,
          detail:
            "High-trust sources used when reader signals or heat are thinner.",
          label: "Source Trust",
          shareLabel: "20%",
        },
      ],
      summary:
        "5 stories tuned across reader match 40%, exploration 20%, heat 20%, and trust 20%.",
    });
  });

  it("keeps the personalization mix explicit while stories are unavailable", () => {
    expect(
      getNewsPersonalizationMix({
        items: [],
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      actions: [
        {
          detail: "Collect stories before tuning the recommendation mix.",
          label: "Waiting for stories",
        },
      ],
      label: "Waiting",
      metrics: [
        { label: "Reader match", value: "0%" },
        { label: "Exploration", value: "0%" },
        { label: "Heat", value: "0%" },
        { label: "Bias", value: "Balanced" },
      ],
      objectives: [
        {
          count: 0,
          detail: "Known-interest stories from explicit reader signals.",
          label: "Reader Match",
          shareLabel: "0%",
        },
        {
          count: 0,
          detail:
            "Outside-profile stories used to discover adjacent interests.",
          label: "Exploration",
          shareLabel: "0%",
        },
        {
          count: 0,
          detail:
            "High-trend stories that keep the feed connected to the live AI market.",
          label: "Trend Heat",
          shareLabel: "0%",
        },
        {
          count: 0,
          detail:
            "High-trust sources used when reader signals or heat are thinner.",
          label: "Source Trust",
          shareLabel: "0%",
        },
      ],
      summary: "Personalization mix will appear after stories are ranked.",
    });
  });
});

describe("getNewsExperimentAllocation", () => {
  it("allocates For You traffic across reader, cohort, exploration, freshness, and trust experiments", () => {
    expect(
      getNewsExperimentAllocation({
        formatCategory: (category) =>
          category === "agent_product"
            ? "Agents"
            : category === "model_release"
              ? "Models"
              : category === "hot_take"
                ? "Hot Takes"
                : category,
        historyItems: [
          {
            ...localItem,
            id: "read-model",
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            title: "Read model analysis",
          },
        ],
        items: [
          {
            ...localItem,
            id: "reader-match",
            matchedSignals: ["category", "source", "entity"],
            personalizedScore: 150,
            sourceName: "OpenAI News",
            sourceScore: 94,
            sourceSlug: "openai-news",
            title: "OpenAI ships a new reasoning model",
            trendScore: 88,
          },
          {
            ...localItem,
            category: "agent_product",
            entities: ["Agents"],
            id: "collab-agent",
            matchedSignals: ["exploration"],
            personalizedScore: 126,
            sourceName: "Agent Desk",
            sourceScore: 82,
            sourceSlug: "agent-desk",
            title: "Agent teams test shared memory",
            trendScore: 87,
          },
          {
            ...localItem,
            id: "heat-story",
            matchedSignals: [],
            personalizedScore: 109,
            sourceName: "Market Heat",
            sourceScore: 76,
            sourceSlug: "market-heat",
            title: "Model deployment heats up",
            trendScore: 93,
          },
          {
            ...localItem,
            category: "hot_take",
            entities: ["StealthAI"],
            id: "low-trust-heat",
            matchedSignals: [],
            personalizedScore: 91,
            sourceName: "Rumor Feed",
            sourceScore: 45,
            sourceSlug: "rumor-feed",
            title: "Rumor feed claims a model leak",
            trendScore: 92,
          },
        ],
        negativeFeedbackItems: [
          {
            ...olderItem,
            category: "hot_take",
            entities: ["StealthAI"],
            id: "hidden-rumor",
            sourceName: "Rumor Feed",
            sourceSlug: "rumor-feed",
            title: "Hidden rumor story",
          },
        ],
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: ["openai-news"],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1.4,
          recencyBias: 1.3,
        },
        savedItems: [
          {
            ...localItem,
            category: "agent_product",
            entities: ["Agents"],
            id: "saved-agent",
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Saved agent workflow",
          },
        ],
      }),
    ).toEqual({
      arms: [
        {
          action: "Keep explicit reader matches in the lead slot.",
          allocationLabel: "30%",
          key: "reader_match",
          label: "Reader Match",
          objective: "Exploit known preferences.",
          storyCount: 1,
          trigger: "3 reader signals and 1 matching story.",
        },
        {
          action: "Use cohort lift as a secondary boost, not a replacement.",
          allocationLabel: "25%",
          key: "collaborative_lift",
          label: "Collaborative Lift",
          objective: "Test what similar readers are rewarding.",
          storyCount: 2,
          trigger: "2 cohort candidates are available.",
        },
        {
          action: "Keep exploration visible while novelty is high.",
          allocationLabel: "20%",
          key: "exploration",
          label: "Exploration",
          objective: "Discover adjacent interests.",
          storyCount: 1,
          trigger: "1 exploration story and 1.4 novelty bias.",
        },
        {
          action: "Reserve a freshness probe for fast-moving AI stories.",
          allocationLabel: "15%",
          key: "freshness_probe",
          label: "Freshness Probe",
          objective: "Catch high-velocity market movement.",
          storyCount: 3,
          trigger: "3 high-heat stories and 1.3 recency bias.",
        },
        {
          action: "Keep guarded stories out of promotion until verified.",
          allocationLabel: "10%",
          key: "trust_guard",
          label: "Trust Guard",
          objective: "Measure risk without amplifying weak sources.",
          storyCount: 1,
          trigger: "1 low-trust high-heat story and 1 Less signal.",
        },
      ],
      label: "5 Active Arms",
      metrics: [
        { label: "Active arms", value: "5" },
        { label: "Allocation", value: "100%" },
        { label: "Stories", value: "4" },
        { label: "Guardrails", value: "1" },
      ],
      summary:
        "For You traffic is split across 5 experiment arms; Reader Match leads at 30%.",
    });
  });

  it("keeps experiment allocation cold before stories arrive", () => {
    expect(
      getNewsExperimentAllocation({
        formatCategory: (category) => category,
        historyItems: [],
        items: [],
        negativeFeedbackItems: [],
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
      arms: [],
      label: "Cold Experiment",
      metrics: [
        { label: "Active arms", value: "0" },
        { label: "Allocation", value: "0%" },
        { label: "Stories", value: "0" },
        { label: "Guardrails", value: "0" },
      ],
      summary: "Experiment allocation will appear after stories are ranked.",
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
            entities: ["OpenAI"],
            matchedSignals: ["category", "source"],
            personalizedScore: 142,
          },
          {
            ...serverItem,
            entities: ["Anthropic"],
            matchedSignals: ["entity"],
            personalizedScore: 131,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
          },
          {
            ...olderItem,
            entities: ["Mistral"],
            id: "explore-story",
            matchedSignals: ["exploration"],
            personalizedScore: 104,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
          {
            ...localItem,
            entities: ["Perplexity"],
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
        { label: "Entity spread", value: "4 entities" },
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
        {
          detail:
            "No entity owns more than half of this edition, keeping the recommendation mix broad.",
          label: "Entity diversity",
        },
      ],
      summary:
        "4 stories: 2 personalized, 1 exploratory, and 1 trend-led across 4 sources and 4 entities.",
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
        { label: "Entity spread", value: "1 entity" },
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
        {
          detail:
            "One entity dominates this edition; add adjacent entities or exploration stories to broaden coverage.",
          label: "Entity concentration",
        },
      ],
      summary:
        "2 stories: 0 personalized, 0 exploratory, and 2 trend-led across 1 source and 1 entity.",
    });
  });
});

describe("getNewsRecommendationTrace", () => {
  it("explains verified coverage and edition timing without counting them as reader profile matches", () => {
    const trace = getNewsRecommendationTrace({
      formatCategory: (category) =>
        category === "model_release"
          ? "Models"
          : category === "agent_product"
            ? "Agents"
            : category,
      historyItems: [],
      items: [
        {
          ...localItem,
          id: "verified-lead",
          category: "model_release",
          matchedSignals: ["source_corroboration"],
          personalizedScore: 142,
          sourceName: "Model Wire",
          sourceScore: 88,
          title: "Independent sources confirm a model launch",
          trendScore: 84,
        },
        {
          ...serverItem,
          id: "timed-briefing",
          category: "agent_product",
          matchedSignals: ["daypart"],
          personalizedScore: 126,
          sourceName: "Morning Brief",
          title: "Agent market briefing fits the morning edition",
        },
      ],
      limit: 5,
      negativeFeedbackItems: [],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
    });

    expect(trace.metrics).toContainEqual({
      label: "Reader matches",
      value: "0",
    });
    expect(trace.metrics).toContainEqual({
      label: "Verified",
      value: "1",
    });
    expect(trace.metrics).toContainEqual({
      label: "Timed",
      value: "1",
    });
    expect(trace.steps).toContainEqual({
      detail:
        "Model Wire is lifted because independent sources are confirming the same development.",
      label: "Verified coverage",
      scoreLabel: "1 story",
      title: "Independent sources confirm a model launch",
    });
    expect(trace.steps).toContainEqual({
      detail: "Agents is timed for the reader's current edition context.",
      label: "Edition timing",
      scoreLabel: "1 story",
      title: "Agent market briefing fits the morning edition",
    });
  });

  it("explains active and guarded angle signals in the ranking trace", () => {
    const trace = getNewsRecommendationTrace({
      formatCategory: (category) =>
        category === "security" ? "Security" : "Safety",
      historyItems: [],
      items: [
        {
          ...localItem,
          category: "security",
          entities: ["OpenAI"],
          id: "angle-match",
          matchedSignals: [],
          personalizedScore: 137,
          sourceName: "Security Desk",
          sourceSlug: "security-desk",
          tags: ["prompt_injection"],
          title: "Prompt injection defense playbook",
        },
      ],
      limit: 4,
      negativeFeedbackItems: [
        {
          ...localItem,
          category: "safety",
          entities: ["Anthropic"],
          id: "hidden-jailbreak",
          sourceName: "Safety Lab",
          sourceSlug: "safety-lab",
          tags: ["jailbreaks"],
          title: "Hidden jailbreak story",
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: ["prompt_injection"],
        noveltyBias: 1,
        recencyBias: 1,
      },
    });

    expect(trace.steps).toContainEqual({
      detail: "prompt injection match the active profile.",
      label: "Reader profile",
      scoreLabel: "1 signal",
      title: "Prompt injection defense playbook",
    });
    expect(trace.steps).toContainEqual({
      detail: "Less feedback guards Safety, Anthropic, Safety Lab, and jailbreaks.",
      label: "Guardrail",
      scoreLabel: "1 signal",
      title: "Hidden jailbreak story",
    });
  });

  it("explains the lead, profile match, exploration, and guardrail decisions behind a ranked feed", () => {
    expect(
      getNewsRecommendationTrace({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category === "funding"
                ? "Funding"
                : category,
        historyItems: [
          {
            ...localItem,
            id: "read-agent",
            category: "agent_product",
            title: "Read agent workflow",
          },
        ],
        items: [
          {
            ...localItem,
            id: "lead-openai",
            title: "OpenAI ships the top model story",
            category: "model_release",
            entities: ["OpenAI", "Agents"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 168,
            sourceName: "OpenAI News",
            sourceScore: 94,
            sourceSlug: "openai-news",
            trendScore: 96,
          },
          {
            ...localItem,
            id: "explore-robotics",
            title: "Robotics agents break out",
            category: "agent_product",
            entities: ["Figure"],
            matchedSignals: ["exploration"],
            personalizedScore: 117,
            sourceName: "Robotics Desk",
            sourceSlug: "robotics-desk",
            trendScore: 88,
          },
          {
            ...localItem,
            id: "funding-repeat",
            title: "Funding rumor repeats a weak YC thread",
            category: "funding",
            entities: ["YC"],
            matchedSignals: ["category"],
            personalizedScore: 109,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            trendScore: 81,
          },
        ],
        limit: 4,
        negativeFeedbackItems: [
          {
            ...localItem,
            id: "hidden-funding",
            category: "funding",
            entities: ["YC"],
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Hidden YC funding rumor",
          },
        ],
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: [],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1.2,
          recencyBias: 1.1,
        },
      }),
    ).toEqual({
      label: "Trace Ready",
      metrics: [
        { label: "Lead score", value: "168" },
        { label: "Reader matches", value: "2" },
        { label: "Verified", value: "0" },
        { label: "Timed", value: "0" },
        { label: "Exploration", value: "1" },
        { label: "Guardrails", value: "1" },
      ],
      steps: [
        {
          detail:
            "OpenAI News leads because 2 reader signals meet 94 trust and 96 heat.",
          label: "Lead story",
          scoreLabel: "168 score",
          title: "OpenAI ships the top model story",
        },
        {
          detail: "Models and OpenAI match the active profile.",
          label: "Reader profile",
          scoreLabel: "2 signals",
          title: "OpenAI ships the top model story",
        },
        {
          detail:
            "Agents adds adjacent coverage outside the active profile after 1 read.",
          label: "Exploration check",
          scoreLabel: "1 story",
          title: "Robotics agents break out",
        },
        {
          detail: "Less feedback guards Funding, YC, and VentureWire.",
          label: "Guardrail",
          scoreLabel: "1 signal",
          title: "Hidden YC funding rumor",
        },
      ],
      summary: "Trace explains 4 ranking decisions across 3 stories.",
    });
  });

  it("keeps the trace empty before the feed has ranked stories", () => {
    expect(
      getNewsRecommendationTrace({
        formatCategory: (category) => category,
        historyItems: [],
        items: [],
        limit: 4,
        negativeFeedbackItems: [],
        profile: localProfile,
      }),
    ).toEqual({
      label: "Trace Waiting",
      metrics: [
        { label: "Lead score", value: "0" },
        { label: "Reader matches", value: "0" },
        { label: "Verified", value: "0" },
        { label: "Timed", value: "0" },
        { label: "Exploration", value: "0" },
        { label: "Guardrails", value: "0" },
      ],
      steps: [],
      summary: "Recommendation trace will appear after stories are ranked.",
    });
  });
});

describe("getNewsEditorialGuardrails", () => {
  it("flags entity concentration even when coverage spans multiple sources", () => {
    expect(
      getNewsEditorialGuardrails({
        items: [
          {
            ...localItem,
            id: "openai-primary",
            entities: ["OpenAI", "Agents"],
            matchedSignals: ["entity"],
            personalizedScore: 160,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            title: "OpenAI primary source update",
          },
          {
            ...serverItem,
            id: "openai-market",
            category: "funding",
            entities: ["OpenAI", "Series A"],
            matchedSignals: ["entity"],
            personalizedScore: 150,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "OpenAI market follow-up",
          },
          {
            ...olderItem,
            id: "openai-analysis",
            category: "research",
            entities: ["OpenAI", "Benchmarks"],
            matchedSignals: ["entity"],
            personalizedScore: 140,
            sourceName: "Research Lab",
            sourceSlug: "research-lab",
            title: "OpenAI benchmark analysis",
          },
          {
            ...olderItem,
            id: "anthropic-agent",
            category: "agent_product",
            entities: ["Anthropic", "Claude"],
            matchedSignals: ["exploration"],
            personalizedScore: 120,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Anthropic agent update",
          },
        ],
        limit: 2,
        negativeFeedbackItems: [],
      }),
    ).toEqual({
      label: "Guardrail Watch",
      metrics: [
        { label: "Risks", value: "1" },
        { label: "Single-source", value: "0" },
        { label: "Entity concentration", value: "1" },
        { label: "Low-trust", value: "0" },
        { label: "Negative matches", value: "0" },
      ],
      risks: [
        {
          action: "Mix another entity before promoting more OpenAI coverage.",
          detail: "OpenAI appears in 3 of 4 stories across 3 sources.",
          label: "Entity concentration",
          severity: "high",
          stories: [
            {
              id: "openai-primary",
              sourceName: "OpenAI News",
              title: "OpenAI primary source update",
            },
            {
              id: "openai-market",
              sourceName: "VentureWire",
              title: "OpenAI market follow-up",
            },
          ],
        },
      ],
      summary: "1 editorial guardrail active across 4 ranked stories.",
    });
  });

  it("surfaces editorial risks before a recommendation slice over-promotes narrow or weak coverage", () => {
    expect(
      getNewsEditorialGuardrails({
        items: [
          {
            ...localItem,
            id: "openai-release-one",
            matchedSignals: ["category"],
            personalizedScore: 160,
            title: "OpenAI release one",
          },
          {
            ...localItem,
            id: "openai-release-two",
            matchedSignals: ["source"],
            personalizedScore: 150,
            title: "OpenAI release two",
          },
          {
            ...localItem,
            id: "openai-release-three",
            matchedSignals: ["entity"],
            personalizedScore: 140,
            title: "OpenAI release three",
          },
          {
            ...localItem,
            category: "hot_take",
            entities: ["StealthAI"],
            id: "rumor-feed-leak",
            matchedSignals: [],
            personalizedScore: 112,
            sourceName: "Rumor Feed",
            sourceScore: 52,
            sourceSlug: "rumor-feed",
            title: "Rumor feed claims model leak",
            trendScore: 91,
          },
        ],
        limit: 2,
        negativeFeedbackItems: [
          {
            ...localItem,
            category: "hot_take",
            entities: ["StealthAI"],
            id: "hidden-rumor",
            sourceName: "Rumor Feed",
            sourceSlug: "rumor-feed",
            title: "Hidden rumor feed story",
          },
        ],
      }),
    ).toEqual({
      label: "Guardrail Watch",
      metrics: [
        { label: "Risks", value: "4" },
        { label: "Single-source", value: "1" },
        { label: "Entity concentration", value: "0" },
        { label: "Low-trust", value: "1" },
        { label: "Negative matches", value: "1" },
      ],
      risks: [
        {
          action:
            "Mix another source before promoting more Local Source coverage.",
          detail: "Local Source carries 3 of 4 stories in this slice.",
          label: "Source concentration",
          severity: "high",
          stories: [
            {
              id: "openai-release-one",
              sourceName: "Local Source",
              title: "OpenAI release one",
            },
            {
              id: "openai-release-two",
              sourceName: "Local Source",
              title: "OpenAI release two",
            },
          ],
        },
        {
          action:
            "Wait for another source before treating OpenAI coverage as consensus.",
          detail: "OpenAI appears in 3 stories from Local Source only.",
          label: "Single-source thread",
          severity: "medium",
          stories: [
            {
              id: "openai-release-one",
              sourceName: "Local Source",
              title: "OpenAI release one",
            },
            {
              id: "openai-release-two",
              sourceName: "Local Source",
              title: "OpenAI release two",
            },
          ],
        },
        {
          action:
            "Keep low-trust items below lead positions unless another source confirms them.",
          detail: "1 story is below the source trust floor.",
          label: "Low-trust source",
          severity: "medium",
          stories: [
            {
              id: "rumor-feed-leak",
              sourceName: "Rumor Feed",
              title: "Rumor feed claims model leak",
            },
          ],
        },
        {
          action:
            "Keep matching stories in suppress or exploration lanes until the reader saves one.",
          detail: "1 story matches hidden reader signals.",
          label: "Negative feedback match",
          severity: "low",
          stories: [
            {
              id: "rumor-feed-leak",
              sourceName: "Rumor Feed",
              title: "Rumor feed claims model leak",
            },
          ],
        },
      ],
      summary: "4 editorial guardrails active across 4 ranked stories.",
    });
  });

  it("stays empty while the desk has no ranked stories to review", () => {
    expect(
      getNewsEditorialGuardrails({
        items: [],
        limit: 2,
        negativeFeedbackItems: [],
      }),
    ).toEqual({
      label: "Waiting",
      metrics: [
        { label: "Risks", value: "0" },
        { label: "Single-source", value: "0" },
        { label: "Entity concentration", value: "0" },
        { label: "Low-trust", value: "0" },
        { label: "Negative matches", value: "0" },
      ],
      risks: [],
      summary: "Editorial guardrails will appear after stories are ranked.",
    });
  });
});

describe("getNewsFeedRecipe", () => {
  it("separates verified coverage and edition timing from reader-led slices", () => {
    const recipe = getNewsFeedRecipe({
      items: [
        {
          ...localItem,
          matchedSignals: ["category"],
          personalizedScore: 150,
          title: "Reader profile story",
        },
        {
          ...serverItem,
          id: "verified-coverage-story",
          matchedSignals: ["source_corroboration"],
          personalizedScore: 136,
          sourceName: "Model Wire",
          title: "Independent sources confirm the model story",
        },
        {
          ...olderItem,
          id: "daypart-story",
          matchedSignals: ["daypart"],
          personalizedScore: 124,
          sourceName: "Morning Brief",
          title: "Morning briefing story",
        },
      ],
      profile: {
        preferredCategories: ["model_release"],
        preferredSources: ["local-source"],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1,
        recencyBias: 1,
      },
      storiesPerSlice: 2,
    });

    const readerSlice = recipe.slices.find(
      (slice) => slice.label === "Reader signals",
    );
    const verifiedSlice = recipe.slices.find(
      (slice) => slice.label === "Verified coverage",
    );
    const timingSlice = recipe.slices.find(
      (slice) => slice.label === "Edition timing",
    );

    expect(recipe.metrics).toContainEqual({
      label: "Reader signals",
      value: "1",
    });
    expect(recipe.metrics).toContainEqual({
      label: "Verified coverage",
      value: "1",
    });
    expect(recipe.metrics).toContainEqual({
      label: "Edition timing",
      value: "1",
    });
    expect(readerSlice).toEqual(
      expect.objectContaining({
        count: 1,
        label: "Reader signals",
        stories: [
          {
            id: "local-story",
            sourceName: "Local Source",
            title: "Reader profile story",
          },
        ],
      }),
    );
    expect(verifiedSlice).toEqual(
      expect.objectContaining({
        count: 1,
        label: "Verified coverage",
        stories: [
          {
            id: "verified-coverage-story",
            sourceName: "Model Wire",
            title: "Independent sources confirm the model story",
          },
        ],
      }),
    );
    expect(timingSlice).toEqual(
      expect.objectContaining({
        count: 1,
        label: "Edition timing",
        stories: [
          {
            id: "daypart-story",
            sourceName: "Morning Brief",
            title: "Morning briefing story",
          },
        ],
      }),
    );
    expect(recipe.summary).toBe(
      "3 stories: 1 reader-led, 1 verified coverage, and 1 edition-timed.",
    );
  });

  it("classifies the ranked feed into one primary recommendation recipe per story", () => {
    expect(
      getNewsFeedRecipe({
        items: [
          {
            ...localItem,
            matchedSignals: ["category"],
            personalizedScore: 150,
            sourceScore: 80,
            title: "Profile story",
            trendScore: 72,
          },
          {
            ...localItem,
            id: "explore-story",
            matchedSignals: ["exploration"],
            personalizedScore: 118,
            sourceName: "Explore Desk",
            sourceScore: 70,
            title: "Exploration story",
            trendScore: 68,
          },
          {
            ...localItem,
            id: "trend-story",
            matchedSignals: [],
            personalizedScore: 116,
            sourceName: "Trend Wire",
            sourceScore: 72,
            title: "Trend heat story",
            trendScore: 93,
          },
          {
            ...localItem,
            id: "trust-story",
            matchedSignals: [],
            personalizedScore: 112,
            sourceName: "Primary Source",
            sourceScore: 91,
            title: "Trusted source story",
            trendScore: 70,
          },
          {
            ...localItem,
            id: "fresh-story",
            matchedSignals: [],
            personalizedScore: 106,
            sourceName: "Fresh Desk",
            sourceScore: 65,
            title: "Freshness fallback story",
            trendScore: 55,
          },
        ],
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: ["local-source"],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1.4,
          recencyBias: 1,
        },
        storiesPerSlice: 2,
      }),
    ).toEqual({
      label: "Personalized Recipe",
      metrics: [
        { label: "Reader signals", value: "1" },
        { label: "Verified coverage", value: "0" },
        { label: "Edition timing", value: "0" },
        { label: "Exploration", value: "1" },
        { label: "Trend heat", value: "1" },
        { label: "Source trust", value: "1" },
        { label: "Freshness", value: "1" },
      ],
      signals: [
        { label: "Signal strength", value: "3 signals" },
        { label: "Bias mode", value: "Discovery" },
        { label: "Dominant slice", value: "Reader signals" },
      ],
      slices: [
        {
          count: 1,
          detail: "Profile matches are leading known-interest coverage.",
          label: "Reader signals",
          percentage: 20,
          stories: [
            {
              id: "local-story",
              sourceName: "Local Source",
              title: "Profile story",
            },
          ],
        },
        {
          count: 0,
          detail:
            "Corroborated stories surface when independent sources confirm the same development.",
          label: "Verified coverage",
          percentage: 0,
          stories: [],
        },
        {
          count: 0,
          detail:
            "Edition timing promotes stories that fit the reader's current daypart.",
          label: "Edition timing",
          percentage: 0,
          stories: [],
        },
        {
          count: 1,
          detail:
            "Exploration slots test coverage outside the current profile.",
          label: "Exploration",
          percentage: 20,
          stories: [
            {
              id: "explore-story",
              sourceName: "Explore Desk",
              title: "Exploration story",
            },
          ],
        },
        {
          count: 1,
          detail:
            "High-heat stories keep the edition connected to the live market.",
          label: "Trend heat",
          percentage: 20,
          stories: [
            {
              id: "trend-story",
              sourceName: "Trend Wire",
              title: "Trend heat story",
            },
          ],
        },
        {
          count: 1,
          detail: "High-trust sources anchor the recipe when signals are thin.",
          label: "Source trust",
          percentage: 20,
          stories: [
            {
              id: "trust-story",
              sourceName: "Primary Source",
              title: "Trusted source story",
            },
          ],
        },
        {
          count: 1,
          detail:
            "Freshness fallback keeps the river moving between stronger signals.",
          label: "Freshness",
          percentage: 20,
          stories: [
            {
              id: "fresh-story",
              sourceName: "Fresh Desk",
              title: "Freshness fallback story",
            },
          ],
        },
      ],
      summary:
        "5 stories: 1 reader-led, 1 exploration, 1 trend-led, 1 source-trust, and 1 freshness fallback.",
    });
  });

  it("returns a waiting recipe before the feed ranks stories", () => {
    expect(
      getNewsFeedRecipe({
        items: [],
        profile: createDefaultNewsPreferenceProfile(),
        storiesPerSlice: 2,
      }),
    ).toEqual({
      label: "Waiting",
      metrics: [
        { label: "Reader signals", value: "0" },
        { label: "Verified coverage", value: "0" },
        { label: "Edition timing", value: "0" },
        { label: "Exploration", value: "0" },
        { label: "Trend heat", value: "0" },
        { label: "Source trust", value: "0" },
        { label: "Freshness", value: "0" },
      ],
      signals: [
        { label: "Signal strength", value: "3 signals" },
        { label: "Bias mode", value: "Balanced" },
        { label: "Dominant slice", value: "None" },
      ],
      slices: [
        {
          count: 0,
          detail: "Profile matches are leading known-interest coverage.",
          label: "Reader signals",
          percentage: 0,
          stories: [],
        },
        {
          count: 0,
          detail:
            "Corroborated stories surface when independent sources confirm the same development.",
          label: "Verified coverage",
          percentage: 0,
          stories: [],
        },
        {
          count: 0,
          detail:
            "Edition timing promotes stories that fit the reader's current daypart.",
          label: "Edition timing",
          percentage: 0,
          stories: [],
        },
        {
          count: 0,
          detail:
            "Exploration slots test coverage outside the current profile.",
          label: "Exploration",
          percentage: 0,
          stories: [],
        },
        {
          count: 0,
          detail:
            "High-heat stories keep the edition connected to the live market.",
          label: "Trend heat",
          percentage: 0,
          stories: [],
        },
        {
          count: 0,
          detail: "High-trust sources anchor the recipe when signals are thin.",
          label: "Source trust",
          percentage: 0,
          stories: [],
        },
        {
          count: 0,
          detail:
            "Freshness fallback keeps the river moving between stronger signals.",
          label: "Freshness",
          percentage: 0,
          stories: [],
        },
      ],
      summary: "Feed recipe will appear as stories rank.",
    });
  });
});

describe("getNewsRankingPipeline", () => {
  it("summarizes candidate recall, scoring, diversity, and feedback training stages", () => {
    expect(
      getNewsRankingPipeline({
        historyItems: [
          {
            ...localItem,
            id: "read-agent",
            category: "agent_product",
            entities: ["Agents", "OpenAI"],
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Read agent story",
          },
        ],
        items: [
          {
            ...localItem,
            matchedSignals: ["category", "entity"],
            personalizedScore: 160,
            title: "Agent platform ranks first",
            trendScore: 76,
          },
          {
            ...localItem,
            id: "same-source",
            category: "model_release",
            entities: ["OpenAI"],
            matchedSignals: ["source"],
            personalizedScore: 114,
            sourceName: "Local Source",
            sourceSlug: "local-source",
            title: "Same source follow-up",
            trendScore: 62,
          },
          {
            ...localItem,
            id: "explore-story",
            category: "open_source",
            entities: ["LangChain"],
            matchedSignals: ["exploration"],
            personalizedScore: 122,
            sourceName: "OSS Desk",
            sourceSlug: "oss-desk",
            title: "Open-source tool enters the feed",
            trendScore: 64,
          },
          {
            ...localItem,
            id: "heat-story",
            category: "model_release",
            entities: ["Anthropic"],
            matchedSignals: [],
            personalizedScore: 118,
            sourceName: "Model Wire",
            sourceSlug: "model-wire",
            title: "Model release heats up",
            trendScore: 94,
          },
        ],
        negativeFeedbackItems: [
          {
            ...olderItem,
            id: "hidden-rumor",
            category: "hot_take",
            entities: ["Rumor"],
            sourceName: "Rumor Feed",
            sourceSlug: "rumor-feed",
            title: "Hidden rumor item",
          },
        ],
        profile: {
          preferredCategories: ["model_release", "agent_product"],
          preferredSources: ["local-source"],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1.4,
          recencyBias: 1,
        },
        savedItems: [
          {
            ...localItem,
            id: "saved-agent",
            category: "agent_product",
            entities: ["Agents", "OpenAI"],
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Saved agent item",
          },
        ],
      }),
    ).toEqual({
      label: "Four-stage Ranker",
      metrics: [
        { label: "Candidates", value: "4" },
        { label: "Personalized", value: "2" },
        { label: "Explore", value: "1" },
        { label: "Guardrails", value: "3" },
      ],
      stages: [
        {
          detail: "Pulls 4 candidate stories from 3 sources before ranking.",
          label: "Candidate recall",
          signals: ["Local Source", "OSS Desk", "Model Wire"],
          value: "4 stories",
        },
        {
          detail:
            "Scores candidates with 4 reader signals and current trend heat.",
          label: "Personalized scoring",
          signals: [
            "Agent platform ranks first",
            "Same source follow-up",
            "Model release heats up",
          ],
          value: "Discovery",
        },
        {
          detail:
            "Keeps exploration and source rotation visible after scoring.",
          label: "Diversity mixer",
          signals: [
            "1 exploration story",
            "3 unique sources",
            "1 adjacent source repeat",
            "1 adjacent entity repeat",
          ],
          value: "Mixed",
        },
        {
          detail:
            "Uses 2 positive events and 1 hidden story to update the next pass.",
          label: "Feedback training",
          signals: [
            "Saved agent item",
            "Read agent story",
            "Hidden rumor item",
          ],
          value: "+2 / -1",
        },
      ],
      summary:
        "Ranker processed 4 candidates into a Discovery feed with 2 personalized stories, 1 exploration story, and 3 guardrails.",
    });
  });

  it("keeps the ranking pipeline visible for an empty feed", () => {
    expect(
      getNewsRankingPipeline({
        historyItems: [],
        items: [],
        negativeFeedbackItems: [],
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
      label: "Cold Ranker",
      metrics: [
        { label: "Candidates", value: "0" },
        { label: "Personalized", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Guardrails", value: "0" },
      ],
      stages: [
        {
          detail:
            "Waiting for collected stories before candidate recall can run.",
          label: "Candidate recall",
          signals: [],
          value: "0 stories",
        },
        {
          detail: "No explicit profile signals are active yet.",
          label: "Personalized scoring",
          signals: [],
          value: "Balanced",
        },
        {
          detail:
            "Diversity controls will activate after ranked stories exist.",
          label: "Diversity mixer",
          signals: [],
          value: "Standby",
        },
        {
          detail: "Reader actions will train the next ranking pass.",
          label: "Feedback training",
          signals: [],
          value: "+0 / -0",
        },
      ],
      summary: "Ranker is waiting for story candidates and reader signals.",
    });
  });
});

describe("getNewsExplorationSlots", () => {
  it("selects trusted stories outside the reader profile while honoring negative feedback", () => {
    expect(
      getNewsExplorationSlots({
        formatCategory: (category) =>
          category === "open_source"
            ? "Open Source"
            : category === "policy"
              ? "Policy"
              : category === "new_concept"
                ? "New Concepts"
                : category === "hot_take"
                  ? "Hot Takes"
                  : "Models",
        items: [
          {
            ...localItem,
            matchedSignals: ["category", "entity"],
            personalizedScore: 160,
            title: "Profile model story",
            trendScore: 76,
          },
          {
            ...localItem,
            id: "explore-oss",
            category: "open_source",
            entities: ["LangChain"],
            matchedSignals: ["exploration"],
            personalizedScore: 126,
            sourceName: "OSS Desk",
            sourceScore: 82,
            sourceSlug: "oss-desk",
            title: "Open-source exploration",
            trendScore: 78,
          },
          {
            ...localItem,
            id: "policy-heat",
            category: "policy",
            entities: ["Regulators"],
            matchedSignals: [],
            personalizedScore: 120,
            sourceName: "Policy Desk",
            sourceScore: 91,
            sourceSlug: "policy-desk",
            title: "Policy heat outside profile",
            trendScore: 92,
          },
          {
            ...localItem,
            id: "new-concept",
            category: "new_concept",
            entities: ["Context memory"],
            matchedSignals: [],
            personalizedScore: 112,
            sourceName: "Concept Lab",
            sourceScore: 72,
            sourceSlug: "concept-lab",
            title: "New concept to test",
            trendScore: 69,
          },
          {
            ...localItem,
            id: "hidden-rumor-match",
            category: "hot_take",
            entities: ["Rumor"],
            matchedSignals: [],
            personalizedScore: 119,
            sourceName: "Rumor Feed",
            sourceScore: 50,
            sourceSlug: "rumor-feed",
            title: "Rumor should stay out",
            trendScore: 97,
          },
        ],
        limit: 3,
        negativeFeedbackItems: [
          {
            ...olderItem,
            id: "hidden-rumor",
            category: "hot_take",
            entities: ["Rumor"],
            sourceName: "Rumor Feed",
            sourceSlug: "rumor-feed",
            title: "Hidden rumor item",
          },
        ],
        profile: {
          preferredCategories: ["model_release", "agent_product"],
          preferredSources: ["local-source"],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1.4,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      label: "Discovery Slots",
      metrics: [
        { label: "Candidates", value: "3" },
        { label: "New topics", value: "3" },
        { label: "New sources", value: "3" },
        { label: "Guarded", value: "1" },
      ],
      slots: [
        {
          id: "explore-oss",
          reason: "Exploration slot",
          scoreLabel: "216 discovery",
          signal: "Open Source",
          sourceName: "OSS Desk",
          title: "Open-source exploration",
        },
        {
          id: "policy-heat",
          reason: "Trusted heat",
          scoreLabel: "209 discovery",
          signal: "Policy",
          sourceName: "Policy Desk",
          title: "Policy heat outside profile",
        },
        {
          id: "new-concept",
          reason: "New topic",
          scoreLabel: "167 discovery",
          signal: "New Concepts",
          sourceName: "Concept Lab",
          title: "New concept to test",
        },
      ],
      summary:
        "3 exploration slots open 3 topics and 3 sources beyond the current profile while guarding 1 negative signal.",
    });
  });

  it("keeps the exploration shelf explicit when no outside-profile stories exist", () => {
    expect(
      getNewsExplorationSlots({
        formatCategory: (category) => category,
        items: [
          {
            ...localItem,
            matchedSignals: ["category", "source"],
            personalizedScore: 160,
          },
        ],
        limit: 3,
        negativeFeedbackItems: [],
        profile: localProfile,
      }),
    ).toEqual({
      label: "No Exploration",
      metrics: [
        { label: "Candidates", value: "0" },
        { label: "New topics", value: "0" },
        { label: "New sources", value: "0" },
        { label: "Guarded", value: "0" },
      ],
      slots: [],
      summary:
        "Exploration slots will appear after stories outside the profile are available.",
    });
  });
});

describe("getNewsDiscoveryLadder", () => {
  it("builds an actionable ladder from followed topics into exploration topics", () => {
    expect(
      getNewsDiscoveryLadder({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category === "funding"
                ? "Funding"
                : category,
        items: [
          {
            ...localItem,
            id: "deepen-model",
            entities: ["OpenAI", "Agents"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 150,
            sourceName: "OpenAI News",
            sourceScore: 90,
            sourceSlug: "openai-news",
            title: "OpenAI model deep dive",
            trendScore: 86,
          },
          {
            ...localItem,
            id: "explore-agents",
            category: "agent_product",
            entities: ["Agents"],
            matchedSignals: ["exploration"],
            personalizedScore: 128,
            sourceName: "Agent Desk",
            sourceScore: 84,
            sourceSlug: "agent-desk",
            title: "Agent workflow startup expands",
            trendScore: 91,
          },
          {
            ...localItem,
            id: "trend-funding",
            category: "funding",
            entities: ["Series A"],
            matchedSignals: [],
            personalizedScore: 122,
            sourceName: "VentureWire",
            sourceScore: 90,
            sourceSlug: "venturewire",
            title: "Funding heats up for AI infra",
            trendScore: 98,
          },
        ],
        limit: 3,
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: ["openai-news"],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1.6,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      label: "Discovery Ladder Ready",
      metrics: [
        { label: "Rungs", value: "3" },
        { label: "Following", value: "1" },
        { label: "New topics", value: "2" },
        { label: "Sources", value: "3" },
      ],
      rungs: [
        {
          actionLabel: "Read next",
          category: "model_release",
          categoryLabel: "Models",
          id: "deepen-model",
          key: "model_release-deepen-model",
          label: "Deepen Models",
          reason: "Known topic reinforced by category and entity signals.",
          scoreLabel: "386 ladder",
          sourceName: "OpenAI News",
          statusLabel: "Following",
          title: "OpenAI model deep dive",
        },
        {
          actionLabel: "Follow topic",
          category: "agent_product",
          categoryLabel: "Agents",
          id: "explore-agents",
          key: "agent_product-explore-agents",
          label: "Explore Agents",
          reason:
            "Exploration signal opens an adjacent topic without replacing the profile.",
          scoreLabel: "355 ladder",
          sourceName: "Agent Desk",
          statusLabel: "Adjacent",
          title: "Agent workflow startup expands",
        },
        {
          actionLabel: "Follow topic",
          category: "funding",
          categoryLabel: "Funding",
          id: "trend-funding",
          key: "funding-trend-funding",
          label: "Track Funding",
          reason: "Trend heat makes this topic worth testing in the profile.",
          scoreLabel: "326 ladder",
          sourceName: "VentureWire",
          statusLabel: "Trending",
          title: "Funding heats up for AI infra",
        },
      ],
      summary:
        "3 discovery rungs connect 1 followed topic with 2 expansion topics.",
    });
  });

  it("keeps the ladder empty until stories are ranked", () => {
    expect(
      getNewsDiscoveryLadder({
        formatCategory: (category) => category,
        items: [],
        limit: 3,
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      label: "Discovery Ladder Waiting",
      metrics: [
        { label: "Rungs", value: "0" },
        { label: "Following", value: "0" },
        { label: "New topics", value: "0" },
        { label: "Sources", value: "0" },
      ],
      rungs: [],
      summary: "Discovery ladder will appear after stories are ranked.",
    });
  });
});

describe("getNewsNextRefreshPlan", () => {
  it("turns saved, read, and hidden signals into the next refresh plan", () => {
    expect(
      getNewsNextRefreshPlan({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "funding"
              ? "Funding"
              : category === "agent_product"
                ? "Agents"
                : category,
        historyItems: [
          {
            ...localItem,
            id: "read-openai",
            category: "model_release",
            entities: ["OpenAI"],
            sourceName: "Local Source",
            sourceSlug: "local-source",
            title: "Read OpenAI model story",
          },
        ],
        items: [
          {
            ...localItem,
            id: "next-openai-model",
            category: "model_release",
            entities: ["OpenAI", "Agents"],
            matchedSignals: ["entity"],
            personalizedScore: 142,
            sourceName: "OpenAI News",
            sourceScore: 90,
            sourceSlug: "openai-news",
            title: "OpenAI model update leads the next refresh",
            trendScore: 82,
          },
          {
            ...serverItem,
            id: "hidden-funding",
            category: "funding",
            entities: ["YC"],
            matchedSignals: ["category"],
            personalizedScore: 136,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Funding story should be dampened",
          },
          {
            ...olderItem,
            id: "explore-robotics",
            category: "agent_product",
            entities: ["Figure"],
            matchedSignals: ["exploration"],
            personalizedScore: 104,
            sourceName: "Robotics Desk",
            sourceSlug: "robotics-desk",
            title: "Robotics agent startup breaks out",
            trendScore: 86,
          },
        ],
        limit: 2,
        negativeFeedbackItems: [
          {
            ...serverItem,
            id: "hidden-funding",
            category: "funding",
            entities: ["YC"],
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Funding story should be dampened",
          },
        ],
        savedItems: [
          {
            ...serverItem,
            id: "saved-openai",
            category: "model_release",
            entities: ["OpenAI"],
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            title: "Saved OpenAI model story",
          },
        ],
      }),
    ).toEqual({
      boosts: [
        {
          detail: "2 saved/read stories",
          label: "OpenAI",
          weightLabel: "+3",
        },
        {
          detail: "2 saved/read stories",
          label: "Models",
          weightLabel: "+3",
        },
        {
          detail: "1 saved/read story",
          label: "OpenAI News",
          weightLabel: "+2",
        },
      ],
      dampers: [
        {
          detail: "1 hidden story",
          label: "Funding",
          weightLabel: "-1",
        },
        {
          detail: "1 hidden story",
          label: "YC",
          weightLabel: "-1",
        },
        {
          detail: "1 hidden story",
          label: "VentureWire",
          weightLabel: "-1",
        },
      ],
      label: "Learning Refresh",
      metrics: [
        { label: "Boosts", value: "3" },
        { label: "Dampers", value: "3" },
        { label: "Candidate slots", value: "2" },
      ],
      slots: [
        {
          id: "next-openai-model",
          reason: "OpenAI boost",
          scoreLabel: "142 score",
          sourceName: "OpenAI News",
          title: "OpenAI model update leads the next refresh",
        },
        {
          id: "explore-robotics",
          reason: "Exploration guard",
          scoreLabel: "104 score",
          sourceName: "Robotics Desk",
          title: "Robotics agent startup breaks out",
        },
      ],
      summary:
        "Next refresh will boost 3 signals, dampen 3 signals, and stage 2 candidate slots.",
    });
  });

  it("uses saved/read and hidden angles to plan the next refresh", () => {
    expect(
      getNewsNextRefreshPlan({
        formatCategory: (category) =>
          category === "security"
            ? "Security"
            : category === "safety"
              ? "Safety"
              : "Markets",
        historyItems: [
          {
            ...localItem,
            category: "security",
            entities: [],
            id: "read-prompt-defense",
            sourceName: "Security Desk",
            sourceSlug: "security-desk",
            tags: ["prompt_injection", "agents"],
            title: "Read prompt defense",
          },
        ],
        items: [
          {
            ...localItem,
            category: "security",
            entities: [],
            id: "prompt-candidate",
            matchedSignals: [],
            personalizedScore: 133,
            sourceName: "Security Desk",
            sourceSlug: "security-desk",
            tags: ["prompt_injection"],
            title: "Prompt injection defense candidate",
            trendScore: 86,
          },
          {
            ...localItem,
            category: "safety",
            entities: [],
            id: "jailbreak-candidate",
            matchedSignals: [],
            personalizedScore: 128,
            sourceName: "Safety Lab",
            sourceSlug: "safety-lab",
            tags: ["jailbreaks"],
            title: "Jailbreak story should be dampened",
            trendScore: 91,
          },
          {
            ...olderItem,
            category: "market_map",
            entities: [],
            id: "market-heat",
            matchedSignals: [],
            personalizedScore: 104,
            sourceName: "Market Wire",
            sourceSlug: "market-wire",
            tags: ["benchmarks"],
            title: "Benchmark market heat remains",
            trendScore: 92,
          },
        ],
        limit: 3,
        negativeFeedbackItems: [
          {
            ...localItem,
            category: "safety",
            entities: [],
            id: "hidden-jailbreak",
            sourceName: "Safety Lab",
            sourceSlug: "safety-lab",
            tags: ["jailbreaks", "research"],
            title: "Hidden jailbreak story",
          },
        ],
        savedItems: [
          {
            ...localItem,
            category: "security",
            entities: [],
            id: "saved-prompt-defense",
            sourceName: "Security Desk",
            sourceSlug: "security-desk",
            tags: ["prompt_injection"],
            title: "Saved prompt defense",
          },
        ],
      }),
    ).toEqual({
      boosts: [
        {
          detail: "2 saved/read stories",
          label: "prompt injection",
          weightLabel: "+3",
        },
        {
          detail: "2 saved/read stories",
          label: "Security",
          weightLabel: "+3",
        },
        {
          detail: "2 saved/read stories",
          label: "Security Desk",
          weightLabel: "+3",
        },
      ],
      dampers: [
        {
          detail: "1 hidden story",
          label: "jailbreaks",
          weightLabel: "-1",
        },
        {
          detail: "1 hidden story",
          label: "Safety",
          weightLabel: "-1",
        },
        {
          detail: "1 hidden story",
          label: "Safety Lab",
          weightLabel: "-1",
        },
      ],
      label: "Learning Refresh",
      metrics: [
        { label: "Boosts", value: "3" },
        { label: "Dampers", value: "3" },
        { label: "Candidate slots", value: "2" },
      ],
      slots: [
        {
          id: "prompt-candidate",
          reason: "prompt injection boost",
          scoreLabel: "133 score",
          sourceName: "Security Desk",
          title: "Prompt injection defense candidate",
        },
        {
          id: "market-heat",
          reason: "Heat check",
          scoreLabel: "104 score",
          sourceName: "Market Wire",
          title: "Benchmark market heat remains",
        },
      ],
      summary:
        "Next refresh will boost 3 signals, dampen 3 signals, and stage 2 candidate slots.",
    });
  });

  it("returns a stable cold refresh plan before stories and signals load", () => {
    expect(
      getNewsNextRefreshPlan({
        formatCategory: (category) => category,
        historyItems: [],
        items: [],
        limit: 3,
        negativeFeedbackItems: [],
        savedItems: [],
      }),
    ).toEqual({
      boosts: [],
      dampers: [],
      label: "Cold Refresh",
      metrics: [
        { label: "Boosts", value: "0" },
        { label: "Dampers", value: "0" },
        { label: "Candidate slots", value: "0" },
      ],
      slots: [],
      summary:
        "Next refresh plan will appear after stories and reader signals load.",
    });
  });
});

describe("getNewsRefreshSimulation", () => {
  it("predicts which stories will be boosted, explored, and dampened on refresh", () => {
    expect(
      getNewsRefreshSimulation({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category === "funding"
                ? "Funding"
                : category,
        historyItems: [
          {
            ...localItem,
            id: "read-openai",
            category: "model_release",
            entities: ["OpenAI"],
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            title: "Read OpenAI story",
          },
        ],
        items: [
          {
            ...localItem,
            id: "refresh-model",
            category: "model_release",
            entities: ["OpenAI"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 148,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            title: "OpenAI model refresh candidate",
            trendScore: 86,
          },
          {
            ...localItem,
            id: "refresh-agent",
            category: "agent_product",
            entities: ["Agents"],
            matchedSignals: ["exploration"],
            personalizedScore: 121,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Agent workflow exploration candidate",
            trendScore: 92,
          },
          {
            ...localItem,
            id: "refresh-funding",
            category: "funding",
            entities: ["YC"],
            matchedSignals: [],
            personalizedScore: 119,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Funding story to reduce",
            trendScore: 88,
          },
        ],
        limit: 3,
        negativeFeedbackItems: [
          {
            ...localItem,
            id: "hidden-funding",
            category: "funding",
            entities: ["YC"],
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Hidden funding story",
          },
        ],
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: ["openai-news"],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1.6,
          recencyBias: 1,
        },
        savedItems: [
          {
            ...localItem,
            id: "saved-openai",
            category: "model_release",
            entities: ["OpenAI"],
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            title: "Saved OpenAI story",
          },
        ],
      }),
    ).toEqual({
      label: "Refresh Simulation Ready",
      metrics: [
        { label: "Moves", value: "3" },
        { label: "Boosts", value: "1" },
        { label: "Explore", value: "1" },
        { label: "Dampers", value: "1" },
      ],
      moves: [
        {
          actionLabel: "Raise weight",
          category: "model_release",
          categoryLabel: "Models",
          deltaLabel: "+36 next",
          id: "refresh-model",
          key: "boost-refresh-model",
          label: "Boost Models",
          reason:
            "Saved or read signals reinforce this story for the next refresh.",
          sourceName: "OpenAI News",
          statusLabel: "Boost",
          title: "OpenAI model refresh candidate",
        },
        {
          actionLabel: "Keep exploring",
          category: "agent_product",
          categoryLabel: "Agents",
          deltaLabel: "+18 next",
          id: "refresh-agent",
          key: "explore-refresh-agent",
          label: "Explore Agents",
          reason: "Novelty bias leaves room for an adjacent topic test.",
          sourceName: "Agent Desk",
          statusLabel: "Explore",
          title: "Agent workflow exploration candidate",
        },
        {
          actionLabel: "Lower weight",
          category: "funding",
          categoryLabel: "Funding",
          deltaLabel: "-42 next",
          id: "refresh-funding",
          key: "dampen-refresh-funding",
          label: "Dampen Funding",
          reason: "Hidden feedback overlaps this topic, source, or entity.",
          sourceName: "VentureWire",
          statusLabel: "Dampen",
          title: "Funding story to reduce",
        },
      ],
      summary:
        "3 simulated refresh moves: 1 boost, 1 exploration, and 1 dampen.",
    });
  });

  it("uses saved/read and hidden angles in refresh simulation moves", () => {
    expect(
      getNewsRefreshSimulation({
        formatCategory: (category) =>
          category === "security"
            ? "Security"
            : category === "safety"
              ? "Safety"
              : category === "agent_product"
                ? "Agents"
                : "Models",
        historyItems: [
          {
            ...localItem,
            category: "model_release",
            entities: [],
            id: "read-prompt-defense",
            sourceName: "Model Wire",
            sourceSlug: "model-wire",
            tags: ["prompt_injection"],
            title: "Read prompt defense",
          },
        ],
        items: [
          {
            ...localItem,
            category: "security",
            entities: [],
            id: "refresh-prompt",
            matchedSignals: [],
            personalizedScore: 132,
            sourceName: "Security Desk",
            sourceSlug: "security-desk",
            tags: ["prompt_injection"],
            title: "Prompt injection refresh candidate",
            trendScore: 84,
          },
          {
            ...localItem,
            category: "agent_product",
            entities: ["Agents"],
            id: "refresh-agent",
            matchedSignals: ["exploration"],
            personalizedScore: 121,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Agent workflow exploration candidate",
            trendScore: 92,
          },
          {
            ...localItem,
            category: "safety",
            entities: [],
            id: "refresh-jailbreak",
            matchedSignals: [],
            personalizedScore: 119,
            sourceName: "Safety Lab",
            sourceSlug: "safety-lab",
            tags: ["jailbreaks"],
            title: "Jailbreak story to reduce",
            trendScore: 88,
          },
        ],
        limit: 3,
        negativeFeedbackItems: [
          {
            ...localItem,
            category: "model_release",
            entities: [],
            id: "hidden-jailbreak",
            sourceName: "Model Wire",
            sourceSlug: "model-wire",
            tags: ["jailbreaks"],
            title: "Hidden jailbreak story",
          },
        ],
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1.4,
          recencyBias: 1,
        },
        savedItems: [],
      }),
    ).toEqual({
      label: "Refresh Simulation Ready",
      metrics: [
        { label: "Moves", value: "3" },
        { label: "Boosts", value: "1" },
        { label: "Explore", value: "1" },
        { label: "Dampers", value: "1" },
      ],
      moves: [
        {
          actionLabel: "Raise weight",
          category: "security",
          categoryLabel: "Security",
          deltaLabel: "+36 next",
          id: "refresh-prompt",
          key: "boost-refresh-prompt",
          label: "Boost Security",
          reason:
            "Saved or read signals reinforce this story for the next refresh.",
          sourceName: "Security Desk",
          statusLabel: "Boost",
          title: "Prompt injection refresh candidate",
        },
        {
          actionLabel: "Keep exploring",
          category: "agent_product",
          categoryLabel: "Agents",
          deltaLabel: "+18 next",
          id: "refresh-agent",
          key: "explore-refresh-agent",
          label: "Explore Agents",
          reason: "Novelty bias leaves room for an adjacent topic test.",
          sourceName: "Agent Desk",
          statusLabel: "Explore",
          title: "Agent workflow exploration candidate",
        },
        {
          actionLabel: "Lower weight",
          category: "safety",
          categoryLabel: "Safety",
          deltaLabel: "-42 next",
          id: "refresh-jailbreak",
          key: "dampen-refresh-jailbreak",
          label: "Dampen Safety",
          reason: "Hidden feedback overlaps this topic, source, entity, or angle.",
          sourceName: "Safety Lab",
          statusLabel: "Dampen",
          title: "Jailbreak story to reduce",
        },
      ],
      summary:
        "3 simulated refresh moves: 1 boost, 1 exploration, and 1 dampen.",
    });
  });

  it("keeps refresh simulation empty before stories are ranked", () => {
    expect(
      getNewsRefreshSimulation({
        formatCategory: (category) => category,
        historyItems: [],
        items: [],
        limit: 3,
        negativeFeedbackItems: [],
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
      label: "Refresh Simulation Waiting",
      metrics: [
        { label: "Moves", value: "0" },
        { label: "Boosts", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Dampers", value: "0" },
      ],
      moves: [],
      summary: "Refresh simulation will appear after stories are ranked.",
    });
  });
});

describe("getNewsTasteCalibration", () => {
  it("turns reader memory, exploration, and negative feedback into calibration actions", () => {
    expect(
      getNewsTasteCalibration({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category === "funding"
                ? "Funding"
                : category,
        historyItems: [
          {
            ...localItem,
            id: "read-openai",
            category: "model_release",
            entities: ["OpenAI"],
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            title: "Read OpenAI story",
          },
        ],
        items: [
          {
            ...localItem,
            id: "calibrate-model",
            category: "model_release",
            entities: ["OpenAI"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 150,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            title: "OpenAI model calibration story",
            trendScore: 86,
          },
          {
            ...localItem,
            id: "calibrate-agent",
            category: "agent_product",
            entities: ["Agents"],
            matchedSignals: ["exploration"],
            personalizedScore: 123,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Agent exploration calibration story",
            trendScore: 91,
          },
          {
            ...localItem,
            id: "calibrate-funding",
            category: "funding",
            entities: ["YC"],
            matchedSignals: [],
            personalizedScore: 118,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Funding story to dampen",
            trendScore: 89,
          },
        ],
        limit: 3,
        negativeFeedbackItems: [
          {
            ...localItem,
            id: "hidden-funding",
            category: "funding",
            entities: ["YC"],
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Hidden funding story",
          },
        ],
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: ["openai-news"],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1.4,
          recencyBias: 1,
        },
        savedItems: [
          {
            ...localItem,
            id: "saved-openai",
            category: "model_release",
            entities: ["OpenAI"],
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            title: "Saved OpenAI story",
          },
        ],
      }),
    ).toEqual({
      actions: [
        {
          actionLabel: "Keep signal",
          detail:
            "OpenAI model calibration story reinforces saved/read behavior and explicit preferences.",
          key: "aligned-calibrate-model",
          label: "Strengthen Models",
          signal: "Models",
          statusLabel: "Aligned",
          storyTitle: "OpenAI model calibration story",
        },
        {
          actionLabel: "Keep slot",
          detail:
            "Agent exploration calibration story tests adjacent coverage without negative overlap.",
          key: "explore-calibrate-agent",
          label: "Keep exploring Agents",
          signal: "Agents",
          statusLabel: "Explore",
          storyTitle: "Agent exploration calibration story",
        },
        {
          actionLabel: "Reduce weight",
          detail: "Funding story to dampen overlaps hidden feedback.",
          key: "dampen-calibrate-funding",
          label: "Reduce Funding",
          signal: "Funding",
          statusLabel: "Dampen",
          storyTitle: "Funding story to dampen",
        },
      ],
      label: "Taste Calibration Ready",
      metrics: [
        { label: "Stories", value: "3" },
        { label: "Profile fit", value: "1/3" },
        { label: "Memory hits", value: "1" },
        { label: "Friction", value: "1" },
      ],
      summary:
        "3 stories calibrate this taste model: 1 profile fit, 1 exploration, and 1 friction signal.",
    });
  });

  it("treats explicit angle preferences as profile fit during calibration", () => {
    expect(
      getNewsTasteCalibration({
        formatCategory: (category) =>
          category === "security" ? "Security" : "Safety",
        historyItems: [
          {
            ...localItem,
            category: "model_release",
            entities: [],
            id: "read-prompt-defense",
            sourceName: "Model Wire",
            sourceSlug: "model-wire",
            tags: ["prompt_injection"],
            title: "Read prompt defense",
          },
        ],
        items: [
          {
            ...localItem,
            category: "security",
            entities: [],
            id: "calibrate-prompt",
            matchedSignals: [],
            personalizedScore: 136,
            sourceName: "Security Desk",
            sourceSlug: "security-desk",
            tags: ["prompt_injection"],
            title: "Prompt injection calibration story",
            trendScore: 84,
          },
          {
            ...localItem,
            category: "safety",
            entities: [],
            id: "calibrate-jailbreak",
            matchedSignals: [],
            personalizedScore: 121,
            sourceName: "Safety Lab",
            sourceSlug: "safety-lab",
            tags: ["jailbreaks"],
            title: "Jailbreak story to dampen",
            trendScore: 88,
          },
        ],
        limit: 2,
        negativeFeedbackItems: [
          {
            ...localItem,
            category: "model_release",
            entities: [],
            id: "hidden-jailbreak",
            sourceName: "Model Wire",
            sourceSlug: "model-wire",
            tags: ["jailbreaks"],
            title: "Hidden jailbreak story",
          },
        ],
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: ["prompt_injection"],
          noveltyBias: 1,
          recencyBias: 1,
        },
        savedItems: [],
      }),
    ).toEqual({
      actions: [
        {
          actionLabel: "Keep signal",
          detail:
            "Prompt injection calibration story reinforces saved/read behavior and explicit preferences.",
          key: "aligned-calibrate-prompt",
          label: "Strengthen Security",
          signal: "Security",
          statusLabel: "Aligned",
          storyTitle: "Prompt injection calibration story",
        },
        {
          actionLabel: "Reduce weight",
          detail: "Jailbreak story to dampen overlaps hidden feedback.",
          key: "dampen-calibrate-jailbreak",
          label: "Reduce Safety",
          signal: "Safety",
          statusLabel: "Dampen",
          storyTitle: "Jailbreak story to dampen",
        },
      ],
      label: "Taste Calibration Ready",
      metrics: [
        { label: "Stories", value: "2" },
        { label: "Profile fit", value: "1/2" },
        { label: "Memory hits", value: "1" },
        { label: "Friction", value: "1" },
      ],
      summary:
        "2 stories calibrate this taste model: 1 profile fit, 0 explorations, and 1 friction signal.",
    });
  });

  it("keeps calibration stable before ranked stories exist", () => {
    expect(
      getNewsTasteCalibration({
        formatCategory: (category) => category,
        historyItems: [],
        items: [],
        limit: 3,
        negativeFeedbackItems: [],
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
      actions: [],
      label: "Taste Calibration Waiting",
      metrics: [
        { label: "Stories", value: "0" },
        { label: "Profile fit", value: "0/0" },
        { label: "Memory hits", value: "0" },
        { label: "Friction", value: "0" },
      ],
      summary: "Taste calibration will appear after stories are ranked.",
    });
  });
});

describe("getNewsFeedGovernor", () => {
  it("flags a concentrated angle even when sources and topics are mixed", () => {
    const governor = getNewsFeedGovernor({
      formatCategory: (category) =>
        category === "security"
          ? "Security"
          : category === "research"
            ? "Research"
            : category === "market_map"
              ? "Market Maps"
              : category,
      items: [
        {
          ...localItem,
          category: "security",
          entities: ["Agent Security"],
          matchedSignals: ["tag"],
          personalizedScore: 145,
          sourceName: "Security Desk",
          sourceSlug: "security-desk",
          tags: ["prompt_injection"],
        },
        {
          ...serverItem,
          category: "research",
          entities: ["Browser Agents"],
          matchedSignals: ["tag"],
          personalizedScore: 130,
          sourceName: "Research Wire",
          sourceSlug: "research-wire",
          tags: ["prompt_injection"],
        },
        {
          ...olderItem,
          category: "market_map",
          entities: ["AI Market"],
          matchedSignals: ["tag"],
          personalizedScore: 120,
          sourceName: "Market Desk",
          sourceSlug: "market-desk",
          tags: ["prompt_injection", "red_team"],
        },
        {
          ...olderItem,
          category: "research",
          entities: ["Benchmarks"],
          id: "red-team-research",
          matchedSignals: ["exploration"],
          personalizedScore: 110,
          sourceName: "Lab Notes",
          sourceSlug: "lab-notes",
          tags: ["red_team"],
        },
      ],
      profile: {
        preferredCategories: ["security"],
        preferredSources: [],
        preferredEntities: ["prompt_injection"],
        noveltyBias: 1,
        recencyBias: 1,
      },
    });

    expect(governor.metrics).toContainEqual({
      label: "Top angle",
      value: "75%",
    });
    expect(governor.risks).toContainEqual({
      detail: "prompt injection appears in 75% of this slice.",
      label: "Angle concentration",
    });
    expect(governor.controls).toContainEqual({
      action: "follow_entity",
      buttonLabel: "Follow angle",
      label: "Angle spread",
      reason: "red team broadens coverage beyond prompt injection.",
      signal: "red_team",
    });
    expect(governor.summary).toBe(
      "4 stories under governance: top source 25%, top topic 50%, top entity 25%, top angle 75%, exploration 25%.",
    );
  });

  it("flags a concentrated entity even when sources and topics are mixed", () => {
    const governor = getNewsFeedGovernor({
      formatCategory: (category) =>
        category === "model_release"
          ? "Models"
          : category === "funding"
            ? "Funding"
            : category === "agent_product"
              ? "Agents"
              : category === "research"
                ? "Research"
                : category,
      items: [
        {
          ...localItem,
          category: "model_release",
          entities: ["OpenAI", "Agents"],
          matchedSignals: ["entity"],
          personalizedScore: 145,
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
        },
        {
          ...serverItem,
          category: "funding",
          entities: ["OpenAI", "Series A"],
          matchedSignals: ["entity"],
          personalizedScore: 130,
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
        },
        {
          ...olderItem,
          category: "agent_product",
          entities: ["OpenAI", "Agents"],
          matchedSignals: ["entity"],
          personalizedScore: 120,
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
        },
        {
          ...olderItem,
          category: "research",
          entities: ["Anthropic", "Claude"],
          id: "anthropic-research",
          matchedSignals: ["exploration"],
          personalizedScore: 110,
          sourceName: "Research Lab",
          sourceSlug: "research-lab",
        },
      ],
      profile: {
        preferredCategories: ["model_release"],
        preferredSources: [],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1,
        recencyBias: 1,
      },
    });

    expect(governor.metrics).toContainEqual({
      label: "Top entity",
      value: "75%",
    });
    expect(governor.risks).toContainEqual({
      detail: "OpenAI appears in 75% of this slice.",
      label: "Entity concentration",
    });
    expect(governor.controls).toContainEqual({
      action: "follow_entity",
      buttonLabel: "Follow entity",
      label: "Entity spread",
      reason: "Anthropic broadens coverage beyond OpenAI.",
      signal: "Anthropic",
    });
    expect(governor.summary).toBe(
      "4 stories under governance: top source 25%, top topic 25%, top entity 75%, exploration 25%.",
    );
  });

  it("flags a narrow For You slice and suggests controls that broaden the recommendation mix", () => {
    expect(
      getNewsFeedGovernor({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category,
        items: [
          {
            ...localItem,
            matchedSignals: ["category"],
            personalizedScore: 145,
            trendScore: 85,
          },
          {
            ...localItem,
            id: "local-follow-up",
            matchedSignals: ["category"],
            personalizedScore: 138,
            trendScore: 84,
          },
          {
            ...olderItem,
            id: "local-analysis",
            matchedSignals: ["category"],
            personalizedScore: 132,
            trendScore: 78,
          },
          {
            ...serverItem,
            matchedSignals: ["category"],
            personalizedScore: 120,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            trendScore: 82,
          },
          {
            ...olderItem,
            category: "agent_product",
            entities: ["Agents"],
            id: "agent-market",
            matchedSignals: [],
            personalizedScore: 99,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            trendScore: 70,
          },
        ],
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: ["local-source"],
          preferredEntities: ["OpenAI"],
          noveltyBias: 0.5,
          recencyBias: 1.8,
        },
      }),
    ).toEqual({
      controls: [
        {
          action: "increase_novelty",
          buttonLabel: "Open explore",
          label: "Add exploration",
          reason:
            "No exploration stories are present, so raise novelty to test broader AI coverage.",
        },
        {
          action: "reset_balance",
          buttonLabel: "Set neutral",
          label: "Rebalance bias",
          reason:
            "Freshness is leading the feed; reset freshness and novelty to a neutral mix.",
        },
        {
          action: "follow_source",
          buttonLabel: "Follow source",
          label: "Source spread",
          reason: "OpenAI News adds another source outside Local Source.",
          signal: "openai-news",
        },
        {
          action: "follow_topic",
          buttonLabel: "Follow topic",
          label: "Topic spread",
          reason: "Agents broadens coverage beyond Models.",
          signal: "agent_product",
        },
      ],
      label: "Bubble Watch",
      metrics: [
        { label: "Top source", value: "60%" },
        { label: "Top topic", value: "80%" },
        { label: "Top entity", value: "80%" },
        { label: "Exploration", value: "0%" },
        { label: "Bias mode", value: "Freshness" },
      ],
      risks: [
        {
          detail: "Local Source owns 60% of this slice.",
          label: "Source concentration",
        },
        {
          detail: "Models represents 80% of this slice.",
          label: "Topic concentration",
        },
        {
          detail: "OpenAI appears in 80% of this slice.",
          label: "Entity concentration",
        },
        {
          detail:
            "No exploration stories are present, so the feed is relying on known or trend-led coverage.",
          label: "Exploration gap",
        },
      ],
      summary:
        "5 stories under governance: top source 60%, top topic 80%, top entity 80%, exploration 0%.",
    });
  });

  it("recognizes a healthy mix while still exposing lightweight tuning controls", () => {
    expect(
      getNewsFeedGovernor({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category === "funding"
                ? "Funding"
                : category === "research"
                  ? "Research"
                  : category,
        items: [
          {
            ...localItem,
            matchedSignals: ["category"],
            personalizedScore: 132,
          },
          {
            ...serverItem,
            category: "agent_product",
            entities: ["Anthropic"],
            matchedSignals: ["exploration"],
            personalizedScore: 118,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
          },
          {
            ...olderItem,
            category: "funding",
            entities: ["Mistral"],
            matchedSignals: [],
            personalizedScore: 105,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
          {
            ...olderItem,
            category: "research",
            entities: ["DeepMind"],
            id: "research-story",
            matchedSignals: ["entity"],
            personalizedScore: 101,
            sourceName: "Research Lab",
            sourceSlug: "research-lab",
          },
        ],
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: ["local-source"],
          preferredEntities: ["OpenAI", "Anthropic"],
          noveltyBias: 1.5,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      controls: [
        {
          action: "increase_recency",
          buttonLabel: "Freshen",
          label: "Freshness guard",
          reason:
            "Discovery is leading; raise freshness when breaking AI stories matter more.",
        },
        {
          action: "reset_balance",
          buttonLabel: "Set neutral",
          label: "Neutral mix",
          reason: "Reset novelty and freshness when the feed feels over-tuned.",
        },
      ],
      label: "Healthy Mix",
      metrics: [
        { label: "Top source", value: "25%" },
        { label: "Top topic", value: "25%" },
        { label: "Top entity", value: "25%" },
        { label: "Exploration", value: "25%" },
        { label: "Bias mode", value: "Discovery" },
      ],
      risks: [
        {
          detail: "No source, topic, or entity dominates this edition slice.",
          label: "Coverage healthy",
        },
        {
          detail:
            "1 exploration story is testing coverage outside the current profile.",
          label: "Exploration active",
        },
      ],
      summary:
        "4 stories under governance: top source 25%, top topic 25%, top entity 25%, exploration 25%.",
    });
  });

  it("keeps governance stable while ranked stories are unavailable", () => {
    expect(
      getNewsFeedGovernor({
        formatCategory: (category) => category,
        items: [],
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      controls: [],
      label: "Waiting",
      metrics: [
        { label: "Top source", value: "0%" },
        { label: "Top topic", value: "0%" },
        { label: "Top entity", value: "0%" },
        { label: "Exploration", value: "0%" },
        { label: "Bias mode", value: "Balanced" },
      ],
      risks: [
        {
          detail: "Feed governance will appear after stories are ranked.",
          label: "Waiting for stories",
        },
      ],
      summary: "Feed governance will appear as stories load.",
    });
  });
});

describe("getNewsFilterBubbleReport", () => {
  it("flags a narrow profile-matched feed before it becomes a filter bubble", () => {
    expect(
      getNewsFilterBubbleReport({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category,
        items: [
          {
            ...localItem,
            id: "openai-model-1",
            matchedSignals: ["category", "source", "entity"],
            personalizedScore: 150,
            title: "OpenAI ships a new reasoning model",
          },
          {
            ...localItem,
            id: "openai-model-2",
            matchedSignals: ["category", "source"],
            personalizedScore: 143,
            title: "Model pricing changes for developers",
          },
          {
            ...localItem,
            id: "openai-model-3",
            matchedSignals: ["category", "entity"],
            personalizedScore: 136,
            title: "OpenAI expands model evals",
          },
          {
            ...localItem,
            category: "agent_product",
            entities: ["Agents"],
            id: "agent-explore",
            matchedSignals: ["exploration"],
            personalizedScore: 118,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Agent teams test memory workflows",
          },
        ],
        profile: localProfile,
      }),
    ).toEqual({
      checks: [
        {
          action:
            "Add one exploration story or raise novelty before the next refresh.",
          detail: "3 of 4 stories match explicit reader signals.",
          label: "Profile lock",
          status: "risk",
        },
        {
          action:
            "Follow another source covering Models before keeping this mix.",
          detail: "Local Source carries 3 of 4 stories.",
          label: "Source narrowness",
          status: "risk",
        },
        {
          action: "Keep at least 1 adjacent story visible in this edition.",
          detail: "1 exploration story is present.",
          label: "Exploration floor",
          status: "watch",
        },
      ],
      label: "Bubble Risk",
      metrics: [
        { label: "Profile share", value: "75%" },
        { label: "Exploration", value: "25%" },
        { label: "Source spread", value: "2 sources" },
        { label: "Entity spread", value: "1 entity" },
        { label: "Dominant topic", value: "Models" },
      ],
      summary:
        "Filter bubble risk is high: 3 profile-matched stories and 1 exploration story across 2 sources.",
    });
  });

  it("flags entity concentration even when profile and source mix look broad", () => {
    expect(
      getNewsFilterBubbleReport({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "funding"
              ? "Funding"
              : category === "agent_product"
                ? "Agents"
                : category,
        items: [
          {
            ...localItem,
            id: "openai-model-release",
            matchedSignals: ["entity"],
            personalizedScore: 150,
            sourceName: "Model Wire",
            sourceSlug: "model-wire",
            title: "OpenAI ships a faster reasoning model",
          },
          {
            ...localItem,
            category: "funding",
            id: "anthropic-funding",
            matchedSignals: ["exploration"],
            personalizedScore: 142,
            sourceName: "Funding Desk",
            sourceSlug: "funding-desk",
            title: "Anthropic closes an enterprise expansion round",
            entities: ["Anthropic"],
          },
          {
            ...localItem,
            category: "agent_product",
            id: "openai-agent",
            matchedSignals: ["entity"],
            personalizedScore: 139,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "OpenAI agent workflows roll into team plans",
          },
          {
            ...localItem,
            category: "research",
            id: "mistral-research",
            matchedSignals: ["exploration"],
            personalizedScore: 131,
            sourceName: "Research Notes",
            sourceSlug: "research-notes",
            title: "Mistral publishes a new evaluation suite",
            entities: ["Mistral"],
          },
          {
            ...localItem,
            category: "big_tech",
            id: "openai-platform",
            matchedSignals: ["entity"],
            personalizedScore: 126,
            sourceName: "Platform Brief",
            sourceSlug: "platform-brief",
            title: "OpenAI platform tooling gains new safety hooks",
          },
        ],
        profile: {
          ...localProfile,
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: ["OpenAI"],
        },
      }),
    ).toEqual({
      checks: [
        {
          action: "Keep adjacent coverage in the next refresh.",
          detail: "3 of 5 stories match explicit reader signals.",
          label: "Profile lock",
          status: "watch",
        },
        {
          action:
            "Add another entity before letting OpenAI dominate the next refresh.",
          detail: "OpenAI appears in 3 of 5 stories across mixed sources.",
          label: "Entity lock",
          status: "risk",
        },
        {
          action: "Keep this exploration floor while the profile learns.",
          detail: "2 exploration stories are present.",
          label: "Exploration floor",
          status: "clear",
        },
      ],
      label: "Bubble Risk",
      metrics: [
        { label: "Profile share", value: "60%" },
        { label: "Exploration", value: "40%" },
        { label: "Source spread", value: "5 sources" },
        { label: "Entity spread", value: "3 entities" },
        { label: "Dominant topic", value: "Models" },
      ],
      summary:
        "Filter bubble risk is high: 3 profile-matched stories, 2 exploration stories, and 5 sources with OpenAI dominating the entity mix.",
    });
  });

  it("flags angle concentration even when sources and topics look broad", () => {
    const report = getNewsFilterBubbleReport({
      formatCategory: (category) =>
        category === "security"
          ? "Security"
          : category === "research"
            ? "Research"
            : category === "market_map"
              ? "Market Maps"
              : category === "policy"
                ? "Policy"
                : category,
      items: [
        {
          ...localItem,
          category: "security",
          entities: ["Agent Security"],
          id: "prompt-injection-security",
          matchedSignals: ["tag"],
          personalizedScore: 150,
          sourceName: "Security Desk",
          sourceSlug: "security-desk",
          tags: ["prompt_injection"],
          title: "Prompt injection incident response expands",
        },
        {
          ...localItem,
          category: "research",
          entities: ["Browser Agents"],
          id: "prompt-injection-research",
          matchedSignals: ["tag"],
          personalizedScore: 142,
          sourceName: "Research Wire",
          sourceSlug: "research-wire",
          tags: ["prompt_injection"],
          title: "Researchers benchmark prompt injection mitigations",
        },
        {
          ...localItem,
          category: "market_map",
          entities: ["AI Market"],
          id: "prompt-injection-market",
          matchedSignals: ["tag"],
          personalizedScore: 136,
          sourceName: "Market Desk",
          sourceSlug: "market-desk",
          tags: ["prompt_injection"],
          title: "Prompt injection vendors enter market maps",
        },
        {
          ...localItem,
          category: "policy",
          entities: ["Policy Teams"],
          id: "red-team-policy",
          matchedSignals: ["exploration"],
          personalizedScore: 128,
          sourceName: "Policy Desk",
          sourceSlug: "policy-desk",
          tags: ["red_team"],
          title: "Policy teams formalize red-team reporting",
        },
        {
          ...localItem,
          category: "research",
          entities: ["Eval Teams"],
          id: "evals-research",
          matchedSignals: ["exploration"],
          personalizedScore: 120,
          sourceName: "Lab Notes",
          sourceSlug: "lab-notes",
          tags: ["evals"],
          title: "Research teams update eval coverage",
        },
      ],
      profile: {
        ...localProfile,
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: ["prompt_injection"],
      },
    });

    expect(report.checks).toContainEqual({
      action:
        "Add another angle before letting prompt injection dominate the next refresh.",
      detail:
        "prompt injection appears in 3 of 5 stories across mixed sources.",
      label: "Angle lock",
      status: "risk",
    });
    expect(report.metrics).toContainEqual({
      label: "Angle spread",
      value: "3 angles",
    });
    expect(report.label).toBe("Bubble Risk");
    expect(report.summary).toBe(
      "Filter bubble risk is high: 3 profile-matched stories, 2 exploration stories, and 5 sources with prompt injection dominating the angle mix.",
    );
  });

  it("keeps the report empty while ranked stories are unavailable", () => {
    expect(
      getNewsFilterBubbleReport({
        formatCategory: (category) => category,
        items: [],
        profile: localProfile,
      }),
    ).toEqual({
      checks: [],
      label: "Waiting",
      metrics: [
        { label: "Profile share", value: "0%" },
        { label: "Exploration", value: "0%" },
        { label: "Source spread", value: "0 sources" },
        { label: "Entity spread", value: "0 entities" },
        { label: "Dominant topic", value: "None" },
      ],
      summary: "Filter bubble report will appear after stories are ranked.",
    });
  });
});

describe("getNewsDistributionQueue", () => {
  it("routes counterweight exploration stories into balance when one entity dominates", () => {
    expect(
      getNewsDistributionQueue({
        hiddenItemIds: [],
        items: [
          {
            ...localItem,
            id: "openai-lead",
            matchedSignals: ["category", "entity"],
            personalizedScore: 152,
            sourceName: "Model Desk",
            sourceSlug: "model-desk",
            title: "OpenAI model update leads the edition",
          },
          {
            ...localItem,
            id: "openai-platform",
            matchedSignals: ["source", "entity"],
            personalizedScore: 144,
            sourceName: "Platform Brief",
            sourceSlug: "platform-brief",
            title: "OpenAI platform tools expand for teams",
          },
          {
            ...localItem,
            id: "openai-follow",
            matchedSignals: ["entity"],
            personalizedScore: 128,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "OpenAI agents add workflow controls",
          },
          {
            ...localItem,
            category: "research",
            entities: ["Anthropic"],
            id: "anthropic-counterweight",
            matchedSignals: ["exploration"],
            personalizedScore: 119,
            sourceName: "Research Notes",
            sourceSlug: "research-notes",
            title: "Anthropic publishes an evaluation update",
          },
        ],
        limit: 2,
        negativeFeedbackItems: [],
      }),
    ).toEqual({
      label: "Distribution Ready",
      metrics: [
        { label: "Boost", value: "2" },
        { label: "Balance", value: "1" },
        { label: "Hold", value: "1" },
        { label: "Explore", value: "0" },
        { label: "Suppress", value: "0" },
      ],
      queues: [
        {
          count: 2,
          key: "boost",
          label: "Boost",
          shareLabel: "50%",
          stories: [
            {
              id: "openai-lead",
              reason: "2 reader signals",
              scoreLabel: "152 score",
              sourceName: "Model Desk",
              title: "OpenAI model update leads the edition",
            },
            {
              id: "openai-platform",
              reason: "2 reader signals",
              scoreLabel: "144 score",
              sourceName: "Platform Brief",
              title: "OpenAI platform tools expand for teams",
            },
          ],
          summary:
            "Direct reader matches are ready to lead the next impression.",
        },
        {
          count: 1,
          key: "balance",
          label: "Balance",
          shareLabel: "25%",
          stories: [
            {
              id: "anthropic-counterweight",
              reason: "Counterbalances OpenAI concentration",
              scoreLabel: "119 score",
              sourceName: "Research Notes",
              title: "Anthropic publishes an evaluation update",
            },
          ],
          summary:
            "Counterweight stories keep entity concentration from narrowing the next impression.",
        },
        {
          count: 1,
          key: "hold",
          label: "Hold",
          shareLabel: "25%",
          stories: [
            {
              id: "openai-follow",
              reason: "Trend-led candidate",
              scoreLabel: "128 score",
              sourceName: "Agent Desk",
              title: "OpenAI agents add workflow controls",
            },
          ],
          summary:
            "Useful trend-led stories stay available without overtaking stronger signals.",
        },
        {
          count: 0,
          key: "explore",
          label: "Explore",
          shareLabel: "0%",
          stories: [],
          summary:
            "Outside-profile stories are isolated so the system can test new interests.",
        },
        {
          count: 0,
          key: "suppress",
          label: "Suppress",
          shareLabel: "0%",
          stories: [],
          summary:
            "Hidden or negatively matched stories are kept out of active recommendation lanes.",
        },
      ],
      summary:
        "4 stories distributed: 2 boost, 1 balance, 1 hold, 0 explore, and 0 suppress.",
    });
  });

  it("routes counterweight exploration stories into balance when one angle dominates", () => {
    expect(
      getNewsDistributionQueue({
        hiddenItemIds: [],
        items: [
          {
            ...localItem,
            category: "security",
            entities: ["Agent Security"],
            id: "prompt-injection-lead",
            matchedSignals: ["tag"],
            personalizedScore: 152,
            sourceName: "Security Desk",
            sourceSlug: "security-desk",
            tags: ["prompt_injection"],
            title: "Prompt injection response leads the edition",
          },
          {
            ...localItem,
            category: "research",
            entities: ["Browser Agents"],
            id: "prompt-injection-research",
            matchedSignals: ["tag"],
            personalizedScore: 144,
            sourceName: "Research Wire",
            sourceSlug: "research-wire",
            tags: ["prompt_injection"],
            title: "Research teams benchmark prompt injection defenses",
          },
          {
            ...localItem,
            category: "market_map",
            entities: ["AI Market"],
            id: "prompt-injection-market",
            matchedSignals: ["tag"],
            personalizedScore: 128,
            sourceName: "Market Desk",
            sourceSlug: "market-desk",
            tags: ["prompt_injection"],
            title: "Prompt injection tools move into market maps",
          },
          {
            ...localItem,
            category: "policy",
            entities: ["Policy Teams"],
            id: "red-team-counterweight",
            matchedSignals: ["exploration"],
            personalizedScore: 119,
            sourceName: "Policy Desk",
            sourceSlug: "policy-desk",
            tags: ["red_team"],
            title: "Policy teams formalize red-team disclosures",
          },
        ],
        limit: 2,
        negativeFeedbackItems: [],
      }),
    ).toEqual({
      label: "Distribution Ready",
      metrics: [
        { label: "Boost", value: "2" },
        { label: "Balance", value: "1" },
        { label: "Hold", value: "1" },
        { label: "Explore", value: "0" },
        { label: "Suppress", value: "0" },
      ],
      queues: [
        {
          count: 2,
          key: "boost",
          label: "Boost",
          shareLabel: "50%",
          stories: [
            {
              id: "prompt-injection-lead",
              reason: "1 reader signal",
              scoreLabel: "152 score",
              sourceName: "Security Desk",
              title: "Prompt injection response leads the edition",
            },
            {
              id: "prompt-injection-research",
              reason: "1 reader signal",
              scoreLabel: "144 score",
              sourceName: "Research Wire",
              title: "Research teams benchmark prompt injection defenses",
            },
          ],
          summary:
            "Direct reader matches are ready to lead the next impression.",
        },
        {
          count: 1,
          key: "balance",
          label: "Balance",
          shareLabel: "25%",
          stories: [
            {
              id: "red-team-counterweight",
              reason: "Counterbalances prompt injection concentration",
              scoreLabel: "119 score",
              sourceName: "Policy Desk",
              title: "Policy teams formalize red-team disclosures",
            },
          ],
          summary:
            "Counterweight stories keep entity concentration from narrowing the next impression.",
        },
        {
          count: 1,
          key: "hold",
          label: "Hold",
          shareLabel: "25%",
          stories: [
            {
              id: "prompt-injection-market",
              reason: "Trend-led candidate",
              scoreLabel: "128 score",
              sourceName: "Market Desk",
              title: "Prompt injection tools move into market maps",
            },
          ],
          summary:
            "Useful trend-led stories stay available without overtaking stronger signals.",
        },
        {
          count: 0,
          key: "explore",
          label: "Explore",
          shareLabel: "0%",
          stories: [],
          summary:
            "Outside-profile stories are isolated so the system can test new interests.",
        },
        {
          count: 0,
          key: "suppress",
          label: "Suppress",
          shareLabel: "0%",
          stories: [],
          summary:
            "Hidden or negatively matched stories are kept out of active recommendation lanes.",
        },
      ],
      summary:
        "4 stories distributed: 2 boost, 1 balance, 1 hold, 0 explore, and 0 suppress.",
    });
  });

  it("classifies ranked stories into boost, hold, explore, and suppress queues", () => {
    expect(
      getNewsDistributionQueue({
        hiddenItemIds: ["hidden-story"],
        items: [
          {
            ...localItem,
            id: "boost-story",
            matchedSignals: ["category", "source"],
            personalizedScore: 148,
            sourceName: "Local Source",
            title: "Model launch matches the reader profile",
            trendScore: 82,
          },
          {
            ...serverItem,
            id: "hold-story",
            matchedSignals: [],
            personalizedScore: 122,
            sourceName: "Model Wire",
            sourceSlug: "model-wire",
            title: "Trend-led model market analysis",
            trendScore: 91,
          },
          {
            ...olderItem,
            category: "robotics",
            entities: ["Figure"],
            id: "explore-story",
            matchedSignals: ["exploration"],
            personalizedScore: 116,
            sourceName: "Robotics Desk",
            sourceSlug: "robotics-desk",
            title: "Robotics agent startup enters the explore lane",
            trendScore: 88,
          },
          {
            ...olderItem,
            id: "hidden-story",
            matchedSignals: ["category"],
            personalizedScore: 130,
            sourceName: "Hidden Desk",
            sourceSlug: "hidden-desk",
            title: "Hidden story should leave active lanes",
          },
          {
            ...serverItem,
            category: "funding",
            entities: ["YC"],
            id: "negative-story",
            matchedSignals: ["category"],
            personalizedScore: 126,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Funding story matches a negative signal",
          },
        ],
        limit: 2,
        negativeFeedbackItems: [
          {
            ...serverItem,
            category: "funding",
            entities: ["YC"],
            id: "hidden-funding",
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Hidden funding story",
          },
        ],
      }),
    ).toEqual({
      label: "Distribution Ready",
      metrics: [
        { label: "Boost", value: "1" },
        { label: "Balance", value: "0" },
        { label: "Hold", value: "1" },
        { label: "Explore", value: "1" },
        { label: "Suppress", value: "2" },
      ],
      queues: [
        {
          count: 1,
          key: "boost",
          label: "Boost",
          shareLabel: "20%",
          stories: [
            {
              id: "boost-story",
              reason: "2 reader signals",
              scoreLabel: "148 score",
              sourceName: "Local Source",
              title: "Model launch matches the reader profile",
            },
          ],
          summary:
            "Direct reader matches are ready to lead the next impression.",
        },
        {
          count: 0,
          key: "balance",
          label: "Balance",
          shareLabel: "0%",
          stories: [],
          summary:
            "Counterweight stories keep entity concentration from narrowing the next impression.",
        },
        {
          count: 1,
          key: "hold",
          label: "Hold",
          shareLabel: "20%",
          stories: [
            {
              id: "hold-story",
              reason: "Trend-led candidate",
              scoreLabel: "122 score",
              sourceName: "Model Wire",
              title: "Trend-led model market analysis",
            },
          ],
          summary:
            "Useful trend-led stories stay available without overtaking stronger signals.",
        },
        {
          count: 1,
          key: "explore",
          label: "Explore",
          shareLabel: "20%",
          stories: [
            {
              id: "explore-story",
              reason: "Exploration signal",
              scoreLabel: "116 score",
              sourceName: "Robotics Desk",
              title: "Robotics agent startup enters the explore lane",
            },
          ],
          summary:
            "Outside-profile stories are isolated so the system can test new interests.",
        },
        {
          count: 2,
          key: "suppress",
          label: "Suppress",
          shareLabel: "40%",
          stories: [
            {
              id: "hidden-story",
              reason: "Hidden by reader",
              scoreLabel: "130 score",
              sourceName: "Hidden Desk",
              title: "Hidden story should leave active lanes",
            },
            {
              id: "negative-story",
              reason: "Negative feedback match",
              scoreLabel: "126 score",
              sourceName: "VentureWire",
              title: "Funding story matches a negative signal",
            },
          ],
          summary:
            "Hidden or negatively matched stories are kept out of active recommendation lanes.",
        },
      ],
      summary:
        "5 stories distributed: 1 boost, 0 balance, 1 hold, 1 explore, and 2 suppress.",
    });
  });

  it("suppresses stories sharing a hidden angle even when topic, source, and entity differ", () => {
    const queue = getNewsDistributionQueue({
      hiddenItemIds: [],
      items: [
        {
          ...localItem,
          category: "research",
          entities: ["Browser Agents"],
          id: "same-angle-story",
          matchedSignals: ["tag"],
          personalizedScore: 142,
          sourceName: "Research Wire",
          sourceSlug: "research-wire",
          tags: ["prompt_injection"],
          title: "Researchers publish prompt injection mitigations",
        },
        {
          ...serverItem,
          category: "market_map",
          entities: ["AI Market"],
          id: "different-angle-story",
          matchedSignals: [],
          personalizedScore: 118,
          sourceName: "Market Desk",
          sourceSlug: "market-desk",
          tags: ["gpu_cloud"],
          title: "GPU cloud market map shifts toward inference",
        },
      ],
      limit: 3,
      negativeFeedbackItems: [
        {
          ...olderItem,
          category: "security",
          entities: ["Agent Security"],
          id: "hidden-prompt-injection",
          sourceName: "Security Desk",
          sourceSlug: "security-desk",
          tags: ["prompt_injection"],
          title: "Reader hid a prompt injection story",
        },
      ],
    });
    const suppressQueue = queue.queues.find(
      (bucket) => bucket.key === "suppress",
    );

    expect(queue.metrics).toContainEqual({ label: "Suppress", value: "1" });
    expect(suppressQueue?.stories).toContainEqual({
      id: "same-angle-story",
      reason: "Negative feedback match",
      scoreLabel: "142 score",
      sourceName: "Research Wire",
      title: "Researchers publish prompt injection mitigations",
    });
  });

  it("keeps an explicit waiting distribution while ranked stories are unavailable", () => {
    expect(
      getNewsDistributionQueue({
        hiddenItemIds: [],
        items: [],
        limit: 2,
        negativeFeedbackItems: [],
      }),
    ).toEqual({
      label: "Waiting",
      metrics: [
        { label: "Boost", value: "0" },
        { label: "Balance", value: "0" },
        { label: "Hold", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Suppress", value: "0" },
      ],
      queues: [
        {
          count: 0,
          key: "boost",
          label: "Boost",
          shareLabel: "0%",
          stories: [],
          summary:
            "Direct reader matches are ready to lead the next impression.",
        },
        {
          count: 0,
          key: "balance",
          label: "Balance",
          shareLabel: "0%",
          stories: [],
          summary:
            "Counterweight stories keep entity concentration from narrowing the next impression.",
        },
        {
          count: 0,
          key: "hold",
          label: "Hold",
          shareLabel: "0%",
          stories: [],
          summary:
            "Useful trend-led stories stay available without overtaking stronger signals.",
        },
        {
          count: 0,
          key: "explore",
          label: "Explore",
          shareLabel: "0%",
          stories: [],
          summary:
            "Outside-profile stories are isolated so the system can test new interests.",
        },
        {
          count: 0,
          key: "suppress",
          label: "Suppress",
          shareLabel: "0%",
          stories: [],
          summary:
            "Hidden or negatively matched stories are kept out of active recommendation lanes.",
        },
      ],
      summary: "Distribution queue will appear after stories are ranked.",
    });
  });
});

describe("getNewsAlertRouting", () => {
  it("cools down repeated immediate alerts for the same entity", () => {
    expect(
      getNewsAlertRouting({
        hiddenItemIds: [],
        items: [
          {
            ...localItem,
            id: "openai-first-alert",
            matchedSignals: ["category", "entity"],
            personalizedScore: 166,
            sourceName: "Model Desk",
            sourceScore: 94,
            sourceSlug: "model-desk",
            title: "OpenAI ships a high-urgency model update",
            trendScore: 96,
          },
          {
            ...localItem,
            id: "openai-second-alert",
            matchedSignals: ["source", "entity"],
            personalizedScore: 158,
            sourceName: "Platform Brief",
            sourceScore: 91,
            sourceSlug: "platform-brief",
            title: "OpenAI platform alert follows the model update",
            trendScore: 92,
          },
          {
            ...localItem,
            entities: ["Anthropic"],
            id: "anthropic-alert",
            matchedSignals: ["entity"],
            personalizedScore: 149,
            sourceName: "Research Notes",
            sourceScore: 90,
            sourceSlug: "research-notes",
            title: "Anthropic releases a high-trust safety update",
            trendScore: 88,
          },
        ],
        limit: 3,
        negativeFeedbackItems: [],
      }),
    ).toEqual({
      label: "Alert Router Ready",
      lanes: [
        {
          count: 2,
          key: "immediate",
          label: "Immediate",
          shareLabel: "67%",
          stories: [
            {
              deliveryLabel: "Now",
              id: "openai-first-alert",
              reason: "High-trust profile alert",
              scoreLabel: "166 score / 96 heat",
              sourceName: "Model Desk",
              title: "OpenAI ships a high-urgency model update",
            },
            {
              deliveryLabel: "Now",
              id: "anthropic-alert",
              reason: "High-trust profile alert",
              scoreLabel: "149 score / 88 heat",
              sourceName: "Research Notes",
              title: "Anthropic releases a high-trust safety update",
            },
          ],
          summary:
            "High-trust, high-heat stories that match the reader profile.",
        },
        {
          count: 1,
          key: "digest",
          label: "Digest",
          shareLabel: "33%",
          stories: [
            {
              deliveryLabel: "Next brief",
              id: "openai-second-alert",
              reason: "Entity cooldown after OpenAI alert",
              scoreLabel: "158 score / 92 heat",
              sourceName: "Platform Brief",
              title: "OpenAI platform alert follows the model update",
            },
          ],
          summary: "Useful personalized stories that can wait for the brief.",
        },
        {
          count: 0,
          key: "watch",
          label: "Watch",
          shareLabel: "0%",
          stories: [],
          summary: "Noisy or exploratory stories held for verification.",
        },
        {
          count: 0,
          key: "muted",
          label: "Muted",
          shareLabel: "0%",
          stories: [],
          summary: "Stories blocked from alerts by reader feedback or trust.",
        },
      ],
      metrics: [
        { label: "Immediate", value: "2" },
        { label: "Digest", value: "1" },
        { label: "Watch", value: "0" },
        { label: "Muted", value: "0" },
      ],
      summary:
        "3 stories routed for alerts: 2 immediate, 1 digest, 0 watch, and 0 muted.",
    });
  });

  it("routes high-trust personalized stories into immediate, digest, watch, and muted alert lanes", () => {
    expect(
      getNewsAlertRouting({
        hiddenItemIds: [],
        items: [
          {
            ...localItem,
            id: "openai-breaking",
            title: "OpenAI ships an urgent agent runtime",
            category: "model_release",
            entities: ["OpenAI", "Agents"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 168,
            sourceName: "OpenAI News",
            sourceScore: 94,
            sourceSlug: "openai-news",
            trendScore: 96,
          },
          {
            ...localItem,
            id: "agent-digest",
            title: "Agent teams add workflow memory",
            category: "agent_product",
            entities: ["Agents"],
            matchedSignals: ["category"],
            personalizedScore: 128,
            sourceName: "Agent Desk",
            sourceScore: 84,
            sourceSlug: "agent-desk",
            trendScore: 74,
          },
          {
            ...localItem,
            id: "community-watch",
            title: "Community thread claims a model leak",
            category: "hot_take",
            entities: ["Leak"],
            matchedSignals: [],
            personalizedScore: 118,
            sourceName: "Community Wire",
            sourceScore: 58,
            sourceSlug: "community-wire",
            trendScore: 91,
          },
          {
            ...localItem,
            id: "muted-funding-repeat",
            title: "Funding rumor repeats a hidden thread",
            category: "funding",
            entities: ["YC"],
            matchedSignals: ["category"],
            personalizedScore: 151,
            sourceName: "VentureWire",
            sourceScore: 88,
            sourceSlug: "venturewire",
            trendScore: 89,
          },
        ],
        limit: 2,
        negativeFeedbackItems: [
          {
            ...localItem,
            id: "hidden-funding",
            category: "funding",
            entities: ["YC"],
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
        ],
      }),
    ).toEqual({
      label: "Alert Router Ready",
      lanes: [
        {
          count: 1,
          key: "immediate",
          label: "Immediate",
          shareLabel: "25%",
          stories: [
            {
              deliveryLabel: "Now",
              id: "openai-breaking",
              reason: "High-trust profile alert",
              scoreLabel: "168 score / 96 heat",
              sourceName: "OpenAI News",
              title: "OpenAI ships an urgent agent runtime",
            },
          ],
          summary:
            "High-trust, high-heat stories that match the reader profile.",
        },
        {
          count: 1,
          key: "digest",
          label: "Digest",
          shareLabel: "25%",
          stories: [
            {
              deliveryLabel: "Next brief",
              id: "agent-digest",
              reason: "Personalized digest",
              scoreLabel: "128 score / 74 heat",
              sourceName: "Agent Desk",
              title: "Agent teams add workflow memory",
            },
          ],
          summary: "Useful personalized stories that can wait for the brief.",
        },
        {
          count: 1,
          key: "watch",
          label: "Watch",
          shareLabel: "25%",
          stories: [
            {
              deliveryLabel: "Verify",
              id: "community-watch",
              reason: "High heat needs verification",
              scoreLabel: "118 score / 91 heat",
              sourceName: "Community Wire",
              title: "Community thread claims a model leak",
            },
          ],
          summary: "Noisy or exploratory stories held for verification.",
        },
        {
          count: 1,
          key: "muted",
          label: "Muted",
          shareLabel: "25%",
          stories: [
            {
              deliveryLabel: "Muted",
              id: "muted-funding-repeat",
              reason: "Negative feedback match",
              scoreLabel: "151 score / 89 heat",
              sourceName: "VentureWire",
              title: "Funding rumor repeats a hidden thread",
            },
          ],
          summary: "Stories blocked from alerts by reader feedback or trust.",
        },
      ],
      metrics: [
        { label: "Immediate", value: "1" },
        { label: "Digest", value: "1" },
        { label: "Watch", value: "1" },
        { label: "Muted", value: "1" },
      ],
      summary:
        "4 stories routed for alerts: 1 immediate, 1 digest, 1 watch, and 1 muted.",
    });
  });

  it("keeps alert routing cold before stories are ranked", () => {
    expect(
      getNewsAlertRouting({
        hiddenItemIds: [],
        items: [],
        limit: 2,
        negativeFeedbackItems: [],
      }),
    ).toEqual({
      label: "Alerts Waiting",
      lanes: [
        {
          count: 0,
          key: "immediate",
          label: "Immediate",
          shareLabel: "0%",
          stories: [],
          summary:
            "High-trust, high-heat stories that match the reader profile.",
        },
        {
          count: 0,
          key: "digest",
          label: "Digest",
          shareLabel: "0%",
          stories: [],
          summary: "Useful personalized stories that can wait for the brief.",
        },
        {
          count: 0,
          key: "watch",
          label: "Watch",
          shareLabel: "0%",
          stories: [],
          summary: "Noisy or exploratory stories held for verification.",
        },
        {
          count: 0,
          key: "muted",
          label: "Muted",
          shareLabel: "0%",
          stories: [],
          summary: "Stories blocked from alerts by reader feedback or trust.",
        },
      ],
      metrics: [
        { label: "Immediate", value: "0" },
        { label: "Digest", value: "0" },
        { label: "Watch", value: "0" },
        { label: "Muted", value: "0" },
      ],
      summary: "Alert routing will appear after stories are ranked.",
    });
  });
});

describe("getNewsPersonalizedPushQueue", () => {
  it("cools down repeated push-now stories for the same entity", () => {
    expect(
      getNewsPersonalizedPushQueue({
        formatCategory: (category) =>
          category === "model_release" ? "Models" : category,
        hiddenItemIds: [],
        historyItems: [],
        items: [
          {
            ...localItem,
            id: "push-openai-first",
            matchedSignals: ["category", "entity"],
            personalizedScore: 166,
            sourceName: "Model Desk",
            sourceScore: 94,
            sourceSlug: "model-desk",
            title: "OpenAI model update deserves a live push",
            trendScore: 96,
          },
          {
            ...localItem,
            id: "push-openai-second",
            matchedSignals: ["source", "entity"],
            personalizedScore: 158,
            sourceName: "Platform Brief",
            sourceScore: 91,
            sourceSlug: "platform-brief",
            title: "OpenAI platform update waits for the digest",
            trendScore: 92,
          },
          {
            ...localItem,
            entities: ["Anthropic"],
            id: "push-anthropic",
            matchedSignals: ["entity"],
            personalizedScore: 149,
            sourceName: "Research Notes",
            sourceScore: 90,
            sourceSlug: "research-notes",
            title: "Anthropic safety update can still push",
            trendScore: 88,
          },
        ],
        limit: 3,
        negativeFeedbackItems: [],
        profile: localProfile,
        savedItems: [],
      }),
    ).toEqual({
      label: "Push Queue Ready",
      lanes: [
        {
          count: 2,
          key: "push_now",
          label: "Push now",
          shareLabel: "67%",
          stories: [
            {
              categoryLabel: "Models",
              deliveryLabel: "Push now",
              id: "push-openai-first",
              reason: "High-trust profile match",
              scoreLabel: "166 score / 96 heat",
              sourceName: "Model Desk",
              title: "OpenAI model update deserves a live push",
              triggerLabel: "2 reader signals",
            },
            {
              categoryLabel: "Models",
              deliveryLabel: "Push now",
              id: "push-anthropic",
              reason: "High-trust profile match",
              scoreLabel: "149 score / 88 heat",
              sourceName: "Research Notes",
              title: "Anthropic safety update can still push",
              triggerLabel: "1 reader signal",
            },
          ],
          summary: "High-trust profile matches can trigger a live push.",
        },
        {
          count: 1,
          key: "digest",
          label: "Next digest",
          shareLabel: "33%",
          stories: [
            {
              categoryLabel: "Models",
              deliveryLabel: "Next digest",
              id: "push-openai-second",
              reason: "Entity cooldown after OpenAI push",
              scoreLabel: "158 score / 92 heat",
              sourceName: "Platform Brief",
              title: "OpenAI platform update waits for the digest",
              triggerLabel: "push cooldown",
            },
          ],
          summary:
            "Useful reader matches wait for the next personalized brief.",
        },
        {
          count: 0,
          key: "watch",
          label: "Quiet watch",
          shareLabel: "0%",
          stories: [],
          summary:
            "Exploration and lower-intent stories stay visible without a push.",
        },
        {
          count: 0,
          key: "muted",
          label: "Muted",
          shareLabel: "0%",
          stories: [],
          summary: "Hidden or negatively matched stories never become pushes.",
        },
      ],
      metrics: [
        { label: "Now", value: "2" },
        { label: "Digest", value: "1" },
        { label: "Watch", value: "0" },
        { label: "Muted", value: "0" },
      ],
      summary:
        "3 stories queued for reader push: 2 now, 1 digest, 0 watch, and 0 muted.",
    });
  });

  it("queues reader-facing pushes from profile, memory, exploration, and muted signals", () => {
    expect(
      getNewsPersonalizedPushQueue({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category === "robotics"
                ? "Robotics"
                : category === "funding"
                  ? "Funding"
                  : category,
        hiddenItemIds: [],
        historyItems: [
          {
            ...localItem,
            id: "read-agent-history",
            category: "agent_product",
            entities: ["Agents"],
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
          },
        ],
        items: [
          {
            ...localItem,
            id: "push-openai-now",
            category: "model_release",
            entities: ["OpenAI", "Agents"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 168,
            sourceName: "OpenAI News",
            sourceScore: 94,
            sourceSlug: "openai-news",
            title: "OpenAI ships an urgent agent runtime",
            trendScore: 96,
          },
          {
            ...localItem,
            id: "push-agent-digest",
            category: "agent_product",
            entities: ["Agents"],
            matchedSignals: ["category"],
            personalizedScore: 128,
            sourceName: "Agent Desk",
            sourceScore: 84,
            sourceSlug: "agent-desk",
            title: "Agent teams add workflow memory",
            trendScore: 74,
          },
          {
            ...olderItem,
            id: "push-robotics-watch",
            category: "robotics",
            entities: ["Figure"],
            matchedSignals: ["exploration"],
            personalizedScore: 118,
            sourceName: "Robotics Desk",
            sourceScore: 88,
            sourceSlug: "robotics-desk",
            title: "Robotics agent startup enters the explore lane",
            trendScore: 89,
          },
          {
            ...serverItem,
            id: "push-muted-funding",
            category: "funding",
            entities: ["YC"],
            matchedSignals: ["category"],
            personalizedScore: 151,
            sourceName: "VentureWire",
            sourceScore: 88,
            sourceSlug: "venturewire",
            title: "Funding rumor repeats a hidden thread",
            trendScore: 89,
          },
        ],
        limit: 2,
        negativeFeedbackItems: [
          {
            ...localItem,
            id: "negative-funding",
            category: "funding",
            entities: ["YC"],
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
        ],
        profile: localProfile,
        savedItems: [
          {
            ...localItem,
            id: "saved-agent-source",
            category: "agent_product",
            entities: ["Agents"],
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
          },
        ],
      }),
    ).toEqual({
      label: "Push Queue Ready",
      lanes: [
        {
          count: 1,
          key: "push_now",
          label: "Push now",
          shareLabel: "25%",
          stories: [
            {
              categoryLabel: "Models",
              deliveryLabel: "Push now",
              id: "push-openai-now",
              reason: "High-trust profile match",
              scoreLabel: "168 score / 96 heat",
              sourceName: "OpenAI News",
              title: "OpenAI ships an urgent agent runtime",
              triggerLabel: "2 reader signals",
            },
          ],
          summary: "High-trust profile matches can trigger a live push.",
        },
        {
          count: 1,
          key: "digest",
          label: "Next digest",
          shareLabel: "25%",
          stories: [
            {
              categoryLabel: "Agents",
              deliveryLabel: "Next digest",
              id: "push-agent-digest",
              reason: "Matches saved or reading memory",
              scoreLabel: "128 score / 74 heat",
              sourceName: "Agent Desk",
              title: "Agent teams add workflow memory",
              triggerLabel: "memory match",
            },
          ],
          summary:
            "Useful reader matches wait for the next personalized brief.",
        },
        {
          count: 1,
          key: "watch",
          label: "Quiet watch",
          shareLabel: "25%",
          stories: [
            {
              categoryLabel: "Robotics",
              deliveryLabel: "Quiet watch",
              id: "push-robotics-watch",
              reason: "Exploration sample",
              scoreLabel: "118 score / 89 heat",
              sourceName: "Robotics Desk",
              title: "Robotics agent startup enters the explore lane",
              triggerLabel: "exploration test",
            },
          ],
          summary:
            "Exploration and lower-intent stories stay visible without a push.",
        },
        {
          count: 1,
          key: "muted",
          label: "Muted",
          shareLabel: "25%",
          stories: [
            {
              categoryLabel: "Funding",
              deliveryLabel: "Muted",
              id: "push-muted-funding",
              reason: "Negative feedback match",
              scoreLabel: "151 score / 89 heat",
              sourceName: "VentureWire",
              title: "Funding rumor repeats a hidden thread",
              triggerLabel: "do not send",
            },
          ],
          summary: "Hidden or negatively matched stories never become pushes.",
        },
      ],
      metrics: [
        { label: "Now", value: "1" },
        { label: "Digest", value: "1" },
        { label: "Watch", value: "1" },
        { label: "Muted", value: "1" },
      ],
      summary:
        "4 stories queued for reader push: 1 now, 1 digest, 1 watch, and 1 muted.",
    });
  });

  it("keeps the personalized push queue cold before stories are ranked", () => {
    expect(
      getNewsPersonalizedPushQueue({
        formatCategory: (category) => category,
        hiddenItemIds: [],
        historyItems: [],
        items: [],
        limit: 2,
        negativeFeedbackItems: [],
        profile: localProfile,
        savedItems: [],
      }),
    ).toEqual({
      label: "Push Queue Waiting",
      lanes: [
        {
          count: 0,
          key: "push_now",
          label: "Push now",
          shareLabel: "0%",
          stories: [],
          summary: "High-trust profile matches can trigger a live push.",
        },
        {
          count: 0,
          key: "digest",
          label: "Next digest",
          shareLabel: "0%",
          stories: [],
          summary:
            "Useful reader matches wait for the next personalized brief.",
        },
        {
          count: 0,
          key: "watch",
          label: "Quiet watch",
          shareLabel: "0%",
          stories: [],
          summary:
            "Exploration and lower-intent stories stay visible without a push.",
        },
        {
          count: 0,
          key: "muted",
          label: "Muted",
          shareLabel: "0%",
          stories: [],
          summary: "Hidden or negatively matched stories never become pushes.",
        },
      ],
      metrics: [
        { label: "Now", value: "0" },
        { label: "Digest", value: "0" },
        { label: "Watch", value: "0" },
        { label: "Muted", value: "0" },
      ],
      summary: "Personalized push queue will appear after stories are ranked.",
    });
  });
});

describe("getNewsChannelStrategy", () => {
  it("turns the ranked feed into a balanced personalized channel strategy", () => {
    expect(
      getNewsChannelStrategy({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category === "funding"
                ? "Funding"
                : category,
        items: [
          {
            ...localItem,
            matchedSignals: ["category", "source"],
            personalizedScore: 142,
          },
          {
            ...serverItem,
            category: "agent_product",
            matchedSignals: ["entity"],
            personalizedScore: 131,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
          },
          {
            ...olderItem,
            category: "funding",
            id: "explore-story",
            matchedSignals: ["exploration"],
            personalizedScore: 104,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
          {
            ...localItem,
            category: "research",
            id: "trend-story",
            matchedSignals: [],
            personalizedScore: 95,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
          },
        ],
        profile: {
          preferredCategories: ["model_release", "agent_product"],
          preferredSources: ["local-source"],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1.4,
          recencyBias: 1.1,
        },
      }),
    ).toEqual({
      label: "Balanced Channels",
      lanes: [
        {
          action: "Keep saving high-signal stories to sharpen this channel.",
          count: 2,
          detail: "Models leads profile coverage with 1 story.",
          label: "For You",
          share: 50,
        },
        {
          action: "Save useful surprises or hide weak ones.",
          count: 1,
          detail: "1 story is testing coverage outside the current profile.",
          label: "Explore",
          share: 25,
        },
        {
          action: "Use Trending mode when you want broader market heat.",
          count: 1,
          detail: "Trend-led coverage is filling gaps without reader matches.",
          label: "Trending",
          share: 25,
        },
      ],
      metrics: [
        { label: "Profile-led", value: "50%" },
        { label: "Exploration", value: "25%" },
        { label: "Trend-led", value: "25%" },
        { label: "Active topics", value: "2" },
      ],
      priorities: [
        {
          detail:
            "For You can lead because reader signals, exploration, and trend-led coverage are all present.",
          label: "Lead channel",
        },
        {
          detail:
            "Novelty bias is higher than freshness, so exploration stories should stay visible.",
          label: "Bias posture",
        },
      ],
      summary:
        "4 stories distributed across 3 AI channels: 2 profile-led, 1 exploration, and 1 trend-led.",
    });
  });

  it("keeps the channel strategy useful before stories or reader signals exist", () => {
    expect(
      getNewsChannelStrategy({
        formatCategory: (category) => category,
        items: [],
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      label: "Waiting For Signals",
      lanes: [],
      metrics: [
        { label: "Profile-led", value: "0%" },
        { label: "Exploration", value: "0%" },
        { label: "Trend-led", value: "0%" },
        { label: "Active topics", value: "0" },
      ],
      priorities: [
        {
          detail:
            "Ingest stories and collect reader actions before locking a channel mix.",
          label: "Learning needed",
        },
      ],
      summary: "Channel strategy will appear as stories load.",
    });
  });
});

describe("getNewsFeedbackCoach", () => {
  it("builds concrete feedback actions for tuning the next edition", () => {
    expect(
      getNewsFeedbackCoach({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "funding"
              ? "Funding"
              : category,
        items: [
          {
            ...localItem,
            matchedSignals: ["category", "source", "entity"],
            personalizedScore: 142,
          },
          {
            ...olderItem,
            category: "funding",
            id: "explore-story",
            matchedSignals: ["exploration"],
            personalizedScore: 104,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
          {
            ...serverItem,
            id: "low-trust-high-heat",
            matchedSignals: [],
            personalizedScore: 88,
            sourceName: "Rumor Lab",
            sourceScore: 42,
            sourceSlug: "rumor-lab",
            trendScore: 96,
          },
        ],
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: ["local-source"],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1.3,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      actions: [
        {
          action: "save",
          buttonLabel: "Save",
          label: "Strengthen",
          reason:
            "Save this Models story to reinforce Local Source and OpenAI.",
          storyId: "local-story",
          storyTitle: "Local trend fallback",
        },
        {
          action: "save",
          buttonLabel: "Save",
          label: "Test surprise",
          reason: "Save this Funding exploration if it belongs in your mix.",
          storyId: "explore-story",
          storyTitle: "Local trend fallback",
        },
        {
          action: "hide",
          buttonLabel: "Less",
          label: "Reduce noise",
          reason:
            "Less will dampen a lower-trust high-heat story before it trains the profile.",
          storyId: "low-trust-high-heat",
          storyTitle: "Server-ranked recommendation",
        },
      ],
      label: "Actionable",
      metrics: [
        { label: "Suggestions", value: "3" },
        { label: "Reader signals", value: "3" },
        { label: "Exploration", value: "1" },
      ],
      summary: "3 feedback actions can tune the next For You edition.",
    });
  });

  it("keeps feedback coaching stable before ranked stories load", () => {
    expect(
      getNewsFeedbackCoach({
        formatCategory: (category) => category,
        items: [],
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
      }),
    ).toEqual({
      actions: [],
      label: "Waiting",
      metrics: [
        { label: "Suggestions", value: "0" },
        { label: "Reader signals", value: "0" },
        { label: "Exploration", value: "0" },
      ],
      summary: "Feedback coach will appear as ranked stories load.",
    });
  });
});

describe("getNewsFeedbackCoachActionState", () => {
  it("keeps coached feedback actions available in the preview edition", () => {
    expect(
      getNewsFeedbackCoachActionState({
        hasSuggestedStory: true,
        isPreview: true,
      }),
    ).toEqual({
      disabled: false,
      helperText:
        "Preview coach actions train this device only. Live stories will sync once production news IDs are available.",
    });
  });

  it("disables coached feedback actions when no matching story is available", () => {
    expect(
      getNewsFeedbackCoachActionState({
        hasSuggestedStory: false,
        isPreview: false,
      }),
    ).toEqual({
      disabled: true,
      helperText: "No matching story is available for this coaching action.",
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

describe("getNewsChannelRail", () => {
  it("orders personalized AI channels for the edition rail", () => {
    expect(
      getNewsChannelRail({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category === "funding"
                ? "Funding"
                : category,
        items: [
          {
            ...localItem,
            id: "channel-lead",
            category: "model_release",
            entities: ["OpenAI", "Agents"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 168,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
            title: "OpenAI ships an urgent agent runtime",
            trendScore: 96,
          },
          {
            ...serverItem,
            id: "channel-model-follow",
            category: "model_release",
            entities: ["OpenAI", "Evaluation"],
            matchedSignals: ["entity"],
            personalizedScore: 132,
            sourceName: "Research Wire",
            sourceSlug: "research-wire",
            title: "Researchers benchmark the agent runtime",
            trendScore: 84,
          },
          {
            ...olderItem,
            id: "channel-agent-explore",
            category: "agent_product",
            entities: ["Agents"],
            matchedSignals: ["exploration"],
            personalizedScore: 119,
            sourceName: "Agent Scout",
            sourceSlug: "agent-scout",
            title: "Agent workflow startup tests a new channel",
            trendScore: 88,
          },
          {
            ...olderItem,
            id: "channel-funding-trend",
            category: "funding",
            entities: ["YC"],
            matchedSignals: [],
            personalizedScore: 111,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Funding heat rises around AI agent infra",
            trendScore: 93,
          },
        ],
        limit: 4,
        profile: localProfile,
      }),
    ).toEqual({
      channels: [
        {
          key: "for_you",
          label: "For You",
          reason:
            "Reader-ranked front page blends profile matches, exploration, and trend heat.",
          scoreLabel: "168 lead score",
          sourceCount: 4,
          statusLabel: "Live",
          storyCount: 4,
          topStory: {
            id: "channel-lead",
            sourceName: "OpenAI News",
            title: "OpenAI ships an urgent agent runtime",
          },
        },
        {
          key: "model_release",
          label: "Models",
          reason: "2 stories match an active reader topic.",
          scoreLabel: "2 stories / 90 heat",
          sourceCount: 2,
          statusLabel: "Following",
          storyCount: 2,
          topStory: {
            id: "channel-lead",
            sourceName: "OpenAI News",
            title: "OpenAI ships an urgent agent runtime",
          },
        },
        {
          key: "agent_product",
          label: "Agents",
          reason: "Exploration channel tests adjacent interest.",
          scoreLabel: "1 story / 88 heat",
          sourceCount: 1,
          statusLabel: "Discover",
          storyCount: 1,
          topStory: {
            id: "channel-agent-explore",
            sourceName: "Agent Scout",
            title: "Agent workflow startup tests a new channel",
          },
        },
        {
          key: "funding",
          label: "Funding",
          reason: "Trend heat keeps this channel in the rail.",
          scoreLabel: "1 story / 93 heat",
          sourceCount: 1,
          statusLabel: "Trending",
          storyCount: 1,
          topStory: {
            id: "channel-funding-trend",
            sourceName: "VentureWire",
            title: "Funding heat rises around AI agent infra",
          },
        },
      ],
      label: "Channel Rail Ready",
      metrics: [
        { label: "Channels", value: "4" },
        { label: "Following", value: "1" },
        { label: "Discover", value: "1" },
        { label: "Sources", value: "4" },
      ],
      summary: "4 channels route 4 stories across 4 sources.",
    });
  });

  it("keeps the channel rail waiting before stories are ranked", () => {
    expect(
      getNewsChannelRail({
        formatCategory: (category) => category,
        items: [],
        limit: 4,
        profile: localProfile,
      }),
    ).toEqual({
      channels: [],
      label: "Channel Rail Waiting",
      metrics: [
        { label: "Channels", value: "0" },
        { label: "Following", value: "0" },
        { label: "Discover", value: "0" },
        { label: "Sources", value: "0" },
      ],
      summary: "Channel rail will appear after stories are ranked.",
    });
  });
});

describe("getNewsChannelComparison", () => {
  it("compares For You, Latest, and Trending leads from the same ranked edition", () => {
    expect(
      getNewsChannelComparison({
        items: [
          {
            ...olderItem,
            id: "personalized-lead",
            matchedSignals: ["category"],
            personalizedScore: 150,
            publishedAt: "2026-06-30T08:00:00.000Z",
            sourceName: "Model Desk",
            title: "Model story leads For You",
            trendScore: 70,
          },
          {
            ...localItem,
            id: "latest-lead",
            matchedSignals: [],
            personalizedScore: 90,
            publishedAt: "2026-07-01T12:00:00.000Z",
            sourceName: "Launch Feed",
            title: "Fresh launch leads Latest",
            trendScore: 65,
          },
          {
            ...serverItem,
            id: "trending-lead",
            matchedSignals: [],
            personalizedScore: 100,
            publishedAt: "2026-07-01T09:00:00.000Z",
            sourceName: "Heat Wire",
            title: "Hot model leads Trending",
            trendScore: 98,
          },
        ],
        limit: 2,
      }),
    ).toEqual({
      channels: [
        {
          key: "for_you",
          label: "For You",
          lead: {
            id: "personalized-lead",
            sourceName: "Model Desk",
            title: "Model story leads For You",
          },
          reason: "Reader signals",
          scoreLabel: "150 score",
          topStories: [
            {
              id: "personalized-lead",
              sourceName: "Model Desk",
              title: "Model story leads For You",
            },
            {
              id: "latest-lead",
              sourceName: "Launch Feed",
              title: "Fresh launch leads Latest",
            },
          ],
        },
        {
          key: "latest",
          label: "Latest",
          lead: {
            id: "latest-lead",
            sourceName: "Launch Feed",
            title: "Fresh launch leads Latest",
          },
          reason: "Newest publish time",
          scoreLabel: "2026-07-01 12:00",
          topStories: [
            {
              id: "latest-lead",
              sourceName: "Launch Feed",
              title: "Fresh launch leads Latest",
            },
            {
              id: "trending-lead",
              sourceName: "Heat Wire",
              title: "Hot model leads Trending",
            },
          ],
        },
        {
          key: "trending",
          label: "Trending",
          lead: {
            id: "trending-lead",
            sourceName: "Heat Wire",
            title: "Hot model leads Trending",
          },
          reason: "Highest heat",
          scoreLabel: "98 heat",
          topStories: [
            {
              id: "trending-lead",
              sourceName: "Heat Wire",
              title: "Hot model leads Trending",
            },
            {
              id: "personalized-lead",
              sourceName: "Model Desk",
              title: "Model story leads For You",
            },
          ],
        },
      ],
      label: "3 Channels",
      metrics: [
        { label: "Channel leads", value: "3" },
        { label: "Lead spread", value: "3 stories" },
        { label: "Shared top 2", value: "0 stories" },
      ],
      summary:
        "3 ranking channels compare 3 stories; 3 different lead stories surface across For You, Latest, and Trending.",
    });
  });

  it("returns a stable empty comparison before stories load", () => {
    expect(getNewsChannelComparison({ items: [], limit: 3 })).toEqual({
      channels: [],
      label: "No Channels",
      metrics: [
        { label: "Channel leads", value: "0" },
        { label: "Lead spread", value: "0 stories" },
        { label: "Shared top 3", value: "0 stories" },
      ],
      summary: "Channel comparison will appear as stories load.",
    });
  });
});

describe("getNewsEditionQualityGate", () => {
  it("checks front-page lead, source spread, personalization, exploration, and guardrails", () => {
    expect(
      getNewsEditionQualityGate({
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category === "research"
                ? "Research"
                : category === "funding"
                  ? "Funding"
                  : category,
        items: [
          {
            ...localItem,
            id: "quality-lead",
            category: "model_release",
            entities: ["OpenAI", "Agents"],
            matchedSignals: ["category", "entity"],
            personalizedScore: 168,
            sourceName: "OpenAI News",
            sourceScore: 94,
            sourceSlug: "openai-news",
            title: "OpenAI ships an urgent agent runtime",
            trendScore: 96,
          },
          {
            ...serverItem,
            id: "quality-explore",
            category: "agent_product",
            entities: ["Agents"],
            matchedSignals: ["exploration"],
            personalizedScore: 119,
            sourceName: "Agent Scout",
            sourceScore: 86,
            sourceSlug: "agent-scout",
            title: "Agent workflow startup tests a new channel",
            trendScore: 88,
          },
          {
            ...olderItem,
            id: "quality-research",
            category: "research",
            entities: ["OpenAI", "Evaluation"],
            matchedSignals: ["entity"],
            personalizedScore: 132,
            sourceName: "Research Wire",
            sourceScore: 90,
            sourceSlug: "research-wire",
            title: "Researchers benchmark the agent runtime",
            trendScore: 81,
          },
        ],
        negativeFeedbackItems: [
          {
            ...olderItem,
            id: "quality-guardrail",
            category: "funding",
            entities: ["YC"],
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            title: "Funding rumor receives less feedback",
          },
        ],
        profile: localProfile,
      }),
    ).toEqual({
      checks: [
        {
          action: "Keep as lead",
          detail: "Front-page lead is strong enough to anchor the edition.",
          evidenceLabel: "168 score / 96 heat",
          key: "lead",
          label: "Lead story",
          status: "pass",
        },
        {
          action: "Edition has source spread",
          detail: "3 sources keep the edition from reading like one outlet.",
          evidenceLabel: "3 sources",
          key: "source_mix",
          label: "Source mix",
          status: "pass",
        },
        {
          action: "Personalization is active",
          detail: "2 stories carry reader profile signals.",
          evidenceLabel: "2 profile matches",
          key: "reader_fit",
          label: "Reader fit",
          status: "pass",
        },
        {
          action: "Keep discovery lane",
          detail: "1 exploration story keeps the feed open.",
          evidenceLabel: "1 exploration",
          key: "exploration",
          label: "Exploration lane",
          status: "pass",
        },
        {
          action: "Apply demotion guard",
          detail: "1 negative feedback signal is protecting the edition.",
          evidenceLabel: "1 guardrail",
          key: "guardrail",
          label: "Guardrail",
          status: "pass",
        },
      ],
      label: "Quality Gate Ready",
      metrics: [
        { label: "Pass", value: "5" },
        { label: "Watch", value: "0" },
        { label: "Block", value: "0" },
        { label: "Sources", value: "3" },
      ],
      summary:
        "5 checks passed with 0 watch items and 0 blockers across 3 sources.",
    });
  });

  it("blocks the edition quality gate before ranked stories arrive", () => {
    expect(
      getNewsEditionQualityGate({
        formatCategory: (category) => category,
        items: [],
        negativeFeedbackItems: [],
        profile: localProfile,
      }),
    ).toEqual({
      checks: [
        {
          action: "Wait for ranked stories",
          detail: "No ranked lead is available yet.",
          evidenceLabel: "0 stories",
          key: "lead",
          label: "Lead story",
          status: "block",
        },
      ],
      label: "Quality Gate Waiting",
      metrics: [
        { label: "Pass", value: "0" },
        { label: "Watch", value: "0" },
        { label: "Block", value: "1" },
        { label: "Sources", value: "0" },
      ],
      summary: "Edition quality gate is waiting for ranked stories.",
    });
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

describe("getNewsSourceTrustLedger", () => {
  it("summarizes source trust and low-trust heat risk for the ranked edition", () => {
    expect(
      getNewsSourceTrustLedger({
        items: [
          {
            ...localItem,
            sourceScore: 92,
            trendScore: 82,
          },
          {
            ...localItem,
            id: "trusted-lab",
            sourceName: "Research Wire",
            sourceScore: 86,
            trendScore: 74,
          },
          {
            ...localItem,
            id: "standard-wire",
            sourceName: "Launch Feed",
            sourceScore: 68,
            trendScore: 78,
          },
          {
            ...localItem,
            id: "low-trust-heat",
            sourceName: "Rumor Desk",
            sourceScore: 42,
            trendScore: 91,
          },
        ],
      }),
    ).toEqual({
      label: "Guarded",
      metrics: [
        { label: "High trust", value: "2/4" },
        { label: "Watchlist", value: "1" },
        { label: "Average score", value: "72" },
        { label: "Low-trust heat", value: "1" },
      ],
      notices: [
        {
          detail:
            "1 high-heat story from lower-trust sources is dampened before ranking.",
          label: "Trust guard",
        },
        {
          detail: "2 high-trust stories are anchoring this edition.",
          label: "Source confidence",
        },
      ],
      summary:
        "2 of 4 stories come from high-trust sources; 1 low-trust high-heat story is being guarded.",
    });
  });

  it("returns a stable empty trust ledger before stories load", () => {
    expect(getNewsSourceTrustLedger({ items: [] })).toEqual({
      label: "Empty",
      metrics: [
        { label: "High trust", value: "0/0" },
        { label: "Watchlist", value: "0" },
        { label: "Average score", value: "0" },
        { label: "Low-trust heat", value: "0" },
      ],
      notices: [],
      summary: "Source trust ledger will appear as stories load.",
    });
  });
});

describe("getNewsAggregationIntake", () => {
  it("groups incoming stories into source-type intake lanes for the editor desk", () => {
    expect(
      getNewsAggregationIntake({
        items: [
          {
            ...localItem,
            id: "openai-model",
            sourceName: "OpenAI News",
            sourceScore: 94,
            sourceSlug: "openai-news",
            sourceType: "vendor_blog",
            title: "OpenAI ships a new reasoning model",
            trendScore: 88,
          },
          {
            ...localItem,
            id: "deepmind-model",
            sourceName: "DeepMind Blog",
            sourceScore: 90,
            sourceSlug: "deepmind-blog",
            sourceType: "vendor_blog",
            title: "DeepMind updates agent evals",
            trendScore: 76,
          },
          {
            ...localItem,
            id: "hn-agents",
            sourceName: "Hacker News AI",
            sourceScore: 72,
            sourceSlug: "hacker-news-ai",
            sourceType: "hacker_news",
            title: "Developers debate agent memory",
            trendScore: 91,
          },
          {
            ...localItem,
            category: "product_hunt",
            id: "ph-launch",
            sourceName: "Product Hunt AI",
            sourceScore: 70,
            sourceSlug: "product-hunt-ai",
            sourceType: "product_hunt",
            title: "New AI workspace launches",
            trendScore: 84,
          },
          {
            ...localItem,
            category: "research",
            id: "research-paper",
            sourceName: "Research Wire",
            sourceScore: 87,
            sourceSlug: "research-wire",
            sourceType: "research",
            title: "Researchers benchmark inference agents",
            trendScore: 69,
          },
          {
            ...localItem,
            id: "desk-note",
            sourceName: "Editor's Desk",
            sourceScore: 70,
            sourceSlug: "editor-desk",
            sourceType: "manual",
            title: "Desk note keeps the edition alive",
            trendScore: 58,
          },
        ],
        limit: 2,
      }),
    ).toEqual({
      label: "Active Intake",
      lanes: [
        {
          action: "Anchor the front page with direct-source reporting.",
          count: 2,
          key: "primary",
          label: "Primary Sources",
          shareLabel: "33%",
          stories: [
            {
              id: "openai-model",
              reason: "Vendor Blog source with 94 trust.",
              scoreLabel: "94 trust / 88 trend",
              sourceName: "OpenAI News",
              title: "OpenAI ships a new reasoning model",
            },
            {
              id: "deepmind-model",
              reason: "Vendor Blog source with 90 trust.",
              scoreLabel: "90 trust / 76 trend",
              sourceName: "DeepMind Blog",
              title: "DeepMind updates agent evals",
            },
          ],
          summary:
            "2 direct-source stories from labs, vendors, or publications are ready for ranking.",
        },
        {
          action:
            "Verify community heat with a primary source before promotion.",
          count: 1,
          key: "community",
          label: "Community Signals",
          shareLabel: "17%",
          stories: [
            {
              id: "hn-agents",
              reason: "Hacker News source with 72 trust.",
              scoreLabel: "72 trust / 91 trend",
              sourceName: "Hacker News AI",
              title: "Developers debate agent memory",
            },
          ],
          summary: "1 community signal needs confirmation before it leads.",
        },
        {
          action: "Check traction and funding context before promotion.",
          count: 1,
          key: "launch",
          label: "Launch Watch",
          shareLabel: "17%",
          stories: [
            {
              id: "ph-launch",
              reason: "Product Hunt source with 70 trust.",
              scoreLabel: "70 trust / 84 trend",
              sourceName: "Product Hunt AI",
              title: "New AI workspace launches",
            },
          ],
          summary: "1 launch or startup signal is ready for market context.",
        },
        {
          action: "Assign explainer treatment before the next edition.",
          count: 1,
          key: "research",
          label: "Research Desk",
          shareLabel: "17%",
          stories: [
            {
              id: "research-paper",
              reason: "Research source with 87 trust.",
              scoreLabel: "87 trust / 69 trend",
              sourceName: "Research Wire",
              title: "Researchers benchmark inference agents",
            },
          ],
          summary: "1 research, policy, or security story needs translation.",
        },
        {
          action: "Keep desk notes as fallback until live sources refresh.",
          count: 1,
          key: "desk",
          label: "Desk Notes",
          shareLabel: "17%",
          stories: [
            {
              id: "desk-note",
              reason: "Manual source with 70 trust.",
              scoreLabel: "70 trust / 58 trend",
              sourceName: "Editor's Desk",
              title: "Desk note keeps the edition alive",
            },
          ],
          summary: "1 desk or fallback story keeps the edition coherent.",
        },
      ],
      metrics: [
        { label: "Stories", value: "6" },
        { label: "Lanes", value: "5" },
        { label: "High trust", value: "3" },
        { label: "Needs verify", value: "2" },
      ],
      summary:
        "6 stories are entering the desk across 5 intake lanes; Primary Sources leads with 33%.",
    });
  });

  it("keeps the aggregation intake empty before stories arrive", () => {
    expect(getNewsAggregationIntake({ items: [], limit: 2 })).toEqual({
      label: "Cold Intake",
      lanes: [],
      metrics: [
        { label: "Stories", value: "0" },
        { label: "Lanes", value: "0" },
        { label: "High trust", value: "0" },
        { label: "Needs verify", value: "0" },
      ],
      summary: "Aggregation intake will appear after sources deliver stories.",
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

describe("selectReaderFreshNewsHomeItems", () => {
  it("moves read stories behind unread stories while preserving each group order", () => {
    expect(
      selectReaderFreshNewsHomeItems({
        historyItems: [{ id: "server-story" }, { id: "older-story" }],
        items: [
          {
            ...serverItem,
            matchedSignals: ["category"],
            personalizedScore: 140,
          },
          {
            ...localItem,
            matchedSignals: ["entity"],
            personalizedScore: 130,
          },
          {
            ...olderItem,
            matchedSignals: [],
            personalizedScore: 120,
          },
        ],
      }).map((item) => item.id),
    ).toEqual(["local-story", "server-story", "older-story"]);
  });

  it("moves read URL variants behind unread stories", () => {
    expect(
      selectReaderFreshNewsHomeItems({
        historyItems: [
          {
            id: "read-original",
            canonicalUrl: "https://example.com/read-story",
            originalUrl: "https://example.com/read-story",
          },
        ],
        items: [
          {
            ...serverItem,
            canonicalUrl: "https://mirror.example/read-story",
            id: "read-syndicated",
            matchedSignals: ["category"],
            originalUrl: "https://example.com/read-story?utm=feed",
            personalizedScore: 140,
          },
          {
            ...localItem,
            canonicalUrl: "https://example.com/unread-story",
            id: "unread-story",
            matchedSignals: ["entity"],
            originalUrl: "https://example.com/unread-story",
            personalizedScore: 130,
          },
        ],
      }).map((item) => item.id),
    ).toEqual(["unread-story", "read-syndicated"]);
  });

  it("keeps ranked order when there is no matching read history", () => {
    expect(
      selectReaderFreshNewsHomeItems({
        historyItems: [{ id: "different-story" }],
        items: [
          {
            ...serverItem,
            matchedSignals: ["category"],
            personalizedScore: 140,
          },
          {
            ...localItem,
            matchedSignals: ["entity"],
            personalizedScore: 130,
          },
        ],
      }).map((item) => item.id),
    ).toEqual(["server-story", "local-story"]);
  });
});

describe("selectSessionIntentNewsHomeItems", () => {
  it("lifts stories matching the current search and topic session intent", () => {
    const feed = selectSessionIntentNewsHomeItems({
      intent: {
        category: "agent_product",
        query: "LangChain agents",
        sourceSlug: null,
      },
      items: [
        {
          ...localItem,
          id: "high-profile-model",
          category: "model_release",
          entities: ["OpenAI"],
          matchedSignals: ["category"],
          personalizedScore: 132,
          tags: ["model"],
          title: "OpenAI ships a model refresh",
        },
        {
          ...olderItem,
          id: "session-agent-match",
          category: "agent_product",
          entities: ["LangChain"],
          matchedSignals: [],
          personalizedScore: 120,
          tags: ["agents"],
          title: "LangChain agent runtime adds workflow memory",
        },
      ],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "session-agent-match",
      "high-profile-model",
    ]);
    expect(feed[0]?.matchedSignals).toContain("session_intent");
    expect(feed[0]?.personalizedScore).toBeGreaterThan(132);
  });

  it("does not retag or reorder the feed when there is no active session intent", () => {
    const feed = selectSessionIntentNewsHomeItems({
      intent: {
        category: null,
        query: " ",
        sourceSlug: null,
      },
      items: [
        {
          ...localItem,
          matchedSignals: ["category"],
          personalizedScore: 132,
        },
        {
          ...olderItem,
          matchedSignals: [],
          personalizedScore: 120,
        },
      ],
    });

    expect(feed.map((item) => item.id)).toEqual(["local-story", "older-story"]);
    expect(feed[0]?.matchedSignals).toEqual(["category"]);
    expect(feed[1]?.matchedSignals).toEqual([]);
  });

  it("does not apply the session intent boost twice to server-ranked stories", () => {
    const feed = selectSessionIntentNewsHomeItems({
      intent: {
        category: "agent_product",
        query: "LangChain agents",
        sourceSlug: null,
      },
      items: [
        {
          ...olderItem,
          id: "server-ranked-agent-story",
          category: "agent_product",
          entities: ["LangChain"],
          matchedSignals: ["session_intent"],
          personalizedScore: 134,
          tags: ["agents"],
          title: "LangChain agent runtime adds workflow memory",
        },
        {
          ...localItem,
          id: "high-profile-model",
          matchedSignals: [],
          personalizedScore: 132,
          title: "OpenAI ships a model refresh",
        },
      ],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "server-ranked-agent-story",
      "high-profile-model",
    ]);
    expect(feed[0]?.personalizedScore).toBe(134);
  });

  it("does not boost Less feedback stories for the current session intent", () => {
    const feed = selectSessionIntentNewsHomeItems({
      intent: {
        category: "agent_product",
        query: "LangChain agents",
        sourceSlug: null,
      },
      items: [
        {
          ...localItem,
          id: "safe-model-story",
          matchedSignals: [],
          personalizedScore: 126,
          title: "OpenAI ships a model refresh",
        },
        {
          ...olderItem,
          id: "blocked-agent-story",
          category: "agent_product",
          entities: ["LangChain"],
          matchedSignals: ["negative_feedback"],
          personalizedScore: 120,
          tags: ["agents"],
          title: "LangChain agent runtime adds workflow memory",
        },
      ],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "safe-model-story",
      "blocked-agent-story",
    ]);
    expect(feed[1]?.matchedSignals).not.toContain("session_intent");
  });
});

describe("selectSourceCorroboratedNewsHomeItems", () => {
  it("lifts trusted local stories corroborated by independent sources", () => {
    const feed = selectSourceCorroboratedNewsHomeItems({
      items: [
        {
          ...localItem,
          id: "solo-hot-story",
          category: "model_release",
          entities: ["OpenAI"],
          matchedSignals: [],
          personalizedScore: 132,
          sourceSlug: "launchwire",
        },
        {
          ...olderItem,
          id: "corroborated-agent-angle",
          category: "agent_product",
          entities: ["LangChain"],
          matchedSignals: [],
          personalizedScore: 121,
          sourceScore: 82,
          sourceSlug: "agent-desk",
        },
        {
          ...serverItem,
          id: "independent-agent-confirmation",
          category: "agent_product",
          entities: ["LangChain"],
          matchedSignals: [],
          personalizedScore: 118,
          sourceScore: 85,
          sourceSlug: "developer-weekly",
        },
      ],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "corroborated-agent-angle",
      "solo-hot-story",
      "independent-agent-confirmation",
    ]);
    expect(feed[0]?.matchedSignals).toContain("source_corroboration");
    expect(feed[2]?.matchedSignals).toContain("source_corroboration");
  });

  it("does not treat repeated local coverage from one source as corroboration", () => {
    const feed = selectSourceCorroboratedNewsHomeItems({
      items: [
        {
          ...localItem,
          id: "single-source-primary",
          category: "agent_product",
          entities: ["LangChain"],
          matchedSignals: [],
          personalizedScore: 130,
          sourceSlug: "agent-desk",
        },
        {
          ...olderItem,
          id: "single-source-follow-up",
          category: "agent_product",
          entities: ["LangChain"],
          matchedSignals: [],
          personalizedScore: 120,
          sourceSlug: "agent-desk",
        },
      ],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "single-source-primary",
      "single-source-follow-up",
    ]);
    expect(feed[0]?.matchedSignals).not.toContain("source_corroboration");
    expect(feed[1]?.matchedSignals).not.toContain("source_corroboration");
  });
});

describe("selectNewsHomeExposureRecords", () => {
  it("records bounded home exposures for unseen live feed items", () => {
    expect(
      selectNewsHomeExposureRecords({
        feedMode: "for_you",
        isPreview: false,
        items: [
          {
            ...serverItem,
            matchedSignals: ["category"],
            personalizedScore: 140,
          },
          {
            ...localItem,
            matchedSignals: ["entity"],
            personalizedScore: 130,
          },
          {
            ...olderItem,
            matchedSignals: [],
            personalizedScore: 120,
          },
        ],
        limit: 2,
        recordedItems: [],
        visitorKey: "visitor-test-123",
      }),
    ).toEqual([
      {
        action: "view",
        metadata: {
          exposure: true,
          exposureSlot: 0,
          feedMode: "for_you",
          surface: "home",
        },
        newsItemId: "server-story",
        visitorKey: "visitor-test-123",
      },
      {
        action: "view",
        metadata: {
          exposure: true,
          exposureSlot: 1,
          feedMode: "for_you",
          surface: "home",
        },
        newsItemId: "local-story",
        visitorKey: "visitor-test-123",
      },
    ]);
  });

  it("skips preview sessions, missing visitors, and already exposed URL variants", () => {
    const readVariant = {
      id: "read-original",
      canonicalUrl: "https://example.com/read-story",
      originalUrl: "https://example.com/read-story",
    };

    expect(
      selectNewsHomeExposureRecords({
        feedMode: "latest",
        isPreview: true,
        items: [
          {
            ...serverItem,
            matchedSignals: ["category"],
            personalizedScore: 140,
          },
        ],
        limit: 3,
        recordedItems: [],
        visitorKey: "visitor-test-123",
      }),
    ).toEqual([]);
    expect(
      selectNewsHomeExposureRecords({
        feedMode: "latest",
        isPreview: false,
        items: [
          {
            ...serverItem,
            matchedSignals: ["category"],
            personalizedScore: 140,
          },
        ],
        limit: 3,
        recordedItems: [],
        visitorKey: null,
      }),
    ).toEqual([]);
    expect(
      selectNewsHomeExposureRecords({
        feedMode: "latest",
        isPreview: false,
        items: [
          {
            ...serverItem,
            canonicalUrl: "https://mirror.example/read-story",
            id: "read-syndicated",
            matchedSignals: ["category"],
            originalUrl: "https://example.com/read-story?utm=home",
            personalizedScore: 140,
          },
          {
            ...localItem,
            matchedSignals: ["entity"],
            personalizedScore: 130,
          },
        ],
        limit: 3,
        recordedItems: [readVariant],
        visitorKey: "visitor-test-123",
      }).map((record) => record.newsItemId),
    ).toEqual(["local-story"]);
  });
});

describe("selectNewsHomePositiveFeedbackAnchors", () => {
  it("turns current feedback, saved stories, and read history into local For You anchors", () => {
    expect(
      selectNewsHomePositiveFeedbackAnchors({
        explicitFeedbackItems: [
          {
            ...localItem,
            action: "share",
            occurredAt: "2026-07-01T10:00:00.000Z",
          },
        ],
        historyItems: [
          {
            ...olderItem,
            viewedAt: "2026-07-01T08:00:00.000Z",
          },
        ],
        savedItems: [
          {
            ...serverItem,
            savedAt: "2026-07-01T09:00:00.000Z",
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        action: "share",
        occurredAt: "2026-07-01T10:00:00.000Z",
        sourceSlug: localItem.sourceSlug,
      }),
      expect.objectContaining({
        action: "save",
        occurredAt: "2026-07-01T09:00:00.000Z",
        sourceSlug: serverItem.sourceSlug,
      }),
      expect.objectContaining({
        action: undefined,
        occurredAt: "2026-07-01T08:00:00.000Z",
        sourceSlug: olderItem.sourceSlug,
      }),
    ]);
  });

  it("preserves saved and read angle tags for local For You anchors", () => {
    expect(
      selectNewsHomePositiveFeedbackAnchors({
        explicitFeedbackItems: [],
        historyItems: [
          {
            ...olderItem,
            tags: ["prompt-injection"],
            viewedAt: "2026-07-01T08:00:00.000Z",
          },
        ],
        savedItems: [
          {
            ...serverItem,
            savedAt: "2026-07-01T09:00:00.000Z",
            tags: ["prompt_injection"],
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        action: "save",
        tags: ["prompt_injection"],
      }),
      expect.objectContaining({
        action: undefined,
        tags: ["prompt-injection"],
      }),
    ]);
  });
});

describe("mergeNewsHomePositiveFeedbackItems", () => {
  it("upgrades a saved story to a stronger shared feedback anchor", () => {
    const merged = mergeNewsHomePositiveFeedbackItems({
      currentItems: [
        {
          ...localItem,
          action: "save",
          occurredAt: "2026-07-01T09:00:00.000Z",
        },
      ],
      nextItem: {
        ...localItem,
        action: "share",
        occurredAt: "2026-07-01T09:05:00.000Z",
      },
    });

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      action: "share",
      id: localItem.id,
      occurredAt: "2026-07-01T09:05:00.000Z",
    });
  });

  it("does not downgrade a shared story after weaker source feedback", () => {
    const merged = mergeNewsHomePositiveFeedbackItems({
      currentItems: [
        {
          ...localItem,
          action: "share",
          occurredAt: "2026-07-01T09:05:00.000Z",
        },
      ],
      nextItem: {
        ...localItem,
        action: "click_source",
        occurredAt: "2026-07-01T09:10:00.000Z",
      },
    });

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      action: "share",
      id: localItem.id,
      occurredAt: "2026-07-01T09:05:00.000Z",
    });
  });
});

describe("selectNegativeFeedbackAdjustedNewsHomeItems", () => {
  it("moves stories similar to hidden feedback behind unrelated alternatives", () => {
    const hiddenFeedbackItem = {
      ...localItem,
      id: "hidden-openai-model",
      category: "model_release",
      entities: ["OpenAI", "GPT-5"],
      sourceSlug: "local-source",
    };

    expect(
      selectNegativeFeedbackAdjustedNewsHomeItems({
        negativeFeedbackItems: [hiddenFeedbackItem],
        items: [
          {
            ...localItem,
            id: "same-source-follow-up",
            entities: ["Anthropic"],
            matchedSignals: ["source"],
            personalizedScore: 180,
            sourceSlug: "local-source",
          },
          {
            ...serverItem,
            id: "unrelated-agent-story",
            category: "agent_product",
            entities: ["Anthropic", "Agents"],
            matchedSignals: ["category"],
            personalizedScore: 120,
            sourceSlug: "agent-desk",
            tags: ["agents"],
          },
          {
            ...olderItem,
            id: "shared-entity-follow-up",
            category: "funding",
            entities: ["OpenAI", "SoftBank"],
            matchedSignals: ["entity"],
            personalizedScore: 170,
            sourceSlug: "venturewire",
          },
        ],
      }).map((item) => item.id),
    ).toEqual([
      "unrelated-agent-story",
      "same-source-follow-up",
      "shared-entity-follow-up",
    ]);
  });

  it("moves stories sharing hidden tags behind unrelated alternatives", () => {
    const hiddenFeedbackItem = {
      ...localItem,
      id: "hidden-agent-angle",
      category: "model_release",
      entities: ["OpenAI"],
      sourceSlug: "local-source",
      tags: ["agents"],
    };

    const feed = selectNegativeFeedbackAdjustedNewsHomeItems({
      negativeFeedbackItems: [hiddenFeedbackItem],
      items: [
        {
          ...localItem,
          id: "shared-agent-angle",
          category: "research",
          entities: ["Benchmarks"],
          matchedSignals: ["tag"],
          personalizedScore: 180,
          sourceSlug: "research-lab",
          tags: ["agents"],
        },
        {
          ...serverItem,
          id: "fresh-market-angle",
          category: "market_map",
          entities: ["AI market"],
          matchedSignals: [],
          personalizedScore: 130,
          sourceSlug: "market-map",
          tags: ["enterprise"],
        },
      ],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "fresh-market-angle",
      "shared-agent-angle",
    ]);
    expect(feed[1]?.matchedSignals).toContain("negative_feedback");
  });

  it("keeps ranked order when there is no negative feedback context", () => {
    expect(
      selectNegativeFeedbackAdjustedNewsHomeItems({
        negativeFeedbackItems: [],
        items: [
          {
            ...serverItem,
            matchedSignals: ["category"],
            personalizedScore: 140,
          },
          {
            ...localItem,
            matchedSignals: ["entity"],
            personalizedScore: 130,
          },
        ],
      }).map((item) => item.id),
    ).toEqual(["server-story", "local-story"]);
  });
});

describe("selectFeedFatigueBalancedNewsHomeItems", () => {
  it("inserts an available source and topic alternate before fatigue repeats", () => {
    expect(
      selectFeedFatigueBalancedNewsHomeItems({
        items: [
          {
            ...localItem,
            id: "openai-model-lead",
            category: "model_release",
            matchedSignals: ["category"],
            personalizedScore: 180,
            sourceSlug: "openai-news",
          },
          {
            ...localItem,
            id: "openai-funding-follow",
            category: "funding",
            matchedSignals: ["source"],
            personalizedScore: 170,
            sourceSlug: "openai-news",
          },
          {
            ...serverItem,
            id: "anthropic-model-follow",
            category: "model_release",
            matchedSignals: ["category"],
            personalizedScore: 165,
            sourceSlug: "agent-desk",
          },
          {
            ...olderItem,
            id: "agent-product-alternate",
            category: "agent_product",
            matchedSignals: ["exploration"],
            personalizedScore: 120,
            sourceSlug: "venturewire",
          },
        ],
      }).map((item) => item.id),
    ).toEqual([
      "openai-model-lead",
      "agent-product-alternate",
      "openai-funding-follow",
      "anthropic-model-follow",
    ]);
  });

  it("keeps ranked order when every remaining story would repeat fatigue", () => {
    expect(
      selectFeedFatigueBalancedNewsHomeItems({
        items: [
          {
            ...localItem,
            id: "first-source-story",
            matchedSignals: ["source"],
            personalizedScore: 160,
            sourceSlug: "openai-news",
          },
          {
            ...serverItem,
            id: "second-source-story",
            matchedSignals: ["source"],
            personalizedScore: 150,
            sourceSlug: "openai-news",
          },
        ],
      }).map((item) => item.id),
    ).toEqual(["first-source-story", "second-source-story"]);
  });
});

describe("getNewsFeedFatigueReport", () => {
  it("summarizes repeated entities in the ranked feed", () => {
    const report = getNewsFeedFatigueReport({
      items: [
        {
          ...localItem,
          id: "openai-model-lead",
          category: "model_release",
          entities: ["OpenAI", "Agents"],
          matchedSignals: ["category"],
          personalizedScore: 180,
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
        },
        {
          ...serverItem,
          id: "openai-funding-follow",
          category: "funding",
          entities: ["OpenAI", "Benchmarks"],
          matchedSignals: ["entity"],
          personalizedScore: 170,
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
        },
        {
          ...olderItem,
          id: "anthropic-agent-angle",
          category: "agent_product",
          entities: ["Anthropic", "Claude"],
          matchedSignals: ["exploration"],
          personalizedScore: 120,
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
        },
      ],
    });

    expect(report.label).toBe("Watch");
    expect(report.metrics).toEqual(
      expect.arrayContaining([
        { label: "Entity repeats", value: "1" },
        { label: "Longest entity run", value: "2" },
      ]),
    );
    expect(report.notices).toEqual(
      expect.arrayContaining([
        {
          detail:
            "OpenAI repeats across 2 adjacent stories before the next entity appears.",
          label: "Entity fatigue",
        },
      ]),
    );
    expect(report.summary).toBe(
      "3 stories checked for source, topic, and entity fatigue: 0 source repeats, 0 topic repeats, 1 entity repeat.",
    );
  });

  it("summarizes source and topic repeats in the ranked feed", () => {
    expect(
      getNewsFeedFatigueReport({
        items: [
          {
            ...localItem,
            id: "openai-model-lead",
            category: "model_release",
            entities: ["OpenAI"],
            matchedSignals: ["category"],
            personalizedScore: 180,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
          },
          {
            ...serverItem,
            id: "openai-funding-follow",
            category: "funding",
            entities: ["Anthropic"],
            matchedSignals: ["source"],
            personalizedScore: 170,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
          },
          {
            ...olderItem,
            id: "agent-product-alternate",
            category: "agent_product",
            entities: ["Mistral"],
            matchedSignals: ["exploration"],
            personalizedScore: 120,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
          {
            ...serverItem,
            id: "anthropic-agent-follow",
            category: "agent_product",
            entities: ["Claude"],
            matchedSignals: ["category"],
            personalizedScore: 115,
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
          },
        ],
      }),
    ).toEqual({
      label: "Watch",
      metrics: [
        { label: "Source repeats", value: "1" },
        { label: "Topic repeats", value: "1" },
        { label: "Entity repeats", value: "0" },
        { label: "Longest source run", value: "2" },
        { label: "Longest topic run", value: "2" },
        { label: "Longest entity run", value: "1" },
      ],
      notices: [
        {
          detail:
            "OpenAI News repeats across 2 adjacent stories before the next source appears.",
          label: "Source fatigue",
        },
        {
          detail:
            "Agents repeats across 2 adjacent stories before the next topic appears.",
          label: "Topic fatigue",
        },
      ],
      summary:
        "4 stories checked for source, topic, and entity fatigue: 1 source repeat, 1 topic repeat, 0 entity repeats.",
    });
  });

  it("marks a balanced feed when adjacent fatigue is absent", () => {
    expect(
      getNewsFeedFatigueReport({
        items: [
          {
            ...localItem,
            category: "model_release",
            matchedSignals: ["category"],
            personalizedScore: 180,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
          },
          {
            ...serverItem,
            category: "agent_product",
            entities: ["Anthropic"],
            matchedSignals: ["exploration"],
            personalizedScore: 120,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
        ],
      }).label,
    ).toBe("Throttled");
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

  it("removes canonical or original URL variants of stories hidden during the current session", () => {
    expect(
      selectVisibleNewsHomeItems({
        hiddenItemIds: ["hidden-openai-model"],
        hiddenItems: [
          {
            ...localItem,
            canonicalUrl: "https://example.com/openai-model",
            id: "hidden-openai-model",
            originalUrl: "https://example.com/openai-model",
          },
        ],
        items: [
          {
            ...serverItem,
            canonicalUrl: "https://mirror.example/openai-model",
            id: "syndicated-openai-model",
            originalUrl: "https://example.com/openai-model?utm=feed",
          },
          {
            ...olderItem,
            canonicalUrl: "https://example.com/fresh-story",
            id: "fresh-story",
            originalUrl: "https://example.com/fresh-story",
          },
        ],
      }).map((item) => item.id),
    ).toEqual(["fresh-story"]);
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
    const uniqueServerItem = {
      ...serverItem,
      canonicalUrl: "https://example.com/server-story",
      originalUrl: "https://example.com/server-story",
    };

    expect(
      mergeNewsHomeItems({
        currentItems: [localItem, uniqueServerItem],
        nextItems: [
          uniqueServerItem,
          {
            ...olderItem,
            canonicalUrl: "https://example.com/older-story",
            originalUrl: "https://example.com/older-story",
          },
        ],
      }).map((item) => item.id),
    ).toEqual(["local-story", "server-story", "older-story"]);
  });

  it("does not append canonical or original URL variants of existing stories", () => {
    expect(
      mergeNewsHomeItems({
        currentItems: [
          {
            ...localItem,
            canonicalUrl: "https://example.com/openai-model",
            id: "canonical-openai-model",
            originalUrl: "https://example.com/openai-model",
          },
        ],
        nextItems: [
          {
            ...serverItem,
            canonicalUrl: "https://mirror.example/openai-model",
            id: "syndicated-openai-model",
            originalUrl: "https://example.com/openai-model?utm=feed",
          },
          {
            ...olderItem,
            canonicalUrl: "https://example.com/fresh-story",
            id: "fresh-story",
            originalUrl: "https://example.com/fresh-story",
          },
        ],
      }).map((item) => item.id),
    ).toEqual(["canonical-openai-model", "fresh-story"]);
  });
});

describe("selectRelatedNewsHomeItems", () => {
  it("removes current article URL variants and deduplicates related stories", () => {
    expect(
      selectRelatedNewsHomeItems({
        article: {
          ...localItem,
          canonicalUrl: "https://example.com/openai-model",
          id: "current-openai-model",
          originalUrl: "https://example.com/openai-model",
        },
        limit: 3,
        relatedItems: [
          {
            ...serverItem,
            canonicalUrl: "https://mirror.example/openai-model",
            id: "current-syndicated-openai-model",
            originalUrl: "https://example.com/openai-model?utm=related",
            sourceScore: 70,
            trendScore: 95,
          },
          {
            ...serverItem,
            canonicalUrl: "https://mirror.example/agents-launch",
            id: "syndicated-agents-launch",
            originalUrl: "https://example.com/agents-launch?utm=related",
            sourceScore: 84,
            trendScore: 92,
          },
          {
            ...serverItem,
            canonicalUrl: "https://example.com/agents-launch",
            id: "official-agents-launch",
            originalUrl: "https://example.com/agents-launch",
            sourceScore: 96,
            trendScore: 86,
          },
          {
            ...olderItem,
            canonicalUrl: "https://example.com/fresh-related-story",
            id: "fresh-related-story",
            originalUrl: "https://example.com/fresh-related-story",
          },
        ],
      }).map((item) => item.id),
    ).toEqual(["official-agents-launch", "fresh-related-story"]);
  });

  it("ranks entity and angle matches before broad topic-only related stories", () => {
    expect(
      selectRelatedNewsHomeItems({
        article: {
          ...localItem,
          category: "agent_product",
          entities: ["OpenAI"],
          tags: ["agents"],
        },
        limit: 3,
        relatedItems: [
          {
            ...serverItem,
            canonicalUrl: "https://example.com/topic-only-hot-story",
            category: "agent_product",
            entities: ["Anthropic"],
            id: "topic-only-hot-story",
            originalUrl: "https://example.com/topic-only-hot-story",
            tags: ["enterprise"],
            trendScore: 99,
          },
          {
            ...olderItem,
            canonicalUrl: "https://example.com/shared-entity-story",
            category: "research",
            entities: ["OpenAI"],
            id: "shared-entity-story",
            originalUrl: "https://example.com/shared-entity-story",
            tags: ["benchmarks"],
            trendScore: 70,
          },
          {
            ...serverItem,
            canonicalUrl: "https://example.com/shared-angle-story",
            category: "funding",
            entities: ["Mistral"],
            id: "shared-angle-story",
            originalUrl: "https://example.com/shared-angle-story",
            tags: ["agents"],
            trendScore: 72,
          },
        ],
      }).map((item) => item.id),
    ).toEqual([
      "shared-entity-story",
      "shared-angle-story",
      "topic-only-hot-story",
    ]);
  });

  it("normalizes related angle tag variants before broad topic-only stories", () => {
    expect(
      selectRelatedNewsHomeItems({
        article: {
          ...localItem,
          category: "security",
          entities: ["Security Lab"],
          tags: ["prompt_injection"],
        },
        limit: 2,
        relatedItems: [
          {
            ...serverItem,
            canonicalUrl: "https://example.com/topic-only-security",
            category: "security",
            entities: ["Policy Desk"],
            id: "topic-only-security",
            originalUrl: "https://example.com/topic-only-security",
            tags: ["governance"],
            trendScore: 99,
          },
          {
            ...olderItem,
            canonicalUrl: "https://example.com/prompt-injection-follow-up",
            category: "research",
            entities: ["Red Team Lab"],
            id: "prompt-injection-follow-up",
            originalUrl: "https://example.com/prompt-injection-follow-up",
            tags: ["prompt-injection"],
            trendScore: 70,
          },
        ],
      }).map((item) => item.id),
    ).toEqual(["prompt-injection-follow-up", "topic-only-security"]);
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

describe("getNewsHomeReaderMemoryResetCacheScopes", () => {
  it("refreshes every persisted reader-memory surface after a reset", () => {
    expect(getNewsHomeReaderMemoryResetCacheScopes()).toEqual([
      "forYou",
      "profile",
      "saved",
      "history",
      "guardrails",
    ]);
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

  it("explains fine-grained tag matches from the reader interest graph", () => {
    expect(
      getNewsRecommendationReasons({
        item: {
          ...localItem,
          matchedSignals: ["tag"],
          personalizedScore: 128,
          tags: ["model", "prompt_injection"],
        },
      }),
    ).toEqual(["Preferred angle: prompt injection"]);
  });

  it("explains positive feedback from deep reads, saves, shares, or source clicks", () => {
    expect(
      getNewsRecommendationReasons({
        item: {
          ...localItem,
          matchedSignals: ["positive_feedback"],
          personalizedScore: 128,
        },
      }),
    ).toEqual(["Deep read, save, share, or source-click signal"]);
  });

  it("explains semantic similarity to reader-memory stories", () => {
    expect(
      getNewsRecommendationReasons({
        item: {
          ...localItem,
          matchedSignals: ["semantic_feedback"],
          personalizedScore: 124,
        },
      }),
    ).toEqual(["Similar to stories you engaged with"]);
  });

  it("explains collaborative signals from similar readers", () => {
    expect(
      getNewsRecommendationReasons({
        item: {
          ...localItem,
          matchedSignals: ["collaborative_feedback"],
          personalizedScore: 119,
        },
      }),
    ).toEqual(["Popular with similar readers"]);
  });

  it("explains source corroboration across independent coverage", () => {
    expect(
      getNewsRecommendationReasons({
        item: {
          ...localItem,
          matchedSignals: ["source_corroboration"],
          personalizedScore: 119,
        },
      }),
    ).toEqual(["Corroborated by multiple sources"]);
  });

  it("explains current session intent from search or active filters", () => {
    expect(
      getNewsRecommendationReasons({
        item: {
          ...localItem,
          matchedSignals: ["session_intent"],
          personalizedScore: 119,
        },
      }),
    ).toEqual(["Current session intent"]);
  });

  it("explains edition timing signals from the daypart scheduler", () => {
    expect(
      getNewsRecommendationReasons({
        item: {
          ...localItem,
          matchedSignals: ["daypart"],
          personalizedScore: 119,
        },
      }),
    ).toEqual(["Timed for this edition"]);
  });

  it("explains exact home exposure cooldown separately from article reads", () => {
    expect(
      getNewsRecommendationReasons({
        item: {
          ...localItem,
          matchedSignals: ["home_exposure_cooldown"],
          personalizedScore: 119,
        },
      }),
    ).toEqual(["Recently seen on home"]);
  });

  it("explains recommendations dampened by Less feedback", () => {
    expect(
      getNewsRecommendationReasons({
        item: {
          ...localItem,
          matchedSignals: ["negative_feedback"],
          personalizedScore: 64,
        },
      }),
    ).toEqual(["Dampened by Less feedback"]);
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
  it("uses the server recommendation explanation for For You stories when available", () => {
    const serverExplainedItem = {
      ...localItem,
      matchedSignals: ["category"],
      personalizedScore: 136,
      recommendation: {
        badges: ["Server ranked"],
        scoreLabel: "136 score",
        summary: "Server-side ranking trace explains this card.",
      },
    };

    expect(
      getNewsStoryRankDetails({
        item: serverExplainedItem,
        mode: "for_you",
        now: new Date("2026-07-01T10:00:00.000Z"),
      }),
    ).toEqual({
      badges: ["Server ranked"],
      summary: "Server-side ranking trace explains this card.",
      scoreLabel: "136 score",
    });
  });

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

  it("includes tag signals in personalized rank explanations", () => {
    expect(
      getNewsStoryRankDetails({
        item: {
          ...localItem,
          matchedSignals: ["tag"],
          personalizedScore: 118,
          tags: ["model", "prompt_injection"],
          trendScore: 64,
        },
        now: new Date("2026-07-01T10:00:00.000Z"),
      }),
    ).toEqual({
      badges: ["Preferred angle: prompt injection", "Fresh", "Strong source"],
      summary:
        "Ranked for your prompt injection angle signals, with fresh publication timing and source credibility.",
      scoreLabel: "118 score",
    });
  });

  it("explains reader-memory anchors without falling back to edition-wide momentum", () => {
    expect(
      getNewsStoryRankDetails({
        item: {
          ...localItem,
          matchedSignals: ["positive_feedback"],
          personalizedScore: 126,
          sourceScore: 84,
          trendScore: 61,
        },
        now: new Date("2026-07-01T10:00:00.000Z"),
      }),
    ).toEqual({
      badges: [
        "Deep read, save, share, or source-click signal",
        "Fresh",
        "Strong source",
      ],
      summary:
        "Ranked from your reader-memory signals, with fresh publication timing and source credibility.",
      scoreLabel: "126 score",
    });
  });

  it("explains semantic reader-memory matches without implying a direct preference", () => {
    expect(
      getNewsStoryRankDetails({
        item: {
          ...localItem,
          matchedSignals: ["semantic_feedback"],
          personalizedScore: 123,
          sourceScore: 84,
          trendScore: 66,
        },
        now: new Date("2026-07-01T10:00:00.000Z"),
      }),
    ).toEqual({
      badges: ["Similar to stories you engaged with", "Fresh", "Strong source"],
      summary:
        "Ranked by semantic similarity to stories you read, saved, shared, or source-clicked, with fresh publication timing and source credibility.",
      scoreLabel: "123 score",
    });
  });

  it("explains collaborative reader lift as a crowd signal", () => {
    expect(
      getNewsStoryRankDetails({
        item: {
          ...localItem,
          matchedSignals: ["collaborative_feedback"],
          personalizedScore: 119,
          sourceScore: 84,
          trendScore: 66,
        },
        now: new Date("2026-07-01T10:00:00.000Z"),
      }),
    ).toEqual({
      badges: ["Popular with similar readers", "Fresh", "Strong source"],
      summary:
        "Lifted by recent saves, shares, and deep reads from similar readers, with fresh publication timing and source credibility.",
      scoreLabel: "119 score",
    });
  });

  it("explains source corroboration as independent coverage", () => {
    expect(
      getNewsStoryRankDetails({
        item: {
          ...localItem,
          matchedSignals: ["source_corroboration"],
          personalizedScore: 121,
          sourceScore: 84,
          trendScore: 66,
        },
        now: new Date("2026-07-01T10:00:00.000Z"),
      }),
    ).toEqual({
      badges: ["Corroborated by multiple sources", "Fresh", "Strong source"],
      summary:
        "Lifted because independent sources are covering the same development, with fresh publication timing and source credibility.",
      scoreLabel: "121 score",
    });
  });

  it("explains active search or filter intent as a session signal", () => {
    expect(
      getNewsStoryRankDetails({
        item: {
          ...localItem,
          matchedSignals: ["session_intent"],
          personalizedScore: 119,
          sourceScore: 84,
          trendScore: 66,
        },
        now: new Date("2026-07-01T10:00:00.000Z"),
      }),
    ).toEqual({
      badges: ["Current session intent", "Fresh", "Strong source"],
      summary:
        "Ranked by the topic, source, or search intent active in this session, with fresh publication timing and source credibility.",
      scoreLabel: "119 score",
    });
  });

  it("explains home exposure cooldown as a repeated card guardrail", () => {
    expect(
      getNewsStoryRankDetails({
        item: {
          ...localItem,
          matchedSignals: ["home_exposure_cooldown"],
          personalizedScore: 119,
          sourceScore: 84,
          trendScore: 66,
        },
        now: new Date("2026-07-01T10:00:00.000Z"),
      }),
    ).toEqual({
      badges: ["Recently seen on home", "Fresh", "Strong source"],
      summary:
        "Moved behind fresh angles because this card or URL was recently seen on the home feed, while still supported by fresh publication timing and source credibility.",
      scoreLabel: "119 score",
    });
  });

  it("explains article-read exposure cooldown as a fresh-angle guardrail", () => {
    expect(
      getNewsStoryRankDetails({
        item: {
          ...localItem,
          matchedSignals: ["exposure_cooldown"],
          personalizedScore: 119,
          sourceScore: 84,
          trendScore: 66,
        },
        now: new Date("2026-07-01T10:00:00.000Z"),
      }),
    ).toEqual({
      badges: ["Fresh angle after reading", "Fresh", "Strong source"],
      summary:
        "Moved behind fresh angles because you recently read a similar topic, source, or entity, while still supported by fresh publication timing and source credibility.",
      scoreLabel: "119 score",
    });
  });

  it("explains negative feedback guardrails without presenting the story as a reader match", () => {
    expect(
      getNewsStoryRankDetails({
        item: {
          ...localItem,
          matchedSignals: ["negative_feedback"],
          personalizedScore: 58,
          sourceScore: 82,
          trendScore: 73,
        },
        now: new Date("2026-07-01T10:00:00.000Z"),
      }),
    ).toEqual({
      badges: ["Dampened by Less feedback", "Fresh", "Strong source"],
      summary:
        "Dampened by your Less feedback, but still visible because of fresh publication timing and source credibility.",
      scoreLabel: "58 score",
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

describe("getNewsStoryProofStrip", () => {
  it("summarizes reader fit, corroboration, source trust, and story heat", () => {
    expect(
      getNewsStoryProofStrip({
        item: {
          ...localItem,
          matchedSignals: ["category", "entity", "source_corroboration"],
          personalizedScore: 137,
          sourceScore: 86,
          trendScore: 78,
        },
      }),
    ).toEqual({
      metrics: [
        { label: "Fit", value: "2 reader signals" },
        { label: "Coverage", value: "Corroborated" },
        { label: "Trust", value: "86" },
        { label: "Heat", value: "78" },
      ],
      summary:
        "Personalized from 2 reader signals, corroborated by independent coverage, with 86 source trust and 78 story heat.",
    });
  });

  it("labels Less feedback as a guardrail instead of a positive reader match", () => {
    expect(
      getNewsStoryProofStrip({
        item: {
          ...localItem,
          matchedSignals: ["negative_feedback"],
          personalizedScore: 58,
          sourceScore: 82,
          trendScore: 73,
        },
      }),
    ).toEqual({
      metrics: [
        { label: "Fit", value: "Guardrail" },
        { label: "Coverage", value: "Single source" },
        { label: "Trust", value: "82" },
        { label: "Heat", value: "73" },
      ],
      summary:
        "Dampened by Less feedback, but kept visible by 82 source trust and 73 story heat.",
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
      label: "Preview edition",
      detail:
        "A readable AI preview edition is serving while the production news tables are unavailable.",
    });
  });
});

describe("getNewsProductionReadinessChecklist", () => {
  it("keeps schema and source setup actionable while preview mode is serving", () => {
    expect(
      getNewsProductionReadinessChecklist({
        refreshConfigured: false,
        status: {
          health: "unavailable",
          activeSources: 0,
          totalSources: 0,
          publishedStories: 0,
          latestPublishedAt: null,
          latestRun: null,
        },
      }),
    ).toEqual([
      {
        detail:
          "Preview stories are serving now; apply the production news schema to unlock live collection.",
        label: "Apply database schema",
        state: "current",
      },
      {
        detail: "Register the AI source list after the schema is available.",
        label: "Seed sources",
        state: "pending",
      },
      {
        detail: "Set NEWS_REFRESH_SECRET before scheduling refresh calls.",
        label: "Protect refresh endpoint",
        state: "current",
      },
      {
        detail: "Run news:refresh or news:refresh:remote after sources exist.",
        label: "Run first refresh",
        state: "pending",
      },
      {
        detail: "Preview stories stay visible until published stories exist.",
        label: "Live stories",
        state: "pending",
      },
    ]);
  });

  it("shows seeded sources as ready while the first refresh is still pending", () => {
    expect(
      getNewsProductionReadinessChecklist({
        refreshConfigured: true,
        status: {
          health: "seeded",
          activeSources: 6,
          totalSources: 8,
          publishedStories: 0,
          latestPublishedAt: null,
          latestRun: null,
        },
      }).map((item) => [item.label, item.state]),
    ).toEqual([
      ["Apply database schema", "done"],
      ["Seed sources", "done"],
      ["Protect refresh endpoint", "done"],
      ["Run first refresh", "current"],
      ["Live stories", "pending"],
    ]);
  });

  it("marks the production news loop ready when live stories are published", () => {
    expect(
      getNewsProductionReadinessChecklist({
        refreshConfigured: true,
        status: {
          health: "live",
          activeSources: 9,
          totalSources: 12,
          publishedStories: 42,
          latestPublishedAt: "2026-07-01T10:30:00.000Z",
          latestRun: null,
        },
      }).map((item) => [item.label, item.state]),
    ).toEqual([
      ["Apply database schema", "done"],
      ["Seed sources", "done"],
      ["Protect refresh endpoint", "done"],
      ["Run first refresh", "done"],
      ["Live stories", "done"],
    ]);
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
