import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import type { NewsHomeItem } from "./news-home-model";
import { getNewsJsonFeed, getNewsRssFeed } from "./news-feed";

const createFeedItem = ({
  id,
  imageUrl = null,
  publishedAt,
  title,
}: {
  id: string;
  imageUrl?: string | null;
  publishedAt: string;
  title: string;
}): NewsHomeItem => ({
  canonicalUrl: `https://source.example/${id}`,
  category: "agent_product",
  clusterKey: id,
  entities: ["OpenAI", "Agents"],
  id,
  imageUrl,
  originalUrl: `https://source.example/original/${id}`,
  publishedAt,
  sourceName: "Agent Desk",
  sourceScore: 84,
  sourceSlug: "agent-desk",
  sourceType: "rss",
  summary: `${title} summary with <angle brackets> & quotes.`,
  tags: ["workflow"],
  title,
  trendScore: 89,
});

const countOccurrences = (text: string, value: string) =>
  text.split(value).length - 1;

describe("getNewsRssFeed", () => {
  it("builds a valid RSS feed from homepage news items", () => {
    const feed = getNewsRssFeed({
      baseUrl: "https://thenewagenttimes.test",
      items: [
        createFeedItem({
          id: "openai-agents",
          publishedAt: "2026-07-06T08:35:00.000Z",
          title: "OpenAI & Anthropic <agent stack>",
        }),
      ],
    });

    expect(feed).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(feed).toContain('<rss version="2.0"');
    expect(feed).toContain("<title>The New AI Times</title>");
    expect(feed).toContain(
      '<atom:link href="https://thenewagenttimes.test/rss.xml" rel="self" type="application/rss+xml" />',
    );
    expect(feed).toContain(
      "<lastBuildDate>Mon, 06 Jul 2026 08:35:00 GMT</lastBuildDate>",
    );
    expect(feed).toContain(
      "<title>OpenAI &amp; Anthropic &lt;agent stack&gt;</title>",
    );
    expect(feed).toContain(
      "<link>https://thenewagenttimes.test/news/openai-agents</link>",
    );
    expect(feed).toContain("<category>agent_product</category>");
    expect(feed).toContain(
      "<description>OpenAI &amp; Anthropic &lt;agent stack&gt; summary with &lt;angle brackets&gt; &amp; quotes.</description>",
    );
    expect(feed).not.toContain("<agent stack>");
  });

  it("adds media RSS image metadata for visual news readers", () => {
    const feed = getNewsRssFeed({
      baseUrl: "https://thenewagenttimes.test",
      items: [
        createFeedItem({
          id: "visual-agent-story",
          imageUrl: "https://cdn.example.com/agent-stack.jpg?size=large&v=1",
          publishedAt: "2026-07-06T08:35:00.000Z",
          title: "Visual agent story",
        }),
      ],
    });

    expect(feed).toContain('xmlns:media="http://search.yahoo.com/mrss/"');
    expect(feed).toContain(
      '<media:content url="https://cdn.example.com/agent-stack.jpg?size=large&amp;v=1" medium="image" />',
    );
  });

  it("converts local media RSS image paths into absolute URLs for aggregators", () => {
    const feed = getNewsRssFeed({
      baseUrl: "https://thenewagenttimes.test",
      items: [
        createFeedItem({
          id: "local-visual-agent-story",
          imageUrl: "/news-images/new-ai-times-agent-browsers.png",
          publishedAt: "2026-07-06T08:35:00.000Z",
          title: "Local visual agent story",
        }),
      ],
    });

    expect(feed).toContain(
      '<media:content url="https://thenewagenttimes.test/news-images/new-ai-times-agent-browsers.png" medium="image" />',
    );
  });

  it("caps RSS items to the front-page story budget", () => {
    const feed = getNewsRssFeed({
      baseUrl: "https://thenewagenttimes.test",
      items: Array.from({ length: 35 }, (_, index) =>
        createFeedItem({
          id: `story-${index}`,
          publishedAt: "2026-07-06T08:35:00.000Z",
          title: `Story ${index}`,
        }),
      ),
    });

    expect(countOccurrences(feed, "<item>")).toBe(30);
  });

  it("wires the rss.xml route to the same news data loader", async () => {
    const routeSource = await readFile(
      new URL("../rss.xml/route.ts", import.meta.url),
      "utf8",
    );

    expect(routeSource).toContain("getNewsHomeData()");
    expect(routeSource).toContain("getNewsRssFeed({");
    expect(routeSource).toContain("application/rss+xml; charset=utf-8");
  });
});

