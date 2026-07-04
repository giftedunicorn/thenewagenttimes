import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import type { SQL } from "@acme/db";
import type {
  DedupeNewsItem,
  NegativeFeedbackNewsItem,
  NewsCollaborativeSignal,
  NewsPreferenceProfile,
  NewsRecommendationExplanation,
  NewsSemanticSimilarityMatch,
  NewsSessionIntentFilter,
  NewsUrlReference,
  PositiveFeedbackNewsItem,
  RankedNewsItem,
  ReaderInteraction,
  RecentExposureNewsItem,
  RecommendableNewsItem,
} from "@acme/validators";
import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  lt,
  notInArray,
  or,
  sql,
} from "@acme/db";
import {
  NewsCategorySchema,
  NewsItem,
  NewsItemVector,
  NewsReaderInteraction,
  NewsReaderInteractionActionSchema,
  NewsReaderProfile,
  NewsSignal,
  NewsSource,
} from "@acme/db/schema";
import {
  buildNewsSemanticSimilarityMatches,
  dedupeNewsItems,
  filterBlockedNewsItems,
  getNewsDedupeUrlKeys,
  getNewsExplorationInterval,
  getNewsRecommendationAngleLabels,
  normalizeNewsPreferenceProfile,
  rankNewsForReader,
  selectAngleQuotaBalancedNewsFeed,
  selectBreakingNewsPriorityFeed,
  selectCategoryQuotaBalancedNewsFeed,
  selectCollaborativeSignalNewsFeed,
  selectDaypartBalancedNewsFeed,
  selectDiscoverySlotNewsFeed,
  selectDiverseNewsFeed,
  selectEntityQuotaBalancedNewsFeed,
  selectExposureBalancedNewsFeed,
  selectFatigueBalancedNewsFeed,
  selectFreshnessQuotaBalancedNewsFeed,
  selectNegativeFeedbackAdjustedNewsFeed,
  selectNewsRecommendationRotationFeed,
  selectPositiveFeedbackAnchoredNewsFeed,
  selectReaderFreshNewsFeed,
  selectSemanticSimilarityNewsFeed,
  selectSessionIntentNewsFeed,
  selectSourceCorroboratedNewsFeed,
  selectSourceQuotaBalancedNewsFeed,
  selectSourceTrustBalancedNewsFeed,
  shouldTrainReaderProfileFromInteraction,
  summarizeNewsRecommendation,
  updateReaderProfileWithInteraction,
} from "@acme/validators";

import type { createTRPCContext } from "../trpc";
import { publicProcedure } from "../trpc";

const optionalTrimmedString = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength).optional();

const normalizeNewsTagValue = (tag: string) =>
  tag
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");

const optionalNewsTagFilter = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .transform(normalizeNewsTagValue)
  .optional();

const optionalVisitorKey = z.string().trim().min(8).max(160).optional();
const NewsPublicFeedModeSchema = z.enum(["latest", "trending"]);

const defaultNewsPreferenceProfile: NewsPreferenceProfile = {
  preferredCategories: ["model_release", "agent_product", "funding"],
  preferredSources: [],
  preferredEntities: [],
  noveltyBias: 1,
  recencyBias: 1,
};

const NewsFeedFilterInputSchema = z.object({
  category: NewsCategorySchema.optional(),
  tag: optionalNewsTagFilter,
  sourceSlug: optionalTrimmedString(160),
  q: optionalTrimmedString(256),
  limit: z.number().int().min(1).max(50).default(20),
});

const NewsFeedBaseInputSchema = NewsFeedFilterInputSchema.extend({
  cursor: z.string().datetime().optional(),
});

export const NewsFeedInputSchema = NewsFeedBaseInputSchema.extend({
  cursorTrendScore: z.number().finite().optional(),
  mode: NewsPublicFeedModeSchema.default("trending"),
});

export const NewsByIdInputSchema = z.object({
  id: z.string().uuid(),
});

export const NewsSearchCandidatesInputSchema = NewsFeedFilterInputSchema.extend(
  {
    q: z.string().trim().min(1).max(256),
    limit: z.number().int().min(1).max(25).default(10),
  },
);

export const NewsReaderProfileInputSchema = z.object({
  visitorKey: optionalVisitorKey,
});

export const NewsSavedInputSchema = NewsReaderProfileInputSchema.extend({
  limit: z.number().int().min(1).max(25).default(6),
});

export const NewsHistoryInputSchema = NewsReaderProfileInputSchema.extend({
  limit: z.number().int().min(1).max(25).default(6),
});

export const NewsGuardrailsInputSchema = NewsReaderProfileInputSchema.extend({
  limit: z.number().int().min(1).max(25).default(6),
});

export const NewsForYouInputSchema = NewsFeedFilterInputSchema.extend({
  excludeNewsItemIds: z.array(z.string().uuid()).max(240).optional(),
  readerLocalHour: z.number().int().min(0).max(23).optional(),
  visitorKey: optionalVisitorKey,
});

const NewsFeedModeSchema = z.enum(["for_you", "latest", "trending"]);
type NewsFeedMode = z.infer<typeof NewsFeedModeSchema>;
const NewsArticleReadMilestoneSchema = z.enum([
  "opened",
  "meaningful_read",
  "deep_read",
]);

const newsInteractionMatchedSignalInputLimit = 24;
const newsInteractionMatchedSignalStorageLimit = 12;

const normalizeNewsInteractionMetadataKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");

const normalizeNewsInteractionMatchedSignals = (signals: readonly string[]) => {
  const seenSignals = new Set<string>();
  const normalizedSignals: string[] = [];

  for (const signal of signals) {
    const normalizedSignal = normalizeNewsInteractionMetadataKey(signal);

    if (!normalizedSignal || seenSignals.has(normalizedSignal)) continue;

    seenSignals.add(normalizedSignal);
    normalizedSignals.push(normalizedSignal);
  }

  return normalizedSignals.slice(0, newsInteractionMatchedSignalStorageLimit);
};

const NewsInteractionMatchedSignalsSchema = z
  .array(z.string().trim().min(1).max(80))
  .max(newsInteractionMatchedSignalInputLimit)
  .transform(normalizeNewsInteractionMatchedSignals);

const NewsInteractionMetadataSchema = z
  .object({
    exposure: z.boolean().optional(),
    exposureSlot: z.number().int().min(0).max(50).optional(),
    feedMode: NewsFeedModeSchema.optional(),
    intentCategory: NewsCategorySchema.optional(),
    intentQuery: optionalTrimmedString(256),
    intentSourceSlug: optionalTrimmedString(160),
    intentTag: optionalNewsTagFilter,
    matchedSignals: NewsInteractionMatchedSignalsSchema.optional(),
    personalizedScore: z.number().finite().optional(),
    rankSlot: z.number().int().min(0).max(240).optional(),
    readMilestone: NewsArticleReadMilestoneSchema.optional(),
    readPercent: z.number().min(0).max(1).optional(),
    surface: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .transform(normalizeNewsInteractionMetadataKey)
      .optional(),
  })
  .passthrough();

export const NewsRecordInteractionInputSchema = z.object({
  visitorKey: optionalVisitorKey,
  newsItemId: z.string().uuid(),
  action: NewsReaderInteractionActionSchema,
  metadata: NewsInteractionMetadataSchema.optional(),
});

type NewsRecordInteractionInput = z.infer<
  typeof NewsRecordInteractionInputSchema
>;

export const NewsRestoreGuardrailInputSchema =
  NewsReaderProfileInputSchema.extend({
    newsItemId: z.string().uuid(),
  });

export const NewsRemoveSavedInputSchema = NewsReaderProfileInputSchema.extend({
  newsItemId: z.string().uuid(),
});

export const shouldTrainNewsProfileFromInteraction = ({
  action,
  metadata,
}: Pick<NewsRecordInteractionInput, "action" | "metadata">) => {
  if (action !== "view") return true;
  if (metadata?.surface?.trim().toLowerCase() !== "article") return false;
  if (metadata.readPercent === undefined) return false;

  return shouldTrainReaderProfileFromInteraction({
    action,
    readPercent: metadata.readPercent,
  });
};

export const shouldIncludeNewsInteractionInReadingHistory = ({
  action,
  metadata,
}: Pick<NewsRecordInteractionInput, "action" | "metadata">) => {
  if (action !== "view") return false;
  if (metadata?.surface?.trim().toLowerCase() !== "article") return false;
  if (metadata.readPercent === undefined) return false;

  return shouldTrainReaderProfileFromInteraction({
    action,
    readPercent: metadata.readPercent,
  });
};

export const shouldIncludeNewsInteractionAsPositiveFeedback = ({
  action,
  metadata,
}: Pick<NewsRecordInteractionInput, "action" | "metadata">) => {
  if (action === "click_source" || action === "save" || action === "share") {
    return true;
  }

  if (action !== "view") return false;
  if (metadata?.surface?.trim().toLowerCase() !== "article") return false;

  return shouldTrainReaderProfileFromInteraction({
    action,
    readPercent: metadata.readPercent ?? 0,
  });
};

export const toNewsReaderProfileInteraction = ({
  action,
  metadata,
}: Pick<
  NewsRecordInteractionInput,
  "action" | "metadata"
>): ReaderInteraction => ({
  action,
  rankSlot: metadata?.rankSlot,
  readPercent: metadata?.readPercent,
});

export const shouldDedupeNewsHomeExposureInteraction = ({
  action,
  metadata,
}: Pick<NewsRecordInteractionInput, "action" | "metadata">) => {
  if (action !== "view") return false;
  if (metadata?.exposure !== true) return false;

  const surface = metadata.surface?.trim().toLowerCase();

  return surface === "home" || surface === "home_exposure";
};

interface NewsViewedHistoryRow {
  canonicalUrl: string | null;
  category: string;
  entities: readonly string[];
  metadata: unknown;
  newsItemId: string;
  occurredAt: Date;
  originalUrl: string | null;
  sourceSlug: string;
  tags: readonly string[];
  title: string;
}

export const selectNewsViewedHistory = (
  rows: readonly NewsViewedHistoryRow[],
): {
  readingHistoryItemIds: string[];
  readingHistoryItems: RecentExposureNewsItem[];
  recentExposureItems: RecentExposureNewsItem[];
} => {
  const viewedHistory = rows.map((row) => {
    const metadata = NewsInteractionMetadataSchema.safeParse(row.metadata);
    const parsedMetadata = metadata.success ? metadata.data : undefined;

    return {
      item: {
        canonicalUrl: row.canonicalUrl,
        category: row.category,
        entities: row.entities,
        id: row.newsItemId,
        occurredAt: row.occurredAt.toISOString(),
        originalUrl: row.originalUrl,
        readPercent: parsedMetadata?.readPercent,
        sourceSlug: row.sourceSlug,
        surface: parsedMetadata?.surface,
        tags: row.tags,
        title: row.title,
      },
      metadata: parsedMetadata,
    };
  });
  const recentExposureItems = viewedHistory.map((entry) => entry.item);
  const readingHistoryItems = viewedHistory
    .filter((entry) =>
      shouldIncludeNewsInteractionInReadingHistory({
        action: "view",
        metadata: entry.metadata,
      }),
    )
    .map((entry) => entry.item);

  return {
    readingHistoryItemIds: readingHistoryItems.map((item) => item.id),
    readingHistoryItems,
    recentExposureItems,
  };
};

export const getNewsSemanticFeedbackStrength = ({
  action,
  metadata,
}: Pick<NewsRecordInteractionInput, "action" | "metadata">) => {
  if (action === "share") return 3;
  if (action === "save") return 2;
  if (action === "click_source") return 1;

  if (
    action === "view" &&
    metadata?.surface?.trim().toLowerCase() === "article"
  ) {
    return (metadata.readPercent ?? 0) >= 0.8 ? 2 : 1;
  }

  return 0;
};

