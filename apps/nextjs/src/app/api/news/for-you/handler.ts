import type {
  NegativeFeedbackNewsItem,
  NewsCollaborativeSignal,
  NewsPreferenceProfile,
  NewsRecommendationRotationObjective,
  NewsSemanticSimilarityMatch,
  NewsSessionIntentFilter,
  PositiveFeedbackNewsItem,
  RankedNewsItem,
  RecentExposureNewsItem,
} from "@acme/validators";
import {
  getNewsDedupeUrlKeys,
  getNewsRecommendationAngleLabels,
  normalizeNewsPreferenceProfile,
  selectCollaborativeSignalNewsFeed,
  selectDaypartBalancedNewsFeed,
  selectExposureBalancedNewsFeed,
  selectNegativeFeedbackAdjustedNewsFeed,
  selectNewsRecommendationRotationFeed,
  selectPositiveFeedbackAnchoredNewsFeed,
  selectSemanticSimilarityNewsFeed,
  selectSessionIntentNewsFeed,
  summarizeNewsRecommendation,
} from "@acme/validators";

import type {
  NewsHomeItem,
  NewsReaderMemoryItem,
} from "../../../_components/news-home-model";
import {
  createDefaultNewsPreferenceProfile,
  getNewsHomeCollaborativeRankingSignals,
  selectInitialNewsHomeItems,
} from "../../../_components/news-home-model";

interface HandleNewsForYouRequestInput {
  getCollaborativeSignals?: (
    input: NewsForYouCollaborativeSignalResolverInput,
  ) => Promise<readonly NewsForYouCollaborativeSignal[]>;
  getItems: () => Promise<readonly NewsHomeItem[]>;
  getSemanticSimilarityMatches?: (
    input: NewsForYouSemanticSimilarityResolverInput,
  ) => Promise<readonly NewsForYouSemanticSimilarityMatch[]>;
  request: Request;
}

interface NewsForYouCollaborativeSignalResolverInput {
  items: readonly NewsHomeItem[];
}

interface NewsForYouSemanticSimilarityResolverInput {
  items: readonly NewsHomeItem[];
  positiveFeedbackItems: readonly NewsForYouPositiveFeedbackItem[];
}

interface NewsForYouRequestBody {
  category: string | null;
  collaborativeSignals: NewsForYouCollaborativeSignal[];
  excludeNewsItemIds: string[];
  limit: number;
  negativeFeedbackItems: NewsForYouNegativeFeedbackItem[];
  objective: NewsRecommendationRotationObjective;
  positiveFeedbackItems: NewsForYouPositiveFeedbackItem[];
  profile: NewsPreferenceProfile;
  q: string;
  readerLocalHour?: number;
  recentExposureItems: NewsForYouRecentExposureItem[];
  searchMemoryItems: NewsForYouSearchMemoryItem[];
  semanticSimilarityMatches: NewsForYouSemanticSimilarityMatch[];
  sourceSlug: string | null;
  tag: string | null;
}

interface NewsForYouMemoryItemBase {
  canonicalUrl?: string | null;
  category: string;
  entities: readonly string[];
  id: string;
  originalUrl?: string | null;
  sourceName: string | null;
  sourceSlug: string;
  tags: readonly string[];
  title: string | null;
}

type NewsForYouNegativeFeedbackItem = NegativeFeedbackNewsItem &
  NewsForYouMemoryItemBase & {
    hiddenAt?: string;
  };

type NewsForYouPositiveFeedbackItem = PositiveFeedbackNewsItem &
  NewsForYouMemoryItemBase & {
    newsItemId: string;
  };

interface NewsForYouSearchMemoryItem {
  query: string;
  resultCount: number;
  searchedAt: string;
}

type NewsForYouRecentExposureItem = RecentExposureNewsItem & {
  id: string;
};

type NewsForYouCollaborativeSignal = NewsCollaborativeSignal;

type NewsForYouSemanticSimilarityMatch = NewsSemanticSimilarityMatch;

type NewsForYouDegradedSignal = "collaborative_signals" | "semantic_similarity";

interface NewsForYouContext {
  degradedSignals: NewsForYouDegradedSignal[];
  filters: {
    category: string | null;
    q: string | null;
    sourceSlug: string | null;
    tag: string | null;
  };
  memory: {
    collaborativeSignals: number;
    negativeFeedback: number;
    positiveFeedback: number;
    recentExposure: number;
    searches: number;
    semanticSimilarity: number;
  };
  objective: NewsRecommendationRotationObjective;
  profileSignalCount: number;
  readerLocalHour: number | null;
}

const newsForYouObjectives = [
  "exploration",
  "market_heat",
  "reader_match",
  "source_trust",
] as const satisfies readonly NewsRecommendationRotationObjective[];

const defaultNewsForYouObjective: NewsRecommendationRotationObjective =
  "reader_match";
const defaultNewsForYouLimit = 12;
const maxNewsForYouMemoryItems = 80;
const maxNewsForYouLimit = 30;
const newsForYouNegativeFeedbackRetentionMs = 30 * 24 * 60 * 60 * 1000;
const newsForYouSourceClickFeedbackRetentionMs = 14 * 24 * 60 * 60 * 1000;
const newsForYouRecentExposureRetentionMs = 2 * 24 * 60 * 60 * 1000;
const newsForYouSearchMemoryRetentionMs = 14 * 24 * 60 * 60 * 1000;
const newsForYouSearchMemoryQueryMaxLength = 120;
const newsForYouSemanticSimilarityRetentionMs = 14 * 24 * 60 * 60 * 1000;
const newsForYouCollaborativeSignalMaxScore = 6;
const maxNewsForYouExcludeItemIds = 240;

const isNewsForYouObjective = (
  value: string,
): value is NewsRecommendationRotationObjective =>
  newsForYouObjectives.some((objective) => objective === value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readStringArray = (
  value: unknown,
  fallback: readonly string[] = [],
): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [...fallback];

const readNonEmptyString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const readNullableString = (value: unknown) =>
  typeof value === "string" ? value : null;

const normalizeNewsForYouSearchQuery = (query: string) =>
  query
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, newsForYouSearchMemoryQueryMaxLength)
    .trim();

const getNewsForYouSearchQueryKey = (query: string) =>
  normalizeNewsForYouSearchQuery(query)
    .replace(/[_-]+/g, " ")
    .toLowerCase();

const readOptionalIsoTimestamp = (value: unknown) => {
  if (typeof value !== "string") return null;

  return Number.isFinite(Date.parse(value)) ? value : null;
};

const getPastTimestamp = (value: string | undefined) => {
  const timestamp = Date.parse(value ?? "");

  return Number.isFinite(timestamp) ? timestamp : 0;
};

