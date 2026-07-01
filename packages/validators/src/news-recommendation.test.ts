import { describe, expect, test } from "vitest";

import {
  dedupeNewsItems,
  filterHiddenNewsItems,
  getNewsExplorationInterval,
  normalizeNewsPreferenceProfile,
  rankNewsForReader,
  selectDiverseNewsFeed,
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
});

describe("filterHiddenNewsItems", () => {
  test("removes stories that the reader has hidden before ranking", () => {
    const filtered = filterHiddenNewsItems(items, ["funding"]);

    expect(filtered.map((item) => item.id)).toEqual(["model-release"]);
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
      preferredEntities: ["OpenAI", "Series A"],
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
});
