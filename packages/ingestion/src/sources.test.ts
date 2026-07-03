import { describe, expect, it } from "vitest";

import { initialNewsSources } from "./sources";

describe("initialNewsSources", () => {
  it("includes active RSS-capable vendor sources", () => {
    const rssSourceNames = initialNewsSources
      .filter((source) => source.isActive && source.feedUrl)
      .map((source) => source.name);

    expect(rssSourceNames).toEqual(
      expect.arrayContaining([
        "OpenAI News",
        "Anthropic News",
        "Google AI Blog",
        "DeepMind Blog",
        "Hugging Face Blog",
        "LangChain Blog",
      ]),
    );
  });

  it("keeps deferred high-signal sources in the registry", () => {
    const deferredSourceSlugs = initialNewsSources
      .filter((source) => !source.feedUrl)
      .map((source) => source.slug);

    expect(deferredSourceSlugs).toEqual(
      expect.arrayContaining(["product-hunt-ai", "hacker-news-ai", "yc-ai"]),
    );
  });

  it("covers independent news, research, and builder commentary RSS sources", () => {
    const sourcesBySlug = new Map(
      initialNewsSources.map((source) => [source.slug, source]),
    );

    expect(sourcesBySlug.get("techcrunch-ai")).toMatchObject({
      feedUrl: "https://techcrunch.com/category/artificial-intelligence/feed/",
      isActive: true,
      sourceType: "rss",
    });
    expect(sourcesBySlug.get("the-decoder")).toMatchObject({
      feedUrl: "https://the-decoder.com/feed/",
      isActive: true,
      sourceType: "rss",
    });
    expect(sourcesBySlug.get("mit-news-ai")).toMatchObject({
      feedUrl: "https://news.mit.edu/topic/mitartificial-intelligence2-rss.xml",
      isActive: true,
      sourceType: "rss",
    });
    expect(sourcesBySlug.get("arxiv-ai-ml")).toMatchObject({
      feedUrl: "https://rss.arxiv.org/rss/cs.AI+cs.LG",
      isActive: true,
      sourceType: "rss",
    });
    expect(sourcesBySlug.get("simon-willison-llms")).toMatchObject({
      feedUrl: "https://simonwillison.net/tags/llms.atom",
      isActive: true,
      sourceType: "rss",
    });
    expect(sourcesBySlug.get("venturebeat-ai")).toMatchObject({
      feedUrl: "https://venturebeat.com/category/ai/feed/",
      isActive: true,
      sourceType: "rss",
    });
    expect(sourcesBySlug.get("the-verge-ai")).toMatchObject({
      feedUrl:
        "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
      isActive: true,
      sourceType: "publication",
    });
    expect(sourcesBySlug.get("ars-technica-ai")).toMatchObject({
      feedUrl: "https://arstechnica.com/ai/feed/",
      isActive: true,
      sourceType: "publication",
    });
    expect(sourcesBySlug.get("mozilla-ai-blog")).toMatchObject({
      feedUrl: "https://blog.mozilla.ai/rss/",
      isActive: true,
      sourceType: "vendor_blog",
    });
    expect(sourcesBySlug.get("import-ai")).toMatchObject({
      feedUrl: "https://importai.substack.com/feed",
      isActive: true,
      sourceType: "research",
    });
    expect(sourcesBySlug.get("latent-space")).toMatchObject({
      feedUrl: "https://www.latent.space/feed",
      isActive: true,
      sourceType: "rss",
    });
  });

  it("keeps the active RSS catalog broad enough for a live AI front page", () => {
    expect(
      initialNewsSources.filter((source) => source.isActive && source.feedUrl),
    ).toHaveLength(20);
  });

  it("uses unique slugs for every source", () => {
    const slugs = initialNewsSources.map((source) => source.slug);
    const uniqueSlugs = new Set(slugs);

    expect(uniqueSlugs.size).toBe(slugs.length);
  });

  it("validates every source against the DB insert schema", () => {
    expect(initialNewsSources.length).toBeGreaterThanOrEqual(10);
  });
});
