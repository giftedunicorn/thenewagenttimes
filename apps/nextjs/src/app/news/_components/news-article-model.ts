import type { RankedNewsItem } from "@acme/validators";

import type { NewsArticleItem, NewsHomeItem } from "../../_data/news";

const normalizeValue = (value: string) => value.trim().toLowerCase();

const getNormalizedSet = (values: readonly string[]) =>
  new Set(values.map(normalizeValue).filter(Boolean));

const getSharedValues = (
  baseValues: readonly string[],
  candidateValues: readonly string[],
) => {
  const candidateSet = getNormalizedSet(candidateValues);
  const sharedValues: string[] = [];
  const seenValues = new Set<string>();

  for (const value of baseValues) {
    const normalizedValue = normalizeValue(value);

    if (!normalizedValue) continue;
    if (!candidateSet.has(normalizedValue)) continue;
    if (seenValues.has(normalizedValue)) continue;

    sharedValues.push(value.trim());
    seenValues.add(normalizedValue);
  }

  return sharedValues;
};

const formatSignalCount = (count: number) =>
  `${count} ${count === 1 ? "signal" : "signals"}`;

const categoryLabels: Record<string, string> = {
  funding: "Funding",
  product_hunt: "Product Hunt",
  model_release: "Models",
  new_concept: "New Concepts",
  hot_take: "Hot Takes",
  agent_product: "Agents",
  big_tech: "Big Tech",
  musk_ai: "Musk AI",
  yc_ai: "YC AI",
  research: "Research",
  policy: "Policy",
  security: "Security",
  open_source: "Open Source",
  market_map: "Market Maps",
  other: "Other",
};

const getUniqueValues = (values: readonly string[], limit: number) => {
  const seenValues = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    const trimmedValue = value.trim();
    const normalizedValue = normalizeValue(trimmedValue);

    if (!trimmedValue || seenValues.has(normalizedValue)) continue;

    uniqueValues.push(trimmedValue);
    seenValues.add(normalizedValue);
  }

  return uniqueValues.slice(0, limit);
};

const getArticleText = (article: NewsArticleItem) => {
  const bodyText = article.bodyText?.trim();

  return bodyText && bodyText.length > 0 ? bodyText : article.summary;
};

const splitArticleFacts = (text: string) =>
  text
    .split(/\n{2,}|(?<=[.!?])\s+/)
    .map((fact) => fact.trim())
    .filter(Boolean)
    .slice(0, 3);

const getReadTimeLabel = (text: string) => {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / 220));

  return `${minutes} min read`;
};

export const getNewsArticleDigest = ({
  article,
}: {
  article: NewsArticleItem;
}) => {
  const articleText = getArticleText(article);

  return {
    entities: getUniqueValues(article.entities, 4),
    facts: splitArticleFacts(articleText),
    readTimeLabel: getReadTimeLabel(articleText),
    sourceLine: `${article.sourceName} / ${
      categoryLabels[article.category] ?? article.category
    }`,
    tags: getUniqueValues(article.tags, 4),
  };
};

export const getNewsArticleSourceLens = ({
  article,
}: {
  article: NewsArticleItem;
}) => {
  const entityCount = getUniqueValues(article.entities, 100).length;
  const tagCount = getUniqueValues(article.tags, 100).length;
  const highCredibility = article.sourceScore >= 80;
  const strongHeat = article.trendScore >= 70;
  const denseSignals = entityCount >= 3;
  const tone = highCredibility && strongHeat ? "High confidence" : "Watch";

  return {
    lines: [
      { label: "Source", value: article.sourceName },
      { label: "Type", value: article.sourceType },
      { label: "Credibility", value: `${article.sourceScore}/100` },
      { label: "Heat", value: `${article.trendScore}/100` },
      {
        label: "Signals",
        value: `${entityCount} ${
          entityCount === 1 ? "entity" : "entities"
        } / ${tagCount} ${tagCount === 1 ? "tag" : "tags"}`,
      },
    ],
    summary: `${highCredibility ? "High-credibility" : "Lower-confidence"} ${
      article.sourceType
    } source with ${strongHeat ? "strong" : "quieter"} edition heat and ${
      denseSignals ? "dense" : "sparse"
    } entity coverage.`,
    tone,
  };
};

const getRecommendationReason = ({
  sameCategory,
  sameSource,
  sharedEntities,
  sharedTags,
}: {
  sameCategory: boolean;
  sameSource: boolean;
  sharedEntities: readonly string[];
  sharedTags: readonly string[];
}) => {
  const [entity] = sharedEntities;
  if (entity) return `${entity} thread`;

  if (sameCategory) return "Same topic";
  if (sameSource) return "Same source";

  const [tag] = sharedTags;
  if (tag) return `${tag} thread`;

  return "Reader signal";
};

export const getNewsArticleReadingPath = ({
  article,
  formatCategory,
  limit,
  relatedItems,
}: {
  article: NewsArticleItem;
  formatCategory: (category: string) => string;
  limit: number;
  relatedItems: readonly RankedNewsItem<NewsHomeItem>[];
}) => {
  const context = [
    { label: "Topic", value: formatCategory(article.category) },
    { label: "Source", value: article.sourceName },
    {
      label: "Entities",
      value: article.entities.slice(0, 4).join(", ") || "None",
    },
    { label: "Tags", value: article.tags.slice(0, 4).join(", ") || "None" },
  ];

  const recommendations = relatedItems
    .map((item) => {
      const sharedEntities = getSharedValues(article.entities, item.entities);
      const sharedTags = getSharedValues(article.tags, item.tags);
      const sameCategory = item.category === article.category;
      const sameSource = item.sourceSlug === article.sourceSlug;
      const signalCount =
        sharedEntities.length +
        sharedTags.length +
        (sameCategory ? 1 : 0) +
        (sameSource ? 1 : 0);

      return {
        id: item.id,
        personalizedScore: item.personalizedScore,
        publishedAt: item.publishedAt,
        reason: getRecommendationReason({
          sameCategory,
          sameSource,
          sharedEntities,
          sharedTags,
        }),
        signalCount,
        scoreLabel: `${formatSignalCount(signalCount)} / ${
          item.personalizedScore
        } score`,
        title: item.title,
      };
    })
    .filter((item) => item.signalCount > 0)
    .sort((left, right) => {
      if (right.signalCount !== left.signalCount) {
        return right.signalCount - left.signalCount;
      }

      if (right.personalizedScore !== left.personalizedScore) {
        return right.personalizedScore - left.personalizedScore;
      }

      return (
        new Date(right.publishedAt).getTime() -
        new Date(left.publishedAt).getTime()
      );
    })
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      reason: item.reason,
      signalCount: item.signalCount,
      scoreLabel: item.scoreLabel,
      title: item.title,
    }));

  return {
    context,
    recommendations,
    summary:
      recommendations.length > 0
        ? `${recommendations.length} follow-ups ranked by article overlap, shared entities, and reader signals.`
        : "Reading path will appear as related stories load.",
  };
};
