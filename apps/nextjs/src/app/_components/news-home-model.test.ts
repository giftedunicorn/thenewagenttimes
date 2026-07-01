import { describe, expect, it } from "vitest";

import {
  selectNewsHomeItems,
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
