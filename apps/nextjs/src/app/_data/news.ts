import type {
  NewsCollaborativeSignal,
  NewsSemanticSimilarityMatch,
  NewsUrlReference,
} from "@acme/validators";
import { and, desc, eq, ilike, inArray, or, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  IngestionRun,
  NewsCategorySchema,
  NewsItem,
  NewsItemVector,
  NewsReaderInteraction,
  NewsSource,
} from "@acme/db/schema";
import { buildNewsSemanticSimilarityMatches } from "@acme/validators";

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

type NewsSemanticFeedbackAction = "click_source" | "save" | "share";

export interface NewsSemanticFeedbackItem extends NewsUrlReference {
  action?: NewsSemanticFeedbackAction;
  clusterKey?: string | null;
  newsItemId: string;
  occurredAt?: string;
  strength?: number;
}

interface NewsCollaborativeSignalRow {
  canonicalUrl?: string | null;
  category: string;
  clusterKey?: string | null;
  deepReadCount: number;
  entities: readonly string[];
  hideCount: number;
  newsItemId: string;
  originalUrl?: string | null;
  readerCount: number;
  saveCount: number;
  shareCount: number;
  sourceClickCount: number;
  sourceSlug: string;
  tags: readonly string[];
}

const collaborativeSignalWindowMs = 1000 * 60 * 60 * 24 * 14;

const getNewsSemanticFeedbackItemStrength = (
  item: NewsSemanticFeedbackItem,
) => {
  if (typeof item.strength === "number" && Number.isFinite(item.strength)) {
    return item.strength;
  }

  if (item.action === "share") return 3;
  if (item.action === "save") return 2;

  return 1;
};

const getNewsCollaborativeSignalWindowStart = (now = new Date()) =>
  new Date(now.getTime() - collaborativeSignalWindowMs);

const getNewsCollaborativeSignalScore = ({
  deepReadCount,
  hideCount = 0,
  readerCount,
  saveCount,
  shareCount,
  sourceClickCount,
}: {
  deepReadCount: number;
  hideCount?: number;
  readerCount: number;
  saveCount: number;
  shareCount: number;
  sourceClickCount: number;
}) =>
  readerCount >= 2
    ? shareCount * 3 +
      saveCount * 2 +
      deepReadCount * 2 +
      sourceClickCount -
      hideCount * 3
    : 0;

const toNewsCollaborativeSignal = (
  row: NewsCollaborativeSignalRow,
): NewsCollaborativeSignal | null => {
  const score = getNewsCollaborativeSignalScore(row);

  return score !== 0
    ? {
        ...(row.canonicalUrl ? { canonicalUrl: row.canonicalUrl } : {}),
        category: row.category,
        ...(row.clusterKey ? { clusterKey: row.clusterKey } : {}),
        entities: row.entities,
        newsItemId: row.newsItemId,
        ...(row.originalUrl ? { originalUrl: row.originalUrl } : {}),
        score,
        sourceSlug: row.sourceSlug,
        tags: row.tags,
      }
    : null;
};

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

const shouldReadNewsClusterKeyFromDatabase = (clusterKey?: string | null) => {
  const normalizedClusterKey = clusterKey?.trim().toLowerCase() ?? "";

  return (
    normalizedClusterKey.length > 0 &&
    !normalizedClusterKey.startsWith("preview-")
  );
};

const shouldReadNewsClusterFromDatabase = ({
  clusterKey,
  sourceSlug,
}: {
  clusterKey?: string | null;
  sourceSlug: string;
}) => {
  const normalizedSourceSlug = sourceSlug.trim().toLowerCase();

  return (
    shouldReadNewsClusterKeyFromDatabase(clusterKey) &&
    !normalizedSourceSlug.startsWith("preview-")
  );
};

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

export type NewsEditionPageKind = "entity" | "search" | "source" | "topic";

export interface NewsEditionPageData {
  filter: {
    kind: NewsEditionPageKind;
    title: string;
    value: string;
  };
  items: NewsHomeItem[];
  status: NewsHomeStatus;
}

