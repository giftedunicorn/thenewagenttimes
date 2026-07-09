"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { NewsPreferenceProfile } from "@acme/validators";
import { Button } from "@acme/ui/button";
import {
  getNewsRecommendationAngleLabels,
  normalizeNewsPreferenceProfile,
} from "@acme/validators";

import type {
  NewsHomeItem,
  NewsHomeStatus,
  NewsReaderMemoryItem,
} from "./news-home-model";
import { useTRPC } from "~/trpc/react";
import { NewsEditionStoryActions } from "./news-edition-story-actions";
import {
  createDefaultNewsPreferenceProfile,
  formatNewsTime,
  getNewsTopicHref,
  mergeNewsReaderMemoryItems,
  selectActiveNewsReaderMemoryItem,
  selectHydratedNewsPreferenceProfile,
  shouldPersistNewsHomeItemReaderSignals,
  stripPersistedNewsPreferenceProfile,
} from "./news-home-model";
import {
  newsGuardrailStorageKey,
  readStoredNewsReaderMemoryItems,
  subscribeToNewsReaderMemoryStorage,
  writeStoredNewsReaderMemoryItems,
} from "./news-reader-memory-storage";
import {
  areNewsPreferenceProfilesEqual,
  emptyNewsPreferenceProfileSnapshot,
  parseStoredNewsPreferenceProfile,
  readNewsPreferenceProfileSnapshot,
  readOrCreateNewsVisitorKey,
  subscribeToNewsPreferenceProfileStorage,
  toNewsServerPreferenceProfileInput,
  writeStoredNewsPreferenceProfile,
} from "./news-reader-profile-storage";

interface NewsCoverageThreadsMetric {
  label: string;
  value: string;
}

export interface NewsCoverageThread {
  categoryLabel: string;
  href: string;
  key: string;
  latestAtLabel: string;
  lead: NewsHomeItem;
  readerFitLabel: string;
  readerSignals: string[];
  sourceCountLabel: string;
  storyCountLabel: string;
  stories: NewsHomeItem[];
  summary: string;
  threadHref: string;
  title: string;
  topicHref: string;
  trendLabel: string;
  verificationLabel: string;
  verificationSummary: string;
}

interface NewsCoverageThreadTimelineItem {
  href: string;
  item: NewsHomeItem;
  publishedAtLabel: string;
  sourceName: string;
  sourceScoreLabel: string;
  summary: string;
  title: string;
  trendLabel: string;
}

export interface NewsCoverageThreadDetail {
  metrics: NewsCoverageThreadsMetric[];
  statusLabel: string;
  summary: string;
  thread: NewsCoverageThread;
  timeline: NewsCoverageThreadTimelineItem[];
}

export interface NewsCoverageThreadsModel {
  metrics: NewsCoverageThreadsMetric[];
  summary: string;
  threads: NewsCoverageThread[];
}

interface NewsCoverageThreadSelectionInput {
  guardrailItems?: readonly NewsReaderMemoryItem[];
  items: readonly NewsHomeItem[];
}

