import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  BackgroundJobPayloadByType,
  BackgroundJobRow,
  BackgroundJobStatus,
  BackgroundJobType,
  NewsEmbedJobPayload,
  NewsRefreshJobPayload,
} from "./schema";
import {
  BackgroundJob,
  BackgroundJobStatusSchema,
  BackgroundJobTypeSchema,
  NewsEmbedJobPayloadSchema,
  NewsRefreshJobPayloadSchema,
} from "./schema";

describe("background job schema", () => {
  it("exports the supported job types and statuses", () => {
    expect(BackgroundJobTypeSchema.options).toEqual([
      "news_refresh",
      "news_embed",
    ]);
    expect(BackgroundJobStatusSchema.options).toEqual([
      "queued",
      "running",
      "succeeded",
      "failed",
    ]);

    expectTypeOf<BackgroundJobType>().toEqualTypeOf<
      "news_refresh" | "news_embed"
    >();
    expectTypeOf<BackgroundJobStatus>().toEqualTypeOf<
      "queued" | "running" | "succeeded" | "failed"
    >();
  });

  it("defines the durable job and lease columns", () => {
    const config = getTableConfig(BackgroundJob);

    expect(config.name).toBe("background_job");
    expect(config.columns.map((column) => column.name)).toEqual([
      "id",
      "jobType",
      "status",
      "dedupeKey",
      "payload",
      "result",
      "attempts",
      "maxAttempts",
      "nextRunAt",
      "lockedBy",
      "lockedAt",
      "lockExpiresAt",
      "startedAt",
      "completedAt",
      "errorMessage",
      "createdAt",
      "updatedAt",
    ]);

    expectTypeOf<BackgroundJobRow["payload"]>().toEqualTypeOf<
      Record<string, unknown>
    >();
    expectTypeOf<BackgroundJobRow["result"]>().toEqualTypeOf<Record<
      string,
      unknown
    > | null>();
  });

  it("indexes deduplication, due jobs, and expired leases", () => {
    const indexes = getTableConfig(BackgroundJob).indexes.map(({ config }) => ({
      columns: config.columns.map((column) =>
        "name" in column ? column.name : undefined,
      ),
      name: config.name,
      unique: config.unique,
    }));

    expect(indexes).toEqual([
      {
        columns: ["dedupeKey"],
        name: "background_job_dedupe_key_idx",
        unique: true,
      },
      {
        columns: ["status", "nextRunAt"],
        name: "background_job_status_next_run_at_idx",
        unique: false,
      },
      {
        columns: ["status", "lockExpiresAt"],
        name: "background_job_status_lock_expires_at_idx",
        unique: false,
      },
    ]);
  });

  it("validates refresh and embedding payloads at runtime", () => {
    expect(
      NewsRefreshJobPayloadSchema.safeParse({
        requestedAt: "2026-07-19T08:30:00.000Z",
        trigger: "cron",
      }).success,
    ).toBe(true);
    expect(
      NewsEmbedJobPayloadSchema.safeParse({
        batch: 0,
        limit: 100,
        parentJobId: "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0",
      }).success,
    ).toBe(true);
    expect(
      NewsEmbedJobPayloadSchema.safeParse({
        batch: 1,
        limit: 25,
      }).success,
    ).toBe(true);
  });

  it("rejects invalid payload dates, limits, identifiers, and extra fields", () => {
    expect(
      NewsRefreshJobPayloadSchema.safeParse({
        requestedAt: "2026-07-19",
        trigger: "manual",
      }).success,
    ).toBe(false);
    expect(
      NewsRefreshJobPayloadSchema.safeParse({
        requestedAt: "2026-07-19T08:30:00.000Z",
        trigger: "cron",
        unexpected: true,
      }).success,
    ).toBe(false);
    expect(
      NewsEmbedJobPayloadSchema.safeParse({
        batch: -1,
        limit: 25,
      }).success,
    ).toBe(false);
    expect(
      NewsEmbedJobPayloadSchema.safeParse({
        batch: 0,
        limit: 0,
      }).success,
    ).toBe(false);
    expect(
      NewsEmbedJobPayloadSchema.safeParse({
        batch: 0,
        limit: 101,
      }).success,
    ).toBe(false);
    expect(
      NewsEmbedJobPayloadSchema.safeParse({
        batch: 0,
        limit: 25,
        parentJobId: "not-a-uuid",
      }).success,
    ).toBe(false);
    expect(
      NewsEmbedJobPayloadSchema.safeParse({
        batch: 0,
        limit: 25,
        unexpected: true,
      }).success,
    ).toBe(false);
  });

  it("maps every job type to its inferred payload", () => {
    expectTypeOf<
      keyof BackgroundJobPayloadByType
    >().toEqualTypeOf<BackgroundJobType>();
    expectTypeOf<
      BackgroundJobPayloadByType["news_refresh"]
    >().toEqualTypeOf<NewsRefreshJobPayload>();
    expectTypeOf<
      BackgroundJobPayloadByType["news_embed"]
    >().toEqualTypeOf<NewsEmbedJobPayload>();
  });
});
