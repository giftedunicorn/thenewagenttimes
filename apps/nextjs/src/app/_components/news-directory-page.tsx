import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@acme/ui/button";

import type {
  NewsDeskSourceHealthDiagnostic,
  NewsDeskStatus,
  NewsHomeItem,
  NewsHomeStatus,
} from "./news-home-model";
import { NewsDirectoryFollowButton } from "./news-directory-follow-controls";
import { NewsDirectoryReaderLens } from "./news-directory-reader-lens";
import { NewsEditionStoryActions } from "./news-edition-story-actions";
import {
  formatNewsTime,
  getNewsDeskRunYieldLabel,
  getNewsDeskSourceHealthDiagnostics,
  getNewsTopicHref,
} from "./news-home-model";

export type NewsDirectoryPageKind = "entity" | "source" | "topic";

export interface NewsDirectoryPageEntry {
  countLabel: string;
  href: string;
  latestItem: NewsHomeItem;
  metricLabel: string;
  title: string;
  value: string;
}

export interface NewsDirectoryPageHealth {
  diagnostics?: NewsDeskSourceHealthDiagnostic[];
  metrics: {
    label: string;
    value: string;
  }[];
  summary: string;
}

export interface NewsDirectoryPageData {
  description: string;
  entries: NewsDirectoryPageEntry[];
  health: NewsDirectoryPageHealth;
  kind: NewsDirectoryPageKind;
  status: NewsHomeStatus;
  title: string;
}

const newsDirectorySiteName = "The New AI Times";

