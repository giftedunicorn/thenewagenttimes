"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { NewsPreferenceProfile, RankedNewsItem } from "@acme/validators";
import { Button } from "@acme/ui/button";
import {
  normalizeNewsPreferenceProfile,
  rankNewsForReader,
} from "@acme/validators";

import type { NewsEditionPageData } from "../_data/news";
import type { NewsHomeItem } from "./news-home-model";
import type { NewsSearchMemoryItem } from "./news-reader-memory-storage";
import { useTRPC } from "~/trpc/react";
import { NewsEditionStoryActions } from "./news-edition-story-actions";
import {
  createDefaultNewsPreferenceProfile,
  selectHydratedNewsPreferenceProfile,
  selectNewsHomeSearchMemoryAnchoredItems,
} from "./news-home-model";
import {
  newsSearchStorageKey,
  readStoredNewsSearchMemoryItems,
  subscribeToNewsReaderMemoryStorage,
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

type NewsEditionFilter = NewsEditionPageData["filter"];

export interface NewsEditionReaderLensModel {
  items: RankedNewsItem<NewsHomeItem>[];
  label: string;
  metrics: {
    label: string;
    value: string;
  }[];
  summary: string;
}

export interface NewsEditionFollowState {
  isFollowing: boolean;
  label: string;
}

const readStoredProfile = (stored: string): NewsPreferenceProfile => {
  return parseStoredNewsPreferenceProfile({
    defaultProfile: createDefaultNewsPreferenceProfile(),
    stored,
  });
};

const emptyNewsSearchMemoryItems: NewsSearchMemoryItem[] = [];
let latestNewsSearchMemorySnapshot = "";
let latestNewsSearchMemoryItems: NewsSearchMemoryItem[] =
  emptyNewsSearchMemoryItems;

const readNewsSearchMemorySnapshot = () => {
  if (typeof window === "undefined") return emptyNewsSearchMemoryItems;

  const nextSnapshot = window.localStorage.getItem(newsSearchStorageKey) ?? "";
  if (nextSnapshot === latestNewsSearchMemorySnapshot) {
    return latestNewsSearchMemoryItems;
  }

  latestNewsSearchMemorySnapshot = nextSnapshot;
  latestNewsSearchMemoryItems = readStoredNewsSearchMemoryItems();
  return latestNewsSearchMemoryItems;
};

const getReaderSignalCount = (profile: NewsPreferenceProfile) =>
  profile.preferredCategories.length +
  profile.preferredEntities.length +
  profile.preferredSources.length;

const addUniqueProfileSignal = (signals: readonly string[], value: string) => {
  const normalizedValue = value.trim();
  const normalizedKey = normalizedValue.toLowerCase();

  if (
    !normalizedValue ||
    signals.some((signal) => signal.trim().toLowerCase() === normalizedKey)
  ) {
    return [...signals];
  }

  return [...signals, normalizedValue];
};

const normalizeSearchIntentSignal = (value: string) =>
  value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

const normalizeSearchIntentSignalKey = (value: string) =>
  normalizeSearchIntentSignal(value).toLowerCase();

const toggleProfileSignal = (signals: readonly string[], value: string) => {
  const normalizedValue = value.trim();
  const normalizedKey = normalizedValue.toLowerCase();

  if (!normalizedValue) return [...signals];

  return signals.some((signal) => signal.trim().toLowerCase() === normalizedKey)
    ? signals.filter((signal) => signal.trim().toLowerCase() !== normalizedKey)
    : addUniqueProfileSignal(signals, normalizedValue);
};

const toggleSearchIntentSignal = (
  signals: readonly string[],
  value: string,
) => {
  const normalizedValue = normalizeSearchIntentSignal(value);
  const normalizedKey = normalizedValue.toLowerCase();

  if (!normalizedValue) return [...signals];

  return signals.some(
    (signal) => normalizeSearchIntentSignalKey(signal) === normalizedKey,
  )
    ? signals.filter(
        (signal) => normalizeSearchIntentSignalKey(signal) !== normalizedKey,
      )
    : addUniqueProfileSignal(signals, normalizedValue);
};

export const applyNewsEditionFollowAction = ({
  filter,
  profile,
}: {
  filter: NewsEditionFilter;
  profile: NewsPreferenceProfile;
}): NewsPreferenceProfile => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  return normalizeNewsPreferenceProfile({
    ...normalizedProfile,
    preferredCategories:
      filter.kind === "topic"
        ? toggleProfileSignal(
            normalizedProfile.preferredCategories,
            filter.value,
          )
        : [...normalizedProfile.preferredCategories],
    preferredEntities:
      filter.kind === "entity"
        ? toggleProfileSignal(normalizedProfile.preferredEntities, filter.value)
        : filter.kind === "search"
          ? toggleSearchIntentSignal(
              normalizedProfile.preferredEntities,
              filter.value,
            )
          : [...normalizedProfile.preferredEntities],
    preferredSources:
      filter.kind === "source"
        ? toggleProfileSignal(normalizedProfile.preferredSources, filter.value)
        : [...normalizedProfile.preferredSources],
  });
};

