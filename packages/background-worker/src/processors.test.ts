import { describe, expect, it } from "vitest";

import type { EnqueueBackgroundJobInput } from "@acme/db/background-jobs";
import type { BackgroundJobRow } from "@acme/db/schema";

import type { JobProcessorDependencies } from "./processors";
import { createJobProcessor } from "./processors";

const refreshJobId = "11111111-1111-4111-8111-111111111111";
const embedJobId = "22222222-2222-4222-8222-222222222222";
const nextEmbedJobId = "33333333-3333-4333-8333-333333333333";
const timestamp = new Date("2026-07-19T00:00:00.000Z");

const refreshResult = {
  diagnostic: new Error("must not be persisted"),
  itemsCreated: 4,
  itemsSeen: 5,
  itemsSkipped: 1,
  itemsUpdated: 0,
  sourcesAttempted: 1,
  sourcesFailed: 0,
  sourcesSeeded: 1,
  sourcesSucceeded: 1,
};

const createJob = (
  overrides: Partial<BackgroundJobRow> = {},
): BackgroundJobRow => ({
  attempts: 1,
  completedAt: null,
  createdAt: timestamp,
  dedupeKey: `test-job:${refreshJobId}`,
  errorMessage: null,
  id: refreshJobId,
  jobType: "news_refresh",
  lockedAt: timestamp,
  lockedBy: "worker-one",
  lockExpiresAt: new Date("2026-07-19T00:05:00.000Z"),
  maxAttempts: 3,
  nextRunAt: timestamp,
  payload: {
    requestedAt: "2026-07-19T00:00:00.000Z",
    trigger: "cron",
  },
  result: null,
  startedAt: timestamp,
  status: "running",
  updatedAt: timestamp,
  ...overrides,
});

const createDependencies = (
  overrides: Partial<JobProcessorDependencies> = {},
): JobProcessorDependencies => ({
  embed: () => Promise.resolve({ embedded: 0, failed: 0 }),
  enqueue: (input) =>
    Promise.resolve({
      job: createJob({
        dedupeKey: input.dedupeKey,
        id: embedJobId,
        jobType: input.jobType,
        payload: input.payload,
        status: "queued",
      }),
      status: "queued",
    }),
  refresh: () => Promise.resolve(refreshResult),
  ...overrides,
});