const normalizeNewsEditionTopicCategoryValue = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");

export const parseNewsEditionTopicCategory = (value: string) =>
  NewsCategorySchema.safeParse(normalizeNewsEditionTopicCategoryValue(value));

const normalizeNewsEditionValue = ({
  kind,
  value,
}: {
  kind: NewsEditionPageKind;
  value: string;
}) => {
  const trimmedValue = value.trim();

  if (kind !== "topic") return trimmedValue;

  const parsedCategory = parseNewsEditionTopicCategory(trimmedValue);

  return parsedCategory.success ? parsedCategory.data : trimmedValue;
};

const newsEditionTopicTitles: Record<string, string> = {
  agent_product: "Agents",
  big_tech: "Big Tech",
  funding: "Funding",
  hot_take: "Hot Takes",
  market_map: "Market Maps",
  model_release: "Models",
  musk_ai: "Musk AI",
  new_concept: "New Concepts",
  open_source: "Open Source",
  other: "Other",
  policy: "Policy",
  product_hunt: "Product Hunt",
  research: "Research",
  security: "Security",
  yc_ai: "YC AI",
};

const formatNewsEditionFilterTitle = (value: string) =>
  value
    .trim()
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getNewsEditionFallbackTitle = ({
  kind,
  value,
}: {
  kind: NewsEditionPageKind;
  value: string;
}) =>
  kind === "search"
    ? value
      ? `Search: ${value}`
      : "Search"
    : kind === "topic"
      ? (newsEditionTopicTitles[value] ?? formatNewsEditionFilterTitle(value))
      : formatNewsEditionFilterTitle(value);

const normalizeNewsSearchValue = (value: string) =>
  value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

const getNewsSearchTokens = (value: string) =>
  normalizeNewsSearchValue(value).split(/\s+/).filter(Boolean);

const getNewsEditionSearchText = (item: NewsHomeItem) =>
  normalizeNewsSearchValue(
    [
      item.title,
      item.summary,
      item.sourceName,
      item.sourceSlug,
      item.category,
      ...item.tags,
      ...item.entities,
    ].join(" "),
  );

const doesNewsEditionItemMatchSearch = ({
  item,
  value,
}: {
  item: NewsHomeItem;
  value: string;
}) => {
  const tokens = getNewsSearchTokens(value);

  if (tokens.length === 0) return false;

  const searchText = getNewsEditionSearchText(item);

  return tokens.every((token) => searchText.includes(token));
};

const filterPreviewNewsEditionItems = ({
  kind,
  value,
}: {
  kind: NewsEditionPageKind;
  value: string;
}) => {
  const normalizedValue = value.trim().toLowerCase();

  return getPreviewNewsHomeItems().filter((item) =>
    kind === "search"
      ? doesNewsEditionItemMatchSearch({ item, value })
      : kind === "topic"
        ? item.category.toLowerCase() === normalizedValue
        : kind === "entity"
          ? item.entities.some(
              (entity) => entity.trim().toLowerCase() === normalizedValue,
            )
          : item.sourceSlug.toLowerCase() === normalizedValue,
  );
};

const selectPreviewNewsEditionItems = ({
  kind,
  value,
}: {
  kind: NewsEditionPageKind;
  value: string;
}) =>
  selectInitialNewsHomeItems({
    items: filterPreviewNewsEditionItems({ kind, value }),
    limit: 30,
  });

const buildNewsSearchTokenCondition = (token: string) => {
  const pattern = `%${token}%`;

  return or(
    ilike(NewsItem.title, pattern),
    ilike(NewsItem.summary, pattern),
    ilike(NewsItem.category, pattern),
    ilike(NewsSource.name, pattern),
    ilike(NewsSource.slug, pattern),
    sql`exists (select 1 from unnest(${NewsItem.entities}) as entity where entity ilike ${pattern})`,
    sql`exists (select 1 from unnest(${NewsItem.tags}) as tag where tag ilike ${pattern})`,
  );
};