const normalizeNewsForYouCollaborativeScore = (score: number) =>
  Number.isFinite(score)
    ? Math.min(
        Math.max(score, -newsForYouCollaborativeSignalMaxScore),
        newsForYouCollaborativeSignalMaxScore,
      )
    : null;

const getNewsForYouCollaborativeSignalKeys = (
  signal: NewsForYouCollaborativeSignal,
) => [
  `news:${signal.newsItemId}`,
  ...getNewsDedupeUrlKeys(signal).map((urlKey) => `url:${urlKey}`),
];

const selectNewsForYouCollaborativeSignals = (
  signals: readonly NewsForYouCollaborativeSignal[],
) => {
  const selectedSignals: NewsForYouCollaborativeSignal[] = [];
  const seenKeys = new Set<string>();
  const sortedSignals = signals
    .map((signal, index) => ({ index, signal }))
    .sort((left, right) => {
      const magnitudeDelta =
        Math.abs(right.signal.score) - Math.abs(left.signal.score);

      if (magnitudeDelta !== 0) return magnitudeDelta;

      const scoreDelta = right.signal.score - left.signal.score;
      if (scoreDelta !== 0) return scoreDelta;

      return left.index - right.index;
    });

  for (const { signal } of sortedSignals) {
    const keys = getNewsForYouCollaborativeSignalKeys(signal);

    if (keys.some((key) => seenKeys.has(key))) continue;

    for (const key of keys) {
      seenKeys.add(key);
    }

    selectedSignals.push(signal);

    if (selectedSignals.length >= maxNewsForYouMemoryItems) break;
  }

  return selectedSignals;
};

const normalizeNewsForYouSemanticStrength = (strength: number) =>
  Math.min(Math.max(strength, 1), 3);

const normalizeNewsForYouSemanticMatch = ({
  newsItemId,
  now,
  occurredAt,
  similarity,
  strength,
}: {
  newsItemId: string;
  now: number;
  occurredAt?: string;
  similarity: number;
  strength?: number;
}): NewsForYouSemanticSimilarityMatch | null => {
  if (!newsItemId || !Number.isFinite(similarity)) return null;
  if (similarity < 0 || similarity > 1) return null;

  if (occurredAt) {
    const occurredAtTime = Date.parse(occurredAt);

    if (
      !Number.isFinite(occurredAtTime) ||
      occurredAtTime > now ||
      now - occurredAtTime > newsForYouSemanticSimilarityRetentionMs
    ) {
      return null;
    }
  }

  return {
    newsItemId,
    ...(occurredAt ? { occurredAt } : {}),
    similarity,
    ...(strength !== undefined && Number.isFinite(strength)
      ? { strength: normalizeNewsForYouSemanticStrength(strength) }
      : {}),
  };
};

