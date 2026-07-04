import type { ArxivAiPaper } from "./arxiv";
import type { GitHubTrendingAiRepository } from "./github";
import type { HackerNewsAiStory } from "./hacker-news";
import type {
  EmbeddingProvider,
  NewsItemInput,
  NewsRepository,
  NewsSourceInput,
} from "./types";
import type { YcAiCompany } from "./yc";
import { fetchArxivAiPapers, toArxivAiManualNewsInput } from "./arxiv";
import { buildEmbeddingInput, hashEmbeddingInput } from "./embedding";
import {
  fetchGitHubTrendingAiRepositories,
  toGitHubTrendingAiManualNewsInput,
} from "./github";
import {
  fetchHackerNewsAiStories,
  toHackerNewsAiManualNewsInput,
} from "./hacker-news";
import { normalizeFeedItem, normalizeManualItem } from "./normalize";
import { parseFeedXml } from "./rss";
import { initialNewsSources } from "./sources";
import { fetchYcAiCompanies, toYcAiManualNewsInput } from "./yc";

export const arxivAiSourceSlug = "arxiv-ai-ml";
export const githubTrendingAiSourceSlug = "github-trending-ai";
export const hackerNewsAiSourceSlug = "hacker-news-ai";
export const ycAiSourceSlug = "yc-ai";

const activeHighSignalSourceSlugs = [
  arxivAiSourceSlug,
  hackerNewsAiSourceSlug,
  githubTrendingAiSourceSlug,
  ycAiSourceSlug,
] as const;

export const getActiveRssSourceSlugs = (
  sources: readonly NewsSourceInput[] = initialNewsSources,
) =>
  sources
    .filter((source) => source.isActive && source.feedUrl)
    .map((source) => source.slug);

export const getActiveHighSignalSourceSlugs = (
  sources: readonly NewsSourceInput[] = initialNewsSources,
) =>
  sources
    .filter(
      (source) =>
        source.isActive &&
        !source.feedUrl &&
        activeHighSignalSourceSlugs.includes(
          source.slug as (typeof activeHighSignalSourceSlugs)[number],
        ),
    )
    .map((source) => source.slug);

export const seedSources = async (input: { repository: NewsRepository }) => {
  return input.repository.seedSources(initialNewsSources);
};

export type NewsIngestionSkipReason =
  | "duplicate"
  | "future"
  | "irrelevant"
  | "stale";

export type NewsIngestionSkippedByReason = Record<
  NewsIngestionSkipReason,
  number
>;

export interface NewsSourceRefreshResult {
  sourceSlug: string;
  status: "succeeded" | "failed";
  itemsSeen: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsSkipped: number;
  skippedByReason: NewsIngestionSkippedByReason;
  errorMessage?: string;
}

export interface NewsSourceHealthSummary {
  healthySourceSlugs: string[];
  emptySourceSlugs: string[];
  failedSourceSlugs: string[];
  failureMessages: Record<string, string>;
}

export interface NewsSourceRefreshAggregateSummary {
  sourcesAttempted: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  itemsSeen: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsSkipped: number;
  skippedByReason: NewsIngestionSkippedByReason;
  results: NewsSourceRefreshResult[];
  sourceHealth: NewsSourceHealthSummary;
}

const newsEditionWindowMs = 45 * 24 * 60 * 60 * 1000;
const newsEditionFutureToleranceMs = 2 * 24 * 60 * 60 * 1000;
const hourMs = 60 * 60 * 1000;

const categoryTrendBoosts = {
  agent_product: 9,
  big_tech: 7,
  funding: 8,
  hot_take: 6,
  market_map: 5,
  model_release: 10,
  musk_ai: 7,
  new_concept: 8,
  open_source: 7,
  other: 3,
  policy: 5,
  product_hunt: 7,
  research: 8,
  security: 7,
  yc_ai: 7,
} satisfies Record<NewsItemInput["category"], number>;

const clampScore = (score: number) =>
  Math.min(Math.max(Math.round(score), 0), 100);

const getFreshnessTrendScore = ({
  now,
  publishedAt,
}: {
  now: Date;
  publishedAt: Date;
}) => {
  const ageHours = Math.max(
    0,
    (now.getTime() - publishedAt.getTime()) / hourMs,
  );

  if (ageHours <= 6) return 30;
  if (ageHours <= 24) return 24;
  if (ageHours <= 72) return 18;
  if (ageHours <= 168) return 12;
  if (ageHours <= 720) return 6;

  return 2;
};

