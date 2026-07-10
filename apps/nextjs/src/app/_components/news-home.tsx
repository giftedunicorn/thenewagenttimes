"use client";

import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  NewsCollaborativeSignal,
  NewsPreferenceProfile,
  NewsRecommendationRotationObjective,
  NewsSemanticSimilarityMatch,
  RankedNewsItem,
  ReaderInteractionAction,
  RecentExposureNewsItem,
} from "@acme/validators";
import { cn } from "@acme/ui";
import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import {
  dedupeNewsItems,
  getNewsExplorationInterval,
  normalizeNewsPreferenceProfile,
  rankNewsForReader,
  selectBreakingNewsPriorityFeed,
  selectDiscoverySlotNewsFeed,
  selectDiverseNewsFeed,
  selectExposureBalancedNewsFeed,
  selectNewsRecommendationRotationFeed,
  selectPositiveFeedbackAnchoredNewsFeed,
  selectSourceTrustBalancedNewsFeed,
  updateReaderProfileWithInteraction,
} from "@acme/validators";

import type {
  getNewsPersonalizationDataVaultExport,
  getNewsPreferenceTuningPlan,
  NewsDeskStatus,
  NewsFeedMode,
  NewsHomeItem,
  NewsHomeStatus,
  NewsHomeStoryActionCommand,
  NewsPositiveFeedbackMemoryItem,
  NewsPreferenceBiasAction,
  NewsPreferenceProfileTrainingAction,
  NewsReaderMemoryItem,
  PersistedNewsPreferenceProfile,
} from "./news-home-model";
import type { NewsSearchMemoryItem } from "./news-reader-memory-storage";
import { TRPCReactProvider, useTRPC } from "~/trpc/react";
import {
  applyNewsStoryQuickTuneAction,
  buildNewsHomeFeedInput,
  buildNewsHomeForYouApiRequestBody,
  buildNewsHomeInteractionMetadata,
  buildNewsHomeLoadMoreFeedInput,
  buildNewsHomeReaderInteraction,
  buildNewsHomeSessionIntentFilter,
  createDefaultNewsPreferenceProfile,
  formatNewsEditionDate,
  formatNewsTime,
  getNewsAnglePreferenceOptions,
  getNewsBriefingPack,
  getNewsBriefingPackTrainingAction,
  getNewsChannelRail,
  getNewsClaimTracker,
  getNewsClaimTrackerTrainingAction,
  getNewsConsensusBoard,
  getNewsConsensusThreadTrainingAction,
  getNewsCoverageThreads,
  getNewsCoverageThreadTrainingAction,
  getNewsEditionBriefing,
  getNewsFeedbackTrainingUpdate,
  getNewsForYouApiPipelineGuardrailSummary,
  getNewsForYouApiPipelineSummary,
  getNewsForYouApiTrainingSignalSummary,
  getNewsForYouControlStrip,
  getNewsFrontPageLayout,
  getNewsFrontPageLayoutTrainingAction,
  getNewsFrontPageSlotMix,
  getNewsFrontPageSlotMixTrainingAction,
  getNewsGuardrailRestoreTrainingUpdate,
  getNewsHomeCollaborativeRankingSignals,
  getNewsHomeForYouApiNextRequestResetKey,
  getNewsHomeLoadMoreQueryRoute,
  getNewsHomeLoadMoreState,
  getNewsHomePaginationResetKey,
  getNewsHomePrimaryQueryRoute,
  getNewsHomeReaderMemoryResetCacheScopes,
  getNewsHomeStoryActionPanel,
  getNewsHomeStoryHistoryItem,
  getNewsPreferenceProfileToggleAction,
  getNewsPreferenceProfileTrainingUpdate,
  getNewsReaderMemoryResetPersistence,
  getNewsReaderMemoryResetTrainingUpdate,
  getNewsReaderSignalSummary,
  getNewsRecommendationNudge,
  getNewsSearchCandidateRail,
  getNewsSearchCandidateTrainingAction,
  getNewsSearchTrends,
  getNewsSearchTrendTrainingAction,
  getNewsSectionFronts,
  getNewsSectionFrontTrainingAction,
  getNewsSourceClusters,
  getNewsSourceClusterTrainingAction,
  getNewsSourceFilterOptions,
  getNewsStoryProofStrip,
  getNewsStoryQuickTuneActions,
  getNewsStoryQuickTuneTrainingUpdate,
  getNewsStoryRankDetails,
  getNewsStorySourceUrl,
  getNewsStoryTimeline,
  getNewsStoryTimelineTrainingAction,
  getNewsTopicHref,
  getNextNewsHomeCursorState,
  getPreviewNewsHomeItems,
  hasNewsHomeExploreFilters,
  isNewsHomePreviewEdition,
  mergeNewsHomeItems,
  mergeNewsHomePositiveFeedbackItems,
  mergeNewsReaderMemoryItems,
  mergeNewsTrainingUpdateHistory,
  removeNewsHomePositiveFeedbackActionItem,
  removeNewsHomePositiveFeedbackItem,
  removeNewsReaderMemoryItem,
  selectActiveNewsGuardrailItems,
  selectActiveNewsHistoryItems,
  selectActiveNewsReaderMemoryItem,
  selectActiveNewsSavedItems,
  selectAngleQuotaBalancedNewsHomeItems,
  selectCategoryQuotaBalancedNewsHomeItems,
  selectCollaborativeSignalNewsHomeItems,
  selectDaypartBalancedNewsHomeItems,
  selectEntityQuotaBalancedNewsHomeItems,
  selectFeedFatigueBalancedNewsHomeItems,
  selectFreshnessQuotaBalancedNewsHomeItems,
  selectHydratedNewsPreferenceProfile,
  selectNegativeFeedbackAdjustedNewsHomeItems,
  selectNewsFeedModeItems,
  selectNewsHomeBaseFeedItems,
  selectNewsHomeExposureRecords,
  selectNewsHomeItems,
  selectNewsHomeLiveSearchCandidateItems,
  selectNewsHomePositiveFeedbackAnchors,
  selectNewsHomePositiveFeedbackMemoryItems,
  selectNewsHomeSearchMemoryAnchoredItems,
  selectNewsHomeSessionScopedItems,
  selectReaderFreshNewsHomeItems,
  selectSessionIntentNewsHomeItems,
  selectSourceCorroboratedNewsHomeItems,
  selectSourceQuotaBalancedNewsHomeItems,
  selectVisibleNewsHomeItems,
  shouldAutoLoadMoreNewsHomeItems,
  shouldDisableNewsHomeLoadMoreButton,
  shouldFetchNewsHomeLiveSearchCandidates,
  shouldFetchNewsHomePrimaryFeed,
  shouldFetchServerRecommendations,
  shouldPersistNewsHomeItemReaderSignals,
  shouldPersistNewsReaderProfile,
  shouldTrainNewsHomeProfileFromAction,
  stripPersistedNewsPreferenceProfile,
  toNewsHomeItemFromPublicFeedItem,
} from "./news-home-model";
import {
  clearStoredNewsReaderMemoryItems as clearStoredMemoryItems,
  newsGuardrailStorageKey as guardrailStorageKey,
  newsHistoryStorageKey as historyStorageKey,
  newsHomeExposureStorageKey as homeExposureStorageKey,
  newsPositiveFeedbackStorageKey as positiveFeedbackStorageKey,
  readStoredNewsReaderMemoryItems as readStoredMemoryItems,
  readStoredNewsSearchMemoryItems,
  readStoredNewsPositiveFeedbackItems as readStoredPositiveFeedbackItems,
  recordStoredNewsSearchMemoryItem,
  newsRestoredGuardrailStorageKey as restoredGuardrailStorageKey,
  newsSavedStorageKey as savedStorageKey,
  newsSearchStorageKey as searchStorageKey,
  selectStoredNewsSearchMemoryItems,
  subscribeToNewsReaderMemoryStorage,
  writeStoredNewsReaderMemoryItems as writeStoredMemoryItems,
  writeStoredNewsPositiveFeedbackItems as writeStoredPositiveFeedbackItems,
  writeStoredNewsSearchMemoryItems as writeStoredSearchItems,
} from "./news-reader-memory-storage";
import {
  areNewsPreferenceProfilesEqual,
  getNewsPreferenceProfileStorageValue,
  readOrCreateNewsVisitorKey,
  readStoredNewsForYouObjective,
  readStoredNewsPreferenceProfile,
  subscribeToNewsForYouObjectiveStorage,
  subscribeToNewsPreferenceProfileStorage,
  writeStoredNewsForYouObjective,
  writeStoredNewsPreferenceProfile,
} from "./news-reader-profile-storage";

type RankedNewsHomeItem = RankedNewsItem<NewsHomeItem>;
type NewsStoryQuickTuneAction = ReturnType<
  typeof getNewsStoryQuickTuneActions
>["actions"][number];
type NewsPreferenceTuningSuggestion = ReturnType<
  typeof getNewsPreferenceTuningPlan
>["suggestions"][number];
type NewsTrainingUpdate = ReturnType<typeof getNewsFeedbackTrainingUpdate> & {
  dataVaultExport?: NonNullable<
    ReturnType<typeof getNewsPersonalizationDataVaultExport>
  >;
  guardrailReviewAction?: {
    actionLabel: string;
    query: string;
    resetFilters: boolean;
    targetFeedMode: NewsFeedMode;
  };
  impactStories?: {
    id: string;
    reason: string;
    sourceName: string;
    title: string;
  }[];
  preferenceUndoAction?: {
    beforeProfile: NewsPreferenceProfile;
    suggestion: NewsPreferenceTuningSuggestion;
  };
  preferenceProfileUndoAction?: {
    action: NewsPreferenceProfileTrainingAction;
    beforeProfile: NewsPreferenceProfile;
  };
  biasUndoAction?: {
    action: NewsPreferenceBiasAction;
    beforeProfile: NewsPreferenceProfile;
  };
  biasResetUndoAction?: {
    beforeProfile: NewsPreferenceProfile;
    label: string;
  };
  undoAction?: NewsStoryQuickTuneAction;
};
type PositiveNewsHomeFeedbackItem = NewsPositiveFeedbackMemoryItem;

interface NewsHomeProps {
  authConfigured: boolean;
  initialItems: NewsHomeItem[];
  deskStatus: NewsDeskStatus;
  refreshConfigured: boolean;
  status: NewsHomeStatus;
  generatedAt: string;
}

interface NewsHomeForYouApiNextRequest {
  collaborativeSignals?: readonly NewsCollaborativeSignal[];
  recentExposureItems?: readonly RecentExposureNewsItem[];
  readingHistoryItems?: readonly RecentExposureNewsItem[];
  semanticSimilarityMatches?: readonly NewsSemanticSimilarityMatch[];
}

interface NewsHomeForYouApiContext {
  daypart: {
    cadenceMinutes: number;
    key: string | null;
    label: string;
  };
  degradedSignals: readonly string[];
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
    readingHistory: number;
    searches: number;
    semanticSimilarity: number;
  };
  objective: NewsForYouObjective;
  pagination: {
    candidateCount: number;
    hasMore: boolean;
    returnedCount: number;
  };
  profileSignalCount: number;
  rankingStages: readonly {
    key: string;
    label: string;
  }[];
  readerLocalHour: number | null;
  sessionIntent: {
    active: boolean;
    fallbackReason?: "no_current_matches";
    query: string | null;
    source: "direct_filter" | "direct_search" | "search_memory" | null;
  };
}

interface NewsHomeForYouApiResponse {
  context?: NewsHomeForYouApiContext;
  hasMore: boolean;
  items: NewsHomeItem[];
  nextRequest?: NewsHomeForYouApiNextRequest;
  ok: boolean;
}

const categoryLabels = {
  funding: "Funding",
  product_hunt: "Product Hunt",
  model_release: "Models",
  new_concept: "New Concepts",
  hot_take: "Hot Takes",
  agent_product: "Agents",
  big_tech: "Big Tech",
  musk_ai: "Musk AI",
  yc_ai: "YC AI",
  research: "Research",
  policy: "Policy",
  security: "Security",
  open_source: "Open Source",
  market_map: "Market Maps",
  other: "Other",
} as const;

type NewsCategoryKey = keyof typeof categoryLabels;

const isNewsCategoryKey = (category: string): category is NewsCategoryKey =>
  category in categoryLabels;

const feedModeOptions = [
  {
    detail: "Reader-ranked",
    label: "For You",
    mode: "for_you",
  },
  {
    detail: "Newest first",
    label: "Latest",
    mode: "latest",
  },
  {
    detail: "Heat-ranked",
    label: "Trending",
    mode: "trending",
  },
] as const satisfies readonly {
  detail: string;
  label: string;
  mode: NewsFeedMode;
}[];

type NewsForYouObjective = NewsRecommendationRotationObjective;

const forYouObjectiveOptions = [
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
  objective: NewsForYouObjective;
}[];

const getNewsForYouObjectiveOrder = (
  objective: NewsForYouObjective,
): readonly NewsRecommendationRotationObjective[] => [
  objective,
  ...forYouObjectiveOptions
    .map((option) => option.objective)
    .filter((candidate) => candidate !== objective),
];

const getCategoryLabel = (category: string) =>
  isNewsCategoryKey(category) ? categoryLabels[category] : category;

const previewItems = getPreviewNewsHomeItems();

const readStoredProfile = (): NewsPreferenceProfile => {
  return readStoredNewsPreferenceProfile({
    defaultProfile: createDefaultNewsPreferenceProfile(),
  });
};

const writeStoredProfile = (profile: NewsPreferenceProfile) => {
  writeStoredNewsPreferenceProfile(profile);
};

const readStoredItemIds = (storageKey: string) => {
  if (typeof window === "undefined") return [];

  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter(
          (itemId): itemId is string =>
            typeof itemId === "string" && itemId.trim().length > 0,
        )
      : [];
  } catch {
    return [];
  }
};

const writeStoredItemIds = (storageKey: string, itemIds: readonly string[]) => {
  window.localStorage.setItem(storageKey, JSON.stringify(itemIds));
};

const toLocalSavedMemoryItem = ({
  item,
  savedAt,
}: {
  item: NewsHomeItem;
  savedAt: string;
}): NewsReaderMemoryItem => ({
  canonicalUrl: item.canonicalUrl,
  category: item.category,
  ...(item.clusterKey ? { clusterKey: item.clusterKey } : {}),
  entities: [...item.entities],
  id: item.id,
  originalUrl: item.originalUrl,
  savedAt,
  sourceName: item.sourceName,
  sourceSlug: item.sourceSlug,
  tags: [...item.tags],
  title: item.title,
});

const toLocalGuardrailMemoryItem = ({
  hiddenAt,
  item,
}: {
  hiddenAt: string;
  item: NewsHomeItem;
}): NewsReaderMemoryItem => ({
  canonicalUrl: item.canonicalUrl,
  category: item.category,
  ...(item.clusterKey ? { clusterKey: item.clusterKey } : {}),
  entities: [...item.entities],
  hiddenAt,
  id: item.id,
  occurredAt: hiddenAt,
  originalUrl: item.originalUrl,
  sourceName: item.sourceName,
  sourceSlug: item.sourceSlug,
  tags: [...item.tags],
  title: item.title,
});

const toLocalHomeExposureMemoryItem = ({
  item,
  viewedAt,
}: {
  item: NewsHomeItem;
  viewedAt: string;
}): NewsReaderMemoryItem => ({
  canonicalUrl: item.canonicalUrl,
  category: item.category,
  ...(item.clusterKey ? { clusterKey: item.clusterKey } : {}),
  entities: [...item.entities],
  id: item.id,
  originalUrl: item.originalUrl,
  sourceName: item.sourceName,
  sourceSlug: item.sourceSlug,
  surface: "home_exposure",
  tags: [...item.tags],
  title: item.title,
  viewedAt,
});

const readNewsForYouApiExposureItems = (
  items: readonly RecentExposureNewsItem[] | undefined,
): NewsReaderMemoryItem[] => {
  if (!items) return [];

  return items.flatMap((item) => {
    const viewedAt = item.occurredAt;

    if (!item.id || !viewedAt || !Number.isFinite(Date.parse(viewedAt))) {
      return [];
    }

    return [
      {
        category: item.category,
        entities: [...item.entities],
        id: item.id,
        sourceName: item.sourceSlug,
        sourceSlug: item.sourceSlug,
        readPercent: item.readPercent,
        surface: item.surface === "article" ? "article" : "home_exposure",
        tags: [...(item.tags ?? [])],
        title: item.title ?? item.id,
        viewedAt,
        ...(item.canonicalUrl !== undefined
          ? { canonicalUrl: item.canonicalUrl }
          : {}),
        ...(typeof item.clusterKey === "string"
          ? { clusterKey: item.clusterKey }
          : {}),
        ...(item.originalUrl !== undefined
          ? { originalUrl: item.originalUrl }
          : {}),
      },
    ];
  });
};

const readStoredHistoryItems = () => readStoredMemoryItems(historyStorageKey);

const readStoredHomeExposureItems = () =>
  readStoredMemoryItems(homeExposureStorageKey);

const readStoredSavedItems = () => readStoredMemoryItems(savedStorageKey);

const readStoredGuardrailItems = () =>
  readStoredMemoryItems(guardrailStorageKey);

const readStoredRestoredGuardrailItemIds = () =>
  readStoredItemIds(restoredGuardrailStorageKey);

const readStoredSearchItems = () => readStoredNewsSearchMemoryItems();

const clearReaderMemoryStorage = () => {
  clearStoredMemoryItems(guardrailStorageKey);
  clearStoredMemoryItems(homeExposureStorageKey);
  clearStoredMemoryItems(historyStorageKey);
  clearStoredMemoryItems(positiveFeedbackStorageKey);
  clearStoredMemoryItems(restoredGuardrailStorageKey);
  clearStoredMemoryItems(savedStorageKey);
  clearStoredMemoryItems(searchStorageKey);
};

const toServerProfile = (profile: NewsPreferenceProfile) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  return {
    preferredCategories: normalizedProfile.preferredCategories
      .filter(isNewsCategoryKey)
      .slice(0, 12),
    preferredSources: normalizedProfile.preferredSources.slice(0, 12),
    preferredEntities: normalizedProfile.preferredEntities.slice(0, 24),
    noveltyBias: normalizedProfile.noveltyBias,
    recencyBias: normalizedProfile.recencyBias,
  };
};

const addValue = (values: readonly string[], value: string) =>
  values.includes(value) ? [...values] : [...values, value];