export const getNewsCollaborativeSignalScore = ({
  deepReadCount,
  hideCount = 0,
  readerCount,
  saveCount,
  shareCount,
  sourceClickCount,
}: {
  deepReadCount: number;
  hideCount?: number;
  readerCount: number;
  saveCount: number;
  shareCount: number;
  sourceClickCount: number;
}) =>
  readerCount >= 2
    ? shareCount * 3 +
      saveCount * 2 +
      deepReadCount * 2 +
      sourceClickCount -
      hideCount * 3
    : 0;

export interface NewsCollaborativeSignalRow {
  canonicalUrl?: string | null;
  category: z.infer<typeof NewsCategorySchema>;
  deepReadCount: number;
  entities: readonly string[];
  hideCount: number;
  newsItemId: string;
  originalUrl?: string | null;
  readerCount: number;
  saveCount: number;
  shareCount: number;
  sourceClickCount: number;
  sourceSlug: string;
  tags: readonly string[];
}

type NewsSemanticFeedbackRef = NewsUrlReference & {
  newsItemId: string;
  occurredAt?: string;
  strength?: number;
};

export const toNewsCollaborativeSignal = (
  row: NewsCollaborativeSignalRow,
): NewsCollaborativeSignal | null => {
  const score = getNewsCollaborativeSignalScore(row);

  return score !== 0
    ? {
        ...(row.canonicalUrl ? { canonicalUrl: row.canonicalUrl } : {}),
        category: row.category,
        entities: row.entities,
        newsItemId: row.newsItemId,
        ...(row.originalUrl ? { originalUrl: row.originalUrl } : {}),
        score,
        sourceSlug: row.sourceSlug,
        tags: row.tags,
      }
    : null;
};

const newsArticleSurfaceCondition = () =>
  sql`trim(lower(${NewsReaderInteraction.metadata}->>'surface')) = 'article'`;

const meaningfulNewsArticleReadCondition = (): SQL<unknown> =>
  sql`${newsArticleSurfaceCondition()} and coalesce((${NewsReaderInteraction.metadata}->>'readPercent')::double precision, 0) >= 0.35`;

const collaborativeSignalInteractionCondition = (): SQL<unknown> =>
  or(
    sql`${NewsReaderInteraction.action} in ('hide', 'save', 'share', 'click_source')`,
    sql`${NewsReaderInteraction.action} = 'view' and ${newsArticleSurfaceCondition()} and coalesce((${NewsReaderInteraction.metadata}->>'readPercent')::double precision, 0) >= 0.8`,
  ) ?? sql`false`;

export const NewsPreferenceProfileInputSchema = z.object({
  preferredCategories: z.array(NewsCategorySchema).max(12),
  preferredSources: z.array(z.string().trim().min(1).max(160)).max(12),
  preferredEntities: z.array(z.string().trim().min(1).max(160)).max(24),
  noveltyBias: z.number().min(0).max(2),
  recencyBias: z.number().min(0).max(2),
});

const NewsPreferenceProfileSnapshotSchema = z.object({
  preferredCategories: z.array(z.string().trim().min(1).max(160)).max(12),
  preferredSources: z.array(z.string().trim().min(1).max(160)).max(12),
  preferredEntities: z.array(z.string().trim().min(1).max(160)).max(24),
  noveltyBias: z.number().finite().min(0).max(2),
  recencyBias: z.number().finite().min(0).max(2),
});

export const NewsUpdateProfileInputSchema = NewsReaderProfileInputSchema.extend(
  {
    profile: NewsPreferenceProfileInputSchema,
  },
);

type NewsFeedInput = z.infer<typeof NewsFeedInputSchema>;
type NewsFeedFilterInput = z.infer<typeof NewsFeedFilterInputSchema>;
type NewsFeedBaseInput = z.infer<typeof NewsFeedBaseInputSchema>;
type NewsPublishedFeedConditionInput = NewsFeedBaseInput &
  Partial<Pick<NewsFeedInput, "cursorTrendScore" | "mode">>;
type NewsForYouInput = z.infer<typeof NewsForYouInputSchema>;
type NewsSearchCandidatesInput = z.infer<
  typeof NewsSearchCandidatesInputSchema
>;
type NewsRouterDb = Awaited<ReturnType<typeof createTRPCContext>>["db"];
type NewsReaderProfileRow = typeof NewsReaderProfile.$inferSelect;

export interface NewsReaderProfileSignalInteraction {
  action: NewsRecordInteractionInput["action"];
  category: z.infer<typeof NewsCategorySchema>;
  entities: readonly string[];
  metadata?: NewsRecordInteractionInput["metadata"];
  occurredAt: string;
  sourceSlug: string;
  tags?: readonly string[];
}

interface NewsReaderProfileSignalInteractionRow {
  action: NewsReaderProfileSignalInteraction["action"];
  category: NewsReaderProfileSignalInteraction["category"];
  entities: readonly string[];
  id: string;
  metadata: unknown;
  newsItemId: string;
  occurredAt: Date;
  sourceSlug: string;
  tags: readonly string[];
}

interface NewsReaderProfileSignalCount {
  count: number;
  firstSeenIndex: number;
  key: string;
}

const formatProfileAuditList = (values: readonly string[]) => {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0] ?? "";

  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
};

const newsProfileAuditCategoryLabels = {
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
} as const satisfies Record<z.infer<typeof NewsCategorySchema>, string>;

const newsProfileAuditCategoryLabelsByKey: Partial<Record<string, string>> =
  newsProfileAuditCategoryLabels;

const formatNewsProfileAuditCategory = (category: string) => {
  const normalizedCategory = category.trim();
  const label = newsProfileAuditCategoryLabelsByKey[normalizedCategory];

  if (label) return label;

  const fallbackLabel = normalizedCategory
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return fallbackLabel || category;
};

const createSignalCounter = () =>
  new Map<string, NewsReaderProfileSignalCount>();

const addSignalCount = (
  counter: Map<string, NewsReaderProfileSignalCount>,
  key: string,
  index: number,
) => {
  const current = counter.get(key);

  counter.set(key, {
    count: (current?.count ?? 0) + 1,
    firstSeenIndex: current?.firstSeenIndex ?? index,
    key,
  });
};

const toTopSignalCounts = (
  counter: Map<string, NewsReaderProfileSignalCount>,
) =>
  Array.from(counter.values())
    .sort(
      (left, right) =>
        right.count - left.count || left.firstSeenIndex - right.firstSeenIndex,
    )
    .map(({ count, key }) => ({ count, key }));

const getInteractionMetadataRankSlot = (
  metadata: NewsRecordInteractionInput["metadata"] | undefined,
) => {
  const surface = metadata?.surface
    ? normalizeNewsInteractionMetadataKey(metadata.surface)
    : "";

  return (surface.startsWith("home") || surface === "mobile_home") &&
    typeof metadata?.rankSlot === "number"
    ? metadata.rankSlot
    : null;
};

const getAverageHomeRankSlot = (rankSlots: readonly number[]) => {
  if (rankSlots.length === 0) return null;

  const average =
    rankSlots.reduce((total, rankSlot) => total + rankSlot, 0) /
    rankSlots.length;

  return Math.round(average * 10) / 10;
};

const isArticleReadWithDepth = ({
  action,
  metadata,
}: Pick<NewsRecordInteractionInput, "action" | "metadata">) =>
  action === "view" &&
  metadata?.surface?.trim().toLowerCase() === "article" &&
  typeof metadata.readPercent === "number";

const getProfileTrainingActionLabel = (action: string) => {
  if (action === "click_source") return "source clicks";
  if (action === "save") return "saves";
  if (action === "share") return "shares";
  if (action === "view") return "reads";

  return action;
};

const trainingActionPriority = {
  click_source: 2,
  save: 3,
  share: 4,
  view: 1,
} as const;

const getTrainingActionPriority = (action: string) => {
  if (
    action === "click_source" ||
    action === "save" ||
    action === "share" ||
    action === "view"
  ) {
    return trainingActionPriority[action];
  }

  return 0;
};

const toTopTrainingAction = (
  counter: Map<string, NewsReaderProfileSignalCount>,
) =>
  Array.from(counter.values()).sort(
    (left, right) =>
      right.count - left.count ||
      getTrainingActionPriority(right.key) -
        getTrainingActionPriority(left.key) ||
      left.firstSeenIndex - right.firstSeenIndex,
  )[0]?.key;

const getLatestProfileSignalTimestamp = (
  currentTimestamp: string | null,
  candidateTimestamp: string,
) => {
  const candidateTime = new Date(candidateTimestamp).getTime();

  if (Number.isNaN(candidateTime)) return currentTimestamp;
  if (!currentTimestamp) return new Date(candidateTime).toISOString();

  const currentTime = new Date(currentTimestamp).getTime();

  return Number.isNaN(currentTime) || candidateTime > currentTime
    ? new Date(candidateTime).toISOString()
    : currentTimestamp;
};

const summarizeProfilePreference = ({
  ignoredSignalCount,
  negativeSignalCount,
  positiveSignalCount,
  profile,
  topTrainingAction,
}: {
  ignoredSignalCount: number;
  negativeSignalCount: number;
  positiveSignalCount: number;
  profile: NewsPreferenceProfile;
  topTrainingAction?: string;
}) => {
  if (positiveSignalCount === 0) {
    if (negativeSignalCount > 0) {
      return ignoredSignalCount > 0
        ? "Profile is guarding against Less feedback while recent exposure or low-depth reads stay out of training."
        : "Profile is guarding against Less feedback while it waits for the next positive reader signal.";
    }

    return ignoredSignalCount > 0
      ? "Profile is still learning; recent signals are mostly exposure or low-depth reads."
      : "Profile is still learning from the next meaningful read, save, share, or source click.";
  }

  const actionText = topTrainingAction
    ? `, driven by ${getProfileTrainingActionLabel(topTrainingAction)}`
    : "";
  const categoryText = formatProfileAuditList(
    profile.preferredCategories.slice(0, 2).map(formatNewsProfileAuditCategory),
  );
  const leaderText = formatProfileAuditList(
    [profile.preferredSources[0], profile.preferredEntities[0]].filter(
      (value): value is string => Boolean(value),
    ),
  );

  if (categoryText && leaderText) {
    return `Profile leans toward ${categoryText}, led by ${leaderText}${actionText}.`;
  }

  if (categoryText) return `Profile leans toward ${categoryText}${actionText}.`;
  if (leaderText) return `Profile is led by ${leaderText}${actionText}.`;

  return `Profile is learning from recent meaningful reader signals${actionText}.`;
};

