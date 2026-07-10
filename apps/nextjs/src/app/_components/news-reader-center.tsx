"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  NewsPreferenceProfile,
  NewsRecommendationRotationObjective,
} from "@acme/validators";
import { Button } from "@acme/ui/button";
import {
  getNewsRecommendationAngleLabels,
  normalizeNewsPreferenceProfile,
  rankNewsForReader,
} from "@acme/validators";

import type {
  NewsHomeItem,
  NewsHomeStatus,
  NewsPositiveFeedbackMemoryItem,
  NewsReaderMemoryItem,
} from "./news-home-model";
import type { NewsSearchMemoryItem } from "./news-reader-memory-storage";
import { useTRPC } from "~/trpc/react";
import {
  createDefaultNewsPreferenceProfile,
  formatNewsTime,
  getNewsTopicHref,
  mergeNewsHomePositiveFeedbackItems,
  mergeNewsReaderMemoryItems,
  selectHydratedNewsPreferenceProfile,
  selectStoredNewsPositiveFeedbackItems,
  selectStoredNewsReaderMemoryItems,
} from "./news-home-model";
import {
  clearStoredNewsReaderMemoryItems,
  newsGuardrailStorageKey,
  newsHistoryStorageKey,
  newsHomeExposureStorageKey,
  newsRestoredGuardrailStorageKey,
  newsSavedStorageKey,
  readStoredNewsPositiveFeedbackItems,
  readStoredNewsReaderMemoryItems,
  readStoredNewsSearchMemoryItems,
  selectStoredNewsSearchMemoryItems,
  subscribeToNewsReaderMemoryStorage,
  writeStoredNewsPositiveFeedbackItems,
  writeStoredNewsReaderMemoryItems,
  writeStoredNewsSearchMemoryItems,
} from "./news-reader-memory-storage";
import {
  areNewsPreferenceProfilesEqual,
  parseStoredNewsForYouObjective,
  readOrCreateNewsVisitorKey,
  readStoredNewsForYouObjective,
  readStoredNewsPreferenceProfile,
  subscribeToNewsForYouObjectiveStorage,
  subscribeToNewsPreferenceProfileStorage,
  toNewsServerPreferenceProfileInput,
  writeStoredNewsForYouObjective,
  writeStoredNewsPreferenceProfile,
} from "./news-reader-profile-storage";
import { NewsRecommendationLabView } from "./news-recommendation-lab";

interface NewsReaderCenterMetric {
  label: string;
  value: string;
}

interface NewsReaderCenterForYouObjective {
  label: string;
  objective: NewsRecommendationRotationObjective;
  summary: string;
}

interface NewsReaderCenterNextAction {
  href: string;
  label: string;
  summary: string;
}

interface NewsReaderCenterProfileImpactStory {
  href: string;
  matchLabel: string;
  reason: string;
  sourceName: string;
  title: string;
}

interface NewsReaderCenterProfileImpact {
  label: string;
  stories: NewsReaderCenterProfileImpactStory[];
  summary: string;
}

type NewsReaderCenterMemoryTrainingSuggestionKind =
  | "angle"
  | "category"
  | "entity"
  | "source";

export interface NewsReaderCenterMemoryTrainingSuggestion {
  actionLabel: string;
  kind: NewsReaderCenterMemoryTrainingSuggestionKind;
  label: string;
  signal: string;
  summary: string;
  supportLabel: string;
}

interface NewsReaderCenterSignalValue {
  href: string;
  label: string;
}

interface NewsReaderCenterSignalGroup {
  label: string;
  values: NewsReaderCenterSignalValue[];
}

interface NewsReaderCenterRecentSignal {
  href: string;
  label: string;
  occurredAt: string | null;
  sourceName: string;
  title: string;
}

interface NewsReaderCenterRecommendationAuditSignal {
  detail: string;
  label: string;
  tone: NewsReaderCenterTrainingTone;
  weightLabel: string;
}

interface NewsReaderCenterRecommendationAuditStory {
  href: string;
  signalCountLabel: string;
  signals: NewsReaderCenterRecommendationAuditSignal[];
  sourceName: string;
  summary: string;
  title: string;
}

interface NewsReaderCenterRecommendationAudit {
  label: string;
  stories: NewsReaderCenterRecommendationAuditStory[];
  summary: string;
}

type NewsReaderCenterRankingInputStatus = "Active" | "Waiting";

interface NewsReaderCenterRankingInput {
  detail: string;
  label: string;
  signalCount: number;
  statusLabel: NewsReaderCenterRankingInputStatus;
  weightLabel: string;
}

type NewsReaderCenterReadinessLabel = "Cold Start" | "Learning" | "Tuned";

interface NewsReaderCenterReadinessGap {
  label: string;
  summary: string;
}

interface NewsReaderCenterReadiness {
  activeInputCount: number;
  gapCount: number;
  gaps: NewsReaderCenterReadinessGap[];
  label: NewsReaderCenterReadinessLabel;
  score: number;
  summary: string;
}

type NewsReaderCenterTrainingTone = "boost" | "dampen" | "intent";

interface NewsReaderCenterTrainingSignal {
  detail: string;
  label: string;
  tone: NewsReaderCenterTrainingTone;
  weightLabel: string;
}

export interface NewsReaderCenterMemorySnapshot {
  guardrailItems: NewsReaderMemoryItem[];
  historyItems: NewsReaderMemoryItem[];
  homeExposureItems: NewsReaderMemoryItem[];
  positiveFeedbackItems: NewsPositiveFeedbackMemoryItem[];
  restoredGuardrailItems: NewsReaderMemoryItem[];
  savedItems: NewsReaderMemoryItem[];
  searchItems: NewsSearchMemoryItem[];
}

export interface NewsReaderCenterData {
  forYouObjective: NewsReaderCenterForYouObjective;
  memory: NewsReaderCenterMemorySnapshot;
  memoryTrainingSuggestions: NewsReaderCenterMemoryTrainingSuggestion[];
  metrics: NewsReaderCenterMetric[];
  nextActions: NewsReaderCenterNextAction[];
  profile: NewsPreferenceProfile;
  profileImpact: NewsReaderCenterProfileImpact;
  rankingInputs: NewsReaderCenterRankingInput[];
  readiness: NewsReaderCenterReadiness;
  recentSignals: NewsReaderCenterRecentSignal[];
  recommendationAudit: NewsReaderCenterRecommendationAudit;
  searchIntentPromotions: NewsReaderCenterSearchIntentPromotion[];
  signalGroups: NewsReaderCenterSignalGroup[];
  trainingSignals: NewsReaderCenterTrainingSignal[];
}

export interface NewsReaderCenterImportSnapshot {
  forYouObjective: NewsRecommendationRotationObjective | null;
  memory: NewsReaderCenterMemorySnapshot | null;
  profile: NewsPreferenceProfile;
}

export interface NewsReaderCenterProfileDraft {
  noveltyBias: string;
  preferredCategoriesText: string;
  preferredEntitiesText: string;
  preferredSourcesText: string;
  recencyBias: string;
}

type NewsReaderCenterQuickStartSignalKind = "category" | "entity" | "source";

interface NewsReaderCenterQuickStartSignalDefinition {
  kind: NewsReaderCenterQuickStartSignalKind;
  label: string;
  signal: string;
}

export interface NewsReaderCenterQuickStartSignal
  extends NewsReaderCenterQuickStartSignalDefinition {
  active: boolean;
}

export interface NewsReaderCenterQuickStart {
  actionLabel: string;
  key: string;
  label: string;
  newSignalCount: number;
  signals: NewsReaderCenterQuickStartSignal[];
  summary: string;
}

export interface NewsReaderCenterSearchIntentPromotion {
  actionLabel: string;
  active: boolean;
  query: string;
  resultCountLabel: string;
  searchedAt: string;
  summary: string;
}

const readerCenterExportFileName = "the-new-ai-times-reader-profile.json";
const defaultNewsReaderCenterForYouObjective: NewsRecommendationRotationObjective =
  "reader_match";

const newsReaderCenterForYouObjectiveOptions = [
  {
    detail: "Profile and behavior first",
    label: "Reader match",
    objective: "reader_match",
  },
  {
    detail: "Adjacent stories earlier",
    label: "Explore",
    objective: "exploration",
  },
  {
    detail: "High-velocity stories earlier",
    label: "Market heat",
    objective: "market_heat",
  },
  {
    detail: "High-trust sources earlier",
    label: "Source trust",
    objective: "source_trust",
  },
] as const satisfies readonly {
  detail: string;
  label: string;
  objective: NewsRecommendationRotationObjective;
}[];

const newsReaderCenterForYouObjectiveMetadata = {
  exploration: {
    label: "Explore",
    summary:
      "Adjacent stories and newer angles move first in the recommendation rotation.",
  },
  market_heat: {
    label: "Market heat",
    summary:
      "Trending and high-velocity stories move first in the recommendation rotation.",
  },
  reader_match: {
    label: "Reader match",
    summary:
      "Reader profile and local behavior move first in the recommendation rotation.",
  },
  source_trust: {
    label: "Source trust",
    summary: "High-trust sources move first in the recommendation rotation.",
  },
} satisfies Record<
  NewsRecommendationRotationObjective,
  { label: string; summary: string }
>;

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

const getNewsReaderCenterForYouObjective = (
  objective: NewsRecommendationRotationObjective,
): NewsReaderCenterForYouObjective => ({
  objective,
  ...newsReaderCenterForYouObjectiveMetadata[objective],
});

const readerCenterQuickStartDefinitions = [
  {
    key: "agent-builder",
    label: "Agent Builder",
    signals: [
      { kind: "category", label: "Agents", signal: "agent_product" },
      { kind: "source", label: "Agent Desk", signal: "agent-desk" },
      { kind: "source", label: "OpenAI News", signal: "openai-news" },
      { kind: "source", label: "Anthropic", signal: "anthropic" },
      { kind: "entity", label: "OpenAI", signal: "OpenAI" },
      { kind: "entity", label: "Agents", signal: "Agents" },
      { kind: "entity", label: "Browser agents", signal: "browser agents" },
    ],
    summary:
      "Prioritize agent products, tool-use workflows, and the labs shipping agentic interfaces.",
  },
  {
    key: "model-watch",
    label: "Model Watch",
    signals: [
      { kind: "category", label: "Models", signal: "model_release" },
      { kind: "source", label: "OpenAI News", signal: "openai-news" },
      { kind: "source", label: "DeepMind", signal: "deepmind" },
      { kind: "entity", label: "OpenAI", signal: "OpenAI" },
      { kind: "entity", label: "Anthropic", signal: "Anthropic" },
      { kind: "entity", label: "DeepMind", signal: "DeepMind" },
      { kind: "entity", label: "Evals", signal: "evals" },
    ],
    summary:
      "Track frontier model releases, eval shifts, and lab-level reliability claims.",
  },
  {
    key: "ai-business",
    label: "AI Business",
    signals: [
      { kind: "category", label: "Funding", signal: "funding" },
      { kind: "category", label: "Market Maps", signal: "market_map" },
      { kind: "category", label: "YC AI", signal: "yc_ai" },
      { kind: "source", label: "VentureWire", signal: "venturewire" },
      { kind: "source", label: "YC", signal: "yc" },
      { kind: "entity", label: "Series A", signal: "Series A" },
      { kind: "entity", label: "Enterprise AI", signal: "enterprise AI" },
    ],
    summary:
      "Follow funding rounds, startup cohorts, and enterprise adoption signals.",
  },
  {
    key: "research-oss",
    label: "Research & OSS",
    signals: [
      { kind: "category", label: "Research", signal: "research" },
      { kind: "category", label: "Open Source", signal: "open_source" },
      { kind: "source", label: "Arxiv AI", signal: "arxiv-ai" },
      { kind: "source", label: "GitHub Trending", signal: "github-trending" },
      { kind: "entity", label: "Hugging Face", signal: "Hugging Face" },
      { kind: "entity", label: "Benchmarks", signal: "benchmarks" },
      { kind: "entity", label: "Open source", signal: "open source" },
    ],
    summary:
      "Watch research papers, open models, benchmarks, and developer adoption.",
  },
] satisfies {
  key: string;
  label: string;
  signals: NewsReaderCenterQuickStartSignalDefinition[];
  summary: string;
}[];

const normalizeReaderCenterSignal = (value: string) =>
  value.trim().toLowerCase();

const normalizeReaderCenterEntityOrAngleSignal = (value: string) =>
  value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

const hasReaderCenterSignal = (
  activeSignals: readonly string[],
  signal: string,
) => {
  const normalizedSignal = normalizeReaderCenterSignal(signal);

  return activeSignals.some(
    (activeSignal) =>
      normalizeReaderCenterSignal(activeSignal) === normalizedSignal,
  );
};

const hasReaderCenterEntityOrAngleSignal = (
  activeSignals: readonly string[],
  signal: string,
) => {
  const normalizedSignal = normalizeReaderCenterEntityOrAngleSignal(signal);

  return activeSignals.some(
    (activeSignal) =>
      normalizeReaderCenterEntityOrAngleSignal(activeSignal) ===
      normalizedSignal,
  );
};

