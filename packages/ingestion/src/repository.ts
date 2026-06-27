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
    const result = await db
      .insert(NewsItem)
      .values(item)
      .onConflictDoNothing({ target: NewsItem.dedupeKey })
      .returning({ id: NewsItem.id });

    return result.length > 0 ? "created" : "duplicate";
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