const newsDirectoryTopicTitles: Record<string, string> = {
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

const formatDirectoryTitle = (value: string) =>
  value
    .trim()
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatDirectoryCount = ({
  count,
  plural,
  singular,
}: {
  count: number;
  plural?: string;
  singular: string;
}) => `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;

const getPublishedAtTime = (item: Pick<NewsHomeItem, "publishedAt">) => {
  const date = new Date(item.publishedAt);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const getLatestDirectoryItem = (items: readonly NewsHomeItem[]) =>
  items.reduce<NewsHomeItem | null>((latestItem, item) => {
    if (!latestItem) return item;

    return getPublishedAtTime(item) > getPublishedAtTime(latestItem)
      ? item
      : latestItem;
  }, null);

const getUniqueDirectoryValueCount = (
  items: readonly NewsHomeItem[],
  getValue: (item: NewsHomeItem) => string,
) => new Set(items.map(getValue)).size;

const getDirectoryBalanceLabel = ({
  dominantCount,
  totalCount,
}: {
  dominantCount: number;
  totalCount: number;
}) => {
  if (totalCount === 0) return "Empty";

  return dominantCount / totalCount >= 0.5 ? "Concentrated" : "Balanced";
};

const getDirectoryDescription = (kind: NewsDirectoryPageKind) =>
  kind === "topic"
    ? `Browse ${newsDirectorySiteName} by AI topic, with live counts and the latest lead from each section.`
    : kind === "entity"
      ? `Browse ${newsDirectorySiteName} by AI company, product, person, or concept entity, with live counts and the latest lead from each signal.`
      : `Browse ${newsDirectorySiteName} by source, with coverage volume and the latest story from each feed.`;

const getDirectoryPageTitle = (kind: NewsDirectoryPageKind) =>
  kind === "topic" ? "Topics" : kind === "entity" ? "Entities" : "Sources";

const getDirectoryPagePath = (kind: NewsDirectoryPageKind) =>
  kind === "topic" ? "/topics" : kind === "entity" ? "/entities" : "/sources";

const getDirectorySectionMetricLabel = (kind: NewsDirectoryPageKind) =>
  kind === "topic"
    ? "Topic sections"
    : kind === "entity"
      ? "Entity signals"
      : "Source feeds";

const getDirectoryBreadthMetricLabel = (kind: NewsDirectoryPageKind) =>
  kind === "source" ? "Topic breadth" : "Source breadth";

const getDirectoryEntryValues = ({
  item,
  kind,
}: {
  item: NewsHomeItem;
  kind: NewsDirectoryPageKind;
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

const getDirectoryEntryHref = ({
  kind,
  value,
}: {
  kind: NewsDirectoryPageKind;
  value: string;
}) =>
  kind === "topic"
    ? getNewsTopicHref(value)
    : kind === "entity"
      ? `/entities/${encodeURIComponent(value)}`
      : `/sources/${value}`;

const getDirectoryEntryTitle = ({
  kind,
  latestItem,
  value,
}: {
  kind: NewsDirectoryPageKind;
  latestItem: NewsHomeItem;
  value: string;
}) =>
  kind === "topic"
    ? (newsDirectoryTopicTitles[value] ?? formatDirectoryTitle(value))
    : kind === "entity"
      ? value
      : latestItem.sourceName;

const getDirectoryRelatedValue = ({
  item,
  kind,
}: {
  item: NewsHomeItem;
  kind: NewsDirectoryPageKind;
}) => (kind === "source" ? item.category : item.sourceSlug);

const getDirectoryRelatedSingular = (kind: NewsDirectoryPageKind) =>
  kind === "source" ? "topic" : "source";

const getNewsDirectorySourceHealthDetails = (
  deskStatus: NewsDeskStatus | undefined,
) => {
  const run = deskStatus?.latestRun;
  const sourceHealth = run?.sourceHealth;

  if (!sourceHealth) return null;

  const healthyCount = sourceHealth.healthySourceSlugs.length;
  const attentionCount =
    sourceHealth.failedSourceSlugs.length +
    sourceHealth.emptySourceSlugs.length;
  const checkedCount = healthyCount + attentionCount;
  const diagnostics = getNewsDeskSourceHealthDiagnostics(run);

  return {
    diagnostics,
    metrics: [
      { label: "Healthy feeds", value: String(healthyCount) },
      { label: "Attention feeds", value: String(attentionCount) },
      { label: "Run yield", value: getNewsDeskRunYieldLabel(run) },
    ],
    summarySuffix:
      checkedCount > 0
        ? ` Latest refresh checked ${formatDirectoryCount({
            count: checkedCount,
            singular: "feed",
          })}: ${healthyCount} healthy, ${attentionCount} ${
            attentionCount === 1 ? "needs" : "need"
          } attention.`
        : "",
  };
};

const appendNewsDirectorySourceHealth = ({
  deskStatus,
  health,
}: {
  deskStatus: NewsDeskStatus | undefined;
  health: NewsDirectoryPageHealth;
}): NewsDirectoryPageHealth => {
  const sourceHealth = getNewsDirectorySourceHealthDetails(deskStatus);

  if (!sourceHealth) return health;

  return {
    ...(sourceHealth.diagnostics.length > 0
      ? { diagnostics: sourceHealth.diagnostics }
      : {}),
    metrics: [...health.metrics, ...sourceHealth.metrics],
    summary: `${health.summary}${sourceHealth.summarySuffix}`,
  };
};

const getNewsDirectoryPageHealth = ({
  deskStatus,
  entries,
  items,
  kind,
}: {
  deskStatus?: NewsDeskStatus;
  entries: readonly NewsDirectoryPageEntry[];
  items: readonly NewsHomeItem[];
  kind: NewsDirectoryPageKind;
}): NewsDirectoryPageHealth => {
  const storyCount = items.length;
  const topicCount = getUniqueDirectoryValueCount(
    items,
    (item) => item.category,
  );
  const sourceCount = getUniqueDirectoryValueCount(
    items,
    (item) => item.sourceSlug,
  );
  const latestItem = getLatestDirectoryItem(items);
  const dominantEntry = entries[0] ?? null;
  const dominantCount = dominantEntry
    ? Number.parseInt(dominantEntry.countLabel, 10)
    : 0;
  const balanceLabel = getDirectoryBalanceLabel({
    dominantCount,
    totalCount: storyCount,
  });

  if (!dominantEntry) {
    return appendNewsDirectorySourceHealth({
      deskStatus,
      health: {
        metrics: [
          {
            label: "Coverage",
            value: formatDirectoryCount({ count: 0, singular: "story" }),
          },
          {
            label: getDirectorySectionMetricLabel(kind),
            value: "0",
          },
          {
            label: getDirectoryBreadthMetricLabel(kind),
            value: "0",
          },
          { label: "Latest", value: "None" },
          { label: "Balance", value: balanceLabel },
        ],
        summary: "No published stories are available for this directory yet.",
      },
    });
  }

  return appendNewsDirectorySourceHealth({
    deskStatus,
    health: {
      metrics: [
        {
          label: "Coverage",
          value: formatDirectoryCount({
            count: storyCount,
            plural: "stories",
            singular: "story",
          }),
        },
        {
          label: getDirectorySectionMetricLabel(kind),
          value: String(entries.length),
        },
        {
          label: getDirectoryBreadthMetricLabel(kind),
          value: String(kind === "source" ? topicCount : sourceCount),
        },
        { label: "Latest", value: latestItem?.title ?? "None" },
        { label: "Balance", value: balanceLabel },
      ],
      summary: `${formatDirectoryCount({
        count: storyCount,
        plural: "stories",
        singular: "story",
      })} across ${formatDirectoryCount({
        count: topicCount,
        singular: "topic",
      })} and ${formatDirectoryCount({
        count: sourceCount,
        singular: "source",
      })}. ${dominantEntry.title} leads with ${formatDirectoryCount({
        count: dominantCount,
        plural: "stories",
        singular: "story",
      })}.`,
    },
  });
};

export const getNewsDirectoryPageMetadata = ({
  kind,
}: {
  kind: NewsDirectoryPageKind;
}): Metadata => {
  const title = getDirectoryPageTitle(kind);
  const description = getDirectoryDescription(kind);
  const path = getDirectoryPagePath(kind);

  return {
    alternates: {
      canonical: path,
    },
    description,
    openGraph: {
      description,
      siteName: newsDirectorySiteName,
      title: `${title} | ${newsDirectorySiteName}`,
      type: "website",
      url: path,
    },
    title: `${title} | ${newsDirectorySiteName}`,
    twitter: {
      card: "summary_large_image",
      description,
      title: `${title} | ${newsDirectorySiteName}`,
    },
  };
};

export const getNewsDirectoryPageData = ({
  deskStatus,
  kind,
  items,
  status = "ready",
}: {
  deskStatus?: NewsDeskStatus;
  kind: NewsDirectoryPageKind;
  items: readonly NewsHomeItem[];
  status?: NewsHomeStatus;
}): NewsDirectoryPageData => {
  const groups = new Map<
    string,
    {
      items: NewsHomeItem[];
      value: string;
    }
  >();

  for (const item of items) {
    for (const value of getDirectoryEntryValues({ item, kind })) {
      const groupKey = kind === "entity" ? value.toLowerCase() : value;
      const group = groups.get(groupKey) ?? { items: [], value };

      group.items.push(item);
      groups.set(groupKey, group);
    }
  }

  const entries = Array.from(
    groups.values(),
    ({ items: groupItems, value }) => {
      const latestItem = getLatestDirectoryItem(groupItems);

      if (!latestItem) return null;

      const relatedValues = new Set(
        groupItems.map((item) => getDirectoryRelatedValue({ item, kind })),
      );
      const title = getDirectoryEntryTitle({ kind, latestItem, value });

      return {
        countLabel: formatDirectoryCount({
          count: groupItems.length,
          plural: "stories",
          singular: "story",
        }),
        href: getDirectoryEntryHref({ kind, value }),
        latestItem,
        metricLabel: formatDirectoryCount({
          count: relatedValues.size,
          singular: getDirectoryRelatedSingular(kind),
        }),
        title,
        value,
      };
    },
  )
    .filter((entry): entry is NewsDirectoryPageEntry => entry !== null)
    .sort((left, right) => {
      const countDifference =
        Number.parseInt(right.countLabel, 10) -
        Number.parseInt(left.countLabel, 10);

      if (countDifference !== 0) return countDifference;

      const latestDifference =
        getPublishedAtTime(right.latestItem) -
        getPublishedAtTime(left.latestItem);

      if (latestDifference !== 0) return latestDifference;

      return left.title.localeCompare(right.title);
    });

  return {
    description: getDirectoryDescription(kind),
    entries,
    health: getNewsDirectoryPageHealth({ deskStatus, entries, items, kind }),
    kind,
    status,
    title: getDirectoryPageTitle(kind),
  };
};

export function NewsDirectoryPage({
  directory,
}: {
  directory: NewsDirectoryPageData;
}) {
  const secondaryMetricLabel = getDirectoryBreadthMetricLabel(directory.kind);
  const isPreview = directory.status !== "ready";
  const sourceDiagnostics = directory.health.diagnostics ?? [];

  return (
    <main className="min-h-[100dvh] bg-[#f7f5ef] text-[#161616] transition-colors dark:bg-[#101010] dark:text-[#f4f1ea]">
      <header className="border-b border-[#161616] dark:border-[#f4f1ea]">
        <div className="container grid gap-4 py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <Link
              className="font-mono text-xs tracking-[0.18em] uppercase hover:underline"
              href="/"
            >
              The New AI Times
            </Link>
            <p className="mt-4 font-mono text-xs tracking-[0.18em] uppercase">
              Directory
            </p>
            <h1 className="mt-2 text-4xl leading-none font-black tracking-normal sm:text-6xl">
              {directory.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4a4a4a] dark:text-[#c8c4ba]">
              {directory.description}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center font-mono text-xs lg:min-w-72">
            <div className="border border-[#161616]/25 bg-[#fffdf7] p-3 dark:border-[#f4f1ea]/20 dark:bg-[#181818]">
              <p className="text-[10px] tracking-[0.12em] uppercase">
                Sections
              </p>
              <p className="mt-1 text-2xl font-black">
                {directory.entries.length}
              </p>
            </div>
            <div className="border border-[#161616]/25 bg-[#fffdf7] p-3 dark:border-[#f4f1ea]/20 dark:bg-[#181818]">
              <p className="text-[10px] tracking-[0.12em] uppercase">Latest</p>
              <p className="mt-1 text-2xl font-black">
                {directory.entries[0]
                  ? formatNewsTime(directory.entries[0].latestItem.publishedAt)
                  : "None"}
              </p>
            </div>
          </div>
        </div>
      </header>
      <NewsDirectoryReaderLens directory={directory} />

      <section className="container py-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <aside className="border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
            <p className="font-mono text-xs tracking-[0.18em] uppercase">
              Index
            </p>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
              Use this directory to jump into the sections that already have
              coverage in the current edition.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild className="rounded-none" variant="outline">
                <Link href="/">Front page</Link>
              </Button>
              <Button asChild className="rounded-none" variant="outline">
                <Link
                  href={directory.kind === "topic" ? "/sources" : "/topics"}
                >
                  {directory.kind === "topic" ? "Sources" : "Topics"}
                </Link>
              </Button>
            </div>
            <div className="mt-6 border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
              <h2 className="text-xl font-black">Aggregation Health</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                {directory.health.summary}
              </p>
              <dl className="mt-4 grid gap-2 text-sm">
                {directory.health.metrics.map((metric) => (
                  <div
                    className="flex justify-between gap-4 border-t border-[#161616]/15 pt-2 dark:border-[#f4f1ea]/15"
                    key={metric.label}
                  >
                    <dt className="text-[#5b5750] dark:text-[#bbb4aa]">
                      {metric.label}
                    </dt>
                    <dd className="max-w-48 text-right font-mono">
                      {metric.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {sourceDiagnostics.length > 0 ? (
                <div className="mt-5 border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
                  <h3 className="text-sm leading-5 font-black">
                    Source feed diagnostics
                  </h3>
                  <div className="mt-3 grid gap-3">
                    {sourceDiagnostics.map((diagnostic) => (
                      <article
                        className="grid gap-1 border-t border-[#161616]/15 pt-3 dark:border-[#f4f1ea]/15"
                        key={`${diagnostic.state}-${diagnostic.label}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 font-mono text-sm">
                            {diagnostic.label}
                          </p>
                          <span className="shrink-0 border border-[#161616]/25 px-2 py-0.5 font-mono text-[10px] uppercase dark:border-[#f4f1ea]/20">
                            {diagnostic.state}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                          {diagnostic.detail}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </aside>

          <div className="border-t border-[#161616] dark:border-[#f4f1ea]">
            <div className="hidden grid-cols-[minmax(0,1fr)_110px_130px_90px_96px] gap-3 border-b border-[#161616]/25 py-2 font-mono text-[10px] tracking-[0.12em] uppercase md:grid dark:border-[#f4f1ea]/20">
              <span>Section</span>
              <span>Stories</span>
              <span>{secondaryMetricLabel}</span>
              <span>Latest</span>
              <span>Action</span>
            </div>
            {directory.entries.length > 0 ? (
              directory.entries.map((entry, index) => (
                <article
                  className="grid gap-3 border-b border-[#161616]/25 py-4 md:grid-cols-[minmax(0,1fr)_110px_130px_90px_96px] md:items-start dark:border-[#f4f1ea]/20"
                  key={entry.value}
                >
                  <div className="min-w-0">
                    <h2 className="text-2xl leading-tight font-black">
                      <Link className="hover:underline" href={entry.href}>
                        {entry.title}
                      </Link>
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                      Latest:{" "}
                      <Link
                        className="font-semibold text-[#161616] hover:underline dark:text-[#f4f1ea]"
                        href={`/news/${entry.latestItem.id}`}
                      >
                        {entry.latestItem.title}
                      </Link>
                    </p>
                    <NewsEditionStoryActions
                      isPreview={isPreview}
                      item={entry.latestItem}
                      rankSlot={index + 1}
                    />
                  </div>
                  <p className="font-mono text-sm">{entry.countLabel}</p>
                  <p className="font-mono text-sm">{entry.metricLabel}</p>
                  <p className="font-mono text-sm">
                    {formatNewsTime(entry.latestItem.publishedAt)}
                  </p>
                  <NewsDirectoryFollowButton
                    entry={entry}
                    kind={directory.kind}
                    status={directory.status}
                  />
                </article>
              ))
            ) : (
              <div className="py-8">
                <h2 className="text-2xl font-black">No sections yet</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  Sections appear here after published stories are available.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
