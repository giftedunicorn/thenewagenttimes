import { describe, expect, test } from "vitest";

import {
  dedupeNewsItems,
  filterBlockedNewsItems,
  filterHiddenNewsItems,
  getNewsExplorationInterval,
  normalizeNewsPreferenceProfile,
  rankNewsForReader,
  selectBreakingNewsPriorityFeed,
  selectDiscoverySlotNewsFeed,
  selectDiverseNewsFeed,
  selectExposureBalancedNewsFeed,
  selectFatigueBalancedNewsFeed,
  selectNegativeFeedbackAdjustedNewsFeed,
  selectPositiveFeedbackAnchoredNewsFeed,
  selectReaderFreshNewsFeed,
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
