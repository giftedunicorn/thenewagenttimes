import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import type { SQL } from "@acme/db";
import type {
  DedupeNewsItem,
  NegativeFeedbackNewsItem,
  NewsCollaborativeSignal,
  NewsPreferenceProfile,
  NewsSemanticSimilarityMatch,
  NewsSemanticVector,
  PositiveFeedbackNewsItem,
  RankedNewsItem,
  ReaderInteraction,
  RecentExposureNewsItem,
  RecommendableNewsItem,
} from "@acme/validators";
import { and, desc, eq, ilike, inArray, lt, or, sql } from "@acme/db";
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
  getNewsExplorationInterval,
  normalizeNewsPreferenceProfile,
  rankNewsForReader,
  selectBreakingNewsPriorityFeed,
  selectCollaborativeSignalNewsFeed,
  selectDiscoverySlotNewsFeed,
  selectDiverseNewsFeed,
  selectExposureBalancedNewsFeed,
  selectFatigueBalancedNewsFeed,
  selectNegativeFeedbackAdjustedNewsFeed,
  selectPositiveFeedbackAnchoredNewsFeed,
  selectReaderFreshNewsFeed,
  selectSemanticSimilarityNewsFeed,
  selectSourceTrustBalancedNewsFeed,
  shouldTrainReaderProfileFromInteraction,
  updateReaderProfileWithInteraction,
} from "@acme/validators";

import { publicProcedure } from "../trpc";

const optionalTrimmedString = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength).optional();

const optionalVisitorKey = z.string().trim().min(8).max(160).optional();

const defaultNewsPreferenceProfile: NewsPreferenceProfile = {
  preferredCategories: ["model_release", "agent_product", "funding"],
  preferredSources: [],
  preferredEntities: [],
  noveltyBias: 1,
  recencyBias: 1,
};

export const NewsFeedInputSchema = z.object({
  category: NewsCategorySchema.optional(),
  tag: optionalTrimmedString(80),
  sourceSlug: optionalTrimmedString(160),
  q: optionalTrimmedString(256),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().datetime().optional(),
});

export const NewsByIdInputSchema = z.object({
  id: z.string().uuid(),
});

export const NewsSearchCandidatesInputSchema = z.object({
  q: z.string().trim().min(1).max(256),
  category: NewsCategorySchema.optional(),
  limit: z.number().int().min(1).max(25).default(10),
});

export const NewsReaderProfileInputSchema = z.object({
  visitorKey: optionalVisitorKey,
});

export const NewsSavedInputSchema = NewsReaderProfileInputSchema.extend({
  limit: z.number().int().min(1).max(25).default(6),
});

export const NewsHistoryInputSchema = NewsReaderProfileInputSchema.extend({
  limit: z.number().int().min(1).max(25).default(6),
});

export const NewsForYouInputSchema = NewsFeedInputSchema.extend({
  visitorKey: optionalVisitorKey,
});

const NewsFeedModeSchema = z.enum(["for_you", "latest", "trending"]);
const NewsArticleReadMilestoneSchema = z.enum([
  "opened",
  "meaningful_read",
  "deep_read",
]);