const readProfile = (value: unknown): NewsPreferenceProfile => {
  const defaultProfile = createDefaultNewsPreferenceProfile();

  if (!isRecord(value)) return defaultProfile;

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

const readLimit = (value: unknown) => {
  const parsedLimit =
    typeof value === "number" ? value : defaultNewsForYouLimit;

  if (!Number.isFinite(parsedLimit)) return defaultNewsForYouLimit;

  return Math.min(Math.max(Math.trunc(parsedLimit), 1), maxNewsForYouLimit);
};

const readObjective = (value: unknown): NewsRecommendationRotationObjective =>
  typeof value === "string" && isNewsForYouObjective(value)
    ? value
    : defaultNewsForYouObjective;

const readMemoryItemBase = (
  value: unknown,
): NewsForYouMemoryItemBase | null => {
  if (!isRecord(value)) return null;

  const category = readNonEmptyString(value.category);
  const id = readNonEmptyString(value.id);
  const sourceSlug = readNonEmptyString(value.sourceSlug);

  if (!category || !id || !sourceSlug) return null;

  return {
    canonicalUrl: readNullableString(value.canonicalUrl),
    category,
    entities: readStringArray(value.entities),
    id,
    originalUrl: readNullableString(value.originalUrl),
    sourceName: readNullableString(value.sourceName),
    sourceSlug,
    tags: readStringArray(value.tags),
    title: readNullableString(value.title),
  };
};

const getNewsForYouNegativeFeedbackKeys = (
  item: NewsForYouNegativeFeedbackItem,
) => [
  `id:${item.id}`,
  ...getNewsDedupeUrlKeys(item).map((urlKey) => `url:${urlKey}`),
];

const selectNewsForYouNegativeFeedbackItems = (
  items: readonly NewsForYouNegativeFeedbackItem[],
) => {
  const selectedItems: NewsForYouNegativeFeedbackItem[] = [];
  const seenKeys = new Set<string>();
  const sortedItems = [...items].sort((left, right) => {
    const timestampDelta =
      getPastTimestamp(right.occurredAt ?? right.hiddenAt) -
      getPastTimestamp(left.occurredAt ?? left.hiddenAt);

    if (timestampDelta !== 0) return timestampDelta;

    return left.id.localeCompare(right.id);
  });

  for (const item of sortedItems) {
    const keys = getNewsForYouNegativeFeedbackKeys(item);

    if (keys.some((key) => seenKeys.has(key))) continue;

    for (const key of keys) {
      seenKeys.add(key);
    }

    selectedItems.push(item);

    if (selectedItems.length >= maxNewsForYouMemoryItems) break;
  }

  return selectedItems;
};

const readNegativeFeedbackItems = (
  value: unknown,
): NewsForYouNegativeFeedbackItem[] => {
  if (!Array.isArray(value)) return [];

  const items: NewsForYouNegativeFeedbackItem[] = [];
  const now = Date.now();

  for (const item of value) {
    const baseItem = readMemoryItemBase(item);

    if (!baseItem || !isRecord(item)) continue;

    const hiddenAt = readOptionalIsoTimestamp(item.hiddenAt);
    const rawOccurredAt = readOptionalIsoTimestamp(item.occurredAt);
    if (item.hiddenAt !== undefined && item.hiddenAt !== null && !hiddenAt) {
      continue;
    }
    if (
      item.occurredAt !== undefined &&
      item.occurredAt !== null &&
      !rawOccurredAt
    ) {
      continue;
    }

    const occurredAt = rawOccurredAt ?? hiddenAt;
    if (occurredAt) {
      const occurredAtTime = Date.parse(occurredAt);

      if (
        occurredAtTime > now ||
        now - occurredAtTime > newsForYouNegativeFeedbackRetentionMs
      ) {
        continue;
      }
    }
    const negativeFeedbackItem: NewsForYouNegativeFeedbackItem = {
      ...baseItem,
      ...(hiddenAt ? { hiddenAt } : {}),
      ...(occurredAt ? { occurredAt } : {}),
    };

    items.push(negativeFeedbackItem);
  }

  return selectNewsForYouNegativeFeedbackItems(items);
};

type NewsForYouPositiveFeedbackAction = NonNullable<
  PositiveFeedbackNewsItem["action"]
>;

const newsForYouPositiveFeedbackActions = [
  "click_source",
  "save",
  "share",
] as const satisfies readonly NewsForYouPositiveFeedbackAction[];
const newsForYouPositiveFeedbackActionStrength = {
  click_source: 1,
  save: 2,
  share: 3,
} as const satisfies Record<NewsForYouPositiveFeedbackAction, number>;

const isNewsForYouPositiveFeedbackAction = (
  value: string,
): value is NewsForYouPositiveFeedbackAction =>
  newsForYouPositiveFeedbackActions.some((action) => action === value);

const readPositiveFeedbackAction = (
  value: unknown,
): NewsForYouPositiveFeedbackAction | undefined =>
  typeof value === "string" && isNewsForYouPositiveFeedbackAction(value)
    ? value
    : undefined;

const getNewsForYouPositiveFeedbackActionStrength = (
  action: NewsForYouPositiveFeedbackAction | undefined,
) => (action ? newsForYouPositiveFeedbackActionStrength[action] : 0);

const getNewsForYouPositiveFeedbackKeys = (
  item: NewsForYouPositiveFeedbackItem,
) => [
  `id:${item.id}`,
  `news:${item.newsItemId}`,
  ...getNewsDedupeUrlKeys(item).map((urlKey) => `url:${urlKey}`),
];

const selectNewsForYouPositiveFeedbackItems = (
  items: readonly NewsForYouPositiveFeedbackItem[],
) => {
  const selectedItems: NewsForYouPositiveFeedbackItem[] = [];
  const seenKeys = new Set<string>();
  const sortedItems = [...items].sort((left, right) => {
    const strengthDelta =
      getNewsForYouPositiveFeedbackActionStrength(right.action) -
      getNewsForYouPositiveFeedbackActionStrength(left.action);

    if (strengthDelta !== 0) return strengthDelta;

    const timestampDelta =
      getPastTimestamp(right.occurredAt) - getPastTimestamp(left.occurredAt);

    if (timestampDelta !== 0) return timestampDelta;

    return left.id.localeCompare(right.id);
  });

  for (const item of sortedItems) {
    const keys = getNewsForYouPositiveFeedbackKeys(item);

    if (keys.some((key) => seenKeys.has(key))) continue;

    for (const key of keys) {
      seenKeys.add(key);
    }

    selectedItems.push(item);

    if (selectedItems.length >= maxNewsForYouMemoryItems) break;
  }

  return selectedItems;
};

const readPositiveFeedbackItems = (
  value: unknown,
): NewsForYouPositiveFeedbackItem[] => {
  if (!Array.isArray(value)) return [];

  const items: NewsForYouPositiveFeedbackItem[] = [];
  const now = Date.now();

  for (const item of value) {
    const baseItem = readMemoryItemBase(item);

    if (!baseItem || !isRecord(item)) continue;

    const action = readPositiveFeedbackAction(item.action);
    if (item.action !== undefined && !action) continue;

    const occurredAt = readOptionalIsoTimestamp(item.occurredAt);
    if (
      item.occurredAt !== undefined &&
      item.occurredAt !== null &&
      !occurredAt
    ) {
      continue;
    }

    if (occurredAt) {
      const occurredAtTime = Date.parse(occurredAt);

      if (
        occurredAtTime > now ||
        (action === "click_source" &&
          now - occurredAtTime > newsForYouSourceClickFeedbackRetentionMs)
      ) {
        continue;
      }
    }
    const newsItemId = readNonEmptyString(item.newsItemId) || baseItem.id;
    const positiveFeedbackItem: NewsForYouPositiveFeedbackItem = {
      ...baseItem,
      newsItemId,
      ...(action ? { action } : {}),
      ...(occurredAt ? { occurredAt } : {}),
    };

    items.push(positiveFeedbackItem);
  }

  return selectNewsForYouPositiveFeedbackItems(items);
};

const readSearchMemoryItems = (
  value: unknown,
): NewsForYouSearchMemoryItem[] => {
  if (!Array.isArray(value)) return [];

  const now = Date.now();
  const searchItems: NewsForYouSearchMemoryItem[] = [];
  const seenQueries = new Set<string>();

  const normalizedItems = value
    .map((item) => {
      if (!isRecord(item)) return null;

      const query =
        typeof item.query === "string"
          ? normalizeNewsForYouSearchQuery(item.query)
          : "";
      const searchedAt = readOptionalIsoTimestamp(item.searchedAt);
      const resultCount =
        typeof item.resultCount === "number" &&
        Number.isFinite(item.resultCount)
          ? Math.max(0, Math.round(item.resultCount))
          : 0;

      if (!query || !searchedAt) return null;

      return {
        query,
        resultCount,
        searchedAt,
      };
    })
    .filter((item): item is NewsForYouSearchMemoryItem => item !== null)
    .filter((item) => {
      const searchedAt = Date.parse(item.searchedAt);

      return (
        searchedAt <= now &&
        now - searchedAt <= newsForYouSearchMemoryRetentionMs
      );
    })
    .sort(
      (left, right) =>
        Date.parse(right.searchedAt) - Date.parse(left.searchedAt),
    );

  for (const item of normalizedItems) {
    const queryKey = getNewsForYouSearchQueryKey(item.query);

    if (seenQueries.has(queryKey)) continue;

    searchItems.push(item);
    seenQueries.add(queryKey);
  }

  return searchItems.slice(0, 20);
};

const getNewsForYouRecentExposureKeys = (
  item: NewsForYouRecentExposureItem,
) => [
  `id:${item.id}`,
  ...getNewsDedupeUrlKeys(item).map((urlKey) => `url:${urlKey}`),
];

const selectNewsForYouRecentExposureItems = (
  items: readonly NewsForYouRecentExposureItem[],
) => {
  const seenKeys = new Set<string>();
  const selectedItems: NewsForYouRecentExposureItem[] = [];
  const sortedItems = [...items].sort((left, right) => {
    const timestampDelta =
      getPastTimestamp(right.occurredAt) - getPastTimestamp(left.occurredAt);

    if (timestampDelta !== 0) return timestampDelta;

    return left.id.localeCompare(right.id);
  });

  for (const item of sortedItems) {
    const keys = getNewsForYouRecentExposureKeys(item);

    if (keys.some((key) => seenKeys.has(key))) continue;

    for (const key of keys) {
      seenKeys.add(key);
    }

    selectedItems.push(item);

    if (selectedItems.length >= maxNewsForYouMemoryItems) break;
  }

  return selectedItems;
};

const readRecentExposureItems = (
  value: unknown,
): NewsForYouRecentExposureItem[] => {
  if (!Array.isArray(value)) return [];

  const items: NewsForYouRecentExposureItem[] = [];
  const now = Date.now();

  for (const item of value) {
    const baseItem = readMemoryItemBase(item);

    if (!baseItem || !isRecord(item)) continue;

    const occurredAt = readOptionalIsoTimestamp(item.occurredAt);
    const viewedAt = readOptionalIsoTimestamp(item.viewedAt);
    if (
      item.occurredAt !== undefined &&
      item.occurredAt !== null &&
      !occurredAt
    ) {
      continue;
    }
    if (item.viewedAt !== undefined && item.viewedAt !== null && !viewedAt) {
      continue;
    }

    const exposureOccurredAt = occurredAt ?? viewedAt;
    if (exposureOccurredAt) {
      const occurredAtTime = Date.parse(exposureOccurredAt);

      if (
        occurredAtTime > now ||
        now - occurredAtTime > newsForYouRecentExposureRetentionMs
      ) {
        continue;
      }
    }
    const surface = readNonEmptyString(item.surface) || "home_exposure";
    const readPercent =
      typeof item.readPercent === "number" && Number.isFinite(item.readPercent)
        ? Math.min(Math.max(item.readPercent, 0), 1)
        : undefined;
    const recentExposureItem: NewsForYouRecentExposureItem = {
      canonicalUrl: baseItem.canonicalUrl,
      category: baseItem.category,
      entities: baseItem.entities,
      id: baseItem.id,
      originalUrl: baseItem.originalUrl,
      sourceSlug: baseItem.sourceSlug,
      surface,
      tags: baseItem.tags,
      ...(exposureOccurredAt ? { occurredAt: exposureOccurredAt } : {}),
      ...(readPercent !== undefined ? { readPercent } : {}),
      ...(baseItem.title ? { title: baseItem.title } : {}),
    };

    items.push(recentExposureItem);
  }

  return selectNewsForYouRecentExposureItems(items);
};

const readCollaborativeSignals = (
  value: unknown,
): NewsForYouCollaborativeSignal[] => {
  if (!Array.isArray(value)) return [];

  const signals: NewsForYouCollaborativeSignal[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;

    const newsItemId = readNonEmptyString(item.newsItemId);
    const score =
      typeof item.score === "number" && Number.isFinite(item.score)
        ? normalizeNewsForYouCollaborativeScore(item.score)
        : null;

    if (!newsItemId || score === null) continue;

    const category = readNonEmptyString(item.category);
    const clusterKey =
      item.clusterKey === null ? null : readNonEmptyString(item.clusterKey);
    const sourceSlug = readNonEmptyString(item.sourceSlug);
    const canonicalUrl = readNullableString(item.canonicalUrl);
    const originalUrl = readNullableString(item.originalUrl);

    signals.push({
      ...(canonicalUrl !== null ? { canonicalUrl } : {}),
      ...(category ? { category } : {}),
      ...(clusterKey !== "" ? { clusterKey } : {}),
      entities: readStringArray(item.entities),
      newsItemId,
      ...(originalUrl !== null ? { originalUrl } : {}),
      score,
      ...(sourceSlug ? { sourceSlug } : {}),
      tags: readStringArray(item.tags),
    });
  }

  return selectNewsForYouCollaborativeSignals(signals);
};

const getNewsForYouSemanticMatchRank = (
  match: NewsForYouSemanticSimilarityMatch,
) => match.similarity * (match.strength ?? 1);

const selectNewsForYouSemanticSimilarityMatches = (
  matches: readonly NewsForYouSemanticSimilarityMatch[],
) => {
  const matchByNewsItemId = new Map<string, NewsForYouSemanticSimilarityMatch>();

  for (const match of matches) {
    const currentMatch = matchByNewsItemId.get(match.newsItemId);

    if (!currentMatch) {
      matchByNewsItemId.set(match.newsItemId, match);
      continue;
    }

    const rankDelta =
      getNewsForYouSemanticMatchRank(match) -
      getNewsForYouSemanticMatchRank(currentMatch);

    if (
      rankDelta > 0 ||
      (rankDelta === 0 &&
        getPastTimestamp(match.occurredAt) >
          getPastTimestamp(currentMatch.occurredAt))
    ) {
      matchByNewsItemId.set(match.newsItemId, match);
    }
  }

  return Array.from(matchByNewsItemId.values())
    .sort((left, right) => {
      const rankDelta =
        getNewsForYouSemanticMatchRank(right) -
        getNewsForYouSemanticMatchRank(left);

      if (rankDelta !== 0) return rankDelta;

      const timestampDelta =
        getPastTimestamp(right.occurredAt) - getPastTimestamp(left.occurredAt);

      if (timestampDelta !== 0) return timestampDelta;

      return left.newsItemId.localeCompare(right.newsItemId);
    })
    .slice(0, maxNewsForYouMemoryItems);
};

const readSemanticSimilarityMatches = (
  value: unknown,
): NewsForYouSemanticSimilarityMatch[] => {
  if (!Array.isArray(value)) return [];

  const matches: NewsForYouSemanticSimilarityMatch[] = [];
  const now = Date.now();

  for (const item of value) {
    if (!isRecord(item)) continue;

    const newsItemId = readNonEmptyString(item.newsItemId);
    const similarity =
      typeof item.similarity === "number" && Number.isFinite(item.similarity)
        ? item.similarity
        : null;

    if (!newsItemId || similarity === null) continue;

    const occurredAt = readOptionalIsoTimestamp(item.occurredAt);
    if (
      item.occurredAt !== undefined &&
      item.occurredAt !== null &&
      !occurredAt
    ) {
      continue;
    }

    const strength =
      typeof item.strength === "number" && Number.isFinite(item.strength)
        ? item.strength
        : undefined;

    if (occurredAt) {
      const occurredAtTime = Date.parse(occurredAt);

      if (
        occurredAtTime > now ||
        now - occurredAtTime > newsForYouSemanticSimilarityRetentionMs
      ) {
        continue;
      }
    }

    const normalizedMatch = normalizeNewsForYouSemanticMatch({
      newsItemId,
      now,
      ...(occurredAt ? { occurredAt } : {}),
      similarity,
      ...(strength !== undefined ? { strength } : {}),
    });
    if (!normalizedMatch) continue;

    matches.push(normalizedMatch);
  }

  return selectNewsForYouSemanticSimilarityMatches(matches);
};

const readReaderLocalHour = (value: unknown) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 23
    ? value
    : undefined;

const readRequestBody = (value: unknown): NewsForYouRequestBody => {
  const body = isRecord(value) ? value : {};

  return {
    category: readNonEmptyString(body.category) || null,
    collaborativeSignals: readCollaborativeSignals(body.collaborativeSignals),
    excludeNewsItemIds: readStringArray(body.excludeNewsItemIds).slice(
      0,
      maxNewsForYouExcludeItemIds,
    ),
    limit: readLimit(body.limit),
    negativeFeedbackItems: readNegativeFeedbackItems(
      body.negativeFeedbackItems,
    ),
    objective: readObjective(body.objective),
    positiveFeedbackItems: readPositiveFeedbackItems(
      body.positiveFeedbackItems,
    ),
    profile: readProfile(body.profile),
    q:
      typeof body.q === "string" ? normalizeNewsForYouSearchQuery(body.q) : "",
    readerLocalHour: readReaderLocalHour(body.readerLocalHour),
    recentExposureItems: readRecentExposureItems(body.recentExposureItems),
    searchMemoryItems: readSearchMemoryItems(body.searchMemoryItems),
    semanticSimilarityMatches: readSemanticSimilarityMatches(
      body.semanticSimilarityMatches,
    ),
    sourceSlug: readNonEmptyString(body.sourceSlug) || null,
    tag: readNonEmptyString(body.tag) || null,
  };
};

const getNewsForYouProfileSignalCount = (profile: NewsPreferenceProfile) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  return (
    normalizedProfile.preferredCategories.length +
    normalizedProfile.preferredSources.length +
    normalizedProfile.preferredEntities.length
  );
};

