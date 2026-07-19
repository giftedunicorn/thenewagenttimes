import type { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { db as dbClient } from "./client";
import type {
  BackgroundJobRow,
  NewsEmbedJobPayload,
  NewsRefreshJobPayload,
} from "./schema";
import {
  claimNextBackgroundJob,
  completeBackgroundJob,
  enqueueBackgroundJob,
  failBackgroundJob,
  getBackgroundJobRetryDelayMs,
  renewBackgroundJobLease,
} from "./background-jobs";
import * as schema from "./schema";

type Database = typeof dbClient;

interface CapturedQuery {
  params: readonly unknown[];
  text: string;
}

const createJob = (
  overrides: Partial<BackgroundJobRow> = {},
): BackgroundJobRow => ({
  attempts: 0,
  completedAt: null,
  createdAt: new Date("2026-07-19T08:00:00.000Z"),
  dedupeKey: "news-refresh:2026-07-19T08:00:00Z",
  errorMessage: null,
  id: "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0",
  jobType: "news_refresh",
  lockedAt: null,
  lockedBy: null,
  lockExpiresAt: null,
  maxAttempts: 3,
  nextRunAt: new Date("2026-07-19T08:00:00.000Z"),
  payload: {
    requestedAt: "2026-07-19T08:00:00.000Z",
    trigger: "cron",
  },
  result: null,
  startedAt: null,
  status: "queued",
  updatedAt: new Date("2026-07-19T08:00:00.000Z"),
  ...overrides,
});

const toDriverRow = (job: BackgroundJobRow): unknown[] => [
  job.id,
  job.jobType,
  job.status,
  job.dedupeKey,
  job.payload,
  job.result,
  job.attempts,
  job.maxAttempts,
  job.nextRunAt,
  job.lockedBy,
  job.lockedAt,
  job.lockExpiresAt,
  job.startedAt,
  job.completedAt,
  job.errorMessage,
  job.createdAt,
  job.updatedAt,
];

const createDatabase = (responses: unknown[][][]) => {
  const queries: CapturedQuery[] = [];
  const pendingResponses = [...responses];
  const query = vi.fn(
    (
      queryConfig: string | { text: string },
      params: readonly unknown[] = [],
    ) => {
      const text =
        typeof queryConfig === "string" ? queryConfig : queryConfig.text;
      queries.push({ params, text });

      const normalizedText = text.trim().toLowerCase();
      const rows =
        normalizedText === "begin" ||
        normalizedText === "commit" ||
        normalizedText === "rollback" ||
        normalizedText.includes("pg_advisory_xact_lock")
          ? []
          : (pendingResponses.shift() ?? []);

      return Promise.resolve({
        command: "",
        fields: [],
        oid: 0,
        rowCount: rows.length,
        rows,
      });
    },
  );
  const database = drizzle({
    casing: "snake_case",
    client: { query } as unknown as Pool,
    schema,
  }) as unknown as Database;

  return { database, queries };
};

const dataQueries = (queries: CapturedQuery[]) =>
  queries.filter(
    ({ text }) =>
      !["begin", "commit", "rollback"].includes(text.trim().toLowerCase()) &&
      !text.toLowerCase().includes("pg_advisory_xact_lock"),
  );

describe("background job retry delay", () => {
  it("uses a capped exponential schedule based on current attempts", () => {
    expect(getBackgroundJobRetryDelayMs(1)).toBe(1_000);
    expect(getBackgroundJobRetryDelayMs(2)).toBe(2_000);
    expect(getBackgroundJobRetryDelayMs(3)).toBe(4_000);
    expect(getBackgroundJobRetryDelayMs(100)).toBe(3_600_000);
  });
});

describe("enqueueBackgroundJob", () => {
  it("discriminates payloads by job type", () => {
    type EnqueueInput = Parameters<typeof enqueueBackgroundJob>[1];

    expectTypeOf<
      Extract<EnqueueInput, { jobType: "news_refresh" }>["payload"]
    >().toEqualTypeOf<NewsRefreshJobPayload>();
    expectTypeOf<
      Extract<EnqueueInput, { jobType: "news_embed" }>["payload"]
    >().toEqualTypeOf<NewsEmbedJobPayload>();
  });

  it("inserts a typed queued job and reports it as queued", async () => {
    const job = createJob();
    const { database, queries } = createDatabase([[toDriverRow(job)]]);

    const result = await enqueueBackgroundJob(database, {
      dedupeKey: job.dedupeKey,
      jobType: "news_refresh",
      payload: {
        requestedAt: "2026-07-19T08:00:00.000Z",
        trigger: "cron",
      },
    });

    expect(result).toEqual({ job, status: "queued" });
    expect(dataQueries(queries)).toHaveLength(1);
    expect(dataQueries(queries)[0]?.text).toContain(
      'on conflict ("dedupe_key") do nothing',
    );
    expect(dataQueries(queries)[0]?.params).toEqual(
      expect.arrayContaining([
        "news_refresh",
        "queued",
        job.dedupeKey,
        JSON.stringify(job.payload),
      ]),
    );

    expectTypeOf(result.job.payload).toEqualTypeOf<Record<string, unknown>>();
  });

  it("returns the existing row when the dedupe key already exists", async () => {
    const existingJob = createJob({
      id: "3ac9b3f6-6936-4795-a20a-bf861c9201dc",
    });
    const { database, queries } = createDatabase([
      [],
      [toDriverRow(existingJob)],
    ]);

    const result = await enqueueBackgroundJob(database, {
      dedupeKey: existingJob.dedupeKey,
      jobType: "news_refresh",
      payload: {
        requestedAt: "2026-07-19T08:00:00.000Z",
        trigger: "cron",
      },
    });

    expect(result).toEqual({ job: existingJob, status: "duplicate" });
    expect(dataQueries(queries)).toHaveLength(2);
    expect(dataQueries(queries)[1]?.text).toContain(
      'where "background_job"."dedupe_key" = $1',
    );
  });
});

describe("claimNextBackgroundJob", () => {
  it("claims the oldest eligible job in one skip-locked transaction", async () => {
    const now = new Date("2026-07-19T08:05:00.000Z");
    const queuedJob = createJob();
    const claimedJob = createJob({
      attempts: 1,
      lockedAt: now,
      lockedBy: "worker-1",
      lockExpiresAt: new Date("2026-07-19T08:06:00.000Z"),
      startedAt: now,
      status: "running",
      updatedAt: now,
    });
    const { database, queries } = createDatabase([
      [],
      [toDriverRow(queuedJob)],
      [toDriverRow(claimedJob)],
    ]);

    const result = await claimNextBackgroundJob(database, {
      leaseDurationMs: 60_000,
      now,
      workerId: "worker-1",
    });

    expect(result).toEqual(claimedJob);
    expect(queries.map(({ text }) => text.trim().toLowerCase())).toEqual([
      "begin",
      expect.stringContaining("pg_advisory_xact_lock"),
      expect.stringContaining("update"),
      expect.stringContaining("select"),
      expect.stringContaining("update"),
      "commit",
    ]);

    const [terminalizeQuery, selectQuery, updateQuery] = dataQueries(queries);
    expect(terminalizeQuery?.params).toEqual(
      expect.arrayContaining([
        "failed",
        "Worker lease expired after maximum attempts",
        now.toISOString(),
      ]),
    );
    expect(selectQuery?.text).toContain("for update skip locked");
    expect(selectQuery?.text).toContain("not exists");
    expect(selectQuery?.text).toContain('"active_background_job"');
    expect(selectQuery?.text).toContain(
      '"background_job"."attempts" < "background_job"."max_attempts"',
    );
    expect(selectQuery?.text).toContain(
      'order by "background_job"."created_at" asc',
    );
    expect(selectQuery?.params).toEqual(
      expect.arrayContaining(["queued", "running", now.toISOString()]),
    );
    expect(updateQuery?.params).toEqual(
      expect.arrayContaining([
        "running",
        1,
        "worker-1",
        now.toISOString(),
        "2026-07-19T08:06:00.000Z",
      ]),
    );
  });

  it("preserves the original start time when reclaiming an expired job", async () => {
    const now = new Date("2026-07-19T08:05:00.000Z");
    const originalStartedAt = new Date("2026-07-19T08:01:00.000Z");
    const expiredJob = createJob({
      attempts: 1,
      lockedAt: new Date("2026-07-19T08:01:00.000Z"),
      lockedBy: "dead-worker",
      lockExpiresAt: new Date("2026-07-19T08:02:00.000Z"),
      startedAt: originalStartedAt,
      status: "running",
    });
    const reclaimedJob = createJob({
      attempts: 2,
      lockedAt: now,
      lockedBy: "worker-2",
      lockExpiresAt: new Date("2026-07-19T08:06:00.000Z"),
      startedAt: originalStartedAt,
      status: "running",
      updatedAt: now,
    });
    const { database, queries } = createDatabase([
      [],
      [toDriverRow(expiredJob)],
      [toDriverRow(reclaimedJob)],
    ]);

    const result = await claimNextBackgroundJob(database, {
      leaseDurationMs: 60_000,
      now,
      workerId: "worker-2",
    });

    expect(result).toEqual(reclaimedJob);
    expect(dataQueries(queries)[2]?.params).toContain(
      originalStartedAt.toISOString(),
    );
    expect(dataQueries(queries)[1]?.text).toContain(
      '"background_job"."attempts" < "background_job"."max_attempts"',
    );
  });

  it("returns null without updating when no job is eligible", async () => {
    const { database, queries } = createDatabase([[], []]);

    const result = await claimNextBackgroundJob(database, {
      leaseDurationMs: 60_000,
      now: new Date("2026-07-19T08:05:00.000Z"),
      workerId: "worker-1",
    });

    expect(result).toBeNull();
    expect(queries.map(({ text }) => text.trim().toLowerCase())).toEqual([
      "begin",
      expect.stringContaining("pg_advisory_xact_lock"),
      expect.stringContaining("update"),
      expect.stringContaining("select"),
      "commit",
    ]);
  });

  it("terminalizes an expired job that exhausted its attempts", async () => {
    const now = new Date("2026-07-19T08:05:00.000Z");
    const { database, queries } = createDatabase([[], []]);

    const result = await claimNextBackgroundJob(database, {
      leaseDurationMs: 60_000,
      now,
      workerId: "worker-2",
    });

    expect(result).toBeNull();
    const [terminalizeQuery, selectQuery] = dataQueries(queries);
    expect(terminalizeQuery?.text).toContain(
      '"background_job"."attempts" >= "background_job"."max_attempts"',
    );
    expect(terminalizeQuery?.text).toContain(
      '"background_job"."lock_expires_at" <=',
    );
    expect(terminalizeQuery?.params).toEqual(
      expect.arrayContaining([
        "failed",
        null,
        now.toISOString(),
        "Worker lease expired after maximum attempts",
        "running",
      ]),
    );
    expect(selectQuery?.text).toContain(
      '"background_job"."attempts" < "background_job"."max_attempts"',
    );
    expect(selectQuery?.text).toContain("for update skip locked");
  });
});

describe("lease-owned transitions", () => {
  it("renews a lease only when the running job belongs to the worker", async () => {
    const now = new Date("2026-07-19T08:05:00.000Z");
    const lockedAt = new Date("2026-07-19T08:04:00.000Z");
    const owned = createDatabase([[["6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0"]]]);
    const stale = createDatabase([[]]);

    await expect(
      renewBackgroundJobLease(owned.database, {
        jobId: "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0",
        leaseDurationMs: 60_000,
        lockedAt,
        now,
        workerId: "worker-1",
      }),
    ).resolves.toBe(true);
    await expect(
      renewBackgroundJobLease(stale.database, {
        jobId: "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0",
        leaseDurationMs: 60_000,
        lockedAt,
        now,
        workerId: "stale-worker",
      }),
    ).resolves.toBe(false);

    expect(dataQueries(owned.queries)[0]?.params).toEqual(
      expect.arrayContaining([
        "2026-07-19T08:06:00.000Z",
        "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0",
        "running",
        "worker-1",
        lockedAt.toISOString(),
        now.toISOString(),
      ]),
    );
    expect(dataQueries(owned.queries)[0]?.text).toContain(
      '"background_job"."lock_expires_at" >',
    );
  });

  it("completes an owned job and clears its lease and previous error", async () => {
    const now = new Date("2026-07-19T08:05:00.000Z");
    const lockedAt = new Date("2026-07-19T08:04:00.000Z");
    const result = { itemsCreated: 12, sourcesProcessed: 4 };
    const { database, queries } = createDatabase([
      [["6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0"]],
    ]);

    await expect(
      completeBackgroundJob(database, {
        jobId: "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0",
        lockedAt,
        now,
        result,
        workerId: "worker-1",
      }),
    ).resolves.toBe(true);

    expect(dataQueries(queries)[0]?.params).toEqual(
      expect.arrayContaining([
        "succeeded",
        JSON.stringify(result),
        null,
        now.toISOString(),
        "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0",
        "running",
        "worker-1",
        lockedAt.toISOString(),
        now.toISOString(),
      ]),
    );
    expect(dataQueries(queries)[0]?.text).toContain(
      '"background_job"."lock_expires_at" >',
    );
  });

  it("rejects renew, completion, and failure after the lease expires", async () => {
    const lockedAt = new Date("2026-07-19T08:04:00.000Z");
    const now = new Date("2026-07-19T08:05:00.000Z");
    const renew = createDatabase([[]]);
    const complete = createDatabase([[]]);
    const fail = createDatabase([[]]);

    await expect(
      renewBackgroundJobLease(renew.database, {
        jobId: "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0",
        leaseDurationMs: 60_000,
        lockedAt,
        now,
        workerId: "worker-1",
      }),
    ).resolves.toBe(false);
    await expect(
      completeBackgroundJob(complete.database, {
        jobId: "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0",
        lockedAt,
        now,
        result: {},
        workerId: "worker-1",
      }),
    ).resolves.toBe(false);
    await expect(
      failBackgroundJob(fail.database, {
        error: "late failure",
        jobId: "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0",
        lockedAt,
        now,
        workerId: "worker-1",
      }),
    ).resolves.toBe(false);

    for (const query of [
      dataQueries(renew.queries)[0],
      dataQueries(complete.queries)[0],
      dataQueries(fail.queries)[0],
    ]) {
      expect(query?.text).toContain('"background_job"."lock_expires_at" >');
      expect(query?.params).toEqual(
        expect.arrayContaining([lockedAt.toISOString(), now.toISOString()]),
      );
    }
  });

  it("rejects an older claim token when the worker ID is reused", async () => {
    const oldLockedAt = new Date("2026-07-19T08:03:00.000Z");
    const now = new Date("2026-07-19T08:05:00.000Z");
    const renew = createDatabase([[]]);
    const complete = createDatabase([[]]);
    const fail = createDatabase([[]]);

    await expect(
      renewBackgroundJobLease(renew.database, {
        jobId: "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0",
        leaseDurationMs: 60_000,
        lockedAt: oldLockedAt,
        now,
        workerId: "worker-1",
      }),
    ).resolves.toBe(false);
    await expect(
      completeBackgroundJob(complete.database, {
        jobId: "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0",
        lockedAt: oldLockedAt,
        now,
        result: {},
        workerId: "worker-1",
      }),
    ).resolves.toBe(false);
    await expect(
      failBackgroundJob(fail.database, {
        error: "stale generation",
        jobId: "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0",
        lockedAt: oldLockedAt,
        now,
        workerId: "worker-1",
      }),
    ).resolves.toBe(false);

    for (const query of [
      dataQueries(renew.queries)[0],
      dataQueries(complete.queries)[0],
      dataQueries(fail.queries)[0],
    ]) {
      expect(query?.text).toContain('"background_job"."locked_at" =');
      expect(query?.params).toContain(oldLockedAt.toISOString());
    }
  });
});

describe("failBackgroundJob", () => {
  it("requeues an owned job with backoff and a bounded error", async () => {
    const now = new Date("2026-07-19T08:05:00.000Z");
    const lockedAt = new Date("2026-07-19T08:04:00.000Z");
    const longError = "x".repeat(5_000);
    const { database, queries } = createDatabase([
      [[1, 3]],
      [["6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0"]],
    ]);

    await expect(
      failBackgroundJob(database, {
        error: new Error(longError),
        jobId: "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0",
        lockedAt,
        now,
        workerId: "worker-1",
      }),
    ).resolves.toBe(true);

    const [selectQuery, updateQuery] = dataQueries(queries);
    expect(selectQuery?.text).toContain("for update");
    expect(selectQuery?.params).toEqual(
      expect.arrayContaining([
        "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0",
        "running",
        "worker-1",
        lockedAt.toISOString(),
        now.toISOString(),
      ]),
    );
    expect(selectQuery?.text).toContain('"background_job"."lock_expires_at" >');
    expect(updateQuery?.params).toEqual(
      expect.arrayContaining([
        "queued",
        "2026-07-19T08:05:01.000Z",
        null,
        "x".repeat(4_000),
      ]),
    );
  });

  it("marks the job failed when its attempts are exhausted", async () => {
    const now = new Date("2026-07-19T08:05:00.000Z");
    const lockedAt = new Date("2026-07-19T08:04:00.000Z");
    const { database, queries } = createDatabase([
      [[3, 3]],
      [["6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0"]],
    ]);

    await expect(
      failBackgroundJob(database, {
        error: "processor failed",
        jobId: "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0",
        lockedAt,
        now,
        workerId: "worker-1",
      }),
    ).resolves.toBe(true);

    expect(dataQueries(queries)[1]?.params).toEqual(
      expect.arrayContaining([
        "failed",
        now.toISOString(),
        "processor failed",
        null,
      ]),
    );
  });

  it("does not fail a job no longer owned by the worker", async () => {
    const { database, queries } = createDatabase([[]]);
    const lockedAt = new Date("2026-07-19T08:04:00.000Z");

    await expect(
      failBackgroundJob(database, {
        error: "late failure",
        jobId: "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0",
        lockedAt,
        now: new Date("2026-07-19T08:05:00.000Z"),
        workerId: "stale-worker",
      }),
    ).resolves.toBe(false);

    expect(dataQueries(queries)).toHaveLength(1);
  });
});
