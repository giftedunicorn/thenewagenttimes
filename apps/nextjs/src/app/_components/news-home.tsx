"use client";

import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  NewsPreferenceProfile,
  RankedNewsItem,
  ReaderInteractionAction,
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
  selectPositiveFeedbackAnchoredNewsFeed,
  selectSourceTrustBalancedNewsFeed,
  updateReaderProfileWithInteraction,
} from "@acme/validators";

import type {
  NewsDeskStatus,
  NewsFeedMode,
  NewsHomeItem,
  NewsHomeStatus,
  NewsReaderMemoryItem,
} from "./news-home-model";
import { useTRPC } from "~/trpc/react";
import {
  buildNewsHomeFeedInput,
  buildNewsHomeInteractionMetadata,
  buildNewsHomeReaderInteraction,
  createDefaultNewsPreferenceProfile,
  getNewsAggregationIntake,
  getNewsAlertRouting,
  getNewsBriefingPack,
  getNewsChannelComparison,
  getNewsChannelRail,
  getNewsChannelStrategy,
  getNewsClaimTracker,
  getNewsCollaborativeSignals,
  getNewsConsensusBoard,
  getNewsContinuationRail,
  getNewsCoverageThreads,
  getNewsDeskStatusSummary,
  getNewsDiscoveryLadder,
  getNewsDistributionQueue,
  getNewsEditionBriefing,
  getNewsEditionMix,
  getNewsEditionQualityGate,
  getNewsEditionSchedule,
  getNewsEditorialGuardrails,
  getNewsEntityRadar,
  getNewsExperimentAllocation,
  getNewsExplorationSlots,
  getNewsFeedbackCoach,
  getNewsFeedbackTrainingUpdate,
  getNewsFeedFatigueReport,
  getNewsFeedGovernor,
  getNewsFeedRecipe,
  getNewsFilterBubbleReport,
  getNewsFrontPageLayout,
  getNewsFrontPageSlotMix,
  getNewsHomeReaderMemoryResetCacheScopes,
  getNewsHotBoard,
  getNewsInterestDrift,
  getNewsInterestGraph,
  getNewsLiveWire,
  getNewsMissedCoverageShelf,
  getNewsNextRefreshPlan,
  getNewsPersonalizationMix,
  getNewsPersonalizedPushQueue,
  getNewsPersonalizedReadingQueue,
  getNewsPreferenceControlPanel,
  getNewsPreferencePresets,
  getNewsPreferenceStarter,
  getNewsPreferenceTuningPlan,
  getNewsProductionReadinessChecklist,
  getNewsProfileImpactPreview,
  getNewsProfileSignalLedger,
  getNewsRankingPipeline,
  getNewsReaderCohorts,
  getNewsReaderDaypartPlan,
  getNewsReaderDigest,
  getNewsReaderJourneyMap,
  getNewsReaderLearningLoop,
  getNewsReaderMemory,
  getNewsReaderMemoryResetPersistence,
  getNewsReaderMemoryResetTrainingUpdate,
  getNewsReaderRankingFactors,
  getNewsReaderScorecards,
  getNewsReaderSignalSummary,
  getNewsReaderWatchlist,
  getNewsRecommendationAudit,
  getNewsRecommendationTrace,
  getNewsRefreshSimulation,
  getNewsSearchTrends,
  getNewsSectionFronts,
  getNewsServerProfileAuditDisplay,
  getNewsSessionIntent,
  getNewsSourceBalance,
  getNewsSourceClusters,
  getNewsSourceTrustLedger,
  getNewsStoryRankDetails,
  getNewsStoryTimeline,
  getNewsTasteCalibration,
  getNewsTopicMatchMatrix,
  getNewsTopicPulse,
  getNextNewsHomeCursor,
  getPreviewNewsHomeItems,
  mergeNewsHomeItems,
  mergeNewsReaderMemoryItems,
  selectFeedFatigueBalancedNewsHomeItems,
  selectHydratedNewsPreferenceProfile,
  selectNegativeFeedbackAdjustedNewsHomeItems,
  selectNewsFeedModeItems,
  selectNewsHomeExposureRecords,
  selectNewsHomeItems,
  selectNewsHomePositiveFeedbackAnchors,
  selectReaderFreshNewsHomeItems,
  selectSessionIntentNewsHomeItems,
  selectSourceCorroboratedNewsHomeItems,
  selectStoredNewsReaderMemoryItems,
  selectVisibleNewsHomeItems,
  shouldAutoLoadMoreNewsHomeItems,
  shouldFetchServerRecommendations,
  shouldTrainNewsHomeProfileFromAction,
  stripPersistedNewsPreferenceProfile,
} from "./news-home-model";

type RankedNewsHomeItem = RankedNewsItem<NewsHomeItem>;
type PositiveNewsHomeFeedbackItem = NewsHomeItem & {
  action: Extract<ReaderInteractionAction, "click_source" | "save" | "share">;
  occurredAt: string;
};

interface NewsHomeProps {
  initialItems: NewsHomeItem[];
  deskStatus: NewsDeskStatus;
  refreshConfigured: boolean;
  status: NewsHomeStatus;
  generatedAt: string;
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

const getCategoryLabel = (category: string) =>
  isNewsCategoryKey(category) ? categoryLabels[category] : category;

const profileStorageKey = "new-ai-times-profile";
const savedStorageKey = "new-ai-times-saved";
const historyStorageKey = "new-ai-times-history";
const guardrailStorageKey = "new-ai-times-guardrails";
const visitorStorageKey = "new-ai-times-visitor-key";
const previewItems = getPreviewNewsHomeItems();

const readStoredProfile = (): NewsPreferenceProfile => {
  const defaultProfile = createDefaultNewsPreferenceProfile();

  if (typeof window === "undefined") return defaultProfile;

  const stored = window.localStorage.getItem(profileStorageKey);
  if (!stored) return defaultProfile;

  try {
    const parsed = JSON.parse(stored) as Partial<NewsPreferenceProfile>;
    return normalizeNewsPreferenceProfile({
      preferredCategories: Array.isArray(parsed.preferredCategories)
        ? parsed.preferredCategories.filter(
            (value): value is string => typeof value === "string",
          )
        : defaultProfile.preferredCategories,
      preferredSources: Array.isArray(parsed.preferredSources)
        ? parsed.preferredSources.filter(
            (value): value is string => typeof value === "string",
          )
        : defaultProfile.preferredSources,
      preferredEntities: Array.isArray(parsed.preferredEntities)
        ? parsed.preferredEntities.filter(
            (value): value is string => typeof value === "string",
          )
        : defaultProfile.preferredEntities,
      noveltyBias:
        typeof parsed.noveltyBias === "number"
          ? parsed.noveltyBias
          : defaultProfile.noveltyBias,
      recencyBias:
        typeof parsed.recencyBias === "number"
          ? parsed.recencyBias
          : defaultProfile.recencyBias,
    });
  } catch {
    return defaultProfile;
  }
};

const writeStoredProfile = (profile: NewsPreferenceProfile) => {
  window.localStorage.setItem(
    profileStorageKey,
    JSON.stringify(normalizeNewsPreferenceProfile(profile)),
  );
};

const readStoredMemoryItems = (storageKey: string): NewsReaderMemoryItem[] => {
  if (typeof window === "undefined") return [];

  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return [];

  try {
    return selectStoredNewsReaderMemoryItems(JSON.parse(stored) as unknown);
  } catch {
    return [];
  }
};

const writeStoredMemoryItems = (
  storageKey: string,
  items: readonly NewsReaderMemoryItem[],
) => {
  window.localStorage.setItem(storageKey, JSON.stringify(items));
};

const clearStoredMemoryItems = (storageKey: string) => {
  window.localStorage.removeItem(storageKey);
};

const toLocalSavedMemoryItem = ({
  item,
  savedAt,
}: {
  item: NewsHomeItem;
  savedAt: string;
}): NewsReaderMemoryItem => ({
  category: item.category,
  entities: [...item.entities],
  id: item.id,
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
  category: item.category,
  entities: [...item.entities],
  hiddenAt,
  id: item.id,
  occurredAt: hiddenAt,
  sourceName: item.sourceName,
  sourceSlug: item.sourceSlug,
  tags: [...item.tags],
  title: item.title,
});

const readStoredHistoryItems = () => readStoredMemoryItems(historyStorageKey);

const readStoredSavedItems = () => readStoredMemoryItems(savedStorageKey);

const readStoredGuardrailItems = () =>
  readStoredMemoryItems(guardrailStorageKey);

const clearReaderMemoryStorage = () => {
  clearStoredMemoryItems(guardrailStorageKey);
  clearStoredMemoryItems(historyStorageKey);
  clearStoredMemoryItems(savedStorageKey);
};

const readOrCreateVisitorKey = () => {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(visitorStorageKey);
  if (stored) return stored;

  const next =
    typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(visitorStorageKey, next);
  return next;
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

const formatEditionDate = (date: string) =>
  new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));

const formatTime = (date: string) =>
  new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));

const numberFormatter = new Intl.NumberFormat("en");

const formatCount = (value: number) => numberFormatter.format(value);

const formatOptionalTime = (date: string | null) =>
  date ? formatTime(date) : "None yet";

const formatLastRun = (run: NewsDeskStatus["latestRun"]) => {
  if (!run) return "No run yet";

  return `${run.sourceName ?? run.runType} ${run.status}`;
};

const formatRunYield = (run: NewsDeskStatus["latestRun"]) => {
  if (!run) return "No items yet";

  return `${formatCount(run.itemsCreated)} new, ${formatCount(run.itemsUpdated)} updated`;
};

const toggleValue = (values: readonly string[], value: string) =>
  values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];

const addValue = (values: readonly string[], value: string) =>
  values.includes(value) ? [...values] : [...values, value];

const addValues = (values: readonly string[], nextValues: readonly string[]) =>
  nextValues.reduce(
    (currentValues, value) => addValue(currentValues, value),
    [...values],
  );

const removeValue = (values: readonly string[], value: string) =>
  values.filter((item) => item !== value);

const increaseProfileBias = (value: number) =>
  Math.min(Math.round((value + 0.5) * 10) / 10, 2);

const decreaseProfileBias = (value: number) =>
  Math.max(Math.round((value - 0.5) * 10) / 10, 0);

const getUniqueValues = (items: readonly NewsHomeItem[], key: "sourceSlug") =>
  Array.from(new Set(items.map((item) => item[key]))).slice(0, 8);

const getTopEntities = (items: readonly NewsHomeItem[]) =>
  Array.from(new Set(items.flatMap((item) => item.entities))).slice(0, 10);

const getTopTags = (items: readonly NewsHomeItem[]) => {
  const entries = new Map<
    string,
    { count: number; firstIndex: number; label: string }
  >();

  items.forEach((item, itemIndex) => {
    item.tags.forEach((tag) => {
      const label = tag.trim();
      const key = label.toLowerCase();

      if (!key || !label) return;

      const existing = entries.get(key);

      if (!existing) {
        entries.set(key, { count: 1, firstIndex: itemIndex, label });
        return;
      }

      existing.count += 1;
    });
  });

  return Array.from(entries.values())
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      if (left.firstIndex !== right.firstIndex) {
        return left.firstIndex - right.firstIndex;
      }
      return left.label.localeCompare(right.label);
    })
    .map((entry) => entry.label)
    .slice(0, 10);
};

