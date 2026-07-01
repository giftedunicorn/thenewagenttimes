import { describe, expect, test } from "vitest";

import { rankNewsForReader } from "./news-recommendation";

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
