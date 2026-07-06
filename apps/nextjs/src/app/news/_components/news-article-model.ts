import type {
  NewsPreferenceProfile,
  NewsUrlReference,
  RankedNewsItem,
  ReaderInteractionAction,
} from "@acme/validators";
import {
  getNewsDedupeUrlKeys,
  normalizeNewsPreferenceProfile,
  shouldTrainReaderProfileFromInteraction,
  updateReaderProfileWithInteraction,
} from "@acme/validators";

import type {
  NewsPositiveFeedbackMemoryItem,
  NewsReaderMemoryItem,
  NewsServerProfileAudit,
} from "../../_components/news-home-model";
import type { NewsArticleItem, NewsHomeItem } from "../../_data/news";
import {
  getNewsServerProfileAuditDisplay,
  getNewsStorySourceUrl,
} from "../../_components/news-home-model";

const normalizeValue = (value: string) => value.trim().toLowerCase();

const getOptionalArticleClusterKey = ({
  clusterKey,
}: {
  clusterKey?: string | null;
}) => {
  const normalizedClusterKey = clusterKey?.trim().toLowerCase();

  if (!normalizedClusterKey) return null;

  return normalizedClusterKey;
};

const hasSameArticleClusterKey = (
  left: { clusterKey?: string | null },
  right: { clusterKey?: string | null },
) => {
  const leftClusterKey = getOptionalArticleClusterKey(left);

  return (
    leftClusterKey !== null &&
    leftClusterKey === getOptionalArticleClusterKey(right)
  );
};

const hasSameNormalizedValue = (left: string, right: string) => {
  const normalizedLeft = normalizeValue(left);

  return Boolean(normalizedLeft) && normalizedLeft === normalizeValue(right);
};

const formatSharedValue = (value: string) => value.trim();

const formatTagValue = (value: string) =>
  value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

const normalizeTagValue = (value: string) =>
  normalizeValue(formatTagValue(value));

const isSpecificTagValue = (value: string) => /\s/.test(formatTagValue(value));

const getNormalizedSet = (
  values: readonly string[],
  normalize: (value: string) => string = normalizeValue,
) => new Set(values.map(normalize).filter(Boolean));

const getSharedValues = (
  baseValues: readonly string[],
  candidateValues: readonly string[],
  normalize: (value: string) => string = normalizeValue,
  formatValue: (value: string) => string = formatSharedValue,
) => {
  const candidateSet = getNormalizedSet(candidateValues, normalize);
  const sharedValues: string[] = [];
  const seenValues = new Set<string>();

  for (const value of baseValues) {
    const normalizedValue = normalize(value);

    if (!normalizedValue) continue;
    if (!candidateSet.has(normalizedValue)) continue;
    if (seenValues.has(normalizedValue)) continue;

    sharedValues.push(formatValue(value));
    seenValues.add(normalizedValue);
  }

  return sharedValues;
};

const formatSignalCount = (count: number) =>
  `${count} ${count === 1 ? "signal" : "signals"}`;

const nonReaderArticleRecommendationSignals = new Set([
  "angle_quota",
  "category_quota",
  "collaborative_negative_feedback",
  "daypart",
  "entity_quota",
  "exploration",
  "freshness_quota",
  "negative_feedback",
  "source_corroboration",
  "source_quota",
  "source_trust",
]);

const positiveArticleReaderMemoryActionSignals = [
  "positive_share_feedback",
  "positive_save_feedback",
  "positive_source_click_feedback",
  "positive_read_feedback",
] as const;

const isPositiveArticleReaderMemoryActionSignal = (signal: string) =>
  positiveArticleReaderMemoryActionSignals.some(
    (actionSignal) => actionSignal === signal,
  );

const getArticleReaderRecommendationSignalCount = (
  item: RankedNewsItem<NewsHomeItem>,
) => {
  const hasPositiveFeedback = item.matchedSignals.includes("positive_feedback");

  return item.matchedSignals.filter(
    (signal) =>
      !nonReaderArticleRecommendationSignals.has(signal) &&
      (!hasPositiveFeedback ||
        !isPositiveArticleReaderMemoryActionSignal(signal)),
  ).length;
};

const hasArticleSourceTrustGuardrail = (item: RankedNewsItem<NewsHomeItem>) =>
  item.matchedSignals.includes("source_trust");

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

export const getNewsArticleFormattedDate = (date: string) =>
  new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(date));

export const getNewsArticleReadPercent = ({
  documentHeight,
  scrollY,
  viewportHeight,
}: {
  documentHeight: number;
  scrollY: number;
  viewportHeight: number;
}) => {
  if (documentHeight <= 0) return 0;

  const readPercent = (Math.max(scrollY, 0) + viewportHeight) / documentHeight;

  return Math.min(Math.max(Math.round(readPercent * 100) / 100, 0), 1);
};

export const shouldTrainNewsArticleProfileFromReadPercent = (
  readPercent: number,
) =>
  shouldTrainReaderProfileFromInteraction({
    action: "view",
    readPercent,
  });

export type NewsArticleReadMilestone =
  | "opened"
  | "meaningful_read"
  | "deep_read";

interface NewsArticleReadMilestoneDefinition {
  key: NewsArticleReadMilestone;
  minReadPercent: number;
  shouldShowFeedback: boolean;
}

const newsArticleReadMilestones = [
  {
    key: "deep_read",
    minReadPercent: 0.8,
    shouldShowFeedback: true,
  },
  {
    key: "meaningful_read",
    minReadPercent: 0.35,
    shouldShowFeedback: false,
  },
  {
    key: "opened",
    minReadPercent: 0.01,
    shouldShowFeedback: false,
  },
] as const satisfies readonly NewsArticleReadMilestoneDefinition[];

export const getNewsArticleReadDepthCheckpoints = () =>
  [...newsArticleReadMilestones]
    .filter((milestone) => milestone.key !== "opened")
    .sort((left, right) => left.minReadPercent - right.minReadPercent)
    .map((milestone) => ({
      key: milestone.key,
      readPercent: milestone.minReadPercent,
      topPercent: Math.round(milestone.minReadPercent * 100),
    }));

export const getNewsArticleSourceUrl = (
  article: Pick<NewsArticleItem, "canonicalUrl" | "originalUrl">,
) => getNewsStorySourceUrl(article);

