"use client";

import type { FormEvent } from "react";
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
import { Button } from "@acme/ui/button";
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
  getNewsStoryQuickTuneActions,
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
  buildNewsHomeFeedInput,
  buildNewsHomeForYouApiRequestBody,
  buildNewsHomeInteractionMetadata,
  buildNewsHomeLoadMoreFeedInput,
  buildNewsHomeReaderInteraction,
  buildNewsHomeSessionIntentFilter,
  createDefaultNewsPreferenceProfile,
  getNewsFeedbackTrainingUpdate,
  getNewsGuardrailRestoreTrainingUpdate,
  getNewsHomeCollaborativeRankingSignals,
  getNewsHomeForYouApiNextRequestResetKey,
  getNewsHomeLoadMoreQueryRoute,
  getNewsHomeLoadMoreState,
  getNewsHomePaginationResetKey,
  getNewsHomePrimaryQueryRoute,
  getNewsHomeStoryActionPanel,
  getNewsHomeStoryHistoryItem,
  getNewsReaderSignalSummary,
  getNewsStorySourceUrl,
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
  shouldFetchNewsHomePrimaryFeed,
  shouldFetchServerRecommendations,
  shouldPersistNewsHomeItemReaderSignals,
  shouldPersistNewsReaderProfile,
  shouldTrainNewsHomeProfileFromAction,
  stripPersistedNewsPreferenceProfile,
  toNewsHomeItemFromPublicFeedItem,
} from "./news-home-model";
import { NewsPublicFrontPageView } from "./news-public-front-page";
import { selectNewsPublicFrontPage } from "./news-public-front-page-model";
import {
  newsGuardrailStorageKey as guardrailStorageKey,
  newsHistoryStorageKey as historyStorageKey,
  newsHomeExposureStorageKey as homeExposureStorageKey,
  readStoredNewsReaderMemoryItems as readStoredMemoryItems,
  readStoredNewsSearchMemoryItems,
  readStoredNewsPositiveFeedbackItems as readStoredPositiveFeedbackItems,
  recordStoredNewsSearchMemoryItem,
  newsRestoredGuardrailStorageKey as restoredGuardrailStorageKey,
  newsSavedStorageKey as savedStorageKey,
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
  generatedAt: string;
  initialItems: NewsHomeItem[];
  status: NewsHomeStatus;
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
  const forYouObjectiveOrder = useMemo(
    () => getNewsForYouObjectiveOrder(forYouObjective),
    [forYouObjective],
  );
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
  const { mutate: recordHomeExposure } = useMutation(
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
  const forYouApiRequestKey = useMemo(
    () => getNewsHomeForYouApiNextRequestResetKey(forYouApiRequestBody),
    [forYouApiRequestBody],
  );
  const forYouApiQuery = useQuery({
    enabled:
      primaryFeedEnabled &&
      primaryFeedRoute === "forYou" &&
      readerStateHydrated &&
      serverReaderMemoryReady,
    queryFn: () => fetchNewsHomeForYouApiPayload(forYouApiRequestBody),
    queryKey: ["news", "for-you-api", forYouApiRequestKey],
  });
  useEffect(() => {
    setForYouApiNextRequest(null);
  }, [forYouApiRequestKey]);
  useEffect(() => {
    if (primaryFeedRoute !== "forYou" || !forYouApiQuery.data) return;

    applyForYouApiExposureMemory(
      forYouApiQuery.data.nextRequest?.recentExposureItems,
    );
    setForYouApiNextRequest(forYouApiQuery.data.nextRequest ?? null);
    setHasMoreItems(forYouApiQuery.data.hasMore);
  }, [applyForYouApiExposureMemory, forYouApiQuery.data, primaryFeedRoute]);
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

  const applyExploreSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedSearchDraft = searchDraft.trim();

    if (!trimmedSearchDraft) return;

    setReviewHiddenAngleQuery("");
    setSearchQuery(trimmedSearchDraft);
    recordHomeSearchIntent({
      query: trimmedSearchDraft,
      resultCount: items.length,
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
      records.forEach((record) => recordHomeExposure(record));
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

  const publicFrontPage = useMemo(
    () => selectNewsPublicFrontPage(rankedItems),
    [rankedItems],
  );
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

  return (
    <NewsPublicFrontPageView
      feedEndRef={feedEndRef}
      feedMode={feedMode}
      formatCategory={getCategoryLabel}
      frontPage={publicFrontPage}
      generatedAt={generatedAt}
      hasExploreFilters={hasExploreFilters}
      hasMoreItems={hasMoreItems}
      isLoadingMore={isLoadingMore}
      isPreview={isPreview}
      lessCount={guardrailItems.length}
      loadMoreDisabled={shouldDisableNewsHomeLoadMoreButton({
        cursor: nextCursor,
        feedMode,
        hasMoreItems,
        isLoadingMore,
        visitorKey,
      })}
      readerSummary={readerSignalSummary.detail}
      savedCount={savedItems.length}
      searchDraft={searchDraft}
      onClearSearch={clearExploreFilters}
      onFeedModeChange={setFeedMode}
      onLoadMore={() => void loadMoreStories()}
      onSearchDraftChange={setSearchDraft}
      onSearchSubmit={applyExploreSearch}
      renderStoryActions={(item, rankSlot) => (
        <StoryAction
          guardrailItem={selectGuardrailItemForStory(item)}
          isPreview={isPreview}
          item={item}
          rankSlot={rankSlot}
          savedItem={selectSavedItemForStory(item)}
          onAction={recordStoryAction}
          onRemoveSaved={removeSavedItem}
          onRestoreGuardrail={restoreGuardrailItem}
        />
      )}
    />
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
              <Button
                key={action.action}
                asChild
                className="rounded-none bg-[#8b1e18] text-white hover:bg-[#6f1712] dark:bg-[#9f2a22] dark:hover:bg-[#b3342a]"
              >
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