const buildNewsForYouContext = ({
  body,
  degradedSignals,
  rankedRequestBody,
}: {
  body: NewsForYouRequestBody;
  degradedSignals: readonly NewsForYouDegradedSignal[];
  rankedRequestBody: NewsForYouRequestBody;
}): NewsForYouContext => ({
  degradedSignals: [...degradedSignals],
  filters: {
    category: body.category,
    q: body.q || null,
    sourceSlug: body.sourceSlug,
    tag: body.tag,
  },
  memory: {
    collaborativeSignals: rankedRequestBody.collaborativeSignals.length,
    negativeFeedback: body.negativeFeedbackItems.length,
    positiveFeedback: body.positiveFeedbackItems.length,
    recentExposure: body.recentExposureItems.length,
    searches: body.searchMemoryItems.length,
    semanticSimilarity: rankedRequestBody.semanticSimilarityMatches.length,
  },
  objective: body.objective,
  profileSignalCount: getNewsForYouProfileSignalCount(body.profile),
  readerLocalHour: body.readerLocalHour ?? null,
});

const getObjectiveOrder = (
  objective: NewsRecommendationRotationObjective,
): NewsRecommendationRotationObjective[] => [
  objective,
  ...newsForYouObjectives.filter((candidate) => candidate !== objective),
];

