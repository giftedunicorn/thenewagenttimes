"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@acme/ui/button";

import type {
  NewsHomeItem,
  NewsHomePositiveFeedbackAction,
  NewsHomeStatus,
  NewsPositiveFeedbackMemoryItem,
  NewsReaderMemoryItem,
} from "./news-home-model";
import type { NewsSearchMemoryItem } from "./news-reader-memory-storage";
import { useTRPC } from "~/trpc/react";
import { NewsEditionStoryActions } from "./news-edition-story-actions";
import {
  formatNewsTime,
  mergeNewsHomePositiveFeedbackItems,
  mergeNewsReaderMemoryItems,
  removeNewsHomePositiveFeedbackActionItem,
  removeNewsHomePositiveFeedbackItem,
  removeNewsReaderMemoryItem,
} from "./news-home-model";
import {
  newsGuardrailStorageKey,
  newsHistoryStorageKey,
  newsSavedStorageKey,
  normalizeNewsSearchMemoryQuery,
  readStoredNewsPositiveFeedbackItems,
  readStoredNewsReaderMemoryItems,
  readStoredNewsSearchMemoryItems,
  selectStoredNewsSearchMemoryItems,
  subscribeToNewsReaderMemoryStorage,
  writeStoredNewsPositiveFeedbackItems,
  writeStoredNewsReaderMemoryItems,
  writeStoredNewsSearchMemoryItems,
} from "./news-reader-memory-storage";
import { readOrCreateNewsVisitorKey } from "./news-reader-profile-storage";

type NewsReaderLibraryPositiveFeedbackAction = Extract<
  NewsHomePositiveFeedbackAction,
  "click_source" | "share"
>;

type NewsReaderLibraryPositiveFeedbackItem = NewsPositiveFeedbackMemoryItem & {
  action: NewsReaderLibraryPositiveFeedbackAction;
};

interface NewsReaderLibraryEntry {
  href: string;
  meta: string;
  memoryItem?: NewsReaderMemoryItem;
  positiveFeedbackItem?: NewsReaderLibraryPositiveFeedbackItem;
  summary: string;
  timestamp: string | null;
  title: string;
}

interface NewsReaderLibrarySection {
  emptyLabel: string;
  entries: NewsReaderLibraryEntry[];
  label: string;
  summary: string;
}

interface NewsReaderLibraryRecallStory {
  href: string;
  item: NewsHomeItem;
  matchLabel: string;
  reason: string;
  sourceName: string;
  title: string;
}

interface NewsReaderLibraryRecallFeed {
  stories: NewsReaderLibraryRecallStory[];
  summary: string;
}

export interface NewsReaderLibraryModel {
  metrics: {
    label: string;
    value: string;
  }[];
  recallFeed: NewsReaderLibraryRecallFeed;
  sections: NewsReaderLibrarySection[];
  summary: string;
}

interface NewsReaderLibraryMemorySnapshot {
  guardrailItems: NewsReaderMemoryItem[];
  historyItems: NewsReaderMemoryItem[];
  positiveFeedbackItems: NewsPositiveFeedbackMemoryItem[];
  savedItems: NewsReaderMemoryItem[];
  searchItems: NewsSearchMemoryItem[];
}

