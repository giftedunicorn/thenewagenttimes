import type { SQL } from "drizzle-orm";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod/v4";

import {
  IngestionRun,
  ingestionRunStatusValues,
  ingestionRunTypeValues,
  NewsSource,
} from "@acme/db/schema";

import { adminProcedure, createTRPCRouter } from "./trpc";

export const ingestionListInput = z.strictObject({
  from: z.coerce.date().optional(),
  page: z.number().int().nonnegative().default(0),
  pageSize: z.number().int().min(1).max(50).default(20),
  runType: z.enum(ingestionRunTypeValues).optional(),
  sourceId: z.string().uuid().optional(),
  status: z.enum(ingestionRunStatusValues).optional(),
  to: z.coerce.date().optional(),
});

export interface SourceHealth {
  failed: string[];
  notes: Record<string, string>;
  succeeded: string[];
}

const boundedStrings = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .slice(0, 100)
        .map((item) => item.slice(0, 300))
    : [];

export const parseSourceHealthMetadata = (
  metadata: unknown,
): SourceHealth | null => {
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    !("sourceHealth" in metadata)
  ) {
    return null;
  }

  const sourceHealth = metadata.sourceHealth;
  if (typeof sourceHealth !== "object" || sourceHealth === null) return null;

  const raw = sourceHealth as Record<string, unknown>;
  const notes =
    typeof raw.notes === "object" && raw.notes !== null
      ? Object.fromEntries(
          Object.entries(raw.notes)
            .filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === "string",
            )
            .slice(0, 100)
            .map(([key, value]) => [key.slice(0, 160), value.slice(0, 1_000)]),
        )
      : {};

  return {
    failed: boundedStrings(raw.failed),
    notes,
    succeeded: boundedStrings(raw.succeeded),
  };
};

const toIso = (value: Date | null) => value?.toISOString() ?? null;

export const toSafeIngestionDetail = <
  T extends {
    errorMessage: string | null;
    finishedAt: Date | null;
    metadata: unknown;
    startedAt: Date;
  },
>(
  row: T,
) => {
  const { errorMessage, finishedAt, metadata, startedAt, ...safeRow } = row;

  return {
    ...safeRow,
    errorMessage: errorMessage?.slice(0, 4_000) ?? null,
    finishedAt: toIso(finishedAt),
    sourceHealth: parseSourceHealthMetadata(metadata),
    startedAt: startedAt.toISOString(),
  };
};

export const ingestionRouter = createTRPCRouter({
  byId: adminProcedure
    .input(z.strictObject({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          errorMessage: IngestionRun.errorMessage,
          finishedAt: IngestionRun.finishedAt,
          id: IngestionRun.id,
          itemsCreated: IngestionRun.itemsCreated,
          itemsSeen: IngestionRun.itemsSeen,
          itemsUpdated: IngestionRun.itemsUpdated,
          metadata: IngestionRun.metadata,
          runType: IngestionRun.runType,
          sourceId: IngestionRun.sourceId,
          sourceName: NewsSource.name,
          startedAt: IngestionRun.startedAt,
          status: IngestionRun.status,
        })
        .from(IngestionRun)
        .leftJoin(NewsSource, eq(IngestionRun.sourceId, NewsSource.id))
        .where(eq(IngestionRun.id, input.id))
        .limit(1);
      const row = rows[0];
      if (!row) return null;

      return toSafeIngestionDetail(row);
    }),
  list: adminProcedure
    .input(ingestionListInput)
    .query(async ({ ctx, input }) => {
      const conditions: SQL[] = [];
      if (input.status) {
        conditions.push(eq(IngestionRun.status, input.status));
      }
      if (input.runType) {
        conditions.push(eq(IngestionRun.runType, input.runType));
      }
      if (input.sourceId) {
        conditions.push(eq(IngestionRun.sourceId, input.sourceId));
      }
      if (input.from) {
        conditions.push(gte(IngestionRun.startedAt, input.from));
      }
      if (input.to) {
        conditions.push(lte(IngestionRun.startedAt, input.to));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, countRows] = await Promise.all([
        ctx.db
          .select({
            errorMessage: IngestionRun.errorMessage,
            finishedAt: IngestionRun.finishedAt,
            id: IngestionRun.id,
            itemsCreated: IngestionRun.itemsCreated,
            itemsSeen: IngestionRun.itemsSeen,
            itemsUpdated: IngestionRun.itemsUpdated,
            runType: IngestionRun.runType,
            sourceId: IngestionRun.sourceId,
            sourceName: NewsSource.name,
            sourceSlug: NewsSource.slug,
            startedAt: IngestionRun.startedAt,
            status: IngestionRun.status,
          })
          .from(IngestionRun)
          .leftJoin(NewsSource, eq(IngestionRun.sourceId, NewsSource.id))
          .where(where)
          .orderBy(desc(IngestionRun.startedAt))
          .limit(input.pageSize)
          .offset(input.page * input.pageSize),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(IngestionRun)
          .where(where),
      ]);

      return {
        items: rows.map((row) => ({
          ...row,
          errorMessage: row.errorMessage?.slice(0, 4_000) ?? null,
          finishedAt: toIso(row.finishedAt),
          startedAt: row.startedAt.toISOString(),
        })),
        total: countRows[0]?.count ?? 0,
      };
    }),
});
