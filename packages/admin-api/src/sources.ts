import { desc, sql } from "drizzle-orm";

import { IngestionRun, NewsItem, NewsSource } from "@acme/db/schema";

import { adminProcedure, createTRPCRouter } from "./trpc";

const SOURCE_STALE_MS = 72 * 60 * 60 * 1_000;

interface SourceStatusInput {
  feedUrl: string | null;
  isActive: boolean;
  latestCollectedAt: string | null;
  latestIngestionStatus: string | null;
  sourceType: string;
  storyCount: number;
}

export type SourceStatus = "critical" | "degraded" | "healthy" | "inactive";

export const deriveSourceStatus = (
  source: SourceStatusInput,
  now = new Date(),
): SourceStatus => {
  if (!source.isActive) return "inactive";
  if (source.sourceType === "rss" && !source.feedUrl) return "critical";
  if (source.latestIngestionStatus === "failed") return "critical";
  if (source.storyCount === 0 || !source.latestCollectedAt) return "degraded";
  if (
    now.getTime() - new Date(source.latestCollectedAt).getTime() >
    SOURCE_STALE_MS
  ) {
    return "degraded";
  }
  if (source.latestIngestionStatus === "partial") return "degraded";
  return "healthy";
};

export const sourcesRouter = createTRPCRouter({
  list: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const [sources, contentAggregates, latestIngestions] = await Promise.all([
      ctx.db.select().from(NewsSource).orderBy(NewsSource.name),
      ctx.db
        .select({
          latestCollectedAt: sql<Date | null>`max(${NewsItem.collectedAt})`,
          sourceId: NewsItem.sourceId,
          storyCount: sql<number>`count(*)::int`,
        })
        .from(NewsItem)
        .groupBy(NewsItem.sourceId),
      ctx.db
        .selectDistinctOn([IngestionRun.sourceId], {
          sourceId: IngestionRun.sourceId,
          startedAt: IngestionRun.startedAt,
          status: IngestionRun.status,
        })
        .from(IngestionRun)
        .where(sql`${IngestionRun.sourceId} is not null`)
        .orderBy(IngestionRun.sourceId, desc(IngestionRun.startedAt)),
    ]);

    const contentBySource = new Map(
      contentAggregates.map((aggregate) => [aggregate.sourceId, aggregate]),
    );
    const ingestionBySource = new Map(
      latestIngestions.flatMap((ingestion) =>
        ingestion.sourceId ? [[ingestion.sourceId, ingestion] as const] : [],
      ),
    );

    return {
      items: sources.map((source) => {
        const content = contentBySource.get(source.id);
        const ingestion = ingestionBySource.get(source.id);
        const statusInput: SourceStatusInput = {
          feedUrl: source.feedUrl,
          isActive: source.isActive,
          latestCollectedAt: content?.latestCollectedAt?.toISOString() ?? null,
          latestIngestionStatus: ingestion?.status ?? null,
          sourceType: source.sourceType,
          storyCount: content?.storyCount ?? 0,
        };

        return {
          createdAt: source.createdAt.toISOString(),
          credibility: source.credibility,
          feedUrl: source.feedUrl,
          homepageUrl: source.homepageUrl,
          id: source.id,
          isActive: source.isActive,
          latestCollectedAt: statusInput.latestCollectedAt,
          latestIngestionAt: ingestion?.startedAt.toISOString() ?? null,
          latestIngestionStatus: statusInput.latestIngestionStatus,
          name: source.name,
          slug: source.slug,
          sourceType: source.sourceType,
          status: deriveSourceStatus(statusInput, now),
          storyCount: statusInput.storyCount,
        };
      }),
    };
  }),
});
