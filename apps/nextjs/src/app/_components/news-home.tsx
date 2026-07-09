"use client";

import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  NewsPreferenceProfile,
  NewsRecommendationRotationObjective,
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
  getNewsAggregationIntake,
  getNewsAggregationIntakeTrainingAction,
  getNewsAggregationRecoveryQueue,
  getNewsAggregationRecoveryTrainingAction,
  getNewsAlertRouting,
  getNewsAlertRoutingTrainingAction,
  getNewsAnglePreferenceOptions,
  getNewsBreakingEscalationQueue,
  getNewsBriefingPack,
  getNewsBriefingPackTrainingAction,
  getNewsChannelComparison,
  getNewsChannelRail,
  getNewsChannelStrategy,
  getNewsChannelStrategyTrainingAction,
  getNewsClaimTracker,
  getNewsCollaborativeSignals,
  getNewsCollaborativeSignalTrainingAction,
  getNewsConsensusBoard,
  getNewsContinuationRail,
  getNewsContinuationRailTrainingAction,
  getNewsCoverageThreads,
  getNewsDeskFreshnessStatus,
  getNewsDeskRunYieldLabel,
  getNewsDeskSourceHealthDiagnostics,
  getNewsDeskStatusSummary,
  getNewsDiscoveryLadder,
  getNewsDistributionQueue,
  getNewsDistributionQueueTrainingAction,
  getNewsEditionBriefing,
  getNewsEditionMix,
  getNewsEditionQualityGate,
  getNewsEditionQualityGateTrainingAction,
  getNewsEditionSchedule,
  getNewsEditionScheduleTrainingAction,
  getNewsEditorialGuardrails,
  getNewsEditorialGuardrailTrainingAction,
  getNewsEntityRadar,
  getNewsEntityRadarTrainingAction,
  getNewsExperimentAllocation,
  getNewsExperimentAllocationTrainingAction,
  getNewsExplorationSlots,
  getNewsExplorationSlotTrainingAction,
  getNewsExposureCooldownQueue,
  getNewsExposureCooldownTrainingAction,
  getNewsFeedbackCoach,
  getNewsFeedbackCoachActionState,
  getNewsFeedbackTrainingUpdate,
  getNewsFeedFatigueReport,
  getNewsFeedFatigueTrainingAction,
  getNewsFeedGovernor,
  getNewsFeedGovernorControlTrainingAction,
  getNewsFeedRecipe,
  getNewsFilterBubbleReport,
  getNewsFilterBubbleTrainingAction,
  getNewsForYouControlStrip,
  getNewsForYouNextQueue,
  getNewsForYouNextQueueTrainingAction,
  getNewsFrontPageLayout,
  getNewsFrontPageLayoutTrainingAction,
  getNewsFrontPageSlotMix,
  getNewsFrontPageSlotMixTrainingAction,
  getNewsGuardrailRecoveryPlan,
  getNewsGuardrailRecoveryTrainingAction,
  getNewsGuardrailRestoreTrainingUpdate,
  getNewsGuardrailShelf,
  getNewsHomeCollaborativeRankingSignals,
  getNewsHomeLoadMoreQueryRoute,
  getNewsHomeLoadMoreState,
  getNewsHomePaginationResetKey,
  getNewsHomePrimaryQueryRoute,
  getNewsHomeReaderMemoryResetCacheScopes,
  getNewsHomeStoryActionPanel,
  getNewsHomeStoryHistoryItem,
  getNewsHotBoard,
  getNewsInterestDrift,
  getNewsInterestDriftTrainingAction,
  getNewsInterestGraph,
  getNewsInterestGraphNodeTrainingAction,
  getNewsLiveWire,
  getNewsLiveWireTrainingAction,
  getNewsMembershipMeter,
  getNewsMissedCoverageShelf,
  getNewsModelTrainingBatch,
  getNewsModelTrainingBatchTrainingAction,
  getNewsNewsletterPlan,
  getNewsNextRefreshPlan,
  getNewsNextRefreshPlanTrainingAction,
  getNewsPersonalizationDataVault,
  getNewsPersonalizationDataVaultExport,
  getNewsPersonalizationDataVaultExportHref,
  getNewsPersonalizationDataVaultProfileImport,
  getNewsPersonalizationDataVaultTrainingUpdate,
  getNewsPersonalizationMix,
  getNewsPersonalizationMixTrainingAction,
  getNewsPersonalizedPushQueue,
  getNewsPersonalizedPushQueueTrainingAction,
  getNewsPersonalizedReadingQueue,
  getNewsPersonalizedReadingQueueTrainingAction,
  getNewsPreferenceBiasCycleAction,
  getNewsPreferenceBiasResetTrainingUpdate,
  getNewsPreferenceBiasResetUndoTrainingUpdate,
  getNewsPreferenceBiasTrainingUpdate,
  getNewsPreferenceBiasUndoTrainingUpdate,
  getNewsPreferenceControlPanel,
  getNewsPreferenceCoverageDebt,
  getNewsPreferenceDecayQueue,
  getNewsPreferenceDecayTrainingAction,
  getNewsPreferencePresets,
  getNewsPreferenceProfileToggleAction,
  getNewsPreferenceProfileTrainingUpdate,
  getNewsPreferenceProfileUndoTrainingUpdate,
  getNewsPreferenceStarter,
  getNewsPreferenceTuningPlan,
  getNewsPreferenceTuningTrainingUpdate,
  getNewsPreferenceTuningUndoTrainingUpdate,
  getNewsProductionReadinessChecklist,
  getNewsProfileImpactPreview,
  getNewsProfileSignalLedger,
  getNewsProfileSignalLedgerTrainingAction,
  getNewsProfileUpdateProposal,
  getNewsProfileUpdateProposalTrainingAction,
  getNewsRankingPipeline,
  getNewsReaderCohorts,
  getNewsReaderCohortTrainingAction,
  getNewsReaderDaypartPlan,
  getNewsReaderDigest,
  getNewsReaderJourneyMap,
  getNewsReaderLearningLoop,
  getNewsReaderLearningLoopTrainingAction,
  getNewsReaderMemory,
  getNewsReaderMemoryResetPersistence,
  getNewsReaderMemoryResetTrainingUpdate,
  getNewsReaderProfileSnapshot,
  getNewsReaderRankingFactors,
  getNewsReaderRetentionPlan,
  getNewsReaderRetentionTrainingAction,
  getNewsReaderSatisfactionBrief,
  getNewsReaderSatisfactionTrainingAction,
  getNewsReaderScorecards,
  getNewsReaderSignalSummary,
  getNewsReaderWatchlist,
  getNewsReaderWatchlistTrainingAction,
  getNewsRecommendationAudit,
  getNewsRecommendationAuditTrainingAction,
  getNewsRecommendationDiversityGovernor,
  getNewsRecommendationDiversityGovernorTrainingAction,
  getNewsRecommendationDiversityRepairQueue,
  getNewsRecommendationEntitySaturation,
  getNewsRecommendationNudge,
  getNewsRecommendationRotationQueue,
  getNewsRecommendationRotationTrainingAction,
  getNewsRecommendationSaturationTrainingAction,
  getNewsRecommendationSourceSaturation,
  getNewsRecommendationTopicSaturation,
  getNewsRecommendationTrace,
  getNewsRecommendationTraceTrainingAction,
  getNewsRefreshSimulation,
  getNewsRefreshSimulationTrainingAction,
  getNewsSearchCandidateRail,
  getNewsSearchTrends,
  getNewsSearchTrendTrainingAction,
  getNewsSectionFronts,
  getNewsServerProfileAuditDisplay,
  getNewsSessionIntent,
  getNewsSessionIntentTrainingAction,
  getNewsSourceBalance,
  getNewsSourceBalanceTrainingAction,
  getNewsSourceClusters,
  getNewsSourceFilterOptions,
  getNewsSourceTrustLedger,
  getNewsSourceTrustTrainingAction,
  getNewsStoryProofStrip,
  getNewsStoryQuickTuneActions,
  getNewsStoryQuickTuneTrainingUpdate,
  getNewsStoryQuickTuneUndoTrainingUpdate,
  getNewsStoryRankDetails,
  getNewsStorySourceUrl,
  getNewsStoryTimeline,
  getNewsTasteCalibration,
  getNewsTasteCalibrationTrainingAction,
  getNewsTopicHref,
  getNewsTopicMatchMatrix,
  getNewsTopicMatchTrainingAction,
  getNewsTopicPulse,
  getNewsTopicPulseTrainingAction,
  getNextNewsHomeCursorState,
  getPreviewNewsHomeItems,
  hasNewsHomeExploreFilters,
  isNewsHomePreviewEdition,
  mergeNewsHomeItems,
  mergeNewsHomePositiveFeedbackItems,
  mergeNewsReaderMemoryItems,
  mergeNewsTrainingUpdateHistory,
  removeNewsHomePositiveFeedbackItem,
  removeNewsReaderMemoryItem,
  revertNewsStoryQuickTuneAction,
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
type NewsPreferenceCoverageDebtAction = ReturnType<
  typeof getNewsPreferenceCoverageDebt
>["debts"][number]["action"];
type NewsPersonalizationDataVaultAction = ReturnType<
  typeof getNewsPersonalizationDataVault
>["controls"][number];
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
  initialItems: NewsHomeItem[];
  deskStatus: NewsDeskStatus;
  refreshConfigured: boolean;
  status: NewsHomeStatus;
  generatedAt: string;
}

interface NewsHomeForYouApiNextRequest {
  recentExposureItems?: readonly RecentExposureNewsItem[];
}

interface NewsHomeForYouApiContext {
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
    searches: number;
    semanticSimilarity: number;
  };
  objective: NewsForYouObjective;
  profileSignalCount: number;
  readerLocalHour: number | null;
}

