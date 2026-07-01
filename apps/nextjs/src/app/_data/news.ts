import { desc, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { NewsItem, NewsSource } from "@acme/db/schema";

import type { NewsHomeItem, NewsHomeStatus } from "../_components/news-home";

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