export const getNewsArticleSourceFollowState = ({
  article,
  profile,
}: {
  article: Pick<NewsArticleItem, "sourceName" | "sourceSlug">;
  profile: NewsPreferenceProfile;
}) => {
  const followedSources = getNormalizedSet(profile.preferredSources);
  const isFollowing = followedSources.has(normalizeValue(article.sourceSlug));

  return {
    isFollowing,
    label: isFollowing ? "Following Source" : "Follow Source",
    summary: isFollowing
      ? `${article.sourceName} is already a durable For You signal.`
      : `Follow ${article.sourceName} to make it a durable For You signal.`,
  };
};

export const getNewsArticleSourceFollowProfile = ({
  article,
  profile,
}: {
  article: Pick<NewsArticleItem, "sourceSlug">;
  profile: NewsPreferenceProfile;
}): NewsPreferenceProfile => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const articleSourceSlug = normalizeValue(article.sourceSlug);
  const preferredSources = [
    ...normalizedProfile.preferredSources
      .map(normalizeValue)
      .filter((sourceSlug) => sourceSlug && sourceSlug !== articleSourceSlug),
    articleSourceSlug,
  ];

  return normalizeNewsPreferenceProfile({
    ...normalizedProfile,
    preferredSources,
  });
};

const newsArticleReadMilestoneRank = new Map<NewsArticleReadMilestone, number>(
  newsArticleReadMilestones.map((milestone, index) => [milestone.key, index]),
);

const isNewsArticleReadMilestoneCovered = ({
  milestone,
  recordedMilestones,
}: {
  milestone: NewsArticleReadMilestone;
  recordedMilestones: readonly NewsArticleReadMilestone[];
}) => {
  const milestoneRank = newsArticleReadMilestoneRank.get(milestone);

  if (milestoneRank === undefined) return false;

  return recordedMilestones.some((recordedMilestone) => {
    const recordedRank = newsArticleReadMilestoneRank.get(recordedMilestone);

    return recordedRank !== undefined && recordedRank <= milestoneRank;
  });
};

export const getNewsArticleReadTrainingReceipt = ({
  article,
  formatCategory,
  recordedMilestones,
}: {
  article: NewsArticleItem;
  formatCategory: (category: string) => string;
  recordedMilestones: readonly NewsArticleReadMilestone[];
}) => {
  const topicLabel = formatCategory(article.category);
  const opened = isNewsArticleReadMilestoneCovered({
    milestone: "opened",
    recordedMilestones,
  });
  const meaningfulRead = isNewsArticleReadMilestoneCovered({
    milestone: "meaningful_read",
    recordedMilestones,
  });
  const deepRead = isNewsArticleReadMilestoneCovered({
    milestone: "deep_read",
    recordedMilestones,
  });
  const trainingSignalCount = Number(meaningfulRead) + Number(deepRead);
  const nextTarget = !opened
    ? "Open"
    : !meaningfulRead
      ? "35%"
      : !deepRead
        ? "80%"
        : "Complete";
  const getStageStatus = (
    milestone: NewsArticleReadMilestone,
  ): "done" | "locked" | "next" => {
    if (
      isNewsArticleReadMilestoneCovered({
        milestone,
        recordedMilestones,
      })
    ) {
      return "done";
    }

    if (milestone === "opened") return "next";
    if (milestone === "meaningful_read") return opened ? "next" : "locked";
    return meaningfulRead ? "next" : "locked";
  };

  return {
    label: deepRead
      ? "Deep Read"
      : meaningfulRead
        ? "Training"
        : opened
          ? "Opened"
          : "Awaiting Read",
    metrics: [
      { label: "Opened", value: opened ? "Yes" : "No" },
      { label: "Training signals", value: String(trainingSignalCount) },
      { label: "Next target", value: nextTarget },
    ],
    nextStep: deepRead
      ? `Deep read has trained For You toward ${topicLabel} from ${article.sourceName}.`
      : meaningfulRead
        ? `Read to 80% to strengthen ${topicLabel} and related entity memory.`
        : opened
          ? `Read to 35% to train ${topicLabel} and add this article to reading history.`
          : `Open this article to start reader-memory training for ${topicLabel}.`,
    stages: [
      {
        detail:
          "The article open is logged, but it does not train preferences yet.",
        key: "opened",
        label: "Opened",
        status: getStageStatus("opened"),
        target: "Open",
      },
      {
        detail: "Reading to 35% starts profile training and reading history.",
        key: "meaningful_read",
        label: "Meaningful read",
        status: getStageStatus("meaningful_read"),
        target: "35%",
      },
      {
        detail: "Reading to 80% strengthens related topic and entity memory.",
        key: "deep_read",
        label: "Deep read",
        status: getStageStatus("deep_read"),
        target: "80%",
      },
    ],
    summary: deepRead
      ? `Deep read trained the For You model toward ${topicLabel}.`
      : meaningfulRead
        ? `Meaningful read is training ${topicLabel}; deep read adds stronger memory.`
        : opened
          ? "This open is logged; the For You model waits for a meaningful read."
          : "Article read training starts after the reader opens this story.",
  };
};

export const getNewsArticleLocalHistoryItem = ({
  article,
  viewedAt,
}: {
  article: NewsArticleItem;
  viewedAt: string;
}): NewsReaderMemoryItem => ({
  canonicalUrl: article.canonicalUrl,
  category: article.category,
  entities: [...article.entities],
  id: article.id,
  originalUrl: article.originalUrl,
  sourceName: article.sourceName,
  sourceSlug: article.sourceSlug,
  title: article.title,
  viewedAt,
});

export const getNewsArticleLocalSavedItem = ({
  article,
  savedAt,
}: {
  article: NewsArticleItem;
  savedAt: string;
}): NewsReaderMemoryItem => ({
  canonicalUrl: article.canonicalUrl,
  category: article.category,
  entities: [...article.entities],
  id: article.id,
  originalUrl: article.originalUrl,
  savedAt,
  sourceName: article.sourceName,
  sourceSlug: article.sourceSlug,
  tags: [...article.tags],
  title: article.title,
});

export const getNewsArticleSaveSignalState = ({
  article,
  articleId,
  savedItems,
}: {
  article?: NewsUrlReference;
  articleId: string;
  savedItems: readonly ({ id: string } & NewsUrlReference)[];
}) => {
  const articleUrlKeys = new Set(article ? getNewsDedupeUrlKeys(article) : []);
  const isSaved = savedItems.some(
    (item) =>
      item.id === articleId ||
      (articleUrlKeys.size > 0 &&
        getNewsDedupeUrlKeys(item).some((urlKey) =>
          articleUrlKeys.has(urlKey),
        )),
  );

  return {
    isSaved,
    label: isSaved ? "Remove saved signal" : "Save signal",
  };
};

