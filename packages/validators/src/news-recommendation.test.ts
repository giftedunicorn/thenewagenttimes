import { describe, expect, test } from "vitest";

import {
  buildNewsSemanticSimilarityMatches,
  dedupeNewsItems,
  filterBlockedNewsItems,
  filterHiddenNewsItems,
  getNewsExplorationInterval,
  normalizeNewsPreferenceProfile,
  rankNewsForReader,
  selectBreakingNewsPriorityFeed,
  selectCollaborativeSignalNewsFeed,
  selectDaypartBalancedNewsFeed,
  selectDiscoverySlotNewsFeed,
  selectDiverseNewsFeed,
  selectExposureBalancedNewsFeed,
  selectFatigueBalancedNewsFeed,
  selectNegativeFeedbackAdjustedNewsFeed,
  selectNewsRecommendationRotationFeed,
  selectNewsRecommendationRotationSlots,
  selectPositiveFeedbackAnchoredNewsFeed,
  selectReaderFreshNewsFeed,
  selectSemanticSimilarityNewsFeed,
  selectSessionIntentNewsFeed,
  selectSourceCorroboratedNewsFeed,
  selectSourceTrustBalancedNewsFeed,
  updateReaderProfileWithInteraction,
} from "./news-recommendation";

const basePublishedAt = "2026-07-01T08:00:00.000Z";

const items = [
  {
    id: "model-release",
    title: "Frontier model release reshapes agent benchmarks",
    category: "model_release",
    tags: ["agents", "benchmarks"],
    entities: ["OpenAI"],
    sourceSlug: "openai-news",
    sourceScore: 88,
    trendScore: 70,
    publishedAt: basePublishedAt,
  },
  {
    id: "funding",
    title: "Agent startup raises new funding round",
    category: "funding",
    tags: ["startup"],
    entities: ["Series A"],
    sourceSlug: "venturewire",
    sourceScore: 78,
    trendScore: 92,
    publishedAt: "2026-06-29T08:00:00.000Z",
  },
] as const;

const defaultProfile = {
  preferredCategories: ["model_release"],
  preferredSources: [],
  preferredEntities: [],
  noveltyBias: 1,
  recencyBias: 1,
};

describe("normalizeNewsPreferenceProfile", () => {
  test("cleans reader signals before ranking or persistence", () => {
    const profile = normalizeNewsPreferenceProfile({
      preferredCategories: [" model_release ", "MODEL_RELEASE", "", "funding"],
      preferredSources: [" openai-news ", "OpenAI-News", "venturewire", " "],
      preferredEntities: [" OpenAI ", "openai", "Anthropic", ""],
      noveltyBias: 9,
      recencyBias: -3,
    });

    expect(profile).toEqual({
      preferredCategories: ["model_release", "funding"],
      preferredSources: ["openai-news", "venturewire"],
      preferredEntities: ["OpenAI", "Anthropic"],
      noveltyBias: 2,
      recencyBias: 0,
    });
  });

  test("keeps only the most recent bounded reader signals", () => {
    const profile = normalizeNewsPreferenceProfile({
      preferredCategories: Array.from(
        { length: 14 },
        (_, index) => `category-${index}`,
      ),
      preferredSources: Array.from(
        { length: 14 },
        (_, index) => `source-${index}`,
      ),
      preferredEntities: Array.from(
        { length: 26 },
        (_, index) => `Entity ${index}`,
      ),
      noveltyBias: 1,
      recencyBias: 1,
    });

    expect(profile.preferredCategories).toEqual(
      Array.from({ length: 12 }, (_, index) => `category-${index + 2}`),
    );
    expect(profile.preferredSources).toEqual(
      Array.from({ length: 12 }, (_, index) => `source-${index + 2}`),
    );
    expect(profile.preferredEntities).toEqual(
      Array.from({ length: 24 }, (_, index) => `Entity ${index + 2}`),
    );
  });
});

describe("getNewsExplorationInterval", () => {
  test("uses a higher exploration budget while the reader profile is cold", () => {
    expect(
      getNewsExplorationInterval({
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      }),
    ).toBe(2);
  });

  test("uses a moderate exploration budget while the reader profile is learning", () => {
    expect(
      getNewsExplorationInterval({
        preferredCategories: ["model_release", "funding"],
        preferredSources: ["openai-news"],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1.2,
        recencyBias: 1,
      }),
    ).toBe(4);
  });

  test("uses a lower exploration budget for focused reader profiles", () => {
    expect(
      getNewsExplorationInterval({
        preferredCategories: [
          "model_release",
          "funding",
          "agent_product",
          "research",
        ],
        preferredSources: ["openai-news", "venturewire"],
        preferredEntities: ["OpenAI", "Anthropic", "YC", "LangChain"],
        noveltyBias: 1.7,
        recencyBias: 1.5,
      }),
    ).toBe(6);
  });
});