const normalizeSignal = (value: string) => value.trim().toLowerCase();

const normalizePreferenceSignalKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");

const normalizeAngleSignal = (value: string) =>
  value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

const addMatchedSignal = (
  signals: readonly string[],
  signal: string,
): string[] => {
  const normalizedSignal = normalizeSignal(signal);
  const seenSignals = new Set(signals.map(normalizeSignal));

  return normalizedSignal && !seenSignals.has(normalizedSignal)
    ? [...signals, signal]
    : [...signals];
};

const boostNewsForYouItem = ({
  item,
  profile,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  profile: NewsPreferenceProfile;
}): RankedNewsItem<NewsHomeItem> => {
  let personalizedScore = item.personalizedScore;
  let matchedSignals = [...item.matchedSignals];
  const preferredCategories = new Set(
    profile.preferredCategories.map(normalizePreferenceSignalKey),
  );
  const preferredSources = new Set(
    profile.preferredSources.map(normalizePreferenceSignalKey),
  );
  const preferredEntities = new Set(
    profile.preferredEntities.map(normalizeSignal),
  );
  const preferredAngles = new Set(
    profile.preferredEntities.map(normalizeAngleSignal),
  );
  const preferredCategoryMatch = preferredCategories.has(
    normalizePreferenceSignalKey(item.category),
  );
  const preferredSourceMatch = preferredSources.has(
    normalizePreferenceSignalKey(item.sourceSlug),
  );
  const preferredEntityMatch = item.entities.some((entity) =>
    preferredEntities.has(normalizeSignal(entity)),
  );
  const preferredAngleMatch = getNewsRecommendationAngleLabels(item.tags).some(
    (angle) => preferredAngles.has(normalizeAngleSignal(angle)),
  );

  if (preferredCategoryMatch) {
    personalizedScore += 45;
    matchedSignals = addMatchedSignal(matchedSignals, "category");
  }

  if (preferredSourceMatch) {
    personalizedScore += 35;
    matchedSignals = addMatchedSignal(matchedSignals, "source");
  }

  if (preferredEntityMatch) {
    personalizedScore += 30;
    matchedSignals = addMatchedSignal(matchedSignals, "entity");
  }

  if (preferredAngleMatch) {
    personalizedScore += 30;
    matchedSignals = addMatchedSignal(matchedSignals, "tag");
  }

  if (
    preferredCategoryMatch ||
    preferredSourceMatch ||
    preferredEntityMatch ||
    preferredAngleMatch
  ) {
    matchedSignals = matchedSignals.filter(
      (signal) => signal !== "exploration",
    );
  }

  return {
    ...item,
    matchedSignals,
    personalizedScore,
  };
};

const getNewsForYouSessionIntent = (
  searchMemoryItems: readonly NewsForYouSearchMemoryItem[],
): NewsSessionIntentFilter | null => {
  const latestSearchItem = searchMemoryItems[0];

  if (!latestSearchItem) return null;

  return {
    category: null,
    query: latestSearchItem.query,
    sourceSlug: null,
  };
};

const buildNewsForYouCandidateRecallBody = (
  body: NewsForYouRequestBody,
): NewsForYouRequestBody => {
  const explicitQuery = body.q.trim();
  const sessionQuery = (
    getNewsForYouSessionIntent(body.searchMemoryItems)?.query ?? ""
  ).trim();
  const recallQuery = explicitQuery.length > 0 ? explicitQuery : sessionQuery;

  return {
    ...body,
    q: recallQuery,
  };
};

const hasMatchedSignal = (item: RankedNewsItem<NewsHomeItem>, signal: string) =>
  item.matchedSignals.some((itemSignal) => itemSignal === signal);

const newsForYouSessionIntentBlockedSignals = new Set([
  "collaborative_negative_feedback",
  "exposure_cooldown",
  "home_exposure_cooldown",
  "negative_feedback",
  "source_trust",
]);

const hasBlockedSessionIntentSignal = (item: RankedNewsItem<NewsHomeItem>) =>
  item.matchedSignals.some((signal) =>
    newsForYouSessionIntentBlockedSignals.has(normalizeSignal(signal)),
  );