export const getIngestedNewsTrendScore = ({
  category,
  now,
  publishedAt,
  sourceScore,
}: {
  category: NewsItemInput["category"];
  now: Date;
  publishedAt: Date;
  sourceScore: number;
}) =>
  clampScore(
    sourceScore * 0.55 +
      getFreshnessTrendScore({ now, publishedAt }) +
      categoryTrendBoosts[category],
  );

export const applyIngestionScores = ({
  item,
  now,
  sourceCredibility,
}: {
  item: NewsItemInput;
  now: Date;
  sourceCredibility: number;
}): NewsItemInput => {
  const sourceScore = clampScore(sourceCredibility);

  return {
    ...item,
    sourceScore,
    trendScore: getIngestedNewsTrendScore({
      category: item.category,
      now,
      publishedAt: item.publishedAt,
      sourceScore,
    }),
  };
};

const isRelevantAiNewsItem = (item: NewsItemInput) =>
  item.category !== "other" || (item.entities?.length ?? 0) > 0;

const createSkippedByReason = (): NewsIngestionSkippedByReason => ({
  duplicate: 0,
  future: 0,
  irrelevant: 0,
  stale: 0,
});

const getNewsEditionWindowSkipReason = ({
  now,
  publishedAt,
}: {
  now: Date;
  publishedAt: Date;
}): NewsIngestionSkipReason | null => {
  const publishedAtMs = publishedAt.getTime();
  const nowMs = now.getTime();

  if (publishedAtMs > nowMs + newsEditionFutureToleranceMs) return "future";

  return nowMs - publishedAtMs > newsEditionWindowMs ? "stale" : null;
};

const countSkippedItem = (
  skippedByReason: NewsIngestionSkippedByReason,
  reason: NewsIngestionSkipReason,
) => {
  skippedByReason[reason] += 1;
};

const getSkippedItemCount = (skippedByReason: NewsIngestionSkippedByReason) =>
  Object.values(skippedByReason).reduce((total, count) => total + count, 0);

const getFailedSourceMessage = (sourcesFailed: number) =>
  `${sourcesFailed} ${sourcesFailed === 1 ? "source" : "sources"} failed`;

const hasFailureMessage = (
  result: NewsSourceRefreshResult,
): result is NewsSourceRefreshResult & { errorMessage: string } =>
  result.status === "failed" && Boolean(result.errorMessage);

const summarizeNewsSourceRefreshResults = (
  results: NewsSourceRefreshResult[],
): NewsSourceRefreshAggregateSummary => ({
  sourcesAttempted: results.length,
  sourcesSucceeded: results.filter((result) => result.status === "succeeded")
    .length,
  sourcesFailed: results.filter((result) => result.status === "failed").length,
  itemsSeen: results.reduce((total, result) => total + result.itemsSeen, 0),
  itemsCreated: results.reduce(
    (total, result) => total + result.itemsCreated,
    0,
  ),
  itemsUpdated: results.reduce(
    (total, result) => total + result.itemsUpdated,
    0,
  ),
  itemsSkipped: results.reduce(
    (total, result) => total + result.itemsSkipped,
    0,
  ),
  skippedByReason: results.reduce(
    (total, result) => ({
      duplicate: total.duplicate + result.skippedByReason.duplicate,
      future: total.future + result.skippedByReason.future,
      irrelevant: total.irrelevant + result.skippedByReason.irrelevant,
      stale: total.stale + result.skippedByReason.stale,
    }),
    createSkippedByReason(),
  ),
  results,
  sourceHealth: buildNewsSourceHealthSummary(results),
});

