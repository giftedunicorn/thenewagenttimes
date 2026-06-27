import { createHash } from "node:crypto";

import type { newsCategoryValues } from "@acme/db/schema";
import { CreateNewsItemSchema } from "@acme/db/schema";

import type { ManualNewsInput, NewsItemInput, RawFeedItem } from "./types";

type NewsCategory = (typeof newsCategoryValues)[number];

const trackingParams = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
]);

const knownEntities = [
  "OpenAI",
  "Anthropic",
  "Google",
  "DeepMind",
  "Meta",
  "Microsoft",
  "NVIDIA",
  "Hugging Face",
  "LangChain",
  "Elon Musk",
  "xAI",
  "Grok",
  "Tesla",
  "YC",
  "Y Combinator",
] as const;

const normalizeText = (text: string) =>
  text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const slugText = (text: string) =>
  normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const canonicalizeUrl = (url: string): string => {
  const parsed = new URL(url);
  parsed.hash = "";

  for (const param of [...parsed.searchParams.keys()]) {
    if (trackingParams.has(param.toLowerCase())) {
      parsed.searchParams.delete(param);
    }
  }

  parsed.searchParams.sort();

  return parsed.toString().replace(/\?$/, "");
};

export const buildDedupeKey = (input: {
  sourceId: string;
  title: string;
  canonicalUrl: string;
}) => {
  const canonicalUrl = canonicalizeUrl(input.canonicalUrl);
  const digest = createHash("sha256")
    .update(`${input.sourceId}:${canonicalUrl}:${slugText(input.title)}`)
    .digest("hex")
    .slice(0, 24);

  return `${slugText(input.title).slice(0, 80)}-${digest}`;
};

export const extractEntities = (text: string): string[] => {
  const lowerText = text.toLowerCase();

  return knownEntities.filter((entity) =>
    lowerText.includes(entity.toLowerCase()),
  );
};

export const inferNewsCategory = (input: {
  text: string;
  sourceSlug?: string;
}): NewsCategory => {
  const text = input.text.toLowerCase();
  const sourceSlug = input.sourceSlug?.toLowerCase() ?? "";

  if (text.includes("product hunt") || sourceSlug.includes("product-hunt")) {
    return "product_hunt";
  }
  if (
    text.includes("funding") ||
    text.includes("raises") ||
    text.includes(" seed ") ||
    text.includes("series a") ||
    text.includes("series b") ||
    text.includes("valuation")
  ) {
    return "funding";
  }
  if (
    text.includes("elon musk") ||
    text.includes(" xai") ||
    text.includes("grok") ||
    text.includes("tesla ai")
  ) {
    return "musk_ai";
  }
  if (
    text.includes("yc ") ||
    text.includes(" y combinator") ||
    sourceSlug.includes("yc")
  ) {
    return "yc_ai";
  }
  if (
    text.includes("arxiv") ||
    text.includes("paper") ||
    text.includes("benchmark") ||
    text.includes("evaluation") ||
    text.includes("research")
  ) {
    return "research";
  }
  if (
    text.includes("framework") ||
    text.includes("protocol") ||
    text.includes("paradigm") ||
    text.includes("new term") ||
    text.includes("concept")
  ) {
    return "new_concept";
  }
  if (
    text.includes("openai") ||
    text.includes("anthropic") ||
    text.includes("google") ||
    text.includes("meta") ||
    text.includes("microsoft") ||
    text.includes("nvidia") ||
    text.includes("amazon") ||
    text.includes("apple")
  ) {
    if (
      text.includes("model") ||
      text.includes("release") ||
      text.includes("api")
    ) {
      return "model_release";
    }
    return "big_tech";
  }
  if (
    text.includes("model") ||
    text.includes("release") ||
    text.includes("benchmark") ||
    text.includes("weights") ||
    text.includes("api")
  ) {
    return "model_release";
  }
  if (
    text.includes("agent") ||
    text.includes("workflow") ||
    text.includes("automation") ||
    text.includes("browser")
  ) {
    return "agent_product";
  }

  return "other";
};

const tagsFor = (input: {
  text: string;
  sourceSlug?: string;
  category: NewsCategory;
}) => {
  const tags = new Set<string>([input.category]);
  const text = input.text.toLowerCase();
  const sourceSlug = input.sourceSlug?.toLowerCase() ?? "";

  if (text.includes("agent")) tags.add("agent");
  if (text.includes("model")) tags.add("model");
  if (text.includes("yc") || sourceSlug.includes("yc")) tags.add("yc");
  if (text.includes("product hunt") || sourceSlug.includes("product-hunt")) {
    tags.add("product_hunt");
  }

  return [...tags];
};

const normalizeShared = (input: {
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
}): NewsItemInput => {
  const title = normalizeText(input.title);
  const summary = normalizeText(input.summary);
  const bodyText = input.bodyText ? normalizeText(input.bodyText) : undefined;
  const canonicalUrl = canonicalizeUrl(input.url);
  const fullText = [title, summary, bodyText].filter(Boolean).join(" ");
  const category = inferNewsCategory({
    text: fullText,
    sourceSlug: input.sourceSlug,
  });
  const inferredTags = tagsFor({
    text: fullText,
    sourceSlug: input.sourceSlug,
    category,
  });
  const entities = input.entities ?? extractEntities(fullText);

  return CreateNewsItemSchema.parse({
    sourceId: input.sourceId,
    title,
    summary,
    bodyText,
    canonicalUrl,
    originalUrl: input.url,
    imageUrl: input.imageUrl,
    authorName: input.authorName,
    publishedAt: input.publishedAt,
    status: "published",
    category,
    tags: [...new Set([...(input.tags ?? []), ...inferredTags])],
    entities,
    dedupeKey: buildDedupeKey({
      sourceId: input.sourceId,
      title,
      canonicalUrl,
    }),
    embeddingStatus: "pending",
  });
};

export const normalizeFeedItem = (input: {
  sourceId: string;
  sourceSlug?: string;
  item: RawFeedItem;
}): NewsItemInput =>
  normalizeShared({
    sourceId: input.sourceId,
    sourceSlug: input.sourceSlug,
    title: input.item.title,
    url: input.item.url,
    summary: input.item.summary ?? input.item.title,
    bodyText: input.item.bodyText,
    publishedAt: input.item.publishedAt ?? new Date(),
    authorName: input.item.authorName,
    imageUrl: input.item.imageUrl,
  });

export const normalizeManualItem = (input: ManualNewsInput): NewsItemInput =>
  normalizeShared(input);
