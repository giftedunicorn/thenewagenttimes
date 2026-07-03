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
  "Cohere",
  "Gemini",
  "Mistral",
  "Perplexity",
  "Cursor",
  "Windsurf",
  "Devin",
  "Cognition",
  "GitHub Copilot",
  "Vercel",
  "ElevenLabs",
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

const policyAngleTags = [
  { tag: "ai_act", tokens: ["ai act"] },
  { tag: "executive_order", tokens: ["executive order"] },
  { tag: "export_controls", tokens: ["export control", "export controls"] },
  { tag: "copyright", tokens: ["copyright"] },
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

const securityAngleTags = [
  { tag: "jailbreak", tokens: ["jailbreak"] },
  { tag: "vulnerability", tokens: ["vulnerability"] },
  { tag: "exploit", tokens: ["exploit"] },
] as const;

const openSourceTokens = [
  "apache license",
  "github",
  "mit license",
  "open source",
  "open-source",
  "oss",
] as const;

const openSourceAngleTags = [
  { tag: "open_weights", tokens: ["model weights", "open weights", "weights"] },
  { tag: "apache_license", tokens: ["apache license"] },
  { tag: "mit_license", tokens: ["mit license"] },
  { tag: "github_repo", tokens: ["github", "repository", "repo"] },
] as const;

const codingAgentTokens = [
  "code review",
  "coding",
  "coding agent",
  "copilot",
  "cursor",
  "devin",
  "github copilot",
  "repo automation",
  "repository automation",
  "windsurf",
] as const;

const agentProductAngleTags = [
  { tag: "browser_agent", tokens: ["browser agent", "browser agents"] },
  {
    tag: "workflow_automation",
    tokens: ["workflow", "workflows", "workflow automation"],
  },
  { tag: "enterprise_agent", tokens: ["enterprise"] },
  { tag: "computer_use", tokens: ["computer use", "computer-use"] },
] as const;

const developerToolTokens = [
  ...codingAgentTokens,
  "developer tool",
  "developer tools",
  "ide",
] as const;

const modelEvaluationTokens = [
  "evaluate",
  "evaluation",
  "eval",
  "evals",
] as const;

const toolUseTokens = [
  "function calling",
  "tool calling",
  "tool use",
  "tool-use",
] as const;

const localInferenceTokens = [
  "local inference",
  "local-inference",
  "local llm",
  "local llms",
  "local model",
  "local models",
  "on-device",
  "on device",
] as const;

const modelReleaseAngleTags = [
  { tag: "reasoning", tokens: ["reasoning"] },
  { tag: "api_release", tokens: ["api"] },
  { tag: "multimodal", tokens: ["audio", "multimodal", "vision"] },
  { tag: "pricing", tokens: ["price", "pricing", "token price"] },
] as const;

const fundingRoundTokens = [
  "funding",
  "raise",
  "raises",
  "raised",
  "seed",
  "series a",
  "series b",
  "series c",
] as const;

const fundingRoundTagTokens = [...fundingRoundTokens, "round"] as const;

const seedRoundTokens = ["pre-seed", "seed"] as const;

const fundingStageTags = [
  { tag: "series_a_round", tokens: ["series a"] },
  { tag: "series_b_round", tokens: ["series b"] },
  { tag: "series_c_round", tokens: ["series c"] },
] as const;

const valuationTokens = ["valuation", "valued at"] as const;

const marketMapTokens = [
  "gpu cloud",
  "gpu clouds",
  "infrastructure startups",
  "landscape",
  "market map",
  "startup map",
  "vendor map",
] as const;

const namedHtmlEntities: Partial<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
} as const;

const decodeHtmlEntity = (entity: string) => {
  if (entity.startsWith("#x") || entity.startsWith("#X")) {
    const codePoint = Number.parseInt(entity.slice(2), 16);

    return Number.isFinite(codePoint)
      ? String.fromCodePoint(codePoint)
      : `&${entity};`;
  }

  if (entity.startsWith("#")) {
    const codePoint = Number.parseInt(entity.slice(1), 10);

    return Number.isFinite(codePoint)
      ? String.fromCodePoint(codePoint)
      : `&${entity};`;
  }

  return namedHtmlEntities[entity] ?? `&${entity};`;
};