const isReaderCenterQuickStartSignalActive = ({
  profile,
  signal,
}: {
  profile: NewsPreferenceProfile;
  signal: NewsReaderCenterQuickStartSignalDefinition;
}) => {
  if (signal.kind === "category") {
    return hasReaderCenterSignal(profile.preferredCategories, signal.signal);
  }

  if (signal.kind === "source") {
    return hasReaderCenterSignal(profile.preferredSources, signal.signal);
  }

  return hasReaderCenterEntityOrAngleSignal(
    profile.preferredEntities,
    signal.signal,
  );
};

export const getNewsReaderCenterQuickStarts = (
  profile: NewsPreferenceProfile,
): NewsReaderCenterQuickStart[] => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  return readerCenterQuickStartDefinitions.map((definition) => {
    const signals = definition.signals.map((signal) => ({
      ...signal,
      active: isReaderCenterQuickStartSignalActive({
        profile: normalizedProfile,
        signal,
      }),
    }));
    const newSignalCount = signals.filter((signal) => !signal.active).length;

    return {
      actionLabel:
        newSignalCount > 0 ? "Apply quick start" : "Quick start active",
      key: definition.key,
      label: definition.label,
      newSignalCount,
      signals,
      summary: definition.summary,
    };
  });
};

export const applyNewsReaderCenterQuickStart = ({
  currentProfile,
  quickStart,
}: {
  currentProfile: NewsPreferenceProfile;
  quickStart: NewsReaderCenterQuickStart;
}) =>
  normalizeNewsPreferenceProfile({
    ...currentProfile,
    preferredCategories: [
      ...currentProfile.preferredCategories,
      ...quickStart.signals
        .filter((signal) => signal.kind === "category")
        .map((signal) => signal.signal),
    ],
    preferredEntities: [
      ...currentProfile.preferredEntities,
      ...quickStart.signals
        .filter((signal) => signal.kind === "entity")
        .map((signal) => signal.signal),
    ],
    preferredSources: [
      ...currentProfile.preferredSources,
      ...quickStart.signals
        .filter((signal) => signal.kind === "source")
        .map((signal) => signal.signal),
    ],
  });

export const applyNewsReaderCenterSearchIntentPromotion = ({
  currentProfile,
  promotion,
}: {
  currentProfile: NewsPreferenceProfile;
  promotion: NewsReaderCenterSearchIntentPromotion;
}) =>
  normalizeNewsPreferenceProfile({
    ...currentProfile,
    preferredEntities: [...currentProfile.preferredEntities, promotion.query],
  });

const normalizeReaderCenterSearchQuery = (query: string) =>
  query.trim().toLowerCase();

export const removeNewsReaderCenterSearchMemoryItem = ({
  query,
  searchItems,
}: {
  query: string;
  searchItems: readonly NewsSearchMemoryItem[];
}) => {
  const queryKey = normalizeReaderCenterSearchQuery(query);

  if (!queryKey) return [...searchItems];

  return searchItems.filter(
    (item) => normalizeReaderCenterSearchQuery(item.query) !== queryKey,
  );
};

export const applyNewsReaderCenterMemoryTrainingSuggestion = ({
  currentProfile,
  suggestion,
}: {
  currentProfile: NewsPreferenceProfile;
  suggestion: NewsReaderCenterMemoryTrainingSuggestion;
}) => {
  if (suggestion.kind === "category") {
    return normalizeNewsPreferenceProfile({
      ...currentProfile,
      preferredCategories: [
        ...currentProfile.preferredCategories,
        suggestion.signal,
      ],
    });
  }

  if (suggestion.kind === "source") {
    return normalizeNewsPreferenceProfile({
      ...currentProfile,
      preferredSources: [...currentProfile.preferredSources, suggestion.signal],
    });
  }

  return normalizeNewsPreferenceProfile({
    ...currentProfile,
    preferredEntities: [...currentProfile.preferredEntities, suggestion.signal],
  });
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getUniqueValues = (values: readonly string[], limit: number) => {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    const trimmedValue = value.trim();
    const normalizedValue = trimmedValue.toLowerCase();

    if (!trimmedValue || seen.has(normalizedValue)) continue;

    uniqueValues.push(trimmedValue);
    seen.add(normalizedValue);
  }

  return uniqueValues.slice(0, limit);
};

const toReaderCenterSignalValues = (
  values: readonly string[],
  getHref: (value: string) => string,
  limit: number,
) =>
  getUniqueValues(values, limit).map((value) => ({
    href: getHref(value),
    label: value,
  }));

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

const sortMemoryItemsByTimestamp = (
  left: NewsReaderMemoryItem,
  right: NewsReaderMemoryItem,
) => {
  const leftTimestamp = Date.parse(getMemoryTimestamp(left) ?? "");
  const rightTimestamp = Date.parse(getMemoryTimestamp(right) ?? "");

  return (
    (Number.isFinite(rightTimestamp) ? rightTimestamp : 0) -
    (Number.isFinite(leftTimestamp) ? leftTimestamp : 0)
  );
};

const sortPositiveFeedbackItemsByTimestamp = (
  left: NewsPositiveFeedbackMemoryItem,
  right: NewsPositiveFeedbackMemoryItem,
) => {
  const leftTimestamp = Date.parse(left.occurredAt);
  const rightTimestamp = Date.parse(right.occurredAt);

  return (
    (Number.isFinite(rightTimestamp) ? rightTimestamp : 0) -
    (Number.isFinite(leftTimestamp) ? leftTimestamp : 0)
  );
};

const sortSearchItemsByTimestamp = (
  left: NewsSearchMemoryItem,
  right: NewsSearchMemoryItem,
) => {
  const leftTimestamp = Date.parse(left.searchedAt);
  const rightTimestamp = Date.parse(right.searchedAt);

  return (
    (Number.isFinite(rightTimestamp) ? rightTimestamp : 0) -
    (Number.isFinite(leftTimestamp) ? leftTimestamp : 0)
  );
};

const sortRecentSignalsByTimestamp = (
  left: NewsReaderCenterRecentSignal,
  right: NewsReaderCenterRecentSignal,
) => {
  const leftTimestamp = Date.parse(left.occurredAt ?? "");
  const rightTimestamp = Date.parse(right.occurredAt ?? "");

  return (
    (Number.isFinite(rightTimestamp) ? rightTimestamp : 0) -
    (Number.isFinite(leftTimestamp) ? leftTimestamp : 0)
  );
};

const getLatestMemorySignal = ({
  items,
  label,
}: {
  items: readonly NewsReaderMemoryItem[];
  label: string;
}): NewsReaderCenterRecentSignal | null => {
  const item = [...items].sort(sortMemoryItemsByTimestamp)[0];

  if (!item) return null;

  return {
    href: `/news/${item.id}`,
    label,
    occurredAt: getMemoryTimestamp(item),
    sourceName: item.sourceName,
    title: item.title,
  };
};

const getLatestPositiveFeedbackSignal = (
  items: readonly NewsPositiveFeedbackMemoryItem[],
): NewsReaderCenterRecentSignal | null => {
  const item = [...items].sort(sortPositiveFeedbackItemsByTimestamp)[0];

  if (!item) return null;

  const label =
    item.action === "share"
      ? "Shared"
      : item.action === "save"
        ? "Saved"
        : item.action === "click_source"
          ? "Source clicked"
          : "Read";

  return {
    href: `/news/${item.id}`,
    label,
    occurredAt: item.occurredAt,
    sourceName: item.sourceName,
    title: item.title,
  };
};

const getLatestSearchSignal = (
  items: readonly NewsSearchMemoryItem[],
): NewsReaderCenterRecentSignal | null => {
  const item = [...items].sort(sortSearchItemsByTimestamp)[0];

  if (!item) return null;

  return {
    href: getReaderCenterSearchHref(item.query),
    label: "Searched",
    occurredAt: item.searchedAt,
    sourceName: `${item.resultCount} ${
      item.resultCount === 1 ? "result" : "results"
    }`,
    title: `Search: ${item.query}`,
  };
};

const getReaderCenterSearchHref = (query: string) =>
  `/search?q=${encodeURIComponent(query)}`;

const getReaderCenterEntityHref = (entity: string) =>
  `/entities/${encodeURIComponent(entity)}`;

const looksLikeReaderCenterEntitySignal = (signal: string) =>
  /[A-Z]/.test(signal);

const getReaderCenterAngleLabel = (signal: string) =>
  getNewsRecommendationAngleLabels([signal])[0] ?? signal;

const looksLikeReaderCenterAngleSignal = (signal: string) =>
  !looksLikeReaderCenterEntitySignal(signal) &&
  getNewsRecommendationAngleLabels([signal]).length > 0;

const incrementCount = (counts: Map<string, number>, value: string) => {
  const normalizedValue = value.trim();

  if (!normalizedValue) return;

  counts.set(normalizedValue, (counts.get(normalizedValue) ?? 0) + 1);
};

const getTopCountEntry = (counts: ReadonlyMap<string, number>) =>
  Array.from(counts, ([value, count]) => ({
    count,
    title: formatCategory(value),
    value,
  })).sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;

    return left.title.localeCompare(right.title);
  })[0];