export function NewsHome({
  initialItems,
  deskStatus,
  refreshConfigured,
  status,
  generatedAt,
}: NewsHomeProps) {
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
  const [localHistoryItems, setLocalHistoryItems] = useState<
    NewsReaderMemoryItem[]
  >([]);
  const [localGuardrailItems, setLocalGuardrailItems] = useState<
    NewsReaderMemoryItem[]
  >([]);
  const [loadedItems, setLoadedItems] = useState<NewsHomeItem[]>([]);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [feedMode, setFeedMode] = useState<NewsFeedMode>("for_you");
  const [trainingUpdate, setTrainingUpdate] = useState<ReturnType<
    typeof getNewsFeedbackTrainingUpdate
  > | null>(null);
  const [activeCategory, setActiveCategory] = useState<NewsCategoryKey | null>(
    null,
  );
  const [activeSourceSlug, setActiveSourceSlug] = useState<string | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const isLoadingMoreRef = useRef(false);
  const recordedHomeExposureItemsRef = useRef<NewsHomeItem[]>([]);
  const fallbackItems = initialItems.length > 0 ? initialItems : previewItems;
  const canPersistProfile = status !== "unavailable";
  const hasExploreFilters = Boolean(
    activeCategory ?? activeSourceSlug ?? searchQuery.trim(),
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
  const forYouQuery = useQuery(
    trpc.news.forYou.queryOptions(
      buildNewsHomeFeedInput({
        category: activeCategory,
        cursor: null,
        limit: 30,
        q: searchQuery,
        readerLocalHour,
        sourceSlug: activeSourceSlug,
        visitorKey,
      }),
      {
        enabled: shouldFetchServerRecommendations({ status, visitorKey }),
      },
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
  const resetReaderMemory = useMutation(
    trpc.news.resetProfile.mutationOptions({
      onError: () => {
        setTrainingUpdate(
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
        const nextProfile = stripPersistedNewsPreferenceProfile(serverProfile);
        setProfile(nextProfile);
        setHiddenItemIds([]);
        setLocalGuardrailItems([]);
        setLocalHistoryItems([]);
        setLocalSavedItems([]);
        setNegativeFeedbackItems([]);
        setPositiveFeedbackItems([]);
        writeStoredProfile(nextProfile);
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
        const nextProfile = stripPersistedNewsPreferenceProfile(serverProfile);
        setProfile(nextProfile);
        writeStoredProfile(nextProfile);
        await Promise.all([
          queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
          queryClient.invalidateQueries(trpc.news.profile.pathFilter()),
          queryClient.invalidateQueries(trpc.news.saved.pathFilter()),
          queryClient.invalidateQueries(trpc.news.history.pathFilter()),
        ]);
      },
    }),
  );
  const recordHomeExposure = useMutation(
    trpc.news.recordInteraction.mutationOptions(),
  );
  const serverRecommendedItems = forYouQuery.data;
  const initialFeedItems = hasExploreFilters ? [] : fallbackItems;
  const baseItems = selectNewsHomeItems({
    initialItems: initialFeedItems,
    serverRecommendedItems,
  });
  const items = selectVisibleNewsHomeItems({
    hiddenItemIds,
    hiddenItems: negativeFeedbackItems,
    items: mergeNewsHomeItems({
      currentItems: baseItems,
      nextItems: loadedItems,
    }),
  });
  const isPreview =
    !hasExploreFilters &&
    initialItems.length === 0 &&
    !serverRecommendedItems?.length;
  const nextCursor = getNextNewsHomeCursor(items);
  const deskStatusSummary = getNewsDeskStatusSummary(deskStatus);
  const readinessChecklist = getNewsProductionReadinessChecklist({
    refreshConfigured,
    status: deskStatus,
  });

  useEffect(() => {
    const storedGuardrails = readStoredGuardrailItems();

    setProfile(readStoredProfile());
    setLocalHistoryItems(readStoredHistoryItems());
    setLocalSavedItems(readStoredSavedItems());
    setLocalGuardrailItems(storedGuardrails);
    setHiddenItemIds(storedGuardrails.map((item) => item.id));
    setVisitorKey(readOrCreateVisitorKey());
    setReaderLocalHour(new Date().getHours());
    setReaderStateHydrated(true);
  }, []);

  useEffect(() => {
    if (!readerStateHydrated) return;

    writeStoredProfile(profile);
  }, [profile, readerStateHydrated]);

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
    setLoadedItems([]);
    setHasMoreItems(true);
  }, [activeCategory, activeSourceSlug, searchQuery]);

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
      setTrainingUpdate(
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

    if (action === "hide") {
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

      setPositiveFeedbackItems((current) =>
        current.some((feedbackItem) => feedbackItem.id === item.id)
          ? current
          : [...current, { ...item, action, occurredAt }],
      );
    }

    if (visitorKey && canPersistProfile && !isPreview) {
      recordInteraction.mutate({
        visitorKey,
        newsItemId: item.id,
        action,
        metadata: buildNewsHomeInteractionMetadata({
          feedMode,
          item,
          rankSlot,
        }),
      });
    }
  };

  const applyExploreSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchQuery(searchDraft.trim());
  };

  const clearExploreFilters = () => {
    setActiveCategory(null);
    setActiveSourceSlug(null);
    setSearchDraft("");
    setSearchQuery("");
  };

  const resetProfile = () => {
    const nextProfile = createDefaultNewsPreferenceProfile();

    setProfile(nextProfile);
    writeStoredProfile(nextProfile);
    setHiddenItemIds([]);
    setLocalGuardrailItems([]);
    setLocalHistoryItems([]);
    setLocalSavedItems([]);
    setNegativeFeedbackItems([]);
    setPositiveFeedbackItems([]);
    clearReaderMemoryStorage();
    setTrainingUpdate(
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

  const loadMoreStories = useCallback(async () => {
    const cursor = nextCursor;

    if (!cursor || !visitorKey) return;

    if (
      !shouldAutoLoadMoreNewsHomeItems({
        cursor,
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
      const nextItems = await queryClient.fetchQuery(
        trpc.news.forYou.queryOptions(
          buildNewsHomeFeedInput({
            category: activeCategory,
            cursor,
            limit: 20,
            q: searchQuery,
            readerLocalHour,
            sourceSlug: activeSourceSlug,
            visitorKey,
          }),
        ),
      );

      setLoadedItems((current) =>
        mergeNewsHomeItems({
          currentItems: current,
          nextItems,
        }),
      );
      setHasMoreItems(nextItems.length > 0);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [
    activeCategory,
    activeSourceSlug,
    hasMoreItems,
    isPreview,
    nextCursor,
    queryClient,
    readerLocalHour,
    searchQuery,
    trpc.news.forYou,
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
  }, [hasMoreItems, isPreview, loadMoreStories, nextCursor, visitorKey]);

  const serverSavedItems = useMemo(
    () => savedQuery.data ?? [],
    [savedQuery.data],
  );
  const savedItems = useMemo(
    () =>
      mergeNewsReaderMemoryItems({
        localItems: localSavedItems,
        serverItems: serverSavedItems,
      }),
    [localSavedItems, serverSavedItems],
  );
  const serverHistoryItems = useMemo(
    () => historyQuery.data ?? [],
    [historyQuery.data],
  );
  const historyItems = useMemo(
    () =>
      mergeNewsReaderMemoryItems({
        localItems: localHistoryItems,
        serverItems: serverHistoryItems,
      }),
    [localHistoryItems, serverHistoryItems],
  );
  const negativeFeedbackMemoryItems = useMemo(
    () =>
      mergeNewsReaderMemoryItems({
        localItems: localGuardrailItems,
        serverItems: negativeFeedbackItems,
      }),
    [localGuardrailItems, negativeFeedbackItems],
  );
  const positiveFeedbackAnchors = useMemo(
    () =>
      selectNewsHomePositiveFeedbackAnchors({
        explicitFeedbackItems: positiveFeedbackItems,
        historyItems,
        savedItems,
      }),
    [historyItems, positiveFeedbackItems, savedItems],
  );
  const personalizedItems = useMemo(
    () =>
      selectDiverseNewsFeed(
        rankNewsForReader(dedupeNewsItems(items), profile),
        {
          explorationInterval: getNewsExplorationInterval(profile),
          limit: items.length,
        },
      ),
    [items, profile],
  );
  const rankedItems = useMemo(() => {
    const modeItems = selectNewsFeedModeItems({
      items: personalizedItems,
      mode: feedMode,
    });
    const sessionIntentItems =
      feedMode === "for_you"
        ? selectSessionIntentNewsHomeItems({
            intent: {
              category: activeCategory,
              query: searchQuery,
              sourceSlug: activeSourceSlug,
            },
            items: modeItems,
          })
        : modeItems;
    const exposureBalancedItems = selectExposureBalancedNewsFeed(
      sessionIntentItems,
      historyItems,
    );
    const positiveAnchoredItems = selectPositiveFeedbackAnchoredNewsFeed(
      exposureBalancedItems,
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
    const fatigueBalancedItems = selectFeedFatigueBalancedNewsHomeItems({
      items: sourceCorroboratedItems,
    });
    const breakingPriorityItems = selectBreakingNewsPriorityFeed(
      fatigueBalancedItems,
      new Date(generatedAt),
    );
    const discoverySlotItems = selectDiscoverySlotNewsFeed(
      breakingPriorityItems,
    );

    return selectReaderFreshNewsHomeItems({
      historyItems,
      items: discoverySlotItems,
    });
  }, [
    activeCategory,
    activeSourceSlug,
    feedMode,
    generatedAt,
    historyItems,
    negativeFeedbackMemoryItems,
    personalizedItems,
    positiveFeedbackAnchors,
    searchQuery,
  ]);

  useEffect(() => {
    if (!canPersistProfile) return;

    const records = selectNewsHomeExposureRecords({
      feedMode,
      isPreview,
      items: rankedItems,
      limit: 6,
      recordedItems: recordedHomeExposureItemsRef.current,
      visitorKey,
    });

    if (records.length === 0) return;

    const exposedIds = new Set(records.map((record) => record.newsItemId));
    recordedHomeExposureItemsRef.current = mergeNewsHomeItems({
      currentItems: recordedHomeExposureItemsRef.current,
      nextItems: rankedItems.filter((item) => exposedIds.has(item.id)),
    });

    records.forEach((record) => recordHomeExposure.mutate(record));
  }, [
    canPersistProfile,
    feedMode,
    isPreview,
    rankedItems,
    recordHomeExposure,
    visitorKey,
  ]);

  const leadStory = rankedItems[0];
  const secondaryStories = rankedItems.slice(1, 4);
  const streamStories = rankedItems.slice(4);
  const defaultCategories = Object.keys(categoryLabels) as NewsCategoryKey[];
  const availableCategories = Array.from(
    new Set([
      ...defaultCategories.slice(0, 9),
      ...items.map((item) => item.category).filter(isNewsCategoryKey),
    ]),
  );
  const availableSources = getUniqueValues(items, "sourceSlug");
  const sourceFilterOptions = Array.from(
    new Set([...fallbackItems, ...items].map((item) => item.sourceSlug)),
  ).slice(0, 8);
  const availableEntities = getTopEntities(items);
  const availableTags = getTopTags(items);
  const readerMemory = getNewsReaderMemory({
    formatCategory: getCategoryLabel,
    historyItems,
    profile,
    savedItems,
  });
  const readerJourneyMap = getNewsReaderJourneyMap({
    formatCategory: getCategoryLabel,
    historyItems,
    items: rankedItems,
    limit: 5,
    negativeFeedbackItems,
    profile,
    savedItems,
  });
  const readerLearningLoop = getNewsReaderLearningLoop({
    formatCategory: getCategoryLabel,
    historyItems,
    items: rankedItems,
    negativeFeedbackItems,
    profile,
    savedItems,
  });
  const serverProfileAudit = getNewsServerProfileAuditDisplay(
    profileQuery.data?.audit,
  );
  const readerWatchlist = getNewsReaderWatchlist({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 4,
    profile,
  });
  const readerCohorts = getNewsReaderCohorts({
    formatCategory: getCategoryLabel,
    historyItems,
    limit: 3,
    negativeFeedbackItems,
    profile,
    savedItems,
  });
  const collaborativeSignals = getNewsCollaborativeSignals({
    formatCategory: getCategoryLabel,
    historyItems,
    items: rankedItems,
    limit: 2,
    negativeFeedbackItems,
    profile,
    savedItems,
  });
  const sessionIntent = getNewsSessionIntent({
    formatCategory: getCategoryLabel,
    historyItems,
    items: rankedItems,
    limit: 3,
    negativeFeedbackItems,
    profile,
    savedItems,
  });
  const profileSignalLedger = getNewsProfileSignalLedger({
    formatCategory: getCategoryLabel,
    historyItems,
    negativeFeedbackItems,
    profile,
    savedItems,
  });
  const interestDrift = getNewsInterestDrift({
    formatCategory: getCategoryLabel,
    historyItems,
    negativeFeedbackItems,
    profile,
    savedItems,
  });
  const readerSignalSummary = getNewsReaderSignalSummary(profile);
  const readerRankingFactors = getNewsReaderRankingFactors(profile);
  const readerDigest = getNewsReaderDigest({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    profile,
  });
  const readerDaypartPlan = getNewsReaderDaypartPlan({
    formatCategory: getCategoryLabel,
    generatedAt,
    items: rankedItems,
    profile,
  });
  const readerScorecards = getNewsReaderScorecards({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 2,
    now: new Date(generatedAt),
    profile,
  });
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
  const editionQualityGate = getNewsEditionQualityGate({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    negativeFeedbackItems,
    profile,
  });
  const recommendationAudit = getNewsRecommendationAudit({
    items: rankedItems,
    profile,
  });
  const recommendationTrace = getNewsRecommendationTrace({
    formatCategory: getCategoryLabel,
    historyItems,
    items: rankedItems,
    limit: 4,
    negativeFeedbackItems,
    profile,
  });
  const editorialGuardrails = getNewsEditorialGuardrails({
    items: rankedItems,
    limit: 2,
    negativeFeedbackItems,
  });
  const feedRecipe = getNewsFeedRecipe({
    items: rankedItems,
    profile,
    storiesPerSlice: 2,
  });
  const rankingPipeline = getNewsRankingPipeline({
    historyItems,
    items: rankedItems,
    negativeFeedbackItems,
    profile,
    savedItems,
  });
  const explorationSlots = getNewsExplorationSlots({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 3,
    negativeFeedbackItems,
    profile,
  });
  const discoveryLadder = getNewsDiscoveryLadder({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 4,
    profile,
  });
  const channelComparison = getNewsChannelComparison({
    items: rankedItems,
    limit: 3,
  });
  const channelRail = getNewsChannelRail({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 5,
    profile,
  });
  const nextRefreshPlan = getNewsNextRefreshPlan({
    formatCategory: getCategoryLabel,
    historyItems,
    items: rankedItems,
    limit: 3,
    negativeFeedbackItems,
    savedItems,
  });
  const refreshSimulation = getNewsRefreshSimulation({
    formatCategory: getCategoryLabel,
    historyItems,
    items: rankedItems,
    limit: 4,
    negativeFeedbackItems,
    profile,
    savedItems,
  });
  const experimentAllocation = getNewsExperimentAllocation({
    formatCategory: getCategoryLabel,
    historyItems,
    items: rankedItems,
    negativeFeedbackItems,
    profile,
    savedItems,
  });
  const personalizationMix = getNewsPersonalizationMix({
    items: rankedItems,
    profile,
  });
  const channelStrategy = getNewsChannelStrategy({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    profile,
  });
  const feedbackCoach = getNewsFeedbackCoach({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    profile,
  });
  const feedGovernor = getNewsFeedGovernor({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    profile,
  });
  const distributionQueue = getNewsDistributionQueue({
    hiddenItemIds,
    items: rankedItems,
    limit: 2,
    negativeFeedbackItems,
  });
  const alertRouting = getNewsAlertRouting({
    hiddenItemIds,
    items: rankedItems,
    limit: 2,
    negativeFeedbackItems,
  });
  const personalizedPushQueue = getNewsPersonalizedPushQueue({
    formatCategory: getCategoryLabel,
    hiddenItemIds,
    historyItems,
    items: rankedItems,
    limit: 2,
    negativeFeedbackItems,
    profile,
    savedItems,
  });
  const fatigueReport = getNewsFeedFatigueReport({ items: rankedItems });
  const preferenceStarter = getNewsPreferenceStarter({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    profile,
  });
  const preferenceControlPanel = getNewsPreferenceControlPanel({
    formatCategory: getCategoryLabel,
    profile,
  });
  const preferencePresets = getNewsPreferencePresets({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 3,
    profile,
  });
  const preferenceTuningPlan = getNewsPreferenceTuningPlan({
    formatCategory: getCategoryLabel,
    historyItems,
    items: rankedItems,
    limit: 4,
    negativeFeedbackItems,
    profile,
    savedItems,
  });
  const profileImpactPreview = getNewsProfileImpactPreview({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 2,
    negativeFeedbackItems,
    profile,
  });
  const filterBubbleReport = getNewsFilterBubbleReport({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    profile,
  });
  const tasteCalibration = getNewsTasteCalibration({
    formatCategory: getCategoryLabel,
    historyItems,
    items: rankedItems,
    limit: 3,
    negativeFeedbackItems,
    profile,
    savedItems,
  });
  const interestGraph = getNewsInterestGraph({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 3,
    profile,
  });
  const hotBoard = getNewsHotBoard({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 5,
  });
  const searchTrends = getNewsSearchTrends({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 5,
    profile,
  });
  const liveWire = getNewsLiveWire({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 4,
  });
  const continuationRail = getNewsContinuationRail({
    formatCategory: getCategoryLabel,
    historyItems,
    items: rankedItems,
    limit: 3,
  });
  const missedCoverage = getNewsMissedCoverageShelf({
    frontPageCount: 4,
    historyItems,
    items: rankedItems,
    limit: 3,
  });
  const readingQueue = getNewsPersonalizedReadingQueue({
    formatCategory: getCategoryLabel,
    historyItems,
    items: rankedItems,
    negativeFeedbackItems,
    savedItems,
  });
  const editionSchedule = getNewsEditionSchedule({ items: rankedItems });
  const editionMix = getNewsEditionMix({ items: rankedItems });
  const aggregationIntake = getNewsAggregationIntake({
    items: rankedItems,
    limit: 2,
  });
  const sourceBalance = getNewsSourceBalance({ items: rankedItems });
  const sourceTrustLedger = getNewsSourceTrustLedger({ items: rankedItems });
  const entityRadar = getNewsEntityRadar({ items: rankedItems, limit: 5 });
  const topicPulse = getNewsTopicPulse({ items: rankedItems, limit: 4 });
  const topicMatchMatrix = getNewsTopicMatchMatrix({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 4,
    profile,
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
            <p>{formatEditionDate(generatedAt)}</p>
            <p>
              A ranked front page for agent products, frontier models, funding,
              research, and the companies shaping the next software cycle.
            </p>
          </div>
        </div>
        <nav className="container flex gap-2 overflow-x-auto border-t border-[#161616]/25 py-3 text-sm dark:border-[#f4f1ea]/25">
          {availableCategories.slice(0, 10).map((category) => (
            <Button
              key={category}
              type="button"
              variant={
                profile.preferredCategories.includes(category)
                  ? "default"
                  : "outline"
              }
              size="sm"
              className="rounded-none"
              onClick={() =>
                commitProfile((current) => ({
                  ...current,
                  preferredCategories: toggleValue(
                    current.preferredCategories,
                    category,
                  ),
                }))
              }
            >
              {getCategoryLabel(category)}
            </Button>
          ))}
        </nav>
        <section className="container grid gap-3 border-t border-[#161616]/25 py-4 dark:border-[#f4f1ea]/25">
          <form
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
            onSubmit={applyExploreSearch}
          >
            <Input
              aria-label="Search AI news"
              className="h-10 rounded-none border-[#161616]/45 bg-[#fffdf7] dark:border-[#f4f1ea]/45 dark:bg-[#181818]"
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
                searchTrends.trends.map((trend) => (
                  <Button
                    key={trend.key}
                    className="h-auto min-w-52 justify-start rounded-none px-3 py-2 text-left"
                    size="sm"
                    type="button"
                    variant={
                      searchQuery === trend.query ? "default" : "outline"
                    }
                    onClick={() => {
                      setSearchDraft(trend.query);
                      setSearchQuery(trend.query);
                    }}
                  >
                    <span className="grid gap-1">
                      <span className="font-mono text-[11px] opacity-70">
                        {trend.label} / {trend.supportLabel}
                      </span>
                      <span>{trend.query}</span>
                    </span>
                  </Button>
                ))
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
              <Button
                key={category}
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
                <Button
                  key={source}
                  className="rounded-none"
                  size="sm"
                  type="button"
                  variant={activeSourceSlug === source ? "default" : "outline"}
                  onClick={() =>
                    setActiveSourceSlug((current) =>
                      current === source ? null : source,
                    )
                  }
                >
                  {source}
                </Button>
              ))}
            </div>
          ) : null}
        </section>
      </header>

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
                <span
                  key={entity.entity}
                  className="border border-[#161616]/30 px-2 py-1 dark:border-[#f4f1ea]/30"
                >
                  {entity.entity} / {entity.storyCount}
                </span>
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
                briefingPack.slots.map((slot) => (
                  <Link
                    key={slot.id}
                    className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                    href={`/news/${slot.id}`}
                  >
                    <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                      {slot.label} / {slot.scoreLabel}
                    </span>
                    <span className="leading-5 font-semibold">
                      {slot.title}
                    </span>
                    <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                      {slot.sourceName} / {slot.categoryLabel}
                    </span>
                    <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                      {slot.reason}
                    </span>
                  </Link>
                ))
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
                frontPageLayout.sections.map((section) => (
                  <Link
                    key={section.id}
                    className="grid min-h-44 content-start gap-2 border-t border-[#161616]/20 pt-3 text-sm hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                    href={`/news/${section.id}`}
                  >
                    <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                      {section.label} / {section.treatment}
                    </span>
                    <span className="leading-5 font-semibold">
                      {section.title}
                    </span>
                    <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                      {section.sourceName} / {section.categoryLabel} /{" "}
                      {section.scoreLabel}
                    </span>
                    <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                      {section.reason}
                    </span>
                  </Link>
                ))
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
                frontPageSlotMix.slots.map((slot) => (
                  <Link
                    key={`${slot.key}-${slot.id}`}
                    className="grid content-start gap-2 border-t border-[#161616]/20 pt-3 text-sm hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                    href={`/news/${slot.id}`}
                  >
                    <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                      {slot.label} / {slot.treatment}
                    </span>
                    <span className="leading-5 font-semibold">
                      {slot.title}
                    </span>
                    <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                      {slot.sourceName} / {slot.categoryLabel} /{" "}
                      {slot.scoreLabel}
                    </span>
                    <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                      {slot.reason}
                    </span>
                  </Link>
                ))
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
            <article className="grid min-h-[420px] border-y border-[#161616] py-6 md:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.7fr)] dark:border-[#f4f1ea]">
              <div className="flex flex-col justify-between gap-8 pr-0 md:pr-6">
                <div>
                  <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold tracking-normal uppercase">
                    <span>{getCategoryLabel(leadStory.category)}</span>
                    <span className="text-[#78746c]">/</span>
                    <span>{leadStory.sourceName}</span>
                    <span className="text-[#78746c]">/</span>
                    <span>{formatTime(leadStory.publishedAt)}</span>
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
                    rankedAt={rankDetailsAt}
                  />
                </div>
                <StoryAction
                  item={leadStory}
                  isPreview={isPreview}
                  rankSlot={0}
                  onAction={recordStoryAction}
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
                rankSlot={index + 1}
                rankedAt={rankDetailsAt}
                onAction={recordStoryAction}
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
                {sectionFronts.map((section) => (
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
                          {formatTime(section.lead.publishedAt)}
                        </div>
                        <h3 className="mt-2 text-2xl leading-tight font-black">
                          {section.lead.title}
                        </h3>
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
                ))}
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
                sourceClusters.clusters.map((cluster) => (
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
                ))
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
                claimTracker.claims.map((claim) => (
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
                ))
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
                storyTimeline.events.map((event) => (
                  <article
                    key={event.id}
                    className="grid gap-4 border border-[#161616]/35 bg-[#fffdf7] p-4 md:grid-cols-[auto_1fr_auto] md:items-start dark:border-[#f4f1ea]/35 dark:bg-[#181818]"
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
                    </div>
                    <div className="flex flex-wrap gap-2 md:max-w-48 md:justify-end">
                      <span className="border border-[#161616]/25 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/25">
                        {event.heatLabel}
                      </span>
                      {event.entities.map((entity) => (
                        <span
                          key={entity}
                          className="border border-[#161616]/25 px-2 py-1 font-mono text-xs text-[#5b5750] dark:border-[#f4f1ea]/25 dark:text-[#bbb4aa]"
                        >
                          {entity}
                        </span>
                      ))}
                    </div>
                  </article>
                ))
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
                {coverageThreads.threads.map((thread) =>
                  thread.lead ? (
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
                  ) : null,
                )}
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
                {consensusBoard.threads.map((thread) => (
                  <article
                    key={thread.entity}
                    className="grid min-h-64 grid-rows-[auto_1fr] border border-[#161616]/35 bg-[#fffdf7] p-4 dark:border-[#f4f1ea]/35 dark:bg-[#181818]"
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
                  </article>
                ))}
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
                  rankSlot={index + 4}
                  rankedAt={rankDetailsAt}
                  onAction={recordStoryAction}
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
                disabled={
                  !visitorKey || !nextCursor || isLoadingMore || !hasMoreItems
                }
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
              <div>
                <h2 className="text-xl font-black">For You</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {status === "ready"
                    ? "Your edition is ranked by trend, freshness, and selected signals."
                    : "The recommendation layer is ready; live stories need the first crawl."}
                </p>
              </div>
              <div className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {leadStory?.personalizedScore ?? 0}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black">Reader Signal</h3>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    className="h-8 rounded-none px-2 text-xs"
                    type="button"
                    variant="outline"
                    onClick={resetProfile}
                  >
                    Reset Signal
                  </Button>
                  <span className="border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                    {readerSignalSummary.strength} /{" "}
                    {readerSignalSummary.signalCount}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                {readerSignalSummary.detail}
              </p>
              <div className="mt-3 grid gap-3 text-xs">
                <SignalChips
                  label="Topics"
                  values={readerSignalSummary.topics.map(getCategoryLabel)}
                />
                <SignalChips
                  label="Sources"
                  values={readerSignalSummary.sources}
                />
                <SignalChips
                  label="Entities"
                  values={readerSignalSummary.entities}
                />
              </div>
              <div className="mt-4 border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15">
                <h4 className="font-mono text-[11px] tracking-[0.14em] uppercase">
                  Ranking Factors
                </h4>
                <div className="mt-2 grid gap-2">
                  {readerRankingFactors.map((factor) => (
                    <div
                      key={`${factor.label}-${factor.detail}`}
                      className="grid gap-1 text-xs sm:grid-cols-[5rem_1fr]"
                    >
                      <span className="font-semibold">{factor.label}</span>
                      <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {factor.detail}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Reader Learning Loop</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {readerLearningLoop.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {readerLearningLoop.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {readerLearningLoop.metrics.map((metric) => (
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
              <div className="mt-3 border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-mono text-[11px] tracking-[0.14em] uppercase">
                    Server Profile
                  </h4>
                  <span className="border border-[#161616]/30 px-2 py-0.5 font-mono text-[10px] uppercase dark:border-[#f4f1ea]/30">
                    {serverProfileAudit.label}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                  {serverProfileAudit.summary}
                </p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  {serverProfileAudit.metrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="border-t border-[#161616]/20 pt-2 dark:border-[#f4f1ea]/15"
                    >
                      <dt className="font-mono text-[10px] tracking-[0.12em] text-[#5b5750] uppercase dark:text-[#bbb4aa]">
                        {metric.label}
                      </dt>
                      <dd className="mt-1 text-base font-black">
                        {metric.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {serverProfileAudit.chips.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {serverProfileAudit.chips.map((chip) => (
                      <span
                        key={chip}
                        className="border border-[#161616]/30 px-2 py-1 text-[11px] dark:border-[#f4f1ea]/30"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="mt-3 grid gap-3">
                {readerLearningLoop.actions.length > 0 ? (
                  readerLearningLoop.actions.map((action) => (
                    <div
                      key={action.key}
                      className="grid gap-1 border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">
                          {action.label}: {action.title}
                        </span>
                        <span className="border border-[#161616]/30 px-2 py-0.5 font-mono text-[10px] uppercase dark:border-[#f4f1ea]/30">
                          {action.statusLabel}
                        </span>
                      </div>
                      <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {action.signalLabel}
                      </span>
                      <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {action.detail}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    Reader learning loop will appear after behavior or ranked
                    stories.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Reader Journey Map</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {readerJourneyMap.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {readerJourneyMap.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {readerJourneyMap.metrics.map((metric) => (
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
              <div className="mt-3 grid gap-3">
                {readerJourneyMap.steps.length > 0 ? (
                  readerJourneyMap.steps.map((step) => {
                    const stepBody = (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">
                            {step.label}: {step.title}
                          </span>
                          <span className="border border-[#161616]/30 px-2 py-0.5 font-mono text-[10px] uppercase dark:border-[#f4f1ea]/30">
                            {step.statusLabel}
                          </span>
                        </div>
                        <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {step.sourceName
                            ? `${step.sourceName} / ${step.signalLabel}`
                            : step.signalLabel}
                        </span>
                        <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {step.detail}
                        </span>
                      </>
                    );

                    return step.id && !isPreview ? (
                      <Link
                        key={`${step.key}-${step.id}`}
                        className="grid gap-1 border-t border-[#161616]/20 pt-3 text-xs hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                        href={`/news/${step.id}`}
                      >
                        {stepBody}
                      </Link>
                    ) : (
                      <div
                        key={`${step.key}-${step.id ?? step.title}`}
                        className="grid gap-1 border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                      >
                        {stepBody}
                      </div>
                    );
                  })
                ) : (
                  <div className="border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    Reader journey will appear after profile or behavior
                    signals.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Reader Scorecard</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {readerScorecards.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {readerScorecards.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {readerScorecards.metrics.map((metric) => (
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
              <div className="mt-3 grid gap-4">
                {readerScorecards.scorecards.length > 0 ? (
                  readerScorecards.scorecards.map((scorecard) => (
                    <div
                      key={scorecard.id}
                      className="border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                    >
                      <Link
                        className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                        href={`/news/${scorecard.id}`}
                      >
                        <span className="font-semibold">{scorecard.title}</span>
                        <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {scorecard.sourceName} / {scorecard.categoryLabel} /{" "}
                          {scorecard.scoreLabel}
                        </span>
                        <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {scorecard.summary}
                        </span>
                      </Link>
                      <div className="mt-2 grid gap-2">
                        {scorecard.components.map((component) => (
                          <div
                            key={`${scorecard.id}-${component.label}-${component.valueLabel}`}
                            className="grid gap-1 border-t border-[#161616]/15 pt-2 sm:grid-cols-[5.25rem_3.5rem_1fr] dark:border-[#f4f1ea]/10"
                          >
                            <span className="font-semibold">
                              {component.label}
                            </span>
                            <span
                              className={cn(
                                "font-mono",
                                component.tone === "penalty"
                                  ? "text-[#8a241c] dark:text-[#ff8b7e]"
                                  : component.tone === "base"
                                    ? "text-[#161616] dark:text-[#f4f1ea]"
                                    : "text-[#2f6f4e] dark:text-[#8fd8ae]",
                              )}
                            >
                              {component.valueLabel}
                            </span>
                            <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                              {component.detail}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    Reader scorecards will appear after ranked stories are
                    available.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Reader Daypart</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {readerDaypartPlan.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {readerDaypartPlan.label}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-xs">
                <div className="grid gap-1 border-t border-[#161616]/20 pt-2 sm:grid-cols-[5.5rem_1fr] dark:border-[#f4f1ea]/15">
                  <span className="font-semibold">Intent</span>
                  <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                    {readerDaypartPlan.intent}
                  </span>
                </div>
                <div className="grid gap-1 border-t border-[#161616]/20 pt-2 sm:grid-cols-[5.5rem_1fr] dark:border-[#f4f1ea]/15">
                  <span className="font-semibold">Cadence</span>
                  <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                    {readerDaypartPlan.cadenceLabel}
                  </span>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {readerDaypartPlan.metrics.map((metric) => (
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
              <div className="mt-3 grid gap-3">
                {readerDaypartPlan.lanes.length > 0 ? (
                  readerDaypartPlan.lanes.map((lane) => (
                    <Link
                      key={`${lane.key}-${lane.id}`}
                      className="grid gap-1 border-t border-[#161616]/20 pt-3 text-xs hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                      href={`/news/${lane.id}`}
                    >
                      <span className="font-semibold">
                        {lane.label} / {lane.title}
                      </span>
                      <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {lane.sourceName} / {lane.categoryLabel} /{" "}
                        {lane.scoreLabel}
                      </span>
                      <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {lane.reason}
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    Daypart lanes will appear after ranked stories are
                    available.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Reader Digest</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {readerDigest.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {readerDigest.label}
                </span>
              </div>
              <h4 className="mt-3 text-lg leading-6 font-black">
                {readerDigest.headline}
              </h4>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {readerDigest.metrics.map((metric) => (
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
              <div className="mt-3 grid gap-2">
                {readerDigest.notices.map((notice) => (
                  <div
                    key={`${notice.label}-${notice.detail}`}
                    className="grid gap-1 border-t border-[#161616]/20 pt-2 text-xs sm:grid-cols-[5.5rem_1fr] dark:border-[#f4f1ea]/15"
                  >
                    <span className="font-semibold">{notice.label}</span>
                    <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                      {notice.detail}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-3">
                {readerDigest.nextReads.length > 0 ? (
                  readerDigest.nextReads.map((story) => (
                    <Link
                      key={story.id}
                      className="grid gap-1 border-t border-[#161616]/20 pt-3 text-xs hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                      href={`/news/${story.id}`}
                    >
                      <span className="font-semibold">{story.title}</span>
                      <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {story.sourceName} / {story.categoryLabel} /{" "}
                        {story.scoreLabel}
                      </span>
                      <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {story.reason}
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    Digest recommendations will appear after stories are ranked.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Preference Controls</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {preferenceControlPanel.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {preferenceControlPanel.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {preferenceControlPanel.metrics.map((metric) => (
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
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {preferenceControlPanel.biasControls.map((control) => (
                  <div
                    key={control.key}
                    className="border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{control.label}</span>
                      <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                        {control.value}
                      </span>
                    </div>
                    <p className="mt-1 leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                      {control.detail}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button
                        className="h-8 rounded-none text-xs"
                        type="button"
                        variant="outline"
                        onClick={() =>
                          commitProfile((current) =>
                            control.key === "recencyBias"
                              ? {
                                  ...current,
                                  recencyBias: decreaseProfileBias(
                                    current.recencyBias,
                                  ),
                                }
                              : {
                                  ...current,
                                  noveltyBias: decreaseProfileBias(
                                    current.noveltyBias,
                                  ),
                                },
                          )
                        }
                      >
                        Lower
                      </Button>
                      <Button
                        className="h-8 rounded-none text-xs"
                        type="button"
                        variant="outline"
                        onClick={() =>
                          commitProfile((current) =>
                            control.key === "recencyBias"
                              ? {
                                  ...current,
                                  recencyBias: increaseProfileBias(
                                    current.recencyBias,
                                  ),
                                }
                              : {
                                  ...current,
                                  noveltyBias: increaseProfileBias(
                                    current.noveltyBias,
                                  ),
                                },
                          )
                        }
                      >
                        Raise
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-3">
                {preferenceControlPanel.groups.map((group) => (
                  <div
                    key={group.key}
                    className="border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                  >
                    <div className="font-mono text-[11px] tracking-[0.14em] uppercase">
                      {group.label}
                    </div>
                    {group.signals.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {group.signals.map((signal) => (
                          <span
                            key={`${signal.kind}-${signal.signal}`}
                            className="inline-flex max-w-full items-center gap-2 border border-[#161616]/30 px-2 py-1 dark:border-[#f4f1ea]/30"
                          >
                            <span className="truncate">{signal.label}</span>
                            <Button
                              className="h-6 rounded-none px-2 text-[10px]"
                              size="sm"
                              type="button"
                              variant="outline"
                              onClick={() =>
                                commitProfile((current) => {
                                  if (signal.kind === "category") {
                                    return {
                                      ...current,
                                      preferredCategories: removeValue(
                                        current.preferredCategories,
                                        signal.signal,
                                      ),
                                    };
                                  }

                                  if (signal.kind === "source") {
                                    return {
                                      ...current,
                                      preferredSources: removeValue(
                                        current.preferredSources,
                                        signal.signal,
                                      ),
                                    };
                                  }

                                  return {
                                    ...current,
                                    preferredEntities: removeValue(
                                      current.preferredEntities,
                                      signal.signal,
                                    ),
                                  };
                                })
                              }
                            >
                              Remove
                            </Button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {group.emptyLabel}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Preference Presets</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {preferencePresets.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {preferencePresets.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {preferencePresets.metrics.map((metric) => (
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
              <div className="mt-3 grid gap-3">
                {preferencePresets.presets.length > 0 ? (
                  preferencePresets.presets.map((preset) => (
                    <div
                      key={preset.key}
                      className="grid gap-3 border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                    >
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">
                              {preset.label}
                            </span>
                            <span className="border border-[#161616]/40 px-2 py-0.5 font-mono text-[10px] text-[#5b5750] uppercase dark:border-[#f4f1ea]/35 dark:text-[#bbb4aa]">
                              {preset.coverageLabel}
                            </span>
                            <span className="border border-[#161616]/40 px-2 py-0.5 font-mono text-[10px] text-[#5b5750] uppercase dark:border-[#f4f1ea]/35 dark:text-[#bbb4aa]">
                              {preset.newSignalCount} new
                            </span>
                          </div>
                          <p className="mt-1 leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                            {preset.summary}
                          </p>
                        </div>
                        <Button
                          className="h-8 rounded-none px-2 text-xs whitespace-nowrap"
                          disabled={preset.newSignalCount === 0}
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const categories = preset.signals
                              .filter((signal) => signal.kind === "category")
                              .map((signal) => signal.signal);
                            const sources = preset.signals
                              .filter((signal) => signal.kind === "source")
                              .map((signal) => signal.signal);
                            const entities = preset.signals
                              .filter((signal) => signal.kind === "entity")
                              .map((signal) => signal.signal);

                            commitProfile((current) => ({
                              ...current,
                              preferredCategories: addValues(
                                current.preferredCategories,
                                categories,
                              ),
                              preferredEntities: addValues(
                                current.preferredEntities,
                                entities,
                              ),
                              preferredSources: addValues(
                                current.preferredSources,
                                sources,
                              ),
                            }));
                          }}
                        >
                          {preset.actionLabel}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {preset.signals.map((signal) => (
                          <span
                            key={`${preset.key}-${signal.kind}-${signal.signal}`}
                            className={cn(
                              "border px-2 py-1 leading-none",
                              signal.active
                                ? "border-[#8a241c] bg-[#8a241c] text-[#fffdf7] dark:border-[#ff8b7e] dark:bg-[#ff8b7e] dark:text-[#181818]"
                                : "border-[#161616]/35 text-[#5b5750] dark:border-[#f4f1ea]/35 dark:text-[#bbb4aa]",
                            )}
                          >
                            {signal.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    Preference presets will appear after ranked stories load.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Preference Starter</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {preferenceStarter.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {preferenceStarter.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {preferenceStarter.metrics.map((metric) => (
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
              <div className="mt-3 grid gap-3">
                {preferenceStarter.groups.length > 0 ? (
                  preferenceStarter.groups.map((group) => (
                    <div
                      key={group.label}
                      className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                    >
                      <div className="font-mono text-[11px] tracking-[0.14em] uppercase">
                        {group.label}
                      </div>
                      <div className="mt-2 grid gap-2">
                        {group.suggestions.map((suggestion) => (
                          <div
                            key={`${suggestion.kind}-${suggestion.signal}`}
                            className="grid gap-2 text-xs sm:grid-cols-[1fr_auto] sm:items-center"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-semibold">
                                {suggestion.label}
                              </div>
                              <p className="mt-1 leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                                {suggestion.reason}
                              </p>
                            </div>
                            <Button
                              className="h-8 rounded-none px-2 text-xs whitespace-nowrap"
                              type="button"
                              variant="outline"
                              onClick={() =>
                                commitProfile((current) => {
                                  if (suggestion.kind === "category") {
                                    return {
                                      ...current,
                                      preferredCategories: toggleValue(
                                        current.preferredCategories,
                                        suggestion.signal,
                                      ),
                                    };
                                  }

                                  if (suggestion.kind === "source") {
                                    return {
                                      ...current,
                                      preferredSources: toggleValue(
                                        current.preferredSources,
                                        suggestion.signal,
                                      ),
                                    };
                                  }

                                  return {
                                    ...current,
                                    preferredEntities: toggleValue(
                                      current.preferredEntities,
                                      suggestion.signal,
                                    ),
                                  };
                                })
                              }
                            >
                              {suggestion.actionLabel}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    Active story signals are already covered by the profile.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Preference Tuning</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {preferenceTuningPlan.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {preferenceTuningPlan.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {preferenceTuningPlan.metrics.map((metric) => (
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
              <div className="mt-3 grid gap-3">
                {preferenceTuningPlan.suggestions.length > 0 ? (
                  preferenceTuningPlan.suggestions.map((suggestion) => (
                    <div
                      key={`${suggestion.action}-${suggestion.kind}-${suggestion.signal}`}
                      className="grid gap-3 border-t border-[#161616]/20 pt-3 text-xs sm:grid-cols-[1fr_auto] sm:items-start dark:border-[#f4f1ea]/15"
                    >
                      <div className="min-w-0">
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)]">
                          <div className="font-semibold">
                            {suggestion.label}
                          </div>
                          <p className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                            {suggestion.detail}
                          </p>
                        </div>
                        {suggestion.evidence.length > 0 ? (
                          <div className="mt-2 truncate text-[#5b5750] dark:text-[#bbb4aa]">
                            Evidence: {suggestion.evidence.join(" / ")}
                          </div>
                        ) : null}
                      </div>
                      <Button
                        className="h-8 rounded-none px-2 text-xs whitespace-nowrap"
                        disabled={suggestion.action === "keep"}
                        type="button"
                        variant="outline"
                        onClick={() =>
                          commitProfile((current) => {
                            if (suggestion.action === "explore") {
                              return {
                                ...current,
                                noveltyBias: increaseProfileBias(
                                  current.noveltyBias,
                                ),
                              };
                            }

                            if (suggestion.kind === "category") {
                              return {
                                ...current,
                                preferredCategories:
                                  suggestion.action === "reduce"
                                    ? removeValue(
                                        current.preferredCategories,
                                        suggestion.signal,
                                      )
                                    : addValue(
                                        current.preferredCategories,
                                        suggestion.signal,
                                      ),
                              };
                            }

                            if (suggestion.kind === "source") {
                              return {
                                ...current,
                                preferredSources:
                                  suggestion.action === "reduce"
                                    ? removeValue(
                                        current.preferredSources,
                                        suggestion.signal,
                                      )
                                    : addValue(
                                        current.preferredSources,
                                        suggestion.signal,
                                      ),
                              };
                            }

                            if (suggestion.kind === "entity") {
                              return {
                                ...current,
                                preferredEntities:
                                  suggestion.action === "reduce"
                                    ? removeValue(
                                        current.preferredEntities,
                                        suggestion.signal,
                                      )
                                    : addValue(
                                        current.preferredEntities,
                                        suggestion.signal,
                                      ),
                              };
                            }

                            return current;
                          })
                        }
                      >
                        {suggestion.actionLabel}
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    Save, read, or press Less on stories to generate tuning
                    suggestions.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Profile Impact Preview</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {profileImpactPreview.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {profileImpactPreview.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {profileImpactPreview.metrics.map((metric) => (
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
              <div className="mt-3 grid gap-3">
                {profileImpactPreview.lanes.length > 0 ? (
                  profileImpactPreview.lanes.map((lane) => (
                    <div
                      key={lane.key}
                      className="border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                    >
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,0.35fr)_minmax(0,1fr)]">
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <span className="font-semibold">{lane.label}</span>
                          <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                            {lane.count}
                          </span>
                        </div>
                        <p className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {lane.summary}
                        </p>
                      </div>
                      <div className="mt-2 grid gap-2">
                        {lane.stories.length > 0 ? (
                          lane.stories.map((story) => (
                            <Link
                              key={`${lane.key}-${story.id}`}
                              className="grid gap-1 border-t border-[#161616]/15 pt-2 hover:text-[#8a241c] dark:border-[#f4f1ea]/10 dark:hover:text-[#ff8b7e]"
                              href={`/news/${story.id}`}
                            >
                              <span className="truncate font-semibold">
                                {story.title}
                              </span>
                              <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                                {story.sourceName} / {story.reason}
                              </span>
                            </Link>
                          ))
                        ) : (
                          <p className="border-t border-[#161616]/15 pt-2 leading-5 text-[#5b5750] dark:border-[#f4f1ea]/10 dark:text-[#bbb4aa]">
                            No stories in this lane yet.
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    Profile impact will appear after the edition has ranked
                    stories and active reader signals.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Filter Bubble Report</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {filterBubbleReport.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {filterBubbleReport.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {filterBubbleReport.metrics.map((metric) => (
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
              <div className="mt-3 grid gap-3">
                {filterBubbleReport.checks.length > 0 ? (
                  filterBubbleReport.checks.map((check) => (
                    <div
                      key={check.label}
                      className="border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                    >
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,0.35fr)_minmax(0,1fr)]">
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <span className="font-semibold">{check.label}</span>
                          <span
                            className={cn(
                              "font-mono",
                              check.status === "risk"
                                ? "text-[#8a241c] dark:text-[#ff8b7e]"
                                : check.status === "watch"
                                  ? "text-[#7a4b12] dark:text-[#f0b35d]"
                                  : "text-[#23613c] dark:text-[#78d59a]",
                            )}
                          >
                            {check.status}
                          </span>
                        </div>
                        <div className="grid gap-2">
                          <p className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                            {check.detail}
                          </p>
                          <p className="leading-5">{check.action}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    Filter bubble checks will appear after ranked stories load.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Taste Calibration</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {tasteCalibration.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {tasteCalibration.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {tasteCalibration.metrics.map((metric) => (
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
              <div className="mt-3 grid gap-3">
                {tasteCalibration.actions.length > 0 ? (
                  tasteCalibration.actions.map((action) => (
                    <div
                      key={action.key}
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{action.label}</span>
                        <span
                          className={cn(
                            "border border-[#161616]/30 px-2 py-0.5 font-mono text-[10px] uppercase dark:border-[#f4f1ea]/30",
                            action.statusLabel === "Dampen"
                              ? "text-[#5b5750] dark:text-[#bbb4aa]"
                              : action.statusLabel === "Explore"
                                ? "text-[#7a4b12] dark:text-[#f0b35d]"
                                : "text-[#23613c] dark:text-[#78d59a]",
                          )}
                        >
                          {action.statusLabel}
                        </span>
                      </div>
                      <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {action.storyTitle}
                      </span>
                      <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {action.detail}
                      </span>
                      <span className="w-fit border border-[#161616]/25 px-2 py-1 font-mono text-[11px] uppercase dark:border-[#f4f1ea]/25">
                        {action.actionLabel}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    Taste calibration will appear after stories are ranked.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Discovery Ladder</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {discoveryLadder.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {discoveryLadder.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {discoveryLadder.metrics.map((metric) => (
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
              <div className="mt-3 grid gap-3">
                {discoveryLadder.rungs.length > 0 ? (
                  discoveryLadder.rungs.map((rung) => {
                    const isFollowed =
                      rung.statusLabel === "Following" ||
                      profile.preferredCategories.includes(rung.category);
                    const storyBody = (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{rung.label}</span>
                          <span className="border border-[#161616]/30 px-2 py-0.5 font-mono text-[10px] uppercase dark:border-[#f4f1ea]/30">
                            {rung.statusLabel}
                          </span>
                        </div>
                        <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {rung.title}
                        </span>
                        <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {rung.sourceName} / {rung.categoryLabel} /{" "}
                          {rung.scoreLabel}
                        </span>
                        <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {rung.reason}
                        </span>
                      </>
                    );

                    return (
                      <div
                        key={rung.key}
                        className="grid gap-2 border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                      >
                        {isPreview ? (
                          <div className="grid gap-1">{storyBody}</div>
                        ) : (
                          <Link
                            className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                            href={`/news/${rung.id}`}
                          >
                            {storyBody}
                          </Link>
                        )}
                        <Button
                          className="h-8 w-full rounded-none text-xs"
                          disabled={!isNewsCategoryKey(rung.category)}
                          size="sm"
                          type="button"
                          variant={isFollowed ? "outline" : "default"}
                          onClick={() => {
                            if (!isNewsCategoryKey(rung.category)) return;

                            commitProfile((current) => ({
                              ...current,
                              preferredCategories: addValue(
                                current.preferredCategories,
                                rung.category,
                              ),
                            }));
                            setActiveCategory(rung.category);
                            setFeedMode("for_you");
                          }}
                        >
                          {isFollowed ? "Focus topic" : rung.actionLabel}
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <div className="border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    Discovery ladder will appear after stories are ranked.
                  </div>
                )}
              </div>
            </div>

            <PreferenceGroup title="Sources">
              {availableSources.map((source) => (
                <PreferenceButton
                  key={source}
                  active={profile.preferredSources.includes(source)}
                  onClick={() =>
                    commitProfile((current) => ({
                      ...current,
                      preferredSources: toggleValue(
                        current.preferredSources,
                        source,
                      ),
                    }))
                  }
                >
                  {source}
                </PreferenceButton>
              ))}
            </PreferenceGroup>

            <PreferenceGroup title="Angles">
              {availableTags.map((tag) => (
                <PreferenceButton
                  key={tag}
                  active={profile.preferredEntities.some(
                    (entity) => entity.toLowerCase() === tag.toLowerCase(),
                  )}
                  onClick={() =>
                    commitProfile((current) => ({
                      ...current,
                      preferredEntities: toggleValue(
                        current.preferredEntities,
                        tag,
                      ),
                    }))
                  }
                >
                  {tag}
                </PreferenceButton>
              ))}
            </PreferenceGroup>

            <PreferenceGroup title="Entities">
              {availableEntities.map((entity) => (
                <PreferenceButton
                  key={entity}
                  active={profile.preferredEntities.includes(entity)}
                  onClick={() =>
                    commitProfile((current) => ({
                      ...current,
                      preferredEntities: toggleValue(
                        current.preferredEntities,
                        entity,
                      ),
                    }))
                  }
                >
                  {entity}
                </PreferenceButton>
              ))}
            </PreferenceGroup>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <BiasButton
                label="Fresh"
                value={profile.recencyBias}
                onClick={() =>
                  commitProfile((current) => ({
                    ...current,
                    recencyBias:
                      current.recencyBias >= 2 ? 0 : current.recencyBias + 1,
                  }))
                }
              />
              <BiasButton
                label="Novel"
                value={profile.noveltyBias}
                onClick={() =>
                  commitProfile((current) => ({
                    ...current,
                    noveltyBias:
                      current.noveltyBias >= 2 ? 0 : current.noveltyBias + 1,
                  }))
                }
              />
            </div>
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Refresh Simulation</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {refreshSimulation.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 text-right font-mono text-sm dark:border-[#f4f1ea]">
                {refreshSimulation.label}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-3 text-sm">
              {refreshSimulation.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {refreshSimulation.moves.length > 0 ? (
                refreshSimulation.moves.map((move) => (
                  <Link
                    key={move.key}
                    className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                    href={`/news/${move.id}`}
                  >
                    <span className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
                      <span>
                        <span className="block font-semibold">
                          {move.label}: {move.title}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {move.sourceName} / {move.categoryLabel} /{" "}
                          {move.reason}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "font-mono text-xs",
                          move.statusLabel === "Dampen"
                            ? "text-[#5b5750] dark:text-[#bbb4aa]"
                            : move.statusLabel === "Explore"
                              ? "text-[#7a4b12] dark:text-[#f0b35d]"
                              : "text-[#8a241c] dark:text-[#ff8b7e]",
                        )}
                      >
                        {move.deltaLabel}
                      </span>
                    </span>
                    <span className="w-fit border border-[#161616]/25 px-2 py-1 font-mono text-[11px] uppercase dark:border-[#f4f1ea]/25">
                      {move.actionLabel}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Refresh simulation will appear after stories are ranked.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Edition Quality Gate</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {editionQualityGate.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 text-right font-mono text-sm dark:border-[#f4f1ea]">
                {editionQualityGate.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {editionQualityGate.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {editionQualityGate.checks.map((check) => (
                <div
                  key={check.key}
                  className="grid gap-3 border-t border-[#161616]/20 pt-3 text-sm sm:grid-cols-[minmax(0,0.35fr)_minmax(0,1fr)] dark:border-[#f4f1ea]/15"
                >
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <span className="font-semibold">{check.label}</span>
                    <span
                      className={cn(
                        "font-mono text-xs",
                        check.status === "pass"
                          ? "text-[#23613c] dark:text-[#78d59a]"
                          : check.status === "watch"
                            ? "text-[#7a4b12] dark:text-[#f0b35d]"
                            : "text-[#8a241c] dark:text-[#ff8b7e]",
                      )}
                    >
                      {check.status}
                    </span>
                  </div>
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                        {check.evidenceLabel}
                      </span>
                      <span>{check.action}</span>
                    </div>
                    <p className="leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                      {check.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Personalized Push Queue</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {personalizedPushQueue.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 text-right font-mono text-sm dark:border-[#f4f1ea]">
                {personalizedPushQueue.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {personalizedPushQueue.metrics.map((metric) => (
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
            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-4">
              {personalizedPushQueue.lanes.map((lane) => (
                <div
                  key={lane.key}
                  className="grid content-start gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <h3 className="font-semibold">{lane.label}</h3>
                    <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                      {lane.count} / {lane.shareLabel}
                    </span>
                  </div>
                  <p className="leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {lane.summary}
                  </p>
                  <div className="grid gap-2">
                    {lane.stories.length > 0 ? (
                      lane.stories.map((story) => {
                        const storyBody = (
                          <>
                            <span className="leading-5 font-semibold">
                              {story.deliveryLabel}: {story.title}
                            </span>
                            <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                              {story.sourceName} / {story.categoryLabel} /{" "}
                              {story.scoreLabel}
                            </span>
                            <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                              {story.reason} / {story.triggerLabel}
                            </span>
                          </>
                        );

                        return isPreview ? (
                          <div
                            key={story.id}
                            className="grid gap-1 border-t border-[#161616]/10 pt-2 dark:border-[#f4f1ea]/10"
                          >
                            {storyBody}
                          </div>
                        ) : (
                          <Link
                            key={story.id}
                            className="grid gap-1 border-t border-[#161616]/10 pt-2 hover:text-[#8a241c] dark:border-[#f4f1ea]/10 dark:hover:text-[#ff8b7e]"
                            href={`/news/${story.id}`}
                          >
                            {storyBody}
                          </Link>
                        );
                      })
                    ) : (
                      <p className="border-t border-[#161616]/10 pt-2 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/10 dark:text-[#bbb4aa]">
                        No stories in this push lane.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Reader Watchlist</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {readerWatchlist.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {readerWatchlist.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {readerWatchlist.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {readerWatchlist.entries.length > 0 ? (
                readerWatchlist.entries.map((entry) => {
                  const watchTitle = (
                    <span className="leading-5 font-semibold">
                      {entry.topStory?.title}
                    </span>
                  );

                  return (
                    <div
                      key={entry.key}
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-mono text-[11px] tracking-[0.12em] uppercase">
                            {entry.statusLabel} / {entry.kind}
                          </div>
                          <div className="mt-1 truncate font-semibold">
                            {entry.signal}
                          </div>
                        </div>
                        <span className="shrink-0 border border-[#161616]/25 px-2 py-1 font-mono text-[11px] dark:border-[#f4f1ea]/25">
                          {entry.supportLabel}
                        </span>
                      </div>
                      <p className="leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        {entry.reason}
                      </p>
                      {entry.topStory ? (
                        isPreview ? (
                          <div>{watchTitle}</div>
                        ) : (
                          <Link
                            className="hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                            href={`/news/${entry.topStory.id}`}
                          >
                            {watchTitle}
                          </Link>
                        )
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Reader watchlist will appear after stories are ranked.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">AI Hot Board</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {hotBoard.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 text-right font-mono text-xs dark:border-[#f4f1ea]">
                {hotBoard.label}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {hotBoard.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {hotBoard.entries.length > 0 ? (
                hotBoard.entries.map((entry) => {
                  const entryTitle = (
                    <span className="leading-5 font-semibold">
                      {entry.title}
                    </span>
                  );

                  return (
                    <div
                      key={entry.id}
                      className="grid grid-cols-[2rem_1fr_auto] items-start gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                        {entry.rank}
                      </span>
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] tracking-[0.12em] uppercase">
                          {entry.label} / {entry.categoryLabel}
                        </div>
                        {isPreview ? (
                          <div className="mt-2">{entryTitle}</div>
                        ) : (
                          <Link
                            className="mt-2 block hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                            href={`/news/${entry.id}`}
                          >
                            {entryTitle}
                          </Link>
                        )}
                        <p className="mt-1 text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {entry.reason}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 font-mono text-[11px] text-[#5b5750] dark:text-[#bbb4aa]">
                          {entry.scoreBreakdown.map((score) => (
                            <span
                              key={score.label}
                              className="border border-[#161616]/25 px-2 py-1 dark:border-[#f4f1ea]/25"
                            >
                              {score.label} {score.value}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="font-mono">{entry.heatScore}</span>
                    </div>
                  );
                })
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Hot board will appear after stories are ranked.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Recommendation Trace</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {recommendationTrace.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 text-right font-mono text-sm dark:border-[#f4f1ea]">
                {recommendationTrace.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {recommendationTrace.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {recommendationTrace.steps.length > 0 ? (
                recommendationTrace.steps.map((step, index) => (
                  <div
                    key={`${step.label}-${step.title}`}
                    className="grid gap-3 border-t border-[#161616]/20 pt-3 text-sm sm:grid-cols-[2rem_1fr_auto] dark:border-[#f4f1ea]/15"
                  >
                    <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold">{step.label}</div>
                      <div className="mt-1 leading-5 font-semibold">
                        {step.title}
                      </div>
                      <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        {step.detail}
                      </p>
                    </div>
                    <span className="font-mono text-xs">{step.scoreLabel}</span>
                  </div>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Recommendation trace will appear after stories are ranked.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Experiment Allocation</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {experimentAllocation.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {experimentAllocation.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {experimentAllocation.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {experimentAllocation.arms.length > 0 ? (
                experimentAllocation.arms.map((arm) => (
                  <div
                    key={arm.key}
                    className="grid gap-3 border-t border-[#161616]/20 pt-3 text-sm md:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] dark:border-[#f4f1ea]/15"
                  >
                    <div>
                      <div className="grid grid-cols-[1fr_auto] gap-3">
                        <span className="font-semibold">{arm.label}</span>
                        <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                          {arm.allocationLabel}
                        </span>
                      </div>
                      <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        {arm.objective}
                      </p>
                    </div>
                    <div>
                      <div className="grid grid-cols-[1fr_auto] gap-3">
                        <span className="leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                          {arm.trigger}
                        </span>
                        <span className="font-mono text-xs">
                          {arm.storyCount}
                        </span>
                      </div>
                      <p className="mt-2 leading-6">{arm.action}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Experiment allocation will appear after stories are ranked.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Aggregation Intake</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {aggregationIntake.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {aggregationIntake.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {aggregationIntake.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {aggregationIntake.lanes.length > 0 ? (
                aggregationIntake.lanes.map((lane) => (
                  <div
                    key={lane.key}
                    className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                  >
                    <div className="grid grid-cols-[1fr_auto] gap-3">
                      <div className="font-semibold">{lane.label}</div>
                      <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                        {lane.shareLabel}
                      </span>
                    </div>
                    <p className="mt-2 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                      {lane.summary}
                    </p>
                    <p className="mt-2 leading-6">{lane.action}</p>
                    <div className="mt-3 grid gap-2">
                      {lane.stories.map((story) => (
                        <Link
                          key={`${lane.key}-${story.id}`}
                          className="grid gap-1 border-t border-[#161616]/15 pt-2 hover:text-[#8a241c] dark:border-[#f4f1ea]/10 dark:hover:text-[#ff8b7e]"
                          href={`/news/${story.id}`}
                        >
                          <span className="truncate font-semibold">
                            {story.title}
                          </span>
                          <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                            {story.sourceName} / {story.scoreLabel}
                          </span>
                          <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                            {story.reason}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Aggregation intake will appear after sources deliver stories.
                </div>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Reader Cohorts</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {readerCohorts.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {readerCohorts.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {readerCohorts.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {readerCohorts.cohorts.length > 0 ? (
                readerCohorts.cohorts.map((cohort) => (
                  <div
                    key={cohort.label}
                    className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                  >
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,0.65fr)_minmax(0,1fr)]">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-semibold">{cohort.label}</div>
                          <span className="font-mono text-xs">
                            {cohort.confidenceLabel}
                          </span>
                        </div>
                        <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                          {cohort.detail}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {cohort.evidence.map((signal) => (
                            <span
                              key={signal}
                              className="border border-[#161616]/25 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/25"
                            >
                              {signal}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="border-t border-[#161616]/10 pt-3 sm:border-t-0 sm:pt-0 dark:border-[#f4f1ea]/10">
                        <div className="grid grid-cols-[1fr_auto] gap-3">
                          <span className="font-semibold">Guardrails</span>
                          <span className="font-mono">
                            {cohort.guardrailCount}
                          </span>
                        </div>
                        <p className="mt-2 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                          {cohort.nextAction}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Cohorts will appear after explicit preferences, reads, saves,
                  or Less feedback.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Collaborative Signals</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {collaborativeSignals.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {collaborativeSignals.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {collaborativeSignals.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {collaborativeSignals.signals.length > 0 ? (
                collaborativeSignals.signals.map((signal) => (
                  <div
                    key={signal.label}
                    className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                  >
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,0.52fr)_minmax(0,1fr)]">
                      <div>
                        <div className="grid grid-cols-[1fr_auto] gap-3">
                          <div className="font-semibold">{signal.label}</div>
                          <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                            {signal.liftLabel}
                          </span>
                        </div>
                        <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                          {signal.detail}
                        </p>
                        <p className="mt-2 leading-6">{signal.action}</p>
                      </div>
                      <div className="grid gap-2">
                        {signal.stories.map((story) => (
                          <Link
                            key={`${signal.label}-${story.id}`}
                            className="grid gap-1 border-t border-[#161616]/15 pt-2 hover:text-[#8a241c] dark:border-[#f4f1ea]/10 dark:hover:text-[#ff8b7e]"
                            href={`/news/${story.id}`}
                          >
                            <span className="truncate font-semibold">
                              {story.title}
                            </span>
                            <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                              {story.sourceName} / {story.scoreLabel}
                            </span>
                            <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                              {story.reason}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Collaborative signals will appear after reader cohorts and
                  ranked stories exist.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Alert Routing</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {alertRouting.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 text-right font-mono text-sm dark:border-[#f4f1ea]">
                {alertRouting.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {alertRouting.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-4 lg:grid-cols-4">
              {alertRouting.lanes.map((lane) => (
                <div
                  key={lane.key}
                  className="grid content-start gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <h3 className="font-semibold">{lane.label}</h3>
                    <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                      {lane.count} / {lane.shareLabel}
                    </span>
                  </div>
                  <p className="leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {lane.summary}
                  </p>
                  <div className="grid gap-2">
                    {lane.stories.length > 0 ? (
                      lane.stories.map((story) => {
                        const storyBody = (
                          <>
                            <span className="leading-5 font-semibold">
                              {story.deliveryLabel}: {story.title}
                            </span>
                            <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                              {story.sourceName} / {story.reason} /{" "}
                              {story.scoreLabel}
                            </span>
                          </>
                        );

                        return isPreview ? (
                          <div
                            key={story.id}
                            className="grid gap-1 border-t border-[#161616]/10 pt-2 dark:border-[#f4f1ea]/10"
                          >
                            {storyBody}
                          </div>
                        ) : (
                          <Link
                            key={story.id}
                            className="grid gap-1 border-t border-[#161616]/10 pt-2 hover:text-[#8a241c] dark:border-[#f4f1ea]/10 dark:hover:text-[#ff8b7e]"
                            href={`/news/${story.id}`}
                          >
                            {storyBody}
                          </Link>
                        );
                      })
                    ) : (
                      <p className="border-t border-[#161616]/10 pt-2 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/10 dark:text-[#bbb4aa]">
                        No stories in this route.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Session Intent</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {sessionIntent.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {sessionIntent.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {sessionIntent.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {sessionIntent.intents.length > 0 ? (
                sessionIntent.intents.map((intent) => (
                  <div
                    key={intent.label}
                    className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                  >
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,0.58fr)_minmax(0,1fr)]">
                      <div>
                        <div className="grid grid-cols-[1fr_auto] gap-3">
                          <div className="font-semibold">{intent.label}</div>
                          <span className="font-mono">
                            {intent.score} / {intent.candidateCount}
                          </span>
                        </div>
                        <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                          {intent.nextAction}
                        </p>
                        {intent.evidence.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {intent.evidence.map((signal) => (
                              <span
                                key={signal}
                                className="border border-[#161616]/25 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/25"
                              >
                                {signal}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                            No session evidence yet.
                          </p>
                        )}
                      </div>
                      <div className="border-t border-[#161616]/10 pt-3 lg:border-t-0 lg:pt-0 dark:border-[#f4f1ea]/10">
                        <div className="grid grid-cols-[1fr_auto] gap-3">
                          <span className="font-semibold">Lead candidate</span>
                          <span className="font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                            {intent.guardrailCount} guardrails
                          </span>
                        </div>
                        {intent.leadStory ? (
                          <Link
                            className="mt-2 block leading-5 font-semibold hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                            href={`/news/${intent.leadStory.id}`}
                          >
                            {intent.leadStory.title}
                            <span className="mt-1 block font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                              {intent.leadStory.sourceName}
                            </span>
                          </Link>
                        ) : (
                          <p className="mt-2 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                            No matching candidate is ready for this intent.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Read, save, or hide stories to let the next session declare an
                  intent.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Profile Ledger</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {profileSignalLedger.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {profileSignalLedger.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {profileSignalLedger.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {profileSignalLedger.entries.map((entry) => (
                <div
                  key={entry.label}
                  className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,0.55fr)_minmax(0,1fr)]">
                    <div>
                      <div className="grid grid-cols-[1fr_auto] gap-3">
                        <div className="font-semibold">{entry.label}</div>
                        <span className="font-mono">{entry.count}</span>
                      </div>
                      <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        {entry.detail}
                      </p>
                    </div>
                    <div>
                      <div className="grid grid-cols-[1fr_auto] gap-3">
                        <span className="font-semibold">{entry.effect}</span>
                        <span className="font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {entry.source}
                        </span>
                      </div>
                      {entry.signals.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {entry.signals.map((signal) => (
                            <span
                              key={signal}
                              className="border border-[#161616]/25 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/25"
                            >
                              {signal}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          No active signals in this source.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Feed Governor</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {feedGovernor.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {feedGovernor.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {feedGovernor.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {feedGovernor.risks.map((risk) => (
                <div
                  key={risk.label}
                  className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="font-semibold">{risk.label}</div>
                  <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {risk.detail}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3">
              {feedGovernor.controls.length > 0 ? (
                feedGovernor.controls.map((control) => (
                  <div
                    key={`${control.action}-${control.signal ?? control.label}`}
                    className="grid gap-3 border-t border-[#161616]/20 pt-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center dark:border-[#f4f1ea]/15"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold">{control.label}</div>
                      <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        {control.reason}
                      </p>
                    </div>
                    <Button
                      className="rounded-none whitespace-nowrap"
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() =>
                        commitProfile((current) => {
                          if (control.action === "increase_novelty") {
                            return {
                              ...current,
                              noveltyBias: increaseProfileBias(
                                current.noveltyBias,
                              ),
                            };
                          }

                          if (control.action === "increase_recency") {
                            return {
                              ...current,
                              recencyBias: increaseProfileBias(
                                current.recencyBias,
                              ),
                            };
                          }

                          if (control.action === "reset_balance") {
                            return {
                              ...current,
                              noveltyBias: 1,
                              recencyBias: 1,
                            };
                          }

                          if (
                            control.action === "follow_source" &&
                            control.signal
                          ) {
                            return {
                              ...current,
                              preferredSources: toggleValue(
                                current.preferredSources,
                                control.signal,
                              ),
                            };
                          }

                          if (
                            control.action === "follow_topic" &&
                            control.signal
                          ) {
                            return {
                              ...current,
                              preferredCategories: toggleValue(
                                current.preferredCategories,
                                control.signal,
                              ),
                            };
                          }

                          if (
                            control.action === "follow_entity" &&
                            control.signal
                          ) {
                            return {
                              ...current,
                              preferredEntities: toggleValue(
                                current.preferredEntities,
                                control.signal,
                              ),
                            };
                          }

                          return current;
                        })
                      }
                    >
                      {control.buttonLabel}
                    </Button>
                  </div>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Feed controls will appear once ranked stories are available.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Distribution Queue</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {distributionQueue.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {distributionQueue.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {distributionQueue.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-4 lg:grid-cols-4">
              {distributionQueue.queues.map((queue) => (
                <div
                  key={queue.key}
                  className="grid content-start gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <h3 className="font-semibold">{queue.label}</h3>
                    <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                      {queue.count} / {queue.shareLabel}
                    </span>
                  </div>
                  <p className="leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {queue.summary}
                  </p>
                  <div className="grid gap-2">
                    {queue.stories.length > 0 ? (
                      queue.stories.map((story) => {
                        const storyBody = (
                          <>
                            <span className="leading-5 font-semibold">
                              {story.title}
                            </span>
                            <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                              {story.sourceName} / {story.reason} /{" "}
                              {story.scoreLabel}
                            </span>
                          </>
                        );

                        return isPreview ? (
                          <div
                            key={story.id}
                            className="grid gap-1 border-t border-[#161616]/10 pt-2 dark:border-[#f4f1ea]/10"
                          >
                            {storyBody}
                          </div>
                        ) : (
                          <Link
                            key={story.id}
                            className="grid gap-1 border-t border-[#161616]/10 pt-2 hover:text-[#8a241c] dark:border-[#f4f1ea]/10 dark:hover:text-[#ff8b7e]"
                            href={`/news/${story.id}`}
                          >
                            {storyBody}
                          </Link>
                        );
                      })
                    ) : (
                      <p className="border-t border-[#161616]/10 pt-2 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/10 dark:text-[#bbb4aa]">
                        No stories in this queue.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Next Refresh</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {nextRefreshPlan.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {nextRefreshPlan.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              {nextRefreshPlan.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="grid gap-2">
                <h3 className="font-mono text-xs tracking-[0.18em] uppercase">
                  Boosts
                </h3>
                {nextRefreshPlan.boosts.length > 0 ? (
                  nextRefreshPlan.boosts.map((signal) => (
                    <div
                      key={`${signal.label}-${signal.weightLabel}`}
                      className="grid grid-cols-[1fr_auto] gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <span>
                        <span className="block font-semibold">
                          {signal.label}
                        </span>
                        <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {signal.detail}
                        </span>
                      </span>
                      <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                        {signal.weightLabel}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    Save or read stories to create positive refresh signals.
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <h3 className="font-mono text-xs tracking-[0.18em] uppercase">
                  Dampers
                </h3>
                {nextRefreshPlan.dampers.length > 0 ? (
                  nextRefreshPlan.dampers.map((signal) => (
                    <div
                      key={`${signal.label}-${signal.weightLabel}`}
                      className="grid grid-cols-[1fr_auto] gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <span>
                        <span className="block font-semibold">
                          {signal.label}
                        </span>
                        <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {signal.detail}
                        </span>
                      </span>
                      <span className="font-mono text-[#5b5750] dark:text-[#bbb4aa]">
                        {signal.weightLabel}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    Less feedback will dampen repeated topics and sources here.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {nextRefreshPlan.slots.length > 0 ? (
                nextRefreshPlan.slots.map((item) => (
                  <Link
                    key={item.id}
                    className="grid gap-1 border-t border-[#161616]/20 pt-3 text-sm hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                    href={`/news/${item.id}`}
                  >
                    <span className="leading-5 font-semibold">
                      {item.title}
                    </span>
                    <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                      {item.sourceName} / {item.reason} / {item.scoreLabel}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Candidate refresh slots will appear after the desk ranks
                  stories.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Personalization Mix</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {personalizationMix.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {personalizationMix.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {personalizationMix.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-4 lg:grid-cols-4">
              {personalizationMix.objectives.map((objective) => (
                <div
                  key={objective.label}
                  className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <h3 className="font-semibold">{objective.label}</h3>
                    <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                      {objective.count} / {objective.shareLabel}
                    </span>
                  </div>
                  <p className="mt-2 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {objective.detail}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {personalizationMix.actions.map((action) => (
                <div
                  key={action.label}
                  className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="font-semibold">{action.label}</div>
                  <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {action.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Feed Recipe</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {feedRecipe.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {feedRecipe.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              {feedRecipe.signals.map((signal) => (
                <div
                  key={signal.label}
                  className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                >
                  <dt className="text-xs font-semibold text-[#5b5750] dark:text-[#bbb4aa]">
                    {signal.label}
                  </dt>
                  <dd className="mt-1 font-mono text-lg">{signal.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 grid gap-3">
              {feedRecipe.slices.map((slice) => (
                <div
                  key={slice.label}
                  className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,0.55fr)_minmax(0,1fr)]">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-semibold">{slice.label}</div>
                        <span className="font-mono text-xs">
                          {slice.count} / {slice.percentage}%
                        </span>
                      </div>
                      <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        {slice.detail}
                      </p>
                    </div>
                    <div className="grid gap-2">
                      {slice.stories.length > 0 ? (
                        slice.stories.map((story) => (
                          <div
                            key={story.id}
                            className="grid grid-cols-[1fr_auto] gap-3 border-t border-[#161616]/10 pt-2 first:border-t-0 first:pt-0 dark:border-[#f4f1ea]/10"
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
                        ))
                      ) : (
                        <p className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          No stories in this slice.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Ranking Pipeline</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {rankingPipeline.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {rankingPipeline.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {rankingPipeline.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3 lg:grid-cols-4">
              {rankingPipeline.stages.map((stage) => (
                <div
                  key={stage.label}
                  className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">{stage.label}</h3>
                    <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                      {stage.value}
                    </span>
                  </div>
                  <p className="mt-2 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {stage.detail}
                  </p>
                  {stage.signals.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {stage.signals.map((signal) => (
                        <span
                          key={signal}
                          className="border border-[#161616]/20 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/20"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                      No stage signals yet.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Exploration Slots</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {explorationSlots.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {explorationSlots.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {explorationSlots.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {explorationSlots.slots.length > 0 ? (
                explorationSlots.slots.map((slot) => (
                  <Link
                    key={slot.id}
                    className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                    href={`/news/${slot.id}`}
                  >
                    <span className="leading-5 font-semibold">
                      {slot.title}
                    </span>
                    <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                      {slot.sourceName} / {slot.reason} / {slot.scoreLabel}
                    </span>
                    <span className="w-fit border border-[#161616]/20 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/20">
                      {slot.signal}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] lg:col-span-3 dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Outside-profile stories will appear here when the feed has
                  enough breadth.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Channel Compare</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {channelComparison.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {channelComparison.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              {channelComparison.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {channelComparison.channels.length > 0 ? (
                channelComparison.channels.map((channel) => (
                  <div
                    key={channel.key}
                    className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold">{channel.label}</h3>
                      <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                        {channel.scoreLabel}
                      </span>
                    </div>
                    <Link
                      className="mt-2 block text-sm leading-5 font-semibold hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                      href={`/news/${channel.lead.id}`}
                    >
                      {channel.lead.title}
                    </Link>
                    <p className="mt-1 text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                      {channel.lead.sourceName} / {channel.reason}
                    </p>
                    <div className="mt-3 grid gap-2">
                      {channel.topStories.map((story, index) => (
                        <Link
                          key={story.id}
                          className="grid grid-cols-[1.5rem_1fr] gap-2 text-xs leading-5 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                          href={`/news/${story.id}`}
                        >
                          <span className="font-mono text-[#5b5750] dark:text-[#bbb4aa]">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span>
                            <span className="block font-semibold">
                              {story.title}
                            </span>
                            <span className="text-[#5b5750] dark:text-[#bbb4aa]">
                              {story.sourceName}
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Channel comparison will appear after stories are ranked.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Missed Coverage</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {missedCoverage.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {missedCoverage.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              {missedCoverage.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {missedCoverage.stories.length > 0 ? (
                missedCoverage.stories.map((item) => (
                  <Link
                    key={item.id}
                    className="grid gap-1 border-t border-[#161616]/20 pt-3 text-sm hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                    href={`/news/${item.id}`}
                  >
                    <span className="leading-5 font-semibold">
                      {item.title}
                    </span>
                    <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                      {item.sourceName} / {item.reason} / {item.scoreLabel}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Keep reading the front page and this rail will catch
                  high-signal stories that slipped below the lead stack.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Fatigue Throttle</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {fatigueReport.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {fatigueReport.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {fatigueReport.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {fatigueReport.notices.map((notice) => (
                <div
                  key={notice.label}
                  className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="font-semibold">{notice.label}</div>
                  <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {notice.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Channel Strategy</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {channelStrategy.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {channelStrategy.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {channelStrategy.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {channelStrategy.lanes.length > 0 ? (
                channelStrategy.lanes.map((lane) => (
                  <div
                    key={lane.label}
                    className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                  >
                    <div className="grid grid-cols-[1fr_auto] gap-3">
                      <div className="font-semibold">{lane.label}</div>
                      <span className="font-mono text-xs">
                        {lane.count} / {lane.share}%
                      </span>
                    </div>
                    <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                      {lane.detail}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                      {lane.action}
                    </p>
                  </div>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Channel strategy will appear after the edition has ranked
                  stories.
                </p>
              )}
            </div>
            <div className="mt-4 grid gap-3">
              {channelStrategy.priorities.map((priority) => (
                <div
                  key={priority.label}
                  className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="font-semibold">{priority.label}</div>
                  <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {priority.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Training Loop</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {trainingUpdate
                    ? trainingUpdate.summary
                    : "Save, share, open sources, or press Less to train the next edition."}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {trainingUpdate?.label ?? "Waiting"}
              </span>
            </div>
            {trainingUpdate ? (
              <>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  {trainingUpdate.metrics.map((metric) => (
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
                <div className="mt-4 grid gap-3">
                  {trainingUpdate.signals.map((signal) => (
                    <div
                      key={`${signal.label}-${signal.value}`}
                      className="grid gap-1 border-t border-[#161616]/20 pt-3 text-sm sm:grid-cols-[5rem_1fr] dark:border-[#f4f1ea]/15"
                    >
                      <span className="font-semibold">{signal.label}</span>
                      <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {signal.value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-3">
                  {trainingUpdate.notices.map((notice) => (
                    <div
                      key={notice.label}
                      className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <div className="font-semibold">{notice.label}</div>
                      <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        {notice.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <StatusLine
                  label="Reader signals"
                  value={String(readerSignalSummary.signalCount)}
                />
                <StatusLine
                  label="Profile"
                  value={readerSignalSummary.strength}
                />
              </dl>
            )}
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Feedback Coach</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {feedbackCoach.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {feedbackCoach.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              {feedbackCoach.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {feedbackCoach.actions.length > 0 ? (
                feedbackCoach.actions.map((suggestion) => {
                  const suggestedStory = rankedItems.find(
                    (story) => story.id === suggestion.storyId,
                  );
                  const suggestedRankSlot = suggestedStory
                    ? rankedItems.findIndex(
                        (story) => story.id === suggestedStory.id,
                      )
                    : 0;

                  return (
                    <div
                      key={`${suggestion.action}-${suggestion.storyId}`}
                      className="grid gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <div className="grid grid-cols-[1fr_auto] gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold">
                            {suggestion.label}
                          </div>
                          <div className="mt-1 leading-5">
                            {suggestion.storyTitle}
                          </div>
                        </div>
                        <Button
                          className="rounded-none"
                          disabled={!suggestedStory || isPreview}
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            suggestedStory
                              ? recordStoryAction(
                                  suggestedStory,
                                  suggestion.action,
                                  suggestedRankSlot,
                                )
                              : undefined
                          }
                        >
                          {suggestion.buttonLabel}
                        </Button>
                      </div>
                      <p className="leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        {suggestion.reason}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Feedback suggestions will appear once the ranked edition has
                  stories to tune.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Live Wire</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {liveWire.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {liveWire.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {liveWire.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {liveWire.updates.length > 0 ? (
                liveWire.updates.map((update) => {
                  const updateTitle = (
                    <span className="leading-5 font-semibold">
                      {update.title}
                    </span>
                  );

                  return (
                    <div
                      key={update.id}
                      className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.12em] uppercase">
                        <span className="text-[#8a241c] dark:text-[#ff8b7e]">
                          {update.signal}
                        </span>
                        <span className="text-[#78746c]">/</span>
                        <span>{formatTime(update.publishedAt)}</span>
                        <span className="text-[#78746c]">/</span>
                        <span>{update.categoryLabel}</span>
                      </div>
                      {isPreview ? (
                        <div className="mt-2">{updateTitle}</div>
                      ) : (
                        <Link
                          className="mt-2 block hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                          href={`/news/${update.id}`}
                        >
                          {updateTitle}
                        </Link>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                        <span>{update.sourceName}</span>
                        <span className="font-mono">
                          trend {update.trendScore} / score{" "}
                          {update.personalizedScore}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Live wire will appear after the first ranked crawl.
                </p>
              )}
            </div>
            <div className="mt-4 grid gap-3">
              {liveWire.notices.map((notice) => (
                <div
                  key={notice.label}
                  className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="font-semibold">{notice.label}</div>
                  <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {notice.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Edition Schedule</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {editionSchedule.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {editionSchedule.slots.length}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {editionSchedule.slots.length > 0 ? (
                editionSchedule.slots.map((slot) => {
                  const storyTitle = (
                    <span className="leading-5 font-semibold">
                      {slot.story.title}
                    </span>
                  );

                  return (
                    <div
                      key={`${slot.timeLabel}-${slot.story.id}`}
                      className="grid grid-cols-[3.25rem_1fr_auto] gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                        {slot.timeLabel}
                      </span>
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] tracking-[0.14em] uppercase">
                          {slot.label} / {slot.intent}
                        </div>
                        {isPreview ? (
                          <div className="mt-1">{storyTitle}</div>
                        ) : (
                          <Link
                            className="mt-1 block hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                            href={`/news/${slot.story.id}`}
                          >
                            {storyTitle}
                          </Link>
                        )}
                        <p className="mt-1 leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {slot.reason}
                        </p>
                        <div className="mt-1 text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {slot.story.sourceName}
                        </div>
                      </div>
                      <span className="font-mono text-xs">
                        {slot.story.personalizedScore}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Timed slots will appear after the edition has ranked stories.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Today&apos;s Queue</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {readingQueue.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {readingQueue.slots.length}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {readingQueue.slots.length > 0 ? (
                readingQueue.slots.map((slot, index) => {
                  const storyTitle = (
                    <span className="leading-5 font-semibold">
                      {slot.story.title}
                    </span>
                  );

                  return (
                    <div
                      key={`${slot.intent}-${slot.story.id}`}
                      className="grid grid-cols-[2rem_1fr_auto] gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] tracking-[0.14em] uppercase">
                          {slot.label} / {slot.intent}
                        </div>
                        {isPreview ? (
                          <div className="mt-1">{storyTitle}</div>
                        ) : (
                          <Link
                            className="mt-1 block hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                            href={`/news/${slot.story.id}`}
                          >
                            {storyTitle}
                          </Link>
                        )}
                        <p className="mt-1 leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {slot.reason}
                        </p>
                        <div className="mt-1 text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {slot.story.sourceName}
                        </div>
                      </div>
                      <span className="font-mono text-xs">
                        {slot.story.personalizedScore}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  The queue will build itself after the edition has ranked
                  stories.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Recommendation Audit</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {recommendationAudit.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {recommendationAudit.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {recommendationAudit.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {recommendationAudit.notices.map((notice) => (
                <div
                  key={notice.label}
                  className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="font-semibold">{notice.label}</div>
                  <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {notice.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Editorial Guardrails</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {editorialGuardrails.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {editorialGuardrails.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {editorialGuardrails.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {editorialGuardrails.risks.length > 0 ? (
                editorialGuardrails.risks.map((risk) => (
                  <div
                    key={risk.label}
                    className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                  >
                    <div className="grid grid-cols-[1fr_auto] gap-3">
                      <div className="font-semibold">{risk.label}</div>
                      <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                        {risk.severity}
                      </span>
                    </div>
                    <p className="mt-2 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                      {risk.detail}
                    </p>
                    <p className="mt-2 leading-6">{risk.action}</p>
                    <div className="mt-3 grid gap-2">
                      {risk.stories.map((story) => (
                        <Link
                          key={`${risk.label}-${story.id}`}
                          className="grid gap-1 border-t border-[#161616]/15 pt-2 hover:text-[#8a241c] dark:border-[#f4f1ea]/10 dark:hover:text-[#ff8b7e]"
                          href={`/news/${story.id}`}
                        >
                          <span className="leading-5 font-semibold">
                            {story.title}
                          </span>
                          <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                            {story.sourceName}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Source, trust, consensus, and negative-feedback controls are
                  clear for this ranked slice.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Topic Match Matrix</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {topicMatchMatrix.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {topicMatchMatrix.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {topicMatchMatrix.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {topicMatchMatrix.rows.length > 0 ? (
                topicMatchMatrix.rows.map((row) => (
                  <div
                    key={row.category}
                    className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                  >
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_auto] sm:items-start">
                      <div>
                        <div className="font-semibold">{row.label}</div>
                        <div className="mt-1 font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {row.mode} / {row.readerLabel} / {row.heatLabel}
                        </div>
                      </div>
                      {row.lead ? (
                        <Link
                          className="leading-5 font-semibold hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                          href={`/news/${row.lead.id}`}
                        >
                          {row.lead.title}
                          <span className="mt-1 block text-xs font-normal text-[#5b5750] dark:text-[#bbb4aa]">
                            {row.lead.sourceName}
                          </span>
                        </Link>
                      ) : (
                        <p className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          Waiting for a lead story.
                        </p>
                      )}
                      <span className="font-mono text-xs">
                        {row.storyCount}
                      </span>
                    </div>
                    <p className="mt-2 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                      {row.reason}
                    </p>
                  </div>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Topic match matrix will appear after stories are ranked.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Interest Graph</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {interestGraph.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {interestGraph.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {interestGraph.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-4">
              {interestGraph.lanes.map((lane) => (
                <div
                  key={lane.key}
                  className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <h3 className="font-semibold">{lane.label}</h3>
                    <span className="font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                      {lane.nodes.length}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3">
                    {lane.nodes.length > 0 ? (
                      lane.nodes.map((node) => (
                        <div
                          key={`${lane.key}-${node.label}`}
                          className="text-sm"
                        >
                          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                            <div className="min-w-0 truncate font-semibold">
                              {node.label}
                            </div>
                            <span className="font-mono text-xs">
                              {node.score}
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 border border-[#161616]/30 dark:border-[#f4f1ea]/25">
                            <div
                              className="h-full bg-[#8a241c] dark:bg-[#ff8b7e]"
                              style={{
                                width: `${Math.min(node.score, 100)}%`,
                              }}
                            />
                          </div>
                          <div className="mt-1 text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                            {node.storyCount}{" "}
                            {node.storyCount === 1 ? "story" : "stories"} /{" "}
                            {node.activeSignal ? "active signal" : "discovered"}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        This lane will fill as the reader profile and story mix
                        develop.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3">
              {interestGraph.notices.map((notice) => (
                <div
                  key={notice.label}
                  className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="font-semibold">{notice.label}</div>
                  <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {notice.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Source Balance</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {sourceBalance.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {sourceBalance.concentration}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <StatusLine
                label="Sources"
                value={`${sourceBalance.uniqueSourceCount}/${sourceBalance.totalCount}`}
              />
              <StatusLine
                label="Leader"
                value={sourceBalance.dominantSource?.name ?? "None"}
              />
              <StatusLine
                label="Share"
                value={
                  sourceBalance.dominantSource
                    ? `${sourceBalance.dominantSource.percentage}%`
                    : "0%"
                }
              />
            </dl>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Source Trust</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {sourceTrustLedger.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {sourceTrustLedger.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {sourceTrustLedger.metrics.map((metric) => (
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
            {sourceTrustLedger.notices.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {sourceTrustLedger.notices.map((notice) => (
                  <div
                    key={notice.label}
                    className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                  >
                    <div className="font-semibold">{notice.label}</div>
                    <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                      {notice.detail}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Edition Mix</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {editionMix.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {editionMix.totalCount}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {editionMix.segments.map((segment) => (
                <div
                  key={segment.label}
                  className="grid grid-cols-[1fr_auto] gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="min-w-0">
                    <div className="font-semibold">{segment.label}</div>
                    <div className="mt-1 text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                      {segment.detail}
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div>{segment.count}</div>
                    <div className="mt-1 text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                      {segment.percentage}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Entity Radar</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  People, companies, models, and projects recurring across the
                  edition.
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {entityRadar.length}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {entityRadar.length > 0 ? (
                entityRadar.map((entry, index) => (
                  <div
                    key={entry.entity}
                    className="grid grid-cols-[2rem_1fr_auto] items-start gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                  >
                    <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        {entry.entity}
                      </div>
                      <div className="mt-1 text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                        {entry.storyCount} stories / {entry.sourceCount} sources
                      </div>
                    </div>
                    <span className="font-mono">{entry.heatScore}</span>
                  </div>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Entity radar will appear as stories share names, products, or
                  companies.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Topic Pulse</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  Clusters in the current edition, ranked by volume and heat.
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {topicPulse.length}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {topicPulse.length > 0 ? (
                topicPulse.map((pulse, index) => (
                  <div
                    key={pulse.category}
                    className="grid grid-cols-[2rem_1fr_auto] items-start gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                  >
                    <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold">
                        {getCategoryLabel(pulse.category)}
                      </div>
                      <div className="mt-1 truncate text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                        {pulse.storyCount} stories / {pulse.sources.join(", ")}
                      </div>
                    </div>
                    <span className="font-mono">{pulse.heatScore}</span>
                  </div>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Topic clusters will appear as the edition fills.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Reader Memory</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {readerMemory.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {readerMemory.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {readerMemory.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {readerMemory.highlights.map((highlight) => (
                <div
                  key={highlight.label}
                  className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="font-semibold">{highlight.label}</div>
                  <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {highlight.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Interest Drift</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {interestDrift.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {interestDrift.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {interestDrift.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3">
              {interestDrift.notices.map((notice) => (
                <div
                  key={notice.label}
                  className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="font-semibold">{notice.label}</div>
                  <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {notice.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Saved</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  Your reading list follows the same anonymous reader key as the
                  For You feed.
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {savedItems.length}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {savedItems.length > 0 ? (
                savedItems.map((item) => (
                  <Link
                    key={item.id}
                    className="grid gap-1 border-t border-[#161616]/20 pt-3 text-sm hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                    href={`/news/${item.id}`}
                  >
                    <span className="leading-5 font-semibold">
                      {item.title}
                    </span>
                    <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                      {item.sourceName} / saved{" "}
                      {item.savedAt ? formatTime(item.savedAt) : "recently"}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Save stories from the front page to build a personal reading
                  queue.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Continue Reading</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {continuationRail.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {continuationRail.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              {continuationRail.metrics.map((metric) => (
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
            {continuationRail.anchor ? (
              <div className="mt-4 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15">
                <div className="font-semibold">
                  {continuationRail.anchor.title}
                </div>
                <p className="mt-1 text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                  {continuationRail.anchor.sourceName} /{" "}
                  {continuationRail.anchor.categoryLabel}
                </p>
              </div>
            ) : null}
            <div className="mt-4 grid gap-3">
              {continuationRail.followUps.length > 0
                ? continuationRail.followUps.map((item) => (
                    <Link
                      key={item.id}
                      className="grid gap-1 border-t border-[#161616]/20 pt-3 text-sm hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                      href={`/news/${item.id}`}
                    >
                      <span className="leading-5 font-semibold">
                        {item.title}
                      </span>
                      <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                        {item.sourceName} / {item.reason} / {item.scoreLabel}
                      </span>
                    </Link>
                  ))
                : continuationRail.notices.map((notice) => (
                    <div
                      key={notice.label}
                      className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <div className="font-semibold">{notice.label}</div>
                      <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        {notice.detail}
                      </p>
                    </div>
                  ))}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Recently Read</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  Opened stories become a lightweight trail for follow-up
                  recommendations.
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {historyItems.length}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {historyItems.length > 0 ? (
                historyItems.map((item) => (
                  <Link
                    key={item.id}
                    className="grid gap-1 border-t border-[#161616]/20 pt-3 text-sm hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                    href={`/news/${item.id}`}
                  >
                    <span className="leading-5 font-semibold">
                      {item.title}
                    </span>
                    <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                      {item.sourceName} / read{" "}
                      {item.viewedAt ? formatTime(item.viewedAt) : "recently"}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Open stories to build a reading trail for the next edition.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <h2 className="text-xl font-black">Signal Board</h2>
            <div className="mt-4 grid gap-3">
              {rankedItems.slice(0, 5).map((story, index) => {
                const rankDetails = getNewsStoryRankDetails({
                  item: story,
                  mode: feedMode,
                  now: rankDetailsAt,
                });

                return (
                  <div
                    key={story.id}
                    className="grid grid-cols-[2rem_1fr_auto] items-start gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                  >
                    <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="leading-5">
                      {story.title}
                      <span className="mt-1 block text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                        {rankDetails.summary}
                      </span>
                    </span>
                    <span className="font-mono">{rankDetails.scoreLabel}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-[#161616] p-5 text-[#f4f1ea] dark:bg-[#f4f1ea] dark:text-[#161616]">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-black">Desk Status</h2>
              <span className="border border-current px-2 py-1 font-mono text-xs">
                {deskStatusSummary.label}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 opacity-80">
              {deskStatusSummary.detail}
            </p>
            <div className="mt-4 grid gap-2 border-y border-current/20 py-4">
              {readinessChecklist.map((item) => (
                <div
                  key={item.label}
                  className="grid grid-cols-[5rem_1fr] gap-3 text-sm"
                >
                  <span className="font-mono text-xs uppercase opacity-70">
                    {item.state}
                  </span>
                  <span>
                    <span className="block font-semibold">{item.label}</span>
                    <span className="mt-1 block text-xs leading-5 opacity-70">
                      {item.detail}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <StatusLine
                label="Sources"
                value={`${formatCount(deskStatus.activeSources)}/${formatCount(deskStatus.totalSources)} active`}
              />
              <StatusLine
                label="Stories"
                value={formatCount(deskStatus.publishedStories)}
              />
              <StatusLine
                label="Latest story"
                value={formatOptionalTime(deskStatus.latestPublishedAt)}
              />
              <StatusLine
                label="Last refresh"
                value={formatLastRun(deskStatus.latestRun)}
              />
              <StatusLine
                label="Run yield"
                value={formatRunYield(deskStatus.latestRun)}
              />
            </dl>
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
  rankedAt,
}: {
  item: RankedNewsHomeItem;
  className?: string;
  mode: NewsFeedMode;
  rankedAt: Date;
}) {
  const rankDetails = getNewsStoryRankDetails({
    item,
    mode,
    now: rankedAt,
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
        className={cn(
          "min-h-52 bg-cover bg-center grayscale",
          featured && "mt-6 md:mt-0",
        )}
        style={{ backgroundImage: `url(${item.imageUrl})` }}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-52 items-end justify-between border border-[#161616] bg-[#e8e1d4] p-4 dark:border-[#f4f1ea] dark:bg-[#24211d]",
        featured && "mt-6 md:mt-0",
      )}
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
  isPreview,
  rankSlot,
  onAction,
}: {
  item: RankedNewsHomeItem;
  isPreview: boolean;
  rankSlot: number;
  onAction: (
    item: RankedNewsHomeItem,
    action: ReaderInteractionAction,
    rankSlot: number,
  ) => void;
}) {
  if (isPreview) {
    return (
      <p className="max-w-xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
        Live collection will replace preview desk notes after sources and schema
        are initialized in production.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild className="rounded-none">
        <Link
          href={`/news/${item.id}`}
          onClick={() => onAction(item, "view", rankSlot)}
        >
          Read
        </Link>
      </Button>
      <Button
        className="rounded-none"
        type="button"
        variant="outline"
        onClick={() => onAction(item, "save", rankSlot)}
      >
        Save
      </Button>
      <Button
        className="rounded-none"
        type="button"
        variant="outline"
        onClick={() => onAction(item, "share", rankSlot)}
      >
        Share
      </Button>
      <Button
        className="rounded-none"
        type="button"
        variant="outline"
        onClick={() => onAction(item, "hide", rankSlot)}
      >
        Less
      </Button>
      {item.canonicalUrl ? (
        <Button asChild className="rounded-none" variant="outline">
          <a
            href={item.canonicalUrl}
            onClick={() => onAction(item, "click_source", rankSlot)}
            rel="nofollow noopener noreferrer"
            target="_blank"
          >
            Source
          </a>
        </Button>
      ) : null}
    </div>
  );
}

function StoryCard({
  item,
  isPreview,
  mode,
  rankSlot,
  rankedAt,
  onAction,
}: {
  item: RankedNewsHomeItem;
  isPreview: boolean;
  mode: NewsFeedMode;
  rankSlot: number;
  rankedAt: Date;
  onAction: (
    item: RankedNewsHomeItem,
    action: ReaderInteractionAction,
    rankSlot: number,
  ) => void;
}) {
  return (
    <article className="grid gap-3 border border-[#161616]/35 bg-[#fffdf7] p-4 dark:border-[#f4f1ea]/35 dark:bg-[#181818]">
      <StoryVisual item={item} />
      <div className="text-xs font-semibold tracking-normal text-[#8a241c] uppercase dark:text-[#ff8b7e]">
        {getCategoryLabel(item.category)}
      </div>
      <h3 className="text-xl leading-tight font-black">{item.title}</h3>
      <p className="line-clamp-4 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
        {item.summary}
      </p>
      <RecommendationReasons item={item} mode={mode} rankedAt={rankedAt} />
      {!isPreview ? (
        <StoryAction
          item={item}
          isPreview={isPreview}
          rankSlot={rankSlot}
          onAction={onAction}
        />
      ) : null}
    </article>
  );
}

function StoryRow({
  item,
  isPreview,
  mode,
  rankSlot,
  rankedAt,
  onAction,
}: {
  item: RankedNewsHomeItem;
  isPreview: boolean;
  mode: NewsFeedMode;
  rankSlot: number;
  rankedAt: Date;
  onAction: (
    item: RankedNewsHomeItem,
    action: ReaderInteractionAction,
    rankSlot: number,
  ) => void;
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
          rankedAt={rankedAt}
        />
      </div>
      <div className="font-mono text-sm">
        <div>{formatTime(item.publishedAt)}</div>
        <div className="mt-1 text-[#5b5750] dark:text-[#bbb4aa]">
          Score {item.personalizedScore}
        </div>
      </div>
      <StoryAction
        item={item}
        isPreview={isPreview}
        rankSlot={rankSlot}
        onAction={onAction}
      />
    </article>
  );
}

function SignalChips({
  label,
  values,
}: {
  label: string;
  values: readonly string[];
}) {
  return (
    <div className="grid gap-2">
      <span className="font-mono text-[11px] tracking-[0.14em] uppercase">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {values.length > 0 ? (
          values.map((value) => (
            <span
              key={`${label}-${value}`}
              className="max-w-full border border-[#161616]/30 px-2 py-1 dark:border-[#f4f1ea]/25"
            >
              <span className="block truncate">{value}</span>
            </span>
          ))
        ) : (
          <span className="text-[#5b5750] dark:text-[#bbb4aa]">None yet</span>
        )}
      </div>
    </div>
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

function PreferenceGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <h3 className="font-mono text-xs tracking-[0.18em] uppercase">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function PreferenceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      className="max-w-full rounded-none"
      onClick={onClick}
    >
      <span className="truncate">{children}</span>
    </Button>
  );
}

function BiasButton({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto rounded-none py-3"
      onClick={onClick}
    >
      <span>{label}</span>
      <span className="font-mono">{value}/2</span>
    </Button>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-t border-current/25 pt-2">
      <dt>{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
