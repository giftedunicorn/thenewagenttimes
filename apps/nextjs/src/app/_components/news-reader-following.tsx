"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { NewsPreferenceProfile } from "@acme/validators";
import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import { Label } from "@acme/ui/label";
import {
  getNewsRecommendationAngleLabels,
  normalizeNewsPreferenceProfile,
} from "@acme/validators";

import type { NewsHomeItem, NewsHomeStatus } from "./news-home-model";
import { useTRPC } from "~/trpc/react";
import { NewsEditionStoryActions } from "./news-edition-story-actions";
import {
  createDefaultNewsPreferenceProfile,
  formatNewsTime,
  getNewsTopicHref,
  selectHydratedNewsPreferenceProfile,
} from "./news-home-model";
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

export type NewsReaderFollowingSignalKind =
  | "angle"
  | "entity"
  | "source"
  | "topic";

interface NewsReaderFollowingMetric {
  label: string;
  value: string;
}

export interface NewsReaderFollowingEntry {
  href: string;
  kind: NewsReaderFollowingSignalKind;
  label: string;
  signal: string;
  summary: string;
}

interface NewsReaderFollowingAddInput {
  kind: NewsReaderFollowingSignalKind;
  signal: string;
}

interface NewsReaderFollowingSection {
  emptyLabel: string;
  entries: NewsReaderFollowingEntry[];
  label: string;
  summary: string;
}

interface NewsReaderFollowingFeedStory {
  href: string;
  id: string;
  item: NewsHomeItem;
  matchLabel: string;
  publishedAt: string;
  reason: string;
  sourceName: string;
  title: string;
}

interface NewsReaderFollowingCoverageGap {
  href: string;
  kind: NewsReaderFollowingSignalKind;
  label: string;
  recoveryHref: string;
  signal: string;
  summary: string;
}

export interface NewsReaderFollowingSuggestion {
  actionLabel: string;
  href: string;
  kind: NewsReaderFollowingSignalKind;
  label: string;
  signal: string;
  summary: string;
  supportLabel: string;
}