const finishAggregateRefreshRun = async ({
  repository,
  results,
  runType,
}: {
  repository: NewsRepository;
  results: NewsSourceRefreshResult[];
  runType: Parameters<NewsRepository["startIngestionRun"]>[0]["runType"];
}) => {
  const summary = summarizeNewsSourceRefreshResults(results);
  const aggregateRun = await repository.startIngestionRun({ runType });
  const status =
    summary.sourcesFailed === 0
      ? "succeeded"
      : summary.sourcesSucceeded === 0
        ? "failed"
        : "partial";

  await repository.finishIngestionRun({
    runId: aggregateRun.id,
    status,
    itemsSeen: summary.itemsSeen,
    itemsCreated: summary.itemsCreated,
    itemsUpdated: summary.itemsUpdated,
    errorMessage:
      summary.sourcesFailed > 0
        ? getFailedSourceMessage(summary.sourcesFailed)
        : undefined,
    metadata: {
      itemsSkipped: summary.itemsSkipped,
      skippedByReason: summary.skippedByReason,
      sourceHealth: summary.sourceHealth,
      sourcesAttempted: summary.sourcesAttempted,
      sourcesFailed: summary.sourcesFailed,
      sourcesSucceeded: summary.sourcesSucceeded,
    },
  });

  return summary;
};

export const buildNewsSourceHealthSummary = (
  results: readonly NewsSourceRefreshResult[],
): NewsSourceHealthSummary => ({
  healthySourceSlugs: results
    .filter((result) => result.status === "succeeded" && result.itemsSeen > 0)
    .map((result) => result.sourceSlug),
  emptySourceSlugs: results
    .filter((result) => result.status === "succeeded" && result.itemsSeen === 0)
    .map((result) => result.sourceSlug),
  failedSourceSlugs: results
    .filter((result) => result.status === "failed")
    .map((result) => result.sourceSlug),
  failureMessages: Object.fromEntries(
    results
      .filter(hasFailureMessage)
      .map((result) => [result.sourceSlug, result.errorMessage]),
  ),
});