const formatLibraryCount = ({
  count,
  plural,
  singular,
}: {
  count: number;
  plural?: string;
  singular: string;
}) => `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;

const getMemoryTimestamp = (item: NewsReaderMemoryItem) => {
  const latestTimestamp = [
    item.savedAt,
    item.viewedAt,
    item.hiddenAt,
    item.occurredAt,
  ].reduce<{ occurredAt: string; timestamp: number } | null>(
    (latest, occurredAt) => {
      if (typeof occurredAt !== "string") return latest;

      const timestamp = Date.parse(occurredAt);

      if (!Number.isFinite(timestamp)) return latest;
      if (!latest || timestamp > latest.timestamp)
        return { occurredAt, timestamp };

      return latest;
    },
    null,
  );

  return latestTimestamp?.occurredAt ?? null;
};

const sortLibraryEntries = (
  left: NewsReaderLibraryEntry,
  right: NewsReaderLibraryEntry,
) => {
  const leftTimestamp = Date.parse(left.timestamp ?? "");
  const rightTimestamp = Date.parse(right.timestamp ?? "");

  return (
    (Number.isFinite(rightTimestamp) ? rightTimestamp : 0) -
    (Number.isFinite(leftTimestamp) ? leftTimestamp : 0)
  );
};

const toStoryEntry = ({
  item,
  meta,
}: {
  item: NewsReaderMemoryItem;
  meta: string;
}): NewsReaderLibraryEntry => ({
  href: `/news/${item.id}`,
  meta,
  memoryItem: item,
  summary: `${item.sourceName} / ${item.category.replace(/[_-]+/g, " ")}`,
  timestamp: getMemoryTimestamp(item),
  title: item.title,
});

const toSearchEntry = (item: NewsSearchMemoryItem): NewsReaderLibraryEntry => ({
  href: `/search?q=${encodeURIComponent(item.query)}`,
  meta: formatLibraryCount({
    count: item.resultCount,
    singular: "result",
  }),
  summary: "Recent search intent",
  timestamp: item.searchedAt,
  title: `Search: ${item.query}`,
});

const isExplicitPositiveFeedbackItem = (
  item: NewsPositiveFeedbackMemoryItem,
): item is NewsReaderLibraryPositiveFeedbackItem =>
  item.action === "click_source" || item.action === "share";

const getPositiveFeedbackEntryMeta = (
  action: NewsReaderLibraryPositiveFeedbackAction,
) => (action === "share" ? "Shared" : "Source clicked");

const toPositiveFeedbackEntry = (
  item: NewsReaderLibraryPositiveFeedbackItem,
): NewsReaderLibraryEntry => ({
  href: `/news/${item.id}`,
  meta: getPositiveFeedbackEntryMeta(item.action),
  memoryItem: item,
  positiveFeedbackItem: item,
  summary: `${item.sourceName} / ${item.category.replace(/[_-]+/g, " ")}`,
  timestamp: item.occurredAt,
  title: item.title,
});

const createLibrarySection = ({
  emptyLabel,
  entries,
  label,
  summary,
}: NewsReaderLibrarySection): NewsReaderLibrarySection => ({
  emptyLabel,
  entries: [...entries].sort(sortLibraryEntries),
  label,
  summary,
});

const emptyNewsReaderLibraryItems: readonly NewsHomeItem[] = [];

const normalizeLibrarySignal = (value: string) =>
  value.trim().toLowerCase().replace(/[_-]+/g, " ");

const hasLibrarySignal = (values: readonly string[], value: string) => {
  const normalizedValue = normalizeLibrarySignal(value);

  return values.some(
    (itemValue) => normalizeLibrarySignal(itemValue) === normalizedValue,
  );
};

const getLibraryStorySearchText = (item: NewsHomeItem) =>
  [
    item.title,
    item.summary,
    item.category,
    item.sourceName,
    item.sourceSlug,
    ...item.entities,
    ...item.tags,
  ]
    .join(" ")
    .toLowerCase()
    .replace(/[_-]+/g, " ");

const doesLibraryStoryMatchSearch = ({
  item,
  query,
}: {
  item: NewsHomeItem;
  query: string;
}) => {
  const tokens = normalizeLibrarySignal(query).split(/\s+/).filter(Boolean);

  if (tokens.length === 0) return false;

  const searchText = getLibraryStorySearchText(item);

  return tokens.every((token) => searchText.includes(token));
};

const hasSameLibraryStoryReference = (
  item: NewsHomeItem,
  memoryItem: NewsReaderMemoryItem,
) =>
  item.id === memoryItem.id ||
  (Boolean(item.canonicalUrl) &&
    item.canonicalUrl === memoryItem.canonicalUrl) ||
  (Boolean(item.originalUrl) && item.originalUrl === memoryItem.originalUrl);

const getLibraryMemorySignalMatches = ({
  item,
  memoryItems,
}: {
  item: NewsHomeItem;
  memoryItems: readonly NewsReaderMemoryItem[];
}) => {
  const signals = new Set<string>();

  for (const memoryItem of memoryItems) {
    if (hasSameLibraryStoryReference(item, memoryItem)) continue;

    if (
      normalizeLibrarySignal(memoryItem.category) ===
      normalizeLibrarySignal(item.category)
    ) {
      signals.add(`category:${normalizeLibrarySignal(item.category)}`);
    }

    if (
      normalizeLibrarySignal(memoryItem.sourceSlug) ===
      normalizeLibrarySignal(item.sourceSlug)
    ) {
      signals.add(`source:${normalizeLibrarySignal(item.sourceSlug)}`);
    }

    for (const entity of item.entities) {
      if (hasLibrarySignal(memoryItem.entities, entity)) {
        signals.add(`entity:${normalizeLibrarySignal(entity)}`);
      }
    }

    for (const tag of item.tags) {
      if (hasLibrarySignal(memoryItem.tags ?? [], tag)) {
        signals.add(`tag:${normalizeLibrarySignal(tag)}`);
      }
    }
  }

  return signals;
};

const doesLibraryStoryMatchGuardrails = ({
  guardrailItems,
  item,
}: {
  guardrailItems: readonly NewsReaderMemoryItem[];
  item: NewsHomeItem;
}) =>
  getLibraryMemorySignalMatches({ item, memoryItems: guardrailItems }).size > 0;

const getLibraryRecallReason = ({
  hasHistoryMatch,
  hasSavedMatch,
  hasSearchMatch,
}: {
  hasHistoryMatch: boolean;
  hasSavedMatch: boolean;
  hasSearchMatch: boolean;
}) => {
  const reasons = [
    ...(hasSavedMatch ? ["saved stories"] : []),
    ...(hasHistoryMatch ? ["read history"] : []),
    ...(hasSearchMatch ? ["recent search intent"] : []),
  ];

  if (reasons.length === 0) return "Matches reader memory.";
  if (reasons.length === 1) return `Matches ${reasons[0]}.`;
  if (reasons.length === 2) return `Matches ${reasons[0]} and ${reasons[1]}.`;

  return `Matches ${reasons.slice(0, -1).join(", ")}, and ${
    reasons[reasons.length - 1]
  }.`;
};

const getLibraryRecallMatchLabel = (count: number) =>
  `${count} ${count === 1 ? "signal" : "signals"}`;

const selectNewsReaderLibraryRecallFeed = ({
  guardrailItems,
  historyItems,
  items,
  limit = 4,
  savedItems,
  searchItems,
}: {
  guardrailItems: readonly NewsReaderMemoryItem[];
  historyItems: readonly NewsReaderMemoryItem[];
  items: readonly NewsHomeItem[];
  limit?: number;
  savedItems: readonly NewsReaderMemoryItem[];
  searchItems: readonly NewsSearchMemoryItem[];
}): NewsReaderLibraryRecallFeed => {
  const stories = items
    .flatMap((item) => {
      if (doesLibraryStoryMatchGuardrails({ guardrailItems, item })) {
        return [];
      }

      const savedSignals = getLibraryMemorySignalMatches({
        item,
        memoryItems: savedItems,
      });
      const historySignals = getLibraryMemorySignalMatches({
        item,
        memoryItems: historyItems,
      });
      const hasSearchMatch = searchItems.some((searchItem) =>
        doesLibraryStoryMatchSearch({ item, query: searchItem.query }),
      );
      const signalCount =
        savedSignals.size + historySignals.size + (hasSearchMatch ? 1 : 0);

      if (signalCount === 0) return [];

      return [
        {
          href: `/news/${item.id}`,
          item,
          matchLabel: getLibraryRecallMatchLabel(signalCount),
          reason: getLibraryRecallReason({
            hasHistoryMatch: historySignals.size > 0,
            hasSavedMatch: savedSignals.size > 0,
            hasSearchMatch,
          }),
          signalCount,
          sourceName: item.sourceName,
          title: item.title,
          trendScore: item.trendScore,
        },
      ];
    })
    .sort((left, right) => {
      if (right.signalCount !== left.signalCount) {
        return right.signalCount - left.signalCount;
      }

      if (right.trendScore !== left.trendScore) {
        return right.trendScore - left.trendScore;
      }

      return left.title.localeCompare(right.title);
    });
  const storyCount = stories.length;

  return {
    stories: stories
      .slice(0, Math.max(0, Math.trunc(limit)))
      .map(({ href, item, matchLabel, reason, sourceName, title }) => ({
        href,
        item,
        matchLabel,
        reason,
        sourceName,
        title,
      })),
    summary:
      storyCount > 0
        ? `${storyCount} current ${
            storyCount === 1 ? "story is" : "stories are"
          } recalled from saved, read, or search memory.`
        : "Current stories will appear here after saved, read, or search memory matches the edition.",
  };
};

export const selectNewsReaderLibrary = ({
  guardrailItems,
  historyItems,
  items = emptyNewsReaderLibraryItems,
  positiveFeedbackItems = [],
  savedItems,
  searchItems,
}: {
  guardrailItems: readonly NewsReaderMemoryItem[];
  historyItems: readonly NewsReaderMemoryItem[];
  items?: readonly NewsHomeItem[];
  positiveFeedbackItems?: readonly NewsPositiveFeedbackMemoryItem[];
  savedItems: readonly NewsReaderMemoryItem[];
  searchItems: readonly NewsSearchMemoryItem[];
}): NewsReaderLibraryModel => {
  const explicitPositiveFeedbackItems = positiveFeedbackItems.filter(
    isExplicitPositiveFeedbackItem,
  );
  const signalCount =
    guardrailItems.length +
    historyItems.length +
    explicitPositiveFeedbackItems.length +
    savedItems.length +
    searchItems.length;
  const recallFeed = selectNewsReaderLibraryRecallFeed({
    guardrailItems,
    historyItems,
    items,
    savedItems,
    searchItems,
  });

  return {
    metrics: [
      { label: "Saved", value: String(savedItems.length) },
      { label: "Read", value: String(historyItems.length) },
      {
        label: "Positive",
        value: String(explicitPositiveFeedbackItems.length),
      },
      { label: "Hidden", value: String(guardrailItems.length) },
      { label: "Searches", value: String(searchItems.length) },
      {
        label: "Recall",
        value: String(recallFeed.stories.length),
      },
    ],
    recallFeed,
    sections: [
      createLibrarySection({
        emptyLabel: "Saved stories will appear after you press Save.",
        entries: savedItems.map((item) =>
          toStoryEntry({ item, meta: "Saved" }),
        ),
        label: "Saved Stories",
        summary: "Stories kept for later reading and positive ranking signals.",
      }),
      createLibrarySection({
        emptyLabel: "Read history appears after you open stories.",
        entries: historyItems.map((item) =>
          toStoryEntry({ item, meta: "Read" }),
        ),
        label: "Read History",
        summary: "Opened stories that help For You rank continuations.",
      }),
      createLibrarySection({
        emptyLabel: "Shares and source clicks will appear after you act.",
        entries: explicitPositiveFeedbackItems.map(toPositiveFeedbackEntry),
        label: "Positive Feedback",
        summary: "Shares and source clicks that boost related coverage.",
      }),
      createLibrarySection({
        emptyLabel: "Less feedback appears after you hide weak matches.",
        entries: guardrailItems.map((item) =>
          toStoryEntry({ item, meta: "Less" }),
        ),
        label: "Less Feedback",
        summary: "Stories you hid so similar topics and sources rank lower.",
      }),
      createLibrarySection({
        emptyLabel: "Searches appear after you search AI news.",
        entries: searchItems.map(toSearchEntry),
        label: "Searches",
        summary: "Recent search intent that can steer the current session.",
      }),
    ],
    summary:
      signalCount > 0
        ? `${signalCount} local reader ${
            signalCount === 1 ? "signal is" : "signals are"
          } available on this device.`
        : "No local reader signals are stored on this device yet.",
  };
};

const createEmptyReaderLibraryMemory = (): NewsReaderLibraryMemorySnapshot => ({
  guardrailItems: [],
  historyItems: [],
  positiveFeedbackItems: [],
  savedItems: [],
  searchItems: [],
});

const readNewsReaderLibraryMemory = (): NewsReaderLibraryMemorySnapshot => ({
  guardrailItems: readStoredNewsReaderMemoryItems(newsGuardrailStorageKey),
  historyItems: readStoredNewsReaderMemoryItems(newsHistoryStorageKey),
  positiveFeedbackItems: readStoredNewsPositiveFeedbackItems(),
  savedItems: readStoredNewsReaderMemoryItems(newsSavedStorageKey),
  searchItems: readStoredNewsSearchMemoryItems(),
});

const getReaderLibrarySearchQueryKey = (query: string) =>
  normalizeNewsSearchMemoryQuery(query).toLowerCase();

export function NewsReaderLibraryView({
  isPreview = false,
  library,
  onClearSearches,
  onRemoveHistory,
  onRemovePositiveFeedback,
  onRemoveSaved,
  onRestoreGuardrail,
}: {
  isPreview?: boolean;
  library: NewsReaderLibraryModel;
  onClearSearches?: () => void;
  onRemoveHistory?: (item: NewsReaderMemoryItem) => void;
  onRemovePositiveFeedback?: (
    item: NewsReaderLibraryPositiveFeedbackItem,
  ) => void;
  onRemoveSaved?: (item: NewsReaderMemoryItem) => void;
  onRestoreGuardrail?: (item: NewsReaderMemoryItem) => void;
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
              Reader memory
            </p>
            <h1 className="mt-2 text-4xl leading-none font-black tracking-normal sm:text-6xl">
              Reader Library
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4a4a4a] dark:text-[#c8c4ba]">
              {library.summary}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4 lg:min-w-[30rem]">
            {library.metrics.map((metric) => (
              <div
                className="border border-[#161616]/25 bg-[#fffdf7] p-3 text-center dark:border-[#f4f1ea]/20 dark:bg-[#181818]"
                key={metric.label}
              >
                <p className="text-[10px] tracking-[0.12em] uppercase">
                  {metric.label}
                </p>
                <p className="mt-1 text-2xl font-black">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <section className="container grid gap-6 py-6 lg:grid-cols-[minmax(220px,0.28fr)_minmax(0,0.72fr)]">
        <aside className="grid content-start gap-3 border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
          <h2 className="text-xl font-black">Library controls</h2>
          <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
            Review the local signals currently shaping For You on this device.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="rounded-none" variant="outline">
              <Link href="/reader">Reader Center</Link>
            </Button>
            <Button asChild className="rounded-none" variant="outline">
              <Link href="/reader/following">Following</Link>
            </Button>
            <Button asChild className="rounded-none" variant="outline">
              <Link href="/">For You</Link>
            </Button>
          </div>
        </aside>

        <div className="grid gap-6">
          <section className="border-t border-[#161616] pt-4 dark:border-[#f4f1ea]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">Library Recall</h2>
                <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {library.recallFeed.summary}
                </p>
              </div>
              <span className="border border-[#161616]/25 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/20">
                {library.recallFeed.stories.length}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {library.recallFeed.stories.length > 0 ? (
                library.recallFeed.stories.map((story, index) => (
                  <article
                    className="grid gap-3 border-b border-[#161616]/15 pb-3 dark:border-[#f4f1ea]/15"
                    key={story.href}
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-[#8a241c] uppercase dark:text-[#ff8b7e]">
                        {story.matchLabel}
                      </p>
                      <h3 className="mt-1 text-lg leading-tight font-black">
                        <Link className="hover:underline" href={story.href}>
                          {story.title}
                        </Link>
                      </h3>
                      <p className="mt-1 text-sm text-[#5b5750] dark:text-[#bbb4aa]">
                        {story.sourceName} / {story.reason}
                      </p>
                    </div>
                    <NewsEditionStoryActions
                      isPreview={isPreview}
                      item={story.item}
                      rankSlot={index + 1}
                    />
                  </article>
                ))
              ) : (
                <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  Save, read, or search stories to recall matching coverage from
                  the current edition.
                </p>
              )}
            </div>
          </section>
          {library.sections.map((section) => (
            <section
              className="border-t border-[#161616] pt-4 dark:border-[#f4f1ea]"
              key={section.label}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">{section.label}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {section.summary}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {section.label === "Searches" &&
                  section.entries.length > 0 &&
                  onClearSearches ? (
                    <Button
                      className="h-8 rounded-none px-2 font-mono text-xs"
                      onClick={onClearSearches}
                      type="button"
                      variant="outline"
                    >
                      Clear searches
                    </Button>
                  ) : null}
                  <span className="border border-[#161616]/25 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/20">
                    {section.entries.length}
                  </span>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {section.entries.length > 0 ? (
                  section.entries.map((entry) => (
                    <article
                      className="grid gap-3 border-b border-[#161616]/15 pb-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] dark:border-[#f4f1ea]/15"
                      key={`${section.label}-${entry.href}`}
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] text-[#8a241c] uppercase dark:text-[#ff8b7e]">
                          {entry.meta}
                        </p>
                        <h3 className="mt-1 text-lg leading-tight font-black">
                          <Link className="hover:underline" href={entry.href}>
                            {entry.title}
                          </Link>
                        </h3>
                        <p className="mt-1 text-sm text-[#5b5750] dark:text-[#bbb4aa]">
                          {entry.summary}
                        </p>
                      </div>
                      <p className="font-mono text-sm">
                        {entry.timestamp
                          ? formatNewsTime(entry.timestamp)
                          : "-"}
                      </p>
                      {section.label === "Read History" &&
                      entry.memoryItem &&
                      onRemoveHistory ? (
                        <Button
                          className="h-8 rounded-none px-2 font-mono text-xs"
                          onClick={() => {
                            if (entry.memoryItem) {
                              onRemoveHistory(entry.memoryItem);
                            }
                          }}
                          type="button"
                          variant="outline"
                        >
                          Remove read
                        </Button>
                      ) : null}
                      {section.label === "Saved Stories" &&
                      entry.memoryItem &&
                      onRemoveSaved ? (
                        <Button
                          className="h-8 rounded-none px-2 font-mono text-xs"
                          onClick={() => {
                            if (entry.memoryItem) {
                              onRemoveSaved(entry.memoryItem);
                            }
                          }}
                          type="button"
                          variant="outline"
                        >
                          Remove saved
                        </Button>
                      ) : null}
                      {section.label === "Positive Feedback" &&
                      entry.positiveFeedbackItem &&
                      onRemovePositiveFeedback ? (
                        <Button
                          className="h-8 rounded-none px-2 font-mono text-xs"
                          onClick={() => {
                            if (entry.positiveFeedbackItem) {
                              onRemovePositiveFeedback(
                                entry.positiveFeedbackItem,
                              );
                            }
                          }}
                          type="button"
                          variant="outline"
                        >
                          Remove feedback
                        </Button>
                      ) : null}
                      {section.label === "Less Feedback" &&
                      entry.memoryItem &&
                      onRestoreGuardrail ? (
                        <Button
                          className="h-8 rounded-none px-2 font-mono text-xs"
                          onClick={() => {
                            if (entry.memoryItem) {
                              onRestoreGuardrail(entry.memoryItem);
                            }
                          }}
                          type="button"
                          variant="outline"
                        >
                          Restore
                        </Button>
                      ) : null}
                      {section.label === "Searches" ? (
                        <Button
                          asChild
                          className="h-8 rounded-none px-2 font-mono text-xs"
                          variant="outline"
                        >
                          <Link href="/reader#promote-search-intent">
                            Tune For You
                          </Link>
                        </Button>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {section.emptyLabel}
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}

export function NewsReaderLibrary({
  items = emptyNewsReaderLibraryItems,
  status = "ready",
}: {
  items?: readonly NewsHomeItem[];
  status?: NewsHomeStatus;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [localMemory, setLocalMemory] =
    useState<NewsReaderLibraryMemorySnapshot>(createEmptyReaderLibraryMemory);
  const [removedHistoryItemIds, setRemovedHistoryItemIds] = useState<string[]>(
    [],
  );
  const [removedPositiveFeedbackItemIds, setRemovedPositiveFeedbackItemIds] =
    useState<string[]>([]);
  const [removedSavedItemIds, setRemovedSavedItemIds] = useState<string[]>([]);
  const [removedSearchQueryKeys, setRemovedSearchQueryKeys] = useState<
    string[]
  >([]);
  const [restoredGuardrailItemIds, setRestoredGuardrailItemIds] = useState<
    string[]
  >([]);
  const [visitorKey] = useState<string | null>(() =>
    readOrCreateNewsVisitorKey(),
  );
  const canUseServerReaderMemory = status === "ready" && Boolean(visitorKey);
  const restoreGuardrail = useMutation(
    trpc.news.restoreGuardrail.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
          queryClient.invalidateQueries(trpc.news.profile.pathFilter()),
          queryClient.invalidateQueries(
            trpc.news.positiveFeedback.pathFilter(),
          ),
          queryClient.invalidateQueries(trpc.news.guardrails.pathFilter()),
        ]);
      },
    }),
  );
  const removeHistory = useMutation(
    trpc.news.removeHistory.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
          queryClient.invalidateQueries(trpc.news.profile.pathFilter()),
          queryClient.invalidateQueries(trpc.news.history.pathFilter()),
        ]);
      },
    }),
  );
  const removePositiveFeedback = useMutation(
    trpc.news.removePositiveFeedback.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
          queryClient.invalidateQueries(trpc.news.profile.pathFilter()),
          queryClient.invalidateQueries(
            trpc.news.positiveFeedback.pathFilter(),
          ),
        ]);
      },
    }),
  );
  const removeSaved = useMutation(
    trpc.news.removeSaved.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
          queryClient.invalidateQueries(trpc.news.profile.pathFilter()),
          queryClient.invalidateQueries(trpc.news.saved.pathFilter()),
        ]);
      },
    }),
  );
  const removeSearchMemory = useMutation(
    trpc.news.removeSearchMemory.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
          queryClient.invalidateQueries(trpc.news.searchMemory.pathFilter()),
        ]);
      },
    }),
  );
  const savedQuery = useQuery(
    trpc.news.saved.queryOptions(
      { limit: 30, visitorKey: visitorKey ?? undefined },
      { enabled: canUseServerReaderMemory },
    ),
  );
  const historyQuery = useQuery(
    trpc.news.history.queryOptions(
      { limit: 30, visitorKey: visitorKey ?? undefined },
      { enabled: canUseServerReaderMemory },
    ),
  );
  const positiveFeedbackQuery = useQuery(
    trpc.news.positiveFeedback.queryOptions(
      { limit: 30, visitorKey: visitorKey ?? undefined },
      { enabled: canUseServerReaderMemory },
    ),
  );
  const guardrailsQuery = useQuery(
    trpc.news.guardrails.queryOptions(
      { limit: 30, visitorKey: visitorKey ?? undefined },
      { enabled: canUseServerReaderMemory },
    ),
  );
  const searchMemoryQuery = useQuery(
    trpc.news.searchMemory.queryOptions(
      { limit: 20, visitorKey: visitorKey ?? undefined },
      { enabled: canUseServerReaderMemory },
    ),
  );
  const library = useMemo(
    () =>
      selectNewsReaderLibrary({
        guardrailItems: mergeNewsReaderMemoryItems({
          limit: 30,
          localItems: localMemory.guardrailItems,
          serverItems: guardrailsQuery.data ?? [],
        }).filter((item) => !restoredGuardrailItemIds.includes(item.id)),
        historyItems: mergeNewsReaderMemoryItems({
          limit: 30,
          localItems: localMemory.historyItems,
          serverItems: historyQuery.data ?? [],
        }).filter((item) => !removedHistoryItemIds.includes(item.id)),
        items,
        positiveFeedbackItems: (positiveFeedbackQuery.data ?? [])
          .reduce<NewsPositiveFeedbackMemoryItem[]>(
            (currentItems, nextItem) =>
              mergeNewsHomePositiveFeedbackItems({
                currentItems,
                limit: 30,
                nextItem,
              }),
            localMemory.positiveFeedbackItems,
          )
          .filter((item) => !removedPositiveFeedbackItemIds.includes(item.id)),
        savedItems: mergeNewsReaderMemoryItems({
          limit: 30,
          localItems: localMemory.savedItems,
          serverItems: savedQuery.data ?? [],
        }).filter((item) => !removedSavedItemIds.includes(item.id)),
        searchItems: selectStoredNewsSearchMemoryItems([
          ...(searchMemoryQuery.data ?? []),
          ...localMemory.searchItems,
        ]).filter(
          (item) =>
            !removedSearchQueryKeys.includes(
              getReaderLibrarySearchQueryKey(item.query),
            ),
        ),
      }),
    [
      guardrailsQuery.data,
      historyQuery.data,
      items,
      localMemory,
      removedHistoryItemIds,
      removedPositiveFeedbackItemIds,
      removedSavedItemIds,
      removedSearchQueryKeys,
      positiveFeedbackQuery.data,
      restoredGuardrailItemIds,
      savedQuery.data,
      searchMemoryQuery.data,
    ],
  );

  useEffect(() => {
    const refreshLibrary = () => setLocalMemory(readNewsReaderLibraryMemory());

    refreshLibrary();

    return subscribeToNewsReaderMemoryStorage(refreshLibrary);
  }, []);

  useEffect(() => {
    if (savedQuery.data && savedQuery.data.length > 0) {
      writeStoredNewsReaderMemoryItems(
        newsSavedStorageKey,
        mergeNewsReaderMemoryItems({
          limit: 30,
          localItems: readStoredNewsReaderMemoryItems(newsSavedStorageKey),
          serverItems: savedQuery.data,
        }),
      );
    }
  }, [savedQuery.data]);

  useEffect(() => {
    if (historyQuery.data && historyQuery.data.length > 0) {
      writeStoredNewsReaderMemoryItems(
        newsHistoryStorageKey,
        mergeNewsReaderMemoryItems({
          limit: 30,
          localItems: readStoredNewsReaderMemoryItems(newsHistoryStorageKey),
          serverItems: historyQuery.data,
        }),
      );
    }
  }, [historyQuery.data]);

  useEffect(() => {
    if (!positiveFeedbackQuery.data || positiveFeedbackQuery.data.length === 0)
      return;

    writeStoredNewsPositiveFeedbackItems(
      positiveFeedbackQuery.data.reduce<NewsPositiveFeedbackMemoryItem[]>(
        (currentItems, nextItem) =>
          mergeNewsHomePositiveFeedbackItems({
            currentItems,
            limit: 30,
            nextItem,
          }),
        readStoredNewsPositiveFeedbackItems(),
      ),
    );
  }, [positiveFeedbackQuery.data]);

  useEffect(() => {
    if (guardrailsQuery.data && guardrailsQuery.data.length > 0) {
      writeStoredNewsReaderMemoryItems(
        newsGuardrailStorageKey,
        mergeNewsReaderMemoryItems({
          limit: 30,
          localItems: readStoredNewsReaderMemoryItems(newsGuardrailStorageKey),
          serverItems: guardrailsQuery.data,
        }),
      );
    }
  }, [guardrailsQuery.data]);

  useEffect(() => {
    if (!searchMemoryQuery.data || searchMemoryQuery.data.length === 0) return;

    writeStoredNewsSearchMemoryItems(
      selectStoredNewsSearchMemoryItems([
        ...searchMemoryQuery.data,
        ...readStoredNewsSearchMemoryItems(),
      ]),
    );
  }, [searchMemoryQuery.data]);

  const clearSearches = () => {
    const searchItemsToClear = selectStoredNewsSearchMemoryItems([
      ...(searchMemoryQuery.data ?? []),
      ...localMemory.searchItems,
    ]);
    setRemovedSearchQueryKeys((current) => [
      ...new Set([
        ...current,
        ...searchItemsToClear.map((item) =>
          getReaderLibrarySearchQueryKey(item.query),
        ),
      ]),
    ]);
    writeStoredNewsSearchMemoryItems([]);
    setLocalMemory(readNewsReaderLibraryMemory());

    if (!canUseServerReaderMemory) return;
    if (!visitorKey) return;

    for (const item of searchItemsToClear) {
      removeSearchMemory.mutate({
        query: item.query,
        visitorKey,
      });
    }
  };

  const removeHistoryItem = (item: NewsReaderMemoryItem) => {
    setRemovedHistoryItemIds((current) =>
      current.includes(item.id) ? current : [...current, item.id],
    );
    writeStoredNewsReaderMemoryItems(
      newsHistoryStorageKey,
      removeNewsReaderMemoryItem({
        item,
        itemId: item.id,
        items: readStoredNewsReaderMemoryItems(newsHistoryStorageKey),
      }),
    );
    setLocalMemory(readNewsReaderLibraryMemory());

    if (!canUseServerReaderMemory) return;
    if (!visitorKey) return;

    removeHistory.mutate({
      visitorKey,
      newsItemId: item.id,
    });
  };

  const removePositiveFeedbackItem = (
    item: NewsReaderLibraryPositiveFeedbackItem,
  ) => {
    setRemovedPositiveFeedbackItemIds((current) =>
      current.includes(item.id) ? current : [...current, item.id],
    );
    writeStoredNewsPositiveFeedbackItems(
      removeNewsHomePositiveFeedbackActionItem({
        action: item.action,
        item,
        itemId: item.id,
        items: readStoredNewsPositiveFeedbackItems(),
      }),
    );
    setLocalMemory(readNewsReaderLibraryMemory());

    if (!canUseServerReaderMemory) return;
    if (!visitorKey) return;

    removePositiveFeedback.mutate({
      action: item.action,
      visitorKey,
      newsItemId: item.id,
    });
  };

  const removeSavedItem = (item: NewsReaderMemoryItem) => {
    setRemovedSavedItemIds((current) =>
      current.includes(item.id) ? current : [...current, item.id],
    );
    writeStoredNewsReaderMemoryItems(
      newsSavedStorageKey,
      removeNewsReaderMemoryItem({
        item,
        itemId: item.id,
        items: readStoredNewsReaderMemoryItems(newsSavedStorageKey),
      }),
    );
    writeStoredNewsPositiveFeedbackItems(
      removeNewsHomePositiveFeedbackItem({
        item,
        itemId: item.id,
        items: readStoredNewsPositiveFeedbackItems(),
      }),
    );
    setLocalMemory(readNewsReaderLibraryMemory());

    if (!canUseServerReaderMemory) return;
    if (!visitorKey) return;

    removeSaved.mutate({
      visitorKey,
      newsItemId: item.id,
    });
  };

  const restoreGuardrailItem = (item: NewsReaderMemoryItem) => {
    setRestoredGuardrailItemIds((current) =>
      current.includes(item.id) ? current : [...current, item.id],
    );
    writeStoredNewsReaderMemoryItems(
      newsGuardrailStorageKey,
      removeNewsReaderMemoryItem({
        item,
        itemId: item.id,
        items: readStoredNewsReaderMemoryItems(newsGuardrailStorageKey),
      }),
    );
    setLocalMemory(readNewsReaderLibraryMemory());

    if (!canUseServerReaderMemory) return;
    if (!visitorKey) return;

    restoreGuardrail.mutate({
      visitorKey,
      newsItemId: item.id,
    });
  };

  return (
    <NewsReaderLibraryView
      isPreview={status !== "ready"}
      library={library}
      onClearSearches={clearSearches}
      onRemoveHistory={removeHistoryItem}
      onRemovePositiveFeedback={removePositiveFeedbackItem}
      onRemoveSaved={removeSavedItem}
      onRestoreGuardrail={restoreGuardrailItem}
    />
  );
}