export const buildNewsSearchEditionCondition = (value: string) => {
  const tokenConditions = getNewsSearchTokens(value)
    .map(buildNewsSearchTokenCondition)
    .filter((condition) => condition !== undefined);

  return tokenConditions.length > 0
    ? and(eq(NewsItem.status, "published"), ...tokenConditions)
    : sql`false`;
};

const buildNewsEditionCondition = ({
  kind,
  value,
}: {
  kind: NewsEditionPageKind;
  value: string;
}) => {
  if (kind === "search") {
    return buildNewsSearchEditionCondition(value);
  }

  if (kind === "topic") {
    const category = parseNewsEditionTopicCategory(value);

    if (!category.success) return sql`false`;

    return and(
      eq(NewsItem.status, "published"),
      eq(NewsItem.category, category.data),
    );
  }

  if (kind === "entity") {
    const normalizedEntity = value.trim().toLowerCase();

    if (!normalizedEntity) return sql`false`;

    return and(
      eq(NewsItem.status, "published"),
      sql`exists (select 1 from unnest(${NewsItem.entities}) as entity where lower(entity) = ${normalizedEntity})`,
    );
  }

  return and(eq(NewsItem.status, "published"), eq(NewsSource.slug, value));
};

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
  } catch {
    return {
      items: getPreviewNewsHomeItems(),
      status: "unavailable",
      deskStatus: getUnavailableNewsDeskStatus(),
    };
  }
};

export const getNewsCollaborativeSignals = async ({
  items,
}: {
  items: readonly Pick<
    NewsHomeItem,
    "category" | "clusterKey" | "entities" | "id" | "sourceSlug" | "tags"
  >[];
}): Promise<NewsCollaborativeSignal[]> => {
  const candidateNewsItemIds = Array.from(
    new Set(
      items
        .map((item) => item.id.trim())
        .filter(shouldReadNewsArticleFromDatabase)
        .filter((newsItemId) => newsItemId.length > 0),
    ),
  );
  const candidateClusterKeys = Array.from(
    new Set(
      items
        .filter(shouldReadNewsClusterFromDatabase)
        .map((item) => item.clusterKey?.trim() ?? "")
        .filter((clusterKey) => clusterKey.length > 0),
    ),
  );

  if (candidateNewsItemIds.length === 0 && candidateClusterKeys.length === 0) {
    return [];
  }

  try {
    const since = getNewsCollaborativeSignalWindowStart();
    const interactionRecallCondition =
      candidateNewsItemIds.length > 0 && candidateClusterKeys.length > 0
        ? or(
            inArray(NewsReaderInteraction.newsItemId, candidateNewsItemIds),
            inArray(NewsItem.clusterKey, candidateClusterKeys),
          )
        : candidateNewsItemIds.length > 0
          ? inArray(NewsReaderInteraction.newsItemId, candidateNewsItemIds)
          : inArray(NewsItem.clusterKey, candidateClusterKeys);
    const rows = await db
      .select({
        canonicalUrl: NewsItem.canonicalUrl,
        category: NewsItem.category,
        clusterKey: NewsItem.clusterKey,
        deepReadCount: sql<number>`count(*) filter (where ${
          NewsReaderInteraction.action
        } = 'view' and coalesce(${NewsReaderInteraction.metadata}->>'surface', '') = 'article' and coalesce((${NewsReaderInteraction.metadata}->>'readPercent')::double precision, 0) >= 0.8)::int`,
        entities: NewsItem.entities,
        hideCount: sql<number>`count(*) filter (where ${NewsReaderInteraction.action} = 'hide')::int`,
        newsItemId: NewsReaderInteraction.newsItemId,
        originalUrl: NewsItem.originalUrl,
        readerCount: sql<number>`count(distinct ${NewsReaderInteraction.readerProfileId})::int`,
        saveCount: sql<number>`count(*) filter (where ${NewsReaderInteraction.action} = 'save')::int`,
        shareCount: sql<number>`count(*) filter (where ${NewsReaderInteraction.action} = 'share')::int`,
        sourceClickCount: sql<number>`count(*) filter (where ${NewsReaderInteraction.action} = 'click_source')::int`,
        sourceSlug: NewsSource.slug,
        tags: NewsItem.tags,
      })
      .from(NewsReaderInteraction)
      .innerJoin(NewsItem, eq(NewsReaderInteraction.newsItemId, NewsItem.id))
      .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
      .where(
        and(
          interactionRecallCondition,
          sql`${NewsReaderInteraction.occurredAt} >= ${since}`,
        ),
      )
      .groupBy(
        NewsReaderInteraction.newsItemId,
        NewsItem.canonicalUrl,
        NewsItem.category,
        NewsItem.clusterKey,
        NewsItem.entities,
        NewsItem.originalUrl,
        NewsSource.slug,
        NewsItem.tags,
      );

    return rows.flatMap((row) => {
      const signal = toNewsCollaborativeSignal(row);

      return signal ? [signal] : [];
    });
  } catch (error: unknown) {
    console.warn(
      "Unable to load news collaborative signals",
      error instanceof Error ? error.message : String(error),
    );

    return [];
  }
};

