import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import type { NewsHomeItem } from "./news-home-model";
import { getNewsRobotsPolicy, getNewsSitemapEntries } from "./news-sitemap";

const createSitemapItem = ({
  category,
  id,
  publishedAt,
  sourceSlug,
}: {
  category: string;
  id: string;
  publishedAt: string;
  sourceSlug: string;
}): NewsHomeItem => ({
  canonicalUrl: `https://source.example/${id}`,
  category,
  clusterKey: id,
  entities: ["OpenAI", "Agents"],
  id,
  imageUrl: null,
  originalUrl: `https://source.example/original/${id}`,
  publishedAt,
  sourceName: sourceSlug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" "),
  sourceScore: 84,
  sourceSlug,
  sourceType: "rss",
  summary: `${id} summary.`,
  tags: ["workflow"],
  title: `${id} title`,
  trendScore: 89,
});

describe("getNewsSitemapEntries", () => {
  it("builds discoverable sitemap entries for home, core surfaces, feeds, machine discovery, topics, entities, sources, and stories", () => {
    const entries = getNewsSitemapEntries({
      baseUrl: "https://thenewagenttimes.test",
      items: [
        createSitemapItem({
          category: "agent_product",
          id: "openai-agents",
          publishedAt: "2026-07-06T08:35:00.000Z",
          sourceSlug: "agent-desk",
        }),
        createSitemapItem({
          category: "model_release",
          id: "frontier-model",
          publishedAt: "2026-07-06T10:05:00.000Z",
          sourceSlug: "model-desk",
        }),
        createSitemapItem({
          category: "agent_product",
          id: "agent-followup",
          publishedAt: "2026-07-05T10:05:00.000Z",
          sourceSlug: "agent-desk",
        }),
      ],
    });

    expect(entries).toEqual([
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 1,
        url: "https://thenewagenttimes.test/",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.9,
        url: "https://thenewagenttimes.test/briefing",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.85,
        url: "https://thenewagenttimes.test/threads",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.7,
        url: "https://thenewagenttimes.test/search",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.65,
        url: "https://thenewagenttimes.test/reader",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.55,
        url: "https://thenewagenttimes.test/reader/following",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.55,
        url: "https://thenewagenttimes.test/reader/library",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.45,
        url: "https://thenewagenttimes.test/reader/onboarding",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.6,
        url: "https://thenewagenttimes.test/rss.xml",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.6,
        url: "https://thenewagenttimes.test/feed.json",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.5,
        url: "https://thenewagenttimes.test/llms.txt",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.5,
        url: "https://thenewagenttimes.test/opensearch.xml",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.8,
        url: "https://thenewagenttimes.test/topics",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.8,
        url: "https://thenewagenttimes.test/sources",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.78,
        url: "https://thenewagenttimes.test/entities",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T08:35:00.000Z",
        priority: 0.75,
        url: "https://thenewagenttimes.test/topics/agent-product",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.75,
        url: "https://thenewagenttimes.test/topics/model-release",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T08:35:00.000Z",
        priority: 0.7,
        url: "https://thenewagenttimes.test/sources/agent-desk",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.7,
        url: "https://thenewagenttimes.test/sources/model-desk",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.7,
        url: "https://thenewagenttimes.test/entities/OpenAI",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.7,
        url: "https://thenewagenttimes.test/entities/Agents",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T08:35:00.000Z",
        priority: 0.72,
        url: "https://thenewagenttimes.test/threads/openai-agents",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.72,
        url: "https://thenewagenttimes.test/threads/frontier-model",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-05T10:05:00.000Z",
        priority: 0.72,
        url: "https://thenewagenttimes.test/threads/agent-followup",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T08:35:00.000Z",
        priority: 0.85,
        url: "https://thenewagenttimes.test/news/openai-agents",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.85,
        url: "https://thenewagenttimes.test/news/frontier-model",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-05T10:05:00.000Z",
        priority: 0.85,
        url: "https://thenewagenttimes.test/news/agent-followup",
      },
    ]);
  });

  it("normalizes robots metadata to the public sitemap URL", () => {
    expect(
      getNewsRobotsPolicy({
        baseUrl: "https://thenewagenttimes.test",
      }),
    ).toEqual({
      rules: {
        allow: "/",
        disallow: "/api/",
        userAgent: "*",
      },
      sitemap: "https://thenewagenttimes.test/sitemap.xml",
    });
  });

  it("wires Next special sitemap and robots routes to the news helpers", async () => {
    const [sitemapSource, robotsSource] = await Promise.all([
      readFile(new URL("../sitemap.ts", import.meta.url), "utf8"),
      readFile(new URL("../robots.ts", import.meta.url), "utf8"),
    ]);

    expect(sitemapSource).toContain("getNewsHomeData()");
    expect(sitemapSource).toContain("getNewsSitemapEntries({");
    expect(robotsSource).toContain("getNewsRobotsPolicy()");
  });
});