describe("createJobProcessor", () => {
  it("refreshes once and reports a duplicate initial embedding enqueue", async () => {
    let refreshCalls = 0;
    const enqueueCalls: EnqueueBackgroundJobInput[] = [];
    const processor = createJobProcessor(
      { embedLimit: 25 },
      createDependencies({
        enqueue: (input) => {
          enqueueCalls.push(input);
          return Promise.resolve({
            job: createJob({
              dedupeKey: input.dedupeKey,
              id: embedJobId,
              jobType: input.jobType,
              payload: input.payload,
              status: "queued",
            }),
            status: "duplicate",
          });
        },
        refresh: () => {
          refreshCalls += 1;
          return Promise.resolve(refreshResult);
        },
      }),
    );

    await expect(processor(createJob())).resolves.toEqual({
      embeddingEnqueue: {
        batch: 0,
        dedupeKey: `news-embed:${refreshJobId}:0`,
        jobId: embedJobId,
        status: "duplicate",
      },
      itemsCreated: 4,
      itemsSeen: 5,
      itemsSkipped: 1,
      itemsUpdated: 0,
      sourcesAttempted: 1,
      sourcesFailed: 0,
      sourcesSeeded: 1,
      sourcesSucceeded: 1,
    });
    expect(refreshCalls).toBe(1);
    expect(enqueueCalls).toEqual([
      {
        dedupeKey: `news-embed:${refreshJobId}:0`,
        jobType: "news_embed",
        payload: {
          batch: 0,
          limit: 25,
          parentJobId: refreshJobId,
        },
      },
    ]);
  });

  it("embeds with the validated payload limit and stops after a partial batch", async () => {
    const embedLimits: number[] = [];
    const enqueueCalls: EnqueueBackgroundJobInput[] = [];
    const processor = createJobProcessor(
      { embedLimit: 25 },
      createDependencies({
        embed: (limit) => {
          embedLimits.push(limit);
          return Promise.resolve({ embedded: 6, failed: 0 });
        },
        enqueue: (input) => {
          enqueueCalls.push(input);
          return Promise.reject(new Error("unexpected enqueue"));
        },
      }),
    );

    await expect(
      processor(
        createJob({
          id: embedJobId,
          jobType: "news_embed",
          payload: { batch: 3, limit: 10, parentJobId: refreshJobId },
        }),
      ),
    ).resolves.toEqual({ batch: 3, embedded: 6, failed: 0 });
    expect(embedLimits).toEqual([10]);
    expect(enqueueCalls).toEqual([]);
  });

  it("chains the next batch after a full successful embedding batch", async () => {
    const enqueueCalls: EnqueueBackgroundJobInput[] = [];
    const processor = createJobProcessor(
      { embedLimit: 25 },
      createDependencies({
        embed: () => Promise.resolve({ embedded: 10, failed: 0 }),
        enqueue: (input) => {
          enqueueCalls.push(input);
          return Promise.resolve({
            job: createJob({
              dedupeKey: input.dedupeKey,
              id: nextEmbedJobId,
              jobType: input.jobType,
              payload: input.payload,
              status: "queued",
            }),
            status: "queued",
          });
        },
      }),
    );

    await expect(
      processor(
        createJob({
          id: embedJobId,
          jobType: "news_embed",
          payload: { batch: 3, limit: 10, parentJobId: refreshJobId },
        }),
      ),
    ).resolves.toEqual({
      batch: 3,
      embedded: 10,
      failed: 0,
      embeddingEnqueue: {
        batch: 4,
        dedupeKey: `news-embed:${refreshJobId}:4`,
        jobId: nextEmbedJobId,
        status: "queued",
      },
    });
    expect(enqueueCalls).toEqual([
      {
        dedupeKey: `news-embed:${refreshJobId}:4`,
        jobType: "news_embed",
        payload: {
          batch: 4,
          limit: 10,
          parentJobId: refreshJobId,
        },
      },
    ]);
  });

  it("uses the current job as the stable root when no parent is present", async () => {
    const enqueueCalls: EnqueueBackgroundJobInput[] = [];
    const processor = createJobProcessor(
      { embedLimit: 25 },
      createDependencies({
        embed: () => Promise.resolve({ embedded: 10, failed: 0 }),
        enqueue: (input) => {
          enqueueCalls.push(input);
          return Promise.resolve({
            job: createJob({
              id: nextEmbedJobId,
              jobType: input.jobType,
              payload: input.payload,
            }),
            status: "duplicate",
          });
        },
      }),
    );

    await processor(
      createJob({
        id: embedJobId,
        jobType: "news_embed",
        payload: { batch: 0, limit: 10 },
      }),
    );

    expect(enqueueCalls).toEqual([
      {
        dedupeKey: `news-embed:${embedJobId}:1`,
        jobType: "news_embed",
        payload: {
          batch: 1,
          limit: 10,
          parentJobId: embedJobId,
        },
      },
    ]);
  });

  it("does not chain a full batch containing failures", async () => {
    const enqueueCalls: EnqueueBackgroundJobInput[] = [];
    const processor = createJobProcessor(
      { embedLimit: 25 },
      createDependencies({
        embed: () => Promise.resolve({ embedded: 9, failed: 1 }),
        enqueue: (input) => {
          enqueueCalls.push(input);
          return Promise.reject(new Error("unexpected enqueue"));
        },
      }),
    );

    await expect(
      processor(
        createJob({
          id: embedJobId,
          jobType: "news_embed",
          payload: { batch: 2, limit: 10, parentJobId: refreshJobId },
        }),
      ),
    ).resolves.toEqual({ batch: 2, embedded: 9, failed: 1 });
    expect(enqueueCalls).toEqual([]);
  });

  it.each([
    {
      jobType: "news_refresh" as const,
      payload: { requestedAt: "not-a-date", trigger: "cron" },
    },
    {
      jobType: "news_embed" as const,
      payload: { batch: 0, limit: 0 },
    },
  ])("rejects an invalid $jobType payload", async ({ jobType, payload }) => {
    const processor = createJobProcessor(
      { embedLimit: 25 },
      createDependencies(),
    );

    await expect(processor(createJob({ jobType, payload }))).rejects.toThrow();
  });

  it("rejects an unsupported runtime job type clearly", async () => {
    const processor = createJobProcessor(
      { embedLimit: 25 },
      createDependencies(),
    );
    const corruptJob = {
      ...createJob(),
      jobType: "corrupt_job_type",
    } as unknown as BackgroundJobRow;

    await expect(processor(corruptJob)).rejects.toThrow(
      "Unsupported background job type: corrupt_job_type",
    );
  });
});