describe("getNewsJsonFeed", () => {
  it("builds a JSON Feed for modern news readers", () => {
    const feed = getNewsJsonFeed({
      baseUrl: "https://thenewagenttimes.test",
      items: [
        createFeedItem({
          id: "openai-agents",
          imageUrl: "https://cdn.example.com/openai-agents.jpg",
          publishedAt: "2026-07-06T08:35:00.000Z",
          title: "OpenAI agent stack",
        }),
      ],
    });

    expect(feed).toEqual({
      description:
        "A personalized front page for AI agents, frontier models, funding, research, launches, and market shifts.",
      feed_url: "https://thenewagenttimes.test/feed.json",
      home_page_url: "https://thenewagenttimes.test/",
      items: [
        {
          authors: [{ name: "Agent Desk" }],
          content_text:
            "OpenAI agent stack summary with <angle brackets> & quotes.",
          date_published: "2026-07-06T08:35:00.000Z",
          external_url: "https://source.example/openai-agents",
          id: "https://thenewagenttimes.test/news/openai-agents",
          image: "https://cdn.example.com/openai-agents.jpg",
          tags: ["agent_product", "workflow", "OpenAI", "Agents"],
          title: "OpenAI agent stack",
          url: "https://thenewagenttimes.test/news/openai-agents",
        },
      ],
      title: "The New AI Times",
      version: "https://jsonfeed.org/version/1.1",
    });
  });

  it("caps JSON Feed items to the front-page story budget", () => {
    const feed = getNewsJsonFeed({
      baseUrl: "https://thenewagenttimes.test",
      items: Array.from({ length: 35 }, (_, index) =>
        createFeedItem({
          id: `story-${index}`,
          publishedAt: "2026-07-06T08:35:00.000Z",
          title: `Story ${index}`,
        }),
      ),
    });

    expect(feed.items).toHaveLength(30);
  });

  it("converts local JSON Feed image paths into absolute URLs for feed readers", () => {
    const feed = getNewsJsonFeed({
      baseUrl: "https://thenewagenttimes.test",
      items: [
        createFeedItem({
          id: "local-openai-agents",
          imageUrl: "/news-images/new-ai-times-agent-browsers.png",
          publishedAt: "2026-07-06T08:35:00.000Z",
          title: "Local OpenAI agent stack",
        }),
      ],
    });

    expect(feed.items[0]?.image).toBe(
      "https://thenewagenttimes.test/news-images/new-ai-times-agent-browsers.png",
    );
  });

  it("wires the feed.json route to the same news data loader", async () => {
    const routeSource = await readFile(
      new URL("../feed.json/route.ts", import.meta.url),
      "utf8",
    );

    expect(routeSource).toContain("getNewsHomeData()");
    expect(routeSource).toContain("getNewsJsonFeed({");
    expect(routeSource).toContain("application/feed+json; charset=utf-8");
  });

  it("advertises RSS and JSON feeds from root metadata", async () => {
    const layoutSource = await readFile(
      new URL("../layout.tsx", import.meta.url),
      "utf8",
    );

    expect(layoutSource).toContain("alternates:");
    expect(layoutSource).toContain("types:");
    expect(layoutSource).toContain('"application/rss+xml": "/rss.xml"');
    expect(layoutSource).toContain('"application/feed+json": "/feed.json"');
  });

  it("does not hard-code localhost:3000 as the news metadata base", async () => {
    const layoutSource = await readFile(
      new URL("../layout.tsx", import.meta.url),
      "utf8",
    );

    expect(layoutSource).not.toContain("http://localhost:3000");
    expect(layoutSource).toContain("newsStructuredDataDefaultBaseUrl");
  });
});
