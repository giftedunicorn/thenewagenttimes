import { describe, expect, it } from "vitest";

import type { NewsHomeItem } from "./news-home-model";
import { selectNewsPublicFrontPage } from "./news-public-front-page-model";

const makeStory = (
  id: string,
  overrides: Partial<NewsHomeItem & {
    matchedSignals: string[];
    personalizedScore: number;
  }> = {},
) => ({
  id,
  title: `Story ${id}`,
  summary: `Summary for ${id}`,
  canonicalUrl: `https://example.com/${id}`,
  imageUrl: null,
  publishedAt: "2026-07-10T08:00:00.000Z",
  category: "research",
  tags: [],
  entities: [],
  sourceName: `Source ${id}`,
  sourceSlug: `source-${id}`,
  sourceType: "rss",
  sourceScore: 80,
  trendScore: 70,
  personalizedScore: 100,
  matchedSignals: [],
  ...overrides,
});

describe("selectNewsPublicFrontPage", () => {
  it("builds mutually exclusive lead, latest, most-read, and editor groups", () => {
    const stories = Array.from({ length: 14 }, (_, index) =>
      makeStory(`story-${index}`, {
        category: index % 2 === 0 ? "research" : "agent_product",
        publishedAt: `2026-07-${String(10 - Math.floor(index / 2)).padStart(2, "0")}T${String(20 - index).padStart(2, "0")}:00:00.000Z`,
        sourceScore: 70 + index,
        trendScore: 100 - index,
      }),
    );

    const frontPage = selectNewsPublicFrontPage(stories, {
      editorPickLimit: 3,
      latestLimit: 3,
      mostReadLimit: 3,
    });
    const featuredIds = [
      frontPage.lead?.id,
      ...frontPage.latest.map((item) => item.id),
      ...frontPage.mostRead.map((item) => item.id),
      ...frontPage.editorPicks.map((item) => item.id),
    ].filter((id): id is string => Boolean(id));

    expect(frontPage.lead?.id).toBe("story-0");
    expect(new Set(featuredIds).size).toBe(featuredIds.length);
    expect(frontPage.latest.map((item) => item.publishedAt)).toEqual(
      [...frontPage.latest]
        .sort((left, right) =>
          right.publishedAt.localeCompare(left.publishedAt),
        )
        .map((item) => item.publishedAt),
    );
  });

  it("uses trend strength for most read and returns a chronological stream", () => {
    const stories = [
      makeStory("lead", { personalizedScore: 200 }),
      makeStory("newest", {
        publishedAt: "2026-07-10T12:00:00.000Z",
        trendScore: 20,
      }),
      makeStory("trending", {
        publishedAt: "2026-07-09T12:00:00.000Z",
        trendScore: 99,
      }),
      makeStory("trusted", {
        category: "security",
        publishedAt: "2026-07-08T12:00:00.000Z",
        sourceScore: 99,
        trendScore: 30,
      }),
      makeStory("stream-new", {
        publishedAt: "2026-07-07T12:00:00.000Z",
      }),
      makeStory("stream-old", {
        publishedAt: "2026-07-06T12:00:00.000Z",
      }),
    ];

    const frontPage = selectNewsPublicFrontPage(stories, {
      editorPickLimit: 1,
      latestLimit: 1,
      mostReadLimit: 1,
    });

    expect(frontPage.mostRead[0]?.id).toBe("trending");
    expect(frontPage.editorPicks[0]?.id).toBe("trusted");
    expect(frontPage.stream.map((item) => item.id)).toEqual([
      "stream-new",
      "stream-old",
    ]);
  });
});
