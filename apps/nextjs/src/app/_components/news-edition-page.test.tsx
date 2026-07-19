import { readFile } from "node:fs/promises";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { NewsEditionPageData } from "../_data/news";
import type { NewsHomeItem } from "./news-home-model";
import { TRPCReactProvider } from "~/trpc/react";
import {
  getNewsEditionFacetNavigation,
  getNewsEditionPageMetadata,
  getNewsEditionPageStructuredData,
  NewsEditionPage,
} from "./news-edition-page";

const globalWithReact = globalThis as typeof globalThis & {
  React: typeof React;
};

globalWithReact.React = React;

const createStory = ({
  category = "agent_product",
  id,
  sourceSlug,
  title,
}: {
  category?: string;
  id: string;
  sourceSlug: string;
  title: string;
}): NewsHomeItem => ({
  canonicalUrl: `https://example.com/${id}`,
  category,
  clusterKey: id,
  entities: ["OpenAI"],
  id,
  imageUrl: null,
  originalUrl: `https://example.com/original/${id}`,
  publishedAt: "2026-07-06T08:35:00.000Z",
  sourceName: sourceSlug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" "),
  sourceScore: 84,
  sourceSlug,
  sourceType: "rss",
  summary: `${title} summary.`,
  tags: ["workflow"],
  title,
  trendScore: 89,
});

const countOccurrences = (text: string, value: string) =>
  text.split(value).length - 1;

const renderEditionPageMarkup = (edition: NewsEditionPageData) =>
  renderToStaticMarkup(
    React.createElement(
      TRPCReactProvider,
      null,
      React.createElement(NewsEditionPage, { edition }),
    ),
  );

