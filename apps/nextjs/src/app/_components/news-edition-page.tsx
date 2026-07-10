import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@acme/ui/button";

import type { NewsEditionPageData } from "../_data/news";
import { NewsEditionReaderLens } from "./news-edition-reader-lens";
import { NewsEditionStoryActions } from "./news-edition-story-actions";
import { formatNewsTime, getNewsTopicHref } from "./news-home-model";
import {
  getNewsStructuredDataUrl,
  stringifyNewsStructuredData,
} from "./news-structured-data";

const getEditionKindLabel = (kind: NewsEditionPageData["filter"]["kind"]) =>
  kind === "search"
    ? "Search Edition"
    : kind === "topic"
      ? "Topic Edition"
      : kind === "entity"
        ? "Entity Edition"
        : "Source Edition";

const newsEditionSiteName = "The New AI Times";

const newsEditionTopicTitles: Record<string, string> = {
  agent_product: "Agents",
  big_tech: "Big Tech",
  funding: "Funding",
  hot_take: "Hot Takes",
  market_map: "Market Maps",
  model_release: "Models",
  musk_ai: "Musk AI",
  new_concept: "New Concepts",
  open_source: "Open Source",
  other: "Other",
  policy: "Policy",
  product_hunt: "Product Hunt",
  research: "Research",
  security: "Security",
  yc_ai: "YC AI",
};

const newsEditionSearchRecoveryLinks = [
  {
    description: "Open active AI topic fronts.",
    href: "/topics",
    label: "Topics",
  },
  {
    description: "Scan source-led coverage.",
    href: "/sources",
    label: "Sources",
  },
  {
    description: "Review saved, read, and search signals.",
    href: "/reader",
    label: "Reader Center",
  },
  {
    description: "Reset or train For You from scratch.",
    href: "/reader/onboarding",
    label: "Set up For You",
  },
] as const;

export interface NewsEditionFacetEntry {
  countLabel: string;
  href: string;
  title: string;
  value: string;
}

export interface NewsEditionFacetNavigation {
  entities: NewsEditionFacetEntry[];
  sources: NewsEditionFacetEntry[];
  topics: NewsEditionFacetEntry[];
}

