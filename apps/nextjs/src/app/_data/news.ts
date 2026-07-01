import { and, desc, eq, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { IngestionRun, NewsItem, NewsSource } from "@acme/db/schema";

import type {
  NewsDeskStatus,
  NewsHomeItem,
  NewsHomeStatus,
} from "../_components/news-home-model";
import { buildNewsDeskStatus } from "../_components/news-home-model";

export type {
  NewsDeskStatus,
  NewsHomeItem,
} from "../_components/news-home-model";

export interface NewsArticleItem extends NewsHomeItem {
  bodyText: string | null;
  originalUrl: string;
  authorName: string | null;
  collectedAt: string;
}

interface NewsHomeData {
  items: NewsHomeItem[];
  status: NewsHomeStatus;
  deskStatus: NewsDeskStatus;
}

export const getNewsHomeData = async (): Promise<NewsHomeData> => {
  try {
    const [rows, deskStatus] = await Promise.all([
      db
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
        .where(eq(NewsItem.status, "published"))
        .orderBy(desc(NewsItem.trendScore), desc(NewsItem.publishedAt))
        .limit(30),
      getNewsDeskStatus(),
    ]);

    return {
      items: rows.map((row) => ({
        ...row,
        publishedAt: row.publishedAt.toISOString(),
      })),
      status: rows.length > 0 ? "ready" : "empty",
      deskStatus,
    };
  } catch (error: unknown) {
    console.error(
      "Unable to load news homepage data",
      error instanceof Error ? error.message : String(error),
    );

    return {
      items: [],
      status: "unavailable",
      deskStatus: getUnavailableNewsDeskStatus(),
    };
  }
};

const getUnavailableNewsDeskStatus = () =>
  buildNewsDeskStatus({
    activeSources: 0,
    totalSources: 0,
    publishedStories: 0,
    latestPublishedAt: null,
    latestRun: null,
    unavailable: true,
  });

const getNewsDeskStatus = async (): Promise<NewsDeskStatus> => {
  const [sourceCounts, itemCounts, latestRuns] = await Promise.all([
    db
      .select({
        totalSources: sql<number>`count(*)::int`,
        activeSources: sql<number>`count(*) filter (where ${NewsSource.isActive})::int`,
      })
      .from(NewsSource),
    db
      .select({
        publishedStories: sql<number>`count(*)::int`,
        latestPublishedAt: sql<Date | null>`max(${NewsItem.publishedAt})`,
      })
      .from(NewsItem)
      .where(eq(NewsItem.status, "published")),
    db
      .select({
        sourceName: NewsSource.name,
        status: IngestionRun.status,
        runType: IngestionRun.runType,
        startedAt: IngestionRun.startedAt,
        finishedAt: IngestionRun.finishedAt,
        itemsSeen: IngestionRun.itemsSeen,
        itemsCreated: IngestionRun.itemsCreated,
        itemsUpdated: IngestionRun.itemsUpdated,
        errorMessage: IngestionRun.errorMessage,
      })
      .from(IngestionRun)
      .leftJoin(NewsSource, eq(IngestionRun.sourceId, NewsSource.id))
      .orderBy(desc(IngestionRun.startedAt))
      .limit(1),
  ]);
  const sourceCount = sourceCounts[0];
  const itemCount = itemCounts[0];
  const latestRun = latestRuns[0];

  return buildNewsDeskStatus({
    activeSources: sourceCount?.activeSources ?? 0,
    totalSources: sourceCount?.totalSources ?? 0,
    publishedStories: itemCount?.publishedStories ?? 0,
    latestPublishedAt: itemCount?.latestPublishedAt?.toISOString() ?? null,
    latestRun: latestRun
      ? {
          ...latestRun,
          startedAt: latestRun.startedAt.toISOString(),
          finishedAt: latestRun.finishedAt?.toISOString() ?? null,
        }
      : null,
  });
};

export const getNewsArticleData = async (
  id: string,
): Promise<{
  article: NewsArticleItem | null;
  related: NewsHomeItem[];
}> => {
  try {
    const [article] = await db
      .select({
        id: NewsItem.id,
        title: NewsItem.title,
        summary: NewsItem.summary,
        bodyText: NewsItem.bodyText,
        canonicalUrl: NewsItem.canonicalUrl,
        originalUrl: NewsItem.originalUrl,
        imageUrl: NewsItem.imageUrl,
        authorName: NewsItem.authorName,
        publishedAt: NewsItem.publishedAt,
        collectedAt: NewsItem.collectedAt,
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
      .where(and(eq(NewsItem.id, id), eq(NewsItem.status, "published")))
      .limit(1);

    if (!article) {
      return { article: null, related: [] };
    }

    const relatedRows = await db
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
      .where(
        sql`${NewsItem.status} = 'published' and ${NewsItem.id} <> ${id} and (${NewsItem.category} = ${article.category} or ${NewsItem.entities} && ${article.entities})`,
      )
      .orderBy(desc(NewsItem.trendScore), desc(NewsItem.publishedAt))
      .limit(8);

    return {
      article: {
        ...article,
        publishedAt: article.publishedAt.toISOString(),
        collectedAt: article.collectedAt.toISOString(),
      },
      related: relatedRows.map((row) => ({
        ...row,
        publishedAt: row.publishedAt.toISOString(),
      })),
    };
  } catch (error: unknown) {
    console.error(
      "Unable to load news article data",
      error instanceof Error ? error.message : String(error),
    );

    return { article: null, related: [] };
  }
};