export const getNewsSemanticSimilarityMatches = async ({
  feedbackItems,
  items,
}: {
  feedbackItems: readonly NewsSemanticFeedbackItem[];
  items: readonly Pick<
    NewsHomeItem,
    "canonicalUrl" | "clusterKey" | "id" | "originalUrl"
  >[];
}): Promise<NewsSemanticSimilarityMatch[]> => {
  const candidateItems = items.filter(
    (item) =>
      shouldReadNewsArticleFromDatabase(item.id) ||
      shouldReadNewsClusterKeyFromDatabase(item.clusterKey),
  );
  const semanticFeedbackItems = feedbackItems
    .filter((item) => item.newsItemId.trim().length > 0)
    .filter(
      (item) =>
        shouldReadNewsArticleFromDatabase(item.newsItemId) ||
        shouldReadNewsClusterKeyFromDatabase(item.clusterKey),
    )
    .map((item) => ({
      canonicalUrl: item.canonicalUrl,
      clusterKey: item.clusterKey,
      newsItemId: item.newsItemId,
      occurredAt: item.occurredAt,
      originalUrl: item.originalUrl,
      strength: getNewsSemanticFeedbackItemStrength(item),
    }));

  if (candidateItems.length === 0 || semanticFeedbackItems.length === 0) {
    return [];
  }

  const vectorNewsItemIds = Array.from(
    new Set([
      ...candidateItems
        .map((item) => item.id)
        .filter(shouldReadNewsArticleFromDatabase),
      ...semanticFeedbackItems
        .map((item) => item.newsItemId)
        .filter(shouldReadNewsArticleFromDatabase),
    ]),
  );
  const vectorClusterKeys = Array.from(
    new Set(
      [...candidateItems, ...semanticFeedbackItems]
        .map((item) => item.clusterKey?.trim() ?? "")
        .filter(shouldReadNewsClusterKeyFromDatabase),
    ),
  );

  if (vectorNewsItemIds.length === 0 && vectorClusterKeys.length === 0) {
    return [];
  }

  try {
    const vectorRecallCondition =
      vectorNewsItemIds.length > 0 && vectorClusterKeys.length > 0
        ? or(
            inArray(NewsItemVector.newsItemId, vectorNewsItemIds),
            inArray(NewsItem.clusterKey, vectorClusterKeys),
          )
        : vectorNewsItemIds.length > 0
          ? inArray(NewsItemVector.newsItemId, vectorNewsItemIds)
          : inArray(NewsItem.clusterKey, vectorClusterKeys);
    const vectorRows = await db
      .select({
        clusterKey: NewsItem.clusterKey,
        createdAt: NewsItemVector.createdAt,
        embedding: NewsItemVector.embedding,
        newsItemId: NewsItemVector.newsItemId,
      })
      .from(NewsItemVector)
      .innerJoin(NewsItem, eq(NewsItemVector.newsItemId, NewsItem.id))
      .where(vectorRecallCondition)
      .orderBy(desc(NewsItemVector.createdAt))
      .limit((vectorNewsItemIds.length + vectorClusterKeys.length) * 3);
    const latestEmbeddingByNewsItemId = new Map<string, readonly number[]>();
    const latestEmbeddingByClusterKey = new Map<string, readonly number[]>();

    for (const vectorRow of vectorRows) {
      if (!vectorRow.embedding || vectorRow.embedding.length === 0) continue;

      if (!latestEmbeddingByNewsItemId.has(vectorRow.newsItemId)) {
        latestEmbeddingByNewsItemId.set(
          vectorRow.newsItemId,
          vectorRow.embedding,
        );
      }

      const clusterKey =
        typeof vectorRow.clusterKey === "string"
          ? vectorRow.clusterKey.trim().toLowerCase()
          : "";
      if (clusterKey && !latestEmbeddingByClusterKey.has(clusterKey)) {
        latestEmbeddingByClusterKey.set(clusterKey, vectorRow.embedding);
      }
    }

    const getVectorEmbedding = ({
      clusterKey,
      newsItemId,
    }: {
      clusterKey?: string | null;
      newsItemId: string;
    }) =>
      latestEmbeddingByNewsItemId.get(newsItemId) ??
      latestEmbeddingByClusterKey.get(clusterKey?.trim().toLowerCase() ?? "") ??
      null;

    return buildNewsSemanticSimilarityMatches({
      candidateVectors: candidateItems.map((item) => ({
        canonicalUrl: item.canonicalUrl,
        clusterKey: item.clusterKey,
        embedding: getVectorEmbedding({
          clusterKey: item.clusterKey,
          newsItemId: item.id,
        }),
        newsItemId: item.id,
        originalUrl: item.originalUrl,
      })),
      feedbackVectors: semanticFeedbackItems.map((item) => ({
        ...item,
        embedding: getVectorEmbedding({
          clusterKey: item.clusterKey,
          newsItemId: item.newsItemId,
        }),
      })),
    });
  } catch (error: unknown) {
    console.warn(
      "Unable to load news semantic vectors",
      error instanceof Error ? error.message : String(error),
    );

    return [];
  }
};