const removeValue = (values: readonly string[], value: string) =>
  values.filter((item) => item !== value);

const normalizeEntityPreferenceValue = (value: string) =>
  value.trim().toLowerCase();

const hasEntityValue = (values: readonly string[], value: string) => {
  const normalizedValue = normalizeEntityPreferenceValue(value);

  return values.some(
    (item) => normalizeEntityPreferenceValue(item) === normalizedValue,
  );
};

const addEntityValue = (values: readonly string[], value: string) =>
  hasEntityValue(values, value) ? [...values] : [...values, value];

const removeEntityValue = (values: readonly string[], value: string) => {
  const normalizedValue = normalizeEntityPreferenceValue(value);

  return values.filter(
    (item) => normalizeEntityPreferenceValue(item) !== normalizedValue,
  );
};

const normalizeAnglePreferenceValue = (value: string) =>
  value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

const hasAngleValue = (values: readonly string[], value: string) => {
  const normalizedValue = normalizeAnglePreferenceValue(value);

  return values.some(
    (item) => normalizeAnglePreferenceValue(item) === normalizedValue,
  );
};

const addAngleValue = (values: readonly string[], value: string) => {
  return hasAngleValue(values, value) ? [...values] : [...values, value];
};

const removeAngleValue = (values: readonly string[], value: string) => {
  const normalizedValue = normalizeAnglePreferenceValue(value);

  return values.filter(
    (item) => normalizeAnglePreferenceValue(item) !== normalizedValue,
  );
};

const fetchNewsHomeForYouApiPayload = async (
  body: ReturnType<typeof buildNewsHomeForYouApiRequestBody>,
): Promise<NewsHomeForYouApiResponse> => {
  const response = await fetch("/api/news/for-you", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to load personalized stories");
  }

  const payload = (await response.json()) as NewsHomeForYouApiResponse;

  return {
    ...payload,
    hasMore: typeof payload.hasMore === "boolean" ? payload.hasMore : false,
    items: payload.ok && Array.isArray(payload.items) ? payload.items : [],
  };
};

export function NewsHome(props: NewsHomeProps) {
  return (
    <TRPCReactProvider>
      <NewsHomeContent {...props} />
    </TRPCReactProvider>
  );
}

