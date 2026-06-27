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

  it("uses unique slugs for every source", () => {
    const slugs = initialNewsSources.map((source) => source.slug);
    const uniqueSlugs = new Set(slugs);

    expect(uniqueSlugs.size).toBe(slugs.length);
  });

  it("validates every source against the DB insert schema", () => {
    expect(initialNewsSources.length).toBeGreaterThanOrEqual(10);
  });
});
