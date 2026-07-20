import { desc, gte, sql } from "drizzle-orm";

import {
  BackgroundJob,
  IngestionRun,
  NewsItem,
  NewsSource,
} from "@acme/db/schema";

import { adminProcedure, createTRPCRouter } from "./trpc";

const NEWS_FRESHNESS_MS = 72 * 60 * 60 * 1_000;
const DUE_JOB_GRACE_MS = 2 * 60 * 60 * 1_000;

export interface OverviewSnapshot {
  activeSourceCount: number;
  daily: {
    collected: number;
    date: string;
    failedIngestions: number;
    succeededIngestions: number;
  }[];
  ingestion: {
    finishedAt: string | null;
    itemsCreated: number;
    itemsSeen: number;
    itemsUpdated: number;
    startedAt: string;
    status: string;
  } | null;
  jobs: {
    expiredLeaseCount: number;
    failed: number;
    oldestDueQueuedAt: string | null;
    queued: number;
    running: number;
    succeeded: number;
  };
  news: {
    collected24h: number;
    embeddedPublishedTotal: number;
    latestPublishedAt: string | null;
    published24h: number;
    publishedTotal: number;
  };
  sourceCount: number;
}

export interface OverviewFinding {
  code:
    | "expired-job-lease"
    | "failed-ingestion"
    | "no-content"
    | "overdue-jobs"
    | "stale-content"
    | "terminal-jobs";
  message: string;
  severity: "critical" | "warning";
}

export interface OverviewHealth {
  findings: OverviewFinding[];
  state: "critical" | "degraded" | "healthy";
}

const toIso = (value: Date | string | null) => {
  if (value === null) return null;
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
};

export const buildOverviewHealth = (
  snapshot: OverviewSnapshot,
  now = new Date(),
): OverviewHealth => {
  const findings: OverviewFinding[] = [];
  const latestPublishedAt = snapshot.news.latestPublishedAt
    ? new Date(snapshot.news.latestPublishedAt).getTime()
    : null;

  if (latestPublishedAt === null) {
    findings.push({
      code: "no-content",
      message: "No published content is available.",
      severity: "warning",
    });
  } else if (now.getTime() - latestPublishedAt > NEWS_FRESHNESS_MS) {
    findings.push({
      code: "stale-content",
      message: "The latest published story is more than 72 hours old.",
      severity: "critical",
    });
  }

  if (snapshot.jobs.failed > 0) {
    findings.push({
      code: "terminal-jobs",
      message: `${snapshot.jobs.failed} background jobs have failed.`,
      severity: "warning",
    });
  }

  if (snapshot.jobs.expiredLeaseCount > 0) {
    findings.push({
      code: "expired-job-lease",
      message: `${snapshot.jobs.expiredLeaseCount} running jobs have expired leases.`,
      severity: "critical",
    });
  }

  const oldestDueQueuedAt = snapshot.jobs.oldestDueQueuedAt
    ? new Date(snapshot.jobs.oldestDueQueuedAt).getTime()
    : null;
  if (
    oldestDueQueuedAt !== null &&
    now.getTime() - oldestDueQueuedAt > DUE_JOB_GRACE_MS
  ) {
    findings.push({
      code: "overdue-jobs",
      message: "At least one due job has remained queued for over two hours.",
      severity: "warning",
    });
  }

  if (
    snapshot.ingestion?.status === "failed" ||
    snapshot.ingestion?.status === "partial"
  ) {
    findings.push({
      code: "failed-ingestion",
      message: `The latest ingestion run ended with status ${snapshot.ingestion.status}.`,
      severity: "warning",
    });
  }

  findings.sort((left, right) =>
    left.severity === right.severity
      ? left.code.localeCompare(right.code)
      : left.severity === "critical"
        ? -1
        : 1,
  );

  return {
    findings,
    state: findings.some(({ severity }) => severity === "critical")
      ? "critical"
      : findings.length > 0
        ? "degraded"
        : "healthy",
  };
};