describe("NewsEditionPage", () => {
  it("builds topic, entity, and source facets from edition stories", () => {
    const edition: NewsEditionPageData = {
      filter: {
        kind: "search",
        title: "Search: agents",
        value: "agents",
      },
      items: [
        createStory({
          id: "agent-lead",
          sourceSlug: "model-desk",
          title: "Agent lead",
        }),
        createStory({
          category: "model_release",
          id: "model-followup",
          sourceSlug: "model-desk",
          title: "Model followup",
        }),
        createStory({
          id: "agent-source",
          sourceSlug: "agent-desk",
          title: "Agent source",
        }),
      ],
      status: "ready",
    };

    expect(getNewsEditionFacetNavigation(edition)).toEqual({
      entities: [
        {
          countLabel: "3 stories",
          href: "/entities/OpenAI",
          title: "OpenAI",
          value: "OpenAI",
        },
      ],
      sources: [
        {
          countLabel: "2 stories",
          href: "/sources/model-desk",
          title: "Model Desk",
          value: "model-desk",
        },
        {
          countLabel: "1 story",
          href: "/sources/agent-desk",
          title: "Agent Desk",
          value: "agent-desk",
        },
      ],
      topics: [
        {
          countLabel: "2 stories",
          href: "/topics/agent-product",
          title: "Agents",
          value: "agent_product",
        },
        {
          countLabel: "1 story",
          href: "/topics/model-release",
          title: "Models",
          value: "model_release",
        },
      ],
    });
  });

  it("creates topic edition metadata for searchable section pages", () => {
    const edition: NewsEditionPageData = {
      filter: {
        kind: "topic",
        title: "Agents",
        value: "agent_product",
      },
      items: [
        createStory({
          id: "lead-story",
          sourceSlug: "agent-product-desk",
          title: "Lead agent workflow story",
        }),
        createStory({
          id: "river-story",
          sourceSlug: "recommendation-desk",
          title: "Recommendation story",
        }),
      ],
      status: "ready",
    };

    expect(getNewsEditionPageMetadata({ edition })).toEqual({
      alternates: {
        canonical: "/topics/agent-product",
      },
      description:
        "Latest Agents AI news from The New AI Times: 2 stories from 2 sources across 1 topic.",
      openGraph: {
        description:
          "Latest Agents AI news from The New AI Times: 2 stories from 2 sources across 1 topic.",
        siteName: "The New AI Times",
        title: "Agents | The New AI Times",
        type: "website",
        url: "/topics/agent-product",
      },
      title: "Agents | The New AI Times",
      twitter: {
        card: "summary_large_image",
        description:
          "Latest Agents AI news from The New AI Times: 2 stories from 2 sources across 1 topic.",
        title: "Agents | The New AI Times",
      },
    });
  });

  it("creates CollectionPage JSON-LD for a topic edition", () => {
    const edition: NewsEditionPageData = {
      filter: {
        kind: "topic",
        title: "Agents",
        value: "agent_product",
      },
      items: [
        createStory({
          id: "lead-story",
          sourceSlug: "agent-product-desk",
          title: "Lead agent workflow story",
        }),
        createStory({
          id: "river-story",
          sourceSlug: "recommendation-desk",
          title: "Recommendation story",
        }),
      ],
      status: "ready",
    };

    expect(
      getNewsEditionPageStructuredData({
        baseUrl: "https://thenewaitimes.test",
        edition,
      }),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      description:
        "Latest Agents AI news from The New AI Times: 2 stories from 2 sources across 1 topic.",
      isPartOf: {
        "@type": "WebSite",
        name: "The New AI Times",
        url: "https://thenewaitimes.test/",
      },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: [
          {
            "@type": "ListItem",
            name: "Lead agent workflow story",
            position: 1,
            url: "https://thenewaitimes.test/news/lead-story",
          },
          {
            "@type": "ListItem",
            name: "Recommendation story",
            position: 2,
            url: "https://thenewaitimes.test/news/river-story",
          },
        ],
        numberOfItems: 2,
      },
      name: "Agents",
      url: "https://thenewaitimes.test/topics/agent-product",
    });
  });

  it("creates source edition metadata for shareable source pages", () => {
    const edition: NewsEditionPageData = {
      filter: {
        kind: "source",
        title: "Recommendation Desk",
        value: "preview-recommendation-desk",
      },
      items: [
        createStory({
          id: "lead-story",
          sourceSlug: "preview-recommendation-desk",
          title: "Lead recommendation story",
        }),
      ],
      status: "empty",
    };

    expect(getNewsEditionPageMetadata({ edition })).toMatchObject({
      alternates: {
        canonical: "/sources/preview-recommendation-desk",
      },
      description:
        "Latest AI news from Recommendation Desk on The New AI Times: 1 story across 1 topic.",
      title: "Recommendation Desk | The New AI Times",
    });
  });

  it("creates noindex metadata and a canonical URL for shareable search pages", () => {
    const edition: NewsEditionPageData = {
      filter: {
        kind: "search",
        title: "Search: browser agents",
        value: "browser agents",
      },
      items: [
        createStory({
          id: "lead-story",
          sourceSlug: "agent-product-desk",
          title: "Lead browser agent story",
        }),
      ],
      status: "ready",
    };

    expect(getNewsEditionPageMetadata({ edition })).toMatchObject({
      alternates: {
        canonical: "/search?q=browser%20agents",
      },
      description:
        'Search results for "browser agents" on The New AI Times: 1 story from 1 source across 1 topic.',
      robots: {
        follow: true,
        index: false,
      },
      title: "Search: browser agents | The New AI Times",
    });
  });

  it("creates SearchResultsPage JSON-LD for a search edition", () => {
    const edition: NewsEditionPageData = {
      filter: {
        kind: "search",
        title: "Search: browser agents",
        value: "browser agents",
      },
      items: [
        createStory({
          id: "lead-story",
          sourceSlug: "agent-product-desk",
          title: "Lead browser agent story",
        }),
      ],
      status: "ready",
    };

    expect(
      getNewsEditionPageStructuredData({
        baseUrl: "https://thenewaitimes.test",
        edition,
      }),
    ).toMatchObject({
      "@type": "SearchResultsPage",
      name: "Search: browser agents",
      url: "https://thenewaitimes.test/search?q=browser%20agents",
    });
  });

  it("does not repeat lead and sidebar stories in the river", () => {
    const edition: NewsEditionPageData = {
      filter: {
        kind: "topic",
        title: "Agent Product",
        value: "agent_product",
      },
      items: [
        createStory({
          id: "lead-story",
          sourceSlug: "agent-product-desk",
          title: "Lead agent workflow story",
        }),
        createStory({
          id: "sidebar-story-one",
          sourceSlug: "recommendation-desk",
          title: "First sidebar story",
        }),
        createStory({
          id: "sidebar-story-two",
          sourceSlug: "model-desk",
          title: "Second sidebar story",
        }),
        createStory({
          id: "river-story",
          sourceSlug: "capital-desk",
          title: "River-only story",
        }),
      ],
      status: "ready",
    };

    const markup = renderEditionPageMarkup(edition);
    const riverMarkup =
      markup.split('aria-label="Edition story river"')[1] ?? "";

    expect(countOccurrences(markup, 'href="/news/lead-story"')).toBeGreaterThan(
      0,
    );
    expect(riverMarkup).not.toContain('href="/news/lead-story"');
    expect(riverMarkup).not.toContain('href="/news/sidebar-story-one"');
    expect(riverMarkup).not.toContain('href="/news/sidebar-story-two"');
    expect(riverMarkup).toContain('href="/news/river-story"');
  });

  it("renders reader feedback actions for lead, sidebar, and river stories", () => {
    const edition: NewsEditionPageData = {
      filter: {
        kind: "search",
        title: "Search: browser agents",
        value: "browser agents",
      },
      items: [
        createStory({
          id: "lead-story",
          sourceSlug: "agent-product-desk",
          title: "Lead browser agent story",
        }),
        createStory({
          id: "sidebar-story",
          sourceSlug: "model-desk",
          title: "Sidebar model story",
        }),
        createStory({
          id: "river-story",
          sourceSlug: "capital-desk",
          title: "River funding story",
        }),
        createStory({
          id: "second-river-story",
          sourceSlug: "research-desk",
          title: "Second river story",
        }),
      ],
      status: "ready",
    };

    const markup = renderEditionPageMarkup(edition);

    expect(markup).toContain(
      'aria-label="Reader actions: Lead browser agent story"',
    );
    expect(markup).toContain(
      'aria-label="Reader actions: Sidebar model story"',
    );
    expect(markup).toContain('aria-label="Reader actions: Second river story"');
    expect(markup).toContain("Save");
    expect(markup).toContain("Share");
    expect(markup).toContain("Less");
    expect(markup).toContain("Source");
  });

  it("links story source labels to source editions across the edition layout", () => {
    const edition: NewsEditionPageData = {
      filter: {
        kind: "search",
        title: "Search: browser agents",
        value: "browser agents",
      },
      items: [
        createStory({
          id: "lead-story",
          sourceSlug: "agent-product-desk",
          title: "Lead browser agent story",
        }),
        createStory({
          id: "sidebar-story",
          sourceSlug: "model-desk",
          title: "Sidebar model story",
        }),
        createStory({
          id: "river-story",
          sourceSlug: "capital-desk",
          title: "River funding story",
        }),
        createStory({
          id: "second-river-story",
          sourceSlug: "research-desk",
          title: "Second river story",
        }),
      ],
      status: "ready",
    };

    const markup = renderEditionPageMarkup(edition);

    expect(
      countOccurrences(markup, 'href="/sources/agent-product-desk"'),
    ).toBeGreaterThanOrEqual(2);
    expect(
      countOccurrences(markup, 'href="/sources/model-desk"'),
    ).toBeGreaterThanOrEqual(2);
    expect(
      countOccurrences(markup, 'href="/sources/research-desk"'),
    ).toBeGreaterThanOrEqual(2);
  });

  it("wires edition story actions into shared reader memory and profile storage", async () => {
    const [pageSource, actionsSource] = await Promise.all([
      readFile(new URL("./news-edition-page.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("./news-edition-story-actions.tsx", import.meta.url),
        "utf8",
      ),
    ]);

    expect(pageSource).toContain("NewsEditionStoryActions");
    expect(actionsSource).toContain("updateReaderProfileWithInteraction");
    expect(actionsSource).toContain("writeStoredNewsPreferenceProfile");
    expect(actionsSource).toContain("writeStoredNewsReaderMemoryItems");
    expect(actionsSource).toContain("writeStoredNewsPositiveFeedbackItems");
    expect(actionsSource).toContain("newsSavedStorageKey");
    expect(actionsSource).toContain("newsGuardrailStorageKey");
    expect(actionsSource).toContain("useTRPC");
    expect(actionsSource).toContain("trpc.news.recordInteraction");
    expect(actionsSource).toContain("trpc.news.restoreGuardrail");
    expect(actionsSource).toContain("trpc.news.removeSaved");
    expect(actionsSource).toContain("shouldPersistNewsHomeItemReaderSignals");
    expect(actionsSource).toContain("readOrCreateNewsVisitorKey");
    expect(actionsSource).toContain('"edition_feedback"');
    expect(actionsSource).toContain('"edition_source"');
    expect(actionsSource).toContain('"edition_read"');
  });

  it("renders an edition search form that routes searches through the search page", () => {
    const edition: NewsEditionPageData = {
      filter: {
        kind: "search",
        title: "Search: browser agents",
        value: "browser agents",
      },
      items: [
        createStory({
          id: "lead-story",
          sourceSlug: "agent-product-desk",
          title: "Lead browser agent story",
        }),
      ],
      status: "ready",
    };

    const markup = renderEditionPageMarkup(edition);

    expect(markup).toContain('action="/search"');
    expect(markup).toContain('method="get"');
    expect(markup).toContain('name="q"');
    expect(markup).toContain('value="browser agents"');
    expect(markup).toContain("Search AI news");
  });

  it("renders edition facet links for adjacent topic and source discovery", () => {
    const edition: NewsEditionPageData = {
      filter: {
        kind: "search",
        title: "Search: agents",
        value: "agents",
      },
      items: [
        createStory({
          id: "agent-lead",
          sourceSlug: "model-desk",
          title: "Agent lead",
        }),
        createStory({
          category: "model_release",
          id: "model-followup",
          sourceSlug: "model-desk",
          title: "Model followup",
        }),
        createStory({
          id: "agent-source",
          sourceSlug: "agent-desk",
          title: "Agent source",
        }),
      ],
      status: "ready",
    };

    const markup = renderEditionPageMarkup(edition);

    expect(markup).toContain("Edition Index");
    expect(markup).toContain('href="/topics/agent-product"');
    expect(markup).toContain('href="/topics/model-release"');
    expect(markup).toContain('href="/sources/model-desk"');
    expect(markup).toContain('href="/sources/agent-desk"');
    expect(markup).toContain("2 stories");
  });

  it("renders a visible search intent bridge back into For You", () => {
    const edition: NewsEditionPageData = {
      filter: {
        kind: "search",
        title: "Search: browser agents",
        value: "browser agents",
      },
      items: [
        createStory({
          id: "agent-lead",
          sourceSlug: "agent-desk",
          title: "Agent browser workflows expand",
        }),
        createStory({
          category: "model_release",
          id: "model-followup",
          sourceSlug: "model-desk",
          title: "Model releases add browser skills",
        }),
      ],
      status: "ready",
    };

    const markup = renderEditionPageMarkup(edition);

    expect(markup).toContain("Search Intent");
    expect(markup).toContain("browser agents");
    expect(markup).toContain("For You");
    expect(markup).toContain("Reader Center");
    expect(markup).toContain('href="/"');
    expect(markup).toContain('href="/reader"');
    expect(markup).toContain("Promote Search");
    expect(markup).toContain('href="/reader#promote-search-intent"');
  });

  it("renders recovery paths when a search edition has no matching stories", () => {
    const edition: NewsEditionPageData = {
      filter: {
        kind: "search",
        title: "Search: private model routers",
        value: "private model routers",
      },
      items: [],
      status: "ready",
    };

    const markup = renderEditionPageMarkup(edition);

    expect(markup).toContain("Search Recovery");
    expect(markup).toContain("private model routers");
    expect(markup).toContain('href="/topics"');
    expect(markup).toContain('href="/sources"');
    expect(markup).toContain('href="/reader"');
    expect(markup).toContain('href="/reader/onboarding"');
  });

  it("renders edition structured data in the page shell", () => {
    const edition: NewsEditionPageData = {
      filter: {
        kind: "source",
        title: "Recommendation Desk",
        value: "preview-recommendation-desk",
      },
      items: [
        createStory({
          id: "lead-story",
          sourceSlug: "preview-recommendation-desk",
          title: "Lead recommendation story",
        }),
      ],
      status: "ready",
    };

    const markup = renderEditionPageMarkup(edition);

    expect(markup).toContain('type="application/ld+json"');
    expect(markup).toContain('"@type":"CollectionPage"');
    expect(markup).toContain(
      '"url":"https://thenewaitimes.com/news/lead-story"',
    );
  });

  it("generates topic, source, entity, and search route metadata from edition data", async () => {
    const [topicSource, sourceSource, entitySource, searchSource] =
      await Promise.all([
        readFile(new URL("../topics/[category]/page.tsx", import.meta.url), {
          encoding: "utf8",
        }),
        readFile(new URL("../sources/[slug]/page.tsx", import.meta.url), {
          encoding: "utf8",
        }),
        readFile(new URL("../entities/[entity]/page.tsx", import.meta.url), {
          encoding: "utf8",
        }),
        readFile(new URL("../search/page.tsx", import.meta.url), {
          encoding: "utf8",
        }),
      ]);

    expect(topicSource).toContain("generateMetadata");
    expect(topicSource).toContain("getNewsEditionPageData({");
    expect(topicSource).toContain("parseNewsEditionTopicCategory(category)");
    expect(topicSource).toContain("getNewsTopicHref(parsedCategory.data)");
    expect(topicSource).toContain("redirect(canonicalHref)");
    expect(topicSource).toContain("getNewsEditionPageMetadata({");
    expect(sourceSource).toContain("generateMetadata");
    expect(sourceSource).toContain("getNewsEditionPageData({");
    expect(sourceSource).toContain("getNewsEditionPageMetadata({");
    expect(entitySource).toContain("generateMetadata");
    expect(entitySource).toContain("getNewsEditionPageData({");
    expect(entitySource).toContain('kind: "entity"');
    expect(entitySource).toContain("getNewsEditionPageMetadata({");
    expect(searchSource).toContain("searchParams");
    expect(searchSource).toContain('kind: "search"');
    expect(searchSource).toContain("<NewsEditionPage");
    expect(searchSource).toContain("getNewsEditionPageMetadata({");
  });
});
