import type {
  EmbeddingProvider,
  NewsRepository,
  NewsSourceInput,
} from "./types";
import { buildEmbeddingInput, hashEmbeddingInput } from "./embedding";
import { normalizeFeedItem } from "./normalize";
import { parseFeedXml } from "./rss";
import { initialNewsSources } from "./sources";

export const getActiveRssSourceSlugs = (
  sources: readonly NewsSourceInput[] = initialNewsSources,
) =>
  sources
    .filter((source) => source.isActive && source.feedUrl)
    .map((source) => source.slug);

export const seedSources = async (input: { repository: NewsRepository }) => {
  return input.repository.seedSources(initialNewsSources);
};

export const ingestRssSource = async (input: {
  repository: NewsRepository;
  sourceSlug: string;
  fetchFeed?: (url: string) => Promise<string>;
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
    let itemsCreated = 0;
    let itemsUpdated = 0;

    for (const item of rawItems) {
      const normalized = normalizeFeedItem({
        sourceId: source.id,
        sourceSlug: source.slug,
        item,
      });
      const result = await input.repository.upsertNewsItem(normalized);

      if (result === "created") itemsCreated += 1;
      if (result === "updated") itemsUpdated += 1;
    }

    await input.repository.finishIngestionRun({
      runId: run.id,
      status: "succeeded",
      itemsSeen: rawItems.length,
      itemsCreated,
      itemsUpdated,
      errorMessage: undefined,
    });

    return {
      itemsSeen: rawItems.length,
      itemsCreated,
      itemsUpdated,
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
}) => {
  const sourceSlugs = getActiveRssSourceSlugs();
  const results: {
    sourceSlug: string;
    status: "succeeded" | "failed";
    itemsSeen: number;
    itemsCreated: number;
    itemsUpdated: number;
    errorMessage?: string;
  }[] = [];

  for (const sourceSlug of sourceSlugs) {
    try {
      const result = await ingestRssSource({
        repository: input.repository,
        sourceSlug,
        fetchFeed: input.fetchFeed,
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
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    sourcesAttempted: results.length,
    sourcesSucceeded: results.filter((result) => result.status === "succeeded")
      .length,
    sourcesFailed: results.filter((result) => result.status === "failed")
      .length,
    itemsSeen: results.reduce((total, result) => total + result.itemsSeen, 0),
    itemsCreated: results.reduce(
      (total, result) => total + result.itemsCreated,
      0,
    ),
    itemsUpdated: results.reduce(
      (total, result) => total + result.itemsUpdated,
      0,
    ),
    results,
  };
};

export const refreshActiveRssSources = async (input: {
  repository: NewsRepository;
  fetchFeed?: (url: string) => Promise<string>;
}) => {
  const seedResult = await seedSources({ repository: input.repository });
  const ingestResult = await ingestActiveRssSources(input);

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