interface NewsHomeForYouApiResponse {
  context?: NewsHomeForYouApiContext;
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
  entities: [...item.entities],
  id: item.id,
  originalUrl: item.originalUrl,
  sourceName: item.sourceName,
  sourceSlug: item.sourceSlug,
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
        tags: [...(item.tags ?? [])],
        title: item.title ?? item.id,
        viewedAt,
        ...(item.canonicalUrl !== undefined
          ? { canonicalUrl: item.canonicalUrl }
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

const numberFormatter = new Intl.NumberFormat("en");

const formatCount = (value: number) => numberFormatter.format(value);

const formatOptionalTime = (date: string | null) =>
  date ? formatNewsTime(date) : "None yet";

const formatLastRun = (run: NewsDeskStatus["latestRun"]) => {
  if (!run) return "No run yet";

  return `${run.sourceName ?? run.runType} ${run.status}`;
};

const formatRunYield = (run: NewsDeskStatus["latestRun"]) => {
  return getNewsDeskRunYieldLabel(run);
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

const increaseProfileBias = (value: number) =>
  Math.min(Math.round((value + 0.5) * 10) / 10, 2);

const decreaseProfileBias = (value: number) =>
  Math.max(Math.round((value - 0.5) * 10) / 10, 0);

const getUniqueValues = (items: readonly NewsHomeItem[], key: "sourceSlug") =>
  Array.from(new Set(items.map((item) => item[key]))).slice(0, 8);

const getTopEntities = (items: readonly NewsHomeItem[]) =>
  Array.from(new Set(items.flatMap((item) => item.entities))).slice(0, 10);

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

function NewsHomeContent({
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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewHiddenAngleQuery, setReviewHiddenAngleQuery] = useState("");
  const [feedMode, setFeedMode] = useState<NewsFeedMode>("for_you");
  const [forYouObjective, setForYouObjective] =
    useState<NewsForYouObjective>("reader_match");
  const [trainingUpdate, setTrainingUpdate] =
    useState<NewsTrainingUpdate | null>(null);
  const [trainingUpdateHistory, setTrainingUpdateHistory] = useState<
    NewsTrainingUpdate[]
  >([]);
  const [dataVaultImportDraft, setDataVaultImportDraft] = useState("");
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

      if (!visitorKey) return;

      recordSearchMemory({
        query: trimmedQuery,
        resultCount,
        visitorKey,
      });
    },
    [recordSearchMemory, visitorKey],
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
        serverItems: historyItems,
      }),
    [historyItems, localHomeExposureItems],
  );
  const positiveFeedbackMemoryItems = useMemo(() => {
    const memoryItems = [
      ...positiveFeedbackItems,
      ...serverPositiveFeedbackItems,
      ...savedItems.flatMap((item): PositiveNewsHomeFeedbackItem[] => {
        const occurredAt = item.savedAt ?? item.occurredAt;

        if (!occurredAt || !Number.isFinite(Date.parse(occurredAt))) {
          return [];
        }

        return [{ ...item, action: "save", occurredAt }];
      }),
      ...historyItems.flatMap((item): PositiveNewsHomeFeedbackItem[] => {
        const occurredAt = item.viewedAt ?? item.occurredAt;

        if (!occurredAt || !Number.isFinite(Date.parse(occurredAt))) {
          return [];
        }

        return [{ ...item, occurredAt }];
      }),
    ];

    return memoryItems.reduce<PositiveNewsHomeFeedbackItem[]>(
      (currentItems, nextItem) =>
        mergeNewsHomePositiveFeedbackItems({
          currentItems,
          nextItem,
        }),
      [],
    );
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
  useEffect(() => {
    if (primaryFeedRoute !== "forYou" || !forYouApiQuery.data) return;

    applyForYouApiExposureMemory(
      forYouApiQuery.data.nextRequest?.recentExposureItems,
    );
  }, [applyForYouApiExposureMemory, forYouApiQuery.data, primaryFeedRoute]);
  const forYouApiContext = forYouApiQuery.data?.context;
  const forYouApiContextMemory = forYouApiContext
    ? [
        {
          label: "Profile",
          value: `${forYouApiContext.profileSignalCount} signals`,
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
  const deskStatusSummary = getNewsDeskStatusSummary(deskStatus);
  const deskFreshnessStatus = getNewsDeskFreshnessStatus({
    now: new Date(generatedAt),
    status: deskStatus,
  });
  const sourceHealthDiagnostics = getNewsDeskSourceHealthDiagnostics(
    deskStatus.latestRun,
  );
  const readinessChecklist = getNewsProductionReadinessChecklist({
    refreshConfigured,
    status: deskStatus,
  });

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

  const undoStoryQuickTuneAction = (action: NewsStoryQuickTuneAction) => {
    const beforeProfile = profile;
    const afterProfile = revertNewsStoryQuickTuneAction({
      action,
      profile: beforeProfile,
    });

    commitProfile(() => afterProfile);
    publishTrainingUpdate(
      getNewsStoryQuickTuneUndoTrainingUpdate({
        action,
        afterProfile,
        beforeProfile,
        formatCategory: getCategoryLabel,
      }),
    );
  };

  const applyPreferenceTuningSuggestion = (
    suggestion: NewsPreferenceTuningSuggestion,
  ) => {
    const beforeProfile = profile;
    const afterProfile = (() => {
      if (suggestion.action === "explore") {
        return {
          ...beforeProfile,
          noveltyBias: increaseProfileBias(beforeProfile.noveltyBias),
        };
      }

      if (suggestion.kind === "category") {
        return {
          ...beforeProfile,
          preferredCategories:
            suggestion.action === "reduce"
              ? removeValue(
                  beforeProfile.preferredCategories,
                  suggestion.signal,
                )
              : addValue(beforeProfile.preferredCategories, suggestion.signal),
        };
      }

      if (suggestion.kind === "source") {
        return {
          ...beforeProfile,
          preferredSources:
            suggestion.action === "reduce"
              ? removeValue(beforeProfile.preferredSources, suggestion.signal)
              : addValue(beforeProfile.preferredSources, suggestion.signal),
        };
      }

      if (suggestion.kind === "entity" || suggestion.kind === "tag") {
        return {
          ...beforeProfile,
          preferredEntities:
            suggestion.action === "reduce"
              ? suggestion.kind === "tag"
                ? removeAngleValue(
                    beforeProfile.preferredEntities,
                    suggestion.signal,
                  )
                : removeEntityValue(
                    beforeProfile.preferredEntities,
                    suggestion.signal,
                  )
              : suggestion.kind === "tag"
                ? addAngleValue(
                    beforeProfile.preferredEntities,
                    suggestion.signal,
                  )
                : addEntityValue(
                    beforeProfile.preferredEntities,
                    suggestion.signal,
                  ),
        };
      }

      return beforeProfile;
    })();

    commitProfile(() => afterProfile);
    const trainingUpdate = getNewsPreferenceTuningTrainingUpdate({
      afterProfile,
      beforeProfile,
      formatCategory: getCategoryLabel,
      suggestion,
    });
    const { undoAction, ...visibleTrainingUpdate } = trainingUpdate;

    publishTrainingUpdate({
      ...visibleTrainingUpdate,
      ...(undoAction ? { preferenceUndoAction: undoAction } : {}),
    });
  };

  const undoPreferenceTuningSuggestion = ({
    beforeProfile,
    suggestion,
  }: NonNullable<NewsTrainingUpdate["preferenceUndoAction"]>) => {
    const currentProfile = profile;

    commitProfile(() => beforeProfile);
    publishTrainingUpdate(
      getNewsPreferenceTuningUndoTrainingUpdate({
        afterProfile: beforeProfile,
        beforeProfile: currentProfile,
        formatCategory: getCategoryLabel,
        suggestion,
      }),
    );
  };

  const applyPreferenceCoverageDebtAction = (
    action: NewsPreferenceCoverageDebtAction,
  ) => {
    setFeedMode(action.feedMode);
    setActiveAngleTag(null);

    if (action.type === "category_filter") {
      setActiveCategory(
        isNewsCategoryKey(action.category) ? action.category : null,
      );
      setActiveSourceSlug(null);
      setReviewHiddenAngleQuery("");
      setSearchDraft("");
      setSearchQuery("");
      return;
    }

    if (action.type === "source_filter") {
      setActiveCategory(null);
      setActiveSourceSlug(action.sourceSlug);
      setReviewHiddenAngleQuery("");
      setSearchDraft("");
      setSearchQuery("");
      return;
    }

    setActiveCategory(null);
    setActiveSourceSlug(null);
    setReviewHiddenAngleQuery("");
    setSearchDraft(action.query);
    setSearchQuery(action.query);
    recordHomeSearchIntent({
      query: action.query,
      resultCount: rankedItems.length,
    });
  };

  const applyPreferenceDecayAction = (
    entry: Parameters<typeof getNewsPreferenceDecayTrainingAction>[0],
  ) => {
    const action = getNewsPreferenceDecayTrainingAction(entry);

    if (!action) return;

    applyPreferenceProfileAction(action);
  };

  const applyRecommendationSaturationAction = (
    action: Parameters<typeof getNewsRecommendationSaturationTrainingAction>[0],
  ) => {
    const trainingAction =
      getNewsRecommendationSaturationTrainingAction(action);

    if (!trainingAction) return;

    applyPreferenceProfileAction(trainingAction);
  };

  const applyRecommendationDiversityGovernorAction = (
    control: Parameters<
      typeof getNewsRecommendationDiversityGovernorTrainingAction
    >[0],
  ) => {
    const trainingAction =
      getNewsRecommendationDiversityGovernorTrainingAction(control);

    if (!trainingAction) return;

    applyPreferenceProfileAction(trainingAction);
  };

  const applyGuardrailRecoveryAction = (
    action: ReturnType<typeof getNewsGuardrailRecoveryPlan>["actions"][number],
  ) => {
    const trainingAction = getNewsGuardrailRecoveryTrainingAction({
      action,
      formatCategory: getCategoryLabel,
      historyItems,
      items: rankedItems,
      negativeFeedbackItems,
      positiveFeedbackItems,
      restoredGuardrailItems,
      savedItems,
    });

    if (!trainingAction) return;

    applyPreferenceProfileAction(trainingAction);
  };

  const applyReaderSatisfactionAction = (
    action: ReturnType<
      typeof getNewsReaderSatisfactionBrief
    >["actions"][number],
  ) => {
    const trainingAction = getNewsReaderSatisfactionTrainingAction({
      action,
      formatCategory: getCategoryLabel,
      historyItems,
      items: rankedItems,
      negativeFeedbackItems,
      positiveFeedbackItems,
      savedItems,
    });

    if (!trainingAction) return;

    applyPreferenceProfileAction(trainingAction);
  };

  const applyReaderLearningLoopAction = (
    action: ReturnType<typeof getNewsReaderLearningLoop>["actions"][number],
  ) => {
    const trainingAction = getNewsReaderLearningLoopTrainingAction({
      action,
      formatCategory: getCategoryLabel,
      historyItems,
      items: rankedItems,
      negativeFeedbackItems,
      positiveFeedbackItems,
      savedItems,
    });

    if (!trainingAction) return;

    applyPreferenceProfileAction(trainingAction);
  };

  const applyReaderRetentionAction = (
    action: ReturnType<typeof getNewsReaderRetentionPlan>["actions"][number],
  ) => {
    const trainingAction = getNewsReaderRetentionTrainingAction({
      action,
      formatCategory: getCategoryLabel,
      items: rankedItems,
      negativeFeedbackItems,
    });

    if (!trainingAction) return;

    applyPreferenceProfileAction(trainingAction);
  };

  const applyPersonalizationMixAction = (
    action: ReturnType<typeof getNewsPersonalizationMix>["actions"][number],
  ) => {
    const mixAction = getNewsPersonalizationMixTrainingAction({
      action,
      formatCategory: getCategoryLabel,
      items: rankedItems,
    });

    if (!mixAction) return;

    if (mixAction.kind === "profile") {
      applyPreferenceProfileAction(mixAction.action);
      return;
    }

    applyPreferenceBiasAction(mixAction.action);
  };

  const applyTasteCalibrationAction = (
    action: ReturnType<typeof getNewsTasteCalibration>["actions"][number],
  ) => {
    const trainingAction = getNewsTasteCalibrationTrainingAction({
      action,
      formatCategory: getCategoryLabel,
      items: rankedItems,
    });

    if (!trainingAction) return;

    applyPreferenceProfileAction(trainingAction);
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

  const applyEditionQualityGateAction = (
    input: Parameters<typeof getNewsEditionQualityGateTrainingAction>[0],
  ) => {
    const trainingAction = getNewsEditionQualityGateTrainingAction(input);

    if (!trainingAction) return;

    applyPreferenceProfileAction(trainingAction);
  };

  const applyFeedFatigueAction = (
    notice: ReturnType<typeof getNewsFeedFatigueReport>["notices"][number],
  ) => {
    const fatigueAction = getNewsFeedFatigueTrainingAction({
      items: rankedItems,
      notice,
    });

    if (!fatigueAction) return;

    applyPreferenceProfileAction(fatigueAction);
  };

  const applyTopicMatchAction = (
    row: ReturnType<typeof getNewsTopicMatchMatrix>["rows"][number],
  ) => {
    applyPreferenceProfileAction(getNewsTopicMatchTrainingAction({ row }));
  };

  const applySourceBalanceAction = () => {
    if (!sourceBalanceAction) return;

    applyPreferenceProfileAction(sourceBalanceAction);
  };

  const applySourceTrustAction = (
    notice: ReturnType<typeof getNewsSourceTrustLedger>["notices"][number],
  ) => {
    const sourceTrustAction = getNewsSourceTrustTrainingAction({
      items: rankedItems,
      notice,
    });

    if (!sourceTrustAction) return;

    applyPreferenceProfileAction(sourceTrustAction);
  };

  const applyEntityRadarAction = (
    entry: ReturnType<typeof getNewsEntityRadar>[number],
  ) => {
    applyPreferenceProfileAction(
      getNewsEntityRadarTrainingAction({ entry, profile }),
    );
  };

  const applyTopicPulseAction = (
    pulse: ReturnType<typeof getNewsTopicPulse>[number],
  ) => {
    applyPreferenceProfileAction(
      getNewsTopicPulseTrainingAction({
        formatCategory: getCategoryLabel,
        profile,
        pulse,
      }),
    );
  };

  const applyInterestDriftAction = (
    notice: ReturnType<typeof getNewsInterestDrift>["notices"][number],
  ) => {
    const driftAction = getNewsInterestDriftTrainingAction({
      formatCategory: getCategoryLabel,
      historyItems,
      negativeFeedbackItems: negativeFeedbackMemoryItems,
      notice,
      positiveFeedbackItems,
      profile,
      savedItems,
    });

    if (!driftAction) return;

    applyPreferenceProfileAction(driftAction);
  };

  const applyInterestGraphNodeAction = ({
    laneKey,
    node,
  }: {
    laneKey: ReturnType<typeof getNewsInterestGraph>["lanes"][number]["key"];
    node: ReturnType<
      typeof getNewsInterestGraph
    >["lanes"][number]["nodes"][number];
  }) => {
    applyPreferenceProfileAction(
      getNewsInterestGraphNodeTrainingAction({ laneKey, node }),
    );
  };

  const applyReaderCohortAction = (
    cohort: NonNullable<
      Parameters<typeof getNewsReaderCohortTrainingAction>[0]["cohort"]
    >,
  ) => {
    const cohortAction = getNewsReaderCohortTrainingAction({
      cohort,
      formatCategory: getCategoryLabel,
      profile,
    });

    if (!cohortAction) return;

    applyPreferenceProfileAction(cohortAction);
  };

  const applySessionIntentAction = (
    intent: NonNullable<
      Parameters<typeof getNewsSessionIntentTrainingAction>[0]["intent"]
    >,
  ) => {
    const intentAction = getNewsSessionIntentTrainingAction({
      formatCategory: getCategoryLabel,
      intent,
      profile,
    });

    if (!intentAction) return;

    applyPreferenceProfileAction(intentAction);
  };

  const applyCollaborativeSignalAction = (
    signal: NonNullable<
      Parameters<typeof getNewsCollaborativeSignalTrainingAction>[0]["signal"]
    >,
  ) => {
    const collaborativeAction = getNewsCollaborativeSignalTrainingAction({
      formatCategory: getCategoryLabel,
      profile,
      signal,
    });

    if (!collaborativeAction) return;

    applyPreferenceProfileAction(collaborativeAction);
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

  const undoPreferenceProfileAction = ({
    action,
    beforeProfile,
  }: NonNullable<NewsTrainingUpdate["preferenceProfileUndoAction"]>) => {
    const currentProfile = profile;

    commitProfile(() => beforeProfile);
    publishTrainingUpdate(
      getNewsPreferenceProfileUndoTrainingUpdate({
        action,
        afterProfile: beforeProfile,
        beforeProfile: currentProfile,
      }),
    );
  };

  const applyPreferenceBiasCycleAction = ({
    key,
    label,
  }: {
    key: NewsPreferenceBiasAction["key"];
    label: string;
  }) => {
    const beforeProfile = profile;
    const { action, afterProfile } = getNewsPreferenceBiasCycleAction({
      key,
      label,
      profile: beforeProfile,
    });

    commitProfile(() => afterProfile);
    const trainingUpdate = getNewsPreferenceBiasTrainingUpdate({
      action,
      afterProfile,
      beforeProfile,
    });
    const { undoAction, ...visibleTrainingUpdate } = trainingUpdate;

    publishTrainingUpdate({
      ...visibleTrainingUpdate,
      biasUndoAction: undoAction,
    });
  };

  const applyPreferenceBiasAction = (action: NewsPreferenceBiasAction) => {
    const beforeProfile = profile;
    const afterProfile =
      action.key === "recencyBias"
        ? {
            ...beforeProfile,
            recencyBias:
              action.direction === "raise"
                ? increaseProfileBias(beforeProfile.recencyBias)
                : decreaseProfileBias(beforeProfile.recencyBias),
          }
        : {
            ...beforeProfile,
            noveltyBias:
              action.direction === "raise"
                ? increaseProfileBias(beforeProfile.noveltyBias)
                : decreaseProfileBias(beforeProfile.noveltyBias),
          };

    commitProfile(() => afterProfile);
    const trainingUpdate = getNewsPreferenceBiasTrainingUpdate({
      action,
      afterProfile,
      beforeProfile,
    });
    const { undoAction, ...visibleTrainingUpdate } = trainingUpdate;

    publishTrainingUpdate({
      ...visibleTrainingUpdate,
      biasUndoAction: undoAction,
    });
  };

  const undoPreferenceBiasAction = ({
    action,
    beforeProfile,
  }: NonNullable<NewsTrainingUpdate["biasUndoAction"]>) => {
    const currentProfile = profile;

    commitProfile(() => beforeProfile);
    publishTrainingUpdate(
      getNewsPreferenceBiasUndoTrainingUpdate({
        action,
        afterProfile: beforeProfile,
        beforeProfile: currentProfile,
      }),
    );
  };

  const applyPreferenceBiasResetAction = (label: string) => {
    const beforeProfile = profile;
    const afterProfile = {
      ...beforeProfile,
      noveltyBias: 1,
      recencyBias: 1,
    };

    commitProfile(() => afterProfile);
    const trainingUpdate = getNewsPreferenceBiasResetTrainingUpdate({
      afterProfile,
      beforeProfile,
      label,
    });
    const { undoAction, ...visibleTrainingUpdate } = trainingUpdate;

    publishTrainingUpdate({
      ...visibleTrainingUpdate,
      biasResetUndoAction: undoAction,
    });
  };

  const undoPreferenceBiasResetAction = ({
    beforeProfile,
    label,
  }: NonNullable<NewsTrainingUpdate["biasResetUndoAction"]>) => {
    const currentProfile = profile;

    commitProfile(() => beforeProfile);
    publishTrainingUpdate(
      getNewsPreferenceBiasResetUndoTrainingUpdate({
        afterProfile: beforeProfile,
        beforeProfile: currentProfile,
        label,
      }),
    );
  };

  const applyFeedGovernorControl = (
    control: Parameters<typeof getNewsFeedGovernorControlTrainingAction>[0],
  ) => {
    const trainingAction = getNewsFeedGovernorControlTrainingAction(control);

    if (!trainingAction) return;

    if (trainingAction.kind === "profile") {
      applyPreferenceProfileAction(trainingAction.action);
      return;
    }

    if (trainingAction.kind === "bias") {
      applyPreferenceBiasAction(trainingAction.action);
      return;
    }

    applyPreferenceBiasResetAction(trainingAction.label);
  };

  const applyFilterBubbleAction = (
    check: Parameters<typeof getNewsFilterBubbleTrainingAction>[0]["check"],
  ) => {
    const trainingAction = getNewsFilterBubbleTrainingAction({
      check,
      formatCategory: getCategoryLabel,
      items: rankedItems,
      profile,
    });

    if (!trainingAction) return;

    if (trainingAction.kind === "profile") {
      applyPreferenceProfileAction(trainingAction.action);
      return;
    }

    applyPreferenceBiasAction(trainingAction.action);
  };

  const applyExplorationSlotAction = (
    slot: NonNullable<
      Parameters<typeof getNewsExplorationSlotTrainingAction>[0]["slot"]
    >,
  ) => {
    const trainingAction = getNewsExplorationSlotTrainingAction({
      formatCategory: getCategoryLabel,
      items: rankedItems,
      profile,
      slot,
    });

    if (!trainingAction) return;

    applyPreferenceProfileAction(trainingAction);
  };

  const applyChannelStrategyAction = (
    lane: NonNullable<
      Parameters<typeof getNewsChannelStrategyTrainingAction>[0]["lane"]
    >,
  ) => {
    const trainingAction = getNewsChannelStrategyTrainingAction({
      formatCategory: getCategoryLabel,
      items: rankedItems,
      lane,
      profile,
    });

    if (!trainingAction) return;

    if (trainingAction.kind === "profile") {
      applyPreferenceProfileAction(trainingAction.action);
      return;
    }

    applyPreferenceBiasAction(trainingAction.action);
  };

  const applyEditorialGuardrailAction = (
    risk: NonNullable<
      Parameters<typeof getNewsEditorialGuardrailTrainingAction>[0]["risk"]
    >,
  ) => {
    const trainingAction = getNewsEditorialGuardrailTrainingAction({
      items: rankedItems,
      profile,
      risk,
    });

    if (!trainingAction) return;

    if (trainingAction.kind === "profile") {
      applyPreferenceProfileAction(trainingAction.action);
      return;
    }

    applyPreferenceBiasAction(trainingAction.action);
  };

  const applyRecommendationAuditAction = (
    notice: NonNullable<
      Parameters<typeof getNewsRecommendationAuditTrainingAction>[0]["notice"]
    >,
  ) => {
    const trainingAction = getNewsRecommendationAuditTrainingAction({
      items: rankedItems,
      notice,
      profile,
    });

    if (!trainingAction) return;

    if (trainingAction.kind === "profile") {
      applyPreferenceProfileAction(trainingAction.action);
      return;
    }

    applyPreferenceBiasAction(trainingAction.action);
  };

  const applyRecommendationTraceAction = (
    input: Parameters<typeof getNewsRecommendationTraceTrainingAction>[0],
  ) => {
    const trainingAction = getNewsRecommendationTraceTrainingAction(input);

    if (!trainingAction) return;

    applyPreferenceProfileAction(trainingAction);
  };

  const applyExperimentAllocationAction = (
    input: Parameters<typeof getNewsExperimentAllocationTrainingAction>[0],
  ) => {
    const experimentAction = getNewsExperimentAllocationTrainingAction(input);

    if (!experimentAction) return;

    if (experimentAction.kind === "profile") {
      applyPreferenceProfileAction(experimentAction.action);
      return;
    }

    applyPreferenceBiasAction(experimentAction.action);
  };

  const applyAggregationIntakeAction = (
    input: Parameters<typeof getNewsAggregationIntakeTrainingAction>[0],
  ) => {
    const intakeAction = getNewsAggregationIntakeTrainingAction(input);

    if (!intakeAction) return;

    applyPreferenceProfileAction(intakeAction);
  };

  const applyAggregationRecoveryAction = (
    input: Parameters<typeof getNewsAggregationRecoveryTrainingAction>[0],
  ) => {
    const recoveryAction = getNewsAggregationRecoveryTrainingAction(input);

    if (!recoveryAction) return;

    applyPreferenceProfileAction(recoveryAction);
  };

  const applyProfileSignalLedgerAction = (
    control: Parameters<typeof getNewsProfileSignalLedgerTrainingAction>[0],
  ) => {
    applyPreferenceProfileAction(
      getNewsProfileSignalLedgerTrainingAction(control),
    );
  };

  const applyForYouNextQueueAction = (
    notice: NonNullable<
      Parameters<typeof getNewsForYouNextQueueTrainingAction>[0]["notice"]
    >,
  ) => {
    const trainingAction = getNewsForYouNextQueueTrainingAction({
      formatCategory: getCategoryLabel,
      negativeFeedbackItems: negativeFeedbackMemoryItems,
      notice,
    });

    if (!trainingAction) return;

    applyPreferenceProfileAction(trainingAction);
  };

  const applyLiveWireAction = (
    notice: NonNullable<
      Parameters<typeof getNewsLiveWireTrainingAction>[0]["notice"]
    >,
  ) => {
    const trainingAction = getNewsLiveWireTrainingAction({
      formatCategory: getCategoryLabel,
      items: rankedItems,
      notice,
    });

    if (!trainingAction) return;

    if (trainingAction.kind === "profile") {
      applyPreferenceProfileAction(trainingAction.action);
      return;
    }

    applyPreferenceBiasAction(trainingAction.action);
  };

  const applyProfileUpdateProposal = (
    proposal: Parameters<typeof getNewsProfileUpdateProposalTrainingAction>[0],
  ) => {
    const trainingAction = getNewsProfileUpdateProposalTrainingAction(proposal);

    if (!trainingAction) return;

    applyPreferenceProfileAction(trainingAction);
  };

  const applyModelTrainingBatchAction = (
    input: Parameters<typeof getNewsModelTrainingBatchTrainingAction>[0],
  ) => {
    const trainingAction = getNewsModelTrainingBatchTrainingAction(input);

    if (!trainingAction) return;

    applyPreferenceProfileAction(trainingAction);
  };

  const applyDistributionQueueAction = (
    input: Parameters<typeof getNewsDistributionQueueTrainingAction>[0],
  ) => {
    const trainingAction = getNewsDistributionQueueTrainingAction(input);

    if (!trainingAction) return;

    applyPreferenceProfileAction(trainingAction);
  };

  const applyAlertRoutingAction = (
    input: Parameters<typeof getNewsAlertRoutingTrainingAction>[0],
  ) => {
    applyPreferenceProfileAction(getNewsAlertRoutingTrainingAction(input));
  };

  const applyRecommendationRotationAction = (
    input: Parameters<typeof getNewsRecommendationRotationTrainingAction>[0],
  ) => {
    applyPreferenceProfileAction(
      getNewsRecommendationRotationTrainingAction(input),
    );
  };

  const applyPersonalizedReadingQueueAction = (
    input: Parameters<typeof getNewsPersonalizedReadingQueueTrainingAction>[0],
  ) => {
    applyPreferenceProfileAction(
      getNewsPersonalizedReadingQueueTrainingAction(input),
    );
  };

  const applyContinuationRailAction = (
    input: Parameters<typeof getNewsContinuationRailTrainingAction>[0],
  ) => {
    applyPreferenceProfileAction(getNewsContinuationRailTrainingAction(input));
  };

  const applyNextRefreshPlanAction = (
    input: Parameters<typeof getNewsNextRefreshPlanTrainingAction>[0],
  ) => {
    applyPreferenceProfileAction(getNewsNextRefreshPlanTrainingAction(input));
  };

  const applyRefreshSimulationAction = (
    move: Parameters<typeof getNewsRefreshSimulationTrainingAction>[0],
  ) => {
    applyPreferenceProfileAction(getNewsRefreshSimulationTrainingAction(move));
  };

  const applyEditionScheduleAction = (
    input: Parameters<typeof getNewsEditionScheduleTrainingAction>[0],
  ) => {
    applyPreferenceProfileAction(getNewsEditionScheduleTrainingAction(input));
  };

  const applyExposureCooldownAction = (
    input: Parameters<typeof getNewsExposureCooldownTrainingAction>[0],
  ) => {
    applyPreferenceProfileAction(getNewsExposureCooldownTrainingAction(input));
  };

  const applyReaderProfileSnapshotAction = (
    action: NewsPreferenceProfileTrainingAction,
  ) => {
    applyPreferenceProfileAction(action);
  };

  const applyReaderWatchlistAction = (
    entry: Parameters<typeof getNewsReaderWatchlistTrainingAction>[0],
  ) => {
    const trainingAction = getNewsReaderWatchlistTrainingAction(entry);

    if (!trainingAction) return;

    applyPreferenceProfileAction(trainingAction);
  };

  const applySearchTrendAction = (
    trend: Parameters<typeof getNewsSearchTrendTrainingAction>[0],
  ) => {
    const trainingAction = getNewsSearchTrendTrainingAction(trend);

    if (!trainingAction) return;

    applyPreferenceProfileAction(trainingAction);
  };

  const applyPersonalizedPushQueueAction = (
    input: Parameters<typeof getNewsPersonalizedPushQueueTrainingAction>[0],
  ) => {
    const trainingAction = getNewsPersonalizedPushQueueTrainingAction(input);

    if (!trainingAction) return;

    applyPreferenceProfileAction(trainingAction);
  };

  const reviewTrainingGuardrailConflict = (
    action: NonNullable<NewsTrainingUpdate["guardrailReviewAction"]>,
  ) => {
    if (action.resetFilters) {
      setActiveAngleTag(null);
      setActiveCategory(null);
      setActiveSourceSlug(null);
    }

    setFeedMode(action.targetFeedMode);
    setReviewHiddenAngleQuery(action.query);
    setSearchDraft(action.query);
    setSearchQuery(action.query);
    recordHomeSearchIntent({
      query: action.query,
      resultCount: rankedItems.length,
    });
  };

  const applyExploreSearch = (event: FormEvent<HTMLFormElement>) => {
    if (!searchDraft.trim()) {
      event.preventDefault();
    }

    setReviewHiddenAngleQuery("");
    setSearchQuery(searchDraft.trim());
    recordHomeSearchIntent({
      query: searchDraft,
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

  const applyPersonalizationDataVaultAction = (
    control: NewsPersonalizationDataVaultAction,
  ) => {
    const dataVaultExport = getNewsPersonalizationDataVaultExport({
      control,
      historyItems,
      negativeFeedbackItems,
      positiveFeedbackItems,
      profile,
      savedItems,
      searchMemoryItems,
    });
    const trainingUpdate =
      getNewsPersonalizationDataVaultTrainingUpdate(control);
    const nextTrainingUpdate = dataVaultExport
      ? {
          ...trainingUpdate,
          dataVaultExport,
          notices: [
            ...trainingUpdate.notices,
            {
              detail: dataVaultExport.summary,
              label: dataVaultExport.label,
            },
          ],
        }
      : trainingUpdate;

    if (control.action.kind === "reset_memory") {
      resetProfile();
      publishTrainingUpdate(nextTrainingUpdate);
      return;
    }

    if (control.action.kind === "start_training") {
      clearExploreFilters();
      setFeedMode("for_you");
    }

    if (control.action.kind === "review_guardrails") {
      setActiveAngleTag(null);
      setActiveCategory(null);
      setActiveSourceSlug(null);
      setFeedMode("for_you");
      setReviewHiddenAngleQuery("less feedback");
      setSearchDraft("less feedback");
      setSearchQuery("less feedback");
      recordHomeSearchIntent({
        query: "less feedback",
        resultCount: negativeFeedbackMemoryItems.length,
      });
    }

    publishTrainingUpdate(nextTrainingUpdate);
  };

  const applyPersonalizationDataVaultProfileImport = () => {
    const dataVaultImport =
      getNewsPersonalizationDataVaultProfileImport(dataVaultImportDraft);

    if (!dataVaultImport) {
      publishTrainingUpdate({
        label: "Profile Import",
        metrics: [{ label: "Status", value: "Invalid" }],
        notices: [
          {
            detail:
              "Paste a profile export JSON package from The New AI Times Data Vault.",
            label: "Import failed",
          },
        ],
        signals: [],
        summary: "Data Vault profile import could not be read.",
      });
      return;
    }

    commitProfile(() => dataVaultImport.profile);
    writeStoredProfile(dataVaultImport.profile);
    setDataVaultImportDraft("");
    publishTrainingUpdate({
      label: dataVaultImport.label,
      metrics: dataVaultImport.metrics,
      notices: dataVaultImport.notices,
      signals: dataVaultImport.signals,
      summary: dataVaultImport.summary,
    });
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
            collaborativeSignals: collaborativeRankingSignals,
            currentItems: scopedItems,
            limit: 20,
            negativeFeedbackItems: negativeFeedbackMemoryItems,
            objective: forYouObjective,
            positiveFeedbackItems: positiveFeedbackMemoryItems,
            profile,
            q: searchQuery,
            readerLocalHour,
            recentExposureItems: recentExposureMemoryItems,
            searchMemoryItems,
            semanticSimilarityMatches: [],
            sourceSlug: activeSourceSlug,
            tag: activeAngleTag,
          }),
        );

        applyForYouApiExposureMemory(
          forYouApiPayload.nextRequest?.recentExposureItems,
        );
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
      setHasMoreItems(loadMoreState.hasNewVisibleItems);
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
    forYouObjective,
    hasMoreItems,
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
  const availableSources = getUniqueValues(items, "sourceSlug");
  const sourceFilterOptions = getNewsSourceFilterOptions({
    items: [...fallbackItems, ...items],
    limit: 8,
  });
  const availableEntities = getTopEntities(items);
  const availableAngleOptions = getNewsAnglePreferenceOptions({
    items: [...fallbackItems, ...items],
  });
  const readerMemory = getNewsReaderMemory({
    formatCategory: getCategoryLabel,
    historyItems,
    profile,
    savedItems,
    searchMemoryItems,
  });
  const guardrailShelf = getNewsGuardrailShelf({
    formatCategory: getCategoryLabel,
    guardrailItems,
    positiveFeedbackItems,
    positiveItems: [...savedItems, ...historyItems],
  });
  const guardrailRecoveryPlan = getNewsGuardrailRecoveryPlan({
    formatCategory: getCategoryLabel,
    historyItems,
    items: rankedItems,
    negativeFeedbackItems: negativeFeedbackMemoryItems,
    positiveFeedbackItems,
    restoredGuardrailItems,
    savedItems,
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
  const readerJourneyMap = getNewsReaderJourneyMap({
    formatCategory: getCategoryLabel,
    historyItems,
    items: rankedItems,
    limit: 5,
    negativeFeedbackItems,
    positiveFeedbackItems,
    profile,
    savedItems,
  });
  const readerLearningLoop = getNewsReaderLearningLoop({
    formatCategory: getCategoryLabel,
    historyItems,
    items: rankedItems,
    negativeFeedbackItems,
    positiveFeedbackItems,
    profile,
    savedItems,
  });
  const readerSatisfactionBrief = getNewsReaderSatisfactionBrief({
    historyItems,
    items: rankedItems,
    negativeFeedbackItems,
    positiveFeedbackItems,
    savedItems,
  });
  const exposureCooldownQueue = getNewsExposureCooldownQueue({
    historyItems,
    items: rankedItems,
    limit: 2,
    negativeFeedbackItems,
    positiveFeedbackItems,
    recordedItems: mergeNewsReaderMemoryItems({
      limit: 24,
      localItems: localHomeExposureItems,
      serverItems: recordedHomeExposureItemsRef.current,
    }),
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
    positiveFeedbackItems,
    profile,
    savedItems,
  });
  const collaborativeSignals = getNewsCollaborativeSignals({
    formatCategory: getCategoryLabel,
    historyItems,
    items: rankedItems,
    limit: 2,
    negativeFeedbackItems,
    positiveFeedbackItems,
    profile,
    savedItems,
  });
  const sessionIntent = getNewsSessionIntent({
    activeIntent: activeFeedIntent,
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
    positiveFeedbackItems,
    profile,
    savedItems,
  });
  const personalizationDataVault = getNewsPersonalizationDataVault({
    historyItems,
    negativeFeedbackItems,
    persisted: Boolean(profileQuery.data?.persisted),
    positiveFeedbackItems,
    profile,
    savedItems,
    searchMemoryItems,
  });
  const interestDrift = getNewsInterestDrift({
    formatCategory: getCategoryLabel,
    historyItems,
    negativeFeedbackItems,
    positiveFeedbackItems,
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
  const recommendationRotationQueue = getNewsRecommendationRotationQueue({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 4,
    objectiveOrder: feedMode === "for_you" ? forYouObjectiveOrder : undefined,
    profile,
  });
  const recommendationDiversityGovernor =
    getNewsRecommendationDiversityGovernor({
      formatCategory: getCategoryLabel,
      items: rankedItems,
      limit: 4,
    });
  const recommendationDiversityRepairQueue =
    getNewsRecommendationDiversityRepairQueue({
      formatCategory: getCategoryLabel,
      items: rankedItems,
      limit: 4,
    });
  const recommendationSourceSaturation = getNewsRecommendationSourceSaturation({
    items: rankedItems,
    limit: 4,
  });
  const recommendationTopicSaturation = getNewsRecommendationTopicSaturation({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 4,
  });
  const recommendationEntitySaturation = getNewsRecommendationEntitySaturation({
    items: rankedItems,
    limit: 4,
  });
  const readerDaypartPlan = getNewsReaderDaypartPlan({
    formatCategory: getCategoryLabel,
    generatedAt,
    items: rankedItems,
    profile,
    readerLocalHour,
  });
  const readerRetentionPlan = getNewsReaderRetentionPlan({
    generatedAt,
    historyItems,
    items: rankedItems,
    negativeFeedbackItems,
    positiveFeedbackItems,
    readerLocalHour,
    savedItems,
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
    positiveFeedbackItems,
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
    positiveFeedbackItems,
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
    positiveFeedbackItems,
    profile,
    savedItems,
  });
  const experimentAllocation = getNewsExperimentAllocation({
    formatCategory: getCategoryLabel,
    historyItems,
    items: rankedItems,
    negativeFeedbackItems,
    positiveFeedbackItems,
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
  const feedbackCoachHasAvailableAction = feedbackCoach.actions.some(
    (suggestion) =>
      rankedItems.some((story) => story.id === suggestion.storyId),
  );
  const feedbackCoachPreviewActionState = getNewsFeedbackCoachActionState({
    hasSuggestedStory: feedbackCoachHasAvailableAction,
    isPreview,
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
    positiveFeedbackItems,
    profile,
    savedItems,
  });
  const newsletterPlan = getNewsNewsletterPlan({
    formatCategory: getCategoryLabel,
    hiddenItemIds,
    historyItems,
    items: rankedItems,
    limit: 2,
    negativeFeedbackItems,
    positiveFeedbackItems,
    profile,
    savedItems,
  });
  const membershipMeter = getNewsMembershipMeter({
    formatCategory: getCategoryLabel,
    hiddenItemIds,
    historyItems,
    items: rankedItems,
    limit: 2,
    negativeFeedbackItems,
    positiveFeedbackItems,
    profile,
    savedItems,
  });
  const modelTrainingBatch = getNewsModelTrainingBatch({
    formatCategory: getCategoryLabel,
    hiddenItemIds,
    historyItems,
    items: rankedItems,
    limit: 2,
    negativeFeedbackItems,
    positiveFeedbackItems,
    profile,
    savedItems,
  });
  const profileUpdateProposal = getNewsProfileUpdateProposal({
    formatCategory: getCategoryLabel,
    hiddenItemIds,
    historyItems,
    items: rankedItems,
    limit: 2,
    negativeFeedbackItems,
    positiveFeedbackItems,
    profile,
    savedItems,
  });
  const readerProfileSnapshot = getNewsReaderProfileSnapshot({
    formatCategory: getCategoryLabel,
    hiddenItemIds,
    historyItems,
    items: rankedItems,
    limit: 2,
    negativeFeedbackItems,
    positiveFeedbackItems,
    profile,
    savedItems,
  });
  const fatigueReport = getNewsFeedFatigueReport({ items: rankedItems });
  const preferenceStarter = getNewsPreferenceStarter({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    profile,
  });
  const preferenceCoverageDebt = getNewsPreferenceCoverageDebt({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 4,
    profile,
  });
  const preferenceDecayQueue = getNewsPreferenceDecayQueue({
    formatCategory: getCategoryLabel,
    generatedAt,
    historyItems,
    items: rankedItems,
    limit: 3,
    negativeFeedbackItems,
    positiveFeedbackItems,
    profile,
    savedItems,
  });
  const preferenceControlPanel = getNewsPreferenceControlPanel({
    formatCategory: getCategoryLabel,
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
  const preferencePresets = getNewsPreferencePresets({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 3,
    profile,
  });
  const preferenceTuningPlan = getNewsPreferenceTuningPlan({
    formatCategory: getCategoryLabel,
    historyItems,
    impactLimit: 2,
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
    positiveFeedbackItems,
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
    positiveFeedbackItems,
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
  const liveWire = getNewsLiveWire({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 4,
  });
  const breakingEscalationQueue = getNewsBreakingEscalationQueue({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 3,
    now: new Date(generatedAt),
  });
  const continuationRail = getNewsContinuationRail({
    formatCategory: getCategoryLabel,
    historyItems,
    items: rankedItems,
    limit: 3,
    positiveFeedbackItems,
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
    positiveFeedbackItems,
    savedItems,
  });
  const nextForYouQueue = getNewsForYouNextQueue({
    cursor: nextCursor,
    feedMode,
    formatCategory: getCategoryLabel,
    hasMoreItems,
    isLoadingMore,
    isPreview,
    items: rankedItems,
    negativeFeedbackItems: negativeFeedbackMemoryItems,
    searchMemoryItems,
    visibleItems: rankedItems,
    visitorKey,
  });
  const editionSchedule = getNewsEditionSchedule({ items: rankedItems });
  const editionMix = getNewsEditionMix({ items: rankedItems });
  const aggregationIntake = getNewsAggregationIntake({
    items: rankedItems,
    limit: 2,
  });
  const aggregationRecoveryQueue = getNewsAggregationRecoveryQueue({
    items: rankedItems,
    limit: 3,
  });
  const sourceBalance = getNewsSourceBalance({ items: rankedItems });
  const sourceBalanceAction = getNewsSourceBalanceTrainingAction(sourceBalance);
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
                          {formatNewsTime(section.lead.publishedAt)}
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
                sourceClusters.clusters.map((cluster, index) => {
                  const leadItem = cluster.lead
                    ? rankedItemsById.get(cluster.lead.id)
                    : undefined;

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
                <SignalChips
                  label="Angles"
                  values={readerSignalSummary.angles}
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
                  <h3 className="text-sm font-black">Preference Decay Queue</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {preferenceDecayQueue.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {preferenceDecayQueue.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {preferenceDecayQueue.metrics.map((metric) => (
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
                {preferenceDecayQueue.decays.length > 0 ? (
                  preferenceDecayQueue.decays.map((entry) => {
                    const decayAction =
                      getNewsPreferenceDecayTrainingAction(entry);

                    return (
                      <div
                        key={`${entry.kind}-${entry.signal}`}
                        className="grid gap-2 border-t border-[#161616]/20 pt-3 text-xs sm:grid-cols-[minmax(0,0.35fr)_minmax(0,1fr)_auto] sm:items-start dark:border-[#f4f1ea]/15"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold">
                            {entry.label}
                          </div>
                          <div className="mt-1 font-mono text-[10px] tracking-[0.12em] text-[#8a241c] uppercase dark:text-[#ff8b7e]">
                            {entry.kind} / {entry.statusLabel}
                          </div>
                        </div>
                        <p className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {entry.reason}
                        </p>
                        {decayAction ? (
                          <Button
                            className="h-8 w-fit rounded-none px-2 text-xs"
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => applyPreferenceDecayAction(entry)}
                          >
                            {decayAction.actionLabel}
                          </Button>
                        ) : (
                          <span className="w-fit border border-[#161616]/25 px-2 py-1 font-mono text-[11px] uppercase dark:border-[#f4f1ea]/25">
                            {entry.actionLabel}
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    No stale profile signals need cooling in the current ranked
                    feed.
                  </div>
                )}
              </div>
              <div className="mt-3 grid gap-3">
                <h4 className="border-t border-[#161616]/20 pt-3 font-mono text-[11px] tracking-[0.14em] uppercase dark:border-[#f4f1ea]/15">
                  Warm Signals
                </h4>
                {preferenceDecayQueue.revivals.length > 0 ? (
                  preferenceDecayQueue.revivals.map((entry) => (
                    <div
                      key={`${entry.kind}-${entry.signal}`}
                      className="grid gap-1 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{entry.label}</span>
                        <span className="border border-[#161616]/30 px-2 py-0.5 font-mono text-[10px] uppercase dark:border-[#f4f1ea]/30">
                          {entry.kind} / {entry.statusLabel}
                        </span>
                      </div>
                      <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {entry.reason}
                      </span>
                      <span className="w-fit border border-[#161616]/25 px-2 py-1 font-mono text-[11px] uppercase dark:border-[#f4f1ea]/25">
                        {entry.actionLabel}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                    Warm signals will appear after recent positive behavior
                    reinforces active preferences.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">
                    Exposure Cooldown Queue
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {exposureCooldownQueue.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {exposureCooldownQueue.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {exposureCooldownQueue.metrics.map((metric) => (
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
                {exposureCooldownQueue.cooldowns.length > 0 ? (
                  exposureCooldownQueue.cooldowns.map((story, index) => {
                    const item = rankedItemsById.get(story.id);
                    const exposureAction = item
                      ? getNewsExposureCooldownTrainingAction({
                          formatCategory: getCategoryLabel,
                          item,
                          mode: "cooldown",
                        })
                      : null;

                    return (
                      <article
                        key={story.id}
                        className="grid gap-3 border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                      >
                        <div className="grid gap-1">
                          <span className="flex flex-wrap items-center gap-2 font-semibold">
                            <span className="font-mono">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span>{story.sourceName}</span>
                            <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                              {story.scoreLabel}
                            </span>
                          </span>
                          <Link
                            className="leading-5 text-[#5b5750] hover:text-[#8a241c] dark:text-[#bbb4aa] dark:hover:text-[#ff8b7e]"
                            href={`/news/${story.id}`}
                          >
                            {story.title}
                          </Link>
                          <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                            {story.reason}
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
                        {exposureAction && item ? (
                          <Button
                            className="h-8 w-fit rounded-none px-2 text-xs"
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() =>
                              applyExposureCooldownAction({
                                formatCategory: getCategoryLabel,
                                item,
                                mode: "cooldown",
                              })
                            }
                          >
                            {exposureAction.actionLabel}
                          </Button>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <div className="border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    No repeated unengaged exposures need cooling down.
                  </div>
                )}
              </div>
              <div className="mt-3 grid gap-3">
                <h4 className="border-t border-[#161616]/20 pt-3 font-mono text-[11px] tracking-[0.14em] uppercase dark:border-[#f4f1ea]/15">
                  Replacement Ready
                </h4>
                {exposureCooldownQueue.replacements.length > 0 ? (
                  exposureCooldownQueue.replacements.map((story) => {
                    const item = rankedItemsById.get(story.id);
                    const exposureAction = item
                      ? getNewsExposureCooldownTrainingAction({
                          formatCategory: getCategoryLabel,
                          item,
                          mode: "replacement",
                        })
                      : null;

                    return (
                      <article
                        key={story.id}
                        className="grid gap-2 border-t border-[#161616]/10 pt-2 text-xs dark:border-[#f4f1ea]/10"
                      >
                        <Link
                          className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                          href={`/news/${story.id}`}
                        >
                          <span className="font-semibold">{story.title}</span>
                          <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                            {story.sourceName} / {story.scoreLabel}
                          </span>
                          <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                            {story.reason}
                          </span>
                        </Link>
                        {exposureAction && item ? (
                          <Button
                            className="h-8 w-fit rounded-none px-2 text-xs"
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() =>
                              applyExposureCooldownAction({
                                formatCategory: getCategoryLabel,
                                item,
                                mode: "replacement",
                              })
                            }
                          >
                            {exposureAction.actionLabel}
                          </Button>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <div className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                    Replacement candidates will appear as unseen stories enter
                    the ranked feed.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">
                    Reader Profile Snapshot
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {readerProfileSnapshot.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 text-right font-mono text-xs dark:border-[#f4f1ea]/50">
                  {readerProfileSnapshot.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {readerProfileSnapshot.metrics.map((metric) => (
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
                {readerProfileSnapshot.cards.map((card) => {
                  const cardAction = card.action;

                  return (
                    <div
                      key={card.key}
                      className="grid content-start gap-2 border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                    >
                      <div className="grid grid-cols-[1fr_auto] gap-3">
                        <span className="font-semibold">{card.label}</span>
                        <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                          {card.statusLabel}
                        </span>
                      </div>
                      <div className="font-mono text-sm">{card.value}</div>
                      <p className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {card.detail}
                      </p>
                      {card.signals.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {card.signals.map((signal) => (
                            <span
                              key={`${card.key}-${signal}`}
                              className="border border-[#161616]/20 px-2 py-1 font-mono text-[11px] dark:border-[#f4f1ea]/20"
                            >
                              {signal}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          No active signals in this snapshot.
                        </p>
                      )}
                      {cardAction ? (
                        <Button
                          className="h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            applyReaderProfileSnapshotAction(cardAction)
                          }
                        >
                          Apply next update
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Reader Retention</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {readerRetentionPlan.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {readerRetentionPlan.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {readerRetentionPlan.metrics.map((metric) => (
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
                {readerRetentionPlan.actions.map((action) => {
                  const retentionAction = getNewsReaderRetentionTrainingAction({
                    action,
                    formatCategory: getCategoryLabel,
                    items: rankedItems,
                    negativeFeedbackItems,
                  });

                  return (
                    <div
                      key={action.label}
                      className="grid gap-2 border-t border-[#161616]/20 pt-2 text-xs sm:grid-cols-[7rem_1fr_auto] sm:items-start dark:border-[#f4f1ea]/15"
                    >
                      <span className="font-semibold">{action.label}</span>
                      <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {action.detail}
                      </span>
                      {retentionAction ? (
                        <Button
                          className="h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => applyReaderRetentionAction(action)}
                        >
                          {retentionAction.actionLabel}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 grid gap-3">
                {readerRetentionPlan.slots.length > 0 ? (
                  readerRetentionPlan.slots.map((slot, index) => {
                    const item = rankedItemsById.get(slot.id);

                    return (
                      <article
                        key={`${slot.label}-${slot.id}`}
                        className="grid gap-3 border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                      >
                        <div className="grid gap-1">
                          <Link
                            className="font-semibold hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                            href={`/news/${slot.id}`}
                          >
                            {slot.label} / {slot.title}
                          </Link>
                          <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                            {slot.sourceName} / {slot.reason}
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
                      </article>
                    );
                  })
                ) : (
                  <div className="border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    Return slots will appear after ranked stories or behavior
                    arrive.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Preference Coverage</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {preferenceCoverageDebt.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {preferenceCoverageDebt.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {preferenceCoverageDebt.metrics.map((metric) => (
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
                {preferenceCoverageDebt.debts.length > 0 ? (
                  preferenceCoverageDebt.debts.map((debt) => (
                    <div
                      key={`${debt.kind}-${debt.signal}`}
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-xs sm:grid-cols-[minmax(0,0.35fr)_minmax(0,1fr)_auto] sm:items-start dark:border-[#f4f1ea]/15"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold">
                          {debt.label}
                        </div>
                        <div className="mt-1 font-mono text-[10px] tracking-[0.12em] text-[#5b5750] uppercase dark:text-[#bbb4aa]">
                          {debt.kind}
                        </div>
                      </div>
                      <p className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {debt.reason}
                      </p>
                      <Button
                        className="h-8 rounded-none px-2 text-xs whitespace-nowrap"
                        type="button"
                        variant="outline"
                        onClick={() =>
                          applyPreferenceCoverageDebtAction(debt.action)
                        }
                      >
                        {debt.actionLabel}
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    Current ranked stories cover the active For You profile.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Diversity Governor</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {recommendationDiversityGovernor.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {recommendationDiversityGovernor.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {recommendationDiversityGovernor.metrics.map((metric) => (
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
                {recommendationDiversityGovernor.controls.map((control) => {
                  const diversityAction =
                    getNewsRecommendationDiversityGovernorTrainingAction(
                      control,
                    );

                  return (
                    <div
                      key={`${control.dimension}-${control.label}`}
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-xs sm:grid-cols-[5rem_1fr_auto] sm:items-start dark:border-[#f4f1ea]/15"
                    >
                      <span className="font-mono text-[10px] tracking-[0.12em] text-[#8a241c] uppercase dark:text-[#ff8b7e]">
                        {control.dimension} / {control.shareLabel}
                      </span>
                      <span>
                        <span className="block font-semibold">
                          {control.label}
                        </span>
                        <span className="mt-1 block leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {control.detail}
                        </span>
                        <span className="mt-1 block font-mono text-[10px] tracking-[0.12em] text-[#5b5750] uppercase dark:text-[#bbb4aa]">
                          {control.statusLabel}
                        </span>
                      </span>
                      {diversityAction ? (
                        <Button
                          className="h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            applyRecommendationDiversityGovernorAction(control)
                          }
                        >
                          {diversityAction.actionLabel}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Diversity Repair Queue</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {recommendationDiversityRepairQueue.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {recommendationDiversityRepairQueue.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {recommendationDiversityRepairQueue.metrics.map((metric) => (
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
                {recommendationDiversityRepairQueue.repairs.length > 0 ? (
                  recommendationDiversityRepairQueue.repairs.map(
                    (repair, index) => {
                      const item = rankedItemsById.get(repair.candidate.id);

                      return (
                        <article
                          key={`${repair.dimension}-${repair.candidate.id}`}
                          className="grid gap-3 border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                        >
                          <div className="grid gap-1 sm:grid-cols-[5rem_1fr]">
                            <span className="font-mono text-[10px] tracking-[0.12em] text-[#8a241c] uppercase dark:text-[#ff8b7e]">
                              {repair.dimension} / {repair.shareLabel}
                            </span>
                            <span>
                              <Link
                                className="block font-semibold hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                                href={`/news/${repair.candidate.id}`}
                              >
                                {repair.label}
                              </Link>
                              <span className="mt-1 block leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                                Replace {repair.replaceStory.title} with{" "}
                                {repair.candidate.title}.
                              </span>
                              <span className="mt-1 block leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                                {repair.reason}
                              </span>
                              <span className="mt-1 block font-mono text-[10px] tracking-[0.12em] text-[#5b5750] uppercase dark:text-[#bbb4aa]">
                                {repair.candidate.sourceName} / Score{" "}
                                {repair.candidate.personalizedScore}
                              </span>
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
                        </article>
                      );
                    },
                  )
                ) : (
                  <div className="border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    No diversity repairs are needed for the current
                    recommendation queue.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Source Saturation</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {recommendationSourceSaturation.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {recommendationSourceSaturation.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {recommendationSourceSaturation.metrics.map((metric) => (
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
                {recommendationSourceSaturation.actions.map((action) => {
                  const saturationAction =
                    getNewsRecommendationSaturationTrainingAction(action);

                  return (
                    <div
                      key={action.label}
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-xs sm:grid-cols-[1fr_auto] sm:items-start dark:border-[#f4f1ea]/15"
                    >
                      <div className="grid gap-1">
                        <span className="font-semibold">{action.label}</span>
                        <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {action.detail}
                        </span>
                      </div>
                      {saturationAction ? (
                        <Button
                          className="h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            applyRecommendationSaturationAction(action)
                          }
                        >
                          {saturationAction.actionLabel}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Topic Saturation</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {recommendationTopicSaturation.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {recommendationTopicSaturation.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {recommendationTopicSaturation.metrics.map((metric) => (
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
                {recommendationTopicSaturation.actions.map((action) => {
                  const saturationAction =
                    getNewsRecommendationSaturationTrainingAction(action);

                  return (
                    <div
                      key={action.label}
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-xs sm:grid-cols-[1fr_auto] sm:items-start dark:border-[#f4f1ea]/15"
                    >
                      <div className="grid gap-1">
                        <span className="font-semibold">{action.label}</span>
                        <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {action.detail}
                        </span>
                      </div>
                      {saturationAction ? (
                        <Button
                          className="h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            applyRecommendationSaturationAction(action)
                          }
                        >
                          {saturationAction.actionLabel}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Entity Saturation</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {recommendationEntitySaturation.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {recommendationEntitySaturation.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {recommendationEntitySaturation.metrics.map((metric) => (
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
                {recommendationEntitySaturation.actions.map((action) => {
                  const saturationAction =
                    getNewsRecommendationSaturationTrainingAction(action);

                  return (
                    <div
                      key={action.label}
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-xs sm:grid-cols-[1fr_auto] sm:items-start dark:border-[#f4f1ea]/15"
                    >
                      <div className="grid gap-1">
                        <span className="font-semibold">{action.label}</span>
                        <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {action.detail}
                        </span>
                      </div>
                      {saturationAction ? (
                        <Button
                          className="h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            applyRecommendationSaturationAction(action)
                          }
                        >
                          {saturationAction.actionLabel}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">Reader Satisfaction</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {readerSatisfactionBrief.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {readerSatisfactionBrief.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {readerSatisfactionBrief.metrics.map((metric) => (
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
                {readerSatisfactionBrief.actions.map((action) => {
                  const satisfactionAction =
                    getNewsReaderSatisfactionTrainingAction({
                      action,
                      formatCategory: getCategoryLabel,
                      historyItems,
                      items: rankedItems,
                      negativeFeedbackItems,
                      positiveFeedbackItems,
                      savedItems,
                    });

                  return (
                    <div
                      key={action.label}
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-xs sm:grid-cols-[1fr_auto] sm:items-start dark:border-[#f4f1ea]/15"
                    >
                      <div className="grid gap-1">
                        <span className="font-semibold">{action.label}</span>
                        <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {action.detail}
                        </span>
                      </div>
                      {satisfactionAction ? (
                        <Button
                          className="h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => applyReaderSatisfactionAction(action)}
                        >
                          {satisfactionAction.actionLabel}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black">
                    Recommendation Rotation
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {recommendationRotationQueue.summary}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {recommendationRotationQueue.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {recommendationRotationQueue.metrics.map((metric) => (
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
                {recommendationRotationQueue.entries.length > 0 ? (
                  recommendationRotationQueue.entries.map((entry, index) => {
                    const item = rankedItemsById.get(entry.id);
                    const rotationActionInput = item
                      ? {
                          formatCategory: getCategoryLabel,
                          item,
                          objective: entry.objective,
                        }
                      : null;
                    const rotationAction = rotationActionInput
                      ? getNewsRecommendationRotationTrainingAction(
                          rotationActionInput,
                        )
                      : null;

                    return (
                      <article
                        key={`${entry.label}-${entry.id}`}
                        className="grid gap-3 border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                      >
                        <div className="grid gap-1">
                          <span className="flex flex-wrap items-center gap-2 font-semibold">
                            <span className="font-mono">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span>{entry.label}</span>
                            <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                              {entry.scoreLabel}
                            </span>
                          </span>
                          <Link
                            className="leading-5 text-[#5b5750] hover:text-[#8a241c] dark:text-[#bbb4aa] dark:hover:text-[#ff8b7e]"
                            href={`/news/${entry.id}`}
                          >
                            {entry.title}
                          </Link>
                          <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                            {entry.sourceName} / {entry.categoryLabel}
                          </span>
                          <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                            {entry.reason}
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
                        {rotationAction && rotationActionInput ? (
                          <Button
                            className="h-8 w-fit rounded-none px-2 text-xs"
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() =>
                              applyRecommendationRotationAction(
                                rotationActionInput,
                              )
                            }
                          >
                            {rotationAction.actionLabel}
                          </Button>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <div className="border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    Recommendation rotation will appear after stories are
                    ranked.
                  </div>
                )}
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
                  readerLearningLoop.actions.map((action) => {
                    const learningLoopAction =
                      getNewsReaderLearningLoopTrainingAction({
                        action,
                        formatCategory: getCategoryLabel,
                        historyItems,
                        items: rankedItems,
                        negativeFeedbackItems,
                        positiveFeedbackItems,
                        savedItems,
                      });

                    return (
                      <div
                        key={action.key}
                        className="grid gap-2 border-t border-[#161616]/20 pt-3 text-xs sm:grid-cols-[1fr_auto] sm:items-start dark:border-[#f4f1ea]/15"
                      >
                        <div className="grid gap-1">
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
                        {learningLoopAction ? (
                          <Button
                            className="h-8 w-fit rounded-none px-2 text-xs"
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() =>
                              applyReaderLearningLoopAction(action)
                            }
                          >
                            {learningLoopAction.actionLabel}
                          </Button>
                        ) : null}
                      </div>
                    );
                  })
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
                  readerJourneyMap.steps.map((step, index) => {
                    const item = step.id
                      ? rankedItemsById.get(step.id)
                      : undefined;
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

                    return (
                      <article
                        key={`${step.key}-${step.id ?? step.title}`}
                        className="grid gap-3 border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                      >
                        {step.id && !isPreview ? (
                          <Link
                            className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                            href={`/news/${step.id}`}
                          >
                            {stepBody}
                          </Link>
                        ) : (
                          <div className="grid gap-1">{stepBody}</div>
                        )}
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
                      </article>
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
                  readerScorecards.scorecards.map((scorecard, index) => {
                    const item = rankedItemsById.get(scorecard.id);

                    return (
                      <article
                        key={scorecard.id}
                        className="grid gap-3 border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                      >
                        <Link
                          className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                          href={`/news/${scorecard.id}`}
                        >
                          <span className="font-semibold">
                            {scorecard.title}
                          </span>
                          <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                            {scorecard.sourceName} / {scorecard.categoryLabel} /{" "}
                            {scorecard.scoreLabel}
                          </span>
                          <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                            {scorecard.summary}
                          </span>
                        </Link>
                        <div className="grid gap-2">
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
                      </article>
                    );
                  })
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
                  readerDaypartPlan.lanes.map((lane, index) => {
                    const item = rankedItemsById.get(lane.id);

                    return (
                      <article
                        key={`${lane.key}-${lane.id}`}
                        className="grid gap-3 border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                      >
                        <div className="grid gap-1">
                          <Link
                            className="font-semibold hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                            href={`/news/${lane.id}`}
                          >
                            {lane.label} / {lane.title}
                          </Link>
                          <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                            {lane.sourceName} / {lane.categoryLabel} /{" "}
                            {lane.scoreLabel}
                          </span>
                          <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                            {lane.reason}
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
                      </article>
                    );
                  })
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
                  readerDigest.nextReads.map((story, index) => {
                    const item = rankedItemsById.get(story.id);

                    return (
                      <article
                        key={story.id}
                        className="grid gap-3 border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15"
                      >
                        <div className="grid gap-1">
                          <Link
                            className="font-semibold hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                            href={`/news/${story.id}`}
                          >
                            {story.title}
                          </Link>
                          <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                            {story.sourceName} / {story.categoryLabel} /{" "}
                            {story.scoreLabel}
                          </span>
                          <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                            {story.reason}
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
                      </article>
                    );
                  })
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
                          applyPreferenceBiasAction({
                            direction: "lower",
                            key: control.key,
                            label: control.label,
                          })
                        }
                      >
                        Lower
                      </Button>
                      <Button
                        className="h-8 rounded-none text-xs"
                        type="button"
                        variant="outline"
                        onClick={() =>
                          applyPreferenceBiasAction({
                            direction: "raise",
                            key: control.key,
                            label: control.label,
                          })
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
                                applyPreferenceProfileAction({
                                  actionLabel:
                                    signal.kind === "category"
                                      ? "Remove topic"
                                      : signal.kind === "source"
                                        ? "Remove source"
                                        : signal.kind === "tag"
                                          ? "Remove angle"
                                          : "Remove entity",
                                  effect: "remove",
                                  label: signal.label,
                                  signals: [signal],
                                  source: "control",
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
                          onClick={() =>
                            applyPreferenceProfileAction({
                              actionLabel: preset.actionLabel,
                              label: preset.label,
                              signals: preset.signals,
                              source: "preset",
                            })
                          }
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
                                applyPreferenceProfileAction({
                                  actionLabel: suggestion.actionLabel,
                                  label: suggestion.label,
                                  signals: [suggestion],
                                  source: "starter",
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
                        {"impactStories" in suggestion &&
                        suggestion.impactStories.length > 0 ? (
                          <div className="mt-3 grid gap-2">
                            {suggestion.impactStories.map(
                              (story, storyIndex) => {
                                const item = rankedItemsById.get(story.id);

                                return (
                                  <article
                                    key={`${suggestion.action}-${suggestion.kind}-${suggestion.signal}-${story.id}`}
                                    className="grid gap-2 border-t border-[#161616]/15 pt-2 dark:border-[#f4f1ea]/10"
                                  >
                                    <Link
                                      className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                                      href={`/news/${story.id}`}
                                    >
                                      <span className="truncate font-semibold">
                                        {story.title}
                                      </span>
                                      <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                                        {story.sourceName} / {story.reason}
                                      </span>
                                    </Link>
                                    {item ? (
                                      <StoryAction
                                        item={item}
                                        guardrailItem={selectGuardrailItemForStory(
                                          item,
                                        )}
                                        isPreview={isPreview}
                                        rankSlot={storyIndex + 1}
                                        savedItem={selectSavedItemForStory(
                                          item,
                                        )}
                                        onAction={recordStoryAction}
                                        onRemoveSaved={removeSavedItem}
                                        onRestoreGuardrail={
                                          restoreGuardrailItem
                                        }
                                      />
                                    ) : null}
                                  </article>
                                );
                              },
                            )}
                          </div>
                        ) : null}
                      </div>
                      <Button
                        className="h-8 rounded-none px-2 text-xs whitespace-nowrap"
                        disabled={suggestion.action === "keep"}
                        type="button"
                        variant="outline"
                        onClick={() =>
                          applyPreferenceTuningSuggestion(suggestion)
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
                          lane.stories.map((story, storyIndex) => {
                            const item = rankedItemsById.get(story.id);

                            return (
                              <article
                                key={`${lane.key}-${story.id}`}
                                className="grid gap-2 border-t border-[#161616]/15 pt-2 dark:border-[#f4f1ea]/10"
                              >
                                <Link
                                  className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                                  href={`/news/${story.id}`}
                                >
                                  <span className="truncate font-semibold">
                                    {story.title}
                                  </span>
                                  <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                                    {story.sourceName} / {story.reason}
                                  </span>
                                </Link>
                                {item ? (
                                  <StoryAction
                                    item={item}
                                    guardrailItem={selectGuardrailItemForStory(
                                      item,
                                    )}
                                    isPreview={isPreview}
                                    rankSlot={storyIndex + 1}
                                    savedItem={selectSavedItemForStory(item)}
                                    onAction={recordStoryAction}
                                    onRemoveSaved={removeSavedItem}
                                    onRestoreGuardrail={restoreGuardrailItem}
                                  />
                                ) : null}
                              </article>
                            );
                          })
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
                  filterBubbleReport.checks.map((check) => {
                    const filterBubbleAction =
                      getNewsFilterBubbleTrainingAction({
                        check,
                        formatCategory: getCategoryLabel,
                        items: rankedItems,
                        profile,
                      });
                    const filterBubbleActionLabel =
                      filterBubbleAction?.kind === "profile"
                        ? filterBubbleAction.action.actionLabel
                        : filterBubbleAction
                          ? `${filterBubbleAction.action.direction === "raise" ? "Raise" : "Lower"} ${
                              filterBubbleAction.action.label
                            }`
                          : null;

                    return (
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
                            {filterBubbleActionLabel ? (
                              <Button
                                className="mt-1 h-8 w-fit rounded-none px-2 text-xs"
                                size="sm"
                                type="button"
                                variant={
                                  filterBubbleAction?.kind === "profile" &&
                                  filterBubbleAction.action.effect === "remove"
                                    ? "outline"
                                    : "default"
                                }
                                onClick={() => applyFilterBubbleAction(check)}
                              >
                                {filterBubbleActionLabel}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
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
                  tasteCalibration.actions.map((action) => {
                    const tasteAction = getNewsTasteCalibrationTrainingAction({
                      action,
                      formatCategory: getCategoryLabel,
                      items: rankedItems,
                    });

                    return (
                      <div
                        key={action.key}
                        className="grid gap-2 border-t border-[#161616]/20 pt-3 text-xs sm:grid-cols-[1fr_auto] sm:items-start dark:border-[#f4f1ea]/15"
                      >
                        <div className="grid gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">
                              {action.label}
                            </span>
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
                        </div>
                        {tasteAction ? (
                          <Button
                            className="h-8 w-fit rounded-none px-2 text-xs"
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => applyTasteCalibrationAction(action)}
                          >
                            {tasteAction.actionLabel}
                          </Button>
                        ) : null}
                      </div>
                    );
                  })
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
                  discoveryLadder.rungs.map((rung, index) => {
                    const item = rankedItemsById.get(rung.id);
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

                            if (!isFollowed) {
                              applyPreferenceProfileAction(
                                getNewsPreferenceProfileToggleAction({
                                  active: false,
                                  kind: "category",
                                  label: getCategoryLabel(rung.category),
                                  signal: rung.category,
                                }),
                              );
                            }
                            setActiveCategory(rung.category);
                            setFeedMode("for_you");
                          }}
                        >
                          {isFollowed ? "Focus topic" : rung.actionLabel}
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
              {availableSources.map((source) => {
                const active = profile.preferredSources.includes(source);

                return (
                  <PreferenceButton
                    key={source}
                    active={active}
                    onClick={() =>
                      applyPreferenceProfileAction(
                        getNewsPreferenceProfileToggleAction({
                          active,
                          kind: "source",
                          label: source,
                          signal: source,
                        }),
                      )
                    }
                  >
                    {source}
                  </PreferenceButton>
                );
              })}
            </PreferenceGroup>

            <PreferenceGroup title="Angles">
              {availableAngleOptions.map((angle) => {
                const active = hasAngleValue(
                  profile.preferredEntities,
                  angle.signal,
                );

                return (
                  <PreferenceButton
                    key={angle.signal}
                    active={active}
                    onClick={() =>
                      applyPreferenceProfileAction(
                        getNewsPreferenceProfileToggleAction({
                          active,
                          kind: "tag",
                          label: angle.label,
                          signal: angle.signal,
                        }),
                      )
                    }
                  >
                    {angle.label}
                  </PreferenceButton>
                );
              })}
            </PreferenceGroup>

            <PreferenceGroup title="Entities">
              {availableEntities.map((entity) => {
                const active = hasEntityValue(
                  profile.preferredEntities,
                  entity,
                );

                return (
                  <PreferenceButton
                    key={entity}
                    active={active}
                    onClick={() =>
                      applyPreferenceProfileAction(
                        getNewsPreferenceProfileToggleAction({
                          active,
                          kind: "entity",
                          label: entity,
                          signal: entity,
                        }),
                      )
                    }
                  >
                    {entity}
                  </PreferenceButton>
                );
              })}
            </PreferenceGroup>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <BiasButton
                label="Fresh"
                value={profile.recencyBias}
                onClick={() =>
                  applyPreferenceBiasCycleAction({
                    key: "recencyBias",
                    label: "Fresh",
                  })
                }
              />
              <BiasButton
                label="Novel"
                value={profile.noveltyBias}
                onClick={() =>
                  applyPreferenceBiasCycleAction({
                    key: "noveltyBias",
                    label: "Novel",
                  })
                }
              />
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Guardrail Recovery</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {guardrailRecoveryPlan.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {guardrailRecoveryPlan.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {guardrailRecoveryPlan.metrics.map((metric) => (
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
              {guardrailRecoveryPlan.actions.map((action) => {
                const recoveryAction = getNewsGuardrailRecoveryTrainingAction({
                  action,
                  formatCategory: getCategoryLabel,
                  historyItems,
                  items: rankedItems,
                  negativeFeedbackItems,
                  positiveFeedbackItems,
                  restoredGuardrailItems,
                  savedItems,
                });

                return (
                  <div
                    key={action.label}
                    className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm sm:grid-cols-[1fr_auto] sm:items-start dark:border-[#f4f1ea]/15"
                  >
                    <div>
                      <div className="font-semibold">{action.label}</div>
                      <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        {action.detail}
                      </p>
                    </div>
                    {recoveryAction ? (
                      <Button
                        className="h-8 w-fit rounded-none px-2 text-xs"
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => applyGuardrailRecoveryAction(action)}
                      >
                        {recoveryAction.actionLabel}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid gap-3">
              {guardrailRecoveryPlan.candidates.length > 0 ? (
                guardrailRecoveryPlan.candidates.map((candidate, index) => {
                  const item = rankedItemsById.get(candidate.id);

                  return (
                    <article
                      key={candidate.id}
                      className="grid gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <Link
                        className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                        href={`/news/${candidate.id}`}
                      >
                        <span className="font-mono text-[11px] text-[#5b5750] uppercase dark:text-[#bbb4aa]">
                          {candidate.label} / {candidate.sourceName}
                        </span>
                        <span className="leading-5 font-semibold">
                          {candidate.title}
                        </span>
                        <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {candidate.reason}
                        </span>
                      </Link>
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
                    </article>
                  );
                })
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Recovery candidates will appear after restored or conflicted
                  guardrails match current ranked stories.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">
                  Breaking Escalation Queue
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {breakingEscalationQueue.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {breakingEscalationQueue.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {breakingEscalationQueue.metrics.map((metric) => (
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
              {breakingEscalationQueue.lanes.map((lane) => (
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
                  <div className="mt-3 grid gap-2">
                    {lane.stories.length > 0 ? (
                      lane.stories.map((story, storyIndex) => {
                        const item = rankedItemsById.get(story.id);

                        return (
                          <article
                            key={`${lane.key}-${story.id}`}
                            className="grid gap-2 border-t border-[#161616]/15 pt-2 dark:border-[#f4f1ea]/10"
                          >
                            <Link
                              className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                              href={`/news/${story.id}`}
                            >
                              <span className="font-mono text-[11px] text-[#8a241c] uppercase dark:text-[#ff8b7e]">
                                {story.urgencyLabel} / {story.categoryLabel}
                              </span>
                              <span className="leading-5 font-semibold">
                                {story.title}
                              </span>
                              <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                                {story.sourceName} / {story.scoreLabel}
                              </span>
                              <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                                {story.reason}
                              </span>
                            </Link>
                            {item ? (
                              <StoryAction
                                item={item}
                                guardrailItem={selectGuardrailItemForStory(
                                  item,
                                )}
                                isPreview={isPreview}
                                rankSlot={storyIndex + 1}
                                savedItem={selectSavedItemForStory(item)}
                                onAction={recordStoryAction}
                                onRemoveSaved={removeSavedItem}
                                onRestoreGuardrail={restoreGuardrailItem}
                              />
                            ) : null}
                          </article>
                        );
                      })
                    ) : (
                      <p className="border-t border-[#161616]/15 pt-2 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/10 dark:text-[#bbb4aa]">
                        No stories are currently assigned to this escalation
                        lane.
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
                <h2 className="text-xl font-black">Data Vault</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {personalizationDataVault.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {personalizationDataVault.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {personalizationDataVault.metrics.map((metric) => (
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
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {personalizationDataVault.controls.map((control) => (
                <div
                  key={control.label}
                  className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="font-semibold">{control.label}</div>
                  <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {control.detail}
                  </p>
                  <Button
                    className="mt-3 h-8 w-fit rounded-none px-2 text-xs"
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => applyPersonalizationDataVaultAction(control)}
                  >
                    {control.action.actionLabel}
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-[#161616]/20 pt-4 text-sm dark:border-[#f4f1ea]/15">
              <div className="font-semibold">Import profile package</div>
              <textarea
                aria-label="Data Vault profile package JSON"
                className="mt-2 min-h-28 w-full resize-y border border-[#161616]/30 bg-transparent p-3 font-mono text-xs leading-5 break-words text-[#161616] outline-none focus:border-[#8a241c] dark:border-[#f4f1ea]/25 dark:text-[#f4f1ea] dark:focus:border-[#ff8b7e]"
                placeholder="Paste Data Vault profile JSON"
                value={dataVaultImportDraft}
                onChange={(event) =>
                  setDataVaultImportDraft(event.currentTarget.value)
                }
              />
              <Button
                className="mt-3 h-8 w-fit rounded-none px-2 text-xs"
                disabled={!dataVaultImportDraft.trim()}
                size="sm"
                type="button"
                variant="outline"
                onClick={applyPersonalizationDataVaultProfileImport}
              >
                Import profile
              </Button>
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
                refreshSimulation.moves.map((move) => {
                  const refreshSimulationAction =
                    getNewsRefreshSimulationTrainingAction(move);

                  return (
                    <article
                      key={move.key}
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <Link
                        className="grid gap-2 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
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
                      </Link>
                      <Button
                        className="h-8 w-fit rounded-none px-2 text-xs"
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => applyRefreshSimulationAction(move)}
                      >
                        {refreshSimulationAction.actionLabel}
                      </Button>
                    </article>
                  );
                })
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
              {editionQualityGate.checks.map((check) => {
                const qualityActionInput = {
                  check,
                  formatCategory: getCategoryLabel,
                  items: rankedItems,
                  negativeFeedbackItems,
                };
                const qualityAction =
                  getNewsEditionQualityGateTrainingAction(qualityActionInput);

                return (
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
                      {qualityAction ? (
                        <Button
                          className="mt-1 h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            applyEditionQualityGateAction(qualityActionInput)
                          }
                        >
                          {qualityAction.actionLabel}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
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
                      lane.stories.map((story, storyIndex) => {
                        const item = rankedItemsById.get(story.id);
                        const pushAction = item
                          ? getNewsPersonalizedPushQueueTrainingAction({
                              item,
                              laneKey: lane.key,
                              story,
                            })
                          : null;
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

                        return (
                          <article
                            key={`${lane.key}-${story.id}`}
                            className="grid gap-2 border-t border-[#161616]/10 pt-2 dark:border-[#f4f1ea]/10"
                          >
                            {isPreview ? (
                              <div className="grid gap-1">{storyBody}</div>
                            ) : (
                              <Link
                                className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                                href={`/news/${story.id}`}
                              >
                                {storyBody}
                              </Link>
                            )}
                            {item ? (
                              <StoryAction
                                item={item}
                                guardrailItem={selectGuardrailItemForStory(
                                  item,
                                )}
                                isPreview={isPreview}
                                rankSlot={storyIndex + 1}
                                savedItem={selectSavedItemForStory(item)}
                                onAction={recordStoryAction}
                                onRemoveSaved={removeSavedItem}
                                onRestoreGuardrail={restoreGuardrailItem}
                              />
                            ) : null}
                            {pushAction && item ? (
                              <Button
                                className="h-8 w-fit rounded-none px-2 text-xs"
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  applyPersonalizedPushQueueAction({
                                    item,
                                    laneKey: lane.key,
                                    story,
                                  })
                                }
                              >
                                {pushAction.actionLabel}
                              </Button>
                            ) : null}
                          </article>
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
                <h2 className="text-xl font-black">Newsletter Studio</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {newsletterPlan.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 text-right font-mono text-sm dark:border-[#f4f1ea]">
                {newsletterPlan.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {newsletterPlan.metrics.map((metric) => (
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
              {newsletterPlan.lanes.map((lane) => (
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
                      lane.stories.map((story, storyIndex) => {
                        const item = rankedItemsById.get(story.id);
                        const storyBody = (
                          <>
                            <span className="leading-5 font-semibold">
                              {story.cadenceLabel}: {story.title}
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

                        return (
                          <article
                            key={`${lane.key}-${story.id}`}
                            className="grid gap-2 border-t border-[#161616]/10 pt-2 dark:border-[#f4f1ea]/10"
                          >
                            {isPreview ? (
                              <div className="grid gap-1">{storyBody}</div>
                            ) : (
                              <Link
                                className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                                href={`/news/${story.id}`}
                              >
                                {storyBody}
                              </Link>
                            )}
                            {item ? (
                              <StoryAction
                                item={item}
                                guardrailItem={selectGuardrailItemForStory(
                                  item,
                                )}
                                isPreview={isPreview}
                                rankSlot={storyIndex + 1}
                                savedItem={selectSavedItemForStory(item)}
                                onAction={recordStoryAction}
                                onRemoveSaved={removeSavedItem}
                                onRestoreGuardrail={restoreGuardrailItem}
                              />
                            ) : null}
                          </article>
                        );
                      })
                    ) : (
                      <p className="border-t border-[#161616]/10 pt-2 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/10 dark:text-[#bbb4aa]">
                        No stories in this newsletter lane.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Membership Meter</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {membershipMeter.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 text-right font-mono text-sm dark:border-[#f4f1ea]">
                {membershipMeter.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {membershipMeter.metrics.map((metric) => (
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
              {membershipMeter.lanes.map((lane) => (
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
                      lane.stories.map((story, storyIndex) => {
                        const item = rankedItemsById.get(story.id);
                        const storyBody = (
                          <>
                            <span className="leading-5 font-semibold">
                              {story.offerLabel}: {story.title}
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

                        return (
                          <article
                            key={`${lane.key}-${story.id}`}
                            className="grid gap-2 border-t border-[#161616]/10 pt-2 dark:border-[#f4f1ea]/10"
                          >
                            {isPreview ? (
                              <div className="grid gap-1">{storyBody}</div>
                            ) : (
                              <Link
                                className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                                href={`/news/${story.id}`}
                              >
                                {storyBody}
                              </Link>
                            )}
                            {item ? (
                              <StoryAction
                                item={item}
                                guardrailItem={selectGuardrailItemForStory(
                                  item,
                                )}
                                isPreview={isPreview}
                                rankSlot={storyIndex + 1}
                                savedItem={selectSavedItemForStory(item)}
                                onAction={recordStoryAction}
                                onRemoveSaved={removeSavedItem}
                                onRestoreGuardrail={restoreGuardrailItem}
                              />
                            ) : null}
                          </article>
                        );
                      })
                    ) : (
                      <p className="border-t border-[#161616]/10 pt-2 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/10 dark:text-[#bbb4aa]">
                        No stories in this membership lane.
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
                <h2 className="text-xl font-black">Model Training Batch</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {modelTrainingBatch.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 text-right font-mono text-sm dark:border-[#f4f1ea]">
                {modelTrainingBatch.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {modelTrainingBatch.metrics.map((metric) => (
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
              {modelTrainingBatch.lanes.map((lane) => (
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
                      lane.stories.map((story, storyIndex) => {
                        const item = rankedItemsById.get(story.id);
                        const modelAction = item
                          ? getNewsModelTrainingBatchTrainingAction({
                              formatCategory: getCategoryLabel,
                              item,
                              laneKey: lane.key,
                              profile,
                            })
                          : null;
                        const storyBody = (
                          <>
                            <span className="leading-5 font-semibold">
                              {story.outcomeLabel}: {story.title}
                            </span>
                            <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                              {story.sourceName} / {story.categoryLabel} /{" "}
                              {story.scoreLabel}
                            </span>
                            <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                              {story.reason} / {story.signalLabel}
                            </span>
                          </>
                        );

                        return (
                          <article
                            key={`${lane.key}-${story.id}`}
                            className="grid gap-2 border-t border-[#161616]/10 pt-2 dark:border-[#f4f1ea]/10"
                          >
                            {isPreview ? (
                              <div className="grid gap-1">{storyBody}</div>
                            ) : (
                              <Link
                                className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                                href={`/news/${story.id}`}
                              >
                                {storyBody}
                              </Link>
                            )}
                            {item ? (
                              <StoryAction
                                item={item}
                                guardrailItem={selectGuardrailItemForStory(
                                  item,
                                )}
                                isPreview={isPreview}
                                rankSlot={storyIndex + 1}
                                savedItem={selectSavedItemForStory(item)}
                                onAction={recordStoryAction}
                                onRemoveSaved={removeSavedItem}
                                onRestoreGuardrail={restoreGuardrailItem}
                              />
                            ) : null}
                            {modelAction && item ? (
                              <Button
                                className="h-8 w-fit rounded-none px-2 text-xs"
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  applyModelTrainingBatchAction({
                                    formatCategory: getCategoryLabel,
                                    item,
                                    laneKey: lane.key,
                                    profile,
                                  })
                                }
                              >
                                {modelAction.actionLabel}
                              </Button>
                            ) : null}
                          </article>
                        );
                      })
                    ) : (
                      <p className="border-t border-[#161616]/10 pt-2 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/10 dark:text-[#bbb4aa]">
                        No stories in this training lane.
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
                <h2 className="text-xl font-black">Profile Update Proposal</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {profileUpdateProposal.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 text-right font-mono text-sm dark:border-[#f4f1ea]">
                {profileUpdateProposal.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {profileUpdateProposal.metrics.map((metric) => (
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
              {profileUpdateProposal.lanes.map((lane) => (
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
                    {lane.proposals.length > 0 ? (
                      lane.proposals.map((proposal, proposalIndex) => {
                        const item = rankedItemsById.get(proposal.storyId);
                        const trainingAction =
                          getNewsProfileUpdateProposalTrainingAction(proposal);
                        const proposalBody = (
                          <div className="grid gap-1">
                            <Link
                              className="leading-5 font-semibold hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                              href={`/news/${proposal.storyId}`}
                            >
                              {proposal.actionLabel}: {proposal.signalLabel}
                            </Link>
                            <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                              {proposal.signalKind} / {proposal.sourceName} /{" "}
                              {proposal.evidenceLabel}
                            </span>
                            <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                              {proposal.reason}
                            </span>
                          </div>
                        );

                        return (
                          <div
                            key={proposal.id}
                            className="grid gap-2 border-t border-[#161616]/10 pt-2 dark:border-[#f4f1ea]/10"
                          >
                            {isPreview ? (
                              <div className="grid gap-1">{proposalBody}</div>
                            ) : (
                              proposalBody
                            )}
                            {item ? (
                              <StoryAction
                                item={item}
                                guardrailItem={selectGuardrailItemForStory(
                                  item,
                                )}
                                isPreview={isPreview}
                                rankSlot={proposalIndex + 1}
                                savedItem={selectSavedItemForStory(item)}
                                onAction={recordStoryAction}
                                onRemoveSaved={removeSavedItem}
                                onRestoreGuardrail={restoreGuardrailItem}
                              />
                            ) : null}
                            {trainingAction ? (
                              <Button
                                className="h-8 w-fit rounded-none px-2 text-xs"
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  applyProfileUpdateProposal(proposal)
                                }
                              >
                                Apply proposal
                              </Button>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <p className="border-t border-[#161616]/10 pt-2 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/10 dark:text-[#bbb4aa]">
                        No profile proposals in this lane.
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
                readerWatchlist.entries.map((entry, index) => {
                  const watchTitle = (
                    <span className="leading-5 font-semibold">
                      {entry.topStory?.title}
                    </span>
                  );
                  const item = entry.topStory
                    ? rankedItemsById.get(entry.topStory.id)
                    : undefined;
                  const watchlistAction =
                    getNewsReaderWatchlistTrainingAction(entry);

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
                        <div className="grid gap-2">
                          {isPreview ? (
                            <div>{watchTitle}</div>
                          ) : (
                            <Link
                              className="hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                              href={`/news/${entry.topStory.id}`}
                            >
                              {watchTitle}
                            </Link>
                          )}
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
                      ) : null}
                      {watchlistAction ? (
                        <Button
                          className="h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => applyReaderWatchlistAction(entry)}
                        >
                          {watchlistAction.actionLabel}
                        </Button>
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
                hotBoard.entries.map((entry, index) => {
                  const item = rankedItemsById.get(entry.id);
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
                        {item ? (
                          <div className="mt-2">
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
                          </div>
                        ) : null}
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
                recommendationTrace.steps.map((step, index) => {
                  const traceActionInput = {
                    formatCategory: getCategoryLabel,
                    items: rankedItems,
                    negativeFeedbackItems,
                    step,
                  };
                  const traceAction =
                    getNewsRecommendationTraceTrainingAction(traceActionInput);

                  return (
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
                        {traceAction ? (
                          <Button
                            className="mt-2 h-8 w-fit rounded-none px-2 text-xs"
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() =>
                              applyRecommendationTraceAction(traceActionInput)
                            }
                          >
                            {traceAction.actionLabel}
                          </Button>
                        ) : null}
                      </div>
                      <span className="font-mono text-xs">
                        {step.scoreLabel}
                      </span>
                    </div>
                  );
                })
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
                experimentAllocation.arms.map((arm) => {
                  const experimentActionInput = {
                    arm,
                    formatCategory: getCategoryLabel,
                    items: rankedItems,
                    negativeFeedbackItems,
                    profile,
                  };
                  const experimentAction =
                    getNewsExperimentAllocationTrainingAction(
                      experimentActionInput,
                    );
                  const experimentActionLabel =
                    experimentAction?.kind === "profile"
                      ? experimentAction.action.actionLabel
                      : experimentAction
                        ? `Raise ${experimentAction.action.label}`
                        : null;

                  return (
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
                        {experimentAction && experimentActionLabel ? (
                          <Button
                            className="mt-2 h-8 w-fit rounded-none px-2 text-xs"
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() =>
                              applyExperimentAllocationAction(
                                experimentActionInput,
                              )
                            }
                          >
                            {experimentActionLabel}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
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
                aggregationIntake.lanes.map((lane) => {
                  const intakeActionInput = {
                    formatCategory: getCategoryLabel,
                    items: rankedItems,
                    lane,
                  };
                  const intakeAction =
                    getNewsAggregationIntakeTrainingAction(intakeActionInput);

                  return (
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
                      {intakeAction ? (
                        <Button
                          className="mt-2 h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            applyAggregationIntakeAction(intakeActionInput)
                          }
                        >
                          {intakeAction.actionLabel}
                        </Button>
                      ) : null}
                      <div className="mt-3 grid gap-2">
                        {lane.stories.map((story, storyIndex) => {
                          const item = rankedItemsById.get(story.id);
                          const storyBody = (
                            <>
                              <span className="truncate font-semibold">
                                {story.title}
                              </span>
                              <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                                {story.sourceName} / {story.scoreLabel}
                              </span>
                              <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                                {story.reason}
                              </span>
                            </>
                          );

                          return (
                            <article
                              key={`${lane.key}-${story.id}`}
                              className="grid gap-2 border-t border-[#161616]/15 pt-2 dark:border-[#f4f1ea]/10"
                            >
                              {isPreview ? (
                                <div className="grid gap-1">{storyBody}</div>
                              ) : (
                                <Link
                                  className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                                  href={`/news/${story.id}`}
                                >
                                  {storyBody}
                                </Link>
                              )}
                              {item ? (
                                <StoryAction
                                  item={item}
                                  guardrailItem={selectGuardrailItemForStory(
                                    item,
                                  )}
                                  isPreview={isPreview}
                                  rankSlot={storyIndex + 1}
                                  savedItem={selectSavedItemForStory(item)}
                                  onAction={recordStoryAction}
                                  onRemoveSaved={removeSavedItem}
                                  onRestoreGuardrail={restoreGuardrailItem}
                                />
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Aggregation intake will appear after sources deliver stories.
                </div>
              )}
            </div>
            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black">
                    Aggregation Recovery Queue
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {aggregationRecoveryQueue.summary}
                  </p>
                </div>
                <span className="border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                  {aggregationRecoveryQueue.label}
                </span>
              </div>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
                {aggregationRecoveryQueue.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="border-t border-[#161616]/20 pt-2 dark:border-[#f4f1ea]/15"
                  >
                    <dt className="text-xs font-semibold text-[#5b5750] dark:text-[#bbb4aa]">
                      {metric.label}
                    </dt>
                    <dd className="mt-1 font-mono text-lg">{metric.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 grid gap-3">
                {aggregationRecoveryQueue.actions.length > 0 ? (
                  aggregationRecoveryQueue.actions.map((action) => {
                    const recoveryActionInput = {
                      action,
                      items: rankedItems,
                    };
                    const recoveryAction =
                      getNewsAggregationRecoveryTrainingAction(
                        recoveryActionInput,
                      );

                    return (
                      <article
                        key={`${action.priorityLabel}-${action.story.id}`}
                        className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm sm:grid-cols-[4rem_1fr] dark:border-[#f4f1ea]/15"
                      >
                        <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                          {action.priorityLabel}
                        </span>
                        <span>
                          <Link
                            className="grid gap-2 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                            href={`/news/${action.story.id}`}
                          >
                            <span className="grid gap-2 sm:grid-cols-[1fr_auto]">
                              <span className="font-semibold">
                                {action.actionLabel}
                              </span>
                              <span className="font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                                {action.laneLabel}
                              </span>
                            </span>
                            <span className="block leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                              {action.reason}
                            </span>
                            <span className="block text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                              {action.story.sourceName} /{" "}
                              {action.story.scoreLabel}
                            </span>
                          </Link>
                          {recoveryAction ? (
                            <Button
                              className="mt-2 h-8 w-fit rounded-none px-2 text-xs"
                              size="sm"
                              type="button"
                              variant="outline"
                              onClick={() =>
                                applyAggregationRecoveryAction(
                                  recoveryActionInput,
                                )
                              }
                            >
                              {recoveryAction.actionLabel}
                            </Button>
                          ) : null}
                        </span>
                      </article>
                    );
                  })
                ) : (
                  <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                    Aggregation recovery actions will appear when intake needs
                    verification, direct-source refresh, or fallback
                    replacement.
                  </p>
                )}
              </div>
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
                readerCohorts.cohorts.map((cohort) => {
                  const cohortAction = getNewsReaderCohortTrainingAction({
                    cohort,
                    formatCategory: getCategoryLabel,
                    profile,
                  });

                  return (
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
                          {cohortAction ? (
                            <Button
                              className="mt-3 w-full sm:w-auto"
                              size="sm"
                              variant={
                                cohortAction.effect === "remove"
                                  ? "outline"
                                  : "default"
                              }
                              onClick={() => applyReaderCohortAction(cohort)}
                            >
                              {cohortAction.actionLabel}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
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
                collaborativeSignals.signals.map((signal) => {
                  const collaborativeAction =
                    getNewsCollaborativeSignalTrainingAction({
                      formatCategory: getCategoryLabel,
                      profile,
                      signal,
                    });

                  return (
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
                          {collaborativeAction ? (
                            <Button
                              className="mt-3 w-full sm:w-auto"
                              size="sm"
                              onClick={() =>
                                applyCollaborativeSignalAction(signal)
                              }
                            >
                              {collaborativeAction.actionLabel}
                            </Button>
                          ) : null}
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
                  );
                })
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
                      lane.stories.map((story, storyIndex) => {
                        const item = rankedItemsById.get(story.id);
                        const alertActionInput = item
                          ? {
                              formatCategory: getCategoryLabel,
                              item,
                              laneKey: lane.key,
                            }
                          : null;
                        const alertAction = alertActionInput
                          ? getNewsAlertRoutingTrainingAction(alertActionInput)
                          : null;
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

                        return (
                          <article
                            key={`${lane.key}-${story.id}`}
                            className="grid gap-2 border-t border-[#161616]/10 pt-2 dark:border-[#f4f1ea]/10"
                          >
                            {isPreview ? (
                              <div className="grid gap-1">{storyBody}</div>
                            ) : (
                              <Link
                                className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                                href={`/news/${story.id}`}
                              >
                                {storyBody}
                              </Link>
                            )}
                            {item ? (
                              <StoryAction
                                item={item}
                                guardrailItem={selectGuardrailItemForStory(
                                  item,
                                )}
                                isPreview={isPreview}
                                rankSlot={storyIndex + 1}
                                savedItem={selectSavedItemForStory(item)}
                                onAction={recordStoryAction}
                                onRemoveSaved={removeSavedItem}
                                onRestoreGuardrail={restoreGuardrailItem}
                              />
                            ) : null}
                            {alertAction && alertActionInput ? (
                              <Button
                                className="h-8 w-fit rounded-none px-2 text-xs"
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  applyAlertRoutingAction(alertActionInput)
                                }
                              >
                                {alertAction.actionLabel}
                              </Button>
                            ) : null}
                          </article>
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
                sessionIntent.intents.map((intent, index) => {
                  const intentAction = getNewsSessionIntentTrainingAction({
                    formatCategory: getCategoryLabel,
                    intent,
                    profile,
                  });
                  const leadItem = intent.leadStory
                    ? rankedItemsById.get(intent.leadStory.id)
                    : undefined;

                  return (
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
                          {intentAction ? (
                            <Button
                              className="mt-3 w-full sm:w-auto"
                              size="sm"
                              variant={
                                intentAction.effect === "remove"
                                  ? "outline"
                                  : "default"
                              }
                              onClick={() => applySessionIntentAction(intent)}
                            >
                              {intentAction.actionLabel}
                            </Button>
                          ) : null}
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
                            <span className="font-semibold">
                              Lead candidate
                            </span>
                            <span className="font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                              {intent.guardrailCount} guardrails
                            </span>
                          </div>
                          {intent.leadStory ? (
                            <div className="mt-2 grid gap-2">
                              {isPreview ? (
                                <div className="leading-5 font-semibold">
                                  {intent.leadStory.title}
                                  <span className="mt-1 block font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                                    {intent.leadStory.sourceName}
                                  </span>
                                </div>
                              ) : (
                                <Link
                                  className="block leading-5 font-semibold hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                                  href={`/news/${intent.leadStory.id}`}
                                >
                                  {intent.leadStory.title}
                                  <span className="mt-1 block font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                                    {intent.leadStory.sourceName}
                                  </span>
                                </Link>
                              )}
                              {leadItem ? (
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
                              ) : null}
                            </div>
                          ) : (
                            <p className="mt-2 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                              No matching candidate is ready for this intent.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
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
                      {entry.controls.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {entry.controls.map((control) => {
                            const ledgerAction =
                              getNewsProfileSignalLedgerTrainingAction(control);

                            return (
                              <Button
                                key={`${control.kind}-${control.signal}`}
                                className="h-8 max-w-full rounded-none px-2 text-xs"
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  applyProfileSignalLedgerAction(control)
                                }
                              >
                                {ledgerAction.actionLabel}:{" "}
                                <span className="truncate font-mono">
                                  {ledgerAction.label}
                                </span>
                              </Button>
                            );
                          })}
                        </div>
                      ) : null}
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
                      onClick={() => applyFeedGovernorControl(control)}
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
                      queue.stories.map((story, storyIndex) => {
                        const item = rankedItemsById.get(story.id);
                        const distributionActionInput = item
                          ? {
                              formatCategory: getCategoryLabel,
                              item,
                              laneKey: queue.key,
                            }
                          : null;
                        const distributionAction = distributionActionInput
                          ? getNewsDistributionQueueTrainingAction(
                              distributionActionInput,
                            )
                          : null;
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

                        return (
                          <article
                            key={story.id}
                            className="grid gap-2 border-t border-[#161616]/10 pt-2 dark:border-[#f4f1ea]/10"
                          >
                            {isPreview ? (
                              <div className="grid gap-1">{storyBody}</div>
                            ) : (
                              <Link
                                className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                                href={`/news/${story.id}`}
                              >
                                {storyBody}
                              </Link>
                            )}
                            {item ? (
                              <StoryAction
                                item={item}
                                guardrailItem={selectGuardrailItemForStory(
                                  item,
                                )}
                                isPreview={isPreview}
                                rankSlot={storyIndex + 1}
                                savedItem={selectSavedItemForStory(item)}
                                onAction={recordStoryAction}
                                onRemoveSaved={removeSavedItem}
                                onRestoreGuardrail={restoreGuardrailItem}
                              />
                            ) : null}
                            {distributionAction && distributionActionInput ? (
                              <Button
                                className="h-8 w-fit rounded-none px-2 text-xs"
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  applyDistributionQueueAction(
                                    distributionActionInput,
                                  )
                                }
                              >
                                {distributionAction.actionLabel}
                              </Button>
                            ) : null}
                          </article>
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
                nextRefreshPlan.slots.map((slot, index) => {
                  const item = rankedItemsById.get(slot.id);
                  const refreshActionInput = item
                    ? {
                        formatCategory: getCategoryLabel,
                        item,
                        reason: slot.reason,
                      }
                    : null;
                  const refreshAction = refreshActionInput
                    ? getNewsNextRefreshPlanTrainingAction(refreshActionInput)
                    : null;

                  return (
                    <article
                      key={slot.id}
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      {isPreview ? (
                        <div className="grid gap-1">
                          <span className="leading-5 font-semibold">
                            {slot.title}
                          </span>
                          <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                            {slot.sourceName} / {slot.reason} /{" "}
                            {slot.scoreLabel}
                          </span>
                        </div>
                      ) : (
                        <Link
                          className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                          href={`/news/${slot.id}`}
                        >
                          <span className="leading-5 font-semibold">
                            {slot.title}
                          </span>
                          <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                            {slot.sourceName} / {slot.reason} /{" "}
                            {slot.scoreLabel}
                          </span>
                        </Link>
                      )}
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
                      {refreshActionInput && refreshAction ? (
                        <Button
                          className="h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            applyNextRefreshPlanAction(refreshActionInput)
                          }
                        >
                          {refreshAction.actionLabel}
                        </Button>
                      ) : null}
                    </article>
                  );
                })
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
              {personalizationMix.actions.map((action) => {
                const mixAction = getNewsPersonalizationMixTrainingAction({
                  action,
                  formatCategory: getCategoryLabel,
                  items: rankedItems,
                });
                const mixActionLabel =
                  mixAction?.kind === "profile"
                    ? mixAction.action.actionLabel
                    : mixAction
                      ? `Raise ${mixAction.action.label}`
                      : null;

                return (
                  <div
                    key={action.label}
                    className="grid gap-3 border-t border-[#161616]/20 pt-3 text-sm sm:grid-cols-[1fr_auto] sm:items-start dark:border-[#f4f1ea]/15"
                  >
                    <div>
                      <div className="font-semibold">{action.label}</div>
                      <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        {action.detail}
                      </p>
                    </div>
                    {mixActionLabel ? (
                      <Button
                        className="h-8 w-fit rounded-none px-2 text-xs"
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => applyPersonalizationMixAction(action)}
                      >
                        {mixActionLabel}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
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
                explorationSlots.slots.map((slot) => {
                  const explorationAction =
                    getNewsExplorationSlotTrainingAction({
                      formatCategory: getCategoryLabel,
                      items: rankedItems,
                      profile,
                      slot,
                    });

                  return (
                    <article
                      key={slot.id}
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <Link
                        className="grid gap-2 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                        href={`/news/${slot.id}`}
                      >
                        <span className="leading-5 font-semibold">
                          {slot.title}
                        </span>
                        <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {slot.sourceName} / {slot.reason} / {slot.scoreLabel}
                        </span>
                      </Link>
                      <span className="w-fit border border-[#161616]/20 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/20">
                        {slot.signal}
                      </span>
                      {explorationAction ? (
                        <Button
                          className="h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          onClick={() => applyExplorationSlotAction(slot)}
                        >
                          {explorationAction.actionLabel}
                        </Button>
                      ) : null}
                    </article>
                  );
                })
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
                channelComparison.channels.map((channel, index) => {
                  const leadItem = rankedItemsById.get(channel.lead.id);

                  return (
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
                      {leadItem ? (
                        <div className="mt-2">
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
                      <div className="mt-3 grid gap-2">
                        {channel.topStories.map((story, storyIndex) => (
                          <Link
                            key={story.id}
                            className="grid grid-cols-[1.5rem_1fr] gap-2 text-xs leading-5 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                            href={`/news/${story.id}`}
                          >
                            <span className="font-mono text-[#5b5750] dark:text-[#bbb4aa]">
                              {String(storyIndex + 1).padStart(2, "0")}
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
                  );
                })
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
                missedCoverage.stories.map((item, index) => {
                  const story = rankedItemsById.get(item.id);
                  const storyBody = (
                    <>
                      <span className="leading-5 font-semibold">
                        {item.title}
                      </span>
                      <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                        {item.sourceName} / {item.reason} / {item.scoreLabel}
                      </span>
                    </>
                  );

                  return (
                    <article
                      key={item.id}
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      {isPreview ? (
                        <div className="grid gap-1">{storyBody}</div>
                      ) : (
                        <Link
                          className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                          href={`/news/${item.id}`}
                        >
                          {storyBody}
                        </Link>
                      )}
                      {story ? (
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
                      ) : null}
                    </article>
                  );
                })
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
              {fatigueReport.notices.map((notice) => {
                const fatigueAction = getNewsFeedFatigueTrainingAction({
                  items: rankedItems,
                  notice,
                });

                return (
                  <div
                    key={notice.label}
                    className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm sm:grid-cols-[1fr_auto] sm:items-start dark:border-[#f4f1ea]/15"
                  >
                    <div>
                      <div className="font-semibold">{notice.label}</div>
                      <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        {notice.detail}
                      </p>
                    </div>
                    {fatigueAction ? (
                      <Button
                        className="h-8 w-fit rounded-none px-2 text-xs"
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => applyFeedFatigueAction(notice)}
                      >
                        {fatigueAction.actionLabel}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
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
                channelStrategy.lanes.map((lane) => {
                  const channelAction = getNewsChannelStrategyTrainingAction({
                    formatCategory: getCategoryLabel,
                    items: rankedItems,
                    lane,
                    profile,
                  });
                  const channelActionLabel =
                    channelAction?.kind === "profile"
                      ? channelAction.action.actionLabel
                      : channelAction
                        ? `${channelAction.action.direction === "raise" ? "Raise" : "Lower"} ${
                            channelAction.action.label
                          }`
                        : null;

                  return (
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
                      {channelActionLabel ? (
                        <Button
                          className="mt-3 h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          onClick={() => applyChannelStrategyAction(lane)}
                        >
                          {channelActionLabel}
                        </Button>
                      ) : null}
                    </div>
                  );
                })
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
                {trainingUpdate?.undoAction ? (
                  <Button
                    className="mt-3 h-8 rounded-none px-2 text-xs"
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const undoAction = trainingUpdate.undoAction;

                      if (!undoAction) return;

                      undoStoryQuickTuneAction(undoAction);
                    }}
                  >
                    Undo tune
                  </Button>
                ) : null}
                {trainingUpdate?.preferenceUndoAction ? (
                  <Button
                    className="mt-3 h-8 rounded-none px-2 text-xs"
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const undoAction = trainingUpdate.preferenceUndoAction;

                      if (!undoAction) return;

                      undoPreferenceTuningSuggestion(undoAction);
                    }}
                  >
                    Undo tuning
                  </Button>
                ) : null}
                {trainingUpdate?.preferenceProfileUndoAction ? (
                  <Button
                    className="mt-3 h-8 rounded-none px-2 text-xs"
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const undoAction =
                        trainingUpdate.preferenceProfileUndoAction;

                      if (!undoAction) return;

                      undoPreferenceProfileAction(undoAction);
                    }}
                  >
                    Undo preference
                  </Button>
                ) : null}
                {trainingUpdate?.biasUndoAction ? (
                  <Button
                    className="mt-3 h-8 rounded-none px-2 text-xs"
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const undoAction = trainingUpdate.biasUndoAction;

                      if (!undoAction) return;

                      undoPreferenceBiasAction(undoAction);
                    }}
                  >
                    Undo bias
                  </Button>
                ) : null}
                {trainingUpdate?.biasResetUndoAction ? (
                  <Button
                    className="mt-3 h-8 rounded-none px-2 text-xs"
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const undoAction = trainingUpdate.biasResetUndoAction;

                      if (!undoAction) return;

                      undoPreferenceBiasResetAction(undoAction);
                    }}
                  >
                    Undo reset
                  </Button>
                ) : null}
                {trainingUpdate?.guardrailReviewAction ? (
                  <Button
                    className="mt-2 h-8 rounded-none px-2 text-xs"
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const reviewAction = trainingUpdate.guardrailReviewAction;

                      if (!reviewAction) return;

                      reviewTrainingGuardrailConflict(reviewAction);
                    }}
                  >
                    {trainingUpdate.guardrailReviewAction.actionLabel}
                  </Button>
                ) : null}
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
                {trainingUpdate.impactStories &&
                trainingUpdate.impactStories.length > 0 ? (
                  <div className="mt-4 grid gap-3">
                    {trainingUpdate.impactStories.map((story) => (
                      <div
                        key={story.id}
                        className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                      >
                        <div className="font-semibold">{story.title}</div>
                        <p className="mt-1 text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {story.sourceName} / {story.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
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
                {trainingUpdate.dataVaultExport ? (
                  <div className="mt-4 border-t border-[#161616]/20 pt-4 text-sm dark:border-[#f4f1ea]/15">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black">
                          {trainingUpdate.dataVaultExport.label}
                        </h3>
                        <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                          {trainingUpdate.dataVaultExport.summary}
                        </p>
                      </div>
                      <span className="border border-[#161616]/30 px-2 py-1 font-mono text-xs break-all dark:border-[#f4f1ea]/25">
                        {trainingUpdate.dataVaultExport.filename}
                      </span>
                    </div>
                    <Button
                      asChild
                      className="mt-3 h-8 w-fit rounded-none px-2 text-xs"
                      size="sm"
                      variant="outline"
                    >
                      <a
                        download={trainingUpdate.dataVaultExport.filename}
                        href={getNewsPersonalizationDataVaultExportHref(
                          trainingUpdate.dataVaultExport,
                        )}
                      >
                        Download package
                      </a>
                    </Button>
                    <div className="mt-3 grid gap-3">
                      {trainingUpdate.dataVaultExport.sections.map(
                        (section) => (
                          <div
                            key={section.label}
                            className="border-t border-[#161616]/15 pt-3 dark:border-[#f4f1ea]/10"
                          >
                            <div className="font-semibold">{section.label}</div>
                            <dl className="mt-2 grid gap-2">
                              {section.records.length > 0 ? (
                                section.records.map((record) => (
                                  <div
                                    key={`${section.label}-${record.label}-${record.value}`}
                                    className="grid gap-1 sm:grid-cols-[9rem_1fr]"
                                  >
                                    <dt className="font-mono text-xs break-words text-[#5b5750] uppercase dark:text-[#bbb4aa]">
                                      {record.label}
                                    </dt>
                                    <dd className="leading-5 break-words">
                                      {record.value}
                                    </dd>
                                  </div>
                                ))
                              ) : (
                                <div className="text-[#5b5750] dark:text-[#bbb4aa]">
                                  No records in this package.
                                </div>
                              )}
                            </dl>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}
                {trainingUpdateHistory.length > 1 ? (
                  <div className="mt-4 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
                    <h3 className="text-sm font-black">Recent Learning</h3>
                    <div className="mt-3 grid gap-2">
                      {trainingUpdateHistory
                        .slice(1)
                        .map((historyUpdate, index) => (
                          <div
                            key={`${historyUpdate.label}-${historyUpdate.summary}-${index}`}
                            className="border-t border-[#161616]/15 pt-3 text-sm dark:border-[#f4f1ea]/10"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <span className="font-semibold">
                                {historyUpdate.label}
                              </span>
                              <span className="font-mono text-[10px] text-[#5b5750] dark:text-[#bbb4aa]">
                                #{index + 2}
                              </span>
                            </div>
                            <p className="mt-1 leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                              {historyUpdate.summary}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}
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
            {isPreview &&
            feedbackCoachPreviewActionState.helperText &&
            !feedbackCoachPreviewActionState.disabled ? (
              <p className="mt-3 border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                {feedbackCoachPreviewActionState.helperText}
              </p>
            ) : null}
            <div className="mt-4 grid gap-3">
              {feedbackCoach.actions.length > 0 ? (
                feedbackCoach.actions.map((suggestion) => {
                  const suggestedStory = rankedItems.find(
                    (story) => story.id === suggestion.storyId,
                  );
                  const coachActionState = getNewsFeedbackCoachActionState({
                    hasSuggestedStory: Boolean(suggestedStory),
                    isPreview,
                  });
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
                          disabled={coachActionState.disabled}
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
                      {coachActionState.disabled &&
                      coachActionState.helperText ? (
                        <p className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {coachActionState.helperText}
                        </p>
                      ) : null}
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
                liveWire.updates.map((update, index) => {
                  const item = rankedItemsById.get(update.id);
                  const updateTitle = (
                    <span className="leading-5 font-semibold">
                      {update.title}
                    </span>
                  );

                  return (
                    <article
                      key={update.id}
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.12em] uppercase">
                          <span className="text-[#8a241c] dark:text-[#ff8b7e]">
                            {update.signal}
                          </span>
                          <span className="text-[#78746c]">/</span>
                          <span>{formatNewsTime(update.publishedAt)}</span>
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
                    </article>
                  );
                })
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Live wire will appear after the first ranked crawl.
                </p>
              )}
            </div>
            <div className="mt-4 grid gap-3">
              {liveWire.notices.map((notice) => {
                const liveWireAction = getNewsLiveWireTrainingAction({
                  formatCategory: getCategoryLabel,
                  items: rankedItems,
                  notice,
                });
                const liveWireActionLabel =
                  liveWireAction?.kind === "profile"
                    ? liveWireAction.action.actionLabel
                    : liveWireAction
                      ? `${liveWireAction.action.direction === "raise" ? "Raise" : "Lower"} ${
                          liveWireAction.action.label
                        }`
                      : null;

                return (
                  <div
                    key={notice.label}
                    className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start dark:border-[#f4f1ea]/15"
                  >
                    <div>
                      <div className="font-semibold">{notice.label}</div>
                      <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        {notice.detail}
                      </p>
                    </div>
                    {liveWireActionLabel ? (
                      <Button
                        className="h-8 w-fit rounded-none px-2 text-xs"
                        size="sm"
                        type="button"
                        variant={
                          liveWireAction?.kind === "profile" &&
                          liveWireAction.action.effect === "remove"
                            ? "outline"
                            : "default"
                        }
                        onClick={() => applyLiveWireAction(notice)}
                      >
                        {liveWireActionLabel}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
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
                editionSchedule.slots.map((slot, index) => {
                  const item = rankedItemsById.get(slot.story.id);
                  const scheduleActionInput = item
                    ? {
                        formatCategory: getCategoryLabel,
                        item,
                        slotLabel: slot.label,
                      }
                    : null;
                  const scheduleAction = scheduleActionInput
                    ? getNewsEditionScheduleTrainingAction(scheduleActionInput)
                    : null;
                  const storyTitle = (
                    <span className="leading-5 font-semibold">
                      {slot.story.title}
                    </span>
                  );

                  return (
                    <article
                      key={`${slot.timeLabel}-${slot.story.id}`}
                      className="grid gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <div className="grid grid-cols-[3.25rem_1fr_auto] gap-3">
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
                      {scheduleActionInput && scheduleAction ? (
                        <Button
                          className="h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            applyEditionScheduleAction(scheduleActionInput)
                          }
                        >
                          {scheduleAction.actionLabel}
                        </Button>
                      ) : null}
                    </article>
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
                  const item = rankedItemsById.get(slot.story.id);
                  const readingActionInput = item
                    ? {
                        formatCategory: getCategoryLabel,
                        intent: slot.intent,
                        item,
                      }
                    : null;
                  const readingAction = readingActionInput
                    ? getNewsPersonalizedReadingQueueTrainingAction(
                        readingActionInput,
                      )
                    : null;
                  const storyTitle = (
                    <span className="leading-5 font-semibold">
                      {slot.story.title}
                    </span>
                  );

                  return (
                    <article
                      key={`${slot.intent}-${slot.story.id}`}
                      className="grid gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <div className="grid grid-cols-[2rem_1fr_auto] gap-3">
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
                      {readingAction && readingActionInput ? (
                        <Button
                          className="h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            applyPersonalizedReadingQueueAction(
                              readingActionInput,
                            )
                          }
                        >
                          {readingAction.actionLabel}
                        </Button>
                      ) : null}
                    </article>
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

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Next For You Queue</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {nextForYouQueue.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {nextForYouQueue.label}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {nextForYouQueue.metrics.map((metric) => (
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
            <div className="mt-4 border-t border-[#161616]/20 pt-3 text-xs leading-5 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
              Request {nextForYouQueue.nextRequest.route} excludes{" "}
              {nextForYouQueue.nextRequest.excludeNewsItemIds.length} visible{" "}
              {nextForYouQueue.nextRequest.excludeNewsItemIds.length === 1
                ? "story"
                : "stories"}{" "}
              and {nextForYouQueue.nextRequest.negativeFeedbackItemIds.length}{" "}
              Less{" "}
              {nextForYouQueue.nextRequest.negativeFeedbackItemIds.length === 1
                ? "guardrail"
                : "guardrails"}
              .
            </div>
            <div className="mt-4 grid gap-3">
              {nextForYouQueue.candidates.length > 0 ? (
                nextForYouQueue.candidates.map((candidate, index) => {
                  const item = rankedItemsById.get(candidate.id);
                  const storyTitle = (
                    <span className="leading-5 font-semibold">
                      {candidate.title}
                    </span>
                  );

                  return (
                    <div
                      key={candidate.id}
                      className="grid grid-cols-[2rem_1fr] gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] tracking-[0.14em] uppercase">
                          {candidate.categoryLabel} / {candidate.scoreLabel}
                        </div>
                        {isPreview ? (
                          <div className="mt-1">{storyTitle}</div>
                        ) : (
                          <Link
                            className="mt-1 block hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                            href={`/news/${candidate.id}`}
                          >
                            {storyTitle}
                          </Link>
                        )}
                        <p className="mt-1 leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {candidate.reason}
                        </p>
                        <div className="mt-1 text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {candidate.sourceName}
                        </div>
                        {item ? (
                          <div className="mt-2">
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
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  The next batch will be explained after unseen personalized
                  stories are available.
                </p>
              )}
            </div>
            <div className="mt-4 grid gap-3">
              {nextForYouQueue.notices.map((notice) => {
                const nextQueueAction = getNewsForYouNextQueueTrainingAction({
                  formatCategory: getCategoryLabel,
                  negativeFeedbackItems: negativeFeedbackMemoryItems,
                  notice,
                });

                return (
                  <div
                    key={notice.label}
                    className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start dark:border-[#f4f1ea]/15"
                  >
                    <div>
                      <div className="font-semibold">{notice.label}</div>
                      <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        {notice.detail}
                      </p>
                    </div>
                    {nextQueueAction ? (
                      <Button
                        className="h-8 w-fit rounded-none px-2 text-xs"
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => applyForYouNextQueueAction(notice)}
                      >
                        {nextQueueAction.actionLabel}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
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
              {recommendationAudit.notices.map((notice) => {
                const auditAction = getNewsRecommendationAuditTrainingAction({
                  items: rankedItems,
                  notice,
                  profile,
                });
                const auditActionLabel =
                  auditAction?.kind === "profile"
                    ? auditAction.action.actionLabel
                    : auditAction
                      ? `${auditAction.action.direction === "raise" ? "Raise" : "Lower"} ${
                          auditAction.action.label
                        }`
                      : null;

                return (
                  <div
                    key={notice.label}
                    className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                  >
                    <div className="font-semibold">{notice.label}</div>
                    <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                      {notice.detail}
                    </p>
                    {auditActionLabel ? (
                      <Button
                        className="mt-3 h-8 w-fit rounded-none px-2 text-xs"
                        size="sm"
                        type="button"
                        variant={
                          auditAction?.kind === "profile" &&
                          auditAction.action.effect === "remove"
                            ? "outline"
                            : "default"
                        }
                        onClick={() => applyRecommendationAuditAction(notice)}
                      >
                        {auditActionLabel}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
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
                editorialGuardrails.risks.map((risk) => {
                  const editorialAction =
                    getNewsEditorialGuardrailTrainingAction({
                      items: rankedItems,
                      profile,
                      risk,
                    });
                  const editorialActionLabel =
                    editorialAction?.kind === "profile"
                      ? editorialAction.action.actionLabel
                      : editorialAction
                        ? `${editorialAction.action.direction === "raise" ? "Raise" : "Lower"} ${
                            editorialAction.action.label
                          }`
                        : null;

                  return (
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
                      {editorialActionLabel ? (
                        <Button
                          className="mt-3 h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant={
                            editorialAction?.kind === "profile" &&
                            editorialAction.action.effect === "remove"
                              ? "outline"
                              : "default"
                          }
                          onClick={() => applyEditorialGuardrailAction(risk)}
                        >
                          {editorialActionLabel}
                        </Button>
                      ) : null}
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
                  );
                })
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
                topicMatchMatrix.rows.map((row) => {
                  const topicAction = getNewsTopicMatchTrainingAction({ row });

                  return (
                    <div
                      key={row.category}
                      className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_auto_auto] sm:items-start">
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
                        <Button
                          className="h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant={
                            row.mode === "Cooldown" ? "outline" : "default"
                          }
                          onClick={() => applyTopicMatchAction(row)}
                        >
                          {topicAction.actionLabel}
                        </Button>
                      </div>
                      <p className="mt-2 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        {row.reason}
                      </p>
                    </div>
                  );
                })
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
                      lane.nodes.map((node) => {
                        const graphAction =
                          getNewsInterestGraphNodeTrainingAction({
                            laneKey: lane.key,
                            node,
                          });

                        return (
                          <div
                            key={`${lane.key}-${node.signal}`}
                            className="grid gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                          >
                            <div className="min-w-0">
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
                                {node.activeSignal
                                  ? "active signal"
                                  : "discovered"}
                              </div>
                            </div>
                            <Button
                              className="h-8 w-fit rounded-none px-2 text-xs"
                              size="sm"
                              type="button"
                              variant={
                                node.activeSignal ? "outline" : "default"
                              }
                              onClick={() =>
                                applyInterestGraphNodeAction({
                                  laneKey: lane.key,
                                  node,
                                })
                              }
                            >
                              {graphAction.actionLabel}
                            </Button>
                          </div>
                        );
                      })
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
            {sourceBalanceAction ? (
              <Button
                className="mt-4 h-8 w-fit rounded-none px-2 text-xs"
                size="sm"
                type="button"
                variant="outline"
                onClick={applySourceBalanceAction}
              >
                {sourceBalanceAction.actionLabel}
              </Button>
            ) : null}
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
                {sourceTrustLedger.notices.map((notice) => {
                  const sourceTrustAction = getNewsSourceTrustTrainingAction({
                    items: rankedItems,
                    notice,
                  });

                  return (
                    <div
                      key={notice.label}
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start dark:border-[#f4f1ea]/15"
                    >
                      <div>
                        <div className="font-semibold">{notice.label}</div>
                        <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                          {notice.detail}
                        </p>
                      </div>
                      {sourceTrustAction ? (
                        <Button
                          className="h-8 w-fit rounded-none px-2 text-xs"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => applySourceTrustAction(notice)}
                        >
                          {sourceTrustAction.actionLabel}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
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
                entityRadar.map((entry, index) => {
                  const entityAction = getNewsEntityRadarTrainingAction({
                    entry,
                    profile,
                  });

                  return (
                    <div
                      key={entry.signal}
                      className="grid gap-3 border-t border-[#161616]/20 pt-3 text-sm sm:grid-cols-[2rem_minmax(0,1fr)_auto_auto] sm:items-start dark:border-[#f4f1ea]/15"
                    >
                      <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <Link
                          className="block truncate font-semibold hover:underline"
                          href={`/entities/${encodeURIComponent(entry.entity)}`}
                        >
                          {entry.entity}
                        </Link>
                        <div className="mt-1 text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {entry.storyCount} stories / {entry.sourceCount}{" "}
                          sources
                        </div>
                      </div>
                      <span className="font-mono">{entry.heatScore}</span>
                      <Button
                        className="h-8 w-fit rounded-none px-2 text-xs"
                        size="sm"
                        type="button"
                        variant={
                          entityAction.effect === "remove"
                            ? "outline"
                            : "default"
                        }
                        onClick={() => applyEntityRadarAction(entry)}
                      >
                        {entityAction.actionLabel}
                      </Button>
                    </div>
                  );
                })
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
                topicPulse.map((pulse, index) => {
                  const pulseAction = getNewsTopicPulseTrainingAction({
                    formatCategory: getCategoryLabel,
                    profile,
                    pulse,
                  });

                  return (
                    <div
                      key={pulse.category}
                      className="grid gap-3 border-t border-[#161616]/20 pt-3 text-sm sm:grid-cols-[2rem_minmax(0,1fr)_auto_auto] sm:items-start dark:border-[#f4f1ea]/15"
                    >
                      <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold">
                          {getCategoryLabel(pulse.category)}
                        </div>
                        <div className="mt-1 truncate text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {pulse.storyCount} stories /{" "}
                          {pulse.sources.join(", ")}
                        </div>
                      </div>
                      <span className="font-mono">{pulse.heatScore}</span>
                      <Button
                        className="h-8 w-fit rounded-none px-2 text-xs"
                        size="sm"
                        type="button"
                        variant={
                          pulseAction.effect === "remove"
                            ? "outline"
                            : "default"
                        }
                        onClick={() => applyTopicPulseAction(pulse)}
                      >
                        {pulseAction.actionLabel}
                      </Button>
                    </div>
                  );
                })
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
              {interestDrift.notices.map((notice) => {
                const driftAction = getNewsInterestDriftTrainingAction({
                  formatCategory: getCategoryLabel,
                  historyItems,
                  negativeFeedbackItems: negativeFeedbackMemoryItems,
                  notice,
                  positiveFeedbackItems,
                  profile,
                  savedItems,
                });

                return (
                  <div
                    key={notice.label}
                    className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start dark:border-[#f4f1ea]/15"
                  >
                    <div>
                      <div className="font-semibold">{notice.label}</div>
                      <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                        {notice.detail}
                      </p>
                    </div>
                    {driftAction ? (
                      <Button
                        className="h-8 w-fit rounded-none px-2 text-xs"
                        size="sm"
                        type="button"
                        variant={
                          driftAction.effect === "remove"
                            ? "outline"
                            : "default"
                        }
                        onClick={() => applyInterestDriftAction(notice)}
                      >
                        {driftAction.actionLabel}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
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
                savedItems.map((item, index) => {
                  const story = rankedItemsById.get(item.id);

                  return (
                    <article
                      key={item.id}
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <Link
                        className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                        href={`/news/${item.id}`}
                      >
                        <span className="leading-5 font-semibold">
                          {item.title}
                        </span>
                        <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {item.sourceName} / saved{" "}
                          {item.savedAt
                            ? formatNewsTime(item.savedAt)
                            : "recently"}
                        </span>
                      </Link>
                      {story ? (
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
                      ) : (
                        <Button
                          className="h-8 rounded-none px-3 text-xs sm:justify-self-start"
                          disabled={removeSaved.isPending}
                          onClick={() => removeSavedItem(item)}
                          type="button"
                          variant="outline"
                        >
                          Remove
                        </Button>
                      )}
                    </article>
                  );
                })
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
                <h2 className="text-xl font-black">Less / Guardrails</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {guardrailShelf.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {guardrailShelf.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              {guardrailShelf.metrics.map((metric) => (
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
            {guardrailShelf.calibrationPrompts.length > 0 ? (
              <div className="mt-4 grid gap-2 border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15">
                {guardrailShelf.calibrationPromptLabel ? (
                  <p className="font-mono text-[11px] text-[#5b5750] uppercase dark:text-[#bbb4aa]">
                    {guardrailShelf.calibrationPromptLabel}
                  </p>
                ) : null}
                {guardrailShelf.calibrationPrompts.map((prompt) => (
                  <div
                    key={`${prompt.label}-${prompt.detail}`}
                    className="grid gap-2 text-sm leading-6 text-[#5b5750] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center dark:text-[#bbb4aa]"
                  >
                    <p>
                      <span className="font-semibold text-[#161616] dark:text-[#f4f1ea]">
                        {prompt.label}:
                      </span>{" "}
                      <span className="font-mono text-[11px] uppercase">
                        {prompt.priorityLabel}
                      </span>{" "}
                      {prompt.detail}
                    </p>
                    <Button
                      className="h-8 rounded-none"
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (prompt.resetFilters) {
                          setActiveAngleTag(null);
                          setActiveCategory(null);
                          setActiveSourceSlug(null);
                        }

                        setFeedMode(prompt.targetFeedMode);
                        setReviewHiddenAngleQuery(
                          prompt.includeHiddenItems ? prompt.actionQuery : "",
                        );
                        setSearchDraft(prompt.actionQuery);
                        setSearchQuery(prompt.actionQuery);
                        recordHomeSearchIntent({
                          query: prompt.actionQuery,
                          resultCount: guardrailShelf.items.length,
                        });
                      }}
                    >
                      {prompt.actionLabel}
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-4 grid gap-3">
              {guardrailShelf.items.length > 0 ? (
                guardrailShelf.items.map((item, index) => {
                  const story = rankedItemsById.get(item.id);

                  return (
                    <article
                      key={item.id}
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <Link
                        className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                        href={`/news/${item.id}`}
                      >
                        <span className="leading-5 font-semibold">
                          {item.title}
                        </span>
                        <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {[
                            item.sourceName,
                            item.categoryLabel,
                            item.angleLabel,
                            `Less ${
                              item.hiddenAt
                                ? formatNewsTime(item.hiddenAt)
                                : "recently"
                            }`,
                          ]
                            .filter(Boolean)
                            .join(" / ")}
                        </span>
                      </Link>
                      {story ? (
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
                      ) : (
                        <Button
                          className="h-8 rounded-none px-2 text-xs whitespace-nowrap sm:justify-self-start"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const guardrailItem = guardrailItems.find(
                              (memoryItem) => memoryItem.id === item.id,
                            );

                            if (!guardrailItem) return;

                            restoreGuardrailItem(guardrailItem);
                          }}
                        >
                          Restore
                        </Button>
                      )}
                    </article>
                  );
                })
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Less feedback will appear here after you hide stories from the
                  front page or article view.
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
                ? continuationRail.followUps.map((followUp, index) => {
                    const item = rankedItemsById.get(followUp.id);
                    const continuationActionInput = item
                      ? {
                          formatCategory: getCategoryLabel,
                          item,
                          reason: followUp.reason,
                        }
                      : null;
                    const continuationAction = continuationActionInput
                      ? getNewsContinuationRailTrainingAction(
                          continuationActionInput,
                        )
                      : null;
                    const followUpBody = (
                      <>
                        <span className="leading-5 font-semibold">
                          {followUp.title}
                        </span>
                        <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {followUp.sourceName} / {followUp.reason} /{" "}
                          {followUp.scoreLabel}
                        </span>
                      </>
                    );

                    return (
                      <article
                        key={followUp.id}
                        className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                      >
                        {isPreview ? (
                          <div className="grid gap-1">{followUpBody}</div>
                        ) : (
                          <Link
                            className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                            href={`/news/${followUp.id}`}
                          >
                            {followUpBody}
                          </Link>
                        )}
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
                        {continuationActionInput && continuationAction ? (
                          <Button
                            className="h-8 w-fit rounded-none px-2 text-xs"
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() =>
                              applyContinuationRailAction(
                                continuationActionInput,
                              )
                            }
                          >
                            {continuationAction.actionLabel}
                          </Button>
                        ) : null}
                      </article>
                    );
                  })
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
                historyItems.map((item, index) => {
                  const story = rankedItemsById.get(item.id);

                  return (
                    <article
                      key={item.id}
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <Link
                        className="grid gap-1 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                        href={`/news/${item.id}`}
                      >
                        <span className="leading-5 font-semibold">
                          {item.title}
                        </span>
                        <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {item.sourceName} / read{" "}
                          {item.viewedAt
                            ? formatNewsTime(item.viewedAt)
                            : "recently"}
                        </span>
                      </Link>
                      {story ? (
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
                      ) : null}
                    </article>
                  );
                })
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
                  <article
                    key={story.id}
                    className="grid gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                  >
                    <div className="grid grid-cols-[2rem_1fr_auto] items-start gap-3">
                      <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="leading-5">
                        {story.title}
                        <span className="mt-1 block text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {rankDetails.summary}
                        </span>
                      </span>
                      <span className="font-mono">
                        {rankDetails.scoreLabel}
                      </span>
                    </div>
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
            {sourceHealthDiagnostics.length > 0 ? (
              <div className="mt-4 grid gap-2 border-y border-current/20 py-4">
                <p className="font-mono text-xs tracking-normal uppercase opacity-70">
                  Source diagnostics
                </p>
                <div className="grid gap-2">
                  {sourceHealthDiagnostics.map((diagnostic) => (
                    <div
                      key={`${diagnostic.state}-${diagnostic.label}`}
                      className="grid gap-1 border-l border-current/40 pl-3 text-sm sm:grid-cols-[5rem_1fr] sm:gap-3"
                    >
                      <span className="font-mono text-xs uppercase opacity-70">
                        {diagnostic.state}
                      </span>
                      <span>
                        <span className="block font-semibold break-words">
                          {diagnostic.label}
                        </span>
                        <span className="mt-1 block text-xs leading-5 opacity-70">
                          {diagnostic.detail}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
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
                label="Freshness"
                value={deskFreshnessStatus.label}
              />
              <p className="-mt-2 text-xs leading-5 opacity-70">
                {deskFreshnessStatus.detail}
              </p>
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