const formatEditionCount = ({
  count,
  plural,
  singular,
}: {
  count: number;
  plural?: string;
  singular: string;
}) => `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;

const formatEditionFacetTitle = (value: string) =>
  value
    .trim()
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getNewsEditionFacetValues = ({
  item,
  kind,
}: {
  item: NewsEditionPageData["items"][number];
  kind: "entity" | "source" | "topic";
}) => {
  if (kind === "topic") return [item.category];
  if (kind === "source") return [item.sourceSlug];

  const seenEntities = new Set<string>();

  return item.entities.flatMap((entity) => {
    const value = entity.trim();
    const key = value.toLowerCase();

    if (!value || seenEntities.has(key)) return [];

    seenEntities.add(key);
    return [value];
  });
};

const getNewsEditionFacetHref = ({
  kind,
  value,
}: {
  kind: "entity" | "source" | "topic";
  value: string;
}) =>
  kind === "topic"
    ? getNewsTopicHref(value)
    : kind === "entity"
      ? `/entities/${encodeURIComponent(value)}`
      : `/sources/${value}`;

const getNewsEditionFacetEntries = ({
  edition,
  kind,
}: {
  edition: NewsEditionPageData;
  kind: "entity" | "source" | "topic";
}) => {
  const groups = new Map<
    string,
    {
      items: NewsEditionPageData["items"];
      value: string;
    }
  >();

  for (const item of edition.items) {
    for (const value of getNewsEditionFacetValues({ item, kind })) {
      const groupKey = kind === "entity" ? value.toLowerCase() : value;
      const group = groups.get(groupKey) ?? { items: [], value };

      group.items.push(item);
      groups.set(groupKey, group);
    }
  }

  return Array.from(groups.values(), ({ items: groupItems, value }) => {
    const title =
      kind === "topic"
        ? (newsEditionTopicTitles[value] ?? formatEditionFacetTitle(value))
        : kind === "entity"
          ? value
          : (groupItems[0]?.sourceName ?? formatEditionFacetTitle(value));

    return {
      countLabel: formatEditionCount({
        count: groupItems.length,
        plural: "stories",
        singular: "story",
      }),
      href: getNewsEditionFacetHref({ kind, value }),
      title,
      value,
    };
  })
    .sort((left, right) => {
      const countDifference =
        Number.parseInt(right.countLabel, 10) -
        Number.parseInt(left.countLabel, 10);

      if (countDifference !== 0) return countDifference;

      return left.title.localeCompare(right.title);
    })
    .slice(0, 6);
};

export const getNewsEditionFacetNavigation = (
  edition: NewsEditionPageData,
): NewsEditionFacetNavigation => ({
  entities: getNewsEditionFacetEntries({ edition, kind: "entity" }),
  sources: getNewsEditionFacetEntries({ edition, kind: "source" }),
  topics: getNewsEditionFacetEntries({ edition, kind: "topic" }),
});

const getEditionCounts = (edition: NewsEditionPageData) => ({
  sourceCount: new Set(edition.items.map((item) => item.sourceSlug)).size,
  topicCount: new Set(edition.items.map((item) => item.category)).size,
});

const getEditionSummary = (edition: NewsEditionPageData) => {
  const { sourceCount, topicCount } = getEditionCounts(edition);

  if (edition.items.length === 0) {
    return edition.filter.kind === "search" && edition.filter.value
      ? `No matching stories are available for "${edition.filter.value}".`
      : `No matching stories are available for ${edition.filter.title}.`;
  }

  return `${edition.items.length} stories from ${sourceCount} sources across ${topicCount} topics.`;
};

const getNewsEditionPagePath = (edition: NewsEditionPageData) =>
  edition.filter.kind === "search"
    ? edition.filter.value
      ? `/search?q=${encodeURIComponent(edition.filter.value)}`
      : "/search"
    : edition.filter.kind === "topic"
      ? getNewsTopicHref(edition.filter.value)
      : edition.filter.kind === "entity"
        ? `/entities/${encodeURIComponent(edition.filter.value)}`
        : `/sources/${edition.filter.value}`;

const getNewsEditionMetadataDescription = (edition: NewsEditionPageData) => {
  if (edition.filter.kind === "search") {
    const query = edition.filter.value.trim();

    if (edition.items.length === 0) {
      return query
        ? `Search The New AI Times for "${query}".`
        : "Search The New AI Times for AI news.";
    }

    const { sourceCount, topicCount } = getEditionCounts(edition);
    const storyCountText = formatEditionCount({
      count: edition.items.length,
      plural: "stories",
      singular: "story",
    });
    const sourceCountText = formatEditionCount({
      count: sourceCount,
      singular: "source",
    });
    const topicCountText = formatEditionCount({
      count: topicCount,
      singular: "topic",
    });

    return `Search results for "${query}" on ${newsEditionSiteName}: ${storyCountText} from ${sourceCountText} across ${topicCountText}.`;
  }

  if (edition.items.length === 0) {
    return edition.filter.kind === "topic"
      ? `Latest ${edition.filter.title} AI news from ${newsEditionSiteName}.`
      : edition.filter.kind === "entity"
        ? `Latest AI news about ${edition.filter.title} from ${newsEditionSiteName}.`
        : `Latest AI news from ${edition.filter.title} on ${newsEditionSiteName}.`;
  }

  const { sourceCount, topicCount } = getEditionCounts(edition);
  const storyCountText = formatEditionCount({
    count: edition.items.length,
    plural: "stories",
    singular: "story",
  });
  const sourceCountText = formatEditionCount({
    count: sourceCount,
    singular: "source",
  });
  const topicCountText = formatEditionCount({
    count: topicCount,
    singular: "topic",
  });

  return edition.filter.kind === "topic"
    ? `Latest ${edition.filter.title} AI news from ${newsEditionSiteName}: ${storyCountText} from ${sourceCountText} across ${topicCountText}.`
    : edition.filter.kind === "entity"
      ? `Latest AI news about ${edition.filter.title} on ${newsEditionSiteName}: ${storyCountText} from ${sourceCountText} across ${topicCountText}.`
      : `Latest AI news from ${edition.filter.title} on ${newsEditionSiteName}: ${storyCountText} across ${topicCountText}.`;
};

export const getNewsEditionPageMetadata = ({
  edition,
}: {
  edition: NewsEditionPageData;
}): Metadata => {
  const title = `${edition.filter.title} | ${newsEditionSiteName}`;
  const description = getNewsEditionMetadataDescription(edition);
  const url = getNewsEditionPagePath(edition);

  return {
    alternates: {
      canonical: url,
    },
    description,
    openGraph: {
      description,
      siteName: newsEditionSiteName,
      title,
      type: "website",
      url,
    },
    ...(edition.filter.kind === "search"
      ? {
          robots: {
            follow: true,
            index: false,
          },
        }
      : {}),
    title,
    twitter: {
      card: "summary_large_image",
      description,
      title,
    },
  };
};

export const getNewsEditionPageStructuredData = ({
  edition,
  baseUrl,
}: {
  edition: NewsEditionPageData;
  baseUrl?: string;
}) => {
  const pageUrl = getNewsStructuredDataUrl({
    baseUrl,
    path: getNewsEditionPagePath(edition),
  });
  const listedItems = edition.items.slice(0, 20);

  return {
    "@context": "https://schema.org",
    "@type":
      edition.filter.kind === "search" ? "SearchResultsPage" : "CollectionPage",
    description: getNewsEditionMetadataDescription(edition),
    isPartOf: {
      "@type": "WebSite",
      name: newsEditionSiteName,
      url: getNewsStructuredDataUrl({ baseUrl, path: "/" }),
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: listedItems.map((item, index) => ({
        "@type": "ListItem",
        name: item.title,
        position: index + 1,
        url: getNewsStructuredDataUrl({
          baseUrl,
          path: `/news/${item.id}`,
        }),
      })),
      numberOfItems: listedItems.length,
    },
    name: edition.filter.title,
    url: pageUrl,
  };
};

export function NewsEditionPage({ edition }: { edition: NewsEditionPageData }) {
  const [lead, ...restItems] = edition.items;
  const secondaryItems = restItems.slice(0, 2);
  const riverItems = restItems.slice(2);
  const isPreview = edition.status !== "ready";
  const sourceCount = new Set(edition.items.map((item) => item.sourceSlug))
    .size;
  const topicCount = new Set(edition.items.map((item) => item.category)).size;
  const latestItem = edition.items[0];
  const structuredData = getNewsEditionPageStructuredData({ edition });
  const searchDefaultValue =
    edition.filter.kind === "search" ? edition.filter.value : "";
  const searchIntentQuery = searchDefaultValue.trim();
  const facetNavigation = getNewsEditionFacetNavigation(edition);
  const shouldShowSearchRecovery =
    edition.filter.kind === "search" && edition.items.length === 0;

  return (
    <main className="min-h-[100dvh] bg-[#f7f5ef] text-[#161616] transition-colors dark:bg-[#101010] dark:text-[#f4f1ea]">
      <script
        dangerouslySetInnerHTML={{
          __html: stringifyNewsStructuredData(structuredData),
        }}
        type="application/ld+json"
      />
      <header className="border-b border-[#161616] dark:border-[#f4f1ea]">
        <div className="container grid gap-5 py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <Link
              className="font-mono text-xs tracking-[0.18em] uppercase hover:underline"
              href="/"
            >
              The New AI Times
            </Link>
            <p className="mt-4 font-mono text-xs tracking-[0.18em] uppercase">
              {getEditionKindLabel(edition.filter.kind)}
            </p>
            <h1 className="mt-2 text-4xl leading-none font-black tracking-normal sm:text-6xl">
              {edition.filter.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4a4a4a] dark:text-[#c8c4ba]">
              {getEditionSummary(edition)}
            </p>
            <form
              action="/search"
              className="mt-5 grid max-w-2xl grid-cols-[minmax(0,1fr)_auto] border border-[#161616] bg-[#fffdf7] dark:border-[#f4f1ea] dark:bg-[#181818]"
              method="get"
            >
              <label className="sr-only" htmlFor="edition-search-query">
                Search AI news
              </label>
              <input
                aria-label="Search AI news"
                className="min-w-0 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-[#777168] dark:placeholder:text-[#9c958b]"
                defaultValue={searchDefaultValue}
                id="edition-search-query"
                name="q"
                placeholder="Search models, agents, funding"
                type="search"
              />
              <Button className="rounded-none border-0" type="submit">
                Search
              </Button>
            </form>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs lg:min-w-80">
            <div className="border border-[#161616]/25 bg-[#fffdf7] p-3 dark:border-[#f4f1ea]/20 dark:bg-[#181818]">
              <p className="text-[10px] tracking-[0.12em] uppercase">Stories</p>
              <p className="mt-1 text-2xl font-black">{edition.items.length}</p>
            </div>
            <div className="border border-[#161616]/25 bg-[#fffdf7] p-3 dark:border-[#f4f1ea]/20 dark:bg-[#181818]">
              <p className="text-[10px] tracking-[0.12em] uppercase">Sources</p>
              <p className="mt-1 text-2xl font-black">{sourceCount}</p>
            </div>
            <div className="border border-[#161616]/25 bg-[#fffdf7] p-3 dark:border-[#f4f1ea]/20 dark:bg-[#181818]">
              <p className="text-[10px] tracking-[0.12em] uppercase">Topics</p>
              <p className="mt-1 text-2xl font-black">{topicCount}</p>
            </div>
          </div>
        </div>
      </header>
      <NewsEditionReaderLens
        filter={edition.filter}
        isPreview={isPreview}
        items={edition.items}
      />
      {edition.filter.kind === "search" && searchIntentQuery ? (
        <section
          aria-label="Search intent memory"
          className="border-b border-[#161616]/25 bg-[#161616] text-[#f4f1ea] dark:border-[#f4f1ea]/20 dark:bg-[#f4f1ea] dark:text-[#161616]"
        >
          <div className="container grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <p className="font-mono text-xs tracking-[0.18em] uppercase">
                Search Intent
              </p>
              <h2 className="mt-2 text-2xl leading-tight font-black">
                {searchIntentQuery}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 opacity-80">
                This query becomes a recent For You signal, so matching stories
                can move up on the next personalized pass.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[auto_auto_auto]">
              <Button asChild className="rounded-none" variant="secondary">
                <Link href="/">For You</Link>
              </Button>
              <Button asChild className="rounded-none" variant="outline">
                <Link href="/reader">Reader Center</Link>
              </Button>
              <Button asChild className="rounded-none" variant="outline">
                <Link href="/reader#promote-search-intent">Promote Search</Link>
              </Button>
            </div>
          </div>
        </section>
      ) : null}
      {facetNavigation.topics.length > 0 ||
      facetNavigation.entities.length > 0 ||
      facetNavigation.sources.length > 0 ? (
        <section
          aria-label="Edition Index"
          className="border-b border-[#161616]/25 bg-[#eee9dd] dark:border-[#f4f1ea]/20 dark:bg-[#141414]"
        >
          <div className="container grid gap-4 py-5 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)] lg:items-start">
            <div>
              <p className="font-mono text-xs tracking-[0.18em] uppercase">
                Edition Index
              </p>
              <h2 className="mt-2 text-2xl leading-tight font-black">
                Topic, entity, and source map
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="min-w-0">
                <p className="font-mono text-[11px] tracking-[0.14em] text-[#5b5750] uppercase dark:text-[#bbb4aa]">
                  Topics
                </p>
                <div className="mt-3 grid gap-2">
                  {facetNavigation.topics.map((entry) => (
                    <Link
                      className="flex min-h-11 items-center justify-between gap-3 border-t border-[#161616]/25 py-2 text-sm hover:underline dark:border-[#f4f1ea]/20"
                      href={entry.href}
                      key={entry.value}
                    >
                      <span className="min-w-0 font-black">{entry.title}</span>
                      <span className="shrink-0 font-mono text-[11px] text-[#5b5750] dark:text-[#bbb4aa]">
                        {entry.countLabel}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[11px] tracking-[0.14em] text-[#5b5750] uppercase dark:text-[#bbb4aa]">
                  Entities
                </p>
                <div className="mt-3 grid gap-2">
                  {facetNavigation.entities.map((entry) => (
                    <Link
                      className="flex min-h-11 items-center justify-between gap-3 border-t border-[#161616]/25 py-2 text-sm hover:underline dark:border-[#f4f1ea]/20"
                      href={entry.href}
                      key={entry.value}
                    >
                      <span className="min-w-0 font-black">{entry.title}</span>
                      <span className="shrink-0 font-mono text-[11px] text-[#5b5750] dark:text-[#bbb4aa]">
                        {entry.countLabel}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[11px] tracking-[0.14em] text-[#5b5750] uppercase dark:text-[#bbb4aa]">
                  Sources
                </p>
                <div className="mt-3 grid gap-2">
                  {facetNavigation.sources.map((entry) => (
                    <Link
                      className="flex min-h-11 items-center justify-between gap-3 border-t border-[#161616]/25 py-2 text-sm hover:underline dark:border-[#f4f1ea]/20"
                      href={entry.href}
                      key={entry.value}
                    >
                      <span className="min-w-0 font-black">{entry.title}</span>
                      <span className="shrink-0 font-mono text-[11px] text-[#5b5750] dark:text-[#bbb4aa]">
                        {entry.countLabel}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="container grid gap-6 py-6">
        {lead ? (
          <div className="grid gap-5 border-b border-[#161616]/25 pb-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)] dark:border-[#f4f1ea]/20">
            <article className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(260px,0.55fr)]">
              <div>
                <p className="font-mono text-xs tracking-[0.18em] uppercase">
                  Lead Story
                </p>
                <h2 className="mt-2 text-3xl leading-tight font-black sm:text-5xl">
                  <Link href={`/news/${lead.id}`} className="hover:underline">
                    {lead.title}
                  </Link>
                </h2>
                <p className="mt-3 max-w-3xl text-base leading-7 text-[#4a4a4a] dark:text-[#c8c4ba]">
                  {lead.summary}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 font-mono text-[11px]">
                  <Link
                    className="border border-[#161616]/30 px-2 py-1 hover:bg-[#efe8dc] dark:border-[#f4f1ea]/30 dark:hover:bg-[#242424]"
                    href={`/sources/${lead.sourceSlug}`}
                  >
                    {lead.sourceName}
                  </Link>
                  <span className="border border-[#161616]/30 px-2 py-1 dark:border-[#f4f1ea]/30">
                    {formatNewsTime(lead.publishedAt)}
                  </span>
                  <span className="border border-[#161616]/30 px-2 py-1 dark:border-[#f4f1ea]/30">
                    Heat {Math.round(lead.trendScore)}
                  </span>
                </div>
                <NewsEditionStoryActions
                  isPreview={isPreview}
                  item={lead}
                  rankSlot={1}
                />
              </div>
              <Link
                aria-label={lead.title}
                className="min-h-64 border border-[#161616]/25 bg-[#ded8ca] bg-cover bg-center dark:border-[#f4f1ea]/20 dark:bg-[#242424]"
                href={`/news/${lead.id}`}
                style={
                  lead.imageUrl
                    ? { backgroundImage: `url(${lead.imageUrl})` }
                    : undefined
                }
              />
            </article>

            <aside className="grid content-start gap-3">
              <p className="font-mono text-xs tracking-[0.18em] uppercase">
                Also In This Edition
              </p>
              {secondaryItems.length > 0 ? (
                secondaryItems.map((item, index) => (
                  <article
                    key={item.id}
                    className="border-t border-[#161616]/25 pt-3 dark:border-[#f4f1ea]/20"
                  >
                    <p className="font-mono text-[11px] text-[#5b5750] dark:text-[#bbb4aa]">
                      <Link
                        className="hover:underline"
                        href={`/sources/${item.sourceSlug}`}
                      >
                        {item.sourceName}
                      </Link>{" "}
                      / {formatNewsTime(item.publishedAt)}
                    </p>
                    <h3 className="mt-2 text-lg leading-snug font-black">
                      <Link
                        href={`/news/${item.id}`}
                        className="hover:underline"
                      >
                        {item.title}
                      </Link>
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                      {item.summary}
                    </p>
                    <NewsEditionStoryActions
                      isPreview={isPreview}
                      item={item}
                      rankSlot={index + 2}
                    />
                  </article>
                ))
              ) : (
                <p className="border-t border-[#161616]/25 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/20 dark:text-[#bbb4aa]">
                  More stories will appear here after the next refresh.
                </p>
              )}
            </aside>
          </div>
        ) : (
          <div className="border border-[#161616]/25 bg-[#fffdf7] p-6 dark:border-[#f4f1ea]/20 dark:bg-[#181818]">
            <p className="font-mono text-xs tracking-[0.18em] uppercase">
              No matching stories
            </p>
            <h2 className="mt-2 text-3xl font-black">No matching stories</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
              This edition will fill in after the next crawl or when matching
              preview stories are available.
            </p>
            {shouldShowSearchRecovery ? (
              <div className="mt-5 border-t border-[#161616]/25 pt-5 dark:border-[#f4f1ea]/20">
                <p className="font-mono text-xs tracking-[0.18em] uppercase">
                  Search Recovery
                </p>
                <h3 className="mt-2 text-xl leading-tight font-black">
                  Keep moving from {searchIntentQuery || "AI news"}
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {newsEditionSearchRecoveryLinks.map((entry) => (
                    <Link
                      className="min-h-24 border border-[#161616]/25 p-3 hover:bg-[#eee9dd] hover:no-underline dark:border-[#f4f1ea]/20 dark:hover:bg-[#242424]"
                      href={entry.href}
                      key={entry.href}
                    >
                      <span className="block text-sm font-black">
                        {entry.label}
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {entry.description}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            <Button asChild className="mt-4 rounded-none" variant="outline">
              <Link href="/">Back to front page</Link>
            </Button>
          </div>
        )}

        {riverItems.length > 0 ? (
          <div
            aria-label="Edition story river"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {riverItems.map((item, index) => (
              <article
                key={item.id}
                className="border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20"
              >
                <p className="font-mono text-[11px] text-[#5b5750] dark:text-[#bbb4aa]">
                  <Link
                    className="hover:underline"
                    href={`/sources/${item.sourceSlug}`}
                  >
                    {item.sourceName}
                  </Link>{" "}
                  / {formatNewsTime(item.publishedAt)}
                </p>
                <h3 className="mt-2 text-xl leading-snug font-black">
                  <Link href={`/news/${item.id}`} className="hover:underline">
                    {item.title}
                  </Link>
                </h3>
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {item.summary}
                </p>
                <NewsEditionStoryActions
                  isPreview={isPreview}
                  item={item}
                  rankSlot={index + 4}
                />
              </article>
            ))}
          </div>
        ) : null}

        {latestItem ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
            <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
              Latest story in this edition:{" "}
              {formatNewsTime(latestItem.publishedAt)}
            </p>
            <Button asChild className="rounded-none" variant="outline">
              <Link href="/">Back to front page</Link>
            </Button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