const categoryLabels: Record<string, string> = {
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

const formatCategory = (category: string) =>
  categoryLabels[category] ?? category;

const formatCount = ({
  count,
  plural,
  singular,
}: {
  count: number;
  plural?: string;
  singular: string;
}) => `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;

const normalizeSignal = (value: string) => value.trim().toLowerCase();

const normalizeAngleSignal = (value: string) =>
  value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

const appendUniqueSignals = (
  existingSignals: readonly string[],
  nextSignals: readonly string[],
) => {
  const seenSignals = new Set(existingSignals.map(normalizeSignal));
  const mergedSignals = [...existingSignals];

  for (const signal of nextSignals) {
    const trimmedSignal = signal.trim();
    const normalizedSignal = normalizeSignal(trimmedSignal);

    if (!trimmedSignal || seenSignals.has(normalizedSignal)) continue;

    mergedSignals.push(trimmedSignal);
    seenSignals.add(normalizedSignal);
  }

  return mergedSignals;
};

const getThreadKey = (item: NewsHomeItem) => {
  const clusterKey = item.clusterKey?.trim();

  return clusterKey ? `cluster:${clusterKey}` : `topic:${item.category}`;
};

const getNewsCoverageThreadRouteKey = (threadKey: string) => {
  const [kind, ...valueParts] = threadKey.split(":");
  const value = valueParts.join(":").trim();

  if (kind === "cluster" && value) return encodeURIComponent(value);
  if (kind === "topic" && value) return `topic-${encodeURIComponent(value)}`;

  return encodeURIComponent(threadKey);
};

const getNewsCoverageThreadHref = (threadKey: string) =>
  `/threads/${getNewsCoverageThreadRouteKey(threadKey)}`;

const getThreadReaderSignalHref = (signal: string) => {
  const entityPrefix = "Entity: ";
  if (!signal.startsWith(entityPrefix)) return null;

  const entity = signal.slice(entityPrefix.length).trim();
  if (!entity) return null;

  return `/entities/${encodeURIComponent(entity)}`;
};

const normalizeThreadRouteKey = (threadKey: string) => {
  try {
    return decodeURIComponent(threadKey.trim());
  } catch {
    return threadKey.trim();
  }
};

const doesThreadRouteKeyMatch = ({
  item,
  threadKey,
}: {
  item: NewsHomeItem;
  threadKey: string;
}) => {
  const itemThreadKey = getThreadKey(item);
  const routeKey = getNewsCoverageThreadRouteKey(itemThreadKey);
  const normalizedRouteKey = normalizeThreadRouteKey(routeKey);
  const normalizedThreadKey = normalizeThreadRouteKey(threadKey);

  return routeKey === threadKey || normalizedRouteKey === normalizedThreadKey;
};

const getPublishedAtTime = (item: Pick<NewsHomeItem, "publishedAt">) => {
  const publishedAt = Date.parse(item.publishedAt);

  return Number.isFinite(publishedAt) ? publishedAt : 0;
};

const getLeadStory = (stories: readonly NewsHomeItem[]) =>
  [...stories].sort((left, right) => {
    const scoreDelta =
      right.trendScore +
      right.sourceScore / 10 -
      (left.trendScore + left.sourceScore / 10);

    if (scoreDelta !== 0) return scoreDelta;

    return getPublishedAtTime(right) - getPublishedAtTime(left);
  })[0];

const sortThreadStories = (stories: readonly NewsHomeItem[]) =>
  [...stories].sort((left, right) => {
    const publishedDelta = getPublishedAtTime(right) - getPublishedAtTime(left);

    if (publishedDelta !== 0) return publishedDelta;

    return right.trendScore - left.trendScore;
  });

const getUniqueSources = (stories: readonly NewsHomeItem[]) => {
  const sources = new Map<string, string>();

  for (const story of stories) {
    const slug = story.sourceSlug.trim();
    if (!slug) continue;

    sources.set(slug.toLowerCase(), story.sourceName);
  }

  return sources;
};

const getNewsCoverageThreadVerificationLabel = ({
  averageTrustScore,
  sourceCount,
}: {
  averageTrustScore: number;
  sourceCount: number;
}) =>
  sourceCount >= 2 && averageTrustScore >= 70
    ? "Verified thread"
    : "Developing thread";

const getNewsCoverageThreadVerificationSummary = ({
  averageTrustScore,
  sourceCount,
  sourceNames,
  storyCount,
}: {
  averageTrustScore: number;
  sourceCount: number;
  sourceNames: readonly string[];
  storyCount: number;
}) => {
  if (sourceCount >= 2 && averageTrustScore >= 70) {
    return `${sourceCount} independent ${
      sourceCount === 1 ? "source" : "sources"
    } with ${averageTrustScore} average trust support this thread.`;
  }

  if (sourceCount === 1) {
    return `${storyCount} ${
      storyCount === 1 ? "report" : "reports"
    } from ${sourceNames[0] ?? "one source"} ${
      storyCount === 1 ? "is" : "are"
    } still waiting for independent confirmation.`;
  }

  return `${sourceCount} independent ${
    sourceCount === 1 ? "source is" : "sources are"
  } still developing this thread with ${averageTrustScore} average trust.`;
};

const getThreadReaderSignals = ({
  profile,
  stories,
}: {
  profile: NewsPreferenceProfile;
  stories: readonly NewsHomeItem[];
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const preferredCategories = new Set(
    normalizedProfile.preferredCategories.map(normalizeSignal),
  );
  const preferredEntities = new Set(
    normalizedProfile.preferredEntities.map(normalizeSignal),
  );
  const preferredAngles = new Set(
    normalizedProfile.preferredEntities.map(normalizeAngleSignal),
  );
  const preferredSources = new Set(
    normalizedProfile.preferredSources.map(normalizeSignal),
  );
  const signals: string[] = [];
  const seenSignals = new Set<string>();

  const addSignal = (signal: string) => {
    const key = signal.toLowerCase();

    if (seenSignals.has(key)) return;

    signals.push(signal);
    seenSignals.add(key);
  };

  for (const story of stories) {
    if (preferredCategories.has(normalizeSignal(story.category))) {
      addSignal(`Topic: ${formatCategory(story.category)}`);
    }

    if (preferredSources.has(normalizeSignal(story.sourceSlug))) {
      addSignal(`Source: ${story.sourceName}`);
    }

    for (const entity of story.entities) {
      if (preferredEntities.has(normalizeSignal(entity))) {
        addSignal(`Entity: ${entity}`);
      }
    }

    for (const angle of getNewsRecommendationAngleLabels(story.tags)) {
      if (preferredAngles.has(normalizeAngleSignal(angle))) {
        addSignal(`Angle: ${angle}`);
      }
    }
  }

  return signals.slice(0, 6);
};

const toCoverageThread = ({
  key,
  profile,
  stories,
}: {
  key: string;
  profile: NewsPreferenceProfile;
  stories: readonly NewsHomeItem[];
}): NewsCoverageThread | null => {
  const lead = getLeadStory(stories);

  if (!lead) return null;

  const sortedStories = sortThreadStories(stories);
  const sources = getUniqueSources(stories);
  const sourceCount = sources.size;
  const readerSignals = getThreadReaderSignals({ profile, stories });
  const categoryLabel = formatCategory(lead.category);
  const storyCountLabel = formatCount({
    count: stories.length,
    plural: "stories",
    singular: "story",
  });
  const averageTrustScore = Math.round(
    stories.reduce((total, story) => total + story.sourceScore, 0) /
      stories.length,
  );
  const sourceCountLabel = formatCount({
    count: sourceCount,
    singular: "source",
  });

  return {
    categoryLabel,
    href: `/news/${lead.id}`,
    key,
    latestAtLabel: formatNewsTime(lead.publishedAt),
    lead,
    readerFitLabel:
      readerSignals.length > 0
        ? `${readerSignals.length} reader matches`
        : "Discovery thread",
    readerSignals,
    sourceCountLabel,
    storyCountLabel,
    stories: sortedStories,
    summary: `${categoryLabel} coverage led by ${lead.sourceName} with ${sourceCountLabel}.`,
    threadHref: getNewsCoverageThreadHref(key),
    title: lead.title,
    topicHref: getNewsTopicHref(lead.category),
    trendLabel: `Heat ${Math.round(lead.trendScore)}`,
    verificationLabel: getNewsCoverageThreadVerificationLabel({
      averageTrustScore,
      sourceCount,
    }),
    verificationSummary: getNewsCoverageThreadVerificationSummary({
      averageTrustScore,
      sourceCount,
      sourceNames: Array.from(sources.values()),
      storyCount: stories.length,
    }),
  };
};

const getThreadSortScore = (thread: NewsCoverageThread) =>
  thread.readerSignals.length * 1_000 +
  thread.lead.trendScore * 10 +
  getUniqueSources(thread.stories).size * 5 +
  thread.lead.sourceScore;

export const selectNewsCoverageThreadEligibleItems = ({
  guardrailItems = [],
  items,
}: NewsCoverageThreadSelectionInput) =>
  items.filter(
    (item) =>
      !selectActiveNewsReaderMemoryItem({
        item,
        memoryItems: guardrailItems,
      }),
  );

export const selectNewsCoverageThreads = ({
  guardrailItems = [],
  items,
  limit = 12,
  profile,
}: {
  guardrailItems?: readonly NewsReaderMemoryItem[];
  items: readonly NewsHomeItem[];
  limit?: number;
  profile: NewsPreferenceProfile;
}): NewsCoverageThreadsModel => {
  const eligibleItems = selectNewsCoverageThreadEligibleItems({
    guardrailItems,
    items,
  });
  const groups = new Map<string, NewsHomeItem[]>();

  for (const item of eligibleItems) {
    const key = getThreadKey(item);
    const group = groups.get(key);

    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  const threads = Array.from(groups.entries())
    .map(([key, stories]) => toCoverageThread({ key, profile, stories }))
    .filter((thread): thread is NewsCoverageThread => thread !== null)
    .sort((left, right) => getThreadSortScore(right) - getThreadSortScore(left))
    .slice(0, limit);
  const storyCount = eligibleItems.length;
  const sourceCount = new Set(eligibleItems.map((item) => item.sourceSlug))
    .size;
  const readerMatchCount = threads.filter(
    (thread) => thread.readerSignals.length > 0,
  ).length;
  const threadCount = threads.length;

  return {
    metrics: [
      { label: "Threads", value: String(threadCount) },
      { label: "Stories", value: String(storyCount) },
      { label: "Sources", value: String(sourceCount) },
      { label: "Reader matches", value: String(readerMatchCount) },
    ],
    summary:
      threadCount > 0
        ? `${formatCount({
            count: threadCount,
            singular: "coverage thread",
          })} group ${formatCount({
            count: storyCount,
            plural: "stories",
            singular: "story",
          })} across ${formatCount({
            count: sourceCount,
            singular: "source",
          })}. ${formatCount({
            count: readerMatchCount,
            singular: "thread",
          })} ${
            readerMatchCount === 1 ? "matches" : "match"
          } the active reader profile.`
        : "Coverage threads will appear after the edition has stories to group.",
    threads,
  };
};

export const applyNewsCoverageThreadFollow = ({
  profile,
  thread,
}: {
  profile: NewsPreferenceProfile;
  thread: NewsCoverageThread;
}): NewsPreferenceProfile =>
  normalizeNewsPreferenceProfile({
    ...profile,
    preferredCategories: appendUniqueSignals(profile.preferredCategories, [
      thread.lead.category,
    ]),
    preferredEntities: appendUniqueSignals(
      profile.preferredEntities,
      thread.stories.flatMap((story) => [
        ...story.entities,
        ...getNewsRecommendationAngleLabels(story.tags),
      ]),
    ),
    preferredSources: appendUniqueSignals(
      profile.preferredSources,
      thread.stories.map((story) => story.sourceSlug),
    ),
  });

export const getNewsCoverageThreadGuardrailItems = ({
  hiddenAt,
  thread,
}: {
  hiddenAt: string;
  thread: NewsCoverageThread;
}): NewsReaderMemoryItem[] =>
  thread.stories.map((story) => ({
    canonicalUrl: story.canonicalUrl,
    category: story.category,
    entities: [...story.entities],
    hiddenAt,
    id: story.id,
    occurredAt: hiddenAt,
    originalUrl: story.originalUrl,
    sourceName: story.sourceName,
    sourceSlug: story.sourceSlug,
    tags: [...story.tags],
    title: story.title,
  }));

const writeNewsCoverageThreadGuardrails = (thread: NewsCoverageThread) => {
  const guardrailItems = getNewsCoverageThreadGuardrailItems({
    hiddenAt: new Date().toISOString(),
    thread,
  });
  const nextGuardrailItems = mergeNewsReaderMemoryItems({
    limit: 30,
    localItems: guardrailItems,
    serverItems: readStoredNewsReaderMemoryItems(newsGuardrailStorageKey),
  });

  writeStoredNewsReaderMemoryItems(newsGuardrailStorageKey, nextGuardrailItems);
};

const getReaderSignalSummary = (count: number) =>
  count === 1
    ? "1 reader signal matches this thread."
    : `${count} reader signals match this thread.`;

export const selectNewsCoverageThreadDetail = ({
  guardrailItems = [],
  items,
  profile,
  threadKey,
}: {
  guardrailItems?: readonly NewsReaderMemoryItem[];
  items: readonly NewsHomeItem[];
  profile: NewsPreferenceProfile;
  threadKey: string;
}): NewsCoverageThreadDetail | null => {
  const eligibleItems = selectNewsCoverageThreadEligibleItems({
    guardrailItems,
    items,
  });
  const threadItems = eligibleItems.filter((item) =>
    doesThreadRouteKeyMatch({ item, threadKey }),
  );
  const firstThreadItem = threadItems[0];

  if (!firstThreadItem) return null;

  const thread = toCoverageThread({
    key: getThreadKey(firstThreadItem),
    profile,
    stories: threadItems,
  });

  if (!thread) return null;

  const sourceCount = getUniqueSources(thread.stories).size;

  return {
    metrics: [
      { label: "Stories", value: String(thread.stories.length) },
      { label: "Sources", value: String(sourceCount) },
      { label: "Reader matches", value: String(thread.readerSignals.length) },
      { label: "Heat", value: String(Math.round(thread.lead.trendScore)) },
    ],
    statusLabel: `${thread.storyCountLabel} / ${thread.sourceCountLabel}`,
    summary: `${thread.summary} ${getReaderSignalSummary(
      thread.readerSignals.length,
    )}`,
    thread,
    timeline: thread.stories.map((story) => ({
      href: `/news/${story.id}`,
      item: story,
      publishedAtLabel: formatNewsTime(story.publishedAt),
      sourceName: story.sourceName,
      sourceScoreLabel: `Source ${Math.round(story.sourceScore)}`,
      summary: story.summary,
      title: story.title,
      trendLabel: `Heat ${Math.round(story.trendScore)}`,
    })),
  };
};

export function NewsCoverageThreadsView({
  coverage,
  onFollowThread,
  onLessThread,
  status,
}: {
  coverage: NewsCoverageThreadsModel;
  onFollowThread?: (thread: NewsCoverageThread) => void;
  onLessThread?: (thread: NewsCoverageThread) => void;
  status: NewsHomeStatus;
}) {
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
              Aggregation desk
            </p>
            <h1 className="mt-2 text-4xl leading-none font-black tracking-normal sm:text-6xl">
              Coverage Threads
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4a4a4a] dark:text-[#c8c4ba]">
              {coverage.summary}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4 lg:min-w-[32rem]">
            {coverage.metrics.map((metric) => (
              <div
                className="border border-[#161616]/25 bg-[#fffdf7] p-3 text-center dark:border-[#f4f1ea]/20 dark:bg-[#181818]"
                key={metric.label}
              >
                <dt className="text-[10px] tracking-[0.12em] uppercase">
                  {metric.label}
                </dt>
                <dd className="mt-1 text-2xl font-black">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <nav className="container flex gap-2 overflow-x-auto border-t border-[#161616]/25 py-3 text-sm dark:border-[#f4f1ea]/25">
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <Link href="/">Front page</Link>
          </Button>
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <Link href="/briefing">Briefing</Link>
          </Button>
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <Link href="/topics">Topics</Link>
          </Button>
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <Link href="/sources">Sources</Link>
          </Button>
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <Link href="/reader/following">Following</Link>
          </Button>
        </nav>
      </header>

      <section className="container grid gap-6 py-6 lg:grid-cols-[minmax(220px,0.28fr)_minmax(0,0.72fr)]">
        <aside className="grid content-start gap-3 border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
          <h2 className="text-xl font-black">Thread logic</h2>
          <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
            Clustered stories are grouped first. Topic fallback keeps the
            edition readable while live clusters are still sparse.
          </p>
          <div className="grid gap-2 font-mono text-xs">
            <div className="border border-[#161616]/25 bg-[#fffdf7] p-3 dark:border-[#f4f1ea]/20 dark:bg-[#181818]">
              Status: {status}
            </div>
            <div className="border border-[#161616]/25 bg-[#fffdf7] p-3 dark:border-[#f4f1ea]/20 dark:bg-[#181818]">
              Reader fit uses followed topics, sources, entities, and angles.
            </div>
          </div>
        </aside>

        <div className="grid gap-5">
          {coverage.threads.length > 0 ? (
            coverage.threads.map((thread, index) => (
              <article
                className="grid gap-4 border-t border-[#161616] pt-4 dark:border-[#f4f1ea]"
                key={thread.key}
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.3fr)]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2 font-mono text-[11px] tracking-[0.12em] uppercase">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <Link
                        className="text-[#8a241c] hover:underline dark:text-[#ff8b7e]"
                        href={thread.topicHref}
                      >
                        {thread.categoryLabel}
                      </Link>
                      <span>{thread.storyCountLabel}</span>
                      <span>{thread.sourceCountLabel}</span>
                    </div>
                    <Link
                      className="mt-2 block text-2xl leading-tight font-black hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                      href={thread.threadHref}
                    >
                      {thread.title}
                    </Link>
                    <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                      {thread.summary}
                    </p>
                  </div>
                  <div className="grid content-start gap-2">
                    <div className="border border-[#161616]/25 bg-[#fffdf7] p-3 dark:border-[#f4f1ea]/20 dark:bg-[#181818]">
                      <p className="font-mono text-[11px] tracking-[0.12em] uppercase">
                        {thread.readerFitLabel}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {thread.readerSignals.length > 0 ? (
                          thread.readerSignals.map((signal) => {
                            const signalHref =
                              getThreadReaderSignalHref(signal);

                            if (signalHref) {
                              return (
                                <Link
                                  className="border border-[#161616]/25 px-2 py-1 text-xs hover:bg-[#efe8dc] dark:border-[#f4f1ea]/25 dark:hover:bg-[#242424]"
                                  href={signalHref}
                                  key={signal}
                                >
                                  {signal}
                                </Link>
                              );
                            }

                            return (
                              <span
                                className="border border-[#161616]/25 px-2 py-1 text-xs dark:border-[#f4f1ea]/25"
                                key={signal}
                              >
                                {signal}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-sm text-[#5b5750] dark:text-[#bbb4aa]">
                            No direct profile signal yet.
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                      <div className="border border-[#161616]/25 p-2 dark:border-[#f4f1ea]/20">
                        {thread.trendLabel}
                      </div>
                      <div className="border border-[#161616]/25 p-2 dark:border-[#f4f1ea]/20">
                        Latest {thread.latestAtLabel}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        className="h-8 rounded-none px-2 text-xs"
                        disabled={!onFollowThread}
                        type="button"
                        variant="outline"
                        onClick={() => onFollowThread?.(thread)}
                      >
                        Follow thread
                      </Button>
                      <Button
                        className="h-8 rounded-none px-2 text-xs"
                        disabled={!onLessThread}
                        type="button"
                        variant="outline"
                        onClick={() => onLessThread?.(thread)}
                      >
                        Less thread
                      </Button>
                    </div>
                    <Button
                      asChild
                      className="h-8 rounded-none px-2 text-xs"
                      variant="outline"
                    >
                      <Link href={thread.href}>Lead story</Link>
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  {thread.stories.map((story, storyIndex) => (
                    <article
                      className="grid gap-2 border-t border-[#161616]/20 py-3 text-sm dark:border-[#f4f1ea]/15"
                      key={story.id}
                    >
                      <div className="grid gap-1 md:grid-cols-[minmax(0,1fr)_auto]">
                        <Link
                          className="font-semibold hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                          href={`/news/${story.id}`}
                        >
                          {story.title}
                        </Link>
                        <span className="font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {story.sourceName} /{" "}
                          {formatNewsTime(story.publishedAt)}
                        </span>
                      </div>
                      <NewsEditionStoryActions
                        isPreview={status !== "ready"}
                        item={story}
                        rankSlot={storyIndex + 1}
                      />
                    </article>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <p className="border-t border-[#161616] pt-4 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea] dark:text-[#bbb4aa]">
              No coverage threads are available yet.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

export function NewsCoverageThreadDetailView({
  detail,
  status = "ready",
  onFollowThread,
  onLessThread,
}: {
  detail: NewsCoverageThreadDetail;
  status?: NewsHomeStatus;
  onFollowThread?: (thread: NewsCoverageThread) => void;
  onLessThread?: (thread: NewsCoverageThread) => void;
}) {
  return (
    <main className="min-h-[100dvh] bg-[#f7f5ef] text-[#161616] transition-colors dark:bg-[#101010] dark:text-[#f4f1ea]">
      <header className="border-b border-[#161616] dark:border-[#f4f1ea]">
        <div className="container grid gap-4 py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <Link
              className="font-mono text-xs tracking-[0.18em] uppercase hover:underline"
              href="/threads"
            >
              Coverage Threads
            </Link>
            <p className="mt-4 font-mono text-xs tracking-[0.18em] uppercase">
              Coverage Thread
            </p>
            <h1 className="mt-2 text-4xl leading-none font-black tracking-normal sm:text-6xl">
              {detail.thread.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4a4a4a] dark:text-[#c8c4ba]">
              {detail.summary}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4 lg:min-w-[32rem]">
            {detail.metrics.map((metric) => (
              <div
                className="border border-[#161616]/25 bg-[#fffdf7] p-3 text-center dark:border-[#f4f1ea]/20 dark:bg-[#181818]"
                key={metric.label}
              >
                <dt className="text-[10px] tracking-[0.12em] uppercase">
                  {metric.label}
                </dt>
                <dd className="mt-1 text-2xl font-black">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <nav className="container flex gap-2 overflow-x-auto border-t border-[#161616]/25 py-3 text-sm dark:border-[#f4f1ea]/25">
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <Link href="/">Front page</Link>
          </Button>
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <Link href="/threads">All threads</Link>
          </Button>
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <Link href={detail.thread.href}>Lead story</Link>
          </Button>
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <Link href={detail.thread.topicHref}>
              {detail.thread.categoryLabel}
            </Link>
          </Button>
        </nav>
      </header>

      <section className="container grid gap-6 py-6 lg:grid-cols-[minmax(220px,0.28fr)_minmax(0,0.72fr)]">
        <aside className="grid content-start gap-3 border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
          <h2 className="text-xl font-black">Thread Signals</h2>
          <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
            {detail.statusLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-none"
              disabled={!onFollowThread}
              type="button"
              variant="outline"
              onClick={() => onFollowThread?.(detail.thread)}
            >
              Follow thread
            </Button>
            <Button
              className="rounded-none"
              disabled={!onLessThread}
              type="button"
              variant="outline"
              onClick={() => onLessThread?.(detail.thread)}
            >
              Less thread
            </Button>
          </div>
          <div className="grid gap-2">
            <div className="border border-[#161616]/25 bg-[#fffdf7] px-3 py-3 dark:border-[#f4f1ea]/20 dark:bg-[#181818]">
              <p className="font-mono text-[11px] tracking-[0.12em] uppercase">
                Verification
              </p>
              <p className="mt-2 text-sm font-black">
                {detail.thread.verificationLabel}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                {detail.thread.verificationSummary}
              </p>
            </div>
            {detail.thread.readerSignals.length > 0 ? (
              detail.thread.readerSignals.map((signal) => {
                const signalHref = getThreadReaderSignalHref(signal);

                if (signalHref) {
                  return (
                    <Link
                      className="border border-[#161616]/25 bg-[#fffdf7] px-3 py-2 text-sm hover:bg-[#efe8dc] dark:border-[#f4f1ea]/20 dark:bg-[#181818] dark:hover:bg-[#242424]"
                      href={signalHref}
                      key={signal}
                    >
                      {signal}
                    </Link>
                  );
                }

                return (
                  <span
                    className="border border-[#161616]/25 bg-[#fffdf7] px-3 py-2 text-sm dark:border-[#f4f1ea]/20 dark:bg-[#181818]"
                    key={signal}
                  >
                    {signal}
                  </span>
                );
              })
            ) : (
              <span className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                No direct profile signal yet.
              </span>
            )}
          </div>
        </aside>

        <div className="grid gap-4 border-t border-[#161616] pt-4 dark:border-[#f4f1ea]">
          <h2 className="text-2xl font-black">Source Timeline</h2>
          {detail.timeline.map((item, index) => (
            <article
              className="grid gap-3 border-t border-[#161616]/20 py-4 dark:border-[#f4f1ea]/15"
              key={item.href}
            >
              <div className="flex flex-wrap gap-2 font-mono text-[11px] tracking-[0.12em] uppercase">
                <span>{item.publishedAtLabel}</span>
                <span>{item.sourceName}</span>
                <span>{item.sourceScoreLabel}</span>
                <span>{item.trendLabel}</span>
              </div>
              <Link
                className="text-xl leading-tight font-black hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                href={item.href}
              >
                {item.title}
              </Link>
              <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                {item.summary}
              </p>
              <NewsEditionStoryActions
                isPreview={status !== "ready"}
                item={item.item}
                rankSlot={index + 1}
              />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export function NewsCoverageThreadsPage({
  items,
  status,
}: {
  items: readonly NewsHomeItem[];
  status: NewsHomeStatus;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [visitorKey] = useState<string | null>(() =>
    readOrCreateNewsVisitorKey(),
  );
  const canUseServerReaderMemory = status === "ready" && Boolean(visitorKey);
  const updateProfile = useMutation(
    trpc.news.updateProfile.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
          queryClient.invalidateQueries(trpc.news.profile.pathFilter()),
        ]);
      },
    }),
  );
  const applyServerProfile = async (
    serverProfile: Parameters<typeof stripPersistedNewsPreferenceProfile>[0],
  ) => {
    writeStoredNewsPreferenceProfile(
      stripPersistedNewsPreferenceProfile(serverProfile),
    );
    await Promise.all([
      queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
      queryClient.invalidateQueries(trpc.news.profile.pathFilter()),
      queryClient.invalidateQueries(trpc.news.positiveFeedback.pathFilter()),
      queryClient.invalidateQueries(trpc.news.guardrails.pathFilter()),
    ]);
  };
  const recordInteraction = useMutation(
    trpc.news.recordInteraction.mutationOptions({
      onSuccess: applyServerProfile,
    }),
  );
  const profileQuery = useQuery(
    trpc.news.profile.queryOptions(
      { visitorKey: visitorKey ?? undefined },
      { enabled: canUseServerReaderMemory },
    ),
  );
  const guardrailsQuery = useQuery(
    trpc.news.guardrails.queryOptions(
      { limit: 25, visitorKey: visitorKey ?? undefined },
      { enabled: canUseServerReaderMemory },
    ),
  );
  const defaultProfile = useMemo(
    () => createDefaultNewsPreferenceProfile(),
    [],
  );
  const [localGuardrailItems, setLocalGuardrailItems] = useState<
    NewsReaderMemoryItem[]
  >(() => readStoredNewsReaderMemoryItems(newsGuardrailStorageKey));
  const profileSnapshot = useSyncExternalStore(
    subscribeToNewsPreferenceProfileStorage,
    readNewsPreferenceProfileSnapshot,
    () => emptyNewsPreferenceProfileSnapshot,
  );
  const profile = useMemo(
    () =>
      parseStoredNewsPreferenceProfile({
        defaultProfile,
        stored: profileSnapshot,
      }),
    [defaultProfile, profileSnapshot],
  );
  useEffect(() => {
    if (!profileQuery.data?.persisted) return;

    const nextProfile = selectHydratedNewsPreferenceProfile({
      localProfile: profile,
      serverProfile: profileQuery.data,
    });

    if (areNewsPreferenceProfilesEqual(profile, nextProfile)) return;

    writeStoredNewsPreferenceProfile(nextProfile);
  }, [profile, profileQuery.data]);
  useEffect(
    () =>
      subscribeToNewsReaderMemoryStorage(() => {
        setLocalGuardrailItems(
          readStoredNewsReaderMemoryItems(newsGuardrailStorageKey),
        );
      }),
    [],
  );

  const guardrailItems = useMemo(
    () =>
      mergeNewsReaderMemoryItems({
        limit: 60,
        localItems: localGuardrailItems,
        serverItems: guardrailsQuery.data ?? [],
      }),
    [guardrailsQuery.data, localGuardrailItems],
  );
  const eligibleItems = useMemo(
    () =>
      selectNewsCoverageThreadEligibleItems({
        guardrailItems,
        items,
      }),
    [guardrailItems, items],
  );

  const coverage = useMemo(
    () => selectNewsCoverageThreads({ items: eligibleItems, profile }),
    [eligibleItems, profile],
  );
  const followThread = (thread: NewsCoverageThread) => {
    const nextProfile = applyNewsCoverageThreadFollow({ profile, thread });

    writeStoredNewsPreferenceProfile(nextProfile);

    if (!canUseServerReaderMemory) return;
    if (!visitorKey) return;

    updateProfile.mutate({
      profile: toNewsServerPreferenceProfileInput(nextProfile),
      visitorKey,
    });
  };
  const persistThreadLessFeedback = (thread: NewsCoverageThread) => {
    if (!visitorKey) return;

    thread.stories.forEach((story, index) => {
      if (
        !shouldPersistNewsHomeItemReaderSignals({
          canPersistProfile: true,
          isPreview: status !== "ready",
          itemId: story.id,
          visitorKey,
        })
      ) {
        return;
      }

      recordInteraction.mutate({
        action: "hide",
        newsItemId: story.id,
        metadata: {
          surface: "thread",
          threadKey: thread.key,
          rankSlot: index + 1,
        },
        visitorKey,
      });
    });
  };
  const lessThread = (thread: NewsCoverageThread) => {
    writeNewsCoverageThreadGuardrails(thread);
    setLocalGuardrailItems(
      readStoredNewsReaderMemoryItems(newsGuardrailStorageKey),
    );
    persistThreadLessFeedback(thread);
  };

  return (
    <NewsCoverageThreadsView
      coverage={coverage}
      status={status}
      onFollowThread={followThread}
      onLessThread={lessThread}
    />
  );
}

export function NewsCoverageThreadDetailPage({
  items,
  status = "ready",
  threadKey,
}: {
  items: readonly NewsHomeItem[];
  status?: NewsHomeStatus;
  threadKey: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [visitorKey] = useState<string | null>(() =>
    readOrCreateNewsVisitorKey(),
  );
  const canUseServerReaderMemory = status === "ready" && Boolean(visitorKey);
  const updateProfile = useMutation(
    trpc.news.updateProfile.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
          queryClient.invalidateQueries(trpc.news.profile.pathFilter()),
        ]);
      },
    }),
  );
  const applyServerProfile = async (
    serverProfile: Parameters<typeof stripPersistedNewsPreferenceProfile>[0],
  ) => {
    writeStoredNewsPreferenceProfile(
      stripPersistedNewsPreferenceProfile(serverProfile),
    );
    await Promise.all([
      queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
      queryClient.invalidateQueries(trpc.news.profile.pathFilter()),
      queryClient.invalidateQueries(trpc.news.positiveFeedback.pathFilter()),
      queryClient.invalidateQueries(trpc.news.guardrails.pathFilter()),
    ]);
  };
  const recordInteraction = useMutation(
    trpc.news.recordInteraction.mutationOptions({
      onSuccess: applyServerProfile,
    }),
  );
  const profileQuery = useQuery(
    trpc.news.profile.queryOptions(
      { visitorKey: visitorKey ?? undefined },
      { enabled: canUseServerReaderMemory },
    ),
  );
  const guardrailsQuery = useQuery(
    trpc.news.guardrails.queryOptions(
      { limit: 25, visitorKey: visitorKey ?? undefined },
      { enabled: canUseServerReaderMemory },
    ),
  );
  const defaultProfile = useMemo(
    () => createDefaultNewsPreferenceProfile(),
    [],
  );
  const [localGuardrailItems, setLocalGuardrailItems] = useState<
    NewsReaderMemoryItem[]
  >(() => readStoredNewsReaderMemoryItems(newsGuardrailStorageKey));
  const profileSnapshot = useSyncExternalStore(
    subscribeToNewsPreferenceProfileStorage,
    readNewsPreferenceProfileSnapshot,
    () => emptyNewsPreferenceProfileSnapshot,
  );
  const profile = useMemo(
    () =>
      parseStoredNewsPreferenceProfile({
        defaultProfile,
        stored: profileSnapshot,
      }),
    [defaultProfile, profileSnapshot],
  );
  useEffect(() => {
    if (!profileQuery.data?.persisted) return;

    const nextProfile = selectHydratedNewsPreferenceProfile({
      localProfile: profile,
      serverProfile: profileQuery.data,
    });

    if (areNewsPreferenceProfilesEqual(profile, nextProfile)) return;

    writeStoredNewsPreferenceProfile(nextProfile);
  }, [profile, profileQuery.data]);
  useEffect(
    () =>
      subscribeToNewsReaderMemoryStorage(() => {
        setLocalGuardrailItems(
          readStoredNewsReaderMemoryItems(newsGuardrailStorageKey),
        );
      }),
    [],
  );

  const guardrailItems = useMemo(
    () =>
      mergeNewsReaderMemoryItems({
        limit: 60,
        localItems: localGuardrailItems,
        serverItems: guardrailsQuery.data ?? [],
      }),
    [guardrailsQuery.data, localGuardrailItems],
  );
  const eligibleItems = useMemo(
    () =>
      selectNewsCoverageThreadEligibleItems({
        guardrailItems,
        items,
      }),
    [guardrailItems, items],
  );

  const detail = useMemo(
    () =>
      selectNewsCoverageThreadDetail({
        items: eligibleItems,
        profile,
        threadKey,
      }),
    [eligibleItems, profile, threadKey],
  );
  const followThread = (thread: NewsCoverageThread) => {
    const nextProfile = applyNewsCoverageThreadFollow({ profile, thread });

    writeStoredNewsPreferenceProfile(nextProfile);

    if (!canUseServerReaderMemory) return;
    if (!visitorKey) return;

    updateProfile.mutate({
      profile: toNewsServerPreferenceProfileInput(nextProfile),
      visitorKey,
    });
  };
  const persistThreadLessFeedback = (thread: NewsCoverageThread) => {
    if (!visitorKey) return;

    thread.stories.forEach((story, index) => {
      if (
        !shouldPersistNewsHomeItemReaderSignals({
          canPersistProfile: true,
          isPreview: status !== "ready",
          itemId: story.id,
          visitorKey,
        })
      ) {
        return;
      }

      recordInteraction.mutate({
        action: "hide",
        newsItemId: story.id,
        metadata: {
          surface: "thread",
          threadKey: thread.key,
          rankSlot: index + 1,
        },
        visitorKey,
      });
    });
  };
  const lessThread = (thread: NewsCoverageThread) => {
    writeNewsCoverageThreadGuardrails(thread);
    setLocalGuardrailItems(
      readStoredNewsReaderMemoryItems(newsGuardrailStorageKey),
    );
    persistThreadLessFeedback(thread);
  };

  if (!detail) {
    return (
      <main className="min-h-[100dvh] bg-[#f7f5ef] text-[#161616] transition-colors dark:bg-[#101010] dark:text-[#f4f1ea]">
        <section className="container grid gap-4 py-10">
          <Link
            className="font-mono text-xs tracking-[0.18em] uppercase hover:underline"
            href="/threads"
          >
            Coverage Threads
          </Link>
          <h1 className="text-4xl leading-none font-black tracking-normal">
            Thread not found
          </h1>
        </section>
      </main>
    );
  }

  return (
    <NewsCoverageThreadDetailView
      detail={detail}
      status={status}
      onFollowThread={followThread}
      onLessThread={lessThread}
    />
  );
}