const NewsInteractionMetadataSchema = z
  .object({
    exposure: z.boolean().optional(),
    exposureSlot: z.number().int().min(0).max(50).optional(),
    feedMode: NewsFeedModeSchema.optional(),
    matchedSignals: z
      .array(z.string().trim().min(1).max(80))
      .max(12)
      .optional(),
    personalizedScore: z.number().finite().optional(),
    rankSlot: z.number().int().min(0).max(240).optional(),
    readMilestone: NewsArticleReadMilestoneSchema.optional(),
    readPercent: z.number().min(0).max(1).optional(),
    surface: z.string().trim().min(1).max(80).optional(),
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

  return (metadata.readPercent ?? 0) >= 0.8;
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

const getNewsSemanticFeedbackStrength = (
  action: NewsRecordInteractionInput["action"],
) => {
  if (action === "share") return 3;
  if (action === "save") return 2;
  if (action === "click_source") return 1;

  return 2;
};

export const getNewsCollaborativeSignalScore = ({
  deepReadCount,
  saveCount,
  shareCount,
  sourceClickCount,
}: {
  deepReadCount: number;
  saveCount: number;
  shareCount: number;
  sourceClickCount: number;
}) => shareCount * 3 + saveCount * 2 + deepReadCount * 2 + sourceClickCount;

const meaningfulNewsArticleReadCondition = (): SQL<unknown> =>
  sql`${NewsReaderInteraction.metadata}->>'surface' = 'article' and coalesce((${NewsReaderInteraction.metadata}->>'readPercent')::double precision, 0) >= 0.35`;

export const NewsPreferenceProfileInputSchema = z.object({
  preferredCategories: z.array(NewsCategorySchema).max(12),
  preferredSources: z.array(z.string().trim().min(1).max(160)).max(12),
  preferredEntities: z.array(z.string().trim().min(1).max(160)).max(24),
  noveltyBias: z.number().min(0).max(2),
  recencyBias: z.number().min(0).max(2),
});

export const NewsUpdateProfileInputSchema = NewsReaderProfileInputSchema.extend(
  {
    profile: NewsPreferenceProfileInputSchema,
  },
);

type NewsFeedInput = z.infer<typeof NewsFeedInputSchema>;
type NewsSearchCandidatesInput = z.infer<
  typeof NewsSearchCandidatesInputSchema
>;
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
) =>
  metadata?.surface?.trim().toLowerCase() === "home" &&
  typeof metadata.rankSlot === "number"
    ? metadata.rankSlot
    : null;

const getAverageHomeRankSlot = (rankSlots: readonly number[]) => {
  if (rankSlots.length === 0) return null;

  const average =
    rankSlots.reduce((total, rankSlot) => total + rankSlot, 0) /
    rankSlots.length;

  return Math.round(average * 10) / 10;
};

const summarizeProfilePreference = ({
  ignoredSignalCount,
  positiveSignalCount,
  profile,
}: {
  ignoredSignalCount: number;
  positiveSignalCount: number;
  profile: NewsPreferenceProfile;
}) => {
  if (positiveSignalCount === 0) {
    return ignoredSignalCount > 0
      ? "Profile is still learning; recent signals are mostly exposure or low-depth reads."
      : "Profile is still learning from the next meaningful read, save, share, or source click.";
  }

  const categoryText = formatProfileAuditList(
    profile.preferredCategories.slice(0, 2),
  );
  const leaderText = formatProfileAuditList(
    [profile.preferredSources[0], profile.preferredEntities[0]].filter(
      (value): value is string => Boolean(value),
    ),
  );

  if (categoryText && leaderText) {
    return `Profile leans toward ${categoryText}, led by ${leaderText}.`;
  }

  if (categoryText) return `Profile leans toward ${categoryText}.`;
  if (leaderText) return `Profile is led by ${leaderText}.`;

  return "Profile is learning from recent meaningful reader signals.";
};

export const summarizeNewsReaderProfileSignals = ({
  interactions,
  profile,
}: {
  interactions: readonly NewsReaderProfileSignalInteraction[];
  profile: NewsPreferenceProfile;
}) => {
  const categoryCounts = createSignalCounter();
  const entityCounts = createSignalCounter();
  const feedModeCounts = createSignalCounter();
  const matchedSignalCounts = createSignalCounter();
  const sourceCounts = createSignalCounter();
  const tagCounts = createSignalCounter();
  const homeRankSlots: number[] = [];
  let ignoredSignalCount = 0;
  let negativeSignalCount = 0;
  let positiveSignalCount = 0;

  interactions.forEach((interaction, index) => {
    if (interaction.metadata?.feedMode) {
      addSignalCount(feedModeCounts, interaction.metadata.feedMode, index);
    }

    interaction.metadata?.matchedSignals?.forEach((signal) =>
      addSignalCount(matchedSignalCounts, signal, index),
    );

    const rankSlot = getInteractionMetadataRankSlot(interaction.metadata);

    if (rankSlot !== null) {
      homeRankSlots.push(rankSlot);
    }

    if (interaction.action === "hide") {
      negativeSignalCount += 1;
      return;
    }

    if (!shouldTrainNewsProfileFromInteraction(interaction)) {
      ignoredSignalCount += 1;
      return;
    }

    positiveSignalCount += 1;
    addSignalCount(categoryCounts, interaction.category, index);
    addSignalCount(sourceCounts, interaction.sourceSlug, index);
    interaction.entities.forEach((entity) =>
      addSignalCount(entityCounts, entity, index),
    );
    interaction.tags?.forEach((tag) => addSignalCount(tagCounts, tag, index));
  });

  return {
    averageHomeRankSlot: getAverageHomeRankSlot(homeRankSlots),
    ignoredSignalCount,
    negativeSignalCount,
    positiveSignalCount,
    summary: summarizeProfilePreference({
      ignoredSignalCount,
      positiveSignalCount,
      profile,
    }),
    topCategories: toTopSignalCounts(categoryCounts),
    topEntities: toTopSignalCounts(entityCounts),
    topFeedModes: toTopSignalCounts(feedModeCounts),
    topMatchedSignals: toTopSignalCounts(matchedSignalCounts),
    topSources: toTopSignalCounts(sourceCounts),
    topTags: toTopSignalCounts(tagCounts),
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

export const buildNewsTextSearchCondition = (
  query: string | undefined,
): SQL<unknown> | undefined => {
  if (!query) return undefined;

  const pattern = `%${query}%`;

  return or(
    ilike(NewsItem.title, pattern),
    ilike(NewsItem.summary, pattern),
    ilike(NewsSource.name, pattern),
    ilike(NewsSource.slug, pattern),
    sql`exists (select 1 from unnest(${NewsItem.entities}) as entity where entity ilike ${pattern})`,
    sql`exists (select 1 from unnest(${NewsItem.tags}) as tag where tag ilike ${pattern})`,
  );
};

const tagCondition = (tag: string | undefined): SQL<unknown> | undefined => {
  if (!tag) return undefined;

  return sql`${NewsItem.tags} @> array[${tag}]::text[]`;
};

const publishedFeedConditions = (
  input: NewsFeedInput,
): SQL<unknown> | undefined =>
  compactConditions([
    eq(NewsItem.status, "published"),
    input.category ? eq(NewsItem.category, input.category) : undefined,
    input.sourceSlug ? eq(NewsSource.slug, input.sourceSlug) : undefined,
    input.cursor ? lt(NewsItem.publishedAt, new Date(input.cursor)) : undefined,
    tagCondition(input.tag),
    buildNewsTextSearchCondition(input.q),
  ]);

const searchCandidateConditions = (
  input: NewsSearchCandidatesInput,
): SQL<unknown> | undefined =>
  compactConditions([
    eq(NewsItem.status, "published"),
    input.category ? eq(NewsItem.category, input.category) : undefined,
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
  semanticMatches = [],
  viewedNewsItemIds,
  viewedNewsItems = [],
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
  semanticMatches?: readonly NewsSemanticSimilarityMatch[];
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
  const positiveAnchoredRows = selectPositiveFeedbackAnchoredNewsFeed(
    collaborativeSignalRows,
    positiveFeedbackItems,
    now,
  );
  const feedbackAdjustedRows = selectNegativeFeedbackAdjustedNewsFeed(
    positiveAnchoredRows,
    negativeFeedbackItems,
    now,
  );
  const trustBalancedRows =
    selectSourceTrustBalancedNewsFeed(feedbackAdjustedRows);
  const fatigueBalancedRows = selectFatigueBalancedNewsFeed(trustBalancedRows);
  const breakingPriorityRows = selectBreakingNewsPriorityFeed(
    fatigueBalancedRows,
    now,
  );
  const discoverySlotRows = selectDiscoverySlotNewsFeed(breakingPriorityRows);

  return selectReaderFreshNewsFeed(
    discoverySlotRows,
    viewedNewsItemIds,
    viewedNewsItems,
  ).slice(0, limit);
};

export const getNewsForYouCandidateLimit = (limit: number) =>
  Math.min(limit * 6, 240);

export const selectUniqueNewsCollectionItems = <TItem extends DedupeNewsItem>(
  items: readonly TItem[],
): TItem[] => dedupeNewsItems(items);

export const selectNewsFeedItems = <TItem extends DedupeNewsItem>({
  items,
  limit,
}: {
  items: readonly TItem[];
  limit: number;
}): TItem[] => dedupeNewsItems(items).slice(0, limit);

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
        .orderBy(desc(NewsItem.trendScore), desc(NewsItem.publishedAt))
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
      let semanticFeedbackRefs: Pick<
        NewsSemanticVector,
        "newsItemId" | "occurredAt" | "strength"
      >[] = [];
      let viewedNewsItemIds: string[] = [];
      let viewedNewsItems: RecentExposureNewsItem[] = [];

      if (identity) {
        const [persistedProfile] = await ctx.db
          .select()
          .from(NewsReaderProfile)
          .where(eq(NewsReaderProfile.readerKey, identity.readerKey))
          .limit(1);

        profile = toPreferenceProfile(persistedProfile);

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
                category: NewsItem.category,
                entities: NewsItem.entities,
                metadata: NewsReaderInteraction.metadata,
                newsItemId: NewsReaderInteraction.newsItemId,
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
                category: row.category,
                entities: row.entities,
                newsItemId: row.newsItemId,
                occurredAt: row.occurredAt.toISOString(),
                sourceSlug: row.sourceSlug,
                tags: row.tags,
              },
            ];
          });
          positiveFeedbackItems = positiveFeedbackRows.map((row) => ({
            action:
              row.action === "click_source" ||
              row.action === "save" ||
              row.action === "share"
                ? row.action
                : undefined,
            category: row.category,
            entities: row.entities,
            occurredAt: row.occurredAt,
            sourceSlug: row.sourceSlug,
            tags: row.tags,
          }));
          semanticFeedbackRefs = positiveFeedbackRows.map((row) => ({
            newsItemId: row.newsItemId,
            occurredAt: row.occurredAt,
            strength: getNewsSemanticFeedbackStrength(row.action),
          }));
          viewedNewsItemIds = viewedRows.map((row) => row.newsItemId);
          viewedNewsItems = viewedRows.map((row) => {
            const metadata = NewsInteractionMetadataSchema.safeParse(
              row.metadata,
            );

            return {
              canonicalUrl: row.canonicalUrl,
              category: row.category,
              entities: row.entities,
              id: row.newsItemId,
              occurredAt: row.occurredAt.toISOString(),
              originalUrl: row.originalUrl,
              readPercent: metadata.success
                ? metadata.data.readPercent
                : undefined,
              sourceSlug: row.sourceSlug,
              surface: metadata.success ? metadata.data.surface : undefined,
              tags: row.tags,
              title: row.title,
            };
          });
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
        .where(publishedFeedConditions(input))
        .orderBy(desc(NewsItem.trendScore), desc(NewsItem.publishedAt))
        .limit(candidateLimit);

      const items = rows.map((row) => ({
        ...row,
        publishedAt: row.publishedAt.toISOString(),
      }));
      let collaborativeSignals: NewsCollaborativeSignal[] = [];
      let semanticMatches: NewsSemanticSimilarityMatch[] = [];

      if (items.length > 0) {
        const collaborativeSince = new Date(Date.now() - 7 * 24 * 3_600_000);
        const collaborativeRows = await ctx.db
          .select({
            deepReadCount: sql<number>`count(*) filter (where ${
              NewsReaderInteraction.action
            } = 'view' and ${
              NewsReaderInteraction.metadata
            }->>'surface' = 'article' and coalesce((${NewsReaderInteraction.metadata}->>'readPercent')::double precision, 0) >= 0.8)::int`,
            newsItemId: NewsReaderInteraction.newsItemId,
            saveCount: sql<number>`count(*) filter (where ${NewsReaderInteraction.action} = 'save')::int`,
            shareCount: sql<number>`count(*) filter (where ${NewsReaderInteraction.action} = 'share')::int`,
            sourceClickCount: sql<number>`count(*) filter (where ${NewsReaderInteraction.action} = 'click_source')::int`,
          })
          .from(NewsReaderInteraction)
          .innerJoin(
            NewsItem,
            eq(NewsReaderInteraction.newsItemId, NewsItem.id),
          )
          .where(
            compactConditions([
              inArray(
                NewsReaderInteraction.newsItemId,
                items.map((item) => item.id),
              ),
              eq(NewsItem.status, "published"),
              sql`${NewsReaderInteraction.occurredAt} >= ${collaborativeSince}`,
            ]),
          )
          .groupBy(NewsReaderInteraction.newsItemId);

        collaborativeSignals = collaborativeRows.flatMap((row) => {
          const score = getNewsCollaborativeSignalScore(row);

          return score > 0 ? [{ newsItemId: row.newsItemId, score }] : [];
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

        semanticMatches = buildNewsSemanticSimilarityMatches({
          candidateVectors: items.map((item) => ({
            embedding: latestEmbeddingByNewsItemId.get(item.id) ?? null,
            newsItemId: item.id,
          })),
          feedbackVectors: semanticFeedbackRefs.map((item) => ({
            ...item,
            embedding: latestEmbeddingByNewsItemId.get(item.newsItemId) ?? null,
          })),
        });
      }

      return selectNewsForYouItems({
        collaborativeSignals,
        hiddenNewsItemIds,
        hiddenNewsItems,
        items,
        limit: input.limit,
        negativeFeedbackItems,
        positiveFeedbackItems,
        profile,
        semanticMatches,
        viewedNewsItemIds,
        viewedNewsItems,
      });
    }),

  saved: publicProcedure
    .input(NewsSavedInputSchema)
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
          savedAt: NewsReaderInteraction.occurredAt,
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
            eq(NewsReaderInteraction.action, "save"),
            eq(NewsItem.status, "published"),
          ]),
        )
        .orderBy(desc(NewsReaderInteraction.occurredAt))
        .limit(input.limit * 3);

      return selectUniqueNewsCollectionItems(
        rows.map((row) => ({
          ...row,
          publishedAt: row.publishedAt.toISOString(),
          savedAt: row.savedAt.toISOString(),
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
          viewedAt: NewsReaderInteraction.occurredAt,
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
            eq(NewsReaderInteraction.action, "view"),
            meaningfulNewsArticleReadCondition(),
            eq(NewsItem.status, "published"),
          ]),
        )
        .orderBy(desc(NewsReaderInteraction.occurredAt))
        .limit(input.limit * 3);

      return selectUniqueNewsCollectionItems(
        rows.map((row) => ({
          ...row,
          publishedAt: row.publishedAt.toISOString(),
          viewedAt: row.viewedAt.toISOString(),
        })),
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

      await ctx.db.insert(NewsReaderInteraction).values({
        action: input.action,
        metadata: input.metadata ?? {},
        newsItemId: input.newsItemId,
        readerProfileId: profile.id,
      });

      return {
        ...toPreferenceProfile(profile),
        persisted: true,
      };
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

      return {
        ...toPreferenceProfile(profile),
        persisted: true,
      };
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

      return {
        ...toPreferenceProfile(profile),
        persisted: true,
      };
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
          originalUrl: NewsItem.originalUrl,
          publishedAt: NewsItem.publishedAt,
          category: NewsItem.category,
          tags: NewsItem.tags,
          entities: NewsItem.entities,
          sourceScore: NewsItem.sourceScore,
          trendScore: NewsItem.trendScore,
          embeddingStatus: NewsItem.embeddingStatus,
          source: {
            name: NewsSource.name,
            slug: NewsSource.slug,
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