describe("rankNewsForReader", () => {
  test("boosts items matching preferred categories, sources, and entities", () => {
    const ranked = rankNewsForReader(items, {
      preferredCategories: ["model_release"],
      preferredSources: ["openai-news"],
      preferredEntities: ["OpenAI"],
      noveltyBias: 1,
      recencyBias: 1,
    });

    expect(ranked[0]?.id).toBe("model-release");
    expect(ranked[0]?.personalizedScore).toBeGreaterThan(
      ranked[1]?.personalizedScore ?? 0,
    );
    expect(ranked[0]?.matchedSignals).toEqual(
      expect.arrayContaining(["category", "source", "entity"]),
    );
  });

  test("boosts fine-grained interest terms that match story tags", () => {
    const ranked = rankNewsForReader(
      [
        {
          ...items[0],
          id: "matching-tag",
          category: "research",
          entities: ["Benchmarks"],
          publishedAt: "2026-07-01T08:00:00.000Z",
          sourceSlug: "research-lab",
          tags: ["agents"],
          title: "Agent benchmark roundup",
          trendScore: 70,
        },
        {
          ...items[0],
          id: "newer-without-tag",
          category: "research",
          entities: ["Benchmarks"],
          publishedAt: "2026-07-01T09:00:00.000Z",
          sourceSlug: "research-lab",
          tags: ["benchmarks"],
          title: "Benchmark roundup",
          trendScore: 70,
        },
      ],
      {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: ["agents"],
        noveltyBias: 0,
        recencyBias: 0,
      },
    );

    expect(ranked.map((item) => item.id)).toEqual([
      "matching-tag",
      "newer-without-tag",
    ]);
    expect(ranked[0]?.matchedSignals).toContain("tag");
  });

  test("keeps trend-heavy items competitive when preferences are broad", () => {
    const ranked = rankNewsForReader(items, {
      preferredCategories: [],
      preferredSources: [],
      preferredEntities: [],
      noveltyBias: 0,
      recencyBias: 0,
    });

    expect(ranked[0]?.id).toBe("funding");
  });

  test("preserves upstream semantic and collaborative recommendation signals during reranking", () => {
    const ranked = rankNewsForReader(
      [
        {
          ...items[0],
          id: "server-lifted-follow-up",
          matchedSignals: ["semantic_feedback", "collaborative_feedback"],
          personalizedScore: 140,
          publishedAt: "2026-07-01T08:00:00.000Z",
          sourceScore: 70,
          trendScore: 40,
        },
        {
          ...items[1],
          id: "raw-trending-story",
          publishedAt: "2026-07-01T08:30:00.000Z",
          sourceScore: 90,
          trendScore: 95,
        },
      ],
      {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 0,
        recencyBias: 0,
      },
      new Date("2026-07-01T10:00:00.000Z"),
    );

    expect(ranked[0]?.id).toBe("server-lifted-follow-up");
    expect(ranked[0]?.personalizedScore).toBeGreaterThanOrEqual(140);
    expect(ranked[0]?.matchedSignals).toEqual(
      expect.arrayContaining(["semantic_feedback", "collaborative_feedback"]),
    );
  });

  test("preserves upstream demotion guardrails during reranking", () => {
    const ranked = rankNewsForReader(
      [
        {
          ...items[0],
          id: "server-dampened-repeat",
          matchedSignals: ["negative_feedback", "home_exposure_cooldown"],
          personalizedScore: 24,
          sourceScore: 98,
          trendScore: 100,
        },
        {
          ...items[1],
          id: "clean-alternative",
          sourceScore: 75,
          trendScore: 70,
        },
      ],
      {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 0,
        recencyBias: 0,
      },
      new Date("2026-07-01T10:00:00.000Z"),
    );

    expect(ranked[0]?.id).toBe("clean-alternative");
    expect(ranked[1]?.id).toBe("server-dampened-repeat");
    expect(ranked[1]?.personalizedScore).toBeLessThanOrEqual(24);
    expect(ranked[1]?.matchedSignals).toEqual(
      expect.arrayContaining(["negative_feedback", "home_exposure_cooldown"]),
    );
  });

  test("dampens stale high-trend stories when freshness is part of the reader model", () => {
    const ranked = rankNewsForReader(
      [
        {
          ...items[0],
          id: "stale-high-trend",
          publishedAt: "2026-06-28T08:00:00.000Z",
          sourceScore: 90,
          trendScore: 100,
        },
        {
          ...items[0],
          id: "fresh-developing-story",
          publishedAt: "2026-07-01T09:00:00.000Z",
          sourceScore: 90,
          trendScore: 82,
        },
      ],
      {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      new Date("2026-07-01T10:00:00.000Z"),
    );

    expect(ranked.map((item) => item.id)).toEqual([
      "fresh-developing-story",
      "stale-high-trend",
    ]);
  });

  test("guards the feed from low-trust high-heat sources", () => {
    const ranked = rankNewsForReader(
      [
        {
          ...items[0],
          id: "low-trust-high-heat",
          publishedAt: "2026-07-01T09:00:00.000Z",
          sourceScore: 30,
          trendScore: 100,
        },
        {
          ...items[0],
          id: "trusted-developing-story",
          publishedAt: "2026-07-01T09:00:00.000Z",
          sourceScore: 94,
          trendScore: 86,
        },
      ],
      {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      new Date("2026-07-01T10:00:00.000Z"),
    );

    expect(ranked.map((item) => item.id)).toEqual([
      "trusted-developing-story",
      "low-trust-high-heat",
    ]);
  });
});

describe("selectNewsRecommendationRotationSlots", () => {
  const rotationItems = [
    {
      ...items[0],
      id: "reader-fit",
      matchedSignals: ["category", "entity"],
      personalizedScore: 172,
      sourceScore: 84,
      sourceSlug: "model-desk",
      trendScore: 84,
    },
    {
      ...items[0],
      id: "same-source-hot",
      category: "funding",
      matchedSignals: [],
      personalizedScore: 126,
      sourceScore: 82,
      sourceSlug: "model-desk",
      trendScore: 99,
    },
    {
      ...items[0],
      id: "explore-adjacent",
      category: "agent_product",
      matchedSignals: ["exploration"],
      personalizedScore: 132,
      sourceScore: 78,
      sourceSlug: "agent-scout",
      trendScore: 88,
    },
    {
      ...items[1],
      id: "market-hot",
      matchedSignals: [],
      personalizedScore: 119,
      sourceScore: 76,
      sourceSlug: "venturewire",
      trendScore: 96,
    },
    {
      ...items[0],
      id: "trusted-analysis",
      category: "research",
      matchedSignals: [],
      personalizedScore: 121,
      sourceScore: 97,
      sourceSlug: "research-review",
      trendScore: 74,
    },
  ];

  test("interleaves reader match, exploration, market heat, and source trust with source diversity", () => {
    const slots = selectNewsRecommendationRotationSlots({
      items: rotationItems,
      limit: 4,
    });

    expect(
      slots.map((slot) => ({
        id: slot.item.id,
        objective: slot.objective,
        score: slot.score,
        scoreKind: slot.scoreKind,
        sourceSlug: slot.item.sourceSlug,
      })),
    ).toEqual([
      {
        id: "reader-fit",
        objective: "reader_match",
        score: 172,
        scoreKind: "score",
        sourceSlug: "model-desk",
      },
      {
        id: "explore-adjacent",
        objective: "exploration",
        score: 88,
        scoreKind: "heat",
        sourceSlug: "agent-scout",
      },
      {
        id: "market-hot",
        objective: "market_heat",
        score: 96,
        scoreKind: "heat",
        sourceSlug: "venturewire",
      },
      {
        id: "trusted-analysis",
        objective: "source_trust",
        score: 97,
        scoreKind: "trust",
        sourceSlug: "research-review",
      },
    ]);
  });

  test("returns an empty rotation while no ranked stories exist", () => {
    expect(
      selectNewsRecommendationRotationSlots({
        items: [],
        limit: 4,
      }),
    ).toEqual([]);
  });

  test("seeds the visible feed with rotation slots before appending the remaining ranked stories", () => {
    expect(
      selectNewsRecommendationRotationFeed({
        items: rotationItems,
        limit: 5,
      }).map((item) => item.id),
    ).toEqual([
      "reader-fit",
      "explore-adjacent",
      "market-hot",
      "trusted-analysis",
      "same-source-hot",
    ]);
  });

  test("does not override protected ranking signals or demotion guardrails", () => {
    const protectedFeed = [
      {
        ...items[0],
        id: "protected-breaking",
        matchedSignals: ["breaking_news"],
        personalizedScore: 140,
        sourceScore: 96,
        sourceSlug: "official-lab",
        trendScore: 99,
      },
      {
        ...items[0],
        id: "protected-positive",
        matchedSignals: ["positive_feedback"],
        personalizedScore: 136,
        sourceScore: 88,
        sourceSlug: "saved-source",
        trendScore: 82,
      },
      {
        ...items[0],
        id: "cooled-repeat",
        matchedSignals: ["home_exposure_cooldown"],
        personalizedScore: 118,
        sourceScore: 92,
        sourceSlug: "repeat-source",
        trendScore: 94,
      },
      {
        ...items[1],
        id: "ordinary-market",
        matchedSignals: [],
        personalizedScore: 112,
        sourceScore: 82,
        sourceSlug: "market-source",
        trendScore: 90,
      },
    ];

    expect(
      selectNewsRecommendationRotationFeed({
        items: protectedFeed,
        limit: 4,
      }).map((item) => item.id),
    ).toEqual([
      "protected-breaking",
      "protected-positive",
      "cooled-repeat",
      "ordinary-market",
    ]);
  });
});

describe("filterHiddenNewsItems", () => {
  test("removes stories that the reader has hidden before ranking", () => {
    const filtered = filterHiddenNewsItems(items, ["funding"]);

    expect(filtered.map((item) => item.id)).toEqual(["model-release"]);
  });
});

describe("filterBlockedNewsItems", () => {
  test("removes hidden stories and duplicate canonical URL variants", () => {
    const filtered = filterBlockedNewsItems(
      [
        {
          ...items[0],
          id: "hidden-openai-story",
          canonicalUrl: "https://example.com/openai-story",
        },
        {
          ...items[0],
          id: "syndicated-openai-story",
          canonicalUrl: "https://example.com/openai-story?utm=feed",
          sourceSlug: "syndication",
        },
        {
          ...items[1],
          id: "fresh-funding-story",
          canonicalUrl: "https://example.com/funding-story",
        },
      ],
      ["hidden-openai-story"],
      [
        {
          ...items[0],
          id: "hidden-openai-story",
          canonicalUrl: "https://example.com/openai-story",
        },
      ],
    );

    expect(filtered.map((item) => item.id)).toEqual(["fresh-funding-story"]);
  });

  test("removes hidden stories when a candidate original URL matches the hidden canonical URL", () => {
    const filtered = filterBlockedNewsItems(
      [
        {
          ...items[0],
          id: "syndicated-openai-story",
          canonicalUrl: "https://mirror.example/openai-story",
          originalUrl: "https://example.com/openai-story?utm=feed",
          sourceSlug: "syndication",
        },
        {
          ...items[1],
          id: "fresh-funding-story",
          canonicalUrl: "https://example.com/funding-story",
          originalUrl: "https://example.com/funding-story",
        },
      ],
      ["hidden-openai-story"],
      [
        {
          ...items[0],
          id: "hidden-openai-story",
          canonicalUrl: "https://example.com/openai-story",
          originalUrl: "https://example.com/openai-story",
        },
      ],
    );

    expect(filtered.map((item) => item.id)).toEqual(["fresh-funding-story"]);
  });

  test("removes title-equivalent hidden variants inside the same category", () => {
    const filtered = filterBlockedNewsItems(
      [
        {
          ...items[0],
          id: "hidden-gpt5-story",
          canonicalUrl: null,
          title: "OpenAI releases GPT-5 for agent workflows",
        },
        {
          ...items[0],
          id: "rewritten-gpt5-story",
          canonicalUrl: null,
          title: "OpenAI releases GPT 5 for agent workflows",
        },
        {
          ...items[0],
          id: "policy-same-title",
          canonicalUrl: null,
          category: "policy",
          title: "OpenAI releases GPT 5 for agent workflows",
        },
      ],
      ["hidden-gpt5-story"],
      [
        {
          ...items[0],
          id: "hidden-gpt5-story",
          canonicalUrl: null,
          title: "OpenAI releases GPT-5 for agent workflows",
        },
      ],
    );

    expect(filtered.map((item) => item.id)).toEqual(["policy-same-title"]);
  });

  test("removes paraphrased cross-source hidden story variants", () => {
    const filtered = filterBlockedNewsItems(
      [
        {
          ...items[0],
          id: "official-gpt5-launch",
          title: "GPT-5 arrives as OpenAI agent workflow tools",
          canonicalUrl: "https://openai.com/news/gpt5-agent-workflow-tools",
          originalUrl: "https://openai.com/news/gpt5-agent-workflow-tools",
          sourceSlug: "openai-news",
        },
        {
          ...items[0],
          id: "openai-voice-model",
          title: "OpenAI updates GPT-4o voice model",
          canonicalUrl: "https://openai.com/news/gpt4o-voice-model",
          originalUrl: "https://openai.com/news/gpt4o-voice-model",
          sourceSlug: "openai-news",
        },
      ],
      ["hidden-wire-gpt5-launch"],
      [
        {
          ...items[0],
          id: "hidden-wire-gpt5-launch",
          title: "OpenAI releases GPT-5 for agent workflows",
          canonicalUrl: "https://wire.example/openai-gpt5-agents",
          originalUrl: "https://wire.example/openai-gpt5-agents?utm=feed",
          sourceSlug: "wire",
        },
      ],
    );

    expect(filtered.map((item) => item.id)).toEqual(["openai-voice-model"]);
  });
});

describe("dedupeNewsItems", () => {
  test("collapses duplicate canonical URLs while keeping the strongest source version", () => {
    const deduped = dedupeNewsItems([
      {
        ...items[0],
        id: "syndicated-openai",
        canonicalUrl: "https://openai.com/news/agent-model",
        sourceScore: 72,
        trendScore: 88,
      },
      {
        ...items[0],
        id: "official-openai",
        canonicalUrl: "https://openai.com/news/agent-model",
        sourceScore: 96,
        trendScore: 70,
      },
      {
        ...items[1],
        id: "funding",
        canonicalUrl: "https://venture.example/funding",
      },
    ]);

    expect(deduped.map((item) => item.id)).toEqual([
      "official-openai",
      "funding",
    ]);
  });

  test("collapses canonical and original URL variants while keeping the strongest source version", () => {
    const deduped = dedupeNewsItems([
      {
        ...items[0],
        id: "canonical-openai",
        canonicalUrl: "https://openai.com/news/agent-model",
        originalUrl: "https://openai.com/news/agent-model",
        sourceScore: 82,
        trendScore: 88,
      },
      {
        ...items[0],
        id: "original-openai",
        canonicalUrl: "https://mirror.example/openai-agent-model",
        originalUrl: "https://openai.com/news/agent-model?utm=feed",
        sourceScore: 96,
        trendScore: 70,
      },
      {
        ...items[1],
        id: "funding",
        canonicalUrl: "https://venture.example/funding",
        originalUrl: "https://venture.example/funding",
      },
    ]);

    expect(deduped.map((item) => item.id)).toEqual([
      "original-openai",
      "funding",
    ]);
  });

  test("collapses title-equivalent stories inside the same category", () => {
    const deduped = dedupeNewsItems([
      {
        ...items[0],
        id: "launch-one",
        title: "OpenAI releases GPT-5 for agent workflows",
        canonicalUrl: null,
        sourceScore: 82,
        trendScore: 91,
      },
      {
        ...items[0],
        id: "launch-two",
        title: "OpenAI releases GPT 5 for agent workflows",
        canonicalUrl: null,
        sourceScore: 88,
        trendScore: 86,
      },
      {
        ...items[0],
        id: "policy-story",
        category: "policy",
        title: "OpenAI releases GPT 5 for agent workflows",
        canonicalUrl: null,
        sourceScore: 70,
        trendScore: 80,
      },
    ]);

    expect(deduped.map((item) => item.id)).toEqual([
      "launch-two",
      "policy-story",
    ]);
  });

  test("collapses title-equivalent syndicated stories even when URLs differ", () => {
    const deduped = dedupeNewsItems([
      {
        ...items[0],
        id: "wire-version",
        title: "OpenAI releases GPT-5 for agent workflows",
        canonicalUrl: "https://wire.example/openai-gpt5-agents",
        originalUrl: "https://wire.example/openai-gpt5-agents?utm=feed",
        sourceScore: 82,
        trendScore: 94,
      },
      {
        ...items[0],
        id: "official-version",
        title: "OpenAI releases GPT 5 for agent workflows",
        canonicalUrl: "https://openai.com/news/gpt5-agent-workflows",
        originalUrl: "https://openai.com/news/gpt5-agent-workflows",
        sourceScore: 96,
        trendScore: 88,
      },
      {
        ...items[0],
        id: "policy-version",
        category: "policy",
        title: "OpenAI releases GPT 5 for agent workflows",
        canonicalUrl: "https://policy.example/openai-gpt5-agents",
        originalUrl: "https://policy.example/openai-gpt5-agents",
        sourceScore: 90,
        trendScore: 80,
      },
    ]);

    expect(deduped.map((item) => item.id)).toEqual([
      "official-version",
      "policy-version",
    ]);
  });

  test("collapses paraphrased cross-source AI launch headlines with shared entity and topic tokens", () => {
    const deduped = dedupeNewsItems([
      {
        ...items[0],
        id: "wire-gpt5-launch",
        title: "OpenAI releases GPT-5 for agent workflows",
        canonicalUrl: "https://wire.example/openai-gpt5-agents",
        originalUrl: "https://wire.example/openai-gpt5-agents?utm=feed",
        sourceSlug: "wire",
        sourceScore: 82,
        trendScore: 94,
      },
      {
        ...items[0],
        id: "official-gpt5-launch",
        title: "GPT-5 arrives as OpenAI agent workflow tools",
        canonicalUrl: "https://openai.com/news/gpt5-agent-workflow-tools",
        originalUrl: "https://openai.com/news/gpt5-agent-workflow-tools",
        sourceSlug: "openai-news",
        sourceScore: 96,
        trendScore: 88,
      },
      {
        ...items[0],
        id: "openai-voice-model",
        title: "OpenAI updates GPT-4o voice model",
        canonicalUrl: "https://openai.com/news/gpt4o-voice-model",
        originalUrl: "https://openai.com/news/gpt4o-voice-model",
        sourceSlug: "openai-news",
        sourceScore: 94,
        trendScore: 82,
      },
    ]);

    expect(deduped.map((item) => item.id)).toEqual([
      "official-gpt5-launch",
      "openai-voice-model",
    ]);
  });

  test("keeps title-equivalent stories when URL slugs do not identify the title", () => {
    const deduped = dedupeNewsItems([
      {
        ...items[0],
        id: "first-follow-up",
        title: "OpenAI model lead",
        canonicalUrl: "https://example.com/same-source-follow-up",
        originalUrl: "https://example.com/same-source-follow-up",
        sourceScore: 82,
        trendScore: 84,
      },
      {
        ...items[0],
        id: "second-analysis",
        title: "OpenAI model lead",
        canonicalUrl: "https://example.com/same-entity-analysis",
        originalUrl: "https://example.com/same-entity-analysis",
        sourceScore: 88,
        trendScore: 82,
      },
    ]);

    expect(deduped.map((item) => item.id)).toEqual([
      "first-follow-up",
      "second-analysis",
    ]);
  });
});

describe("selectDiverseNewsFeed", () => {
  test("interleaves strong stories from different sources and categories", () => {
    const ranked = [
      {
        ...items[0],
        id: "openai-model-1",
        category: "model_release",
        sourceSlug: "openai-news",
        personalizedScore: 160,
        matchedSignals: ["category"],
      },
      {
        ...items[0],
        id: "openai-model-2",
        category: "model_release",
        sourceSlug: "openai-news",
        personalizedScore: 155,
        matchedSignals: ["category"],
      },
      {
        ...items[0],
        id: "anthropic-agent",
        category: "agent_product",
        sourceSlug: "anthropic-news",
        personalizedScore: 132,
        matchedSignals: ["category"],
      },
      {
        ...items[1],
        id: "venture-funding",
        category: "funding",
        sourceSlug: "venturewire",
        personalizedScore: 120,
        matchedSignals: [],
      },
    ];

    expect(
      selectDiverseNewsFeed(ranked, { limit: 4 }).map((item) => item.id),
    ).toEqual([
      "openai-model-1",
      "anthropic-agent",
      "venture-funding",
      "openai-model-2",
    ]);
  });

  test("preserves score order when there are no alternate sources or categories", () => {
    const ranked = [
      {
        ...items[0],
        id: "openai-model-1",
        personalizedScore: 160,
        matchedSignals: ["category"],
      },
      {
        ...items[0],
        id: "openai-model-2",
        personalizedScore: 155,
        matchedSignals: ["category"],
      },
    ];

    expect(
      selectDiverseNewsFeed(ranked, { limit: 2 }).map((item) => item.id),
    ).toEqual(["openai-model-1", "openai-model-2"]);
  });

  test("reserves periodic exploration slots for high-trend unmatched stories", () => {
    const ranked = [
      {
        ...items[0],
        id: "preferred-model",
        category: "model_release",
        sourceSlug: "openai-news",
        trendScore: 70,
        personalizedScore: 190,
        matchedSignals: ["category"],
      },
      {
        ...items[0],
        id: "preferred-agent",
        category: "agent_product",
        sourceSlug: "agentwire",
        trendScore: 72,
        personalizedScore: 180,
        matchedSignals: ["category"],
      },
      {
        ...items[0],
        id: "preferred-research",
        category: "research",
        sourceSlug: "lab-notes",
        trendScore: 74,
        personalizedScore: 170,
        matchedSignals: ["entity"],
      },
      {
        ...items[1],
        id: "hot-outside-profile",
        category: "policy",
        sourceSlug: "policywire",
        trendScore: 99,
        personalizedScore: 120,
        matchedSignals: [],
      },
      {
        ...items[0],
        id: "preferred-oss",
        category: "open_source",
        sourceSlug: "oss-desk",
        trendScore: 68,
        personalizedScore: 160,
        matchedSignals: ["source"],
      },
    ];

    const feed = selectDiverseNewsFeed(ranked, {
      explorationInterval: 3,
      limit: 5,
    });

    expect(feed.map((item) => item.id)).toEqual([
      "preferred-model",
      "preferred-agent",
      "hot-outside-profile",
      "preferred-research",
      "preferred-oss",
    ]);
    expect(feed[2]?.matchedSignals).toContain("exploration");
  });

  test("avoids immediate source and topic fatigue when alternate ranked stories are available", () => {
    const ranked = [
      {
        ...items[0],
        id: "openai-model-lead",
        category: "model_release",
        sourceSlug: "openai-news",
        personalizedScore: 210,
        matchedSignals: ["category", "source"],
      },
      {
        ...items[0],
        id: "anthropic-agent-lead",
        category: "agent_product",
        sourceSlug: "anthropic-news",
        personalizedScore: 190,
        matchedSignals: ["category"],
      },
      {
        ...items[1],
        id: "venture-funding-lead",
        category: "funding",
        sourceSlug: "venturewire",
        personalizedScore: 180,
        matchedSignals: ["category"],
      },
      {
        ...items[0],
        id: "openai-model-follow-up",
        category: "model_release",
        sourceSlug: "openai-news",
        personalizedScore: 170,
        matchedSignals: ["category", "source"],
      },
      {
        ...items[0],
        id: "openai-model-third",
        category: "model_release",
        sourceSlug: "openai-news",
        personalizedScore: 165,
        matchedSignals: ["category", "source"],
      },
      {
        ...items[0],
        id: "anthropic-agent-follow-up",
        category: "agent_product",
        sourceSlug: "anthropic-news",
        personalizedScore: 150,
        matchedSignals: ["category"],
      },
    ];

    expect(
      selectDiverseNewsFeed(ranked, { limit: 6 }).map((item) => item.id),
    ).toEqual([
      "openai-model-lead",
      "anthropic-agent-lead",
      "venture-funding-lead",
      "openai-model-follow-up",
      "anthropic-agent-follow-up",
      "openai-model-third",
    ]);
  });
});

describe("selectDiscoverySlotNewsFeed", () => {
  test("inserts a high-quality unmatched story into an over-personalized top feed", () => {
    const ranked = [
      {
        ...items[0],
        id: "matched-model-lead",
        sourceSlug: "openai-news",
        personalizedScore: 220,
        matchedSignals: ["category", "source"],
      },
      {
        ...items[1],
        id: "matched-funding-lead",
        sourceSlug: "venturewire",
        personalizedScore: 210,
        matchedSignals: ["category", "entity"],
      },
      {
        ...items[0],
        id: "matched-agent-lead",
        category: "agent_product",
        sourceSlug: "agent-desk",
        personalizedScore: 200,
        matchedSignals: ["category"],
      },
      {
        ...items[0],
        id: "matched-research-lead",
        category: "research",
        sourceSlug: "research-lab",
        personalizedScore: 190,
        matchedSignals: ["category"],
      },
      {
        ...items[0],
        id: "matched-market-map-lead",
        category: "market_map",
        sourceSlug: "market-map",
        personalizedScore: 180,
        matchedSignals: ["category"],
      },
      {
        ...items[1],
        id: "qualified-discovery-story",
        category: "open_source",
        sourceScore: 86,
        sourceSlug: "oss-radar",
        trendScore: 78,
        personalizedScore: 120,
        matchedSignals: [],
      },
    ];

    const feed = selectDiscoverySlotNewsFeed(ranked);

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

  test("keeps order when the top feed already has a discovery slot", () => {
    const ranked = [
      {
        ...items[0],
        id: "matched-model-lead",
        personalizedScore: 220,
        matchedSignals: ["category"],
      },
      {
        ...items[1],
        id: "existing-discovery",
        category: "open_source",
        sourceScore: 86,
        sourceSlug: "oss-radar",
        trendScore: 78,
        personalizedScore: 120,
        matchedSignals: ["discovery_slot"],
      },
      {
        ...items[1],
        id: "later-unmatched-story",
        category: "research",
        sourceScore: 88,
        sourceSlug: "research-lab",
        trendScore: 76,
        personalizedScore: 110,
        matchedSignals: [],
      },
    ];

    expect(selectDiscoverySlotNewsFeed(ranked).map((item) => item.id)).toEqual([
      "matched-model-lead",
      "existing-discovery",
      "later-unmatched-story",
    ]);
  });

  test("upgrades a qualified exploration story into the discovery slot", () => {
    const ranked = [
      {
        ...items[0],
        id: "matched-model-lead",
        sourceSlug: "openai-news",
        personalizedScore: 220,
        matchedSignals: ["category", "source"],
      },
      {
        ...items[1],
        id: "matched-funding-lead",
        sourceSlug: "venturewire",
        personalizedScore: 210,
        matchedSignals: ["category", "entity"],
      },
      {
        ...items[0],
        id: "matched-agent-lead",
        category: "agent_product",
        sourceSlug: "agent-desk",
        personalizedScore: 200,
        matchedSignals: ["category"],
      },
      {
        ...items[0],
        id: "matched-research-lead",
        category: "research",
        sourceSlug: "research-lab",
        personalizedScore: 190,
        matchedSignals: ["category"],
      },
      {
        ...items[0],
        id: "matched-market-map-lead",
        category: "market_map",
        sourceSlug: "market-map",
        personalizedScore: 180,
        matchedSignals: ["category"],
      },
      {
        ...items[1],
        id: "qualified-exploration-story",
        category: "open_source",
        sourceScore: 86,
        sourceSlug: "oss-radar",
        trendScore: 78,
        personalizedScore: 120,
        matchedSignals: ["exploration"],
      },
    ];

    const feed = selectDiscoverySlotNewsFeed(ranked);

    expect(feed.map((item) => item.id)).toEqual([
      "matched-model-lead",
      "matched-funding-lead",
      "matched-agent-lead",
      "qualified-exploration-story",
      "matched-research-lead",
      "matched-market-map-lead",
    ]);
    expect(feed[3]?.matchedSignals).toEqual(["exploration", "discovery_slot"]);
  });
});

describe("selectSourceTrustBalancedNewsFeed", () => {
  test("moves low-trust high-heat stories behind trusted alternatives", () => {
    const ranked = [
      {
        ...items[0],
        id: "viral-low-trust-claim",
        sourceScore: 45,
        trendScore: 99,
        personalizedScore: 190,
        matchedSignals: [],
      },
      {
        ...items[1],
        id: "trusted-funding-follow-up",
        sourceScore: 84,
        trendScore: 82,
        personalizedScore: 150,
        matchedSignals: ["category"],
      },
      {
        ...items[0],
        id: "trusted-model-analysis",
        sourceScore: 90,
        trendScore: 70,
        personalizedScore: 140,
        matchedSignals: ["source"],
      },
    ];

    expect(
      selectSourceTrustBalancedNewsFeed(ranked).map((item) => item.id),
    ).toEqual([
      "trusted-funding-follow-up",
      "trusted-model-analysis",
      "viral-low-trust-claim",
    ]);
  });

  test("preserves ranked order when every remaining story needs source review", () => {
    const ranked = [
      {
        ...items[0],
        id: "first-low-trust-claim",
        sourceScore: 45,
        trendScore: 99,
        personalizedScore: 190,
        matchedSignals: [],
      },
      {
        ...items[1],
        id: "second-low-trust-claim",
        sourceScore: 50,
        trendScore: 90,
        personalizedScore: 150,
        matchedSignals: [],
      },
    ];

    expect(
      selectSourceTrustBalancedNewsFeed(ranked).map((item) => item.id),
    ).toEqual(["first-low-trust-claim", "second-low-trust-claim"]);
  });
});

describe("buildNewsSemanticSimilarityMatches", () => {
  test("connects embedded candidates to recent positive feedback vectors", () => {
    const matches = buildNewsSemanticSimilarityMatches({
      candidateVectors: [
        {
          newsItemId: "agent-runtime-analysis",
          embedding: [0.96, 0.2, 0],
        },
        {
          newsItemId: "funding-market-map",
          embedding: [0, 1, 0],
        },
      ],
      feedbackVectors: [
        {
          newsItemId: "saved-agent-runtime",
          embedding: [1, 0, 0],
          occurredAt: "2026-07-01T08:00:00.000Z",
          strength: 3,
        },
      ],
      minSimilarity: 0.9,
      now: new Date("2026-07-01T10:00:00.000Z"),
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      newsItemId: "agent-runtime-analysis",
      strength: 3,
    });
    expect(matches[0]?.similarity).toBeCloseTo(0.98, 2);
  });

  test("ignores stale feedback vectors and incompatible dimensions", () => {
    expect(
      buildNewsSemanticSimilarityMatches({
        candidateVectors: [
          {
            newsItemId: "agent-runtime-analysis",
            embedding: [1, 0, 0],
          },
          {
            newsItemId: "dimension-mismatch",
            embedding: [1, 0],
          },
        ],
        feedbackVectors: [
          {
            newsItemId: "old-agent-runtime",
            embedding: [1, 0, 0],
            occurredAt: "2026-06-01T08:00:00.000Z",
          },
          {
            newsItemId: "saved-short-vector",
            embedding: [0, 1, 0],
            occurredAt: "2026-07-01T08:00:00.000Z",
          },
        ],
        maxAgeHours: 24,
        minSimilarity: 0.9,
        now: new Date("2026-07-01T10:00:00.000Z"),
      }),
    ).toEqual([]);
  });
});

describe("selectSemanticSimilarityNewsFeed", () => {
  test("lifts embedded stories similar to positive feedback without hiding the signal", () => {
    const ranked = [
      {
        ...items[1],
        id: "generic-fresh-funding",
        personalizedScore: 112,
        matchedSignals: [],
      },
      {
        ...items[0],
        id: "agent-runtime-analysis",
        category: "research",
        entities: ["Agents"],
        sourceSlug: "research-lab",
        personalizedScore: 106,
        matchedSignals: [],
      },
    ];

    const feed = selectSemanticSimilarityNewsFeed(ranked, [
      {
        newsItemId: "agent-runtime-analysis",
        similarity: 0.98,
        strength: 3,
      },
    ]);

    expect(feed.map((item) => item.id)).toEqual([
      "agent-runtime-analysis",
      "generic-fresh-funding",
    ]);
    expect(feed[0]?.matchedSignals).toContain("semantic_feedback");
    expect(feed[0]?.personalizedScore).toBeGreaterThan(112);
  });
});

describe("selectCollaborativeSignalNewsFeed", () => {
  test("lifts high-trust weakly personalized stories from aggregate reader signals", () => {
    const ranked = [
      {
        ...items[0],
        id: "direct-reader-match",
        personalizedScore: 130,
        matchedSignals: ["category"],
      },
      {
        ...items[1],
        id: "generic-funding-story",
        personalizedScore: 124,
        matchedSignals: [],
      },
      {
        ...items[0],
        id: "similar-reader-hit",
        category: "research",
        entities: ["Benchmarks"],
        sourceScore: 86,
        sourceSlug: "research-lab",
        personalizedScore: 118,
        matchedSignals: [],
      },
    ];

    const feed = selectCollaborativeSignalNewsFeed(ranked, [
      {
        newsItemId: "similar-reader-hit",
        score: 6,
      },
    ]);

    expect(feed.map((item) => item.id)).toEqual([
      "direct-reader-match",
      "similar-reader-hit",
      "generic-funding-story",
    ]);
    expect(feed[0]?.matchedSignals).not.toContain("collaborative_feedback");
    expect(feed[1]?.matchedSignals).toContain("collaborative_feedback");
  });

  test("keeps collaborative lifts behind explicit reader matches", () => {
    const ranked = [
      {
        ...items[0],
        id: "direct-reader-match",
        personalizedScore: 125,
        matchedSignals: ["category"],
      },
      {
        ...items[1],
        id: "crowd-backed-story",
        sourceScore: 88,
        personalizedScore: 124,
        matchedSignals: [],
      },
      {
        ...items[1],
        id: "generic-story",
        sourceScore: 84,
        personalizedScore: 110,
        matchedSignals: [],
      },
    ];

    const feed = selectCollaborativeSignalNewsFeed(ranked, [
      {
        newsItemId: "crowd-backed-story",
        score: 10,
      },
    ]);

    expect(feed.map((item) => item.id)).toEqual([
      "direct-reader-match",
      "crowd-backed-story",
      "generic-story",
    ]);
    expect(feed[0]?.matchedSignals).not.toContain("collaborative_feedback");
    expect(feed[1]?.matchedSignals).toContain("collaborative_feedback");
  });

  test("keeps low-trust or already personalized stories out of collaborative lift", () => {
    const ranked = [
      {
        ...items[0],
        id: "personal-story",
        personalizedScore: 120,
        matchedSignals: ["entity"],
      },
      {
        ...items[1],
        id: "low-trust-crowd-hit",
        sourceScore: 55,
        personalizedScore: 118,
        matchedSignals: [],
      },
      {
        ...items[1],
        id: "trusted-generic-story",
        sourceScore: 84,
        personalizedScore: 116,
        matchedSignals: [],
      },
    ];

    const feed = selectCollaborativeSignalNewsFeed(ranked, [
      { newsItemId: "personal-story", score: 8 },
      { newsItemId: "low-trust-crowd-hit", score: 8 },
    ]);

    expect(feed.map((item) => item.id)).toEqual([
      "personal-story",
      "low-trust-crowd-hit",
      "trusted-generic-story",
    ]);
    expect(feed[0]?.matchedSignals).not.toContain("collaborative_feedback");
    expect(feed[1]?.matchedSignals).not.toContain("collaborative_feedback");
  });

  test("keeps exposure-cooldown guardrails out of collaborative lift", () => {
    const ranked = [
      {
        ...items[1],
        id: "fresh-unseen-story",
        sourceScore: 84,
        personalizedScore: 110,
        matchedSignals: [],
      },
      {
        ...items[0],
        id: "home-repeat-story",
        sourceScore: 90,
        personalizedScore: 100,
        matchedSignals: ["home_exposure_cooldown"],
      },
      {
        ...items[0],
        id: "recently-read-topic",
        sourceScore: 90,
        personalizedScore: 98,
        matchedSignals: ["exposure_cooldown"],
      },
    ];

    const feed = selectCollaborativeSignalNewsFeed(ranked, [
      { newsItemId: "home-repeat-story", score: 8 },
      { newsItemId: "recently-read-topic", score: 8 },
    ]);

    expect(feed.map((item) => item.id)).toEqual([
      "fresh-unseen-story",
      "home-repeat-story",
      "recently-read-topic",
    ]);
    expect(feed[1]?.matchedSignals).not.toContain("collaborative_feedback");
    expect(feed[2]?.matchedSignals).not.toContain("collaborative_feedback");
  });
});

describe("selectDaypartBalancedNewsFeed", () => {
  test("lifts trusted morning-briefing stories ahead of generic close-score stories", () => {
    const feed = selectDaypartBalancedNewsFeed(
      [
        {
          ...items[1],
          id: "generic-funding-story",
          category: "funding",
          sourceScore: 82,
          trendScore: 88,
          personalizedScore: 150,
          matchedSignals: [],
        },
        {
          ...items[0],
          id: "security-briefing",
          category: "security",
          sourceScore: 90,
          trendScore: 82,
          personalizedScore: 146,
          matchedSignals: [],
        },
      ],
      new Date("2026-07-01T06:00:00.000Z"),
    );

    expect(feed.map((item) => item.id)).toEqual([
      "security-briefing",
      "generic-funding-story",
    ]);
    expect(feed[0]?.matchedSignals).toContain("daypart");
  });

  test("keeps explicit reader matches ahead of daypart-only stories", () => {
    const feed = selectDaypartBalancedNewsFeed(
      [
        {
          ...items[0],
          id: "reader-matched-model",
          personalizedScore: 150,
          matchedSignals: ["category"],
        },
        {
          ...items[0],
          id: "security-briefing",
          category: "security",
          sourceScore: 90,
          trendScore: 82,
          personalizedScore: 146,
          matchedSignals: [],
        },
      ],
      new Date("2026-07-01T06:00:00.000Z"),
    );

    expect(feed.map((item) => item.id)).toEqual([
      "reader-matched-model",
      "security-briefing",
    ]);
    expect(feed[1]?.matchedSignals).toContain("daypart");
  });

  test("uses the reader local hour when it differs from server time", () => {
    const feed = selectDaypartBalancedNewsFeed(
      [
        {
          ...items[0],
          id: "morning-security-briefing",
          category: "security",
          sourceScore: 90,
          trendScore: 82,
          personalizedScore: 150,
          matchedSignals: [],
        },
        {
          ...items[1],
          id: "evening-market-map",
          category: "market_map",
          sourceScore: 88,
          trendScore: 82,
          personalizedScore: 146,
          matchedSignals: [],
        },
      ],
      {
        now: new Date("2026-07-01T06:00:00.000Z"),
        readerLocalHour: 20,
      },
    );

    expect(feed.map((item) => item.id)).toEqual([
      "evening-market-map",
      "morning-security-briefing",
    ]);
    expect(feed[0]?.matchedSignals).toContain("daypart");
  });
});

describe("selectSessionIntentNewsFeed", () => {
  test("lifts stories matching the current search and topic intent", () => {
    const feed = selectSessionIntentNewsFeed(
      [
        {
          ...items[0],
          id: "high-profile-model",
          category: "model_release",
          entities: ["OpenAI"],
          matchedSignals: ["category"],
          personalizedScore: 132,
          tags: ["model"],
          title: "OpenAI ships a model refresh",
        },
        {
          ...items[1],
          id: "session-agent-match",
          category: "agent_product",
          entities: ["LangChain"],
          matchedSignals: [],
          personalizedScore: 120,
          tags: ["agents"],
          title: "LangChain agent runtime adds workflow memory",
        },
      ],
      {
        category: "agent_product",
        query: "LangChain agents",
        sourceSlug: null,
      },
    );

    expect(feed.map((item) => item.id)).toEqual([
      "session-agent-match",
      "high-profile-model",
    ]);
    expect(feed[0]?.matchedSignals).toContain("session_intent");
    expect(feed[0]?.personalizedScore).toBeGreaterThan(132);
  });

  test("does not boost blocked stories for the current session intent", () => {
    const feed = selectSessionIntentNewsFeed(
      [
        {
          ...items[0],
          id: "safe-model-story",
          matchedSignals: [],
          personalizedScore: 126,
          title: "OpenAI ships a model refresh",
        },
        {
          ...items[1],
          id: "blocked-agent-story",
          category: "agent_product",
          entities: ["LangChain"],
          matchedSignals: ["negative_feedback"],
          personalizedScore: 120,
          tags: ["agents"],
          title: "LangChain agent runtime adds workflow memory",
        },
      ],
      {
        category: "agent_product",
        query: "LangChain agents",
        sourceSlug: null,
      },
    );

    expect(feed.map((item) => item.id)).toEqual([
      "safe-model-story",
      "blocked-agent-story",
    ]);
    expect(feed[1]?.matchedSignals).not.toContain("session_intent");
  });

  test("does not apply the session intent boost twice to server-ranked stories", () => {
    const feed = selectSessionIntentNewsFeed(
      [
        {
          ...items[1],
          id: "server-ranked-agent-story",
          category: "agent_product",
          entities: ["LangChain"],
          matchedSignals: ["session_intent"],
          personalizedScore: 134,
          tags: ["agents"],
          title: "LangChain agent runtime adds workflow memory",
        },
        {
          ...items[0],
          id: "high-profile-model",
          matchedSignals: [],
          personalizedScore: 132,
          tags: ["model"],
          title: "OpenAI ships a model refresh",
        },
      ],
      {
        category: "agent_product",
        query: "LangChain agents",
        sourceSlug: null,
      },
    );

    expect(feed.map((item) => item.id)).toEqual([
      "server-ranked-agent-story",
      "high-profile-model",
    ]);
    expect(feed[0]?.personalizedScore).toBe(134);
  });

  test("matches session search terms from optional summaries and source names", () => {
    const feed = selectSessionIntentNewsFeed(
      [
        {
          ...items[0],
          id: "title-only-model-story",
          matchedSignals: [],
          personalizedScore: 132,
          tags: ["model"],
          title: "OpenAI ships a model refresh",
        },
        {
          ...items[1],
          id: "summary-source-match",
          matchedSignals: [],
          personalizedScore: 124,
          sourceName: "AgentOps Daily",
          summary: "LangChain adds workflow memory for production agents.",
          tags: ["runtime"],
          title: "Runtime notes from the field",
        },
      ],
      {
        category: null,
        query: "LangChain AgentOps",
        sourceSlug: null,
      },
    );

    expect(feed.map((item) => item.id)).toEqual([
      "summary-source-match",
      "title-only-model-story",
    ]);
    expect(feed[0]?.matchedSignals).toContain("session_intent");
  });
});

describe("selectSourceCorroboratedNewsFeed", () => {
  test("lifts trusted stories covered by multiple independent sources", () => {
    const feed = selectSourceCorroboratedNewsFeed([
      {
        ...items[0],
        id: "single-source-high-score",
        category: "model_release",
        entities: ["Anthropic"],
        matchedSignals: [],
        personalizedScore: 132,
        sourceSlug: "single-lab",
        tags: ["model"],
      },
      {
        ...items[0],
        id: "corroborated-openai-story",
        category: "model_release",
        entities: ["OpenAI"],
        matchedSignals: [],
        personalizedScore: 124,
        sourceScore: 90,
        sourceSlug: "openai-news",
        tags: ["frontier-model"],
      },
      {
        ...items[1],
        id: "openai-analysis-follow-up",
        category: "model_release",
        entities: ["OpenAI"],
        matchedSignals: [],
        personalizedScore: 116,
        sourceScore: 84,
        sourceSlug: "agent-desk",
        tags: ["frontier-model"],
      },
    ]);

    expect(feed.map((item) => item.id)).toEqual([
      "corroborated-openai-story",
      "single-source-high-score",
      "openai-analysis-follow-up",
    ]);
    expect(feed[0]?.matchedSignals).toContain("source_corroboration");
  });

  test("does not treat repeated coverage from the same source as corroboration", () => {
    const feed = selectSourceCorroboratedNewsFeed([
      {
        ...items[0],
        id: "first-openai-wire",
        category: "model_release",
        entities: ["OpenAI"],
        matchedSignals: [],
        personalizedScore: 132,
        sourceSlug: "openai-news",
        tags: ["frontier-model"],
      },
      {
        ...items[1],
        id: "second-openai-wire",
        category: "model_release",
        entities: ["OpenAI"],
        matchedSignals: [],
        personalizedScore: 124,
        sourceSlug: "openai-news",
        tags: ["frontier-model"],
      },
    ]);

    expect(feed.map((item) => item.id)).toEqual([
      "first-openai-wire",
      "second-openai-wire",
    ]);
    expect(feed[0]?.matchedSignals).not.toContain("source_corroboration");
    expect(feed[1]?.matchedSignals).not.toContain("source_corroboration");
  });
});

describe("selectPositiveFeedbackAnchoredNewsFeed", () => {
  test("anchors source-click feedback by source without boosting topic or entity matches", () => {
    const ranked = [
      {
        ...items[1],
        id: "same-topic-only",
        category: "model_release",
        entities: ["Anthropic"],
        sourceSlug: "lab-notes",
        personalizedScore: 190,
        matchedSignals: [],
      },
      {
        ...items[0],
        id: "same-source-follow-up",
        category: "agent_product",
        entities: ["Agents"],
        sourceSlug: "openai-news",
        personalizedScore: 120,
        matchedSignals: ["source"],
      },
      {
        ...items[1],
        id: "same-entity-only",
        category: "funding",
        entities: ["OpenAI"],
        sourceSlug: "venturewire",
        personalizedScore: 180,
        matchedSignals: [],
      },
    ];

    const feed = selectPositiveFeedbackAnchoredNewsFeed(ranked, [
      {
        action: "click_source",
        category: "model_release",
        entities: ["OpenAI"],
        sourceSlug: "openai-news",
      },
    ]);

    expect(feed.map((item) => item.id)).toEqual([
      "same-source-follow-up",
      "same-topic-only",
      "same-entity-only",
    ]);
    expect(feed[0]?.matchedSignals).toContain("positive_feedback");
    expect(feed[1]?.matchedSignals).not.toContain("positive_feedback");
    expect(feed[2]?.matchedSignals).not.toContain("positive_feedback");
  });

  test("ignores stale source-click feedback outside the weak signal window", () => {
    const ranked = [
      {
        ...items[1],
        id: "unrelated-story",
        category: "funding",
        entities: ["Series A"],
        sourceSlug: "venturewire",
        personalizedScore: 190,
        matchedSignals: [],
      },
      {
        ...items[0],
        id: "stale-source-click-follow-up",
        category: "agent_product",
        entities: ["Agents"],
        sourceSlug: "openai-news",
        personalizedScore: 120,
        matchedSignals: ["source"],
      },
    ];

    const feed = selectPositiveFeedbackAnchoredNewsFeed(
      ranked,
      [
        {
          action: "click_source",
          category: "model_release",
          entities: ["OpenAI"],
          occurredAt: "2026-06-01T09:00:00.000Z",
          sourceSlug: "openai-news",
        },
      ],
      new Date("2026-07-01T09:00:00.000Z"),
    );

    expect(feed.map((item) => item.id)).toEqual([
      "unrelated-story",
      "stale-source-click-follow-up",
    ]);
    expect(feed[1]?.matchedSignals).not.toContain("positive_feedback");
  });

  test("orders saved or shared matches before weaker source-click matches", () => {
    const ranked = [
      {
        ...items[0],
        id: "source-click-follow-up",
        category: "agent_product",
        entities: ["Agents"],
        sourceSlug: "openai-news",
        personalizedScore: 190,
        matchedSignals: ["source"],
      },
      {
        ...items[1],
        id: "shared-topic-follow-up",
        category: "funding",
        entities: ["Series A"],
        sourceSlug: "venturewire",
        personalizedScore: 120,
        matchedSignals: ["category"],
      },
      {
        ...items[1],
        id: "unrelated-story",
        category: "research",
        entities: ["Benchmarks"],
        sourceSlug: "research-lab",
        personalizedScore: 160,
        matchedSignals: [],
      },
    ];

    const feed = selectPositiveFeedbackAnchoredNewsFeed(ranked, [
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
    ]);

    expect(feed.map((item) => item.id)).toEqual([
      "shared-topic-follow-up",
      "source-click-follow-up",
      "unrelated-story",
    ]);
    expect(feed[0]?.matchedSignals).toContain("positive_feedback");
    expect(feed[1]?.matchedSignals).toContain("positive_feedback");
  });

  test("orders newer positive feedback matches before older same-strength matches", () => {
    const ranked = [
      {
        ...items[0],
        id: "old-share-follow-up",
        category: "model_release",
        entities: ["OpenAI"],
        sourceSlug: "openai-news",
        personalizedScore: 190,
        matchedSignals: ["category"],
      },
      {
        ...items[1],
        id: "recent-share-follow-up",
        category: "funding",
        entities: ["Series A"],
        sourceSlug: "venturewire",
        personalizedScore: 120,
        matchedSignals: ["category"],
      },
      {
        ...items[1],
        id: "unrelated-story",
        category: "research",
        entities: ["Benchmarks"],
        sourceSlug: "research-lab",
        personalizedScore: 160,
        matchedSignals: [],
      },
    ];

    const feed = selectPositiveFeedbackAnchoredNewsFeed(ranked, [
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
    ]);

    expect(feed.map((item) => item.id)).toEqual([
      "recent-share-follow-up",
      "old-share-follow-up",
      "unrelated-story",
    ]);
    expect(feed[0]?.matchedSignals).toContain("positive_feedback");
    expect(feed[1]?.matchedSignals).toContain("positive_feedback");
  });

  test("diversifies same-strength positive feedback anchors before repeating a source and topic", () => {
    const ranked = [
      {
        ...items[0],
        id: "openai-agent-follow-up",
        category: "agent_product",
        entities: ["Agents"],
        sourceSlug: "openai-news",
        personalizedScore: 190,
        matchedSignals: ["source"],
      },
      {
        ...items[0],
        id: "openai-agent-analysis",
        category: "agent_product",
        entities: ["Agents"],
        sourceSlug: "openai-news",
        personalizedScore: 180,
        matchedSignals: ["source"],
      },
      {
        ...items[1],
        id: "venture-funding-follow-up",
        category: "funding",
        entities: ["Series A"],
        sourceSlug: "venturewire",
        personalizedScore: 170,
        matchedSignals: ["category"],
      },
      {
        ...items[1],
        id: "unrelated-story",
        category: "research",
        entities: ["Benchmarks"],
        sourceSlug: "research-lab",
        personalizedScore: 160,
        matchedSignals: [],
      },
    ];

    const feed = selectPositiveFeedbackAnchoredNewsFeed(
      ranked,
      [
        {
          action: "share",
          category: "agent_product",
          entities: ["Agents"],
          occurredAt: "2026-07-01T09:00:00.000Z",
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
      new Date("2026-07-01T10:00:00.000Z"),
    );

    expect(feed.map((item) => item.id)).toEqual([
      "openai-agent-follow-up",
      "venture-funding-follow-up",
      "openai-agent-analysis",
      "unrelated-story",
    ]);
    expect(
      feed
        .slice(0, 3)
        .every((item) => item.matchedSignals.includes("positive_feedback")),
    ).toBe(true);
  });

  test("anchors stories matching saved or shared feedback before unrelated items", () => {
    const ranked = [
      {
        ...items[1],
        id: "unrelated-high-trend-funding",
        sourceSlug: "venturewire",
        personalizedScore: 190,
        matchedSignals: [],
      },
      {
        ...items[0],
        id: "saved-source-follow-up",
        sourceSlug: "openai-news",
        personalizedScore: 150,
        matchedSignals: ["source"],
      },
      {
        ...items[0],
        id: "saved-entity-follow-up",
        entities: ["OpenAI", "Agents"],
        sourceSlug: "agent-desk",
        personalizedScore: 140,
        matchedSignals: ["entity"],
      },
    ];

    const feed = selectPositiveFeedbackAnchoredNewsFeed(ranked, [
      {
        category: "model_release",
        entities: ["OpenAI"],
        sourceSlug: "openai-news",
      },
    ]);

    expect(feed.map((item) => item.id)).toEqual([
      "saved-source-follow-up",
      "saved-entity-follow-up",
      "unrelated-high-trend-funding",
    ]);
    expect(feed[0]?.matchedSignals).toContain("positive_feedback");
  });

  test("anchors stories matching saved or shared feedback tags before unrelated items", () => {
    const ranked = [
      {
        ...items[1],
        id: "unrelated-market-story",
        category: "market_map",
        entities: ["AI market"],
        sourceSlug: "market-map",
        tags: ["enterprise"],
        personalizedScore: 190,
        matchedSignals: [],
      },
      {
        ...items[0],
        id: "saved-agent-angle",
        category: "research",
        entities: ["Benchmarks"],
        sourceSlug: "research-lab",
        tags: ["agents"],
        personalizedScore: 130,
        matchedSignals: ["tag"],
      },
    ];

    const feed = selectPositiveFeedbackAnchoredNewsFeed(ranked, [
      {
        action: "save",
        category: "model_release",
        entities: ["OpenAI"],
        sourceSlug: "openai-news",
        tags: ["agents"],
      },
    ]);

    expect(feed.map((item) => item.id)).toEqual([
      "saved-agent-angle",
      "unrelated-market-story",
    ]);
    expect(feed[0]?.matchedSignals).toContain("positive_feedback");
  });

  test("keeps ranked order when there are no positive feedback matches", () => {
    const ranked = [
      {
        ...items[1],
        id: "funding-story",
        sourceSlug: "venturewire",
        personalizedScore: 190,
        matchedSignals: [],
      },
      {
        ...items[0],
        id: "model-story",
        sourceSlug: "openai-news",
        personalizedScore: 150,
        matchedSignals: ["source"],
      },
    ];

    expect(
      selectPositiveFeedbackAnchoredNewsFeed(ranked, [
        {
          category: "agent_product",
          entities: ["Anthropic"],
          sourceSlug: "agent-desk",
        },
      ]).map((item) => item.id),
    ).toEqual(["funding-story", "model-story"]);
  });
});

describe("selectFatigueBalancedNewsFeed", () => {
  test("keeps adjacent positive feedback anchors ahead of fatigue alternates", () => {
    const ranked = [
      {
        ...items[0],
        id: "saved-agent-follow-up",
        category: "agent_product",
        entities: ["Agents"],
        sourceSlug: "agent-desk",
        personalizedScore: 180,
        matchedSignals: ["positive_feedback"],
      },
      {
        ...items[0],
        id: "saved-entity-analysis",
        category: "model_release",
        entities: ["OpenAI", "Agents"],
        sourceSlug: "openai-news",
        personalizedScore: 170,
        matchedSignals: ["positive_feedback"],
      },
      {
        ...items[1],
        id: "unrelated-market-angle",
        category: "funding",
        entities: ["Series A"],
        sourceSlug: "venturewire",
        personalizedScore: 160,
        matchedSignals: [],
      },
    ];

    expect(
      selectFatigueBalancedNewsFeed(ranked).map((item) => item.id),
    ).toEqual([
      "saved-agent-follow-up",
      "saved-entity-analysis",
      "unrelated-market-angle",
    ]);
  });

  test("inserts an available entity alternate before repeated lead-entity coverage", () => {
    const ranked = [
      {
        ...items[0],
        id: "openai-model-lead",
        entities: ["OpenAI", "Agents"],
        personalizedScore: 190,
        matchedSignals: ["category", "entity"],
      },
      {
        ...items[0],
        id: "openai-model-follow-up",
        category: "funding",
        sourceSlug: "venturewire",
        entities: ["OpenAI", "Benchmarks"],
        personalizedScore: 180,
        matchedSignals: ["category", "entity"],
      },
      {
        ...items[0],
        id: "anthropic-agent-angle",
        category: "agent_product",
        sourceSlug: "anthropic-news",
        entities: ["Anthropic", "Claude"],
        personalizedScore: 150,
        matchedSignals: ["exploration"],
      },
    ];

    expect(
      selectFatigueBalancedNewsFeed(ranked).map((item) => item.id),
    ).toEqual([
      "openai-model-lead",
      "anthropic-agent-angle",
      "openai-model-follow-up",
    ]);
  });

  test("inserts an available source and topic alternate before fatigue repeats", () => {
    const ranked = [
      {
        ...items[0],
        id: "openai-model-lead",
        category: "model_release",
        sourceSlug: "openai-news",
        personalizedScore: 180,
        matchedSignals: ["category"],
      },
      {
        ...items[1],
        id: "openai-funding-follow",
        category: "funding",
        sourceSlug: "openai-news",
        personalizedScore: 170,
        matchedSignals: ["source"],
      },
      {
        ...items[0],
        id: "anthropic-model-follow",
        category: "model_release",
        sourceSlug: "agent-desk",
        personalizedScore: 165,
        matchedSignals: ["category"],
      },
      {
        ...items[0],
        id: "agent-product-alternate",
        category: "agent_product",
        sourceSlug: "venturewire",
        personalizedScore: 120,
        matchedSignals: ["exploration"],
      },
    ];

    expect(
      selectFatigueBalancedNewsFeed(ranked).map((item) => item.id),
    ).toEqual([
      "openai-model-lead",
      "agent-product-alternate",
      "openai-funding-follow",
      "anthropic-model-follow",
    ]);
  });

  test("keeps ranked order when every remaining story would repeat fatigue", () => {
    const ranked = [
      {
        ...items[0],
        id: "first-source-story",
        personalizedScore: 160,
        matchedSignals: ["source"],
      },
      {
        ...items[0],
        id: "second-source-story",
        personalizedScore: 150,
        matchedSignals: ["source"],
      },
    ];

    expect(
      selectFatigueBalancedNewsFeed(ranked).map((item) => item.id),
    ).toEqual(["first-source-story", "second-source-story"]);
  });
});

describe("selectReaderFreshNewsFeed", () => {
  test("moves viewed stories behind unseen stories while preserving each group order", () => {
    const ranked = [
      {
        ...items[0],
        id: "already-read-model",
        personalizedScore: 180,
        matchedSignals: ["category"],
      },
      {
        ...items[1],
        id: "fresh-funding",
        personalizedScore: 160,
        matchedSignals: ["entity"],
      },
      {
        ...items[0],
        id: "already-read-agent",
        category: "agent_product",
        personalizedScore: 140,
        matchedSignals: ["source"],
      },
      {
        ...items[1],
        id: "fresh-policy",
        category: "policy",
        personalizedScore: 120,
        matchedSignals: [],
      },
    ];

    expect(
      selectReaderFreshNewsFeed(ranked, [
        "already-read-model",
        "already-read-agent",
      ]).map((item) => item.id),
    ).toEqual([
      "fresh-funding",
      "fresh-policy",
      "already-read-model",
      "already-read-agent",
    ]);
  });

  test("moves canonical or original URL variants of viewed stories behind unseen stories", () => {
    const ranked = [
      {
        ...items[0],
        id: "viewed-syndicated-model",
        canonicalUrl: "https://mirror.example/openai-model",
        originalUrl: "https://example.com/openai-model?utm=feed",
        personalizedScore: 180,
        matchedSignals: ["category"],
      },
      {
        ...items[1],
        id: "fresh-funding",
        canonicalUrl: "https://example.com/fresh-funding",
        originalUrl: "https://example.com/fresh-funding",
        personalizedScore: 160,
        matchedSignals: ["entity"],
      },
    ];

    expect(
      selectReaderFreshNewsFeed(
        ranked,
        ["viewed-model"],
        [
          {
            canonicalUrl: "https://example.com/openai-model",
            originalUrl: "https://example.com/openai-model",
          },
        ],
      ).map((item) => item.id),
    ).toEqual(["fresh-funding", "viewed-syndicated-model"]);
  });

  test("keeps ranked order when no viewed story ids match", () => {
    const ranked = [
      {
        ...items[0],
        id: "model-story",
        personalizedScore: 180,
        matchedSignals: ["category"],
      },
      {
        ...items[1],
        id: "funding-story",
        personalizedScore: 160,
        matchedSignals: ["entity"],
      },
    ];

    expect(
      selectReaderFreshNewsFeed(ranked, ["different-story"]).map(
        (item) => item.id,
      ),
    ).toEqual(["model-story", "funding-story"]);
  });
});

describe("selectExposureBalancedNewsFeed", () => {
  test("keeps home exposure from cooling adjacent topic and source follow-ups", () => {
    const ranked = [
      {
        ...items[0],
        id: "same-source-follow-up",
        sourceSlug: "openai-news",
        personalizedScore: 190,
        matchedSignals: ["source"],
      },
      {
        ...items[1],
        id: "fresh-market-angle",
        category: "funding",
        entities: ["Series A"],
        sourceSlug: "venturewire",
        personalizedScore: 150,
        matchedSignals: [],
      },
    ];
    const homeExposure = [
      {
        category: "model_release",
        entities: ["OpenAI"],
        sourceSlug: "openai-news",
        surface: "home" as const,
      },
    ];

    const feed = selectExposureBalancedNewsFeed(ranked, homeExposure);

    expect(feed.map((item) => item.id)).toEqual([
      "same-source-follow-up",
      "fresh-market-angle",
    ]);
    expect(feed[0]?.matchedSignals).not.toContain("exposure_cooldown");
  });

  test("moves repeated home exposure URLs behind fresh angles", () => {
    const ranked = [
      {
        ...items[0],
        id: "same-card-repeat",
        canonicalUrl: "https://example.com/openai-model",
        originalUrl: "https://example.com/openai-model?utm=feed",
        personalizedScore: 190,
        matchedSignals: ["source"],
      },
      {
        ...items[1],
        id: "fresh-market-angle",
        category: "funding",
        entities: ["Series A"],
        sourceSlug: "venturewire",
        personalizedScore: 150,
        matchedSignals: [],
      },
    ];
    const homeExposure = [
      {
        canonicalUrl: "https://example.com/openai-model",
        category: "research",
        entities: ["Benchmarks"],
        originalUrl: "https://example.com/openai-model",
        sourceSlug: "research-lab",
        surface: "home" as const,
        tags: ["evaluations"],
      },
    ];

    const feed = selectExposureBalancedNewsFeed(ranked, homeExposure);

    expect(feed.map((item) => item.id)).toEqual([
      "fresh-market-angle",
      "same-card-repeat",
    ]);
    expect(feed[1]?.matchedSignals).toContain("home_exposure_cooldown");
    expect(feed[1]?.matchedSignals).not.toContain("exposure_cooldown");
  });

  test("keeps shallow article opens from cooling adjacent topic and source follow-ups", () => {
    const ranked = [
      {
        ...items[0],
        id: "same-source-follow-up",
        sourceSlug: "openai-news",
        personalizedScore: 190,
        matchedSignals: ["source"],
      },
      {
        ...items[1],
        id: "fresh-market-angle",
        category: "funding",
        entities: ["Series A"],
        sourceSlug: "venturewire",
        personalizedScore: 150,
        matchedSignals: [],
      },
    ];

    const feed = selectExposureBalancedNewsFeed(ranked, [
      {
        category: "model_release",
        entities: ["OpenAI"],
        readPercent: 0.2,
        sourceSlug: "openai-news",
        surface: "article",
      },
    ]);

    expect(feed.map((item) => item.id)).toEqual([
      "same-source-follow-up",
      "fresh-market-angle",
    ]);
    expect(feed[0]?.matchedSignals).not.toContain("exposure_cooldown");
  });

  test("moves candidates matching recent reading exposure behind fresh angles", () => {
    const ranked = [
      {
        ...items[0],
        id: "same-source-follow-up",
        sourceSlug: "openai-news",
        personalizedScore: 190,
        matchedSignals: ["source"],
      },
      {
        ...items[0],
        id: "same-entity-analysis",
        entities: ["OpenAI", "Agents"],
        sourceSlug: "agent-desk",
        personalizedScore: 170,
        matchedSignals: ["entity"],
      },
      {
        ...items[1],
        id: "fresh-market-angle",
        category: "funding",
        entities: ["Series A"],
        sourceSlug: "venturewire",
        personalizedScore: 140,
        matchedSignals: [],
      },
    ];

    const feed = selectExposureBalancedNewsFeed(ranked, [
      {
        category: "model_release",
        entities: ["OpenAI"],
        sourceSlug: "openai-news",
      },
    ]);

    expect(feed.map((item) => item.id)).toEqual([
      "fresh-market-angle",
      "same-source-follow-up",
      "same-entity-analysis",
    ]);
    expect(feed[1]?.matchedSignals).toContain("exposure_cooldown");
  });

  test("moves candidates sharing recent exposure tags behind fresh angles", () => {
    const ranked = [
      {
        ...items[0],
        id: "same-agent-angle",
        category: "research",
        entities: ["Benchmarks"],
        sourceSlug: "research-lab",
        tags: ["agents"],
        personalizedScore: 190,
        matchedSignals: ["tag"],
      },
      {
        ...items[1],
        id: "fresh-market-angle",
        category: "market_map",
        entities: ["AI market"],
        sourceSlug: "market-map",
        tags: ["enterprise"],
        personalizedScore: 140,
        matchedSignals: [],
      },
    ];

    const feed = selectExposureBalancedNewsFeed(ranked, [
      {
        category: "model_release",
        entities: ["OpenAI"],
        sourceSlug: "openai-news",
        tags: ["agents"],
      },
    ]);

    expect(feed.map((item) => item.id)).toEqual([
      "fresh-market-angle",
      "same-agent-angle",
    ]);
    expect(feed[1]?.matchedSignals).toContain("exposure_cooldown");
  });

  test("keeps ranked order when every candidate matches recent exposure", () => {
    const ranked = [
      {
        ...items[0],
        id: "first-model-follow-up",
        personalizedScore: 190,
        matchedSignals: ["category"],
      },
      {
        ...items[0],
        id: "second-model-follow-up",
        sourceSlug: "agent-desk",
        personalizedScore: 170,
        matchedSignals: ["entity"],
      },
    ];

    expect(
      selectExposureBalancedNewsFeed(ranked, [
        {
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
        },
      ]).map((item) => item.id),
    ).toEqual(["first-model-follow-up", "second-model-follow-up"]);
  });

  test("keeps deep preference matches ahead of generic fresh angles", () => {
    const ranked = [
      {
        ...items[0],
        id: "deep-preference-model-follow-up",
        sourceSlug: "openai-news",
        personalizedScore: 210,
        matchedSignals: ["category", "source", "entity"],
      },
      {
        ...items[1],
        id: "fresh-but-unmatched-market-angle",
        category: "funding",
        entities: ["Series A"],
        sourceSlug: "venturewire",
        personalizedScore: 150,
        matchedSignals: [],
      },
    ];

    const feed = selectExposureBalancedNewsFeed(ranked, [
      {
        category: "model_release",
        entities: ["OpenAI"],
        sourceSlug: "openai-news",
      },
    ]);

    expect(feed.map((item) => item.id)).toEqual([
      "deep-preference-model-follow-up",
      "fresh-but-unmatched-market-angle",
    ]);
    expect(feed[0]?.matchedSignals).toContain("deep_preference");
    expect(feed[0]?.matchedSignals).not.toContain("exposure_cooldown");
  });

  test("does not cool down candidates from stale reading exposure", () => {
    const ranked = [
      {
        ...items[0],
        id: "same-source-return",
        sourceSlug: "openai-news",
        personalizedScore: 190,
        matchedSignals: ["source"],
      },
      {
        ...items[1],
        id: "fresh-market-angle",
        category: "funding",
        entities: ["Series A"],
        sourceSlug: "venturewire",
        personalizedScore: 150,
        matchedSignals: [],
      },
    ];

    const feed = selectExposureBalancedNewsFeed(
      ranked,
      [
        {
          category: "model_release",
          entities: ["OpenAI"],
          occurredAt: "2999-01-01T00:00:00.000Z",
          sourceSlug: "openai-news",
        },
      ],
      new Date("2999-01-02T01:00:00.000Z"),
    );

    expect(feed.map((item) => item.id)).toEqual([
      "same-source-return",
      "fresh-market-angle",
    ]);
    expect(feed[0]?.matchedSignals).not.toContain("exposure_cooldown");
  });
});

describe("selectNegativeFeedbackAdjustedNewsFeed", () => {
  test("moves stories similar to hidden feedback behind unrelated alternatives", () => {
    const ranked = [
      {
        ...items[0],
        id: "same-source-follow-up",
        entities: ["Anthropic"],
        personalizedScore: 180,
        matchedSignals: ["source"],
      },
      {
        ...items[1],
        id: "unrelated-agent-story",
        category: "agent_product",
        entities: ["Agents"],
        sourceSlug: "agent-desk",
        personalizedScore: 120,
        matchedSignals: ["category"],
      },
      {
        ...items[1],
        id: "shared-entity-follow-up",
        category: "funding",
        entities: ["OpenAI", "Series A"],
        sourceSlug: "venturewire",
        personalizedScore: 170,
        matchedSignals: ["entity"],
      },
    ];

    expect(
      selectNegativeFeedbackAdjustedNewsFeed(ranked, [
        {
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
        },
      ]).map((item) => item.id),
    ).toEqual([
      "unrelated-agent-story",
      "same-source-follow-up",
      "shared-entity-follow-up",
    ]);
  });

  test("moves stories sharing hidden feedback tags behind unrelated alternatives", () => {
    const ranked = [
      {
        ...items[0],
        id: "shared-agent-angle",
        category: "research",
        entities: ["Benchmarks"],
        sourceSlug: "research-lab",
        tags: ["agents"],
        personalizedScore: 180,
        matchedSignals: ["tag"],
      },
      {
        ...items[1],
        id: "fresh-market-angle",
        category: "market_map",
        entities: ["AI market"],
        sourceSlug: "market-map",
        tags: ["enterprise"],
        personalizedScore: 130,
        matchedSignals: [],
      },
    ];

    const feed = selectNegativeFeedbackAdjustedNewsFeed(ranked, [
      {
        category: "model_release",
        entities: ["OpenAI"],
        sourceSlug: "openai-news",
        tags: ["agents"],
      },
    ]);

    expect(feed.map((item) => item.id)).toEqual([
      "fresh-market-angle",
      "shared-agent-angle",
    ]);
    expect(feed[1]?.matchedSignals).toContain("negative_feedback");
  });

  test("ignores stale negative feedback outside the cooldown window", () => {
    const ranked = [
      {
        ...items[0],
        id: "same-source-follow-up",
        entities: ["Anthropic"],
        personalizedScore: 180,
        matchedSignals: ["source"],
      },
      {
        ...items[1],
        id: "unrelated-agent-story",
        category: "agent_product",
        entities: ["Agents"],
        sourceSlug: "agent-desk",
        personalizedScore: 120,
        matchedSignals: ["category"],
      },
    ];

    expect(
      selectNegativeFeedbackAdjustedNewsFeed(
        ranked,
        [
          {
            category: "model_release",
            entities: ["OpenAI"],
            occurredAt: "2026-05-01T09:00:00.000Z",
            sourceSlug: "openai-news",
          },
        ],
        new Date("2026-07-01T09:00:00.000Z"),
      ).map((item) => item.id),
    ).toEqual(["same-source-follow-up", "unrelated-agent-story"]);
  });

  test("keeps ranked order when there is no negative feedback context", () => {
    const ranked = [
      {
        ...items[0],
        id: "model-story",
        personalizedScore: 180,
        matchedSignals: ["category"],
      },
      {
        ...items[1],
        id: "funding-story",
        personalizedScore: 160,
        matchedSignals: ["entity"],
      },
    ];

    expect(selectNegativeFeedbackAdjustedNewsFeed(ranked, [])).toEqual(ranked);
  });
});

describe("selectBreakingNewsPriorityFeed", () => {
  test("moves high-trust fresh high-heat stories ahead of ordinary ranked items", () => {
    const ranked = [
      {
        ...items[1],
        id: "ordinary-ranked-lead",
        publishedAt: "2026-07-01T08:00:00.000Z",
        sourceScore: 82,
        trendScore: 82,
        personalizedScore: 190,
        matchedSignals: ["category"],
      },
      {
        ...items[0],
        id: "breaking-model-update",
        publishedAt: "2026-07-01T09:30:00.000Z",
        sourceScore: 94,
        trendScore: 96,
        personalizedScore: 150,
        matchedSignals: [],
      },
    ];

    const feed = selectBreakingNewsPriorityFeed(
      ranked,
      new Date("2026-07-01T10:00:00.000Z"),
    );

    expect(feed.map((item) => item.id)).toEqual([
      "breaking-model-update",
      "ordinary-ranked-lead",
    ]);
    expect(feed[0]?.matchedSignals).toContain("breaking_news");
  });

  test("does not rescue stories already suppressed by negative feedback", () => {
    const ranked = [
      {
        ...items[1],
        id: "ordinary-ranked-lead",
        personalizedScore: 190,
        matchedSignals: ["category"],
      },
      {
        ...items[0],
        id: "hidden-topic-breaking-story",
        publishedAt: "2026-07-01T09:30:00.000Z",
        sourceScore: 94,
        trendScore: 96,
        personalizedScore: 150,
        matchedSignals: ["negative_feedback"],
      },
    ];

    expect(
      selectBreakingNewsPriorityFeed(
        ranked,
        new Date("2026-07-01T10:00:00.000Z"),
      ).map((item) => item.id),
    ).toEqual(["ordinary-ranked-lead", "hidden-topic-breaking-story"]);
  });
});

describe("updateReaderProfileWithInteraction", () => {
  test("normalizes stale profile data while applying a reader action", () => {
    const profile = updateReaderProfileWithInteraction(
      {
        preferredCategories: [" model_release ", "MODEL_RELEASE"],
        preferredSources: [" openai-news ", "OpenAI-News"],
        preferredEntities: [" OpenAI ", "openai"],
        noveltyBias: 9,
        recencyBias: -3,
      },
      items[1],
      { action: "save" },
    );

    expect(profile).toEqual({
      preferredCategories: ["model_release", "funding"],
      preferredSources: ["openai-news", "venturewire"],
      preferredEntities: ["OpenAI", "Series A", "startup"],
      noveltyBias: 2,
      recencyBias: 0.3,
    });
  });

  test("learns from strong reader actions without duplicating signals", () => {
    const profile = updateReaderProfileWithInteraction(
      defaultProfile,
      items[0],
      {
        action: "save",
      },
    );

    expect(profile.preferredCategories).toContain("model_release");
    expect(profile.preferredSources).toContain("openai-news");
    expect(profile.preferredEntities).toContain("OpenAI");
    expect(
      profile.preferredCategories.filter((item) => item === "model_release"),
    ).toHaveLength(1);
  });

  test("learns fine-grained tag interests from strong reader actions", () => {
    const profile = updateReaderProfileWithInteraction(
      {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      {
        ...items[0],
        entities: ["OpenAI"],
        tags: ["agents", "benchmarks"],
      },
      {
        action: "save",
      },
    );

    expect(profile.preferredEntities).toEqual([
      "OpenAI",
      "agents",
      "benchmarks",
    ]);
  });

  test("keeps source clicks focused on source preference", () => {
    const profile = updateReaderProfileWithInteraction(
      {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      {
        ...items[0],
        category: "model_release",
        entities: ["OpenAI"],
        sourceSlug: "openai-news",
        tags: ["agents"],
      },
      {
        action: "click_source",
      },
    );

    expect(profile.preferredSources).toEqual(["openai-news"]);
    expect(profile.preferredCategories).toEqual([]);
    expect(profile.preferredEntities).toEqual([]);
  });

  test("uses weaker actions to increase recency and novelty bias gradually", () => {
    const profile = updateReaderProfileWithInteraction(
      {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      items[1],
      { action: "view" },
    );

    expect(profile.preferredCategories).toContain("funding");
    expect(profile.noveltyBias).toBeGreaterThan(1);
    expect(profile.recencyBias).toBeGreaterThan(1);
  });

  test("weights view learning by reading completion depth", () => {
    const startingProfile = {
      preferredCategories: [],
      preferredSources: [],
      preferredEntities: [],
      noveltyBias: 1,
      recencyBias: 1,
    };

    const shallowViewProfile = updateReaderProfileWithInteraction(
      startingProfile,
      items[0],
      { action: "view", readPercent: 0.15 },
    );
    const completedViewProfile = updateReaderProfileWithInteraction(
      startingProfile,
      items[0],
      { action: "view", readPercent: 0.9 },
    );

    expect(completedViewProfile.noveltyBias).toBeGreaterThan(
      shallowViewProfile.noveltyBias,
    );
    expect(completedViewProfile.recencyBias).toBeGreaterThan(
      shallowViewProfile.recencyBias,
    );
  });

  test("does not train the profile from shallow reads", () => {
    const startingProfile = {
      preferredCategories: [],
      preferredSources: [],
      preferredEntities: [],
      noveltyBias: 1,
      recencyBias: 1,
    };

    const profile = updateReaderProfileWithInteraction(
      startingProfile,
      items[0],
      { action: "view", readPercent: 0.2 },
    );

    expect(profile).toEqual(startingProfile);
  });

  test("only learns entity interests from completed reads", () => {
    const startingProfile = {
      preferredCategories: [],
      preferredSources: [],
      preferredEntities: [],
      noveltyBias: 1,
      recencyBias: 1,
    };

    const shallowViewProfile = updateReaderProfileWithInteraction(
      startingProfile,
      items[0],
      { action: "view", readPercent: 0.2 },
    );
    const completedViewProfile = updateReaderProfileWithInteraction(
      startingProfile,
      items[0],
      { action: "view", readPercent: 0.85 },
    );

    expect(shallowViewProfile.preferredCategories).not.toContain(
      "model_release",
    );
    expect(shallowViewProfile.preferredEntities).not.toContain("OpenAI");
    expect(completedViewProfile.preferredEntities).toContain("OpenAI");
  });

  test("treats sharing as a stronger positive signal than saving", () => {
    const startingProfile = {
      preferredCategories: [],
      preferredSources: [],
      preferredEntities: [],
      noveltyBias: 1,
      recencyBias: 1,
    };

    const savedProfile = updateReaderProfileWithInteraction(
      startingProfile,
      items[0],
      { action: "save" },
    );
    const sharedProfile = updateReaderProfileWithInteraction(
      startingProfile,
      items[0],
      { action: "share" },
    );

    expect(sharedProfile.noveltyBias).toBeGreaterThan(savedProfile.noveltyBias);
    expect(sharedProfile.recencyBias).toBeGreaterThan(savedProfile.recencyBias);
  });

  test("weights lower-ranked positive feedback as stronger reader intent", () => {
    const startingProfile = {
      preferredCategories: [],
      preferredSources: [],
      preferredEntities: [],
      noveltyBias: 1,
      recencyBias: 1,
    };

    const leadStoryProfile = updateReaderProfileWithInteraction(
      startingProfile,
      items[0],
      { action: "save", rankSlot: 0 },
    );
    const lowerRankedStoryProfile = updateReaderProfileWithInteraction(
      startingProfile,
      items[0],
      { action: "save", rankSlot: 12 },
    );

    expect(lowerRankedStoryProfile.noveltyBias).toBeGreaterThan(
      leadStoryProfile.noveltyBias,
    );
    expect(lowerRankedStoryProfile.recencyBias).toBeGreaterThan(
      leadStoryProfile.recencyBias,
    );
  });

  test("dampens freshness and novelty bias after negative feedback", () => {
    const profile = updateReaderProfileWithInteraction(
      {
        preferredCategories: ["model_release", "funding"],
        preferredSources: ["openai-news", "venturewire"],
        preferredEntities: ["OpenAI", "Series A"],
        noveltyBias: 1.6,
        recencyBias: 1.4,
      },
      items[0],
      { action: "hide" },
    );

    expect(profile.preferredCategories).not.toContain("model_release");
    expect(profile.preferredSources).not.toContain("openai-news");
    expect(profile.preferredEntities).not.toContain("OpenAI");
    expect(profile.noveltyBias).toBeLessThan(1.6);
    expect(profile.recencyBias).toBeLessThan(1.4);
  });

  test("removes negative feedback signals with normalized matching", () => {
    const profile = updateReaderProfileWithInteraction(
      {
        preferredCategories: [" Model_Release ", "funding"],
        preferredSources: [" OpenAI-News ", "venturewire"],
        preferredEntities: [" openai ", "Agents", "Series A"],
        noveltyBias: 1.6,
        recencyBias: 1.4,
      },
      {
        ...items[0],
        category: "model_release",
        entities: ["OpenAI", "agents"],
        sourceSlug: "openai-news",
      },
      { action: "hide" },
    );

    expect(profile.preferredCategories).toEqual(["funding"]);
    expect(profile.preferredSources).toEqual(["venturewire"]);
    expect(profile.preferredEntities).toEqual(["Series A"]);
  });
});