export const ingestRssSource = async (input: {
  repository: NewsRepository;
  sourceSlug: string;
  fetchFeed?: (url: string) => Promise<string>;
  now?: Date;
}) => {
  const source = await input.repository.findSourceBySlug(input.sourceSlug);

  if (!source?.feedUrl) {
    throw new Error(
      `RSS source not found or missing feedUrl: ${input.sourceSlug}`,
    );
  }

  const run = await input.repository.startIngestionRun({
    sourceId: source.id,
    runType: "rss",
  });
  const fetchFeed =
    input.fetchFeed ??
    (async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Feed request failed: ${response.status}`);
      }
      return response.text();
    });

  try {
    const xml = await fetchFeed(source.feedUrl);
    const rawItems = parseFeedXml(xml);
    const seenDedupeKeys = new Set<string>();
    const now = input.now ?? new Date();
    let itemsCreated = 0;
    let itemsUpdated = 0;
    const skippedByReason = createSkippedByReason();

    for (const item of rawItems) {
      const normalized = applyIngestionScores({
        item: normalizeFeedItem({
          sourceId: source.id,
          sourceSlug: source.slug,
          item,
          now,
        }),
        now,
        sourceCredibility: source.credibility,
      });

      const editionWindowSkipReason = getNewsEditionWindowSkipReason({
        now,
        publishedAt: normalized.publishedAt,
      });

      if (editionWindowSkipReason) {
        countSkippedItem(skippedByReason, editionWindowSkipReason);
        continue;
      }

      if (!isRelevantAiNewsItem(normalized)) {
        countSkippedItem(skippedByReason, "irrelevant");
        continue;
      }

      if (seenDedupeKeys.has(normalized.dedupeKey)) {
        countSkippedItem(skippedByReason, "duplicate");
        continue;
      }
      seenDedupeKeys.add(normalized.dedupeKey);

      const result = await input.repository.upsertNewsItem(normalized);

      if (result === "created") itemsCreated += 1;
      if (result === "updated") itemsUpdated += 1;
      if (result === "duplicate")
        countSkippedItem(skippedByReason, "duplicate");
    }

    const itemsSkipped = getSkippedItemCount(skippedByReason);

    await input.repository.finishIngestionRun({
      runId: run.id,
      status: "succeeded",
      itemsSeen: rawItems.length,
      itemsCreated,
      itemsUpdated,
      ...(itemsSkipped > 0
        ? {
            metadata: {
              itemsSkipped,
              skippedByReason,
            },
          }
        : {}),
      errorMessage: undefined,
    });

    return {
      itemsSeen: rawItems.length,
      itemsCreated,
      itemsUpdated,
      itemsSkipped,
      skippedByReason,
    };
  } catch (error) {
    await input.repository.finishIngestionRun({
      runId: run.id,
      status: "failed",
      itemsSeen: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
};

export const ingestGitHubTrendingAiSource = async (input: {
  repository: NewsRepository;
  fetchRepositories?: () => Promise<readonly GitHubTrendingAiRepository[]>;
  limit?: number;
  now?: Date;
}) => {
  const source = await input.repository.findSourceBySlug(
    githubTrendingAiSourceSlug,
  );

  if (!source) {
    throw new Error(`GitHub source not found: ${githubTrendingAiSourceSlug}`);
  }

  const run = await input.repository.startIngestionRun({
    sourceId: source.id,
    runType: "api",
  });
  const fetchRepositories =
    input.fetchRepositories ??
    (() =>
      fetchGitHubTrendingAiRepositories({
        limit: input.limit,
        now: input.now,
      }));

  try {
    const rawItems = await fetchRepositories();
    const seenDedupeKeys = new Set<string>();
    const now = input.now ?? new Date();
    let itemsCreated = 0;
    let itemsUpdated = 0;
    const skippedByReason = createSkippedByReason();

    for (const repository of rawItems) {
      const normalized = applyIngestionScores({
        item: normalizeManualItem(
          toGitHubTrendingAiManualNewsInput({
            repository,
            sourceId: source.id,
            sourceSlug: source.slug,
          }),
        ),
        now,
        sourceCredibility: source.credibility,
      });

      const editionWindowSkipReason = getNewsEditionWindowSkipReason({
        now,
        publishedAt: normalized.publishedAt,
      });

      if (editionWindowSkipReason) {
        countSkippedItem(skippedByReason, editionWindowSkipReason);
        continue;
      }

      if (!isRelevantAiNewsItem(normalized)) {
        countSkippedItem(skippedByReason, "irrelevant");
        continue;
      }

      if (seenDedupeKeys.has(normalized.dedupeKey)) {
        countSkippedItem(skippedByReason, "duplicate");
        continue;
      }
      seenDedupeKeys.add(normalized.dedupeKey);

      const result = await input.repository.upsertNewsItem(normalized);

      if (result === "created") itemsCreated += 1;
      if (result === "updated") itemsUpdated += 1;
      if (result === "duplicate")
        countSkippedItem(skippedByReason, "duplicate");
    }

    const itemsSkipped = getSkippedItemCount(skippedByReason);

    await input.repository.finishIngestionRun({
      runId: run.id,
      status: "succeeded",
      itemsSeen: rawItems.length,
      itemsCreated,
      itemsUpdated,
      ...(itemsSkipped > 0
        ? {
            metadata: {
              itemsSkipped,
              skippedByReason,
            },
          }
        : {}),
      errorMessage: undefined,
    });

    return {
      itemsSeen: rawItems.length,
      itemsCreated,
      itemsUpdated,
      itemsSkipped,
      skippedByReason,
    };
  } catch (error) {
    await input.repository.finishIngestionRun({
      runId: run.id,
      status: "failed",
      itemsSeen: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
};

export const ingestArxivAiSource = async (input: {
  repository: NewsRepository;
  fetchPapers?: () => Promise<readonly ArxivAiPaper[]>;
  limit?: number;
  now?: Date;
}) => {
  const source = await input.repository.findSourceBySlug(arxivAiSourceSlug);

  if (!source) {
    throw new Error(`arXiv source not found: ${arxivAiSourceSlug}`);
  }

  const run = await input.repository.startIngestionRun({
    sourceId: source.id,
    runType: "api",
  });
  const fetchPapers =
    input.fetchPapers ??
    (() =>
      fetchArxivAiPapers({
        limit: input.limit,
      }));

  try {
    const rawItems = await fetchPapers();
    const seenDedupeKeys = new Set<string>();
    const now = input.now ?? new Date();
    let itemsCreated = 0;
    let itemsUpdated = 0;
    const skippedByReason = createSkippedByReason();

    for (const paper of rawItems) {
      const normalized = applyIngestionScores({
        item: normalizeManualItem(
          toArxivAiManualNewsInput({
            paper,
            sourceId: source.id,
            sourceSlug: source.slug,
          }),
        ),
        now,
        sourceCredibility: source.credibility,
      });

      const editionWindowSkipReason = getNewsEditionWindowSkipReason({
        now,
        publishedAt: normalized.publishedAt,
      });

      if (editionWindowSkipReason) {
        countSkippedItem(skippedByReason, editionWindowSkipReason);
        continue;
      }

      if (!isRelevantAiNewsItem(normalized)) {
        countSkippedItem(skippedByReason, "irrelevant");
        continue;
      }

      if (seenDedupeKeys.has(normalized.dedupeKey)) {
        countSkippedItem(skippedByReason, "duplicate");
        continue;
      }
      seenDedupeKeys.add(normalized.dedupeKey);

      const result = await input.repository.upsertNewsItem(normalized);

      if (result === "created") itemsCreated += 1;
      if (result === "updated") itemsUpdated += 1;
      if (result === "duplicate")
        countSkippedItem(skippedByReason, "duplicate");
    }

    const itemsSkipped = getSkippedItemCount(skippedByReason);

    await input.repository.finishIngestionRun({
      runId: run.id,
      status: "succeeded",
      itemsSeen: rawItems.length,
      itemsCreated,
      itemsUpdated,
      ...(itemsSkipped > 0
        ? {
            metadata: {
              itemsSkipped,
              skippedByReason,
            },
          }
        : {}),
      errorMessage: undefined,
    });

    return {
      itemsSeen: rawItems.length,
      itemsCreated,
      itemsUpdated,
      itemsSkipped,
      skippedByReason,
    };
  } catch (error) {
    await input.repository.finishIngestionRun({
      runId: run.id,
      status: "failed",
      itemsSeen: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
};

export const ingestHackerNewsAiSource = async (input: {
  repository: NewsRepository;
  fetchStories?: () => Promise<readonly HackerNewsAiStory[]>;
  limitPerQuery?: number;
  now?: Date;
}) => {
  const source = await input.repository.findSourceBySlug(
    hackerNewsAiSourceSlug,
  );

  if (!source) {
    throw new Error(`Hacker News source not found: ${hackerNewsAiSourceSlug}`);
  }

  const run = await input.repository.startIngestionRun({
    sourceId: source.id,
    runType: "api",
  });
  const fetchStories =
    input.fetchStories ??
    (() =>
      fetchHackerNewsAiStories({
        limitPerQuery: input.limitPerQuery,
        now: input.now,
      }));

  try {
    const rawItems = await fetchStories();
    const seenDedupeKeys = new Set<string>();
    const now = input.now ?? new Date();
    let itemsCreated = 0;
    let itemsUpdated = 0;
    const skippedByReason = createSkippedByReason();

    for (const story of rawItems) {
      const normalized = applyIngestionScores({
        item: normalizeManualItem(
          toHackerNewsAiManualNewsInput({
            sourceId: source.id,
            sourceSlug: source.slug,
            story,
          }),
        ),
        now,
        sourceCredibility: source.credibility,
      });

      const editionWindowSkipReason = getNewsEditionWindowSkipReason({
        now,
        publishedAt: normalized.publishedAt,
      });

      if (editionWindowSkipReason) {
        countSkippedItem(skippedByReason, editionWindowSkipReason);
        continue;
      }

      if (!isRelevantAiNewsItem(normalized)) {
        countSkippedItem(skippedByReason, "irrelevant");
        continue;
      }

      if (seenDedupeKeys.has(normalized.dedupeKey)) {
        countSkippedItem(skippedByReason, "duplicate");
        continue;
      }
      seenDedupeKeys.add(normalized.dedupeKey);

      const result = await input.repository.upsertNewsItem(normalized);

      if (result === "created") itemsCreated += 1;
      if (result === "updated") itemsUpdated += 1;
      if (result === "duplicate")
        countSkippedItem(skippedByReason, "duplicate");
    }

    const itemsSkipped = getSkippedItemCount(skippedByReason);

    await input.repository.finishIngestionRun({
      runId: run.id,
      status: "succeeded",
      itemsSeen: rawItems.length,
      itemsCreated,
      itemsUpdated,
      ...(itemsSkipped > 0
        ? {
            metadata: {
              itemsSkipped,
              skippedByReason,
            },
          }
        : {}),
      errorMessage: undefined,
    });

    return {
      itemsSeen: rawItems.length,
      itemsCreated,
      itemsUpdated,
      itemsSkipped,
      skippedByReason,
    };
  } catch (error) {
    await input.repository.finishIngestionRun({
      runId: run.id,
      status: "failed",
      itemsSeen: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
};

export const ingestYcAiSource = async (input: {
  repository: NewsRepository;
  fetchCompanies?: () => Promise<readonly YcAiCompany[]>;
  limit?: number;
  now?: Date;
}) => {
  const source = await input.repository.findSourceBySlug(ycAiSourceSlug);

  if (!source) {
    throw new Error(`YC source not found: ${ycAiSourceSlug}`);
  }

  const run = await input.repository.startIngestionRun({
    sourceId: source.id,
    runType: "api",
  });
  const fetchCompanies =
    input.fetchCompanies ??
    (() =>
      fetchYcAiCompanies({
        limit: input.limit,
      }));

  try {
    const rawItems = await fetchCompanies();
    const seenDedupeKeys = new Set<string>();
    const now = input.now ?? new Date();
    let itemsCreated = 0;
    let itemsUpdated = 0;
    const skippedByReason = createSkippedByReason();

    for (const company of rawItems) {
      const normalized = applyIngestionScores({
        item: normalizeManualItem(
          toYcAiManualNewsInput({
            company,
            sourceId: source.id,
            sourceSlug: source.slug,
          }),
        ),
        now,
        sourceCredibility: source.credibility,
      });

      const editionWindowSkipReason = getNewsEditionWindowSkipReason({
        now,
        publishedAt: normalized.publishedAt,
      });

      if (editionWindowSkipReason) {
        countSkippedItem(skippedByReason, editionWindowSkipReason);
        continue;
      }

      if (!isRelevantAiNewsItem(normalized)) {
        countSkippedItem(skippedByReason, "irrelevant");
        continue;
      }

      if (seenDedupeKeys.has(normalized.dedupeKey)) {
        countSkippedItem(skippedByReason, "duplicate");
        continue;
      }
      seenDedupeKeys.add(normalized.dedupeKey);

      const result = await input.repository.upsertNewsItem(normalized);

      if (result === "created") itemsCreated += 1;
      if (result === "updated") itemsUpdated += 1;
      if (result === "duplicate")
        countSkippedItem(skippedByReason, "duplicate");
    }

    const itemsSkipped = getSkippedItemCount(skippedByReason);

    await input.repository.finishIngestionRun({
      runId: run.id,
      status: "succeeded",
      itemsSeen: rawItems.length,
      itemsCreated,
      itemsUpdated,
      ...(itemsSkipped > 0
        ? {
            metadata: {
              itemsSkipped,
              skippedByReason,
            },
          }
        : {}),
      errorMessage: undefined,
    });

    return {
      itemsSeen: rawItems.length,
      itemsCreated,
      itemsUpdated,
      itemsSkipped,
      skippedByReason,
    };
  } catch (error) {
    await input.repository.finishIngestionRun({
      runId: run.id,
      status: "failed",
      itemsSeen: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
};

export const ingestActiveRssSources = async (input: {
  repository: NewsRepository;
  fetchFeed?: (url: string) => Promise<string>;
  now?: Date;
}) => {
  const sourceSlugs = getActiveRssSourceSlugs();
  const results: NewsSourceRefreshResult[] = [];

  for (const sourceSlug of sourceSlugs) {
    try {
      const result = await ingestRssSource({
        repository: input.repository,
        sourceSlug,
        fetchFeed: input.fetchFeed,
        now: input.now,
      });

      results.push({
        sourceSlug,
        status: "succeeded",
        ...result,
      });
    } catch (error) {
      results.push({
        sourceSlug,
        status: "failed",
        itemsSeen: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsSkipped: 0,
        skippedByReason: createSkippedByReason(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return finishAggregateRefreshRun({
    repository: input.repository,
    results,
    runType: "rss",
  });
};

export const ingestActiveNewsSources = async (input: {
  repository: NewsRepository;
  fetchArxivPapers?: () => Promise<readonly ArxivAiPaper[]>;
  fetchFeed?: (url: string) => Promise<string>;
  fetchGitHubRepositories?: () => Promise<
    readonly GitHubTrendingAiRepository[]
  >;
  fetchHackerNewsStories?: () => Promise<readonly HackerNewsAiStory[]>;
  fetchYcCompanies?: () => Promise<readonly YcAiCompany[]>;
  now?: Date;
}) => {
  const results: NewsSourceRefreshResult[] = [];

  for (const sourceSlug of getActiveRssSourceSlugs()) {
    try {
      const result = await ingestRssSource({
        repository: input.repository,
        sourceSlug,
        fetchFeed: input.fetchFeed,
        now: input.now,
      });

      results.push({
        sourceSlug,
        status: "succeeded",
        ...result,
      });
    } catch (error) {
      results.push({
        sourceSlug,
        status: "failed",
        itemsSeen: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsSkipped: 0,
        skippedByReason: createSkippedByReason(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  for (const sourceSlug of getActiveHighSignalSourceSlugs()) {
    try {
      let result;

      if (sourceSlug === arxivAiSourceSlug) {
        result = await ingestArxivAiSource({
          repository: input.repository,
          fetchPapers: input.fetchArxivPapers,
          now: input.now,
        });
      } else if (sourceSlug === hackerNewsAiSourceSlug) {
        result = await ingestHackerNewsAiSource({
          repository: input.repository,
          fetchStories: input.fetchHackerNewsStories,
          now: input.now,
        });
      } else if (sourceSlug === githubTrendingAiSourceSlug) {
        result = await ingestGitHubTrendingAiSource({
          repository: input.repository,
          fetchRepositories: input.fetchGitHubRepositories,
          now: input.now,
        });
      } else if (sourceSlug === ycAiSourceSlug) {
        result = await ingestYcAiSource({
          repository: input.repository,
          fetchCompanies: input.fetchYcCompanies,
          now: input.now,
        });
      } else {
        throw new Error(`Unsupported high-signal source: ${sourceSlug}`);
      }

      results.push({
        sourceSlug,
        status: "succeeded",
        ...result,
      });
    } catch (error) {
      results.push({
        sourceSlug,
        status: "failed",
        itemsSeen: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsSkipped: 0,
        skippedByReason: createSkippedByReason(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return finishAggregateRefreshRun({
    repository: input.repository,
    results,
    runType: "crawler",
  });
};

export const refreshActiveRssSources = async (input: {
  repository: NewsRepository;
  fetchFeed?: (url: string) => Promise<string>;
  now?: Date;
}) => {
  const seedResult = await seedSources({ repository: input.repository });
  const ingestResult = await ingestActiveRssSources(input);

  return {
    sourcesSeeded: seedResult.created,
    ...ingestResult,
  };
};

export const refreshNewsSources = async (input: {
  repository: NewsRepository;
  fetchArxivPapers?: () => Promise<readonly ArxivAiPaper[]>;
  fetchFeed?: (url: string) => Promise<string>;
  fetchGitHubRepositories?: () => Promise<
    readonly GitHubTrendingAiRepository[]
  >;
  fetchHackerNewsStories?: () => Promise<readonly HackerNewsAiStory[]>;
  fetchYcCompanies?: () => Promise<readonly YcAiCompany[]>;
  now?: Date;
}) => {
  const seedResult = await seedSources({ repository: input.repository });
  const ingestResult = await ingestActiveNewsSources(input);

  return {
    sourcesSeeded: seedResult.created,
    ...ingestResult,
  };
};

export const embedPendingNewsItems = async (input: {
  repository: NewsRepository;
  provider: EmbeddingProvider;
  limit: number;
}) => {
  const items = await input.repository.findPendingEmbeddingItems(input.limit);
  let embedded = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const embeddingInput = buildEmbeddingInput(item);
      const result = await input.provider.embed(embeddingInput);
      await input.repository.insertNewsItemVector({
        newsItemId: item.id,
        provider: result.provider,
        model: result.model,
        dimension: result.dimension,
        contentHash: hashEmbeddingInput(embeddingInput),
        vectorRef: result.vectorRef,
        embedding: result.embedding,
      });
      await input.repository.updateEmbeddingStatus(item.id, "embedded");
      embedded += 1;
    } catch {
      await input.repository.updateEmbeddingStatus(item.id, "failed");
      failed += 1;
    }
  }

  return { embedded, failed };
};
