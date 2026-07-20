import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { user } from "./auth-schema";

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

export const newsReaderInteractionActionValues = [
  "view",
  "click_source",
  "save",
  "share",
  "hide",
] as const;

export const NewsSourceType = pgEnum("news_source_type", newsSourceTypeValues);
export const NewsStatus = pgEnum("news_status", newsStatusValues);
export const NewsCategory = pgEnum("news_category", newsCategoryValues);
export const NewsEmbeddingStatus = pgEnum(
  "news_embedding_status",
  newsEmbeddingStatusValues,
);
export const IngestionRunType = pgEnum(
  "ingestion_run_type",
  ingestionRunTypeValues,
);
export const IngestionRunStatus = pgEnum(
  "ingestion_run_status",
  ingestionRunStatusValues,
);
export const NewsReaderInteractionAction = pgEnum(
  "news_reader_interaction_action",
  newsReaderInteractionActionValues,
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
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => new Date()),
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
    collectedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    status: NewsStatus().default("draft").notNull(),
    category: NewsCategory().notNull(),
    tags: t
      .text()
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    entities: t
      .text()
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    clusterKey: t.varchar({ length: 320 }).notNull(),
    dedupeKey: t.varchar({ length: 320 }).notNull(),
    sourceScore: t.integer().default(50).notNull(),
    trendScore: t.integer().default(0).notNull(),
    embeddingStatus: NewsEmbeddingStatus().default("pending").notNull(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => new Date()),
  }),
  (table) => [
    index("news_item_cluster_key_idx").on(table.clusterKey),
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
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
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

export const IngestionRun = pgTable("ingestion_run", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  sourceId: t.uuid().references(() => NewsSource.id, { onDelete: "set null" }),
  runType: IngestionRunType().notNull(),
  status: IngestionRunStatus().default("queued").notNull(),
  startedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  finishedAt: t.timestamp({ mode: "date", withTimezone: true }),
  itemsSeen: t.integer().default(0).notNull(),
  itemsCreated: t.integer().default(0).notNull(),
  itemsUpdated: t.integer().default(0).notNull(),
  errorMessage: t.text(),
  metadata: t
    .jsonb()
    .$type<Record<string, unknown>>()
    .default(sql`'{}'::jsonb`)
    .notNull(),
}));

export const NewsReaderProfile = pgTable(
  "news_reader_profile",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    readerKey: t.varchar({ length: 200 }).notNull(),
    userId: t.text().references(() => user.id, { onDelete: "cascade" }),
    preferredCategories: t
      .text()
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    preferredSources: t
      .text()
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    preferredEntities: t
      .text()
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    noveltyBias: t.real().default(1).notNull(),
    recencyBias: t.real().default(1).notNull(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => new Date()),
  }),
  (table) => [
    uniqueIndex("news_reader_profile_reader_key_idx").on(table.readerKey),
  ],
);

export const NewsReaderInteraction = pgTable(
  "news_reader_interaction",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    readerProfileId: t
      .uuid()
      .notNull()
      .references(() => NewsReaderProfile.id, { onDelete: "cascade" }),
    newsItemId: t
      .uuid()
      .notNull()
      .references(() => NewsItem.id, { onDelete: "cascade" }),
    action: NewsReaderInteractionAction().notNull(),
    metadata: t
      .jsonb()
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    occurredAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
);

export const NewsCategorySchema = z.enum(newsCategoryValues);
export const NewsStatusSchema = z.enum(newsStatusValues);
export const NewsEmbeddingStatusSchema = z.enum(newsEmbeddingStatusValues);
export const NewsReaderInteractionActionSchema = z.enum(
  newsReaderInteractionActionValues,
);

export const CreateNewsSourceSchema = createInsertSchema(NewsSource, {
  name: z.string().min(1).max(160),
  slug: z.string().min(1).max(160),
  homepageUrl: z.string().url().max(2048),
  feedUrl: z.string().url().max(2048).nullable().optional(),
  sourceType: z.enum(newsSourceTypeValues),
  credibility: z.number().int().min(0).max(100).optional(),
}).omit({
  createdAt: true,
  id: true,
  updatedAt: true,
});

export const CreateNewsItemSchema = createInsertSchema(NewsItem, {
  authorName: z.string().max(160).nullable().optional(),
  canonicalUrl: z.string().url().max(2048),
  category: NewsCategorySchema,
  clusterKey: z.string().min(1).max(320),
  dedupeKey: z.string().min(1).max(320),
  embeddingStatus: NewsEmbeddingStatusSchema.optional(),
  entities: z.array(z.string().min(1).max(160)).optional(),
  imageUrl: z.string().url().max(2048).nullable().optional(),
  language: z.string().min(2).max(16).optional(),
  originalUrl: z.string().url().max(2048),
  publishedAt: z.date(),
  sourceScore: z.number().int().min(0).max(100).optional(),
  status: NewsStatusSchema.optional(),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1).max(80)).optional(),
  title: z.string().min(1).max(320),
  trendScore: z.number().int().optional(),
}).omit({
  collectedAt: true,
  createdAt: true,
  id: true,
  updatedAt: true,
});

export const CreateNewsItemVectorSchema = createInsertSchema(NewsItemVector, {
  contentHash: z.string().min(1).max(160),
  dimension: z.number().int().positive(),
  embedding: z.array(z.number()).nullable().optional(),
  model: z.string().min(1).max(160),
  provider: z.string().min(1).max(80),
  vectorRef: z.string().min(1).max(512).nullable().optional(),
}).omit({
  createdAt: true,
  id: true,
});

export * from "./auth-schema";
export * from "./schemas/background-job";
