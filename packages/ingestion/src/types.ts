import type { z } from "zod/v4";

import type {
  CreateNewsItemSchema,
  CreateNewsItemVectorSchema,
  CreateNewsSourceSchema,
} from "@acme/db/schema";

export type NewsSourceInput = z.infer<typeof CreateNewsSourceSchema>;
export type NewsItemInput = z.infer<typeof CreateNewsItemSchema>;
export type NewsItemVectorInput = z.infer<typeof CreateNewsItemVectorSchema>;

export interface RawFeedItem {
  title: string;
  url: string;
  id?: string;
  summary?: string;
  bodyText?: string;
  publishedAt?: Date;
  authorName?: string;
  imageUrl?: string;
}

export interface ManualNewsInput {
  sourceId: string;
  sourceSlug?: string;
  title: string;
  url: string;
  summary: string;
  bodyText?: string;
  publishedAt: Date;
  authorName?: string;
  imageUrl?: string;
  tags?: string[];
  entities?: string[];
}

export interface PendingEmbeddingNewsItem {
  id: string;
  title: string;
  summary: string;
  bodyText: string | null;
  category: NewsItemInput["category"];
  tags: string[];
  entities: string[];
}

export interface EmbeddingResult {
  provider: string;
  model: string;
  dimension: number;
  embedding: number[];
  vectorRef?: string;
}

export interface EmbeddingProvider {
  embed(input: string): Promise<EmbeddingResult>;
}

export interface NewsRepository {
  seedSources(sources: NewsSourceInput[]): Promise<{ created: number }>;
  findSourceBySlug(slug: string): Promise<{
    id: string;
    slug: string;
    feedUrl: string | null;
  } | null>;
  startIngestionRun(input: {
    sourceId: string;
    runType: "rss" | "manual_import" | "api" | "crawler" | "backfill";
  }): Promise<{ id: string }>;
  finishIngestionRun(input: {
    runId: string;
    status: "succeeded" | "failed" | "partial";
    itemsSeen: number;
    itemsCreated: number;
    itemsUpdated: number;
    errorMessage?: string;
  }): Promise<void>;
  upsertNewsItem(
    item: NewsItemInput,
  ): Promise<"created" | "updated" | "duplicate">;
  findPendingEmbeddingItems(limit: number): Promise<PendingEmbeddingNewsItem[]>;
  insertNewsItemVector(
    vector: NewsItemVectorInput & { newsItemId: string },
  ): Promise<void>;
  updateEmbeddingStatus(
    newsItemId: string,
    status: "pending" | "embedded" | "failed" | "skipped",
  ): Promise<void>;
}