function NewsHomeContent({ initialItems, status, generatedAt }: NewsHomeProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<NewsPreferenceProfile>(
    createDefaultNewsPreferenceProfile,
  );
  const [visitorKey, setVisitorKey] = useState<string | null>(null);
  const [readerLocalHour, setReaderLocalHour] = useState<number | null>(null);
  const [readerStateHydrated, setReaderStateHydrated] = useState(false);
  const [hiddenItemIds, setHiddenItemIds] = useState<string[]>([]);
  const [negativeFeedbackItems, setNegativeFeedbackItems] = useState<
    NewsHomeItem[]
  >([]);
  const [positiveFeedbackItems, setPositiveFeedbackItems] = useState<
    PositiveNewsHomeFeedbackItem[]
  >([]);
  const [localSavedItems, setLocalSavedItems] = useState<
    NewsReaderMemoryItem[]
  >([]);
  const [removedSavedItems, setRemovedSavedItems] = useState<
    NewsReaderMemoryItem[]
  >([]);
  const [localHistoryItems, setLocalHistoryItems] = useState<
    NewsReaderMemoryItem[]
  >([]);
  const [localHomeExposureItems, setLocalHomeExposureItems] = useState<
    NewsReaderMemoryItem[]
  >([]);
  const [localGuardrailItems, setLocalGuardrailItems] = useState<
    NewsReaderMemoryItem[]
  >([]);
  const [searchMemoryItems, setSearchMemoryItems] = useState<
    NewsSearchMemoryItem[]
  >([]);
  const [restoredGuardrailItemIds, setRestoredGuardrailItemIds] = useState<
    string[]
  >([]);
  const [restoredGuardrailItems, setRestoredGuardrailItems] = useState<
    NewsReaderMemoryItem[]
  >([]);
  const [loadedItems, setLoadedItems] = useState<NewsHomeItem[]>([]);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [forYouApiNextRequest, setForYouApiNextRequest] =
    useState<NewsHomeForYouApiNextRequest | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewHiddenAngleQuery, setReviewHiddenAngleQuery] = useState("");
  const [feedMode, setFeedMode] = useState<NewsFeedMode>("for_you");
  const [forYouObjective, setForYouObjective] =
    useState<NewsForYouObjective>("reader_match");
  const [, setTrainingUpdate] = useState<NewsTrainingUpdate | null>(null);
  const [, setTrainingUpdateHistory] = useState<NewsTrainingUpdate[]>([]);
  const [activeCategory, setActiveCategory] = useState<NewsCategoryKey | null>(
    null,
  );
  const [activeSourceSlug, setActiveSourceSlug] = useState<string | null>(null);
  const [activeAngleTag, setActiveAngleTag] = useState<string | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const isLoadingMoreRef = useRef(false);
  const pendingForYouLoadMoreRetryRef = useRef(false);
  const recordedHomeExposureItemsRef = useRef<NewsReaderMemoryItem[]>([]);
  const serverProfileSyncSnapshotRef = useRef<string | null>(null);
  const fallbackItems = initialItems.length > 0 ? initialItems : previewItems;
  const canPersistProfile = shouldPersistNewsReaderProfile({
    status,
    visitorKey,
  });
  const hasExploreFilters = hasNewsHomeExploreFilters({
    category: activeCategory,
    query: searchQuery,
    sourceSlug: activeSourceSlug,
    tag: activeAngleTag,
  });
  const liveSearchQuery = searchDraft.trim();
  const forYouObjectiveOrder = useMemo(
    () => getNewsForYouObjectiveOrder(forYouObjective),
    [forYouObjective],
  );
  const shouldFetchLiveSearchCandidates =
    shouldFetchNewsHomeLiveSearchCandidates({
      query: liveSearchQuery,
      status,
    });
  const serverRecommendationsEnabled = shouldFetchServerRecommendations({
    status,
    visitorKey,
  });
  const normalizedReviewHiddenAngleQuery = reviewHiddenAngleQuery
    .trim()
    .toLowerCase();
  const isReviewingHiddenAngle =
    Boolean(normalizedReviewHiddenAngleQuery) &&
    !activeCategory &&
    !activeAngleTag &&
    !activeSourceSlug &&
    searchQuery.trim().toLowerCase() === normalizedReviewHiddenAngleQuery;
  const publishTrainingUpdate = useCallback(
    (nextUpdate: NewsTrainingUpdate) => {
      setTrainingUpdate(nextUpdate);
      setTrainingUpdateHistory((currentUpdates) =>
        mergeNewsTrainingUpdateHistory({
          currentUpdates,
          limit: 5,
          nextUpdate,
        }),
      );
    },
    [],
  );
  const { mutate: recordSearchMemory } = useMutation(
    trpc.news.recordSearchMemory.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
          queryClient.invalidateQueries(trpc.news.searchMemory.pathFilter()),
        ]);
      },
    }),
  );
  const recordHomeSearchIntent = useCallback(
    ({ query, resultCount }: { query: string; resultCount: number }) => {
      const trimmedQuery = query.trim();

      if (!trimmedQuery) return;

      recordStoredNewsSearchMemoryItem({
        query: trimmedQuery,
        resultCount,
      });
      setSearchMemoryItems(readStoredSearchItems());

      if (!canPersistProfile) return;
      if (!visitorKey) return;

      recordSearchMemory({
        query: trimmedQuery,
        resultCount,
        visitorKey,
      });
    },
    [canPersistProfile, recordSearchMemory, visitorKey],
  );
  const applyForYouApiExposureMemory = useCallback(
    (recentExposureItems: readonly RecentExposureNewsItem[] | undefined) => {
      const nextExposureItems =
        readNewsForYouApiExposureItems(recentExposureItems);
      const unseenExposureItems = nextExposureItems.filter(
        (item) =>
          !selectActiveNewsReaderMemoryItem({
            item,
            memoryItems: recordedHomeExposureItemsRef.current,
          }),
      );

      if (unseenExposureItems.length === 0) return;

      recordedHomeExposureItemsRef.current = mergeNewsReaderMemoryItems({
        limit: 24,
        localItems: unseenExposureItems,
        serverItems: recordedHomeExposureItemsRef.current,
      });
      setLocalHomeExposureItems((currentItems) => {
        const nextItems = mergeNewsReaderMemoryItems({
          limit: 24,
          localItems: unseenExposureItems,
          serverItems: currentItems,
        });

        writeStoredMemoryItems(homeExposureStorageKey, nextItems);
        return nextItems;
      });
    },
    [],
  );
  const profileQuery = useQuery(
    trpc.news.profile.queryOptions(
      { visitorKey: visitorKey ?? undefined },
      { enabled: canPersistProfile && Boolean(visitorKey) },
    ),
  );
  const savedQuery = useQuery(
    trpc.news.saved.queryOptions(
      { limit: 6, visitorKey: visitorKey ?? undefined },
      { enabled: canPersistProfile && Boolean(visitorKey) },
    ),
  );
  const historyQuery = useQuery(
    trpc.news.history.queryOptions(
      { limit: 6, visitorKey: visitorKey ?? undefined },
      { enabled: canPersistProfile && Boolean(visitorKey) },
    ),
  );
  const positiveFeedbackQuery = useQuery(
    trpc.news.positiveFeedback.queryOptions(
      { limit: 6, visitorKey: visitorKey ?? undefined },
      { enabled: canPersistProfile && Boolean(visitorKey) },
    ),
  );
  const guardrailsQuery = useQuery(
    trpc.news.guardrails.queryOptions(
      { limit: 6, visitorKey: visitorKey ?? undefined },
      { enabled: canPersistProfile && Boolean(visitorKey) },
    ),
  );
  const searchMemoryQuery = useQuery(
    trpc.news.searchMemory.queryOptions(
      { limit: 20, visitorKey: visitorKey ?? undefined },
      { enabled: canPersistProfile && Boolean(visitorKey) },
    ),
  );
  const serverReaderMemoryReady =
    !canPersistProfile ||
    !visitorKey ||
    !(
      profileQuery.isPending ||
      savedQuery.isPending ||
      historyQuery.isPending ||
      positiveFeedbackQuery.isPending ||
      guardrailsQuery.isPending ||
      searchMemoryQuery.isPending
    );
  const searchCandidatesQuery = useQuery(
    trpc.news.searchCandidates.queryOptions(
      {
        category: activeCategory ?? undefined,
        limit: 5,
        profile: toServerProfile(profile),
        q: liveSearchQuery,
        sourceSlug: activeSourceSlug ?? undefined,
        tag: activeAngleTag ?? undefined,
        visitorKey: visitorKey ?? undefined,
      },
      { enabled: shouldFetchLiveSearchCandidates },
    ),
  );
  const primaryFeedInput = buildNewsHomeFeedInput({
    category: activeCategory,
    cursor: null,
    feedMode,
    limit: 30,
    q: searchQuery,
    readerLocalHour,
    sourceSlug: activeSourceSlug,
    tag: activeAngleTag,
    visitorKey,
  });
  const primaryFeedRoute = getNewsHomePrimaryQueryRoute({ feedMode });
  const primaryFeedEnabled = shouldFetchNewsHomePrimaryFeed({
    feedMode,
    status,
    visitorKey,
  });
  const publicFeedQuery = useQuery(
    trpc.news.feed.queryOptions(primaryFeedInput, {
      enabled: primaryFeedEnabled && primaryFeedRoute === "feed",
    }),
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
  const applyServerProfile = useCallback(
    (serverProfile: PersistedNewsPreferenceProfile) => {
      const nextProfile = stripPersistedNewsPreferenceProfile(serverProfile);

      setProfile(nextProfile);
      writeStoredProfile(nextProfile);

      return nextProfile;
    },
    [],
  );
  const resetReaderMemory = useMutation(
    trpc.news.resetProfile.mutationOptions({
      onError: () => {
        publishTrainingUpdate(
          getNewsReaderMemoryResetTrainingUpdate({
            persisted: getNewsReaderMemoryResetPersistence({
              canPersistProfile,
              resetFailed: true,
              visitorKey,
            }),
          }),
        );
      },
      onSuccess: async (serverProfile) => {
        applyServerProfile(serverProfile);
        setHiddenItemIds([]);
        setLocalGuardrailItems([]);
        setLocalHomeExposureItems([]);
        setLocalHistoryItems([]);
        setLocalSavedItems([]);
        setRemovedSavedItems([]);
        setNegativeFeedbackItems([]);
        setPositiveFeedbackItems([]);
        setRestoredGuardrailItemIds([]);
        setRestoredGuardrailItems([]);
        setSearchMemoryItems([]);
        recordedHomeExposureItemsRef.current = [];
        clearReaderMemoryStorage();
        const invalidations = getNewsHomeReaderMemoryResetCacheScopes().map(
          (scope) => {
            switch (scope) {
              case "forYou":
                return queryClient.invalidateQueries(
                  trpc.news.forYou.pathFilter(),
                );
              case "profile":
                return queryClient.invalidateQueries(
                  trpc.news.profile.pathFilter(),
                );
              case "saved":
                return queryClient.invalidateQueries(
                  trpc.news.saved.pathFilter(),
                );
              case "history":
                return queryClient.invalidateQueries(
                  trpc.news.history.pathFilter(),
                );
              case "positiveFeedback":
                return queryClient.invalidateQueries(
                  trpc.news.positiveFeedback.pathFilter(),
                );
              case "searchMemory":
                return queryClient.invalidateQueries(
                  trpc.news.searchMemory.pathFilter(),
                );
              case "guardrails":
                return queryClient.invalidateQueries(
                  trpc.news.guardrails.pathFilter(),
                );
            }
          },
        );

        await Promise.all(invalidations);
      },
    }),
  );
  const recordInteraction = useMutation(
    trpc.news.recordInteraction.mutationOptions({
      onSuccess: async (serverProfile) => {
        applyServerProfile(serverProfile);
        await Promise.all([
          queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
          queryClient.invalidateQueries(trpc.news.profile.pathFilter()),
          queryClient.invalidateQueries(trpc.news.saved.pathFilter()),
          queryClient.invalidateQueries(trpc.news.history.pathFilter()),
          queryClient.invalidateQueries(
            trpc.news.positiveFeedback.pathFilter(),
          ),
          queryClient.invalidateQueries(trpc.news.guardrails.pathFilter()),
        ]);
      },
    }),
  );
  const recordHomeExposure = useMutation(
    trpc.news.recordInteraction.mutationOptions(),
  );
  const restoreGuardrail = useMutation(
    trpc.news.restoreGuardrail.mutationOptions({
      onSuccess: async (serverProfile) => {
        applyServerProfile(serverProfile);
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
  const removeSaved = useMutation(
    trpc.news.removeSaved.mutationOptions({
      onSuccess: async (serverProfile) => {
        applyServerProfile(serverProfile);
        await Promise.all([
          queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
          queryClient.invalidateQueries(trpc.news.profile.pathFilter()),
          queryClient.invalidateQueries(trpc.news.saved.pathFilter()),
        ]);
      },
    }),
  );
  const rawServerGuardrailItems = useMemo(
    () => guardrailsQuery.data ?? [],
    [guardrailsQuery.data],
  );
  const serverGuardrailItems = useMemo(
    () =>
      selectActiveNewsGuardrailItems({
        guardrailItems: rawServerGuardrailItems,
        restoredItemIds: restoredGuardrailItemIds,
        restoredItems: restoredGuardrailItems,
      }),
    [rawServerGuardrailItems, restoredGuardrailItemIds, restoredGuardrailItems],
  );
  const activeLocalGuardrailItems = useMemo(
    () =>
      selectActiveNewsGuardrailItems({
        guardrailItems: localGuardrailItems,
        restoredItemIds: restoredGuardrailItemIds,
        restoredItems: restoredGuardrailItems,
      }),
    [localGuardrailItems, restoredGuardrailItemIds, restoredGuardrailItems],
  );
  const hiddenNewsHomeItems = useMemo(
    () =>
      mergeNewsHomeItems({
        currentItems: selectActiveNewsGuardrailItems({
          guardrailItems: negativeFeedbackItems,
          restoredItemIds: restoredGuardrailItemIds,
          restoredItems: restoredGuardrailItems,
        }),
        nextItems: serverGuardrailItems,
      }),
    [
      negativeFeedbackItems,
      restoredGuardrailItemIds,
      restoredGuardrailItems,
      serverGuardrailItems,
    ],
  );
  const guardrailItems = useMemo(
    () =>
      mergeNewsReaderMemoryItems({
        localItems: activeLocalGuardrailItems,
        serverItems: serverGuardrailItems,
      }),
    [activeLocalGuardrailItems, serverGuardrailItems],
  );
  const negativeFeedbackMemoryItems = useMemo(
    () =>
      mergeNewsReaderMemoryItems({
        localItems: guardrailItems,
        serverItems: negativeFeedbackItems,
      }),
    [guardrailItems, negativeFeedbackItems],
  );
  const serverSavedItems = useMemo(
    () =>
      selectActiveNewsSavedItems({
        negativeFeedbackItems: [],
        removedSavedItems,
        savedItems: savedQuery.data ?? [],
      }),
    [removedSavedItems, savedQuery.data],
  );
  const savedItems = useMemo(() => {
    const mergedSavedItems = mergeNewsReaderMemoryItems({
      localItems: localSavedItems,
      serverItems: serverSavedItems,
    });

    return selectActiveNewsSavedItems({
      negativeFeedbackItems: guardrailItems,
      savedItems: mergedSavedItems,
    });
  }, [guardrailItems, localSavedItems, serverSavedItems]);
  const serverHistoryItems = useMemo(
    () => historyQuery.data ?? [],
    [historyQuery.data],
  );
  const serverPositiveFeedbackItems = useMemo(
    () => positiveFeedbackQuery.data ?? [],
    [positiveFeedbackQuery.data],
  );
  const historyItems = useMemo(() => {
    const mergedHistoryItems = mergeNewsReaderMemoryItems({
      localItems: localHistoryItems,
      serverItems: serverHistoryItems,
    });

    return selectActiveNewsHistoryItems({
      historyItems: mergedHistoryItems,
      negativeFeedbackItems: guardrailItems,
    });
  }, [guardrailItems, localHistoryItems, serverHistoryItems]);
  const recentExposureMemoryItems = useMemo(
    () =>
      mergeNewsReaderMemoryItems({
        limit: 80,
        localItems: localHomeExposureItems,
        serverItems: historyItems.map((item) => ({
          ...item,
          surface: "article",
        })),
      }),
    [historyItems, localHomeExposureItems],
  );
  const positiveFeedbackMemoryItems = useMemo(() => {
    return selectNewsHomePositiveFeedbackMemoryItems({
      historyItems,
      positiveFeedbackItems,
      savedItems,
      serverPositiveFeedbackItems,
    });
  }, [
    historyItems,
    positiveFeedbackItems,
    savedItems,
    serverPositiveFeedbackItems,
  ]);
  const positiveFeedbackAnchors = useMemo(
    () =>
      selectNewsHomePositiveFeedbackAnchors({
        explicitFeedbackItems: positiveFeedbackItems,
        historyItems,
        negativeFeedbackItems: negativeFeedbackMemoryItems,
        savedItems,
      }),
    [
      historyItems,
      negativeFeedbackMemoryItems,
      positiveFeedbackItems,
      savedItems,
    ],
  );
  const initialForYouRankingItems = useMemo(
    () =>
      selectDiverseNewsFeed(
        rankNewsForReader(dedupeNewsItems(fallbackItems), profile),
        {
          explorationInterval: getNewsExplorationInterval(profile),
          limit: fallbackItems.length,
        },
      ),
    [fallbackItems, profile],
  );
  const initialForYouCollaborativeSignals = useMemo(
    () =>
      getNewsHomeCollaborativeRankingSignals({
        formatCategory: getCategoryLabel,
        historyItems,
        items: initialForYouRankingItems,
        negativeFeedbackItems: negativeFeedbackMemoryItems,
        positiveFeedbackItems: positiveFeedbackMemoryItems,
        profile,
        savedItems,
      }),
    [
      historyItems,
      initialForYouRankingItems,
      negativeFeedbackMemoryItems,
      positiveFeedbackMemoryItems,
      profile,
      savedItems,
    ],
  );
  const forYouApiRequestBody = useMemo(
    () =>
      buildNewsHomeForYouApiRequestBody({
        category: activeCategory,
        collaborativeSignals: initialForYouCollaborativeSignals,
        currentItems: [],
        limit: 30,
        negativeFeedbackItems: negativeFeedbackMemoryItems,
        objective: forYouObjective,
        positiveFeedbackItems: positiveFeedbackMemoryItems,
        profile,
        q: searchQuery,
        readerLocalHour,
        recentExposureItems: recentExposureMemoryItems,
        readingHistoryItems: historyItems,
        searchMemoryItems,
        semanticSimilarityMatches: [],
        sourceSlug: activeSourceSlug,
        tag: activeAngleTag,
      }),
    [
      activeAngleTag,
      activeCategory,
      activeSourceSlug,
      forYouObjective,
      initialForYouCollaborativeSignals,
      negativeFeedbackMemoryItems,
      positiveFeedbackMemoryItems,
      profile,
      readerLocalHour,
      recentExposureMemoryItems,
      historyItems,
      searchQuery,
      searchMemoryItems,
    ],
  );
  const forYouApiQuery = useQuery({
    enabled:
      primaryFeedEnabled &&
      primaryFeedRoute === "forYou" &&
      readerStateHydrated &&
      serverReaderMemoryReady,
    queryFn: () => fetchNewsHomeForYouApiPayload(forYouApiRequestBody),
    queryKey: ["news", "for-you-api", forYouApiRequestBody],
  });
  const forYouApiNextRequestResetKey = useMemo(
    () => getNewsHomeForYouApiNextRequestResetKey(forYouApiRequestBody),
    [forYouApiRequestBody],
  );
  useEffect(() => {
    setForYouApiNextRequest(null);
  }, [forYouApiNextRequestResetKey]);
  useEffect(() => {
    if (primaryFeedRoute !== "forYou" || !forYouApiQuery.data) return;

    applyForYouApiExposureMemory(
      forYouApiQuery.data.nextRequest?.recentExposureItems,
    );
    setForYouApiNextRequest(forYouApiQuery.data.nextRequest ?? null);
    setHasMoreItems(forYouApiQuery.data.hasMore);
  }, [applyForYouApiExposureMemory, forYouApiQuery.data, primaryFeedRoute]);
  const forYouApiContext = forYouApiQuery.data?.context;
  const forYouApiDirectFilterLabel = forYouApiContext
    ? [
        forYouApiContext.filters.category
          ? getCategoryLabel(forYouApiContext.filters.category)
          : null,
        forYouApiContext.filters.sourceSlug,
        forYouApiContext.filters.tag,
      ]
        .filter((filterLabel): filterLabel is string => Boolean(filterLabel))
        .join(" / ")
    : "";
  const forYouApiIntentLabel =
    forYouApiContext?.sessionIntent.fallbackReason === "no_current_matches"
      ? "Search memory fallback"
      : forYouApiContext?.sessionIntent.source === "search_memory"
        ? "Search memory"
        : forYouApiContext?.sessionIntent.source === "direct_filter"
          ? "Direct filter"
          : "Direct search";
  const forYouApiContextMemory = forYouApiContext
    ? [
        {
          label: "Profile",
          value: `${forYouApiContext.profileSignalCount} signals`,
        },
        {
          label: "Daypart",
          value: forYouApiContext.daypart.label,
        },
        {
          label: "Intent",
          value: forYouApiContext.sessionIntent.active
            ? `${forYouApiIntentLabel}: ${
                forYouApiContext.sessionIntent.source === "direct_filter"
                  ? forYouApiDirectFilterLabel || "Active"
                  : (forYouApiContext.sessionIntent.query ?? "Active")
              }`
            : "None",
        },
        {
          label: "Signal health",
          value:
            forYouApiContext.degradedSignals.length > 0
              ? `${forYouApiContext.degradedSignals.length} degraded`
              : "All signals live",
        },
        {
          label: "Pipeline",
          value: getNewsForYouApiPipelineSummary(
            forYouApiContext.rankingStages,
          ),
        },
        {
          label: "Guardrails",
          value: getNewsForYouApiPipelineGuardrailSummary(
            forYouApiContext.rankingStages,
          ),
        },
        {
          label: "Training",
          value: getNewsForYouApiTrainingSignalSummary(forYouApiContext.memory),
        },
        {
          label: "Page",
          value: `${forYouApiContext.pagination.returnedCount}/${forYouApiContext.pagination.candidateCount}${
            forYouApiContext.pagination.hasMore ? " more" : " done"
          }`,
        },
        {
          label: "Exposure",
          value: `${forYouApiContext.memory.recentExposure} seen`,
        },
        {
          label: "Cohort",
          value: `${forYouApiContext.memory.collaborativeSignals} signals`,
        },
        {
          label: "Semantic",
          value: `${forYouApiContext.memory.semanticSimilarity} matches`,
        },
      ]
    : [];
  const serverRecommendedItems = useMemo(
    () =>
      primaryFeedRoute === "feed"
        ? (publicFeedQuery.data ?? []).map(toNewsHomeItemFromPublicFeedItem)
        : (forYouApiQuery.data?.items ?? []),
    [forYouApiQuery.data, primaryFeedRoute, publicFeedQuery.data],
  );
  const effectiveHiddenItemIds = useMemo(
    () =>
      Array.from(
        new Set([...hiddenItemIds, ...guardrailItems.map((item) => item.id)]),
      ),
    [guardrailItems, hiddenItemIds],
  );
  const initialFeedItems = selectNewsHomeBaseFeedItems({
    fallbackItems,
    hasExploreFilters,
    serverRecommendationsEnabled,
  });
  const baseItems = selectNewsHomeItems({
    initialItems: initialFeedItems,
    serverRecommendedItems,
  });
  const items = selectVisibleNewsHomeItems({
    hiddenItemIds: effectiveHiddenItemIds,
    hiddenItems: hiddenNewsHomeItems,
    includeHiddenItems: isReviewingHiddenAngle,
    items: mergeNewsHomeItems({
      currentItems: baseItems,
      nextItems: loadedItems,
    }),
  });
  const activeFeedIntent = useMemo(
    () =>
      buildNewsHomeSessionIntentFilter({
        category: activeCategory,
        query: searchQuery,
        sourceSlug: activeSourceSlug,
        tag: activeAngleTag,
      }),
    [activeAngleTag, activeCategory, activeSourceSlug, searchQuery],
  );
  const paginationResetKey = getNewsHomePaginationResetKey({
    category: activeCategory,
    feedMode,
    query: searchQuery,
    reviewHiddenAngleQuery,
    sourceSlug: activeSourceSlug,
    tag: activeAngleTag,
  });
  const scopedItems = serverRecommendationsEnabled
    ? items
    : selectNewsHomeSessionScopedItems({
        intent: activeFeedIntent,
        items,
      });
  const isPreview = isNewsHomePreviewEdition({
    hasExploreFilters,
    initialItems,
    serverRecommendedItems,
    status,
  });
  const nextCursorState = getNextNewsHomeCursorState({
    items: scopedItems,
    mode: feedMode,
  });
  const nextCursor = nextCursorState.cursor;
  const nextCursorTrendScore = nextCursorState.cursorTrendScore;

  useEffect(() => {
    const storedGuardrails = readStoredGuardrailItems();
    const storedHomeExposureItems = readStoredHomeExposureItems();
    const storedRestoredGuardrailItemIds = readStoredRestoredGuardrailItemIds();
    const storedRestoredGuardrailIds = new Set(storedRestoredGuardrailItemIds);

    setProfile(readStoredProfile());
    setForYouObjective(readStoredNewsForYouObjective());
    setLocalHomeExposureItems(storedHomeExposureItems);
    setLocalHistoryItems(readStoredHistoryItems());
    setLocalSavedItems(readStoredSavedItems());
    setLocalGuardrailItems(storedGuardrails);
    setPositiveFeedbackItems(readStoredPositiveFeedbackItems());
    setSearchMemoryItems(readStoredSearchItems());
    setRestoredGuardrailItemIds(storedRestoredGuardrailItemIds);
    setHiddenItemIds(
      storedGuardrails
        .filter((item) => !storedRestoredGuardrailIds.has(item.id))
        .map((item) => item.id),
    );
    setVisitorKey(readOrCreateNewsVisitorKey());
    recordedHomeExposureItemsRef.current = storedHomeExposureItems;
    setReaderLocalHour(new Date().getHours());
    setReaderStateHydrated(true);
  }, []);

  useEffect(() => {
    if (!readerStateHydrated) return;

    return subscribeToNewsForYouObjectiveStorage(() => {
      setForYouObjective(readStoredNewsForYouObjective());
    });
  }, [readerStateHydrated]);

  useEffect(() => {
    if (!readerStateHydrated) return;

    writeStoredProfile(profile);
  }, [profile, readerStateHydrated]);

  useEffect(() => {
    if (!readerStateHydrated) return;

    return subscribeToNewsPreferenceProfileStorage(() => {
      const nextProfile = readStoredProfile();

      setProfile((currentProfile) =>
        areNewsPreferenceProfilesEqual(currentProfile, nextProfile)
          ? currentProfile
          : nextProfile,
      );
    });
  }, [readerStateHydrated]);

  useEffect(() => {
    if (!readerStateHydrated) return;

    return subscribeToNewsReaderMemoryStorage(() => {
      const storedGuardrails = readStoredGuardrailItems();
      const storedHomeExposureItems = readStoredHomeExposureItems();
      const storedRestoredGuardrailItemIds =
        readStoredRestoredGuardrailItemIds();
      const storedRestoredGuardrailIds = new Set(
        storedRestoredGuardrailItemIds,
      );

      setLocalHomeExposureItems(storedHomeExposureItems);
      setLocalHistoryItems(readStoredHistoryItems());
      setLocalSavedItems(readStoredSavedItems());
      setLocalGuardrailItems(storedGuardrails);
      setPositiveFeedbackItems(readStoredPositiveFeedbackItems());
      setSearchMemoryItems(readStoredSearchItems());
      setRestoredGuardrailItemIds(storedRestoredGuardrailItemIds);
      setHiddenItemIds(
        storedGuardrails
          .filter((item) => !storedRestoredGuardrailIds.has(item.id))
          .map((item) => item.id),
      );
      recordedHomeExposureItemsRef.current = storedHomeExposureItems;
    });
  }, [readerStateHydrated]);

  useEffect(() => {
    if (!profileQuery.data?.persisted) return;

    setProfile((current) => {
      const nextProfile = selectHydratedNewsPreferenceProfile({
        localProfile: current,
        serverProfile: profileQuery.data,
      });
      writeStoredProfile(nextProfile);
      return nextProfile;
    });
  }, [profileQuery.data]);

  useEffect(() => {
    if (!positiveFeedbackQuery.data || positiveFeedbackQuery.data.length === 0)
      return;

    const nextPositiveFeedbackItems = positiveFeedbackQuery.data.reduce<
      PositiveNewsHomeFeedbackItem[]
    >(
      (currentItems, nextItem) =>
        mergeNewsHomePositiveFeedbackItems({
          currentItems,
          nextItem,
        }),
      readStoredPositiveFeedbackItems(),
    );

    writeStoredPositiveFeedbackItems(nextPositiveFeedbackItems);
    setPositiveFeedbackItems(nextPositiveFeedbackItems);
  }, [positiveFeedbackQuery.data]);

  useEffect(() => {
    if (!searchMemoryQuery.data || searchMemoryQuery.data.length === 0) return;

    const nextSearchMemoryItems = selectStoredNewsSearchMemoryItems([
      ...searchMemoryQuery.data,
      ...readStoredSearchItems(),
    ]);

    writeStoredSearchItems(nextSearchMemoryItems);
    setSearchMemoryItems(nextSearchMemoryItems);
  }, [searchMemoryQuery.data]);

  useEffect(() => {
    if (!readerStateHydrated) return;
    if (!visitorKey || !canPersistProfile) return;
    if (!profileQuery.data || profileQuery.data.persisted) return;
    if (
      areNewsPreferenceProfilesEqual(
        profile,
        createDefaultNewsPreferenceProfile(),
      )
    ) {
      return;
    }

    const localProfileSnapshot = getNewsPreferenceProfileStorageValue(profile);

    if (serverProfileSyncSnapshotRef.current === localProfileSnapshot) return;

    serverProfileSyncSnapshotRef.current = localProfileSnapshot;
    updateProfile.mutate({
      visitorKey,
      profile: toServerProfile(profile),
    });
  }, [
    canPersistProfile,
    profile,
    profileQuery.data,
    readerStateHydrated,
    updateProfile,
    visitorKey,
  ]);

  useEffect(() => {
    setLoadedItems([]);
    setHasMoreItems(true);
  }, [paginationResetKey]);

  useEffect(() => {
    if (!reviewHiddenAngleQuery) return;

    if (
      activeCategory ||
      activeAngleTag ||
      activeSourceSlug ||
      searchQuery.trim().toLowerCase() !== normalizedReviewHiddenAngleQuery
    ) {
      setReviewHiddenAngleQuery("");
    }
  }, [
    activeAngleTag,
    activeCategory,
    activeSourceSlug,
    normalizedReviewHiddenAngleQuery,
    reviewHiddenAngleQuery,
    searchQuery,
  ]);

  const commitProfile = (
    createNextProfile: (
      current: NewsPreferenceProfile,
    ) => NewsPreferenceProfile,
  ) => {
    setProfile((current) => {
      const nextProfile = createNextProfile(current);

      if (visitorKey && canPersistProfile) {
        updateProfile.mutate({
          visitorKey,
          profile: toServerProfile(nextProfile),
        });
      }

      return nextProfile;
    });
  };

  const recordStoryAction = (
    item: RankedNewsHomeItem,
    action: ReaderInteractionAction,
    rankSlot: number,
  ) => {
    if (shouldTrainNewsHomeProfileFromAction(action)) {
      const nextProfile = updateReaderProfileWithInteraction(
        profile,
        item,
        buildNewsHomeReaderInteraction({ action, rankSlot }),
      );
      setProfile(nextProfile);
      writeStoredProfile(nextProfile);
      publishTrainingUpdate(
        getNewsFeedbackTrainingUpdate({
          action,
          afterProfile: nextProfile,
          beforeProfile: profile,
          formatCategory: getCategoryLabel,
          item,
        }),
      );
    }

    const occurredAt = new Date().toISOString();

    if (action === "view") {
      setLocalHistoryItems((current) => {
        const nextItems = mergeNewsReaderMemoryItems({
          localItems: [
            getNewsHomeStoryHistoryItem({
              item,
              viewedAt: occurredAt,
            }),
          ],
          serverItems: current,
        });

        writeStoredMemoryItems(historyStorageKey, nextItems);
        return nextItems;
      });
    }

    if (action === "hide") {
      setRestoredGuardrailItemIds((current) => {
        if (!current.includes(item.id)) return current;

        const nextIds = current.filter((itemId) => itemId !== item.id);

        writeStoredItemIds(restoredGuardrailStorageKey, nextIds);
        return nextIds;
      });
      setRestoredGuardrailItems((current) =>
        removeNewsReaderMemoryItem({
          item,
          itemId: item.id,
          items: current,
        }),
      );
      setLocalSavedItems((current) => {
        const nextItems = removeNewsReaderMemoryItem({
          item,
          itemId: item.id,
          items: current,
        });

        writeStoredMemoryItems(savedStorageKey, nextItems);
        return nextItems;
      });
      setPositiveFeedbackItems((current) => {
        const saveCleanedItems = removeNewsHomePositiveFeedbackItem({
          item,
          itemId: item.id,
          items: current,
        });
        const shareCleanedItems = removeNewsHomePositiveFeedbackActionItem({
          action: "share",
          item,
          itemId: item.id,
          items: saveCleanedItems,
        });
        const nextItems = removeNewsHomePositiveFeedbackActionItem({
          action: "click_source",
          item,
          itemId: item.id,
          items: shareCleanedItems,
        });

        writeStoredPositiveFeedbackItems(nextItems);
        return nextItems;
      });
      setHiddenItemIds((current) =>
        current.includes(item.id) ? current : [...current, item.id],
      );
      setLocalGuardrailItems((current) => {
        const nextItems = mergeNewsReaderMemoryItems({
          localItems: [
            toLocalGuardrailMemoryItem({
              hiddenAt: occurredAt,
              item,
            }),
          ],
          serverItems: current,
        });

        writeStoredMemoryItems(guardrailStorageKey, nextItems);
        return nextItems;
      });
      setNegativeFeedbackItems((current) =>
        current.some((feedbackItem) => feedbackItem.id === item.id)
          ? current
          : [...current, item],
      );
    }

    if (action === "click_source" || action === "save" || action === "share") {
      if (action === "save") {
        setLocalSavedItems((current) => {
          const nextItems = mergeNewsReaderMemoryItems({
            localItems: [
              toLocalSavedMemoryItem({
                item,
                savedAt: occurredAt,
              }),
            ],
            serverItems: current,
          });

          writeStoredMemoryItems(savedStorageKey, nextItems);
          return nextItems;
        });
      }

      setPositiveFeedbackItems((current) => {
        const nextItems = mergeNewsHomePositiveFeedbackItems({
          currentItems: current,
          nextItem: { ...item, action, occurredAt },
        });

        writeStoredPositiveFeedbackItems(nextItems);
        return nextItems;
      });
    }

    if (
      visitorKey &&
      shouldPersistNewsHomeItemReaderSignals({
        canPersistProfile,
        isPreview,
        itemId: item.id,
        visitorKey,
      })
    ) {
      recordInteraction.mutate({
        visitorKey,
        newsItemId: item.id,
        action,
        metadata: buildNewsHomeInteractionMetadata({
          action,
          feedMode,
          intent: activeFeedIntent,
          item,
          rankSlot,
        }),
      });
    }
  };

  const restoreGuardrailItem = (item: NewsReaderMemoryItem) => {
    setRestoredGuardrailItemIds((current) => {
      const nextIds = current.includes(item.id)
        ? current
        : [...current, item.id];

      writeStoredItemIds(restoredGuardrailStorageKey, nextIds);
      return nextIds;
    });
    setRestoredGuardrailItems((current) =>
      current.some((restoredItem) => restoredItem.id === item.id)
        ? current
        : [...current, item],
    );
    setHiddenItemIds((current) =>
      current.filter((itemId) => itemId !== item.id),
    );
    setLocalGuardrailItems((current) => {
      const nextItems = removeNewsReaderMemoryItem({
        item,
        itemId: item.id,
        items: current,
      });

      writeStoredMemoryItems(guardrailStorageKey, nextItems);
      return nextItems;
    });
    setNegativeFeedbackItems((current) =>
      removeNewsReaderMemoryItem({
        item,
        itemId: item.id,
        items: current,
      }),
    );
    publishTrainingUpdate(
      getNewsGuardrailRestoreTrainingUpdate({
        formatCategory: getCategoryLabel,
        item,
      }),
    );

    if (
      visitorKey &&
      shouldPersistNewsHomeItemReaderSignals({
        canPersistProfile,
        isPreview,
        itemId: item.id,
        visitorKey,
      })
    ) {
      restoreGuardrail.mutate({
        visitorKey,
        newsItemId: item.id,
      });
    }
  };

  const removeSavedItem = (item: NewsReaderMemoryItem) => {
    setRemovedSavedItems((current) =>
      [
        item,
        ...removeNewsReaderMemoryItem({
          item,
          itemId: item.id,
          items: current,
        }),
      ].slice(0, 12),
    );
    setLocalSavedItems((current) => {
      const nextItems = removeNewsReaderMemoryItem({
        item,
        itemId: item.id,
        items: current,
      });

      writeStoredMemoryItems(savedStorageKey, nextItems);
      return nextItems;
    });
    setPositiveFeedbackItems((current) => {
      const nextItems = removeNewsHomePositiveFeedbackItem({
        item,
        itemId: item.id,
        items: current,
      });

      writeStoredPositiveFeedbackItems(nextItems);
      return nextItems;
    });

    if (
      visitorKey &&
      shouldPersistNewsHomeItemReaderSignals({
        canPersistProfile,
        isPreview,
        itemId: item.id,
        visitorKey,
      })
    ) {
      removeSaved.mutate({
        visitorKey,
        newsItemId: item.id,
      });
    }
  };

  const applyStoryQuickTuneAction = (action: NewsStoryQuickTuneAction) => {
    const beforeProfile = profile;
    const afterProfile = applyNewsStoryQuickTuneAction({
      action,
      profile: beforeProfile,
    });

    commitProfile(() => afterProfile);
    publishTrainingUpdate(
      getNewsStoryQuickTuneTrainingUpdate({
        action,
        afterProfile,
        beforeProfile,
        formatCategory: getCategoryLabel,
        impactItems: rankedItems,
        impactLimit: 2,
        negativeFeedbackItems: negativeFeedbackMemoryItems,
      }),
    );
  };

  const applySectionFrontAction = (
    input: Parameters<typeof getNewsSectionFrontTrainingAction>[0],
  ) => {
    applyPreferenceProfileAction(getNewsSectionFrontTrainingAction(input));
  };

  const applyBriefingPackAction = (
    input: Parameters<typeof getNewsBriefingPackTrainingAction>[0],
  ) => {
    applyPreferenceProfileAction(getNewsBriefingPackTrainingAction(input));
  };

  const applyFrontPageLayoutAction = (
    input: Parameters<typeof getNewsFrontPageLayoutTrainingAction>[0],
  ) => {
    applyPreferenceProfileAction(getNewsFrontPageLayoutTrainingAction(input));
  };

  const applyFrontPageSlotMixAction = (
    input: Parameters<typeof getNewsFrontPageSlotMixTrainingAction>[0],
  ) => {
    applyPreferenceProfileAction(getNewsFrontPageSlotMixTrainingAction(input));
  };

  const applySourceClusterAction = (
    cluster: Parameters<typeof getNewsSourceClusterTrainingAction>[0],
  ) => {
    applyPreferenceProfileAction(getNewsSourceClusterTrainingAction(cluster));
  };

  const applyClaimTrackerAction = (
    claim: Parameters<typeof getNewsClaimTrackerTrainingAction>[0],
  ) => {
    const claimAction = getNewsClaimTrackerTrainingAction(claim);

    if (!claimAction) return;

    applyPreferenceProfileAction(claimAction);
  };

  const applyStoryTimelineAction = (
    event: Parameters<typeof getNewsStoryTimelineTrainingAction>[0],
  ) => {
    applyPreferenceProfileAction(getNewsStoryTimelineTrainingAction(event));
  };

  const applyCoverageThreadAction = (
    thread: Parameters<typeof getNewsCoverageThreadTrainingAction>[0],
  ) => {
    applyPreferenceProfileAction(getNewsCoverageThreadTrainingAction(thread));
  };

  const applyConsensusThreadAction = (
    thread: Parameters<typeof getNewsConsensusThreadTrainingAction>[0],
  ) => {
    const consensusAction = getNewsConsensusThreadTrainingAction(thread);

    if (!consensusAction) return;

    applyPreferenceProfileAction(consensusAction);
  };

  const applyPreferenceProfileAction = (
    action: NewsPreferenceProfileTrainingAction,
  ) => {
    const beforeProfile = profile;
    const effect = action.effect ?? "add";
    const afterProfile = action.signals.reduce<NewsPreferenceProfile>(
      (currentProfile, signal) => {
        if (signal.kind === "category") {
          return {
            ...currentProfile,
            preferredCategories:
              effect === "remove"
                ? removeValue(currentProfile.preferredCategories, signal.signal)
                : addValue(currentProfile.preferredCategories, signal.signal),
          };
        }

        if (signal.kind === "source") {
          return {
            ...currentProfile,
            preferredSources:
              effect === "remove"
                ? removeValue(currentProfile.preferredSources, signal.signal)
                : addValue(currentProfile.preferredSources, signal.signal),
          };
        }

        return {
          ...currentProfile,
          preferredEntities:
            effect === "remove"
              ? signal.kind === "tag"
                ? removeAngleValue(
                    currentProfile.preferredEntities,
                    signal.signal,
                  )
                : removeEntityValue(
                    currentProfile.preferredEntities,
                    signal.signal,
                  )
              : signal.kind === "tag"
                ? addAngleValue(currentProfile.preferredEntities, signal.signal)
                : addEntityValue(
                    currentProfile.preferredEntities,
                    signal.signal,
                  ),
        };
      },
      beforeProfile,
    );

    commitProfile(() => afterProfile);
    const trainingUpdate = getNewsPreferenceProfileTrainingUpdate({
      action,
      afterProfile,
      beforeProfile,
    });
    const { undoAction, ...visibleTrainingUpdate } = trainingUpdate;

    publishTrainingUpdate({
      ...visibleTrainingUpdate,
      preferenceProfileUndoAction: undoAction,
    });
  };

  const applySearchTrendAction = (
    trend: Parameters<typeof getNewsSearchTrendTrainingAction>[0],
  ) => {
    const trainingAction = getNewsSearchTrendTrainingAction(trend);

    if (!trainingAction) return;

    applyPreferenceProfileAction(trainingAction);
  };

  const applySearchCandidateAction = (
    input: Parameters<typeof getNewsSearchCandidateTrainingAction>[0],
  ) => {
    const candidateAction = getNewsSearchCandidateTrainingAction(input);

    if (!candidateAction) return;

    applyPreferenceProfileAction(candidateAction);
  };

  const applyExploreSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedSearchDraft = searchDraft.trim();

    if (!trimmedSearchDraft) return;

    setReviewHiddenAngleQuery("");
    setSearchQuery(trimmedSearchDraft);
    recordHomeSearchIntent({
      query: trimmedSearchDraft,
      resultCount: searchCandidateRail.leads.length,
    });
  };

  const clearExploreFilters = () => {
    setActiveAngleTag(null);
    setActiveCategory(null);
    setActiveSourceSlug(null);
    setReviewHiddenAngleQuery("");
    setSearchDraft("");
    setSearchQuery("");
  };

  const applyForYouObjective = (objective: NewsForYouObjective) => {
    setForYouObjective(objective);
    writeStoredNewsForYouObjective(objective);
  };

  const resetProfile = () => {
    const nextProfile = createDefaultNewsPreferenceProfile();

    setProfile(nextProfile);
    writeStoredProfile(nextProfile);
    applyForYouObjective("reader_match");
    setHiddenItemIds([]);
    setLocalGuardrailItems([]);
    setLocalHomeExposureItems([]);
    setLocalHistoryItems([]);
    setLocalSavedItems([]);
    setNegativeFeedbackItems([]);
    setPositiveFeedbackItems([]);
    setRestoredGuardrailItemIds([]);
    setRestoredGuardrailItems([]);
    setSearchMemoryItems([]);
    setReviewHiddenAngleQuery("");
    recordedHomeExposureItemsRef.current = [];
    clearReaderMemoryStorage();
    publishTrainingUpdate(
      getNewsReaderMemoryResetTrainingUpdate({
        persisted: getNewsReaderMemoryResetPersistence({
          canPersistProfile,
          visitorKey,
        }),
      }),
    );

    if (visitorKey && canPersistProfile) {
      resetReaderMemory.mutate({ visitorKey });
    }
  };

  const personalizedItems = useMemo(
    () =>
      selectDiverseNewsFeed(
        rankNewsForReader(dedupeNewsItems(scopedItems), profile),
        {
          explorationInterval: getNewsExplorationInterval(profile),
          limit: scopedItems.length,
        },
      ),
    [profile, scopedItems],
  );
  const collaborativeRankingSignals = useMemo(
    () =>
      getNewsHomeCollaborativeRankingSignals({
        formatCategory: getCategoryLabel,
        historyItems,
        items: personalizedItems,
        negativeFeedbackItems: negativeFeedbackMemoryItems,
        positiveFeedbackItems: positiveFeedbackMemoryItems,
        profile,
        savedItems,
      }),
    [
      historyItems,
      negativeFeedbackMemoryItems,
      personalizedItems,
      positiveFeedbackMemoryItems,
      profile,
      savedItems,
    ],
  );

  const loadMoreStories = useCallback(async () => {
    const cursor = nextCursor;

    if (!cursor) return;

    if (
      !shouldAutoLoadMoreNewsHomeItems({
        cursor,
        feedMode,
        hasMoreItems,
        isFeedEndVisible: true,
        isLoadingMore: isLoadingMoreRef.current,
        isPreview,
        visitorKey,
      })
    ) {
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const loadMoreInput = buildNewsHomeLoadMoreFeedInput({
        category: activeCategory,
        cursor,
        cursorTrendScore: nextCursorTrendScore,
        excludeNewsItemIds: scopedItems.map((item) => item.id),
        feedMode,
        limit: 20,
        q: searchQuery,
        readerLocalHour,
        sourceSlug: activeSourceSlug,
        tag: activeAngleTag,
        visitorKey,
      });
      const loadMoreRoute = getNewsHomeLoadMoreQueryRoute({ feedMode });
      let nextHasMoreItems: boolean | undefined;
      let nextItems: NewsHomeItem[];

      if (loadMoreRoute === "forYou") {
        if (!serverReaderMemoryReady) {
          pendingForYouLoadMoreRetryRef.current = true;
          return;
        }
        pendingForYouLoadMoreRetryRef.current = false;

        const forYouApiPayload = await fetchNewsHomeForYouApiPayload(
          buildNewsHomeForYouApiRequestBody({
            category: activeCategory,
            collaborativeSignals:
              forYouApiNextRequest?.collaborativeSignals ??
              collaborativeRankingSignals,
            currentItems: scopedItems,
            limit: 20,
            negativeFeedbackItems: negativeFeedbackMemoryItems,
            objective: forYouObjective,
            positiveFeedbackItems: positiveFeedbackMemoryItems,
            profile,
            q: searchQuery,
            readerLocalHour,
            recentExposureItems: recentExposureMemoryItems,
            readingHistoryItems: historyItems,
            searchMemoryItems,
            semanticSimilarityMatches:
              forYouApiNextRequest?.semanticSimilarityMatches ?? [],
            sourceSlug: activeSourceSlug,
            tag: activeAngleTag,
          }),
        );

        applyForYouApiExposureMemory(
          forYouApiPayload.nextRequest?.recentExposureItems,
        );
        setForYouApiNextRequest(forYouApiPayload.nextRequest ?? null);
        nextHasMoreItems = forYouApiPayload.hasMore;
        nextItems = forYouApiPayload.items;
      } else {
        nextItems = (
          await queryClient.fetchQuery(
            trpc.news.feed.queryOptions(loadMoreInput),
          )
        ).map(toNewsHomeItemFromPublicFeedItem);
      }

      const loadMoreState = getNewsHomeLoadMoreState({
        currentVisibleItems: scopedItems,
        loadedItems,
        nextItems,
      });

      setLoadedItems(loadMoreState.loadedItems);
      setHasMoreItems(nextHasMoreItems ?? loadMoreState.hasNewVisibleItems);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [
    activeAngleTag,
    activeCategory,
    activeSourceSlug,
    applyForYouApiExposureMemory,
    collaborativeRankingSignals,
    feedMode,
    forYouApiNextRequest,
    forYouObjective,
    hasMoreItems,
    historyItems,
    isPreview,
    loadedItems,
    negativeFeedbackMemoryItems,
    nextCursor,
    nextCursorTrendScore,
    positiveFeedbackMemoryItems,
    profile,
    queryClient,
    readerLocalHour,
    recentExposureMemoryItems,
    scopedItems,
    searchQuery,
    searchMemoryItems,
    serverReaderMemoryReady,
    trpc.news.feed,
    visitorKey,
  ]);

  useEffect(() => {
    if (!serverReaderMemoryReady) return;
    if (!pendingForYouLoadMoreRetryRef.current) return;

    if (getNewsHomeLoadMoreQueryRoute({ feedMode }) !== "forYou") {
      pendingForYouLoadMoreRetryRef.current = false;
      return;
    }

    if (
      !shouldAutoLoadMoreNewsHomeItems({
        cursor: nextCursor,
        feedMode,
        hasMoreItems,
        isFeedEndVisible: true,
        isLoadingMore: isLoadingMoreRef.current,
        isPreview,
        visitorKey,
      })
    ) {
      pendingForYouLoadMoreRetryRef.current = false;
      return;
    }

    pendingForYouLoadMoreRetryRef.current = false;
    void loadMoreStories();
  }, [
    feedMode,
    hasMoreItems,
    isPreview,
    loadMoreStories,
    nextCursor,
    serverReaderMemoryReady,
    visitorKey,
  ]);

  useEffect(() => {
    const feedEnd = feedEndRef.current;
    if (
      !feedEnd ||
      isPreview ||
      typeof window === "undefined" ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          shouldAutoLoadMoreNewsHomeItems({
            cursor: nextCursor,
            feedMode,
            hasMoreItems,
            isFeedEndVisible: Boolean(entry?.isIntersecting),
            isLoadingMore: isLoadingMoreRef.current,
            isPreview,
            visitorKey,
          })
        ) {
          void loadMoreStories();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(feedEnd);

    return () => observer.disconnect();
  }, [
    feedMode,
    hasMoreItems,
    isPreview,
    loadMoreStories,
    nextCursor,
    visitorKey,
  ]);

  const rankedItems = useMemo(() => {
    const modeItems = selectNewsFeedModeItems({
      items: personalizedItems,
      mode: feedMode,
    });
    const searchMemoryAnchoredItems =
      feedMode === "for_you"
        ? selectNewsHomeSearchMemoryAnchoredItems({
            items: modeItems,
            searchItems: searchMemoryItems,
          })
        : modeItems;
    const sessionIntentItems =
      feedMode === "for_you"
        ? selectSessionIntentNewsHomeItems({
            intent: activeFeedIntent,
            items: searchMemoryAnchoredItems,
          })
        : searchMemoryAnchoredItems;
    const exposureBalancedItems = selectExposureBalancedNewsFeed(
      sessionIntentItems,
      historyItems,
    );
    const collaborativeSignalItems = selectCollaborativeSignalNewsHomeItems({
      collaborativeSignals: collaborativeRankingSignals,
      items: exposureBalancedItems,
    });
    const positiveAnchoredItems = selectPositiveFeedbackAnchoredNewsFeed(
      collaborativeSignalItems,
      positiveFeedbackAnchors,
      new Date(generatedAt),
    );
    const feedbackAdjustedItems = selectNegativeFeedbackAdjustedNewsHomeItems({
      items: positiveAnchoredItems,
      negativeFeedbackItems: negativeFeedbackMemoryItems,
    });
    const trustBalancedItems = selectSourceTrustBalancedNewsFeed(
      feedbackAdjustedItems,
    );
    const sourceCorroboratedItems = selectSourceCorroboratedNewsHomeItems({
      items: trustBalancedItems,
    });
    const daypartBalancedItems = selectDaypartBalancedNewsHomeItems({
      items: sourceCorroboratedItems,
      now: new Date(generatedAt),
      readerLocalHour,
    });
    const fatigueBalancedItems = selectFeedFatigueBalancedNewsHomeItems({
      items: daypartBalancedItems,
    });
    const breakingPriorityItems = selectBreakingNewsPriorityFeed(
      fatigueBalancedItems,
      new Date(generatedAt),
    );
    const discoverySlotItems = selectDiscoverySlotNewsFeed(
      breakingPriorityItems,
    );

    const readerFreshItems = selectReaderFreshNewsHomeItems({
      historyItems,
      items: discoverySlotItems,
    });
    const freshnessQuotaItems = selectFreshnessQuotaBalancedNewsHomeItems({
      items: readerFreshItems,
      limit: readerFreshItems.length,
      now: new Date(generatedAt),
    });
    const rotatedItems = selectNewsRecommendationRotationFeed({
      items: freshnessQuotaItems,
      limit: freshnessQuotaItems.length,
      objectiveOrder: feedMode === "for_you" ? forYouObjectiveOrder : undefined,
    });

    const sourceQuotaBalancedItems = selectSourceQuotaBalancedNewsHomeItems({
      items: rotatedItems,
      limit: rotatedItems.length,
    });

    const entityQuotaBalancedItems = selectEntityQuotaBalancedNewsHomeItems({
      items: sourceQuotaBalancedItems,
      limit: sourceQuotaBalancedItems.length,
    });

    const categoryQuotaBalancedItems = selectCategoryQuotaBalancedNewsHomeItems(
      {
        items: entityQuotaBalancedItems,
        limit: entityQuotaBalancedItems.length,
      },
    );

    return selectAngleQuotaBalancedNewsHomeItems({
      items: categoryQuotaBalancedItems,
      limit: categoryQuotaBalancedItems.length,
    });
  }, [
    activeFeedIntent,
    collaborativeRankingSignals,
    feedMode,
    forYouObjectiveOrder,
    generatedAt,
    historyItems,
    negativeFeedbackMemoryItems,
    personalizedItems,
    positiveFeedbackAnchors,
    readerLocalHour,
    searchMemoryItems,
  ]);

  useEffect(() => {
    const records = selectNewsHomeExposureRecords({
      feedMode,
      isPreview,
      items: rankedItems,
      limit: 6,
      recordedItems: mergeNewsReaderMemoryItems({
        limit: 24,
        localItems: localHomeExposureItems,
        serverItems: recordedHomeExposureItemsRef.current,
      }),
      visitorKey,
    });

    if (records.length === 0) return;

    const exposedIds = new Set(records.map((record) => record.newsItemId));
    const exposedAt = new Date().toISOString();
    const nextExposureItems = rankedItems
      .filter((item) => exposedIds.has(item.id))
      .map((item) =>
        toLocalHomeExposureMemoryItem({
          item,
          viewedAt: exposedAt,
        }),
      );

    recordedHomeExposureItemsRef.current = mergeNewsReaderMemoryItems({
      limit: 24,
      localItems: nextExposureItems,
      serverItems: recordedHomeExposureItemsRef.current,
    });
    setLocalHomeExposureItems((currentItems) => {
      const nextItems = mergeNewsReaderMemoryItems({
        limit: 24,
        localItems: nextExposureItems,
        serverItems: currentItems,
      });

      writeStoredMemoryItems(homeExposureStorageKey, nextItems);
      return nextItems;
    });

    if (canPersistProfile) {
      records.forEach((record) => recordHomeExposure.mutate(record));
    }
  }, [
    canPersistProfile,
    feedMode,
    isPreview,
    localHomeExposureItems,
    rankedItems,
    recordHomeExposure,
    visitorKey,
  ]);

  const leadStory = rankedItems[0];
  const secondaryStories = rankedItems.slice(1, 4);
  const streamStories = rankedItems.slice(4);
  const rankedItemsById = useMemo(
    () => new Map(rankedItems.map((item) => [item.id, item])),
    [rankedItems],
  );
  const defaultCategories = Object.keys(categoryLabels) as NewsCategoryKey[];
  const availableCategories = Array.from(
    new Set([
      ...defaultCategories.slice(0, 9),
      ...items.map((item) => item.category).filter(isNewsCategoryKey),
    ]),
  );
  const sourceFilterOptions = getNewsSourceFilterOptions({
    items: [...fallbackItems, ...items],
    limit: 8,
  });
  const availableAngleOptions = getNewsAnglePreferenceOptions({
    items: [...fallbackItems, ...items],
  });
  const selectSavedItemForStory = (item: NewsReaderMemoryItem) =>
    selectActiveNewsReaderMemoryItem({
      item,
      memoryItems: savedItems,
    });
  const selectGuardrailItemForStory = (item: NewsReaderMemoryItem) =>
    selectActiveNewsReaderMemoryItem({
      item,
      memoryItems: guardrailItems,
    });
  const readerSignalSummary = getNewsReaderSignalSummary(profile);
  const rankDetailsAt = useMemo(() => new Date(generatedAt), [generatedAt]);
  const editionBriefing = getNewsEditionBriefing({
    entityLimit: 3,
    formatCategory: getCategoryLabel,
    items: rankedItems,
    topicLimit: 3,
  });
  const briefingPack = getNewsBriefingPack({
    formatCategory: getCategoryLabel,
    items: rankedItems,
  });
  const frontPageLayout = getNewsFrontPageLayout({
    formatCategory: getCategoryLabel,
    items: rankedItems,
  });
  const frontPageSlotMix = getNewsFrontPageSlotMix({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    profile,
  });
  const channelRail = getNewsChannelRail({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 5,
    profile,
  });
  const forYouControlStrip = getNewsForYouControlStrip({
    formatCategory: getCategoryLabel,
    guardrailItems,
    profile,
    rankedItems,
    savedItems,
    searchMemoryItems,
  });
  const searchTrends = getNewsSearchTrends({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 5,
    profile,
  });
  const liveSearchServerCandidateItems = useMemo(
    () =>
      searchCandidatesQuery.data?.map(toNewsHomeItemFromPublicFeedItem) ?? [],
    [searchCandidatesQuery.data],
  );
  const liveSearchCandidateItems = useMemo(
    () =>
      selectNewsHomeLiveSearchCandidateItems({
        activeCategory,
        activeSourceSlug,
        activeTag: activeAngleTag,
        localItems: rankedItems,
        query: liveSearchQuery,
        serverItems: liveSearchServerCandidateItems,
      }),
    [
      activeAngleTag,
      activeCategory,
      activeSourceSlug,
      liveSearchQuery,
      liveSearchServerCandidateItems,
      rankedItems,
    ],
  );
  const searchCandidateRail = getNewsSearchCandidateRail({
    candidates: liveSearchCandidateItems,
    formatCategory: getCategoryLabel,
    limit: 4,
    query: liveSearchQuery,
  });
  const sectionFronts = getNewsSectionFronts({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 4,
    storiesPerSection: 3,
  });
  const sourceClusters = getNewsSourceClusters({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 3,
    storiesPerCluster: 3,
  });
  const claimTracker = getNewsClaimTracker({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 3,
    storiesPerClaim: 3,
  });
  const storyTimeline = getNewsStoryTimeline({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 4,
  });
  const coverageThreads = getNewsCoverageThreads({
    items: rankedItems,
    limit: 3,
    storiesPerThread: 3,
  });
  const consensusBoard = getNewsConsensusBoard({
    items: rankedItems,
    limit: 3,
    storiesPerThread: 2,
  });

  return (
    <main className="min-h-[100dvh] bg-[#f7f5ef] text-[#161616] transition-colors dark:bg-[#101010] dark:text-[#f4f1ea]">
      <header className="border-b border-[#161616] dark:border-[#f4f1ea]">
        <div className="container flex flex-col gap-4 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] uppercase">
              AI intelligence edition
            </p>
            <h1 className="mt-2 text-4xl leading-none font-black tracking-normal sm:text-6xl lg:text-7xl">
              The New AI Times
            </h1>
          </div>
          <div className="max-w-xl text-sm leading-6 text-[#4a4a4a] dark:text-[#c8c4ba]">
            <p>{formatNewsEditionDate(generatedAt)}</p>
            <p>
              A ranked front page for agent products, frontier models, funding,
              research, and the companies shaping the next software cycle.
            </p>
          </div>
        </div>
        <nav className="container flex gap-2 overflow-x-auto border-t border-[#161616]/25 py-3 text-sm dark:border-[#f4f1ea]/25">
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <Link href="/briefing">Briefing</Link>
          </Button>
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <Link href="/threads">Threads</Link>
          </Button>
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <Link href="/topics">Topics</Link>
          </Button>
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <Link href="/entities">Entities</Link>
          </Button>
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <Link href="/sources">Sources</Link>
          </Button>
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <Link href="/reader">Reader</Link>
          </Button>
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <Link href="/reader/following">Following</Link>
          </Button>
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <Link href="/reader/library">Library</Link>
          </Button>
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <Link href="/reader/onboarding">Set up</Link>
          </Button>
          <Button asChild className="rounded-none" size="sm" variant="outline">
            <a href="/rss.xml">RSS</a>
          </Button>
          {availableCategories.slice(0, 10).map((category) => {
            const active = profile.preferredCategories.includes(category);
            const label = getCategoryLabel(category);

            return (
              <Button
                key={category}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                className="rounded-none"
                onClick={() =>
                  applyPreferenceProfileAction(
                    getNewsPreferenceProfileToggleAction({
                      active,
                      kind: "category",
                      label,
                      signal: category,
                    }),
                  )
                }
              >
                {label}
              </Button>
            );
          })}
        </nav>
        {leadStory ? (
          <section
            aria-label="A1 Lead Story"
            className="border-t border-[#161616]/25 dark:border-[#f4f1ea]/25"
          >
            <div className="container grid gap-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:items-stretch">
              <article className="grid gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-mono text-xs tracking-[0.18em] uppercase">
                    A1 Lead Story
                  </p>
                  <span className="border border-[#161616]/35 px-2 py-1 text-xs font-semibold text-[#8a241c] dark:border-[#f4f1ea]/35 dark:text-[#ff8b7e]">
                    {getCategoryLabel(leadStory.category)}
                  </span>
                </div>
                <div className="grid gap-3">
                  <Link
                    className="max-w-5xl text-3xl leading-tight font-black tracking-normal hover:text-[#8a241c] sm:text-4xl lg:text-5xl dark:hover:text-[#ff8b7e]"
                    href={`/news/${leadStory.id}`}
                  >
                    {leadStory.title}
                  </Link>
                  <p className="max-w-3xl text-base leading-7 text-[#4a4a4a] dark:text-[#c8c4ba]">
                    {leadStory.summary}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                  <span className="border border-[#161616]/25 px-2 py-1 dark:border-[#f4f1ea]/20">
                    {leadStory.sourceName}
                  </span>
                  <span className="border border-[#161616]/25 px-2 py-1 dark:border-[#f4f1ea]/20">
                    {formatNewsTime(leadStory.publishedAt)}
                  </span>
                  <span className="border border-[#161616]/25 px-2 py-1 dark:border-[#f4f1ea]/20">
                    {leadStory.personalizedScore} For You score
                  </span>
                </div>
                <StoryAction
                  item={leadStory}
                  guardrailItem={selectGuardrailItemForStory(leadStory)}
                  isPreview={isPreview}
                  rankSlot={1}
                  savedItem={selectSavedItemForStory(leadStory)}
                  onAction={recordStoryAction}
                  onRemoveSaved={removeSavedItem}
                  onRestoreGuardrail={restoreGuardrailItem}
                />
              </article>
              <StoryVisual featured item={leadStory} />
            </div>
          </section>
        ) : null}
        <section className="container grid gap-3 border-t border-[#161616]/25 py-4 dark:border-[#f4f1ea]/25">
          <form
            action="/search"
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
            method="get"
            onSubmit={applyExploreSearch}
          >
            <Input
              aria-label="Search AI news"
              className="h-10 rounded-none border-[#161616]/45 bg-[#fffdf7] dark:border-[#f4f1ea]/45 dark:bg-[#181818]"
              name="q"
              placeholder="Search models, agents, funding"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
            <Button className="rounded-none" type="submit">
              Search
            </Button>
            <Button
              className="rounded-none"
              disabled={!hasExploreFilters && !searchDraft.trim()}
              type="button"
              variant="outline"
              onClick={clearExploreFilters}
            >
              Reset
            </Button>
          </form>
          {liveSearchQuery ? (
            <div
              aria-label="Live Search Leads"
              className="grid gap-2 border border-[#161616]/25 bg-[#fffdf7] p-3 dark:border-[#f4f1ea]/20 dark:bg-[#181818]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-black">
                    {searchCandidateRail.label}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                    {searchCandidatesQuery.isFetching
                      ? `Checking live matches for "${liveSearchQuery}".`
                      : searchCandidateRail.summary}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 font-mono text-[11px]">
                  {searchCandidateRail.metrics.map((metric) => (
                    <span
                      key={metric.label}
                      className="border border-[#161616]/30 px-2 py-1 dark:border-[#f4f1ea]/30"
                    >
                      {metric.label} {metric.value}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {searchCandidateRail.leads.length > 0 ? (
                  searchCandidateRail.leads.map((lead, index) => {
                    const item = rankedItemsById.get(lead.id);
                    const candidateAction = item
                      ? getNewsSearchCandidateTrainingAction({ item, lead })
                      : null;

                    return (
                      <article
                        key={lead.id}
                        className="grid min-w-60 gap-2 border border-[#161616]/20 p-2 dark:border-[#f4f1ea]/15"
                      >
                        <Button
                          className="h-auto justify-start rounded-none px-3 py-2 text-left"
                          size="sm"
                          type="button"
                          variant={
                            searchQuery === lead.query ? "default" : "outline"
                          }
                          onClick={() => {
                            setReviewHiddenAngleQuery("");
                            setSearchDraft(lead.query);
                            setSearchQuery(lead.query);
                            recordHomeSearchIntent({
                              query: lead.query,
                              resultCount: searchCandidateRail.leads.length,
                            });
                          }}
                        >
                          <span className="grid gap-1">
                            <span className="font-mono text-[11px] opacity-70">
                              {lead.sourceName} / {lead.categoryLabel}
                            </span>
                            <span className="line-clamp-2">{lead.title}</span>
                            <span className="text-xs opacity-70">
                              {lead.reasonLabel} / {lead.topicLabel}
                            </span>
                          </span>
                        </Button>
                        {item ? (
                          <StoryAction
                            item={item}
                            guardrailItem={selectGuardrailItemForStory(item)}
                            isPreview={isPreview}
                            rankSlot={index + 1}
                            savedItem={selectSavedItemForStory(item)}
                            onAction={recordStoryAction}
                            onRemoveSaved={removeSavedItem}
                            onRestoreGuardrail={restoreGuardrailItem}
                          />
                        ) : null}
                        {candidateAction && item ? (
                          <Button
                            className="h-8 justify-start rounded-none px-2 text-xs"
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() =>
                              applySearchCandidateAction({ item, lead })
                            }
                          >
                            {candidateAction.actionLabel}
                          </Button>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {searchCandidatesQuery.isFetching
                      ? "Loading live search leads."
                      : searchCandidateRail.summary}
                  </p>
                )}
              </div>
            </div>
          ) : null}
          <div className="grid gap-2 border border-[#161616]/25 bg-[#fffdf7] p-3 dark:border-[#f4f1ea]/20 dark:bg-[#181818]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black">Search Trends</h2>
                <p className="mt-1 text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                  {searchTrends.summary}
                </p>
              </div>
              <span className="border border-[#161616]/30 px-2 py-1 font-mono text-[11px] dark:border-[#f4f1ea]/30">
                {searchTrends.label}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {searchTrends.trends.length > 0 ? (
                searchTrends.trends.map((trend) => {
                  const trendAction = getNewsSearchTrendTrainingAction(trend);

                  return (
                    <div key={trend.key} className="grid min-w-52 gap-2">
                      <Button
                        className="h-auto justify-start rounded-none px-3 py-2 text-left"
                        size="sm"
                        type="button"
                        variant={
                          searchQuery === trend.query ? "default" : "outline"
                        }
                        onClick={() => {
                          setReviewHiddenAngleQuery("");
                          setSearchDraft(trend.query);
                          setSearchQuery(trend.query);
                          recordHomeSearchIntent({
                            query: trend.query,
                            resultCount: rankedItems.length,
                          });
                        }}
                      >
                        <span className="grid gap-1">
                          <span className="font-mono text-[11px] opacity-70">
                            {trend.label} / {trend.supportLabel}
                          </span>
                          <span>{trend.query}</span>
                        </span>
                      </Button>
                      {trendAction ? (
                        <Button
                          className="h-8 justify-start rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => applySearchTrendAction(trend)}
                        >
                          Add to profile
                        </Button>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  Search trends will appear after stories are ranked.
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {feedModeOptions.map((option) => (
              <Button
                key={option.mode}
                className="h-auto justify-between rounded-none px-3 py-2 text-left"
                type="button"
                variant={feedMode === option.mode ? "default" : "outline"}
                onClick={() => setFeedMode(option.mode)}
              >
                <span>{option.label}</span>
                <span className="ml-3 font-mono text-[11px] opacity-70">
                  {option.detail}
                </span>
              </Button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto text-sm">
            <Button
              className="rounded-none"
              size="sm"
              type="button"
              variant={!activeCategory ? "default" : "outline"}
              onClick={() => setActiveCategory(null)}
            >
              All topics
            </Button>
            {availableCategories.slice(0, 10).map((category) => (
              <div key={category} className="flex shrink-0 gap-1">
                <Button
                  className="rounded-none"
                  size="sm"
                  type="button"
                  variant={activeCategory === category ? "default" : "outline"}
                  onClick={() =>
                    setActiveCategory((current) =>
                      current === category ? null : category,
                    )
                  }
                >
                  {getCategoryLabel(category)}
                </Button>
                <Button
                  asChild
                  aria-label="Open topic edition"
                  className="rounded-none px-2"
                  size="sm"
                  variant="outline"
                >
                  <Link href={getNewsTopicHref(category)}>Edition</Link>
                </Button>
              </div>
            ))}
          </div>
          {sourceFilterOptions.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto text-sm">
              <Button
                className="rounded-none"
                size="sm"
                type="button"
                variant={!activeSourceSlug ? "default" : "outline"}
                onClick={() => setActiveSourceSlug(null)}
              >
                All sources
              </Button>
              {sourceFilterOptions.map((source) => (
                <div key={source.slug} className="flex shrink-0 gap-1">
                  <Button
                    className="rounded-none"
                    size="sm"
                    type="button"
                    variant={
                      activeSourceSlug === source.slug ? "default" : "outline"
                    }
                    onClick={() =>
                      setActiveSourceSlug((current) =>
                        current === source.slug ? null : source.slug,
                      )
                    }
                  >
                    {source.label}
                  </Button>
                  <Button
                    asChild
                    aria-label="Open source edition"
                    className="rounded-none px-2"
                    size="sm"
                    variant="outline"
                  >
                    <Link href={`/sources/${source.slug}`}>Edition</Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
          {availableAngleOptions.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto text-sm">
              <Button
                className="rounded-none"
                size="sm"
                type="button"
                variant={!activeAngleTag ? "default" : "outline"}
                onClick={() => setActiveAngleTag(null)}
              >
                All angles
              </Button>
              {availableAngleOptions.slice(0, 10).map((angle) => (
                <Button
                  key={angle.signal}
                  className="rounded-none"
                  size="sm"
                  type="button"
                  variant={
                    activeAngleTag === angle.signal ? "default" : "outline"
                  }
                  onClick={() =>
                    setActiveAngleTag((current) =>
                      current === angle.signal ? null : angle.signal,
                    )
                  }
                >
                  {angle.label}
                </Button>
              ))}
            </div>
          ) : null}
        </section>
      </header>

      <section className="border-b border-[#161616]/25 bg-[#fffdf7] dark:border-[#f4f1ea]/25 dark:bg-[#181818]">
        <div className="container grid gap-3 py-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <p className="font-mono text-xs tracking-[0.18em] uppercase">
                For You Control Strip
              </p>
              <h2 className="mt-1 text-xl font-black">
                {forYouControlStrip.label}
              </h2>
              <p className="mt-1 max-w-4xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                {forYouControlStrip.summary}
              </p>
            </div>
            <Button
              className="rounded-none whitespace-nowrap"
              disabled={resetReaderMemory.isPending}
              type="button"
              variant="outline"
              onClick={resetProfile}
            >
              Reset memory
            </Button>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="grid gap-3">
              <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                {forYouControlStrip.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="border-t border-[#161616]/20 pt-2 dark:border-[#f4f1ea]/15"
                  >
                    <dt className="font-mono text-[10px] tracking-[0.12em] text-[#5b5750] uppercase dark:text-[#bbb4aa]">
                      {metric.label}
                    </dt>
                    <dd className="mt-1 text-lg font-black">{metric.value}</dd>
                  </div>
                ))}
              </dl>

              <dl className="flex flex-wrap gap-2 text-xs">
                {forYouControlStrip.memory.map((memoryItem) => (
                  <div
                    key={memoryItem.label}
                    className="flex items-center gap-2 border border-[#161616]/20 px-2 py-1 dark:border-[#f4f1ea]/20"
                  >
                    <dt className="font-mono text-[10px] tracking-[0.12em] text-[#5b5750] uppercase dark:text-[#bbb4aa]">
                      {memoryItem.label}
                    </dt>
                    <dd className="font-semibold">{memoryItem.value}</dd>
                  </div>
                ))}
              </dl>

              {forYouApiContextMemory.length > 0 ? (
                <div className="grid gap-2 border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15">
                  <p className="font-mono text-[10px] tracking-[0.12em] text-[#5b5750] uppercase dark:text-[#bbb4aa]">
                    Live API context
                  </p>
                  <dl className="flex flex-wrap gap-2 text-xs">
                    {forYouApiContextMemory.map((memoryItem) => (
                      <div
                        key={memoryItem.label}
                        className="flex items-center gap-2 border border-[#161616]/20 px-2 py-1 dark:border-[#f4f1ea]/20"
                      >
                        <dt className="font-mono text-[10px] tracking-[0.12em] text-[#5b5750] uppercase dark:text-[#bbb4aa]">
                          {memoryItem.label}
                        </dt>
                        <dd className="font-semibold">{memoryItem.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              <div className="grid gap-2 border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15">
                <p className="font-mono text-[10px] tracking-[0.12em] text-[#5b5750] uppercase dark:text-[#bbb4aa]">
                  Rotation objective
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {forYouObjectiveOptions.map((option) => (
                    <Button
                      key={option.objective}
                      className="h-auto min-w-36 rounded-none px-3 py-2 text-left"
                      type="button"
                      variant={
                        forYouObjective === option.objective
                          ? "default"
                          : "outline"
                      }
                      onClick={() => applyForYouObjective(option.objective)}
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
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {forYouControlStrip.trainingActions.map((action) => (
                <Button
                  key={action.signals.map((signal) => signal.signal).join(":")}
                  className="h-9 rounded-none px-3 text-xs whitespace-nowrap"
                  disabled={action.active}
                  type="button"
                  variant={action.active ? "default" : "outline"}
                  onClick={() => applyPreferenceProfileAction(action)}
                >
                  {action.actionLabel}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#161616]/25 bg-[#fffdf7] dark:border-[#f4f1ea]/25 dark:bg-[#181818]">
        <div className="container grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs tracking-[0.18em] uppercase">
                  Channel Rail
                </p>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {channelRail.summary}
                </p>
              </div>
              <span className="shrink-0 border border-[#161616]/35 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/35">
                {channelRail.label}
              </span>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {channelRail.channels.length > 0 ? (
                channelRail.channels.map((channel) => {
                  const isForYouChannel = channel.key === "for_you";
                  const isActiveChannel = isForYouChannel
                    ? activeCategory === null
                    : activeCategory === channel.key;

                  return (
                    <Button
                      key={channel.key}
                      className="h-auto min-w-48 rounded-none px-3 py-2 text-left"
                      type="button"
                      variant={isActiveChannel ? "default" : "outline"}
                      onClick={() => {
                        if (isForYouChannel) {
                          setActiveCategory(null);
                          setFeedMode("for_you");
                          return;
                        }

                        setFeedMode("for_you");
                        setActiveCategory((current) =>
                          current === channel.key
                            ? null
                            : isNewsCategoryKey(channel.key)
                              ? channel.key
                              : null,
                        );
                      }}
                    >
                      <span className="grid gap-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-semibold">{channel.label}</span>
                          <span className="font-mono text-[10px] uppercase opacity-70">
                            {channel.statusLabel}
                          </span>
                        </span>
                        <span className="text-xs leading-5 opacity-75">
                          {channel.scoreLabel}
                        </span>
                      </span>
                    </Button>
                  );
                })
              ) : (
                <div className="border-t border-[#161616]/20 pt-3 text-sm text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Channel rail will appear after stories are ranked.
                </div>
              )}
            </div>
          </div>
          <dl className="grid grid-cols-4 border border-[#161616]/35 text-center text-xs dark:border-[#f4f1ea]/35">
            {channelRail.metrics.map((metric) => (
              <div
                key={metric.label}
                className="border-r border-[#161616]/20 p-3 last:border-r-0 dark:border-[#f4f1ea]/15"
              >
                <dt className="font-semibold text-[#5b5750] dark:text-[#bbb4aa]">
                  {metric.label}
                </dt>
                <dd className="mt-1 font-mono text-lg">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-b border-[#161616]/25 dark:border-[#f4f1ea]/25">
        <div className="container grid gap-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.55fr)] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-mono text-xs tracking-[0.18em] uppercase">
                Today&apos;s Briefing
              </p>
              {editionBriefing.lead ? (
                <span className="border border-[#161616]/35 px-2 py-1 text-xs font-semibold text-[#8a241c] dark:border-[#f4f1ea]/35 dark:text-[#ff8b7e]">
                  {editionBriefing.lead.categoryLabel}
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 max-w-4xl text-2xl leading-tight font-black tracking-normal sm:text-3xl">
              {editionBriefing.headline}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
              {editionBriefing.summary}
            </p>
          </div>

          <dl className="grid grid-cols-3 border border-[#161616]/35 text-center dark:border-[#f4f1ea]/35">
            {editionBriefing.metrics.map((metric) => (
              <div
                key={metric.label}
                className="border-r border-[#161616]/20 p-3 last:border-r-0 dark:border-[#f4f1ea]/15"
              >
                <dt className="font-mono text-[11px] tracking-[0.12em] uppercase">
                  {metric.label}
                </dt>
                <dd className="mt-1 text-xl font-black">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="container grid gap-4 pb-6 md:grid-cols-2">
          <BriefingStrip title="Top Topics">
            {editionBriefing.topics.length > 0 ? (
              editionBriefing.topics.map((topic) => (
                <span
                  key={topic.category}
                  className="border border-[#161616]/30 px-2 py-1 dark:border-[#f4f1ea]/30"
                >
                  {topic.label} / {topic.storyCount}
                </span>
              ))
            ) : (
              <span className="text-[#5b5750] dark:text-[#bbb4aa]">
                Waiting for clusters
              </span>
            )}
          </BriefingStrip>
          <BriefingStrip title="Entity Watch">
            {editionBriefing.entities.length > 0 ? (
              editionBriefing.entities.map((entity) => (
                <Link
                  key={entity.entity}
                  className="border border-[#161616]/30 px-2 py-1 hover:underline dark:border-[#f4f1ea]/30"
                  href={`/entities/${encodeURIComponent(entity.entity)}`}
                >
                  {entity.entity} / {entity.storyCount}
                </Link>
              ))
            ) : (
              <span className="text-[#5b5750] dark:text-[#bbb4aa]">
                Waiting for entity signals
              </span>
            )}
          </BriefingStrip>
        </div>

        <div className="container pb-6">
          <section className="border border-[#161616]/35 p-4 dark:border-[#f4f1ea]/35">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Briefing Pack</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {briefingPack.summary}
                </p>
              </div>
              <span className="border border-[#161616]/35 px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]/35">
                {briefingPack.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              {briefingPack.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                >
                  <dt className="text-xs font-semibold text-[#5b5750] dark:text-[#bbb4aa]">
                    {metric.label}
                  </dt>
                  <dd className="mt-1 font-mono text-lg">{metric.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {briefingPack.slots.length > 0 ? (
                briefingPack.slots.map((slot, index) => {
                  const item = rankedItemsById.get(slot.id);
                  const briefingActionInput = item
                    ? {
                        formatCategory: getCategoryLabel,
                        item,
                        slotLabel: slot.label,
                      }
                    : null;
                  const briefingAction = briefingActionInput
                    ? getNewsBriefingPackTrainingAction(briefingActionInput)
                    : null;

                  return (
                    <article
                      key={slot.id}
                      className="grid gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <div className="grid gap-2">
                        <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                          {slot.label} / {slot.scoreLabel}
                        </span>
                        <Link
                          className="leading-5 font-semibold hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                          href={`/news/${slot.id}`}
                        >
                          {slot.title}
                        </Link>
                        <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {slot.sourceName} / {slot.categoryLabel}
                        </span>
                        <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {slot.reason}
                        </span>
                      </div>
                      {item ? (
                        <StoryAction
                          item={item}
                          guardrailItem={selectGuardrailItemForStory(item)}
                          isPreview={isPreview}
                          rankSlot={index + 1}
                          savedItem={selectSavedItemForStory(item)}
                          onAction={recordStoryAction}
                          onRemoveSaved={removeSavedItem}
                          onRestoreGuardrail={restoreGuardrailItem}
                        />
                      ) : null}
                      {briefingActionInput && briefingAction ? (
                        <Button
                          className="h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            applyBriefingPackAction(briefingActionInput)
                          }
                        >
                          {briefingAction.actionLabel}
                        </Button>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Briefing slots will appear after the desk ranks stories.
                </p>
              )}
            </div>
          </section>
          <section className="mt-4 border border-[#161616]/35 bg-[#fffdf7] p-4 dark:border-[#f4f1ea]/35 dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Front Page Layout</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {frontPageLayout.summary}
                </p>
              </div>
              <span className="border border-[#161616]/35 px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]/35">
                {frontPageLayout.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              {frontPageLayout.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                >
                  <dt className="text-xs font-semibold text-[#5b5750] dark:text-[#bbb4aa]">
                    {metric.label}
                  </dt>
                  <dd className="mt-1 font-mono text-lg">{metric.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.75fr))]">
              {frontPageLayout.sections.length > 0 ? (
                frontPageLayout.sections.map((section, index) => {
                  const item = rankedItemsById.get(section.id);
                  const layoutActionInput = item
                    ? {
                        formatCategory: getCategoryLabel,
                        item,
                        sectionLabel: section.label,
                      }
                    : null;
                  const layoutAction = layoutActionInput
                    ? getNewsFrontPageLayoutTrainingAction(layoutActionInput)
                    : null;

                  return (
                    <article
                      key={section.id}
                      className="grid min-h-44 content-start gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <div className="grid gap-2">
                        <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                          {section.label} / {section.treatment}
                        </span>
                        <Link
                          className="leading-5 font-semibold hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                          href={`/news/${section.id}`}
                        >
                          {section.title}
                        </Link>
                        <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {section.sourceName} / {section.categoryLabel} /{" "}
                          {section.scoreLabel}
                        </span>
                        <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {section.reason}
                        </span>
                      </div>
                      {item ? (
                        <StoryAction
                          item={item}
                          guardrailItem={selectGuardrailItemForStory(item)}
                          isPreview={isPreview}
                          rankSlot={index + 1}
                          savedItem={selectSavedItemForStory(item)}
                          onAction={recordStoryAction}
                          onRemoveSaved={removeSavedItem}
                          onRestoreGuardrail={restoreGuardrailItem}
                        />
                      ) : null}
                      {layoutActionInput && layoutAction ? (
                        <Button
                          className="h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            applyFrontPageLayoutAction(layoutActionInput)
                          }
                        >
                          {layoutAction.actionLabel}
                        </Button>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] lg:col-span-4 dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  A1 layout will appear after ranked stories are available.
                </p>
              )}
            </div>
          </section>
          <section className="mt-4 border border-[#161616]/35 bg-[#fffdf7] p-4 dark:border-[#f4f1ea]/35 dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Slot Mix</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {frontPageSlotMix.summary}
                </p>
              </div>
              <span className="border border-[#161616]/35 px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]/35">
                {frontPageSlotMix.label}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {frontPageSlotMix.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                >
                  <dt className="text-xs font-semibold text-[#5b5750] dark:text-[#bbb4aa]">
                    {metric.label}
                  </dt>
                  <dd className="mt-1 font-mono text-lg">{metric.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {frontPageSlotMix.slots.length > 0 ? (
                frontPageSlotMix.slots.map((slot, index) => {
                  const item = rankedItemsById.get(slot.id);
                  const slotMixActionInput = item
                    ? {
                        formatCategory: getCategoryLabel,
                        item,
                        slotKey: slot.key,
                      }
                    : null;
                  const slotMixAction = slotMixActionInput
                    ? getNewsFrontPageSlotMixTrainingAction(slotMixActionInput)
                    : null;

                  return (
                    <article
                      key={`${slot.key}-${slot.id}`}
                      className="grid content-start gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <div className="grid gap-2">
                        <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                          {slot.label} / {slot.treatment}
                        </span>
                        <Link
                          className="leading-5 font-semibold hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                          href={`/news/${slot.id}`}
                        >
                          {slot.title}
                        </Link>
                        <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {slot.sourceName} / {slot.categoryLabel} /{" "}
                          {slot.scoreLabel}
                        </span>
                        <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {slot.reason}
                        </span>
                      </div>
                      {item ? (
                        <StoryAction
                          item={item}
                          guardrailItem={selectGuardrailItemForStory(item)}
                          isPreview={isPreview}
                          rankSlot={index + 1}
                          savedItem={selectSavedItemForStory(item)}
                          onAction={recordStoryAction}
                          onRemoveSaved={removeSavedItem}
                          onRestoreGuardrail={restoreGuardrailItem}
                        />
                      ) : null}
                      {slotMixActionInput && slotMixAction ? (
                        <Button
                          className="h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            applyFrontPageSlotMixAction(slotMixActionInput)
                          }
                        >
                          {slotMixAction.actionLabel}
                        </Button>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] md:col-span-2 xl:col-span-4 dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Slot mix will appear after ranked stories are available.
                </p>
              )}
            </div>
          </section>
        </div>
      </section>

      <section className="container grid gap-6 py-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <div className="grid gap-6">
          {leadStory ? (
            <article className="grid min-h-[420px] grid-cols-[minmax(0,1fr)] border-y border-[#161616] py-6 md:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.7fr)] dark:border-[#f4f1ea]">
              <div className="flex flex-col justify-between gap-8 pr-0 md:pr-6">
                <div>
                  <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold tracking-normal uppercase">
                    <span>{getCategoryLabel(leadStory.category)}</span>
                    <span className="text-[#78746c]">/</span>
                    <span>{leadStory.sourceName}</span>
                    <span className="text-[#78746c]">/</span>
                    <span>{formatNewsTime(leadStory.publishedAt)}</span>
                  </div>
                  <h2 className="max-w-4xl text-4xl leading-[1.03] font-black tracking-normal sm:text-5xl lg:text-6xl">
                    {leadStory.title}
                  </h2>
                  <p className="mt-5 max-w-2xl text-lg leading-8 text-[#4a4a4a] dark:text-[#c8c4ba]">
                    {leadStory.summary}
                  </p>
                  <RecommendationReasons
                    className="mt-5"
                    item={leadStory}
                    mode={feedMode}
                    profile={profile}
                    rankedAt={rankDetailsAt}
                    onTune={applyStoryQuickTuneAction}
                  />
                  <StoryProofStrip className="mt-4" item={leadStory} />
                  <StoryQuickTune
                    className="mt-4"
                    item={leadStory}
                    profile={profile}
                    onTune={applyStoryQuickTuneAction}
                  />
                </div>
                <StoryAction
                  item={leadStory}
                  guardrailItem={selectGuardrailItemForStory(leadStory)}
                  isPreview={isPreview}
                  rankSlot={0}
                  savedItem={selectSavedItemForStory(leadStory)}
                  onAction={recordStoryAction}
                  onRemoveSaved={removeSavedItem}
                  onRestoreGuardrail={restoreGuardrailItem}
                />
              </div>
              <StoryVisual item={leadStory} featured />
            </article>
          ) : null}

          <section className="grid gap-4 md:grid-cols-3">
            {secondaryStories.map((story, index) => (
              <StoryCard
                key={story.id}
                item={story}
                isPreview={isPreview}
                mode={feedMode}
                profile={profile}
                rankSlot={index + 1}
                rankedAt={rankDetailsAt}
                guardrailItem={selectGuardrailItemForStory(story)}
                savedItem={selectSavedItemForStory(story)}
                onTune={applyStoryQuickTuneAction}
                onAction={recordStoryAction}
                onRemoveSaved={removeSavedItem}
                onRestoreGuardrail={restoreGuardrailItem}
              />
            ))}
          </section>

          {sectionFronts.length > 0 ? (
            <section className="border-y border-[#161616]/35 py-5 dark:border-[#f4f1ea]/35">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-xs tracking-[0.18em] uppercase">
                    Section Fronts
                  </p>
                  <h2 className="mt-2 text-2xl font-black">
                    Channel desks from this edition
                  </h2>
                </div>
                <span className="border border-[#161616]/35 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/35">
                  {sectionFronts.length} channels
                </span>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {sectionFronts.map((section) => {
                  const leadItem = section.lead
                    ? rankedItemsById.get(section.lead.id)
                    : undefined;
                  const sectionFrontAction = leadItem
                    ? getNewsSectionFrontTrainingAction({
                        formatCategory: getCategoryLabel,
                        item: leadItem,
                      })
                    : null;

                  return (
                    <article
                      key={section.category}
                      className="grid min-h-56 grid-rows-[auto_1fr_auto] border border-[#161616]/35 bg-[#fffdf7] p-4 dark:border-[#f4f1ea]/35 dark:bg-[#181818]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono text-xs tracking-[0.14em] uppercase">
                            {section.label}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                            {section.summary}
                          </p>
                        </div>
                        <span className="border border-[#161616]/30 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/30">
                          {section.heatScore}
                        </span>
                      </div>
                      {section.lead ? (
                        <div className="mt-5">
                          <div className="text-xs font-semibold tracking-normal text-[#8a241c] uppercase dark:text-[#ff8b7e]">
                            {section.lead.sourceName} /{" "}
                            {formatNewsTime(section.lead.publishedAt)}
                          </div>
                          <h3 className="mt-2 text-2xl leading-tight font-black">
                            {section.lead.title}
                          </h3>
                          {sectionFrontAction && leadItem ? (
                            <Button
                              className="mt-3 h-8 w-fit rounded-none px-2 text-xs"
                              size="sm"
                              type="button"
                              variant="outline"
                              onClick={() =>
                                applySectionFrontAction({
                                  formatCategory: getCategoryLabel,
                                  item: leadItem,
                                })
                              }
                            >
                              {sectionFrontAction.actionLabel}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="mt-4 grid gap-2 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15">
                        <div className="flex justify-between gap-4 font-mono text-xs">
                          <span>{section.storyCount} stories</span>
                          <span>{section.sourceCount} sources</span>
                          <span>heat {section.averageTrendScore}</span>
                        </div>
                        {section.supportingStories.map((story) => (
                          <div
                            key={story.id}
                            className="grid grid-cols-[1fr_auto] gap-3 border-t border-[#161616]/10 pt-2 dark:border-[#f4f1ea]/10"
                          >
                            <span className="leading-5">{story.title}</span>
                            <span className="font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                              {story.personalizedScore}
                            </span>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="border-y border-[#161616]/35 py-5 dark:border-[#f4f1ea]/35">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">Source Clusters</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {sourceClusters.summary}
                </p>
              </div>
              <span className="border border-[#161616]/35 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/35">
                {sourceClusters.label}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 border border-[#161616]/35 text-center sm:grid-cols-4 dark:border-[#f4f1ea]/35">
              {sourceClusters.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="border-r border-[#161616]/20 p-3 last:border-r-0 dark:border-[#f4f1ea]/15"
                >
                  <dt className="text-xs font-semibold text-[#5b5750] dark:text-[#bbb4aa]">
                    {metric.label}
                  </dt>
                  <dd className="mt-1 font-mono text-xl">{metric.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {sourceClusters.clusters.length > 0 ? (
                sourceClusters.clusters.map((cluster, index) => {
                  const leadItem = cluster.lead
                    ? rankedItemsById.get(cluster.lead.id)
                    : undefined;
                  const sourceClusterAction =
                    getNewsSourceClusterTrainingAction(cluster);

                  return (
                    <article
                      key={cluster.key}
                      className="grid min-h-64 grid-rows-[auto_1fr_auto] border border-[#161616]/35 bg-[#fffdf7] p-4 dark:border-[#f4f1ea]/35 dark:bg-[#181818]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono text-xs tracking-[0.14em] uppercase">
                            {cluster.categoryLabel}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                            {cluster.summary}
                          </p>
                        </div>
                        <span className="border border-[#161616]/30 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/30">
                          {cluster.heatScore}
                        </span>
                      </div>
                      {cluster.lead ? (
                        <div className="mt-5">
                          <div className="text-xs font-semibold tracking-normal text-[#8a241c] uppercase dark:text-[#ff8b7e]">
                            {cluster.lead.sourceName} /{" "}
                            {cluster.lead.personalizedScore} score
                          </div>
                          {isPreview ? (
                            <h3 className="mt-2 text-xl leading-tight font-black">
                              {cluster.lead.title}
                            </h3>
                          ) : (
                            <Link
                              className="mt-2 block text-xl leading-tight font-black hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                              href={`/news/${cluster.lead.id}`}
                            >
                              {cluster.lead.title}
                            </Link>
                          )}
                        </div>
                      ) : null}
                      {leadItem ? (
                        <div className="mt-4">
                          <StoryAction
                            item={leadItem}
                            guardrailItem={selectGuardrailItemForStory(
                              leadItem,
                            )}
                            isPreview={isPreview}
                            rankSlot={index + 1}
                            savedItem={selectSavedItemForStory(leadItem)}
                            onAction={recordStoryAction}
                            onRemoveSaved={removeSavedItem}
                            onRestoreGuardrail={restoreGuardrailItem}
                          />
                        </div>
                      ) : null}
                      <Button
                        className="mt-4 h-8 w-fit rounded-none px-2 text-xs"
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => applySourceClusterAction(cluster)}
                      >
                        {sourceClusterAction.actionLabel}
                      </Button>
                      <div className="mt-4 grid gap-2 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15">
                        <div className="flex justify-between gap-4 font-mono text-xs">
                          <span>{cluster.storyCount} stories</span>
                          <span>{cluster.sourceCount} sources</span>
                          <span>{cluster.averageTrustScore} trust</span>
                        </div>
                        {cluster.supportingStories.map((story) => (
                          <div
                            key={story.id}
                            className="grid grid-cols-[1fr_auto] gap-3 border-t border-[#161616]/10 pt-2 dark:border-[#f4f1ea]/10"
                          >
                            {isPreview ? (
                              <span className="leading-5">{story.title}</span>
                            ) : (
                              <Link
                                className="leading-5 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                                href={`/news/${story.id}`}
                              >
                                {story.title}
                              </Link>
                            )}
                            <span className="font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                              {story.sourceScore}
                            </span>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] lg:col-span-3 dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Source clusters will appear after related stories are ranked.
                </p>
              )}
            </div>
          </section>

          <section className="border-y border-[#161616]/35 py-5 dark:border-[#f4f1ea]/35">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">Claim Tracker</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {claimTracker.summary}
                </p>
              </div>
              <span className="border border-[#161616]/35 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/35">
                {claimTracker.label}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 border border-[#161616]/35 text-center sm:grid-cols-4 dark:border-[#f4f1ea]/35">
              {claimTracker.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="border-r border-[#161616]/20 p-3 last:border-r-0 dark:border-[#f4f1ea]/15"
                >
                  <dt className="text-xs font-semibold text-[#5b5750] dark:text-[#bbb4aa]">
                    {metric.label}
                  </dt>
                  <dd className="mt-1 font-mono text-xl">{metric.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {claimTracker.claims.length > 0 ? (
                claimTracker.claims.map((claim, index) => {
                  const leadItem = claim.lead
                    ? rankedItemsById.get(claim.lead.id)
                    : undefined;
                  const claimAction = getNewsClaimTrackerTrainingAction(claim);

                  return (
                    <article
                      key={claim.key}
                      className="grid min-h-72 grid-rows-[auto_1fr_auto] border border-[#161616]/35 bg-[#fffdf7] p-4 dark:border-[#f4f1ea]/35 dark:bg-[#181818]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono text-xs tracking-[0.14em] uppercase">
                            {claim.categoryLabel}
                          </div>
                          <div className="mt-2 text-xs font-semibold tracking-normal text-[#8a241c] uppercase dark:text-[#ff8b7e]">
                            {claim.label}
                          </div>
                        </div>
                        <span className="border border-[#161616]/30 px-2 py-1 text-right font-mono text-xs dark:border-[#f4f1ea]/30">
                          {claim.supportLabel}
                        </span>
                      </div>
                      <div className="mt-5">
                        <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                          {claim.claim}
                        </p>
                        {claim.lead ? (
                          <div className="mt-4">
                            <div className="text-xs font-semibold tracking-normal uppercase">
                              {claim.lead.sourceName} / {claim.confidenceLabel}
                            </div>
                            {isPreview ? (
                              <h3 className="mt-2 text-xl leading-tight font-black">
                                {claim.lead.title}
                              </h3>
                            ) : (
                              <Link
                                className="mt-2 block text-xl leading-tight font-black hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                                href={`/news/${claim.lead.id}`}
                              >
                                {claim.lead.title}
                              </Link>
                            )}
                          </div>
                        ) : null}
                      </div>
                      {leadItem ? (
                        <div className="mt-4">
                          <StoryAction
                            item={leadItem}
                            guardrailItem={selectGuardrailItemForStory(
                              leadItem,
                            )}
                            isPreview={isPreview}
                            rankSlot={index + 1}
                            savedItem={selectSavedItemForStory(leadItem)}
                            onAction={recordStoryAction}
                            onRemoveSaved={removeSavedItem}
                            onRestoreGuardrail={restoreGuardrailItem}
                          />
                        </div>
                      ) : null}
                      {claimAction ? (
                        <Button
                          className="mt-4 h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => applyClaimTrackerAction(claim)}
                        >
                          {claimAction.actionLabel}
                        </Button>
                      ) : null}
                      <div className="mt-4 grid gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15">
                        <div className="flex flex-wrap gap-2">
                          {claim.sourceNames.map((sourceName) => (
                            <span
                              key={sourceName}
                              className="border border-[#161616]/25 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/25"
                            >
                              {sourceName}
                            </span>
                          ))}
                        </div>
                        <div className="grid gap-2">
                          {claim.evidence.map((story) => (
                            <div
                              key={story.id}
                              className="grid gap-1 border-t border-[#161616]/10 pt-2 first:border-t-0 first:pt-0 dark:border-[#f4f1ea]/10"
                            >
                              {isPreview ? (
                                <span className="leading-5">{story.title}</span>
                              ) : (
                                <Link
                                  className="leading-5 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                                  href={`/news/${story.id}`}
                                >
                                  {story.title}
                                </Link>
                              )}
                              <span className="font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                                {story.sourceName} / {story.signalLabel}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] lg:col-span-3 dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Claim tracker will appear after story evidence clusters.
                </p>
              )}
            </div>
          </section>

          <section className="border-y border-[#161616]/35 py-5 dark:border-[#f4f1ea]/35">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">Story Timeline</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {storyTimeline.summary}
                </p>
              </div>
              <span className="border border-[#161616]/35 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/35">
                {storyTimeline.label}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 border border-[#161616]/35 text-center sm:grid-cols-4 dark:border-[#f4f1ea]/35">
              {storyTimeline.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="border-r border-[#161616]/20 p-3 last:border-r-0 dark:border-[#f4f1ea]/15"
                >
                  <dt className="text-xs font-semibold text-[#5b5750] dark:text-[#bbb4aa]">
                    {metric.label}
                  </dt>
                  <dd className="mt-1 font-mono text-xl">{metric.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 grid gap-3">
              {storyTimeline.events.length > 0 ? (
                storyTimeline.events.map((event, index) => {
                  const item = rankedItemsById.get(event.id);
                  const timelineAction =
                    getNewsStoryTimelineTrainingAction(event);

                  return (
                    <article
                      key={event.id}
                      className="grid gap-4 border border-[#161616]/35 bg-[#fffdf7] p-4 md:grid-cols-[auto_1fr_minmax(14rem,auto)] md:items-start dark:border-[#f4f1ea]/35 dark:bg-[#181818]"
                    >
                      <div className="flex items-center gap-3 md:grid md:justify-items-center md:gap-2">
                        <span className="grid h-10 w-10 place-items-center border border-[#161616]/35 font-mono text-sm dark:border-[#f4f1ea]/35">
                          {event.rank}
                        </span>
                        <span className="font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {event.timeLabel}
                        </span>
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-normal uppercase">
                          <span className="text-[#8a241c] dark:text-[#ff8b7e]">
                            {event.signalLabel}
                          </span>
                          <span>{event.categoryLabel}</span>
                          <span className="text-[#5b5750] dark:text-[#bbb4aa]">
                            {event.sourceName}
                          </span>
                        </div>
                        {isPreview ? (
                          <h3 className="mt-2 text-xl leading-tight font-black">
                            {event.title}
                          </h3>
                        ) : (
                          <Link
                            className="mt-2 block text-xl leading-tight font-black hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                            href={`/news/${event.id}`}
                          >
                            {event.title}
                          </Link>
                        )}
                        <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                          {event.reason}
                        </p>
                        <Button
                          className="mt-3 h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => applyStoryTimelineAction(event)}
                        >
                          {timelineAction.actionLabel}
                        </Button>
                      </div>
                      <div className="grid gap-3">
                        <div className="flex flex-wrap gap-2 md:justify-end">
                          <span className="border border-[#161616]/25 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/25">
                            {event.heatLabel}
                          </span>
                          {event.entities.map((entity) => (
                            <Link
                              key={entity}
                              className="border border-[#161616]/25 px-2 py-1 font-mono text-xs text-[#5b5750] hover:bg-[#efe8dc] dark:border-[#f4f1ea]/25 dark:text-[#bbb4aa] dark:hover:bg-[#242424]"
                              href={`/entities/${encodeURIComponent(entity)}`}
                            >
                              {entity}
                            </Link>
                          ))}
                        </div>
                        {item ? (
                          <StoryAction
                            item={item}
                            guardrailItem={selectGuardrailItemForStory(item)}
                            isPreview={isPreview}
                            rankSlot={index + 1}
                            savedItem={selectSavedItemForStory(item)}
                            onAction={recordStoryAction}
                            onRemoveSaved={removeSavedItem}
                            onRestoreGuardrail={restoreGuardrailItem}
                          />
                        ) : null}
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Story timeline will appear after ranked stories are available.
                </p>
              )}
            </div>
          </section>

          {coverageThreads.threads.length > 0 ? (
            <section className="border-y border-[#161616]/35 py-5 dark:border-[#f4f1ea]/35">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-xs tracking-[0.18em] uppercase">
                    Coverage Threads
                  </p>
                  <h2 className="mt-2 text-2xl font-black">
                    Multi-source AI story clusters
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {coverageThreads.summary}
                  </p>
                </div>
                <span className="border border-[#161616]/35 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/35">
                  {coverageThreads.threads.length} threads
                </span>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {coverageThreads.threads.map((thread, index) => {
                  const leadItem = thread.lead
                    ? rankedItemsById.get(thread.lead.id)
                    : undefined;
                  const coverageThreadAction =
                    getNewsCoverageThreadTrainingAction(thread);

                  return thread.lead ? (
                    <article
                      key={thread.entity}
                      className="grid min-h-72 grid-rows-[auto_1fr_auto] border border-[#161616]/35 bg-[#fffdf7] p-4 dark:border-[#f4f1ea]/35 dark:bg-[#181818]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold tracking-normal text-[#8a241c] uppercase dark:text-[#ff8b7e]">
                            {thread.entity}
                          </div>
                          <div className="mt-2 text-xs font-semibold tracking-normal uppercase">
                            {thread.verificationLabel}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                            {thread.summary}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                            {thread.verificationSummary}
                          </p>
                        </div>
                        <span className="border border-[#161616]/30 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/30">
                          {thread.heatScore}
                        </span>
                      </div>
                      <div className="mt-5">
                        <div className="text-xs font-semibold tracking-normal uppercase">
                          {getCategoryLabel(thread.lead.category)} /{" "}
                          {thread.lead.sourceName}
                        </div>
                        {isPreview ? (
                          <h3 className="mt-2 text-xl leading-tight font-black">
                            {thread.lead.title}
                          </h3>
                        ) : (
                          <Link
                            className="mt-2 block text-xl leading-tight font-black hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                            href={`/news/${thread.lead.id}`}
                          >
                            {thread.lead.title}
                          </Link>
                        )}
                      </div>
                      {leadItem ? (
                        <div className="mt-4">
                          <StoryAction
                            item={leadItem}
                            guardrailItem={selectGuardrailItemForStory(
                              leadItem,
                            )}
                            isPreview={isPreview}
                            rankSlot={index + 1}
                            savedItem={selectSavedItemForStory(leadItem)}
                            onAction={recordStoryAction}
                            onRemoveSaved={removeSavedItem}
                            onRestoreGuardrail={restoreGuardrailItem}
                          />
                        </div>
                      ) : null}
                      <Button
                        className="mt-4 h-8 w-fit rounded-none px-2 text-xs"
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => applyCoverageThreadAction(thread)}
                      >
                        {coverageThreadAction.actionLabel}
                      </Button>
                      <div className="mt-4 grid gap-2 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15">
                        <div className="flex justify-between gap-4 font-mono text-xs">
                          <span>{thread.storyCount} stories</span>
                          <span>{thread.sourceCount} sources</span>
                        </div>
                        {thread.supportingStories.map((story) => (
                          <div
                            key={story.id}
                            className="grid grid-cols-[1fr_auto] gap-3 border-t border-[#161616]/10 pt-2 dark:border-[#f4f1ea]/10"
                          >
                            {isPreview ? (
                              <span className="leading-5">{story.title}</span>
                            ) : (
                              <Link
                                className="leading-5 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                                href={`/news/${story.id}`}
                              >
                                {story.title}
                              </Link>
                            )}
                            <span className="font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                              {getCategoryLabel(story.category)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </article>
                  ) : null;
                })}
              </div>
            </section>
          ) : null}

          {consensusBoard.threads.length > 0 ? (
            <section className="border-y border-[#161616]/35 py-5 dark:border-[#f4f1ea]/35">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">Consensus Board</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {consensusBoard.summary}
                  </p>
                </div>
                <span className="border border-[#161616]/35 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/35">
                  {consensusBoard.label}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-3 border border-[#161616]/35 text-center dark:border-[#f4f1ea]/35">
                {consensusBoard.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="border-r border-[#161616]/20 p-3 last:border-r-0 dark:border-[#f4f1ea]/15"
                  >
                    <dt className="text-xs font-semibold text-[#5b5750] dark:text-[#bbb4aa]">
                      {metric.label}
                    </dt>
                    <dd className="mt-1 font-mono text-xl">{metric.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {consensusBoard.threads.map((thread, index) => {
                  const leadStory = thread.stories[0];
                  const leadItem = leadStory
                    ? rankedItemsById.get(leadStory.id)
                    : undefined;
                  const consensusAction =
                    getNewsConsensusThreadTrainingAction(thread);

                  return (
                    <article
                      key={thread.entity}
                      className="grid min-h-64 grid-rows-[auto_1fr_auto] border border-[#161616]/35 bg-[#fffdf7] p-4 dark:border-[#f4f1ea]/35 dark:bg-[#181818]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black">
                            {thread.entity}
                          </div>
                          <div className="mt-2 text-xs font-semibold tracking-normal text-[#8a241c] uppercase dark:text-[#ff8b7e]">
                            {thread.label}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                            {thread.reason}
                          </p>
                        </div>
                        <span className="border border-[#161616]/30 px-2 py-1 text-right font-mono text-xs dark:border-[#f4f1ea]/30">
                          {thread.confidenceLabel}
                        </span>
                      </div>
                      <div className="mt-4 grid content-end gap-2 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15">
                        {thread.stories.map((story) => (
                          <div
                            key={story.id}
                            className="grid gap-1 border-t border-[#161616]/10 pt-2 first:border-t-0 first:pt-0 dark:border-[#f4f1ea]/10"
                          >
                            {isPreview ? (
                              <span className="leading-5">{story.title}</span>
                            ) : (
                              <Link
                                className="leading-5 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                                href={`/news/${story.id}`}
                              >
                                {story.title}
                              </Link>
                            )}
                            <span className="font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                              {story.sourceName}
                            </span>
                          </div>
                        ))}
                      </div>
                      {leadItem ? (
                        <div className="mt-4">
                          <StoryAction
                            item={leadItem}
                            guardrailItem={selectGuardrailItemForStory(
                              leadItem,
                            )}
                            isPreview={isPreview}
                            rankSlot={index + 1}
                            savedItem={selectSavedItemForStory(leadItem)}
                            onAction={recordStoryAction}
                            onRemoveSaved={removeSavedItem}
                            onRestoreGuardrail={restoreGuardrailItem}
                          />
                        </div>
                      ) : null}
                      {consensusAction ? (
                        <Button
                          className="mt-4 h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => applyConsensusThreadAction(thread)}
                        >
                          {consensusAction.actionLabel}
                        </Button>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="divide-y divide-[#161616]/20 border-y border-[#161616]/35 dark:divide-[#f4f1ea]/15 dark:border-[#f4f1ea]/35">
            {streamStories.length > 0 ? (
              streamStories.map((story, index) => (
                <StoryRow
                  key={story.id}
                  item={story}
                  isPreview={isPreview}
                  mode={feedMode}
                  profile={profile}
                  rankSlot={index + 4}
                  rankedAt={rankDetailsAt}
                  guardrailItem={selectGuardrailItemForStory(story)}
                  savedItem={selectSavedItemForStory(story)}
                  onTune={applyStoryQuickTuneAction}
                  onAction={recordStoryAction}
                  onRemoveSaved={removeSavedItem}
                  onRestoreGuardrail={restoreGuardrailItem}
                />
              ))
            ) : (
              <div className="py-8 text-sm text-[#5b5750] dark:text-[#bbb4aa]">
                {hasExploreFilters
                  ? "No matching stories yet. Adjust filters or reset search."
                  : "More stories will appear here as the crawl volume increases."}
              </div>
            )}
          </section>

          {!isPreview ? (
            <div ref={feedEndRef} aria-hidden="true" className="h-px w-full" />
          ) : null}

          {!isPreview ? (
            <div className="flex justify-center border-b border-[#161616]/25 pb-6 dark:border-[#f4f1ea]/25">
              <Button
                className="rounded-none"
                disabled={shouldDisableNewsHomeLoadMoreButton({
                  cursor: nextCursor,
                  feedMode,
                  hasMoreItems,
                  isLoadingMore,
                  visitorKey,
                })}
                type="button"
                variant="outline"
                onClick={() => void loadMoreStories()}
              >
                {isLoadingMore
                  ? "Loading"
                  : hasMoreItems
                    ? "Load more"
                    : "End of feed"}
              </Button>
            </div>
          ) : null}
        </div>

        <aside className="grid content-start gap-6">
          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-black">For You</h2>
                <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {readerSignalSummary.detail}
                </p>
              </div>
              <span className="shrink-0 border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {leadStory?.personalizedScore ?? 0}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15">
                <dt>Saved</dt>
                <dd className="mt-1 font-mono text-lg">{savedItems.length}</dd>
              </div>
              <div className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15">
                <dt>Less</dt>
                <dd className="mt-1 font-mono text-lg">
                  {guardrailItems.length}
                </dd>
              </div>
            </dl>

            <div className="mt-4 grid gap-3">
              {rankedItems.slice(0, 3).map((story, index) => (
                <article
                  className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                  key={story.id}
                >
                  <Link
                    className="leading-5 font-semibold hover:underline"
                    href={`/news/${story.id}`}
                  >
                    {story.title}
                  </Link>
                  <p className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                    {story.sourceName} /{" "}
                    {story.matchedSignals.length > 0
                      ? story.matchedSignals.join(", ")
                      : "Edition signal"}
                  </p>
                  <StoryAction
                    item={story}
                    guardrailItem={selectGuardrailItemForStory(story)}
                    isPreview={isPreview}
                    rankSlot={index + 1}
                    savedItem={selectSavedItemForStory(story)}
                    onAction={recordStoryAction}
                    onRemoveSaved={removeSavedItem}
                    onRestoreGuardrail={restoreGuardrailItem}
                  />
                </article>
              ))}
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Button asChild className="rounded-none" variant="outline">
                <Link href="/reader">Reader Center</Link>
              </Button>
              <Button asChild className="rounded-none" variant="outline">
                <Link href="/reader/library">Library</Link>
              </Button>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function RecommendationReasons({
  item,
  className,
  mode,
  onTune,
  profile,
  rankedAt,
}: {
  item: RankedNewsHomeItem;
  className?: string;
  mode: NewsFeedMode;
  onTune: (action: NewsStoryQuickTuneAction) => void;
  profile: NewsPreferenceProfile;
  rankedAt: Date;
}) {
  const rankDetails = getNewsStoryRankDetails({
    item,
    mode,
    now: rankedAt,
  });
  const recommendationNudge = getNewsRecommendationNudge({
    formatCategory: getCategoryLabel,
    item,
    profile,
  });

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-normal uppercase">
        <span className="text-[#5b5750] dark:text-[#bbb4aa]">Why this</span>
        {rankDetails.badges.map((reason) => (
          <span
            key={reason}
            className="border border-[#161616]/30 px-2 py-1 text-[#8a241c] dark:border-[#f4f1ea]/30 dark:text-[#ff8b7e]"
          >
            {reason}
          </span>
        ))}
      </div>
      <p className="max-w-2xl text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
        {rankDetails.summary}
      </p>
      {recommendationNudge ? (
        <div className="grid gap-2 border-l border-[#8a241c]/45 pl-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center dark:border-[#ff8b7e]/50">
          <p className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
            <span className="font-semibold text-[#161616] dark:text-[#f4f1ea]">
              {recommendationNudge.label}:
            </span>{" "}
            {recommendationNudge.detail}
          </p>
          <Button
            className="h-8 rounded-none px-2 text-xs whitespace-nowrap"
            size="sm"
            type="button"
            variant="outline"
            onClick={() => onTune(recommendationNudge.action)}
          >
            {recommendationNudge.action.actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StoryProofStrip({
  item,
  className,
}: {
  item: RankedNewsHomeItem;
  className?: string;
}) {
  const proofStrip = getNewsStoryProofStrip({ item });

  return (
    <div
      className={cn(
        "border-y border-[#161616]/20 py-3 dark:border-[#f4f1ea]/15",
        className,
      )}
    >
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {proofStrip.metrics.map((metric) => (
          <div key={metric.label} className="grid gap-1">
            <dt className="text-[0.68rem] font-semibold text-[#5b5750] uppercase dark:text-[#bbb4aa]">
              {metric.label}
            </dt>
            <dd className="font-mono text-sm">{metric.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
        {proofStrip.summary}
      </p>
    </div>
  );
}

function StoryQuickTune({
  item,
  className,
  profile,
  onTune,
}: {
  item: RankedNewsHomeItem;
  className?: string;
  profile: NewsPreferenceProfile;
  onTune: (action: NewsStoryQuickTuneAction) => void;
}) {
  const quickTune = getNewsStoryQuickTuneActions({
    formatCategory: getCategoryLabel,
    item,
    profile,
  });

  if (quickTune.actions.length === 0) return null;

  return (
    <div
      className={cn(
        "grid gap-2 border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15",
        className,
      )}
    >
      <div className="grid gap-1">
        <div className="text-xs font-semibold text-[#5b5750] uppercase dark:text-[#bbb4aa]">
          {quickTune.label}
        </div>
        <p className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
          {quickTune.summary}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {quickTune.actions.map((action) => (
          <Button
            key={`${action.kind}-${action.signal}`}
            className="h-auto rounded-none px-2 py-1.5 text-left text-xs whitespace-normal"
            size="sm"
            type="button"
            variant="outline"
            onClick={() => onTune(action)}
          >
            {action.actionLabel}: {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function StoryVisual({
  item,
  featured = false,
}: {
  item: NewsHomeItem;
  featured?: boolean;
}) {
  if (item.imageUrl) {
    return (
      <div
        aria-label={`Visual for ${item.title}`}
        className={cn(
          "aspect-[16/10] min-h-52 w-full max-w-full self-start bg-cover bg-center grayscale",
          featured && "mt-6 md:mt-0",
        )}
        role="img"
        style={{ backgroundImage: `url(${item.imageUrl})` }}
      />
    );
  }

  return (
    <div
      aria-label={`Visual for ${item.title}`}
      className={cn(
        "flex aspect-[16/10] min-h-52 w-full max-w-full items-end justify-between self-start border border-[#161616] bg-[#e8e1d4] p-4 dark:border-[#f4f1ea] dark:bg-[#24211d]",
        featured && "mt-6 md:mt-0",
      )}
      role="img"
    >
      <span className="max-w-[12rem] text-3xl leading-none font-black">
        {getCategoryLabel(item.category)}
      </span>
      <span className="font-mono text-5xl leading-none text-[#8a241c] dark:text-[#ff8b7e]">
        AI
      </span>
    </div>
  );
}

function StoryAction({
  item,
  guardrailItem,
  isPreview,
  rankSlot,
  savedItem,
  onAction,
  onRemoveSaved,
  onRestoreGuardrail,
}: {
  item: RankedNewsHomeItem;
  guardrailItem?: NewsReaderMemoryItem;
  isPreview: boolean;
  rankSlot: number;
  savedItem?: NewsReaderMemoryItem;
  onAction: (
    item: RankedNewsHomeItem,
    action: ReaderInteractionAction,
    rankSlot: number,
  ) => void;
  onRemoveSaved: (item: NewsReaderMemoryItem) => void;
  onRestoreGuardrail: (item: NewsReaderMemoryItem) => void;
}) {
  const sourceUrl = getNewsStorySourceUrl(item);
  const actionPanel = getNewsHomeStoryActionPanel({
    hasSourceUrl: Boolean(sourceUrl),
    isGuardrailed: Boolean(guardrailItem),
    isPreview,
    isSaved: Boolean(savedItem),
  });
  const runAction = (action: NewsHomeStoryActionCommand) => {
    if (action === "remove_saved") {
      onRemoveSaved(
        savedItem ??
          toLocalSavedMemoryItem({
            item,
            savedAt: new Date().toISOString(),
          }),
      );
      return;
    }

    if (action === "restore_guardrail") {
      onRestoreGuardrail(
        guardrailItem ??
          toLocalGuardrailMemoryItem({
            hiddenAt: new Date().toISOString(),
            item,
          }),
      );
      return;
    }

    onAction(item, action, rankSlot);
  };

  return (
    <div className="grid gap-2">
      {actionPanel.helperText ? (
        <p className="max-w-xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
          {actionPanel.helperText}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {actionPanel.actions.map((action) => {
          if (action.type === "read") {
            return (
              <Button key={action.action} asChild className="rounded-none">
                <Link
                  href={`/news/${item.id}`}
                  onClick={() => runAction(action.action)}
                >
                  {action.label}
                </Link>
              </Button>
            );
          }

          if (action.type === "source" && sourceUrl) {
            return (
              <Button
                key={action.action}
                asChild
                className="rounded-none"
                variant="outline"
              >
                <a
                  href={sourceUrl}
                  onClick={() => runAction(action.action)}
                  rel="nofollow noopener noreferrer"
                  target="_blank"
                >
                  {action.label}
                </a>
              </Button>
            );
          }

          return (
            <Button
              key={action.action}
              className="rounded-none"
              type="button"
              variant="outline"
              onClick={() => runAction(action.action)}
            >
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function StoryCard({
  item,
  guardrailItem,
  isPreview,
  mode,
  profile,
  rankSlot,
  rankedAt,
  savedItem,
  onAction,
  onRemoveSaved,
  onRestoreGuardrail,
  onTune,
}: {
  item: RankedNewsHomeItem;
  guardrailItem?: NewsReaderMemoryItem;
  isPreview: boolean;
  mode: NewsFeedMode;
  profile: NewsPreferenceProfile;
  rankSlot: number;
  rankedAt: Date;
  savedItem?: NewsReaderMemoryItem;
  onAction: (
    item: RankedNewsHomeItem,
    action: ReaderInteractionAction,
    rankSlot: number,
  ) => void;
  onRemoveSaved: (item: NewsReaderMemoryItem) => void;
  onRestoreGuardrail: (item: NewsReaderMemoryItem) => void;
  onTune: (action: NewsStoryQuickTuneAction) => void;
}) {
  return (
    <article className="grid grid-cols-[minmax(0,1fr)] gap-3 border border-[#161616]/35 bg-[#fffdf7] p-4 dark:border-[#f4f1ea]/35 dark:bg-[#181818]">
      <StoryVisual item={item} />
      <div className="text-xs font-semibold tracking-normal text-[#8a241c] uppercase dark:text-[#ff8b7e]">
        {getCategoryLabel(item.category)}
      </div>
      <h3 className="text-xl leading-tight font-black">{item.title}</h3>
      <p className="line-clamp-4 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
        {item.summary}
      </p>
      <RecommendationReasons
        item={item}
        mode={mode}
        profile={profile}
        rankedAt={rankedAt}
        onTune={onTune}
      />
      <StoryProofStrip item={item} />
      <StoryQuickTune item={item} profile={profile} onTune={onTune} />
      <StoryAction
        item={item}
        guardrailItem={guardrailItem}
        isPreview={isPreview}
        rankSlot={rankSlot}
        savedItem={savedItem}
        onAction={onAction}
        onRemoveSaved={onRemoveSaved}
        onRestoreGuardrail={onRestoreGuardrail}
      />
    </article>
  );
}

function StoryRow({
  item,
  guardrailItem,
  isPreview,
  mode,
  profile,
  rankSlot,
  rankedAt,
  savedItem,
  onAction,
  onRemoveSaved,
  onRestoreGuardrail,
  onTune,
}: {
  item: RankedNewsHomeItem;
  guardrailItem?: NewsReaderMemoryItem;
  isPreview: boolean;
  mode: NewsFeedMode;
  profile: NewsPreferenceProfile;
  rankSlot: number;
  rankedAt: Date;
  savedItem?: NewsReaderMemoryItem;
  onAction: (
    item: RankedNewsHomeItem,
    action: ReaderInteractionAction,
    rankSlot: number,
  ) => void;
  onRemoveSaved: (item: NewsReaderMemoryItem) => void;
  onRestoreGuardrail: (item: NewsReaderMemoryItem) => void;
  onTune: (action: NewsStoryQuickTuneAction) => void;
}) {
  return (
    <article className="grid gap-4 py-5 md:grid-cols-[1fr_10rem_auto] md:items-start">
      <div>
        <div className="text-xs font-semibold tracking-normal text-[#8a241c] uppercase dark:text-[#ff8b7e]">
          {item.sourceName} / {getCategoryLabel(item.category)}
        </div>
        <h3 className="mt-2 text-2xl leading-tight font-black">{item.title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
          {item.summary}
        </p>
        <RecommendationReasons
          className="mt-3"
          item={item}
          mode={mode}
          profile={profile}
          rankedAt={rankedAt}
          onTune={onTune}
        />
        <StoryProofStrip className="mt-3" item={item} />
        <StoryQuickTune
          className="mt-3"
          item={item}
          profile={profile}
          onTune={onTune}
        />
      </div>
      <div className="font-mono text-sm">
        <div>{formatNewsTime(item.publishedAt)}</div>
        <div className="mt-1 text-[#5b5750] dark:text-[#bbb4aa]">
          Score {item.personalizedScore}
        </div>
      </div>
      <StoryAction
        item={item}
        guardrailItem={guardrailItem}
        isPreview={isPreview}
        rankSlot={rankSlot}
        savedItem={savedItem}
        onAction={onAction}
        onRemoveSaved={onRemoveSaved}
        onRestoreGuardrail={onRestoreGuardrail}
      />
    </article>
  );
}

function BriefingStrip({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[#161616]/20 pt-3 text-xs font-semibold dark:border-[#f4f1ea]/15">
      <span className="font-mono tracking-[0.14em] uppercase">{title}</span>
      {children}
    </div>
  );
}