const decodeHtmlEntities = (text: string) =>
  text.replace(/&([a-zA-Z]+|#[0-9]+|#x[0-9a-fA-F]+);/g, (_match, entity) =>
    decodeHtmlEntity(String(entity)),
  );

const normalizeText = (text: string) =>
  decodeHtmlEntities(text.replace(/<[^>]*>/g, " "))
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
  if (hasAnyToken(text, [...fundingRoundTokens, ...valuationTokens])) {
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
  if (hasAnyToken(text, codingAgentTokens) && hasAiContext(text)) {
    return "agent_product";
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
  if (hasToken(text, "prompt injection")) tags.add("prompt_injection");
  if (hasToken(text, "red team")) tags.add("red_team");
  if (hasAnyToken(text, codingAgentTokens)) tags.add("coding_agent");
  if (
    hasAnyToken(text, developerToolTokens) ||
    sourceSlug.includes("developer-tools")
  ) {
    tags.add("developer_tool");
  }
  if (hasAnyToken(text, modelEvaluationTokens)) tags.add("evals");
  if (hasAnyToken(text, toolUseTokens)) tags.add("tool_use");
  if (hasAnyToken(text, localInferenceTokens)) tags.add("local_inference");
  if (input.category === "policy") {
    policyAngleTags.forEach(({ tag, tokens }) => {
      if (hasAnyToken(text, tokens)) tags.add(tag);
    });
  }
  if (input.category === "security") {
    securityAngleTags.forEach(({ tag, tokens }) => {
      if (hasAnyToken(text, tokens)) tags.add(tag);
    });
  }
  if (input.category === "open_source") {
    openSourceAngleTags.forEach(({ tag, tokens }) => {
      if (hasAnyToken(text, tokens)) tags.add(tag);
    });
  }
  if (input.category === "model_release") {
    modelReleaseAngleTags.forEach(({ tag, tokens }) => {
      if (hasAnyToken(text, tokens)) tags.add(tag);
    });
  }
  if (input.category === "agent_product") {
    agentProductAngleTags.forEach(({ tag, tokens }) => {
      if (hasAnyToken(text, tokens)) tags.add(tag);
    });
  }
  if (input.category === "funding") {
    if (hasAnyToken(text, fundingRoundTagTokens)) tags.add("funding_round");
    if (hasAnyToken(text, seedRoundTokens)) tags.add("seed_round");
    fundingStageTags.forEach(({ tag, tokens }) => {
      if (hasAnyToken(text, tokens)) tags.add(tag);
    });
    if (hasAnyToken(text, valuationTokens)) tags.add("valuation");
  }
  if (hasAnyToken(text, ["gpu cloud", "gpu clouds"])) tags.add("gpu_cloud");
  if (
    hasAnyToken(text, [
      "gpu cloud",
      "gpu clouds",
      "inference platform",
      "inference platforms",
      "infrastructure",
      "infrastructure startups",
    ])
  ) {
    tags.add("infrastructure");
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
  contextText?: string;
  tags?: string[];
  entities?: string[];
}): NewsItemInput => {
  const title = normalizeText(input.title);
  const summary = normalizeText(input.summary);
  const bodyText = input.bodyText ? normalizeText(input.bodyText) : undefined;
  const contextText = input.contextText
    ? normalizeText(input.contextText)
    : undefined;
  const canonicalUrl = canonicalizeUrl(input.url);
  const fullText = [title, summary, bodyText, contextText]
    .filter(Boolean)
    .join(" ");
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
    contextText: input.item.categories?.join(" "),
  });

export const normalizeManualItem = (input: ManualNewsInput): NewsItemInput =>
  normalizeShared(input);