export const getNewsEditionFollowState = ({
  filter,
  profile,
}: {
  filter: NewsEditionFilter;
  profile: NewsPreferenceProfile;
}): NewsEditionFollowState | null => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const normalizedFilterValue = filter.value.trim().toLowerCase();
  if (!normalizedFilterValue) return null;

  const hasFollowedSignal = (signals: readonly string[]) => {
    return signals.some(
      (signal) => signal.trim().toLowerCase() === normalizedFilterValue,
    );
  };
  const hasFollowedSearchIntent = (signals: readonly string[]) => {
    const normalizedSearchValue = normalizeSearchIntentSignalKey(filter.value);

    return signals.some(
      (signal) =>
        normalizeSearchIntentSignalKey(signal) === normalizedSearchValue,
    );
  };
  const isFollowing =
    filter.kind === "topic"
      ? hasFollowedSignal(normalizedProfile.preferredCategories)
      : filter.kind === "source"
        ? hasFollowedSignal(normalizedProfile.preferredSources)
        : filter.kind === "search"
          ? hasFollowedSearchIntent(normalizedProfile.preferredEntities)
          : hasFollowedSignal(normalizedProfile.preferredEntities);

  return {
    isFollowing,
    label: isFollowing
      ? filter.kind === "topic"
        ? "Following topic"
        : filter.kind === "source"
          ? "Following source"
          : filter.kind === "entity"
            ? "Following entity"
            : "Following search"
      : filter.kind === "topic"
        ? "Follow topic"
        : filter.kind === "source"
          ? "Follow source"
          : filter.kind === "entity"
            ? "Follow entity"
            : "Follow search",
  };
};

export const selectNewsEditionReaderLens = ({
  items,
  limit = 3,
  now = new Date(),
  profile,
  searchMemoryItems = [],
}: {
  items: readonly NewsHomeItem[];
  limit?: number;
  now?: Date;
  profile: NewsPreferenceProfile;
  searchMemoryItems?: readonly NewsSearchMemoryItem[];
}): NewsEditionReaderLensModel => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const rankedItems = selectNewsHomeSearchMemoryAnchoredItems({
    items: rankNewsForReader(items, normalizedProfile, now),
    searchItems: searchMemoryItems,
  });
  const readerMatchedItems = rankedItems.filter(
    (item) => item.matchedSignals.length > 0,
  );
  const searchMatchedItems = rankedItems.filter((item) =>
    item.matchedSignals.includes("search_memory"),
  );
  const selectedItems = (
    readerMatchedItems.length > 0 ? readerMatchedItems : rankedItems
  ).slice(0, limit);
  const readerSignalCount = getReaderSignalCount(normalizedProfile);
  const searchMemoryCount = searchMemoryItems.length;

  return {
    items: selectedItems,
    label:
      readerSignalCount > 0 || searchMemoryCount > 0
        ? "For You lens"
        : "Starter lens",
    metrics: [
      { label: "Reader signals", value: String(readerSignalCount) },
      { label: "Searches", value: String(searchMemoryCount) },
      { label: "Matches", value: String(readerMatchedItems.length) },
      {
        label: "Top score",
        value: selectedItems[0]?.personalizedScore.toString() ?? "0",
      },
    ],
    summary:
      searchMatchedItems.length > 0
        ? `${searchMatchedItems.length} stories in this edition match your recent search memory.`
        : readerMatchedItems.length > 0
          ? `${readerMatchedItems.length} stories in this edition match your reader profile.`
          : "No direct profile match yet. The lens is using heat, freshness, and source trust.",
  };
};

