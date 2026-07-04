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
        "Google AI Blog",
        "DeepMind Blog",
        "Microsoft AI Blog",
        "Hugging Face Blog",
        "LangChain Blog",
      ]),
    );
  });

  it("keeps deferred non-RSS high-signal sources in the registry", () => {
    const deferredSourceSlugs = initialNewsSources
      .filter((source) => !source.feedUrl)
      .map((source) => source.slug);

    expect(deferredSourceSlugs).toEqual(
      expect.arrayContaining([
        "arxiv-ai-ml",
        "hacker-news-ai",
        "github-trending-ai",
        "yc-ai",
      ]),
    );
    expect(deferredSourceSlugs).not.toContain("product-hunt-ai");
  });

  it("does not attempt vendor sources whose public RSS endpoints are retired", () => {
    const sourcesBySlug = new Map(
      initialNewsSources.map((source) => [source.slug, source]),
    );

    expect(sourcesBySlug.get("anthropic-news")).toMatchObject({
      feedUrl: null,
      isActive: false,
      sourceType: "vendor_blog",
    });
    expect(sourcesBySlug.get("meta-ai-blog")).toMatchObject({
      feedUrl: null,
      isActive: false,
      sourceType: "vendor_blog",
    });
  });

  it("uses currently resolving vendor RSS endpoints", () => {
    const sourcesBySlug = new Map(
      initialNewsSources.map((source) => [source.slug, source]),
    );

    expect(sourcesBySlug.get("microsoft-ai-blog")).toMatchObject({
      feedUrl: "https://www.microsoft.com/en-us/ai/blog/feed/",
      isActive: true,
      sourceType: "vendor_blog",
    });
    expect(sourcesBySlug.get("langchain-blog")).toMatchObject({
      feedUrl: "https://www.langchain.com/blog/rss.xml",
      isActive: true,
      sourceType: "vendor_blog",
    });
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

  it("keeps arXiv AI active for structured research discovery", () => {
    const sourcesBySlug = new Map(
      initialNewsSources.map((source) => [source.slug, source]),
    );

    expect(sourcesBySlug.get("arxiv-ai-ml")).toMatchObject({
      feedUrl: null,
      homepageUrl: "https://arxiv.org/list/cs.AI/recent",
      isActive: true,
      sourceType: "research",
    });
  });

  it("keeps Product Hunt AI active for launch discovery", () => {
    const sourcesBySlug = new Map(
      initialNewsSources.map((source) => [source.slug, source]),
    );

    expect(sourcesBySlug.get("product-hunt-ai")).toMatchObject({
      feedUrl: "https://www.producthunt.com/feed",
      homepageUrl:
        "https://www.producthunt.com/categories/artificial-intelligence",
      isActive: true,
      sourceType: "product_hunt",
    });
  });

  it("keeps GitHub Trending ready for open-source AI discovery", () => {
    const sourcesBySlug = new Map(
      initialNewsSources.map((source) => [source.slug, source]),
    );

    expect(sourcesBySlug.get("github-trending-ai")).toMatchObject({
      feedUrl: null,
      homepageUrl: "https://github.com/trending?l=&since=daily",
      isActive: true,
      sourceType: "github",
    });
  });

  it("keeps Hacker News ready for AI community discovery", () => {
    const sourcesBySlug = new Map(
      initialNewsSources.map((source) => [source.slug, source]),
    );

    expect(sourcesBySlug.get("hacker-news-ai")).toMatchObject({
      feedUrl: null,
      homepageUrl: "https://news.ycombinator.com/",
      isActive: true,
      sourceType: "hacker_news",
    });
  });

  it("keeps YC AI active for startup launch discovery", () => {
    const sourcesBySlug = new Map(
      initialNewsSources.map((source) => [source.slug, source]),
    );

    expect(sourcesBySlug.get("yc-ai")).toMatchObject({
      feedUrl: null,
      homepageUrl: "https://www.ycombinator.com/companies/industry/ai",
      isActive: true,
      sourceType: "yc",
    });
  });

  it("keeps the active RSS catalog broad enough for a live AI front page", () => {
    expect(
      initialNewsSources.filter((source) => source.isActive && source.feedUrl),
    ).toHaveLength(18);
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