const formatCountLabel = ({
  count,
  plural,
  singular,
}: {
  count: number;
  plural?: string;
  singular: string;
}) => `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;

const readStringArray = (value: unknown, fallback: readonly string[]) =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [...fallback];

const formatProfileDraftBias = (value: number) => String(value);

const formatProfileDraftSignals = (values: readonly string[]) =>
  values.join("\n");

const parseProfileDraftSignals = (value: string) =>
  value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const parseProfileDraftBias = ({
  fallback,
  value,
}: {
  fallback: number;
  value: string;
}) => {
  const parsedValue = Number.parseFloat(value);

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

export const getNewsReaderCenterProfileDraft = (
  profile: NewsPreferenceProfile,
): NewsReaderCenterProfileDraft => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  return {
    noveltyBias: formatProfileDraftBias(normalizedProfile.noveltyBias),
    preferredCategoriesText: formatProfileDraftSignals(
      normalizedProfile.preferredCategories,
    ),
    preferredEntitiesText: formatProfileDraftSignals(
      normalizedProfile.preferredEntities,
    ),
    preferredSourcesText: formatProfileDraftSignals(
      normalizedProfile.preferredSources,
    ),
    recencyBias: formatProfileDraftBias(normalizedProfile.recencyBias),
  };
};

export const getNewsReaderCenterProfileFromDraft = ({
  currentProfile,
  draft,
}: {
  currentProfile: NewsPreferenceProfile;
  draft: NewsReaderCenterProfileDraft;
}) =>
  normalizeNewsPreferenceProfile({
    noveltyBias: parseProfileDraftBias({
      fallback: currentProfile.noveltyBias,
      value: draft.noveltyBias,
    }),
    preferredCategories: parseProfileDraftSignals(
      draft.preferredCategoriesText,
    ),
    preferredEntities: parseProfileDraftSignals(draft.preferredEntitiesText),
    preferredSources: parseProfileDraftSignals(draft.preferredSourcesText),
    recencyBias: parseProfileDraftBias({
      fallback: currentProfile.recencyBias,
      value: draft.recencyBias,
    }),
  });

export const saveNewsReaderCenterProfileDraft = ({
  currentProfile,
  draft,
}: {
  currentProfile: NewsPreferenceProfile;
  draft: NewsReaderCenterProfileDraft;
}) => {
  writeStoredNewsPreferenceProfile(
    getNewsReaderCenterProfileFromDraft({ currentProfile, draft }),
  );
};

const hasImportableProfileFields = (value: Record<string, unknown>) =>
  Array.isArray(value.preferredCategories) ||
  Array.isArray(value.preferredSources) ||
  Array.isArray(value.preferredEntities) ||
  typeof value.noveltyBias === "number" ||
  typeof value.recencyBias === "number";

const toImportableNewsPreferenceProfile = ({
  defaultProfile,
  value,
}: {
  defaultProfile: NewsPreferenceProfile;
  value: unknown;
}) => {
  if (!isRecord(value) || !hasImportableProfileFields(value)) return null;

  return normalizeNewsPreferenceProfile({
    noveltyBias:
      typeof value.noveltyBias === "number"
        ? value.noveltyBias
        : defaultProfile.noveltyBias,
    preferredCategories: readStringArray(
      value.preferredCategories,
      defaultProfile.preferredCategories,
    ),
    preferredEntities: readStringArray(
      value.preferredEntities,
      defaultProfile.preferredEntities,
    ),
    preferredSources: readStringArray(
      value.preferredSources,
      defaultProfile.preferredSources,
    ),
    recencyBias:
      typeof value.recencyBias === "number"
        ? value.recencyBias
        : defaultProfile.recencyBias,
  });
};

const createEmptyReaderCenterMemorySnapshot =
  (): NewsReaderCenterMemorySnapshot => ({
    guardrailItems: [],
    historyItems: [],
    homeExposureItems: [],
    positiveFeedbackItems: [],
    restoredGuardrailItems: [],
    savedItems: [],
    searchItems: [],
  });

const getNewsReaderCenterMemorySnapshot = ({
  guardrailItems,
  historyItems,
  homeExposureItems = [],
  positiveFeedbackItems,
  restoredGuardrailItems = [],
  savedItems,
  searchItems,
}: {
  guardrailItems: readonly NewsReaderMemoryItem[];
  historyItems: readonly NewsReaderMemoryItem[];
  homeExposureItems?: readonly NewsReaderMemoryItem[];
  positiveFeedbackItems: readonly NewsPositiveFeedbackMemoryItem[];
  restoredGuardrailItems?: readonly NewsReaderMemoryItem[];
  savedItems: readonly NewsReaderMemoryItem[];
  searchItems: readonly NewsSearchMemoryItem[];
}): NewsReaderCenterMemorySnapshot => ({
  guardrailItems: [...guardrailItems],
  historyItems: [...historyItems],
  homeExposureItems: [...homeExposureItems],
  positiveFeedbackItems: [...positiveFeedbackItems],
  restoredGuardrailItems: [...restoredGuardrailItems],
  savedItems: [...savedItems],
  searchItems: [...searchItems],
});

const parseNewsReaderCenterMemorySnapshot = (
  value: unknown,
): NewsReaderCenterMemorySnapshot => {
  if (!isRecord(value)) return createEmptyReaderCenterMemorySnapshot();

  return {
    guardrailItems: selectStoredNewsReaderMemoryItems(value.guardrailItems),
    historyItems: selectStoredNewsReaderMemoryItems(value.historyItems),
    homeExposureItems: selectStoredNewsReaderMemoryItems(
      value.homeExposureItems,
    ),
    positiveFeedbackItems: selectStoredNewsPositiveFeedbackItems(
      value.positiveFeedbackItems,
    ),
    restoredGuardrailItems: selectStoredNewsReaderMemoryItems(
      value.restoredGuardrailItems,
    ),
    savedItems: selectStoredNewsReaderMemoryItems(value.savedItems),
    searchItems: selectStoredNewsSearchMemoryItems(value.searchItems),
  };
};

const parseNewsReaderCenterForYouObjective = (
  value: unknown,
): NewsRecommendationRotationObjective | null => {
  const candidate =
    typeof value === "string"
      ? value
      : isRecord(value) && typeof value.objective === "string"
        ? value.objective
        : null;

  if (!candidate) return null;

  const objective = parseStoredNewsForYouObjective(candidate);

  return objective === candidate ? objective : null;
};

export const parseNewsReaderCenterImportSnapshot = ({
  defaultProfile,
  snapshot,
}: {
  defaultProfile: NewsPreferenceProfile;
  snapshot: string;
}): NewsReaderCenterImportSnapshot | null => {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    const importCandidate =
      isRecord(parsed) && "profile" in parsed ? parsed.profile : parsed;
    const profile = toImportableNewsPreferenceProfile({
      defaultProfile,
      value: importCandidate,
    });

    if (!profile) return null;

    return {
      forYouObjective:
        isRecord(parsed) && "forYouObjective" in parsed
          ? parseNewsReaderCenterForYouObjective(parsed.forYouObjective)
          : null,
      memory:
        isRecord(parsed) && "memory" in parsed
          ? parseNewsReaderCenterMemorySnapshot(parsed.memory)
          : null,
      profile,
    };
  } catch {
    return null;
  }
};

export const parseNewsReaderCenterImportProfile = ({
  defaultProfile,
  snapshot,
}: {
  defaultProfile: NewsPreferenceProfile;
  snapshot: string;
}) =>
  parseNewsReaderCenterImportSnapshot({
    defaultProfile,
    snapshot,
  })?.profile ?? null;

export const writeNewsReaderCenterImportSnapshot = (
  importSnapshot: NewsReaderCenterImportSnapshot,
) => {
  writeStoredNewsPreferenceProfile(importSnapshot.profile);

  if (importSnapshot.forYouObjective) {
    writeStoredNewsForYouObjective(importSnapshot.forYouObjective);
  }

  if (!importSnapshot.memory) return;

  writeStoredNewsReaderMemoryItems(
    newsSavedStorageKey,
    importSnapshot.memory.savedItems,
  );
  writeStoredNewsReaderMemoryItems(
    newsHistoryStorageKey,
    importSnapshot.memory.historyItems,
  );
  writeStoredNewsReaderMemoryItems(
    newsHomeExposureStorageKey,
    importSnapshot.memory.homeExposureItems,
  );
  writeStoredNewsReaderMemoryItems(
    newsGuardrailStorageKey,
    importSnapshot.memory.guardrailItems,
  );
  writeStoredNewsReaderMemoryItems(
    newsRestoredGuardrailStorageKey,
    importSnapshot.memory.restoredGuardrailItems,
  );
  writeStoredNewsPositiveFeedbackItems(
    importSnapshot.memory.positiveFeedbackItems,
  );
  writeStoredNewsSearchMemoryItems(importSnapshot.memory.searchItems);
};

const getLatestSearchTrainingSignal = (
  searchItems: readonly NewsSearchMemoryItem[],
): NewsReaderCenterTrainingSignal | null => {
  const latestSearch = [...searchItems].sort(sortSearchItemsByTimestamp)[0];

  if (!latestSearch) return null;

  return {
    detail: `${latestSearch.query} is steering short-term recommendations.`,
    label: "Search intent",
    tone: "intent",
    weightLabel: formatCountLabel({
      count: searchItems.length,
      singular: "search",
    }),
  };
};

const getBoostedTopicTrainingSignal = ({
  historyItems,
  positiveFeedbackItems,
  profile,
  savedItems,
}: {
  historyItems: readonly NewsReaderMemoryItem[];
  positiveFeedbackItems: readonly NewsPositiveFeedbackMemoryItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
}): NewsReaderCenterTrainingSignal | null => {
  const counts = new Map<string, number>();

  for (const category of profile.preferredCategories) {
    incrementCount(counts, category);
  }

  for (const item of [
    ...savedItems,
    ...historyItems,
    ...positiveFeedbackItems,
  ]) {
    incrementCount(counts, item.category);
  }

  const topEntry = getTopCountEntry(counts);

  if (!topEntry) return null;

  return {
    detail: "Profile and local actions are raising this topic.",
    label: `Boost ${topEntry.title}`,
    tone: "boost",
    weightLabel: formatCountLabel({
      count: topEntry.count,
      singular: "signal",
    }),
  };
};

const getDampenedTopicTrainingSignal = (
  guardrailItems: readonly NewsReaderMemoryItem[],
): NewsReaderCenterTrainingSignal | null => {
  const counts = new Map<string, number>();

  for (const item of guardrailItems) {
    incrementCount(counts, item.category);
  }

  const topEntry = getTopCountEntry(counts);

  if (!topEntry) return null;

  return {
    detail: "Less feedback is lowering similar stories from this topic.",
    label: `Dampen ${topEntry.title}`,
    tone: "dampen",
    weightLabel: formatCountLabel({
      count: topEntry.count,
      singular: "hidden",
    }),
  };
};

const getHomeExposureTrainingSignal = (
  homeExposureItems: readonly NewsReaderMemoryItem[],
): NewsReaderCenterTrainingSignal | null => {
  if (homeExposureItems.length === 0) return null;

  return {
    detail:
      "Recently exposed home stories are cooling down unless stronger reader actions appear.",
    label: "Exposure cooldown",
    tone: "intent",
    weightLabel: formatCountLabel({
      count: homeExposureItems.length,
      singular: "exposure",
    }),
  };
};

const getRankingInputStatus = (
  signalCount: number,
): NewsReaderCenterRankingInputStatus =>
  signalCount > 0 ? "Active" : "Waiting";

const getNewsReaderCenterRankingInputs = ({
  guardrailItems,
  historyItems,
  homeExposureItems,
  positiveFeedbackItems,
  profile,
  savedItems,
  searchItems,
}: {
  guardrailItems: readonly NewsReaderMemoryItem[];
  historyItems: readonly NewsReaderMemoryItem[];
  homeExposureItems: readonly NewsReaderMemoryItem[];
  positiveFeedbackItems: readonly NewsPositiveFeedbackMemoryItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
  searchItems: readonly NewsSearchMemoryItem[];
}): NewsReaderCenterRankingInput[] => {
  const profileSignalCount =
    profile.preferredCategories.length +
    profile.preferredSources.length +
    profile.preferredEntities.length;
  const positiveActionCount = savedItems.length + positiveFeedbackItems.length;

  return [
    {
      detail: "Profile topics, sources, and entities boost matching stories.",
      label: "Profile interests",
      signalCount: profileSignalCount,
      statusLabel: getRankingInputStatus(profileSignalCount),
      weightLabel: formatCountLabel({
        count: profileSignalCount,
        singular: "signal",
      }),
    },
    {
      detail: "Recent searches lift matching stories for the current session.",
      label: "Search intent",
      signalCount: searchItems.length,
      statusLabel: getRankingInputStatus(searchItems.length),
      weightLabel: formatCountLabel({
        count: searchItems.length,
        plural: "searches",
        singular: "search",
      }),
    },
    {
      detail: "Saves, shares, and source clicks lift similar stories.",
      label: "Positive actions",
      signalCount: positiveActionCount,
      statusLabel: getRankingInputStatus(positiveActionCount),
      weightLabel: formatCountLabel({
        count: positiveActionCount,
        singular: "action",
      }),
    },
    {
      detail: "Read stories lift continuations while cooling down repeats.",
      label: "Read history",
      signalCount: historyItems.length,
      statusLabel: getRankingInputStatus(historyItems.length),
      weightLabel: formatCountLabel({
        count: historyItems.length,
        singular: "read",
      }),
    },
    {
      detail: "Recently seen home cards are dampened for fresher angles.",
      label: "Home exposure cooldown",
      signalCount: homeExposureItems.length,
      statusLabel: getRankingInputStatus(homeExposureItems.length),
      weightLabel: formatCountLabel({
        count: homeExposureItems.length,
        singular: "exposure",
      }),
    },
    {
      detail: "Less feedback dampens similar topics, sources, and entities.",
      label: "Less feedback guardrail",
      signalCount: guardrailItems.length,
      statusLabel: getRankingInputStatus(guardrailItems.length),
      weightLabel: formatCountLabel({
        count: guardrailItems.length,
        plural: "hidden",
        singular: "hidden",
      }),
    },
  ];
};

const formatReadinessGapList = (
  gaps: readonly NewsReaderCenterReadinessGap[],
) => {
  const labels = gaps.map((gap) => gap.label.toLowerCase());

  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;

  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
};

const getNewsReaderCenterReadiness = (
  rankingInputs: readonly NewsReaderCenterRankingInput[],
): NewsReaderCenterReadiness => {
  const gaps = rankingInputs
    .filter((input) => input.statusLabel === "Waiting")
    .map((input) => ({
      label: input.label,
      summary: input.detail,
    }));
  const totalInputCount = rankingInputs.length;
  const activeInputCount = totalInputCount - gaps.length;
  const score =
    totalInputCount > 0
      ? Math.round((activeInputCount / totalInputCount) * 100)
      : 0;
  const label: NewsReaderCenterReadinessLabel =
    gaps.length === 0
      ? "Tuned"
      : activeInputCount >= 3
        ? "Learning"
        : "Cold Start";
  const summary =
    label === "Tuned"
      ? "For You has every major local ranking input active on this device."
      : label === "Learning"
        ? `For You has ${activeInputCount} of ${totalInputCount} local ranking inputs active. Add ${formatReadinessGapList(gaps)} to finish tuning.`
        : "For You needs more local reader signals before recommendations can move beyond defaults.";

  return {
    activeInputCount,
    gapCount: gaps.length,
    gaps,
    label,
    score,
    summary,
  };
};

const getNewsReaderCenterTrainingSignals = ({
  guardrailItems,
  historyItems,
  homeExposureItems,
  positiveFeedbackItems,
  profile,
  savedItems,
  searchItems,
}: {
  guardrailItems: readonly NewsReaderMemoryItem[];
  historyItems: readonly NewsReaderMemoryItem[];
  homeExposureItems: readonly NewsReaderMemoryItem[];
  positiveFeedbackItems: readonly NewsPositiveFeedbackMemoryItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
  searchItems: readonly NewsSearchMemoryItem[];
}) =>
  [
    getLatestSearchTrainingSignal(searchItems),
    getBoostedTopicTrainingSignal({
      historyItems,
      positiveFeedbackItems,
      profile,
      savedItems,
    }),
    getDampenedTopicTrainingSignal(guardrailItems),
    getHomeExposureTrainingSignal(homeExposureItems),
  ].filter(
    (signal): signal is NewsReaderCenterTrainingSignal => signal !== null,
  );

const getNewsReaderCenterSearchIntentPromotions = ({
  limit = 3,
  profile,
  searchItems,
}: {
  limit?: number;
  profile: NewsPreferenceProfile;
  searchItems: readonly NewsSearchMemoryItem[];
}): NewsReaderCenterSearchIntentPromotion[] => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  return [...searchItems]
    .sort(sortSearchItemsByTimestamp)
    .slice(0, Math.max(0, Math.trunc(limit)))
    .map((item) => {
      const active = hasReaderCenterEntityOrAngleSignal(
        normalizedProfile.preferredEntities,
        item.query,
      );

      return {
        actionLabel: active ? "In profile" : "Add to profile",
        active,
        query: item.query,
        resultCountLabel: formatCountLabel({
          count: item.resultCount,
          singular: "result",
        }),
        searchedAt: item.searchedAt,
        summary: active
          ? `"${item.query}" is already a durable entity or angle in your profile.`
          : `Add "${item.query}" as a durable entity or angle so it can shape For You beyond this session.`,
      };
    });
};

type NewsReaderCenterMemoryTrainingSupportKind =
  | "positive action"
  | "read"
  | "saved";

interface NewsReaderCenterMemoryTrainingCandidate {
  firstIndex: number;
  kind: NewsReaderCenterMemoryTrainingSuggestionKind;
  label: string;
  signal: string;
  supportCounts: Map<NewsReaderCenterMemoryTrainingSupportKind, number>;
}

const memoryTrainingKindOrder = {
  angle: 3,
  category: 0,
  source: 1,
  entity: 2,
} satisfies Record<NewsReaderCenterMemoryTrainingSuggestionKind, number>;

const memoryTrainingBalancedKindLimits = {
  angle: 1,
  category: 1,
  source: 1,
  entity: 1,
} satisfies Record<NewsReaderCenterMemoryTrainingSuggestionKind, number>;

const getMemoryTrainingActionLabel = (
  kind: NewsReaderCenterMemoryTrainingSuggestionKind,
) => {
  if (kind === "category") return "Follow topic";
  if (kind === "source") return "Follow source";
  if (kind === "angle") return "Follow angle";

  return "Follow entity";
};

const getMemoryTrainingSupportCount = (
  candidate: NewsReaderCenterMemoryTrainingCandidate,
) =>
  Array.from(candidate.supportCounts.values()).reduce(
    (total, count) => total + count,
    0,
  );

const getMemoryTrainingSupportLabel = (
  candidate: NewsReaderCenterMemoryTrainingCandidate,
) => {
  const supportEntries = Array.from(candidate.supportCounts.entries());

  if (supportEntries.length === 1) {
    const [supportKind, count] = supportEntries[0] ?? ["read", 0];

    if (supportKind === "positive action") {
      return formatCountLabel({
        count,
        singular: "positive action",
      });
    }

    return formatCountLabel({
      count,
      singular: supportKind,
    });
  }

  return formatCountLabel({
    count: getMemoryTrainingSupportCount(candidate),
    singular: "reader signal",
  });
};

const getMemoryTrainingSummarySupportText = (
  candidate: NewsReaderCenterMemoryTrainingCandidate,
) => {
  const supportEntries = Array.from(candidate.supportCounts.entries());

  if (supportEntries.length === 1) {
    const [supportKind, count] = supportEntries[0] ?? ["read", 0];

    if (supportKind === "read") {
      return `${count} read ${count === 1 ? "story" : "stories"}`;
    }

    if (supportKind === "saved") {
      return `${count} saved ${count === 1 ? "story" : "stories"}`;
    }

    return formatCountLabel({
      count,
      singular: "positive action",
    });
  }

  return formatCountLabel({
    count: getMemoryTrainingSupportCount(candidate),
    singular: "reader signal",
  });
};

const hasMemoryTrainingProfileSignal = ({
  kind,
  profile,
  signal,
}: {
  kind: NewsReaderCenterMemoryTrainingSuggestionKind;
  profile: NewsPreferenceProfile;
  signal: string;
}) => {
  if (kind === "category") {
    return hasReaderCenterSignal(profile.preferredCategories, signal);
  }

  if (kind === "source") {
    return hasReaderCenterSignal(profile.preferredSources, signal);
  }

  return hasReaderCenterEntityOrAngleSignal(profile.preferredEntities, signal);
};

const getMemoryTrainingCandidateKey = ({
  kind,
  signal,
}: {
  kind: NewsReaderCenterMemoryTrainingSuggestionKind;
  signal: string;
}) => `${kind}:${normalizeReaderCenterSignal(signal)}`;

const addMemoryTrainingCandidate = ({
  candidates,
  firstIndex,
  kind,
  label,
  profile,
  signal,
  supportKind,
}: {
  candidates: Map<string, NewsReaderCenterMemoryTrainingCandidate>;
  firstIndex: number;
  kind: NewsReaderCenterMemoryTrainingSuggestionKind;
  label: string;
  profile: NewsPreferenceProfile;
  signal: string;
  supportKind: NewsReaderCenterMemoryTrainingSupportKind;
}) => {
  const trimmedSignal = signal.trim();
  const trimmedLabel = label.trim();

  if (
    !trimmedSignal ||
    hasMemoryTrainingProfileSignal({
      kind,
      profile,
      signal: trimmedSignal,
    })
  ) {
    return;
  }

  const key = getMemoryTrainingCandidateKey({
    kind,
    signal: trimmedSignal,
  });
  const existingCandidate = candidates.get(key);

  if (existingCandidate) {
    existingCandidate.supportCounts.set(
      supportKind,
      (existingCandidate.supportCounts.get(supportKind) ?? 0) + 1,
    );
    return;
  }

  candidates.set(key, {
    firstIndex,
    kind,
    label: trimmedLabel || trimmedSignal,
    signal: trimmedSignal,
    supportCounts: new Map([[supportKind, 1]]),
  });
};

const addMemoryTrainingCandidatesFromItem = ({
  candidates,
  firstIndex,
  item,
  profile,
  supportKind,
}: {
  candidates: Map<string, NewsReaderCenterMemoryTrainingCandidate>;
  firstIndex: number;
  item: NewsReaderMemoryItem;
  profile: NewsPreferenceProfile;
  supportKind: NewsReaderCenterMemoryTrainingSupportKind;
}) => {
  addMemoryTrainingCandidate({
    candidates,
    firstIndex,
    kind: "category",
    label: formatCategory(item.category),
    profile,
    signal: item.category,
    supportKind,
  });
  addMemoryTrainingCandidate({
    candidates,
    firstIndex,
    kind: "source",
    label: item.sourceName,
    profile,
    signal: item.sourceSlug,
    supportKind,
  });

  item.entities.forEach((entity) => {
    addMemoryTrainingCandidate({
      candidates,
      firstIndex,
      kind: "entity",
      label: entity,
      profile,
      signal: entity,
      supportKind,
    });
  });

  getNewsRecommendationAngleLabels(item.tags ?? []).forEach((angle) => {
    addMemoryTrainingCandidate({
      candidates,
      firstIndex,
      kind: "angle",
      label: angle,
      profile,
      signal: angle,
      supportKind,
    });
  });
};

const compareMemoryTrainingCandidates = (
  left: NewsReaderCenterMemoryTrainingCandidate,
  right: NewsReaderCenterMemoryTrainingCandidate,
) => {
  const rightSupportCount = getMemoryTrainingSupportCount(right);
  const leftSupportCount = getMemoryTrainingSupportCount(left);

  if (rightSupportCount !== leftSupportCount) {
    return rightSupportCount - leftSupportCount;
  }

  if (left.firstIndex !== right.firstIndex) {
    return left.firstIndex - right.firstIndex;
  }

  return left.label.localeCompare(right.label);
};

const toMemoryTrainingSuggestion = (
  candidate: NewsReaderCenterMemoryTrainingCandidate,
): NewsReaderCenterMemoryTrainingSuggestion => {
  const supportLabel = getMemoryTrainingSupportLabel(candidate);

  return {
    actionLabel: getMemoryTrainingActionLabel(candidate.kind),
    kind: candidate.kind,
    label: candidate.label,
    signal: candidate.signal,
    summary: `Promote ${candidate.label} from ${getMemoryTrainingSummarySupportText(
      candidate,
    )} so For You can keep ranking similar coverage.`,
    supportLabel,
  };
};

const getNewsReaderCenterMemoryTrainingSuggestions = ({
  historyItems,
  limit = 4,
  positiveFeedbackItems,
  profile,
  savedItems,
}: {
  historyItems: readonly NewsReaderMemoryItem[];
  limit?: number;
  positiveFeedbackItems: readonly NewsPositiveFeedbackMemoryItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const candidates = new Map<string, NewsReaderCenterMemoryTrainingCandidate>();
  let firstIndex = 0;

  for (const item of savedItems) {
    addMemoryTrainingCandidatesFromItem({
      candidates,
      firstIndex,
      item,
      profile: normalizedProfile,
      supportKind: "saved",
    });
    firstIndex += 1;
  }

  for (const item of historyItems) {
    addMemoryTrainingCandidatesFromItem({
      candidates,
      firstIndex,
      item,
      profile: normalizedProfile,
      supportKind: "read",
    });
    firstIndex += 1;
  }

  for (const item of positiveFeedbackItems) {
    addMemoryTrainingCandidatesFromItem({
      candidates,
      firstIndex,
      item,
      profile: normalizedProfile,
      supportKind: "positive action",
    });
    firstIndex += 1;
  }

  const sortedCandidates = Array.from(candidates.values()).sort(
    compareMemoryTrainingCandidates,
  );
  const selectedCandidateKeys = new Set<string>();
  const selectedCandidates: NewsReaderCenterMemoryTrainingCandidate[] = [];
  const maxLimit = Math.max(0, Math.trunc(limit));

  for (const kind of [
    "category",
    "source",
    "entity",
    "angle",
  ] satisfies NewsReaderCenterMemoryTrainingSuggestionKind[]) {
    for (const candidate of sortedCandidates.filter(
      (item) => item.kind === kind,
    )) {
      if (
        selectedCandidates.filter((item) => item.kind === kind).length >=
          memoryTrainingBalancedKindLimits[kind] ||
        selectedCandidates.length >= maxLimit
      ) {
        break;
      }

      selectedCandidateKeys.add(getMemoryTrainingCandidateKey(candidate));
      selectedCandidates.push(candidate);
    }
  }

  for (const candidate of sortedCandidates) {
    if (selectedCandidates.length >= maxLimit) break;

    const key = getMemoryTrainingCandidateKey(candidate);

    if (selectedCandidateKeys.has(key)) continue;

    selectedCandidateKeys.add(key);
    selectedCandidates.push(candidate);
  }

  return selectedCandidates
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return (
          memoryTrainingKindOrder[left.kind] -
          memoryTrainingKindOrder[right.kind]
        );
      }

      return compareMemoryTrainingCandidates(left, right);
    })
    .map(toMemoryTrainingSuggestion);
};

const getNewsReaderCenterNextActions = ({
  guardrailItems,
  historyItems,
  homeExposureItems,
  positiveFeedbackItems,
  savedItems,
  searchItems,
}: {
  guardrailItems: readonly NewsReaderMemoryItem[];
  historyItems: readonly NewsReaderMemoryItem[];
  homeExposureItems: readonly NewsReaderMemoryItem[];
  positiveFeedbackItems: readonly NewsPositiveFeedbackMemoryItem[];
  savedItems: readonly NewsReaderMemoryItem[];
  searchItems: readonly NewsSearchMemoryItem[];
}): NewsReaderCenterNextAction[] => {
  const positiveActionCount = savedItems.length + positiveFeedbackItems.length;
  const actions: NewsReaderCenterNextAction[] = [];

  if (searchItems.length === 0) {
    actions.push({
      href: "/search",
      label: "Search an AI angle",
      summary:
        "Run a search so For You can lift matching stories during this session.",
    });
  }

  if (positiveActionCount === 0) {
    actions.push({
      href: "/",
      label: "Save or share a story",
      summary:
        "Use Save, Share, or Source on a story to create durable positive feedback.",
    });
  }

  if (historyItems.length === 0) {
    actions.push({
      href: "/",
      label: "Read a story",
      summary:
        "Open a story and read meaningfully so continuations can rank higher.",
    });
  }

  if (guardrailItems.length === 0) {
    actions.push({
      href: "/",
      label: "Hide a noisy story",
      summary:
        "Press Less on weak matches so similar topics, sources, and entities are dampened.",
    });
  }

  if (homeExposureItems.length === 0) {
    actions.push({
      href: "/",
      label: "Generate home exposure",
      summary:
        "Open the front page so recently seen stories can cool down and make room for fresher angles.",
    });
  }

  return actions;
};

const emptyNewsReaderCenterItems: readonly NewsHomeItem[] = [];

const getProfileImpactSignalLabel = (count: number) =>
  `${count} ${count === 1 ? "signal" : "signals"}`;

const normalizeImpactSignal = (value: string) => value.trim().toLowerCase();

const hasImpactSignal = (values: readonly string[], signal: string) => {
  const normalizedSignal = normalizeImpactSignal(signal);

  return values.some(
    (value) => normalizeImpactSignal(value) === normalizedSignal,
  );
};

const getReaderCenterStorySearchText = (item: NewsHomeItem) =>
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
    .toLowerCase();

const doesReaderCenterStoryMatchSearch = ({
  item,
  query,
}: {
  item: NewsHomeItem;
  query: string;
}) => {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) return false;

  const searchText = getReaderCenterStorySearchText(item);

  return tokens.every((token) => searchText.includes(token));
};

const getReaderCenterProfileSignalCount = ({
  item,
  profile,
}: {
  item: NewsHomeItem;
  profile: NewsPreferenceProfile;
}) => {
  let count = 0;

  if (hasImpactSignal(profile.preferredCategories, item.category)) count += 1;
  if (hasImpactSignal(profile.preferredSources, item.sourceSlug)) count += 1;

  const matchedEntities = new Set<string>();

  for (const entity of item.entities) {
    if (!hasImpactSignal(profile.preferredEntities, entity)) continue;

    matchedEntities.add(normalizeImpactSignal(entity));
  }

  return count + matchedEntities.size;
};

const doesReaderCenterStoryMatchGuardrail = ({
  guardrailItems,
  item,
}: {
  guardrailItems: readonly NewsReaderMemoryItem[];
  item: NewsHomeItem;
}) =>
  guardrailItems.some((guardrailItem) => {
    if (
      normalizeImpactSignal(guardrailItem.category) ===
      normalizeImpactSignal(item.category)
    ) {
      return true;
    }

    if (
      normalizeImpactSignal(guardrailItem.sourceSlug) ===
      normalizeImpactSignal(item.sourceSlug)
    ) {
      return true;
    }

    return item.entities.some((entity) =>
      guardrailItem.entities.some(
        (guardrailEntity) =>
          normalizeImpactSignal(guardrailEntity) ===
          normalizeImpactSignal(entity),
      ),
    );
  });

const getReaderCenterSearchSignalCount = ({
  item,
  searchItems,
}: {
  item: NewsHomeItem;
  searchItems: readonly NewsSearchMemoryItem[];
}) =>
  searchItems.some((searchItem) =>
    doesReaderCenterStoryMatchSearch({ item, query: searchItem.query }),
  )
    ? 1
    : 0;

const doesReaderCenterMemoryOverlapStory = ({
  item,
  memoryItem,
}: {
  item: NewsHomeItem;
  memoryItem: NewsReaderMemoryItem | NewsPositiveFeedbackMemoryItem;
}) => {
  if (memoryItem.id === item.id) return true;

  if (
    item.canonicalUrl &&
    memoryItem.canonicalUrl &&
    item.canonicalUrl === memoryItem.canonicalUrl
  ) {
    return true;
  }

  if (
    item.originalUrl &&
    memoryItem.originalUrl &&
    item.originalUrl === memoryItem.originalUrl
  ) {
    return true;
  }

  if (
    normalizeImpactSignal(memoryItem.category) ===
    normalizeImpactSignal(item.category)
  ) {
    return true;
  }

  if (
    normalizeImpactSignal(memoryItem.sourceSlug) ===
    normalizeImpactSignal(item.sourceSlug)
  ) {
    return true;
  }

  return item.entities.some((entity) =>
    memoryItem.entities.some(
      (memoryEntity) =>
        normalizeImpactSignal(memoryEntity) === normalizeImpactSignal(entity),
    ),
  );
};

const hasReaderCenterSameStoryReference = ({
  item,
  memoryItem,
}: {
  item: NewsHomeItem;
  memoryItem: NewsReaderMemoryItem;
}) =>
  memoryItem.id === item.id ||
  (Boolean(item.canonicalUrl) &&
    item.canonicalUrl === memoryItem.canonicalUrl) ||
  (Boolean(item.originalUrl) && item.originalUrl === memoryItem.originalUrl);

const getReaderCenterBehaviorSignalCount = ({
  historyItems,
  item,
  positiveFeedbackItems,
  savedItems,
}: {
  historyItems: readonly NewsReaderMemoryItem[];
  item: NewsHomeItem;
  positiveFeedbackItems: readonly NewsPositiveFeedbackMemoryItem[];
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const matchingMemoryIds = new Set<string>();

  for (const memoryItem of [
    ...savedItems,
    ...historyItems,
    ...positiveFeedbackItems,
  ]) {
    if (!doesReaderCenterMemoryOverlapStory({ item, memoryItem })) continue;

    matchingMemoryIds.add(memoryItem.id);
  }

  return matchingMemoryIds.size;
};

const getReaderCenterGuardrailSignalCount = ({
  guardrailItems,
  item,
}: {
  guardrailItems: readonly NewsReaderMemoryItem[];
  item: NewsHomeItem;
}) =>
  guardrailItems.filter((guardrailItem) =>
    doesReaderCenterMemoryOverlapStory({ item, memoryItem: guardrailItem }),
  ).length;

const getReaderCenterExposureSignalCount = ({
  homeExposureItems,
  item,
}: {
  homeExposureItems: readonly NewsReaderMemoryItem[];
  item: NewsHomeItem;
}) =>
  homeExposureItems.filter((homeExposureItem) =>
    hasReaderCenterSameStoryReference({ item, memoryItem: homeExposureItem }),
  ).length;

const lowercaseInitialReaderCenterAuditLabel = (label: string) =>
  label.length > 0 ? `${label[0]?.toLowerCase() ?? ""}${label.slice(1)}` : "";

const formatReaderCenterAuditSignalLabel = (
  signal: NewsReaderCenterRecommendationAuditSignal,
  index: number,
) => {
  const label =
    signal.label === "Less feedback guardrail"
      ? "Less feedback"
      : signal.label === "Exposure cooldown"
        ? "exposure cooldown"
        : signal.label;

  return index === 0 ? label : lowercaseInitialReaderCenterAuditLabel(label);
};

const formatReaderCenterAuditSignalList = (
  signals: readonly NewsReaderCenterRecommendationAuditSignal[],
) => {
  const labels = signals.map(formatReaderCenterAuditSignalLabel);

  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;

  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
};

const getReaderCenterRecommendationAuditSummary = (
  signals: readonly NewsReaderCenterRecommendationAuditSignal[],
) => {
  const signalList = formatReaderCenterAuditSignalList(signals);
  const onlyDampen =
    signals.length > 0 && signals.every((signal) => signal.tone === "dampen");
  const hasDampen = signals.some((signal) => signal.tone === "dampen");
  const verb = signals.length === 1 ? "is" : "are";

  if (onlyDampen) return `${signalList} ${verb} dampening this story.`;
  if (hasDampen) return `${signalList} ${verb} shaping this story.`;

  return `${signalList} ${verb} lifting this story.`;
};

const getNewsReaderCenterRecommendationAudit = ({
  guardrailItems,
  historyItems,
  homeExposureItems,
  items,
  positiveFeedbackItems,
  profile,
  savedItems,
  searchItems,
}: {
  guardrailItems: readonly NewsReaderMemoryItem[];
  historyItems: readonly NewsReaderMemoryItem[];
  homeExposureItems: readonly NewsReaderMemoryItem[];
  items: readonly NewsHomeItem[];
  positiveFeedbackItems: readonly NewsPositiveFeedbackMemoryItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
  searchItems: readonly NewsSearchMemoryItem[];
}): NewsReaderCenterRecommendationAudit => {
  const stories = items.flatMap((item) => {
    const profileSignalCount = getReaderCenterProfileSignalCount({
      item,
      profile,
    });
    const searchSignalCount = getReaderCenterSearchSignalCount({
      item,
      searchItems,
    });
    const behaviorSignalCount = getReaderCenterBehaviorSignalCount({
      historyItems,
      item,
      positiveFeedbackItems,
      savedItems,
    });
    const guardrailSignalCount = getReaderCenterGuardrailSignalCount({
      guardrailItems,
      item,
    });
    const exposureSignalCount = getReaderCenterExposureSignalCount({
      homeExposureItems,
      item,
    });
    const signals = [
      profileSignalCount > 0
        ? {
            detail: "Category, source, or entity preferences match this story.",
            label: "Profile interests",
            tone: "boost",
            weightLabel: formatCountLabel({
              count: profileSignalCount,
              plural: "matches",
              singular: "match",
            }),
          }
        : null,
      searchSignalCount > 0
        ? {
            detail: "Recent search memory matches this story.",
            label: "Search intent",
            tone: "intent",
            weightLabel: formatCountLabel({
              count: searchSignalCount,
              singular: "search",
            }),
          }
        : null,
      behaviorSignalCount > 0
        ? {
            detail: "Saved, read, shared, or source-clicked stories overlap.",
            label: "Local behavior",
            tone: "boost",
            weightLabel: formatCountLabel({
              count: behaviorSignalCount,
              plural: "memories",
              singular: "memory",
            }),
          }
        : null,
      guardrailSignalCount > 0
        ? {
            detail: "Less feedback overlaps by topic, source, or entity.",
            label: "Less feedback guardrail",
            tone: "dampen",
            weightLabel: formatCountLabel({
              count: guardrailSignalCount,
              singular: "guardrail",
            }),
          }
        : null,
      exposureSignalCount > 0
        ? {
            detail: "Recently exposed on the home page.",
            label: "Exposure cooldown",
            tone: "dampen",
            weightLabel: formatCountLabel({
              count: exposureSignalCount,
              singular: "exposure",
            }),
          }
        : null,
    ].filter(
      (signal): signal is NewsReaderCenterRecommendationAuditSignal =>
        signal !== null,
    );

    if (signals.length === 0) return [];

    return [
      {
        href: `/news/${item.id}`,
        signalCountLabel: getProfileImpactSignalLabel(signals.length),
        signals,
        sourceName: item.sourceName,
        summary: getReaderCenterRecommendationAuditSummary(signals),
        title: item.title,
      },
    ];
  });
  const storyCount = stories.length;

  return {
    label: storyCount > 0 ? "Recommendation Audit" : "No Audit Signals",
    stories,
    summary:
      storyCount > 0
        ? `${storyCount} current ${
            storyCount === 1 ? "story has" : "stories have"
          } auditable recommendation signals.`
        : "Current stories do not have local profile, behavior, or guardrail signals yet.",
  };
};

const getReaderCenterProfileImpactReason = ({
  hasProfileMatch,
  hasSearchMatch,
}: {
  hasProfileMatch: boolean;
  hasSearchMatch: boolean;
}) => {
  if (hasProfileMatch && hasSearchMatch) {
    return "Matches profile interests and recent search intent.";
  }

  if (hasProfileMatch) return "Matches profile interests.";
  if (hasSearchMatch) return "Matches recent search intent.";

  return "Matches recent reader memory.";
};

const getNewsReaderCenterProfileImpact = ({
  guardrailItems,
  items,
  limit = 4,
  profile,
  searchItems,
}: {
  guardrailItems: readonly NewsReaderMemoryItem[];
  items: readonly NewsHomeItem[];
  limit?: number;
  profile: NewsPreferenceProfile;
  searchItems: readonly NewsSearchMemoryItem[];
}): NewsReaderCenterProfileImpact => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const stories = rankNewsForReader(items, normalizedProfile)
    .flatMap((item) => {
      if (doesReaderCenterStoryMatchGuardrail({ guardrailItems, item })) {
        return [];
      }

      const profileSignalCount = getReaderCenterProfileSignalCount({
        item,
        profile: normalizedProfile,
      });
      const searchSignalCount = getReaderCenterSearchSignalCount({
        item,
        searchItems,
      });
      const signalCount = profileSignalCount + searchSignalCount;

      if (signalCount === 0) return [];

      return [
        {
          href: `/news/${item.id}`,
          matchLabel: getProfileImpactSignalLabel(signalCount),
          reason: getReaderCenterProfileImpactReason({
            hasProfileMatch: profileSignalCount > 0,
            hasSearchMatch: searchSignalCount > 0,
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
  const visibleStories = stories
    .slice(0, Math.max(0, Math.trunc(limit)))
    .map(({ href, matchLabel, reason, sourceName, title }) => ({
      href,
      matchLabel,
      reason,
      sourceName,
      title,
    }));
  const storyCount = stories.length;

  return {
    label: storyCount > 0 ? "Profile Impact" : "No Impact Yet",
    stories: visibleStories,
    summary:
      storyCount > 0
        ? `${storyCount} current ${
            storyCount === 1 ? "story matches" : "stories match"
          } your profile or recent memory.`
        : "No current stories match your profile or recent memory yet.",
  };
};

export const getNewsReaderCenterData = ({
  forYouObjective = defaultNewsReaderCenterForYouObjective,
  guardrailItems,
  historyItems,
  homeExposureItems = [],
  items = emptyNewsReaderCenterItems,
  positiveFeedbackItems,
  profile,
  restoredGuardrailItems = [],
  savedItems,
  searchItems,
}: {
  forYouObjective?: NewsRecommendationRotationObjective;
  guardrailItems: readonly NewsReaderMemoryItem[];
  historyItems: readonly NewsReaderMemoryItem[];
  homeExposureItems?: readonly NewsReaderMemoryItem[];
  items?: readonly NewsHomeItem[];
  positiveFeedbackItems: readonly NewsPositiveFeedbackMemoryItem[];
  profile: NewsPreferenceProfile;
  restoredGuardrailItems?: readonly NewsReaderMemoryItem[];
  savedItems: readonly NewsReaderMemoryItem[];
  searchItems: readonly NewsSearchMemoryItem[];
}): NewsReaderCenterData => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const preferredAngleSignals = normalizedProfile.preferredEntities.filter(
    looksLikeReaderCenterAngleSignal,
  );
  const preferredEntitySignals = normalizedProfile.preferredEntities.filter(
    (signal) => !looksLikeReaderCenterAngleSignal(signal),
  );
  const rankingInputs = getNewsReaderCenterRankingInputs({
    guardrailItems,
    historyItems,
    homeExposureItems,
    positiveFeedbackItems,
    profile: normalizedProfile,
    savedItems,
    searchItems,
  });

  return {
    forYouObjective: getNewsReaderCenterForYouObjective(forYouObjective),
    memory: getNewsReaderCenterMemorySnapshot({
      guardrailItems,
      historyItems,
      homeExposureItems,
      positiveFeedbackItems,
      restoredGuardrailItems,
      savedItems,
      searchItems,
    }),
    memoryTrainingSuggestions: getNewsReaderCenterMemoryTrainingSuggestions({
      historyItems,
      positiveFeedbackItems,
      profile: normalizedProfile,
      savedItems,
    }),
    metrics: [
      {
        label: "Topics",
        value: String(normalizedProfile.preferredCategories.length),
      },
      {
        label: "Sources",
        value: String(normalizedProfile.preferredSources.length),
      },
      {
        label: "Entities",
        value: String(preferredEntitySignals.length),
      },
      {
        label: "Angles",
        value: String(preferredAngleSignals.length),
      },
      { label: "Searches", value: String(searchItems.length) },
      { label: "Home exposures", value: String(homeExposureItems.length) },
      { label: "Saved", value: String(savedItems.length) },
      { label: "Read", value: String(historyItems.length) },
      { label: "Hidden", value: String(guardrailItems.length) },
    ],
    nextActions: getNewsReaderCenterNextActions({
      guardrailItems,
      historyItems,
      homeExposureItems,
      positiveFeedbackItems,
      savedItems,
      searchItems,
    }),
    profile: normalizedProfile,
    profileImpact: getNewsReaderCenterProfileImpact({
      guardrailItems,
      items,
      profile: normalizedProfile,
      searchItems,
    }),
    rankingInputs,
    readiness: getNewsReaderCenterReadiness(rankingInputs),
    recentSignals: [
      getLatestSearchSignal(searchItems),
      getLatestPositiveFeedbackSignal(positiveFeedbackItems),
      getLatestMemorySignal({
        items: homeExposureItems,
        label: "Home exposure",
      }),
      getLatestMemorySignal({ items: historyItems, label: "Read" }),
      getLatestMemorySignal({ items: guardrailItems, label: "Hidden" }),
      getLatestMemorySignal({ items: savedItems, label: "Saved" }),
    ]
      .filter(
        (signal): signal is NewsReaderCenterRecentSignal => signal !== null,
      )
      .sort(sortRecentSignalsByTimestamp)
      .filter((signal, index, signals) => {
        const signalKey = `${signal.label}:${signal.href}`;

        return (
          signals.findIndex(
            (candidate) => `${candidate.label}:${candidate.href}` === signalKey,
          ) === index
        );
      }),
    recommendationAudit: getNewsReaderCenterRecommendationAudit({
      guardrailItems,
      historyItems,
      homeExposureItems,
      items,
      positiveFeedbackItems,
      profile: normalizedProfile,
      savedItems,
      searchItems,
    }),
    searchIntentPromotions: getNewsReaderCenterSearchIntentPromotions({
      profile: normalizedProfile,
      searchItems,
    }),
    signalGroups: [
      {
        label: "Preferred topics",
        values: toReaderCenterSignalValues(
          normalizedProfile.preferredCategories,
          getNewsTopicHref,
          8,
        ).map((value) => ({
          ...value,
          label: formatCategory(value.label),
        })),
      },
      {
        label: "Preferred sources",
        values: toReaderCenterSignalValues(
          normalizedProfile.preferredSources,
          (source) => `/sources/${source}`,
          8,
        ),
      },
      {
        label: "Preferred entities",
        values: toReaderCenterSignalValues(
          preferredEntitySignals,
          (entity) =>
            looksLikeReaderCenterEntitySignal(entity)
              ? getReaderCenterEntityHref(entity)
              : getReaderCenterSearchHref(entity),
          10,
        ),
      },
      {
        label: "Preferred angles",
        values: toReaderCenterSignalValues(
          preferredAngleSignals.map(getReaderCenterAngleLabel),
          getReaderCenterSearchHref,
          10,
        ),
      },
      {
        label: "Recent searches",
        values: toReaderCenterSignalValues(
          [...searchItems]
            .sort(sortSearchItemsByTimestamp)
            .map((item) => item.query),
          getReaderCenterSearchHref,
          8,
        ),
      },
    ],
    trainingSignals: getNewsReaderCenterTrainingSignals({
      guardrailItems,
      historyItems,
      homeExposureItems,
      positiveFeedbackItems,
      profile: normalizedProfile,
      savedItems,
      searchItems,
    }),
  };
};

export const getNewsReaderCenterExportHref = (center: NewsReaderCenterData) =>
  `data:application/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(center, null, 2),
  )}`;

const createEmptyReaderCenterData = (
  items: readonly NewsHomeItem[] = emptyNewsReaderCenterItems,
) =>
  getNewsReaderCenterData({
    guardrailItems: [],
    historyItems: [],
    homeExposureItems: [],
    items,
    positiveFeedbackItems: [],
    profile: createDefaultNewsPreferenceProfile(),
    restoredGuardrailItems: [],
    savedItems: [],
    searchItems: [],
  });

const readNewsReaderCenterData = ({
  items = emptyNewsReaderCenterItems,
}: {
  items?: readonly NewsHomeItem[];
} = {}) =>
  getNewsReaderCenterData({
    forYouObjective: readStoredNewsForYouObjective(),
    guardrailItems: readStoredNewsReaderMemoryItems(newsGuardrailStorageKey),
    historyItems: readStoredNewsReaderMemoryItems(newsHistoryStorageKey),
    homeExposureItems: readStoredNewsReaderMemoryItems(
      newsHomeExposureStorageKey,
    ),
    positiveFeedbackItems: readStoredNewsPositiveFeedbackItems(),
    profile: readStoredNewsPreferenceProfile({
      defaultProfile: createDefaultNewsPreferenceProfile(),
    }),
    items,
    restoredGuardrailItems: readStoredNewsReaderMemoryItems(
      newsRestoredGuardrailStorageKey,
    ),
    savedItems: readStoredNewsReaderMemoryItems(newsSavedStorageKey),
    searchItems: readStoredNewsSearchMemoryItems(),
  });

export const resetNewsReaderCenterLocalSignals = () => {
  writeStoredNewsPreferenceProfile(createDefaultNewsPreferenceProfile());
  writeStoredNewsForYouObjective(defaultNewsReaderCenterForYouObjective);
  clearStoredNewsReaderMemoryItems(newsSavedStorageKey);
  clearStoredNewsReaderMemoryItems(newsHistoryStorageKey);
  clearStoredNewsReaderMemoryItems(newsHomeExposureStorageKey);
  clearStoredNewsReaderMemoryItems(newsGuardrailStorageKey);
  clearStoredNewsReaderMemoryItems(newsRestoredGuardrailStorageKey);
  writeStoredNewsPositiveFeedbackItems([]);
  writeStoredNewsSearchMemoryItems([]);
};

export function NewsReaderCenterView({
  center,
  exportHref,
  onForYouObjectiveSelect,
  onImportProfile,
  onMemoryTrainingSuggestionApply,
  onProfileDraftSave,
  onQuickStartApply,
  onReset,
  onSearchMemoryRemove,
  onSearchIntentPromotionApply,
}: {
  center: NewsReaderCenterData;
  exportHref?: string;
  onForYouObjectiveSelect?: (
    objective: NewsRecommendationRotationObjective,
  ) => void;
  onImportProfile?: (snapshot: string) => void;
  onMemoryTrainingSuggestionApply?: (
    suggestion: NewsReaderCenterMemoryTrainingSuggestion,
  ) => void;
  onProfileDraftSave?: (draft: NewsReaderCenterProfileDraft) => void;
  onQuickStartApply?: (quickStart: NewsReaderCenterQuickStart) => void;
  onReset?: () => void;
  onSearchMemoryRemove?: (
    promotion: NewsReaderCenterSearchIntentPromotion,
  ) => void;
  onSearchIntentPromotionApply?: (
    promotion: NewsReaderCenterSearchIntentPromotion,
  ) => void;
}) {
  const centerProfileDraft = getNewsReaderCenterProfileDraft(center.profile);
  const quickStarts = getNewsReaderCenterQuickStarts(center.profile);
  const [profileDraftOverride, setProfileDraftOverride] =
    useState<NewsReaderCenterProfileDraft | null>(null);
  const [memoryTrainingStatus, setMemoryTrainingStatus] = useState("");
  const [objectiveStatus, setObjectiveStatus] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [quickStartStatus, setQuickStartStatus] = useState("");
  const [searchPromotionStatus, setSearchPromotionStatus] = useState("");
  const profileDraft = profileDraftOverride ?? centerProfileDraft;

  const updateProfileDraft = (
    key: keyof NewsReaderCenterProfileDraft,
    value: string,
  ) => {
    setProfileDraftOverride({
      ...profileDraft,
      [key]: value,
    });
    setMemoryTrainingStatus("");
    setObjectiveStatus("");
    setProfileStatus("");
    setQuickStartStatus("");
    setSearchPromotionStatus("");
  };

  const handleImportProfile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];

    event.currentTarget.value = "";

    if (!file || !onImportProfile) return;

    void file.text().then((snapshot) => {
      onImportProfile(snapshot);
      setProfileDraftOverride(null);
      setMemoryTrainingStatus("");
      setObjectiveStatus("");
      setProfileStatus("");
      setQuickStartStatus("");
      setSearchPromotionStatus("");
    });
  };

  const handleProfileDraftSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!onProfileDraftSave) return;

    onProfileDraftSave(profileDraft);
    setProfileDraftOverride(null);
    setMemoryTrainingStatus("");
    setObjectiveStatus("");
    setProfileStatus("Preferences saved");
    setQuickStartStatus("");
    setSearchPromotionStatus("");
  };

  const handleForYouObjectiveSelect = (
    option: (typeof newsReaderCenterForYouObjectiveOptions)[number],
  ) => {
    if (!onForYouObjectiveSelect) return;

    onForYouObjectiveSelect(option.objective);
    setMemoryTrainingStatus("");
    setObjectiveStatus(`${option.label} selected`);
    setProfileStatus("");
    setQuickStartStatus("");
    setSearchPromotionStatus("");
  };

  const handleQuickStartApply = (quickStart: NewsReaderCenterQuickStart) => {
    if (!onQuickStartApply) return;

    onQuickStartApply(quickStart);
    setProfileDraftOverride(null);
    setMemoryTrainingStatus("");
    setObjectiveStatus("");
    setProfileStatus("");
    setQuickStartStatus(`${quickStart.label} applied`);
    setSearchPromotionStatus("");
  };

  const handleMemoryTrainingSuggestionApply = (
    suggestion: NewsReaderCenterMemoryTrainingSuggestion,
  ) => {
    if (!onMemoryTrainingSuggestionApply) return;

    onMemoryTrainingSuggestionApply(suggestion);
    setProfileDraftOverride(null);
    setMemoryTrainingStatus(`${suggestion.label} added`);
    setObjectiveStatus("");
    setProfileStatus("");
    setQuickStartStatus("");
    setSearchPromotionStatus("");
  };

  const handleSearchIntentPromotionApply = (
    promotion: NewsReaderCenterSearchIntentPromotion,
  ) => {
    if (!onSearchIntentPromotionApply) return;

    onSearchIntentPromotionApply(promotion);
    setProfileDraftOverride(null);
    setMemoryTrainingStatus("");
    setObjectiveStatus("");
    setProfileStatus("");
    setQuickStartStatus("");
    setSearchPromotionStatus(`${promotion.query} added`);
  };

  const handleSearchMemoryRemove = (
    promotion: NewsReaderCenterSearchIntentPromotion,
  ) => {
    if (!onSearchMemoryRemove) return;

    onSearchMemoryRemove(promotion);
    setProfileDraftOverride(null);
    setMemoryTrainingStatus("");
    setObjectiveStatus("");
    setProfileStatus("");
    setQuickStartStatus("");
    setSearchPromotionStatus(`${promotion.query} removed`);
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
              Reader memory
            </p>
            <h1 className="mt-2 text-4xl leading-none font-black tracking-normal sm:text-6xl">
              Reader Center
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4a4a4a] dark:text-[#c8c4ba]">
              Inspect the local signals shaping your For You ranking on this
              device.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-3 lg:min-w-[28rem]">
            {center.metrics.map((metric) => (
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

      <section className="container grid gap-6 py-6 lg:grid-cols-[minmax(260px,0.35fr)_minmax(0,0.65fr)]">
        <aside className="grid content-start gap-4">
          <div className="border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-black">For You readiness</h2>
                <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {center.readiness.summary}
                </p>
              </div>
              <div className="shrink-0 text-right font-mono">
                <p className="text-3xl leading-none font-black">
                  {center.readiness.score}%
                </p>
                <p className="mt-1 text-[11px] tracking-[0.12em] uppercase">
                  {center.readiness.gapCount}{" "}
                  {center.readiness.gapCount === 1 ? "gap" : "gaps"}
                </p>
              </div>
            </div>
            <div className="mt-4 h-2 border border-[#161616]/25 bg-[#fffdf7] dark:border-[#f4f1ea]/20 dark:bg-[#181818]">
              <div
                className="h-full bg-[#8a241c] dark:bg-[#ff8b7e]"
                style={{ width: `${center.readiness.score}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="border border-[#161616] px-2 py-1 text-sm font-black dark:border-[#f4f1ea]">
                {center.readiness.label}
              </span>
              <span className="font-mono text-[11px] tracking-[0.12em] text-[#5b5750] uppercase dark:text-[#bbb4aa]">
                {center.readiness.activeInputCount} active inputs
              </span>
            </div>
            {center.readiness.gaps.length > 0 ? (
              <div className="mt-3 grid gap-2">
                {center.readiness.gaps.map((gap) => (
                  <p
                    className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]"
                    key={gap.label}
                  >
                    <span className="font-semibold text-[#161616] dark:text-[#f4f1ea]">
                      {gap.label}
                    </span>
                    : {gap.summary}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
          <div className="border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-black">For You objective</h2>
                <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {center.forYouObjective.summary}
                </p>
              </div>
              <span className="shrink-0 border border-[#161616] px-2 py-1 text-sm font-black dark:border-[#f4f1ea]">
                {center.forYouObjective.label}
              </span>
            </div>
            <div className="mt-4 grid gap-2">
              <div className="flex flex-wrap gap-2">
                {newsReaderCenterForYouObjectiveOptions.map((option) => {
                  const selected =
                    center.forYouObjective.objective === option.objective;

                  return (
                    <Button
                      aria-label={`Set For You objective: ${option.label}`}
                      aria-pressed={selected}
                      className="h-auto min-w-36 rounded-none px-3 py-2 text-left"
                      disabled={!onForYouObjectiveSelect}
                      key={option.objective}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      onClick={() => handleForYouObjectiveSelect(option)}
                    >
                      <span className="grid gap-1">
                        <span className="text-xs font-semibold">
                          {option.label}
                        </span>
                        <span className="text-[11px] leading-4 opacity-75">
                          {option.detail}
                        </span>
                      </span>
                    </Button>
                  );
                })}
              </div>
              {objectiveStatus ? (
                <p className="text-sm text-[#5b5750] dark:text-[#bbb4aa]">
                  {objectiveStatus}
                </p>
              ) : null}
            </div>
          </div>
          <div className="border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
            <h2 className="text-xl font-black">Preference signals</h2>
            <div className="mt-4 grid gap-4">
              {center.signalGroups.map((group) => (
                <div key={group.label}>
                  <p className="font-mono text-[11px] tracking-[0.12em] uppercase">
                    {group.label}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    {group.values.length > 0 ? (
                      group.values.map((value) => (
                        <Link
                          className="border border-[#161616]/25 px-2 py-1 hover:border-[#161616] hover:underline dark:border-[#f4f1ea]/20 dark:hover:border-[#f4f1ea]"
                          href={value.href}
                          key={`${group.label}-${value.href}`}
                        >
                          {value.label}
                        </Link>
                      ))
                    ) : (
                      <span className="text-[#5b5750] dark:text-[#bbb4aa]">
                        None yet
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Quick starts</h2>
                <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  Pick a readable preset to seed For You without editing raw
                  topic IDs.
                </p>
              </div>
              {quickStartStatus ? (
                <span className="shrink-0 border border-[#161616]/25 px-2 py-1 text-xs dark:border-[#f4f1ea]/20">
                  {quickStartStatus}
                </span>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3">
              {quickStarts.map((quickStart) => (
                <article
                  className="grid gap-3 border-t border-[#161616]/25 pt-3 dark:border-[#f4f1ea]/20"
                  key={quickStart.key}
                >
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm leading-5 font-black">
                          {quickStart.label}
                        </h3>
                        <span className="border border-[#161616]/25 px-2 py-0.5 font-mono text-[10px] uppercase dark:border-[#f4f1ea]/20">
                          {quickStart.newSignalCount} new
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        {quickStart.summary}
                      </p>
                    </div>
                    <Button
                      className="h-8 rounded-none px-2 text-xs whitespace-nowrap"
                      disabled={
                        !onQuickStartApply || quickStart.newSignalCount === 0
                      }
                      type="button"
                      variant="outline"
                      onClick={() => handleQuickStartApply(quickStart)}
                    >
                      {quickStart.actionLabel}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickStart.signals.map((signal) => (
                      <span
                        className={`border px-2 py-1 text-xs ${
                          signal.active
                            ? "border-[#8a241c] bg-[#8a241c] text-[#fffdf7] dark:border-[#ff8b7e] dark:bg-[#ff8b7e] dark:text-[#181818]"
                            : "border-[#161616]/25 text-[#5b5750] dark:border-[#f4f1ea]/20 dark:text-[#bbb4aa]"
                        }`}
                        key={`${quickStart.key}-${signal.kind}-${signal.signal}`}
                      >
                        {signal.label}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div
            className="scroll-mt-24 border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20"
            id="promote-search-intent"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Promote search intent</h2>
                <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  Turn a repeated search into a durable entity or angle for For
                  You.
                </p>
              </div>
              {searchPromotionStatus ? (
                <span className="shrink-0 border border-[#161616]/25 px-2 py-1 text-xs dark:border-[#f4f1ea]/20">
                  {searchPromotionStatus}
                </span>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3">
              {center.searchIntentPromotions.length > 0 ? (
                center.searchIntentPromotions.map((promotion) => (
                  <article
                    className="grid gap-2 border-t border-[#161616]/25 pt-3 dark:border-[#f4f1ea]/20"
                    key={`${promotion.query}-${promotion.searchedAt}`}
                  >
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm leading-5 font-black">
                            {promotion.query}
                          </h3>
                          <span className="border border-[#161616]/25 px-2 py-0.5 font-mono text-[10px] uppercase dark:border-[#f4f1ea]/20">
                            {promotion.resultCountLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                          {promotion.summary}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <Button
                          className="h-8 rounded-none px-2 text-xs whitespace-nowrap"
                          disabled={
                            promotion.active || !onSearchIntentPromotionApply
                          }
                          type="button"
                          variant="outline"
                          onClick={() =>
                            handleSearchIntentPromotionApply(promotion)
                          }
                        >
                          {promotion.actionLabel}
                        </Button>
                        <Button
                          className="h-8 rounded-none px-2 text-xs whitespace-nowrap"
                          disabled={!onSearchMemoryRemove}
                          type="button"
                          variant="outline"
                          onClick={() => handleSearchMemoryRemove(promotion)}
                        >
                          Remove search
                        </Button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="border-t border-[#161616]/25 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/20 dark:text-[#bbb4aa]">
                  Search from the news page to create short-term intent that can
                  become a durable preference.
                </p>
              )}
            </div>
          </div>
          <div className="border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Train from memory</h2>
                <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  Promote saved, read, and positive-action patterns into durable
                  For You preferences.
                </p>
              </div>
              {memoryTrainingStatus ? (
                <span className="shrink-0 border border-[#161616]/25 px-2 py-1 text-xs dark:border-[#f4f1ea]/20">
                  {memoryTrainingStatus}
                </span>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3">
              {center.memoryTrainingSuggestions.length > 0 ? (
                center.memoryTrainingSuggestions.map((suggestion) => (
                  <article
                    className="grid gap-2 border-t border-[#161616]/25 pt-3 dark:border-[#f4f1ea]/20"
                    key={`${suggestion.kind}-${suggestion.signal}`}
                  >
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm leading-5 font-black">
                            {suggestion.label}
                          </h3>
                          <span className="border border-[#161616]/25 px-2 py-0.5 font-mono text-[10px] uppercase dark:border-[#f4f1ea]/20">
                            {suggestion.supportLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                          {suggestion.summary}
                        </p>
                      </div>
                      <Button
                        className="h-8 rounded-none px-2 text-xs whitespace-nowrap"
                        disabled={!onMemoryTrainingSuggestionApply}
                        type="button"
                        variant="outline"
                        onClick={() =>
                          handleMemoryTrainingSuggestionApply(suggestion)
                        }
                      >
                        {suggestion.actionLabel}
                      </Button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="border-t border-[#161616]/25 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/20 dark:text-[#bbb4aa]">
                  Save, read, share, or click sources to produce durable
                  training suggestions.
                </p>
              )}
            </div>
          </div>
          <form
            aria-label="Tune For You profile"
            className="grid gap-4 border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20"
            onSubmit={handleProfileDraftSubmit}
          >
            <div>
              <h2 className="text-xl font-black">Tune For You profile</h2>
              <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                Directly edit the profile signals used by For You.
              </p>
            </div>
            <div className="grid gap-3">
              <label
                className="grid gap-2 text-sm font-semibold"
                htmlFor="reader-profile-topics"
              >
                Topic IDs
                <textarea
                  aria-label="Preferred topic IDs"
                  className="min-h-20 resize-y border border-[#161616]/25 bg-[#fffdf7] px-3 py-2 font-mono text-sm font-normal outline-none focus:border-[#161616] dark:border-[#f4f1ea]/20 dark:bg-[#181818] dark:focus:border-[#f4f1ea]"
                  id="reader-profile-topics"
                  onChange={(event) =>
                    updateProfileDraft(
                      "preferredCategoriesText",
                      event.currentTarget.value,
                    )
                  }
                  value={profileDraft.preferredCategoriesText}
                />
              </label>
              <label
                className="grid gap-2 text-sm font-semibold"
                htmlFor="reader-profile-sources"
              >
                Source slugs
                <textarea
                  aria-label="Preferred source slugs"
                  className="min-h-20 resize-y border border-[#161616]/25 bg-[#fffdf7] px-3 py-2 font-mono text-sm font-normal outline-none focus:border-[#161616] dark:border-[#f4f1ea]/20 dark:bg-[#181818] dark:focus:border-[#f4f1ea]"
                  id="reader-profile-sources"
                  onChange={(event) =>
                    updateProfileDraft(
                      "preferredSourcesText",
                      event.currentTarget.value,
                    )
                  }
                  value={profileDraft.preferredSourcesText}
                />
              </label>
              <label
                className="grid gap-2 text-sm font-semibold"
                htmlFor="reader-profile-entities"
              >
                Entities and angles
                <textarea
                  aria-label="Preferred entities and angles"
                  className="min-h-20 resize-y border border-[#161616]/25 bg-[#fffdf7] px-3 py-2 font-mono text-sm font-normal outline-none focus:border-[#161616] dark:border-[#f4f1ea]/20 dark:bg-[#181818] dark:focus:border-[#f4f1ea]"
                  id="reader-profile-entities"
                  onChange={(event) =>
                    updateProfileDraft(
                      "preferredEntitiesText",
                      event.currentTarget.value,
                    )
                  }
                  value={profileDraft.preferredEntitiesText}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label
                  className="grid gap-2 text-sm font-semibold"
                  htmlFor="reader-profile-recency"
                >
                  Freshness bias
                  <input
                    aria-label="Freshness bias"
                    className="border border-[#161616]/25 bg-[#fffdf7] px-3 py-2 font-mono text-sm font-normal outline-none focus:border-[#161616] dark:border-[#f4f1ea]/20 dark:bg-[#181818] dark:focus:border-[#f4f1ea]"
                    id="reader-profile-recency"
                    max="2"
                    min="0"
                    onChange={(event) =>
                      updateProfileDraft(
                        "recencyBias",
                        event.currentTarget.value,
                      )
                    }
                    step="0.1"
                    type="number"
                    value={profileDraft.recencyBias}
                  />
                </label>
                <label
                  className="grid gap-2 text-sm font-semibold"
                  htmlFor="reader-profile-novelty"
                >
                  Novelty bias
                  <input
                    aria-label="Novelty bias"
                    className="border border-[#161616]/25 bg-[#fffdf7] px-3 py-2 font-mono text-sm font-normal outline-none focus:border-[#161616] dark:border-[#f4f1ea]/20 dark:bg-[#181818] dark:focus:border-[#f4f1ea]"
                    id="reader-profile-novelty"
                    max="2"
                    min="0"
                    onChange={(event) =>
                      updateProfileDraft(
                        "noveltyBias",
                        event.currentTarget.value,
                      )
                    }
                    step="0.1"
                    type="number"
                    value={profileDraft.noveltyBias}
                  />
                </label>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                className="rounded-none"
                disabled={!onProfileDraftSave}
                type="submit"
              >
                Save preferences
              </Button>
              {profileStatus ? (
                <p className="text-sm text-[#5b5750] dark:text-[#bbb4aa]">
                  {profileStatus}
                </p>
              ) : null}
            </div>
          </form>
          <div className="border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
            <h2 className="text-xl font-black">Recommendation training</h2>
            <div className="mt-3 grid gap-3">
              {center.trainingSignals.length > 0 ? (
                center.trainingSignals.map((signal) => (
                  <article
                    className="grid gap-2 border-t border-[#161616]/25 pt-3 dark:border-[#f4f1ea]/20"
                    key={`${signal.tone}-${signal.label}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm leading-5 font-black">
                        {signal.label}
                      </h3>
                      <span className="shrink-0 font-mono text-[11px] text-[#5b5750] dark:text-[#bbb4aa]">
                        {signal.weightLabel}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                      {signal.detail}
                    </p>
                  </article>
                ))
              ) : (
                <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  Save, search, read, or hide stories to train the recommender.
                </p>
              )}
            </div>
          </div>
          <div className="border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
            <h2 className="text-xl font-black">Next training steps</h2>
            <div className="mt-3 grid gap-3">
              {center.nextActions.length > 0 ? (
                center.nextActions.map((action) => (
                  <article
                    className="grid gap-2 border-t border-[#161616]/25 pt-3 dark:border-[#f4f1ea]/20"
                    key={action.label}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="text-sm leading-5 font-black">
                        {action.label}
                      </h3>
                      <Button
                        asChild
                        className="h-8 rounded-none px-2 text-xs whitespace-nowrap"
                        variant="outline"
                      >
                        <Link href={action.href}>Open</Link>
                      </Button>
                    </div>
                    <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                      {action.summary}
                    </p>
                  </article>
                ))
              ) : (
                <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  All major local ranking inputs have at least one signal.
                </p>
              )}
            </div>
          </div>
          <div className="border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
            <h2 className="text-xl font-black">Ranking inputs</h2>
            <div className="mt-3 grid gap-3">
              {center.rankingInputs.map((input) => (
                <article
                  className="grid gap-2 border-t border-[#161616]/25 pt-3 dark:border-[#f4f1ea]/20"
                  key={input.label}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm leading-5 font-black">
                      {input.label}
                    </h3>
                    <span className="shrink-0 text-right font-mono text-[11px] text-[#5b5750] dark:text-[#bbb4aa]">
                      {input.statusLabel} / {input.weightLabel}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {input.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
            <Button asChild className="rounded-none" variant="outline">
              <Link href="/">Tune For You</Link>
            </Button>
            <Button asChild className="rounded-none" variant="outline">
              <Link href="/reader/lab">Recommendation Lab</Link>
            </Button>
            <Button asChild className="rounded-none" variant="outline">
              <Link href="/reader/library">Reader Library</Link>
            </Button>
            <Button asChild className="rounded-none" variant="outline">
              <Link href="/reader/following">Following</Link>
            </Button>
            <Button asChild className="rounded-none" variant="outline">
              <Link href="/reader/onboarding">Set up For You</Link>
            </Button>
            <Button asChild className="rounded-none" variant="outline">
              <Link href="/topics">Browse topics</Link>
            </Button>
            {exportHref ? (
              <Button asChild className="rounded-none" variant="outline">
                <a download={readerCenterExportFileName} href={exportHref}>
                  Export profile
                </a>
              </Button>
            ) : null}
            {onImportProfile ? (
              <Button asChild className="rounded-none" variant="outline">
                <label>
                  Import profile
                  <input
                    accept="application/json"
                    className="sr-only"
                    onChange={handleImportProfile}
                    type="file"
                  />
                </label>
              </Button>
            ) : null}
            {onReset ? (
              <Button
                className="rounded-none"
                onClick={() => {
                  onReset();
                  setProfileDraftOverride(null);
                  setMemoryTrainingStatus("");
                  setObjectiveStatus("");
                  setProfileStatus("");
                  setQuickStartStatus("");
                  setSearchPromotionStatus("");
                }}
                type="button"
                variant="outline"
              >
                Reset local signals
              </Button>
            ) : null}
          </div>
        </aside>

        <section className="border-t border-[#161616] dark:border-[#f4f1ea]">
          <div className="border-b border-[#161616]/25 py-5 dark:border-[#f4f1ea]/20">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-2xl font-black">Profile Impact</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {center.profileImpact.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 text-sm font-black dark:border-[#f4f1ea]">
                {center.profileImpact.label}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {center.profileImpact.stories.length > 0 ? (
                center.profileImpact.stories.map((story) => (
                  <article
                    className="grid gap-2 border-t border-[#161616]/25 pt-3 dark:border-[#f4f1ea]/20"
                    key={story.href}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="min-w-0 text-xl leading-tight font-black">
                        <Link className="hover:underline" href={story.href}>
                          {story.title}
                        </Link>
                      </h3>
                      <span className="shrink-0 font-mono text-[11px] tracking-[0.12em] text-[#8a241c] uppercase dark:text-[#ff8b7e]">
                        {story.matchLabel}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                      {story.sourceName} / {story.reason}
                    </p>
                  </article>
                ))
              ) : (
                <p className="border-t border-[#161616]/25 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/20 dark:text-[#bbb4aa]">
                  Add profile signals or use search, save, read, and Less
                  actions to make the current edition respond.
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-[6rem_minmax(0,1fr)_8rem] gap-3 border-b border-[#161616]/25 py-2 font-mono text-[10px] tracking-[0.12em] uppercase dark:border-[#f4f1ea]/20">
            <span>Signal</span>
            <span>Story</span>
            <span>Time</span>
          </div>
          {center.recentSignals.length > 0 ? (
            center.recentSignals.map((signal) => (
              <article
                className="grid gap-3 border-b border-[#161616]/25 py-4 sm:grid-cols-[6rem_minmax(0,1fr)_8rem] dark:border-[#f4f1ea]/20"
                key={`${signal.label}-${signal.href}`}
              >
                <p className="font-mono text-sm">{signal.label}</p>
                <div className="min-w-0">
                  <h2 className="text-xl leading-tight font-black">
                    <Link className="hover:underline" href={signal.href}>
                      {signal.title}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-[#5b5750] dark:text-[#bbb4aa]">
                    {signal.sourceName}
                  </p>
                </div>
                <p className="font-mono text-sm">
                  {signal.occurredAt ? formatNewsTime(signal.occurredAt) : "-"}
                </p>
              </article>
            ))
          ) : (
            <div className="py-8">
              <h2 className="text-2xl font-black">No local signals yet</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                Save, read, share, or tune stories to build a reader profile on
                this device.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

export function NewsReaderCenter({
  items = emptyNewsReaderCenterItems,
  status = "ready",
  surface = "center",
}: {
  items?: readonly NewsHomeItem[];
  status?: NewsHomeStatus;
  surface?: "center" | "lab";
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const readCurrentCenter = useCallback(
    () => readNewsReaderCenterData({ items }),
    [items],
  );
  const [center, setCenter] = useState<NewsReaderCenterData>(() =>
    createEmptyReaderCenterData(items),
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
  const invalidateReaderProfileQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
      queryClient.invalidateQueries(trpc.news.profile.pathFilter()),
    ]);
  };
  const invalidateReaderMemoryResetQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
      queryClient.invalidateQueries(trpc.news.profile.pathFilter()),
      queryClient.invalidateQueries(trpc.news.saved.pathFilter()),
      queryClient.invalidateQueries(trpc.news.history.pathFilter()),
      queryClient.invalidateQueries(trpc.news.positiveFeedback.pathFilter()),
      queryClient.invalidateQueries(trpc.news.guardrails.pathFilter()),
      queryClient.invalidateQueries(trpc.news.searchMemory.pathFilter()),
    ]);
  };
  const updateProfile = useMutation(
    trpc.news.updateProfile.mutationOptions({
      onSuccess: invalidateReaderProfileQueries,
    }),
  );
  const resetProfile = useMutation(
    trpc.news.resetProfile.mutationOptions({
      onSuccess: invalidateReaderMemoryResetQueries,
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
  const persistServerProfile = (profile: NewsPreferenceProfile) => {
    if (!canUseServerReaderMemory) return;
    if (!visitorKey) return;

    updateProfile.mutate({
      profile: toNewsServerPreferenceProfileInput(profile),
      visitorKey,
    });
  };
  const removeServerSearchMemory = (query: string) => {
    if (!canUseServerReaderMemory) return;
    if (!visitorKey) return;

    removeSearchMemory.mutate({
      query,
      visitorKey,
    });
  };

  useEffect(() => {
    const refreshCenter = () => setCenter(readCurrentCenter());

    refreshCenter();

    const unsubscribeProfile =
      subscribeToNewsPreferenceProfileStorage(refreshCenter);
    const unsubscribeMemory = subscribeToNewsReaderMemoryStorage(refreshCenter);
    const unsubscribeObjective =
      subscribeToNewsForYouObjectiveStorage(refreshCenter);

    return () => {
      unsubscribeProfile();
      unsubscribeMemory();
      unsubscribeObjective();
    };
  }, [readCurrentCenter]);

  useEffect(() => {
    if (!profileQuery.data?.persisted) return;

    const currentProfile = readCurrentCenter().profile;
    const nextProfile = selectHydratedNewsPreferenceProfile({
      localProfile: currentProfile,
      serverProfile: profileQuery.data,
    });

    if (areNewsPreferenceProfilesEqual(currentProfile, nextProfile)) return;

    writeStoredNewsPreferenceProfile(nextProfile);
  }, [profileQuery.data, readCurrentCenter]);

  useEffect(() => {
    if (!savedQuery.data || savedQuery.data.length === 0) return;

    writeStoredNewsReaderMemoryItems(
      newsSavedStorageKey,
      mergeNewsReaderMemoryItems({
        limit: 30,
        localItems: readStoredNewsReaderMemoryItems(newsSavedStorageKey),
        serverItems: savedQuery.data,
      }),
    );
  }, [savedQuery.data]);

  useEffect(() => {
    if (!historyQuery.data || historyQuery.data.length === 0) return;

    writeStoredNewsReaderMemoryItems(
      newsHistoryStorageKey,
      mergeNewsReaderMemoryItems({
        limit: 30,
        localItems: readStoredNewsReaderMemoryItems(newsHistoryStorageKey),
        serverItems: historyQuery.data,
      }),
    );
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
    if (!guardrailsQuery.data || guardrailsQuery.data.length === 0) return;

    writeStoredNewsReaderMemoryItems(
      newsGuardrailStorageKey,
      mergeNewsReaderMemoryItems({
        limit: 30,
        localItems: readStoredNewsReaderMemoryItems(newsGuardrailStorageKey),
        serverItems: guardrailsQuery.data,
      }),
    );
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

  const canEditReaderCenterProfile = !(
    updateProfile.isPending ||
    resetProfile.isPending ||
    (canUseServerReaderMemory && profileQuery.isPending)
  );

  const importProfile = (snapshot: string) => {
    const importSnapshot = parseNewsReaderCenterImportSnapshot({
      defaultProfile: createDefaultNewsPreferenceProfile(),
      snapshot,
    });

    if (!importSnapshot) return;

    writeNewsReaderCenterImportSnapshot(importSnapshot);
    persistServerProfile(importSnapshot.profile);
    setCenter(readCurrentCenter());
  };

  const saveProfileDraft = (draft: NewsReaderCenterProfileDraft) => {
    const nextProfile = getNewsReaderCenterProfileFromDraft({
      currentProfile: center.profile,
      draft,
    });

    writeStoredNewsPreferenceProfile(nextProfile);
    persistServerProfile(nextProfile);
    setCenter(readCurrentCenter());
  };

  const applyQuickStart = (quickStart: NewsReaderCenterQuickStart) => {
    const nextProfile = applyNewsReaderCenterQuickStart({
      currentProfile: center.profile,
      quickStart,
    });

    writeStoredNewsPreferenceProfile(nextProfile);
    persistServerProfile(nextProfile);
    setCenter(readCurrentCenter());
  };

  const applyMemoryTrainingSuggestion = (
    suggestion: NewsReaderCenterMemoryTrainingSuggestion,
  ) => {
    const nextProfile = applyNewsReaderCenterMemoryTrainingSuggestion({
      currentProfile: center.profile,
      suggestion,
    });

    writeStoredNewsPreferenceProfile(nextProfile);
    persistServerProfile(nextProfile);
    setCenter(readCurrentCenter());
  };

  const applySearchIntentPromotion = (
    promotion: NewsReaderCenterSearchIntentPromotion,
  ) => {
    const nextProfile = applyNewsReaderCenterSearchIntentPromotion({
      currentProfile: center.profile,
      promotion,
    });

    writeStoredNewsPreferenceProfile(nextProfile);
    writeStoredNewsSearchMemoryItems(
      removeNewsReaderCenterSearchMemoryItem({
        query: promotion.query,
        searchItems: readStoredNewsSearchMemoryItems(),
      }),
    );
    removeServerSearchMemory(promotion.query);
    persistServerProfile(nextProfile);
    setCenter(readCurrentCenter());
  };

  const removeSearchMemoryItem = (
    promotion: NewsReaderCenterSearchIntentPromotion,
  ) => {
    writeStoredNewsSearchMemoryItems(
      removeNewsReaderCenterSearchMemoryItem({
        query: promotion.query,
        searchItems: readStoredNewsSearchMemoryItems(),
      }),
    );
    removeServerSearchMemory(promotion.query);
    setCenter(readCurrentCenter());
  };

  const resetReaderCenter = () => {
    resetNewsReaderCenterLocalSignals();
    if (canUseServerReaderMemory && visitorKey) {
      resetProfile.mutate({ visitorKey });
    }
    setCenter(createEmptyReaderCenterData(items));
  };

  return surface === "lab" ? (
    <NewsRecommendationLabView center={center} />
  ) : (
    <NewsReaderCenterView
      center={center}
      exportHref={getNewsReaderCenterExportHref(center)}
      onForYouObjectiveSelect={(objective) => {
        writeStoredNewsForYouObjective(objective);
        setCenter(readCurrentCenter());
      }}
      onImportProfile={canEditReaderCenterProfile ? importProfile : undefined}
      onProfileDraftSave={
        canEditReaderCenterProfile ? saveProfileDraft : undefined
      }
      onQuickStartApply={
        canEditReaderCenterProfile ? applyQuickStart : undefined
      }
      onMemoryTrainingSuggestionApply={
        canEditReaderCenterProfile ? applyMemoryTrainingSuggestion : undefined
      }
      onSearchIntentPromotionApply={
        canEditReaderCenterProfile ? applySearchIntentPromotion : undefined
      }
      onSearchMemoryRemove={removeSearchMemoryItem}
      onReset={canEditReaderCenterProfile ? resetReaderCenter : undefined}
    />
  );
}
