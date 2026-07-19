import {
  and,
  asc,
  eq,
  gt,
  gte,
  lt,
  lte,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { db as dbClient } from "./client";
import type {
  BackgroundJobPayloadByType,
  BackgroundJobRow,
  BackgroundJobType,
} from "./schema";
import { BackgroundJob } from "./schema";

type Database = typeof dbClient;

const RETRY_BASE_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 60 * 60 * 1_000;
const MAX_ERROR_MESSAGE_LENGTH = 4_000;
const EXHAUSTED_LEASE_ERROR = "Worker lease expired after maximum attempts";

interface EnqueueBackgroundJobOptions {
  dedupeKey: string;
  maxAttempts?: number;
  nextRunAt?: Date;
}

export type EnqueueBackgroundJobInput = {
  [TJobType in BackgroundJobType]: EnqueueBackgroundJobOptions & {
    jobType: TJobType;
    payload: BackgroundJobPayloadByType[TJobType];
  };
}[BackgroundJobType];

export interface ClaimNextBackgroundJobInput {
  leaseDurationMs: number;
  now?: Date;
  workerId: string;
}

interface BackgroundJobOwnershipInput {
  jobId: string;
  lockedAt: Date;
  now?: Date;
  workerId: string;
}

export interface RenewBackgroundJobLeaseInput
  extends BackgroundJobOwnershipInput {
  leaseDurationMs: number;
}

export interface CompleteBackgroundJobInput
  extends BackgroundJobOwnershipInput {
  result: Record<string, unknown>;
}

export interface FailBackgroundJobInput extends BackgroundJobOwnershipInput {
  error: unknown;
}

export interface EnqueueBackgroundJobResult {
  job: BackgroundJobRow;
  status: "queued" | "duplicate";
}

export const getBackgroundJobRetryDelayMs = (attempts: number) =>
  Math.min(
    RETRY_BASE_DELAY_MS * 2 ** Math.max(0, Math.floor(attempts) - 1),
    RETRY_MAX_DELAY_MS,
  );

const getLeaseExpiry = (now: Date, leaseDurationMs: number) =>
  new Date(now.getTime() + leaseDurationMs);

const getBackgroundJobOwnershipCondition = (
  input: BackgroundJobOwnershipInput,
  now: Date,
) =>
  and(
    eq(BackgroundJob.id, input.jobId),
    eq(BackgroundJob.status, "running"),
    eq(BackgroundJob.lockedBy, input.workerId),
    eq(BackgroundJob.lockedAt, input.lockedAt),
    gt(BackgroundJob.lockExpiresAt, now),
  );

const getBoundedErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, MAX_ERROR_MESSAGE_LENGTH);
};

export const enqueueBackgroundJob = async (
  database: Database,
  input: EnqueueBackgroundJobInput,
): Promise<EnqueueBackgroundJobResult> => {
  const [insertedJob] = await database
    .insert(BackgroundJob)
    .values({
      dedupeKey: input.dedupeKey,
      jobType: input.jobType,
      payload: input.payload,
      status: "queued",
      ...(input.maxAttempts === undefined
        ? {}
        : { maxAttempts: input.maxAttempts }),
      ...(input.nextRunAt === undefined ? {} : { nextRunAt: input.nextRunAt }),
    })
    .onConflictDoNothing({ target: BackgroundJob.dedupeKey })
    .returning();

  if (insertedJob) {
    return { job: insertedJob, status: "queued" };
  }

  const [existingJob] = await database
    .select()
    .from(BackgroundJob)
    .where(eq(BackgroundJob.dedupeKey, input.dedupeKey))
    .limit(1);

  if (!existingJob) {
    throw new Error("Background job dedupe conflict row was not found");
  }

  return { job: existingJob, status: "duplicate" };
};

