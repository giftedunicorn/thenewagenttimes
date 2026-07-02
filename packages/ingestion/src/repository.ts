import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import {
  IngestionRun,
  NewsItem,
  NewsItemVector,
  NewsSource,
} from "@acme/db/schema";

import type {
  NewsItemInput,
  NewsItemVectorInput,
  NewsRepository,
  NewsSourceInput,
} from "./types";

export interface NewsItemRefreshUpdateValues {
  authorName: string | null;
  bodyText: string | null;
  category: NewsItemInput["category"];
  entities: string[];
  imageUrl: string | null;
  language: string;
  originalUrl: string;
  publishedAt: Date;
  status: NonNullable<NewsItemInput["status"]>;
  summary: string;
  tags: string[];
  title: string;
}

export type NewsItemRefreshDbUpdateValues = NewsItemRefreshUpdateValues & {
  embeddingStatus: "pending";
};

export const getNewsItemRefreshUpdateValues = (
  item: NewsItemInput,
): NewsItemRefreshUpdateValues => ({
  authorName: item.authorName ?? null,
  bodyText: item.bodyText ?? null,
  category: item.category,
  entities: item.entities ?? [],
  imageUrl: item.imageUrl ?? null,
  language: item.language ?? "en",
  originalUrl: item.originalUrl,
  publishedAt: item.publishedAt,
  status: item.status ?? "published",
  summary: item.summary,
  tags: item.tags ?? [],
  title: item.title,
});

export const getNewsItemRefreshDbUpdateValues = (
  item: NewsItemInput,
): NewsItemRefreshDbUpdateValues => ({
  ...getNewsItemRefreshUpdateValues(item),
  embeddingStatus: "pending",
});

const areStringArraysEqual = (
  left: readonly string[],
  right: readonly string[],
) =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

export const shouldUpdateNewsItemFromRefresh = (
  existing: NewsItemRefreshUpdateValues,
  incoming: NewsItemRefreshUpdateValues,
) =>
  existing.authorName !== incoming.authorName ||
  existing.bodyText !== incoming.bodyText ||
  existing.category !== incoming.category ||
  !areStringArraysEqual(existing.entities, incoming.entities) ||
  existing.imageUrl !== incoming.imageUrl ||
  existing.language !== incoming.language ||
  existing.publishedAt.getTime() !== incoming.publishedAt.getTime() ||
  existing.status !== incoming.status ||
  existing.summary !== incoming.summary ||
  !areStringArraysEqual(existing.tags, incoming.tags) ||
  existing.title !== incoming.title;

export const createDbNewsRepository = (): NewsRepository => ({
  async seedSources(sources: NewsSourceInput[]) {
    let created = 0;

    for (const source of sources) {
      await db
        .insert(NewsSource)
        .values(source)
        .onConflictDoUpdate({
          target: NewsSource.slug,
          set: {
            name: source.name,
            homepageUrl: source.homepageUrl,
            feedUrl: source.feedUrl,
            sourceType: source.sourceType,
            credibility: source.credibility,
            isActive: source.isActive,
          },
        });
      created += 1;
    }

    return { created };
  },

  async findSourceBySlug(slug: string) {
    const [source] = await db
      .select({
        id: NewsSource.id,
        slug: NewsSource.slug,
        feedUrl: NewsSource.feedUrl,
      })
      .from(NewsSource)
      .where(and(eq(NewsSource.slug, slug), eq(NewsSource.isActive, true)))
      .limit(1);

    return source ?? null;
  },

  async startIngestionRun(input) {
    const [run] = await db
      .insert(IngestionRun)
      .values({
        sourceId: input.sourceId,
        runType: input.runType,
        status: "running",
      })
      .returning({ id: IngestionRun.id });

    if (!run) throw new Error("Failed to create ingestion run");
    return run;
  },

  async finishIngestionRun(input) {
    await db
      .update(IngestionRun)
      .set({
        status: input.status,
        finishedAt: new Date(),
        itemsSeen: input.itemsSeen,
        itemsCreated: input.itemsCreated,
        itemsUpdated: input.itemsUpdated,
        errorMessage: input.errorMessage,
      })
      .where(eq(IngestionRun.id, input.runId));
  },

  async upsertNewsItem(item: NewsItemInput) {
    const updateValues = getNewsItemRefreshUpdateValues(item);
    const [existing] = await db
      .select({
        authorName: NewsItem.authorName,
        bodyText: NewsItem.bodyText,
        category: NewsItem.category,
        entities: NewsItem.entities,
        id: NewsItem.id,
        imageUrl: NewsItem.imageUrl,
        language: NewsItem.language,
        originalUrl: NewsItem.originalUrl,
        publishedAt: NewsItem.publishedAt,
        status: NewsItem.status,
        summary: NewsItem.summary,
        tags: NewsItem.tags,
        title: NewsItem.title,
      })
      .from(NewsItem)
      .where(eq(NewsItem.canonicalUrl, item.canonicalUrl))
      .limit(1);

    if (existing) {
      if (!shouldUpdateNewsItemFromRefresh(existing, updateValues)) {
        return "duplicate";
      }

      await db
        .update(NewsItem)
        .set(getNewsItemRefreshDbUpdateValues(item))
        .where(eq(NewsItem.id, existing.id));

      return "updated";
    }

    const result = await db
      .insert(NewsItem)
      .values(item)
      .onConflictDoNothing()
      .returning({ id: NewsItem.id });

    if (result.length > 0) return "created";

    const updatedRows = await db
      .update(NewsItem)
      .set(getNewsItemRefreshDbUpdateValues(item))
      .where(eq(NewsItem.canonicalUrl, item.canonicalUrl))
      .returning({ id: NewsItem.id });

    return updatedRows.length > 0 ? "updated" : "duplicate";
  },

  async findPendingEmbeddingItems(limit: number) {
    return db
      .select({
        id: NewsItem.id,
        title: NewsItem.title,
        summary: NewsItem.summary,
        bodyText: NewsItem.bodyText,
        category: NewsItem.category,
        tags: NewsItem.tags,
        entities: NewsItem.entities,
      })
      .from(NewsItem)
      .where(eq(NewsItem.embeddingStatus, "pending"))
      .limit(limit);
  },

  async insertNewsItemVector(
    vector: NewsItemVectorInput & { newsItemId: string },
  ) {
    await db.insert(NewsItemVector).values(vector).onConflictDoNothing();
  },

  async updateEmbeddingStatus(newsItemId, status) {
    await db
      .update(NewsItem)
      .set({ embeddingStatus: status })
      .where(eq(NewsItem.id, newsItemId));
  },
});
