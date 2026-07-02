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
  "SpaceX",
  "Cloudflare",
  "Claude",
  "Gemini",
  "Mistral",
  "Perplexity",
] as const;

const bigTechTokens = [
  "amazon",
  "apple",
  "google",
  "meta",
  "microsoft",
  "nvidia",
] as const;

const aiContextTokens = [
  "agent",
  "agents",
  "agentic",
  "ai",
  "artificial intelligence",
  "automation",
  "benchmark",
  "copilot",
  "deep learning",
  "gemini",
  "generative",
  "gpt",
  "llm",
  "llms",
  "machine learning",
  "model",
  "models",
  "neural",
  "open source",
  "reasoning",
  "robotics",
  "weights",
  "workflow",
] as const;

const hotTakeTokens = [
  "contrarian",
  "hot take",
  "hype",
  "overhyped",
  "op-ed",
  "opinion",
] as const;

const policyTokens = [
  "ai act",
  "bill",
  "congress",
  "executive order",
  "lawmakers",
  "policy",
  "regulation",
  "regulatory",
  "senate",
  "white house",
] as const;

const securityTokens = [
  "attack",
  "cybersecurity",
  "exploit",
  "jailbreak",
  "prompt injection",
  "red team",
  "security",
  "vulnerability",
] as const;

const openSourceTokens = [
  "apache license",
  "github",
  "mit license",
  "open source",
  "open-source",
  "oss",
] as const;

const marketMapTokens = [
  "gpu cloud",
  "gpu clouds",
  "infrastructure startups",
  "landscape",
  "market map",
  "startup map",
  "vendor map",
] as const;

const normalizeText = (text: string) =>
  text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasToken = (text: string, token: string) =>
  new RegExp(`(^|[^a-z0-9])${escapeRegExp(token)}([^a-z0-9]|$)`, "i").test(
    normalizeText(text),
  );

const hasAnyToken = (text: string, tokens: readonly string[]) =>
  tokens.some((token) => hasToken(text, token));

const hasAiContext = (text: string) => hasAnyToken(text, aiContextTokens);

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
  return knownEntities.filter((entity) => hasToken(text, entity));
};

export const inferNewsCategory = (input: {
  text: string;
  sourceSlug?: string;
}): NewsCategory => {
  const text = input.text.toLowerCase();
  const sourceSlug = input.sourceSlug?.toLowerCase() ?? "";

  if (hasToken(text, "product hunt") || sourceSlug.includes("product-hunt")) {
    return "product_hunt";
  }
  if (sourceSlug.includes("arxiv")) {
    return "research";
  }
  if (sourceSlug.includes("github")) {
    return "open_source";
  }
  if (hasAnyToken(text, hotTakeTokens)) {
    return "hot_take";
  }
  if (
    hasAnyToken(text, [
      "funding",
      "raises",
      "seed",
      "series a",
      "series b",
      "valuation",
    ])
  ) {
    return "funding";
  }
  if (hasAnyToken(text, ["elon musk", "xai", "grok", "tesla ai"])) {
    return "musk_ai";
  }
  if (hasAnyToken(text, ["yc", "y combinator"]) || sourceSlug.includes("yc")) {
    return "yc_ai";
  }
  if (hasAnyToken(text, policyTokens) && hasAiContext(text)) {
    return "policy";
  }
  if (hasAnyToken(text, securityTokens) && hasAiContext(text)) {
    return "security";
  }
  if (hasAnyToken(text, openSourceTokens) && hasAiContext(text)) {
    return "open_source";
  }
  if (hasAnyToken(text, marketMapTokens) && hasAiContext(text)) {
    return "market_map";
  }
  if (
    hasAnyToken(text, ["arxiv", "paper", "benchmark", "evaluation", "research"])
  ) {
    return "research";
  }
  if (
    hasAnyToken(text, [
      "framework",
      "protocol",
      "paradigm",
      "new term",
      "concept",
    ])
  ) {
    return "new_concept";
  }
  if (hasAnyToken(text, ["openai", "anthropic"])) {
    if (hasAnyToken(text, ["model", "models", "release", "api"])) {
      return "model_release";
    }
    return "big_tech";
  }
  if (hasAnyToken(text, bigTechTokens) && hasAiContext(text)) {
    if (hasAnyToken(text, ["model", "models", "release", "api"])) {
      return "model_release";
    }
    return "big_tech";
  }
  if (
    hasAnyToken(text, [
      "model",
      "models",
      "release",
      "benchmark",
      "weights",
      "api",
    ])
  ) {
    return "model_release";
  }
  if (
    hasAnyToken(text, [
      "agent",
      "agents",
      "agentic",
      "workflow",
      "automation",
      "browser",
    ])
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

  if (hasAnyToken(text, ["agent", "agents", "agentic"])) tags.add("agent");
  if (hasAnyToken(text, ["model", "models", "llm", "llms"])) {
    tags.add("model");
  }
  if (hasToken(text, "yc") || sourceSlug.includes("yc")) tags.add("yc");
  if (hasToken(text, "product hunt") || sourceSlug.includes("product-hunt")) {
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
  now?: Date;
}): NewsItemInput =>
  normalizeShared({
    sourceId: input.sourceId,
    sourceSlug: input.sourceSlug,
    title: input.item.title,
    url: input.item.url,
    summary: input.item.summary ?? input.item.title,
    bodyText: input.item.bodyText,
    publishedAt: input.item.publishedAt ?? input.now ?? new Date(),
    authorName: input.item.authorName,
    imageUrl: input.item.imageUrl,
  });

export const normalizeManualItem = (input: ManualNewsInput): NewsItemInput =>
  normalizeShared(input);
