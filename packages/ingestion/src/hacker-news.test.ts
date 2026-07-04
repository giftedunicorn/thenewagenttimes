import { describe, expect, it } from "vitest";

import {
  buildHackerNewsAiSearchUrls,
  parseHackerNewsAiStories,
  toHackerNewsAiManualNewsInput,
} from "./hacker-news";

const sourceId = "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0";

describe("buildHackerNewsAiSearchUrls", () => {
  it("queries recent AI discussion signals with bounded page sizes", () => {
    expect(
      buildHackerNewsAiSearchUrls({
        limitPerQuery: 12,
        now: new Date("2026-07-04T12:00:00.000Z"),
        queries: ["llm", "agents"],
      }),
    ).toEqual([
      "https://hn.algolia.com/api/v1/search_by_date?query=llm&tags=story&numericFilters=created_at_i%3E%3D1782561600&hitsPerPage=12",
      "https://hn.algolia.com/api/v1/search_by_date?query=agents&tags=story&numericFilters=created_at_i%3E%3D1782561600&hitsPerPage=12",
    ]);
  });
});

describe("parseHackerNewsAiStories", () => {
  it("keeps the community signal fields needed for news ingestion", () => {
    expect(
      parseHackerNewsAiStories({
        hits: [
          {
            author: "pg",
            created_at: "2026-07-01T08:00:00Z",
            num_comments: 84,
            objectID: "123456",
            points: 512,
            title: "Show HN: Agent runtime for browser workflows",
            url: "https://example.com/agent-runtime",
          },
        ],
      }),
    ).toEqual([
      {
        author: "pg",
        comments: 84,
        discussionUrl: "https://news.ycombinator.com/item?id=123456",
        id: "123456",
        points: 512,
        publishedAt: "2026-07-01T08:00:00Z",
        title: "Show HN: Agent runtime for browser workflows",
        url: "https://example.com/agent-runtime",
      },
    ]);
  });

  it("falls back to the HN discussion URL when a story link is malformed", () => {
    expect(
      parseHackerNewsAiStories({
        hits: [
          {
            author: "pg",
            created_at: "2026-07-01T08:00:00Z",
            num_comments: 12,
            objectID: "123457",
            points: 45,
            title: "Ask HN: Which agent runtime is reliable?",
            url: "not a url",
          },
        ],
      }),
    ).toEqual([
      {
        author: "pg",
        comments: 12,
        discussionUrl: "https://news.ycombinator.com/item?id=123457",
        id: "123457",
        points: 45,
        publishedAt: "2026-07-01T08:00:00Z",
        title: "Ask HN: Which agent runtime is reliable?",
        url: "https://news.ycombinator.com/item?id=123457",
      },
    ]);
  });

  it("falls back to the HN discussion URL for unsafe story link protocols", () => {
    expect(
      parseHackerNewsAiStories({
        hits: [
          {
            author: "pg",
            created_at: "2026-07-01T08:00:00Z",
            num_comments: 12,
            objectID: "123458",
            points: 45,
            title: "Ask HN: Which agent runtime should I trust?",
            url: "javascript:alert('agent')",
          },
          {
            author: "sama",
            created_at: "2026-07-01T09:00:00Z",
            num_comments: 8,
            objectID: "123459",
            points: 39,
            title: "Show HN: Agent brief as a data URL",
            url: "data:text/html,unsafe",
          },
        ],
      }).map((story) => ({
        id: story.id,
        url: story.url,
      })),
    ).toEqual([
      {
        id: "123458",
        url: "https://news.ycombinator.com/item?id=123458",
      },
      {
        id: "123459",
        url: "https://news.ycombinator.com/item?id=123459",
      },
    ]);
  });
});

describe("toHackerNewsAiManualNewsInput", () => {
  it("turns an HN story into a community-signal news candidate", () => {
    const newsInput = toHackerNewsAiManualNewsInput({
      sourceId,
      sourceSlug: "hacker-news-ai",
      story: {
        author: "pg",
        comments: 84,
        discussionUrl: "https://news.ycombinator.com/item?id=123456",
        id: "123456",
        points: 512,
        publishedAt: "2026-07-01T08:00:00Z",
        title: "Show HN: Agent runtime for browser workflows",
        url: "https://example.com/agent-runtime",
      },
    });

    expect(newsInput).toMatchObject({
      authorName: "pg",
      publishedAt: new Date("2026-07-01T08:00:00.000Z"),
      sourceId,
      summary:
        'Hacker News readers are discussing "Show HN: Agent runtime for browser workflows" with 512 points and 84 comments.',
      title:
        "Hacker News discussion: Show HN: Agent runtime for browser workflows",
      url: "https://example.com/agent-runtime",
    });
    expect(newsInput.tags).toEqual(
      expect.arrayContaining([
        "hacker_news",
        "community_signal",
        "agent",
        "workflow_automation",
      ]),
    );
  });
});
