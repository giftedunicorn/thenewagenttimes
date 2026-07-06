import { and, desc, eq, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { IngestionRun, NewsItem, NewsSource } from "@acme/db/schema";

import type {
  NewsDeskStatus,
  NewsHomeItem,
  NewsHomeStatus,
} from "../_components/news-home-model";
import {
  buildNewsDeskStatus,
  getPreviewNewsArticleData,
  getPreviewNewsHomeItems,
  selectInitialNewsHomeItems,
  selectRelatedNewsHomeItems,
} from "../_components/news-home-model";

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

const textArraySql = (values: readonly string[]) =>
  values.length > 0
    ? sql`array[${sql.join(
        values.map((value) => sql`${value}`),
        sql`, `,
      )}]::text[]`
    : sql`array[]::text[]`;

export const buildRelatedNewsCondition = ({
  article,
  articleId,
}: {
  article: Pick<NewsHomeItem, "category" | "clusterKey" | "entities" | "tags">;
  articleId: string;
}) => {
  const clusterKey = article.clusterKey?.trim();
  const relatedCondition = clusterKey
    ? sql`${NewsItem.clusterKey} = ${clusterKey} or ${NewsItem.category} = ${article.category} or ${NewsItem.entities} && ${textArraySql(article.entities)} or ${NewsItem.tags} && ${textArraySql(article.tags)}`
    : sql`${NewsItem.category} = ${article.category} or ${NewsItem.entities} && ${textArraySql(article.entities)} or ${NewsItem.tags} && ${textArraySql(article.tags)}`;

  return sql`${NewsItem.status} = 'published' and ${NewsItem.id} <> ${articleId} and (${relatedCondition})`;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const shouldReadNewsArticleFromDatabase = (id: string) =>
  uuidPattern.test(id);

export const buildNewsHomeCandidateOrderByExpressions = () => [
  desc(NewsItem.publishedAt),
  desc(NewsItem.trendScore),
  desc(NewsItem.sourceScore),
];

export const buildRelatedNewsOrderByExpressions = ({
  article,
}: {
  article: Pick<NewsHomeItem, "clusterKey">;
}) => {
  const clusterKey = article.clusterKey?.trim();

  return [
    ...(clusterKey
      ? [
          sql`case when ${NewsItem.clusterKey} = ${clusterKey} then 0 else 1 end`,
        ]
      : []),
    desc(NewsItem.trendScore),
    desc(NewsItem.publishedAt),
    desc(NewsItem.sourceScore),
  ];
};

const toNullableIsoTimestamp = (
  value: Date | string | null | undefined,
): string | null => {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
};

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
          clusterKey: NewsItem.clusterKey,
          imageUrl: NewsItem.imageUrl,
          originalUrl: NewsItem.originalUrl,
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
        .orderBy(...buildNewsHomeCandidateOrderByExpressions())
        .limit(90),
      getNewsDeskStatus(),
    ]);
    const liveItems = selectInitialNewsHomeItems({
      items: rows.map((row) => ({
        ...row,
        publishedAt: row.publishedAt.toISOString(),
      })),
      limit: 30,
    });

    return {
      items: liveItems.length > 0 ? liveItems : getPreviewNewsHomeItems(),
      status: liveItems.length > 0 ? "ready" : "empty",
      deskStatus,
    };
  } catch (error: unknown) {
    console.warn(
      "Unable to load news homepage data",
      error instanceof Error ? error.message : String(error),
    );

    return {
      items: getPreviewNewsHomeItems(),
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

const newsRunSkipReasons = [
  "duplicate",
  "future",
  "irrelevant",
  "low_quality",
  "stale",
] as const;

type NewsRunSkipReason = (typeof newsRunSkipReasons)[number];

const zeroNewsRunSkippedByReason = () =>
  Object.fromEntries(newsRunSkipReasons.map((reason) => [reason, 0])) as Record<
    NewsRunSkipReason,
    number
  >;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getMetadataNumber = (metadata: Record<string, unknown>, key: string) =>
  typeof metadata[key] === "number" ? metadata[key] : 0;

const getMetadataStringArray = (
  metadata: Record<string, unknown>,
  key: string,
) =>
  Array.isArray(metadata[key])
    ? metadata[key].filter(
        (value): value is string => typeof value === "string",
      )
    : [];

const getMetadataStringRecord = (
  metadata: Record<string, unknown>,
  key: string,
) =>
  isRecord(metadata[key])
    ? Object.fromEntries(
        Object.entries(metadata[key]).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      )
    : {};

const getNewsRunSourceHealthFromMetadata = (
  metadata: Record<string, unknown>,
) => {
  if (!isRecord(metadata.sourceHealth)) return undefined;

  const sourceHealth = metadata.sourceHealth;

  return {
    emptySourceSlugs: getMetadataStringArray(sourceHealth, "emptySourceSlugs"),
    failedSourceSlugs: getMetadataStringArray(
      sourceHealth,
      "failedSourceSlugs",
    ),
    failureMessages: getMetadataStringRecord(sourceHealth, "failureMessages"),
    healthySourceSlugs: getMetadataStringArray(
      sourceHealth,
      "healthySourceSlugs",
    ),
  };
};

export const getNewsRunSkipDiagnosticsFromMetadata = (metadata: unknown) => {
  if (!isRecord(metadata)) {
    return {
      itemsSkipped: 0,
      skippedByReason: zeroNewsRunSkippedByReason(),
    };
  }

  const skippedByReasonMetadata = isRecord(metadata.skippedByReason)
    ? metadata.skippedByReason
    : {};
  const sourceHealth = getNewsRunSourceHealthFromMetadata(metadata);

  return {
    itemsSkipped: getMetadataNumber(metadata, "itemsSkipped"),
    skippedByReason: {
      duplicate: getMetadataNumber(skippedByReasonMetadata, "duplicate"),
      future: getMetadataNumber(skippedByReasonMetadata, "future"),
      irrelevant: getMetadataNumber(skippedByReasonMetadata, "irrelevant"),
      low_quality: getMetadataNumber(skippedByReasonMetadata, "low_quality"),
      stale: getMetadataNumber(skippedByReasonMetadata, "stale"),
    },
    ...(sourceHealth ? { sourceHealth } : {}),
  };
};

export const getNewsDeskStatus = async (): Promise<NewsDeskStatus> => {
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
        embeddedStories: sql<number>`count(*) filter (where ${NewsItem.embeddingStatus} = 'embedded')::int`,
        unembeddedStories: sql<number>`count(*) filter (where ${NewsItem.embeddingStatus} <> 'embedded')::int`,
        latestPublishedAt: sql<
          Date | string | null
        >`max(${NewsItem.publishedAt})`,
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
        metadata: IngestionRun.metadata,
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
    embeddedStories: itemCount?.embeddedStories ?? 0,
    totalSources: sourceCount?.totalSources ?? 0,
    publishedStories: itemCount?.publishedStories ?? 0,
    unembeddedStories: itemCount?.unembeddedStories ?? 0,
    latestPublishedAt: toNullableIsoTimestamp(itemCount?.latestPublishedAt),
    latestRun: latestRun
      ? (() => {
          const { metadata, ...run } = latestRun;
          return {
            ...run,
            ...getNewsRunSkipDiagnosticsFromMetadata(metadata),
            startedAt: run.startedAt.toISOString(),
            finishedAt: run.finishedAt?.toISOString() ?? null,
          };
        })()
      : null,
  });
};

