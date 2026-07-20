import type { SQL } from "drizzle-orm";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod/v4";

import {
  newsCategoryValues,
  newsEmbeddingStatusValues,
  NewsItem,
  NewsSource,
  newsStatusValues,
} from "@acme/db/schema";

import { adminProcedure, createTRPCRouter } from "./trpc";

export const contentListInput = z.strictObject({
  category: z.enum(newsCategoryValues).optional(),
  embeddingStatus: z.enum(newsEmbeddingStatusValues).optional(),
  page: z.number().int().nonnegative().default(0),
  pageSize: z.number().int().min(1).max(50).default(20),
  search: z.string().trim().min(1).max(160).optional(),
  sourceId: z.string().uuid().optional(),
  status: z.enum(newsStatusValues).optional(),
});

export const contentRouter = createTRPCRouter({
  byId: adminProcedure
    .input(z.strictObject({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          authorName: NewsItem.authorName,
          canonicalUrl: NewsItem.canonicalUrl,
          category: NewsItem.category,
          clusterKey: NewsItem.clusterKey,
          collectedAt: NewsItem.collectedAt,
          dedupeKey: NewsItem.dedupeKey,
          embeddingStatus: NewsItem.embeddingStatus,
          entities: NewsItem.entities,
          id: NewsItem.id,
          imageUrl: NewsItem.imageUrl,
          language: NewsItem.language,
          originalUrl: NewsItem.originalUrl,
          publishedAt: NewsItem.publishedAt,
          sourceId: NewsItem.sourceId,
          sourceName: NewsSource.name,
          status: NewsItem.status,
          summary: NewsItem.summary,
          tags: NewsItem.tags,
          title: NewsItem.title,
        })
        .from(NewsItem)
        .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
        .where(eq(NewsItem.id, input.id))
        .limit(1);
      const row = rows[0];
      if (!row) return null;

      return {
        ...row,
        collectedAt: row.collectedAt.toISOString(),
        publishedAt: row.publishedAt.toISOString(),
      };
    }),
  list: adminProcedure.input(contentListInput).query(async ({ ctx, input }) => {
    const conditions: SQL[] = [];
    if (input.status) conditions.push(eq(NewsItem.status, input.status));
    if (input.category) {
      conditions.push(eq(NewsItem.category, input.category));
    }
    if (input.embeddingStatus) {
      conditions.push(eq(NewsItem.embeddingStatus, input.embeddingStatus));
    }
    if (input.sourceId) {
      conditions.push(eq(NewsItem.sourceId, input.sourceId));
    }
    if (input.search) {
      const search = `%${input.search}%`;
      const searchCondition = or(
        ilike(NewsItem.title, search),
        ilike(NewsItem.canonicalUrl, search),
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countRows] = await Promise.all([
      ctx.db
        .select({
          canonicalUrl: NewsItem.canonicalUrl,
          category: NewsItem.category,
          collectedAt: NewsItem.collectedAt,
          embeddingStatus: NewsItem.embeddingStatus,
          id: NewsItem.id,
          publishedAt: NewsItem.publishedAt,
          sourceId: NewsItem.sourceId,
          sourceName: NewsSource.name,
          sourceScore: NewsItem.sourceScore,
          status: NewsItem.status,
          title: NewsItem.title,
          trendScore: NewsItem.trendScore,
        })
        .from(NewsItem)
        .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
        .where(where)
        .orderBy(desc(NewsItem.collectedAt))
        .limit(input.pageSize)
        .offset(input.page * input.pageSize),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(NewsItem)
        .where(where),
    ]);

    return {
      items: rows.map((row) => ({
        ...row,
        collectedAt: row.collectedAt.toISOString(),
        publishedAt: row.publishedAt.toISOString(),
      })),
      total: countRows[0]?.count ?? 0,
    };
  }),
});
