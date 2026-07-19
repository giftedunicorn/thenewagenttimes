import type {
  EnqueueBackgroundJobInput,
  EnqueueBackgroundJobResult,
} from "@acme/db/background-jobs";
import type { BackgroundJobRow } from "@acme/db/schema";
import {
  NewsEmbedJobPayloadSchema,
  NewsRefreshJobPayloadSchema,
} from "@acme/db/schema";

export interface JobProcessorConfig {
  embedLimit: number;
}

export interface NewsEmbedResult {
  embedded: number;
  failed: number;
}

export interface NewsRefreshResult {
  itemsCreated: number;
  itemsSeen: number;
  itemsSkipped: number;
  itemsUpdated: number;
  sourcesAttempted: number;
  sourcesFailed: number;
  sourcesSeeded: number;
  sourcesSucceeded: number;
}

export interface JobProcessorDependencies {
  embed: (limit: number) => Promise<NewsEmbedResult>;
  enqueue: (
    input: EnqueueBackgroundJobInput,
  ) => Promise<EnqueueBackgroundJobResult>;
  refresh: () => Promise<NewsRefreshResult>;
}

const getEmbeddingEnqueueMetadata = (
  batch: number,
  dedupeKey: string,
  result: EnqueueBackgroundJobResult,
) => ({
  batch,
  dedupeKey,
  jobId: result.job.id,
  status: result.status,
});

export const createJobProcessor =
  (
    config: JobProcessorConfig,
    dependencies: JobProcessorDependencies,
  ): ((job: BackgroundJobRow) => Promise<Record<string, unknown>>) =>
  async (job) => {
    const jobType: string = job.jobType;

    if (jobType === "news_refresh") {
      NewsRefreshJobPayloadSchema.parse(job.payload);

      const refreshResult = await dependencies.refresh();
      const batch = 0;
      const dedupeKey = `news-embed:${job.id}:${batch}`;
      const enqueueResult = await dependencies.enqueue({
        dedupeKey,
        jobType: "news_embed",
        payload: {
          batch,
          limit: config.embedLimit,
          parentJobId: job.id,
        },
      });

      return {
        embeddingEnqueue: getEmbeddingEnqueueMetadata(
          batch,
          dedupeKey,
          enqueueResult,
        ),
        itemsCreated: refreshResult.itemsCreated,
        itemsSeen: refreshResult.itemsSeen,
        itemsSkipped: refreshResult.itemsSkipped,
        itemsUpdated: refreshResult.itemsUpdated,
        sourcesAttempted: refreshResult.sourcesAttempted,
        sourcesFailed: refreshResult.sourcesFailed,
        sourcesSeeded: refreshResult.sourcesSeeded,
        sourcesSucceeded: refreshResult.sourcesSucceeded,
      };
    }

    if (jobType === "news_embed") {
      const payload = NewsEmbedJobPayloadSchema.parse(job.payload);
      const embedResult = await dependencies.embed(payload.limit);
      const result: Record<string, unknown> = {
        batch: payload.batch,
        embedded: embedResult.embedded,
        failed: embedResult.failed,
      };

      if (
        embedResult.embedded + embedResult.failed !== payload.limit ||
        embedResult.failed !== 0
      ) {
        return result;
      }

      const batch = payload.batch + 1;
      const parentJobId = payload.parentJobId ?? job.id;
      const dedupeKey = `news-embed:${parentJobId}:${batch}`;
      const enqueueResult = await dependencies.enqueue({
        dedupeKey,
        jobType: "news_embed",
        payload: {
          batch,
          limit: payload.limit,
          parentJobId,
        },
      });

      return {
        ...result,
        embeddingEnqueue: getEmbeddingEnqueueMetadata(
          batch,
          dedupeKey,
          enqueueResult,
        ),
      };
    }

    throw new Error(`Unsupported background job type: ${jobType}`);
  };
