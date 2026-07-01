import { describe, expect, test } from "vitest";

import {
  filterHiddenNewsItems,
  rankNewsForReader,
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

describe("updateReaderProfileWithInteraction", () => {
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
});