const doesNewsForYouItemMatchSessionIntent = ({
  intent,
  item,
}: {
  intent: NewsSessionIntentFilter;
  item: RankedNewsItem<NewsHomeItem>;
}) => {
  if (
    item.sourceScore < 60 ||
    hasMatchedSignal(item, "session_intent") ||
    hasBlockedSessionIntentSignal(item)
  ) {
    return false;
  }

  if (
    intent.category &&
    normalizeFilterValue(item.category) === normalizeFilterValue(intent.category)
  ) {
    return true;
  }

  if (
    intent.sourceSlug &&
    normalizeFilterValue(item.sourceSlug) ===
      normalizeFilterValue(intent.sourceSlug)
  ) {
    return true;
  }

  if (
    intent.tag &&
    item.tags.some((tag) =>
      doesNewsForYouTagMatchFilter({ tag, tagFilter: intent.tag ?? "" }),
    )
  ) {
    return true;
  }

  const queryTerms = getFilterQueryTerms(intent.query ?? "");
  if (queryTerms.length === 0) return false;

  const searchText = getNewsForYouFilterSearchText(item);

  return queryTerms.every((term) => searchText.includes(term));
};

const getPastNewsForYouPublishedAtTime = (publishedAt: string, now: number) => {
  const timestamp = Date.parse(publishedAt);

  return Number.isNaN(timestamp) || timestamp > now ? 0 : timestamp;
};

const rankBoostedNewsForYouItems = (
  items: readonly RankedNewsItem<NewsHomeItem>[],
) => {
  const now = Date.now();

  return [...items].sort((left, right) => {
    if (right.personalizedScore !== left.personalizedScore) {
      return right.personalizedScore - left.personalizedScore;
    }

    return (
      getPastNewsForYouPublishedAtTime(right.publishedAt, now) -
      getPastNewsForYouPublishedAtTime(left.publishedAt, now)
    );
  });
};

const boostSessionIntentItems = ({
  items,
  searchMemoryItems,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
  searchMemoryItems: readonly NewsForYouSearchMemoryItem[];
}): RankedNewsItem<NewsHomeItem>[] => {
  const intent = getNewsForYouSessionIntent(searchMemoryItems);
  const now = Date.now();

  if (!intent) return [...items];

  return selectSessionIntentNewsFeed(items, intent)
    .map((item) => {
      const matchesSessionIntent =
        hasMatchedSignal(item, "session_intent") ||
        doesNewsForYouItemMatchSessionIntent({ intent, item });

      return matchesSessionIntent
        ? {
            ...item,
            matchedSignals: addMatchedSignal(
              item.matchedSignals,
              "session_intent",
            ),
            personalizedScore: item.personalizedScore + 90,
          }
        : item;
    })
    .sort((left, right) => {
      const leftHasSessionIntent = hasMatchedSignal(left, "session_intent");
      const rightHasSessionIntent = hasMatchedSignal(right, "session_intent");

      if (leftHasSessionIntent !== rightHasSessionIntent) {
        return leftHasSessionIntent ? -1 : 1;
      }

      if (right.personalizedScore !== left.personalizedScore) {
        return right.personalizedScore - left.personalizedScore;
      }

      return (
        getPastNewsForYouPublishedAtTime(right.publishedAt, now) -
        getPastNewsForYouPublishedAtTime(left.publishedAt, now)
      );
    });
};

const getNewsForYouCollaborativeSignals = ({
  body,
  items,
}: {
  body: NewsForYouRequestBody;
  items: readonly RankedNewsItem<NewsHomeItem>[];
}) =>
  selectNewsForYouCollaborativeSignals([
    ...body.collaborativeSignals,
    ...getNewsHomeCollaborativeRankingSignals({
      formatCategory: (category) => category,
      historyItems: [],
      items,
      negativeFeedbackItems: body.negativeFeedbackItems.map(
        toNewsForYouReaderMemoryItem,
      ),
      positiveFeedbackItems: body.positiveFeedbackItems.map(
        toNewsForYouCohortPositiveFeedbackItem,
      ),
      profile: body.profile,
      savedItems: [],
    }),
  ]);

const toNewsForYouReaderMemoryItem = (
  item: NewsForYouMemoryItemBase & {
    hiddenAt?: string;
    occurredAt?: string;
  },
): NewsReaderMemoryItem => ({
  canonicalUrl: item.canonicalUrl,
  category: item.category,
  entities: item.entities,
  id: item.id,
  originalUrl: item.originalUrl,
  sourceName: item.sourceName ?? "",
  sourceSlug: item.sourceSlug,
  tags: item.tags,
  title: item.title ?? "",
  ...(item.hiddenAt ? { hiddenAt: item.hiddenAt } : {}),
  ...(item.occurredAt ? { occurredAt: item.occurredAt } : {}),
});

const toNewsForYouCohortPositiveFeedbackItem = (
  item: NewsForYouPositiveFeedbackItem,
) => ({
  ...toNewsForYouReaderMemoryItem(item),
  ...(item.action ? { action: item.action } : {}),
});

const applyNewsForYouMemorySignals = ({
  body,
  items,
}: {
  body: NewsForYouRequestBody;
  items: readonly RankedNewsItem<NewsHomeItem>[];
}): RankedNewsItem<NewsHomeItem>[] => {
  const sessionIntentItems = boostSessionIntentItems({
    items,
    searchMemoryItems: body.searchMemoryItems,
  });
  const exposureBalancedItems =
    body.recentExposureItems.length > 0
      ? selectExposureBalancedNewsFeed(
          sessionIntentItems,
          body.recentExposureItems,
        )
      : sessionIntentItems;
  const collaborativeSignals = getNewsForYouCollaborativeSignals({
    body,
    items: exposureBalancedItems,
  });
  const collaborativeSignalItems =
    collaborativeSignals.length > 0
      ? selectCollaborativeSignalNewsFeed(
          exposureBalancedItems,
          collaborativeSignals,
        )
      : exposureBalancedItems;
  const semanticSimilarityItems =
    body.semanticSimilarityMatches.length > 0
      ? selectSemanticSimilarityNewsFeed(
          collaborativeSignalItems,
          body.semanticSimilarityMatches,
        )
      : collaborativeSignalItems;
  const positiveFeedbackItems =
    body.positiveFeedbackItems.length > 0
      ? selectPositiveFeedbackAnchoredNewsFeed(
          semanticSimilarityItems,
          body.positiveFeedbackItems,
        )
      : semanticSimilarityItems;
  const negativeFeedbackAdjustedItems =
    body.negativeFeedbackItems.length > 0
      ? selectNegativeFeedbackAdjustedNewsFeed(
          positiveFeedbackItems,
          body.negativeFeedbackItems,
        )
      : positiveFeedbackItems;

  return body.readerLocalHour === undefined
    ? negativeFeedbackAdjustedItems
    : selectDaypartBalancedNewsFeed(negativeFeedbackAdjustedItems, {
        readerLocalHour: body.readerLocalHour,
      });
};