export interface NewsReaderFollowingModel {
  coverageGaps: NewsReaderFollowingCoverageGap[];
  feed: NewsReaderFollowingFeedStory[];
  feedSummary: string;
  gapSummary: string;
  metrics: NewsReaderFollowingMetric[];
  sections: NewsReaderFollowingSection[];
  summary: string;
  suggestions: NewsReaderFollowingSuggestion[];
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

const normalizeFollowingSignal = (value: string) => value.trim().toLowerCase();

const getSearchHref = (query: string) =>
  `/search?q=${encodeURIComponent(query)}`;

const getEntityEditionHref = (entity: string) =>
  `/entities/${encodeURIComponent(entity)}`;

const removeFollowingSignalFromList = (
  values: readonly string[],
  signal: string,
) => {
  const normalizedSignal = normalizeFollowingSignal(signal);

  return values.filter(
    (value) => normalizeFollowingSignal(value) !== normalizedSignal,
  );
};

const addFollowingSignalToList = (
  values: readonly string[],
  signal: string,
) => {
  const trimmedSignal = signal.trim();

  return trimmedSignal ? [...values, trimmedSignal] : [...values];
};

const toTopicEntry = (signal: string): NewsReaderFollowingEntry => ({
  href: getNewsTopicHref(signal),
  kind: "topic",
  label: formatCategory(signal),
  signal,
  summary: "Topic signal",
});

const getFollowingSourceLabelMap = (items: readonly NewsHomeItem[]) => {
  const labels = new Map<string, string>();

  for (const item of items) {
    const sourceSlug = item.sourceSlug.trim();
    const sourceName = item.sourceName.trim();

    if (!sourceSlug || !sourceName) continue;

    labels.set(normalizeFollowingSignal(sourceSlug), sourceName);
  }

  return labels;
};

const toSourceEntry = (
  signal: string,
  sourceLabels: ReadonlyMap<string, string>,
): NewsReaderFollowingEntry => ({
  href: `/sources/${signal}`,
  kind: "source",
  label: sourceLabels.get(normalizeFollowingSignal(signal)) ?? signal,
  signal,
  summary: "Source signal",
});

const getFollowingEntityLabelMap = (items: readonly NewsHomeItem[]) => {
  const labels = new Map<string, string>();

  for (const item of items) {
    for (const entity of item.entities) {
      const label = entity.trim();

      if (!label) continue;

      labels.set(normalizeFollowingSignal(label), label);
    }
  }

  return labels;
};

const getFollowingAngleLabelMap = (items: readonly NewsHomeItem[]) => {
  const labels = new Map<string, string>();

  for (const item of items) {
    for (const angle of getNewsRecommendationAngleLabels(item.tags)) {
      labels.set(normalizeFollowingSignal(angle), angle);
    }
  }

  return labels;
};

const looksLikeNamedEntitySignal = (signal: string) => /[A-Z]/.test(signal);

const isFollowingAngleSignal = ({
  angleLabels,
  entityLabels,
  signal,
}: {
  angleLabels: ReadonlyMap<string, string>;
  entityLabels: ReadonlyMap<string, string>;
  signal: string;
}) => {
  const normalizedSignal = normalizeFollowingSignal(signal);

  if (
    angleLabels.has(normalizedSignal) &&
    !entityLabels.has(normalizedSignal)
  ) {
    return true;
  }

  if (
    entityLabels.has(normalizedSignal) ||
    looksLikeNamedEntitySignal(signal)
  ) {
    return false;
  }

  return getNewsRecommendationAngleLabels([signal]).length > 0;
};

const toEntityEntry = (
  signal: string,
  entityLabels: ReadonlyMap<string, string>,
): NewsReaderFollowingEntry => {
  const entityLabel = entityLabels.get(normalizeFollowingSignal(signal));
  const label = entityLabel ?? signal;
  const isNamedEntity =
    Boolean(entityLabel) || looksLikeNamedEntitySignal(signal);

  return {
    href: isNamedEntity ? getEntityEditionHref(label) : getSearchHref(signal),
    kind: "entity",
    label,
    signal,
    summary: isNamedEntity ? "Entity signal" : "Angle signal",
  };
};

const toAngleEntry = (
  signal: string,
  angleLabels: ReadonlyMap<string, string>,
): NewsReaderFollowingEntry => {
  const label =
    angleLabels.get(normalizeFollowingSignal(signal)) ??
    getNewsRecommendationAngleLabels([signal])[0] ??
    signal;

  return {
    href: getSearchHref(label),
    kind: "angle",
    label,
    signal,
    summary: "Angle signal",
  };
};

const toEntityOrAngleEntry = ({
  angleLabels,
  entityLabels,
  signal,
}: {
  angleLabels: ReadonlyMap<string, string>;
  entityLabels: ReadonlyMap<string, string>;
  signal: string;
}) =>
  isFollowingAngleSignal({ angleLabels, entityLabels, signal })
    ? toAngleEntry(signal, angleLabels)
    : toEntityEntry(signal, entityLabels);

const hasFollowingSignal = (values: readonly string[], signal: string) => {
  const normalizedSignal = normalizeFollowingSignal(signal);

  return values.some(
    (value) => normalizeFollowingSignal(value) === normalizedSignal,
  );
};

const getFollowingEntityMatches = ({
  item,
  profile,
}: {
  item: NewsHomeItem;
  profile: NewsPreferenceProfile;
}) => {
  const entityLabels = getFollowingEntityLabelMap([item]);
  const angleLabels = getFollowingAngleLabelMap([item]);
  const itemSignals = [
    ...item.entities,
    ...getNewsRecommendationAngleLabels(item.tags),
    item.title,
  ].map(normalizeFollowingSignal);

  return profile.preferredEntities.flatMap((signal) => {
    const normalizedSignal = normalizeFollowingSignal(signal);

    if (!normalizedSignal) return [];

    const matches = itemSignals.some(
      (itemSignal) =>
        itemSignal === normalizedSignal ||
        itemSignal.includes(normalizedSignal),
    );

    if (!matches) return [];

    return [
      {
        kind: isFollowingAngleSignal({ angleLabels, entityLabels, signal })
          ? ("angle" as const)
          : ("entity" as const),
        signal,
      },
    ];
  });
};

const doesFollowingStoryMatchEntitySignal = ({
  item,
  signal,
}: {
  item: NewsHomeItem;
  signal: string;
}) => {
  const normalizedSignal = normalizeFollowingSignal(signal);

  if (!normalizedSignal) return false;

  return [...item.entities, item.title]
    .map(normalizeFollowingSignal)
    .some(
      (itemSignal) =>
        itemSignal === normalizedSignal ||
        itemSignal.includes(normalizedSignal),
    );
};

const doesFollowingStoryMatchAngleSignal = ({
  item,
  signal,
}: {
  item: NewsHomeItem;
  signal: string;
}) => {
  const normalizedSignal = normalizeFollowingSignal(signal);

  if (!normalizedSignal) return false;

  return [...getNewsRecommendationAngleLabels(item.tags), item.title]
    .map(normalizeFollowingSignal)
    .some(
      (itemSignal) =>
        itemSignal === normalizedSignal ||
        itemSignal.includes(normalizedSignal),
    );
};

const getFollowingFeedReason = (matches: {
  angleCount: number;
  entityCount: number;
  source: boolean;
  topic: boolean;
}) => {
  const labels = [
    ...(matches.topic ? ["Topic"] : []),
    ...(matches.source ? ["source"] : []),
    ...(matches.entityCount > 0 ? ["entity"] : []),
    ...(matches.angleCount > 0 ? ["angle"] : []),
  ];

  if (labels.length === 0) return "No direct following match";
  if (labels.length === 1) return `${labels[0]} match`;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]} matches`;

  return `${labels.slice(0, -1).join(", ")}, and ${
    labels[labels.length - 1]
  } matches`;
};

const getPastFollowingPublishedAtTime = (publishedAt: string, now: number) => {
  const timestamp = Date.parse(publishedAt);

  return Number.isNaN(timestamp) || timestamp > now ? 0 : timestamp;
};

const sortFollowingFeedStories = (
  left: NewsReaderFollowingFeedStory & { matchCount: number },
  right: NewsReaderFollowingFeedStory & { matchCount: number },
  now: number,
) => {
  if (right.matchCount !== left.matchCount) {
    return right.matchCount - left.matchCount;
  }

  return (
    getPastFollowingPublishedAtTime(right.publishedAt, now) -
    getPastFollowingPublishedAtTime(left.publishedAt, now)
  );
};

const selectNewsReaderFollowingFeed = ({
  items,
  limit,
  profile,
}: {
  items: readonly NewsHomeItem[];
  limit: number;
  profile: NewsPreferenceProfile;
}): NewsReaderFollowingFeedStory[] => {
  const now = Date.now();

  return items
    .map((item) => {
      const topicMatch = hasFollowingSignal(
        profile.preferredCategories,
        item.category,
      );
      const sourceMatch = hasFollowingSignal(
        profile.preferredSources,
        item.sourceSlug,
      );
      const entityMatches = getFollowingEntityMatches({ item, profile });
      const entityMatchCount = entityMatches.filter(
        (match) => match.kind === "entity",
      ).length;
      const angleMatchCount = entityMatches.filter(
        (match) => match.kind === "angle",
      ).length;
      const matchCount =
        (topicMatch ? 1 : 0) + (sourceMatch ? 1 : 0) + entityMatches.length;

      if (matchCount === 0) return null;

      return {
        href: `/news/${item.id}`,
        id: item.id,
        item,
        matchCount,
        matchLabel: `${matchCount} ${matchCount === 1 ? "signal" : "signals"}`,
        publishedAt: item.publishedAt,
        reason: getFollowingFeedReason({
          angleCount: angleMatchCount,
          entityCount: entityMatchCount,
          source: sourceMatch,
          topic: topicMatch,
        }),
        sourceName: item.sourceName,
        title: item.title,
      };
    })
    .filter(
      (story): story is NewsReaderFollowingFeedStory & { matchCount: number } =>
        story !== null,
    )
    .sort((left, right) => sortFollowingFeedStories(left, right, now))
    .slice(0, limit)
    .map(({ matchCount: _matchCount, ...story }) => story);
};

const doesFollowingStoryCoverEntry = ({
  entry,
  item,
}: {
  entry: NewsReaderFollowingEntry;
  item: NewsHomeItem;
}) => {
  if (entry.kind === "topic") {
    return (
      normalizeFollowingSignal(item.category) ===
      normalizeFollowingSignal(entry.signal)
    );
  }

  if (entry.kind === "source") {
    return (
      normalizeFollowingSignal(item.sourceSlug) ===
      normalizeFollowingSignal(entry.signal)
    );
  }

  if (entry.kind === "angle") {
    return doesFollowingStoryMatchAngleSignal({
      item,
      signal: entry.signal,
    });
  }

  return doesFollowingStoryMatchEntitySignal({
    item,
    signal: entry.signal,
  });
};

const getFollowingCoverageGapSummary = ({
  gapCount,
  signalCount,
}: {
  gapCount: number;
  signalCount: number;
}) => {
  if (signalCount === 0) return "Follow signals to audit coverage gaps.";
  if (gapCount === 0) return "Every followed signal has current coverage.";

  return `${gapCount} followed ${
    gapCount === 1 ? "signal needs" : "signals need"
  } fresh coverage.`;
};

const toFollowingCoverageGap = (
  entry: NewsReaderFollowingEntry,
): NewsReaderFollowingCoverageGap => ({
  href: entry.href,
  kind: entry.kind,
  label: entry.label,
  recoveryHref: `/search?q=${encodeURIComponent(entry.label)}`,
  signal: entry.signal,
  summary:
    entry.kind === "topic"
      ? "No current following feed story matches this topic."
      : entry.kind === "source"
        ? "No current following feed story matches this source."
        : entry.kind === "angle"
          ? "No current following feed story matches this angle."
          : "No current following feed story matches this entity.",
});

const selectNewsReaderFollowingCoverageGaps = ({
  items,
  sections,
}: {
  items: readonly NewsHomeItem[];
  sections: readonly NewsReaderFollowingSection[];
}) =>
  sections.flatMap((section) =>
    section.entries
      .filter(
        (entry) =>
          !items.some((item) => doesFollowingStoryCoverEntry({ entry, item })),
      )
      .map(toFollowingCoverageGap),
  );

interface NewsReaderFollowingSuggestionCandidate {
  firstIndex: number;
  href: string;
  kind: NewsReaderFollowingSignalKind;
  label: string;
  latestPublishedAt: number;
  signal: string;
  storyCount: number;
}

const followingSuggestionKindOrder = {
  angle: 3,
  topic: 0,
  source: 1,
  entity: 2,
} satisfies Record<NewsReaderFollowingSignalKind, number>;

const getFollowingSuggestionActionLabel = (
  kind: NewsReaderFollowingSignalKind,
) => {
  if (kind === "topic") return "Follow topic";
  if (kind === "source") return "Follow source";
  if (kind === "angle") return "Follow angle";

  return "Follow entity";
};

const getFollowingSuggestionSupportLabel = (storyCount: number) =>
  `${storyCount} ${storyCount === 1 ? "story" : "stories"}`;

const toFollowingSuggestion = (
  candidate: NewsReaderFollowingSuggestionCandidate,
): NewsReaderFollowingSuggestion => {
  const supportLabel = getFollowingSuggestionSupportLabel(candidate.storyCount);

  return {
    actionLabel: getFollowingSuggestionActionLabel(candidate.kind),
    href: candidate.href,
    kind: candidate.kind,
    label: candidate.label,
    signal: candidate.signal,
    summary: `Follow ${candidate.label} from ${candidate.storyCount} current ${
      candidate.storyCount === 1 ? "story" : "stories"
    } to lift similar coverage.`,
    supportLabel,
  };
};

const getFollowingSuggestionKey = ({
  kind,
  signal,
}: {
  kind: NewsReaderFollowingSignalKind;
  signal: string;
}) => `${kind}:${normalizeFollowingSignal(signal)}`;

const addFollowingSuggestionCandidate = ({
  candidates,
  firstIndex,
  href,
  kind,
  label,
  now,
  publishedAt,
  signal,
}: {
  candidates: Map<string, NewsReaderFollowingSuggestionCandidate>;
  firstIndex: number;
  href: string;
  kind: NewsReaderFollowingSignalKind;
  label: string;
  now: number;
  publishedAt: string;
  signal: string;
}) => {
  const trimmedSignal = signal.trim();
  const trimmedLabel = label.trim();
  const key = getFollowingSuggestionKey({ kind, signal: trimmedSignal });
  const safeLatestPublishedAt = getPastFollowingPublishedAtTime(
    publishedAt,
    now,
  );
  const existingCandidate = candidates.get(key);

  if (!trimmedSignal || !trimmedLabel) return;

  if (existingCandidate) {
    existingCandidate.storyCount += 1;
    existingCandidate.latestPublishedAt = Math.max(
      existingCandidate.latestPublishedAt,
      safeLatestPublishedAt,
    );
    return;
  }

  candidates.set(key, {
    firstIndex,
    href,
    kind,
    label: trimmedLabel,
    latestPublishedAt: safeLatestPublishedAt,
    signal: trimmedSignal,
    storyCount: 1,
  });
};

const compareFollowingSuggestionCandidates = (
  left: NewsReaderFollowingSuggestionCandidate,
  right: NewsReaderFollowingSuggestionCandidate,
) => {
  if (right.storyCount !== left.storyCount) {
    return right.storyCount - left.storyCount;
  }

  if (right.latestPublishedAt !== left.latestPublishedAt) {
    return right.latestPublishedAt - left.latestPublishedAt;
  }

  return left.label.localeCompare(right.label);
};

const selectNewsReaderFollowingSuggestions = ({
  items,
  limit = 4,
  profile,
}: {
  items: readonly NewsHomeItem[];
  limit?: number;
  profile: NewsPreferenceProfile;
}): NewsReaderFollowingSuggestion[] => {
  const candidates = new Map<string, NewsReaderFollowingSuggestionCandidate>();
  const maxLimit = Math.max(0, Math.trunc(limit));
  const now = Date.now();

  items.forEach((item, firstIndex) => {
    if (!hasFollowingSignal(profile.preferredCategories, item.category)) {
      addFollowingSuggestionCandidate({
        candidates,
        firstIndex,
        href: getNewsTopicHref(item.category),
        kind: "topic",
        label: formatCategory(item.category),
        now,
        publishedAt: item.publishedAt,
        signal: item.category,
      });
    }

    if (!hasFollowingSignal(profile.preferredSources, item.sourceSlug)) {
      addFollowingSuggestionCandidate({
        candidates,
        firstIndex,
        href: `/sources/${item.sourceSlug}`,
        kind: "source",
        label: item.sourceName,
        now,
        publishedAt: item.publishedAt,
        signal: item.sourceSlug,
      });
    }

    const seenEntitySignals = new Set<string>();

    for (const entity of item.entities) {
      const normalizedEntity = normalizeFollowingSignal(entity);

      if (
        !normalizedEntity ||
        seenEntitySignals.has(normalizedEntity) ||
        hasFollowingSignal(profile.preferredEntities, entity)
      ) {
        continue;
      }

      seenEntitySignals.add(normalizedEntity);
      addFollowingSuggestionCandidate({
        candidates,
        firstIndex,
        href: getEntityEditionHref(entity),
        kind: "entity",
        label: entity,
        now,
        publishedAt: item.publishedAt,
        signal: entity,
      });
    }

    const seenAngleSignals = new Set<string>();

    for (const angle of getNewsRecommendationAngleLabels(item.tags)) {
      const normalizedAngle = normalizeFollowingSignal(angle);

      if (
        !normalizedAngle ||
        seenAngleSignals.has(normalizedAngle) ||
        hasFollowingSignal(profile.preferredEntities, angle)
      ) {
        continue;
      }

      seenAngleSignals.add(normalizedAngle);
      addFollowingSuggestionCandidate({
        candidates,
        firstIndex,
        href: getSearchHref(angle),
        kind: "angle",
        label: angle,
        now,
        publishedAt: item.publishedAt,
        signal: angle,
      });
    }
  });

  const sortedCandidates = Array.from(candidates.values()).sort(
    compareFollowingSuggestionCandidates,
  );
  const selectedCandidates: NewsReaderFollowingSuggestionCandidate[] = [];
  const selectedKeys = new Set<string>();

  for (const kind of [
    "topic",
    "source",
    "entity",
    "angle",
  ] satisfies NewsReaderFollowingSignalKind[]) {
    const candidate = sortedCandidates.find((item) => item.kind === kind);

    if (!candidate || selectedCandidates.length >= maxLimit) continue;

    selectedCandidates.push(candidate);
    selectedKeys.add(getFollowingSuggestionKey(candidate));
  }

  for (const candidate of sortedCandidates) {
    if (selectedCandidates.length >= maxLimit) break;

    const key = getFollowingSuggestionKey(candidate);

    if (selectedKeys.has(key)) continue;

    selectedCandidates.push(candidate);
    selectedKeys.add(key);
  }

  return selectedCandidates
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return (
          followingSuggestionKindOrder[left.kind] -
          followingSuggestionKindOrder[right.kind]
        );
      }

      return compareFollowingSuggestionCandidates(left, right);
    })
    .map(toFollowingSuggestion);
};

export const selectNewsReaderFollowing = ({
  items = [],
  limit = 8,
  profile,
}: {
  items?: readonly NewsHomeItem[];
  limit?: number;
  profile: NewsPreferenceProfile;
}): NewsReaderFollowingModel => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const topicEntries = normalizedProfile.preferredCategories.map(toTopicEntry);
  const sourceLabels = getFollowingSourceLabelMap(items);
  const sourceEntries = normalizedProfile.preferredSources.map((signal) =>
    toSourceEntry(signal, sourceLabels),
  );
  const entityLabels = getFollowingEntityLabelMap(items);
  const angleLabels = getFollowingAngleLabelMap(items);
  const entityOrAngleEntries = normalizedProfile.preferredEntities.map(
    (signal) =>
      toEntityOrAngleEntry({
        angleLabels,
        entityLabels,
        signal,
      }),
  );
  const entityEntries = entityOrAngleEntries.filter(
    (entry) => entry.kind === "entity",
  );
  const angleEntries = entityOrAngleEntries.filter(
    (entry) => entry.kind === "angle",
  );
  const signalCount =
    topicEntries.length +
    sourceEntries.length +
    entityEntries.length +
    angleEntries.length;
  const feed = selectNewsReaderFollowingFeed({
    items,
    limit,
    profile: normalizedProfile,
  });
  const sections = [
    {
      emptyLabel: "Follow topics from the front page or topic directory.",
      entries: topicEntries,
      label: "Topics",
      summary: "Topic preferences lift matching coverage in For You.",
    },
    {
      emptyLabel: "Follow sources from the source directory.",
      entries: sourceEntries,
      label: "Sources",
      summary: "Source preferences lift trusted feeds and source clusters.",
    },
    {
      emptyLabel: "Follow entities from story ranking controls.",
      entries: entityEntries,
      label: "Entities",
      summary: "Entity preferences lift related coverage.",
    },
    {
      emptyLabel: "Follow angles from story ranking controls.",
      entries: angleEntries,
      label: "Angles",
      summary: "Angle preferences lift related coverage.",
    },
  ] satisfies NewsReaderFollowingSection[];
  const coverageGaps = selectNewsReaderFollowingCoverageGaps({
    items,
    sections,
  });

  return {
    coverageGaps,
    feed,
    feedSummary:
      feed.length > 0
        ? `${feed.length} ${
            feed.length === 1 ? "story matches" : "stories match"
          } followed topics, sources, entities, or angles.`
        : signalCount > 0
          ? "No current stories match followed signals yet."
          : "Follow topics, sources, entities, or angles to build a Following feed.",
    gapSummary: getFollowingCoverageGapSummary({
      gapCount: coverageGaps.length,
      signalCount,
    }),
    metrics: [
      { label: "Topics", value: String(topicEntries.length) },
      { label: "Sources", value: String(sourceEntries.length) },
      { label: "Entities", value: String(entityEntries.length) },
      { label: "Angles", value: String(angleEntries.length) },
      { label: "Feed matches", value: String(feed.length) },
      { label: "Signals", value: String(signalCount) },
    ],
    sections,
    summary:
      signalCount > 0
        ? `${signalCount} followed ${
            signalCount === 1 ? "signal is" : "signals are"
          } shaping For You on this device.`
        : "No followed signals are stored on this device yet.",
    suggestions: selectNewsReaderFollowingSuggestions({
      items,
      profile: normalizedProfile,
    }),
  };
};

export const removeNewsReaderFollowingSignal = ({
  kind,
  profile,
  signal,
}: {
  kind: NewsReaderFollowingSignalKind;
  profile: NewsPreferenceProfile;
  signal: string;
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  if (kind === "topic") {
    return normalizeNewsPreferenceProfile({
      ...normalizedProfile,
      preferredCategories: removeFollowingSignalFromList(
        normalizedProfile.preferredCategories,
        signal,
      ),
    });
  }

  if (kind === "source") {
    return normalizeNewsPreferenceProfile({
      ...normalizedProfile,
      preferredSources: removeFollowingSignalFromList(
        normalizedProfile.preferredSources,
        signal,
      ),
    });
  }

  return normalizeNewsPreferenceProfile({
    ...normalizedProfile,
    preferredEntities: removeFollowingSignalFromList(
      normalizedProfile.preferredEntities,
      signal,
    ),
  });
};

export const addNewsReaderFollowingSignal = ({
  kind,
  profile,
  signal,
}: {
  kind: NewsReaderFollowingSignalKind;
  profile: NewsPreferenceProfile;
  signal: string;
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  if (kind === "topic") {
    return normalizeNewsPreferenceProfile({
      ...normalizedProfile,
      preferredCategories: addFollowingSignalToList(
        normalizedProfile.preferredCategories,
        signal,
      ),
    });
  }

  if (kind === "source") {
    return normalizeNewsPreferenceProfile({
      ...normalizedProfile,
      preferredSources: addFollowingSignalToList(
        normalizedProfile.preferredSources,
        signal,
      ),
    });
  }

  return normalizeNewsPreferenceProfile({
    ...normalizedProfile,
    preferredEntities: addFollowingSignalToList(
      normalizedProfile.preferredEntities,
      signal,
    ),
  });
};

export function NewsReaderFollowingView({
  following,
  isPreview = false,
  onAdd,
  onRemove,
}: {
  following: NewsReaderFollowingModel;
  isPreview?: boolean;
  onAdd?: (input: NewsReaderFollowingAddInput) => void;
  onRemove?: (entry: NewsReaderFollowingEntry) => void;
}) {
  const [manualSignalKind, setManualSignalKind] =
    useState<NewsReaderFollowingSignalKind>("entity");
  const [manualSignal, setManualSignal] = useState("");
  const submitManualSignal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const signal = manualSignal.trim();
    if (!signal || !onAdd) return;

    onAdd({ kind: manualSignalKind, signal });
    setManualSignal("");
  };

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
              Reader profile
            </p>
            <h1 className="mt-2 text-4xl leading-none font-black tracking-normal sm:text-6xl">
              Following
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4a4a4a] dark:text-[#c8c4ba]">
              {following.summary}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4 lg:min-w-[30rem]">
            {following.metrics.map((metric) => (
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
      </header>

      <section className="container grid gap-6 py-6 lg:grid-cols-[minmax(220px,0.28fr)_minmax(0,0.72fr)]">
        <aside className="grid content-start gap-3 border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
          <h2 className="text-xl font-black">Following controls</h2>
          <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
            Followed signals are local preferences used by For You, briefing,
            search, and edition lenses.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="rounded-none" variant="outline">
              <Link href="/reader">Reader Center</Link>
            </Button>
            <Button asChild className="rounded-none" variant="outline">
              <Link href="/reader/onboarding">Set up For You</Link>
            </Button>
            <Button asChild className="rounded-none" variant="outline">
              <Link href="/topics">Browse topics</Link>
            </Button>
          </div>
          <form
            className="grid gap-3 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15"
            onSubmit={submitManualSignal}
          >
            <div className="grid gap-2">
              <Label htmlFor="following-signal-kind">Add interest</Label>
              <select
                className="border-input bg-background dark:bg-input/30 h-9 w-full rounded-none border px-3 text-sm outline-none focus-visible:border-[#8a241c] focus-visible:ring-2 focus-visible:ring-[#8a241c]/30 dark:focus-visible:border-[#ff8b7e] dark:focus-visible:ring-[#ff8b7e]/30"
                id="following-signal-kind"
                name="following-signal-kind"
                value={manualSignalKind}
                onChange={(event) =>
                  setManualSignalKind(
                    event.currentTarget.value as NewsReaderFollowingSignalKind,
                  )
                }
              >
                <option value="entity">Entity</option>
                <option value="angle">Angle</option>
                <option value="topic">Topic slug</option>
                <option value="source">Source slug</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="following-signal">Signal</Label>
              <Input
                className="rounded-none"
                id="following-signal"
                name="following-signal"
                placeholder="OpenAI, agent_product, techcrunch-ai"
                value={manualSignal}
                onChange={(event) => setManualSignal(event.currentTarget.value)}
              />
            </div>
            <Button
              className="rounded-none"
              disabled={!onAdd || manualSignal.trim().length === 0}
              type="submit"
            >
              Add interest
            </Button>
          </form>
        </aside>

        <div className="grid gap-6">
          <section className="border-t border-[#161616] pt-4 dark:border-[#f4f1ea]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">Following Feed</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {following.feedSummary}
                </p>
              </div>
              <span className="border border-[#161616]/35 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/35">
                {following.feed.length}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {following.feed.length > 0 ? (
                following.feed.map((story, index) => (
                  <article
                    className="grid gap-3 border-t border-[#161616]/25 pt-3 dark:border-[#f4f1ea]/20"
                    key={story.id}
                  >
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#5b5750] dark:text-[#bbb4aa]">
                      <span>{story.sourceName}</span>
                      <span>{formatNewsTime(story.publishedAt)}</span>
                      <span>{story.matchLabel}</span>
                    </div>
                    <Link
                      className="text-lg leading-tight font-black hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                      href={story.href}
                    >
                      {story.title}
                    </Link>
                    <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                      {story.reason}
                    </p>
                    <NewsEditionStoryActions
                      isPreview={isPreview}
                      item={story.item}
                      rankSlot={index + 1}
                    />
                  </article>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] md:col-span-2 dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Followed stories will appear here after matching coverage is
                  available.
                </p>
              )}
            </div>
          </section>
          {following.suggestions.length > 0 ? (
            <section className="border-t border-[#161616] pt-4 dark:border-[#f4f1ea]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">Suggested follows</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    Current coverage can seed new For You signals.
                  </p>
                </div>
                <span className="border border-[#161616]/35 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/35">
                  {following.suggestions.length}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {following.suggestions.map((suggestion) => (
                  <article
                    className="grid gap-3 border-t border-[#161616]/25 pt-3 dark:border-[#f4f1ea]/20"
                    key={`${suggestion.kind}-${suggestion.signal}`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] tracking-[0.14em] text-[#8a241c] uppercase dark:text-[#ff8b7e]">
                          {suggestion.kind}
                        </span>
                        <span className="font-mono text-[11px] text-[#5b5750] dark:text-[#bbb4aa]">
                          {suggestion.supportLabel}
                        </span>
                      </div>
                      <Link
                        className="mt-2 block text-lg leading-tight font-black hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                        href={suggestion.href}
                      >
                        {suggestion.label}
                      </Link>
                      <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        {suggestion.summary}
                      </p>
                    </div>
                    <Button
                      aria-label={`Follow suggested ${suggestion.kind}: ${suggestion.label}`}
                      className="h-8 w-fit rounded-none px-2 text-xs"
                      disabled={!onAdd}
                      type="button"
                      variant="outline"
                      onClick={() =>
                        onAdd?.({
                          kind: suggestion.kind,
                          signal: suggestion.signal,
                        })
                      }
                    >
                      {suggestion.actionLabel}
                    </Button>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          <section className="border-t border-[#161616] pt-4 dark:border-[#f4f1ea]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">Coverage Gaps</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {following.gapSummary}
                </p>
              </div>
              <span className="border border-[#161616]/35 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/35">
                {following.coverageGaps.length}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {following.coverageGaps.length > 0 ? (
                following.coverageGaps.map((gap) => (
                  <article
                    className="grid gap-2 border-t border-[#161616]/25 pt-3 dark:border-[#f4f1ea]/20"
                    key={`${gap.kind}-${gap.signal}`}
                  >
                    <div className="font-mono text-[11px] tracking-[0.14em] text-[#8a241c] uppercase dark:text-[#ff8b7e]">
                      {gap.kind}
                    </div>
                    <Link
                      className="text-lg leading-tight font-black hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                      href={gap.href}
                    >
                      {gap.label}
                    </Link>
                    <p className="text-sm leading-6 break-words text-[#5b5750] dark:text-[#bbb4aa]">
                      {gap.summary}
                    </p>
                    <Button
                      asChild
                      className="h-8 w-fit rounded-none px-2 text-xs"
                      variant="outline"
                    >
                      <Link href={gap.recoveryHref}>Search coverage</Link>
                    </Button>
                  </article>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] md:col-span-2 dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Current coverage reaches every followed signal on this device.
                </p>
              )}
            </div>
          </section>
          {following.sections.map((section) => (
            <section
              className="border-t border-[#161616] pt-4 dark:border-[#f4f1ea]"
              key={section.label}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">{section.label}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {section.summary}
                  </p>
                </div>
                <span className="border border-[#161616]/35 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/35">
                  {section.entries.length}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {section.entries.length > 0 ? (
                  section.entries.map((entry) => (
                    <article
                      className="grid gap-3 border border-[#161616]/25 bg-[#fffdf7] p-4 dark:border-[#f4f1ea]/20 dark:bg-[#181818]"
                      key={`${entry.kind}-${entry.signal}`}
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] tracking-[0.14em] text-[#8a241c] uppercase dark:text-[#ff8b7e]">
                          {entry.summary}
                        </div>
                        <Link
                          className="mt-2 block text-lg leading-tight font-black hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                          href={entry.href}
                        >
                          {entry.label}
                        </Link>
                        <p className="mt-2 text-sm leading-6 break-words text-[#5b5750] dark:text-[#bbb4aa]">
                          {entry.signal}
                        </p>
                      </div>
                      <Button
                        className="h-8 rounded-none px-2 text-xs"
                        disabled={!onRemove}
                        type="button"
                        variant="outline"
                        onClick={() => onRemove?.(entry)}
                      >
                        Remove
                      </Button>
                    </article>
                  ))
                ) : (
                  <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] md:col-span-2 dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
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

export function NewsReaderFollowing({
  items = [],
  status = "ready",
}: {
  items?: readonly NewsHomeItem[];
  status?: NewsHomeStatus;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const defaultProfile = useMemo(
    () => createDefaultNewsPreferenceProfile(),
    [],
  );
  const [visitorKey] = useState<string | null>(() =>
    readOrCreateNewsVisitorKey(),
  );
  const canUseServerReaderMemory = status === "ready" && Boolean(visitorKey);
  const profileQuery = useQuery(
    trpc.news.profile.queryOptions(
      { visitorKey: visitorKey ?? undefined },
      { enabled: canUseServerReaderMemory },
    ),
  );
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
  const following = useMemo(
    () => selectNewsReaderFollowing({ items, profile }),
    [items, profile],
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

  const removeFollowing = (entry: NewsReaderFollowingEntry) => {
    const nextProfile = removeNewsReaderFollowingSignal({
      kind: entry.kind,
      profile,
      signal: entry.signal,
    });

    writeStoredNewsPreferenceProfile(nextProfile);

    if (!canUseServerReaderMemory) return;
    if (!visitorKey) return;

    updateProfile.mutate({
      profile: toNewsServerPreferenceProfileInput(nextProfile),
      visitorKey,
    });
  };
  const addFollowing = ({ kind, signal }: NewsReaderFollowingAddInput) => {
    const nextProfile = addNewsReaderFollowingSignal({
      kind,
      profile,
      signal,
    });

    if (areNewsPreferenceProfilesEqual(profile, nextProfile)) return;

    writeStoredNewsPreferenceProfile(nextProfile);

    if (!canUseServerReaderMemory) return;
    if (!visitorKey) return;

    updateProfile.mutate({
      profile: toNewsServerPreferenceProfileInput(nextProfile),
      visitorKey,
    });
  };
  const canEditFollowing = !(
    updateProfile.isPending ||
    (canUseServerReaderMemory && profileQuery.isPending)
  );

  return (
    <NewsReaderFollowingView
      following={following}
      isPreview={status !== "ready"}
      onAdd={canEditFollowing ? addFollowing : undefined}
      onRemove={canEditFollowing ? removeFollowing : undefined}
    />
  );
}