export const getNewsEditionPageData = async ({
  kind,
  value,
}: {
  kind: NewsEditionPageKind;
  value: string;
}): Promise<NewsEditionPageData> => {
  const normalizedValue = normalizeNewsEditionValue({ kind, value });
  const fallbackTitle = getNewsEditionFallbackTitle({
    kind,
    value: normalizedValue,
  });

  try {
    const rows = await db
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
      .where(buildNewsEditionCondition({ kind, value: normalizedValue }))
      .orderBy(...buildNewsHomeCandidateOrderByExpressions())
      .limit(90);
    const liveItems = selectInitialNewsHomeItems({
      items: rows.map((row) => ({
        ...row,
        publishedAt: row.publishedAt.toISOString(),
      })),
      limit: 30,
    });
    const fallbackItems =
      liveItems.length > 0
        ? []
        : selectPreviewNewsEditionItems({ kind, value: normalizedValue });
    const items = liveItems.length > 0 ? liveItems : fallbackItems;
    const firstSourceName = items[0]?.sourceName.trim();
    const sourceTitle =
      kind === "source" && firstSourceName ? firstSourceName : undefined;

    return {
      filter: {
        kind,
        title: sourceTitle ?? fallbackTitle,
        value: normalizedValue,
      },
      items,
      status: liveItems.length > 0 ? "ready" : "empty",
    };
  } catch {
    return {
      filter: {
        kind,
        title: fallbackTitle,
        value: normalizedValue,
      },
      items: selectPreviewNewsEditionItems({ kind, value: normalizedValue }),
      status: "unavailable",
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
    emptyReasonMessages: getMetadataStringRecord(
      sourceHealth,
      "emptyReasonMessages",
    ),
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