const resolveNewsForYouSemanticSimilarityMatches = async ({
  body,
  getSemanticSimilarityMatches,
  items,
}: {
  body: NewsForYouRequestBody;
  getSemanticSimilarityMatches:
    | HandleNewsForYouRequestInput["getSemanticSimilarityMatches"]
    | undefined;
  items: readonly NewsHomeItem[];
}) => {
  if (
    !getSemanticSimilarityMatches ||
    body.positiveFeedbackItems.length === 0
  ) {
    return body.semanticSimilarityMatches;
  }

  const resolvedMatches = await getSemanticSimilarityMatches({
    items,
    positiveFeedbackItems: body.positiveFeedbackItems,
  });
  const now = Date.now();
  const normalizedResolvedMatches = resolvedMatches.flatMap((match) => {
    const normalizedMatch = normalizeNewsForYouSemanticMatch({
      ...match,
      now,
    });

    return normalizedMatch ? [normalizedMatch] : [];
  });

  return selectNewsForYouSemanticSimilarityMatches([
    ...body.semanticSimilarityMatches,
    ...normalizedResolvedMatches,
  ]);
};

const resolveNewsForYouCollaborativeSignals = async ({
  body,
  getCollaborativeSignals,
  items,
}: {
  body: NewsForYouRequestBody;
  getCollaborativeSignals:
    | HandleNewsForYouRequestInput["getCollaborativeSignals"]
    | undefined;
  items: readonly NewsHomeItem[];
}) => {
  if (!getCollaborativeSignals) return body.collaborativeSignals;

  const resolvedSignals = await getCollaborativeSignals({ items });
  const normalizedResolvedSignals = resolvedSignals.flatMap((signal) => {
    const score = normalizeNewsForYouCollaborativeScore(signal.score);

    return score === null ? [] : [{ ...signal, score }];
  });

  return selectNewsForYouCollaborativeSignals([
    ...body.collaborativeSignals,
    ...normalizedResolvedSignals,
  ]);
};

const normalizeFilterValue = (value: string) => value.trim().toLowerCase();

const normalizeAngleFilterValue = normalizeAngleSignal;

const doesNewsForYouTagMatchFilter = ({
  tag,
  tagFilter,
}: {
  tag: string;
  tagFilter: string;
}) => {
  if (normalizeFilterValue(tag) === normalizeFilterValue(tagFilter)) {
    return true;
  }

  if (normalizeAngleFilterValue(tag) === normalizeAngleFilterValue(tagFilter)) {
    return true;
  }

  return getNewsRecommendationAngleLabels([tag]).some(
    (angle) =>
      normalizeAngleFilterValue(angle) === normalizeAngleFilterValue(tagFilter),
  );
};

const normalizeFilterSearchValue = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getFilterQueryTerms = (query: string) =>
  normalizeFilterSearchValue(query).split(/\s+/).filter(Boolean);

const getNewsForYouFilterSearchText = (item: NewsHomeItem) =>
  normalizeFilterSearchValue(
    [
      item.category,
      item.sourceName,
      item.sourceSlug,
      item.summary,
      item.title,
      ...item.entities,
      ...item.tags,
    ].join(" "),
  );

const doesNewsForYouItemMatchFilters = ({
  body,
  item,
}: {
  body: NewsForYouRequestBody;
  item: NewsHomeItem;
}) => {
  const category = body.category;
  const sourceSlug = body.sourceSlug;
  const tagFilter = body.tag;

  if (
    category &&
    normalizeFilterValue(item.category) !== normalizeFilterValue(category)
  ) {
    return false;
  }

  if (
    sourceSlug &&
    normalizeFilterValue(item.sourceSlug) !== normalizeFilterValue(sourceSlug)
  ) {
    return false;
  }

  if (
    tagFilter &&
    !item.tags.some(
      (tag) => doesNewsForYouTagMatchFilter({ tag, tagFilter }),
    )
  ) {
    return false;
  }

  const queryTerms = getFilterQueryTerms(body.q);
  if (queryTerms.length === 0) return true;

  const searchText = getNewsForYouFilterSearchText(item);

  return queryTerms.every((term) => searchText.includes(term));
};

const toNewsForYouApiItem = (item: RankedNewsItem<NewsHomeItem>) => ({
  canonicalUrl: item.canonicalUrl,
  category: item.category,
  entities: [...item.entities],
  id: item.id,
  imageUrl: item.imageUrl,
  matchedSignals: [...item.matchedSignals],
  personalizedScore: item.personalizedScore,
  publishedAt: item.publishedAt,
  recommendation: summarizeNewsRecommendation({ item, mode: "for_you" }),
  sourceName: item.sourceName,
  sourceSlug: item.sourceSlug,
  sourceType: item.sourceType,
  summary: item.summary,
  tags: [...item.tags],
  title: item.title,
  trendScore: item.trendScore,
});

const toNewsForYouRecentExposureItem = ({
  item,
  occurredAt,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  occurredAt: string;
}): NewsForYouRecentExposureItem => ({
  canonicalUrl: item.canonicalUrl,
  category: item.category,
  entities: [...item.entities],
  id: item.id,
  occurredAt,
  sourceSlug: item.sourceSlug,
  surface: "home_exposure",
  tags: [...item.tags],
  title: item.title,
  ...(item.clusterKey ? { clusterKey: item.clusterKey } : {}),
  ...(item.originalUrl !== undefined ? { originalUrl: item.originalUrl } : {}),
});

const mergeNewsForYouRecentExposureItems = ({
  currentItems,
  nextItems,
}: {
  currentItems: readonly NewsForYouRecentExposureItem[];
  nextItems: readonly NewsForYouRecentExposureItem[];
}) => {
  const seenKeys = new Set<string>();
  const mergedItems: NewsForYouRecentExposureItem[] = [];

  for (const item of [...nextItems, ...currentItems]) {
    const keys = getNewsForYouRecentExposureKeys(item);

    if (keys.some((key) => seenKeys.has(key))) continue;

    for (const key of keys) {
      seenKeys.add(key);
    }

    mergedItems.push(item);

    if (mergedItems.length >= maxNewsForYouMemoryItems) break;
  }

  return mergedItems;
};

const readJsonBody = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    throw new Error("Invalid JSON request body");
  }
};

const uniqueStrings = (values: readonly string[]) => {
  const seenValues = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    if (seenValues.has(value)) continue;

    seenValues.add(value);
    uniqueValues.push(value);
  }

  return uniqueValues;
};

const mergeNewsForYouExcludeIds = ({
  currentIds,
  nextIds,
}: {
  currentIds: readonly string[];
  nextIds: readonly string[];
}) => {
  const mergedIds = uniqueStrings([...currentIds, ...nextIds]);

  if (mergedIds.length <= maxNewsForYouExcludeItemIds) return mergedIds;

  return uniqueStrings([...nextIds, ...currentIds]).slice(
    0,
    maxNewsForYouExcludeItemIds,
  );
};