const writeStoredProfile = (profile: NewsPreferenceProfile) => {
  writeStoredNewsPreferenceProfile(profile);
};

export function NewsEditionReaderLens({
  filter,
  isPreview = false,
  items,
}: {
  filter: NewsEditionFilter;
  isPreview?: boolean;
  items: readonly NewsHomeItem[];
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [visitorKey] = useState<string | null>(() =>
    readOrCreateNewsVisitorKey(),
  );
  const canUseServerReaderMemory = !isPreview && Boolean(visitorKey);
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
  const profileQuery = useQuery(
    trpc.news.profile.queryOptions(
      { visitorKey: visitorKey ?? undefined },
      { enabled: canUseServerReaderMemory },
    ),
  );
  const profileSnapshot = useSyncExternalStore(
    subscribeToNewsPreferenceProfileStorage,
    readNewsPreferenceProfileSnapshot,
    () => emptyNewsPreferenceProfileSnapshot,
  );
  const profile = useMemo(
    () => readStoredProfile(profileSnapshot),
    [profileSnapshot],
  );
  const searchMemoryItems = useSyncExternalStore(
    subscribeToNewsReaderMemoryStorage,
    readNewsSearchMemorySnapshot,
    () => emptyNewsSearchMemoryItems,
  );

  useEffect(() => {
    if (!profileQuery.data?.persisted) return;

    const nextProfile = selectHydratedNewsPreferenceProfile({
      localProfile: profile,
      serverProfile: profileQuery.data,
    });

    if (areNewsPreferenceProfilesEqual(profile, nextProfile)) return;

    writeStoredProfile(nextProfile);
  }, [profile, profileQuery.data]);

  const lens = useMemo(
    () =>
      selectNewsEditionReaderLens({
        items,
        profile,
        searchMemoryItems,
      }),
    [items, profile, searchMemoryItems],
  );
  const followState = useMemo(
    () => getNewsEditionFollowState({ filter, profile }),
    [filter, profile],
  );

  if (items.length === 0) return null;

  return (
    <section className="border-b border-[#161616]/25 bg-[#fffdf7] dark:border-[#f4f1ea]/20 dark:bg-[#181818]">
      <div className="container grid gap-4 py-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(280px,1.2fr)_auto] lg:items-center">
        <div>
          <p className="font-mono text-xs tracking-[0.18em] uppercase">
            {lens.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
            {lens.summary}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {lens.items.map((item, index) => (
            <article
              key={item.id}
              className="grid gap-2 border-t border-[#161616]/25 pt-2 dark:border-[#f4f1ea]/20"
            >
              <Link className="hover:underline" href={`/news/${item.id}`}>
                <span className="block font-mono text-[11px] text-[#5b5750] dark:text-[#bbb4aa]">
                  Score {item.personalizedScore}
                </span>
                <span className="mt-1 block text-sm leading-5 font-black">
                  {item.title}
                </span>
              </Link>
              <NewsEditionStoryActions
                isPreview={isPreview}
                item={item}
                rankSlot={index + 1}
              />
            </article>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 text-center font-mono text-[10px] sm:grid-cols-4 lg:min-w-80">
          {lens.metrics.map((metric) => (
            <div
              key={metric.label}
              className="border border-[#161616]/25 px-2 py-2 dark:border-[#f4f1ea]/20"
            >
              <p className="tracking-[0.12em] uppercase">{metric.label}</p>
              <p className="mt-1 text-lg font-black">{metric.value}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 lg:col-start-3 lg:justify-end">
          {followState ? (
            <Button
              aria-label={`${followState.label}: ${filter.title}`}
              aria-pressed={followState.isFollowing}
              className="rounded-none"
              onClick={() => {
                const nextProfile = applyNewsEditionFollowAction({
                  filter,
                  profile,
                });

                writeStoredProfile(nextProfile);

                if (!canUseServerReaderMemory) return;
                if (!visitorKey) return;

                updateProfile.mutate({
                  profile: toNewsServerPreferenceProfileInput(nextProfile),
                  visitorKey,
                });
              }}
              type="button"
              variant={followState.isFollowing ? "outline" : "default"}
            >
              {followState.label}
            </Button>
          ) : null}
          <Button asChild className="rounded-none" variant="outline">
            <Link href="/">Tune For You</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