export const getNewsArticleGuardrailSignalState = ({
  article,
  articleId,
  guardrailItems,
}: {
  article?: NewsUrlReference;
  articleId: string;
  guardrailItems: readonly ({ id: string } & Partial<NewsUrlReference>)[];
}) => {
  const articleUrlKeys = new Set(article ? getNewsDedupeUrlKeys(article) : []);
  const isGuardrailed = guardrailItems.some(
    (item) =>
      item.id === articleId ||
      (articleUrlKeys.size > 0 &&
        getNewsDedupeUrlKeys(item).some((urlKey) =>
          articleUrlKeys.has(urlKey),
        )),
  );

  return {
    isGuardrailed,
    label: isGuardrailed ? "Restore signal" : "Less like this",
  };
};

export const getNewsArticleLocalGuardrailItem = ({
  article,
  hiddenAt,
}: {
  article: NewsArticleItem;
  hiddenAt: string;
}): NewsReaderMemoryItem => ({
  canonicalUrl: article.canonicalUrl,
  category: article.category,
  entities: [...article.entities],
  hiddenAt,
  id: article.id,
  occurredAt: hiddenAt,
  originalUrl: article.originalUrl,
  sourceName: article.sourceName,
  sourceSlug: article.sourceSlug,
  tags: [...article.tags],
  title: article.title,
});

const isNewsArticlePositiveFeedbackAction = (
  action: ReaderInteractionAction,
): action is Extract<ReaderInteractionAction, "click_source" | "share"> =>
  action === "click_source" || action === "share";

export const getNewsArticleLocalPositiveFeedbackItem = ({
  action,
  article,
  occurredAt,
}: {
  action: Extract<ReaderInteractionAction, "click_source" | "share">;
  article: NewsArticleItem;
  occurredAt: string;
}): NewsPositiveFeedbackMemoryItem => ({
  action,
  canonicalUrl: article.canonicalUrl,
  category: article.category,
  entities: [...article.entities],
  id: article.id,
  occurredAt,
  originalUrl: article.originalUrl,
  sourceName: article.sourceName,
  sourceSlug: article.sourceSlug,
  tags: [...article.tags],
  title: article.title,
});

export const getNewsArticleLocalMemoryItemForAction = ({
  action,
  article,
  occurredAt,
}: {
  action: ReaderInteractionAction;
  article: NewsArticleItem;
  occurredAt: string;
}) => {
  if (action === "save") {
    return {
      item: getNewsArticleLocalSavedItem({ article, savedAt: occurredAt }),
      storage: "saved" as const,
    };
  }

  if (action === "hide") {
    return {
      item: getNewsArticleLocalGuardrailItem({
        article,
        hiddenAt: occurredAt,
      }),
      storage: "guardrail" as const,
    };
  }

  if (isNewsArticlePositiveFeedbackAction(action)) {
    return {
      item: getNewsArticleLocalPositiveFeedbackItem({
        action,
        article,
        occurredAt,
      }),
      storage: "positive" as const,
    };
  }

  return null;
};

export const getNewsArticleHeroVisual = ({
  article,
  formatCategory,
}: {
  article: Pick<NewsArticleItem, "category" | "imageUrl" | "title">;
  formatCategory: (category: string) => string;
}) => {
  const label = formatCategory(article.category);

  return article.imageUrl
    ? {
        alt: article.title,
        imageUrl: article.imageUrl,
        kind: "image" as const,
        label,
      }
    : {
        kind: "fallback" as const,
        label,
      };
};

export const selectNewsArticleReadMilestone = ({
  readPercent,
  recordedMilestones,
}: {
  readPercent: number;
  recordedMilestones: readonly NewsArticleReadMilestone[];
}) => {
  const milestone = newsArticleReadMilestones.find(
    (candidate) =>
      readPercent >= candidate.minReadPercent &&
      !isNewsArticleReadMilestoneCovered({
        milestone: candidate.key,
        recordedMilestones,
      }),
  );

  if (!milestone) return null;

  return {
    key: milestone.key,
    readPercent,
    shouldShowFeedback: milestone.shouldShowFeedback,
    shouldTrainProfile:
      shouldTrainNewsArticleProfileFromReadPercent(readPercent),
  };
};

export const shouldApplyNewsArticleServerProfileFromInteraction = ({
  action,
  metadata,
}: {
  action: ReaderInteractionAction;
  metadata?: {
    readPercent?: number;
    surface?: string;
  };
}) => {
  if (action !== "view") return true;
  if (metadata?.surface?.trim().toLowerCase() !== "article") return false;
  if (metadata.readPercent === undefined) return false;

  return shouldTrainNewsArticleProfileFromReadPercent(metadata.readPercent);
};

export const getNewsArticleInteractionMetadata = (
  action: ReaderInteractionAction,
) => {
  if (action === "click_source") return { surface: "article_source" };
  if (action === "view") return { surface: "article" };

  return { surface: "article_feedback" };
};

export const shouldApplyNewsArticleLocalProfileFromMilestone = ({
  shouldTrainProfile,
}: {
  readPercent: number;
  shouldShowFeedback: boolean;
  shouldTrainProfile: boolean;
}) => shouldTrainProfile;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const shouldPersistNewsArticleReaderSignals = ({
  articleId,
  visitorKey,
}: {
  articleId: string;
  visitorKey: string | null;
}) => Boolean(visitorKey) && uuidPattern.test(articleId);

export const shouldTrackNewsArticleReaderSignals = ({
  visitorKey,
}: {
  visitorKey: string | null;
}) => Boolean(visitorKey);

const newsArticleReaderSignalCacheScopes = [
  "forYou",
  "profile",
  "saved",
  "history",
  "guardrails",
] as const;

export const getNewsArticleReaderSignalCacheScopes = () =>
  newsArticleReaderSignalCacheScopes;

export const getNewsArticleServerProfileAuditDisplay = (
  audit: NewsServerProfileAudit | undefined,
) => getNewsServerProfileAuditDisplay(audit);

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

const formatArticleCorroborationList = (values: readonly string[]) => {
  if (values.length === 0) return "shared signals";
  if (values.length === 1) return values[0] ?? "shared signals";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
};

const getArticleCorroborationSourceKey = ({
  sourceName,
  sourceSlug,
}: {
  sourceName: string;
  sourceSlug: string;
}) => normalizeValue(sourceSlug) || normalizeValue(sourceName);