export const claimNextBackgroundJob = async (
  database: Database,
  input: ClaimNextBackgroundJobInput,
): Promise<BackgroundJobRow | null> => {
  const now = input.now ?? new Date();

  return database.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(1414677844, 1111704133)`,
    );

    await transaction
      .update(BackgroundJob)
      .set({
        completedAt: now,
        errorMessage: getBoundedErrorMessage(EXHAUSTED_LEASE_ERROR),
        lockedAt: null,
        lockedBy: null,
        lockExpiresAt: null,
        status: "failed",
        updatedAt: now,
      })
      .where(
        and(
          eq(BackgroundJob.status, "running"),
          lte(BackgroundJob.lockExpiresAt, now),
          gte(BackgroundJob.attempts, BackgroundJob.maxAttempts),
        ),
      );

    const ActiveBackgroundJob = alias(BackgroundJob, "active_background_job");
    const [job] = await transaction
      .select()
      .from(BackgroundJob)
      .where(
        and(
          or(
            and(
              eq(BackgroundJob.status, "queued"),
              lte(BackgroundJob.nextRunAt, now),
            ),
            and(
              eq(BackgroundJob.status, "running"),
              lte(BackgroundJob.lockExpiresAt, now),
              lt(BackgroundJob.attempts, BackgroundJob.maxAttempts),
            ),
          ),
          notExists(
            transaction
              .select({ id: ActiveBackgroundJob.id })
              .from(ActiveBackgroundJob)
              .where(
                and(
                  eq(ActiveBackgroundJob.status, "running"),
                  gt(ActiveBackgroundJob.lockExpiresAt, now),
                ),
              ),
          ),
        ),
      )
      .orderBy(asc(BackgroundJob.createdAt), asc(BackgroundJob.id))
      .limit(1)
      .for("update", { skipLocked: true });

    if (!job) return null;

    const [claimedJob] = await transaction
      .update(BackgroundJob)
      .set({
        attempts: job.attempts + 1,
        lockedAt: now,
        lockedBy: input.workerId,
        lockExpiresAt: getLeaseExpiry(now, input.leaseDurationMs),
        startedAt: job.startedAt ?? now,
        status: "running",
        updatedAt: now,
      })
      .where(eq(BackgroundJob.id, job.id))
      .returning();

    return claimedJob ?? null;
  });
};

export const renewBackgroundJobLease = async (
  database: Database,
  input: RenewBackgroundJobLeaseInput,
) => {
  const now = input.now ?? new Date();
  const [renewedJob] = await database
    .update(BackgroundJob)
    .set({
      lockExpiresAt: getLeaseExpiry(now, input.leaseDurationMs),
      updatedAt: now,
    })
    .where(getBackgroundJobOwnershipCondition(input, now))
    .returning({ id: BackgroundJob.id });

  return renewedJob !== undefined;
};

export const completeBackgroundJob = async (
  database: Database,
  input: CompleteBackgroundJobInput,
) => {
  const now = input.now ?? new Date();
  const [completedJob] = await database
    .update(BackgroundJob)
    .set({
      completedAt: now,
      errorMessage: null,
      lockedAt: null,
      lockedBy: null,
      lockExpiresAt: null,
      result: input.result,
      status: "succeeded",
      updatedAt: now,
    })
    .where(getBackgroundJobOwnershipCondition(input, now))
    .returning({ id: BackgroundJob.id });

  return completedJob !== undefined;
};

export const failBackgroundJob = async (
  database: Database,
  input: FailBackgroundJobInput,
) => {
  const now = input.now ?? new Date();

  return database.transaction(async (transaction) => {
    const ownershipCondition = getBackgroundJobOwnershipCondition(input, now);
    const [job] = await transaction
      .select({
        attempts: BackgroundJob.attempts,
        maxAttempts: BackgroundJob.maxAttempts,
      })
      .from(BackgroundJob)
      .where(ownershipCondition)
      .limit(1)
      .for("update");

    if (!job) return false;

    const shouldRetry = job.attempts < job.maxAttempts;
    const [failedJob] = await transaction
      .update(BackgroundJob)
      .set({
        completedAt: shouldRetry ? null : now,
        errorMessage: getBoundedErrorMessage(input.error),
        lockedAt: null,
        lockedBy: null,
        lockExpiresAt: null,
        ...(shouldRetry
          ? {
              nextRunAt: new Date(
                now.getTime() + getBackgroundJobRetryDelayMs(job.attempts),
              ),
              status: "queued" as const,
            }
          : { status: "failed" as const }),
        updatedAt: now,
      })
      .where(ownershipCondition)
      .returning({ id: BackgroundJob.id });

    return failedJob !== undefined;
  });
};
