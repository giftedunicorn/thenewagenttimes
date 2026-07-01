import { describe, expect, it } from "vitest";

import {
  buildNewsDeskStatus,
  getNewsDeskStatusSummary,
  getNewsRecommendationReasons,
  getNextNewsHomeCursor,
  mergeNewsHomeItems,
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