const compareArticleCorroborationCandidates = (
  left: {
    item: RankedNewsItem<NewsHomeItem>;
    signalCount: number;
  },
  right: {
    item: RankedNewsItem<NewsHomeItem>;
    signalCount: number;
  },
) => {
  if (right.signalCount !== left.signalCount) {
    return right.signalCount - left.signalCount;
  }

  if (right.item.sourceScore !== left.item.sourceScore) {
    return right.item.sourceScore - left.item.sourceScore;
  }

  if (right.item.personalizedScore !== left.item.personalizedScore) {
    return right.item.personalizedScore - left.item.personalizedScore;
  }

  return right.item.trendScore - left.item.trendScore;
};

export const getNewsArticleCorroboration = ({
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
  const articleSourceKey = getArticleCorroborationSourceKey(article);
  const candidates = relatedItems
    .map((item) => {
      const sourceKey = getArticleCorroborationSourceKey(item);
      const sharedEntities = getSharedValues(article.entities, item.entities);
      const sharedTags = getSharedValues(
        article.tags,
        item.tags,
        normalizeTagValue,
        formatTagValue,
      );
      const sameCluster = hasSameArticleClusterKey(article, item);
      const evidence = getUniqueValues(
        [sameCluster ? "same event" : "", ...sharedEntities, ...sharedTags],
        4,
      );

      return {
        evidence,
        item,
        signalCount: evidence.length,
        sourceKey,
      };
    })
    .filter(
      (candidate) =>
        candidate.signalCount > 0 &&
        candidate.sourceKey &&
        candidate.sourceKey !== articleSourceKey,
    )
    .sort(compareArticleCorroborationCandidates);
  const bestCandidateBySource = new Map<string, (typeof candidates)[number]>();

  for (const candidate of candidates) {
    if (bestCandidateBySource.has(candidate.sourceKey)) continue;

    bestCandidateBySource.set(candidate.sourceKey, candidate);
  }

  const selectedCandidates = Array.from(bestCandidateBySource.values()).slice(
    0,
    Math.max(0, limit),
  );
  const independentSourceCount = selectedCandidates.length;
  const sourceCount = independentSourceCount + 1;
  const signalCount = selectedCandidates.reduce(
    (total, candidate) => total + candidate.signalCount,
    0,
  );
  const averageTrust =
    sourceCount > 0
      ? Math.round(
          (article.sourceScore +
            selectedCandidates.reduce(
              (total, candidate) => total + candidate.item.sourceScore,
              0,
            )) /
            sourceCount,
        )
      : 0;
  const evidenceSignals = getUniqueValues(
    selectedCandidates.flatMap((candidate) => candidate.evidence),
    4,
  );

  return {
    label:
      independentSourceCount > 1
        ? "Corroborated"
        : independentSourceCount === 1
          ? "Developing"
          : "Single Source",
    metrics: [
      { label: "Sources", value: String(sourceCount) },
      { label: "Matches", value: String(selectedCandidates.length) },
      { label: "Signals", value: String(signalCount) },
      { label: "Avg trust", value: String(averageTrust) },
    ],
    sources: selectedCandidates.map((candidate) => ({
      categoryLabel: formatCategory(candidate.item.category),
      evidenceLabel: candidate.evidence.join(", "),
      id: candidate.item.id,
      scoreLabel: `${candidate.signalCount} ${
        candidate.signalCount === 1 ? "signal" : "signals"
      } / ${candidate.item.sourceScore} trust`,
      sourceName: candidate.item.sourceName,
      title: candidate.item.title,
    })),
    summary:
      selectedCandidates.length > 0
        ? `${selectedCandidates.length} independent ${
            selectedCandidates.length === 1 ? "story" : "stories"
          } from ${independentSourceCount} ${
            independentSourceCount === 1 ? "source" : "sources"
          } ${
            selectedCandidates.length === 1 ? "corroborates" : "corroborate"
          } this article around ${formatArticleCorroborationList(
            evidenceSignals,
          )}.`
        : "No independent related source corroborates this article yet.",
  };
};

const getRecommendationReason = ({
  sameCluster,
  sameCategory,
  sameSource,
  sharedEntities,
  sharedTags,
}: {
  sameCluster?: boolean;
  sameCategory: boolean;
  sameSource: boolean;
  sharedEntities: readonly string[];
  sharedTags: readonly string[];
}) => {
  if (sameCluster) return "Same event";

  const [entity] = sharedEntities;
  if (entity) return `${entity} thread`;

  const specificTag = sharedTags.find(isSpecificTagValue);
  if (specificTag) return `${specificTag} thread`;

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
      const sharedTags = getSharedValues(
        article.tags,
        item.tags,
        normalizeTagValue,
        formatTagValue,
      );
      const sameCategory = hasSameNormalizedValue(
        item.category,
        article.category,
      );
      const sameSource = hasSameNormalizedValue(
        item.sourceSlug,
        article.sourceSlug,
      );
      const sameCluster = hasSameArticleClusterKey(article, item);
      const signalCount =
        sharedEntities.length +
        sharedTags.length +
        (sameCluster ? 1 : 0) +
        (sameCategory ? 1 : 0) +
        (sameSource ? 1 : 0);

      return {
        id: item.id,
        personalizedScore: item.personalizedScore,
        publishedAt: item.publishedAt,
        reason: getRecommendationReason({
          sameCluster,
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

type ArticleNextReadStatus = "Continue" | "Explore" | "Verify";

const articleNextReadStatusPriority = {
  Continue: 0,
  Explore: 1,
  Verify: 2,
} as const satisfies Record<ArticleNextReadStatus, number>;

const getArticleNextReadStatus = ({
  article,
  item,
  profile,
  sameCluster,
  signalCount,
}: {
  article: NewsArticleItem;
  item: RankedNewsItem<NewsHomeItem>;
  profile: NewsPreferenceProfile;
  sameCluster?: boolean;
  signalCount: number;
}): ArticleNextReadStatus => {
  const needsVerification =
    hasArticleSourceTrustGuardrail(item) ||
    item.sourceScore < 65 ||
    (item.trendScore >= 90 && signalCount === 0);

  if (needsVerification) return "Verify";

  if (
    sameCluster ||
    signalCount >= 2 ||
    hasSameNormalizedValue(item.category, article.category) ||
    hasSameNormalizedValue(item.sourceSlug, article.sourceSlug)
  ) {
    return "Continue";
  }

  if (
    item.matchedSignals.includes("exploration") ||
    profile.noveltyBias >= profile.recencyBias ||
    !hasSameNormalizedValue(item.category, article.category)
  ) {
    return "Explore";
  }

  return "Continue";
};

const getArticleNextReadReason = ({
  item,
  sameCluster,
  sameCategory,
  sameSource,
  sharedEntities,
  sharedTags,
  status,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  sameCluster?: boolean;
  sameCategory: boolean;
  sameSource: boolean;
  sharedEntities: readonly string[];
  sharedTags: readonly string[];
  status: ArticleNextReadStatus;
}) => {
  if (status === "Verify" && hasArticleSourceTrustGuardrail(item)) {
    return "Source needs review";
  }
  if (status === "Verify") return "High heat needs source check";
  if (status === "Explore" && item.matchedSignals.includes("exploration")) {
    return "Exploration match";
  }
  if (status === "Explore") return "Broaden reader graph";

  return getRecommendationReason({
    sameCluster,
    sameCategory,
    sameSource,
    sharedEntities,
    sharedTags,
  });
};

const formatNextReadSummary = ({
  continueCount,
  exploreCount,
  readsCount,
  verifyCount,
}: {
  continueCount: number;
  exploreCount: number;
  readsCount: number;
  verifyCount: number;
}) => {
  if (readsCount === 0) {
    return "Next reads will appear as related stories load.";
  }

  return `${readsCount} next reads: ${continueCount} continue, ${exploreCount} explore, and ${verifyCount} verify.`;
};

const selectNewsArticleNextReadCandidates = <
  TRead extends {
    id: string;
    sharesArticleEntity: boolean;
    statusLabel: ArticleNextReadStatus;
  },
>({
  limit,
  reads,
}: {
  limit: number;
  reads: readonly TRead[];
}) => {
  const selectedReads = reads.slice(0, limit);
  const sameEntityContinueCount = selectedReads.filter(
    (item) => item.statusLabel === "Continue" && item.sharesArticleEntity,
  ).length;

  if (
    selectedReads.length < 2 ||
    sameEntityContinueCount < 2 ||
    selectedReads.some((item) => item.statusLabel === "Explore")
  ) {
    return selectedReads;
  }

  const exploreRead = reads.find((item) => item.statusLabel === "Explore");

  if (!exploreRead) return selectedReads;

  let replaceIndex = -1;

  for (let index = selectedReads.length - 1; index >= 0; index -= 1) {
    const item = selectedReads[index];

    if (item?.statusLabel === "Continue" && item.sharesArticleEntity) {
      replaceIndex = index;
      break;
    }
  }

  if (replaceIndex < 0) return selectedReads;

  return selectedReads.map((item, index) =>
    index === replaceIndex ? exploreRead : item,
  );
};

export const getNewsArticleNextReads = ({
  article,
  formatCategory,
  limit,
  profile,
  relatedItems,
}: {
  article: NewsArticleItem;
  formatCategory: (category: string) => string;
  limit: number;
  profile: NewsPreferenceProfile;
  relatedItems: readonly RankedNewsItem<NewsHomeItem>[];
}) => {
  const sortedReads = relatedItems
    .map((item) => {
      const sharedEntities = getSharedValues(article.entities, item.entities);
      const sharedTags = getSharedValues(
        article.tags,
        item.tags,
        normalizeTagValue,
        formatTagValue,
      );
      const sameCategory = hasSameNormalizedValue(
        item.category,
        article.category,
      );
      const sameSource = hasSameNormalizedValue(
        item.sourceSlug,
        article.sourceSlug,
      );
      const sameCluster = hasSameArticleClusterKey(article, item);
      const overlapSignalCount =
        sharedEntities.length +
        sharedTags.length +
        (sameCluster ? 1 : 0) +
        (sameCategory ? 1 : 0) +
        (sameSource ? 1 : 0);
      const signalCount = Math.max(
        overlapSignalCount,
        getArticleReaderRecommendationSignalCount(item),
        item.matchedSignals.includes("exploration") ? 1 : 0,
      );
      const status = getArticleNextReadStatus({
        article,
        item,
        profile,
        sameCluster,
        signalCount,
      });

      return {
        categoryLabel: formatCategory(item.category),
        id: item.id,
        personalizedScore: item.personalizedScore,
        publishedAt: item.publishedAt,
        reason: getArticleNextReadReason({
          item,
          sameCluster,
          sameCategory,
          sameSource,
          sharedEntities,
          sharedTags,
          status,
        }),
        scoreLabel: `${formatSignalCount(signalCount)} / ${
          item.personalizedScore
        } score`,
        sharesArticleEntity: sharedEntities.length > 0,
        sourceName: item.sourceName,
        statusLabel: status,
        title: item.title,
      };
    })
    .sort((left, right) => {
      const statusDelta =
        articleNextReadStatusPriority[left.statusLabel] -
        articleNextReadStatusPriority[right.statusLabel];
      if (statusDelta !== 0) return statusDelta;

      if (right.personalizedScore !== left.personalizedScore) {
        return right.personalizedScore - left.personalizedScore;
      }

      return (
        new Date(right.publishedAt).getTime() -
        new Date(left.publishedAt).getTime()
      );
    });
  const reads = selectNewsArticleNextReadCandidates({
    limit,
    reads: sortedReads,
  }).map((item) => ({
    categoryLabel: item.categoryLabel,
    id: item.id,
    reason: item.reason,
    scoreLabel: item.scoreLabel,
    sourceName: item.sourceName,
    statusLabel: item.statusLabel,
    title: item.title,
  }));
  const continueCount = reads.filter(
    (item) => item.statusLabel === "Continue",
  ).length;
  const exploreCount = reads.filter(
    (item) => item.statusLabel === "Explore",
  ).length;
  const verifyCount = reads.filter(
    (item) => item.statusLabel === "Verify",
  ).length;

  return {
    label: reads.length > 0 ? "Next Reads Ready" : "Next Reads Waiting",
    metrics: [
      { label: "Candidates", value: String(reads.length) },
      { label: "Continue", value: String(continueCount) },
      { label: "Explore", value: String(exploreCount) },
      { label: "Verify", value: String(verifyCount) },
    ],
    reads,
    summary: formatNextReadSummary({
      continueCount,
      exploreCount,
      readsCount: reads.length,
      verifyCount,
    }),
  };
};

const getReaderBiasLabel = (profile: NewsPreferenceProfile) => {
  if (Math.abs(profile.noveltyBias - profile.recencyBias) < 0.05) {
    return "Balanced";
  }

  return profile.noveltyBias > profile.recencyBias ? "Novel" : "Fresh";
};

const getNextStepLabel = (reason: string) => {
  if (reason === "Same event") return "Continue Event";
  if (reason.includes("thread")) return "Continue Thread";
  if (reason === "Same topic") return "Broaden Topic";
  if (reason === "Same source") return "Source Follow-Up";

  return "Next Read";
};

export const getNewsArticleReaderFit = ({
  article,
  formatCategory,
  profile,
  relatedItems,
}: {
  article: NewsArticleItem;
  formatCategory: (category: string) => string;
  profile: NewsPreferenceProfile;
  relatedItems: readonly RankedNewsItem<NewsHomeItem>[];
}) => {
  const preferredCategories = getNormalizedSet(profile.preferredCategories);
  const preferredSources = getNormalizedSet(profile.preferredSources);
  const matchedEntities = getSharedValues(
    article.entities,
    profile.preferredEntities,
  );
  const categoryMatch = preferredCategories.has(
    normalizeValue(article.category),
  );
  const sourceMatch = preferredSources.has(normalizeValue(article.sourceSlug));
  const reasons: { detail: string; label: string }[] = [];

  if (categoryMatch) {
    reasons.push({
      detail: `${formatCategory(article.category)} is in your reader profile.`,
      label: "Topic",
    });
  }

  if (sourceMatch) {
    reasons.push({
      detail: `${article.sourceName} is a preferred source.`,
      label: "Source",
    });
  }

  const [matchedEntity] = matchedEntities;
  if (matchedEntity) {
    reasons.push({
      detail: `${matchedEntity} matches your entity memory.`,
      label: "Entity",
    });
  }

  const matchCount =
    (categoryMatch ? 1 : 0) + (sourceMatch ? 1 : 0) + matchedEntities.length;
  const readingPath = getNewsArticleReadingPath({
    article,
    formatCategory,
    limit: 3,
    relatedItems,
  });
  const [nextRecommendation] = readingPath.recommendations;
  const followUpCount = readingPath.recommendations.length;
  const hasSameEventFollowUp = nextRecommendation?.reason === "Same event";

  return {
    label:
      matchCount >= 3
        ? "Strong Fit"
        : matchCount > 0
          ? "Reader Fit"
          : "Discovery Read",
    metrics: [
      { label: "Profile matches", value: String(matchCount) },
      { label: "Follow-ups", value: String(followUpCount) },
      { label: "Reader bias", value: getReaderBiasLabel(profile) },
    ],
    nextStep: nextRecommendation
      ? {
          id: nextRecommendation.id,
          label: getNextStepLabel(nextRecommendation.reason),
          reason: nextRecommendation.reason,
          scoreLabel: nextRecommendation.scoreLabel,
          title: nextRecommendation.title,
        }
      : null,
    reasons:
      reasons.length > 0
        ? reasons
        : [
            {
              detail: "This article is training a new reader profile.",
              label: "Discovery",
            },
          ],
    summary:
      matchCount > 0
        ? `${matchCount} reader ${
            matchCount === 1 ? "signal matches" : "signals match"
          } this article; ${followUpCount} ${
            followUpCount === 1 ? "follow-up keeps" : "follow-ups keep"
          } the thread moving.`
        : followUpCount > 0
          ? `No saved reader signals match this article yet; ${followUpCount} ${
              hasSameEventFollowUp ? "same-event " : ""
            }${followUpCount === 1 ? "follow-up keeps" : "follow-ups keep"} the ${
              hasSameEventFollowUp ? "story" : "thread"
            } moving.`
          : "No saved reader signals match this article yet.",
  };
};

const articleFeedbackActionLabels = {
  click_source: "Source",
  hide: "Less",
  save: "Save",
  share: "Share",
  view: "Deep read",
} as const satisfies Record<ReaderInteractionAction, string>;

const getNormalizedSignalSet = (values: readonly string[]) =>
  new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));

const countArticleFeedbackDelta = ({
  after,
  before,
}: {
  after: readonly string[];
  before: readonly string[];
}) => {
  const beforeSignals = getNormalizedSignalSet(before);
  const afterSignals = getNormalizedSignalSet(after);

  return {
    added: Array.from(afterSignals).filter(
      (signal) => !beforeSignals.has(signal),
    ).length,
    removed: Array.from(beforeSignals).filter(
      (signal) => !afterSignals.has(signal),
    ).length,
  };
};

const getArticleFeedbackSignalValues = ({
  after,
  before,
  negative,
}: {
  after: readonly string[];
  before: readonly string[];
  negative: boolean;
}) => {
  const beforeSignals = new Map(
    before.map((signal) => [signal.trim().toLowerCase(), signal.trim()]),
  );
  const afterSignals = new Map(
    after.map((signal) => [signal.trim().toLowerCase(), signal.trim()]),
  );
  const source = negative ? beforeSignals : afterSignals;
  const comparison = negative ? afterSignals : beforeSignals;

  return Array.from(source.entries())
    .filter(([key, value]) => value && !comparison.has(key))
    .map(([, value]) => value);
};

const formatArticleFeedbackBiasShift = ({
  afterProfile,
  beforeProfile,
}: {
  afterProfile: NewsPreferenceProfile;
  beforeProfile: NewsPreferenceProfile;
}) => {
  const delta =
    afterProfile.noveltyBias +
    afterProfile.recencyBias -
    beforeProfile.noveltyBias -
    beforeProfile.recencyBias;
  const roundedDelta = Math.round(delta * 10) / 10;

  return roundedDelta > 0 ? `+${roundedDelta}` : String(roundedDelta);
};

export const getNewsArticleFeedbackLoop = ({
  action,
  afterProfile,
  article,
  beforeProfile,
  formatCategory,
}: {
  action: ReaderInteractionAction | null;
  afterProfile: NewsPreferenceProfile;
  article: NewsArticleItem;
  beforeProfile: NewsPreferenceProfile;
  formatCategory: (category: string) => string;
}) => {
  const topicLabel = formatCategory(article.category);

  if (!action) {
    return {
      label: "Waiting",
      metrics: [
        { label: "Action", value: "None" },
        { label: "Signal delta", value: "0" },
        { label: "Bias shift", value: "0" },
        { label: "Topic", value: topicLabel },
      ],
      notices: [
        {
          detail:
            "Deep read, save, share, or press Less to show article-level training feedback.",
          label: "Awaiting feedback",
        },
      ],
      summary: "Article feedback loop will appear after an explicit action.",
    };
  }

  const negative = action === "hide";
  const categoryDelta = countArticleFeedbackDelta({
    after: afterProfile.preferredCategories,
    before: beforeProfile.preferredCategories,
  });
  const sourceDelta = countArticleFeedbackDelta({
    after: afterProfile.preferredSources,
    before: beforeProfile.preferredSources,
  });
  const entityDelta = countArticleFeedbackDelta({
    after: afterProfile.preferredEntities,
    before: beforeProfile.preferredEntities,
  });
  const signalDelta = negative
    ? categoryDelta.removed + sourceDelta.removed + entityDelta.removed
    : categoryDelta.added + sourceDelta.added + entityDelta.added;
  const entitySignals = getArticleFeedbackSignalValues({
    after: afterProfile.preferredEntities,
    before: beforeProfile.preferredEntities,
    negative,
  });
  const notices: { detail: string; label: string }[] = [
    {
      detail: negative
        ? `${topicLabel} will be guarded after this article signal.`
        : `${topicLabel} will rank higher after this article signal.`,
      label: negative ? "Topic guarded" : "Topic learned",
    },
    {
      detail: negative
        ? `${article.sourceName} lost source weight from this article.`
        : `${article.sourceName} gained source weight from this article.`,
      label: negative ? "Source guarded" : "Source learned",
    },
  ];

  if (entitySignals.length > 0) {
    notices.push({
      detail: negative
        ? `${entitySignals.join(", ")} were removed from related coverage memory.`
        : `${entitySignals.join(", ")} were added to related coverage memory.`,
      label: negative ? "Signals guarded" : "Signals learned",
    });
  }

  return {
    label: negative ? "Negative Signal" : "Positive Signal",
    metrics: [
      { label: "Action", value: articleFeedbackActionLabels[action] },
      {
        label: "Signal delta",
        value: `${negative ? "-" : "+"}${signalDelta}`,
      },
      {
        label: "Bias shift",
        value: formatArticleFeedbackBiasShift({ afterProfile, beforeProfile }),
      },
      { label: "Topic", value: topicLabel },
    ],
    notices,
    summary: `${articleFeedbackActionLabels[action]} trained the article queue ${
      negative ? "away from" : "toward"
    } ${topicLabel} from ${article.sourceName}.`,
  };
};

export const getNewsArticleDeepReadTrainingState = ({
  article,
  beforeProfile,
  formatCategory,
  readPercent,
}: {
  article: NewsArticleItem;
  beforeProfile: NewsPreferenceProfile;
  formatCategory: (category: string) => string;
  readPercent: number;
}) => {
  if (!shouldTrainNewsArticleProfileFromReadPercent(readPercent)) return null;

  const profile = updateReaderProfileWithInteraction(beforeProfile, article, {
    action: "view",
    readPercent,
  });

  return {
    feedbackLoop: getNewsArticleFeedbackLoop({
      action: "view",
      afterProfile: profile,
      article,
      beforeProfile,
      formatCategory,
    }),
    profile,
  };
};

type ArticleLearningAction = Extract<
  ReaderInteractionAction,
  "click_source" | "hide" | "save" | "share" | "view"
>;

interface ArticleLearningSignal {
  key: string;
  kind: "category" | "entity" | "source" | "tag";
  label: string;
}

const articleLearningActions = [
  "view",
  "save",
  "share",
  "click_source",
  "hide",
] as const satisfies readonly ArticleLearningAction[];

const articleLearningActionLabels = {
  click_source: "Source",
  hide: "Less",
  save: "Save",
  share: "Share",
  view: "Read",
} as const satisfies Record<ArticleLearningAction, string>;

const getArticleLearningSignals = ({
  article,
  formatCategory,
}: {
  article: NewsArticleItem;
  formatCategory: (category: string) => string;
}): ArticleLearningSignal[] => [
  {
    key: `category:${normalizeValue(article.category)}`,
    kind: "category" as const,
    label: formatCategory(article.category),
  },
  {
    key: `source:${normalizeValue(article.sourceSlug)}`,
    kind: "source" as const,
    label: article.sourceName,
  },
  ...getUniqueValues(article.entities, 6).map((entity) => ({
    key: `entity:${normalizeValue(entity)}`,
    kind: "entity" as const,
    label: entity,
  })),
  ...getUniqueValues(article.tags, 6).map((tag) => ({
    key: `entity:${normalizeValue(tag)}`,
    kind: "tag" as const,
    label: tag,
  })),
];

const getProfileLearningSignalKeys = (profile: NewsPreferenceProfile) =>
  new Set([
    ...profile.preferredCategories.map(
      (category) => `category:${normalizeValue(category)}`,
    ),
    ...profile.preferredSources.map(
      (source) => `source:${normalizeValue(source)}`,
    ),
    ...profile.preferredEntities.map(
      (entity) => `entity:${normalizeValue(entity)}`,
    ),
  ]);

const getArticleLearningSignalDelta = ({
  afterProfile,
  articleSignals,
  beforeProfile,
}: {
  afterProfile: NewsPreferenceProfile;
  articleSignals: readonly ArticleLearningSignal[];
  beforeProfile: NewsPreferenceProfile;
}) => {
  const beforeKeys = getProfileLearningSignalKeys(beforeProfile);
  const afterKeys = getProfileLearningSignalKeys(afterProfile);

  return {
    added: articleSignals.filter(
      (signal) => !beforeKeys.has(signal.key) && afterKeys.has(signal.key),
    ),
    removed: articleSignals.filter(
      (signal) => beforeKeys.has(signal.key) && !afterKeys.has(signal.key),
    ),
  };
};

const getActiveArticleLearningSignals = ({
  articleSignals,
  profile,
}: {
  articleSignals: readonly ArticleLearningSignal[];
  profile: NewsPreferenceProfile;
}) => {
  const profileKeys = getProfileLearningSignalKeys(profile);

  return articleSignals.filter((signal) => profileKeys.has(signal.key));
};

const formatLearningSignalList = (signals: readonly ArticleLearningSignal[]) =>
  signals.map((signal) => signal.label).join(", ");

const formatLearningSignalLabel = ({
  count,
  signed,
}: {
  count: number;
  signed: "negative" | "none" | "positive";
}) => {
  const prefix =
    count === 0
      ? ""
      : signed === "positive"
        ? "+"
        : signed === "negative"
          ? "-"
          : "";

  return `${prefix}${count} ${count === 1 ? "signal" : "signals"}`;
};

const formatLearningMetricDelta = ({
  count,
  signed,
}: {
  count: number;
  signed: "negative" | "positive";
}) => {
  if (count === 0) return "0";

  return `${signed === "positive" ? "+" : "-"}${count}`;
};

const getLearningBiasLabel = ({
  afterProfile,
  beforeProfile,
}: {
  afterProfile: NewsPreferenceProfile;
  beforeProfile: NewsPreferenceProfile;
}) => `${formatArticleFeedbackBiasShift({ afterProfile, beforeProfile })} bias`;

const getLearningActionDetail = ({
  action,
  activeSignals,
  addedSignals,
  article,
  removedSignals,
  topicLabel,
}: {
  action: ArticleLearningAction;
  activeSignals: readonly ArticleLearningSignal[];
  addedSignals: readonly ArticleLearningSignal[];
  article: NewsArticleItem;
  removedSignals: readonly ArticleLearningSignal[];
  topicLabel: string;
}) => {
  if (action === "view") {
    if (activeSignals.length > 0) {
      return `Read memory is active for ${formatLearningSignalList(activeSignals)}.`;
    }

    const waitsForEntityMemory =
      article.entities.length > 0 &&
      !addedSignals.some((signal) => signal.kind === "entity");
    const waitsForAngleMemory =
      article.tags.length > 0 &&
      !addedSignals.some((signal) => signal.kind === "tag");

    if (waitsForEntityMemory && waitsForAngleMemory) {
      return `Read would start a new ${topicLabel} memory; entity and angle memory wait for a deeper read.`;
    }

    if (waitsForEntityMemory) {
      return `Read would start a new ${topicLabel} memory; entity memory waits for a deeper read.`;
    }

    if (waitsForAngleMemory) {
      return `Read would start a new ${topicLabel} memory; angle memory waits for a deeper read.`;
    }

    return `Read would start a new ${topicLabel} memory.`;
  }

  if (action === "hide") {
    if (removedSignals.length > 0) {
      return `Less would remove ${formatLearningSignalList(
        removedSignals,
      )} from this reader profile.`;
    }

    return "Less would only dampen ranking bias until a signal exists.";
  }

  if (action === "save") {
    const [addedSignal] = addedSignals;

    if (addedSignals.length === 1 && addedSignal?.kind === "source") {
      return `Save would add ${article.sourceName} as a source preference.`;
    }

    if (addedSignals.length > 0) {
      return `Save would add ${formatLearningSignalList(
        addedSignals,
      )} to the reader profile.`;
    }

    return `Save would reinforce ${topicLabel} without adding new signals.`;
  }

  if (action === "click_source") {
    if (addedSignals.length > 0) {
      return `Source would add ${formatLearningSignalList(
        addedSignals,
      )} to the reader profile.`;
    }

    return `Source would reinforce ${article.sourceName} as a source preference.`;
  }

  if (addedSignals.length > 0) {
    return `Share would add ${formatLearningSignalList(
      addedSignals,
    )} and push freshness and novelty harder.`;
  }

  return `Share would push freshness and novelty harder around ${topicLabel}.`;
};

export const getNewsArticleLearningImpact = ({
  article,
  formatCategory,
  profile,
  relatedItems,
}: {
  article: NewsArticleItem;
  formatCategory: (category: string) => string;
  profile: NewsPreferenceProfile;
  relatedItems: readonly RankedNewsItem<NewsHomeItem>[];
}) => {
  const topicLabel = formatCategory(article.category);
  const articleSignals = getArticleLearningSignals({ article, formatCategory });
  const activeSignals = getActiveArticleLearningSignals({
    articleSignals,
    profile,
  });
  const actionDeltas = new Map(
    articleLearningActions.map((action) => {
      const nextProfile = updateReaderProfileWithInteraction(profile, article, {
        action,
      });

      return [
        action,
        {
          delta: getArticleLearningSignalDelta({
            afterProfile: nextProfile,
            articleSignals,
            beforeProfile: profile,
          }),
          nextProfile,
        },
      ];
    }),
  );
  const readingPath = getNewsArticleReadingPath({
    article,
    formatCategory,
    limit: 3,
    relatedItems,
  });
  const nextStories = readingPath.recommendations.map((item) => ({
    id: item.id,
    reason: item.reason,
    scoreLabel: item.scoreLabel,
    title: item.title,
  }));
  const saveDelta = actionDeltas.get("save")?.delta.added.length ?? 0;
  const sourceClickDelta =
    actionDeltas.get("click_source")?.delta.added.length ?? 0;
  const hideDelta = actionDeltas.get("hide")?.delta.removed.length ?? 0;

  return {
    actions: articleLearningActions.map((action) => {
      const actionDelta = actionDeltas.get(action);
      const addedSignals = actionDelta?.delta.added ?? [];
      const removedSignals = actionDelta?.delta.removed ?? [];
      const signalCount =
        action === "hide"
          ? removedSignals.length
          : action === "view" && activeSignals.length > 0
            ? activeSignals.length
            : addedSignals.length;
      const signed =
        action === "hide"
          ? "negative"
          : action === "view" && activeSignals.length > 0
            ? "none"
            : "positive";

      return {
        action,
        biasLabel: getLearningBiasLabel({
          afterProfile: actionDelta?.nextProfile ?? profile,
          beforeProfile: profile,
        }),
        detail: getLearningActionDetail({
          action,
          activeSignals,
          addedSignals,
          article,
          removedSignals,
          topicLabel,
        }),
        label: articleLearningActionLabels[action],
        signalLabel: formatLearningSignalLabel({ count: signalCount, signed }),
      };
    }),
    label: activeSignals.length > 0 ? "Learning Active" : "Learning Ready",
    metrics: [
      { label: "Article memory", value: String(activeSignals.length) },
      {
        label: "Save adds",
        value: formatLearningMetricDelta({
          count: saveDelta,
          signed: "positive",
        }),
      },
      {
        label: "Source adds",
        value: formatLearningMetricDelta({
          count: sourceClickDelta,
          signed: "positive",
        }),
      },
      {
        label: "Less removes",
        value: formatLearningMetricDelta({
          count: hideDelta,
          signed: "negative",
        }),
      },
      { label: "Next candidates", value: String(nextStories.length) },
    ],
    nextStories,
    summary:
      activeSignals.length > 0
        ? `This article has ${activeSignals.length} active reader-memory ${
            activeSignals.length === 1 ? "signal" : "signals"
          } and ${nextStories.length} follow-up ${
            nextStories.length === 1 ? "recommendation" : "recommendations"
          }.`
        : nextStories.length > 0
          ? `This article can start reader-memory signals and stage ${nextStories.length} follow-up ${
              nextStories.length === 1 ? "recommendation" : "recommendations"
            }.`
          : "This article can start reader-memory signals; follow-up recommendations will appear after related stories load.",
  };
};
