import { and, desc, eq, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { NewsItem, NewsSource } from "@acme/db/schema";

import type { NewsHomeItem, NewsHomeStatus } from "../_components/news-home";

export type { NewsHomeItem } from "../_components/news-home";

export interface NewsArticleItem extends NewsHomeItem {
  bodyText: string | null;
  originalUrl: string;
  authorName: string | null;
  collectedAt: string;
}

interface NewsHomeData {
  items: NewsHomeItem[];
  status: NewsHomeStatus;
}

export const getNewsHomeData = async (): Promise<NewsHomeData> => {
  try {
    const rows = await db
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
      .limit(30);

    return {
      items: rows.map((row) => ({
        ...row,
        publishedAt: row.publishedAt.toISOString(),
      })),
      status: rows.length > 0 ? "ready" : "empty",
    };
  } catch (error: unknown) {
    console.error(
      "Unable to load news homepage data",
      error instanceof Error ? error.message : String(error),
    );

    return {
      items: [],
      status: "unavailable",
    };
  }
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
