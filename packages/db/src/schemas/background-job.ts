import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const backgroundJobTypeValues = ["news_refresh", "news_embed"] as const;

export const backgroundJobStatusValues = [
  "queued",
  "running",
  "succeeded",
  "failed",
] as const;

export const BackgroundJobTypeEnum = pgEnum(
  "background_job_type",
  backgroundJobTypeValues,
);

export const BackgroundJobStatusEnum = pgEnum(
  "background_job_status",
  backgroundJobStatusValues,
);

export const BackgroundJob = pgTable(
  "background_job",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    jobType: BackgroundJobTypeEnum().notNull(),
    status: BackgroundJobStatusEnum().default("queued").notNull(),
    dedupeKey: t.varchar({ length: 320 }).notNull(),
    payload: t
      .jsonb()
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    result: t.jsonb().$type<Record<string, unknown>>(),
    attempts: t.integer().default(0).notNull(),
    maxAttempts: t.integer().default(3).notNull(),
    nextRunAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    lockedBy: t.varchar({ length: 160 }),
    lockedAt: t.timestamp({ mode: "date", withTimezone: true }),
    lockExpiresAt: t.timestamp({ mode: "date", withTimezone: true }),
    startedAt: t.timestamp({ mode: "date", withTimezone: true }),
    completedAt: t.timestamp({ mode: "date", withTimezone: true }),
    errorMessage: t.text(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  }),
  (table) => [
    uniqueIndex("background_job_dedupe_key_idx").on(table.dedupeKey),
    index("background_job_status_next_run_at_idx").on(
      table.status,
      table.nextRunAt,
    ),
    index("background_job_status_lock_expires_at_idx").on(
      table.status,
      table.lockExpiresAt,
    ),
  ],
);

export const BackgroundJobTypeSchema = z.enum(backgroundJobTypeValues);
export const BackgroundJobStatusSchema = z.enum(backgroundJobStatusValues);

export const NewsRefreshJobPayloadSchema = z.strictObject({
  requestedAt: z.string().datetime(),
  trigger: z.enum(["cron", "manual"]),
});

export const NewsEmbedJobPayloadSchema = z.strictObject({
  batch: z.number().int().nonnegative(),
  limit: z.number().int().min(1).max(100),
  parentJobId: z.string().uuid().optional(),
});

export type BackgroundJobRow = typeof BackgroundJob.$inferSelect;
export type BackgroundJobType = z.infer<typeof BackgroundJobTypeSchema>;
export type BackgroundJobStatus = z.infer<typeof BackgroundJobStatusSchema>;
export type NewsRefreshJobPayload = z.infer<typeof NewsRefreshJobPayloadSchema>;
export type NewsEmbedJobPayload = z.infer<typeof NewsEmbedJobPayloadSchema>;

export interface BackgroundJobPayloadByType {
  news_refresh: NewsRefreshJobPayload;
  news_embed: NewsEmbedJobPayload;
}