export const overviewRouter = createTRPCRouter({
  get: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
    const sevenDaysAgo = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6),
    );

    const [
      sourceRows,
      newsRows,
      ingestionRows,
      jobRows,
      newsDailyRows,
      ingestionDailyRows,
    ] = await Promise.all([
      ctx.db
        .select({
          activeCount: sql<number>`count(*) filter (where ${NewsSource.isActive})::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(NewsSource),
      ctx.db
        .select({
          collected24h: sql<number>`count(*) filter (where ${NewsItem.collectedAt} >= ${oneDayAgo})::int`,
          embeddedPublishedTotal: sql<number>`count(*) filter (where ${NewsItem.status} = 'published' and ${NewsItem.embeddingStatus} = 'embedded')::int`,
          latestPublishedAt: sql<Date | null>`max(${NewsItem.publishedAt}) filter (where ${NewsItem.status} = 'published')`,
          published24h: sql<number>`count(*) filter (where ${NewsItem.status} = 'published' and ${NewsItem.publishedAt} >= ${oneDayAgo})::int`,
          publishedTotal: sql<number>`count(*) filter (where ${NewsItem.status} = 'published')::int`,
        })
        .from(NewsItem),
      ctx.db
        .select({
          finishedAt: IngestionRun.finishedAt,
          itemsCreated: IngestionRun.itemsCreated,
          itemsSeen: IngestionRun.itemsSeen,
          itemsUpdated: IngestionRun.itemsUpdated,
          startedAt: IngestionRun.startedAt,
          status: IngestionRun.status,
        })
        .from(IngestionRun)
        .orderBy(desc(IngestionRun.startedAt))
        .limit(1),
      ctx.db
        .select({
          expiredLeaseCount: sql<number>`count(*) filter (where ${BackgroundJob.status} = 'running' and ${BackgroundJob.lockExpiresAt} < ${now})::int`,
          failed: sql<number>`count(*) filter (where ${BackgroundJob.status} = 'failed')::int`,
          oldestDueQueuedAt: sql<Date | null>`min(${BackgroundJob.nextRunAt}) filter (where ${BackgroundJob.status} = 'queued' and ${BackgroundJob.nextRunAt} <= ${now})`,
          queued: sql<number>`count(*) filter (where ${BackgroundJob.status} = 'queued')::int`,
          running: sql<number>`count(*) filter (where ${BackgroundJob.status} = 'running')::int`,
          succeeded: sql<number>`count(*) filter (where ${BackgroundJob.status} = 'succeeded')::int`,
        })
        .from(BackgroundJob),
      ctx.db
        .select({
          collected: sql<number>`count(*)::int`,
          date: sql<string>`to_char(date_trunc('day', ${NewsItem.collectedAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
        })
        .from(NewsItem)
        .where(gte(NewsItem.collectedAt, sevenDaysAgo))
        .groupBy(
          sql`date_trunc('day', ${NewsItem.collectedAt} at time zone 'UTC')`,
        ),
      ctx.db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${IngestionRun.startedAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
          failed: sql<number>`count(*) filter (where ${IngestionRun.status} in ('failed', 'partial'))::int`,
          succeeded: sql<number>`count(*) filter (where ${IngestionRun.status} = 'succeeded')::int`,
        })
        .from(IngestionRun)
        .where(gte(IngestionRun.startedAt, sevenDaysAgo))
        .groupBy(
          sql`date_trunc('day', ${IngestionRun.startedAt} at time zone 'UTC')`,
        ),
    ]);

    const source = sourceRows[0] ?? { activeCount: 0, count: 0 };
    const news = newsRows[0] ?? {
      collected24h: 0,
      embeddedPublishedTotal: 0,
      latestPublishedAt: null,
      published24h: 0,
      publishedTotal: 0,
    };
    const jobs = jobRows[0] ?? {
      expiredLeaseCount: 0,
      failed: 0,
      oldestDueQueuedAt: null,
      queued: 0,
      running: 0,
      succeeded: 0,
    };
    const latestIngestion = ingestionRows[0];
    const newsByDate = new Map(
      newsDailyRows.map((row) => [row.date, row.collected]),
    );
    const ingestionByDate = new Map(
      ingestionDailyRows.map((row) => [row.date, row]),
    );
    const daily = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(sevenDaysAgo);
      date.setUTCDate(date.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      const ingestion = ingestionByDate.get(key);

      return {
        collected: newsByDate.get(key) ?? 0,
        date: key,
        failedIngestions: ingestion?.failed ?? 0,
        succeededIngestions: ingestion?.succeeded ?? 0,
      };
    });

    const snapshot: OverviewSnapshot = {
      activeSourceCount: source.activeCount,
      daily,
      ingestion: latestIngestion
        ? {
            ...latestIngestion,
            finishedAt: toIso(latestIngestion.finishedAt),
            startedAt: latestIngestion.startedAt.toISOString(),
          }
        : null,
      jobs: {
        ...jobs,
        oldestDueQueuedAt: toIso(jobs.oldestDueQueuedAt),
      },
      news: {
        ...news,
        latestPublishedAt: toIso(news.latestPublishedAt),
      },
      sourceCount: source.count,
    };

    return {
      health: buildOverviewHealth(snapshot, now),
      snapshot,
    };
  }),
});
