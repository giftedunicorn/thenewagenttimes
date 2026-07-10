"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { NewsPreferenceProfile } from "@acme/validators";
import { Button } from "@acme/ui/button";
import { normalizeNewsPreferenceProfile } from "@acme/validators";

import type {
  NewsDirectoryPageData,
  NewsDirectoryPageEntry,
} from "./news-directory-page";
import type { NewsSearchMemoryItem } from "./news-reader-memory-storage";
import { useTRPC } from "~/trpc/react";
import { applyNewsEditionFollowAction } from "./news-edition-reader-lens";
import {
  createDefaultNewsPreferenceProfile,
  selectHydratedNewsPreferenceProfile,
} from "./news-home-model";
import {
  emptyNewsSearchMemorySnapshot,
  parseNewsSearchMemorySnapshot,
  readNewsSearchMemorySnapshot,
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

export interface NewsDirectoryReaderLensEntry {
  href: string;
  label: string;
  summary: string;
  title: string;
  value: string;
}

export interface NewsDirectoryReaderLensModel {
  entries: NewsDirectoryReaderLensEntry[];
  label: string;
  metrics: {
    label: string;
    value: string;
  }[];
  summary: string;
}

const readStoredProfile = (stored: string): NewsPreferenceProfile =>
  parseStoredNewsPreferenceProfile({
    defaultProfile: createDefaultNewsPreferenceProfile(),
    stored,
  });

const getDirectorySignalLabel = ({
  count,
  kind,
}: {
  count: number;
  kind: NewsDirectoryPageData["kind"];
}) => {
  const singular =
    kind === "topic" ? "topic" : kind === "entity" ? "entity" : "source";

  return count === 1 ? singular : `${singular}s`;
};

const getDirectoryFollowedValues = ({
  directory,
  profile,
}: {
  directory: NewsDirectoryPageData;
  profile: NewsPreferenceProfile;
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  const values =
    directory.kind === "topic"
      ? normalizedProfile.preferredCategories
      : directory.kind === "entity"
        ? normalizedProfile.preferredEntities
        : normalizedProfile.preferredSources;

  return new Set(values.map((value) => value.trim().toLowerCase()));
};

const toReaderLensEntry = ({
  entry,
  isFollowing,
  label,
  summarySuffix,
}: {
  entry: NewsDirectoryPageEntry;
  isFollowing: boolean;
  label?: string;
  summarySuffix?: string;
}): NewsDirectoryReaderLensEntry => ({
  href: entry.href,
  label: label ?? (isFollowing ? "Following" : "Coverage leader"),
  summary: [entry.countLabel, entry.metricLabel, summarySuffix]
    .filter((value): value is string => Boolean(value))
    .join(" / "),
  title: entry.title,
  value: entry.value,
});

const toSearchableDirectoryText = (entry: NewsDirectoryPageEntry) =>
  [
    entry.title,
    entry.value,
    entry.latestItem.title,
    entry.latestItem.summary,
    entry.latestItem.sourceName,
    entry.latestItem.sourceSlug,
    entry.latestItem.category,
    ...entry.latestItem.tags,
    ...entry.latestItem.entities,
  ]
    .join(" ")
    .toLowerCase();

const toSearchQueryTokens = (query: string) =>
  query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const getDirectorySearchMatch = ({
  directory,
  searchMemoryItems,
}: {
  directory: NewsDirectoryPageData;
  searchMemoryItems: readonly NewsSearchMemoryItem[];
}) => {
  const sortedSearchMemoryItems = [...searchMemoryItems].sort(
    (left, right) => Date.parse(right.searchedAt) - Date.parse(left.searchedAt),
  );

  for (const searchMemoryItem of sortedSearchMemoryItems) {
    const tokens = toSearchQueryTokens(searchMemoryItem.query);

    if (tokens.length === 0) continue;

    const entry = directory.entries.find((directoryEntry) => {
      const searchableText = toSearchableDirectoryText(directoryEntry);

      return tokens.every((token) => searchableText.includes(token));
    });

    if (entry) {
      return {
        entry,
        query: searchMemoryItem.query,
      };
    }
  }

  return null;
};

export const selectNewsDirectoryReaderLens = ({
  directory,
  limit = 4,
  profile,
  searchMemoryItems = [],
}: {
  directory: NewsDirectoryPageData;
  limit?: number;
  profile: NewsPreferenceProfile;
  searchMemoryItems?: readonly NewsSearchMemoryItem[];
}): NewsDirectoryReaderLensModel => {
  const followedValues = getDirectoryFollowedValues({ directory, profile });
  const followedEntries = directory.entries.filter((entry) =>
    followedValues.has(entry.value.trim().toLowerCase()),
  );
  const searchMatch =
    followedEntries.length === 0
      ? getDirectorySearchMatch({ directory, searchMemoryItems })
      : null;
  const selectedSourceEntries =
    followedEntries.length > 0
      ? followedEntries
      : searchMatch
        ? [searchMatch.entry]
        : directory.entries;
  const selectedEntries = selectedSourceEntries
    .slice(0, followedEntries.length > 0 ? limit : 1)
    .map((entry) => {
      const isSearchMatch = searchMatch?.entry.value === entry.value;

      return toReaderLensEntry({
        entry,
        isFollowing: followedValues.has(entry.value.trim().toLowerCase()),
        label: isSearchMatch ? "Search match" : undefined,
        summarySuffix: isSearchMatch ? searchMatch.query : undefined,
      });
    });
  const searchMatchEntry =
    searchMatch && selectedEntries.length > 0
      ? selectedEntries.find((entry) => entry.value === searchMatch.entry.value)
      : null;
  const searchMatchSummary =
    searchMatch && searchMatchEntry
      ? `Recent search "${searchMatch.query}" matches ${searchMatchEntry.title} in this directory.`
      : null;
  const profileMatchCount = followedEntries.length;
  const signalLabel = getDirectorySignalLabel({
    count: profileMatchCount,
    kind: directory.kind,
  });

  return {
    entries: selectedEntries,
    label:
      profileMatchCount > 0
        ? "Directory match"
        : searchMatchSummary
          ? "Directory search match"
          : "Starter directory",
    metrics: [
      { label: "Profile matches", value: String(profileMatchCount) },
      { label: "Sections", value: String(directory.entries.length) },
      { label: "Mode", value: directory.title },
    ],
    summary:
      profileMatchCount > 0
        ? `${profileMatchCount} followed ${signalLabel} ${
            profileMatchCount === 1 ? "is" : "are"
          } live in this directory.`
        : (searchMatchSummary ??
          `No followed ${getDirectorySignalLabel({
            count: 1,
            kind: directory.kind,
          })} is live here yet. Start with the strongest coverage sections.`),
  };
};

export function NewsDirectoryReaderLens({
  directory,
}: {
  directory: NewsDirectoryPageData;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [visitorKey] = useState<string | null>(() =>
    readOrCreateNewsVisitorKey(),
  );
  const canUseServerReaderMemory =
    directory.status === "ready" && Boolean(visitorKey);
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
  const searchMemorySnapshot = useSyncExternalStore(
    subscribeToNewsReaderMemoryStorage,
    readNewsSearchMemorySnapshot,
    () => emptyNewsSearchMemorySnapshot,
  );
  const searchMemoryItems = useMemo(
    () => parseNewsSearchMemorySnapshot(searchMemorySnapshot),
    [searchMemorySnapshot],
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
  const lens = useMemo(
    () =>
      selectNewsDirectoryReaderLens({
        directory,
        profile,
        searchMemoryItems,
      }),
    [directory, profile, searchMemoryItems],
  );

  if (directory.entries.length === 0) return null;

  return (
    <section className="border-b border-[#161616]/25 bg-[#fffdf7] dark:border-[#f4f1ea]/20 dark:bg-[#181818]">
      <div className="container grid gap-4 py-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto] lg:items-center">
        <div>
          <p className="font-mono text-xs tracking-[0.18em] uppercase">
            {lens.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
            {lens.summary}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {lens.entries.map((entry) => (
            <div
              className="grid gap-2 border-t border-[#161616]/25 pt-2 dark:border-[#f4f1ea]/20"
              key={entry.value}
            >
              <Link className="hover:underline" href={entry.href}>
                <span className="block font-mono text-[11px] text-[#5b5750] dark:text-[#bbb4aa]">
                  {entry.label}
                </span>
                <span className="mt-1 block text-sm leading-5 font-black">
                  {entry.title}
                </span>
                <span className="mt-1 block text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                  {entry.summary}
                </span>
              </Link>
              <Button
                className="h-8 rounded-none px-2 text-xs"
                onClick={() => {
                  const nextProfile = applyNewsEditionFollowAction({
                    filter: {
                      kind: directory.kind,
                      title: entry.title,
                      value: entry.value,
                    },
                    profile,
                  });

                  writeStoredNewsPreferenceProfile(nextProfile);

                  if (!canUseServerReaderMemory) return;
                  if (!visitorKey) return;

                  updateProfile.mutate({
                    profile: toNewsServerPreferenceProfileInput(nextProfile),
                    visitorKey,
                  });
                }}
                type="button"
                variant={entry.label === "Following" ? "outline" : "default"}
              >
                {entry.label === "Following" ? "Unfollow" : "Follow"}
              </Button>
            </div>
          ))}
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center font-mono text-[10px] lg:min-w-72">
          {lens.metrics.map((metric) => (
            <div
              className="border border-[#161616]/25 px-2 py-2 dark:border-[#f4f1ea]/20"
              key={metric.label}
            >
              <dt className="tracking-[0.12em] uppercase">{metric.label}</dt>
              <dd className="mt-1 text-lg font-black">{metric.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
