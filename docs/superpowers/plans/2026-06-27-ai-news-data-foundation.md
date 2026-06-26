# AI News Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first durable data and read API foundation for The News Agent Times without running migrations or implementing crawlers, embeddings, vector similarity search, or public UI.

**Architecture:** Keep the first implementation inside the existing monorepo boundaries. `packages/db/src/schema.ts` owns Drizzle tables and Zod schemas; `packages/db/src/index.ts` exports the Drizzle query helpers the API needs; `packages/api/src/router/news.ts` owns read-only `news` procedures and input schemas; `packages/api/src/root.ts` registers the router.

**Tech Stack:** TypeScript, pnpm workspace catalogs, Vitest, Drizzle ORM, drizzle-zod, Zod v4, tRPC v11, Vercel Postgres driver.

---

## File Structure

- Modify `pnpm-workspace.yaml`: add `vitest` to the root catalog so packages use the same test runner version.
- Modify `packages/db/package.json`: add a `test` script and `vitest` dev dependency.
- Modify `packages/api/package.json`: add a `test` script and `vitest` dev dependency.
- Modify `packages/db/tsconfig.json`: include `src/**/*.test.ts`.
- Modify `packages/api/tsconfig.json`: include `src/**/*.test.ts`.
- Modify `packages/db/src/index.ts`: export Drizzle operators used by the news router.
- Modify `packages/db/src/schema.ts`: add AI news tables, enums-as-constants, relations, and Zod insert schemas while keeping the starter `Post` table intact for existing template routes.
- Create `packages/db/src/schema.test.ts`: contract tests for news categories, source types, insert schema validation, and vector metadata validation.
- Create `packages/api/src/router/news.test.ts`: input validation tests for `news.feed` and `news.searchCandidates`.
- Create `packages/api/src/router/news.ts`: read-only news router.
- Modify `packages/api/src/root.ts`: register `news: newsRouter`.

This plan deliberately leaves `apps/nextjs`, `apps/tanstack-start`, and `apps/expo` unchanged. The starter UI can continue compiling while the backend foundation lands.

## Task 1: Add Test Runner Infrastructure

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `packages/db/package.json`
- Modify: `packages/api/package.json`
- Modify: `packages/db/tsconfig.json`
- Modify: `packages/api/tsconfig.json`

- [ ] **Step 1: Add Vitest to the workspace catalog**

Edit `pnpm-workspace.yaml` so the `catalog` block includes this entry:

```yaml
  vitest: ^4.0.15
```

Place it near the existing `vite` entry:

```yaml
  typescript: ^5.9.3
  vite: 7.1.12
  vitest: ^4.0.15
  zod: ^4.1.12
```

- [ ] **Step 2: Add the DB package test script and dependency**

Edit `packages/db/package.json` so `scripts` includes:

```json
"test": "vitest run"
```

and `devDependencies` includes:

```json
"vitest": "catalog:"
```

The relevant final sections should look like:

```json
  "scripts": {
    "build": "tsc",
    "clean": "git clean -xdf .cache .turbo dist node_modules",
    "dev": "tsc",
    "format": "prettier --check . --ignore-path ../../.gitignore",
    "lint": "eslint --flag unstable_native_nodejs_ts_config",
    "push": "pnpm with-env drizzle-kit push",
    "studio": "pnpm with-env drizzle-kit studio",
    "test": "vitest run",
    "typecheck": "tsc --noEmit --emitDeclarationOnly false",
    "with-env": "dotenv -e ../../.env --"
  },
  "devDependencies": {
    "@acme/eslint-config": "workspace:*",
    "@acme/prettier-config": "workspace:*",
    "@acme/tsconfig": "workspace:*",
    "drizzle-kit": "^0.31.5",
    "eslint": "catalog:",
    "prettier": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
```

- [ ] **Step 3: Add the API package test script and dependency**

Edit `packages/api/package.json` so `scripts` includes:

```json
"test": "vitest run"
```

and `devDependencies` includes:

```json
"vitest": "catalog:"
```

The relevant final sections should look like:

```json
  "scripts": {
    "build": "tsc",
    "clean": "git clean -xdf .cache .turbo dist node_modules",
    "dev": "tsc",
    "format": "prettier --check . --ignore-path ../../.gitignore",
    "lint": "eslint --flag unstable_native_nodejs_ts_config",
    "test": "vitest run",
    "typecheck": "tsc --noEmit --emitDeclarationOnly false"
  },
  "devDependencies": {
    "@acme/eslint-config": "workspace:*",
    "@acme/prettier-config": "workspace:*",
    "@acme/tsconfig": "workspace:*",
    "eslint": "catalog:",
    "prettier": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
```

- [ ] **Step 4: Include tests in DB and API TypeScript configs**

Edit `packages/db/tsconfig.json` to:

```json
{
  "extends": "@acme/tsconfig/compiled-package.json",
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

Edit `packages/api/tsconfig.json` to:

```json
{
  "extends": "@acme/tsconfig/compiled-package.json",
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

These files already include `src`; keep them unchanged if they still match exactly.

- [ ] **Step 5: Update lockfile after package edits**

Run:

```bash
pnpm install --lockfile-only
```

Expected: command exits 0 and updates `pnpm-lock.yaml` for Vitest.

- [ ] **Step 6: Verify package scripts are visible**

Run:

```bash
pnpm -F @acme/db test -- --runInBand
```

Expected at this moment: Vitest exits with "No test files found" because tests have not been added yet. If `--runInBand` is not supported by the installed Vitest version, run `pnpm -F @acme/db test` and expect the same no-test result.

## Task 2: Write Failing DB Schema Contract Tests

**Files:**
- Create: `packages/db/src/schema.test.ts`

- [ ] **Step 1: Create the failing DB schema test**

Create `packages/db/src/schema.test.ts` with this content:

```ts
import { describe, expect, it } from "vitest";

import {
  CreateNewsItemSchema,
  CreateNewsItemVectorSchema,
  newsCategoryValues,
  newsEmbeddingStatusValues,
  newsSourceTypeValues,
} from "./schema";

const sourceId = "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0";

describe("AI news schema contracts", () => {
  it("covers the editorial categories from the product brief", () => {
    expect(newsCategoryValues).toEqual(
      expect.arrayContaining([
        "funding",
        "product_hunt",
        "model_release",
        "new_concept",
        "hot_take",
        "agent_product",
        "big_tech",
        "musk_ai",
        "yc_ai",
      ]),
    );
  });

  it("covers source types needed by the first ingestion targets", () => {
    expect(newsSourceTypeValues).toEqual(
      expect.arrayContaining([
        "publication",
        "rss",
        "product_hunt",
        "hacker_news",
        "github",
        "yc",
        "vendor_blog",
        "research",
      ]),
    );
  });

  it("accepts a normalized published model-release news item", () => {
    const result = CreateNewsItemSchema.safeParse({
      sourceId,
      title: "OpenAI releases a new agent model",
      summary: "A short summary for feed cards and internal trend review.",
      canonicalUrl: "https://example.com/openai-agent-model",
      originalUrl: "https://example.com/openai-agent-model?utm_source=test",
      publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      status: "published",
      category: "model_release",
      tags: ["agent", "model"],
      entities: ["OpenAI"],
      dedupeKey: "openai-releases-a-new-agent-model",
      embeddingStatus: "pending",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid news categories", () => {
    const result = CreateNewsItemSchema.safeParse({
      sourceId,
      title: "A generic launch",
      summary: "A short summary for feed cards and internal trend review.",
      canonicalUrl: "https://example.com/generic-launch",
      originalUrl: "https://example.com/generic-launch",
      publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      status: "published",
      category: "generic_ai_news",
      dedupeKey: "generic-launch",
    });

    expect(result.success).toBe(false);
  });

  it("accepts portable vector metadata before a final vector store is chosen", () => {
    const result = CreateNewsItemVectorSchema.safeParse({
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      provider: "openai",
      model: "text-embedding-3-small",
      dimension: 1536,
      contentHash: "sha256:normalized-news-text",
      vectorRef: "news/a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      embedding: [0.01, -0.02, 0.03],
    });

    expect(result.success).toBe(true);
  });

  it("keeps explicit embedding lifecycle states", () => {
    expect(newsEmbeddingStatusValues).toEqual([
      "pending",
      "embedded",
      "failed",
      "skipped",
    ]);
  });
});
```

- [ ] **Step 2: Run the DB test to verify it fails for missing exports**

Run:

```bash
pnpm -F @acme/db test -- src/schema.test.ts
```

Expected: FAIL because `CreateNewsItemSchema`, `CreateNewsItemVectorSchema`, `newsCategoryValues`, `newsEmbeddingStatusValues`, and `newsSourceTypeValues` are not exported yet.

## Task 3: Implement AI News DB Schema

**Files:**
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Replace `packages/db/src/schema.ts` with the news schema added after the existing imports**

Keep the starter `Post` table and `CreatePostSchema` so existing template apps continue to compile. Add the news constants, enums, tables, relations, and insert schemas around it.

Use this full file content:

```ts
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const newsSourceTypeValues = [
  "publication",
  "rss",
  "product_hunt",
  "hacker_news",
  "github",
  "yc",
  "vendor_blog",
  "research",
  "social",
  "manual",
  "other",
] as const;

export const newsStatusValues = [
  "draft",
  "published",
  "archived",
  "rejected",
  "duplicate",
] as const;

export const newsCategoryValues = [
  "funding",
  "product_hunt",
  "model_release",
  "new_concept",
  "hot_take",
  "agent_product",
  "big_tech",
  "musk_ai",
  "yc_ai",
  "research",
  "policy",
  "security",
  "open_source",
  "market_map",
  "other",
] as const;

export const newsEmbeddingStatusValues = [
  "pending",
  "embedded",
  "failed",
  "skipped",
] as const;

export const newsSignalTypeValues = [
  "source_credibility",
  "recency",
  "social_velocity",
  "product_launch",
  "funding_amount",
  "yc_batch",
  "big_tech",
  "model_release",
  "concept_novelty",
  "internal_relevance",
  "manual_boost",
] as const;

export const ingestionRunTypeValues = [
  "manual_import",
  "rss",
  "api",
  "crawler",
  "backfill",
] as const;

export const ingestionRunStatusValues = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "partial",
] as const;

export const NewsSourceType = pgEnum(
  "news_source_type",
  newsSourceTypeValues,
);
export const NewsStatus = pgEnum("news_status", newsStatusValues);
export const NewsCategory = pgEnum("news_category", newsCategoryValues);
export const NewsEmbeddingStatus = pgEnum(
  "news_embedding_status",
  newsEmbeddingStatusValues,
);
export const NewsSignalType = pgEnum(
  "news_signal_type",
  newsSignalTypeValues,
);
export const IngestionRunType = pgEnum(
  "ingestion_run_type",
  ingestionRunTypeValues,
);
export const IngestionRunStatus = pgEnum(
  "ingestion_run_status",
  ingestionRunStatusValues,
);

export const NewsSource = pgTable(
  "news_source",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    name: t.varchar({ length: 160 }).notNull(),
    slug: t.varchar({ length: 160 }).notNull(),
    homepageUrl: t.varchar({ length: 2048 }).notNull(),
    feedUrl: t.varchar({ length: 2048 }),
    sourceType: NewsSourceType().notNull(),
    credibility: t.integer().default(50).notNull(),
    isActive: t.boolean().default(true).notNull(),
    createdAt: t.timestamp({ mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => [uniqueIndex("news_source_slug_idx").on(table.slug)],
);

export const NewsItem = pgTable(
  "news_item",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    sourceId: t
      .uuid()
      .notNull()
      .references(() => NewsSource.id, { onDelete: "restrict" }),
    title: t.varchar({ length: 320 }).notNull(),
    summary: t.text().notNull(),
    bodyText: t.text(),
    canonicalUrl: t.varchar({ length: 2048 }).notNull(),
    originalUrl: t.varchar({ length: 2048 }).notNull(),
    imageUrl: t.varchar({ length: 2048 }),
    authorName: t.varchar({ length: 160 }),
    language: t.varchar({ length: 16 }).default("en").notNull(),
    publishedAt: t.timestamp({ mode: "date", withTimezone: true }).notNull(),
    collectedAt: t.timestamp({ mode: "date", withTimezone: true }).defaultNow().notNull(),
    status: NewsStatus().default("draft").notNull(),
    category: NewsCategory().notNull(),
    tags: t.text().array().default(sql`'{}'::text[]`).notNull(),
    entities: t.text().array().default(sql`'{}'::text[]`).notNull(),
    dedupeKey: t.varchar({ length: 320 }).notNull(),
    sourceScore: t.integer().default(50).notNull(),
    trendScore: t.integer().default(0).notNull(),
    embeddingStatus: NewsEmbeddingStatus().default("pending").notNull(),
    createdAt: t.timestamp({ mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => [
    uniqueIndex("news_item_canonical_url_idx").on(table.canonicalUrl),
    uniqueIndex("news_item_dedupe_key_idx").on(table.dedupeKey),
  ],
);

export const NewsItemVector = pgTable(
  "news_item_vector",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    newsItemId: t
      .uuid()
      .notNull()
      .references(() => NewsItem.id, { onDelete: "cascade" }),
    provider: t.varchar({ length: 80 }).notNull(),
    model: t.varchar({ length: 160 }).notNull(),
    dimension: t.integer().notNull(),
    contentHash: t.varchar({ length: 160 }).notNull(),
    vectorRef: t.varchar({ length: 512 }),
    embedding: t.jsonb().$type<number[]>(),
    createdAt: t.timestamp({ mode: "date", withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => [
    uniqueIndex("news_item_vector_unique_idx").on(
      table.newsItemId,
      table.provider,
      table.model,
      table.contentHash,
    ),
  ],
);

export const NewsSignal = pgTable("news_signal", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  newsItemId: t
    .uuid()
    .notNull()
    .references(() => NewsItem.id, { onDelete: "cascade" }),
  signalType: NewsSignalType().notNull(),
  signalValue: t.integer().notNull(),
  metadata: t.jsonb().$type<Record<string, unknown>>().default({}).notNull(),
  observedAt: t.timestamp({ mode: "date", withTimezone: true }).defaultNow().notNull(),
}));

export const IngestionRun = pgTable("ingestion_run", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  sourceId: t.uuid().references(() => NewsSource.id, { onDelete: "set null" }),
  runType: IngestionRunType().notNull(),
  status: IngestionRunStatus().default("queued").notNull(),
  startedAt: t.timestamp({ mode: "date", withTimezone: true }).defaultNow().notNull(),
  finishedAt: t.timestamp({ mode: "date", withTimezone: true }),
  itemsSeen: t.integer().default(0).notNull(),
  itemsCreated: t.integer().default(0).notNull(),
  itemsUpdated: t.integer().default(0).notNull(),
  errorMessage: t.text(),
  metadata: t.jsonb().$type<Record<string, unknown>>().default({}).notNull(),
}));

export const NewsSourceRelations = relations(NewsSource, ({ many }) => ({
  items: many(NewsItem),
  ingestionRuns: many(IngestionRun),
}));

export const NewsItemRelations = relations(NewsItem, ({ one, many }) => ({
  source: one(NewsSource, {
    fields: [NewsItem.sourceId],
    references: [NewsSource.id],
  }),
  vectors: many(NewsItemVector),
  signals: many(NewsSignal),
}));

export const NewsItemVectorRelations = relations(NewsItemVector, ({ one }) => ({
  item: one(NewsItem, {
    fields: [NewsItemVector.newsItemId],
    references: [NewsItem.id],
  }),
}));

export const NewsSignalRelations = relations(NewsSignal, ({ one }) => ({
  item: one(NewsItem, {
    fields: [NewsSignal.newsItemId],
    references: [NewsItem.id],
  }),
}));

export const IngestionRunRelations = relations(IngestionRun, ({ one }) => ({
  source: one(NewsSource, {
    fields: [IngestionRun.sourceId],
    references: [NewsSource.id],
  }),
}));

export const NewsCategorySchema = z.enum(newsCategoryValues);
export const NewsStatusSchema = z.enum(newsStatusValues);
export const NewsEmbeddingStatusSchema = z.enum(newsEmbeddingStatusValues);

export const CreateNewsSourceSchema = createInsertSchema(NewsSource, {
  name: z.string().min(1).max(160),
  slug: z.string().min(1).max(160),
  homepageUrl: z.string().url().max(2048),
  feedUrl: z.string().url().max(2048).nullable().optional(),
  sourceType: z.enum(newsSourceTypeValues),
  credibility: z.number().int().min(0).max(100).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const CreateNewsItemSchema = createInsertSchema(NewsItem, {
  title: z.string().min(1).max(320),
  summary: z.string().min(1),
  canonicalUrl: z.string().url().max(2048),
  originalUrl: z.string().url().max(2048),
  imageUrl: z.string().url().max(2048).nullable().optional(),
  authorName: z.string().max(160).nullable().optional(),
  language: z.string().min(2).max(16).optional(),
  publishedAt: z.date(),
  status: NewsStatusSchema.optional(),
  category: NewsCategorySchema,
  tags: z.array(z.string().min(1).max(80)).optional(),
  entities: z.array(z.string().min(1).max(160)).optional(),
  dedupeKey: z.string().min(1).max(320),
  sourceScore: z.number().int().min(0).max(100).optional(),
  trendScore: z.number().int().optional(),
  embeddingStatus: NewsEmbeddingStatusSchema.optional(),
}).omit({
  id: true,
  collectedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const CreateNewsItemVectorSchema = createInsertSchema(NewsItemVector, {
  provider: z.string().min(1).max(80),
  model: z.string().min(1).max(160),
  dimension: z.number().int().positive(),
  contentHash: z.string().min(1).max(160),
  vectorRef: z.string().min(1).max(512).nullable().optional(),
  embedding: z.array(z.number()).nullable().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const CreateNewsSignalSchema = createInsertSchema(NewsSignal, {
  signalType: z.enum(newsSignalTypeValues),
  signalValue: z.number().int(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).omit({
  id: true,
  observedAt: true,
});

export const CreateIngestionRunSchema = createInsertSchema(IngestionRun, {
  runType: z.enum(ingestionRunTypeValues),
  status: z.enum(ingestionRunStatusValues).optional(),
  itemsSeen: z.number().int().min(0).optional(),
  itemsCreated: z.number().int().min(0).optional(),
  itemsUpdated: z.number().int().min(0).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).omit({
  id: true,
  startedAt: true,
});

export const Post = pgTable("post", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  title: t.varchar({ length: 256 }).notNull(),
  content: t.text().notNull(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const CreatePostSchema = createInsertSchema(Post, {
  title: z.string().max(256),
  content: z.string().max(256),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export * from "./auth-schema";
```

- [ ] **Step 2: Run the DB schema test**

Run:

```bash
pnpm -F @acme/db test -- src/schema.test.ts
```

Expected: PASS for all tests in `schema.test.ts`.

- [ ] **Step 3: Run DB typecheck**

Run:

```bash
pnpm -F @acme/db typecheck
```

Expected: exit 0.

If TypeScript rejects a Drizzle helper signature, adjust the smallest affected schema call and rerun the same command. Do not run `pnpm -F @acme/db build`, `pnpm -F @acme/db push`, or any migration command.

## Task 4: Export Drizzle Query Helpers For API Code

**Files:**
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Write the helper export change**

Replace `packages/db/src/index.ts` with:

```ts
export {
  and,
  desc,
  eq,
  ilike,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
export { alias } from "drizzle-orm/pg-core";
```

- [ ] **Step 2: Run DB typecheck**

Run:

```bash
pnpm -F @acme/db typecheck
```

Expected: exit 0.

## Task 5: Write Failing API Input Contract Tests

**Files:**
- Create: `packages/api/src/router/news.test.ts`

- [ ] **Step 1: Create the failing API test**

Create `packages/api/src/router/news.test.ts` with this content:

```ts
import { describe, expect, it } from "vitest";

import { NewsFeedInputSchema, NewsSearchCandidatesInputSchema } from "./news";

describe("news router input contracts", () => {
  it("defaults the public feed limit to 20", () => {
    expect(NewsFeedInputSchema.parse({}).limit).toBe(20);
  });

  it("caps public feed page size at 50", () => {
    const result = NewsFeedInputSchema.safeParse({ limit: 51 });

    expect(result.success).toBe(false);
  });

  it("accepts the approved first-stage news categories", () => {
    const result = NewsFeedInputSchema.safeParse({
      category: "yc_ai",
      limit: 10,
    });

    expect(result.success).toBe(true);
  });

  it("requires a non-empty search query after trimming", () => {
    const result = NewsSearchCandidatesInputSchema.safeParse({ q: "   " });

    expect(result.success).toBe(false);
  });

  it("defaults search candidate limit to 10", () => {
    expect(NewsSearchCandidatesInputSchema.parse({ q: "agent launch" }).limit).toBe(
      10,
    );
  });
});
```

- [ ] **Step 2: Run the API test to verify it fails for missing router exports**

Run:

```bash
pnpm -F @acme/api test -- src/router/news.test.ts
```

Expected: FAIL because `packages/api/src/router/news.ts` does not exist yet.

## Task 6: Implement Read-Only News Router

**Files:**
- Create: `packages/api/src/router/news.ts`
- Modify: `packages/api/src/root.ts`

- [ ] **Step 1: Create `packages/api/src/router/news.ts`**

Create `packages/api/src/router/news.ts` with this content:

```ts
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import {
  and,
  desc,
  eq,
  ilike,
  lt,
  or,
  sql,
  type SQL,
} from "@acme/db";
import {
  NewsCategorySchema,
  NewsItem,
  NewsItemVector,
  NewsSignal,
  NewsSource,
} from "@acme/db/schema";

import { publicProcedure } from "../trpc";

const optionalTrimmedString = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength).optional();

export const NewsFeedInputSchema = z.object({
  category: NewsCategorySchema.optional(),
  tag: optionalTrimmedString(80),
  sourceSlug: optionalTrimmedString(160),
  q: optionalTrimmedString(256),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().datetime().optional(),
});

export const NewsByIdInputSchema = z.object({
  id: z.string().uuid(),
});

export const NewsSearchCandidatesInputSchema = z.object({
  q: z.string().trim().min(1).max(256),
  category: NewsCategorySchema.optional(),
  limit: z.number().int().min(1).max(25).default(10),
});

type NewsFeedInput = z.infer<typeof NewsFeedInputSchema>;
type NewsSearchCandidatesInput = z.infer<
  typeof NewsSearchCandidatesInputSchema
>;

const compactConditions = (
  conditions: Array<SQL<unknown> | undefined>,
): SQL<unknown> | undefined => {
  const definedConditions = conditions.filter(
    (condition): condition is SQL<unknown> => condition !== undefined,
  );

  return definedConditions.length > 0 ? and(...definedConditions) : undefined;
};

const textSearchCondition = (query: string | undefined): SQL<unknown> | undefined => {
  if (!query) return undefined;

  const pattern = `%${query}%`;

  return or(
    ilike(NewsItem.title, pattern),
    ilike(NewsItem.summary, pattern),
    sql`exists (select 1 from unnest(${NewsItem.entities}) as entity where entity ilike ${pattern})`,
  );
};

const tagCondition = (tag: string | undefined): SQL<unknown> | undefined => {
  if (!tag) return undefined;

  return sql`${NewsItem.tags} @> array[${tag}]::text[]`;
};

const publishedFeedConditions = (input: NewsFeedInput): SQL<unknown> | undefined =>
  compactConditions([
    eq(NewsItem.status, "published"),
    input.category ? eq(NewsItem.category, input.category) : undefined,
    input.sourceSlug ? eq(NewsSource.slug, input.sourceSlug) : undefined,
    input.cursor ? lt(NewsItem.publishedAt, new Date(input.cursor)) : undefined,
    tagCondition(input.tag),
    textSearchCondition(input.q),
  ]);

const searchCandidateConditions = (
  input: NewsSearchCandidatesInput,
): SQL<unknown> | undefined =>
  compactConditions([
    eq(NewsItem.status, "published"),
    input.category ? eq(NewsItem.category, input.category) : undefined,
    textSearchCondition(input.q),
  ]);

export const newsRouter = {
  feed: publicProcedure.input(NewsFeedInputSchema).query(({ ctx, input }) => {
    return ctx.db
      .select({
        id: NewsItem.id,
        title: NewsItem.title,
        summary: NewsItem.summary,
        canonicalUrl: NewsItem.canonicalUrl,
        imageUrl: NewsItem.imageUrl,
        publishedAt: NewsItem.publishedAt,
        category: NewsItem.category,
        tags: NewsItem.tags,
        entities: NewsItem.entities,
        sourceScore: NewsItem.sourceScore,
        trendScore: NewsItem.trendScore,
        embeddingStatus: NewsItem.embeddingStatus,
        source: {
          id: NewsSource.id,
          name: NewsSource.name,
          slug: NewsSource.slug,
          homepageUrl: NewsSource.homepageUrl,
          sourceType: NewsSource.sourceType,
          credibility: NewsSource.credibility,
        },
      })
      .from(NewsItem)
      .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
      .where(publishedFeedConditions(input))
      .orderBy(desc(NewsItem.trendScore), desc(NewsItem.publishedAt))
      .limit(input.limit);
  }),

  byId: publicProcedure
    .input(NewsByIdInputSchema)
    .query(async ({ ctx, input }) => {
      const [item] = await ctx.db
        .select({
          id: NewsItem.id,
          title: NewsItem.title,
          summary: NewsItem.summary,
          bodyText: NewsItem.bodyText,
          canonicalUrl: NewsItem.canonicalUrl,
          originalUrl: NewsItem.originalUrl,
          imageUrl: NewsItem.imageUrl,
          authorName: NewsItem.authorName,
          language: NewsItem.language,
          publishedAt: NewsItem.publishedAt,
          collectedAt: NewsItem.collectedAt,
          category: NewsItem.category,
          tags: NewsItem.tags,
          entities: NewsItem.entities,
          sourceScore: NewsItem.sourceScore,
          trendScore: NewsItem.trendScore,
          embeddingStatus: NewsItem.embeddingStatus,
          source: {
            id: NewsSource.id,
            name: NewsSource.name,
            slug: NewsSource.slug,
            homepageUrl: NewsSource.homepageUrl,
            sourceType: NewsSource.sourceType,
            credibility: NewsSource.credibility,
          },
        })
        .from(NewsItem)
        .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
        .where(
          compactConditions([
            eq(NewsItem.id, input.id),
            eq(NewsItem.status, "published"),
          ]),
        )
        .limit(1);

      if (!item) return null;

      const signals = await ctx.db
        .select({
          signalType: NewsSignal.signalType,
          signalValue: NewsSignal.signalValue,
          metadata: NewsSignal.metadata,
          observedAt: NewsSignal.observedAt,
        })
        .from(NewsSignal)
        .where(eq(NewsSignal.newsItemId, input.id))
        .orderBy(desc(NewsSignal.observedAt))
        .limit(20);

      const vectors = await ctx.db
        .select({
          provider: NewsItemVector.provider,
          model: NewsItemVector.model,
          dimension: NewsItemVector.dimension,
          contentHash: NewsItemVector.contentHash,
          vectorRef: NewsItemVector.vectorRef,
          createdAt: NewsItemVector.createdAt,
        })
        .from(NewsItemVector)
        .where(eq(NewsItemVector.newsItemId, input.id))
        .orderBy(desc(NewsItemVector.createdAt))
        .limit(5);

      return {
        ...item,
        signals,
        vectors,
        hasVector: vectors.length > 0,
      };
    }),

  searchCandidates: publicProcedure
    .input(NewsSearchCandidatesInputSchema)
    .query(({ ctx, input }) => {
      return ctx.db
        .select({
          id: NewsItem.id,
          title: NewsItem.title,
          summary: NewsItem.summary,
          canonicalUrl: NewsItem.canonicalUrl,
          publishedAt: NewsItem.publishedAt,
          category: NewsItem.category,
          tags: NewsItem.tags,
          entities: NewsItem.entities,
          sourceScore: NewsItem.sourceScore,
          trendScore: NewsItem.trendScore,
          embeddingStatus: NewsItem.embeddingStatus,
          source: {
            name: NewsSource.name,
            slug: NewsSource.slug,
          },
        })
        .from(NewsItem)
        .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
        .where(searchCandidateConditions(input))
        .orderBy(desc(NewsItem.trendScore), desc(NewsItem.publishedAt))
        .limit(input.limit);
    }),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 2: Register the news router**

Edit `packages/api/src/root.ts` to:

```ts
import { authRouter } from "./router/auth";
import { newsRouter } from "./router/news";
import { postRouter } from "./router/post";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  news: newsRouter,
  post: postRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Run API tests**

Run:

```bash
pnpm -F @acme/api test -- src/router/news.test.ts
```

Expected: PASS for all tests in `news.test.ts`.

- [ ] **Step 4: Run API typecheck**

Run:

```bash
pnpm -F @acme/api typecheck
```

Expected: exit 0.

If TypeScript rejects the `compactConditions` return type or Drizzle `where` type, make the smallest possible type-safe adjustment and rerun the same command.

## Task 7: Full Verification

**Files:**
- Inspect: `git status --short`
- Verify: touched packages only

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm -F @acme/db test -- src/schema.test.ts
pnpm -F @acme/api test -- src/router/news.test.ts
```

Expected: both commands exit 0.

- [ ] **Step 2: Run typechecks**

Run:

```bash
pnpm -F @acme/db typecheck
pnpm -F @acme/api typecheck
```

Expected: both commands exit 0.

- [ ] **Step 3: Confirm no migrations were created or run**

Run:

```bash
find . -path '*drizzle*' -o -path '*migrations*' | sed -n '1,120p'
```

Expected: no new migration files from this implementation. Existing Drizzle config files are acceptable.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short
```

Expected changed files include only the intended plan/spec/docs, package metadata, lockfile, DB schema/test files, and API router/test/root files. `AGENTS.md` was already untracked before this work; do not stage or modify it unless the user explicitly asks.

- [ ] **Step 5: Ask before commit**

Because `AGENTS.md` says to ask before committing, do not run a commit by default. If the user grants commit permission, stage exact files only:

```bash
git add docs/superpowers/specs/2026-06-27-ai-news-data-foundation-design.md \
  docs/superpowers/plans/2026-06-27-ai-news-data-foundation.md \
  pnpm-workspace.yaml \
  pnpm-lock.yaml \
  packages/db/package.json \
  packages/db/tsconfig.json \
  packages/db/src/index.ts \
  packages/db/src/schema.ts \
  packages/db/src/schema.test.ts \
  packages/api/package.json \
  packages/api/tsconfig.json \
  packages/api/src/root.ts \
  packages/api/src/router/news.ts \
  packages/api/src/router/news.test.ts
git commit -m "feat: add ai news data foundation"
```

Expected: commit succeeds without staging `AGENTS.md`.

## Self-Review Notes

- Spec coverage: the plan covers news sources, news items, vectors, signals, ingestion runs, feed/detail/search-candidate API, no migrations, no crawler, no embedding calls, no vector similarity search, and no UI.
- Placeholder scan: no task relies on unspecified code or a future decision.
- Type consistency: the schema exports `NewsCategorySchema`; the API imports it. The router exports `NewsFeedInputSchema` and `NewsSearchCandidatesInputSchema`; the API test imports those exact names.
