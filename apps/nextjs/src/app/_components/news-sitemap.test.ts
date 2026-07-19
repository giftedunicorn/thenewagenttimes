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
      baseUrl: "https://thenewaitimes.test",
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
        url: "https://thenewaitimes.test/",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.9,
        url: "https://thenewaitimes.test/briefing",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.85,
        url: "https://thenewaitimes.test/threads",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.7,
        url: "https://thenewaitimes.test/search",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.65,
        url: "https://thenewaitimes.test/reader",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.55,
        url: "https://thenewaitimes.test/reader/following",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.55,
        url: "https://thenewaitimes.test/reader/library",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.45,
        url: "https://thenewaitimes.test/reader/onboarding",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.6,
        url: "https://thenewaitimes.test/rss.xml",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.6,
        url: "https://thenewaitimes.test/feed.json",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.5,
        url: "https://thenewaitimes.test/llms.txt",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.5,
        url: "https://thenewaitimes.test/opensearch.xml",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.8,
        url: "https://thenewaitimes.test/topics",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.8,
        url: "https://thenewaitimes.test/sources",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.78,
        url: "https://thenewaitimes.test/entities",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T08:35:00.000Z",
        priority: 0.75,
        url: "https://thenewaitimes.test/topics/agent-product",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.75,
        url: "https://thenewaitimes.test/topics/model-release",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T08:35:00.000Z",
        priority: 0.7,
        url: "https://thenewaitimes.test/sources/agent-desk",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.7,
        url: "https://thenewaitimes.test/sources/model-desk",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.7,
        url: "https://thenewaitimes.test/entities/OpenAI",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.7,
        url: "https://thenewaitimes.test/entities/Agents",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T08:35:00.000Z",
        priority: 0.72,
        url: "https://thenewaitimes.test/threads/openai-agents",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.72,
        url: "https://thenewaitimes.test/threads/frontier-model",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-05T10:05:00.000Z",
        priority: 0.72,
        url: "https://thenewaitimes.test/threads/agent-followup",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T08:35:00.000Z",
        priority: 0.85,
        url: "https://thenewaitimes.test/news/openai-agents",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-06T10:05:00.000Z",
        priority: 0.85,
        url: "https://thenewaitimes.test/news/frontier-model",
      },
      {
        changeFrequency: "hourly",
        lastModified: "2026-07-05T10:05:00.000Z",
        priority: 0.85,
        url: "https://thenewaitimes.test/news/agent-followup",
      },
    ]);
  });

  it("normalizes robots metadata to the public sitemap URL", () => {
    expect(
      getNewsRobotsPolicy({
        baseUrl: "https://thenewaitimes.test",
      }),
    ).toEqual({
      rules: {
        allow: "/",
        disallow: "/api/",
        userAgent: "*",
      },
      sitemap: "https://thenewaitimes.test/sitemap.xml",
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