export const summarizeNewsReaderProfileSignals = ({
  interactions,
  profile,
}: {
  interactions: readonly NewsReaderProfileSignalInteraction[];
  profile: NewsPreferenceProfile;
}) => {
  const actionCounts = createSignalCounter();
  const categoryCounts = createSignalCounter();
  const entityCounts = createSignalCounter();
  const feedModeCounts = createSignalCounter();
  const guardrailCategoryCounts = createSignalCounter();
  const guardrailEntityCounts = createSignalCounter();
  const guardrailSourceCounts = createSignalCounter();
  const guardrailTagCounts = createSignalCounter();
  const intentCategoryCounts = createSignalCounter();
  const intentQueryCounts = createSignalCounter();
  const intentSourceCounts = createSignalCounter();
  const intentTagCounts = createSignalCounter();
  const matchedSignalCounts = createSignalCounter();
  const readMilestoneCounts = createSignalCounter();
  const sourceCounts = createSignalCounter();
  const surfaceCounts = createSignalCounter();
  const tagCounts = createSignalCounter();
  const trainingActionCounts = createSignalCounter();
  const homeRankSlots: number[] = [];
  const readPercents: number[] = [];
  let ignoredSignalCount = 0;
  let lastSignalAt: string | null = null;
  let lastTrainedAt: string | null = null;
  let negativeSignalCount = 0;
  let positiveSignalCount = 0;
  let shallowReadCount = 0;
  let trainedReadCount = 0;

  interactions.forEach((interaction, index) => {
    lastSignalAt = getLatestProfileSignalTimestamp(
      lastSignalAt,
      interaction.occurredAt,
    );

    addSignalCount(actionCounts, interaction.action, index);

    if (interaction.metadata?.feedMode) {
      addSignalCount(feedModeCounts, interaction.metadata.feedMode, index);
    }

    if (interaction.metadata?.readMilestone) {
      addSignalCount(
        readMilestoneCounts,
        interaction.metadata.readMilestone,
        index,
      );
    }

    if (interaction.metadata?.intentCategory) {
      addSignalCount(
        intentCategoryCounts,
        interaction.metadata.intentCategory,
        index,
      );
    }

    if (interaction.metadata?.intentQuery) {
      addSignalCount(
        intentQueryCounts,
        interaction.metadata.intentQuery,
        index,
      );
    }

    if (interaction.metadata?.intentSourceSlug) {
      addSignalCount(
        intentSourceCounts,
        interaction.metadata.intentSourceSlug,
        index,
      );
    }

    if (interaction.metadata?.intentTag) {
      getNewsRecommendationAngleLabels([
        interaction.metadata.intentTag,
      ]).forEach((tag) => addSignalCount(intentTagCounts, tag, index));
    }

    if (interaction.metadata?.surface) {
      addSignalCount(
        surfaceCounts,
        normalizeNewsInteractionMetadataKey(interaction.metadata.surface),
        index,
      );
    }

    normalizeNewsInteractionMatchedSignals(
      interaction.metadata?.matchedSignals ?? [],
    ).forEach((signal) => addSignalCount(matchedSignalCounts, signal, index));

    const rankSlot = getInteractionMetadataRankSlot(interaction.metadata);

    if (rankSlot !== null) {
      homeRankSlots.push(rankSlot);
    }

    const hasArticleReadDepth = isArticleReadWithDepth(interaction);
    const articleReadPercent = hasArticleReadDepth
      ? interaction.metadata?.readPercent
      : undefined;

    if (typeof articleReadPercent === "number") {
      readPercents.push(articleReadPercent);
    }

    if (interaction.action === "hide") {
      negativeSignalCount += 1;
      addSignalCount(guardrailCategoryCounts, interaction.category, index);
      addSignalCount(guardrailSourceCounts, interaction.sourceSlug, index);
      interaction.entities.forEach((entity) =>
        addSignalCount(guardrailEntityCounts, entity, index),
      );
      getNewsRecommendationAngleLabels(interaction.tags ?? []).forEach((tag) =>
        addSignalCount(guardrailTagCounts, tag, index),
      );
      return;
    }

    const isTrainingSignal = shouldTrainNewsProfileFromInteraction(interaction);

    if (!isTrainingSignal) {
      if (hasArticleReadDepth) shallowReadCount += 1;
      ignoredSignalCount += 1;
      return;
    }

    positiveSignalCount += 1;
    if (hasArticleReadDepth) trainedReadCount += 1;
    lastTrainedAt = getLatestProfileSignalTimestamp(
      lastTrainedAt,
      interaction.occurredAt,
    );
    addSignalCount(trainingActionCounts, interaction.action, index);
    addSignalCount(categoryCounts, interaction.category, index);
    addSignalCount(sourceCounts, interaction.sourceSlug, index);
    interaction.entities.forEach((entity) =>
      addSignalCount(entityCounts, entity, index),
    );
    getNewsRecommendationAngleLabels(interaction.tags ?? []).forEach((tag) =>
      addSignalCount(tagCounts, tag, index),
    );
  });
  const topIntentCategories = toTopSignalCounts(intentCategoryCounts);
  const topIntentQueries = toTopSignalCounts(intentQueryCounts);
  const topIntentSources = toTopSignalCounts(intentSourceCounts);
  const topIntentTags = toTopSignalCounts(intentTagCounts);
  const topReadMilestones = toTopSignalCounts(readMilestoneCounts);
  const topGuardrailCategories = toTopSignalCounts(guardrailCategoryCounts);
  const topGuardrailEntities = toTopSignalCounts(guardrailEntityCounts);
  const topGuardrailSources = toTopSignalCounts(guardrailSourceCounts);
  const topGuardrailTags = toTopSignalCounts(guardrailTagCounts);

  return {
    averageHomeRankSlot: getAverageHomeRankSlot(homeRankSlots),
    ...(readPercents.length > 0
      ? {
          averageReadPercent:
            Math.round(
              (readPercents.reduce((total, value) => total + value, 0) /
                readPercents.length) *
                100,
            ) / 100,
        }
      : {}),
    ignoredSignalCount,
    lastSignalAt,
    lastTrainedAt,
    negativeSignalCount,
    positiveSignalCount,
    summary: summarizeProfilePreference({
      ignoredSignalCount,
      negativeSignalCount,
      positiveSignalCount,
      profile,
      topTrainingAction: toTopTrainingAction(trainingActionCounts),
    }),
    topActions: toTopSignalCounts(actionCounts),
    topCategories: toTopSignalCounts(categoryCounts),
    topEntities: toTopSignalCounts(entityCounts),
    topFeedModes: toTopSignalCounts(feedModeCounts),
    ...(topGuardrailCategories.length > 0 ? { topGuardrailCategories } : {}),
    ...(topGuardrailEntities.length > 0 ? { topGuardrailEntities } : {}),
    ...(topGuardrailSources.length > 0 ? { topGuardrailSources } : {}),
    ...(topGuardrailTags.length > 0 ? { topGuardrailTags } : {}),
    ...(topIntentCategories.length > 0 ? { topIntentCategories } : {}),
    ...(topIntentQueries.length > 0 ? { topIntentQueries } : {}),
    ...(topIntentSources.length > 0 ? { topIntentSources } : {}),
    ...(topIntentTags.length > 0 ? { topIntentTags } : {}),
    topMatchedSignals: toTopSignalCounts(matchedSignalCounts),
    ...(topReadMilestones.length > 0 ? { topReadMilestones } : {}),
    topSources: toTopSignalCounts(sourceCounts),
    topSurfaces: toTopSignalCounts(surfaceCounts),
    topTags: toTopSignalCounts(tagCounts),
    ...(shallowReadCount > 0 ? { shallowReadCount } : {}),
    ...(trainedReadCount > 0 ? { trainedReadCount } : {}),
    trainedSignalCount: positiveSignalCount,
  };
};