interface NewsSchemaReadinessRows {
  rows?: { isNullable?: string; is_nullable?: string }[];
}

export const getNewsSchemaReadiness = async () => {
  const result = (await db.execute<{ isNullable: string }>(sql`
    select is_nullable as "isNullable"
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'news_item'
      and column_name = 'cluster_key'
    limit 1
  `)) as NewsSchemaReadinessRows;
  const clusterKey = result.rows?.[0];

  return {
    newsItemClusterKey: clusterKey
      ? (clusterKey.isNullable ?? clusterKey.is_nullable) === "NO"
        ? "ready"
        : "incomplete"
      : "missing",
  } as const;
};

export const getNewsArticleData = async (
  id: string,
): Promise<{
  article: NewsArticleItem | null;
  related: NewsHomeItem[];
}> => {
  if (!shouldReadNewsArticleFromDatabase(id)) {
    return getPreviewNewsArticleData(id);
  }

  try {
    const [article] = await db
      .select({
        id: NewsItem.id,
        title: NewsItem.title,
        summary: NewsItem.summary,
        bodyText: NewsItem.bodyText,
        canonicalUrl: NewsItem.canonicalUrl,
        clusterKey: NewsItem.clusterKey,
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
      return getPreviewNewsArticleData(id);
    }

    const relatedRows = await db
      .select({
        id: NewsItem.id,
        title: NewsItem.title,
        summary: NewsItem.summary,
        canonicalUrl: NewsItem.canonicalUrl,
        clusterKey: NewsItem.clusterKey,
        imageUrl: NewsItem.imageUrl,
        originalUrl: NewsItem.originalUrl,
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
      .where(buildRelatedNewsCondition({ article, articleId: id }))
      .orderBy(...buildRelatedNewsOrderByExpressions({ article }))
      .limit(24);

    const articleItem = {
      ...article,
      publishedAt: article.publishedAt.toISOString(),
      collectedAt: article.collectedAt.toISOString(),
    };
    const relatedItems = relatedRows.map((row) => ({
      ...row,
      publishedAt: row.publishedAt.toISOString(),
    }));

    return {
      article: articleItem,
      related: selectRelatedNewsHomeItems({
        article: articleItem,
        limit: 8,
        relatedItems,
      }),
    };
  } catch (error: unknown) {
    console.error(
      "Unable to load news article data",
      error instanceof Error ? error.message : String(error),
    );

    return getPreviewNewsArticleData(id);
  }
};
