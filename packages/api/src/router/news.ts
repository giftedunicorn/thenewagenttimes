import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import type { SQL } from "@acme/db";
import type { NewsPreferenceProfile } from "@acme/validators";
import { and, desc, eq, ilike, lt, or, sql } from "@acme/db";
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
  filterHiddenNewsItems,
  rankNewsForReader,
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

export const NewsForYouInputSchema = NewsFeedInputSchema.extend({
  visitorKey: optionalVisitorKey,
});

export const NewsRecordInteractionInputSchema = z.object({
  visitorKey: optionalVisitorKey,
  newsItemId: z.string().uuid(),
  action: NewsReaderInteractionActionSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

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

const textSearchCondition = (
  query: string | undefined,
): SQL<unknown> | undefined => {
  if (!query) return undefined;

  const pattern = `%${query}%`;

  return or(
    ilike(NewsItem.title, pattern),
    ilike(NewsItem.summary, pattern),
    sql`exists (select 1 from unnest(${NewsItem.entities}) as entity where entity ilike ${pattern})`,
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
    textSearchCondition(input.q),
  ]);

const searchCandidateConditions = (
  input: NewsSearchCandidatesInput,
): SQL<unknown> | undefined =>
  compactConditions([
    eq(NewsItem.status, "published"),
    input.category ? eq(NewsItem.category, input.category) : undefined,
    textSearchCondition(input.q),
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

const clampBias = (value: number) => Math.min(Math.max(value, 0), 2);

const toPreferenceProfile = (
  row: NewsReaderProfileRow | null | undefined,
): NewsPreferenceProfile => {
  if (!row) return defaultNewsPreferenceProfile;

  return {
    preferredCategories: row.preferredCategories,
    preferredSources: row.preferredSources,
    preferredEntities: row.preferredEntities,
    noveltyBias: clampBias(row.noveltyBias),
    recencyBias: clampBias(row.recencyBias),
  };
};

export const newsRouter = {
  feed: publicProcedure.input(NewsFeedInputSchema).query(({ ctx, input }) => {
    return ctx.db
      .select({
        id: NewsItem.id,
        title: NewsItem.title,
        summary: NewsItem.summary,
        canonicalUrl: NewsItem.canonicalUrl,
        imageUrl: NewsItem.imageUrl,
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
      .limit(input.limit);
  }),

  profile: publicProcedure
    .input(NewsReaderProfileInputSchema)
    .query(async ({ ctx, input }) => {
      const identity = resolveReaderIdentity(
        ctx.session?.user.id,
        input.visitorKey,
      );

      if (!identity) {
        return {
          ...defaultNewsPreferenceProfile,
          persisted: false,
        };
      }

      const [profile] = await ctx.db
        .select()
        .from(NewsReaderProfile)
        .where(eq(NewsReaderProfile.readerKey, identity.readerKey))
        .limit(1);

      return {
        ...toPreferenceProfile(profile),
        persisted: Boolean(profile),
      };
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

      if (identity) {
        const [persistedProfile] = await ctx.db
          .select()
          .from(NewsReaderProfile)
          .where(eq(NewsReaderProfile.readerKey, identity.readerKey))
          .limit(1);

        profile = toPreferenceProfile(persistedProfile);

        if (persistedProfile) {
          const hiddenRows = await ctx.db
            .select({
              newsItemId: NewsReaderInteraction.newsItemId,
            })
            .from(NewsReaderInteraction)
            .where(
              compactConditions([
                eq(NewsReaderInteraction.readerProfileId, persistedProfile.id),
                eq(NewsReaderInteraction.action, "hide"),
              ]),
            )
            .orderBy(desc(NewsReaderInteraction.occurredAt))
            .limit(500);

          hiddenNewsItemIds = hiddenRows.map((row) => row.newsItemId);
        }
      }

      const candidateLimit = Math.min(input.limit * 3, 100);
      const rows = await ctx.db
        .select({
          id: NewsItem.id,
          title: NewsItem.title,
          summary: NewsItem.summary,
          canonicalUrl: NewsItem.canonicalUrl,
          imageUrl: NewsItem.imageUrl,
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

      const recommendableRows = filterHiddenNewsItems(
        rows.map((row) => ({
          ...row,
          publishedAt: row.publishedAt.toISOString(),
        })),
        hiddenNewsItemIds,
      );

      return rankNewsForReader(recommendableRows, profile).slice(
        0,
        input.limit,
      );
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

      const nextProfile = updateReaderProfileWithInteraction(
        toPreferenceProfile(existingProfile),
        {
          ...item,
          publishedAt: item.publishedAt.toISOString(),
        },
        { action: input.action },
      );

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
          preferredCategories: input.profile.preferredCategories,
          preferredSources: input.profile.preferredSources,
          preferredEntities: input.profile.preferredEntities,
          noveltyBias: input.profile.noveltyBias,
          recencyBias: input.profile.recencyBias,
        })
        .onConflictDoUpdate({
          target: NewsReaderProfile.readerKey,
          set: {
            userId: identity.userId,
            preferredCategories: input.profile.preferredCategories,
            preferredSources: input.profile.preferredSources,
            preferredEntities: input.profile.preferredEntities,
            noveltyBias: input.profile.noveltyBias,
            recencyBias: input.profile.recencyBias,
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

  searchCandidates: publicProcedure
    .input(NewsSearchCandidatesInputSchema)
    .query(({ ctx, input }) => {
      return ctx.db
        .select({
          id: NewsItem.id,
          title: NewsItem.title,
          summary: NewsItem.summary,
          canonicalUrl: NewsItem.canonicalUrl,
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
        .limit(input.limit);
    }),
} satisfies TRPCRouterRecord;
