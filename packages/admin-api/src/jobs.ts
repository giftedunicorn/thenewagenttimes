import type { SQL } from "drizzle-orm";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod/v4";

import {
  BackgroundJob,
  backgroundJobStatusValues,
  backgroundJobTypeValues,
} from "@acme/db/schema";

import { adminProcedure, createTRPCRouter } from "./trpc";

const OVERDUE_JOB_MS = 2 * 60 * 60 * 1_000;

export const jobsListInput = z.strictObject({
  from: z.coerce.date().optional(),
  jobType: z.enum(backgroundJobTypeValues).optional(),
  page: z.number().int().nonnegative().default(0),
  pageSize: z.number().int().min(1).max(50).default(20),
  status: z.enum(backgroundJobStatusValues).optional(),
  to: z.coerce.date().optional(),
});

interface JobTimingInput {
  attempts: number;
  completedAt: string | null;
  createdAt: string;
  lockExpiresAt: string | null;
  maxAttempts: number;
  nextRunAt: string;
  startedAt: string | null;
  status: (typeof backgroundJobStatusValues)[number];
}

export const buildJobTiming = (job: JobTimingInput, now = new Date()) => {
  const createdAt = new Date(job.createdAt).getTime();
  const startedAt = job.startedAt ? new Date(job.startedAt).getTime() : null;
  const completedAt = job.completedAt
    ? new Date(job.completedAt).getTime()
    : null;
  const nextRunAt = new Date(job.nextRunAt).getTime();
  const lockExpiresAt = job.lockExpiresAt
    ? new Date(job.lockExpiresAt).getTime()
    : null;

  let state:
    | "complete"
    | "expired"
    | "overdue"
    | "retrying"
    | "running"
    | "scheduled";
  if (job.status === "succeeded" || job.status === "failed") {
    state = "complete";
  } else if (
    job.status === "running" &&
    lockExpiresAt !== null &&
    lockExpiresAt < now.getTime()
  ) {
    state = "expired";
  } else if (job.status === "running") {
    state = "running";
  } else if (job.attempts > 0 && job.attempts < job.maxAttempts) {
    state = "retrying";
  } else if (now.getTime() - nextRunAt > OVERDUE_JOB_MS) {
    state = "overdue";
  } else {
    state = "scheduled";
  }

  return {
    executionMs:
      startedAt === null
        ? null
        : Math.max(0, (completedAt ?? now.getTime()) - startedAt),
    queueWaitMs: startedAt === null ? null : Math.max(0, startedAt - createdAt),
    state,
  };
};

const toIso = (value: Date | null) => value?.toISOString() ?? null;

export const jobsRouter = createTRPCRouter({
  byId: adminProcedure
    .input(z.strictObject({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(BackgroundJob)
        .where(eq(BackgroundJob.id, input.id))
        .limit(1);
      const row = rows[0];
      if (!row) return null;

      const serialized = {
        ...row,
        completedAt: toIso(row.completedAt),
        createdAt: row.createdAt.toISOString(),
        errorMessage: row.errorMessage?.slice(0, 4_000) ?? null,
        lockExpiresAt: toIso(row.lockExpiresAt),
        lockedAt: toIso(row.lockedAt),
        nextRunAt: row.nextRunAt.toISOString(),
        startedAt: toIso(row.startedAt),
        updatedAt: row.updatedAt.toISOString(),
      };

      return {
        ...serialized,
        timing: buildJobTiming(serialized),
      };
    }),
  list: adminProcedure.input(jobsListInput).query(async ({ ctx, input }) => {
    const conditions: SQL[] = [];
    if (input.status) {
      conditions.push(eq(BackgroundJob.status, input.status));
    }
    if (input.jobType) {
      conditions.push(eq(BackgroundJob.jobType, input.jobType));
    }
    if (input.from) {
      conditions.push(gte(BackgroundJob.createdAt, input.from));
    }
    if (input.to) {
      conditions.push(lte(BackgroundJob.createdAt, input.to));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countRows] = await Promise.all([
      ctx.db
        .select({
          attempts: BackgroundJob.attempts,
          completedAt: BackgroundJob.completedAt,
          createdAt: BackgroundJob.createdAt,
          errorMessage: BackgroundJob.errorMessage,
          id: BackgroundJob.id,
          jobType: BackgroundJob.jobType,
          lockExpiresAt: BackgroundJob.lockExpiresAt,
          lockedBy: BackgroundJob.lockedBy,
          maxAttempts: BackgroundJob.maxAttempts,
          nextRunAt: BackgroundJob.nextRunAt,
          startedAt: BackgroundJob.startedAt,
          status: BackgroundJob.status,
          updatedAt: BackgroundJob.updatedAt,
        })
        .from(BackgroundJob)
        .where(where)
        .orderBy(desc(BackgroundJob.createdAt))
        .limit(input.pageSize)
        .offset(input.page * input.pageSize),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(BackgroundJob)
        .where(where),
    ]);

    return {
      items: rows.map((row) => {
        const serialized = {
          ...row,
          completedAt: toIso(row.completedAt),
          createdAt: row.createdAt.toISOString(),
          errorMessage: row.errorMessage?.slice(0, 4_000) ?? null,
          lockExpiresAt: toIso(row.lockExpiresAt),
          nextRunAt: row.nextRunAt.toISOString(),
          startedAt: toIso(row.startedAt),
          updatedAt: row.updatedAt.toISOString(),
        };

        return {
          ...serialized,
          timing: buildJobTiming(serialized),
        };
      }),
      total: countRows[0]?.count ?? 0,
    };
  }),
});
