import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import type { SQL } from "@acme/db";
import { and, desc, eq, ilike, lt, or, sql } from "@acme/db";
import {
  NewsCategorySchema,
  NewsItem,
  NewsItemVector,
  NewsSignal,
  NewsSource,
} from "@acme/db/schema";

import { publicProcedure } from "../trpc";

const optionalTrimmedString = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength).optional();

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

type NewsFeedInput = z.infer<typeof NewsFeedInputSchema>;
type NewsSearchCandidatesInput = z.infer<
  typeof NewsSearchCandidatesInputSchema
>;

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