const getExactNegativeFeedbackUrlKeys = (
  negativeFeedbackItems: readonly NewsForYouNegativeFeedbackItem[],
) =>
  new Set(negativeFeedbackItems.flatMap((item) => getNewsDedupeUrlKeys(item)));

const getExactPositiveFeedbackIds = (
  positiveFeedbackItems: readonly NewsForYouPositiveFeedbackItem[],
) =>
  uniqueStrings(
    positiveFeedbackItems.flatMap((item) => [item.id, item.newsItemId]),
  );

const getExactPositiveFeedbackUrlKeys = (
  positiveFeedbackItems: readonly NewsForYouPositiveFeedbackItem[],
) =>
  new Set(positiveFeedbackItems.flatMap((item) => getNewsDedupeUrlKeys(item)));

const getRecentExposureUrlKeys = (
  recentExposureItems: readonly NewsForYouRecentExposureItem[],
) => new Set(recentExposureItems.flatMap((item) => getNewsDedupeUrlKeys(item)));

const getExactExcludedUrlKeys = ({
  excludedIds,
  items,
}: {
  excludedIds: ReadonlySet<string>;
  items: readonly NewsHomeItem[];
}) =>
  new Set(
    items
      .filter((item) => excludedIds.has(item.id))
      .flatMap((item) => getNewsDedupeUrlKeys(item)),
  );

const isExactExcludedItem = ({
  excludedIds,
  excludedUrlKeys,
  item,
}: {
  excludedIds: ReadonlySet<string>;
  excludedUrlKeys: ReadonlySet<string>;
  item: RankedNewsItem<NewsHomeItem>;
}) =>
  excludedIds.has(item.id) ||
  getNewsDedupeUrlKeys(item).some((urlKey) => excludedUrlKeys.has(urlKey));

export const handleNewsForYouRequest = async ({
  getCollaborativeSignals,
  getItems,
  getSemanticSimilarityMatches,
  request,
}: HandleNewsForYouRequestInput) => {
  let parsedBody: unknown;

  try {
    parsedBody = await readJsonBody(request);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Invalid request",
        ok: false,
      },
      { status: 400 },
    );
  }

  const body = readRequestBody(parsedBody);
  const exactExcludedIds = uniqueStrings([
    ...body.excludeNewsItemIds,
    ...body.negativeFeedbackItems.map((item) => item.id),
  ]);
  const consumedIds = new Set([
    ...exactExcludedIds,
    ...getExactPositiveFeedbackIds(body.positiveFeedbackItems),
  ]);
  const items = await getItems();
  const candidateRecallBody = buildNewsForYouCandidateRecallBody(body);
  const excludedUrlKeys = new Set([
    ...getExactNegativeFeedbackUrlKeys(body.negativeFeedbackItems),
    ...getExactPositiveFeedbackUrlKeys(body.positiveFeedbackItems),
    ...getRecentExposureUrlKeys(body.recentExposureItems),
    ...getExactExcludedUrlKeys({ excludedIds: consumedIds, items }),
  ]);
  const candidateItems = selectInitialNewsHomeItems({
    items,
    limit: 90,
  })
    .filter((item) =>
      doesNewsForYouItemMatchFilters({
        body: candidateRecallBody,
        item,
      }),
    )
    .filter(
      (item) =>
        !isExactExcludedItem({
          excludedIds: consumedIds,
          excludedUrlKeys,
          item,
        }),
    );
  const degradedSignals: NewsForYouDegradedSignal[] = [];
  const semanticSimilarityMatches =
    await resolveNewsForYouSemanticSimilarityMatches({
      body,
      getSemanticSimilarityMatches,
      items: candidateItems,
    }).catch(() => {
      degradedSignals.push("semantic_similarity");

      return body.semanticSimilarityMatches;
    });
  const collaborativeSignals = await resolveNewsForYouCollaborativeSignals({
    body,
    getCollaborativeSignals,
    items: candidateItems,
  }).catch(() => {
    degradedSignals.push("collaborative_signals");

    return body.collaborativeSignals;
  });
  const rankedRequestBody: NewsForYouRequestBody = {
    ...body,
    collaborativeSignals,
    semanticSimilarityMatches,
  };
  const rankedItems = applyNewsForYouMemorySignals({
    body: rankedRequestBody,
    items: rankBoostedNewsForYouItems(
      candidateItems.map((item) =>
        boostNewsForYouItem({ item, profile: body.profile }),
      ),
    ),
  });
  const feedItems = selectNewsRecommendationRotationFeed({
    items: rankedItems,
    limit: body.limit,
    objectiveOrder: getObjectiveOrder(body.objective),
  });
  const exposureOccurredAt = new Date().toISOString();
  const nextRecentExposureItems = mergeNewsForYouRecentExposureItems({
    currentItems: body.recentExposureItems,
    nextItems: feedItems.map((item) =>
      toNewsForYouRecentExposureItem({ item, occurredAt: exposureOccurredAt }),
    ),
  });
  const apiItems = feedItems.map(toNewsForYouApiItem);

  return Response.json({
    degradedSignals,
    context: buildNewsForYouContext({
      body,
      degradedSignals,
      rankedRequestBody,
    }),
    excludedCount: exactExcludedIds.length,
    items: apiItems,
    limit: body.limit,
    memory: {
      negativeFeedback: body.negativeFeedbackItems.length,
      positiveFeedback: body.positiveFeedbackItems.length,
      searches: body.searchMemoryItems.length,
    },
    mode: "for_you",
    nextRequest: {
      ...(body.category ? { category: body.category } : {}),
      collaborativeSignals: rankedRequestBody.collaborativeSignals,
      excludeNewsItemIds: mergeNewsForYouExcludeIds({
        currentIds: exactExcludedIds,
        nextIds: apiItems.map((item) => item.id),
      }),
      limit: body.limit,
      negativeFeedbackItems: body.negativeFeedbackItems,
      objective: body.objective,
      positiveFeedbackItems: body.positiveFeedbackItems,
      profile: body.profile,
      ...(body.q ? { q: body.q } : {}),
      ...(body.readerLocalHour !== undefined
        ? { readerLocalHour: body.readerLocalHour }
        : {}),
      recentExposureItems: nextRecentExposureItems,
      searchMemoryItems: body.searchMemoryItems,
      semanticSimilarityMatches: rankedRequestBody.semanticSimilarityMatches,
      ...(body.sourceSlug ? { sourceSlug: body.sourceSlug } : {}),
      ...(body.tag ? { tag: body.tag } : {}),
    },
    objective: body.objective,
    ok: true,
    profile: body.profile,
    returnedCount: apiItems.length,
  });
};