export const buildNewsReaderProfileResponse = ({
  interactions,
  persisted,
  profile,
}: {
  interactions: readonly NewsReaderProfileSignalInteraction[];
  persisted: boolean;
  profile: NewsPreferenceProfile;
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  return {
    ...normalizedProfile,
    audit: summarizeNewsReaderProfileSignals({
      interactions,
      profile: normalizedProfile,
    }),
    persisted,
  };
};

export const buildNewsReaderMutationProfileResponse = ({
  interaction,
  profile,
}: {
  interaction?: NewsReaderProfileSignalInteraction;
  profile: NewsPreferenceProfile;
}) =>
  buildNewsReaderProfileResponse({
    interactions: interaction ? [interaction] : [],
    persisted: true,
    profile,
  });

export const buildNewsInteractionTrainingMetadata = ({
  metadata,
  profileAfter,
  profileBefore,
}: {
  metadata: Record<string, unknown> | undefined;
  profileAfter: NewsPreferenceProfile;
  profileBefore: NewsPreferenceProfile;
}): Record<string, unknown> => ({
  ...(metadata ?? {}),
  profileAfter: normalizeNewsPreferenceProfile(profileAfter),
  profileBefore: normalizeNewsPreferenceProfile(profileBefore),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getNewsInteractionProfileSnapshot = (
  interaction: NewsReaderProfileSignalInteraction,
  key: "profileAfter" | "profileBefore",
): NewsPreferenceProfile | null => {
  if (!isRecord(interaction.metadata)) return null;

  const parsedProfile = NewsPreferenceProfileSnapshotSchema.safeParse(
    interaction.metadata[key],
  );

  return parsedProfile.success
    ? normalizeNewsPreferenceProfile(parsedProfile.data)
    : null;
};

const getNewsInteractionReplayTimestamp = (
  interaction: NewsReaderProfileSignalInteraction,
) => {
  const timestamp = new Date(interaction.occurredAt).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const toNewsReaderProfileSignalInteraction = (
  row: NewsReaderProfileSignalInteractionRow,
): NewsReaderProfileSignalInteraction => {
  const metadata = NewsInteractionMetadataSchema.safeParse(row.metadata);

  return {
    action: row.action,
    category: row.category,
    entities: row.entities,
    metadata: metadata.success ? metadata.data : undefined,
    occurredAt: row.occurredAt.toISOString(),
    sourceSlug: row.sourceSlug,
    tags: row.tags,
  };
};

export const rebuildNewsPreferenceProfileFromInteractions = ({
  baseProfile = defaultNewsPreferenceProfile,
  interactions,
}: {
  baseProfile?: NewsPreferenceProfile;
  interactions: readonly NewsReaderProfileSignalInteraction[];
}): NewsPreferenceProfile =>
  interactions
    .map((interaction, index) => ({ index, interaction }))
    .sort(
      (left, right) =>
        getNewsInteractionReplayTimestamp(left.interaction) -
          getNewsInteractionReplayTimestamp(right.interaction) ||
        left.index - right.index,
    )
    .reduce(
      (profile, { interaction }) =>
        shouldTrainNewsProfileFromInteraction(interaction)
          ? updateReaderProfileWithInteraction(
              profile,
              {
                category: interaction.category,
                entities: interaction.entities,
                id: `${interaction.sourceSlug}:${interaction.occurredAt}`,
                publishedAt: interaction.occurredAt,
                sourceScore: 0,
                sourceSlug: interaction.sourceSlug,
                tags: interaction.tags ?? [],
                title: "",
                trendScore: 0,
              },
              toNewsReaderProfileInteraction(interaction),
            )
          : profile,
      normalizeNewsPreferenceProfile(baseProfile),
    );

const nearlyEqualNewsProfileBias = (left: number, right: number) =>
  Math.abs(left - right) < 0.0001;

const areNewsProfileSignalsEqual = (
  left: readonly string[],
  right: readonly string[],
) =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

const areNewsPreferenceProfilesEqual = (
  left: NewsPreferenceProfile,
  right: NewsPreferenceProfile,
) => {
  const normalizedLeft = normalizeNewsPreferenceProfile(left);
  const normalizedRight = normalizeNewsPreferenceProfile(right);

  return (
    areNewsProfileSignalsEqual(
      normalizedLeft.preferredCategories,
      normalizedRight.preferredCategories,
    ) &&
    areNewsProfileSignalsEqual(
      normalizedLeft.preferredSources,
      normalizedRight.preferredSources,
    ) &&
    areNewsProfileSignalsEqual(
      normalizedLeft.preferredEntities,
      normalizedRight.preferredEntities,
    ) &&
    nearlyEqualNewsProfileBias(
      normalizedLeft.noveltyBias,
      normalizedRight.noveltyBias,
    ) &&
    nearlyEqualNewsProfileBias(
      normalizedLeft.recencyBias,
      normalizedRight.recencyBias,
    )
  );
};

export const buildNewsPreferenceRollbackAfterInteractionRemoval = ({
  currentProfile,
  remainingInteractions,
  removedInteraction,
}: {
  currentProfile: NewsPreferenceProfile;
  remainingInteractions: readonly NewsReaderProfileSignalInteraction[];
  removedInteraction: NewsReaderProfileSignalInteraction;
}): NewsPreferenceProfile | null => {
  const profileBeforeRemoval = getNewsInteractionProfileSnapshot(
    removedInteraction,
    "profileBefore",
  );
  const profileAfterRemoval = getNewsInteractionProfileSnapshot(
    removedInteraction,
    "profileAfter",
  );

  if (!profileBeforeRemoval || !profileAfterRemoval) return null;

  const removedAt = getNewsInteractionReplayTimestamp(removedInteraction);
  const interactionsAfterRemoval = remainingInteractions.filter(
    (interaction) => getNewsInteractionReplayTimestamp(interaction) > removedAt,
  );
  const replayedRemovedProfile = rebuildNewsPreferenceProfileFromInteractions({
    baseProfile: profileBeforeRemoval,
    interactions: [removedInteraction],
  });

  if (
    !areNewsPreferenceProfilesEqual(replayedRemovedProfile, profileAfterRemoval)
  ) {
    return null;
  }

  const replayedCurrentProfile = rebuildNewsPreferenceProfileFromInteractions({
    baseProfile: profileBeforeRemoval,
    interactions: [removedInteraction, ...interactionsAfterRemoval],
  });

  if (!areNewsPreferenceProfilesEqual(replayedCurrentProfile, currentProfile)) {
    return null;
  }

  return rebuildNewsPreferenceProfileFromInteractions({
    baseProfile: profileBeforeRemoval,
    interactions: interactionsAfterRemoval,
  });
};

export const buildNewsReaderProfileAfterInteractionRemoval = ({
  currentProfile,
  remainingInteractions,
  removedInteraction,
}: {
  currentProfile: NewsPreferenceProfile;
  remainingInteractions: readonly NewsReaderProfileSignalInteraction[];
  removedInteraction: NewsReaderProfileSignalInteraction;
}): NewsPreferenceProfile =>
  buildNewsPreferenceRollbackAfterInteractionRemoval({
    currentProfile,
    remainingInteractions,
    removedInteraction,
  }) ?? normalizeNewsPreferenceProfile(currentProfile);

export type NewsForYouCandidate = DedupeNewsItem &
  RecommendableNewsItem & {
    canonicalUrl: string | null;
    imageUrl: string | null;
    originalUrl?: string | null;
    sourceName: string;
    sourceType: string;
    summary: string;
  };

interface ReaderIdentity {
  readerKey: string;
  userId: string | null;
}

const compactConditions = (
  conditions: (SQL<unknown> | undefined)[],
): SQL<unknown> | undefined => {
  const definedConditions = conditions.filter(
    (condition): condition is SQL<unknown> => condition !== undefined,
  );

  return definedConditions.length > 0 ? and(...definedConditions) : undefined;
};

export const getNewsHomeExposureDedupeWindowStart = (now = new Date()) =>
  new Date(now.getTime() - 24 * 60 * 60 * 1000);

export const buildNewsHomeExposureDedupeCondition = ({
  feedMode,
  newsItemId,
  readerProfileId,
  since,
}: {
  feedMode: NewsFeedMode | undefined;
  newsItemId: string;
  readerProfileId: string;
  since: Date;
}): SQL<unknown> =>
  compactConditions([
    eq(NewsReaderInteraction.readerProfileId, readerProfileId),
    eq(NewsReaderInteraction.newsItemId, newsItemId),
    sql`${NewsReaderInteraction.action} = 'view'`,
    sql`${NewsReaderInteraction.occurredAt} >= ${since}`,
    sql`${NewsReaderInteraction.metadata}->>'exposure' = 'true'`,
    sql`trim(lower(${NewsReaderInteraction.metadata}->>'surface')) in ('home', 'home_exposure', 'home-exposure')`,
    feedMode
      ? sql`${NewsReaderInteraction.metadata}->>'feedMode' = ${feedMode}`
      : undefined,
  ]) ?? sql`false`;

export const buildNewsTextSearchCondition = (
  query: string | undefined,
): SQL<unknown> | undefined => {
  if (!query) return undefined;

  const pattern = `%${query}%`;
  const normalizedTagQuery = normalizeNewsTagValue(query);
  const normalizedTagPattern = `%${normalizedTagQuery}%`;
  const normalizedTagCondition =
    normalizedTagQuery === query.toLowerCase()
      ? undefined
      : sql`exists (select 1 from unnest(${NewsItem.tags}) as tag where tag ilike ${normalizedTagPattern})`;

  return or(
    ilike(NewsItem.title, pattern),
    ilike(NewsItem.summary, pattern),
    ilike(NewsSource.name, pattern),
    ilike(NewsSource.slug, pattern),
    sql`exists (select 1 from unnest(${NewsItem.entities}) as entity where entity ilike ${pattern})`,
    sql`exists (select 1 from unnest(${NewsItem.tags}) as tag where tag ilike ${pattern})`,
    normalizedTagCondition,
  );
};

const tagCondition = (tag: string | undefined): SQL<unknown> | undefined => {
  if (!tag) return undefined;

  return sql`${NewsItem.tags} @> array[${tag}]::text[]`;
};

const textArraySql = (values: readonly string[]): SQL<unknown> =>
  values.length > 0
    ? sql`array[${sql.join(
        values.map((value) => sql`${value}`),
        sql`, `,
      )}]::text[]`
    : sql`array[]::text[]`;

const publishedFeedConditions = (
  input: NewsFeedFilterInput & Partial<NewsPublishedFeedConditionInput>,
): SQL<unknown> | undefined =>
  compactConditions([
    eq(NewsItem.status, "published"),
    input.category ? eq(NewsItem.category, input.category) : undefined,
    input.sourceSlug ? eq(NewsSource.slug, input.sourceSlug) : undefined,
    buildNewsFeedCursorCondition(input),
    tagCondition(input.tag),
    buildNewsTextSearchCondition(input.q),
  ]);

const searchCandidateConditions = (
  input: NewsSearchCandidatesInput,
): SQL<unknown> | undefined =>
  compactConditions([
    eq(NewsItem.status, "published"),
    input.category ? eq(NewsItem.category, input.category) : undefined,
    input.sourceSlug ? eq(NewsSource.slug, input.sourceSlug) : undefined,
    tagCondition(input.tag),
    buildNewsTextSearchCondition(input.q),
  ]);

const resolveReaderIdentity = (
  userId: string | undefined,
  visitorKey: string | undefined,
): ReaderIdentity | null => {
  if (userId) {
    return { readerKey: `user:${userId}`, userId };
  }

  if (visitorKey) {
    return { readerKey: `visitor:${visitorKey}`, userId: null };
  }

  return null;
};

export const getNewsReaderProfileResetIdentity = ({
  userId,
  visitorKey,
}: {
  userId: string | undefined;
  visitorKey: string | undefined;
}) => resolveReaderIdentity(userId, visitorKey);

const clampBias = (value: number) => Math.min(Math.max(value, 0), 2);

const toPreferenceProfile = (
  row: NewsReaderProfileRow | null | undefined,
): NewsPreferenceProfile => {
  if (!row) return normalizeNewsPreferenceProfile(defaultNewsPreferenceProfile);

  return normalizeNewsPreferenceProfile({
    preferredCategories: row.preferredCategories,
    preferredSources: row.preferredSources,
    preferredEntities: row.preferredEntities,
    noveltyBias: clampBias(row.noveltyBias),
    recencyBias: clampBias(row.recencyBias),
  });
};

const toNewsPreferenceProfilePersistenceValues = (
  profile: NewsPreferenceProfile,
) => ({
  preferredCategories: [...profile.preferredCategories],
  preferredSources: [...profile.preferredSources],
  preferredEntities: [...profile.preferredEntities],
  noveltyBias: profile.noveltyBias,
  recencyBias: profile.recencyBias,
  updatedAt: sql`now()`,
});

type NewsPositiveFeedbackIdentity = NewsUrlReference & {
  newsItemId?: string;
};

const filterActiveNewsPositiveFeedback = <
  TItem extends NewsPositiveFeedbackIdentity,
>({
  hiddenNewsItemIds,
  hiddenNewsItems,
  positiveFeedbackItems,
}: {
  hiddenNewsItemIds: readonly string[];
  hiddenNewsItems: readonly NewsUrlReference[];
  positiveFeedbackItems: readonly TItem[];
}): TItem[] => {
  const hiddenNewsItemIdSet = new Set(hiddenNewsItemIds);
  const hiddenNewsUrlKeys = new Set(
    hiddenNewsItems.flatMap(getNewsDedupeUrlKeys),
  );

  return positiveFeedbackItems.filter((item) => {
    if (item.newsItemId && hiddenNewsItemIdSet.has(item.newsItemId)) {
      return false;
    }

    return !getNewsDedupeUrlKeys(item).some((urlKey) =>
      hiddenNewsUrlKeys.has(urlKey),
    );
  });
};

export const selectNewsForYouItems = <TItem extends NewsForYouCandidate>({
  collaborativeSignals = [],
  hiddenNewsItemIds,
  hiddenNewsItems = [],
  items,
  limit,
  negativeFeedbackItems,
  now,
  positiveFeedbackItems = [],
  profile,
  readerLocalHour,
  semanticMatches = [],
  sessionIntent,
  viewedNewsItemIds,
  viewedNewsItems = [],
  readingHistoryItemIds = viewedNewsItemIds,
  readingHistoryItems = viewedNewsItems,
}: {
  collaborativeSignals?: readonly NewsCollaborativeSignal[];
  hiddenNewsItemIds: readonly string[];
  hiddenNewsItems?: readonly NewsForYouCandidate[];
  items: readonly TItem[];
  limit: number;
  negativeFeedbackItems: readonly NegativeFeedbackNewsItem[];
  now?: Date;
  positiveFeedbackItems?: readonly PositiveFeedbackNewsItem[];
  profile: NewsPreferenceProfile;
  readerLocalHour?: number;
  readingHistoryItemIds?: readonly string[];
  readingHistoryItems?: readonly RecentExposureNewsItem[];
  semanticMatches?: readonly NewsSemanticSimilarityMatch[];
  sessionIntent?: NewsSessionIntentFilter;
  viewedNewsItemIds: readonly string[];
  viewedNewsItems?: readonly RecentExposureNewsItem[];
}): RankedNewsItem<TItem>[] => {
  const recommendableRows = dedupeNewsItems(
    filterBlockedNewsItems(items, hiddenNewsItemIds, hiddenNewsItems),
  );
  const rankedRows = rankNewsForReader(recommendableRows, profile, now);
  const diverseRows = selectDiverseNewsFeed(rankedRows, {
    explorationInterval: getNewsExplorationInterval(profile),
    limit: rankedRows.length,
  });
  const exposureBalancedRows = selectExposureBalancedNewsFeed(
    diverseRows,
    viewedNewsItems,
    now,
  );
  const semanticSimilarityRows = selectSemanticSimilarityNewsFeed(
    exposureBalancedRows,
    semanticMatches,
  );
  const collaborativeSignalRows = selectCollaborativeSignalNewsFeed(
    semanticSimilarityRows,
    collaborativeSignals,
  );
  const activePositiveFeedbackItems = filterActiveNewsPositiveFeedback({
    hiddenNewsItemIds,
    hiddenNewsItems,
    positiveFeedbackItems,
  });
  const positiveAnchoredRows = selectPositiveFeedbackAnchoredNewsFeed(
    collaborativeSignalRows,
    activePositiveFeedbackItems,
    now,
  );
  const feedbackAdjustedRows = selectNegativeFeedbackAdjustedNewsFeed(
    positiveAnchoredRows,
    negativeFeedbackItems,
    now,
  );
  const trustBalancedRows =
    selectSourceTrustBalancedNewsFeed(feedbackAdjustedRows);
  const sourceCorroboratedRows =
    selectSourceCorroboratedNewsFeed(trustBalancedRows);
  const daypartBalancedRows = selectDaypartBalancedNewsFeed(
    sourceCorroboratedRows,
    {
      now,
      readerLocalHour,
    },
  );
  const sessionIntentRows = sessionIntent
    ? selectSessionIntentNewsFeed(daypartBalancedRows, sessionIntent)
    : daypartBalancedRows;
  const fatigueBalancedRows = selectFatigueBalancedNewsFeed(sessionIntentRows);
  const breakingPriorityRows = selectBreakingNewsPriorityFeed(
    fatigueBalancedRows,
    now,
  );
  const discoverySlotRows = selectDiscoverySlotNewsFeed(breakingPriorityRows);

  const readerFreshRows = selectReaderFreshNewsFeed(
    discoverySlotRows,
    readingHistoryItemIds,
    readingHistoryItems,
  );
  const freshnessQuotaRows = selectFreshnessQuotaBalancedNewsFeed(
    readerFreshRows,
    {
      limit: readerFreshRows.length,
      now,
    },
  );
  const rotatedRows = selectNewsRecommendationRotationFeed({
    items: freshnessQuotaRows,
    limit: freshnessQuotaRows.length,
  });

  const sourceQuotaRows = selectSourceQuotaBalancedNewsFeed(rotatedRows, {
    limit: rotatedRows.length,
  });

  const entityQuotaRows = selectEntityQuotaBalancedNewsFeed(sourceQuotaRows, {
    limit: sourceQuotaRows.length,
  });

  const categoryQuotaRows = selectCategoryQuotaBalancedNewsFeed(
    entityQuotaRows,
    {
      limit: entityQuotaRows.length,
    },
  );

  return selectAngleQuotaBalancedNewsFeed(categoryQuotaRows, {
    limit,
  });
};

export type ExplainedNewsForYouItem<
  TItem extends RankedNewsItem<NewsForYouCandidate>,
> = TItem & {
  recommendation: NewsRecommendationExplanation;
};

export const attachNewsRecommendationExplanations = <
  TItem extends RankedNewsItem<NewsForYouCandidate>,
>(
  items: readonly TItem[],
  now = new Date(),
): ExplainedNewsForYouItem<TItem>[] =>
  items.map((item) => ({
    ...item,
    recommendation: summarizeNewsRecommendation({ item, now }),
  }));

export const getNewsForYouCandidateLimit = (limit: number) =>
  Math.min(limit * 6, 240);

const collaborativeSignalWindowMs = 7 * 24 * 3_600_000;

export const getNewsCollaborativeSignalWindowStart = (now = new Date()) =>
  new Date(now.getTime() - collaborativeSignalWindowMs);

export const buildNewsCollaborativeSignalCondition = ({
  candidateCategories = [],
  candidateEntities = [],
  candidateNewsItemIds,
  candidateSourceSlugs = [],
  candidateTags = [],
  currentReaderProfileId,
  since,
}: {
  candidateCategories?: readonly z.infer<typeof NewsCategorySchema>[];
  candidateEntities?: readonly string[];
  candidateNewsItemIds: readonly string[];
  candidateSourceSlugs?: readonly string[];
  candidateTags?: readonly string[];
  currentReaderProfileId: string | null;
  since: Date;
}): SQL<unknown> | undefined => {
  const candidateRecallConditions = [
    candidateNewsItemIds.length > 0
      ? inArray(NewsReaderInteraction.newsItemId, candidateNewsItemIds)
      : sql`false`,
    candidateCategories.length > 0
      ? inArray(NewsItem.category, candidateCategories)
      : undefined,
    candidateSourceSlugs.length > 0
      ? inArray(NewsSource.slug, candidateSourceSlugs)
      : undefined,
    candidateEntities.length > 0
      ? sql`${NewsItem.entities} && ${textArraySql(candidateEntities)}`
      : undefined,
    candidateTags.length > 0
      ? sql`${NewsItem.tags} && ${textArraySql(candidateTags)}`
      : undefined,
  ].filter((condition): condition is SQL<unknown> => condition !== undefined);

  return compactConditions([
    candidateRecallConditions.length > 0
      ? (or(...candidateRecallConditions) ?? sql`false`)
      : sql`false`,
    eq(NewsItem.status, "published"),
    sql`${NewsReaderInteraction.occurredAt} >= ${since}`,
    collaborativeSignalInteractionCondition(),
    currentReaderProfileId
      ? sql`${NewsReaderInteraction.readerProfileId} <> ${currentReaderProfileId}`
      : undefined,
  ]);
};

export const buildNewsGuardrailRestoreCondition = ({
  newsItemId,
  readerProfileId,
}: {
  newsItemId: string;
  readerProfileId: string;
}): SQL<unknown> =>
  compactConditions([
    eq(NewsReaderInteraction.readerProfileId, readerProfileId),
    eq(NewsReaderInteraction.newsItemId, newsItemId),
    sql`${NewsReaderInteraction.action} = 'hide'`,
  ]) ?? sql`false`;

export const buildNewsSavedRemovalCondition = ({
  newsItemId,
  readerProfileId,
}: {
  newsItemId: string;
  readerProfileId: string;
}): SQL<unknown> =>
  compactConditions([
    eq(NewsReaderInteraction.readerProfileId, readerProfileId),
    eq(NewsReaderInteraction.newsItemId, newsItemId),
    sql`${NewsReaderInteraction.action} = 'save'`,
  ]) ?? sql`false`;

const newsReaderProfileSignalInteractionSelection = {
  action: NewsReaderInteraction.action,
  category: NewsItem.category,
  entities: NewsItem.entities,
  id: NewsReaderInteraction.id,
  metadata: NewsReaderInteraction.metadata,
  newsItemId: NewsReaderInteraction.newsItemId,
  occurredAt: NewsReaderInteraction.occurredAt,
  sourceSlug: NewsSource.slug,
  tags: NewsItem.tags,
};

const removeNewsReaderInteractionAndRollbackProfile = async ({
  db,
  profile,
  removalCondition,
}: {
  db: NewsRouterDb;
  profile: NewsReaderProfileRow;
  removalCondition: SQL<unknown>;
}): Promise<NewsPreferenceProfile> => {
  let responseProfile = toPreferenceProfile(profile);
  const removedRows = await db
    .select(newsReaderProfileSignalInteractionSelection)
    .from(NewsReaderInteraction)
    .innerJoin(NewsItem, eq(NewsReaderInteraction.newsItemId, NewsItem.id))
    .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
    .where(removalCondition)
    .orderBy(desc(NewsReaderInteraction.occurredAt))
    .limit(2);

  await db.delete(NewsReaderInteraction).where(removalCondition);

  const removedRow = removedRows.at(0);

  if (removedRows.length !== 1 || !removedRow) return responseProfile;

  const remainingRows = await db
    .select(newsReaderProfileSignalInteractionSelection)
    .from(NewsReaderInteraction)
    .innerJoin(NewsItem, eq(NewsReaderInteraction.newsItemId, NewsItem.id))
    .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
    .where(
      compactConditions([
        eq(NewsReaderInteraction.readerProfileId, profile.id),
        sql`${NewsReaderInteraction.occurredAt} > ${removedRow.occurredAt}`,
      ]),
    )
    .orderBy(desc(NewsReaderInteraction.occurredAt))
    .limit(500);

  const nextProfile = buildNewsReaderProfileAfterInteractionRemoval({
    currentProfile: responseProfile,
    remainingInteractions: remainingRows.map(
      toNewsReaderProfileSignalInteraction,
    ),
    removedInteraction: toNewsReaderProfileSignalInteraction(removedRow),
  });

  if (!areNewsPreferenceProfilesEqual(nextProfile, responseProfile)) {
    await db
      .update(NewsReaderProfile)
      .set(toNewsPreferenceProfilePersistenceValues(nextProfile))
      .where(eq(NewsReaderProfile.id, profile.id));
  }

  responseProfile = nextProfile;

  return responseProfile;
};

export const selectUniqueNewsCollectionItems = <TItem extends DedupeNewsItem>(
  items: readonly TItem[],
  hiddenNewsItems: readonly DedupeNewsItem[] = [],
): TItem[] =>
  dedupeNewsItems(filterBlockedNewsItems(items, [], hiddenNewsItems));

export const selectNewsFeedItems = <TItem extends DedupeNewsItem>({
  items,
  limit,
}: {
  items: readonly TItem[];
  limit: number;
}): TItem[] => dedupeNewsItems(items).slice(0, limit);

export const buildNewsFeedOrderByExpressions = ({
  mode,
}: {
  mode: z.infer<typeof NewsPublicFeedModeSchema>;
}) =>
  mode === "latest"
    ? [desc(NewsItem.publishedAt), desc(NewsItem.trendScore)]
    : [desc(NewsItem.trendScore), desc(NewsItem.publishedAt)];

export const buildNewsFeedCursorCondition = ({
  cursor,
  cursorTrendScore,
  mode,
}: Pick<
  NewsPublishedFeedConditionInput,
  "cursor" | "cursorTrendScore" | "mode"
>): SQL<unknown> | undefined => {
  if (!cursor) return undefined;

  const cursorPublishedAt = new Date(cursor);

  if (mode === "trending" && typeof cursorTrendScore === "number") {
    return or(
      lt(NewsItem.trendScore, cursorTrendScore),
      and(
        eq(NewsItem.trendScore, cursorTrendScore),
        lt(NewsItem.publishedAt, cursorPublishedAt),
      ),
    );
  }

  return lt(NewsItem.publishedAt, cursorPublishedAt);
};

export const buildNewsForYouCandidateConditions = ({
  input,
}: {
  input: NewsForYouInput;
}): SQL<unknown> | undefined =>
  compactConditions([
    publishedFeedConditions(input),
    input.excludeNewsItemIds && input.excludeNewsItemIds.length > 0
      ? notInArray(NewsItem.id, input.excludeNewsItemIds)
      : undefined,
  ]);

export const selectNewsSearchCandidateItems = <TItem extends DedupeNewsItem>({
  items,
  limit,
}: {
  items: readonly TItem[];
  limit: number;
}): TItem[] => selectNewsFeedItems({ items, limit });

export const newsRouter = {
  feed: publicProcedure
    .input(NewsFeedInputSchema)
    .query(async ({ ctx, input }) => {
      const candidateLimit = Math.min(input.limit * 3, 150);
      const rows = await ctx.db
        .select({
          id: NewsItem.id,
          title: NewsItem.title,
          summary: NewsItem.summary,
          canonicalUrl: NewsItem.canonicalUrl,
          imageUrl: NewsItem.imageUrl,
          originalUrl: NewsItem.originalUrl,
          publishedAt: NewsItem.publishedAt,
          category: NewsItem.category,
          tags: NewsItem.tags,
          entities: NewsItem.entities,
          sourceScore: NewsItem.sourceScore,
          trendScore: NewsItem.trendScore,
          embeddingStatus: NewsItem.embeddingStatus,
          source: {
            id: NewsSource.id,
            name: NewsSource.name,
            slug: NewsSource.slug,
            homepageUrl: NewsSource.homepageUrl,
            sourceType: NewsSource.sourceType,
            credibility: NewsSource.credibility,
          },
        })
        .from(NewsItem)
        .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
        .where(publishedFeedConditions(input))
        .orderBy(...buildNewsFeedOrderByExpressions({ mode: input.mode }))
        .limit(candidateLimit);

      return selectNewsFeedItems({
        items: rows.map((row) => ({
          ...row,
          publishedAt: row.publishedAt.toISOString(),
        })),
        limit: input.limit,
      });
    }),

  profile: publicProcedure
    .input(NewsReaderProfileInputSchema)
    .query(async ({ ctx, input }) => {
      const identity = resolveReaderIdentity(
        ctx.session?.user.id,
        input.visitorKey,
      );

      if (!identity) {
        return buildNewsReaderProfileResponse({
          interactions: [],
          persisted: false,
          profile: defaultNewsPreferenceProfile,
        });
      }

      const [profile] = await ctx.db
        .select()
        .from(NewsReaderProfile)
        .where(eq(NewsReaderProfile.readerKey, identity.readerKey))
        .limit(1);

      const interactions = profile
        ? await ctx.db
            .select({
              action: NewsReaderInteraction.action,
              category: NewsItem.category,
              entities: NewsItem.entities,
              metadata: NewsReaderInteraction.metadata,
              occurredAt: NewsReaderInteraction.occurredAt,
              sourceSlug: NewsSource.slug,
              tags: NewsItem.tags,
            })
            .from(NewsReaderInteraction)
            .innerJoin(
              NewsItem,
              eq(NewsReaderInteraction.newsItemId, NewsItem.id),
            )
            .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
            .where(eq(NewsReaderInteraction.readerProfileId, profile.id))
            .orderBy(desc(NewsReaderInteraction.occurredAt))
            .limit(50)
        : [];

      return buildNewsReaderProfileResponse({
        interactions: interactions.map((interaction) => {
          const metadata = NewsInteractionMetadataSchema.safeParse(
            interaction.metadata,
          );

          return {
            action: interaction.action,
            category: interaction.category,
            entities: interaction.entities,
            metadata: metadata.success ? metadata.data : undefined,
            occurredAt: interaction.occurredAt.toISOString(),
            sourceSlug: interaction.sourceSlug,
            tags: interaction.tags,
          };
        }),
        persisted: Boolean(profile),
        profile: toPreferenceProfile(profile),
      });
    }),

  forYou: publicProcedure
    .input(NewsForYouInputSchema)
    .query(async ({ ctx, input }) => {
      const identity = resolveReaderIdentity(
        ctx.session?.user.id,
        input.visitorKey,
      );
      let profile = defaultNewsPreferenceProfile;
      let hiddenNewsItemIds: string[] = [];
      let hiddenNewsItems: NewsForYouCandidate[] = [];
      let negativeFeedbackItems: NegativeFeedbackNewsItem[] = [];
      let positiveFeedbackItems: PositiveFeedbackNewsItem[] = [];
      let semanticFeedbackRefs: NewsSemanticFeedbackRef[] = [];
      let currentReaderProfileId: string | null = null;
      let viewedNewsItemIds: string[] = [];
      let viewedNewsItems: RecentExposureNewsItem[] = [];
      let readingHistoryItems: RecentExposureNewsItem[] = [];

      if (identity) {
        const [persistedProfile] = await ctx.db
          .select()
          .from(NewsReaderProfile)
          .where(eq(NewsReaderProfile.readerKey, identity.readerKey))
          .limit(1);

        profile = toPreferenceProfile(persistedProfile);
        currentReaderProfileId = persistedProfile?.id ?? null;

        if (persistedProfile) {
          const [hiddenRows, positiveRows, viewedRows] = await Promise.all([
            ctx.db
              .select({
                canonicalUrl: NewsItem.canonicalUrl,
                category: NewsItem.category,
                entities: NewsItem.entities,
                id: NewsItem.id,
                imageUrl: NewsItem.imageUrl,
                newsItemId: NewsReaderInteraction.newsItemId,
                occurredAt: NewsReaderInteraction.occurredAt,
                originalUrl: NewsItem.originalUrl,
                publishedAt: NewsItem.publishedAt,
                sourceName: NewsSource.name,
                sourceSlug: NewsSource.slug,
                sourceScore: NewsItem.sourceScore,
                sourceType: NewsSource.sourceType,
                summary: NewsItem.summary,
                tags: NewsItem.tags,
                title: NewsItem.title,
                trendScore: NewsItem.trendScore,
              })
              .from(NewsReaderInteraction)
              .innerJoin(
                NewsItem,
                eq(NewsReaderInteraction.newsItemId, NewsItem.id),
              )
              .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
              .where(
                compactConditions([
                  eq(
                    NewsReaderInteraction.readerProfileId,
                    persistedProfile.id,
                  ),
                  eq(NewsReaderInteraction.action, "hide"),
                  eq(NewsItem.status, "published"),
                ]),
              )
              .orderBy(desc(NewsReaderInteraction.occurredAt))
              .limit(500),
            ctx.db
              .select({
                action: NewsReaderInteraction.action,
                canonicalUrl: NewsItem.canonicalUrl,
                category: NewsItem.category,
                entities: NewsItem.entities,
                metadata: NewsReaderInteraction.metadata,
                newsItemId: NewsReaderInteraction.newsItemId,
                occurredAt: NewsReaderInteraction.occurredAt,
                originalUrl: NewsItem.originalUrl,
                sourceSlug: NewsSource.slug,
                tags: NewsItem.tags,
              })
              .from(NewsReaderInteraction)
              .innerJoin(
                NewsItem,
                eq(NewsReaderInteraction.newsItemId, NewsItem.id),
              )
              .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
              .where(
                compactConditions([
                  eq(
                    NewsReaderInteraction.readerProfileId,
                    persistedProfile.id,
                  ),
                  or(
                    eq(NewsReaderInteraction.action, "click_source"),
                    eq(NewsReaderInteraction.action, "save"),
                    eq(NewsReaderInteraction.action, "share"),
                    eq(NewsReaderInteraction.action, "view"),
                  ),
                  eq(NewsItem.status, "published"),
                ]),
              )
              .orderBy(desc(NewsReaderInteraction.occurredAt))
              .limit(500),
            ctx.db
              .select({
                canonicalUrl: NewsItem.canonicalUrl,
                category: NewsItem.category,
                entities: NewsItem.entities,
                metadata: NewsReaderInteraction.metadata,
                newsItemId: NewsReaderInteraction.newsItemId,
                occurredAt: NewsReaderInteraction.occurredAt,
                originalUrl: NewsItem.originalUrl,
                sourceSlug: NewsSource.slug,
                tags: NewsItem.tags,
                title: NewsItem.title,
              })
              .from(NewsReaderInteraction)
              .innerJoin(
                NewsItem,
                eq(NewsReaderInteraction.newsItemId, NewsItem.id),
              )
              .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
              .where(
                compactConditions([
                  eq(
                    NewsReaderInteraction.readerProfileId,
                    persistedProfile.id,
                  ),
                  eq(NewsReaderInteraction.action, "view"),
                  eq(NewsItem.status, "published"),
                ]),
              )
              .orderBy(desc(NewsReaderInteraction.occurredAt))
              .limit(500),
          ]);

          hiddenNewsItemIds = hiddenRows.map((row) => row.newsItemId);
          hiddenNewsItems = hiddenRows.map((row) => ({
            ...row,
            canonicalUrl: row.canonicalUrl,
            id: row.id,
            imageUrl: row.imageUrl,
            publishedAt: row.publishedAt.toISOString(),
          }));
          negativeFeedbackItems = hiddenRows.map((row) => ({
            category: row.category,
            entities: row.entities,
            occurredAt: row.occurredAt.toISOString(),
            sourceSlug: row.sourceSlug,
            tags: row.tags,
          }));
          const positiveFeedbackRows = positiveRows.flatMap((row) => {
            const metadata = NewsInteractionMetadataSchema.safeParse(
              row.metadata,
            );
            const parsedMetadata = metadata.success ? metadata.data : undefined;

            if (
              !shouldIncludeNewsInteractionAsPositiveFeedback({
                action: row.action,
                metadata: parsedMetadata,
              })
            ) {
              return [];
            }

            return [
              {
                action: row.action,
                canonicalUrl: row.canonicalUrl,
                category: row.category,
                entities: row.entities,
                metadata: parsedMetadata,
                newsItemId: row.newsItemId,
                occurredAt: row.occurredAt.toISOString(),
                originalUrl: row.originalUrl,
                sourceSlug: row.sourceSlug,
                tags: row.tags,
              },
            ];
          });
          const activePositiveFeedbackRows = filterActiveNewsPositiveFeedback({
            hiddenNewsItemIds,
            hiddenNewsItems,
            positiveFeedbackItems: positiveFeedbackRows,
          });
          positiveFeedbackItems = activePositiveFeedbackRows.map((row) => ({
            action:
              row.action === "click_source" ||
              row.action === "save" ||
              row.action === "share"
                ? row.action
                : undefined,
            canonicalUrl: row.canonicalUrl,
            category: row.category,
            entities: row.entities,
            newsItemId: row.newsItemId,
            occurredAt: row.occurredAt,
            originalUrl: row.originalUrl,
            sourceSlug: row.sourceSlug,
            tags: row.tags,
          }));
          semanticFeedbackRefs = activePositiveFeedbackRows.map((row) => ({
            canonicalUrl: row.canonicalUrl,
            newsItemId: row.newsItemId,
            occurredAt: row.occurredAt,
            originalUrl: row.originalUrl,
            strength: getNewsSemanticFeedbackStrength({
              action: row.action,
              metadata: row.metadata,
            }),
          }));
          const viewedHistory = selectNewsViewedHistory(viewedRows);
          viewedNewsItemIds = viewedHistory.readingHistoryItemIds;
          viewedNewsItems = viewedHistory.recentExposureItems;
          readingHistoryItems = viewedHistory.readingHistoryItems;
        }
      }

      const candidateLimit = getNewsForYouCandidateLimit(input.limit);
      const rows = await ctx.db
        .select({
          id: NewsItem.id,
          title: NewsItem.title,
          summary: NewsItem.summary,
          canonicalUrl: NewsItem.canonicalUrl,
          imageUrl: NewsItem.imageUrl,
          originalUrl: NewsItem.originalUrl,
          publishedAt: NewsItem.publishedAt,
          category: NewsItem.category,
          tags: NewsItem.tags,
          entities: NewsItem.entities,
          sourceScore: NewsItem.sourceScore,
          trendScore: NewsItem.trendScore,
          sourceName: NewsSource.name,
          sourceSlug: NewsSource.slug,
          sourceType: NewsSource.sourceType,
        })
        .from(NewsItem)
        .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
        .where(buildNewsForYouCandidateConditions({ input }))
        .orderBy(desc(NewsItem.trendScore), desc(NewsItem.publishedAt))
        .limit(candidateLimit);

      const items = rows.map((row) => ({
        ...row,
        publishedAt: row.publishedAt.toISOString(),
      }));
      let collaborativeSignals: NewsCollaborativeSignal[] = [];
      let semanticMatches: NewsSemanticSimilarityMatch[] = [];

      if (items.length > 0) {
        const collaborativeSince = getNewsCollaborativeSignalWindowStart();
        const collaborativeRows = await ctx.db
          .select({
            canonicalUrl: NewsItem.canonicalUrl,
            category: NewsItem.category,
            deepReadCount: sql<number>`count(*) filter (where ${
              NewsReaderInteraction.action
            } = 'view' and ${newsArticleSurfaceCondition()} and coalesce((${NewsReaderInteraction.metadata}->>'readPercent')::double precision, 0) >= 0.8)::int`,
            entities: NewsItem.entities,
            newsItemId: NewsReaderInteraction.newsItemId,
            originalUrl: NewsItem.originalUrl,
            readerCount: sql<number>`count(distinct ${NewsReaderInteraction.readerProfileId})::int`,
            hideCount: sql<number>`count(*) filter (where ${NewsReaderInteraction.action} = 'hide')::int`,
            saveCount: sql<number>`count(*) filter (where ${NewsReaderInteraction.action} = 'save')::int`,
            shareCount: sql<number>`count(*) filter (where ${NewsReaderInteraction.action} = 'share')::int`,
            sourceClickCount: sql<number>`count(*) filter (where ${NewsReaderInteraction.action} = 'click_source')::int`,
            sourceSlug: NewsSource.slug,
            tags: NewsItem.tags,
          })
          .from(NewsReaderInteraction)
          .innerJoin(
            NewsItem,
            eq(NewsReaderInteraction.newsItemId, NewsItem.id),
          )
          .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
          .where(
            buildNewsCollaborativeSignalCondition({
              candidateCategories: Array.from(
                new Set(items.map((item) => item.category)),
              ),
              candidateEntities: Array.from(
                new Set(items.flatMap((item) => item.entities)),
              ),
              candidateNewsItemIds: items.map((item) => item.id),
              candidateSourceSlugs: Array.from(
                new Set(items.map((item) => item.sourceSlug)),
              ),
              candidateTags: Array.from(
                new Set(items.flatMap((item) => item.tags)),
              ),
              currentReaderProfileId,
              since: collaborativeSince,
            }),
          )
          .groupBy(
            NewsReaderInteraction.newsItemId,
            NewsItem.canonicalUrl,
            NewsItem.category,
            NewsItem.entities,
            NewsItem.originalUrl,
            NewsSource.slug,
            NewsItem.tags,
          );

        collaborativeSignals = collaborativeRows.flatMap((row) => {
          const signal = toNewsCollaborativeSignal(row);

          return signal ? [signal] : [];
        });
      }

      if (semanticFeedbackRefs.length > 0 && items.length > 0) {
        const vectorNewsItemIds = Array.from(
          new Set([
            ...items.map((item) => item.id),
            ...semanticFeedbackRefs.map((item) => item.newsItemId),
          ]),
        );
        const vectorRows = await ctx.db
          .select({
            createdAt: NewsItemVector.createdAt,
            embedding: NewsItemVector.embedding,
            newsItemId: NewsItemVector.newsItemId,
          })
          .from(NewsItemVector)
          .where(inArray(NewsItemVector.newsItemId, vectorNewsItemIds))
          .orderBy(desc(NewsItemVector.createdAt))
          .limit(vectorNewsItemIds.length * 3);
        const latestEmbeddingByNewsItemId = new Map<
          string,
          readonly number[]
        >();

        for (const vectorRow of vectorRows) {
          if (latestEmbeddingByNewsItemId.has(vectorRow.newsItemId)) continue;
          if (!vectorRow.embedding || vectorRow.embedding.length === 0)
            continue;

          latestEmbeddingByNewsItemId.set(
            vectorRow.newsItemId,
            vectorRow.embedding,
          );
        }

        const semanticCandidateVectors = items.map((item) => ({
          canonicalUrl: item.canonicalUrl,
          embedding: latestEmbeddingByNewsItemId.get(item.id) ?? null,
          newsItemId: item.id,
          originalUrl: item.originalUrl,
        }));
        const semanticFeedbackVectors = semanticFeedbackRefs.map((item) => ({
          ...item,
          embedding: latestEmbeddingByNewsItemId.get(item.newsItemId) ?? null,
        }));

        semanticMatches = buildNewsSemanticSimilarityMatches({
          candidateVectors: semanticCandidateVectors,
          feedbackVectors: semanticFeedbackVectors,
        });
      }

      const now = new Date();
      const forYouItems = selectNewsForYouItems({
        collaborativeSignals,
        hiddenNewsItemIds,
        hiddenNewsItems,
        items,
        limit: input.limit,
        negativeFeedbackItems,
        now,
        positiveFeedbackItems,
        profile,
        readerLocalHour: input.readerLocalHour,
        readingHistoryItems,
        semanticMatches,
        sessionIntent: {
          category: input.category ?? null,
          query: input.q ?? "",
          sourceSlug: input.sourceSlug ?? null,
          tag: input.tag ?? null,
        },
        viewedNewsItemIds,
        viewedNewsItems,
      });

      return attachNewsRecommendationExplanations(forYouItems, now);
    }),

  saved: publicProcedure
    .input(NewsSavedInputSchema)
    .query(async ({ ctx, input }) => {
      const identity = resolveReaderIdentity(
        ctx.session?.user.id,
        input.visitorKey,
      );

      if (!identity) return [];

      const [rows, hiddenRows] = await Promise.all([
        ctx.db
          .select({
            id: NewsItem.id,
            title: NewsItem.title,
            summary: NewsItem.summary,
            canonicalUrl: NewsItem.canonicalUrl,
            imageUrl: NewsItem.imageUrl,
            originalUrl: NewsItem.originalUrl,
            publishedAt: NewsItem.publishedAt,
            category: NewsItem.category,
            tags: NewsItem.tags,
            entities: NewsItem.entities,
            sourceScore: NewsItem.sourceScore,
            trendScore: NewsItem.trendScore,
            sourceName: NewsSource.name,
            sourceSlug: NewsSource.slug,
            sourceType: NewsSource.sourceType,
            savedAt: NewsReaderInteraction.occurredAt,
          })
          .from(NewsReaderInteraction)
          .innerJoin(
            NewsReaderProfile,
            eq(NewsReaderInteraction.readerProfileId, NewsReaderProfile.id),
          )
          .innerJoin(
            NewsItem,
            eq(NewsReaderInteraction.newsItemId, NewsItem.id),
          )
          .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
          .where(
            compactConditions([
              eq(NewsReaderProfile.readerKey, identity.readerKey),
              eq(NewsReaderInteraction.action, "save"),
              eq(NewsItem.status, "published"),
            ]),
          )
          .orderBy(desc(NewsReaderInteraction.occurredAt))
          .limit(input.limit * 3),
        ctx.db
          .select({
            id: NewsItem.id,
            title: NewsItem.title,
            canonicalUrl: NewsItem.canonicalUrl,
            originalUrl: NewsItem.originalUrl,
            publishedAt: NewsItem.publishedAt,
            category: NewsItem.category,
            entities: NewsItem.entities,
            sourceScore: NewsItem.sourceScore,
            trendScore: NewsItem.trendScore,
            sourceSlug: NewsSource.slug,
          })
          .from(NewsReaderInteraction)
          .innerJoin(
            NewsReaderProfile,
            eq(NewsReaderInteraction.readerProfileId, NewsReaderProfile.id),
          )
          .innerJoin(
            NewsItem,
            eq(NewsReaderInteraction.newsItemId, NewsItem.id),
          )
          .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
          .where(
            compactConditions([
              eq(NewsReaderProfile.readerKey, identity.readerKey),
              eq(NewsReaderInteraction.action, "hide"),
              eq(NewsItem.status, "published"),
            ]),
          )
          .orderBy(desc(NewsReaderInteraction.occurredAt))
          .limit(500),
      ]);

      return selectUniqueNewsCollectionItems(
        rows.map((row) => ({
          ...row,
          publishedAt: row.publishedAt.toISOString(),
          savedAt: row.savedAt.toISOString(),
        })),
        hiddenRows.map((row) => ({
          ...row,
          publishedAt: row.publishedAt.toISOString(),
        })),
      ).slice(0, input.limit);
    }),

  history: publicProcedure
    .input(NewsHistoryInputSchema)
    .query(async ({ ctx, input }) => {
      const identity = resolveReaderIdentity(
        ctx.session?.user.id,
        input.visitorKey,
      );

      if (!identity) return [];

      const [rows, hiddenRows] = await Promise.all([
        ctx.db
          .select({
            id: NewsItem.id,
            title: NewsItem.title,
            summary: NewsItem.summary,
            canonicalUrl: NewsItem.canonicalUrl,
            imageUrl: NewsItem.imageUrl,
            originalUrl: NewsItem.originalUrl,
            publishedAt: NewsItem.publishedAt,
            category: NewsItem.category,
            tags: NewsItem.tags,
            entities: NewsItem.entities,
            sourceScore: NewsItem.sourceScore,
            trendScore: NewsItem.trendScore,
            sourceName: NewsSource.name,
            sourceSlug: NewsSource.slug,
            sourceType: NewsSource.sourceType,
            viewedAt: NewsReaderInteraction.occurredAt,
          })
          .from(NewsReaderInteraction)
          .innerJoin(
            NewsReaderProfile,
            eq(NewsReaderInteraction.readerProfileId, NewsReaderProfile.id),
          )
          .innerJoin(
            NewsItem,
            eq(NewsReaderInteraction.newsItemId, NewsItem.id),
          )
          .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
          .where(
            compactConditions([
              eq(NewsReaderProfile.readerKey, identity.readerKey),
              eq(NewsReaderInteraction.action, "view"),
              meaningfulNewsArticleReadCondition(),
              eq(NewsItem.status, "published"),
            ]),
          )
          .orderBy(desc(NewsReaderInteraction.occurredAt))
          .limit(input.limit * 3),
        ctx.db
          .select({
            id: NewsItem.id,
            title: NewsItem.title,
            canonicalUrl: NewsItem.canonicalUrl,
            originalUrl: NewsItem.originalUrl,
            publishedAt: NewsItem.publishedAt,
            category: NewsItem.category,
            entities: NewsItem.entities,
            sourceScore: NewsItem.sourceScore,
            trendScore: NewsItem.trendScore,
            sourceSlug: NewsSource.slug,
          })
          .from(NewsReaderInteraction)
          .innerJoin(
            NewsReaderProfile,
            eq(NewsReaderInteraction.readerProfileId, NewsReaderProfile.id),
          )
          .innerJoin(
            NewsItem,
            eq(NewsReaderInteraction.newsItemId, NewsItem.id),
          )
          .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
          .where(
            compactConditions([
              eq(NewsReaderProfile.readerKey, identity.readerKey),
              eq(NewsReaderInteraction.action, "hide"),
              eq(NewsItem.status, "published"),
            ]),
          )
          .orderBy(desc(NewsReaderInteraction.occurredAt))
          .limit(500),
      ]);

      return selectUniqueNewsCollectionItems(
        rows.map((row) => ({
          ...row,
          publishedAt: row.publishedAt.toISOString(),
          viewedAt: row.viewedAt.toISOString(),
        })),
        hiddenRows.map((row) => ({
          ...row,
          publishedAt: row.publishedAt.toISOString(),
        })),
      ).slice(0, input.limit);
    }),

  guardrails: publicProcedure
    .input(NewsGuardrailsInputSchema)
    .query(async ({ ctx, input }) => {
      const identity = resolveReaderIdentity(
        ctx.session?.user.id,
        input.visitorKey,
      );

      if (!identity) return [];

      const rows = await ctx.db
        .select({
          id: NewsItem.id,
          title: NewsItem.title,
          summary: NewsItem.summary,
          canonicalUrl: NewsItem.canonicalUrl,
          imageUrl: NewsItem.imageUrl,
          originalUrl: NewsItem.originalUrl,
          publishedAt: NewsItem.publishedAt,
          category: NewsItem.category,
          tags: NewsItem.tags,
          entities: NewsItem.entities,
          sourceScore: NewsItem.sourceScore,
          trendScore: NewsItem.trendScore,
          sourceName: NewsSource.name,
          sourceSlug: NewsSource.slug,
          sourceType: NewsSource.sourceType,
          hiddenAt: NewsReaderInteraction.occurredAt,
        })
        .from(NewsReaderInteraction)
        .innerJoin(
          NewsReaderProfile,
          eq(NewsReaderInteraction.readerProfileId, NewsReaderProfile.id),
        )
        .innerJoin(NewsItem, eq(NewsReaderInteraction.newsItemId, NewsItem.id))
        .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
        .where(
          compactConditions([
            eq(NewsReaderProfile.readerKey, identity.readerKey),
            eq(NewsReaderInteraction.action, "hide"),
            eq(NewsItem.status, "published"),
          ]),
        )
        .orderBy(desc(NewsReaderInteraction.occurredAt))
        .limit(input.limit * 3);

      return selectUniqueNewsCollectionItems(
        rows.map((row) => {
          const hiddenAt = row.hiddenAt.toISOString();

          return {
            ...row,
            hiddenAt,
            occurredAt: hiddenAt,
            publishedAt: row.publishedAt.toISOString(),
          };
        }),
      ).slice(0, input.limit);
    }),

  byId: publicProcedure
    .input(NewsByIdInputSchema)
    .query(async ({ ctx, input }) => {
      const [item] = await ctx.db
        .select({
          id: NewsItem.id,
          title: NewsItem.title,
          summary: NewsItem.summary,
          bodyText: NewsItem.bodyText,
          canonicalUrl: NewsItem.canonicalUrl,
          originalUrl: NewsItem.originalUrl,
          imageUrl: NewsItem.imageUrl,
          authorName: NewsItem.authorName,
          language: NewsItem.language,
          publishedAt: NewsItem.publishedAt,
          collectedAt: NewsItem.collectedAt,
          category: NewsItem.category,
          tags: NewsItem.tags,
          entities: NewsItem.entities,
          sourceScore: NewsItem.sourceScore,
          trendScore: NewsItem.trendScore,
          embeddingStatus: NewsItem.embeddingStatus,
          source: {
            id: NewsSource.id,
            name: NewsSource.name,
            slug: NewsSource.slug,
            homepageUrl: NewsSource.homepageUrl,
            sourceType: NewsSource.sourceType,
            credibility: NewsSource.credibility,
          },
        })
        .from(NewsItem)
        .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
        .where(
          compactConditions([
            eq(NewsItem.id, input.id),
            eq(NewsItem.status, "published"),
          ]),
        )
        .limit(1);

      if (!item) return null;

      const signals = await ctx.db
        .select({
          signalType: NewsSignal.signalType,
          signalValue: NewsSignal.signalValue,
          metadata: NewsSignal.metadata,
          observedAt: NewsSignal.observedAt,
        })
        .from(NewsSignal)
        .where(eq(NewsSignal.newsItemId, input.id))
        .orderBy(desc(NewsSignal.observedAt))
        .limit(20);

      const vectors = await ctx.db
        .select({
          provider: NewsItemVector.provider,
          model: NewsItemVector.model,
          dimension: NewsItemVector.dimension,
          contentHash: NewsItemVector.contentHash,
          vectorRef: NewsItemVector.vectorRef,
          createdAt: NewsItemVector.createdAt,
        })
        .from(NewsItemVector)
        .where(eq(NewsItemVector.newsItemId, input.id))
        .orderBy(desc(NewsItemVector.createdAt))
        .limit(5);

      return {
        ...item,
        signals,
        vectors,
        hasVector: vectors.length > 0,
      };
    }),

  recordInteraction: publicProcedure
    .input(NewsRecordInteractionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const identity = resolveReaderIdentity(
        ctx.session?.user.id,
        input.visitorKey,
      );

      if (!identity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A reader identity is required to store news preferences.",
        });
      }

      const [item] = await ctx.db
        .select({
          id: NewsItem.id,
          title: NewsItem.title,
          publishedAt: NewsItem.publishedAt,
          category: NewsItem.category,
          tags: NewsItem.tags,
          entities: NewsItem.entities,
          sourceScore: NewsItem.sourceScore,
          trendScore: NewsItem.trendScore,
          sourceSlug: NewsSource.slug,
        })
        .from(NewsItem)
        .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
        .where(
          compactConditions([
            eq(NewsItem.id, input.newsItemId),
            eq(NewsItem.status, "published"),
          ]),
        )
        .limit(1);

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Published news item not found.",
        });
      }

      const [existingProfile] = await ctx.db
        .select()
        .from(NewsReaderProfile)
        .where(eq(NewsReaderProfile.readerKey, identity.readerKey))
        .limit(1);

      const currentProfile = toPreferenceProfile(existingProfile);
      const nextProfile = shouldTrainNewsProfileFromInteraction(input)
        ? updateReaderProfileWithInteraction(
            currentProfile,
            {
              ...item,
              publishedAt: item.publishedAt.toISOString(),
            },
            toNewsReaderProfileInteraction(input),
          )
        : currentProfile;

      const [profile] = await ctx.db
        .insert(NewsReaderProfile)
        .values({
          readerKey: identity.readerKey,
          userId: identity.userId,
          preferredCategories: [...nextProfile.preferredCategories],
          preferredSources: [...nextProfile.preferredSources],
          preferredEntities: [...nextProfile.preferredEntities],
          noveltyBias: nextProfile.noveltyBias,
          recencyBias: nextProfile.recencyBias,
        })
        .onConflictDoUpdate({
          target: NewsReaderProfile.readerKey,
          set: {
            userId: identity.userId,
            preferredCategories: [...nextProfile.preferredCategories],
            preferredSources: [...nextProfile.preferredSources],
            preferredEntities: [...nextProfile.preferredEntities],
            noveltyBias: nextProfile.noveltyBias,
            recencyBias: nextProfile.recencyBias,
            updatedAt: sql`now()`,
          },
        })
        .returning();

      if (!profile) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to persist reader profile.",
        });
      }

      const duplicateHomeExposure = shouldDedupeNewsHomeExposureInteraction(
        input,
      )
        ? await ctx.db
            .select({ id: NewsReaderInteraction.id })
            .from(NewsReaderInteraction)
            .where(
              buildNewsHomeExposureDedupeCondition({
                feedMode: input.metadata?.feedMode,
                newsItemId: input.newsItemId,
                readerProfileId: profile.id,
                since: getNewsHomeExposureDedupeWindowStart(),
              }),
            )
            .limit(1)
        : [];
      const shouldStoreInteraction = duplicateHomeExposure.length === 0;

      if (shouldStoreInteraction) {
        await ctx.db.insert(NewsReaderInteraction).values({
          action: input.action,
          metadata: buildNewsInteractionTrainingMetadata({
            metadata: input.metadata,
            profileAfter: nextProfile,
            profileBefore: currentProfile,
          }),
          newsItemId: input.newsItemId,
          readerProfileId: profile.id,
        });
      }

      return buildNewsReaderMutationProfileResponse({
        interaction: shouldStoreInteraction
          ? {
              action: input.action,
              category: item.category,
              entities: item.entities,
              metadata: input.metadata,
              occurredAt: new Date().toISOString(),
              sourceSlug: item.sourceSlug,
              tags: item.tags,
            }
          : undefined,
        profile: toPreferenceProfile(profile),
      });
    }),

  restoreGuardrail: publicProcedure
    .input(NewsRestoreGuardrailInputSchema)
    .mutation(async ({ ctx, input }) => {
      const identity = resolveReaderIdentity(
        ctx.session?.user.id,
        input.visitorKey,
      );

      if (!identity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A reader identity is required to restore news guardrails.",
        });
      }

      const [profile] = await ctx.db
        .select()
        .from(NewsReaderProfile)
        .where(eq(NewsReaderProfile.readerKey, identity.readerKey))
        .limit(1);

      let responseProfile = toPreferenceProfile(profile);

      if (profile) {
        responseProfile = await removeNewsReaderInteractionAndRollbackProfile({
          db: ctx.db,
          profile,
          removalCondition: buildNewsGuardrailRestoreCondition({
            newsItemId: input.newsItemId,
            readerProfileId: profile.id,
          }),
        });
      }

      return buildNewsReaderMutationProfileResponse({
        profile: responseProfile,
      });
    }),

  removeSaved: publicProcedure
    .input(NewsRemoveSavedInputSchema)
    .mutation(async ({ ctx, input }) => {
      const identity = resolveReaderIdentity(
        ctx.session?.user.id,
        input.visitorKey,
      );

      if (!identity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A reader identity is required to remove saved news.",
        });
      }

      const [profile] = await ctx.db
        .select()
        .from(NewsReaderProfile)
        .where(eq(NewsReaderProfile.readerKey, identity.readerKey))
        .limit(1);

      let responseProfile = toPreferenceProfile(profile);

      if (profile) {
        responseProfile = await removeNewsReaderInteractionAndRollbackProfile({
          db: ctx.db,
          profile,
          removalCondition: buildNewsSavedRemovalCondition({
            newsItemId: input.newsItemId,
            readerProfileId: profile.id,
          }),
        });
      }

      return buildNewsReaderMutationProfileResponse({
        profile: responseProfile,
      });
    }),

  updateProfile: publicProcedure
    .input(NewsUpdateProfileInputSchema)
    .mutation(async ({ ctx, input }) => {
      const nextProfile = normalizeNewsPreferenceProfile(input.profile);
      const persistedProfile = {
        preferredCategories: [...nextProfile.preferredCategories],
        preferredSources: [...nextProfile.preferredSources],
        preferredEntities: [...nextProfile.preferredEntities],
        noveltyBias: nextProfile.noveltyBias,
        recencyBias: nextProfile.recencyBias,
      };
      const identity = resolveReaderIdentity(
        ctx.session?.user.id,
        input.visitorKey,
      );

      if (!identity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A reader identity is required to store news preferences.",
        });
      }

      const [profile] = await ctx.db
        .insert(NewsReaderProfile)
        .values({
          readerKey: identity.readerKey,
          userId: identity.userId,
          preferredCategories: persistedProfile.preferredCategories,
          preferredSources: persistedProfile.preferredSources,
          preferredEntities: persistedProfile.preferredEntities,
          noveltyBias: persistedProfile.noveltyBias,
          recencyBias: persistedProfile.recencyBias,
        })
        .onConflictDoUpdate({
          target: NewsReaderProfile.readerKey,
          set: {
            userId: identity.userId,
            preferredCategories: persistedProfile.preferredCategories,
            preferredSources: persistedProfile.preferredSources,
            preferredEntities: persistedProfile.preferredEntities,
            noveltyBias: persistedProfile.noveltyBias,
            recencyBias: persistedProfile.recencyBias,
            updatedAt: sql`now()`,
          },
        })
        .returning();

      if (!profile) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to persist reader profile.",
        });
      }

      return buildNewsReaderMutationProfileResponse({
        profile: toPreferenceProfile(profile),
      });
    }),

  resetProfile: publicProcedure
    .input(NewsReaderProfileInputSchema)
    .mutation(async ({ ctx, input }) => {
      const identity = getNewsReaderProfileResetIdentity({
        userId: ctx.session?.user.id,
        visitorKey: input.visitorKey,
      });

      if (!identity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A reader identity is required to reset news preferences.",
        });
      }

      const [profile] = await ctx.db
        .insert(NewsReaderProfile)
        .values({
          readerKey: identity.readerKey,
          userId: identity.userId,
          preferredCategories: [
            ...defaultNewsPreferenceProfile.preferredCategories,
          ],
          preferredSources: [...defaultNewsPreferenceProfile.preferredSources],
          preferredEntities: [
            ...defaultNewsPreferenceProfile.preferredEntities,
          ],
          noveltyBias: defaultNewsPreferenceProfile.noveltyBias,
          recencyBias: defaultNewsPreferenceProfile.recencyBias,
        })
        .onConflictDoUpdate({
          target: NewsReaderProfile.readerKey,
          set: {
            userId: identity.userId,
            preferredCategories: [
              ...defaultNewsPreferenceProfile.preferredCategories,
            ],
            preferredSources: [
              ...defaultNewsPreferenceProfile.preferredSources,
            ],
            preferredEntities: [
              ...defaultNewsPreferenceProfile.preferredEntities,
            ],
            noveltyBias: defaultNewsPreferenceProfile.noveltyBias,
            recencyBias: defaultNewsPreferenceProfile.recencyBias,
            updatedAt: sql`now()`,
          },
        })
        .returning();

      if (!profile) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to reset reader profile.",
        });
      }

      await ctx.db
        .delete(NewsReaderInteraction)
        .where(eq(NewsReaderInteraction.readerProfileId, profile.id));

      return buildNewsReaderMutationProfileResponse({
        profile: toPreferenceProfile(profile),
      });
    }),

  searchCandidates: publicProcedure
    .input(NewsSearchCandidatesInputSchema)
    .query(async ({ ctx, input }) => {
      const candidateLimit = Math.min(input.limit * 3, 75);
      const rows = await ctx.db
        .select({
          id: NewsItem.id,
          title: NewsItem.title,
          summary: NewsItem.summary,
          canonicalUrl: NewsItem.canonicalUrl,
          imageUrl: NewsItem.imageUrl,
          originalUrl: NewsItem.originalUrl,
          publishedAt: NewsItem.publishedAt,
          category: NewsItem.category,
          tags: NewsItem.tags,
          entities: NewsItem.entities,
          sourceScore: NewsItem.sourceScore,
          trendScore: NewsItem.trendScore,
          embeddingStatus: NewsItem.embeddingStatus,
          source: {
            id: NewsSource.id,
            name: NewsSource.name,
            slug: NewsSource.slug,
            homepageUrl: NewsSource.homepageUrl,
            sourceType: NewsSource.sourceType,
            credibility: NewsSource.credibility,
          },
        })
        .from(NewsItem)
        .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
        .where(searchCandidateConditions(input))
        .orderBy(desc(NewsItem.trendScore), desc(NewsItem.publishedAt))
        .limit(candidateLimit);

      return selectNewsSearchCandidateItems({
        items: rows.map((row) => ({
          ...row,
          publishedAt: row.publishedAt.toISOString(),
        })),
        limit: input.limit,
      });
    }),
} satisfies TRPCRouterRecord;
