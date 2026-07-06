import type { db as dbClient } from "@acme/db/client";
import { and, eq, inArray } from "@acme/db";
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

type DbClient = typeof dbClient;

let cachedDbClient: DbClient | null = null;

const getDbClient = async () => {
  cachedDbClient ??= (await import("@acme/db/client")).db;
  return cachedDbClient;
};

export interface NewsItemRefreshUpdateValues {
  authorName: string | null;
  bodyText: string | null;
  category: NewsItemInput["category"];
  clusterKey: string;
  entities: string[];
  imageUrl: string | null;
  language: string;
  originalUrl: string;
  publishedAt: Date;
  sourceScore: number;
  status: NonNullable<NewsItemInput["status"]>;
  summary: string;
  tags: string[];
  title: string;
  trendScore: number;
}

export type NewsItemRefreshDbUpdateValues = NewsItemRefreshUpdateValues & {
  embeddingStatus?: "pending";
};

export const getNewsItemRefreshUpdateValues = (
  item: NewsItemInput,
): NewsItemRefreshUpdateValues => ({
  authorName: item.authorName ?? null,
  bodyText: item.bodyText ?? null,
  category: item.category,
  clusterKey: item.clusterKey,
  entities: item.entities ?? [],
  imageUrl: item.imageUrl ?? null,
  language: item.language ?? "en",
  originalUrl: item.originalUrl,
  publishedAt: item.publishedAt,
  sourceScore: item.sourceScore ?? 50,
  status: item.status ?? "published",
  summary: item.summary,
  tags: item.tags ?? [],
  title: item.title,
  trendScore: item.trendScore ?? 0,
});

export const getNewsItemRefreshDbUpdateValues = (
  item: NewsItemInput,
  options: { resetEmbedding?: boolean } = {},
): NewsItemRefreshDbUpdateValues => ({
  ...getNewsItemRefreshUpdateValues(item),
  ...((options.resetEmbedding ?? true)
    ? ({ embeddingStatus: "pending" } as const)
    : {}),
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
  existing.clusterKey !== incoming.clusterKey ||
  !areStringArraysEqual(existing.entities, incoming.entities) ||
  existing.imageUrl !== incoming.imageUrl ||
  existing.language !== incoming.language ||
  existing.publishedAt.getTime() !== incoming.publishedAt.getTime() ||
  existing.sourceScore !== incoming.sourceScore ||
  existing.status !== incoming.status ||
  existing.summary !== incoming.summary ||
  !areStringArraysEqual(existing.tags, incoming.tags) ||
  existing.title !== incoming.title ||
  existing.trendScore !== incoming.trendScore;

export const shouldResetNewsItemEmbeddingFromRefresh = (
  existing: NewsItemRefreshUpdateValues,
  incoming: NewsItemRefreshUpdateValues,
) =>
  existing.bodyText !== incoming.bodyText ||
  existing.category !== incoming.category ||
  !areStringArraysEqual(existing.entities, incoming.entities) ||
  existing.summary !== incoming.summary ||
  !areStringArraysEqual(existing.tags, incoming.tags) ||
  existing.title !== incoming.title;

export const getIngestionRunFinishUpdateValues = (
  input: Parameters<NewsRepository["finishIngestionRun"]>[0],
) => ({
  status: input.status,
  finishedAt: new Date(),
  itemsSeen: input.itemsSeen,
  itemsCreated: input.itemsCreated,
  itemsUpdated: input.itemsUpdated,
  errorMessage: input.errorMessage,
  ...(input.metadata ? { metadata: input.metadata } : {}),
});

export const buildEmbeddingQueueCondition = () =>
  inArray(NewsItem.embeddingStatus, ["pending", "failed"]);

export const createDbNewsRepository = (): NewsRepository => ({
  async seedSources(sources: NewsSourceInput[]) {
    const db = await getDbClient();
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
    const db = await getDbClient();
    const [source] = await db
      .select({
        credibility: NewsSource.credibility,
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
    const db = await getDbClient();
    const [run] = await db
      .insert(IngestionRun)
      .values({
        sourceId: input.sourceId ?? null,
        runType: input.runType,
        status: "running",
      })
      .returning({ id: IngestionRun.id });

    if (!run) throw new Error("Failed to create ingestion run");
    return run;
  },

  async finishIngestionRun(input) {
    const db = await getDbClient();
    await db
      .update(IngestionRun)
      .set(getIngestionRunFinishUpdateValues(input))
      .where(eq(IngestionRun.id, input.runId));
  },

  async upsertNewsItem(item: NewsItemInput) {
    const db = await getDbClient();
    const updateValues = getNewsItemRefreshUpdateValues(item);
    const [existing] = await db
      .select({
        authorName: NewsItem.authorName,
        bodyText: NewsItem.bodyText,
        category: NewsItem.category,
        clusterKey: NewsItem.clusterKey,
        entities: NewsItem.entities,
        id: NewsItem.id,
        imageUrl: NewsItem.imageUrl,
        language: NewsItem.language,
        originalUrl: NewsItem.originalUrl,
        publishedAt: NewsItem.publishedAt,
        sourceScore: NewsItem.sourceScore,
        status: NewsItem.status,
        summary: NewsItem.summary,
        tags: NewsItem.tags,
        title: NewsItem.title,
        trendScore: NewsItem.trendScore,
      })
      .from(NewsItem)
      .where(eq(NewsItem.canonicalUrl, item.canonicalUrl))
      .limit(1);

    if (existing) {
      if (!shouldUpdateNewsItemFromRefresh(existing, updateValues)) {
        return "duplicate";
      }

      const resetEmbedding = shouldResetNewsItemEmbeddingFromRefresh(
        existing,
        updateValues,
      );

      await db
        .update(NewsItem)
        .set(getNewsItemRefreshDbUpdateValues(item, { resetEmbedding }))
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
    const db = await getDbClient();
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
      .where(buildEmbeddingQueueCondition())
      .limit(limit);
  },

  async insertNewsItemVector(
    vector: NewsItemVectorInput & { newsItemId: string },
  ) {
    const db = await getDbClient();
    await db.insert(NewsItemVector).values(vector).onConflictDoNothing();
  },

  async updateEmbeddingStatus(newsItemId, status) {
    const db = await getDbClient();
    await db
      .update(NewsItem)
      .set({ embeddingStatus: status })
      .where(eq(NewsItem.id, newsItemId));
  },
});
