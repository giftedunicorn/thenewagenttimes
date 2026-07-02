import type {
  NewsPreferenceProfile,
  NewsRecommendationExplanation,
  NewsRecommendationRotationObjective,
  NewsRecommendationRotationScoreKind,
  NewsUrlReference,
  PositiveFeedbackNewsItem,
  RankedNewsItem,
  ReaderInteraction,
  ReaderInteractionAction,
  RecommendableNewsItem,
} from "@acme/validators";
import {
  dedupeNewsItems,
  filterBlockedNewsItems,
  filterHiddenNewsItems,
  getNewsRecommendationReasons as getSharedNewsRecommendationReasons,
  normalizeNewsPreferenceProfile,
  selectFatigueBalancedNewsFeed,
  selectNegativeFeedbackAdjustedNewsFeed,
  selectNewsRecommendationRotationSlots,
  selectReaderFreshNewsFeed,
  selectSourceCorroboratedNewsFeed,
  summarizeNewsRecommendation,
} from "@acme/validators";

export interface NewsHomeItem extends RecommendableNewsItem {
  summary: string;
  canonicalUrl: string | null;
  imageUrl: string | null;
  originalUrl?: string | null;
  recommendation?: NewsRecommendationExplanation;
  sourceName: string;
  sourceType: string;
}

export interface PreviewNewsArticleItem extends NewsHomeItem {
  bodyText: string;
  originalUrl: string;
  authorName: string | null;
  collectedAt: string;
}

export type NewsHomeStatus = "ready" | "empty" | "unavailable";
export type NewsFeedMode = "for_you" | "latest" | "trending";

export interface NewsServerProfileAuditSignal {
  count: number;
  key: string;
}

export interface NewsServerProfileAudit {
  averageHomeRankSlot: number | null;
  ignoredSignalCount: number;
  negativeSignalCount: number;
  positiveSignalCount: number;
  summary: string;
  topCategories: readonly NewsServerProfileAuditSignal[];
  topEntities: readonly NewsServerProfileAuditSignal[];
  topFeedModes: readonly NewsServerProfileAuditSignal[];
  topMatchedSignals: readonly NewsServerProfileAuditSignal[];
  topSources: readonly NewsServerProfileAuditSignal[];
  topTags?: readonly NewsServerProfileAuditSignal[];
  trainedSignalCount: number;
}

export type PersistedNewsPreferenceProfile = NewsPreferenceProfile & {
  audit?: NewsServerProfileAudit;
  persisted: boolean;
};

const defaultNewsPreferenceProfile = {
  preferredCategories: ["model_release", "agent_product", "funding"],
  preferredSources: [],
  preferredEntities: [],
  noveltyBias: 1,
  recencyBias: 1,
} satisfies NewsPreferenceProfile;

export const createDefaultNewsPreferenceProfile =
  (): NewsPreferenceProfile => ({
    preferredCategories: [...defaultNewsPreferenceProfile.preferredCategories],
    preferredSources: [...defaultNewsPreferenceProfile.preferredSources],
    preferredEntities: [...defaultNewsPreferenceProfile.preferredEntities],
    noveltyBias: defaultNewsPreferenceProfile.noveltyBias,
    recencyBias: defaultNewsPreferenceProfile.recencyBias,
  });

const previewNewsArticles: readonly PreviewNewsArticleItem[] = [
  {
    id: "preview-desk",
    title: "The live AI desk is ready for its first crawl",
    summary:
      "The ingestion layer, source registry, ranking API, and Railway web service are connected. The first collected stories will take over this slot automatically.",
    bodyText: [
      "The New AI Times preview edition is wired for live AI coverage. It spans agents, model releases, funding, research, and platform shifts.",
      "The ingestion layer, source registry, ranking API, and Railway web service are connected so live stories can replace this desk note after the database schema and first crawl are available.",
      "Until live collection is seeded, this article keeps the reading experience intact and lets the recommendation controls, feedback loop, and reading path operate like a real edition.",
    ].join("\n\n"),
    originalUrl: "https://thenewagenttimes.com/news/preview-desk",
    authorName: "The New AI Times Desk",
    collectedAt: "2026-07-01T08:02:00.000Z",
    category: "agent_product",
    tags: ["desk", "pipeline", "recommendations"],
    entities: ["The New AI Times"],
    sourceSlug: "new-ai-times-editors-desk",
    sourceName: "Editor's Desk",
    sourceType: "manual",
    sourceScore: 90,
    trendScore: 64,
    publishedAt: "2026-07-01T08:00:00.000Z",
    canonicalUrl: null,
    imageUrl: "https://picsum.photos/seed/new-ai-times-live-desk/1200/820",
  },
  {
    id: "preview-sources",
    title: "Source registry covers labs, model blogs, YC AI, OSS, and launches",
    summary:
      "OpenAI, Anthropic, Google AI, DeepMind, Meta AI, Microsoft AI, NVIDIA, Hugging Face, LangChain, Product Hunt, Hacker News, and YC are modeled as source classes.",
    bodyText: [
      "The source registry is shaped around the places where AI news usually breaks first: frontier lab blogs, model release notes, developer platforms, open source repositories, startup launch surfaces, investor updates, and technical communities.",
      "Each source carries a source type and credibility score so the front page can separate high-trust primary material from faster but noisier social signals.",
      "That source model powers the Source Balance, Source Trust, Coverage Threads, and Feed Governor panels in the preview edition.",
    ].join("\n\n"),
    originalUrl: "https://thenewagenttimes.com/news/preview-sources",
    authorName: "Source Desk",
    collectedAt: "2026-07-01T07:32:00.000Z",
    category: "market_map",
    tags: ["sources", "labs", "launches"],
    entities: ["OpenAI", "Anthropic", "YC"],
    sourceSlug: "new-ai-times-source-desk",
    sourceName: "Source Desk",
    sourceType: "manual",
    sourceScore: 86,
    trendScore: 58,
    publishedAt: "2026-07-01T07:30:00.000Z",
    canonicalUrl: null,
    imageUrl:
      "https://picsum.photos/seed/new-ai-times-source-registry/1200/820",
  },
  {
    id: "preview-recommendations",
    title: "Reader intent now changes the order of the front page",
    summary:
      "Topic, source, and entity preferences rerank stories while trend and freshness keep the edition from becoming a filter bubble.",
    bodyText: [
      "The recommendation layer blends reader-selected topics, saved sources, entity memory, recency, novelty, trend heat, and source credibility into a single ranked edition.",
      "Save, share, source clicks, reads, and Less feedback all move the local profile so the next page view can show a different mix.",
      "The system also adds exploration slots, source fatigue throttling, negative-feedback guardrails, and interest drift summaries to keep the feed from narrowing too quickly.",
    ].join("\n\n"),
    originalUrl: "https://thenewagenttimes.com/news/preview-recommendations",
    authorName: "Recommendation Desk",
    collectedAt: "2026-07-01T07:02:00.000Z",
    category: "new_concept",
    tags: ["personalization", "ranking", "signals"],
    entities: ["Recommendation Engine"],
    sourceSlug: "new-ai-times-recommendation-desk",
    sourceName: "Recommendation Desk",
    sourceType: "manual",
    sourceScore: 82,
    trendScore: 61,
    publishedAt: "2026-07-01T07:00:00.000Z",
    canonicalUrl: null,
    imageUrl:
      "https://picsum.photos/seed/new-ai-times-recommendation-engine/1200/820",
  },
] as const;

const toPreviewNewsHomeItem = ({
  authorName: _authorName,
  bodyText: _bodyText,
  collectedAt: _collectedAt,
  originalUrl: _originalUrl,
  ...item
}: PreviewNewsArticleItem): NewsHomeItem => ({ ...item });

export const getPreviewNewsHomeItems = (): NewsHomeItem[] =>
  previewNewsArticles.map(toPreviewNewsHomeItem);

export const getPreviewNewsArticleData = (
  id: string,
): {
  article: PreviewNewsArticleItem | null;
  related: NewsHomeItem[];
} => {
  const article =
    previewNewsArticles.find((item) => item.id === id.trim()) ?? null;

  if (!article) {
    return {
      article: null,
      related: [],
    };
  }

  return {
    article: { ...article },
    related: previewNewsArticles
      .filter((item) => item.id !== article.id)
      .map(toPreviewNewsHomeItem),
  };
};

export type NewsDeskHealth =
  | "live"
  | "seeded"
  | "empty"
  | "error"
  | "unavailable";

export type NewsDeskRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "partial";

export interface NewsDeskRun {
  sourceName: string | null;
  status: NewsDeskRunStatus;
  runType: string;
  startedAt: string;
  finishedAt: string | null;
  itemsSeen: number;
  itemsCreated: number;
  itemsUpdated: number;
  errorMessage: string | null;
}

export interface NewsDeskStatus {
  health: NewsDeskHealth;
  activeSources: number;
  totalSources: number;
  publishedStories: number;
  latestPublishedAt: string | null;
  latestRun: NewsDeskRun | null;
}

export type NewsProductionReadinessState = "done" | "current" | "pending";

export interface NewsProductionReadinessItem {
  detail: string;
  label: string;
  state: NewsProductionReadinessState;
}

export const buildNewsDeskStatus = ({
  activeSources,
  totalSources,
  publishedStories,
  latestPublishedAt,
  latestRun,
  unavailable = false,
}: Omit<NewsDeskStatus, "health"> & { unavailable?: boolean }) => {
  const health: NewsDeskHealth = unavailable
    ? "unavailable"
    : latestRun?.status === "failed"
      ? "error"
      : publishedStories > 0
        ? "live"
        : activeSources > 0
          ? "seeded"
          : "empty";

  return {
    health,
    activeSources,
    totalSources,
    publishedStories,
    latestPublishedAt,
    latestRun,
  };
};

export const selectNewsHomeItems = ({
  initialItems,
  serverRecommendedItems,
}: {
  initialItems: readonly NewsHomeItem[];
  serverRecommendedItems: readonly NewsHomeItem[] | undefined;
}) =>
  serverRecommendedItems && serverRecommendedItems.length > 0
    ? selectInitialNewsHomeItems({
        items: serverRecommendedItems,
        limit: serverRecommendedItems.length,
      })
    : selectInitialNewsHomeItems({
        items: initialItems,
        limit: initialItems.length,
      });

export const selectInitialNewsHomeItems = ({
  items,
  limit,
}: {
  items: readonly NewsHomeItem[];
  limit: number;
}) => dedupeNewsItems(items).slice(0, limit);

export const getNewsSourceFilterOptions = ({
  items,
  limit,
}: {
  items: readonly Pick<NewsHomeItem, "sourceName" | "sourceSlug">[];
  limit: number;
}) => {
  const options: { label: string; slug: string }[] = [];
  const seenSlugs = new Set<string>();

  for (const item of items) {
    const slug = item.sourceSlug.trim();
    const label = item.sourceName.trim();
    const normalizedSlug = slug.toLowerCase();

    if (!slug || !label || seenSlugs.has(normalizedSlug)) continue;

    options.push({ label, slug });
    seenSlugs.add(normalizedSlug);

    if (options.length >= limit) break;
  }

  return options;
};

export const buildNewsHomeFeedInput = <TCategory extends string>({
  category,
  cursor,
  limit,
  q,
  readerLocalHour,
  sourceSlug,
  visitorKey,
}: {
  category: TCategory | null;
  cursor: string | null;
  limit: number;
  q: string;
  readerLocalHour: number | null;
  sourceSlug: string | null;
  visitorKey: string | null;
}) => {
  const query = q.trim();
  const input: {
    category?: TCategory;
    cursor?: string;
    limit: number;
    q?: string;
    readerLocalHour?: number;
    sourceSlug?: string;
    visitorKey?: string;
  } = { limit };

  if (category) input.category = category;
  if (cursor) input.cursor = cursor;
  if (query) input.q = query;
  if (
    typeof readerLocalHour === "number" &&
    Number.isInteger(readerLocalHour) &&
    readerLocalHour >= 0 &&
    readerLocalHour <= 23
  ) {
    input.readerLocalHour = readerLocalHour;
  }
  if (sourceSlug) input.sourceSlug = sourceSlug;
  if (visitorKey) input.visitorKey = visitorKey;

  return input;
};

export interface NewsHomeInteractionMetadata {
  [key: string]: unknown;
  feedMode: NewsFeedMode;
  matchedSignals: string[];
  personalizedScore: number;
  rankSlot: number;
  surface: "home";
}

const toNewsHomeRankSlot = (rankSlot: number) => {
  if (!Number.isFinite(rankSlot)) return 0;

  return Math.max(0, Math.trunc(rankSlot));
};

const getUniqueNewsHomeInteractionSignals = (
  signals: readonly string[],
): string[] => {
  const seenSignals = new Set<string>();
  const uniqueSignals: string[] = [];

  for (const signal of signals) {
    const trimmedSignal = signal.trim();

    if (!trimmedSignal || seenSignals.has(trimmedSignal)) continue;

    seenSignals.add(trimmedSignal);
    uniqueSignals.push(trimmedSignal);
  }

  return uniqueSignals.slice(0, 12);
};

export const buildNewsHomeInteractionMetadata = ({
  feedMode,
  item,
  rankSlot,
}: {
  feedMode: NewsFeedMode;
  item: RankedNewsItem<NewsHomeItem>;
  rankSlot: number;
}): NewsHomeInteractionMetadata => ({
  feedMode,
  matchedSignals: getUniqueNewsHomeInteractionSignals(item.matchedSignals),
  personalizedScore: item.personalizedScore,
  rankSlot: toNewsHomeRankSlot(rankSlot),
  surface: "home",
});

export const buildNewsHomeReaderInteraction = ({
  action,
  rankSlot,
}: {
  action: ReaderInteractionAction;
  rankSlot: number;
}): ReaderInteraction => ({
  action,
  rankSlot: toNewsHomeRankSlot(rankSlot),
});

export const stripPersistedNewsPreferenceProfile = (
  profile: PersistedNewsPreferenceProfile,
): NewsPreferenceProfile =>
  normalizeNewsPreferenceProfile({
    preferredCategories: profile.preferredCategories,
    preferredSources: profile.preferredSources,
    preferredEntities: profile.preferredEntities,
    noveltyBias: profile.noveltyBias,
    recencyBias: profile.recencyBias,
  });

export const selectHydratedNewsPreferenceProfile = ({
  localProfile,
  serverProfile,
}: {
  localProfile: NewsPreferenceProfile;
  serverProfile: PersistedNewsPreferenceProfile | undefined;
}) =>
  serverProfile?.persisted
    ? stripPersistedNewsPreferenceProfile(serverProfile)
    : localProfile;

const getUniqueSignals = (values: readonly string[], limit: number) => {
  const seenValues = new Set<string>();
  const signals: string[] = [];

  for (const value of values) {
    const signal = value.trim();
    const normalizedSignal = signal.toLowerCase();

    if (!signal || seenValues.has(normalizedSignal)) continue;

    signals.push(signal);
    seenValues.add(normalizedSignal);
  }

  return signals.slice(0, limit);
};

export const getNewsReaderSignalSummary = (profile: NewsPreferenceProfile) => {
  const topics = getUniqueSignals(profile.preferredCategories, 4);
  const sources = getUniqueSignals(profile.preferredSources, 3);
  const entities = getUniqueSignals(profile.preferredEntities, 4);
  const signalCount = topics.length + sources.length + entities.length;
  const averageBias = (profile.noveltyBias + profile.recencyBias) / 2;
  const strength =
    signalCount >= 8 || averageBias >= 1.5
      ? "Focused"
      : signalCount >= 3 || averageBias >= 1
        ? "Learning"
        : "Exploring";

  return {
    detail:
      signalCount > 0
        ? `${signalCount} reader signals are shaping story order.`
        : "Read, save, or hide stories to train your edition.",
    entities,
    signalCount,
    sources,
    strength,
    topics,
  };
};

const formatSignalCount = (count: number, signalName: string) =>
  `${count} ${signalName} ${count === 1 ? "signal" : "signals"}`;

export const getNewsReaderRankingFactors = (profile: NewsPreferenceProfile) => {
  const topics = getUniqueSignals(profile.preferredCategories, 12);
  const sources = getUniqueSignals(profile.preferredSources, 12);
  const entities = getUniqueSignals(profile.preferredEntities, 24);
  const factors: { label: string; detail: string }[] = [];

  if (topics.length > 0) {
    factors.push({
      label: "Topics",
      detail: `${formatSignalCount(topics.length, "topic")} lift matching stories.`,
    });
  }

  if (sources.length > 0) {
    factors.push({
      label: "Sources",
      detail: `${formatSignalCount(sources.length, "source")} lift trusted reporting.`,
    });
  }

  if (entities.length > 0) {
    factors.push({
      label: "Entities",
      detail: `${formatSignalCount(entities.length, "entity")} lift related coverage.`,
    });
  }

  if (factors.length === 0) {
    factors.push({
      label: "Signals",
      detail: "No saved reader signals yet.",
    });
  }

  const biasDetail =
    profile.recencyBias > profile.noveltyBias
      ? "Fresh stories are weighted above novel stories."
      : profile.noveltyBias > profile.recencyBias
        ? "Novel stories are weighted above fresh stories."
        : "Freshness and novelty are balanced.";

  return [
    ...factors,
    {
      label: "Bias",
      detail: biasDetail,
    },
  ];
};

const getReaderDigestSignalCount = (
  item: RankedNewsItem<NewsHomeItem> | undefined,
) =>
  item
    ? item.matchedSignals.filter((signal) => signal !== "exploration").length
    : 0;

const getReaderDigestLeadSignals = ({
  formatCategory,
  item,
  profile,
}: {
  formatCategory: (category: string) => string;
  item: RankedNewsItem<NewsHomeItem>;
  profile: NewsPreferenceProfile;
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const signals: string[] = [];

  if (
    hasPreferenceSignal(normalizedProfile.preferredCategories, item.category)
  ) {
    signals.push(formatCategory(item.category));
  }

  for (const entity of item.entities) {
    if (hasPreferenceSignal(normalizedProfile.preferredEntities, entity)) {
      signals.push(entity);
    }
  }

  if (
    signals.length === 0 &&
    hasPreferenceSignal(normalizedProfile.preferredSources, item.sourceSlug)
  ) {
    signals.push(item.sourceName);
  }

  return getUniqueSignals(signals, 3);
};

const toNewsReaderDigestNextRead = ({
  formatCategory,
  item,
}: {
  formatCategory: (category: string) => string;
  item: RankedNewsItem<NewsHomeItem>;
}) => ({
  categoryLabel: formatCategory(item.category),
  id: item.id,
  reason: item.matchedSignals.includes("exploration")
    ? `Exploration story tests ${formatCategory(
        item.category,
      )} outside your profile.`
    : getReaderDigestSignalCount(item) > 0
      ? `${getReaderDigestSignalCount(item)} reader ${
          getReaderDigestSignalCount(item) === 1 ? "signal" : "signals"
        } keep this story in your digest.`
      : "Trend-led story adds market heat without a profile match.",
  scoreLabel:
    item.matchedSignals.length === 0
      ? `${item.trendScore} heat`
      : `${item.personalizedScore} score`,
  sourceName: item.sourceName,
  title: item.title,
});

const sharesNewsReaderDigestLeadEntity = (
  leadEntityKeys: ReadonlySet<string>,
  item: RankedNewsItem<NewsHomeItem>,
) =>
  getNewsAlertRoutingSpecificEntities(item).some((entity) =>
    leadEntityKeys.has(entity.key),
  );

const selectNewsReaderDigestNextReadItems = ({
  items,
  leadItem,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
  leadItem: RankedNewsItem<NewsHomeItem> | undefined;
}) => {
  if (!leadItem || items.length < 2) return items.slice(0, 2);

  const leadEntityKeys = new Set(
    getNewsAlertRoutingSpecificEntities(leadItem).map((entity) => entity.key),
  );

  if (leadEntityKeys.size === 0) return items.slice(0, 2);

  const [firstItem] = items;

  if (
    !firstItem ||
    !sharesNewsReaderDigestLeadEntity(leadEntityKeys, firstItem)
  ) {
    return items.slice(0, 2);
  }

  const counterpointItem = items.find(
    (item) => !sharesNewsReaderDigestLeadEntity(leadEntityKeys, item),
  );

  if (!counterpointItem) return items.slice(0, 2);

  return [
    counterpointItem,
    ...items.filter((item) => item.id !== counterpointItem.id),
  ].slice(0, 2);
};

export const getNewsReaderDigest = ({
  formatCategory,
  items,
  profile,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  profile: NewsPreferenceProfile;
}) => {
  const signalSummary = getNewsReaderSignalSummary(profile);
  const readerMatchedItems = items.filter(
    (item) =>
      getReaderDigestSignalCount(item) > 0 &&
      !item.matchedSignals.includes("exploration"),
  );
  const explorationItems = items.filter((item) =>
    item.matchedSignals.includes("exploration"),
  );
  const trendLedItems = items.filter(
    (item) => item.matchedSignals.length === 0,
  );

  if (items.length === 0) {
    return {
      headline: "Your AI briefing is learning",
      label: "Digest Waiting",
      metrics: [
        { label: "Stories", value: "0" },
        { label: "Reader matches", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Signals", value: String(signalSummary.signalCount) },
      ],
      nextReads: [],
      notices: [
        {
          detail: "Ranked stories will turn your topics into a digest.",
          label: "Waiting for feed",
        },
      ],
      summary: "Reader digest will appear after stories are ranked.",
    };
  }

  const [leadItem] = items;
  const leadSignals = leadItem
    ? getReaderDigestLeadSignals({ formatCategory, item: leadItem, profile })
    : [];
  const nextReadCandidates = [...items]
    .filter((item) => item.id !== leadItem?.id)
    .sort((left, right) => {
      const leftIsExplore = left.matchedSignals.includes("exploration");
      const rightIsExplore = right.matchedSignals.includes("exploration");

      if (leftIsExplore !== rightIsExplore) return leftIsExplore ? -1 : 1;

      if (right.personalizedScore !== left.personalizedScore) {
        return right.personalizedScore - left.personalizedScore;
      }

      return right.trendScore - left.trendScore;
    });
  const nextReads = selectNewsReaderDigestNextReadItems({
    items: nextReadCandidates,
    leadItem,
  }).map((item) => toNewsReaderDigestNextRead({ formatCategory, item }));
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const notices = [
    {
      detail:
        leadItem && leadSignals.length > 0
          ? `${formatRecommendationTraceList(
              leadSignals,
            )} are driving the lead recommendation from ${leadItem.sourceName}.`
          : leadItem
            ? `${leadItem.sourceName} leads on score, trust, and trend while the profile keeps learning.`
            : "The digest is waiting for a lead story.",
      label: "Why this leads",
    },
    {
      detail:
        normalizedProfile.noveltyBias > normalizedProfile.recencyBias
          ? "Novelty bias is higher than recency, so the digest keeps exploration visible."
          : normalizedProfile.recencyBias > normalizedProfile.noveltyBias
            ? "Recency bias is higher than novelty, so fresh stories stay close to the top."
            : "Freshness and novelty are balanced, so the digest can mix known interests and discoveries.",
      label: "Bias posture",
    },
  ];

  return {
    headline: leadItem?.title ?? "Your AI briefing is learning",
    label: "Digest Ready",
    metrics: [
      { label: "Stories", value: String(items.length) },
      { label: "Reader matches", value: String(readerMatchedItems.length) },
      { label: "Explore", value: String(explorationItems.length) },
      { label: "Signals", value: String(signalSummary.signalCount) },
    ],
    nextReads,
    notices,
    summary: `${items.length} ranked ${
      items.length === 1 ? "story produces" : "stories produce"
    } ${readerMatchedItems.length} reader-matched ${
      readerMatchedItems.length === 1 ? "lead" : "leads"
    }, ${explorationItems.length} exploration ${
      explorationItems.length === 1 ? "option" : "options"
    }, and ${trendLedItems.length} trend-led ${
      trendLedItems.length === 1 ? "fallback" : "fallbacks"
    }.`,
  };
};

export type NewsReaderMemoryItem = Pick<
  NewsHomeItem,
  "category" | "entities" | "id" | "sourceName" | "sourceSlug" | "title"
> & {
  hiddenAt?: string;
  occurredAt?: string;
  savedAt?: string;
  tags?: readonly string[];
  viewedAt?: string;
};

const getNewsReaderMemoryTimestamp = (item: NewsReaderMemoryItem) => {
  const timestamp = Date.parse(
    item.viewedAt ?? item.savedAt ?? item.hiddenAt ?? item.occurredAt ?? "",
  );

  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const mergeNewsReaderMemoryItems = ({
  limit = 6,
  localItems,
  serverItems,
}: {
  limit?: number;
  localItems: readonly NewsReaderMemoryItem[];
  serverItems: readonly NewsReaderMemoryItem[];
}) => {
  const itemsById = new Map<string, NewsReaderMemoryItem>();

  for (const item of [...localItems, ...serverItems]) {
    if (!item.id || itemsById.has(item.id)) continue;

    itemsById.set(item.id, item);
  }

  return Array.from(itemsById.values())
    .sort((left, right) => {
      const timestampDelta =
        getNewsReaderMemoryTimestamp(right) -
        getNewsReaderMemoryTimestamp(left);

      if (timestampDelta !== 0) return timestampDelta;

      return left.title.localeCompare(right.title);
    })
    .slice(0, limit);
};

const isStoredNewsReaderMemoryRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const selectStoredNewsReaderMemoryItems = (
  value: unknown,
): NewsReaderMemoryItem[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isStoredNewsReaderMemoryRecord(item)) return [];

    const {
      category,
      entities,
      hiddenAt,
      id,
      occurredAt,
      savedAt,
      sourceName,
      sourceSlug,
      tags,
      title,
      viewedAt,
    } = item;

    if (
      typeof category !== "string" ||
      !Array.isArray(entities) ||
      typeof id !== "string" ||
      !id ||
      typeof sourceName !== "string" ||
      typeof sourceSlug !== "string" ||
      typeof title !== "string"
    ) {
      return [];
    }

    const memoryItem: NewsReaderMemoryItem = {
      category,
      entities: entities.filter(
        (entity): entity is string => typeof entity === "string",
      ),
      id,
      sourceName,
      sourceSlug,
      title,
    };

    if (typeof hiddenAt === "string") {
      memoryItem.hiddenAt = hiddenAt;
    }

    if (typeof occurredAt === "string") {
      memoryItem.occurredAt = occurredAt;
    }

    if (typeof savedAt === "string") {
      memoryItem.savedAt = savedAt;
    }

    if (Array.isArray(tags)) {
      memoryItem.tags = tags.filter(
        (tag): tag is string => typeof tag === "string",
      );
    }

    if (typeof viewedAt === "string") {
      memoryItem.viewedAt = viewedAt;
    }

    return [memoryItem];
  });
};

type NewsHomePositiveFeedbackAction = Extract<
  ReaderInteractionAction,
  "click_source" | "save" | "share"
>;

type NewsHomePositiveFeedbackSource = Pick<
  NewsHomeItem,
  "category" | "entities" | "sourceSlug"
>;

export type NewsHomePositiveFeedbackAnchor = PositiveFeedbackNewsItem;

const toNewsHomePositiveFeedbackAnchor = ({
  action,
  item,
  occurredAt,
}: {
  action?: NewsHomePositiveFeedbackAction;
  item: NewsHomePositiveFeedbackSource;
  occurredAt?: string;
}): NewsHomePositiveFeedbackAnchor => ({
  action,
  category: item.category,
  entities: item.entities,
  occurredAt,
  sourceSlug: item.sourceSlug,
});

export const selectNewsHomePositiveFeedbackAnchors = ({
  explicitFeedbackItems,
  historyItems,
  savedItems,
}: {
  explicitFeedbackItems: readonly NewsHomePositiveFeedbackAnchor[];
  historyItems: readonly (NewsHomePositiveFeedbackSource & {
    viewedAt?: string;
  })[];
  savedItems: readonly (NewsHomePositiveFeedbackSource & {
    savedAt?: string;
  })[];
}): NewsHomePositiveFeedbackAnchor[] => [
  ...explicitFeedbackItems,
  ...savedItems.map((item) =>
    toNewsHomePositiveFeedbackAnchor({
      action: "save",
      item,
      occurredAt: item.savedAt,
    }),
  ),
  ...historyItems.map((item) =>
    toNewsHomePositiveFeedbackAnchor({
      item,
      occurredAt: item.viewedAt,
    }),
  ),
];

const getTopMemorySignal = (
  values: readonly string[],
): { count: number; value: string } | null => {
  const countsByValue = new Map<
    string,
    {
      count: number;
      value: string;
    }
  >();

  for (const value of values) {
    const signal = value.trim();
    const normalizedSignal = signal.toLowerCase();

    if (!signal) continue;

    const existing = countsByValue.get(normalizedSignal);

    countsByValue.set(normalizedSignal, {
      count: existing ? existing.count + 1 : 1,
      value: existing?.value ?? signal,
    });
  }

  return (
    Array.from(countsByValue.values()).sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.value.localeCompare(right.value);
    })[0] ?? null
  );
};

export const getNewsReaderMemory = ({
  formatCategory,
  historyItems,
  profile,
  savedItems,
}: {
  formatCategory: (category: string) => string;
  historyItems: readonly NewsReaderMemoryItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const signalSummary = getNewsReaderSignalSummary(profile);
  const interactionItems = [...savedItems, ...historyItems];
  const topTopic = getTopMemorySignal(
    interactionItems.map((item) => item.category),
  );
  const topSource = getTopMemorySignal(
    interactionItems.map((item) => item.sourceName),
  );
  const topEntity = getTopMemorySignal(
    interactionItems.flatMap((item) => getUniqueSignals(item.entities, 24)),
  );
  const topTopicLabel = topTopic ? formatCategory(topTopic.value) : "None";
  const savedCount = savedItems.length;
  const readCount = historyItems.length;
  const hasMemory =
    signalSummary.signalCount > 0 || savedCount > 0 || readCount > 0;

  if (!hasMemory) {
    return {
      highlights: [
        {
          detail: "Save, read, or hide stories to build a reader memory.",
          label: "Learning needed",
        },
      ],
      label: "Cold Start",
      metrics: [
        { label: "Profile signals", value: "0" },
        { label: "Saved", value: "0" },
        { label: "Read", value: "0" },
        { label: "Top topic", value: "None" },
      ],
      summary: "Reader memory will appear after you interact with stories.",
    };
  }

  const highlights: { detail: string; label: string }[] = [];

  if (topTopic) {
    highlights.push({
      detail: `${topTopicLabel} leads with ${topTopic.count} saved/read ${
        topTopic.count === 1 ? "story" : "stories"
      }.`,
      label: "Topic memory",
    });
  }

  if (topSource) {
    highlights.push({
      detail: `${topSource.value} is the strongest source signal.`,
      label: "Source memory",
    });
  }

  if (topEntity) {
    highlights.push({
      detail: `${topEntity.value} is the strongest entity signal.`,
      label: "Entity memory",
    });
  }

  if (highlights.length === 0) {
    highlights.push({
      detail:
        "Preference controls are shaping the feed before behavior arrives.",
      label: "Profile memory",
    });
  }

  return {
    highlights,
    label:
      signalSummary.signalCount + savedCount + readCount >= 8
        ? "Strong Memory"
        : "Learning Memory",
    metrics: [
      { label: "Profile signals", value: String(signalSummary.signalCount) },
      { label: "Saved", value: String(savedCount) },
      { label: "Read", value: String(readCount) },
      { label: "Top topic", value: topTopicLabel },
    ],
    summary: `${signalSummary.signalCount} preference ${
      signalSummary.signalCount === 1 ? "signal" : "signals"
    }, ${savedCount} saved ${savedCount === 1 ? "story" : "stories"}, and ${readCount} ${
      readCount === 1 ? "read" : "reads"
    } are shaping the next edition.`,
  };
};

type NewsReaderJourneyStepKey =
  | "guardrail"
  | "impression"
  | "profile"
  | "read"
  | "save";

interface NewsReaderJourneyStep {
  detail: string;
  id?: string;
  key: NewsReaderJourneyStepKey;
  label: string;
  signalLabel: string;
  sourceName?: string;
  statusLabel: string;
  title: string;
}

const formatNewsJourneyProfileSignals = ({
  formatCategory,
  profile,
}: {
  formatCategory: (category: string) => string;
  profile: NewsPreferenceProfile;
}) => {
  const signals = [
    ...profile.preferredCategories.map(formatCategory),
    ...profile.preferredEntities,
    ...profile.preferredSources,
  ].filter((signal) => signal.trim().length > 0);

  return signals.length > 0 ? signals.slice(0, 3).join(" / ") : "No signals";
};

const getNewsJourneyProfileStep = ({
  formatCategory,
  profile,
}: {
  formatCategory: (category: string) => string;
  profile: NewsPreferenceProfile;
}): NewsReaderJourneyStep | null => {
  const signalSummary = getNewsReaderSignalSummary(profile);

  if (signalSummary.signalCount === 0) return null;

  return {
    detail: `${signalSummary.signalCount} active ${
      signalSummary.signalCount === 1 ? "signal" : "signals"
    } shape the starting edition.`,
    key: "profile",
    label: "Profile seed",
    signalLabel: formatNewsJourneyProfileSignals({ formatCategory, profile }),
    statusLabel: "Active",
    title: "Reader profile",
  };
};

const getNewsJourneyImpressionStep = (
  item: RankedNewsItem<NewsHomeItem> | undefined,
): NewsReaderJourneyStep | null => {
  if (!item) return null;

  return {
    detail: `Top ranked story opens the session with ${
      item.matchedSignals.length
    } reader ${item.matchedSignals.length === 1 ? "signal" : "signals"}.`,
    id: item.id,
    key: "impression",
    label: "First impression",
    signalLabel: `${item.personalizedScore} score / ${item.trendScore} heat`,
    sourceName: item.sourceName,
    statusLabel: "For You",
    title: item.title,
  };
};

const getNewsJourneyReadStep = ({
  formatCategory,
  item,
}: {
  formatCategory: (category: string) => string;
  item: NewsReaderMemoryItem | undefined;
}): NewsReaderJourneyStep | null => {
  if (!item) return null;

  const categoryLabel = formatCategory(item.category);

  return {
    detail: `${categoryLabel} read history keeps this topic eligible for follow-up.`,
    id: item.id,
    key: "read",
    label: "Read memory",
    signalLabel: categoryLabel,
    sourceName: item.sourceName,
    statusLabel: "Learned",
    title: item.title,
  };
};

const getNewsJourneySaveStep = ({
  formatCategory,
  item,
}: {
  formatCategory: (category: string) => string;
  item: NewsReaderMemoryItem | undefined;
}): NewsReaderJourneyStep | null => {
  if (!item) return null;

  const categoryLabel = formatCategory(item.category);

  return {
    detail: `Saved ${categoryLabel} coverage becomes durable memory.`,
    id: item.id,
    key: "save",
    label: "Saved signal",
    signalLabel: categoryLabel,
    sourceName: item.sourceName,
    statusLabel: "Pinned",
    title: item.title,
  };
};

const getNewsJourneyGuardrailStep = ({
  formatCategory,
  item,
}: {
  formatCategory: (category: string) => string;
  item: NewsReaderMemoryItem | undefined;
}): NewsReaderJourneyStep | null => {
  if (!item) return null;

  const categoryLabel = formatCategory(item.category);

  return {
    detail: `${categoryLabel} feedback dampens matching future stories.`,
    id: item.id,
    key: "guardrail",
    label: "Less feedback",
    signalLabel: categoryLabel,
    sourceName: item.sourceName,
    statusLabel: "Guarded",
    title: item.title,
  };
};

export const getNewsReaderJourneyMap = ({
  formatCategory,
  historyItems,
  items,
  limit,
  negativeFeedbackItems,
  profile,
  savedItems,
}: {
  formatCategory: (category: string) => string;
  historyItems: readonly NewsReaderMemoryItem[];
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const signalSummary = getNewsReaderSignalSummary(profile);
  const steps = [
    getNewsJourneyProfileStep({ formatCategory, profile }),
    getNewsJourneyImpressionStep(items[0]),
    getNewsJourneyReadStep({ formatCategory, item: historyItems[0] }),
    getNewsJourneySaveStep({ formatCategory, item: savedItems[0] }),
    getNewsJourneyGuardrailStep({
      formatCategory,
      item: negativeFeedbackItems[0],
    }),
  ].filter((step): step is NewsReaderJourneyStep => step !== null);
  const visibleSteps = steps.slice(0, Math.max(0, limit));
  const memoryCount = historyItems.length + savedItems.length;

  return {
    label: visibleSteps.length > 0 ? "Journey Active" : "Journey Waiting",
    metrics: [
      { label: "Steps", value: String(visibleSteps.length) },
      {
        label: "Profile",
        value: `${signalSummary.signalCount} ${
          signalSummary.signalCount === 1 ? "signal" : "signals"
        }`,
      },
      { label: "Memory", value: String(memoryCount) },
      { label: "Guardrails", value: String(negativeFeedbackItems.length) },
    ],
    steps: visibleSteps,
    summary:
      visibleSteps.length > 0
        ? `${visibleSteps.length} journey ${
            visibleSteps.length === 1 ? "step" : "steps"
          } connect ${items.length} ranked ${
            items.length === 1 ? "story" : "stories"
          }, ${historyItems.length} ${
            historyItems.length === 1 ? "read" : "reads"
          }, ${savedItems.length} ${
            savedItems.length === 1 ? "save" : "saves"
          }, and ${negativeFeedbackItems.length} ${
            negativeFeedbackItems.length === 1 ? "guardrail" : "guardrails"
          }.`
        : "Reader journey will appear after profile or behavior signals.",
  };
};

type NewsReaderWatchlistKind = "Entity" | "Source" | "Topic";
type NewsReaderWatchlistStatus = "Suggested" | "Watching";

interface NewsReaderWatchlistWorking {
  firstIndex: number;
  isActive: boolean;
  items: RankedNewsItem<NewsHomeItem>[];
  key: string;
  kind: NewsReaderWatchlistKind;
  signal: string;
  sourceNames: string[];
  sourceSlugs: Set<string>;
  trendScoreTotal: number;
}

const readerWatchlistKindPriority = {
  Entity: 0,
  Topic: 1,
  Source: 2,
} satisfies Record<NewsReaderWatchlistKind, number>;

const upsertNewsReaderWatchlistSignal = ({
  firstIndex,
  isActive,
  item,
  key,
  kind,
  signal,
  store,
}: {
  firstIndex: number;
  isActive: boolean;
  item: RankedNewsItem<NewsHomeItem>;
  key: string;
  kind: NewsReaderWatchlistKind;
  signal: string;
  store: Map<string, NewsReaderWatchlistWorking>;
}) => {
  const normalizedSignal = signal.trim();
  if (!normalizedSignal) return;

  const existing = store.get(key);

  if (!existing) {
    store.set(key, {
      firstIndex,
      isActive,
      items: [item],
      key,
      kind,
      signal: normalizedSignal,
      sourceNames: [item.sourceName],
      sourceSlugs: new Set([item.sourceSlug]),
      trendScoreTotal: item.trendScore,
    });
    return;
  }

  existing.isActive = existing.isActive || isActive;
  existing.items.push(item);
  existing.sourceSlugs.add(item.sourceSlug);
  existing.trendScoreTotal += item.trendScore;

  if (!existing.sourceNames.includes(item.sourceName)) {
    existing.sourceNames.push(item.sourceName);
  }
};

const getNewsReaderWatchlistScore = ({
  averageTrendScore,
  isActive,
  sourceCount,
  storyCount,
}: {
  averageTrendScore: number;
  isActive: boolean;
  sourceCount: number;
  storyCount: number;
}) =>
  averageTrendScore + storyCount * 20 + sourceCount * 8 + (isActive ? 30 : 10);

const getNewsReaderWatchlistReason = (
  statusLabel: NewsReaderWatchlistStatus,
) =>
  statusLabel === "Watching"
    ? "Already in your profile and active in the edition."
    : "High heat suggests adding this signal to the watchlist.";

const toNewsReaderWatchlistEntry = (entry: NewsReaderWatchlistWorking) => {
  const storyCount = entry.items.length;
  const sourceCount = entry.sourceSlugs.size;
  const averageTrendScore = Math.round(entry.trendScoreTotal / storyCount);
  const statusLabel: NewsReaderWatchlistStatus = entry.isActive
    ? "Watching"
    : "Suggested";
  const sortedItems = [...entry.items].sort((left, right) => {
    if (right.personalizedScore !== left.personalizedScore) {
      return right.personalizedScore - left.personalizedScore;
    }

    if (right.trendScore !== left.trendScore) {
      return right.trendScore - left.trendScore;
    }

    return (
      new Date(right.publishedAt).getTime() -
      new Date(left.publishedAt).getTime()
    );
  });
  const [topStory] = sortedItems;

  return {
    coverageCount: storyCount,
    firstIndex: entry.firstIndex,
    key: entry.key,
    kind: entry.kind,
    reason: getNewsReaderWatchlistReason(statusLabel),
    score: getNewsReaderWatchlistScore({
      averageTrendScore,
      isActive: entry.isActive,
      sourceCount,
      storyCount,
    }),
    signal: entry.signal,
    sourceNames: entry.sourceNames,
    statusLabel,
    supportLabel: `${storyCount} ${
      storyCount === 1 ? "story" : "stories"
    } / ${sourceCount} ${sourceCount === 1 ? "source" : "sources"}`,
    topStory: topStory
      ? {
          id: topStory.id,
          sourceName: topStory.sourceName,
          title: topStory.title,
        }
      : null,
  };
};

export const getNewsReaderWatchlist = ({
  formatCategory,
  items,
  limit,
  profile,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  profile: NewsPreferenceProfile;
}) => {
  if (items.length === 0) {
    return {
      entries: [],
      label: "Watchlist Waiting",
      metrics: [
        { label: "Signals", value: "0" },
        { label: "Watching", value: "0" },
        { label: "Suggested", value: "0" },
        { label: "Coverage", value: "0" },
      ],
      summary: "Reader watchlist will appear after stories are ranked.",
    };
  }

  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const workingEntries = new Map<string, NewsReaderWatchlistWorking>();

  items.forEach((item, index) => {
    const topicIsActive = hasPreferenceSignal(
      normalizedProfile.preferredCategories,
      item.category,
    );

    if (topicIsActive || item.trendScore >= 90) {
      upsertNewsReaderWatchlistSignal({
        firstIndex: index,
        isActive: topicIsActive,
        item,
        key: `topic:${normalizePreferenceSignal(item.category)}`,
        kind: "Topic",
        signal: formatCategory(item.category),
        store: workingEntries,
      });
    }

    if (
      hasPreferenceSignal(normalizedProfile.preferredSources, item.sourceSlug)
    ) {
      upsertNewsReaderWatchlistSignal({
        firstIndex: index,
        isActive: true,
        item,
        key: `source:${normalizePreferenceSignal(item.sourceSlug)}`,
        kind: "Source",
        signal: item.sourceName,
        store: workingEntries,
      });
    }

    for (const entity of getUniqueSignals(item.entities, 12)) {
      const entityIsActive = hasPreferenceSignal(
        normalizedProfile.preferredEntities,
        entity,
      );
      const entityIsSuggested =
        item.trendScore >= 90 &&
        isFeedGovernorSpecificEntity({
          key: normalizePreferenceSignal(entity),
        });

      if (!entityIsActive && !entityIsSuggested) {
        continue;
      }

      upsertNewsReaderWatchlistSignal({
        firstIndex: index,
        isActive: entityIsActive,
        item,
        key: `entity:${normalizePreferenceSignal(entity)}`,
        kind: "Entity",
        signal: entity,
        store: workingEntries,
      });
    }
  });

  const entries = Array.from(workingEntries.values())
    .map(toNewsReaderWatchlistEntry)
    .filter((entry) => entry.topStory !== null)
    .filter(
      (entry) =>
        entry.statusLabel === "Watching" ||
        entry.kind !== "Entity" ||
        entry.coverageCount > 1,
    )
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;

      const kindDifference =
        readerWatchlistKindPriority[left.kind] -
        readerWatchlistKindPriority[right.kind];

      if (kindDifference !== 0) return kindDifference;

      return left.firstIndex - right.firstIndex;
    })
    .slice(0, limit)
    .map(
      ({ coverageCount: _coverageCount, firstIndex: _firstIndex, ...entry }) =>
        entry,
    );
  const watchingCount = entries.filter(
    (entry) => entry.statusLabel === "Watching",
  ).length;
  const suggestedCount = entries.filter(
    (entry) => entry.statusLabel === "Suggested",
  ).length;
  const coverageCount = Array.from(workingEntries.values())
    .map(toNewsReaderWatchlistEntry)
    .filter((entry) =>
      entries.some((selectedEntry) => selectedEntry.key === entry.key),
    )
    .reduce((total, entry) => total + entry.coverageCount, 0);

  return {
    entries,
    label: entries.length > 0 ? "Watchlist Active" : "Watchlist Waiting",
    metrics: [
      { label: "Signals", value: String(entries.length) },
      { label: "Watching", value: String(watchingCount) },
      { label: "Suggested", value: String(suggestedCount) },
      { label: "Coverage", value: String(coverageCount) },
    ],
    summary:
      entries.length > 0
        ? `${entries.length} watchlist ${
            entries.length === 1 ? "signal tracks" : "signals track"
          } ${coverageCount} story ${
            coverageCount === 1 ? "match" : "matches"
          } across ${watchingCount} active and ${suggestedCount} suggested ${
            suggestedCount === 1 ? "signal" : "signals"
          }.`
        : "Reader watchlist will appear after stories are ranked.",
  };
};

type NewsReaderCohortLabel =
  | "Builder Watch"
  | "Lab Watch"
  | "Market Scanner"
  | "Risk Desk";

interface NewsReaderCohortDefinition {
  categories: readonly string[];
  detail: string;
  entities: readonly string[];
  label: NewsReaderCohortLabel;
  nextAction: string;
  sources: readonly string[];
}

const newsReaderCohortDefinitions: readonly NewsReaderCohortDefinition[] = [
  {
    categories: ["agent_product", "open_source", "product_hunt"],
    detail:
      "Agent products, open-source tools, and builder platforms are leading the profile.",
    entities: ["agents", "langchain", "hugging face", "developers"],
    label: "Builder Watch",
    nextAction: "Keep builder coverage high and test one adjacent lab story.",
    sources: ["agent-desk", "oss-desk", "product-hunt"],
  },
  {
    categories: ["model_release", "research", "big_tech"],
    detail: "Lab, model, and research signals point to frontier AI coverage.",
    entities: ["openai", "anthropic", "deepmind", "google ai", "meta ai"],
    label: "Lab Watch",
    nextAction:
      "Pair frontier model updates with independent evaluation coverage.",
    sources: ["openai-news", "anthropic", "deepmind", "google-ai"],
  },
  {
    categories: ["funding", "market_map", "yc_ai"],
    detail:
      "Funding, startup, and market-map signals point to dealflow coverage.",
    entities: ["series a", "yc", "investors", "startup"],
    label: "Market Scanner",
    nextAction:
      "Mix funding stories with product proof so the feed stays useful.",
    sources: ["venturewire", "yc", "y-combinator"],
  },
  {
    categories: ["policy", "security", "hot_take", "musk_ai"],
    detail:
      "Policy, security, and hot-take signals are being treated as risk coverage.",
    entities: ["policy", "security", "rumor", "xai"],
    label: "Risk Desk",
    nextAction:
      "Keep risk coverage present but avoid over-weighting noisy sources.",
    sources: ["rumor-feed", "policy-desk", "security-desk"],
  },
] as const;

interface NewsReaderCohortAccumulator {
  definition: NewsReaderCohortDefinition;
  evidence: string[];
  evidenceKeys: Set<string>;
  guardrailCount: number;
  score: number;
}

const createNewsReaderCohortAccumulators = () =>
  new Map<NewsReaderCohortLabel, NewsReaderCohortAccumulator>(
    newsReaderCohortDefinitions.map((definition) => [
      definition.label,
      {
        definition,
        evidence: [],
        evidenceKeys: new Set<string>(),
        guardrailCount: 0,
        score: 0,
      },
    ]),
  );

const matchesNewsReaderCohortSignal = (
  signal: string,
  values: readonly string[],
) => {
  const normalizedSignal = signal.trim().toLowerCase();

  return (
    normalizedSignal.length > 0 &&
    values.some((value) => value.toLowerCase() === normalizedSignal)
  );
};

const findNewsReaderCohortForCategory = (category: string) =>
  newsReaderCohortDefinitions.find((definition) =>
    matchesNewsReaderCohortSignal(category, definition.categories),
  );

const findNewsReaderCohortForSource = (sourceSlug: string) =>
  newsReaderCohortDefinitions.find((definition) =>
    matchesNewsReaderCohortSignal(sourceSlug, definition.sources),
  );

const findNewsReaderCohortForEntity = (entity: string) =>
  newsReaderCohortDefinitions.find((definition) =>
    matchesNewsReaderCohortSignal(entity, definition.entities),
  );

const findNewsReaderCohortForItem = (item: NewsReaderMemoryItem) =>
  findNewsReaderCohortForCategory(item.category) ??
  findNewsReaderCohortForSource(item.sourceSlug) ??
  item.entities
    .map(findNewsReaderCohortForEntity)
    .find(
      (definition): definition is NewsReaderCohortDefinition =>
        definition !== undefined,
    );

const addNewsReaderCohortEvidence = (
  accumulator: NewsReaderCohortAccumulator,
  value: string,
) => {
  const evidence = value.trim();
  const evidenceKey = evidence.toLowerCase();

  if (!evidence || accumulator.evidenceKeys.has(evidenceKey)) return;

  accumulator.evidence.push(evidence);
  accumulator.evidenceKeys.add(evidenceKey);
};

const incrementNewsReaderCohortScore = ({
  accumulators,
  amount,
  definition,
}: {
  accumulators: Map<NewsReaderCohortLabel, NewsReaderCohortAccumulator>;
  amount: number;
  definition: NewsReaderCohortDefinition | undefined;
}) => {
  if (!definition) return;

  const accumulator = accumulators.get(definition.label);

  if (accumulator) accumulator.score += amount;
};

export const getNewsReaderCohorts = ({
  formatCategory,
  historyItems,
  limit,
  negativeFeedbackItems,
  profile,
  savedItems,
}: {
  formatCategory: (category: string) => string;
  historyItems: readonly NewsReaderMemoryItem[];
  limit: number;
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const accumulators = createNewsReaderCohortAccumulators();

  for (const category of normalizedProfile.preferredCategories) {
    const definition = findNewsReaderCohortForCategory(category);
    incrementNewsReaderCohortScore({ accumulators, amount: 1, definition });

    const accumulator = definition ? accumulators.get(definition.label) : null;
    if (accumulator) {
      addNewsReaderCohortEvidence(accumulator, formatCategory(category));
    }
  }

  for (const sourceSlug of normalizedProfile.preferredSources) {
    incrementNewsReaderCohortScore({
      accumulators,
      amount: 1,
      definition: findNewsReaderCohortForSource(sourceSlug),
    });
  }

  for (const entity of normalizedProfile.preferredEntities) {
    const definition = findNewsReaderCohortForEntity(entity);
    incrementNewsReaderCohortScore({ accumulators, amount: 1, definition });

    const accumulator = definition ? accumulators.get(definition.label) : null;
    if (accumulator) addNewsReaderCohortEvidence(accumulator, entity);
  }

  for (const item of savedItems) {
    const definition = findNewsReaderCohortForItem(item);
    incrementNewsReaderCohortScore({ accumulators, amount: 2, definition });

    const accumulator = definition ? accumulators.get(definition.label) : null;
    if (accumulator) addNewsReaderCohortEvidence(accumulator, item.sourceName);
  }

  for (const item of historyItems) {
    const definition = findNewsReaderCohortForItem(item);
    incrementNewsReaderCohortScore({ accumulators, amount: 1, definition });

    const accumulator = definition ? accumulators.get(definition.label) : null;
    if (accumulator) addNewsReaderCohortEvidence(accumulator, item.sourceName);
  }

  for (const item of negativeFeedbackItems) {
    const definition = findNewsReaderCohortForItem(item);
    const accumulator = definition ? accumulators.get(definition.label) : null;

    if (!accumulator) continue;

    accumulator.guardrailCount += 1;
    addNewsReaderCohortEvidence(accumulator, formatCategory(item.category));
    addNewsReaderCohortEvidence(accumulator, item.sourceName);
  }

  const totalScore = Array.from(accumulators.values()).reduce(
    (sum, accumulator) => sum + accumulator.score,
    0,
  );
  const totalGuardrails = Array.from(accumulators.values()).reduce(
    (sum, accumulator) => sum + accumulator.guardrailCount,
    0,
  );
  const activeCohortCount = Array.from(accumulators.values()).filter(
    (accumulator) => accumulator.score > 0,
  ).length;

  if (totalScore === 0 && totalGuardrails === 0) {
    return {
      cohorts: [],
      label: "Cold Cohorts",
      metrics: [
        { label: "Top cohort", value: "None" },
        { label: "Weighted signals", value: "0" },
        { label: "Guardrails", value: "0" },
        { label: "Bias", value: getFeedGovernorBiasMode(profile) },
      ],
      summary:
        "Reader cohorts will appear after preferences or behavior arrive.",
    };
  }

  const cohorts = Array.from(accumulators.values())
    .filter(
      (accumulator) => accumulator.score > 0 || accumulator.guardrailCount > 0,
    )
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.guardrailCount !== left.guardrailCount) {
        return right.guardrailCount - left.guardrailCount;
      }
      return left.definition.label.localeCompare(right.definition.label);
    })
    .slice(0, limit)
    .map((accumulator) => ({
      confidenceLabel: `${accumulator.score} ${
        accumulator.score === 1 ? "signal" : "signals"
      }`,
      detail: accumulator.definition.detail,
      evidence: accumulator.evidence.slice(0, 3),
      guardrailCount: accumulator.guardrailCount,
      label: accumulator.definition.label,
      nextAction: accumulator.definition.nextAction,
      score: accumulator.score,
    }));
  const [topCohort] = cohorts;

  return {
    cohorts,
    label: `${cohorts.length} ${cohorts.length === 1 ? "Cohort" : "Cohorts"}`,
    metrics: [
      { label: "Top cohort", value: topCohort?.label ?? "None" },
      { label: "Weighted signals", value: String(totalScore) },
      { label: "Guardrails", value: String(totalGuardrails) },
      { label: "Bias", value: getFeedGovernorBiasMode(profile) },
    ],
    summary: `Reader profile leans ${
      topCohort?.label ?? "None"
    } with ${totalScore} weighted signals across ${activeCohortCount} active ${
      activeCohortCount === 1 ? "cohort" : "cohorts"
    }.`,
  };
};

const isCollaborativeNegativeMatch = ({
  item,
  negativeFeedbackItems,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
}) =>
  negativeFeedbackItems.some(
    (negativeItem) =>
      normalizePreferenceSignal(negativeItem.category) ===
        normalizePreferenceSignal(item.category) ||
      normalizePreferenceSignal(negativeItem.sourceSlug) ===
        normalizePreferenceSignal(item.sourceSlug) ||
      negativeItem.entities.some((negativeEntity) =>
        item.entities.some(
          (entity) =>
            normalizePreferenceSignal(negativeEntity) ===
            normalizePreferenceSignal(entity),
        ),
      ),
  );

const getCollaborativeStoryLiftScore = ({
  cohortScore,
  item,
}: {
  cohortScore: number;
  item: RankedNewsItem<NewsHomeItem>;
}) =>
  cohortScore * 2 +
  (item.trendScore >= 85 ? 4 : item.trendScore >= 75 ? 2 : 0) +
  (item.sourceScore >= 80 ? 2 : 0) +
  (item.matchedSignals.some((signal) => signal !== "exploration")
    ? 3
    : item.matchedSignals.includes("exploration")
      ? 1
      : 0);

const getCollaborativeLiftLabel = (liftScore: number) =>
  liftScore >= 16
    ? "High lift"
    : liftScore >= 10
      ? "Medium lift"
      : "Light lift";

export const getNewsCollaborativeSignals = ({
  formatCategory,
  historyItems,
  items,
  limit,
  negativeFeedbackItems,
  profile,
  savedItems,
}: {
  formatCategory: (category: string) => string;
  historyItems: readonly NewsReaderMemoryItem[];
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const storyLimit = Math.max(0, limit);
  const cohortReport = getNewsReaderCohorts({
    formatCategory,
    historyItems,
    limit: newsReaderCohortDefinitions.length,
    negativeFeedbackItems,
    profile,
    savedItems,
  });
  const cohortScores = new Map(
    cohortReport.cohorts
      .filter((cohort) => cohort.score > 0)
      .map((cohort) => [cohort.label, cohort.score]),
  );
  const activeCohortCount = cohortScores.size;
  const guardrailCount = cohortReport.cohorts.reduce(
    (sum, cohort) => sum + cohort.guardrailCount,
    0,
  );

  if (items.length === 0 || activeCohortCount === 0) {
    return {
      label: "Cold Signals",
      metrics: [
        { label: "Active cohorts", value: "0" },
        { label: "Candidate stories", value: "0" },
        { label: "Crowd heat", value: "0" },
        { label: "Guardrails", value: String(guardrailCount) },
      ],
      signals: [],
      summary:
        "Collaborative signals will appear after reader cohorts and ranked stories exist.",
    };
  }

  const signalStories = new Map<
    NewsReaderCohortLabel,
    {
      definition: NewsReaderCohortDefinition;
      liftScore: number;
      reason: string;
      story: RankedNewsItem<NewsHomeItem>;
    }[]
  >();

  for (const item of items) {
    if (isCollaborativeNegativeMatch({ item, negativeFeedbackItems })) continue;

    const definition = findNewsReaderCohortForItem(item);
    const cohortScore = definition ? cohortScores.get(definition.label) : 0;

    if (!definition || !cohortScore) continue;

    const liftScore = getCollaborativeStoryLiftScore({ cohortScore, item });
    const stories = signalStories.get(definition.label) ?? [];

    stories.push({
      definition,
      liftScore,
      reason: `Cohort match on ${formatCategory(
        item.category,
      )} with ${item.trendScore} trend.`,
      story: item,
    });
    signalStories.set(definition.label, stories);
  }

  const candidateStoryCount = Array.from(signalStories.values()).reduce(
    (sum, stories) => sum + stories.length,
    0,
  );
  const crowdHeatCount = Array.from(signalStories.values()).reduce(
    (sum, stories) =>
      sum + stories.filter(({ story }) => story.trendScore >= 80).length,
    0,
  );

  if (candidateStoryCount === 0) {
    return {
      label: "Cold Signals",
      metrics: [
        { label: "Active cohorts", value: String(activeCohortCount) },
        { label: "Candidate stories", value: "0" },
        { label: "Crowd heat", value: "0" },
        { label: "Guardrails", value: String(guardrailCount) },
      ],
      signals: [],
      summary:
        "Collaborative signals will appear after reader cohorts and ranked stories exist.",
    };
  }

  const signals = Array.from(signalStories.entries())
    .map(([label, stories]) => {
      const sortedStories = [...stories].sort((left, right) => {
        if (right.liftScore !== left.liftScore) {
          return right.liftScore - left.liftScore;
        }
        return left.story.title.localeCompare(right.story.title);
      });
      const [leadStory] = sortedStories;
      const definition = leadStory?.definition;
      const strongestLift = leadStory?.liftScore ?? 0;

      return {
        action: definition?.nextAction ?? "Keep testing adjacent coverage.",
        detail: `${label} can lift ${stories.length} ranked ${
          stories.length === 1 ? "story" : "stories"
        } from similar readers.`,
        label,
        liftLabel: getCollaborativeLiftLabel(strongestLift),
        stories: sortedStories
          .slice(0, storyLimit)
          .map(({ liftScore, reason, story }) => ({
            id: story.id,
            reason,
            scoreLabel: `${liftScore} lift`,
            sourceName: story.sourceName,
            title: story.title,
          })),
      };
    })
    .sort((left, right) => {
      const leftLift = Number(left.stories[0]?.scoreLabel.split(" ")[0] ?? 0);
      const rightLift = Number(right.stories[0]?.scoreLabel.split(" ")[0] ?? 0);

      if (rightLift !== leftLift) return rightLift - leftLift;
      return left.label.localeCompare(right.label);
    });
  const [leadSignal] = signals;
  const leadLift = leadSignal?.stories[0]?.scoreLabel ?? "0 lift";

  return {
    label: "Cohort Lift",
    metrics: [
      { label: "Active cohorts", value: String(activeCohortCount) },
      { label: "Candidate stories", value: String(candidateStoryCount) },
      { label: "Crowd heat", value: String(crowdHeatCount) },
      { label: "Guardrails", value: String(guardrailCount) },
    ],
    signals,
    summary: `${signals.length} cohort ${
      signals.length === 1 ? "signal can" : "signals can"
    } lift ${candidateStoryCount} ${
      candidateStoryCount === 1 ? "story" : "stories"
    }; ${leadSignal?.label ?? "No cohort"} leads with ${leadLift}.`,
  };
};

type NewsSessionIntentLabel =
  | "Builder Run"
  | "Lab Watch"
  | "Market Scan"
  | "Risk Check";

interface NewsSessionIntentDefinition {
  categories: readonly string[];
  entities: readonly string[];
  label: NewsSessionIntentLabel;
  nextAction: string;
  sources: readonly string[];
}

const newsSessionIntentDefinitions: readonly NewsSessionIntentDefinition[] = [
  {
    categories: ["agent_product", "open_source", "product_hunt"],
    entities: ["agents", "langchain", "hugging face", "developers"],
    label: "Builder Run",
    nextAction:
      "Lead with practical builder stories and keep one lab follow-up nearby.",
    sources: ["agent-desk", "oss-desk", "product-hunt"],
  },
  {
    categories: ["model_release", "research", "big_tech"],
    entities: ["openai", "anthropic", "deepmind", "google ai", "meta ai"],
    label: "Lab Watch",
    nextAction:
      "Lead with frontier model updates and pair them with evaluations.",
    sources: ["openai-news", "anthropic", "deepmind", "google-ai"],
  },
  {
    categories: ["funding", "market_map", "yc_ai"],
    entities: ["series a", "yc", "investors", "startup"],
    label: "Market Scan",
    nextAction:
      "Lead with market moves and keep product proof next to funding news.",
    sources: ["venturewire", "yc", "y-combinator"],
  },
  {
    categories: ["policy", "security", "hot_take", "musk_ai"],
    entities: ["policy", "security", "rumor", "xai"],
    label: "Risk Check",
    nextAction: "Keep risk coverage visible without amplifying noisy sources.",
    sources: ["rumor-feed", "policy-desk", "security-desk"],
  },
] as const;

interface NewsSessionIntentAccumulator {
  candidateItems: RankedNewsItem<NewsHomeItem>[];
  definition: NewsSessionIntentDefinition;
  evidence: string[];
  evidenceKeys: Set<string>;
  guardrailCount: number;
  score: number;
}

const createNewsSessionIntentAccumulators = () =>
  new Map<NewsSessionIntentLabel, NewsSessionIntentAccumulator>(
    newsSessionIntentDefinitions.map((definition) => [
      definition.label,
      {
        candidateItems: [],
        definition,
        evidence: [],
        evidenceKeys: new Set<string>(),
        guardrailCount: 0,
        score: 0,
      },
    ]),
  );

const findNewsSessionIntentForCategory = (category: string) =>
  newsSessionIntentDefinitions.find((definition) =>
    matchesNewsReaderCohortSignal(category, definition.categories),
  );

const findNewsSessionIntentForSource = (sourceSlug: string) =>
  newsSessionIntentDefinitions.find((definition) =>
    matchesNewsReaderCohortSignal(sourceSlug, definition.sources),
  );

const findNewsSessionIntentForEntity = (entity: string) =>
  newsSessionIntentDefinitions.find((definition) =>
    matchesNewsReaderCohortSignal(entity, definition.entities),
  );

const findNewsSessionIntentForItem = (item: NewsReaderMemoryItem) =>
  findNewsSessionIntentForCategory(item.category) ??
  findNewsSessionIntentForSource(item.sourceSlug) ??
  item.entities
    .map(findNewsSessionIntentForEntity)
    .find(
      (definition): definition is NewsSessionIntentDefinition =>
        definition !== undefined,
    );

const addNewsSessionIntentEvidence = (
  accumulator: NewsSessionIntentAccumulator,
  value: string,
) => {
  const evidence = value.trim();
  const evidenceKey = evidence.toLowerCase();

  if (!evidence || accumulator.evidenceKeys.has(evidenceKey)) return;

  accumulator.evidence.push(evidence);
  accumulator.evidenceKeys.add(evidenceKey);
};

const incrementNewsSessionIntentScore = ({
  accumulators,
  amount,
  definition,
}: {
  accumulators: Map<NewsSessionIntentLabel, NewsSessionIntentAccumulator>;
  amount: number;
  definition: NewsSessionIntentDefinition | undefined;
}) => {
  if (!definition) return;

  const accumulator = accumulators.get(definition.label);

  if (accumulator) accumulator.score += amount;
};

const isPersonalizedSessionCandidate = (item: RankedNewsItem<NewsHomeItem>) =>
  item.matchedSignals.some((signal) => signal !== "exploration");

const toNewsSessionLeadStory = (
  item: RankedNewsItem<NewsHomeItem> | undefined,
) =>
  item
    ? {
        id: item.id,
        sourceName: item.sourceName,
        title: item.title,
      }
    : null;

export const getNewsSessionIntent = ({
  formatCategory,
  historyItems,
  items,
  limit,
  negativeFeedbackItems,
  profile,
  savedItems,
}: {
  formatCategory: (category: string) => string;
  historyItems: readonly NewsReaderMemoryItem[];
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const accumulators = createNewsSessionIntentAccumulators();

  for (const category of normalizedProfile.preferredCategories) {
    const definition = findNewsSessionIntentForCategory(category);
    incrementNewsSessionIntentScore({ accumulators, amount: 1, definition });

    const accumulator = definition ? accumulators.get(definition.label) : null;
    if (accumulator) {
      addNewsSessionIntentEvidence(accumulator, formatCategory(category));
    }
  }

  for (const sourceSlug of normalizedProfile.preferredSources) {
    const definition = findNewsSessionIntentForSource(sourceSlug);
    incrementNewsSessionIntentScore({ accumulators, amount: 1, definition });

    const accumulator = definition ? accumulators.get(definition.label) : null;
    if (accumulator) addNewsSessionIntentEvidence(accumulator, sourceSlug);
  }

  for (const entity of normalizedProfile.preferredEntities) {
    const definition = findNewsSessionIntentForEntity(entity);
    incrementNewsSessionIntentScore({ accumulators, amount: 1, definition });

    const accumulator = definition ? accumulators.get(definition.label) : null;
    if (accumulator) addNewsSessionIntentEvidence(accumulator, entity);
  }

  for (const item of savedItems) {
    incrementNewsSessionIntentScore({
      accumulators,
      amount: 3,
      definition: findNewsSessionIntentForItem(item),
    });
  }

  for (const item of historyItems) {
    incrementNewsSessionIntentScore({
      accumulators,
      amount: 2,
      definition: findNewsSessionIntentForItem(item),
    });
  }

  for (const item of items) {
    if (!isPersonalizedSessionCandidate(item)) continue;

    const definition = findNewsSessionIntentForItem(item);
    const accumulator = definition ? accumulators.get(definition.label) : null;

    if (!accumulator) continue;

    accumulator.score += 1;
    accumulator.candidateItems.push(item);
  }

  for (const item of negativeFeedbackItems) {
    const definition = findNewsSessionIntentForItem(item);
    const accumulator = definition ? accumulators.get(definition.label) : null;

    if (!accumulator) continue;

    accumulator.guardrailCount += 1;
    addNewsSessionIntentEvidence(accumulator, formatCategory(item.category));
    addNewsSessionIntentEvidence(accumulator, item.sourceName);
  }

  const totalGuardrails = Array.from(accumulators.values()).reduce(
    (sum, accumulator) => sum + accumulator.guardrailCount,
    0,
  );
  const rankedIntents = Array.from(accumulators.values())
    .filter(
      (accumulator) => accumulator.score > 0 || accumulator.guardrailCount > 0,
    )
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.guardrailCount !== left.guardrailCount) {
        return right.guardrailCount - left.guardrailCount;
      }
      return left.definition.label.localeCompare(right.definition.label);
    });
  const [primaryIntent] = rankedIntents;

  if (!primaryIntent) {
    return {
      intents: [],
      label: "Cold Session",
      metrics: [
        { label: "Primary intent", value: "None" },
        { label: "Strength", value: "0" },
        { label: "Candidate stories", value: "0" },
        { label: "Guardrails", value: "0" },
      ],
      summary:
        "Session intent will appear after preference or behavior signals arrive.",
    };
  }

  const intents = rankedIntents.slice(0, limit).map((accumulator) => {
    const candidateItems = [...accumulator.candidateItems].sort(
      (left, right) => {
        if (right.personalizedScore !== left.personalizedScore) {
          return right.personalizedScore - left.personalizedScore;
        }

        if (right.trendScore !== left.trendScore) {
          return right.trendScore - left.trendScore;
        }

        return (
          new Date(right.publishedAt).getTime() -
          new Date(left.publishedAt).getTime()
        );
      },
    );

    return {
      candidateCount: candidateItems.length,
      evidence: accumulator.evidence.slice(0, 4),
      guardrailCount: accumulator.guardrailCount,
      label: accumulator.definition.label,
      leadStory: toNewsSessionLeadStory(candidateItems[0]),
      nextAction: accumulator.definition.nextAction,
      score: accumulator.score,
    };
  });
  const primaryCandidateCount = primaryIntent.candidateItems.length;

  return {
    intents,
    label: `${primaryIntent.definition.label.replace(/ Run$| Watch$| Scan$| Check$/, "")} Session`,
    metrics: [
      { label: "Primary intent", value: primaryIntent.definition.label },
      { label: "Strength", value: String(primaryIntent.score) },
      { label: "Candidate stories", value: String(primaryCandidateCount) },
      { label: "Guardrails", value: String(totalGuardrails) },
    ],
    summary: `Session intent is ${
      primaryIntent.definition.label
    } with ${primaryIntent.score} ${
      primaryIntent.score === 1 ? "signal" : "signals"
    }, ${primaryCandidateCount} candidate ${
      primaryCandidateCount === 1 ? "story" : "stories"
    }, and ${totalGuardrails} ${
      totalGuardrails === 1 ? "guardrail" : "guardrails"
    }.`,
  };
};

const getNewsProfileBiasDetail = (profile: NewsPreferenceProfile) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  if (normalizedProfile.noveltyBias > normalizedProfile.recencyBias) {
    return "Novelty is weighted above recency.";
  }

  if (normalizedProfile.recencyBias > normalizedProfile.noveltyBias) {
    return "Recency is weighted above novelty.";
  }

  return "Freshness and novelty are balanced.";
};

export const getNewsProfileSignalLedger = ({
  formatCategory,
  historyItems,
  negativeFeedbackItems,
  profile,
  savedItems,
}: {
  formatCategory: (category: string) => string;
  historyItems: readonly NewsReaderMemoryItem[];
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const explicitCount =
    normalizedProfile.preferredCategories.length +
    normalizedProfile.preferredSources.length +
    normalizedProfile.preferredEntities.length;
  const positiveBehaviorCount = savedItems.length + historyItems.length;
  const guardrailCount = negativeFeedbackItems.length;
  const hasLedgerSignals =
    explicitCount > 0 || positiveBehaviorCount > 0 || guardrailCount > 0;
  const explicitSignals = getUniqueSignals(
    [
      ...normalizedProfile.preferredCategories.map(formatCategory),
      ...normalizedProfile.preferredSources,
      ...normalizedProfile.preferredEntities,
    ],
    4,
  );
  const positiveSignals = getUniqueSignals(
    [...savedItems, ...historyItems].map((item) => item.title),
    4,
  );
  const guardrailSignals = getUniqueSignals(
    negativeFeedbackItems.flatMap((item) => [
      item.title,
      formatCategory(item.category),
      item.sourceName,
    ]),
    4,
  );

  return {
    entries: [
      {
        count: explicitCount,
        detail:
          explicitCount > 0
            ? `${normalizedProfile.preferredCategories.length} ${
                normalizedProfile.preferredCategories.length === 1
                  ? "topic"
                  : "topics"
              }, ${normalizedProfile.preferredSources.length} ${
                normalizedProfile.preferredSources.length === 1
                  ? "source"
                  : "sources"
              }, and ${normalizedProfile.preferredEntities.length} ${
                normalizedProfile.preferredEntities.length === 1
                  ? "entity is"
                  : "entities are"
              } active.`
            : "No explicit topics, sources, or entities are active.",
        effect:
          explicitCount > 0 ? "Boosts matching stories" : "No direct boost yet",
        label: "Explicit profile",
        signals: explicitSignals,
        source: "Reader controls",
      },
      {
        count: positiveBehaviorCount,
        detail:
          positiveBehaviorCount > 0
            ? `${savedItems.length} saved ${
                savedItems.length === 1 ? "story" : "stories"
              } and ${historyItems.length} ${
                historyItems.length === 1 ? "read is" : "reads are"
              } feeding the profile.`
            : "No saves or reads have been recorded in this session.",
        effect:
          positiveBehaviorCount > 0
            ? "Raises related coverage"
            : "No behavior lift yet",
        label: "Positive behavior",
        signals: positiveSignals,
        source: "Reads and saves",
      },
      {
        count: guardrailCount,
        detail:
          guardrailCount > 0
            ? `${guardrailCount} hidden ${
                guardrailCount === 1 ? "story is" : "stories are"
              } acting as ${
                guardrailCount === 1 ? "a guardrail" : "guardrails"
              }.`
            : "No Less feedback is currently guarding the feed.",
        effect:
          guardrailCount > 0
            ? "Demotes similar coverage"
            : "No demotion guard yet",
        label: "Negative feedback",
        signals: guardrailSignals,
        source: "Less feedback",
      },
      {
        count: 2,
        detail: getNewsProfileBiasDetail(normalizedProfile),
        effect: "Tunes ranking balance",
        label: "Bias tuning",
        signals: [
          `Novelty ${normalizedProfile.noveltyBias}`,
          `Recency ${normalizedProfile.recencyBias}`,
        ],
        source: "Ranking sliders",
      },
    ],
    label: hasLedgerSignals ? "Transparent Ledger" : "Cold Ledger",
    metrics: [
      { label: "Explicit", value: String(explicitCount) },
      { label: "Positive behavior", value: String(positiveBehaviorCount) },
      { label: "Guardrails", value: String(guardrailCount) },
      { label: "Bias", value: getFeedGovernorBiasMode(normalizedProfile) },
    ],
    summary: hasLedgerSignals
      ? `Profile ledger has ${explicitCount} explicit ${
          explicitCount === 1 ? "signal" : "signals"
        }, ${positiveBehaviorCount} positive behavior ${
          positiveBehaviorCount === 1 ? "signal" : "signals"
        }, and ${guardrailCount} ${
          guardrailCount === 1 ? "guardrail" : "guardrails"
        }.`
      : "Profile ledger is waiting for explicit preferences or behavior signals.",
  };
};

const countInterestDriftSignals = (
  values: readonly string[],
): { count: number; value: string } | null => getTopMemorySignal(values);

export const getNewsInterestDrift = ({
  formatCategory,
  historyItems,
  negativeFeedbackItems,
  profile,
  savedItems,
}: {
  formatCategory: (category: string) => string;
  historyItems: readonly NewsReaderMemoryItem[];
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const activeSignalCount =
    normalizedProfile.preferredCategories.length +
    normalizedProfile.preferredSources.length +
    normalizedProfile.preferredEntities.length;
  const positiveItems = [...savedItems, ...historyItems];
  const positiveDriftCount = positiveItems.length;
  const hasNegativeTopics = negativeFeedbackItems.length > 0;
  const hasNegativeSources = negativeFeedbackItems.length > 0;
  const hasNegativeEntities = negativeFeedbackItems.some(
    (item) => item.entities.length > 0,
  );
  const guardedSignalCount =
    (hasNegativeTopics ? 1 : 0) +
    (hasNegativeSources ? 1 : 0) +
    (hasNegativeEntities ? 1 : 0);
  const topPositiveTopic = countInterestDriftSignals(
    positiveItems.map((item) => item.category),
  );
  const topPositiveSource = countInterestDriftSignals(
    positiveItems.map((item) => item.sourceName),
  );
  const topNegativeItem = negativeFeedbackItems[0];
  const direction = topPositiveTopic
    ? formatCategory(topPositiveTopic.value)
    : (topPositiveSource?.value ?? "None");

  if (positiveDriftCount === 0 && guardedSignalCount === 0) {
    return {
      label: "No Drift",
      metrics: [
        { label: "Active signals", value: String(activeSignalCount) },
        { label: "Positive drift", value: "0" },
        { label: "Guarded signals", value: "0" },
        { label: "Direction", value: "None" },
      ],
      notices: [
        {
          detail:
            "Save, read, or press Less to create a measurable profile drift.",
          label: "No behavior yet",
        },
      ],
      summary: "Interest drift will appear after reader behavior arrives.",
    };
  }

  const notices: { detail: string; label: string }[] = [];

  if (topPositiveTopic) {
    notices.push({
      detail: `${formatCategory(topPositiveTopic.value)} leads recent saves and reads with ${topPositiveTopic.count} weighted signals.`,
      label: "Topic drift",
    });
  }

  if (topPositiveSource) {
    notices.push({
      detail: `${topPositiveSource.value} is gaining weight from ${topPositiveSource.count} saved/read interactions.`,
      label: "Source drift",
    });
  }

  if (topNegativeItem) {
    notices.push({
      detail: `Less feedback is guarding against ${formatCategory(
        topNegativeItem.category,
      )} from ${topNegativeItem.sourceName}.`,
      label: "Guardrail",
    });
  }

  return {
    label:
      positiveDriftCount > 0 && guardedSignalCount > 0
        ? "Drifting"
        : positiveDriftCount > 0
          ? "Learning"
          : "Guarding",
    metrics: [
      { label: "Active signals", value: String(activeSignalCount) },
      { label: "Positive drift", value: String(positiveDriftCount) },
      { label: "Guarded signals", value: String(guardedSignalCount) },
      { label: "Direction", value: direction },
    ],
    notices,
    summary:
      positiveDriftCount > 0
        ? `Recent behavior is pulling the profile toward ${direction} while guarding ${guardedSignalCount} negative signals.`
        : `Less feedback is guarding ${guardedSignalCount} negative signals before positive drift arrives.`,
  };
};

type NewsReaderLearningLoopActionKey =
  | "balance"
  | "dampen"
  | "explore"
  | "reinforce";

interface NewsReaderLearningLoopAction {
  detail: string;
  key: NewsReaderLearningLoopActionKey;
  label: string;
  signalLabel: string;
  statusLabel: string;
  title: string;
}

const getReaderLearningProfileSignalCount = (profile: NewsPreferenceProfile) =>
  profile.preferredCategories.length +
  profile.preferredEntities.length +
  profile.preferredSources.length;

const getReaderLearningExplorationCandidate = (
  items: readonly RankedNewsItem<NewsHomeItem>[],
) =>
  [...items]
    .filter((item) => item.matchedSignals.includes("exploration"))
    .sort((left, right) => {
      const leftScore = left.trendScore + left.sourceScore;
      const rightScore = right.trendScore + right.sourceScore;

      if (rightScore !== leftScore) return rightScore - leftScore;

      return right.personalizedScore - left.personalizedScore;
    })[0];

const getReaderLearningReinforceAction = ({
  formatCategory,
  positiveItems,
}: {
  formatCategory: (category: string) => string;
  positiveItems: readonly NewsReaderMemoryItem[];
}): NewsReaderLearningLoopAction | null => {
  const topTopic = getTopMemorySignal(
    positiveItems.map((item) => item.category),
  );

  if (!topTopic) return null;

  const topicLabel = formatCategory(topTopic.value);

  return {
    detail: `${topTopic.count} reads/saves are teaching the feed to lift ${topicLabel}.`,
    key: "reinforce",
    label: "Reinforce",
    signalLabel: `${topTopic.count} positive ${
      topTopic.count === 1 ? "signal" : "signals"
    }`,
    statusLabel: "Lift",
    title: topicLabel,
  };
};

const getReaderLearningExploreAction = ({
  formatCategory,
  item,
}: {
  formatCategory: (category: string) => string;
  item: RankedNewsItem<NewsHomeItem> | undefined;
}): NewsReaderLearningLoopAction | null => {
  if (!item) return null;

  return {
    detail: "Exploration candidate tests adjacent reader interest.",
    key: "explore",
    label: "Explore",
    signalLabel: `${item.trendScore} heat / ${item.sourceScore} trust`,
    statusLabel: "Test",
    title: formatCategory(item.category),
  };
};

const getReaderLearningDampenAction = ({
  formatCategory,
  negativeFeedbackItems,
}: {
  formatCategory: (category: string) => string;
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
}): NewsReaderLearningLoopAction | null => {
  const [negativeItem] = negativeFeedbackItems;
  if (!negativeItem) return null;

  const categoryLabel = formatCategory(negativeItem.category);

  return {
    detail: `Less feedback guards against similar ${categoryLabel} stories.`,
    key: "dampen",
    label: "Dampen",
    signalLabel: `${negativeFeedbackItems.length} ${
      negativeFeedbackItems.length === 1 ? "guardrail" : "guardrails"
    }`,
    statusLabel: "Guard",
    title: categoryLabel,
  };
};

const getReaderLearningBalanceAction = (
  profile: NewsPreferenceProfile,
): NewsReaderLearningLoopAction | null => {
  const profileSignalCount = getReaderLearningProfileSignalCount(profile);
  if (profileSignalCount === 0) return null;

  return {
    detail: `${profileSignalCount} explicit ${
      profileSignalCount === 1 ? "signal" : "signals"
    } keep the ranking anchored.`,
    key: "balance",
    label: "Balance",
    signalLabel: `novelty ${profile.noveltyBias} / recency ${profile.recencyBias}`,
    statusLabel: "Anchor",
    title: "Profile balance",
  };
};

export const getNewsReaderLearningLoop = ({
  formatCategory,
  historyItems,
  items,
  negativeFeedbackItems,
  profile,
  savedItems,
}: {
  formatCategory: (category: string) => string;
  historyItems: readonly NewsReaderMemoryItem[];
  items: readonly RankedNewsItem<NewsHomeItem>[];
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const positiveItems = [...historyItems, ...savedItems];
  const explorationItems = items.filter((item) =>
    item.matchedSignals.includes("exploration"),
  );
  const profileSignalCount = getReaderLearningProfileSignalCount(profile);
  const actions = [
    getReaderLearningReinforceAction({ formatCategory, positiveItems }),
    getReaderLearningExploreAction({
      formatCategory,
      item: getReaderLearningExplorationCandidate(items),
    }),
    getReaderLearningDampenAction({ formatCategory, negativeFeedbackItems }),
    getReaderLearningBalanceAction(profile),
  ].filter((action): action is NewsReaderLearningLoopAction => action !== null);

  return {
    actions,
    label:
      actions.length > 0 ? "Learning Loop Active" : "Learning Loop Waiting",
    metrics: [
      { label: "Positive", value: String(positiveItems.length) },
      { label: "Guardrails", value: String(negativeFeedbackItems.length) },
      { label: "Explore", value: String(explorationItems.length) },
      {
        label: "Profile",
        value: `${profileSignalCount} ${
          profileSignalCount === 1 ? "signal" : "signals"
        }`,
      },
    ],
    summary:
      actions.length > 0
        ? `${actions.length} learning ${
            actions.length === 1 ? "action" : "actions"
          } combine ${positiveItems.length} positive ${
            positiveItems.length === 1 ? "signal" : "signals"
          }, ${negativeFeedbackItems.length} ${
            negativeFeedbackItems.length === 1 ? "guardrail" : "guardrails"
          }, and ${explorationItems.length} exploration ${
            explorationItems.length === 1 ? "candidate" : "candidates"
          }.`
        : "Reader learning loop will appear after behavior or ranked stories.",
  };
};

export const getNewsServerProfileAuditDisplay = (
  audit: NewsServerProfileAudit | undefined,
) => {
  if (!audit) {
    return {
      chips: [],
      label: "Server Waiting",
      metrics: [
        { label: "Trained", value: "0" },
        { label: "Ignored", value: "0" },
        { label: "Hidden", value: "0" },
      ],
      summary:
        "Server-side profile learning will appear after saved stories, reads, source clicks, or Less feedback sync.",
    };
  }

  const chips = [
    ...audit.topCategories.slice(0, 2),
    ...audit.topSources.slice(0, 1),
    ...(audit.topTags ?? []).slice(0, 1),
    ...audit.topMatchedSignals.slice(0, 1),
  ].map((signal) => `${signal.key} ${signal.count}`);
  const metrics = [
    { label: "Trained", value: String(audit.trainedSignalCount) },
    { label: "Ignored", value: String(audit.ignoredSignalCount) },
    { label: "Hidden", value: String(audit.negativeSignalCount) },
  ];

  if (audit.averageHomeRankSlot !== null) {
    metrics.push({
      label: "Avg slot",
      value: audit.averageHomeRankSlot.toFixed(1),
    });
  }

  return {
    chips,
    label: audit.trainedSignalCount > 0 ? "Server Learned" : "Server Waiting",
    metrics,
    summary: audit.summary,
  };
};

interface NewsFeedbackSignalDelta {
  added: string[];
  removed: string[];
}

const getNormalizedSignalMap = (values: readonly string[]) => {
  const signalsByKey = new Map<string, string>();

  for (const value of values) {
    const signal = value.trim();
    const normalizedSignal = signal.toLowerCase();

    if (!signal || signalsByKey.has(normalizedSignal)) continue;

    signalsByKey.set(normalizedSignal, signal);
  }

  return signalsByKey;
};

const getFeedbackSignalDelta = ({
  after,
  before,
}: {
  after: readonly string[];
  before: readonly string[];
}): NewsFeedbackSignalDelta => {
  const beforeSignals = getNormalizedSignalMap(before);
  const afterSignals = getNormalizedSignalMap(after);

  return {
    added: Array.from(afterSignals.entries())
      .filter(([key]) => !beforeSignals.has(key))
      .map(([, value]) => value),
    removed: Array.from(beforeSignals.entries())
      .filter(([key]) => !afterSignals.has(key))
      .map(([, value]) => value),
  };
};

const formatFeedbackBiasShift = (
  beforeProfile: NewsPreferenceProfile,
  afterProfile: NewsPreferenceProfile,
) => {
  const delta =
    afterProfile.noveltyBias +
    afterProfile.recencyBias -
    beforeProfile.noveltyBias -
    beforeProfile.recencyBias;
  const roundedDelta = Math.round(delta * 10) / 10;

  if (Object.is(roundedDelta, -0) || roundedDelta === 0) return "0.0";

  return `${roundedDelta > 0 ? "+" : ""}${roundedDelta.toFixed(1)}`;
};

const feedbackActionLabels = {
  click_source: "Source click",
  hide: "Less",
  save: "Save",
  share: "Share",
  view: "Read",
} as const satisfies Record<ReaderInteractionAction, string>;

export const shouldTrainNewsHomeProfileFromAction = (
  action: ReaderInteractionAction,
) => action !== "view";

export const getNewsFeedbackTrainingUpdate = ({
  action,
  afterProfile,
  beforeProfile,
  formatCategory,
  item,
}: {
  action: ReaderInteractionAction;
  afterProfile: NewsPreferenceProfile;
  beforeProfile: NewsPreferenceProfile;
  formatCategory: (category: string) => string;
  item: NewsHomeItem;
}) => {
  const categoryDelta = getFeedbackSignalDelta({
    after: afterProfile.preferredCategories,
    before: beforeProfile.preferredCategories,
  });
  const sourceDelta = getFeedbackSignalDelta({
    after: afterProfile.preferredSources,
    before: beforeProfile.preferredSources,
  });
  const entityDelta = getFeedbackSignalDelta({
    after: afterProfile.preferredEntities,
    before: beforeProfile.preferredEntities,
  });
  const isNegativeFeedback = action === "hide";
  const selectedCategories = isNegativeFeedback
    ? categoryDelta.removed
    : categoryDelta.added;
  const selectedSources = isNegativeFeedback
    ? sourceDelta.removed
    : sourceDelta.added;
  const selectedEntities = isNegativeFeedback
    ? entityDelta.removed
    : entityDelta.added;
  const metricPrefix = isNegativeFeedback ? "Removed" : "New";
  const signals: { label: string; value: string }[] = [];

  if (selectedCategories.length > 0) {
    signals.push({
      label: "Topic",
      value: selectedCategories.map(formatCategory).join(", "),
    });
  }

  if (selectedSources.length > 0) {
    signals.push({
      label: "Source",
      value: selectedSources
        .map((source) =>
          source.toLowerCase() === item.sourceSlug.toLowerCase()
            ? item.sourceName
            : source,
        )
        .join(", "),
    });
  }

  if (selectedEntities.length > 0) {
    signals.push({
      label: "Entities",
      value: selectedEntities.join(", "),
    });
  }

  if (signals.length === 0) {
    signals.push({
      label: "Signals",
      value: "No profile change",
    });
  }

  return {
    label: isNegativeFeedback ? "Negative Signal" : "Positive Signal",
    metrics: [
      {
        label: `${metricPrefix} topics`,
        value: String(selectedCategories.length),
      },
      {
        label: `${metricPrefix} sources`,
        value: String(selectedSources.length),
      },
      {
        label: `${metricPrefix} entities`,
        value: String(selectedEntities.length),
      },
      {
        label: "Bias shift",
        value: formatFeedbackBiasShift(beforeProfile, afterProfile),
      },
    ],
    notices: [
      isNegativeFeedback
        ? {
            detail: "Stories matching removed signals will be dampened.",
            label: "Profile guard",
          }
        : {
            detail: "Future stories matching these signals will rank higher.",
            label: "Profile memory",
          },
    ],
    signals,
    summary: `${feedbackActionLabels[action]} trained the feed ${
      isNegativeFeedback ? "away from" : "toward"
    } ${formatCategory(item.category)} from ${item.sourceName}.`,
  };
};

export const getNewsReaderMemoryResetTrainingUpdate = ({
  persisted = true,
}: {
  persisted?: boolean;
} = {}) =>
  persisted
    ? {
        label: "Memory Reset",
        metrics: [
          { label: "Profile", value: "Default" },
          { label: "Saved", value: "Cleared" },
          { label: "History", value: "Cleared" },
          { label: "Guardrails", value: "Cleared" },
        ],
        notices: [
          {
            detail:
              "For You will restart from default AI topics and learn again from new reads, saves, source clicks, and Less feedback.",
            label: "Fresh training loop",
          },
        ],
        signals: [
          { label: "Topics", value: "Models, Agents, Funding" },
          { label: "Sources", value: "No saved sources" },
          { label: "Entities", value: "No saved entities" },
        ],
        summary:
          "Reader memory was reset across profile, saved stories, reading history, and feedback guardrails.",
      }
    : {
        label: "Local Reset",
        metrics: [
          { label: "Profile", value: "Default" },
          { label: "Saved", value: "Not synced" },
          { label: "History", value: "Not synced" },
          { label: "Guardrails", value: "Local only" },
        ],
        notices: [
          {
            detail:
              "This device profile was reset locally. Server memory will clear once a reader key and live API are available.",
            label: "Local training loop",
          },
        ],
        signals: [
          { label: "Topics", value: "Models, Agents, Funding" },
          { label: "Sources", value: "No local sources" },
          { label: "Entities", value: "No local entities" },
        ],
        summary:
          "Local reader memory was reset; persisted saved stories, reading history, and feedback guardrails were not contacted.",
      };

export const getNewsReaderMemoryResetPersistence = ({
  canPersistProfile,
  resetFailed = false,
  visitorKey,
}: {
  canPersistProfile: boolean;
  resetFailed?: boolean;
  visitorKey: string | null;
}) => Boolean(visitorKey) && canPersistProfile && !resetFailed;

type NewsPreferenceStarterKind = "category" | "entity" | "source" | "tag";

interface NewsPreferenceStarterSuggestion {
  actionLabel: string;
  kind: NewsPreferenceStarterKind;
  label: string;
  reason: string;
  signal: string;
}

interface NewsPreferenceStarterEntry {
  firstIndex: number;
  label: string;
  signal: string;
  signalCount: number;
  supportKeys: Set<string>;
  trendScore: number;
}

const getPreferenceStarterMetrics = ({
  entityCount,
  sourceCount,
  tagCount,
  topicCount,
}: {
  entityCount: number;
  sourceCount: number;
  tagCount: number;
  topicCount: number;
}) => [
  {
    label: "Suggestions",
    value: String(topicCount + sourceCount + entityCount + tagCount),
  },
  { label: "New topics", value: String(topicCount) },
  { label: "New sources", value: String(sourceCount) },
  { label: "New entities", value: String(entityCount) },
  { label: "New angles", value: String(tagCount) },
];

const normalizePreferenceSignal = (value: string) => value.trim().toLowerCase();

const hasPreferenceSignal = (values: readonly string[], value: string) => {
  const normalizedValue = normalizePreferenceSignal(value);

  return values.some(
    (signal) => normalizePreferenceSignal(signal) === normalizedValue,
  );
};

const formatStarterStoryCount = (count: number) =>
  `${count} ${count === 1 ? "story" : "stories"}`;

const formatStarterSourceCount = (count: number) =>
  `${count} ${count === 1 ? "source" : "sources"}`;

const formatStarterTopicCount = (count: number) =>
  `${count} ${count === 1 ? "topic" : "topics"}`;

const compareStarterEntries = (
  left: NewsPreferenceStarterEntry,
  right: NewsPreferenceStarterEntry,
) => {
  if (right.signalCount !== left.signalCount) {
    return right.signalCount - left.signalCount;
  }

  if (right.supportKeys.size !== left.supportKeys.size) {
    return right.supportKeys.size - left.supportKeys.size;
  }

  const leftTrendScore = left.trendScore / Math.max(left.signalCount, 1);
  const rightTrendScore = right.trendScore / Math.max(right.signalCount, 1);

  if (rightTrendScore !== leftTrendScore) {
    return rightTrendScore - leftTrendScore;
  }

  if (left.firstIndex !== right.firstIndex) {
    return left.firstIndex - right.firstIndex;
  }

  return left.label.localeCompare(right.label);
};

const upsertPreferenceStarterEntry = ({
  firstIndex,
  label,
  signal,
  store,
  supportKey,
  trendScore,
}: {
  firstIndex: number;
  label: string;
  signal: string;
  store: Map<string, NewsPreferenceStarterEntry>;
  supportKey: string;
  trendScore: number;
}) => {
  const normalizedSignal = normalizePreferenceSignal(signal);
  const entryLabel = label.trim();
  const entrySignal = signal.trim();

  if (!normalizedSignal || !entryLabel || !entrySignal) return;

  const existing = store.get(normalizedSignal);

  if (!existing) {
    store.set(normalizedSignal, {
      firstIndex,
      label: entryLabel,
      signal: entrySignal,
      signalCount: 1,
      supportKeys: new Set([supportKey]),
      trendScore,
    });
    return;
  }

  existing.signalCount += 1;
  existing.supportKeys.add(supportKey);
  existing.trendScore += trendScore;
};

export const getNewsPreferenceStarter = ({
  formatCategory,
  items,
  profile,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  profile: NewsPreferenceProfile;
}) => {
  if (items.length === 0) {
    return {
      groups: [],
      label: "Waiting",
      metrics: getPreferenceStarterMetrics({
        entityCount: 0,
        sourceCount: 0,
        tagCount: 0,
        topicCount: 0,
      }),
      summary: "Preference starter will appear as stories load.",
    };
  }

  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const categoryEntries = new Map<string, NewsPreferenceStarterEntry>();
  const sourceEntries = new Map<string, NewsPreferenceStarterEntry>();
  const entityEntries = new Map<string, NewsPreferenceStarterEntry>();
  const tagEntries = new Map<string, NewsPreferenceStarterEntry>();

  items.forEach((item, index) => {
    if (
      !hasPreferenceSignal(normalizedProfile.preferredCategories, item.category)
    ) {
      upsertPreferenceStarterEntry({
        firstIndex: index,
        label: formatCategory(item.category),
        signal: item.category,
        store: categoryEntries,
        supportKey: item.sourceSlug,
        trendScore: item.trendScore,
      });
    }

    if (
      !hasPreferenceSignal(normalizedProfile.preferredSources, item.sourceSlug)
    ) {
      upsertPreferenceStarterEntry({
        firstIndex: index,
        label: item.sourceName,
        signal: item.sourceSlug,
        store: sourceEntries,
        supportKey: item.category,
        trendScore: item.trendScore,
      });
    }

    const seenEntities = new Set<string>();

    item.entities.forEach((entity, entityIndex) => {
      const normalizedEntity = normalizePreferenceSignal(entity);

      if (
        !normalizedEntity ||
        seenEntities.has(normalizedEntity) ||
        hasPreferenceSignal(normalizedProfile.preferredEntities, entity)
      ) {
        return;
      }

      seenEntities.add(normalizedEntity);

      upsertPreferenceStarterEntry({
        firstIndex: index * 100 + entityIndex,
        label: entity,
        signal: entity,
        store: entityEntries,
        supportKey: item.sourceSlug,
        trendScore: item.trendScore,
      });
    });

    const seenTags = new Set<string>();

    item.tags.forEach((tag, tagIndex) => {
      const normalizedTag = normalizePreferenceSignal(tag);

      if (
        !normalizedTag ||
        seenTags.has(normalizedTag) ||
        hasPreferenceSignal(normalizedProfile.preferredEntities, tag)
      ) {
        return;
      }

      seenTags.add(normalizedTag);

      upsertPreferenceStarterEntry({
        firstIndex: index * 100 + tagIndex,
        label: tag,
        signal: tag,
        store: tagEntries,
        supportKey: item.sourceSlug,
        trendScore: item.trendScore,
      });
    });
  });

  const topicSuggestions = Array.from(categoryEntries.values())
    .sort(compareStarterEntries)
    .slice(0, 2)
    .map(
      (entry): NewsPreferenceStarterSuggestion => ({
        actionLabel: "Follow topic",
        kind: "category",
        label: entry.label,
        reason: `${formatStarterStoryCount(entry.signalCount)} from ${formatStarterSourceCount(
          entry.supportKeys.size,
        )} ${entry.signalCount === 1 ? "is" : "are"} active in ${entry.label}.`,
        signal: entry.signal,
      }),
    );
  const sourceSuggestions = Array.from(sourceEntries.values())
    .sort(compareStarterEntries)
    .slice(0, 2)
    .map(
      (entry): NewsPreferenceStarterSuggestion => ({
        actionLabel: "Follow source",
        kind: "source",
        label: entry.label,
        reason: `${formatStarterStoryCount(entry.signalCount)} across ${formatStarterTopicCount(
          entry.supportKeys.size,
        )} ${entry.signalCount === 1 ? "is" : "are"} coming from ${entry.label}.`,
        signal: entry.signal,
      }),
    );
  const entitySuggestions = Array.from(entityEntries.values())
    .sort(compareStarterEntries)
    .slice(0, 2)
    .map(
      (entry): NewsPreferenceStarterSuggestion => ({
        actionLabel: "Follow entity",
        kind: "entity",
        label: entry.label,
        reason: `${formatStarterStoryCount(entry.signalCount)} from ${formatStarterSourceCount(
          entry.supportKeys.size,
        )} ${entry.signalCount === 1 ? "mentions" : "mention"} ${entry.label}.`,
        signal: entry.signal,
      }),
    );
  const tagSuggestions = Array.from(tagEntries.values())
    .sort(compareStarterEntries)
    .slice(0, 2)
    .map(
      (entry): NewsPreferenceStarterSuggestion => ({
        actionLabel: "Follow angle",
        kind: "tag",
        label: entry.label,
        reason: `${formatStarterStoryCount(entry.signalCount)} from ${formatStarterSourceCount(
          entry.supportKeys.size,
        )} ${
          entry.signalCount === 1 ? "carries" : "carry"
        } the ${entry.label} angle.`,
        signal: entry.signal,
      }),
    );
  const groups = [
    { label: "Topics", suggestions: topicSuggestions },
    { label: "Sources", suggestions: sourceSuggestions },
    { label: "Entities", suggestions: entitySuggestions },
    { label: "Angles", suggestions: tagSuggestions },
  ].filter((group) => group.suggestions.length > 0);
  const suggestionCount =
    topicSuggestions.length +
    sourceSuggestions.length +
    entitySuggestions.length +
    tagSuggestions.length;

  return {
    groups,
    label: suggestionCount > 0 ? "Starter Picks" : "Profile Covered",
    metrics: getPreferenceStarterMetrics({
      entityCount: entitySuggestions.length,
      sourceCount: sourceSuggestions.length,
      tagCount: tagSuggestions.length,
      topicCount: topicSuggestions.length,
    }),
    summary:
      suggestionCount > 0
        ? `${suggestionCount} preference ${
            suggestionCount === 1 ? "starter" : "starters"
          } can seed the For You model from ${items.length} ranked ${
            items.length === 1 ? "story" : "stories"
          }.`
        : "The current profile already covers active story signals.",
  };
};

type NewsPreferenceControlSignalKind = "category" | "entity" | "source";

const toPreferenceControlSignal = ({
  kind,
  label,
  signal,
}: {
  kind: NewsPreferenceControlSignalKind;
  label: string;
  signal: string;
}) => ({
  kind,
  label,
  signal,
});

const formatPreferenceControlBias = (value: number) =>
  `${Math.round(value * 10) / 10}/2`;

export const getNewsPreferenceControlPanel = ({
  formatCategory,
  profile,
}: {
  formatCategory: (category: string) => string;
  profile: NewsPreferenceProfile;
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const topicCount = normalizedProfile.preferredCategories.length;
  const sourceCount = normalizedProfile.preferredSources.length;
  const entityCount = normalizedProfile.preferredEntities.length;
  const activeSignalCount = topicCount + sourceCount + entityCount;
  const biasMode = getFeedGovernorBiasMode(normalizedProfile);

  return {
    biasControls: [
      {
        detail: "Ranks newer stories higher.",
        key: "recencyBias",
        label: "Fresh",
        value: formatPreferenceControlBias(normalizedProfile.recencyBias),
      },
      {
        detail: "Keeps adjacent topics in the feed.",
        key: "noveltyBias",
        label: "Novel",
        value: formatPreferenceControlBias(normalizedProfile.noveltyBias),
      },
    ],
    groups: [
      {
        emptyLabel: "No topics followed",
        key: "categories",
        label: "Topics",
        signals: normalizedProfile.preferredCategories.map((category) =>
          toPreferenceControlSignal({
            kind: "category",
            label: formatCategory(category),
            signal: category,
          }),
        ),
      },
      {
        emptyLabel: "No sources followed",
        key: "sources",
        label: "Sources",
        signals: normalizedProfile.preferredSources.map((source) =>
          toPreferenceControlSignal({
            kind: "source",
            label: source,
            signal: source,
          }),
        ),
      },
      {
        emptyLabel: "No entities followed",
        key: "entities",
        label: "Entities",
        signals: normalizedProfile.preferredEntities.map((entity) =>
          toPreferenceControlSignal({
            kind: "entity",
            label: entity,
            signal: entity,
          }),
        ),
      },
    ],
    label: activeSignalCount > 0 ? "Manual Controls" : "Control Ready",
    metrics: [
      { label: "Signals", value: String(activeSignalCount) },
      { label: "Topics", value: String(topicCount) },
      { label: "Sources", value: String(sourceCount) },
      { label: "Bias", value: biasMode },
    ],
    summary:
      activeSignalCount > 0
        ? `Manual controls expose ${activeSignalCount} active preference ${
            activeSignalCount === 1 ? "signal" : "signals"
          } with ${biasMode} ranking bias.`
        : "Manual controls are ready. Follow topics, sources, or entities to steer For You.",
  };
};

type NewsPreferencePresetSignalKind = "category" | "entity" | "source";

interface NewsPreferencePresetDefinition {
  categories: readonly string[];
  entityLimit: number;
  key: string;
  label: string;
  sourceLimit: number;
  summary: string;
}

const newsPreferencePresetDefinitions: readonly NewsPreferencePresetDefinition[] =
  [
    {
      categories: ["model_release", "research"],
      entityLimit: 3,
      key: "frontier_labs",
      label: "Frontier Labs",
      sourceLimit: 1,
      summary: "Follow frontier model and research coverage from OpenAI News.",
    },
    {
      categories: ["agent_product", "open_source", "product_hunt"],
      entityLimit: 3,
      key: "builder_watch",
      label: "Builder Watch",
      sourceLimit: 1,
      summary: "Follow agent products and builder tooling signals.",
    },
    {
      categories: ["funding", "market_map", "yc_ai"],
      entityLimit: 3,
      key: "market_signals",
      label: "Market Signals",
      sourceLimit: 1,
      summary: "Follow funding, startup, and AI market movement.",
    },
    {
      categories: ["policy", "security"],
      entityLimit: 3,
      key: "risk_watch",
      label: "Risk Watch",
      sourceLimit: 1,
      summary: "Follow policy, safety, and security coverage.",
    },
  ] as const;

const uniquePresetValues = <TValue>({
  getKey,
  limit,
  values,
}: {
  getKey: (value: TValue) => string;
  limit: number;
  values: readonly TValue[];
}) => {
  const seenKeys = new Set<string>();
  const uniqueValues: TValue[] = [];

  for (const value of values) {
    const key = normalizePreferenceSignal(getKey(value));

    if (!key || seenKeys.has(key)) continue;

    seenKeys.add(key);
    uniqueValues.push(value);

    if (uniqueValues.length >= limit) break;
  }

  return uniqueValues;
};

const createNewsPreferencePresetSignal = ({
  active,
  kind,
  label,
  signal,
}: {
  active: boolean;
  kind: NewsPreferencePresetSignalKind;
  label: string;
  signal: string;
}) => ({
  active,
  kind,
  label,
  signal,
});

const getPresetCoverageLabel = (count: number) =>
  `${count} ${count === 1 ? "story" : "stories"}`;

export const getNewsPreferencePresets = ({
  formatCategory,
  items,
  limit,
  profile,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  profile: NewsPreferenceProfile;
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const activeSignalCount =
    normalizedProfile.preferredCategories.length +
    normalizedProfile.preferredSources.length +
    normalizedProfile.preferredEntities.length;

  if (items.length === 0) {
    return {
      label: "Preset Waiting",
      metrics: [
        { label: "Presets", value: "0" },
        { label: "Stories", value: "0" },
        { label: "New signals", value: "0" },
        { label: "Active signals", value: String(activeSignalCount) },
      ],
      presets: [],
      summary: "Preference presets will appear after stories are ranked.",
    };
  }

  const presets = newsPreferencePresetDefinitions
    .map((definition) => {
      const coverageItems = items.filter((item) =>
        definition.categories.includes(item.category),
      );

      if (coverageItems.length === 0) return null;

      const categories = definition.categories.filter((category) =>
        coverageItems.some((item) => item.category === category),
      );
      const sources = uniquePresetValues({
        getKey: (item: RankedNewsItem<NewsHomeItem>) => item.sourceSlug,
        limit: definition.sourceLimit,
        values: coverageItems,
      });
      const entities = uniquePresetValues({
        getKey: (entity: string) => entity,
        limit: definition.entityLimit,
        values: coverageItems.flatMap((item) => item.entities),
      });
      const signals = [
        ...categories.map((category) =>
          createNewsPreferencePresetSignal({
            active: hasPreferenceSignal(
              normalizedProfile.preferredCategories,
              category,
            ),
            kind: "category" as const,
            label: formatCategory(category),
            signal: category,
          }),
        ),
        ...sources.map((item) =>
          createNewsPreferencePresetSignal({
            active: hasPreferenceSignal(
              normalizedProfile.preferredSources,
              item.sourceSlug,
            ),
            kind: "source" as const,
            label: item.sourceName,
            signal: item.sourceSlug,
          }),
        ),
        ...entities.map((entity) =>
          createNewsPreferencePresetSignal({
            active: hasPreferenceSignal(
              normalizedProfile.preferredEntities,
              entity,
            ),
            kind: "entity" as const,
            label: entity,
            signal: entity,
          }),
        ),
      ];
      const newSignalCount = signals.filter((signal) => !signal.active).length;

      return {
        actionLabel: newSignalCount > 0 ? "Apply preset" : "Preset active",
        coverageLabel: getPresetCoverageLabel(coverageItems.length),
        key: definition.key,
        label: definition.label,
        newSignalCount,
        signals,
        summary: definition.summary,
      };
    })
    .filter((preset): preset is NonNullable<typeof preset> => Boolean(preset))
    .slice(0, Math.max(0, limit));
  const newSignalCount = presets.reduce(
    (sum, preset) => sum + preset.newSignalCount,
    0,
  );

  return {
    label: presets.length > 0 ? "Preset Ready" : "Preset Covered",
    metrics: [
      { label: "Presets", value: String(presets.length) },
      { label: "Stories", value: String(items.length) },
      { label: "New signals", value: String(newSignalCount) },
      { label: "Active signals", value: String(activeSignalCount) },
    ],
    presets,
    summary:
      presets.length > 0
        ? `${presets.length} one-click preference ${
            presets.length === 1 ? "preset" : "presets"
          } can reshape the For You model from ${items.length} ranked ${
            items.length === 1 ? "story" : "stories"
          }.`
        : "Preference presets are already covered by the active profile.",
  };
};

type NewsPreferenceTuningAction = "add" | "explore" | "keep" | "reduce";
type NewsPreferenceTuningKind = "bias" | "category" | "entity" | "source";

interface NewsPreferenceTuningSignalAccumulator {
  count: number;
  evidence: string[];
  label: string;
  signal: string;
}

const upsertPreferenceTuningSignal = ({
  evidence,
  key,
  label,
  signal,
  store,
}: {
  evidence: string;
  key: string;
  label: string;
  signal: string;
  store: Map<string, NewsPreferenceTuningSignalAccumulator>;
}) => {
  const normalizedKey = normalizePreferenceSignal(key);
  const normalizedLabel = label.trim();
  const normalizedSignal = signal.trim();

  if (!normalizedKey || !normalizedLabel || !normalizedSignal) return;

  const existing = store.get(normalizedKey);

  if (!existing) {
    store.set(normalizedKey, {
      count: 1,
      evidence: [evidence],
      label: normalizedLabel,
      signal: normalizedSignal,
    });
    return;
  }

  existing.count += 1;

  if (!existing.evidence.includes(evidence)) existing.evidence.push(evidence);
};

const comparePreferenceTuningSignals = (
  left: NewsPreferenceTuningSignalAccumulator,
  right: NewsPreferenceTuningSignalAccumulator,
) => {
  if (right.count !== left.count) return right.count - left.count;

  return left.label.localeCompare(right.label);
};

const getTopPreferenceTuningSignal = ({
  excludedSignals,
  store,
}: {
  excludedSignals: readonly string[];
  store: Map<string, NewsPreferenceTuningSignalAccumulator>;
}) =>
  Array.from(store.values())
    .filter((entry) => !hasPreferenceSignal(excludedSignals, entry.signal))
    .sort(comparePreferenceTuningSignals)[0] ?? null;

const createPreferenceTuningSuggestion = ({
  action,
  actionLabel,
  detail,
  evidence,
  kind,
  label,
  signal,
}: {
  action: NewsPreferenceTuningAction;
  actionLabel: string;
  detail: string;
  evidence: readonly string[];
  kind: NewsPreferenceTuningKind;
  label: string;
  signal: string;
}) => ({
  action,
  actionLabel,
  detail,
  evidence: evidence.slice(0, 3),
  kind,
  label,
  signal,
});

const getPreferenceTuningSupportedCategory = ({
  formatCategory,
  items,
  profile,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  profile: NewsPreferenceProfile;
}) => {
  const supportedCategories = new Map<
    string,
    NewsPreferenceTuningSignalAccumulator
  >();

  for (const item of items) {
    if (!hasPreferenceSignal(profile.preferredCategories, item.category)) {
      continue;
    }

    upsertPreferenceTuningSignal({
      evidence: item.title,
      key: item.category,
      label: formatCategory(item.category),
      signal: item.category,
      store: supportedCategories,
    });
  }

  return (
    Array.from(supportedCategories.values()).sort(
      comparePreferenceTuningSignals,
    )[0] ?? null
  );
};

const getPreferenceTuningBehaviorStores = ({
  formatCategory,
  items,
}: {
  formatCategory: (category: string) => string;
  items: readonly NewsReaderMemoryItem[];
}) => {
  const categories = new Map<string, NewsPreferenceTuningSignalAccumulator>();
  const entities = new Map<string, NewsPreferenceTuningSignalAccumulator>();
  const sources = new Map<string, NewsPreferenceTuningSignalAccumulator>();

  for (const item of items) {
    upsertPreferenceTuningSignal({
      evidence: item.title,
      key: item.category,
      label: formatCategory(item.category),
      signal: item.category,
      store: categories,
    });
    upsertPreferenceTuningSignal({
      evidence: item.title,
      key: item.sourceSlug,
      label: item.sourceName,
      signal: item.sourceSlug,
      store: sources,
    });

    for (const entity of item.entities) {
      upsertPreferenceTuningSignal({
        evidence: item.title,
        key: entity,
        label: entity,
        signal: entity,
        store: entities,
      });
    }
  }

  return { categories, entities, sources };
};

export const getNewsPreferenceTuningPlan = ({
  formatCategory,
  historyItems,
  items,
  limit,
  negativeFeedbackItems,
  profile,
  savedItems,
}: {
  formatCategory: (category: string) => string;
  historyItems: readonly NewsReaderMemoryItem[];
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const activeSignalCount =
    normalizedProfile.preferredCategories.length +
    normalizedProfile.preferredSources.length +
    normalizedProfile.preferredEntities.length;
  const behaviorItems = [...savedItems, ...historyItems];
  const behaviorCount = behaviorItems.length;
  const guardrailCount = negativeFeedbackItems.length;
  const suggestions: ReturnType<typeof createPreferenceTuningSuggestion>[] = [];
  const supportedCategory = getPreferenceTuningSupportedCategory({
    formatCategory,
    items,
    profile: normalizedProfile,
  });

  if (supportedCategory) {
    suggestions.push(
      createPreferenceTuningSuggestion({
        action: "keep",
        actionLabel: "Keep topic",
        detail: `${supportedCategory.label} still appears in ${
          supportedCategory.count
        } ranked ${supportedCategory.count === 1 ? "story" : "stories"}.`,
        evidence: supportedCategory.evidence,
        kind: "category",
        label: `Keep ${supportedCategory.label}`,
        signal: supportedCategory.signal,
      }),
    );
  }

  const behaviorStores = getPreferenceTuningBehaviorStores({
    formatCategory,
    items: behaviorItems,
  });
  const topBehaviorCategory = getTopPreferenceTuningSignal({
    excludedSignals: normalizedProfile.preferredCategories,
    store: behaviorStores.categories,
  });
  const topBehaviorSource = getTopPreferenceTuningSignal({
    excludedSignals: normalizedProfile.preferredSources,
    store: behaviorStores.sources,
  });

  if (topBehaviorCategory) {
    suggestions.push(
      createPreferenceTuningSuggestion({
        action: "add",
        actionLabel: "Add topic",
        detail: `${topBehaviorCategory.count} saved/read ${
          topBehaviorCategory.count === 1 ? "signal points" : "signals point"
        } to ${topBehaviorCategory.label}.`,
        evidence: topBehaviorCategory.evidence,
        kind: "category",
        label: `Add ${topBehaviorCategory.label}`,
        signal: topBehaviorCategory.signal,
      }),
    );
  }

  if (topBehaviorSource) {
    suggestions.push(
      createPreferenceTuningSuggestion({
        action: "add",
        actionLabel: "Add source",
        detail: `${topBehaviorSource.count} saved/read ${
          topBehaviorSource.count === 1 ? "signal points" : "signals point"
        } to ${topBehaviorSource.label}.`,
        evidence: topBehaviorSource.evidence,
        kind: "source",
        label: `Add ${topBehaviorSource.label}`,
        signal: topBehaviorSource.signal,
      }),
    );
  }

  const negativeStores = getPreferenceTuningBehaviorStores({
    formatCategory,
    items: negativeFeedbackItems,
  });
  const topNegativeSource = getTopPreferenceTuningSignal({
    excludedSignals: [],
    store: negativeStores.sources,
  });

  if (topNegativeSource) {
    suggestions.push(
      createPreferenceTuningSuggestion({
        action: "reduce",
        actionLabel: "Reduce source",
        detail: `${topNegativeSource.count} Less ${
          topNegativeSource.count === 1 ? "signal is" : "signals are"
        } guarding ${topNegativeSource.label}.`,
        evidence: topNegativeSource.evidence,
        kind: "source",
        label: `Reduce ${topNegativeSource.label}`,
        signal: topNegativeSource.signal,
      }),
    );
  }

  const topBehaviorEntity = getTopPreferenceTuningSignal({
    excludedSignals: normalizedProfile.preferredEntities,
    store: behaviorStores.entities,
  });

  if (topBehaviorEntity) {
    suggestions.push(
      createPreferenceTuningSuggestion({
        action: "add",
        actionLabel: "Add entity",
        detail: `${topBehaviorEntity.count} saved/read ${
          topBehaviorEntity.count === 1 ? "signal points" : "signals point"
        } to ${topBehaviorEntity.label}.`,
        evidence: topBehaviorEntity.evidence,
        kind: "entity",
        label: `Add ${topBehaviorEntity.label}`,
        signal: topBehaviorEntity.signal,
      }),
    );
  }

  if (
    suggestions.length < limit &&
    behaviorCount > 0 &&
    normalizedProfile.noveltyBias <= normalizedProfile.recencyBias
  ) {
    suggestions.push(
      createPreferenceTuningSuggestion({
        action: "explore",
        actionLabel: "Raise novelty",
        detail:
          "Recent behavior has useful signals; raise novelty when you want more adjacent AI coverage.",
        evidence: behaviorItems.map((item) => item.title),
        kind: "bias",
        label: "Raise exploration",
        signal: "noveltyBias",
      }),
    );
  }

  const visibleSuggestions = suggestions.slice(0, Math.max(0, limit));
  const metrics = [
    { label: "Active signals", value: String(activeSignalCount) },
    { label: "Behavior", value: String(behaviorCount) },
    { label: "Guardrails", value: String(guardrailCount) },
    { label: "Suggestions", value: String(visibleSuggestions.length) },
  ];

  if (activeSignalCount === 0 && behaviorCount === 0 && guardrailCount === 0) {
    return {
      label: "Cold Start",
      metrics,
      suggestions: [],
      summary:
        "Preference tuning will appear after profile signals or reader behavior arrive.",
    };
  }

  return {
    label: visibleSuggestions.length > 0 ? "Ready to Tune" : "Stable Profile",
    metrics,
    suggestions: visibleSuggestions,
    summary:
      visibleSuggestions.length > 0
        ? `${visibleSuggestions.length} tuning ${
            visibleSuggestions.length === 1 ? "suggestion" : "suggestions"
          } from ${activeSignalCount} active ${
            activeSignalCount === 1 ? "signal" : "signals"
          }, ${behaviorCount} behavior ${
            behaviorCount === 1 ? "signal" : "signals"
          }, and ${guardrailCount} ${
            guardrailCount === 1 ? "guardrail" : "guardrails"
          }.`
        : "Current profile signals are stable against the latest behavior.",
  };
};

type NewsProfileImpactLaneKey = "boosted" | "dampened" | "explore";

const joinProfileImpactSignals = (signals: readonly string[]) => {
  if (signals.length === 0) return "current profile";
  if (signals.length === 1) return signals[0] ?? "current profile";
  if (signals.length === 2) return `${signals[0]} and ${signals[1]}`;

  return `${signals.slice(0, -1).join(", ")}, and ${signals[signals.length - 1]}`;
};

const toNewsProfileImpactStory = ({
  item,
  reason,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  reason: string;
}) => ({
  id: item.id,
  reason,
  sourceName: item.sourceName,
  title: item.title,
});

const getNewsProfileImpactMatches = ({
  formatCategory,
  item,
  profile,
}: {
  formatCategory: (category: string) => string;
  item: RankedNewsItem<NewsHomeItem>;
  profile: NewsPreferenceProfile;
}) => {
  const matches: string[] = [];

  if (hasPreferenceSignal(profile.preferredCategories, item.category)) {
    matches.push(formatCategory(item.category));
  }

  if (hasPreferenceSignal(profile.preferredSources, item.sourceSlug)) {
    matches.push(item.sourceName);
  }

  for (const entity of item.entities) {
    if (
      hasPreferenceSignal(profile.preferredEntities, entity) &&
      !matches.includes(entity)
    ) {
      matches.push(entity);
    }
  }

  return matches;
};

const getNewsProfileImpactDampenedReason = ({
  formatCategory,
  item,
  negativeFeedbackItems,
}: {
  formatCategory: (category: string) => string;
  item: RankedNewsItem<NewsHomeItem>;
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
}) => {
  for (const negativeItem of negativeFeedbackItems) {
    if (
      normalizePreferenceSignal(negativeItem.sourceSlug) ===
      normalizePreferenceSignal(item.sourceSlug)
    ) {
      return `Matches hidden source ${negativeItem.sourceName}.`;
    }

    if (
      normalizePreferenceSignal(negativeItem.category) ===
      normalizePreferenceSignal(item.category)
    ) {
      return `Matches hidden topic ${formatCategory(negativeItem.category)}.`;
    }

    const hiddenEntity = item.entities.find((entity) =>
      negativeItem.entities.some(
        (negativeEntity) =>
          normalizePreferenceSignal(negativeEntity) ===
          normalizePreferenceSignal(entity),
      ),
    );

    if (hiddenEntity) return `Matches hidden entity ${hiddenEntity}.`;
  }

  return null;
};

const createProfileImpactLane = ({
  count,
  key,
  label,
  stories,
  summary,
}: {
  count: number;
  key: NewsProfileImpactLaneKey;
  label: string;
  stories: ReturnType<typeof toNewsProfileImpactStory>[];
  summary: string;
}) => ({
  count,
  key,
  label,
  stories,
  summary,
});

export const getNewsProfileImpactPreview = ({
  formatCategory,
  items,
  limit,
  negativeFeedbackItems,
  profile,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
  profile: NewsPreferenceProfile;
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const activeSignalCount =
    normalizedProfile.preferredCategories.length +
    normalizedProfile.preferredSources.length +
    normalizedProfile.preferredEntities.length;
  const storyLimit = Math.max(0, limit);

  if (items.length === 0 && activeSignalCount === 0) {
    return {
      label: "Cold Impact",
      lanes: [],
      metrics: [
        { label: "Active signals", value: "0" },
        { label: "Boosted", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Dampened", value: "0" },
      ],
      summary:
        "Profile impact preview will appear after stories and reader signals arrive.",
    };
  }

  const boostedStories: ReturnType<typeof toNewsProfileImpactStory>[] = [];
  const exploreStories: ReturnType<typeof toNewsProfileImpactStory>[] = [];
  const dampenedStories: ReturnType<typeof toNewsProfileImpactStory>[] = [];

  let boostedCount = 0;
  let exploreCount = 0;
  let dampenedCount = 0;

  for (const item of items) {
    const dampenedReason = getNewsProfileImpactDampenedReason({
      formatCategory,
      item,
      negativeFeedbackItems,
    });

    if (dampenedReason) {
      dampenedCount += 1;
      if (dampenedStories.length < storyLimit) {
        dampenedStories.push(
          toNewsProfileImpactStory({ item, reason: dampenedReason }),
        );
      }
      continue;
    }

    const profileMatches = getNewsProfileImpactMatches({
      formatCategory,
      item,
      profile: normalizedProfile,
    });

    if (profileMatches.length > 0) {
      boostedCount += 1;
      if (boostedStories.length < storyLimit) {
        boostedStories.push(
          toNewsProfileImpactStory({
            item,
            reason: `Matches ${joinProfileImpactSignals(profileMatches)}.`,
          }),
        );
      }
      continue;
    }

    if (item.matchedSignals.includes("exploration")) {
      exploreCount += 1;
      if (exploreStories.length < storyLimit) {
        exploreStories.push(
          toNewsProfileImpactStory({
            item,
            reason: `Explores ${formatCategory(item.category)} outside the active profile.`,
          }),
        );
      }
    }
  }

  const lanes = [
    createProfileImpactLane({
      count: boostedCount,
      key: "boosted",
      label: "Boosted",
      stories: boostedStories,
      summary: `Profile signals lift ${boostedCount} ranked ${
        boostedCount === 1 ? "story" : "stories"
      }.`,
    }),
    createProfileImpactLane({
      count: exploreCount,
      key: "explore",
      label: "Exploration",
      stories: exploreStories,
      summary: `${exploreCount} ${
        exploreCount === 1 ? "story tests" : "stories test"
      } adjacent coverage outside the profile.`,
    }),
    createProfileImpactLane({
      count: dampenedCount,
      key: "dampened",
      label: "Dampened",
      stories: dampenedStories,
      summary: `${dampenedCount} ${
        dampenedCount === 1 ? "story is" : "stories are"
      } held back by negative feedback.`,
    }),
  ];

  return {
    label:
      boostedCount + exploreCount + dampenedCount > 0
        ? "Profile Impact"
        : "No Impact Yet",
    lanes,
    metrics: [
      { label: "Active signals", value: String(activeSignalCount) },
      { label: "Boosted", value: String(boostedCount) },
      { label: "Explore", value: String(exploreCount) },
      { label: "Dampened", value: String(dampenedCount) },
    ],
    summary: `Current profile lifts ${boostedCount} ${
      boostedCount === 1 ? "story" : "stories"
    }, explores ${exploreCount} adjacent ${
      exploreCount === 1 ? "story" : "stories"
    }, and dampens ${dampenedCount} ${
      dampenedCount === 1 ? "story" : "stories"
    }.`,
  };
};

type NewsInterestGraphLaneKey = "angles" | "entities" | "sources" | "topics";

interface NewsInterestGraphNode {
  activeSignal: boolean;
  label: string;
  score: number;
  storyCount: number;
}

interface NewsInterestGraphLane {
  key: NewsInterestGraphLaneKey;
  label: string;
  nodes: NewsInterestGraphNode[];
}

const interestGraphLaneDefinitions = [
  { key: "topics", label: "Topics" },
  { key: "entities", label: "Entities" },
  { key: "sources", label: "Sources" },
  { key: "angles", label: "Angles" },
] as const satisfies readonly {
  key: NewsInterestGraphLaneKey;
  label: string;
}[];

const createInterestGraphStores = () =>
  new Map<
    NewsInterestGraphLaneKey,
    Map<
      string,
      {
        activeSignal: boolean;
        label: string;
        score: number;
        storyIds: Set<string>;
      }
    >
  >(
    interestGraphLaneDefinitions.map((lane) => [
      lane.key,
      new Map<
        string,
        {
          activeSignal: boolean;
          label: string;
          score: number;
          storyIds: Set<string>;
        }
      >(),
    ]),
  );

const addInterestGraphNode = ({
  activeSignal,
  itemId,
  key,
  label,
  lane,
  score,
  stores,
}: {
  activeSignal: boolean;
  itemId?: string;
  key: string;
  label: string;
  lane: NewsInterestGraphLaneKey;
  score: number;
  stores: ReturnType<typeof createInterestGraphStores>;
}) => {
  const normalizedKey = key.trim().toLowerCase();
  const nodeLabel = label.trim();

  if (!normalizedKey || !nodeLabel) return;

  const laneStore = stores.get(lane);
  if (!laneStore) return;

  const existing = laneStore.get(normalizedKey);

  if (!existing) {
    laneStore.set(normalizedKey, {
      activeSignal,
      label: nodeLabel,
      score,
      storyIds: itemId ? new Set([itemId]) : new Set<string>(),
    });
    return;
  }

  existing.activeSignal = existing.activeSignal || activeSignal;
  existing.score += score;

  if (itemId) existing.storyIds.add(itemId);

  if (existing.label.toLowerCase() === normalizedKey) {
    existing.label = nodeLabel;
  }
};

const selectInterestGraphLaneNodes = ({
  lane,
  limit,
  stores,
}: {
  lane: NewsInterestGraphLaneKey;
  limit: number;
  stores: ReturnType<typeof createInterestGraphStores>;
}): NewsInterestGraphNode[] =>
  Array.from(stores.get(lane)?.values() ?? [])
    .map((node) => ({
      activeSignal: node.activeSignal,
      label: node.label,
      score: node.score,
      storyCount: node.storyIds.size,
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.storyCount !== left.storyCount) {
        return right.storyCount - left.storyCount;
      }
      return left.label.localeCompare(right.label);
    })
    .slice(0, limit);

export const getNewsInterestGraph = ({
  formatCategory,
  items,
  limit,
  profile,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  profile: NewsPreferenceProfile;
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const stores = createInterestGraphStores();

  for (const category of normalizedProfile.preferredCategories) {
    addInterestGraphNode({
      activeSignal: true,
      key: category,
      label: formatCategory(category),
      lane: "topics",
      score: 40,
      stores,
    });
  }

  for (const entity of normalizedProfile.preferredEntities) {
    addInterestGraphNode({
      activeSignal: true,
      key: entity,
      label: entity,
      lane: "entities",
      score: 38,
      stores,
    });
  }

  for (const source of normalizedProfile.preferredSources) {
    addInterestGraphNode({
      activeSignal: true,
      key: source,
      label: source,
      lane: "sources",
      score: 35,
      stores,
    });
  }

  const uniqueStoryTags = new Map<string, string>();

  for (const item of items) {
    for (const tagValue of item.tags) {
      const tag = tagValue.trim();
      const normalizedTag = tag.toLowerCase();

      if (!tag || uniqueStoryTags.has(normalizedTag)) continue;
      uniqueStoryTags.set(normalizedTag, tag);
    }
  }

  for (const tag of uniqueStoryTags.values()) {
    if (!hasPreferenceSignal(normalizedProfile.preferredEntities, tag)) {
      continue;
    }

    addInterestGraphNode({
      activeSignal: true,
      key: tag,
      label: tag,
      lane: "angles",
      score: 38,
      stores,
    });
  }

  for (const item of items) {
    addInterestGraphNode({
      activeSignal: false,
      itemId: item.id,
      key: item.category,
      label: formatCategory(item.category),
      lane: "topics",
      score:
        Math.round(item.personalizedScore / 10) +
        Math.round(item.trendScore / 10),
      stores,
    });

    addInterestGraphNode({
      activeSignal: false,
      itemId: item.id,
      key: item.sourceSlug,
      label: item.sourceName,
      lane: "sources",
      score:
        Math.round(item.personalizedScore / 12) +
        Math.round(item.sourceScore / 10),
      stores,
    });

    const seenEntities = new Set<string>();

    for (const entityValue of item.entities) {
      const entity = entityValue.trim();
      const normalizedEntity = entity.toLowerCase();

      if (!entity || seenEntities.has(normalizedEntity)) continue;

      addInterestGraphNode({
        activeSignal: false,
        itemId: item.id,
        key: entity,
        label: entity,
        lane: "entities",
        score:
          Math.round(item.personalizedScore / 12) +
          Math.round(item.trendScore / 12),
        stores,
      });
      seenEntities.add(normalizedEntity);
    }

    const seenTags = new Set<string>();

    for (const tagValue of item.tags) {
      const tag = tagValue.trim();
      const normalizedTag = tag.toLowerCase();

      if (!tag || seenTags.has(normalizedTag)) continue;

      addInterestGraphNode({
        activeSignal: hasPreferenceSignal(
          normalizedProfile.preferredEntities,
          tag,
        ),
        itemId: item.id,
        key: tag,
        label: tag,
        lane: "angles",
        score:
          Math.round(item.personalizedScore / 12) +
          Math.round(item.trendScore / 12),
        stores,
      });
      seenTags.add(normalizedTag);
    }
  }

  const lanes: NewsInterestGraphLane[] = interestGraphLaneDefinitions.map(
    (lane) => ({
      key: lane.key,
      label: lane.label,
      nodes: selectInterestGraphLaneNodes({
        lane: lane.key,
        limit,
        stores,
      }),
    }),
  );
  const displayedNodes = lanes.flatMap((lane) => lane.nodes);
  const activeSignalCount =
    normalizedProfile.preferredCategories.length +
    normalizedProfile.preferredEntities.length +
    normalizedProfile.preferredSources.length;
  const explorationCount = items.filter((item) =>
    item.matchedSignals.includes("exploration"),
  ).length;
  const strongestNode = [...displayedNodes].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.label.localeCompare(right.label);
  })[0];

  if (displayedNodes.length === 0) {
    return {
      label: "Cold Start",
      lanes,
      metrics: [
        { label: "Active signals", value: "0" },
        { label: "Topic nodes", value: "0" },
        { label: "Entity nodes", value: "0" },
        { label: "Source nodes", value: "0" },
        { label: "Angle nodes", value: "0" },
      ],
      notices: [
        {
          detail:
            "Read, save, or hide stories to start building an interest graph.",
          label: "Learning needed",
        },
      ],
      summary: "Interest graph will appear as stories and reader signals load.",
    };
  }

  const notices: { detail: string; label: string }[] = [];

  if (explorationCount > 0) {
    notices.push({
      detail:
        "Exploration stories are feeding the graph, so the profile can keep broadening.",
      label: "Adaptive learning",
    });
  } else if (activeSignalCount > 0) {
    notices.push({
      detail: "Current stories are reinforcing known reader interests.",
      label: "Profile fit",
    });
  } else {
    notices.push({
      detail: "Trending stories are sketching a starting profile.",
      label: "Trend discovery",
    });
  }

  if (strongestNode) {
    notices.push({
      detail: `${strongestNode.label} leads the graph with a ${strongestNode.score} interest score.`,
      label: "Strongest interest",
    });
  }

  return {
    label:
      activeSignalCount === 0
        ? "Trend Discovery"
        : explorationCount > 0
          ? "Adaptive Profile"
          : "Mapped Profile",
    lanes,
    metrics: [
      { label: "Active signals", value: String(activeSignalCount) },
      {
        label: "Topic nodes",
        value: String(
          lanes.find((lane) => lane.key === "topics")?.nodes.length ?? 0,
        ),
      },
      {
        label: "Entity nodes",
        value: String(
          lanes.find((lane) => lane.key === "entities")?.nodes.length ?? 0,
        ),
      },
      {
        label: "Source nodes",
        value: String(
          lanes.find((lane) => lane.key === "sources")?.nodes.length ?? 0,
        ),
      },
      {
        label: "Angle nodes",
        value: String(
          lanes.find((lane) => lane.key === "angles")?.nodes.length ?? 0,
        ),
      },
    ],
    notices,
    summary: `${activeSignalCount} reader ${
      activeSignalCount === 1 ? "signal maps" : "signals map"
    } to ${displayedNodes.length} interest ${
      displayedNodes.length === 1 ? "node" : "nodes"
    } across ${items.length} ranked ${
      items.length === 1 ? "story" : "stories"
    }.`,
  };
};

type NewsLiveWireSignal = "Breaking" | "Explore" | "For You" | "Newswire";

const getNewsLiveWireSignal = (
  item: RankedNewsItem<NewsHomeItem>,
): NewsLiveWireSignal => {
  if (item.trendScore >= 90) return "Breaking";
  if (item.matchedSignals.includes("exploration")) return "Explore";
  if (item.matchedSignals.length > 0) return "For You";

  return "Newswire";
};

const toNewsLiveWireUpdate = ({
  formatCategory,
  item,
}: {
  formatCategory: (category: string) => string;
  item: RankedNewsItem<NewsHomeItem>;
}) => ({
  categoryLabel: formatCategory(item.category),
  id: item.id,
  personalizedScore: item.personalizedScore,
  publishedAt: item.publishedAt,
  signal: getNewsLiveWireSignal(item),
  sourceName: item.sourceName,
  title: item.title,
  trendScore: item.trendScore,
});

export const getNewsLiveWire = ({
  formatCategory,
  items,
  limit,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
}) => {
  const storyCount = items.length;
  const sourceCount = new Set(items.map((item) => item.sourceSlug)).size;
  const topicCount = new Set(items.map((item) => item.category)).size;
  const hotUpdateCount = items.filter((item) => item.trendScore >= 90).length;

  if (storyCount === 0) {
    return {
      label: "Cold Wire",
      metrics: [
        { label: "Live stories", value: "0" },
        { label: "Sources", value: "0" },
        { label: "Topics", value: "0" },
        { label: "Hot updates", value: "0" },
      ],
      notices: [
        {
          detail: "Live wire will appear after stories are ranked.",
          label: "Waiting for crawl",
        },
      ],
      summary: "Live wire will appear as stories load.",
      updates: [],
    };
  }

  const sortedByPublishedAt = [...items].sort((left, right) => {
    const publishedDiff =
      new Date(right.publishedAt).getTime() -
      new Date(left.publishedAt).getTime();

    if (publishedDiff !== 0) return publishedDiff;

    return right.personalizedScore - left.personalizedScore;
  });
  const [newestStory] = sortedByPublishedAt;
  const topHeatStory = [...items].sort((left, right) => {
    if (right.trendScore !== left.trendScore) {
      return right.trendScore - left.trendScore;
    }

    return right.personalizedScore - left.personalizedScore;
  })[0];
  const personalizedCount = items.filter(
    (item) =>
      item.matchedSignals.length > 0 &&
      !item.matchedSignals.includes("exploration"),
  ).length;
  const explorationCount = items.filter((item) =>
    item.matchedSignals.includes("exploration"),
  ).length;
  const notices: { detail: string; label: string }[] = [];

  if (topHeatStory) {
    notices.push({
      detail: `${topHeatStory.title} is leading live heat at ${topHeatStory.trendScore}.`,
      label: "Heat spike",
    });
  }

  if (newestStory) {
    notices.push({
      detail: `${newestStory.title} is the newest update from ${newestStory.sourceName}.`,
      label: "Latest arrival",
    });
  }

  return {
    label:
      hotUpdateCount > 0
        ? "Breaking Wire"
        : personalizedCount > explorationCount
          ? "Personalized Wire"
          : "Live Wire",
    metrics: [
      { label: "Live stories", value: String(storyCount) },
      { label: "Sources", value: String(sourceCount) },
      { label: "Topics", value: String(topicCount) },
      { label: "Hot updates", value: String(hotUpdateCount) },
    ],
    notices,
    summary: `${storyCount} live ${storyCount === 1 ? "update" : "updates"} from ${sourceCount} ${
      sourceCount === 1 ? "source" : "sources"
    } across ${topicCount} ${topicCount === 1 ? "topic" : "topics"}.`,
    updates: sortedByPublishedAt
      .slice(0, limit)
      .map((item) => toNewsLiveWireUpdate({ formatCategory, item })),
  };
};

type NewsHotBoardLabel =
  | "Explore Hot"
  | "For You Hot"
  | "Market Hot"
  | "Newswire Hot";

const getNewsHotBoardLabel = (
  item: RankedNewsItem<NewsHomeItem>,
): NewsHotBoardLabel => {
  if (item.matchedSignals.includes("exploration")) return "Explore Hot";
  if (item.matchedSignals.length > 0) return "For You Hot";
  if (item.trendScore >= 90) return "Market Hot";

  return "Newswire Hot";
};

const getNewsHotBoardReason = (label: NewsHotBoardLabel) => {
  if (label === "For You Hot") {
    return "Reader signals lift this story above market heat.";
  }

  if (label === "Market Hot") {
    return "Market heat leads before the reader profile catches up.";
  }

  if (label === "Explore Hot") {
    return "Exploration keeps a hot adjacent story in the feed.";
  }

  return "Newswire momentum keeps this story on the board.";
};

const getNewsHotBoardScore = (item: RankedNewsItem<NewsHomeItem>) => {
  const readerSignalLift =
    item.matchedSignals.length > 0 &&
    !item.matchedSignals.includes("exploration")
      ? 8
      : 0;
  const explorationLift = item.matchedSignals.includes("exploration") ? 5 : 0;

  return (
    item.trendScore +
    Math.round(item.personalizedScore / 5) +
    Math.round(item.sourceScore / 10) +
    readerSignalLift +
    explorationLift
  );
};

const toNewsHotBoardEntry = ({
  formatCategory,
  heatScore,
  item,
  rank,
}: {
  formatCategory: (category: string) => string;
  heatScore: number;
  item: RankedNewsItem<NewsHomeItem>;
  rank: number;
}) => {
  const label = getNewsHotBoardLabel(item);

  return {
    categoryLabel: formatCategory(item.category),
    heatScore,
    id: item.id,
    label,
    rank: String(rank).padStart(2, "0"),
    reason: getNewsHotBoardReason(label),
    scoreBreakdown: [
      { label: "Trend", value: String(item.trendScore) },
      { label: "Reader", value: String(item.personalizedScore) },
      { label: "Trust", value: String(item.sourceScore) },
    ],
    sourceName: item.sourceName,
    title: item.title,
  };
};

export const getNewsHotBoard = ({
  formatCategory,
  items,
  limit,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
}) => {
  if (items.length === 0) {
    return {
      entries: [],
      label: "Hot Board Waiting",
      metrics: [
        { label: "Entries", value: "0" },
        { label: "For you", value: "0" },
        { label: "Market", value: "0" },
        { label: "Explore", value: "0" },
      ],
      summary: "Hot board will appear after stories are ranked.",
    };
  }

  const scoredEntries = items
    .map((item) => ({
      heatScore: getNewsHotBoardScore(item),
      item,
    }))
    .sort((left, right) => {
      if (right.heatScore !== left.heatScore) {
        return right.heatScore - left.heatScore;
      }

      if (right.item.trendScore !== left.item.trendScore) {
        return right.item.trendScore - left.item.trendScore;
      }

      return (
        new Date(right.item.publishedAt).getTime() -
        new Date(left.item.publishedAt).getTime()
      );
    })
    .slice(0, limit);
  const entries = scoredEntries.map(({ heatScore, item }, index) =>
    toNewsHotBoardEntry({
      formatCategory,
      heatScore,
      item,
      rank: index + 1,
    }),
  );
  const forYouCount = entries.filter(
    (entry) => entry.label === "For You Hot",
  ).length;
  const marketCount = entries.filter(
    (entry) => entry.label === "Market Hot",
  ).length;
  const exploreCount = entries.filter(
    (entry) => entry.label === "Explore Hot",
  ).length;

  return {
    entries,
    label: forYouCount > 0 ? "Personalized Hot Board" : "Market Hot Board",
    metrics: [
      { label: "Entries", value: String(entries.length) },
      { label: "For you", value: String(forYouCount) },
      { label: "Market", value: String(marketCount) },
      { label: "Explore", value: String(exploreCount) },
    ],
    summary: `${entries.length} hot-board ${
      entries.length === 1 ? "entry mixes" : "entries mix"
    } ${forYouCount} reader-matched, ${marketCount} market-led, and ${exploreCount} exploration ${
      exploreCount === 1 ? "story" : "stories"
    }.`,
  };
};

type NewsSearchTrendKind = "Entity" | "Source" | "Topic";
type NewsSearchTrendLabel = "Market Search" | "Reader Search" | "Rising Search";

const newsSearchTrendKindRank = {
  Entity: 0,
  Source: 1,
  Topic: 2,
} satisfies Record<NewsSearchTrendKind, number>;

interface NewsSearchTrendWorking {
  firstIndex: number;
  isReaderMatch: boolean;
  items: RankedNewsItem<NewsHomeItem>[];
  key: string;
  kind: NewsSearchTrendKind;
  query: string;
  sourceNames: string[];
  sourceSlugs: Set<string>;
  trendScoreTotal: number;
}

const getNewsSearchTrendLabel = ({
  averageTrendScore,
  isReaderMatch,
  storyCount,
}: {
  averageTrendScore: number;
  isReaderMatch: boolean;
  storyCount: number;
}): NewsSearchTrendLabel => {
  if (isReaderMatch) return "Reader Search";
  if (storyCount > 1) return "Rising Search";
  if (averageTrendScore >= 90) return "Market Search";

  return "Rising Search";
};

const getNewsSearchTrendReason = (label: NewsSearchTrendLabel) => {
  if (label === "Reader Search") {
    return "Matches your profile and is rising across the edition.";
  }

  if (label === "Market Search") {
    return "Market heat is strong even before reader signals appear.";
  }

  return "Multiple stories are pushing this query up the search rail.";
};

const upsertNewsSearchTrend = ({
  firstIndex,
  isReaderMatch,
  item,
  key,
  kind,
  query,
  store,
}: {
  firstIndex: number;
  isReaderMatch: boolean;
  item: RankedNewsItem<NewsHomeItem>;
  key: string;
  kind: NewsSearchTrendKind;
  query: string;
  store: Map<string, NewsSearchTrendWorking>;
}) => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return;

  const existing = store.get(key);

  if (!existing) {
    store.set(key, {
      firstIndex,
      isReaderMatch,
      items: [item],
      key,
      kind,
      query: normalizedQuery,
      sourceNames: [item.sourceName],
      sourceSlugs: new Set([item.sourceSlug]),
      trendScoreTotal: item.trendScore,
    });
    return;
  }

  existing.isReaderMatch = existing.isReaderMatch || isReaderMatch;
  existing.items.push(item);
  existing.sourceSlugs.add(item.sourceSlug);
  existing.trendScoreTotal += item.trendScore;

  if (!existing.sourceNames.includes(item.sourceName)) {
    existing.sourceNames.push(item.sourceName);
  }
};

const getNewsSearchTrendScore = ({
  averageTrendScore,
  isReaderMatch,
  sourceCount,
  storyCount,
}: {
  averageTrendScore: number;
  isReaderMatch: boolean;
  sourceCount: number;
  storyCount: number;
}) =>
  averageTrendScore +
  storyCount * 15 +
  sourceCount * 6 +
  (isReaderMatch ? 20 : 0);

const toNewsSearchTrend = (trend: NewsSearchTrendWorking) => {
  const storyCount = trend.items.length;
  const sourceCount = trend.sourceSlugs.size;
  const averageTrendScore = Math.round(trend.trendScoreTotal / storyCount);
  const label = getNewsSearchTrendLabel({
    averageTrendScore,
    isReaderMatch: trend.isReaderMatch,
    storyCount,
  });
  const sortedItems = [...trend.items].sort((left, right) => {
    if (right.personalizedScore !== left.personalizedScore) {
      return right.personalizedScore - left.personalizedScore;
    }

    if (right.trendScore !== left.trendScore) {
      return right.trendScore - left.trendScore;
    }

    return (
      new Date(right.publishedAt).getTime() -
      new Date(left.publishedAt).getTime()
    );
  });
  const [topStory] = sortedItems;

  return {
    firstIndex: trend.firstIndex,
    key: trend.key,
    kind: trend.kind,
    label,
    query: trend.query,
    reason: getNewsSearchTrendReason(label),
    score: getNewsSearchTrendScore({
      averageTrendScore,
      isReaderMatch: trend.isReaderMatch,
      sourceCount,
      storyCount,
    }),
    sourceNames: trend.sourceNames,
    storyCount,
    supportLabel: `${storyCount} ${storyCount === 1 ? "story" : "stories"} / ${sourceCount} ${
      sourceCount === 1 ? "source" : "sources"
    }`,
    topStory: topStory
      ? {
          id: topStory.id,
          sourceName: topStory.sourceName,
          title: topStory.title,
        }
      : null,
  };
};

export const getNewsSearchTrends = ({
  formatCategory,
  items,
  limit,
  profile,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  profile: NewsPreferenceProfile;
}) => {
  if (items.length === 0) {
    return {
      label: "Search Trends Waiting",
      metrics: [
        { label: "Queries", value: "0" },
        { label: "Reader", value: "0" },
        { label: "Rising", value: "0" },
        { label: "Market", value: "0" },
      ],
      summary: "Search trends will appear after stories are ranked.",
      trends: [],
    };
  }

  const normalizedProfile = profile;
  const trends = new Map<string, NewsSearchTrendWorking>();

  items.forEach((item, index) => {
    const topicQuery = formatCategory(item.category);

    upsertNewsSearchTrend({
      firstIndex: index,
      isReaderMatch: hasPreferenceSignal(
        normalizedProfile.preferredCategories,
        item.category,
      ),
      item,
      key: `topic:${normalizePreferenceSignal(item.category)}`,
      kind: "Topic",
      query: topicQuery,
      store: trends,
    });

    upsertNewsSearchTrend({
      firstIndex: index,
      isReaderMatch: hasPreferenceSignal(
        normalizedProfile.preferredSources,
        item.sourceSlug,
      ),
      item,
      key: `source:${normalizePreferenceSignal(item.sourceSlug)}`,
      kind: "Source",
      query: item.sourceName,
      store: trends,
    });

    for (const entity of getUniqueSignals(item.entities, 8)) {
      upsertNewsSearchTrend({
        firstIndex: index,
        isReaderMatch: hasPreferenceSignal(
          normalizedProfile.preferredEntities,
          entity,
        ),
        item,
        key: `entity:${normalizePreferenceSignal(entity)}`,
        kind: "Entity",
        query: entity,
        store: trends,
      });
    }
  });

  const searchTrends = Array.from(trends.values())
    .map(toNewsSearchTrend)
    .filter(
      (trend) =>
        trend.kind === "Topic" ||
        trend.storyCount > 1 ||
        trend.label === "Reader Search",
    )
    .filter((trend) => trend.topStory !== null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;

      if (left.label !== right.label) {
        if (left.label === "Reader Search") return -1;
        if (right.label === "Reader Search") return 1;
      }

      if (left.kind !== right.kind) {
        return (
          newsSearchTrendKindRank[left.kind] -
          newsSearchTrendKindRank[right.kind]
        );
      }

      return left.firstIndex - right.firstIndex;
    })
    .slice(0, limit)
    .map(
      ({ firstIndex: _firstIndex, storyCount: _storyCount, ...trend }) => trend,
    );

  const readerCount = searchTrends.filter(
    (trend) => trend.label === "Reader Search",
  ).length;
  const risingCount = searchTrends.filter(
    (trend) => trend.label === "Rising Search",
  ).length;
  const marketCount = searchTrends.filter(
    (trend) => trend.label === "Market Search",
  ).length;

  return {
    label:
      searchTrends.length > 0 ? "Search Trends Ready" : "Search Trends Waiting",
    metrics: [
      { label: "Queries", value: String(searchTrends.length) },
      { label: "Reader", value: String(readerCount) },
      { label: "Rising", value: String(risingCount) },
      { label: "Market", value: String(marketCount) },
    ],
    summary:
      searchTrends.length > 0
        ? `${searchTrends.length} search ${
            searchTrends.length === 1 ? "trend connects" : "trends connect"
          } ${items.length} ${
            items.length === 1 ? "story" : "stories"
          } across reader, rising, and market demand.`
        : "Search trends will appear after stories are ranked.",
    trends: searchTrends,
  };
};

export const getNewsTopicPulse = ({
  items,
  limit,
}: {
  items: readonly NewsHomeItem[];
  limit: number;
}) => {
  const pulseByCategory = new Map<
    string,
    {
      category: string;
      latestPublishedAt: string;
      sources: string[];
      storyCount: number;
      trendScoreTotal: number;
    }
  >();

  for (const item of items) {
    const existing = pulseByCategory.get(item.category);

    if (!existing) {
      pulseByCategory.set(item.category, {
        category: item.category,
        latestPublishedAt: item.publishedAt,
        sources: [item.sourceName],
        storyCount: 1,
        trendScoreTotal: item.trendScore,
      });
      continue;
    }

    existing.storyCount += 1;
    existing.trendScoreTotal += item.trendScore;

    if (!existing.sources.includes(item.sourceName)) {
      existing.sources.push(item.sourceName);
    }

    if (
      new Date(item.publishedAt).getTime() >
      new Date(existing.latestPublishedAt).getTime()
    ) {
      existing.latestPublishedAt = item.publishedAt;
    }
  }

  return Array.from(pulseByCategory.values())
    .map((pulse) => {
      const averageTrendScore = Math.round(
        pulse.trendScoreTotal / pulse.storyCount,
      );

      return {
        averageTrendScore,
        category: pulse.category,
        heatScore: averageTrendScore + pulse.storyCount * 20,
        latestPublishedAt: pulse.latestPublishedAt,
        sources: pulse.sources.slice(0, 3),
        storyCount: pulse.storyCount,
      };
    })
    .sort((left, right) => {
      if (right.heatScore !== left.heatScore) {
        return right.heatScore - left.heatScore;
      }

      return (
        new Date(right.latestPublishedAt).getTime() -
        new Date(left.latestPublishedAt).getTime()
      );
    })
    .slice(0, limit);
};

type NewsTopicMatchMode = "Cooldown" | "Explore" | "Follow" | "Watch";

const newsTopicMatchModePriority = {
  Follow: 0,
  Explore: 1,
  Watch: 2,
  Cooldown: 3,
} satisfies Record<NewsTopicMatchMode, number>;

const getNewsTopicMatchMode = ({
  averageTrendScore,
  hasExploration,
  readerSignalCount,
}: {
  averageTrendScore: number;
  hasExploration: boolean;
  readerSignalCount: number;
}): NewsTopicMatchMode => {
  if (readerSignalCount > 0 && averageTrendScore >= 70) return "Follow";
  if (hasExploration && averageTrendScore >= 80) return "Explore";
  if (averageTrendScore >= 85) return "Watch";
  if (readerSignalCount > 0) return "Cooldown";

  return "Watch";
};

const getNewsTopicMatchReason = ({
  averageTrendScore,
  mode,
}: {
  averageTrendScore: number;
  mode: NewsTopicMatchMode;
}) => {
  if (mode === "Follow") return "Reader signal and enough heat.";
  if (mode === "Explore") return "High heat outside the current profile.";
  if (mode === "Cooldown") {
    return "Reader signal is present, but heat is lower right now.";
  }
  if (averageTrendScore >= 85) {
    return "High heat without a reader signal yet.";
  }

  return "Low-signal topic to monitor.";
};

export const getNewsTopicMatchMatrix = ({
  formatCategory,
  items,
  limit,
  profile,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  profile: NewsPreferenceProfile;
}) => {
  if (items.length === 0) {
    return {
      label: "Waiting",
      metrics: [
        { label: "Follow", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Watch", value: "0" },
        { label: "Cooldown", value: "0" },
      ],
      rows: [],
      summary: "Topic match matrix will appear as stories load.",
    };
  }

  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const topicsByCategory = new Map<
    string,
    {
      firstIndex: number;
      items: RankedNewsItem<NewsHomeItem>[];
      trendScoreTotal: number;
    }
  >();

  items.forEach((item, index) => {
    const existing = topicsByCategory.get(item.category);

    if (!existing) {
      topicsByCategory.set(item.category, {
        firstIndex: index,
        items: [item],
        trendScoreTotal: item.trendScore,
      });
      return;
    }

    existing.items.push(item);
    existing.trendScoreTotal += item.trendScore;
  });

  const rows = Array.from(topicsByCategory.entries())
    .map(([category, topic]) => {
      const [lead] = topic.items;
      const storyCount = topic.items.length;
      const averageTrendScore = Math.round(topic.trendScoreTotal / storyCount);
      const hasExploration = topic.items.some((item) =>
        item.matchedSignals.includes("exploration"),
      );
      const storySignalCount = topic.items.reduce(
        (sum, item) =>
          sum +
          item.matchedSignals.filter((signal) => signal !== "exploration")
            .length,
        0,
      );
      const topicSignalCount = hasPreferenceSignal(
        normalizedProfile.preferredCategories,
        category,
      )
        ? 1
        : 0;
      const sourceSignalCount = new Set(
        topic.items
          .map((item) => item.sourceSlug)
          .filter((sourceSlug) =>
            hasPreferenceSignal(normalizedProfile.preferredSources, sourceSlug),
          ),
      ).size;
      const entitySignalCount = new Set(
        topic.items
          .flatMap((item) => item.entities)
          .filter((entity) =>
            hasPreferenceSignal(normalizedProfile.preferredEntities, entity),
          ),
      ).size;
      const readerSignalCount =
        storySignalCount +
        topicSignalCount +
        Math.min(sourceSignalCount, 2) +
        Math.min(entitySignalCount, 2);
      const mode = getNewsTopicMatchMode({
        averageTrendScore,
        hasExploration,
        readerSignalCount,
      });

      return {
        averageTrendScore,
        category,
        firstIndex: topic.firstIndex,
        heatLabel: `${averageTrendScore} heat`,
        label: formatCategory(category),
        lead: lead
          ? {
              id: lead.id,
              sourceName: lead.sourceName,
              title: lead.title,
            }
          : null,
        mode,
        readerLabel: `${readerSignalCount} ${
          readerSignalCount === 1 ? "signal" : "signals"
        }`,
        reason: getNewsTopicMatchReason({ averageTrendScore, mode }),
        storyCount,
      };
    })
    .sort((left, right) => {
      const modeDiff =
        newsTopicMatchModePriority[left.mode] -
        newsTopicMatchModePriority[right.mode];
      if (modeDiff !== 0) return modeDiff;

      if (right.averageTrendScore !== left.averageTrendScore) {
        return right.averageTrendScore - left.averageTrendScore;
      }

      if (right.storyCount !== left.storyCount) {
        return right.storyCount - left.storyCount;
      }

      return left.firstIndex - right.firstIndex;
    })
    .slice(0, limit)
    .map(
      ({
        averageTrendScore: _averageTrendScore,
        firstIndex: _firstIndex,
        ...row
      }) => row,
    );
  const countMode = (mode: NewsTopicMatchMode) =>
    rows.filter((row) => row.mode === mode).length;

  return {
    label: `${rows.length} ${rows.length === 1 ? "Topic" : "Topics"}`,
    metrics: [
      { label: "Follow", value: String(countMode("Follow")) },
      { label: "Explore", value: String(countMode("Explore")) },
      { label: "Watch", value: String(countMode("Watch")) },
      { label: "Cooldown", value: String(countMode("Cooldown")) },
    ],
    rows,
    summary: `${rows.length} ${
      rows.length === 1 ? "topic" : "topics"
    } mapped across reader fit and market heat.`,
  };
};

const editionMixDefinitions = [
  {
    detail: "Matched reader signals",
    key: "personalized",
    label: "Personalized",
  },
  {
    detail: "Outside your usual mix",
    key: "exploration",
    label: "Exploration",
  },
  {
    detail: "Ranked by heat and freshness",
    key: "trending",
    label: "Trending",
  },
] as const;

export const getNewsEditionMix = ({
  items,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
}) => {
  const counts = {
    exploration: 0,
    personalized: 0,
    trending: 0,
  };

  for (const item of items) {
    if (item.matchedSignals.includes("exploration")) {
      counts.exploration += 1;
    } else if (item.matchedSignals.length > 0) {
      counts.personalized += 1;
    } else {
      counts.trending += 1;
    }
  }

  const totalCount = items.length;
  const segments = editionMixDefinitions.map((definition) => {
    const count = counts[definition.key];

    return {
      count,
      detail: definition.detail,
      label: definition.label,
      percentage: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
    };
  });

  return {
    segments,
    summary:
      totalCount > 0
        ? `${counts.personalized} of ${totalCount} stories match your reader profile.`
        : "Edition mix will appear as stories load.",
    totalCount,
  };
};

type NewsEditionQualityGateStatus = "block" | "pass" | "watch";

interface NewsEditionQualityGateCheck {
  action: string;
  detail: string;
  evidenceLabel: string;
  key: "exploration" | "guardrail" | "lead" | "reader_fit" | "source_mix";
  label: string;
  status: NewsEditionQualityGateStatus;
}

const getNewsEditionQualityLeadCheck = (
  lead: RankedNewsItem<NewsHomeItem> | undefined,
): NewsEditionQualityGateCheck => {
  if (!lead) {
    return {
      action: "Wait for ranked stories",
      detail: "No ranked lead is available yet.",
      evidenceLabel: "0 stories",
      key: "lead",
      label: "Lead story",
      status: "block",
    };
  }

  const isStrongLead =
    lead.personalizedScore >= 130 &&
    lead.sourceScore >= 80 &&
    lead.trendScore >= 75;

  return {
    action: isStrongLead ? "Keep as lead" : "Review lead placement",
    detail: isStrongLead
      ? "Front-page lead is strong enough to anchor the edition."
      : "Lead needs stronger reader fit, trust, or heat before anchoring the edition.",
    evidenceLabel: `${lead.personalizedScore} score / ${lead.trendScore} heat`,
    key: "lead",
    label: "Lead story",
    status: isStrongLead ? "pass" : "watch",
  };
};

const getNewsEditionQualitySourceCheck = (
  sourceCount: number,
): NewsEditionQualityGateCheck => {
  if (sourceCount >= 3) {
    return {
      action: "Edition has source spread",
      detail: `${sourceCount} sources keep the edition from reading like one outlet.`,
      evidenceLabel: `${sourceCount} sources`,
      key: "source_mix",
      label: "Source mix",
      status: "pass",
    };
  }

  return {
    action: "Add source variety",
    detail: `${sourceCount} ${
      sourceCount === 1 ? "source is" : "sources are"
    } not enough for a broad edition.`,
    evidenceLabel: `${sourceCount} ${sourceCount === 1 ? "source" : "sources"}`,
    key: "source_mix",
    label: "Source mix",
    status: sourceCount === 0 ? "block" : "watch",
  };
};

const getNewsEditionQualityReaderFitCheck = (
  personalizedCount: number,
): NewsEditionQualityGateCheck => ({
  action:
    personalizedCount > 0 ? "Personalization is active" : "Tune reader signals",
  detail:
    personalizedCount > 0
      ? `${personalizedCount} ${
          personalizedCount === 1 ? "story carries" : "stories carry"
        } reader profile signals.`
      : "No ranked story currently carries reader profile signals.",
  evidenceLabel: `${personalizedCount} profile ${
    personalizedCount === 1 ? "match" : "matches"
  }`,
  key: "reader_fit",
  label: "Reader fit",
  status: personalizedCount > 0 ? "pass" : "watch",
});

const getNewsEditionQualityExplorationCheck = (
  explorationCount: number,
): NewsEditionQualityGateCheck => ({
  action: explorationCount > 0 ? "Keep discovery lane" : "Add discovery lane",
  detail:
    explorationCount > 0
      ? `${explorationCount} exploration ${
          explorationCount === 1 ? "story keeps" : "stories keep"
        } the feed open.`
      : "No exploration story is currently opening the feed.",
  evidenceLabel: `${explorationCount} exploration`,
  key: "exploration",
  label: "Exploration lane",
  status: explorationCount > 0 ? "pass" : "watch",
});

const getNewsEditionQualityGuardrailCheck = (
  guardrailCount: number,
): NewsEditionQualityGateCheck => ({
  action: guardrailCount > 0 ? "Apply demotion guard" : "Watch feedback",
  detail:
    guardrailCount > 0
      ? `${guardrailCount} negative feedback ${
          guardrailCount === 1 ? "signal is" : "signals are"
        } protecting the edition.`
      : "No negative feedback guardrail is active yet.",
  evidenceLabel: `${guardrailCount} ${
    guardrailCount === 1 ? "guardrail" : "guardrails"
  }`,
  key: "guardrail",
  label: "Guardrail",
  status: guardrailCount > 0 ? "pass" : "watch",
});

export const getNewsEditionQualityGate = ({
  items,
  negativeFeedbackItems,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  negativeFeedbackItems: readonly NewsHomeItem[];
  profile: NewsPreferenceProfile;
}) => {
  if (items.length === 0) {
    const checks = [getNewsEditionQualityLeadCheck(undefined)];

    return {
      checks,
      label: "Quality Gate Waiting",
      metrics: [
        { label: "Pass", value: "0" },
        { label: "Watch", value: "0" },
        { label: "Block", value: "1" },
        { label: "Sources", value: "0" },
      ],
      summary: "Edition quality gate is waiting for ranked stories.",
    };
  }

  const sourceCount = new Set(items.map((item) => item.sourceSlug)).size;
  const personalizedCount = items.filter(
    (item) =>
      item.matchedSignals.length > 0 &&
      !item.matchedSignals.includes("exploration"),
  ).length;
  const explorationCount = items.filter((item) =>
    item.matchedSignals.includes("exploration"),
  ).length;
  const checks: NewsEditionQualityGateCheck[] = [
    getNewsEditionQualityLeadCheck(items[0]),
    getNewsEditionQualitySourceCheck(sourceCount),
    getNewsEditionQualityReaderFitCheck(personalizedCount),
    getNewsEditionQualityExplorationCheck(explorationCount),
    getNewsEditionQualityGuardrailCheck(negativeFeedbackItems.length),
  ];
  const passCount = checks.filter((check) => check.status === "pass").length;
  const watchCount = checks.filter((check) => check.status === "watch").length;
  const blockCount = checks.filter((check) => check.status === "block").length;

  return {
    checks,
    label: blockCount > 0 ? "Quality Gate Blocked" : "Quality Gate Ready",
    metrics: [
      { label: "Pass", value: String(passCount) },
      { label: "Watch", value: String(watchCount) },
      { label: "Block", value: String(blockCount) },
      { label: "Sources", value: String(sourceCount) },
    ],
    summary: `${passCount} ${
      passCount === 1 ? "check" : "checks"
    } passed with ${watchCount} watch ${
      watchCount === 1 ? "item" : "items"
    } and ${blockCount} ${
      blockCount === 1 ? "blocker" : "blockers"
    } across ${sourceCount} ${sourceCount === 1 ? "source" : "sources"}.`,
  };
};

const formatPercentage = (count: number, totalCount: number) =>
  totalCount > 0 ? `${Math.round((count / totalCount) * 100)}%` : "0%";

type NewsPersonalizationMixObjectiveLabel =
  | "Reader Match"
  | "Exploration"
  | "Trend Heat"
  | "Source Trust";

const newsPersonalizationMixDefinitions = [
  {
    detail: "Known-interest stories from explicit reader signals.",
    label: "Reader Match",
  },
  {
    detail: "Outside-profile stories used to discover adjacent interests.",
    label: "Exploration",
  },
  {
    detail:
      "High-trend stories that keep the feed connected to the live AI market.",
    label: "Trend Heat",
  },
  {
    detail: "High-trust sources used when reader signals or heat are thinner.",
    label: "Source Trust",
  },
] satisfies {
  detail: string;
  label: NewsPersonalizationMixObjectiveLabel;
}[];

const getNewsPersonalizationMixObjective = (
  item: RankedNewsItem<NewsHomeItem>,
): NewsPersonalizationMixObjectiveLabel => {
  if (item.matchedSignals.some((signal) => signal !== "exploration")) {
    return "Reader Match";
  }

  if (item.matchedSignals.includes("exploration")) return "Exploration";
  if (item.trendScore >= 85) return "Trend Heat";
  if (item.sourceScore >= 85) return "Source Trust";

  return "Source Trust";
};

const getNewsPersonalizationMixActions = ({
  counts,
  totalCount,
}: {
  counts: Record<NewsPersonalizationMixObjectiveLabel, number>;
  totalCount: number;
}) => {
  if (totalCount === 0) {
    return [
      {
        detail: "Collect stories before tuning the recommendation mix.",
        label: "Waiting for stories",
      },
    ];
  }

  return [
    {
      detail:
        counts["Reader Match"] > 0
          ? "Reader matches are leading the mix; keep saving useful matches and hide stale repeats."
          : "Pick topics, sources, or entities to create reader-match coverage.",
      label: "Tune reader match",
    },
    {
      detail:
        counts.Exploration > 0
          ? "Exploration is present; save useful surprises or hide weak ones to train adjacent coverage."
          : "Raise novelty or add adjacent topics to test exploration stories.",
      label: "Tune exploration",
    },
    {
      detail:
        counts["Trend Heat"] > 0
          ? "Trend heat is available; use Trending mode when market movement matters more than fit."
          : "Use Trending mode when you need more market heat in the edition.",
      label: "Tune heat",
    },
    {
      detail:
        counts["Source Trust"] > 0
          ? "Source-trust fallback is present; follow high-trust sources to stabilize thin topics."
          : "Follow primary sources so the feed has trusted fallback coverage.",
      label: "Tune trust",
    },
  ];
};

export const getNewsPersonalizationMix = ({
  items,
  profile,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
  profile: NewsPreferenceProfile;
}) => {
  const counts: Record<NewsPersonalizationMixObjectiveLabel, number> = {
    Exploration: 0,
    "Reader Match": 0,
    "Source Trust": 0,
    "Trend Heat": 0,
  };

  for (const item of items) {
    counts[getNewsPersonalizationMixObjective(item)] += 1;
  }

  const totalCount = items.length;
  const readerMatchPercent = formatPercentage(
    counts["Reader Match"],
    totalCount,
  );
  const explorationPercent = formatPercentage(counts.Exploration, totalCount);
  const heatPercent = formatPercentage(counts["Trend Heat"], totalCount);
  const trustPercent = formatPercentage(counts["Source Trust"], totalCount);
  const biasMode = getFeedGovernorBiasMode(profile);
  const readerMatchShare =
    totalCount > 0 ? counts["Reader Match"] / totalCount : 0;
  const explorationShare = totalCount > 0 ? counts.Exploration / totalCount : 0;
  const heatShare = totalCount > 0 ? counts["Trend Heat"] / totalCount : 0;
  const label =
    totalCount === 0
      ? "Waiting"
      : readerMatchShare >= 0.6 && counts.Exploration === 0
        ? "Profile Heavy"
        : explorationShare >= 0.3 && biasMode === "Discovery"
          ? "Discovery Mix"
          : heatShare >= 0.4 && biasMode === "Freshness"
            ? "Freshness Mix"
            : "Balanced Mix";

  return {
    actions: getNewsPersonalizationMixActions({ counts, totalCount }),
    label,
    metrics: [
      { label: "Reader match", value: readerMatchPercent },
      { label: "Exploration", value: explorationPercent },
      { label: "Heat", value: heatPercent },
      { label: "Bias", value: biasMode },
    ],
    objectives: newsPersonalizationMixDefinitions.map((definition) => ({
      count: counts[definition.label],
      detail: definition.detail,
      label: definition.label,
      shareLabel: formatPercentage(counts[definition.label], totalCount),
    })),
    summary:
      totalCount > 0
        ? `${totalCount} ${
            totalCount === 1 ? "story" : "stories"
          } tuned across reader match ${readerMatchPercent}, exploration ${explorationPercent}, heat ${heatPercent}, and trust ${trustPercent}.`
        : "Personalization mix will appear after stories are ranked.",
  };
};

type NewsExperimentAllocationArmKey =
  | "collaborative_lift"
  | "exploration"
  | "freshness_probe"
  | "reader_match"
  | "trust_guard";

interface NewsExperimentAllocationArmDefinition {
  action: string;
  allocation: number;
  key: NewsExperimentAllocationArmKey;
  label: string;
  objective: string;
}

const newsExperimentAllocationDefinitions = [
  {
    action: "Keep explicit reader matches in the lead slot.",
    allocation: 30,
    key: "reader_match",
    label: "Reader Match",
    objective: "Exploit known preferences.",
  },
  {
    action: "Use cohort lift as a secondary boost, not a replacement.",
    allocation: 25,
    key: "collaborative_lift",
    label: "Collaborative Lift",
    objective: "Test what similar readers are rewarding.",
  },
  {
    action: "Keep exploration visible while novelty is high.",
    allocation: 20,
    key: "exploration",
    label: "Exploration",
    objective: "Discover adjacent interests.",
  },
  {
    action: "Reserve a freshness probe for fast-moving AI stories.",
    allocation: 15,
    key: "freshness_probe",
    label: "Freshness Probe",
    objective: "Catch high-velocity market movement.",
  },
  {
    action: "Keep guarded stories out of promotion until verified.",
    allocation: 10,
    key: "trust_guard",
    label: "Trust Guard",
    objective: "Measure risk without amplifying weak sources.",
  },
] as const satisfies readonly NewsExperimentAllocationArmDefinition[];

const getNewsExperimentReaderMatchCount = ({
  items,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
}) =>
  items.filter((item) =>
    item.matchedSignals.some((signal) => signal !== "exploration"),
  ).length;

export const getNewsExperimentAllocation = ({
  formatCategory,
  historyItems,
  items,
  negativeFeedbackItems,
  profile,
  savedItems,
}: {
  formatCategory: (category: string) => string;
  historyItems: readonly NewsReaderMemoryItem[];
  items: readonly RankedNewsItem<NewsHomeItem>[];
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const totalCount = items.length;
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const readerSignalCount =
    normalizedProfile.preferredCategories.length +
    normalizedProfile.preferredSources.length +
    normalizedProfile.preferredEntities.length;
  const readerMatchCount = getNewsExperimentReaderMatchCount({
    items,
  });
  const collaborativeSignals = getNewsCollaborativeSignals({
    formatCategory,
    historyItems,
    items,
    limit: 2,
    negativeFeedbackItems,
    profile: normalizedProfile,
    savedItems,
  });
  const collaborativeCandidateCount = collaborativeSignals.signals.length;
  const explorationCount = items.filter((item) =>
    item.matchedSignals.includes("exploration"),
  ).length;
  const highHeatCount = items.filter(
    (item) => item.trendScore >= 85 && item.sourceScore >= 60,
  ).length;
  const lowTrustHighHeatCount = items.filter(
    (item) => item.sourceScore < 60 && item.trendScore >= 85,
  ).length;
  const guardrailCount =
    lowTrustHighHeatCount > 0 || negativeFeedbackItems.length > 0 ? 1 : 0;

  if (totalCount === 0) {
    return {
      arms: [],
      label: "Cold Experiment",
      metrics: [
        { label: "Active arms", value: "0" },
        { label: "Allocation", value: "0%" },
        { label: "Stories", value: "0" },
        { label: "Guardrails", value: "0" },
      ],
      summary: "Experiment allocation will appear after stories are ranked.",
    };
  }

  const armStats: Record<
    NewsExperimentAllocationArmKey,
    { active: boolean; storyCount: number; trigger: string }
  > = {
    collaborative_lift: {
      active: collaborativeCandidateCount > 0,
      storyCount: collaborativeCandidateCount,
      trigger: `${collaborativeCandidateCount} cohort ${
        collaborativeCandidateCount === 1 ? "candidate is" : "candidates are"
      } available.`,
    },
    exploration: {
      active: explorationCount > 0 || normalizedProfile.noveltyBias > 1,
      storyCount: explorationCount,
      trigger: `${explorationCount} exploration ${
        explorationCount === 1 ? "story" : "stories"
      } and ${normalizedProfile.noveltyBias} novelty bias.`,
    },
    freshness_probe: {
      active: highHeatCount > 0 || normalizedProfile.recencyBias > 1,
      storyCount: highHeatCount,
      trigger: `${highHeatCount} high-heat ${
        highHeatCount === 1 ? "story" : "stories"
      } and ${normalizedProfile.recencyBias} recency bias.`,
    },
    reader_match: {
      active: readerMatchCount > 0 && readerSignalCount > 0,
      storyCount: readerMatchCount,
      trigger: `${readerSignalCount} reader ${
        readerSignalCount === 1 ? "signal" : "signals"
      } and ${readerMatchCount} matching ${
        readerMatchCount === 1 ? "story" : "stories"
      }.`,
    },
    trust_guard: {
      active: lowTrustHighHeatCount > 0 || negativeFeedbackItems.length > 0,
      storyCount: lowTrustHighHeatCount,
      trigger: `${lowTrustHighHeatCount} low-trust high-heat ${
        lowTrustHighHeatCount === 1 ? "story" : "stories"
      } and ${Math.min(negativeFeedbackItems.length, 1)} Less signal.`,
    },
  };

  const arms = newsExperimentAllocationDefinitions
    .filter((definition) => armStats[definition.key].active)
    .map((definition) => ({
      action: definition.action,
      allocationLabel: `${definition.allocation}%`,
      key: definition.key,
      label: definition.label,
      objective: definition.objective,
      storyCount: armStats[definition.key].storyCount,
      trigger: armStats[definition.key].trigger,
    }));
  const allocationTotal = arms.reduce((sum, arm) => {
    const allocation = Number.parseInt(arm.allocationLabel, 10);

    return sum + (Number.isNaN(allocation) ? 0 : allocation);
  }, 0);
  const [leadArm] = arms;

  return {
    arms,
    label: `${arms.length} Active ${arms.length === 1 ? "Arm" : "Arms"}`,
    metrics: [
      { label: "Active arms", value: String(arms.length) },
      { label: "Allocation", value: `${allocationTotal}%` },
      { label: "Stories", value: String(totalCount) },
      { label: "Guardrails", value: String(guardrailCount) },
    ],
    summary: `For You traffic is split across ${arms.length} experiment ${
      arms.length === 1 ? "arm" : "arms"
    }; ${leadArm?.label ?? "No arm"} leads at ${
      leadArm?.allocationLabel ?? "0%"
    }.`,
  };
};

const getNewsRecommendationAuditEntityBalance = (
  items: readonly RankedNewsItem<NewsHomeItem>[],
) => {
  const entityEntries = new Map<
    string,
    { count: number; firstIndex: number; key: string; label: string }
  >();

  items.forEach((item, index) => {
    const seenEntities = new Set<string>();

    for (const entity of item.entities) {
      const key = normalizePreferenceSignal(entity);
      const entry = {
        count: 0,
        firstIndex: index,
        key,
        label: entity.trim(),
      };

      if (
        !key ||
        seenEntities.has(key) ||
        !entry.label ||
        !isFeedGovernorSpecificEntity(entry)
      ) {
        continue;
      }

      const existing = entityEntries.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        entityEntries.set(key, {
          count: 1,
          firstIndex: index,
          key,
          label: entry.label,
        });
      }

      seenEntities.add(key);
    }
  });

  const sortedEntities = [...entityEntries.values()].sort(
    compareFeedGovernorEntries,
  );
  const [topEntity] = sortedEntities;
  const topEntityShare =
    topEntity && items.length > 0 ? topEntity.count / items.length : 0;

  return {
    hasEntityConcentration:
      topEntity !== undefined && topEntity.count >= 2 && topEntityShare > 0.5,
    uniqueEntityCount: sortedEntities.length,
  };
};

export const getNewsRecommendationAudit = ({
  items,
  profile,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
  profile: NewsPreferenceProfile;
}) => {
  const editionMix = getNewsEditionMix({ items });
  const sourceBalance = getNewsSourceBalance({ items });
  const entityBalance = getNewsRecommendationAuditEntityBalance(items);
  const readerSignalSummary = getNewsReaderSignalSummary(profile);
  const personalizedCount =
    editionMix.segments.find((segment) => segment.label === "Personalized")
      ?.count ?? 0;
  const explorationCount =
    editionMix.segments.find((segment) => segment.label === "Exploration")
      ?.count ?? 0;
  const trendLedCount =
    editionMix.segments.find((segment) => segment.label === "Trending")
      ?.count ?? 0;
  const totalCount = editionMix.totalCount;
  const hasReaderSignals = readerSignalSummary.signalCount > 0;
  const hasSourceConcentration =
    sourceBalance.concentration === "Single source" ||
    sourceBalance.concentration === "Concentrated";
  const label = !hasReaderSignals
    ? "Cold Start"
    : explorationCount > 0 && !hasSourceConcentration
      ? "Balanced For You"
      : hasSourceConcentration
        ? "Narrow Profile"
        : "Learning Profile";
  const sourceLabel =
    sourceBalance.uniqueSourceCount === 1 ? "source" : "sources";
  const entityLabel =
    entityBalance.uniqueEntityCount === 1 ? "entity" : "entities";
  const notices: { detail: string; label: string }[] = [];

  if (hasReaderSignals && explorationCount > 0) {
    notices.push({
      detail:
        "Exploration stories are present, so the feed is testing useful AI coverage outside the current profile.",
      label: "Filter-bubble guard",
    });
  } else if (!hasReaderSignals) {
    notices.push({
      detail:
        "Read, save, or hide stories to train the recommendation profile.",
      label: "Learning needed",
    });
  } else {
    notices.push({
      detail:
        "No exploration stories are currently in this slice, so the feed is leaning on known reader signals.",
      label: "Exploration gap",
    });
  }

  if (hasSourceConcentration) {
    notices.push({
      detail:
        "One source dominates this edition; add sources or ingest more stories to broaden coverage.",
      label: "Source concentration",
    });
  } else {
    notices.push({
      detail:
        "No source owns more than half of this edition, keeping the front page diversified.",
      label: "Source diversity",
    });
  }

  if (entityBalance.hasEntityConcentration) {
    notices.push({
      detail:
        "One entity dominates this edition; add adjacent entities or exploration stories to broaden coverage.",
      label: "Entity concentration",
    });
  } else {
    notices.push({
      detail:
        "No entity owns more than half of this edition, keeping the recommendation mix broad.",
      label: "Entity diversity",
    });
  }

  return {
    label,
    metrics: [
      {
        label: "Personalized",
        value: formatPercentage(personalizedCount, totalCount),
      },
      {
        label: "Exploration",
        value: formatPercentage(explorationCount, totalCount),
      },
      {
        label: "Source spread",
        value: `${sourceBalance.uniqueSourceCount} ${sourceLabel}`,
      },
      {
        label: "Entity spread",
        value: `${entityBalance.uniqueEntityCount} ${entityLabel}`,
      },
      {
        label: "Reader signals",
        value: String(readerSignalSummary.signalCount),
      },
    ],
    notices,
    summary: `${totalCount} ${
      totalCount === 1 ? "story" : "stories"
    }: ${personalizedCount} personalized, ${explorationCount} exploratory, and ${trendLedCount} trend-led across ${
      sourceBalance.uniqueSourceCount
    } ${sourceLabel} and ${entityBalance.uniqueEntityCount} ${entityLabel}.`,
  };
};

type NewsRecommendationRotationLabel =
  | "Exploration"
  | "Market Heat"
  | "Reader Match"
  | "Source Trust";

interface NewsRecommendationRotationDefinition {
  label: NewsRecommendationRotationLabel;
  reason: string;
}

const newsRecommendationRotationDisplay = {
  exploration: {
    label: "Exploration",
    reason: "Adjacent coverage tests what the reader may want next.",
  },
  market_heat: {
    label: "Market Heat",
    reason: "High trend keeps the edition connected to the live market.",
  },
  reader_match: {
    label: "Reader Match",
    reason: "Profile signals make this the safest next story.",
  },
  source_trust: {
    label: "Source Trust",
    reason: "High-trust coverage stabilizes the recommendation mix.",
  },
} satisfies Record<
  NewsRecommendationRotationObjective,
  NewsRecommendationRotationDefinition
>;

const formatNewsRecommendationRotationScore = ({
  score,
  scoreKind,
}: {
  score: number;
  scoreKind: NewsRecommendationRotationScoreKind;
}) => `${score} ${scoreKind}`;

export const getNewsRecommendationRotationQueue = ({
  formatCategory,
  items,
  limit,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  profile: NewsPreferenceProfile;
}) => {
  const entries = selectNewsRecommendationRotationSlots({
    items,
    limit,
  }).map(({ item, objective, score, scoreKind }) => {
    const display = newsRecommendationRotationDisplay[objective];

    return {
      categoryLabel: formatCategory(item.category),
      id: item.id,
      label: display.label,
      reason: display.reason,
      scoreLabel: formatNewsRecommendationRotationScore({
        score,
        scoreKind,
      }),
      sourceName: item.sourceName,
      title: item.title,
    };
  });

  const readerCount = entries.filter(
    (entry) => entry.label === "Reader Match",
  ).length;
  const explorationCount = entries.filter(
    (entry) => entry.label === "Exploration",
  ).length;
  const sourceCount = new Set(entries.map((entry) => entry.sourceName)).size;

  if (entries.length === 0) {
    return {
      entries,
      label: "Rotation Waiting",
      metrics: [
        { label: "Slots", value: "0" },
        { label: "Reader", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Sources", value: "0" },
      ],
      summary: "Recommendation rotation will appear after stories are ranked.",
    };
  }

  return {
    entries,
    label: "Rotation Ready",
    metrics: [
      { label: "Slots", value: String(entries.length) },
      { label: "Reader", value: String(readerCount) },
      { label: "Explore", value: String(explorationCount) },
      { label: "Sources", value: String(sourceCount) },
    ],
    summary: `${entries.length} rotation ${
      entries.length === 1 ? "slot blends" : "slots blend"
    } reader fit, exploration, market heat, and source trust across ${sourceCount} ${
      sourceCount === 1 ? "source" : "sources"
    }.`,
  };
};

const formatRecommendationTraceList = (values: readonly string[]) => {
  if (values.length === 0) return "reader signals";
  if (values.length === 1) return values[0] ?? "reader signals";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
};

const getRecommendationTraceProfileSignals = ({
  formatCategory,
  item,
  profile,
}: {
  formatCategory: (category: string) => string;
  item: RankedNewsItem<NewsHomeItem>;
  profile: NewsPreferenceProfile;
}) => {
  const signals: string[] = [];

  if (hasPreferenceSignal(profile.preferredCategories, item.category)) {
    signals.push(formatCategory(item.category));
  }

  if (hasPreferenceSignal(profile.preferredSources, item.sourceSlug)) {
    signals.push(item.sourceName);
  }

  for (const entity of item.entities) {
    if (
      hasPreferenceSignal(profile.preferredEntities, entity) &&
      !signals.includes(entity)
    ) {
      signals.push(entity);
    }
  }

  return signals.slice(0, 3);
};

const getRecommendationTraceGuardSignals = ({
  formatCategory,
  item,
}: {
  formatCategory: (category: string) => string;
  item: NewsReaderMemoryItem;
}) => {
  const signals = [formatCategory(item.category)];
  const [entity] = item.entities;

  if (entity) signals.push(entity);
  if (item.sourceName) signals.push(item.sourceName);

  return signals;
};

const nonReaderRecommendationTraceSignals = new Set([
  "daypart",
  "exploration",
  "source_corroboration",
]);

const getRecommendationTraceReaderSignalCount = (
  item: RankedNewsItem<NewsHomeItem> | undefined,
) =>
  item
    ? item.matchedSignals.filter(
        (signal) => !nonReaderRecommendationTraceSignals.has(signal),
      ).length
    : 0;

export const getNewsRecommendationTrace = ({
  formatCategory,
  historyItems,
  items,
  limit,
  negativeFeedbackItems,
  profile,
}: {
  formatCategory: (category: string) => string;
  historyItems: readonly NewsReaderMemoryItem[];
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
  profile: NewsPreferenceProfile;
}) => {
  const [leadItem] = items;
  const leadReaderSignalCount =
    getRecommendationTraceReaderSignalCount(leadItem);
  const explorationItems = items.filter((item) =>
    item.matchedSignals.includes("exploration"),
  );
  const verifiedCoverageItems = items.filter((item) =>
    item.matchedSignals.includes("source_corroboration"),
  );
  const editionTimedItems = items.filter((item) =>
    item.matchedSignals.includes("daypart"),
  );

  if (!leadItem) {
    return {
      label: "Trace Waiting",
      metrics: [
        { label: "Lead score", value: "0" },
        { label: "Reader matches", value: "0" },
        { label: "Verified", value: "0" },
        { label: "Timed", value: "0" },
        { label: "Exploration", value: "0" },
        { label: "Guardrails", value: "0" },
      ],
      steps: [],
      summary: "Recommendation trace will appear after stories are ranked.",
    };
  }

  const steps: {
    detail: string;
    label: string;
    scoreLabel: string;
    title: string;
  }[] = [
    {
      detail: `${leadItem.sourceName} leads because ${leadReaderSignalCount} reader ${
        leadReaderSignalCount === 1 ? "signal" : "signals"
      } meet ${leadItem.sourceScore} trust and ${leadItem.trendScore} heat.`,
      label: "Lead story",
      scoreLabel: `${leadItem.personalizedScore} score`,
      title: leadItem.title,
    },
  ];
  const readerProfileItem =
    items.find(
      (item) =>
        getRecommendationTraceProfileSignals({
          formatCategory,
          item,
          profile,
        }).length > 0,
    ) ?? leadItem;
  const profileSignals = getRecommendationTraceProfileSignals({
    formatCategory,
    item: readerProfileItem,
    profile,
  });

  if (profileSignals.length > 0) {
    steps.push({
      detail: `${formatRecommendationTraceList(
        profileSignals,
      )} match the active profile.`,
      label: "Reader profile",
      scoreLabel: `${profileSignals.length} ${
        profileSignals.length === 1 ? "signal" : "signals"
      }`,
      title: readerProfileItem.title,
    });
  }

  const [verifiedCoverageItem] = verifiedCoverageItems;
  if (verifiedCoverageItem) {
    steps.push({
      detail: `${verifiedCoverageItem.sourceName} is lifted because independent sources are confirming the same development.`,
      label: "Verified coverage",
      scoreLabel: `${verifiedCoverageItems.length} ${
        verifiedCoverageItems.length === 1 ? "story" : "stories"
      }`,
      title: verifiedCoverageItem.title,
    });
  }

  const [editionTimedItem] = editionTimedItems;
  if (editionTimedItem) {
    steps.push({
      detail: `${formatCategory(
        editionTimedItem.category,
      )} is timed for the reader's current edition context.`,
      label: "Edition timing",
      scoreLabel: `${editionTimedItems.length} ${
        editionTimedItems.length === 1 ? "story" : "stories"
      }`,
      title: editionTimedItem.title,
    });
  }

  const [explorationItem] = explorationItems;
  if (explorationItem) {
    steps.push({
      detail: `${formatCategory(
        explorationItem.category,
      )} adds adjacent coverage outside the active profile after ${
        historyItems.length
      } ${historyItems.length === 1 ? "read" : "reads"}.`,
      label: "Exploration check",
      scoreLabel: `${explorationItems.length} ${
        explorationItems.length === 1 ? "story" : "stories"
      }`,
      title: explorationItem.title,
    });
  }

  const [negativeFeedbackItem] = negativeFeedbackItems;
  if (negativeFeedbackItem) {
    steps.push({
      detail: `Less feedback guards ${formatRecommendationTraceList(
        getRecommendationTraceGuardSignals({
          formatCategory,
          item: negativeFeedbackItem,
        }),
      )}.`,
      label: "Guardrail",
      scoreLabel: `${negativeFeedbackItems.length} ${
        negativeFeedbackItems.length === 1 ? "signal" : "signals"
      }`,
      title: negativeFeedbackItem.title,
    });
  }

  const visibleSteps = steps.slice(0, Math.max(0, limit));

  return {
    label: "Trace Ready",
    metrics: [
      { label: "Lead score", value: String(leadItem.personalizedScore) },
      { label: "Reader matches", value: String(leadReaderSignalCount) },
      { label: "Verified", value: String(verifiedCoverageItems.length) },
      { label: "Timed", value: String(editionTimedItems.length) },
      { label: "Exploration", value: String(explorationItems.length) },
      { label: "Guardrails", value: String(negativeFeedbackItems.length) },
    ],
    steps: visibleSteps,
    summary: `Trace explains ${visibleSteps.length} ranking ${
      visibleSteps.length === 1 ? "decision" : "decisions"
    } across ${items.length} ${items.length === 1 ? "story" : "stories"}.`,
  };
};

type NewsEditorialGuardrailSeverity = "high" | "medium" | "low";

const toNewsEditorialGuardrailStory = (item: RankedNewsItem<NewsHomeItem>) => ({
  id: item.id,
  sourceName: item.sourceName,
  title: item.title,
});

const getNewsEditorialNegativeFeedbackMatches = ({
  items,
  negativeFeedbackItems,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
  negativeFeedbackItems: readonly NewsHomeItem[];
}) => {
  if (negativeFeedbackItems.length === 0) return [];

  const negativeCategories = new Set(
    negativeFeedbackItems.map((item) =>
      normalizePreferenceSignal(item.category),
    ),
  );
  const negativeEntities = new Set(
    negativeFeedbackItems.flatMap((item) =>
      item.entities.map(normalizePreferenceSignal),
    ),
  );
  const negativeSources = new Set(
    negativeFeedbackItems.map((item) =>
      normalizePreferenceSignal(item.sourceSlug),
    ),
  );

  return items.filter((item) => {
    const category = normalizePreferenceSignal(item.category);
    const source = normalizePreferenceSignal(item.sourceSlug);

    return (
      negativeCategories.has(category) ||
      negativeSources.has(source) ||
      item.entities.some((entity) =>
        negativeEntities.has(normalizePreferenceSignal(entity)),
      )
    );
  });
};

const getNewsEditorialSourceConcentrationRisk = ({
  items,
  limit,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
}) => {
  const totalCount = items.length;
  const sourceCounts = new Map<
    string,
    { count: number; name: string; slug: string }
  >();

  for (const item of items) {
    const current = sourceCounts.get(item.sourceSlug);

    sourceCounts.set(item.sourceSlug, {
      count: current ? current.count + 1 : 1,
      name: current?.name ?? item.sourceName,
      slug: item.sourceSlug,
    });
  }

  const dominantSource = [...sourceCounts.values()].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;

    return left.name.localeCompare(right.name);
  })[0];

  if (!dominantSource) return null;

  const sourceShare = totalCount > 0 ? dominantSource.count / totalCount : 0;

  if (dominantSource.count < 2 || sourceShare < 0.6) return null;

  return {
    action: `Mix another source before promoting more ${dominantSource.name} coverage.`,
    detail: `${dominantSource.name} carries ${dominantSource.count} of ${totalCount} stories in this slice.`,
    label: "Source concentration",
    severity: sourceShare >= 0.75 ? "high" : "medium",
    stories: items
      .filter((item) => item.sourceSlug === dominantSource.slug)
      .slice(0, limit)
      .map(toNewsEditorialGuardrailStory),
  } satisfies {
    action: string;
    detail: string;
    label: string;
    severity: NewsEditorialGuardrailSeverity;
    stories: ReturnType<typeof toNewsEditorialGuardrailStory>[];
  };
};

const getNewsEditorialSingleSourceThreads = ({
  items,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
}) => {
  const entityThreads = new Map<
    string,
    {
      entity: string;
      items: RankedNewsItem<NewsHomeItem>[];
      sourceNames: Set<string>;
      sourceSlugs: Set<string>;
    }
  >();

  for (const item of items) {
    for (const entity of item.entities) {
      const key = normalizePreferenceSignal(entity);
      const current = entityThreads.get(key) ?? {
        entity,
        items: [],
        sourceNames: new Set<string>(),
        sourceSlugs: new Set<string>(),
      };

      current.items.push(item);
      current.sourceNames.add(item.sourceName);
      current.sourceSlugs.add(item.sourceSlug);
      entityThreads.set(key, current);
    }
  }

  return [...entityThreads.values()]
    .filter(
      (thread) => thread.items.length >= 3 && thread.sourceSlugs.size === 1,
    )
    .sort((left, right) => {
      if (right.items.length !== left.items.length) {
        return right.items.length - left.items.length;
      }

      return left.entity.localeCompare(right.entity);
    });
};

const getNewsEditorialEntityConcentrationRisk = ({
  items,
  limit,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
}) => {
  const totalCount = items.length;
  const entityCounts = new Map<
    string,
    {
      entity: string;
      items: RankedNewsItem<NewsHomeItem>[];
      sourceSlugs: Set<string>;
    }
  >();

  for (const item of items) {
    const seenEntities = new Set<string>();

    for (const entity of item.entities) {
      const key = normalizePreferenceSignal(entity);
      const entry = {
        count: 0,
        firstIndex: 0,
        key,
        label: entity,
      } satisfies NewsFeedGovernorEntry;

      if (
        !key ||
        seenEntities.has(key) ||
        !isFeedGovernorSpecificEntity(entry)
      ) {
        continue;
      }

      const current = entityCounts.get(key) ?? {
        entity,
        items: [],
        sourceSlugs: new Set<string>(),
      };

      current.items.push(item);
      current.sourceSlugs.add(item.sourceSlug);
      entityCounts.set(key, current);
      seenEntities.add(key);
    }
  }

  const dominantEntity = [...entityCounts.values()].sort((left, right) => {
    if (right.items.length !== left.items.length) {
      return right.items.length - left.items.length;
    }

    return left.entity.localeCompare(right.entity);
  })[0];

  if (!dominantEntity) return null;

  const entityShare =
    totalCount > 0 ? dominantEntity.items.length / totalCount : 0;

  if (
    dominantEntity.items.length < 3 ||
    dominantEntity.sourceSlugs.size < 2 ||
    entityShare < 0.6
  ) {
    return null;
  }

  return {
    action: `Mix another entity before promoting more ${dominantEntity.entity} coverage.`,
    detail: `${dominantEntity.entity} appears in ${dominantEntity.items.length} of ${totalCount} stories across ${dominantEntity.sourceSlugs.size} sources.`,
    label: "Entity concentration",
    severity: entityShare >= 0.75 ? "high" : "medium",
    stories: dominantEntity.items
      .slice(0, limit)
      .map(toNewsEditorialGuardrailStory),
  } satisfies {
    action: string;
    detail: string;
    label: string;
    severity: NewsEditorialGuardrailSeverity;
    stories: ReturnType<typeof toNewsEditorialGuardrailStory>[];
  };
};

export const getNewsEditorialGuardrails = ({
  items,
  limit,
  negativeFeedbackItems,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  negativeFeedbackItems: readonly NewsHomeItem[];
}) => {
  const totalCount = items.length;
  const storyLimit = Math.max(0, limit);

  if (totalCount === 0) {
    return {
      label: "Waiting",
      metrics: [
        { label: "Risks", value: "0" },
        { label: "Single-source", value: "0" },
        { label: "Entity concentration", value: "0" },
        { label: "Low-trust", value: "0" },
        { label: "Negative matches", value: "0" },
      ],
      risks: [],
      summary: "Editorial guardrails will appear after stories are ranked.",
    };
  }

  const risks: {
    action: string;
    detail: string;
    label: string;
    severity: NewsEditorialGuardrailSeverity;
    stories: ReturnType<typeof toNewsEditorialGuardrailStory>[];
  }[] = [];
  const sourceConcentrationRisk = getNewsEditorialSourceConcentrationRisk({
    items,
    limit: storyLimit,
  });
  const singleSourceThreads = getNewsEditorialSingleSourceThreads({ items });
  const entityConcentrationRisk = getNewsEditorialEntityConcentrationRisk({
    items,
    limit: storyLimit,
  });
  const lowTrustItems = items.filter((item) => item.sourceScore < 60);
  const negativeMatchedItems = getNewsEditorialNegativeFeedbackMatches({
    items,
    negativeFeedbackItems,
  });

  if (sourceConcentrationRisk) risks.push(sourceConcentrationRisk);
  if (entityConcentrationRisk) risks.push(entityConcentrationRisk);

  const leadSingleSourceThread = singleSourceThreads[0];
  if (leadSingleSourceThread) {
    const sourceName =
      [...leadSingleSourceThread.sourceNames][0] ?? "one source";
    risks.push({
      action: `Wait for another source before treating ${leadSingleSourceThread.entity} coverage as consensus.`,
      detail: `${leadSingleSourceThread.entity} appears in ${leadSingleSourceThread.items.length} stories from ${sourceName} only.`,
      label: "Single-source thread",
      severity: "medium",
      stories: leadSingleSourceThread.items
        .slice(0, storyLimit)
        .map(toNewsEditorialGuardrailStory),
    });
  }

  if (lowTrustItems.length > 0) {
    risks.push({
      action:
        "Keep low-trust items below lead positions unless another source confirms them.",
      detail: `${lowTrustItems.length} ${
        lowTrustItems.length === 1 ? "story is" : "stories are"
      } below the source trust floor.`,
      label: "Low-trust source",
      severity: "medium",
      stories: lowTrustItems
        .slice(0, storyLimit)
        .map(toNewsEditorialGuardrailStory),
    });
  }

  if (negativeMatchedItems.length > 0) {
    risks.push({
      action:
        "Keep matching stories in suppress or exploration lanes until the reader saves one.",
      detail: `${negativeMatchedItems.length} ${
        negativeMatchedItems.length === 1 ? "story matches" : "stories match"
      } hidden reader signals.`,
      label: "Negative feedback match",
      severity: "low",
      stories: negativeMatchedItems
        .slice(0, storyLimit)
        .map(toNewsEditorialGuardrailStory),
    });
  }

  return {
    label: risks.length > 0 ? "Guardrail Watch" : "Guardrails Clear",
    metrics: [
      { label: "Risks", value: String(risks.length) },
      { label: "Single-source", value: String(singleSourceThreads.length) },
      {
        label: "Entity concentration",
        value: entityConcentrationRisk ? "1" : "0",
      },
      { label: "Low-trust", value: String(lowTrustItems.length) },
      { label: "Negative matches", value: String(negativeMatchedItems.length) },
    ],
    risks,
    summary:
      risks.length > 0
        ? `${risks.length} editorial ${
            risks.length === 1 ? "guardrail" : "guardrails"
          } active across ${totalCount} ranked ${
            totalCount === 1 ? "story" : "stories"
          }.`
        : `No editorial guardrails active across ${totalCount} ranked ${
            totalCount === 1 ? "story" : "stories"
          }.`,
  };
};

type NewsFeedRecipeSliceLabel =
  | "Reader signals"
  | "Verified coverage"
  | "Edition timing"
  | "Exploration"
  | "Trend heat"
  | "Source trust"
  | "Freshness";

const newsFeedRecipeSliceDefinitions = [
  {
    detail: "Profile matches are leading known-interest coverage.",
    label: "Reader signals",
    summaryLabel: "reader-led",
  },
  {
    detail:
      "Corroborated stories surface when independent sources confirm the same development.",
    label: "Verified coverage",
    summaryLabel: "verified coverage",
  },
  {
    detail:
      "Edition timing promotes stories that fit the reader's current daypart.",
    label: "Edition timing",
    summaryLabel: "edition-timed",
  },
  {
    detail: "Exploration slots test coverage outside the current profile.",
    label: "Exploration",
    summaryLabel: "exploration",
  },
  {
    detail: "High-heat stories keep the edition connected to the live market.",
    label: "Trend heat",
    summaryLabel: "trend-led",
  },
  {
    detail: "High-trust sources anchor the recipe when signals are thin.",
    label: "Source trust",
    summaryLabel: "source-trust",
  },
  {
    detail:
      "Freshness fallback keeps the river moving between stronger signals.",
    label: "Freshness",
    summaryLabel: "freshness fallback",
  },
] satisfies {
  detail: string;
  label: NewsFeedRecipeSliceLabel;
  summaryLabel: string;
}[];

const toNewsFeedRecipeStory = (item: RankedNewsItem<NewsHomeItem>) => ({
  id: item.id,
  sourceName: item.sourceName,
  title: item.title,
});

const getNewsFeedRecipeSliceLabel = (
  item: RankedNewsItem<NewsHomeItem>,
): NewsFeedRecipeSliceLabel => {
  if (item.matchedSignals.includes("source_corroboration")) {
    return "Verified coverage";
  }

  if (item.matchedSignals.includes("daypart")) {
    return "Edition timing";
  }

  if (
    item.matchedSignals.some(
      (signal) =>
        signal !== "exploration" &&
        signal !== "source_corroboration" &&
        signal !== "daypart",
    )
  ) {
    return "Reader signals";
  }

  if (item.matchedSignals.includes("exploration")) return "Exploration";
  if (item.trendScore >= 85) return "Trend heat";
  if (item.sourceScore >= 85) return "Source trust";

  return "Freshness";
};

const joinNewsFeedRecipeSummaryParts = (parts: readonly string[]) => {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;

  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
};

export const getNewsFeedRecipe = ({
  items,
  profile,
  storiesPerSlice,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
  profile: NewsPreferenceProfile;
  storiesPerSlice: number;
}) => {
  const itemsBySlice = new Map<
    NewsFeedRecipeSliceLabel,
    RankedNewsItem<NewsHomeItem>[]
  >(newsFeedRecipeSliceDefinitions.map((definition) => [definition.label, []]));

  for (const item of items) {
    const sliceLabel = getNewsFeedRecipeSliceLabel(item);
    itemsBySlice.get(sliceLabel)?.push(item);
  }

  const totalCount = items.length;
  const slices = newsFeedRecipeSliceDefinitions.map((definition) => {
    const sliceItems = itemsBySlice.get(definition.label) ?? [];

    return {
      count: sliceItems.length,
      detail: definition.detail,
      label: definition.label,
      percentage:
        totalCount > 0 ? Math.round((sliceItems.length / totalCount) * 100) : 0,
      stories: sliceItems.slice(0, storiesPerSlice).map(toNewsFeedRecipeStory),
    };
  });
  const dominantSlice = [...slices].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;

    return (
      newsFeedRecipeSliceDefinitions.findIndex(
        (definition) => definition.label === left.label,
      ) -
      newsFeedRecipeSliceDefinitions.findIndex(
        (definition) => definition.label === right.label,
      )
    );
  })[0];
  const readerSignalSummary = getNewsReaderSignalSummary(profile);
  const signalLabel = `${readerSignalSummary.signalCount} ${
    readerSignalSummary.signalCount === 1 ? "signal" : "signals"
  }`;
  const summaryParts = newsFeedRecipeSliceDefinitions
    .map((definition) => {
      const count =
        slices.find((slice) => slice.label === definition.label)?.count ?? 0;

      return `${count} ${definition.summaryLabel}`;
    })
    .filter((part) => !part.startsWith("0 "));

  return {
    label:
      totalCount === 0
        ? "Waiting"
        : readerSignalSummary.signalCount > 0
          ? "Personalized Recipe"
          : "Cold Start Recipe",
    metrics: slices.map((slice) => ({
      label: slice.label,
      value: String(slice.count),
    })),
    signals: [
      { label: "Signal strength", value: signalLabel },
      { label: "Bias mode", value: getFeedGovernorBiasMode(profile) },
      {
        label: "Dominant slice",
        value:
          dominantSlice && dominantSlice.count > 0
            ? dominantSlice.label
            : "None",
      },
    ],
    slices,
    summary:
      totalCount > 0
        ? `${totalCount} ${
            totalCount === 1 ? "story" : "stories"
          }: ${joinNewsFeedRecipeSummaryParts(summaryParts)}.`
        : "Feed recipe will appear as stories rank.",
  };
};

const getRankingPipelineSourceSignals = (
  items: readonly RankedNewsItem<NewsHomeItem>[],
) =>
  getUniqueSignals(
    items.map((item) => item.sourceName),
    4,
  );

const countAdjacentSourceRepeats = (
  items: readonly RankedNewsItem<NewsHomeItem>[],
) => {
  let repeatCount = 0;

  for (const [index, item] of items.entries()) {
    const previousItem = items[index - 1];
    if (previousItem && previousItem.sourceSlug === item.sourceSlug) {
      repeatCount += 1;
    }
  }

  return repeatCount;
};

const countAdjacentEntityRepeats = (
  items: readonly RankedNewsItem<NewsHomeItem>[],
) => {
  let repeatCount = 0;

  for (const [index, item] of items.entries()) {
    const previousItem = items[index - 1];

    if (previousItem && getSharedFeedFatigueEntity(item, previousItem)) {
      repeatCount += 1;
    }
  }

  return repeatCount;
};

export const getNewsRankingPipeline = ({
  historyItems,
  items,
  negativeFeedbackItems,
  profile,
  savedItems,
}: {
  historyItems: readonly NewsReaderMemoryItem[];
  items: readonly RankedNewsItem<NewsHomeItem>[];
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const totalCount = items.length;
  const sourceSignals = getRankingPipelineSourceSignals(items);
  const sourceCount = new Set(items.map((item) => item.sourceSlug)).size;
  const readerSignalSummary = getNewsReaderSignalSummary(profile);
  const biasMode = getFeedGovernorBiasMode(profile);
  const personalizedItems = items.filter((item) =>
    item.matchedSignals.some((signal) => signal !== "exploration"),
  );
  const explorationItems = items.filter((item) =>
    item.matchedSignals.includes("exploration"),
  );
  const adjacentSourceRepeats = countAdjacentSourceRepeats(items);
  const adjacentEntityRepeats = countAdjacentEntityRepeats(items);
  const positiveItems = [...savedItems, ...historyItems];
  const guardrailCount =
    negativeFeedbackItems.length +
    adjacentSourceRepeats +
    adjacentEntityRepeats;
  const sourceLabel = sourceCount === 1 ? "source" : "sources";

  if (totalCount === 0) {
    return {
      label: "Cold Ranker",
      metrics: [
        { label: "Candidates", value: "0" },
        { label: "Personalized", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Guardrails", value: "0" },
      ],
      stages: [
        {
          detail:
            "Waiting for collected stories before candidate recall can run.",
          label: "Candidate recall",
          signals: [],
          value: "0 stories",
        },
        {
          detail: "No explicit profile signals are active yet.",
          label: "Personalized scoring",
          signals: [],
          value: "Balanced",
        },
        {
          detail:
            "Diversity controls will activate after ranked stories exist.",
          label: "Diversity mixer",
          signals: [],
          value: "Standby",
        },
        {
          detail: "Reader actions will train the next ranking pass.",
          label: "Feedback training",
          signals: [],
          value: "+0 / -0",
        },
      ],
      summary: "Ranker is waiting for story candidates and reader signals.",
    };
  }

  return {
    label: "Four-stage Ranker",
    metrics: [
      { label: "Candidates", value: String(totalCount) },
      { label: "Personalized", value: String(personalizedItems.length) },
      { label: "Explore", value: String(explorationItems.length) },
      { label: "Guardrails", value: String(guardrailCount) },
    ],
    stages: [
      {
        detail: `Pulls ${totalCount} candidate ${
          totalCount === 1 ? "story" : "stories"
        } from ${sourceCount} ${sourceLabel} before ranking.`,
        label: "Candidate recall",
        signals: sourceSignals,
        value: `${totalCount} ${totalCount === 1 ? "story" : "stories"}`,
      },
      {
        detail: `Scores candidates with ${
          readerSignalSummary.signalCount
        } reader ${
          readerSignalSummary.signalCount === 1 ? "signal" : "signals"
        } and current trend heat.`,
        label: "Personalized scoring",
        signals: getUniqueSignals(
          [
            ...personalizedItems.map((item) => item.title),
            ...items
              .filter((item) => item.trendScore >= 85)
              .map((item) => item.title),
          ],
          3,
        ),
        value: biasMode,
      },
      {
        detail: "Keeps exploration and source rotation visible after scoring.",
        label: "Diversity mixer",
        signals: [
          `${explorationItems.length} exploration ${
            explorationItems.length === 1 ? "story" : "stories"
          }`,
          `${sourceCount} unique ${sourceLabel}`,
          `${adjacentSourceRepeats} adjacent source ${
            adjacentSourceRepeats === 1 ? "repeat" : "repeats"
          }`,
          `${adjacentEntityRepeats} adjacent entity ${
            adjacentEntityRepeats === 1 ? "repeat" : "repeats"
          }`,
        ],
        value:
          explorationItems.length > 0 || sourceCount > 1 ? "Mixed" : "Thin",
      },
      {
        detail: `Uses ${positiveItems.length} positive ${
          positiveItems.length === 1 ? "event" : "events"
        } and ${negativeFeedbackItems.length} hidden ${
          negativeFeedbackItems.length === 1 ? "story" : "stories"
        } to update the next pass.`,
        label: "Feedback training",
        signals: getUniqueSignals(
          [
            ...positiveItems.map((item) => item.title),
            ...negativeFeedbackItems.map((item) => item.title),
          ],
          4,
        ),
        value: `+${positiveItems.length} / -${negativeFeedbackItems.length}`,
      },
    ],
    summary: `Ranker processed ${totalCount} candidates into a ${biasMode} feed with ${
      personalizedItems.length
    } personalized ${
      personalizedItems.length === 1 ? "story" : "stories"
    }, ${explorationItems.length} exploration ${
      explorationItems.length === 1 ? "story" : "stories"
    }, and ${guardrailCount} ${
      guardrailCount === 1 ? "guardrail" : "guardrails"
    }.`,
  };
};

const hasNewsExplorationProfileMatch = ({
  item,
  profile,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  profile: NewsPreferenceProfile;
}) => {
  if (item.matchedSignals.some((signal) => signal !== "exploration")) {
    return true;
  }

  if (hasPreferenceSignal(profile.preferredCategories, item.category)) {
    return true;
  }

  if (hasPreferenceSignal(profile.preferredSources, item.sourceSlug)) {
    return true;
  }

  return item.entities.some((entity) =>
    hasPreferenceSignal(profile.preferredEntities, entity),
  );
};

const hasNewsExplorationNegativeMatch = ({
  item,
  negativeFeedbackItems,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
}) =>
  negativeFeedbackItems.some(
    (negativeItem) =>
      normalizePreferenceSignal(negativeItem.category) ===
        normalizePreferenceSignal(item.category) ||
      normalizePreferenceSignal(negativeItem.sourceSlug) ===
        normalizePreferenceSignal(item.sourceSlug) ||
      item.entities.some((entity) =>
        negativeItem.entities.some(
          (negativeEntity) =>
            normalizePreferenceSignal(negativeEntity) ===
            normalizePreferenceSignal(entity),
        ),
      ),
  );

const getNewsExplorationReason = (
  item: RankedNewsItem<NewsHomeItem>,
  profile: NewsPreferenceProfile,
) => {
  if (item.matchedSignals.includes("exploration")) return "Exploration slot";
  if (item.sourceScore >= 85 && item.trendScore >= 85) return "Trusted heat";
  if (!hasPreferenceSignal(profile.preferredCategories, item.category)) {
    return "New topic";
  }
  if (!hasPreferenceSignal(profile.preferredSources, item.sourceSlug)) {
    return "New source";
  }

  return "Fresh outside profile";
};

const getNewsExplorationScore = (
  item: RankedNewsItem<NewsHomeItem>,
  profile: NewsPreferenceProfile,
) => {
  const hasNewTopic = !hasPreferenceSignal(
    profile.preferredCategories,
    item.category,
  );
  const hasNewSource = !hasPreferenceSignal(
    profile.preferredSources,
    item.sourceSlug,
  );
  const hasNewEntity = item.entities.some(
    (entity) => !hasPreferenceSignal(profile.preferredEntities, entity),
  );

  return (
    item.trendScore +
    item.sourceScore +
    (item.matchedSignals.includes("exploration") ? 30 : 0) +
    (hasNewTopic ? 12 : 0) +
    (hasNewSource ? 8 : 0) +
    (hasNewEntity ? 6 : 0)
  );
};

export const getNewsExplorationSlots = ({
  formatCategory,
  items,
  limit,
  negativeFeedbackItems,
  profile,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
  profile: NewsPreferenceProfile;
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const scoredCandidates = items
    .filter(
      (item) =>
        !hasNewsExplorationProfileMatch({
          item,
          profile: normalizedProfile,
        }) &&
        !hasNewsExplorationNegativeMatch({
          item,
          negativeFeedbackItems,
        }),
    )
    .map((item) => ({
      item,
      reason: getNewsExplorationReason(item, normalizedProfile),
      score: getNewsExplorationScore(item, normalizedProfile),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;

      if (right.item.trendScore !== left.item.trendScore) {
        return right.item.trendScore - left.item.trendScore;
      }

      return (
        new Date(right.item.publishedAt).getTime() -
        new Date(left.item.publishedAt).getTime()
      );
    });
  const slots = scoredCandidates
    .slice(0, limit)
    .map(({ item, reason, score }) => ({
      id: item.id,
      reason,
      scoreLabel: `${score} discovery`,
      signal: formatCategory(item.category),
      sourceName: item.sourceName,
      title: item.title,
    }));
  const topicCount = new Set(
    scoredCandidates.map(({ item }) =>
      normalizePreferenceSignal(item.category),
    ),
  ).size;
  const sourceCount = new Set(
    scoredCandidates.map(({ item }) =>
      normalizePreferenceSignal(item.sourceSlug),
    ),
  ).size;
  const guardedCount = negativeFeedbackItems.length;

  return {
    label: slots.length > 0 ? "Discovery Slots" : "No Exploration",
    metrics: [
      { label: "Candidates", value: String(scoredCandidates.length) },
      { label: "New topics", value: String(topicCount) },
      { label: "New sources", value: String(sourceCount) },
      { label: "Guarded", value: String(guardedCount) },
    ],
    slots,
    summary:
      slots.length > 0
        ? `${slots.length} exploration ${
            slots.length === 1 ? "slot" : "slots"
          } open ${topicCount} ${
            topicCount === 1 ? "topic" : "topics"
          } and ${sourceCount} ${
            sourceCount === 1 ? "source" : "sources"
          } beyond the current profile while guarding ${guardedCount} negative ${
            guardedCount === 1 ? "signal" : "signals"
          }.`
        : "Exploration slots will appear after stories outside the profile are available.",
  };
};

type NewsDiscoveryLadderStatus = "Adjacent" | "Following" | "Trending";

const getNewsDiscoveryLadderStatus = ({
  item,
  profile,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  profile: NewsPreferenceProfile;
}): NewsDiscoveryLadderStatus => {
  if (hasPreferenceSignal(profile.preferredCategories, item.category)) {
    return "Following";
  }

  if (item.matchedSignals.includes("exploration")) return "Adjacent";

  return "Trending";
};

const getNewsDiscoveryLadderScore = ({
  item,
  profile,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  profile: NewsPreferenceProfile;
}) => {
  const isFollowing = hasPreferenceSignal(
    profile.preferredCategories,
    item.category,
  );
  const isNewTopic = !isFollowing;

  return (
    item.personalizedScore +
    item.trendScore +
    item.sourceScore +
    item.matchedSignals.length * 12 +
    (isFollowing ? 36 : 0) +
    (item.matchedSignals.includes("exploration") ? 24 : 0) +
    (isNewTopic ? Math.round(profile.noveltyBias * 10) : 0)
  );
};

const getNewsDiscoveryLadderLabel = ({
  categoryLabel,
  statusLabel,
}: {
  categoryLabel: string;
  statusLabel: NewsDiscoveryLadderStatus;
}) => {
  if (statusLabel === "Following") return `Deepen ${categoryLabel}`;
  if (statusLabel === "Adjacent") return `Explore ${categoryLabel}`;

  return `Track ${categoryLabel}`;
};

const getNewsDiscoveryLadderReason = ({
  item,
  statusLabel,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  statusLabel: NewsDiscoveryLadderStatus;
}) => {
  if (statusLabel === "Following") {
    const signalLabels = item.matchedSignals.filter(
      (signal) => signal !== "exploration",
    );

    return signalLabels.length > 0
      ? `Known topic reinforced by ${signalLabels.join(" and ")} signals.`
      : "Known topic is strong enough to deepen the profile.";
  }

  if (statusLabel === "Adjacent") {
    return "Exploration signal opens an adjacent topic without replacing the profile.";
  }

  return "Trend heat makes this topic worth testing in the profile.";
};

export const getNewsDiscoveryLadder = ({
  formatCategory,
  items,
  limit,
  profile,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  profile: NewsPreferenceProfile;
}) => {
  if (items.length === 0 || limit <= 0) {
    return {
      label: "Discovery Ladder Waiting",
      metrics: [
        { label: "Rungs", value: "0" },
        { label: "Following", value: "0" },
        { label: "New topics", value: "0" },
        { label: "Sources", value: "0" },
      ],
      rungs: [],
      summary: "Discovery ladder will appear after stories are ranked.",
    };
  }

  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const bestByCategory = new Map<
    string,
    {
      firstIndex: number;
      item: RankedNewsItem<NewsHomeItem>;
      score: number;
      statusLabel: NewsDiscoveryLadderStatus;
    }
  >();

  items.forEach((item, index) => {
    const categoryKey = normalizePreferenceSignal(item.category);
    const statusLabel = getNewsDiscoveryLadderStatus({
      item,
      profile: normalizedProfile,
    });
    const score = getNewsDiscoveryLadderScore({
      item,
      profile: normalizedProfile,
    });
    const existing = bestByCategory.get(categoryKey);

    if (
      !existing ||
      score > existing.score ||
      (score === existing.score && index < existing.firstIndex)
    ) {
      bestByCategory.set(categoryKey, {
        firstIndex: index,
        item,
        score,
        statusLabel,
      });
    }
  });

  const rungs = Array.from(bestByCategory.values())
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;

      return left.firstIndex - right.firstIndex;
    })
    .slice(0, limit)
    .map(({ item, score, statusLabel }) => {
      const categoryLabel = formatCategory(item.category);

      return {
        actionLabel: statusLabel === "Following" ? "Read next" : "Follow topic",
        category: item.category,
        categoryLabel,
        id: item.id,
        key: `${item.category}-${item.id}`,
        label: getNewsDiscoveryLadderLabel({
          categoryLabel,
          statusLabel,
        }),
        reason: getNewsDiscoveryLadderReason({ item, statusLabel }),
        scoreLabel: `${score} ladder`,
        sourceName: item.sourceName,
        statusLabel,
        title: item.title,
      };
    });
  const followingCount = rungs.filter(
    (rung) => rung.statusLabel === "Following",
  ).length;
  const newTopicCount = rungs.filter(
    (rung) =>
      !hasPreferenceSignal(
        normalizedProfile.preferredCategories,
        rung.category,
      ),
  ).length;
  const sourceCount = new Set(
    rungs.map((rung) => normalizePreferenceSignal(rung.sourceName)),
  ).size;

  return {
    label:
      rungs.length > 0 ? "Discovery Ladder Ready" : "Discovery Ladder Waiting",
    metrics: [
      { label: "Rungs", value: String(rungs.length) },
      { label: "Following", value: String(followingCount) },
      { label: "New topics", value: String(newTopicCount) },
      { label: "Sources", value: String(sourceCount) },
    ],
    rungs,
    summary:
      rungs.length > 0
        ? `${rungs.length} discovery ${
            rungs.length === 1 ? "rung connects" : "rungs connect"
          } ${followingCount} followed ${
            followingCount === 1 ? "topic" : "topics"
          } with ${newTopicCount} expansion ${
            newTopicCount === 1 ? "topic" : "topics"
          }.`
        : "Discovery ladder will appear after stories are ranked.",
  };
};

type NewsNextRefreshSignalKind = "entity" | "topic" | "source";

interface NewsNextRefreshSignalEntry {
  count: number;
  itemIds: Set<string>;
  key: string;
  kind: NewsNextRefreshSignalKind;
  label: string;
}

const nextRefreshBoostSignalKindPriority = {
  entity: 0,
  topic: 1,
  source: 2,
} satisfies Record<NewsNextRefreshSignalKind, number>;

const nextRefreshDamperSignalKindPriority = {
  topic: 0,
  entity: 1,
  source: 2,
} satisfies Record<NewsNextRefreshSignalKind, number>;

const getNextRefreshSignalKey = (
  kind: NewsNextRefreshSignalKind,
  value: string,
) => `${kind}:${value.trim().toLowerCase()}`;

const addNextRefreshSignal = ({
  amount,
  item,
  keyValue,
  kind,
  label,
  store,
}: {
  amount: number;
  item: NewsReaderMemoryItem;
  keyValue: string;
  kind: NewsNextRefreshSignalKind;
  label: string;
  store: Map<string, NewsNextRefreshSignalEntry>;
}) => {
  const normalizedValue = keyValue.trim().toLowerCase();
  if (!normalizedValue) return;

  const key = getNextRefreshSignalKey(kind, keyValue);
  const existing = store.get(key);

  store.set(key, {
    count: (existing?.count ?? 0) + amount,
    itemIds: new Set([...(existing?.itemIds ?? []), item.id]),
    key: normalizedValue,
    kind,
    label,
  });
};

const addNextRefreshItemSignals = ({
  amount,
  formatCategory,
  item,
  store,
}: {
  amount: number;
  formatCategory: (category: string) => string;
  item: NewsReaderMemoryItem;
  store: Map<string, NewsNextRefreshSignalEntry>;
}) => {
  addNextRefreshSignal({
    amount,
    item,
    keyValue: item.category,
    kind: "topic",
    label: formatCategory(item.category),
    store,
  });
  addNextRefreshSignal({
    amount,
    item,
    keyValue: item.sourceSlug,
    kind: "source",
    label: item.sourceName,
    store,
  });

  for (const entity of getUniqueSignals(item.entities, 12)) {
    addNextRefreshSignal({
      amount,
      item,
      keyValue: entity,
      kind: "entity",
      label: entity,
      store,
    });
  }
};

const sortNextRefreshSignalsByPriority = (
  left: NewsNextRefreshSignalEntry,
  right: NewsNextRefreshSignalEntry,
  priority: Record<NewsNextRefreshSignalKind, number>,
) => {
  if (right.count !== left.count) return right.count - left.count;

  const kindDiff = priority[left.kind] - priority[right.kind];
  if (kindDiff !== 0) return kindDiff;

  return left.label.localeCompare(right.label);
};

const sortNextRefreshBoostSignals = (
  left: NewsNextRefreshSignalEntry,
  right: NewsNextRefreshSignalEntry,
) =>
  sortNextRefreshSignalsByPriority(
    left,
    right,
    nextRefreshBoostSignalKindPriority,
  );

const sortNextRefreshDamperSignals = (
  left: NewsNextRefreshSignalEntry,
  right: NewsNextRefreshSignalEntry,
) =>
  sortNextRefreshSignalsByPriority(
    left,
    right,
    nextRefreshDamperSignalKindPriority,
  );

const toNextRefreshSignalSummary = (
  signal: NewsNextRefreshSignalEntry,
  direction: "boost" | "dampen",
) => ({
  detail: `${signal.itemIds.size} ${
    direction === "boost" ? "saved/read" : "hidden"
  } ${signal.itemIds.size === 1 ? "story" : "stories"}`,
  label: signal.label,
  weightLabel: `${direction === "boost" ? "+" : "-"}${signal.count}`,
});

const matchesNextRefreshSignal = (
  item: RankedNewsItem<NewsHomeItem>,
  signal: NewsNextRefreshSignalEntry,
) => {
  if (signal.kind === "topic") {
    return item.category.trim().toLowerCase() === signal.key;
  }

  if (signal.kind === "source") {
    return item.sourceSlug.trim().toLowerCase() === signal.key;
  }

  return item.entities.some(
    (entity) => entity.trim().toLowerCase() === signal.key,
  );
};

const getNextRefreshSlotReason = ({
  boosts,
  item,
}: {
  boosts: readonly NewsNextRefreshSignalEntry[];
  item: RankedNewsItem<NewsHomeItem>;
}) => {
  const boostMatch = boosts.find((signal) =>
    matchesNextRefreshSignal(item, signal),
  );

  if (boostMatch) return `${boostMatch.label} boost`;
  if (item.matchedSignals.includes("exploration")) return "Exploration guard";
  if (item.trendScore >= 90) return "Heat check";

  return "Fresh candidate";
};

export const getNewsNextRefreshPlan = ({
  formatCategory,
  historyItems,
  items,
  limit,
  negativeFeedbackItems,
  savedItems,
}: {
  formatCategory: (category: string) => string;
  historyItems: readonly NewsReaderMemoryItem[];
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const boostSignals = new Map<string, NewsNextRefreshSignalEntry>();
  const damperSignals = new Map<string, NewsNextRefreshSignalEntry>();

  for (const item of savedItems) {
    addNextRefreshItemSignals({
      amount: 2,
      formatCategory,
      item,
      store: boostSignals,
    });
  }

  for (const item of historyItems) {
    addNextRefreshItemSignals({
      amount: 1,
      formatCategory,
      item,
      store: boostSignals,
    });
  }

  for (const item of negativeFeedbackItems) {
    addNextRefreshItemSignals({
      amount: 1,
      formatCategory,
      item,
      store: damperSignals,
    });
  }

  const boosts = Array.from(boostSignals.values())
    .sort(sortNextRefreshBoostSignals)
    .slice(0, 3);
  const dampers = Array.from(damperSignals.values())
    .sort(sortNextRefreshDamperSignals)
    .slice(0, 3);
  const slots = items
    .filter(
      (item) =>
        !dampers.some((signal) => matchesNextRefreshSignal(item, signal)),
    )
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      reason: getNextRefreshSlotReason({ boosts, item }),
      scoreLabel: `${item.personalizedScore} score`,
      sourceName: item.sourceName,
      title: item.title,
    }));

  if (items.length === 0 && boosts.length === 0 && dampers.length === 0) {
    return {
      boosts: [],
      dampers: [],
      label: "Cold Refresh",
      metrics: [
        { label: "Boosts", value: "0" },
        { label: "Dampers", value: "0" },
        { label: "Candidate slots", value: "0" },
      ],
      slots: [],
      summary:
        "Next refresh plan will appear after stories and reader signals load.",
    };
  }

  return {
    boosts: boosts.map((signal) => toNextRefreshSignalSummary(signal, "boost")),
    dampers: dampers.map((signal) =>
      toNextRefreshSignalSummary(signal, "dampen"),
    ),
    label: boosts.length > 0 ? "Learning Refresh" : "Cold Refresh",
    metrics: [
      { label: "Boosts", value: String(boosts.length) },
      { label: "Dampers", value: String(dampers.length) },
      { label: "Candidate slots", value: String(slots.length) },
    ],
    slots,
    summary: `Next refresh will boost ${boosts.length} ${
      boosts.length === 1 ? "signal" : "signals"
    }, dampen ${dampers.length} ${
      dampers.length === 1 ? "signal" : "signals"
    }, and stage ${slots.length} candidate ${
      slots.length === 1 ? "slot" : "slots"
    }.`,
  };
};

type NewsRefreshSimulationStatus = "Boost" | "Dampen" | "Explore";

const newsRefreshSimulationPriority = {
  Boost: 0,
  Explore: 1,
  Dampen: 2,
} satisfies Record<NewsRefreshSimulationStatus, number>;

const getRefreshSimulationMatchers = (
  items: readonly Pick<NewsHomeItem, "category" | "entities" | "sourceSlug">[],
) => ({
  categories: new Set(
    items.map((item) => normalizePreferenceSignal(item.category)),
  ),
  entities: new Set(
    items.flatMap((item) => item.entities.map(normalizePreferenceSignal)),
  ),
  sources: new Set(
    items.map((item) => normalizePreferenceSignal(item.sourceSlug)),
  ),
});

const hasRefreshSimulationMatch = ({
  item,
  matchers,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  matchers: ReturnType<typeof getRefreshSimulationMatchers>;
}) => {
  const itemCategory = normalizePreferenceSignal(item.category);
  const itemSource = normalizePreferenceSignal(item.sourceSlug);
  const itemEntities = item.entities.map(normalizePreferenceSignal);

  return (
    matchers.categories.has(itemCategory) ||
    matchers.sources.has(itemSource) ||
    itemEntities.some((entity) => matchers.entities.has(entity))
  );
};

const hasRefreshSimulationProfileMatch = ({
  item,
  profile,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  profile: NewsPreferenceProfile;
}) =>
  item.matchedSignals.some((signal) => signal !== "exploration") ||
  hasPreferenceSignal(profile.preferredCategories, item.category) ||
  hasPreferenceSignal(profile.preferredSources, item.sourceSlug) ||
  item.entities.some((entity) =>
    hasPreferenceSignal(profile.preferredEntities, entity),
  );

const getNewsRefreshSimulationMove = ({
  formatCategory,
  historyMatchers,
  item,
  negativeMatchers,
  profile,
  savedMatchers,
}: {
  formatCategory: (category: string) => string;
  historyMatchers: ReturnType<typeof getRefreshSimulationMatchers>;
  item: RankedNewsItem<NewsHomeItem>;
  negativeMatchers: ReturnType<typeof getRefreshSimulationMatchers>;
  profile: NewsPreferenceProfile;
  savedMatchers: ReturnType<typeof getRefreshSimulationMatchers>;
}) => {
  const categoryLabel = formatCategory(item.category);
  const hasNegativeMatch = hasRefreshSimulationMatch({
    item,
    matchers: negativeMatchers,
  });
  const hasSavedMatch = hasRefreshSimulationMatch({
    item,
    matchers: savedMatchers,
  });
  const hasHistoryMatch = hasRefreshSimulationMatch({
    item,
    matchers: historyMatchers,
  });
  const hasProfileMatch = hasRefreshSimulationProfileMatch({ item, profile });
  const hasExplorationMatch = item.matchedSignals.includes("exploration");
  const isNewTopic = !hasPreferenceSignal(
    profile.preferredCategories,
    item.category,
  );

  if (hasNegativeMatch) {
    return {
      actionLabel: "Lower weight",
      category: item.category,
      categoryLabel,
      delta: -42,
      id: item.id,
      label: `Dampen ${categoryLabel}`,
      reason: "Hidden feedback overlaps this topic, source, or entity.",
      sourceName: item.sourceName,
      statusLabel: "Dampen" as const,
      title: item.title,
    };
  }

  if (hasSavedMatch || hasHistoryMatch) {
    return {
      actionLabel: "Raise weight",
      category: item.category,
      categoryLabel,
      delta: 36,
      id: item.id,
      label: `Boost ${categoryLabel}`,
      reason:
        "Saved or read signals reinforce this story for the next refresh.",
      sourceName: item.sourceName,
      statusLabel: "Boost" as const,
      title: item.title,
    };
  }

  if (hasProfileMatch) {
    return {
      actionLabel: "Raise weight",
      category: item.category,
      categoryLabel,
      delta: 24,
      id: item.id,
      label: `Boost ${categoryLabel}`,
      reason: "Reader profile keeps this story in the next refresh.",
      sourceName: item.sourceName,
      statusLabel: "Boost" as const,
      title: item.title,
    };
  }

  if (
    hasExplorationMatch ||
    (isNewTopic && profile.noveltyBias >= profile.recencyBias)
  ) {
    return {
      actionLabel: "Keep exploring",
      category: item.category,
      categoryLabel,
      delta: 18,
      id: item.id,
      label: `Explore ${categoryLabel}`,
      reason: "Novelty bias leaves room for an adjacent topic test.",
      sourceName: item.sourceName,
      statusLabel: "Explore" as const,
      title: item.title,
    };
  }

  return null;
};

export const getNewsRefreshSimulation = ({
  formatCategory,
  historyItems,
  items,
  limit,
  negativeFeedbackItems,
  profile,
  savedItems,
}: {
  formatCategory: (category: string) => string;
  historyItems: readonly NewsReaderMemoryItem[];
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  if (items.length === 0 || limit <= 0) {
    return {
      label: "Refresh Simulation Waiting",
      metrics: [
        { label: "Moves", value: "0" },
        { label: "Boosts", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Dampers", value: "0" },
      ],
      moves: [],
      summary: "Refresh simulation will appear after stories are ranked.",
    };
  }

  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const historyMatchers = getRefreshSimulationMatchers(historyItems);
  const negativeMatchers = getRefreshSimulationMatchers(negativeFeedbackItems);
  const savedMatchers = getRefreshSimulationMatchers(savedItems);
  const moves = items
    .map((item, index) => ({
      index,
      item,
      move: getNewsRefreshSimulationMove({
        formatCategory,
        historyMatchers,
        item,
        negativeMatchers,
        profile: normalizedProfile,
        savedMatchers,
      }),
    }))
    .filter(
      (
        entry,
      ): entry is {
        index: number;
        item: RankedNewsItem<NewsHomeItem>;
        move: NonNullable<ReturnType<typeof getNewsRefreshSimulationMove>>;
      } => entry.move !== null,
    )
    .sort((left, right) => {
      const priorityDiff =
        newsRefreshSimulationPriority[left.move.statusLabel] -
        newsRefreshSimulationPriority[right.move.statusLabel];

      if (priorityDiff !== 0) return priorityDiff;

      const deltaDiff = Math.abs(right.move.delta) - Math.abs(left.move.delta);
      if (deltaDiff !== 0) return deltaDiff;

      if (right.item.personalizedScore !== left.item.personalizedScore) {
        return right.item.personalizedScore - left.item.personalizedScore;
      }

      return left.index - right.index;
    })
    .slice(0, limit)
    .map(({ move }) => ({
      actionLabel: move.actionLabel,
      category: move.category,
      categoryLabel: move.categoryLabel,
      deltaLabel: `${move.delta > 0 ? "+" : ""}${move.delta} next`,
      id: move.id,
      key: `${move.statusLabel.toLowerCase()}-${move.id}`,
      label: move.label,
      reason: move.reason,
      sourceName: move.sourceName,
      statusLabel: move.statusLabel,
      title: move.title,
    }));
  const boostCount = moves.filter(
    (move) => move.statusLabel === "Boost",
  ).length;
  const exploreCount = moves.filter(
    (move) => move.statusLabel === "Explore",
  ).length;
  const dampenCount = moves.filter(
    (move) => move.statusLabel === "Dampen",
  ).length;

  return {
    label:
      moves.length > 0
        ? "Refresh Simulation Ready"
        : "Refresh Simulation Waiting",
    metrics: [
      { label: "Moves", value: String(moves.length) },
      { label: "Boosts", value: String(boostCount) },
      { label: "Explore", value: String(exploreCount) },
      { label: "Dampers", value: String(dampenCount) },
    ],
    moves,
    summary:
      moves.length > 0
        ? `${moves.length} simulated refresh ${
            moves.length === 1 ? "move" : "moves"
          }: ${boostCount} ${boostCount === 1 ? "boost" : "boosts"}, ${exploreCount} ${
            exploreCount === 1 ? "exploration" : "explorations"
          }, and ${dampenCount} ${dampenCount === 1 ? "dampen" : "dampens"}.`
        : "Refresh simulation will appear after stories are ranked.",
  };
};

type NewsTasteCalibrationStatus = "Aligned" | "Dampen" | "Explore";

const newsTasteCalibrationPriority = {
  Aligned: 0,
  Explore: 1,
  Dampen: 2,
} satisfies Record<NewsTasteCalibrationStatus, number>;

const getNewsTasteCalibrationAction = ({
  formatCategory,
  item,
  memoryMatchers,
  negativeMatchers,
  profile,
}: {
  formatCategory: (category: string) => string;
  item: RankedNewsItem<NewsHomeItem>;
  memoryMatchers: ReturnType<typeof getRefreshSimulationMatchers>;
  negativeMatchers: ReturnType<typeof getRefreshSimulationMatchers>;
  profile: NewsPreferenceProfile;
}) => {
  const categoryLabel = formatCategory(item.category);
  const hasFriction = hasRefreshSimulationMatch({
    item,
    matchers: negativeMatchers,
  });
  const hasMemoryHit = hasRefreshSimulationMatch({
    item,
    matchers: memoryMatchers,
  });
  const hasProfileFit = hasRefreshSimulationProfileMatch({ item, profile });
  const hasExploration = item.matchedSignals.includes("exploration");

  if (hasProfileFit && hasMemoryHit && !hasFriction) {
    return {
      actionLabel: "Keep signal",
      detail: `${item.title} reinforces saved/read behavior and explicit preferences.`,
      key: `aligned-${item.id}`,
      label: `Strengthen ${categoryLabel}`,
      signal: categoryLabel,
      statusLabel: "Aligned" as const,
      storyTitle: item.title,
    };
  }

  if (hasExploration && !hasFriction) {
    return {
      actionLabel: "Keep slot",
      detail: `${item.title} tests adjacent coverage without negative overlap.`,
      key: `explore-${item.id}`,
      label: `Keep exploring ${categoryLabel}`,
      signal: categoryLabel,
      statusLabel: "Explore" as const,
      storyTitle: item.title,
    };
  }

  if (hasFriction) {
    return {
      actionLabel: "Reduce weight",
      detail: `${item.title} overlaps hidden feedback.`,
      key: `dampen-${item.id}`,
      label: `Reduce ${categoryLabel}`,
      signal: categoryLabel,
      statusLabel: "Dampen" as const,
      storyTitle: item.title,
    };
  }

  return null;
};

export const getNewsTasteCalibration = ({
  formatCategory,
  historyItems,
  items,
  limit,
  negativeFeedbackItems,
  profile,
  savedItems,
}: {
  formatCategory: (category: string) => string;
  historyItems: readonly NewsReaderMemoryItem[];
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  if (items.length === 0 || limit <= 0) {
    return {
      actions: [],
      label: "Taste Calibration Waiting",
      metrics: [
        { label: "Stories", value: "0" },
        { label: "Profile fit", value: "0/0" },
        { label: "Memory hits", value: "0" },
        { label: "Friction", value: "0" },
      ],
      summary: "Taste calibration will appear after stories are ranked.",
    };
  }

  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const memoryMatchers = getRefreshSimulationMatchers([
    ...historyItems,
    ...savedItems,
  ]);
  const negativeMatchers = getRefreshSimulationMatchers(negativeFeedbackItems);
  const profileFitCount = items.filter((item) =>
    hasRefreshSimulationProfileMatch({ item, profile: normalizedProfile }),
  ).length;
  const explorationCount = items.filter((item) =>
    item.matchedSignals.includes("exploration"),
  ).length;
  const memoryHitCount = items.filter((item) =>
    hasRefreshSimulationMatch({ item, matchers: memoryMatchers }),
  ).length;
  const frictionCount = items.filter((item) =>
    hasRefreshSimulationMatch({ item, matchers: negativeMatchers }),
  ).length;
  const actions = items
    .map((item, index) => ({
      action: getNewsTasteCalibrationAction({
        formatCategory,
        item,
        memoryMatchers,
        negativeMatchers,
        profile: normalizedProfile,
      }),
      index,
      item,
    }))
    .filter(
      (
        entry,
      ): entry is {
        action: NonNullable<ReturnType<typeof getNewsTasteCalibrationAction>>;
        index: number;
        item: RankedNewsItem<NewsHomeItem>;
      } => entry.action !== null,
    )
    .sort((left, right) => {
      const priorityDiff =
        newsTasteCalibrationPriority[left.action.statusLabel] -
        newsTasteCalibrationPriority[right.action.statusLabel];

      if (priorityDiff !== 0) return priorityDiff;

      if (right.item.personalizedScore !== left.item.personalizedScore) {
        return right.item.personalizedScore - left.item.personalizedScore;
      }

      return left.index - right.index;
    })
    .slice(0, limit)
    .map(({ action }) => action);

  return {
    actions,
    label:
      actions.length > 0
        ? "Taste Calibration Ready"
        : "Taste Calibration Waiting",
    metrics: [
      { label: "Stories", value: String(items.length) },
      { label: "Profile fit", value: `${profileFitCount}/${items.length}` },
      { label: "Memory hits", value: String(memoryHitCount) },
      { label: "Friction", value: String(frictionCount) },
    ],
    summary: `${items.length} ${
      items.length === 1 ? "story calibrates" : "stories calibrate"
    } this taste model: ${profileFitCount} profile ${
      profileFitCount === 1 ? "fit" : "fits"
    }, ${explorationCount} ${
      explorationCount === 1 ? "exploration" : "explorations"
    }, and ${frictionCount} friction ${
      frictionCount === 1 ? "signal" : "signals"
    }.`,
  };
};

type NewsFeedGovernorAction =
  | "follow_entity"
  | "follow_source"
  | "follow_topic"
  | "increase_novelty"
  | "increase_recency"
  | "reset_balance";

interface NewsFeedGovernorControl {
  action: NewsFeedGovernorAction;
  buttonLabel: string;
  label: string;
  reason: string;
  signal?: string;
}

interface NewsFeedGovernorEntry {
  count: number;
  firstIndex: number;
  key: string;
  label: string;
}

const compareFeedGovernorEntries = (
  left: NewsFeedGovernorEntry,
  right: NewsFeedGovernorEntry,
) => {
  if (right.count !== left.count) return right.count - left.count;
  if (left.firstIndex !== right.firstIndex) {
    return left.firstIndex - right.firstIndex;
  }
  return left.label.localeCompare(right.label);
};

const incrementFeedGovernorEntry = ({
  key,
  label,
  index,
  store,
}: {
  key: string;
  label: string;
  index: number;
  store: Map<string, NewsFeedGovernorEntry>;
}) => {
  const normalizedKey = key.trim().toLowerCase();
  const normalizedLabel = label.trim();

  if (!normalizedKey || !normalizedLabel) return;

  const existing = store.get(normalizedKey);

  if (!existing) {
    store.set(normalizedKey, {
      count: 1,
      firstIndex: index,
      key,
      label: normalizedLabel,
    });
    return;
  }

  existing.count += 1;
};

const getFeedGovernorBiasMode = (profile: NewsPreferenceProfile) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  if (normalizedProfile.noveltyBias > normalizedProfile.recencyBias) {
    return "Discovery";
  }

  if (normalizedProfile.recencyBias > normalizedProfile.noveltyBias) {
    return "Freshness";
  }

  return "Balanced";
};

const feedGovernorGenericEntityKeys = new Set([
  "agent",
  "agents",
  "ai",
  "benchmarks",
  "llm",
  "llms",
  "series a",
]);

const isFeedGovernorSpecificEntity = (
  entity: Pick<NewsFeedGovernorEntry, "key">,
) => !feedGovernorGenericEntityKeys.has(entity.key.trim().toLowerCase());

export const getNewsFeedGovernor = ({
  formatCategory,
  items,
  profile,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  profile: NewsPreferenceProfile;
}) => {
  const biasMode = getFeedGovernorBiasMode(profile);

  if (items.length === 0) {
    return {
      controls: [],
      label: "Waiting",
      metrics: [
        { label: "Top source", value: "0%" },
        { label: "Top topic", value: "0%" },
        { label: "Top entity", value: "0%" },
        { label: "Exploration", value: "0%" },
        { label: "Bias mode", value: biasMode },
      ],
      risks: [
        {
          detail: "Feed governance will appear after stories are ranked.",
          label: "Waiting for stories",
        },
      ],
      summary: "Feed governance will appear as stories load.",
    };
  }

  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const sourceEntries = new Map<string, NewsFeedGovernorEntry>();
  const topicEntries = new Map<string, NewsFeedGovernorEntry>();
  const entityEntries = new Map<string, NewsFeedGovernorEntry>();

  items.forEach((item, index) => {
    incrementFeedGovernorEntry({
      index,
      key: item.sourceSlug,
      label: item.sourceName,
      store: sourceEntries,
    });
    incrementFeedGovernorEntry({
      index,
      key: item.category,
      label: formatCategory(item.category),
      store: topicEntries,
    });
    getNormalizedFeedFatigueEntities(item).forEach((entity) => {
      incrementFeedGovernorEntry({
        index,
        key: entity.key,
        label: entity.label,
        store: entityEntries,
      });
    });
  });

  const sources = Array.from(sourceEntries.values()).sort(
    compareFeedGovernorEntries,
  );
  const topics = Array.from(topicEntries.values()).sort(
    compareFeedGovernorEntries,
  );
  const entities = Array.from(entityEntries.values()).sort(
    compareFeedGovernorEntries,
  );
  const [topSource] = sources;
  const [topTopic] = topics;
  const [topEntity] = entities;
  const totalCount = items.length;
  const explorationCount = items.filter((item) =>
    item.matchedSignals.includes("exploration"),
  ).length;
  const topSourcePercent = topSource
    ? formatPercentage(topSource.count, totalCount)
    : "0%";
  const topTopicPercent = topTopic
    ? formatPercentage(topTopic.count, totalCount)
    : "0%";
  const topEntityPercent = topEntity
    ? formatPercentage(topEntity.count, totalCount)
    : "0%";
  const explorationPercent = formatPercentage(explorationCount, totalCount);
  const topSourceShare = topSource ? topSource.count / totalCount : 0;
  const topTopicShare = topTopic ? topTopic.count / totalCount : 0;
  const topEntityShare = topEntity ? topEntity.count / totalCount : 0;
  const sourceConcentrated = topSourceShare >= 0.6;
  const topicConcentrated = topTopicShare >= 0.7;
  const entityConcentrated = topEntityShare >= 0.7;
  const readerSignalCount =
    normalizedProfile.preferredCategories.length +
    normalizedProfile.preferredSources.length +
    normalizedProfile.preferredEntities.length;
  const risks: { detail: string; label: string }[] = [];
  const controls: NewsFeedGovernorControl[] = [];

  if (sourceConcentrated && topSource) {
    risks.push({
      detail: `${topSource.label} owns ${topSourcePercent} of this slice.`,
      label: "Source concentration",
    });
  }

  if (topicConcentrated && topTopic) {
    risks.push({
      detail: `${topTopic.label} represents ${topTopicPercent} of this slice.`,
      label: "Topic concentration",
    });
  }

  if (entityConcentrated && topEntity) {
    risks.push({
      detail: `${topEntity.label} appears in ${topEntityPercent} of this slice.`,
      label: "Entity concentration",
    });
  }

  if (!sourceConcentrated && !topicConcentrated && !entityConcentrated) {
    risks.push({
      detail: "No source, topic, or entity dominates this edition slice.",
      label: "Coverage healthy",
    });
  }

  if (explorationCount === 0) {
    risks.push({
      detail:
        "No exploration stories are present, so the feed is relying on known or trend-led coverage.",
      label: "Exploration gap",
    });
    controls.push({
      action: "increase_novelty",
      buttonLabel: "Open explore",
      label: "Add exploration",
      reason:
        "No exploration stories are present, so raise novelty to test broader AI coverage.",
    });
  } else {
    risks.push({
      detail: `${explorationCount} exploration ${
        explorationCount === 1 ? "story is" : "stories are"
      } testing coverage outside the current profile.`,
      label: "Exploration active",
    });
  }

  if (explorationCount > 0 && biasMode === "Discovery") {
    controls.push({
      action: "increase_recency",
      buttonLabel: "Freshen",
      label: "Freshness guard",
      reason:
        "Discovery is leading; raise freshness when breaking AI stories matter more.",
    });
  }

  controls.push({
    action: "reset_balance",
    buttonLabel: "Set neutral",
    label:
      !sourceConcentrated &&
      !topicConcentrated &&
      !entityConcentrated &&
      explorationCount > 0
        ? "Neutral mix"
        : "Rebalance bias",
    reason:
      biasMode === "Freshness"
        ? "Freshness is leading the feed; reset freshness and novelty to a neutral mix."
        : biasMode === "Discovery"
          ? "Reset novelty and freshness when the feed feels over-tuned."
          : "Reset novelty and freshness when the feed feels over-tuned.",
  });

  const sourceCandidate = sources.find(
    (source) =>
      source.key.toLowerCase() !== topSource?.key.toLowerCase() &&
      !hasPreferenceSignal(normalizedProfile.preferredSources, source.key),
  );
  const topicCandidate = topics.find(
    (topic) =>
      topic.key.toLowerCase() !== topTopic?.key.toLowerCase() &&
      !hasPreferenceSignal(normalizedProfile.preferredCategories, topic.key),
  );
  const entityCandidate = entities.find(
    (entity) =>
      isFeedGovernorSpecificEntity(entity) &&
      entity.key.toLowerCase() !== topEntity?.key.toLowerCase() &&
      !hasPreferenceSignal(normalizedProfile.preferredEntities, entity.key),
  );

  if (sourceConcentrated && topSource && sourceCandidate) {
    controls.push({
      action: "follow_source",
      buttonLabel: "Follow source",
      label: "Source spread",
      reason: `${sourceCandidate.label} adds another source outside ${topSource.label}.`,
      signal: sourceCandidate.key,
    });
  }

  if (topicConcentrated && topTopic && topicCandidate) {
    controls.push({
      action: "follow_topic",
      buttonLabel: "Follow topic",
      label: "Topic spread",
      reason: `${topicCandidate.label} broadens coverage beyond ${topTopic.label}.`,
      signal: topicCandidate.key,
    });
  }

  if (entityConcentrated && topEntity && entityCandidate) {
    controls.push({
      action: "follow_entity",
      buttonLabel: "Follow entity",
      label: "Entity spread",
      reason: `${entityCandidate.label} broadens coverage beyond ${topEntity.label}.`,
      signal: entityCandidate.label,
    });
  }

  return {
    controls,
    label:
      readerSignalCount === 0
        ? "Cold Start"
        : sourceConcentrated ||
            topicConcentrated ||
            entityConcentrated ||
            explorationCount === 0
          ? "Bubble Watch"
          : "Healthy Mix",
    metrics: [
      { label: "Top source", value: topSourcePercent },
      { label: "Top topic", value: topTopicPercent },
      { label: "Top entity", value: topEntityPercent },
      { label: "Exploration", value: explorationPercent },
      { label: "Bias mode", value: biasMode },
    ],
    risks,
    summary: `${totalCount} ${
      totalCount === 1 ? "story" : "stories"
    } under governance: top source ${topSourcePercent}, top topic ${topTopicPercent}, top entity ${topEntityPercent}, exploration ${explorationPercent}.`,
  };
};

type NewsFilterBubbleCheckStatus = "clear" | "risk" | "watch";

interface NewsFilterBubbleCheck {
  action: string;
  detail: string;
  label: string;
  status: NewsFilterBubbleCheckStatus;
}

const isNewsFilterBubbleProfileMatch = ({
  formatCategory,
  item,
  profile,
}: {
  formatCategory: (category: string) => string;
  item: RankedNewsItem<NewsHomeItem>;
  profile: NewsPreferenceProfile;
}) => {
  const activeSignalCount =
    profile.preferredCategories.length +
    profile.preferredSources.length +
    profile.preferredEntities.length;

  if (activeSignalCount === 0) return false;

  if (
    getNewsProfileImpactMatches({ formatCategory, item, profile }).length > 0
  ) {
    return true;
  }

  return item.matchedSignals.some(
    (signal) =>
      signal === "category" || signal === "source" || signal === "entity",
  );
};

export const getNewsFilterBubbleReport = ({
  formatCategory,
  items,
  profile,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  profile: NewsPreferenceProfile;
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  if (items.length === 0) {
    return {
      checks: [] as NewsFilterBubbleCheck[],
      label: "Waiting",
      metrics: [
        { label: "Profile share", value: "0%" },
        { label: "Exploration", value: "0%" },
        { label: "Source spread", value: "0 sources" },
        { label: "Entity spread", value: "0 entities" },
        { label: "Dominant topic", value: "None" },
      ],
      summary: "Filter bubble report will appear after stories are ranked.",
    };
  }

  const sourceEntries = new Map<string, NewsFeedGovernorEntry>();
  const topicEntries = new Map<string, NewsFeedGovernorEntry>();
  const entityEntries = new Map<
    string,
    NewsFeedGovernorEntry & { sourceSlugs: Set<string> }
  >();

  items.forEach((item, index) => {
    incrementFeedGovernorEntry({
      index,
      key: item.sourceSlug,
      label: item.sourceName,
      store: sourceEntries,
    });
    incrementFeedGovernorEntry({
      index,
      key: item.category,
      label: formatCategory(item.category),
      store: topicEntries,
    });

    const seenEntities = new Set<string>();

    getNormalizedFeedFatigueEntities(item).forEach((entity) => {
      if (
        seenEntities.has(entity.key) ||
        !isFeedGovernorSpecificEntity(entity)
      ) {
        return;
      }

      const existing = entityEntries.get(entity.key);

      if (existing) {
        existing.count += 1;
        existing.sourceSlugs.add(item.sourceSlug);
      } else {
        entityEntries.set(entity.key, {
          count: 1,
          firstIndex: index,
          key: entity.key,
          label: entity.label,
          sourceSlugs: new Set([item.sourceSlug]),
        });
      }

      seenEntities.add(entity.key);
    });
  });

  const sources = Array.from(sourceEntries.values()).sort(
    compareFeedGovernorEntries,
  );
  const topics = Array.from(topicEntries.values()).sort(
    compareFeedGovernorEntries,
  );
  const entities = Array.from(entityEntries.values()).sort(
    compareFeedGovernorEntries,
  );
  const [topSource] = sources;
  const [topTopic] = topics;
  const [topEntity] = entities;
  const totalCount = items.length;
  const profileMatchCount = items.filter((item) =>
    isNewsFilterBubbleProfileMatch({
      formatCategory,
      item,
      profile: normalizedProfile,
    }),
  ).length;
  const explorationCount = items.filter((item) =>
    item.matchedSignals.includes("exploration"),
  ).length;
  const sourceCount = sources.length;
  const profileShare = profileMatchCount / totalCount;
  const explorationShare = explorationCount / totalCount;
  const topSourceShare = topSource ? topSource.count / totalCount : 0;
  const topEntityShare = topEntity ? topEntity.count / totalCount : 0;
  const hasEntityLock =
    topEntity !== undefined &&
    topEntity.count >= 3 &&
    topEntity.sourceSlugs.size >= 2 &&
    topEntityShare >= 0.6 &&
    topSourceShare < 0.7;
  const checks: NewsFilterBubbleCheck[] = [];

  if (profileShare >= 0.7) {
    checks.push({
      action:
        "Add one exploration story or raise novelty before the next refresh.",
      detail: `${profileMatchCount} of ${totalCount} stories match explicit reader signals.`,
      label: "Profile lock",
      status: "risk",
    });
  } else if (profileShare >= 0.5) {
    checks.push({
      action: "Keep adjacent coverage in the next refresh.",
      detail: `${profileMatchCount} of ${totalCount} stories match explicit reader signals.`,
      label: "Profile lock",
      status: "watch",
    });
  }

  if (topSource && topSourceShare >= 0.7) {
    checks.push({
      action: `Follow another source covering ${
        topTopic?.label ?? "this topic"
      } before keeping this mix.`,
      detail: `${topSource.label} carries ${topSource.count} of ${totalCount} stories.`,
      label: "Source narrowness",
      status: "risk",
    });
  } else if (topSource && topSourceShare >= 0.5) {
    checks.push({
      action: "Keep another source visible in the next edition.",
      detail: `${topSource.label} carries ${topSource.count} of ${totalCount} stories.`,
      label: "Source narrowness",
      status: "watch",
    });
  }

  if (hasEntityLock) {
    checks.push({
      action: `Add another entity before letting ${topEntity.label} dominate the next refresh.`,
      detail: `${topEntity.label} appears in ${topEntity.count} of ${totalCount} stories across mixed sources.`,
      label: "Entity lock",
      status: "risk",
    });
  }

  if (explorationCount === 0) {
    checks.push({
      action: "Raise novelty or add one outside-profile story.",
      detail: "No exploration stories are present.",
      label: "Exploration floor",
      status: "risk",
    });
  } else if (explorationShare <= 0.25) {
    checks.push({
      action: `Keep at least ${explorationCount} adjacent ${
        explorationCount === 1 ? "story" : "stories"
      } visible in this edition.`,
      detail: `${explorationCount} exploration ${
        explorationCount === 1 ? "story is" : "stories are"
      } present.`,
      label: "Exploration floor",
      status: "watch",
    });
  } else {
    checks.push({
      action: "Keep this exploration floor while the profile learns.",
      detail: `${explorationCount} exploration ${
        explorationCount === 1 ? "story is" : "stories are"
      } present.`,
      label: "Exploration floor",
      status: "clear",
    });
  }

  const sourceSpreadLabel = `${sourceCount} ${
    sourceCount === 1 ? "source" : "sources"
  }`;
  const entitySpreadLabel = `${entities.length} ${
    entities.length === 1 ? "entity" : "entities"
  }`;
  const label =
    profileShare >= 0.7 || topSourceShare >= 0.7 || hasEntityLock
      ? "Bubble Risk"
      : explorationShare < 0.25 || profileShare >= 0.5
        ? "Watch"
        : "Balanced";

  return {
    checks,
    label,
    metrics: [
      {
        label: "Profile share",
        value: formatPercentage(profileMatchCount, totalCount),
      },
      {
        label: "Exploration",
        value: formatPercentage(explorationCount, totalCount),
      },
      { label: "Source spread", value: sourceSpreadLabel },
      { label: "Entity spread", value: entitySpreadLabel },
      { label: "Dominant topic", value: topTopic?.label ?? "None" },
    ],
    summary:
      label === "Bubble Risk" && hasEntityLock
        ? `Filter bubble risk is high: ${profileMatchCount} profile-matched ${
            profileMatchCount === 1 ? "story" : "stories"
          }, ${explorationCount} exploration ${
            explorationCount === 1 ? "story" : "stories"
          }, and ${sourceSpreadLabel} with ${
            topEntity.label
          } dominating the entity mix.`
        : label === "Bubble Risk"
          ? `Filter bubble risk is high: ${profileMatchCount} profile-matched ${
              profileMatchCount === 1 ? "story" : "stories"
            } and ${explorationCount} exploration ${
              explorationCount === 1 ? "story" : "stories"
            } across ${sourceSpreadLabel}.`
          : `${profileMatchCount} profile-matched ${
              profileMatchCount === 1 ? "story" : "stories"
            }, ${explorationCount} exploration ${
              explorationCount === 1 ? "story" : "stories"
            }, and ${sourceSpreadLabel} in this edition slice.`,
  };
};

const newsDistributionQueueDefinitions = [
  {
    key: "boost",
    label: "Boost",
    summary: "Direct reader matches are ready to lead the next impression.",
  },
  {
    key: "balance",
    label: "Balance",
    summary:
      "Counterweight stories keep entity concentration from narrowing the next impression.",
  },
  {
    key: "hold",
    label: "Hold",
    summary:
      "Useful trend-led stories stay available without overtaking stronger signals.",
  },
  {
    key: "explore",
    label: "Explore",
    summary:
      "Outside-profile stories are isolated so the system can test new interests.",
  },
  {
    key: "suppress",
    label: "Suppress",
    summary:
      "Hidden or negatively matched stories are kept out of active recommendation lanes.",
  },
] as const;

type NewsDistributionQueueKey =
  (typeof newsDistributionQueueDefinitions)[number]["key"];

interface NewsDistributionQueueStory {
  id: string;
  reason: string;
  scoreLabel: string;
  sourceName: string;
  title: string;
}

interface NewsDistributionQueueBucket {
  count: number;
  key: NewsDistributionQueueKey;
  label: string;
  shareLabel: string;
  stories: NewsDistributionQueueStory[];
  summary: string;
}

const getNegativeFeedbackMatchers = (
  negativeFeedbackItems: readonly NewsHomeItem[],
) => ({
  categories: new Set(
    negativeFeedbackItems.map((item) =>
      normalizePreferenceSignal(item.category),
    ),
  ),
  entities: new Set(
    negativeFeedbackItems.flatMap((item) =>
      item.entities.map(normalizePreferenceSignal),
    ),
  ),
  sources: new Set(
    negativeFeedbackItems.map((item) =>
      normalizePreferenceSignal(item.sourceSlug),
    ),
  ),
});

const getNewsDistributionSuppressReason = ({
  hiddenItemIds,
  item,
  negativeFeedbackItems,
}: {
  hiddenItemIds: ReadonlySet<string>;
  item: RankedNewsItem<NewsHomeItem>;
  negativeFeedbackItems: readonly NewsHomeItem[];
}) => {
  if (hiddenItemIds.has(item.id)) return "Hidden by reader";
  if (negativeFeedbackItems.length === 0) return null;

  const matchers = getNegativeFeedbackMatchers(negativeFeedbackItems);
  const itemCategory = normalizePreferenceSignal(item.category);
  const itemSource = normalizePreferenceSignal(item.sourceSlug);
  const itemEntities = item.entities.map(normalizePreferenceSignal);
  const hasNegativeMatch =
    matchers.categories.has(itemCategory) ||
    matchers.sources.has(itemSource) ||
    itemEntities.some((entity) => matchers.entities.has(entity));

  return hasNegativeMatch ? "Negative feedback match" : null;
};

const getNewsDistributionDominantEntity = ({
  hiddenItemIds,
  items,
  negativeFeedbackItems,
}: {
  hiddenItemIds: ReadonlySet<string>;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  negativeFeedbackItems: readonly NewsHomeItem[];
}) => {
  const entityEntries = new Map<
    string,
    { count: number; firstIndex: number; key: string; label: string }
  >();
  let eligibleCount = 0;

  items.forEach((item, index) => {
    if (
      getNewsDistributionSuppressReason({
        hiddenItemIds,
        item,
        negativeFeedbackItems,
      })
    ) {
      return;
    }

    eligibleCount += 1;

    const seenEntities = new Set<string>();

    getNormalizedFeedFatigueEntities(item).forEach((entity) => {
      if (
        seenEntities.has(entity.key) ||
        !isFeedGovernorSpecificEntity(entity)
      ) {
        return;
      }

      const existing = entityEntries.get(entity.key);

      if (existing) {
        existing.count += 1;
      } else {
        entityEntries.set(entity.key, {
          count: 1,
          firstIndex: index,
          key: entity.key,
          label: entity.label,
        });
      }

      seenEntities.add(entity.key);
    });
  });

  const [dominantEntity] = [...entityEntries.values()].sort(
    compareFeedGovernorEntries,
  );

  if (!dominantEntity || eligibleCount === 0) return null;

  const share = dominantEntity.count / eligibleCount;

  return dominantEntity.count >= 3 && share >= 0.6 ? dominantEntity : null;
};

const hasNewsDistributionEntity = ({
  item,
  key,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  key: string;
}) =>
  getNormalizedFeedFatigueEntities(item).some((entity) => entity.key === key);

const getNewsDistributionQueueKey = ({
  dominantEntity,
  hiddenItemIds,
  item,
  negativeFeedbackItems,
}: {
  dominantEntity: { key: string; label: string } | null;
  hiddenItemIds: ReadonlySet<string>;
  item: RankedNewsItem<NewsHomeItem>;
  negativeFeedbackItems: readonly NewsHomeItem[];
}): { key: NewsDistributionQueueKey; reason: string } => {
  const suppressReason = getNewsDistributionSuppressReason({
    hiddenItemIds,
    item,
    negativeFeedbackItems,
  });

  if (suppressReason) {
    return { key: "suppress", reason: suppressReason };
  }

  if (
    dominantEntity &&
    item.matchedSignals.includes("exploration") &&
    !hasNewsDistributionEntity({ item, key: dominantEntity.key })
  ) {
    return {
      key: "balance",
      reason: `Counterbalances ${dominantEntity.label} concentration`,
    };
  }

  if (item.matchedSignals.includes("exploration")) {
    return { key: "explore", reason: "Exploration signal" };
  }

  if (item.matchedSignals.length >= 2 || item.personalizedScore >= 135) {
    return {
      key: "boost",
      reason:
        item.matchedSignals.length > 0
          ? `${item.matchedSignals.length} reader ${
              item.matchedSignals.length === 1 ? "signal" : "signals"
            }`
          : "High recommendation score",
    };
  }

  return { key: "hold", reason: "Trend-led candidate" };
};

const toNewsDistributionQueueStory = ({
  item,
  reason,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  reason: string;
}): NewsDistributionQueueStory => ({
  id: item.id,
  reason,
  scoreLabel: `${item.personalizedScore} score`,
  sourceName: item.sourceName,
  title: item.title,
});

export const getNewsDistributionQueue = ({
  hiddenItemIds,
  items,
  limit,
  negativeFeedbackItems,
}: {
  hiddenItemIds: readonly string[];
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  negativeFeedbackItems: readonly NewsHomeItem[];
}) => {
  const hiddenIds = new Set(hiddenItemIds);
  const buckets = new Map<
    NewsDistributionQueueKey,
    { count: number; stories: NewsDistributionQueueStory[] }
  >(
    newsDistributionQueueDefinitions.map((definition) => [
      definition.key,
      { count: 0, stories: [] },
    ]),
  );
  const dominantEntity = getNewsDistributionDominantEntity({
    hiddenItemIds: hiddenIds,
    items,
    negativeFeedbackItems,
  });

  for (const item of items) {
    const placement = getNewsDistributionQueueKey({
      dominantEntity,
      hiddenItemIds: hiddenIds,
      item,
      negativeFeedbackItems,
    });
    const bucket = buckets.get(placement.key);

    if (!bucket) continue;

    bucket.count += 1;

    if (bucket.stories.length < limit) {
      bucket.stories.push(
        toNewsDistributionQueueStory({ item, reason: placement.reason }),
      );
    }
  }

  const queues: NewsDistributionQueueBucket[] =
    newsDistributionQueueDefinitions.map((definition) => {
      const bucket = buckets.get(definition.key);
      const count = bucket?.count ?? 0;

      return {
        count,
        key: definition.key,
        label: definition.label,
        shareLabel: formatPercentage(count, items.length),
        stories: bucket?.stories ?? [],
        summary: definition.summary,
      };
    });
  const getQueueCount = (key: NewsDistributionQueueKey) =>
    buckets.get(key)?.count ?? 0;
  const boostCount = getQueueCount("boost");
  const balanceCount = getQueueCount("balance");
  const holdCount = getQueueCount("hold");
  const exploreCount = getQueueCount("explore");
  const suppressCount = getQueueCount("suppress");

  return {
    label: items.length === 0 ? "Waiting" : "Distribution Ready",
    metrics: [
      { label: "Boost", value: String(boostCount) },
      { label: "Balance", value: String(balanceCount) },
      { label: "Hold", value: String(holdCount) },
      { label: "Explore", value: String(exploreCount) },
      { label: "Suppress", value: String(suppressCount) },
    ],
    queues,
    summary:
      items.length === 0
        ? "Distribution queue will appear after stories are ranked."
        : `${items.length} ${
            items.length === 1 ? "story" : "stories"
          } distributed: ${boostCount} boost, ${balanceCount} balance, ${holdCount} hold, ${exploreCount} explore, and ${suppressCount} suppress.`,
  };
};

const newsAlertRoutingDefinitions = [
  {
    key: "immediate",
    label: "Immediate",
    summary: "High-trust, high-heat stories that match the reader profile.",
  },
  {
    key: "digest",
    label: "Digest",
    summary: "Useful personalized stories that can wait for the brief.",
  },
  {
    key: "watch",
    label: "Watch",
    summary: "Noisy or exploratory stories held for verification.",
  },
  {
    key: "muted",
    label: "Muted",
    summary: "Stories blocked from alerts by reader feedback or trust.",
  },
] as const;

type NewsAlertRoutingKey = (typeof newsAlertRoutingDefinitions)[number]["key"];

interface NewsAlertRoutingStory {
  deliveryLabel: string;
  id: string;
  reason: string;
  scoreLabel: string;
  sourceName: string;
  title: string;
}

interface NewsAlertRoutingLane {
  count: number;
  key: NewsAlertRoutingKey;
  label: string;
  shareLabel: string;
  stories: NewsAlertRoutingStory[];
  summary: string;
}

const getNewsAlertRoutingPlacement = ({
  cooledEntity,
  hiddenItemIds,
  item,
  negativeFeedbackItems,
}: {
  cooledEntity: { label: string } | null;
  hiddenItemIds: ReadonlySet<string>;
  item: RankedNewsItem<NewsHomeItem>;
  negativeFeedbackItems: readonly NewsHomeItem[];
}): { deliveryLabel: string; key: NewsAlertRoutingKey; reason: string } => {
  const suppressReason = getNewsDistributionSuppressReason({
    hiddenItemIds,
    item,
    negativeFeedbackItems,
  });

  if (suppressReason) {
    return {
      deliveryLabel: "Muted",
      key: "muted",
      reason: suppressReason,
    };
  }

  if (item.sourceScore < 65 && item.trendScore >= 80) {
    return {
      deliveryLabel: "Verify",
      key: "watch",
      reason: "High heat needs verification",
    };
  }

  if (item.matchedSignals.includes("exploration")) {
    return {
      deliveryLabel: "Verify",
      key: "watch",
      reason: "Exploration alert hold",
    };
  }

  if (
    item.sourceScore >= 80 &&
    item.trendScore >= 85 &&
    item.personalizedScore >= 135 &&
    item.matchedSignals.length > 0
  ) {
    if (cooledEntity) {
      return {
        deliveryLabel: "Next brief",
        key: "digest",
        reason: `Entity cooldown after ${cooledEntity.label} alert`,
      };
    }

    return {
      deliveryLabel: "Now",
      key: "immediate",
      reason: "High-trust profile alert",
    };
  }

  if (item.personalizedScore >= 115 || item.matchedSignals.length > 0) {
    return {
      deliveryLabel: "Next brief",
      key: "digest",
      reason: "Personalized digest",
    };
  }

  return {
    deliveryLabel: "Verify",
    key: "watch",
    reason: "Low-personalization candidate",
  };
};

const getNewsAlertRoutingSpecificEntities = (item: {
  entities: readonly string[];
}) =>
  getNormalizedFeedFatigueEntities(item).filter((entity) =>
    isFeedGovernorSpecificEntity(entity),
  );

const toNewsAlertRoutingStory = ({
  deliveryLabel,
  item,
  reason,
}: {
  deliveryLabel: string;
  item: RankedNewsItem<NewsHomeItem>;
  reason: string;
}): NewsAlertRoutingStory => ({
  deliveryLabel,
  id: item.id,
  reason,
  scoreLabel: `${item.personalizedScore} score / ${item.trendScore} heat`,
  sourceName: item.sourceName,
  title: item.title,
});

export const getNewsAlertRouting = ({
  hiddenItemIds,
  items,
  limit,
  negativeFeedbackItems,
}: {
  hiddenItemIds: readonly string[];
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  negativeFeedbackItems: readonly NewsHomeItem[];
}) => {
  const hiddenIds = new Set(hiddenItemIds);
  const buckets = new Map<
    NewsAlertRoutingKey,
    { count: number; stories: NewsAlertRoutingStory[] }
  >(
    newsAlertRoutingDefinitions.map((definition) => [
      definition.key,
      { count: 0, stories: [] },
    ]),
  );
  const immediateEntityKeys = new Set<string>();

  for (const item of items) {
    const itemEntities = getNewsAlertRoutingSpecificEntities(item);
    const cooledEntity =
      itemEntities.find((entity) => immediateEntityKeys.has(entity.key)) ??
      null;
    const placement = getNewsAlertRoutingPlacement({
      cooledEntity,
      hiddenItemIds: hiddenIds,
      item,
      negativeFeedbackItems,
    });
    const bucket = buckets.get(placement.key);

    if (!bucket) continue;

    bucket.count += 1;

    if (bucket.stories.length < limit) {
      bucket.stories.push(
        toNewsAlertRoutingStory({
          deliveryLabel: placement.deliveryLabel,
          item,
          reason: placement.reason,
        }),
      );
    }

    if (placement.key === "immediate") {
      itemEntities.forEach((entity) => immediateEntityKeys.add(entity.key));
    }
  }

  const lanes: NewsAlertRoutingLane[] = newsAlertRoutingDefinitions.map(
    (definition) => {
      const bucket = buckets.get(definition.key);
      const count = bucket?.count ?? 0;

      return {
        count,
        key: definition.key,
        label: definition.label,
        shareLabel: formatPercentage(count, items.length),
        stories: bucket?.stories ?? [],
        summary: definition.summary,
      };
    },
  );
  const getLaneCount = (key: NewsAlertRoutingKey) =>
    buckets.get(key)?.count ?? 0;
  const immediateCount = getLaneCount("immediate");
  const digestCount = getLaneCount("digest");
  const watchCount = getLaneCount("watch");
  const mutedCount = getLaneCount("muted");

  return {
    label: items.length === 0 ? "Alerts Waiting" : "Alert Router Ready",
    lanes,
    metrics: [
      { label: "Immediate", value: String(immediateCount) },
      { label: "Digest", value: String(digestCount) },
      { label: "Watch", value: String(watchCount) },
      { label: "Muted", value: String(mutedCount) },
    ],
    summary:
      items.length === 0
        ? "Alert routing will appear after stories are ranked."
        : `${items.length} ${
            items.length === 1 ? "story" : "stories"
          } routed for alerts: ${immediateCount} immediate, ${digestCount} digest, ${watchCount} watch, and ${mutedCount} muted.`,
  };
};

const newsPersonalizedPushQueueDefinitions = [
  {
    key: "push_now",
    label: "Push now",
    summary: "High-trust profile matches can trigger a live push.",
  },
  {
    key: "digest",
    label: "Next digest",
    summary: "Useful reader matches wait for the next personalized brief.",
  },
  {
    key: "watch",
    label: "Quiet watch",
    summary:
      "Exploration and lower-intent stories stay visible without a push.",
  },
  {
    key: "muted",
    label: "Muted",
    summary: "Hidden or negatively matched stories never become pushes.",
  },
] as const;

type NewsPersonalizedPushQueueKey =
  (typeof newsPersonalizedPushQueueDefinitions)[number]["key"];

interface NewsPersonalizedPushStory {
  categoryLabel: string;
  deliveryLabel: string;
  id: string;
  reason: string;
  scoreLabel: string;
  sourceName: string;
  title: string;
  triggerLabel: string;
}

interface NewsPersonalizedPushLane {
  count: number;
  key: NewsPersonalizedPushQueueKey;
  label: string;
  shareLabel: string;
  stories: NewsPersonalizedPushStory[];
  summary: string;
}

const getNewsMemoryMatchers = (
  items: readonly Pick<NewsHomeItem, "category" | "entities" | "sourceSlug">[],
) => ({
  categories: new Set(
    items.map((item) => normalizePreferenceSignal(item.category)),
  ),
  entities: new Set(
    items.flatMap((item) => item.entities.map(normalizePreferenceSignal)),
  ),
  sources: new Set(
    items.map((item) => normalizePreferenceSignal(item.sourceSlug)),
  ),
});

const hasNewsMemoryMatch = ({
  historyItems,
  item,
  savedItems,
}: {
  historyItems: readonly NewsReaderMemoryItem[];
  item: RankedNewsItem<NewsHomeItem>;
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const matchers = getNewsMemoryMatchers([...historyItems, ...savedItems]);
  const category = normalizePreferenceSignal(item.category);
  const source = normalizePreferenceSignal(item.sourceSlug);
  const entities = item.entities.map(normalizePreferenceSignal);

  return (
    matchers.categories.has(category) ||
    matchers.sources.has(source) ||
    entities.some((entity) => matchers.entities.has(entity))
  );
};

const getProfileSignalCount = (profile: NewsPreferenceProfile) =>
  profile.preferredCategories.length +
  profile.preferredEntities.length +
  profile.preferredSources.length;

const getNewsPersonalizedPushPlacement = ({
  cooledEntity,
  hiddenItemIds,
  historyItems,
  item,
  negativeFeedbackItems,
  profile,
  savedItems,
}: {
  cooledEntity: { label: string } | null;
  hiddenItemIds: ReadonlySet<string>;
  historyItems: readonly NewsReaderMemoryItem[];
  item: RankedNewsItem<NewsHomeItem>;
  negativeFeedbackItems: readonly NewsHomeItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
}): {
  deliveryLabel: string;
  key: NewsPersonalizedPushQueueKey;
  reason: string;
  triggerLabel: string;
} => {
  const suppressReason = getNewsDistributionSuppressReason({
    hiddenItemIds,
    item,
    negativeFeedbackItems,
  });

  if (suppressReason) {
    return {
      deliveryLabel: "Muted",
      key: "muted",
      reason: suppressReason,
      triggerLabel: "do not send",
    };
  }

  const memoryMatch = hasNewsMemoryMatch({ historyItems, item, savedItems });
  const profileSignalCount = getProfileSignalCount(profile);

  if (
    item.sourceScore >= 82 &&
    item.trendScore >= 85 &&
    item.personalizedScore >= 135 &&
    item.matchedSignals.length > 0 &&
    !item.matchedSignals.includes("exploration")
  ) {
    if (cooledEntity) {
      return {
        deliveryLabel: "Next digest",
        key: "digest",
        reason: `Entity cooldown after ${cooledEntity.label} push`,
        triggerLabel: "push cooldown",
      };
    }

    return {
      deliveryLabel: "Push now",
      key: "push_now",
      reason: "High-trust profile match",
      triggerLabel: `${item.matchedSignals.length} reader ${
        item.matchedSignals.length === 1 ? "signal" : "signals"
      }`,
    };
  }

  if (item.matchedSignals.includes("exploration")) {
    return {
      deliveryLabel: "Quiet watch",
      key: "watch",
      reason: "Exploration sample",
      triggerLabel: "exploration test",
    };
  }

  if (memoryMatch) {
    return {
      deliveryLabel: "Next digest",
      key: "digest",
      reason: "Matches saved or reading memory",
      triggerLabel: "memory match",
    };
  }

  if (item.matchedSignals.length > 0 || item.personalizedScore >= 120) {
    return {
      deliveryLabel: "Next digest",
      key: "digest",
      reason: "Profile match can wait for the next brief",
      triggerLabel:
        profileSignalCount > 0
          ? `${profileSignalCount} profile signals`
          : "profile match",
    };
  }

  return {
    deliveryLabel: "Quiet watch",
    key: "watch",
    reason: "Low reader intent",
    triggerLabel: "trend watch",
  };
};

const toNewsPersonalizedPushStory = ({
  deliveryLabel,
  formatCategory,
  item,
  reason,
  triggerLabel,
}: {
  deliveryLabel: string;
  formatCategory: (category: string) => string;
  item: RankedNewsItem<NewsHomeItem>;
  reason: string;
  triggerLabel: string;
}): NewsPersonalizedPushStory => ({
  categoryLabel: formatCategory(item.category),
  deliveryLabel,
  id: item.id,
  reason,
  scoreLabel: `${item.personalizedScore} score / ${item.trendScore} heat`,
  sourceName: item.sourceName,
  title: item.title,
  triggerLabel,
});

export const getNewsPersonalizedPushQueue = ({
  formatCategory,
  hiddenItemIds,
  historyItems,
  items,
  limit,
  negativeFeedbackItems,
  profile,
  savedItems,
}: {
  formatCategory: (category: string) => string;
  hiddenItemIds: readonly string[];
  historyItems: readonly NewsReaderMemoryItem[];
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  negativeFeedbackItems: readonly NewsHomeItem[];
  profile: NewsPreferenceProfile;
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const hiddenIds = new Set(hiddenItemIds);
  const buckets = new Map<
    NewsPersonalizedPushQueueKey,
    { count: number; stories: NewsPersonalizedPushStory[] }
  >(
    newsPersonalizedPushQueueDefinitions.map((definition) => [
      definition.key,
      { count: 0, stories: [] },
    ]),
  );
  const pushNowEntityKeys = new Set<string>();

  for (const item of items) {
    const itemEntities = getNewsAlertRoutingSpecificEntities(item);
    const cooledEntity =
      itemEntities.find((entity) => pushNowEntityKeys.has(entity.key)) ?? null;
    const placement = getNewsPersonalizedPushPlacement({
      cooledEntity,
      hiddenItemIds: hiddenIds,
      historyItems,
      item,
      negativeFeedbackItems,
      profile,
      savedItems,
    });
    const bucket = buckets.get(placement.key);

    if (!bucket) continue;

    bucket.count += 1;

    if (bucket.stories.length < limit) {
      bucket.stories.push(
        toNewsPersonalizedPushStory({
          deliveryLabel: placement.deliveryLabel,
          formatCategory,
          item,
          reason: placement.reason,
          triggerLabel: placement.triggerLabel,
        }),
      );
    }

    if (placement.key === "push_now") {
      itemEntities.forEach((entity) => pushNowEntityKeys.add(entity.key));
    }
  }

  const lanes: NewsPersonalizedPushLane[] =
    newsPersonalizedPushQueueDefinitions.map((definition) => {
      const bucket = buckets.get(definition.key);
      const count = bucket?.count ?? 0;

      return {
        count,
        key: definition.key,
        label: definition.label,
        shareLabel: formatPercentage(count, items.length),
        stories: bucket?.stories ?? [],
        summary: definition.summary,
      };
    });
  const getLaneCount = (key: NewsPersonalizedPushQueueKey) =>
    buckets.get(key)?.count ?? 0;
  const nowCount = getLaneCount("push_now");
  const digestCount = getLaneCount("digest");
  const watchCount = getLaneCount("watch");
  const mutedCount = getLaneCount("muted");

  return {
    label: items.length === 0 ? "Push Queue Waiting" : "Push Queue Ready",
    lanes,
    metrics: [
      { label: "Now", value: String(nowCount) },
      { label: "Digest", value: String(digestCount) },
      { label: "Watch", value: String(watchCount) },
      { label: "Muted", value: String(mutedCount) },
    ],
    summary:
      items.length === 0
        ? "Personalized push queue will appear after stories are ranked."
        : `${items.length} ${
            items.length === 1 ? "story" : "stories"
          } queued for reader push: ${nowCount} now, ${digestCount} digest, ${watchCount} watch, and ${mutedCount} muted.`,
  };
};

const getDominantChannelCategory = ({
  formatCategory,
  items,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
}) => {
  const categoryCounts = new Map<
    string,
    { category: string; count: number; firstIndex: number }
  >();

  items.forEach((item, index) => {
    const existing = categoryCounts.get(item.category);

    if (!existing) {
      categoryCounts.set(item.category, {
        category: item.category,
        count: 1,
        firstIndex: index,
      });
      return;
    }

    existing.count += 1;
  });

  const [dominantCategory] = Array.from(categoryCounts.values()).sort(
    (left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.firstIndex - right.firstIndex;
    },
  );

  return dominantCategory
    ? {
        count: dominantCategory.count,
        label: formatCategory(dominantCategory.category),
      }
    : null;
};

export const getNewsChannelStrategy = ({
  formatCategory,
  items,
  profile,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  profile: NewsPreferenceProfile;
}) => {
  const totalCount = items.length;
  const profileLedItems = items.filter(
    (item) =>
      !item.matchedSignals.includes("exploration") &&
      item.matchedSignals.length > 0,
  );
  const explorationItems = items.filter((item) =>
    item.matchedSignals.includes("exploration"),
  );
  const trendLedItems = items.filter(
    (item) => item.matchedSignals.length === 0,
  );
  const profileLedCount = profileLedItems.length;
  const explorationCount = explorationItems.length;
  const trendLedCount = trendLedItems.length;
  const activeTopicCount = new Set(profileLedItems.map((item) => item.category))
    .size;

  if (totalCount === 0) {
    return {
      label: "Waiting For Signals",
      lanes: [],
      metrics: [
        { label: "Profile-led", value: "0%" },
        { label: "Exploration", value: "0%" },
        { label: "Trend-led", value: "0%" },
        { label: "Active topics", value: "0" },
      ],
      priorities: [
        {
          detail:
            "Ingest stories and collect reader actions before locking a channel mix.",
          label: "Learning needed",
        },
      ],
      summary: "Channel strategy will appear as stories load.",
    };
  }

  const profileDominantCategory = getDominantChannelCategory({
    formatCategory,
    items: profileLedItems,
  });
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const noveltyLeads =
    normalizedProfile.noveltyBias > normalizedProfile.recencyBias;
  const recencyLeads =
    normalizedProfile.recencyBias > normalizedProfile.noveltyBias;
  const lanes = [
    ...(profileLedCount > 0
      ? [
          {
            action: "Keep saving high-signal stories to sharpen this channel.",
            count: profileLedCount,
            detail: profileDominantCategory
              ? `${profileDominantCategory.label} leads profile coverage with ${
                  profileDominantCategory.count
                } ${profileDominantCategory.count === 1 ? "story" : "stories"}.`
              : "Reader signals are carrying the For You channel.",
            label: "For You",
            share: Math.round((profileLedCount / totalCount) * 100),
          },
        ]
      : [
          {
            action: "Pick topics or sources to start the For You channel.",
            count: 0,
            detail: "No current stories match saved reader signals.",
            label: "For You",
            share: 0,
          },
        ]),
    ...(explorationCount > 0
      ? [
          {
            action: "Save useful surprises or hide weak ones.",
            count: explorationCount,
            detail: `${explorationCount} ${
              explorationCount === 1 ? "story is" : "stories are"
            } testing coverage outside the current profile.`,
            label: "Explore",
            share: Math.round((explorationCount / totalCount) * 100),
          },
        ]
      : [
          {
            action: "Add exploration by broadening topics or raising novelty.",
            count: 0,
            detail: "No exploration story is present in this edition slice.",
            label: "Explore",
            share: 0,
          },
        ]),
    ...(trendLedCount > 0
      ? [
          {
            action: "Use Trending mode when you want broader market heat.",
            count: trendLedCount,
            detail:
              "Trend-led coverage is filling gaps without reader matches.",
            label: "Trending",
            share: Math.round((trendLedCount / totalCount) * 100),
          },
        ]
      : [
          {
            action: "Keep a trend-led lane available for market shocks.",
            count: 0,
            detail: "The current edition is fully driven by reader signals.",
            label: "Trending",
            share: 0,
          },
        ]),
  ];
  const hasBalancedMix =
    profileLedCount > 0 && explorationCount > 0 && trendLedCount > 0;
  const label = hasBalancedMix
    ? "Balanced Channels"
    : profileLedCount / totalCount >= 0.75
      ? "Profile Heavy"
      : explorationCount >= profileLedCount && explorationCount > 0
        ? "Discovery Push"
        : "Learning Channels";

  return {
    label,
    lanes,
    metrics: [
      {
        label: "Profile-led",
        value: formatPercentage(profileLedCount, totalCount),
      },
      {
        label: "Exploration",
        value: formatPercentage(explorationCount, totalCount),
      },
      {
        label: "Trend-led",
        value: formatPercentage(trendLedCount, totalCount),
      },
      { label: "Active topics", value: String(activeTopicCount) },
    ],
    priorities: [
      {
        detail: hasBalancedMix
          ? "For You can lead because reader signals, exploration, and trend-led coverage are all present."
          : label === "Profile Heavy"
            ? "For You is dominant; add exploration to avoid narrowing the edition."
            : label === "Discovery Push"
              ? "Exploration is leading; save or hide stories to teach the profile faster."
              : "Keep collecting reader actions until the channel mix stabilizes.",
        label: "Lead channel",
      },
      {
        detail: noveltyLeads
          ? "Novelty bias is higher than freshness, so exploration stories should stay visible."
          : recencyLeads
            ? "Freshness bias is higher than novelty, so newest stories should stay near the top."
            : "Freshness and novelty are balanced, so channel placement can follow story quality.",
        label: "Bias posture",
      },
    ],
    summary: `${totalCount} ${
      totalCount === 1 ? "story" : "stories"
    } distributed across 3 AI channels: ${profileLedCount} profile-led, ${explorationCount} exploration, and ${trendLedCount} trend-led.`,
  };
};

type NewsChannelRailStatus = "Discover" | "Following" | "Live" | "Trending";

interface NewsChannelRailWorking {
  category: string;
  firstIndex: number;
  items: RankedNewsItem<NewsHomeItem>[];
  sourceSlugs: Set<string>;
  trendScoreTotal: number;
}

const toNewsChannelRailStory = (item: RankedNewsItem<NewsHomeItem>) => ({
  id: item.id,
  sourceName: item.sourceName,
  title: item.title,
});

const getNewsChannelRailStatus = ({
  channel,
  profile,
}: {
  channel: NewsChannelRailWorking;
  profile: NewsPreferenceProfile;
}): NewsChannelRailStatus => {
  if (hasPreferenceSignal(profile.preferredCategories, channel.category)) {
    return "Following";
  }

  if (
    channel.items.some((item) => item.matchedSignals.includes("exploration"))
  ) {
    return "Discover";
  }

  return "Trending";
};

const getNewsChannelRailReason = ({
  statusLabel,
  storyCount,
}: {
  statusLabel: NewsChannelRailStatus;
  storyCount: number;
}) => {
  if (statusLabel === "Following") {
    return `${storyCount} ${
      storyCount === 1 ? "story matches" : "stories match"
    } an active reader topic.`;
  }

  if (statusLabel === "Discover") {
    return "Exploration channel tests adjacent interest.";
  }

  return "Trend heat keeps this channel in the rail.";
};

const getNewsChannelRailScore = ({
  averageTrendScore,
  statusLabel,
  storyCount,
}: {
  averageTrendScore: number;
  statusLabel: NewsChannelRailStatus;
  storyCount: number;
}) =>
  averageTrendScore +
  storyCount * 12 +
  (statusLabel === "Following" ? 40 : 0) +
  (statusLabel === "Discover" ? 24 : 0);

const toNewsChannelRailChannel = ({
  channel,
  formatCategory,
  profile,
}: {
  channel: NewsChannelRailWorking;
  formatCategory: (category: string) => string;
  profile: NewsPreferenceProfile;
}) => {
  const storyCount = channel.items.length;
  const sourceCount = channel.sourceSlugs.size;
  const averageTrendScore = Math.round(channel.trendScoreTotal / storyCount);
  const statusLabel = getNewsChannelRailStatus({ channel, profile });
  const [topStory] = channel.items;

  return {
    firstIndex: channel.firstIndex,
    key: channel.category,
    label: formatCategory(channel.category),
    reason: getNewsChannelRailReason({ statusLabel, storyCount }),
    score: getNewsChannelRailScore({
      averageTrendScore,
      statusLabel,
      storyCount,
    }),
    scoreLabel: `${storyCount} ${
      storyCount === 1 ? "story" : "stories"
    } / ${averageTrendScore} heat`,
    sourceCount,
    statusLabel,
    storyCount,
    topStory: topStory ? toNewsChannelRailStory(topStory) : null,
  };
};

export const getNewsChannelRail = ({
  formatCategory,
  items,
  limit,
  profile,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  profile: NewsPreferenceProfile;
}) => {
  if (items.length === 0 || limit <= 0) {
    return {
      channels: [],
      label: "Channel Rail Waiting",
      metrics: [
        { label: "Channels", value: "0" },
        { label: "Following", value: "0" },
        { label: "Discover", value: "0" },
        { label: "Sources", value: "0" },
      ],
      summary: "Channel rail will appear after stories are ranked.",
    };
  }

  const channelsByCategory = new Map<string, NewsChannelRailWorking>();

  items.forEach((item, index) => {
    const existing = channelsByCategory.get(item.category);

    if (!existing) {
      channelsByCategory.set(item.category, {
        category: item.category,
        firstIndex: index,
        items: [item],
        sourceSlugs: new Set([item.sourceSlug]),
        trendScoreTotal: item.trendScore,
      });
      return;
    }

    existing.items.push(item);
    existing.sourceSlugs.add(item.sourceSlug);
    existing.trendScoreTotal += item.trendScore;
  });

  const categoryChannels = Array.from(channelsByCategory.values())
    .map((channel) =>
      toNewsChannelRailChannel({
        channel,
        formatCategory,
        profile,
      }),
    )
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.storyCount !== left.storyCount) {
        return right.storyCount - left.storyCount;
      }
      return left.firstIndex - right.firstIndex;
    });
  const sourceCount = new Set(items.map((item) => item.sourceSlug)).size;
  const [leadStory] = items;
  const forYouChannel = {
    key: "for_you",
    label: "For You",
    reason:
      "Reader-ranked front page blends profile matches, exploration, and trend heat.",
    scoreLabel: leadStory
      ? `${leadStory.personalizedScore} lead score`
      : "0 lead score",
    sourceCount,
    statusLabel: "Live" as const,
    storyCount: items.length,
    topStory: leadStory ? toNewsChannelRailStory(leadStory) : null,
  };
  const channels = [
    forYouChannel,
    ...categoryChannels
      .slice(0, Math.max(0, limit - 1))
      .map(({ firstIndex: _firstIndex, score: _score, ...channel }) => channel),
  ].slice(0, limit);
  const followingCount = channels.filter(
    (channel) => channel.statusLabel === "Following",
  ).length;
  const discoverCount = channels.filter(
    (channel) => channel.statusLabel === "Discover",
  ).length;

  return {
    channels,
    label: "Channel Rail Ready",
    metrics: [
      { label: "Channels", value: String(channels.length) },
      { label: "Following", value: String(followingCount) },
      { label: "Discover", value: String(discoverCount) },
      { label: "Sources", value: String(sourceCount) },
    ],
    summary: `${channels.length} ${
      channels.length === 1 ? "channel routes" : "channels route"
    } ${items.length} ${items.length === 1 ? "story" : "stories"} across ${sourceCount} ${
      sourceCount === 1 ? "source" : "sources"
    }.`,
  };
};

const getSharedProfileEntity = (
  item: NewsHomeItem,
  profile: NewsPreferenceProfile,
) => {
  const preferredEntities = new Set(
    profile.preferredEntities.map((entity) => entity.toLowerCase()),
  );

  return item.entities.find((entity) =>
    preferredEntities.has(entity.toLowerCase()),
  );
};

export const getNewsFeedbackCoach = ({
  formatCategory,
  items,
  profile,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  profile: NewsPreferenceProfile;
}) => {
  const readerSignalSummary = getNewsReaderSignalSummary(profile);
  const explorationCount = items.filter((item) =>
    item.matchedSignals.includes("exploration"),
  ).length;
  const metrics = [
    { label: "Suggestions", value: "0" },
    { label: "Reader signals", value: String(readerSignalSummary.signalCount) },
    { label: "Exploration", value: String(explorationCount) },
  ];

  if (items.length === 0) {
    return {
      actions: [],
      label: "Waiting",
      metrics,
      summary: "Feedback coach will appear as ranked stories load.",
    };
  }

  const usedIds = new Set<string>();
  const actions: {
    action: Extract<ReaderInteractionAction, "hide" | "save" | "share">;
    buttonLabel: string;
    label: string;
    reason: string;
    storyId: string;
    storyTitle: string;
  }[] = [];
  const addAction = ({
    action,
    buttonLabel,
    item,
    label,
    reason,
  }: {
    action: Extract<ReaderInteractionAction, "hide" | "save" | "share">;
    buttonLabel: string;
    item: RankedNewsItem<NewsHomeItem> | undefined;
    label: string;
    reason: string;
  }) => {
    if (!item || usedIds.has(item.id) || actions.length >= 3) return;

    usedIds.add(item.id);
    actions.push({
      action,
      buttonLabel,
      label,
      reason,
      storyId: item.id,
      storyTitle: item.title,
    });
  };

  const profileMatchedStory = items.find(
    (item) =>
      item.matchedSignals.length > 0 &&
      !item.matchedSignals.includes("exploration"),
  );
  const sharedEntity = profileMatchedStory
    ? getSharedProfileEntity(profileMatchedStory, profile)
    : null;

  addAction({
    action: "save",
    buttonLabel: "Save",
    item: profileMatchedStory,
    label: "Strengthen",
    reason: profileMatchedStory
      ? `Save this ${formatCategory(
          profileMatchedStory.category,
        )} story to reinforce ${profileMatchedStory.sourceName} and ${
          sharedEntity ?? "this topic"
        }.`
      : "Save a matching story to reinforce the reader profile.",
  });

  const explorationStory = items.find((item) =>
    item.matchedSignals.includes("exploration"),
  );

  addAction({
    action: "save",
    buttonLabel: "Save",
    item: explorationStory,
    label: "Test surprise",
    reason: explorationStory
      ? `Save this ${formatCategory(
          explorationStory.category,
        )} exploration if it belongs in your mix.`
      : "Save a useful surprise to broaden the profile.",
  });

  const lowTrustHighHeatStory = items.find(
    (item) =>
      !usedIds.has(item.id) && item.sourceScore < 60 && item.trendScore >= 80,
  );

  addAction({
    action: "hide",
    buttonLabel: "Less",
    item: lowTrustHighHeatStory,
    label: "Reduce noise",
    reason:
      "Less will dampen a lower-trust high-heat story before it trains the profile.",
  });

  const shareCandidate = items.find(
    (item) => !usedIds.has(item.id) && item.sourceScore >= 80,
  );

  addAction({
    action: "share",
    buttonLabel: "Share",
    item: shareCandidate,
    label: "Boost signal",
    reason: shareCandidate
      ? `Share this ${formatCategory(
          shareCandidate.category,
        )} story if it should strongly shape future editions.`
      : "Share a strong story when it should heavily shape the profile.",
  });

  return {
    actions,
    label: actions.length > 0 ? "Actionable" : "Waiting",
    metrics: [
      { label: "Suggestions", value: String(actions.length) },
      {
        label: "Reader signals",
        value: String(readerSignalSummary.signalCount),
      },
      { label: "Exploration", value: String(explorationCount) },
    ],
    summary:
      actions.length > 0
        ? `${actions.length} feedback ${
            actions.length === 1 ? "action can" : "actions can"
          } tune the next For You edition.`
        : "Feedback coach will appear as ranked stories load.",
  };
};

export const getNewsSourceBalance = ({
  items,
}: {
  items: readonly NewsHomeItem[];
}) => {
  const totalCount = items.length;

  if (totalCount === 0) {
    return {
      concentration: "Empty",
      dominantSource: null,
      summary: "Source balance will appear as stories load.",
      totalCount,
      uniqueSourceCount: 0,
    };
  }

  const sourceCounts = new Map<
    string,
    { count: number; name: string; slug: string }
  >();

  for (const item of items) {
    const current = sourceCounts.get(item.sourceSlug);

    sourceCounts.set(item.sourceSlug, {
      count: current ? current.count + 1 : 1,
      name: current?.name ?? item.sourceName,
      slug: item.sourceSlug,
    });
  }

  const sources = Array.from(sourceCounts.values()).sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.name.localeCompare(right.name);
  });
  const dominant = sources[0];

  if (!dominant) {
    return {
      concentration: "Empty",
      dominantSource: null,
      summary: "Source balance will appear as stories load.",
      totalCount,
      uniqueSourceCount: 0,
    };
  }

  const percentage = Math.round((dominant.count / totalCount) * 100);
  const uniqueSourceCount = sources.length;
  const concentration =
    uniqueSourceCount === 1
      ? "Single source"
      : percentage > 50
        ? "Concentrated"
        : "Balanced";

  return {
    concentration,
    dominantSource: {
      count: dominant.count,
      name: dominant.name,
      percentage,
      slug: dominant.slug,
    },
    summary: `${uniqueSourceCount} ${
      uniqueSourceCount === 1 ? "source" : "sources"
    } represented; ${dominant.name} leads with ${percentage}%.`,
    totalCount,
    uniqueSourceCount,
  };
};

export const getNewsSourceTrustLedger = ({
  items,
}: {
  items: readonly NewsHomeItem[];
}) => {
  const totalCount = items.length;
  const highTrustCount = items.filter((item) => item.sourceScore >= 80).length;
  const watchlistCount = items.filter((item) => item.sourceScore < 60).length;
  const lowTrustHeatCount = items.filter(
    (item) => item.sourceScore < 60 && item.trendScore >= 80,
  ).length;
  const averageSourceScore =
    totalCount > 0
      ? Math.round(
          items.reduce((total, item) => total + item.sourceScore, 0) /
            totalCount,
        )
      : 0;

  if (totalCount === 0) {
    return {
      label: "Empty",
      metrics: [
        { label: "High trust", value: "0/0" },
        { label: "Watchlist", value: "0" },
        { label: "Average score", value: "0" },
        { label: "Low-trust heat", value: "0" },
      ],
      notices: [],
      summary: "Source trust ledger will appear as stories load.",
    };
  }

  const notices: { detail: string; label: string }[] = [];

  if (lowTrustHeatCount > 0) {
    notices.push({
      detail: `${lowTrustHeatCount} high-heat ${
        lowTrustHeatCount === 1 ? "story" : "stories"
      } from lower-trust sources ${
        lowTrustHeatCount === 1 ? "is" : "are"
      } dampened before ranking.`,
      label: "Trust guard",
    });
  } else {
    notices.push({
      detail: "No low-trust high-heat stories are leading this edition.",
      label: "Trust guard",
    });
  }

  if (highTrustCount > 0) {
    notices.push({
      detail: `${highTrustCount} high-trust ${
        highTrustCount === 1 ? "story is" : "stories are"
      } anchoring this edition.`,
      label: "Source confidence",
    });
  }

  const label =
    lowTrustHeatCount > 0
      ? "Guarded"
      : highTrustCount / totalCount >= 0.6
        ? "High Trust"
        : "Mixed Trust";

  return {
    label,
    metrics: [
      { label: "High trust", value: `${highTrustCount}/${totalCount}` },
      { label: "Watchlist", value: String(watchlistCount) },
      { label: "Average score", value: String(averageSourceScore) },
      { label: "Low-trust heat", value: String(lowTrustHeatCount) },
    ],
    notices,
    summary: `${highTrustCount} of ${totalCount} ${
      totalCount === 1 ? "story comes" : "stories come"
    } from high-trust sources; ${lowTrustHeatCount} low-trust high-heat ${
      lowTrustHeatCount === 1 ? "story is" : "stories are"
    } being guarded.`,
  };
};

type NewsAggregationIntakeLaneKey =
  | "community"
  | "desk"
  | "launch"
  | "primary"
  | "research";

interface NewsAggregationIntakeLaneDefinition {
  action: string;
  key: NewsAggregationIntakeLaneKey;
  label: string;
}

const newsAggregationIntakeLaneDefinitions = [
  {
    action: "Anchor the front page with direct-source reporting.",
    key: "primary",
    label: "Primary Sources",
  },
  {
    action: "Verify community heat with a primary source before promotion.",
    key: "community",
    label: "Community Signals",
  },
  {
    action: "Check traction and funding context before promotion.",
    key: "launch",
    label: "Launch Watch",
  },
  {
    action: "Assign explainer treatment before the next edition.",
    key: "research",
    label: "Research Desk",
  },
  {
    action: "Keep desk notes as fallback until live sources refresh.",
    key: "desk",
    label: "Desk Notes",
  },
] as const satisfies readonly NewsAggregationIntakeLaneDefinition[];

const newsAggregationSourceTypeLabels = {
  api: "API",
  crawler: "Crawler",
  github: "GitHub",
  hacker_news: "Hacker News",
  manual: "Manual",
  other: "Other",
  product_hunt: "Product Hunt",
  publication: "Publication",
  research: "Research",
  rss: "RSS",
  social: "Social",
  vendor_blog: "Vendor Blog",
  yc: "YC",
} as const;

const formatNewsAggregationSourceType = (sourceType: string) => {
  const normalizedSourceType = sourceType.trim().toLowerCase();

  if (normalizedSourceType in newsAggregationSourceTypeLabels) {
    return newsAggregationSourceTypeLabels[
      normalizedSourceType as keyof typeof newsAggregationSourceTypeLabels
    ];
  }

  return normalizedSourceType
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const getNewsAggregationIntakeLaneKey = (
  item: NewsHomeItem,
): NewsAggregationIntakeLaneKey => {
  const sourceType = item.sourceType.trim().toLowerCase();

  if (["hacker_news", "github", "social", "community"].includes(sourceType)) {
    return "community";
  }

  if (
    ["product_hunt", "yc"].includes(sourceType) ||
    item.category === "funding" ||
    item.category === "yc_ai"
  ) {
    return "launch";
  }

  if (
    sourceType === "research" ||
    item.category === "research" ||
    item.category === "policy" ||
    item.category === "security"
  ) {
    return "research";
  }

  if (sourceType === "manual" || sourceType === "other") {
    return "desk";
  }

  if (
    ["publication", "rss", "vendor_blog"].includes(sourceType) ||
    item.sourceScore >= 80
  ) {
    return "primary";
  }

  return "desk";
};

const getNewsAggregationLaneSummary = ({
  count,
  key,
}: {
  count: number;
  key: NewsAggregationIntakeLaneKey;
}) => {
  if (key === "primary") {
    return `${count} direct-source ${
      count === 1 ? "story" : "stories"
    } from labs, vendors, or publications ${
      count === 1 ? "is" : "are"
    } ready for ranking.`;
  }

  if (key === "community") {
    return `${count} community ${
      count === 1 ? "signal needs" : "signals need"
    } confirmation before ${count === 1 ? "it" : "they"} ${
      count === 1 ? "leads" : "lead"
    }.`;
  }

  if (key === "launch") {
    return `${count} launch or startup ${
      count === 1 ? "signal is" : "signals are"
    } ready for market context.`;
  }

  if (key === "research") {
    return `${count} research, policy, or security ${
      count === 1 ? "story needs" : "stories need"
    } translation.`;
  }

  return `${count} desk or fallback ${
    count === 1 ? "story keeps" : "stories keep"
  } the edition coherent.`;
};

export const getNewsAggregationIntake = ({
  items,
  limit,
}: {
  items: readonly NewsHomeItem[];
  limit: number;
}) => {
  const totalCount = items.length;
  const storyLimit = Math.max(0, limit);

  if (totalCount === 0) {
    return {
      label: "Cold Intake",
      lanes: [],
      metrics: [
        { label: "Stories", value: "0" },
        { label: "Lanes", value: "0" },
        { label: "High trust", value: "0" },
        { label: "Needs verify", value: "0" },
      ],
      summary: "Aggregation intake will appear after sources deliver stories.",
    };
  }

  const laneBuckets = new Map<NewsAggregationIntakeLaneKey, NewsHomeItem[]>();

  for (const item of items) {
    const laneKey = getNewsAggregationIntakeLaneKey(item);
    const laneItems = laneBuckets.get(laneKey) ?? [];
    laneItems.push(item);
    laneBuckets.set(laneKey, laneItems);
  }

  const lanes = newsAggregationIntakeLaneDefinitions
    .map((definition) => {
      const laneItems = laneBuckets.get(definition.key) ?? [];

      return {
        action: definition.action,
        count: laneItems.length,
        key: definition.key,
        label: definition.label,
        shareLabel: formatPercentage(laneItems.length, totalCount),
        stories: laneItems.slice(0, storyLimit).map((item) => ({
          id: item.id,
          reason: `${formatNewsAggregationSourceType(
            item.sourceType,
          )} source with ${item.sourceScore} trust.`,
          scoreLabel: `${item.sourceScore} trust / ${item.trendScore} trend`,
          sourceName: item.sourceName,
          title: item.title,
        })),
        summary: getNewsAggregationLaneSummary({
          count: laneItems.length,
          key: definition.key,
        }),
      };
    })
    .filter((lane) => lane.count > 0);

  const highTrustCount = items.filter((item) => item.sourceScore >= 80).length;
  const needsVerifyCount = items.filter((item) => {
    const laneKey = getNewsAggregationIntakeLaneKey(item);

    return (
      (laneKey === "community" || laneKey === "launch") && item.sourceScore < 80
    );
  }).length;
  const [leadingLane] = lanes;

  return {
    label: "Active Intake",
    lanes,
    metrics: [
      { label: "Stories", value: String(totalCount) },
      { label: "Lanes", value: String(lanes.length) },
      { label: "High trust", value: String(highTrustCount) },
      { label: "Needs verify", value: String(needsVerifyCount) },
    ],
    summary: leadingLane
      ? `${totalCount} ${
          totalCount === 1 ? "story is" : "stories are"
        } entering the desk across ${lanes.length} intake ${
          lanes.length === 1 ? "lane" : "lanes"
        }; ${leadingLane.label} leads with ${leadingLane.shareLabel}.`
      : "Aggregation intake will appear after sources deliver stories.",
  };
};

export const getNewsEntityRadar = ({
  items,
  limit,
}: {
  items: readonly NewsHomeItem[];
  limit: number;
}) => {
  const entityMap = new Map<
    string,
    {
      entity: string;
      sources: Set<string>;
      storyIds: Set<string>;
      trendScoreTotal: number;
    }
  >();

  for (const item of items) {
    const seenEntities = new Set<string>();

    for (const entityValue of item.entities) {
      const entity = entityValue.trim();
      const normalizedEntity = entity.toLowerCase();

      if (!entity || seenEntities.has(normalizedEntity)) continue;

      const existing = entityMap.get(normalizedEntity);

      if (!existing) {
        entityMap.set(normalizedEntity, {
          entity,
          sources: new Set([item.sourceSlug]),
          storyIds: new Set([item.id]),
          trendScoreTotal: item.trendScore,
        });
      } else {
        existing.sources.add(item.sourceSlug);
        existing.storyIds.add(item.id);
        existing.trendScoreTotal += item.trendScore;
      }

      seenEntities.add(normalizedEntity);
    }
  }

  return Array.from(entityMap.values())
    .map((entry) => {
      const storyCount = entry.storyIds.size;
      const sourceCount = entry.sources.size;
      const averageTrendScore =
        storyCount > 0 ? Math.round(entry.trendScoreTotal / storyCount) : 0;

      return {
        entity: entry.entity,
        heatScore: averageTrendScore + storyCount * 20 + sourceCount * 6,
        sourceCount,
        storyCount,
      };
    })
    .sort((left, right) => {
      if (right.heatScore !== left.heatScore) {
        return right.heatScore - left.heatScore;
      }

      if (right.storyCount !== left.storyCount) {
        return right.storyCount - left.storyCount;
      }

      return left.entity.localeCompare(right.entity);
    })
    .slice(0, limit);
};

export const getNewsEditionBriefing = ({
  entityLimit,
  formatCategory,
  items,
  topicLimit,
}: {
  entityLimit: number;
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  topicLimit: number;
}) => {
  const storyCount = items.length;
  const sourceCount = new Set(items.map((item) => item.sourceSlug)).size;
  const topicCount = new Set(items.map((item) => item.category)).size;
  const topics = getNewsTopicPulse({ items, limit: topicLimit }).map(
    (topic) => ({
      ...topic,
      label: formatCategory(topic.category),
    }),
  );
  const entities = getNewsEntityRadar({ items, limit: entityLimit });
  const [leadStory] = items;

  if (!leadStory) {
    return {
      entities,
      headline: "Today's AI briefing",
      lead: null,
      metrics: [
        { label: "Stories", value: "0" },
        { label: "Sources", value: "0" },
        { label: "Topics", value: "0" },
      ],
      sourceCount,
      storyCount,
      summary: "Briefing will appear as stories load.",
      topics,
    };
  }

  const [topTopic] = topics;
  const [topEntity] = entities;
  const topicSummary = topTopic
    ? `${topTopic.label} coverage`
    : "the ranked AI feed";
  const entitySummary = topEntity ? ` and ${topEntity.entity} momentum` : "";

  return {
    entities,
    headline: leadStory.title,
    lead: {
      category: leadStory.category,
      categoryLabel: formatCategory(leadStory.category),
      personalizedScore: leadStory.personalizedScore,
      sourceName: leadStory.sourceName,
      title: leadStory.title,
    },
    metrics: [
      { label: "Stories", value: String(storyCount) },
      { label: "Sources", value: String(sourceCount) },
      { label: "Topics", value: String(topicCount) },
    ],
    sourceCount,
    storyCount,
    summary: `${storyCount} ${
      storyCount === 1 ? "story" : "stories"
    } from ${sourceCount} ${
      sourceCount === 1 ? "source" : "sources"
    }, led by ${topicSummary}${entitySummary}.`,
    topics,
  };
};

const toNewsBriefingPackSlot = ({
  formatCategory,
  item,
  label,
  reason,
  scoreLabel,
}: {
  formatCategory: (category: string) => string;
  item: RankedNewsItem<NewsHomeItem>;
  label: string;
  reason: string;
  scoreLabel: string;
}) => ({
  categoryLabel: formatCategory(item.category),
  id: item.id,
  label,
  reason,
  scoreLabel,
  sourceName: item.sourceName,
  title: item.title,
});

const selectUnusedNewsBriefingPackStory = ({
  items,
  score,
  usedIds,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
  score: (item: RankedNewsItem<NewsHomeItem>) => number;
  usedIds: ReadonlySet<string>;
}) =>
  [...items]
    .filter((item) => !usedIds.has(item.id))
    .sort((left, right) => {
      const scoreDiff = score(right) - score(left);
      if (scoreDiff !== 0) return scoreDiff;

      if (right.personalizedScore !== left.personalizedScore) {
        return right.personalizedScore - left.personalizedScore;
      }

      return (
        new Date(right.publishedAt).getTime() -
        new Date(left.publishedAt).getTime()
      );
    })[0];

export const getNewsBriefingPack = ({
  formatCategory,
  items,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
}) => {
  if (items.length === 0) {
    return {
      label: "Waiting",
      metrics: [
        { label: "Slots", value: "0" },
        { label: "Sources", value: "0" },
        { label: "Categories", value: "0" },
      ],
      slots: [],
      summary: "Briefing pack will appear as stories load.",
    };
  }

  const usedIds = new Set<string>();
  const slots: ReturnType<typeof toNewsBriefingPackSlot>[] = [];
  const addSlot = ({
    item,
    label,
    reason,
    scoreLabel,
  }: {
    item: RankedNewsItem<NewsHomeItem> | undefined;
    label: string;
    reason: string;
    scoreLabel: string;
  }) => {
    if (!item || usedIds.has(item.id)) return;

    usedIds.add(item.id);
    slots.push(
      toNewsBriefingPackSlot({
        formatCategory,
        item,
        label,
        reason,
        scoreLabel,
      }),
    );
  };
  const [leadStory] = items;

  addSlot({
    item: leadStory,
    label: "Lead",
    reason: "Highest-ranked For You story.",
    scoreLabel: leadStory ? `${leadStory.personalizedScore} score` : "0 score",
  });

  const latestStory = selectUnusedNewsBriefingPackStory({
    items,
    score: (item) => new Date(item.publishedAt).getTime(),
    usedIds,
  });

  addSlot({
    item: latestStory,
    label: "Latest",
    reason: "Freshest story in the current edition.",
    scoreLabel: latestStory
      ? latestStory.publishedAt.slice(0, 16).replace("T", " ")
      : "No timestamp",
  });

  const heatStory = selectUnusedNewsBriefingPackStory({
    items,
    score: (item) => item.trendScore,
    usedIds,
  });

  addSlot({
    item: heatStory,
    label: "Heat",
    reason: "Highest heat story still rising.",
    scoreLabel: heatStory ? `${heatStory.trendScore} heat` : "0 heat",
  });

  const explorationStory = items.find(
    (item) =>
      !usedIds.has(item.id) && item.matchedSignals.includes("exploration"),
  );

  addSlot({
    item: explorationStory,
    label: "Explore",
    reason: "Exploration keeps the brief from narrowing.",
    scoreLabel: explorationStory
      ? `${explorationStory.personalizedScore} score`
      : "0 score",
  });

  const sourceCount = new Set(slots.map((slot) => slot.sourceName)).size;
  const categoryCount = new Set(slots.map((slot) => slot.categoryLabel)).size;

  return {
    label: `${slots.length} ${slots.length === 1 ? "Slot" : "Slots"}`,
    metrics: [
      { label: "Slots", value: String(slots.length) },
      { label: "Sources", value: String(sourceCount) },
      { label: "Categories", value: String(categoryCount) },
    ],
    slots,
    summary: `${slots.length} briefing ${
      slots.length === 1 ? "slot" : "slots"
    } from ${sourceCount} ${
      sourceCount === 1 ? "source" : "sources"
    } across ${categoryCount} ${
      categoryCount === 1 ? "category" : "categories"
    }.`,
  };
};

const toNewsFrontPageLayoutSection = ({
  formatCategory,
  item,
  label,
  reason,
  scoreLabel,
  treatment,
}: {
  formatCategory: (category: string) => string;
  item: RankedNewsItem<NewsHomeItem>;
  label: string;
  reason: string;
  scoreLabel: string;
  treatment: string;
}) => ({
  categoryLabel: formatCategory(item.category),
  id: item.id,
  label,
  reason,
  scoreLabel,
  sourceName: item.sourceName,
  title: item.title,
  treatment,
});

export const getNewsFrontPageLayout = ({
  formatCategory,
  items,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
}) => {
  if (items.length === 0) {
    return {
      label: "Waiting",
      metrics: [
        { label: "Sections", value: "0" },
        { label: "Sources", value: "0" },
        { label: "Categories", value: "0" },
      ],
      sections: [],
      summary: "Front page layout will appear after stories are ranked.",
    };
  }

  const usedIds = new Set<string>();
  const sections: ReturnType<typeof toNewsFrontPageLayoutSection>[] = [];
  const addSection = ({
    item,
    label,
    reason,
    scoreLabel,
    treatment,
  }: {
    item: RankedNewsItem<NewsHomeItem> | undefined;
    label: string;
    reason: string;
    scoreLabel: string;
    treatment: string;
  }) => {
    if (!item || usedIds.has(item.id)) return;

    usedIds.add(item.id);
    sections.push(
      toNewsFrontPageLayoutSection({
        formatCategory,
        item,
        label,
        reason,
        scoreLabel,
        treatment,
      }),
    );
  };
  const [leadStory] = items;

  addSection({
    item: leadStory,
    label: "A1 Lead",
    reason: "Highest-ranked story anchors the front page.",
    scoreLabel: leadStory ? `${leadStory.personalizedScore} score` : "0 score",
    treatment: "Lead headline",
  });

  const analysisStory = selectUnusedNewsBriefingPackStory({
    items,
    score: (item) => item.entities.length * 100 + item.sourceScore,
    usedIds,
  });

  addSection({
    item: analysisStory,
    label: "Analysis",
    reason: "Entity-dense follow-up gives the lead story context.",
    scoreLabel: analysisStory
      ? `${analysisStory.entities.length} ${
          analysisStory.entities.length === 1 ? "entity" : "entities"
        }`
      : "0 entities",
    treatment: "Context column",
  });

  const briefStory = selectUnusedNewsBriefingPackStory({
    items,
    score: (item) => item.trendScore,
    usedIds,
  });

  addSection({
    item: briefStory,
    label: "Brief",
    reason: "Highest-heat remaining story gives the page a live market note.",
    scoreLabel: briefStory ? `${briefStory.trendScore} heat` : "0 heat",
    treatment: "News brief",
  });

  const watchStory = selectUnusedNewsBriefingPackStory({
    items: items.filter((item) => item.matchedSignals.includes("exploration")),
    score: (item) => item.personalizedScore,
    usedIds,
  });

  addSection({
    item: watchStory,
    label: "Watch",
    reason: "Exploration story keeps a discovery lane on the front page.",
    scoreLabel: watchStory
      ? `${watchStory.personalizedScore} score`
      : "0 score",
    treatment: "Watch rail",
  });

  const sourceCount = new Set(sections.map((section) => section.sourceName))
    .size;
  const categoryCount = new Set(
    sections.map((section) => section.categoryLabel),
  ).size;

  return {
    label: sections.length > 0 ? "A1 Ready" : "Waiting",
    metrics: [
      { label: "Sections", value: String(sections.length) },
      { label: "Sources", value: String(sourceCount) },
      { label: "Categories", value: String(categoryCount) },
    ],
    sections,
    summary: `${sections.length} front-page ${
      sections.length === 1 ? "section" : "sections"
    } from ${sourceCount} ${
      sourceCount === 1 ? "source" : "sources"
    } across ${categoryCount} ${
      categoryCount === 1 ? "category" : "categories"
    }.`,
  };
};

type NewsFrontPageSlotMixKey = "cooldown" | "explore" | "follow_up" | "lead";

const getNewsFrontPageSharedEntities = (
  leadItem: RankedNewsItem<NewsHomeItem> | undefined,
  item: RankedNewsItem<NewsHomeItem>,
) => {
  if (!leadItem) return [];

  const leadEntities = new Set(
    leadItem.entities.map(normalizePreferenceSignal),
  );

  return item.entities.filter((entity) =>
    leadEntities.has(normalizePreferenceSignal(entity)),
  );
};

const getNewsFrontPageProfileMatchCount = ({
  item,
  profile,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  profile: NewsPreferenceProfile;
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  let count = 0;

  if (
    hasPreferenceSignal(normalizedProfile.preferredCategories, item.category)
  ) {
    count += 1;
  }

  if (
    hasPreferenceSignal(normalizedProfile.preferredSources, item.sourceSlug)
  ) {
    count += 1;
  }

  for (const entity of item.entities) {
    if (hasPreferenceSignal(normalizedProfile.preferredEntities, entity)) {
      count += 1;
    }
  }

  return count;
};

const toNewsFrontPageSlotMixSlot = ({
  formatCategory,
  item,
  key,
  label,
  reason,
  scoreLabel,
  treatment,
}: {
  formatCategory: (category: string) => string;
  item: RankedNewsItem<NewsHomeItem>;
  key: NewsFrontPageSlotMixKey;
  label: string;
  reason: string;
  scoreLabel: string;
  treatment: string;
}) => ({
  categoryLabel: formatCategory(item.category),
  id: item.id,
  key,
  label,
  reason,
  scoreLabel,
  sourceName: item.sourceName,
  title: item.title,
  treatment,
});

const getNewsFrontPageSlotMixMetrics = ({
  cooldownCount,
  explorationCount,
  readerLedCount,
  slotCount,
}: {
  cooldownCount: number;
  explorationCount: number;
  readerLedCount: number;
  slotCount: number;
}) => [
  { label: "Slots", value: String(slotCount) },
  { label: "Reader-led", value: String(readerLedCount) },
  { label: "Exploration", value: String(explorationCount) },
  { label: "Cooldown", value: String(cooldownCount) },
];

export const getNewsFrontPageSlotMix = ({
  formatCategory,
  items,
  profile,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  profile: NewsPreferenceProfile;
}) => {
  if (items.length === 0) {
    return {
      label: "Slot Mix Waiting",
      metrics: getNewsFrontPageSlotMixMetrics({
        cooldownCount: 0,
        explorationCount: 0,
        readerLedCount: 0,
        slotCount: 0,
      }),
      slots: [],
      summary: "Front-page slot mix will appear after stories are ranked.",
    };
  }

  const usedIds = new Set<string>();
  const slots: ReturnType<typeof toNewsFrontPageSlotMixSlot>[] = [];
  const addSlot = ({
    item,
    key,
    label,
    reason,
    scoreLabel,
    treatment,
  }: {
    item: RankedNewsItem<NewsHomeItem> | undefined;
    key: NewsFrontPageSlotMixKey;
    label: string;
    reason: string;
    scoreLabel: string;
    treatment: string;
  }) => {
    if (!item || usedIds.has(item.id)) return;

    usedIds.add(item.id);
    slots.push(
      toNewsFrontPageSlotMixSlot({
        formatCategory,
        item,
        key,
        label,
        reason,
        scoreLabel,
        treatment,
      }),
    );
  };
  const [leadItem] = items;
  const leadReaderSignalCount =
    getRecommendationTraceReaderSignalCount(leadItem);

  addSlot({
    item: leadItem,
    key: "lead",
    label: "Lead",
    reason: `Highest personalized score leads because ${leadReaderSignalCount} reader ${
      leadReaderSignalCount === 1 ? "signal is" : "signals are"
    } active.`,
    scoreLabel: leadItem ? `${leadItem.personalizedScore} score` : "0 score",
    treatment: "Top story",
  });

  const followUpItem = selectUnusedNewsBriefingPackStory({
    items: items.filter(
      (item) =>
        item.id !== leadItem?.id &&
        (getNewsFrontPageSharedEntities(leadItem, item).length > 0 ||
          getNewsFrontPageProfileMatchCount({ item, profile }) > 0),
    ),
    score: (item) =>
      getNewsFrontPageSharedEntities(leadItem, item).length * 100 +
      getNewsFrontPageProfileMatchCount({ item, profile }) * 50 +
      item.personalizedScore,
    usedIds,
  });
  const followUpSharedEntities = followUpItem
    ? getNewsFrontPageSharedEntities(leadItem, followUpItem)
    : [];

  addSlot({
    item: followUpItem,
    key: "follow_up",
    label: "Follow-up",
    reason:
      followUpSharedEntities.length > 0
        ? `Shares ${formatRecommendationTraceList(
            followUpSharedEntities,
          )} with the lead and keeps the reader in context.`
        : "Matches the active profile and keeps the reader in context.",
    scoreLabel:
      followUpSharedEntities.length > 0
        ? `${followUpSharedEntities.length} shared ${
            followUpSharedEntities.length === 1 ? "entity" : "entities"
          }`
        : followUpItem
          ? `${getNewsFrontPageProfileMatchCount({
              item: followUpItem,
              profile,
            })} reader signal`
          : "0 shared entities",
    treatment: "Context slot",
  });

  const exploreItem = selectUnusedNewsBriefingPackStory({
    items: items.filter((item) => item.matchedSignals.includes("exploration")),
    score: (item) => item.personalizedScore,
    usedIds,
  });

  addSlot({
    item: exploreItem,
    key: "explore",
    label: "Explore",
    reason: exploreItem
      ? `Exploration signal tests ${formatCategory(
          exploreItem.category,
        )} outside the active profile.`
      : "Exploration slot waits for an outside-profile story.",
    scoreLabel: exploreItem
      ? `${exploreItem.personalizedScore} score`
      : "0 score",
    treatment: "Discovery slot",
  });

  const cooldownItem = selectUnusedNewsBriefingPackStory({
    items: items.filter(
      (item) =>
        getRecommendationTraceReaderSignalCount(item) === 0 &&
        !item.matchedSignals.includes("exploration"),
    ),
    score: (item) => item.trendScore,
    usedIds,
  });

  addSlot({
    item: cooldownItem,
    key: "cooldown",
    label: "Cooldown",
    reason:
      "No active reader signal, so the story stays below stronger matches.",
    scoreLabel: cooldownItem ? `${cooldownItem.trendScore} heat` : "0 heat",
    treatment: "Market slot",
  });

  const readerLedCount = slots.filter(
    (slot) => slot.key === "lead" || slot.key === "follow_up",
  ).length;
  const explorationCount = slots.filter(
    (slot) => slot.key === "explore",
  ).length;
  const cooldownCount = slots.filter((slot) => slot.key === "cooldown").length;

  return {
    label: slots.length > 0 ? "Slot Mix Ready" : "Slot Mix Waiting",
    metrics: getNewsFrontPageSlotMixMetrics({
      cooldownCount,
      explorationCount,
      readerLedCount,
      slotCount: slots.length,
    }),
    slots,
    summary: `${slots.length} front-page ${
      slots.length === 1 ? "slot balances" : "slots balance"
    } ${readerLedCount} reader-led ${
      readerLedCount === 1 ? "story" : "stories"
    }, ${explorationCount} exploration ${
      explorationCount === 1 ? "story" : "stories"
    }, and ${cooldownCount} cooldown ${
      cooldownCount === 1 ? "candidate" : "candidates"
    }.`,
  };
};

type NewsReaderDaypartKey = "evening" | "midday" | "morning" | "overnight";
type NewsReaderDaypartLaneKey = "explore" | "lead" | "pulse";

const getNewsReaderDaypartConfig = (
  generatedAt: string,
): {
  cadenceMinutes: number;
  intent: string;
  key: NewsReaderDaypartKey;
  label: string;
} => {
  const date = new Date(generatedAt);
  const hour = Number.isNaN(date.getTime()) ? 12 : date.getUTCHours();

  if (hour >= 5 && hour < 11) {
    return {
      cadenceMinutes: 30,
      intent: "Open the AI day with reader matches and one discovery lane.",
      key: "morning",
      label: "Morning Brief",
    };
  }

  if (hour >= 11 && hour < 17) {
    return {
      cadenceMinutes: 15,
      intent: "Catch fast-moving AI updates without burying reader context.",
      key: "midday",
      label: "Midday Scan",
    };
  }

  if (hour >= 17 && hour < 22) {
    return {
      cadenceMinutes: 45,
      intent: "Turn the AI day into context, follow-ups, and deeper reads.",
      key: "evening",
      label: "Evening Read",
    };
  }

  return {
    cadenceMinutes: 60,
    intent: "Keep a light watch on primary sources until the next brief.",
    key: "overnight",
    label: "Overnight Watch",
  };
};

const toNewsReaderDaypartLane = ({
  formatCategory,
  item,
  key,
  label,
  reason,
  scoreLabel,
}: {
  formatCategory: (category: string) => string;
  item: RankedNewsItem<NewsHomeItem>;
  key: NewsReaderDaypartLaneKey;
  label: string;
  reason: string;
  scoreLabel: string;
}) => ({
  categoryLabel: formatCategory(item.category),
  id: item.id,
  key,
  label,
  reason,
  scoreLabel,
  sourceName: item.sourceName,
  title: item.title,
});

export const getNewsReaderDaypartPlan = ({
  formatCategory,
  generatedAt,
  items,
  profile,
}: {
  formatCategory: (category: string) => string;
  generatedAt: string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  profile: NewsPreferenceProfile;
}) => {
  const signalSummary = getNewsReaderSignalSummary(profile);

  if (items.length === 0) {
    return {
      cadenceLabel: "Refresh pauses until stories rank",
      intent: "Daypart planning will start after the feed has ranked stories.",
      label: "Daypart Waiting",
      lanes: [],
      metrics: [
        { label: "Stories", value: "0" },
        { label: "Lanes", value: "0" },
        { label: "Heat", value: "0" },
        { label: "Signals", value: String(signalSummary.signalCount) },
      ],
      summary: "Reader daypart plan will appear after stories are ranked.",
    };
  }

  const config = getNewsReaderDaypartConfig(generatedAt);
  const usedIds = new Set<string>();
  const lanes: ReturnType<typeof toNewsReaderDaypartLane>[] = [];
  const addLane = ({
    item,
    key,
    label,
    reason,
    scoreLabel,
  }: {
    item: RankedNewsItem<NewsHomeItem> | undefined;
    key: NewsReaderDaypartLaneKey;
    label: string;
    reason: string;
    scoreLabel: string;
  }) => {
    if (!item || usedIds.has(item.id)) return;

    usedIds.add(item.id);
    lanes.push(
      toNewsReaderDaypartLane({
        formatCategory,
        item,
        key,
        label,
        reason,
        scoreLabel,
      }),
    );
  };
  const [leadItem] = items;

  addLane({
    item: leadItem,
    key: "lead",
    label: "Reader Lead",
    reason: "Highest personalized score keeps the active AI brief anchored.",
    scoreLabel: leadItem ? `${leadItem.personalizedScore} score` : "0 score",
  });

  const pulseItem = selectUnusedNewsBriefingPackStory({
    items,
    score: (item) => item.trendScore,
    usedIds,
  });

  addLane({
    item: pulseItem,
    key: "pulse",
    label: "Live Pulse",
    reason:
      config.key === "midday"
        ? "Midday scan promotes the highest-heat update for faster refresh."
        : "Highest-heat update keeps the edition aware of live movement.",
    scoreLabel: pulseItem ? `${pulseItem.trendScore} heat` : "0 heat",
  });

  const exploreItem = selectUnusedNewsBriefingPackStory({
    items: items.filter((item) => item.matchedSignals.includes("exploration")),
    score: (item) => item.personalizedScore,
    usedIds,
  });

  addLane({
    item: exploreItem,
    key: "explore",
    label: "Explore",
    reason: exploreItem
      ? `Exploration tests ${formatCategory(
          exploreItem.category,
        )} outside the active profile while the feed is moving.`
      : "Exploration lane waits for a story outside the active profile.",
    scoreLabel: exploreItem
      ? `${exploreItem.personalizedScore} score`
      : "0 score",
  });

  const heatScore = Math.max(...items.map((item) => item.trendScore));

  return {
    cadenceLabel: `Refresh every ${config.cadenceMinutes} min`,
    intent: config.intent,
    label: config.label,
    lanes,
    metrics: [
      { label: "Stories", value: String(items.length) },
      { label: "Lanes", value: String(lanes.length) },
      { label: "Heat", value: String(heatScore) },
      { label: "Signals", value: String(signalSummary.signalCount) },
    ],
    summary: `${config.label} uses ${lanes.length} ${
      lanes.length === 1 ? "lane" : "lanes"
    } across ${items.length} ranked ${
      items.length === 1 ? "story" : "stories"
    } with a ${config.cadenceMinutes} min refresh cadence.`,
  };
};

type NewsReaderScorecardTone = "base" | "boost" | "penalty";

const getScorecardAgeHours = (publishedAt: string, now: Date) => {
  const publishedTime = new Date(publishedAt).getTime();
  if (Number.isNaN(publishedTime)) return 72;

  return Math.max((now.getTime() - publishedTime) / 3_600_000, 0);
};

const formatScorecardAge = (ageHours: number) => `${Math.round(ageHours)}h ago`;

const getScorecardValueLabel = (value: number) =>
  value > 0 ? `+${value}` : String(value);

const toNewsReaderScorecardComponent = ({
  detail,
  label,
  tone,
  valueLabel,
}: {
  detail: string;
  label: string;
  tone: NewsReaderScorecardTone;
  valueLabel: string;
}) => ({
  detail,
  label,
  tone,
  valueLabel,
});

const getScorecardEntityMatch = ({
  item,
  profile,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  profile: NewsPreferenceProfile;
}) =>
  item.entities.find((entity) =>
    hasPreferenceSignal(profile.preferredEntities, entity),
  );

const getReaderScorecardSummary = ({
  hasEntitySignal,
  hasSourceSignal,
  hasTopicSignal,
  isExploration,
}: {
  hasEntitySignal: boolean;
  hasSourceSignal: boolean;
  hasTopicSignal: boolean;
  isExploration: boolean;
}) => {
  const readerSignalCount = [
    hasTopicSignal,
    hasSourceSignal,
    hasEntitySignal,
  ].filter(Boolean).length;

  if (readerSignalCount > 0) {
    return `Reader score combines ${readerSignalCount} reader ${
      readerSignalCount === 1 ? "signal" : "signals"
    }, heat, freshness, novelty, and source trust.`;
  }

  if (isExploration) {
    return "Reader score uses exploration, heat, freshness, novelty, and source trust.";
  }

  return "Reader score uses heat, freshness, novelty, and source trust while the profile keeps learning.";
};

const toNewsReaderScorecard = ({
  formatCategory,
  item,
  now,
  profile,
}: {
  formatCategory: (category: string) => string;
  item: RankedNewsItem<NewsHomeItem>;
  now: Date;
  profile: NewsPreferenceProfile;
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const categoryLabel = formatCategory(item.category);
  const ageHours = getScorecardAgeHours(item.publishedAt, now);
  const hasTopicSignal = hasPreferenceSignal(
    normalizedProfile.preferredCategories,
    item.category,
  );
  const hasSourceSignal = hasPreferenceSignal(
    normalizedProfile.preferredSources,
    item.sourceSlug,
  );
  const entityMatch = getScorecardEntityMatch({
    item,
    profile: normalizedProfile,
  });
  const isExploration = item.matchedSignals.includes("exploration");
  const freshnessBoost = Math.round(
    normalizedProfile.recencyBias * Math.max(16 - ageHours / 3, 0),
  );
  const noveltyBoost = Math.round(
    normalizedProfile.noveltyBias * Math.min(item.tags.length * 2, 10),
  );
  const sourceTrustBoost = Math.round(item.sourceScore / 10);
  const stalenessPenalty = Math.round(
    normalizedProfile.recencyBias *
      Math.min(Math.max(ageHours - 48, 0) / 2, 24),
  );
  const sourceTrustPenalty = Math.round(
    Math.max(60 - item.sourceScore, 0) * 0.35,
  );
  const components = [
    toNewsReaderScorecardComponent({
      detail: "Story heat contributes the base ranking signal.",
      label: "Trend heat",
      tone: "base",
      valueLabel: getScorecardValueLabel(item.trendScore),
    }),
  ];

  if (hasTopicSignal) {
    components.push(
      toNewsReaderScorecardComponent({
        detail: `Matches ${categoryLabel}.`,
        label: "Topic",
        tone: "boost",
        valueLabel: "+28",
      }),
    );
  }

  if (hasSourceSignal) {
    components.push(
      toNewsReaderScorecardComponent({
        detail: `Matches ${item.sourceName}.`,
        label: "Source",
        tone: "boost",
        valueLabel: "+16",
      }),
    );
  }

  if (entityMatch) {
    components.push(
      toNewsReaderScorecardComponent({
        detail: `Matches ${entityMatch}.`,
        label: "Entity",
        tone: "boost",
        valueLabel: "+18",
      }),
    );
  }

  if (isExploration) {
    components.push(
      toNewsReaderScorecardComponent({
        detail: "Inserted to test a story outside the active profile.",
        label: "Exploration",
        tone: "boost",
        valueLabel: "slot",
      }),
    );
  }

  components.push(
    toNewsReaderScorecardComponent({
      detail: `Published ${formatScorecardAge(ageHours)}.`,
      label: "Freshness",
      tone: "boost",
      valueLabel: getScorecardValueLabel(freshnessBoost),
    }),
    toNewsReaderScorecardComponent({
      detail: `${item.tags.length} ${
        item.tags.length === 1 ? "tag adds" : "tags add"
      } novelty lift.`,
      label: "Novelty",
      tone: "boost",
      valueLabel: getScorecardValueLabel(noveltyBoost),
    }),
  );

  if (sourceTrustBoost > 0 && components.length < 6) {
    components.push(
      toNewsReaderScorecardComponent({
        detail: `${item.sourceName} carries ${item.sourceScore} source trust.`,
        label: "Source trust",
        tone: "boost",
        valueLabel: getScorecardValueLabel(sourceTrustBoost),
      }),
    );
  }

  if (stalenessPenalty > 0) {
    components.push(
      toNewsReaderScorecardComponent({
        detail: "Older publication time lowers freshness confidence.",
        label: "Staleness",
        tone: "penalty",
        valueLabel: `-${stalenessPenalty}`,
      }),
    );
  }

  if (sourceTrustPenalty > 0) {
    components.push(
      toNewsReaderScorecardComponent({
        detail: "Source score below 60 reduces confidence.",
        label: "Trust penalty",
        tone: "penalty",
        valueLabel: `-${sourceTrustPenalty}`,
      }),
    );
  }

  return {
    categoryLabel,
    components: components.slice(0, 6),
    id: item.id,
    scoreLabel: `${item.personalizedScore} score`,
    sourceName: item.sourceName,
    summary: getReaderScorecardSummary({
      hasEntitySignal: Boolean(entityMatch),
      hasSourceSignal,
      hasTopicSignal,
      isExploration,
    }),
    title: item.title,
  };
};

export const getNewsReaderScorecards = ({
  formatCategory,
  items,
  limit,
  now = new Date(),
  profile,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  now?: Date;
  profile: NewsPreferenceProfile;
}) => {
  if (items.length === 0) {
    return {
      label: "Scorecards Waiting",
      metrics: [
        { label: "Stories", value: "0" },
        { label: "Reader signals", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Penalties", value: "0" },
      ],
      scorecards: [],
      summary: "Reader scorecards will appear after stories are ranked.",
    };
  }

  const scorecards = items
    .slice(0, limit)
    .map((item) =>
      toNewsReaderScorecard({ formatCategory, item, now, profile }),
    );
  const readerSignalCount = scorecards.filter((scorecard) =>
    scorecard.components.some((component) =>
      ["Entity", "Source", "Topic"].includes(component.label),
    ),
  ).length;
  const explorationCount = scorecards.filter((scorecard) =>
    scorecard.components.some((component) => component.label === "Exploration"),
  ).length;
  const penaltyCount = scorecards.filter((scorecard) =>
    scorecard.components.some((component) => component.tone === "penalty"),
  ).length;

  return {
    label: "Scorecards Ready",
    metrics: [
      { label: "Stories", value: String(scorecards.length) },
      { label: "Reader signals", value: String(readerSignalCount) },
      { label: "Explore", value: String(explorationCount) },
      { label: "Penalties", value: String(penaltyCount) },
    ],
    scorecards,
    summary: `${scorecards.length} ${
      scorecards.length === 1 ? "scorecard explains" : "scorecards explain"
    } ${readerSignalCount} reader-signal ${
      readerSignalCount === 1 ? "story" : "stories"
    }, ${explorationCount} exploration ${
      explorationCount === 1 ? "story" : "stories"
    }, and ${penaltyCount} ${penaltyCount === 1 ? "penalty" : "penalties"}.`,
  };
};

export const getNewsSectionFronts = ({
  formatCategory,
  items,
  limit,
  storiesPerSection,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  storiesPerSection: number;
}) => {
  const sectionsByCategory = new Map<
    string,
    {
      category: string;
      items: RankedNewsItem<NewsHomeItem>[];
      latestPublishedAt: string;
      sources: Set<string>;
      trendScoreTotal: number;
    }
  >();

  for (const item of items) {
    const existing = sectionsByCategory.get(item.category);

    if (!existing) {
      sectionsByCategory.set(item.category, {
        category: item.category,
        items: [item],
        latestPublishedAt: item.publishedAt,
        sources: new Set([item.sourceSlug]),
        trendScoreTotal: item.trendScore,
      });
      continue;
    }

    existing.items.push(item);
    existing.sources.add(item.sourceSlug);
    existing.trendScoreTotal += item.trendScore;

    if (
      new Date(item.publishedAt).getTime() >
      new Date(existing.latestPublishedAt).getTime()
    ) {
      existing.latestPublishedAt = item.publishedAt;
    }
  }

  return Array.from(sectionsByCategory.values())
    .map((section) => {
      const [lead] = section.items;
      const storyCount = section.items.length;
      const sourceCount = section.sources.size;
      const averageTrendScore =
        storyCount > 0 ? Math.round(section.trendScoreTotal / storyCount) : 0;
      const heatScore = lead
        ? lead.personalizedScore +
          averageTrendScore +
          storyCount * 10 +
          sourceCount * 2
        : 0;

      return {
        averageTrendScore,
        category: section.category,
        heatScore,
        label: formatCategory(section.category),
        latestPublishedAt: section.latestPublishedAt,
        lead: lead
          ? {
              id: lead.id,
              personalizedScore: lead.personalizedScore,
              publishedAt: lead.publishedAt,
              sourceName: lead.sourceName,
              title: lead.title,
            }
          : null,
        sourceCount,
        storyCount,
        summary: `${storyCount} ${
          storyCount === 1 ? "story" : "stories"
        } from ${sourceCount} ${
          sourceCount === 1 ? "source" : "sources"
        }, led by ${lead?.sourceName ?? "the desk"}.`,
        supportingStories: section.items
          .slice(1, storiesPerSection)
          .map((item) => ({
            id: item.id,
            personalizedScore: item.personalizedScore,
            sourceName: item.sourceName,
            title: item.title,
          })),
      };
    })
    .sort((left, right) => {
      if (right.heatScore !== left.heatScore) {
        return right.heatScore - left.heatScore;
      }

      if (right.storyCount !== left.storyCount) {
        return right.storyCount - left.storyCount;
      }

      return left.label.localeCompare(right.label);
    })
    .slice(0, limit);
};

const sourceClusterStopWords = new Set([
  "around",
  "brief",
  "climbs",
  "coding",
  "launch",
  "launches",
  "mark",
  "model",
  "new",
  "news",
  "release",
  "sets",
  "story",
  "test",
  "tests",
  "the",
  "with",
  "workflow",
]);

const getSourceClusterTitleTokens = (title: string) =>
  new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .map((token) => token.trim())
      .filter(
        (token) => token.length > 2 && !sourceClusterStopWords.has(token),
      ),
  );

const getSourceClusterEntityEntries = (item: RankedNewsItem<NewsHomeItem>) => {
  const entries = new Map<string, string>();

  for (const entity of item.entities) {
    const normalizedEntity = normalizePreferenceSignal(entity);
    if (!normalizedEntity || entries.has(normalizedEntity)) continue;

    entries.set(normalizedEntity, entity.trim());
  }

  return entries;
};

interface NewsSourceClusterWorking {
  category: string;
  entityCounts: Map<string, number>;
  entityLabels: Map<string, string>;
  items: RankedNewsItem<NewsHomeItem>[];
  titleTokens: Set<string>;
}

const getSourceClusterTokenOverlap = (
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
) => {
  let overlap = 0;

  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }

  return overlap;
};

const shouldJoinSourceCluster = ({
  cluster,
  item,
}: {
  cluster: NewsSourceClusterWorking;
  item: RankedNewsItem<NewsHomeItem>;
}) => {
  if (cluster.category !== item.category) return false;

  const itemEntities = getSourceClusterEntityEntries(item);

  for (const entity of itemEntities.keys()) {
    if (cluster.entityCounts.has(entity)) return true;
  }

  return (
    getSourceClusterTokenOverlap(
      cluster.titleTokens,
      getSourceClusterTitleTokens(item.title),
    ) >= 3
  );
};

const addItemToSourceCluster = ({
  cluster,
  item,
}: {
  cluster: NewsSourceClusterWorking;
  item: RankedNewsItem<NewsHomeItem>;
}) => {
  cluster.items.push(item);

  for (const token of getSourceClusterTitleTokens(item.title)) {
    cluster.titleTokens.add(token);
  }

  for (const [entity, label] of getSourceClusterEntityEntries(item)) {
    cluster.entityLabels.set(entity, cluster.entityLabels.get(entity) ?? label);
    cluster.entityCounts.set(
      entity,
      (cluster.entityCounts.get(entity) ?? 0) + 1,
    );
  }
};

const createSourceCluster = (
  item: RankedNewsItem<NewsHomeItem>,
): NewsSourceClusterWorking => {
  const cluster: NewsSourceClusterWorking = {
    category: item.category,
    entityCounts: new Map(),
    entityLabels: new Map(),
    items: [],
    titleTokens: new Set(),
  };

  addItemToSourceCluster({ cluster, item });

  return cluster;
};

const getSourceClusterCommonSignals = (cluster: NewsSourceClusterWorking) =>
  Array.from(cluster.entityCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([entity]) => cluster.entityLabels.get(entity) ?? entity)
    .slice(0, 3);

const getSourceClusterKey = ({
  category,
  commonSignals,
}: {
  category: string;
  commonSignals: readonly string[];
}) => {
  const signalKey = commonSignals
    .slice(0, 2)
    .map(normalizePreferenceSignal)
    .join(":");

  return signalKey ? `${category}:${signalKey}` : category;
};

const toNewsSourceCluster = ({
  cluster,
  formatCategory,
  storiesPerCluster,
}: {
  cluster: NewsSourceClusterWorking;
  formatCategory: (category: string) => string;
  storiesPerCluster: number;
}) => {
  const [lead] = cluster.items;
  const storyCount = cluster.items.length;
  const sourceCount = new Set(cluster.items.map((item) => item.sourceSlug))
    .size;
  const averageTrendScore = Math.ceil(
    cluster.items.reduce((total, item) => total + item.trendScore, 0) /
      storyCount,
  );
  const averageTrustScore = Math.round(
    cluster.items.reduce((total, item) => total + item.sourceScore, 0) /
      storyCount,
  );
  const commonSignals = getSourceClusterCommonSignals(cluster);
  const heatScore = lead
    ? lead.personalizedScore +
      averageTrendScore +
      storyCount * 10 +
      sourceCount * 12
    : 0;

  return {
    averageTrustScore,
    categoryLabel: formatCategory(cluster.category),
    commonSignals,
    heatScore,
    key: getSourceClusterKey({
      category: cluster.category,
      commonSignals,
    }),
    lead: lead
      ? {
          id: lead.id,
          personalizedScore: lead.personalizedScore,
          sourceName: lead.sourceName,
          title: lead.title,
        }
      : null,
    sourceCount,
    storyCount,
    summary: `${storyCount} ${
      storyCount === 1 ? "report" : "reports"
    } from ${sourceCount} ${
      sourceCount === 1 ? "source" : "sources"
    } converge on ${formatRecommendationTraceList(commonSignals)}.`,
    supportingStories: cluster.items
      .slice(1, storiesPerCluster)
      .map((item) => ({
        id: item.id,
        sourceName: item.sourceName,
        sourceScore: item.sourceScore,
        title: item.title,
      })),
  };
};

export const getNewsSourceClusters = ({
  formatCategory,
  items,
  limit,
  storiesPerCluster,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  storiesPerCluster: number;
}) => {
  if (items.length === 0) {
    return {
      clusters: [],
      label: "Source Clusters Waiting",
      metrics: [
        { label: "Clusters", value: "0" },
        { label: "Stories", value: "0" },
        { label: "Sources", value: "0" },
        { label: "Avg trust", value: "0" },
      ],
      summary: "Source clusters will appear after related stories are ranked.",
    };
  }

  const workingClusters: NewsSourceClusterWorking[] = [];

  for (const item of items) {
    const existingCluster = workingClusters.find((cluster) =>
      shouldJoinSourceCluster({ cluster, item }),
    );

    if (existingCluster) {
      addItemToSourceCluster({ cluster: existingCluster, item });
      continue;
    }

    workingClusters.push(createSourceCluster(item));
  }

  const clusters = workingClusters
    .filter((cluster) => cluster.items.length > 1)
    .map((cluster) =>
      toNewsSourceCluster({
        cluster,
        formatCategory,
        storiesPerCluster,
      }),
    )
    .sort((left, right) => {
      if (right.heatScore !== left.heatScore) {
        return right.heatScore - left.heatScore;
      }

      if (right.storyCount !== left.storyCount) {
        return right.storyCount - left.storyCount;
      }

      return left.key.localeCompare(right.key);
    })
    .slice(0, limit);
  const clusteredStories = clusters.reduce(
    (total, cluster) => total + cluster.storyCount,
    0,
  );
  const clusteredSources = new Set(
    clusters.flatMap((cluster) => [
      cluster.lead?.sourceName,
      ...cluster.supportingStories.map((story) => story.sourceName),
    ]),
  );
  clusteredSources.delete(undefined);
  const averageTrustScore =
    clusters.length > 0
      ? Math.ceil(
          clusters.reduce(
            (total, cluster) =>
              total + cluster.averageTrustScore * cluster.storyCount,
            0,
          ) / clusteredStories,
        )
      : 0;

  return {
    clusters,
    label: clusters.length > 0 ? "Source Clusters Ready" : "No Source Clusters",
    metrics: [
      { label: "Clusters", value: String(clusters.length) },
      { label: "Stories", value: String(clusteredStories) },
      { label: "Sources", value: String(clusteredSources.size) },
      { label: "Avg trust", value: String(averageTrustScore) },
    ],
    summary:
      clusters.length > 0
        ? `${clusters.length} source ${
            clusters.length === 1
              ? "cluster consolidates"
              : "clusters consolidate"
          } ${clusteredStories} ${
            clusteredStories === 1 ? "story" : "stories"
          } from ${clusteredSources.size} ${
            clusteredSources.size === 1 ? "source" : "sources"
          }.`
        : "Source clusters will appear after related stories are ranked.",
  };
};

type NewsClaimTrackerLabel = "Corroborated" | "Developing" | "Single source";

const newsClaimTrackerPriority = {
  Corroborated: 0,
  Developing: 1,
  "Single source": 2,
} satisfies Record<NewsClaimTrackerLabel, number>;

const getNewsClaimTrackerLabel = ({
  averageTrustScore,
  sourceCount,
}: {
  averageTrustScore: number;
  sourceCount: number;
}): NewsClaimTrackerLabel => {
  if (sourceCount >= 3 && averageTrustScore >= 80) return "Corroborated";
  if (sourceCount >= 2) return "Developing";

  return "Single source";
};

const getNewsClaimTrackerConfidenceLabel = (label: NewsClaimTrackerLabel) => {
  if (label === "Corroborated") return "High confidence";
  if (label === "Developing") return "Medium confidence";

  return "Low confidence";
};

const getNewsClaimCoverageLabel = (categoryLabel: string) => {
  const lowerCategory = categoryLabel.toLowerCase();

  return lowerCategory.endsWith("s")
    ? lowerCategory.slice(0, -1)
    : lowerCategory;
};

const getNewsClaimSignals = (cluster: NewsSourceClusterWorking) => {
  const commonSignals = getSourceClusterCommonSignals(cluster);
  if (commonSignals.length > 0) return commonSignals.slice(0, 2);

  const [lead] = cluster.items;
  if (!lead) return [];

  return Array.from(getSourceClusterEntityEntries(lead).values()).slice(0, 2);
};

const getNewsClaimTrackerKey = ({
  category,
  lead,
  signals,
}: {
  category: string;
  lead: RankedNewsItem<NewsHomeItem> | undefined;
  signals: readonly string[];
}) => {
  const signalKey = getSourceClusterKey({
    category,
    commonSignals: signals,
  });

  if (signalKey !== category) return signalKey;

  return lead ? `${category}:${normalizePreferenceSignal(lead.id)}` : category;
};

const toNewsClaimTrackerEvidence = ({
  item,
  signals,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  signals: readonly string[];
}) => ({
  id: item.id,
  signalLabel:
    signals.length > 0
      ? signals.join(" / ")
      : getNewsClaimCoverageLabel(item.category),
  sourceName: item.sourceName,
  title: item.title,
});

const toNewsClaimTrackerItem = ({
  cluster,
  formatCategory,
  storiesPerClaim,
}: {
  cluster: NewsSourceClusterWorking;
  formatCategory: (category: string) => string;
  storiesPerClaim: number;
}) => {
  const sortedItems = [...cluster.items].sort((left, right) => {
    if (right.personalizedScore !== left.personalizedScore) {
      return right.personalizedScore - left.personalizedScore;
    }

    if (right.trendScore !== left.trendScore) {
      return right.trendScore - left.trendScore;
    }

    return (
      new Date(right.publishedAt).getTime() -
      new Date(left.publishedAt).getTime()
    );
  });
  const [lead] = sortedItems;
  const sourceNames = Array.from(
    new Set(sortedItems.map((item) => item.sourceName)),
  );
  const sourceCount = sourceNames.length;
  const storyCount = sortedItems.length;
  const averageTrustScore = Math.round(
    sortedItems.reduce((total, item) => total + item.sourceScore, 0) /
      storyCount,
  );
  const label = getNewsClaimTrackerLabel({
    averageTrustScore,
    sourceCount,
  });
  const categoryLabel = formatCategory(cluster.category);
  const signals = getNewsClaimSignals(cluster);
  const claimFocus = formatRecommendationTraceList(signals);

  return {
    categoryLabel,
    claim: `${claimFocus} ${
      signals.length === 1 ? "is" : "are"
    } the claim focus across ${getNewsClaimCoverageLabel(categoryLabel)} coverage.`,
    confidenceLabel: getNewsClaimTrackerConfidenceLabel(label),
    evidence: sortedItems
      .slice(0, storiesPerClaim)
      .map((item) => toNewsClaimTrackerEvidence({ item, signals })),
    key: getNewsClaimTrackerKey({
      category: cluster.category,
      lead,
      signals,
    }),
    label,
    lead: lead
      ? {
          id: lead.id,
          sourceName: lead.sourceName,
          title: lead.title,
        }
      : null,
    sourceCount,
    sourceNames,
    storyCount,
    supportLabel: `${sourceCount} ${
      sourceCount === 1 ? "source" : "sources"
    } / ${storyCount} ${storyCount === 1 ? "report" : "reports"}`,
    trustScore: averageTrustScore,
  };
};

export const getNewsClaimTracker = ({
  formatCategory,
  items,
  limit,
  storiesPerClaim,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  storiesPerClaim: number;
}) => {
  if (items.length === 0) {
    return {
      claims: [],
      label: "Claim Tracker Waiting",
      metrics: [
        { label: "Claims", value: "0" },
        { label: "Corroborated", value: "0" },
        { label: "Developing", value: "0" },
        { label: "Single source", value: "0" },
      ],
      summary: "Claim tracker will appear after story evidence clusters.",
    };
  }

  const workingClusters: NewsSourceClusterWorking[] = [];

  for (const item of items) {
    const existingCluster = workingClusters.find((cluster) =>
      shouldJoinSourceCluster({ cluster, item }),
    );

    if (existingCluster) {
      addItemToSourceCluster({ cluster: existingCluster, item });
      continue;
    }

    workingClusters.push(createSourceCluster(item));
  }

  const claims = workingClusters
    .map((cluster) =>
      toNewsClaimTrackerItem({
        cluster,
        formatCategory,
        storiesPerClaim,
      }),
    )
    .filter((claim) => claim.lead !== null)
    .sort((left, right) => {
      const priorityDifference =
        newsClaimTrackerPriority[left.label] -
        newsClaimTrackerPriority[right.label];

      if (priorityDifference !== 0) return priorityDifference;

      if (right.sourceCount !== left.sourceCount) {
        return right.sourceCount - left.sourceCount;
      }

      if (right.trustScore !== left.trustScore) {
        return right.trustScore - left.trustScore;
      }

      if (right.storyCount !== left.storyCount) {
        return right.storyCount - left.storyCount;
      }

      return left.key.localeCompare(right.key);
    })
    .slice(0, limit)
    .map(
      ({
        sourceCount: _sourceCount,
        storyCount: _storyCount,
        trustScore: _trustScore,
        ...claim
      }) => claim,
    );

  const corroboratedCount = claims.filter(
    (claim) => claim.label === "Corroborated",
  ).length;
  const developingCount = claims.filter(
    (claim) => claim.label === "Developing",
  ).length;
  const singleSourceCount = claims.filter(
    (claim) => claim.label === "Single source",
  ).length;

  return {
    claims,
    label: claims.length > 0 ? "Claim Tracker Ready" : "Claim Tracker Waiting",
    metrics: [
      { label: "Claims", value: String(claims.length) },
      { label: "Corroborated", value: String(corroboratedCount) },
      { label: "Developing", value: String(developingCount) },
      { label: "Single source", value: String(singleSourceCount) },
    ],
    summary:
      claims.length > 0
        ? `${claims.length} tracked ${
            claims.length === 1 ? "claim" : "claims"
          }: ${corroboratedCount} corroborated, ${developingCount} developing, and ${singleSourceCount} single-source.`
        : "Claim tracker will appear after story evidence clusters.",
  };
};

type NewsStoryTimelineSignalLabel =
  | "Context update"
  | "Follow-up"
  | "Lead development"
  | "Market reaction";

const newsStoryTimelineTimeFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  hour: "numeric",
  hourCycle: "h23",
  minute: "2-digit",
  month: "short",
  timeZone: "UTC",
});

const getNewsStoryTimelineTimestamp = (item: RankedNewsItem<NewsHomeItem>) => {
  const timestamp = new Date(item.publishedAt).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const formatNewsStoryTimelineTime = (publishedAt: string) => {
  const date = new Date(publishedAt);

  if (Number.isNaN(date.getTime())) return "Time pending";

  return newsStoryTimelineTimeFormatter.format(date);
};

const getNewsStoryTimelineSignalLabel = (
  item: RankedNewsItem<NewsHomeItem>,
): NewsStoryTimelineSignalLabel => {
  if (item.matchedSignals.includes("exploration")) return "Context update";
  if (item.trendScore >= 92) return "Market reaction";
  if (
    item.matchedSignals.includes("category") ||
    item.category === "model_release"
  ) {
    return "Lead development";
  }

  return "Follow-up";
};

const getNewsStoryTimelineReason = (label: NewsStoryTimelineSignalLabel) => {
  if (label === "Context update") {
    return "Exploration keeps adjacent developments in the reader edition.";
  }

  if (label === "Market reaction") {
    return "Trend heat is moving faster than the reader profile.";
  }

  if (label === "Lead development") {
    return "Reader signals put this development at the center of the story.";
  }

  return "Earlier coverage adds context to the timeline.";
};

export const getNewsStoryTimeline = ({
  formatCategory,
  items,
  limit,
}: {
  formatCategory: (category: string) => string;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
}) => {
  const timelineItems = [...items]
    .sort((left, right) => {
      const timestampDifference =
        getNewsStoryTimelineTimestamp(right) -
        getNewsStoryTimelineTimestamp(left);

      if (timestampDifference !== 0) return timestampDifference;

      if (right.personalizedScore !== left.personalizedScore) {
        return right.personalizedScore - left.personalizedScore;
      }

      if (right.trendScore !== left.trendScore) {
        return right.trendScore - left.trendScore;
      }

      return left.id.localeCompare(right.id);
    })
    .slice(0, limit);

  const events = timelineItems.map((item, index) => {
    const signalLabel = getNewsStoryTimelineSignalLabel(item);

    return {
      categoryLabel: formatCategory(item.category),
      entities: item.entities.slice(0, 2),
      heatLabel: `${item.trendScore} heat / ${item.personalizedScore} score`,
      id: item.id,
      rank: String(index + 1).padStart(2, "0"),
      reason: getNewsStoryTimelineReason(signalLabel),
      signalLabel,
      sourceName: item.sourceName,
      timeLabel: formatNewsStoryTimelineTime(item.publishedAt),
      title: item.title,
    };
  });
  const sourceCount = new Set(timelineItems.map((item) => item.sourceSlug))
    .size;
  const topicCount = new Set(timelineItems.map((item) => item.category)).size;
  const latestEvent = events[0];

  return {
    events,
    label:
      events.length > 0 ? "Story Timeline Ready" : "Story Timeline Waiting",
    metrics: [
      { label: "Events", value: String(events.length) },
      { label: "Sources", value: String(sourceCount) },
      { label: "Topics", value: String(topicCount) },
      { label: "Latest", value: latestEvent?.timeLabel ?? "None" },
    ],
    summary:
      events.length > 0
        ? `${events.length} timeline ${
            events.length === 1 ? "event" : "events"
          } show how ${events.length} ${
            events.length === 1 ? "story" : "stories"
          } developed across ${sourceCount} ${
            sourceCount === 1 ? "source" : "sources"
          }.`
        : "Story timeline will appear after ranked stories are available.",
  };
};

const toCoverageThreadStory = (item: RankedNewsItem<NewsHomeItem>) => ({
  category: item.category,
  id: item.id,
  personalizedScore: item.personalizedScore,
  sourceName: item.sourceName,
  title: item.title,
});

const getCoverageThreadVerificationLabel = ({
  averageTrustScore,
  sourceCount,
}: {
  averageTrustScore: number;
  sourceCount: number;
}) =>
  sourceCount >= 2 && averageTrustScore >= 70
    ? "Verified thread"
    : "Developing thread";

const getCoverageThreadVerificationSummary = ({
  averageTrustScore,
  sourceCount,
  sourceNames,
  storyCount,
}: {
  averageTrustScore: number;
  sourceCount: number;
  sourceNames: readonly string[];
  storyCount: number;
}) => {
  if (sourceCount >= 2 && averageTrustScore >= 70) {
    return `${sourceCount} independent ${
      sourceCount === 1 ? "source" : "sources"
    } with ${averageTrustScore} average trust support this thread.`;
  }

  if (sourceCount === 1) {
    return `${storyCount} ${
      storyCount === 1 ? "report" : "reports"
    } from ${sourceNames[0] ?? "one source"} ${
      storyCount === 1 ? "is" : "are"
    } still waiting for independent confirmation.`;
  }

  return `${sourceCount} independent ${
    sourceCount === 1 ? "source is" : "sources are"
  } still developing this thread with ${averageTrustScore} average trust.`;
};

export const getNewsCoverageThreads = ({
  items,
  limit,
  storiesPerThread,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  storiesPerThread: number;
}) => {
  const threadsByEntity = new Map<
    string,
    {
      entity: string;
      items: RankedNewsItem<NewsHomeItem>[];
      sourceNames: Set<string>;
      sourceScoreTotal: number;
      sources: Set<string>;
      trendScoreTotal: number;
    }
  >();

  for (const item of items) {
    const seenEntities = new Set<string>();

    for (const entityValue of item.entities) {
      const entity = entityValue.trim();
      const normalizedEntity = entity.toLowerCase();

      if (!entity || seenEntities.has(normalizedEntity)) continue;

      const existing = threadsByEntity.get(normalizedEntity);

      if (!existing) {
        threadsByEntity.set(normalizedEntity, {
          entity,
          items: [item],
          sourceNames: new Set([item.sourceName]),
          sourceScoreTotal: item.sourceScore,
          sources: new Set([item.sourceSlug]),
          trendScoreTotal: item.trendScore,
        });
      } else {
        existing.items.push(item);
        existing.sourceNames.add(item.sourceName);
        existing.sourceScoreTotal += item.sourceScore;
        existing.sources.add(item.sourceSlug);
        existing.trendScoreTotal += item.trendScore;
      }

      seenEntities.add(normalizedEntity);
    }
  }

  const threads = Array.from(threadsByEntity.values())
    .filter((thread) => thread.items.length > 1)
    .map((thread) => {
      const threadItems = [...thread.items].sort((left, right) => {
        if (right.personalizedScore !== left.personalizedScore) {
          return right.personalizedScore - left.personalizedScore;
        }

        if (right.trendScore !== left.trendScore) {
          return right.trendScore - left.trendScore;
        }

        return (
          new Date(right.publishedAt).getTime() -
          new Date(left.publishedAt).getTime()
        );
      });
      const [lead] = threadItems;
      const storyCount = threadItems.length;
      const sourceCount = thread.sources.size;
      const averageTrendScore = Math.round(thread.trendScoreTotal / storyCount);
      const averageTrustScore = Math.round(
        thread.sourceScoreTotal / storyCount,
      );
      const sourceNames = Array.from(thread.sourceNames);
      const heatScore =
        averageTrendScore +
        storyCount * 20 +
        sourceCount * 6 +
        Math.min(sourceCount, 3) * 8;

      return {
        entity: thread.entity,
        heatScore,
        lead: lead ? toCoverageThreadStory(lead) : null,
        sourceCount,
        storyCount,
        summary: `${storyCount} ${
          storyCount === 1 ? "story" : "stories"
        } from ${sourceCount} ${
          sourceCount === 1 ? "source" : "sources"
        } connect around ${thread.entity}.`,
        supportingStories: threadItems
          .slice(1, storiesPerThread)
          .map(toCoverageThreadStory),
        verificationLabel: getCoverageThreadVerificationLabel({
          averageTrustScore,
          sourceCount,
        }),
        verificationSummary: getCoverageThreadVerificationSummary({
          averageTrustScore,
          sourceCount,
          sourceNames,
          storyCount,
        }),
      };
    })
    .filter((thread) => thread.lead !== null)
    .sort((left, right) => {
      if (right.heatScore !== left.heatScore) {
        return right.heatScore - left.heatScore;
      }

      if (right.storyCount !== left.storyCount) {
        return right.storyCount - left.storyCount;
      }

      return left.entity.localeCompare(right.entity);
    })
    .slice(0, limit);

  return {
    summary:
      threads.length > 0
        ? `${threads.length} coverage ${
            threads.length === 1 ? "thread" : "threads"
          } from ${items.length} ranked ${items.length === 1 ? "story" : "stories"}.`
        : "Coverage threads will appear as stories cluster.",
    threads,
  };
};

const consensusEntityStopwords = new Set([
  "agent",
  "agents",
  "ai",
  "funding",
  "model",
  "models",
  "research",
  "startup",
  "startups",
]);

const toConsensusBoardStory = (item: RankedNewsItem<NewsHomeItem>) => ({
  id: item.id,
  sourceName: item.sourceName,
  title: item.title,
});

type NewsConsensusThreadLabel = "Verified" | "Single-source" | "High-risk";

const newsConsensusThreadPriority = {
  Verified: 0,
  "High-risk": 1,
  "Single-source": 2,
} satisfies Record<NewsConsensusThreadLabel, number>;

const getNewsConsensusThreadLabel = ({
  averageTrustScore,
  maxTrendScore,
  sourceCount,
}: {
  averageTrustScore: number;
  maxTrendScore: number;
  sourceCount: number;
}): NewsConsensusThreadLabel => {
  if (sourceCount >= 2 && averageTrustScore >= 70) return "Verified";
  if (sourceCount === 1 && averageTrustScore < 60 && maxTrendScore >= 90) {
    return "High-risk";
  }

  return "Single-source";
};

const getNewsConsensusThreadReason = (label: NewsConsensusThreadLabel) => {
  if (label === "Verified") {
    return "Multiple credible sources are covering this thread.";
  }

  if (label === "High-risk") {
    return "High heat is coming from a lower-trust single source.";
  }

  return "Only one source is covering this thread so far.";
};

export const getNewsConsensusBoard = ({
  items,
  limit,
  storiesPerThread,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  storiesPerThread: number;
}) => {
  const threadsByEntity = new Map<
    string,
    {
      entity: string;
      items: RankedNewsItem<NewsHomeItem>[];
      sources: Set<string>;
      sourceScoreTotal: number;
      maxTrendScore: number;
    }
  >();

  for (const item of items) {
    const seenEntities = new Set<string>();

    for (const entityValue of item.entities) {
      const entity = entityValue.trim();
      const normalizedEntity = entity.toLowerCase();

      if (!entity || seenEntities.has(normalizedEntity)) continue;
      if (consensusEntityStopwords.has(normalizedEntity)) continue;

      const existing = threadsByEntity.get(normalizedEntity);

      if (!existing) {
        threadsByEntity.set(normalizedEntity, {
          entity,
          items: [item],
          sources: new Set([item.sourceSlug]),
          sourceScoreTotal: item.sourceScore,
          maxTrendScore: item.trendScore,
        });
      } else {
        existing.items.push(item);
        existing.sources.add(item.sourceSlug);
        existing.sourceScoreTotal += item.sourceScore;
        existing.maxTrendScore = Math.max(
          existing.maxTrendScore,
          item.trendScore,
        );
      }

      seenEntities.add(normalizedEntity);
    }
  }

  const threads = Array.from(threadsByEntity.values())
    .map((thread) => {
      const threadItems = [...thread.items].sort((left, right) => {
        if (right.personalizedScore !== left.personalizedScore) {
          return right.personalizedScore - left.personalizedScore;
        }

        if (right.trendScore !== left.trendScore) {
          return right.trendScore - left.trendScore;
        }

        return (
          new Date(right.publishedAt).getTime() -
          new Date(left.publishedAt).getTime()
        );
      });
      const sourceCount = thread.sources.size;
      const storyCount = threadItems.length;
      const averageTrustScore = Math.round(
        thread.sourceScoreTotal / storyCount,
      );
      const label = getNewsConsensusThreadLabel({
        averageTrustScore,
        maxTrendScore: thread.maxTrendScore,
        sourceCount,
      });

      return {
        confidenceLabel: `${sourceCount} ${
          sourceCount === 1 ? "source" : "sources"
        } / ${averageTrustScore} trust`,
        entity: thread.entity,
        label,
        maxTrendScore: thread.maxTrendScore,
        reason: getNewsConsensusThreadReason(label),
        stories: threadItems
          .slice(0, storiesPerThread)
          .map(toConsensusBoardStory),
        storyCount,
        trustScore: averageTrustScore,
      };
    })
    .filter((thread) => thread.stories.length > 0)
    .sort((left, right) => {
      const priorityDifference =
        newsConsensusThreadPriority[left.label] -
        newsConsensusThreadPriority[right.label];

      if (priorityDifference !== 0) return priorityDifference;

      if (right.maxTrendScore !== left.maxTrendScore) {
        return right.maxTrendScore - left.maxTrendScore;
      }

      if (right.trustScore !== left.trustScore) {
        return right.trustScore - left.trustScore;
      }

      if (right.storyCount !== left.storyCount) {
        return right.storyCount - left.storyCount;
      }

      return left.entity.localeCompare(right.entity);
    })
    .slice(0, limit)
    .map(
      ({
        maxTrendScore: _maxTrendScore,
        storyCount: _storyCount,
        trustScore: _trustScore,
        ...thread
      }) => thread,
    );

  const verifiedCount = threads.filter(
    (thread) => thread.label === "Verified",
  ).length;
  const highRiskCount = threads.filter(
    (thread) => thread.label === "High-risk",
  ).length;
  const singleSourceCount = threads.filter((thread) =>
    thread.confidenceLabel.startsWith("1 source"),
  ).length;

  return {
    label: threads.length > 0 ? `${threads.length} Threads` : "Waiting",
    metrics: [
      { label: "Verified", value: String(verifiedCount) },
      { label: "Single-source", value: String(singleSourceCount) },
      { label: "High-risk", value: String(highRiskCount) },
    ],
    summary:
      threads.length > 0
        ? `${threads.length} consensus ${
            threads.length === 1 ? "thread" : "threads"
          }: ${verifiedCount} verified, ${singleSourceCount} single-source, and ${highRiskCount} high-risk.`
        : "Consensus board will appear as stories cluster.",
    threads,
  };
};

const toReadingQueueStory = (item: RankedNewsItem<NewsHomeItem>) => ({
  id: item.id,
  personalizedScore: item.personalizedScore,
  sourceName: item.sourceName,
  title: item.title,
});

const getContinuationSharedEntities = ({
  anchor,
  item,
}: {
  anchor: NewsReaderMemoryItem;
  item: RankedNewsItem<NewsHomeItem>;
}) => {
  const itemEntities = new Set(
    item.entities.map((entity) => entity.trim().toLowerCase()).filter(Boolean),
  );
  const sharedEntities: string[] = [];
  const seenEntities = new Set<string>();

  for (const entityValue of anchor.entities) {
    const entity = entityValue.trim();
    const normalizedEntity = entity.toLowerCase();

    if (!entity || seenEntities.has(normalizedEntity)) continue;
    if (!itemEntities.has(normalizedEntity)) continue;

    sharedEntities.push(entity);
    seenEntities.add(normalizedEntity);
  }

  return sharedEntities;
};

const toContinuationFollowUp = ({
  item,
  reason,
  signalCount,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  reason: string;
  signalCount: number;
}) => ({
  id: item.id,
  reason,
  scoreLabel: `${signalCount} ${
    signalCount === 1 ? "signal" : "signals"
  } / ${item.personalizedScore} score`,
  sourceName: item.sourceName,
  title: item.title,
});

const getMissedCoverageReason = ({
  frontPageEntityKeys,
  item,
}: {
  frontPageEntityKeys: ReadonlySet<string>;
  item: RankedNewsItem<NewsHomeItem>;
}) => {
  const itemEntities = getNewsAlertRoutingSpecificEntities(item);
  const isCounterpoint =
    frontPageEntityKeys.size > 0 &&
    itemEntities.length > 0 &&
    itemEntities.every((entity) => !frontPageEntityKeys.has(entity.key));

  if (isCounterpoint) return "Counterpoint catch-up";
  if (item.trendScore >= 90) return "High heat";
  if (item.matchedSignals.includes("exploration")) {
    return "Exploration catch-up";
  }
  if (item.matchedSignals.length > 0) return "Reader signal";

  return "Deep cut";
};

export const getNewsMissedCoverageShelf = ({
  frontPageCount,
  historyItems,
  items,
  limit,
}: {
  frontPageCount: number;
  historyItems: readonly { id: string }[];
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
}) => {
  const readItemIds = new Set(historyItems.map((item) => item.id));
  const frontPageEntityKeys = new Set(
    items
      .slice(0, frontPageCount)
      .flatMap((item) =>
        getNewsAlertRoutingSpecificEntities(item).map((entity) => entity.key),
      ),
  );
  const tailItems = items.slice(frontPageCount);
  const unreadTailItems = tailItems.filter((item) => !readItemIds.has(item.id));
  const scoredStories = unreadTailItems
    .map((item) => {
      const reason = getMissedCoverageReason({ frontPageEntityKeys, item });
      const catchUpScore =
        item.trendScore +
        item.personalizedScore +
        Math.round(item.sourceScore / 10) -
        (hasNewsItemSharedSpecificEntity({
          avoidEntityKeys: frontPageEntityKeys,
          item,
        })
          ? 30
          : 0);

      return {
        catchUpScore,
        item,
        reason,
      };
    })
    .sort((left, right) => {
      if (right.catchUpScore !== left.catchUpScore) {
        return right.catchUpScore - left.catchUpScore;
      }

      if (right.item.trendScore !== left.item.trendScore) {
        return right.item.trendScore - left.item.trendScore;
      }

      return (
        new Date(right.item.publishedAt).getTime() -
        new Date(left.item.publishedAt).getTime()
      );
    })
    .slice(0, limit);
  const topScore = scoredStories[0]?.catchUpScore ?? 0;
  const stories = scoredStories.map(({ catchUpScore, item, reason }) => ({
    id: item.id,
    reason,
    scoreLabel: `${catchUpScore} score`,
    sourceName: item.sourceName,
    title: item.title,
  }));

  return {
    label: stories.length > 0 ? `${stories.length} Unread` : "Caught Up",
    metrics: [
      { label: "Scanned", value: String(tailItems.length) },
      { label: "Unread", value: String(unreadTailItems.length) },
      { label: "Top score", value: String(topScore) },
    ],
    stories,
    summary:
      stories.length > 0
        ? `${stories.length} unread ${
            stories.length === 1 ? "story" : "stories"
          } outside the lead stack ${
            stories.length === 1 ? "is" : "are"
          } worth a second look.`
        : "No unread tail coverage is waiting behind the lead stack.",
  };
};

export const getNewsContinuationRail = ({
  formatCategory,
  historyItems,
  items,
  limit,
}: {
  formatCategory: (category: string) => string;
  historyItems: readonly NewsReaderMemoryItem[];
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
}) => {
  const anchor = historyItems[0];

  if (!anchor) {
    return {
      anchor: null,
      followUps: [],
      label: "No Trail",
      metrics: [
        { label: "Read anchors", value: "0" },
        { label: "Follow-ups", value: "0" },
        { label: "Top thread", value: "None" },
      ],
      notices: [
        {
          detail: "Open stories to build a continuation trail.",
          label: "No reading history",
        },
      ],
      summary: "Continuation rail will appear after you read a story.",
    };
  }

  const readItemIds = new Set(historyItems.map((item) => item.id));
  const anchorEntityKeys = new Set(
    getNewsAlertRoutingSpecificEntities(anchor).map((entity) => entity.key),
  );
  const rankedFollowUps = items
    .filter((item) => !readItemIds.has(item.id))
    .map((item) => {
      const sharedEntities = getContinuationSharedEntities({ anchor, item });
      const sameCategory = item.category === anchor.category;
      const sameSource = item.sourceSlug === anchor.sourceSlug;
      const signalCount =
        sharedEntities.length * 3 +
        (sameCategory ? 2 : 0) +
        (sameSource ? 1 : 0);
      const [sharedEntity] = sharedEntities;
      const reason = sharedEntity
        ? `${sharedEntity} thread`
        : sameCategory
          ? `${formatCategory(anchor.category)} follow-up`
          : sameSource
            ? `${anchor.sourceName} follow-up`
            : "Reader follow-up";

      return {
        item,
        reason,
        signalCount,
      };
    })
    .filter((entry) => entry.signalCount > 0)
    .sort((left, right) => {
      if (right.signalCount !== left.signalCount) {
        return right.signalCount - left.signalCount;
      }

      if (right.item.personalizedScore !== left.item.personalizedScore) {
        return right.item.personalizedScore - left.item.personalizedScore;
      }

      return (
        new Date(right.item.publishedAt).getTime() -
        new Date(left.item.publishedAt).getTime()
      );
    });
  const scoredFollowUps = rankedFollowUps.slice(0, limit);
  const selectedFollowUpsShareAnchorEntity =
    anchorEntityKeys.size > 0 &&
    scoredFollowUps.length >= Math.min(2, limit) &&
    scoredFollowUps.every((entry) =>
      hasNewsItemSharedSpecificEntity({
        avoidEntityKeys: anchorEntityKeys,
        item: entry.item,
      }),
    );
  const counterpointFollowUp = selectedFollowUpsShareAnchorEntity
    ? rankedFollowUps.find((entry) => {
        if (
          scoredFollowUps.some((selected) => selected.item.id === entry.item.id)
        ) {
          return false;
        }

        return !hasNewsItemSharedSpecificEntity({
          avoidEntityKeys: anchorEntityKeys,
          item: entry.item,
        });
      })
    : undefined;

  if (counterpointFollowUp && scoredFollowUps.length > 1) {
    scoredFollowUps[scoredFollowUps.length - 1] = counterpointFollowUp;
  }

  const topFollowUp = scoredFollowUps[0];
  const followUps = scoredFollowUps.map((entry) =>
    toContinuationFollowUp({
      item: entry.item,
      reason: entry.reason,
      signalCount: entry.signalCount,
    }),
  );

  return {
    anchor: {
      categoryLabel: formatCategory(anchor.category),
      id: anchor.id,
      sourceName: anchor.sourceName,
      title: anchor.title,
    },
    followUps,
    label: followUps.length > 0 ? "Active Trail" : "No Match",
    metrics: [
      { label: "Read anchors", value: String(historyItems.length) },
      { label: "Follow-ups", value: String(followUps.length) },
      {
        label: "Top thread",
        value:
          topFollowUp?.reason.replace(/ thread$| follow-up$/, "") ?? "None",
      },
    ],
    notices: [
      followUps.length > 0 && topFollowUp
        ? {
            detail: `${topFollowUp.reason} has the strongest overlap with your latest read.`,
            label: "Thread match",
          }
        : {
            detail:
              "No ranked stories overlap the latest read yet; ingest more related coverage.",
            label: "No follow-up match",
          },
    ],
    summary:
      followUps.length > 0
        ? `${followUps.length} ${
            followUps.length === 1
              ? "follow-up continues"
              : "follow-ups continue"
          } your latest read: ${anchor.title}.`
        : `No follow-ups currently match your latest read: ${anchor.title}.`,
  };
};

export const getNewsPersonalizedReadingQueue = ({
  formatCategory = (category) => category,
  historyItems = [],
  items,
  negativeFeedbackItems = [],
  savedItems = [],
}: {
  formatCategory?: (category: string) => string;
  historyItems?: readonly NewsReaderMemoryItem[];
  items: readonly RankedNewsItem<NewsHomeItem>[];
  negativeFeedbackItems?: readonly NewsReaderMemoryItem[];
  savedItems?: readonly NewsReaderMemoryItem[];
}) => {
  if (items.length === 0) {
    return {
      slots: [],
      summary: "Queue will appear as stories load.",
    };
  }

  const negativeMatchers = getRefreshSimulationMatchers(negativeFeedbackItems);
  const eligibleItems =
    negativeFeedbackItems.length > 0
      ? items.filter(
          (item) =>
            !hasRefreshSimulationMatch({ item, matchers: negativeMatchers }),
        )
      : items;

  if (eligibleItems.length === 0) {
    return {
      slots: [],
      summary: "Queue is waiting for stories outside Less feedback.",
    };
  }

  const usedIds = new Set<string>();
  const slots: {
    intent: string;
    label: string;
    reason: string;
    story: ReturnType<typeof toReadingQueueStory>;
  }[] = [];
  const addSlot = ({
    intent,
    item,
    label,
    reason,
  }: {
    intent: string;
    item: RankedNewsItem<NewsHomeItem> | undefined;
    label: string;
    reason: string;
  }) => {
    if (!item || usedIds.has(item.id)) return;

    usedIds.add(item.id);
    slots.push({
      intent,
      label,
      reason,
      story: toReadingQueueStory(item),
    });
  };
  const [leadStory] = eligibleItems;
  const leadEntityKeys = new Set(
    leadStory
      ? getNewsAlertRoutingSpecificEntities(leadStory).map(
          (entity) => entity.key,
        )
      : [],
  );

  addSlot({
    intent: "Fast Brief",
    item: leadStory,
    label: "Start",
    reason: "Highest-ranked story in this edition.",
  });

  const memoryAnchors = [
    ...savedItems.map((item) => ({
      item,
      sourceLabel: "saved stories",
    })),
    ...historyItems.map((item) => ({
      item,
      sourceLabel: "reading history",
    })),
  ];
  const memoryFollowUp = eligibleItems
    .filter((item) => !usedIds.has(item.id))
    .flatMap((item) =>
      memoryAnchors.map((anchor) => {
        const sharedEntities = getContinuationSharedEntities({
          anchor: anchor.item,
          item,
        });
        const sameCategory = item.category === anchor.item.category;
        const sameSource = item.sourceSlug === anchor.item.sourceSlug;
        const signalCount =
          sharedEntities.length * 3 +
          (sameCategory ? 2 : 0) +
          (sameSource ? 1 : 0);
        const signalLabel =
          sharedEntities[0] ??
          (sameCategory
            ? formatCategory(anchor.item.category)
            : sameSource
              ? anchor.item.sourceName
              : "");

        return {
          item,
          reason: signalLabel
            ? `${signalLabel} from your ${anchor.sourceLabel} anchors this follow-up.`
            : "",
          signalCount,
        };
      }),
    )
    .filter((entry) => entry.signalCount > 0)
    .sort((left, right) => {
      if (right.signalCount !== left.signalCount) {
        return right.signalCount - left.signalCount;
      }

      if (right.item.personalizedScore !== left.item.personalizedScore) {
        return right.item.personalizedScore - left.item.personalizedScore;
      }

      return (
        new Date(right.item.publishedAt).getTime() -
        new Date(left.item.publishedAt).getTime()
      );
    })[0];

  if (memoryFollowUp) {
    addSlot({
      intent: "Follow Interest",
      item: memoryFollowUp.item,
      label: "Continue thread",
      reason: memoryFollowUp.reason,
    });
  }

  const rankedDeepDiveCandidates = [...eligibleItems]
    .filter((item) => !usedIds.has(item.id))
    .sort((left, right) => {
      const getDepthScore = (item: RankedNewsItem<NewsHomeItem>) =>
        item.sourceScore * 2 +
        getUniqueSignals(item.entities, 24).length * 12 +
        getUniqueSignals(item.tags, 24).length * 8 +
        item.personalizedScore;

      const depthDiff = getDepthScore(right) - getDepthScore(left);
      if (depthDiff !== 0) return depthDiff;

      return right.trendScore - left.trendScore;
    });
  const counterpointDeepDiveStory =
    leadEntityKeys.size > 0
      ? rankedDeepDiveCandidates.find((item) => {
          const itemEntityKeys = getNewsAlertRoutingSpecificEntities(item).map(
            (entity) => entity.key,
          );

          return (
            itemEntityKeys.length > 0 &&
            itemEntityKeys.every((entityKey) => !leadEntityKeys.has(entityKey))
          );
        })
      : undefined;
  const deepDiveStory =
    counterpointDeepDiveStory ?? rankedDeepDiveCandidates[0];
  const deepEntityCount = deepDiveStory
    ? getUniqueSignals(deepDiveStory.entities, 24).length
    : 0;
  const deepTagCount = deepDiveStory
    ? getUniqueSignals(deepDiveStory.tags, 24).length
    : 0;

  addSlot({
    intent: "Deep Dive",
    item: deepDiveStory,
    label: "Go deeper",
    reason: `Dense source-backed story with ${deepEntityCount} ${
      deepEntityCount === 1 ? "entity" : "entities"
    } and ${deepTagCount} ${deepTagCount === 1 ? "tag" : "tags"}.`,
  });

  const explorationStory = eligibleItems.find(
    (item) =>
      !usedIds.has(item.id) && item.matchedSignals.includes("exploration"),
  );

  if (explorationStory) {
    addSlot({
      intent: "Explore",
      item: explorationStory,
      label: "Try outside profile",
      reason: "Exploration story keeps the queue from narrowing.",
    });
  } else {
    addSlot({
      intent: "Catch Up",
      item: eligibleItems.find((item) => !usedIds.has(item.id)),
      label: "Keep reading",
      reason: "Next ranked story keeps the queue moving.",
    });
  }

  return {
    slots,
    summary: `${slots.length}-step queue built from ${items.length} ranked ${
      items.length === 1 ? "story" : "stories"
    }.`,
  };
};

const selectUnusedEditionStory = ({
  items,
  score,
  usedIds,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
  score: (item: RankedNewsItem<NewsHomeItem>) => number;
  usedIds: ReadonlySet<string>;
}) =>
  [...items]
    .filter((item) => !usedIds.has(item.id))
    .sort((left, right) => {
      const scoreDiff = score(right) - score(left);
      if (scoreDiff !== 0) return scoreDiff;

      if (right.personalizedScore !== left.personalizedScore) {
        return right.personalizedScore - left.personalizedScore;
      }

      return (
        new Date(right.publishedAt).getTime() -
        new Date(left.publishedAt).getTime()
      );
    })[0];

const hasNewsItemSharedSpecificEntity = ({
  avoidEntityKeys,
  item,
}: {
  avoidEntityKeys: ReadonlySet<string>;
  item: RankedNewsItem<NewsHomeItem>;
}) =>
  getNewsAlertRoutingSpecificEntities(item).some((entity) =>
    avoidEntityKeys.has(entity.key),
  );

const selectUnusedEditionCounterpointStory = ({
  avoidEntityKeys,
  items,
  score,
  usedIds,
}: {
  avoidEntityKeys: ReadonlySet<string>;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  score: (item: RankedNewsItem<NewsHomeItem>) => number;
  usedIds: ReadonlySet<string>;
}) => {
  if (avoidEntityKeys.size === 0) {
    return selectUnusedEditionStory({ items, score, usedIds });
  }

  const counterpointItems = items.filter(
    (item) =>
      !usedIds.has(item.id) &&
      !hasNewsItemSharedSpecificEntity({ avoidEntityKeys, item }),
  );

  return (
    selectUnusedEditionStory({
      items: counterpointItems,
      score,
      usedIds,
    }) ?? selectUnusedEditionStory({ items, score, usedIds })
  );
};

export const getNewsEditionSchedule = ({
  items,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
}) => {
  if (items.length === 0) {
    return {
      slots: [],
      summary: "Edition schedule will appear as stories load.",
    };
  }

  const usedIds = new Set<string>();
  const slots: {
    intent: string;
    label: string;
    reason: string;
    story: ReturnType<typeof toReadingQueueStory>;
    timeLabel: string;
  }[] = [];
  const addSlot = ({
    intent,
    item,
    label,
    reason,
    timeLabel,
  }: {
    intent: string;
    item: RankedNewsItem<NewsHomeItem> | undefined;
    label: string;
    reason: string;
    timeLabel: string;
  }) => {
    if (!item || usedIds.has(item.id)) return;

    usedIds.add(item.id);
    slots.push({
      intent,
      label,
      reason,
      story: toReadingQueueStory(item),
      timeLabel,
    });
  };
  const [leadStory] = items;
  const leadEntityKeys = new Set(
    leadStory
      ? getNewsAlertRoutingSpecificEntities(leadStory).map(
          (entity) => entity.key,
        )
      : [],
  );

  addSlot({
    intent: "Start with the lead story.",
    item: leadStory,
    label: "Morning Brief",
    reason: "Highest-ranked story in the personalized edition.",
    timeLabel: "08:00",
  });

  const heatStory = selectUnusedEditionCounterpointStory({
    avoidEntityKeys: leadEntityKeys,
    items,
    score: (item) => item.trendScore,
    usedIds,
  });
  const heatStoryIsCounterpoint =
    heatStory !== undefined &&
    leadEntityKeys.size > 0 &&
    !hasNewsItemSharedSpecificEntity({
      avoidEntityKeys: leadEntityKeys,
      item: heatStory,
    });
  const leadEntityLabel = leadStory
    ? getNewsAlertRoutingSpecificEntities(leadStory)[0]?.label
    : undefined;

  addSlot({
    intent: "Track what is gaining heat.",
    item: heatStory,
    label: "Midday Watch",
    reason: heatStory
      ? heatStoryIsCounterpoint && leadEntityLabel
        ? `Counterpoint heat story at ${heatStory.trendScore} trend after ${leadEntityLabel}.`
        : `Highest heat story remaining at ${heatStory.trendScore} trend.`
      : "Highest heat story remaining.",
    timeLabel: "12:00",
  });

  const latestStory = selectUnusedEditionStory({
    items,
    score: (item) => new Date(item.publishedAt).getTime(),
    usedIds,
  });

  addSlot({
    intent: "Catch the newest movement.",
    item: latestStory,
    label: "Evening Catch-Up",
    reason: latestStory
      ? `Newest remaining story from ${latestStory.sourceName}.`
      : "Newest remaining story.",
    timeLabel: "18:00",
  });

  const deepReadStory = selectUnusedEditionStory({
    items,
    score: (item) =>
      item.sourceScore * 2 +
      getUniqueSignals(item.entities, 24).length * 12 +
      getUniqueSignals(item.tags, 24).length * 8 +
      item.personalizedScore,
    usedIds,
  });
  const entityCount = deepReadStory
    ? getUniqueSignals(deepReadStory.entities, 24).length
    : 0;
  const tagCount = deepReadStory
    ? getUniqueSignals(deepReadStory.tags, 24).length
    : 0;

  addSlot({
    intent: "Save time for context.",
    item: deepReadStory,
    label: "Deep Read",
    reason: `Strong source with ${entityCount} ${
      entityCount === 1 ? "entity" : "entities"
    } and ${tagCount} ${tagCount === 1 ? "tag" : "tags"}.`,
    timeLabel: "21:00",
  });

  return {
    slots,
    summary: `${slots.length} timed edition ${
      slots.length === 1 ? "slot" : "slots"
    } from ${items.length} ranked ${items.length === 1 ? "story" : "stories"}.`,
  };
};

export const selectNewsFeedModeItems = ({
  items,
  mode,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
  mode: NewsFeedMode;
}) => {
  if (mode === "for_you") return [...items];

  return [...items].sort((left, right) => {
    if (mode === "latest") {
      const publishedDiff =
        new Date(right.publishedAt).getTime() -
        new Date(left.publishedAt).getTime();

      if (publishedDiff !== 0) return publishedDiff;
    }

    if (right.trendScore !== left.trendScore) {
      return right.trendScore - left.trendScore;
    }

    if (right.personalizedScore !== left.personalizedScore) {
      return right.personalizedScore - left.personalizedScore;
    }

    return (
      new Date(right.publishedAt).getTime() -
      new Date(left.publishedAt).getTime()
    );
  });
};

export interface NewsSessionIntentFilter {
  category: string | null;
  query: string;
  sourceSlug: string | null;
}

const newsSessionIntentSignal = "session_intent";
const sessionIntentQueryStopwords = new Set([
  "a",
  "ai",
  "an",
  "and",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const getSessionIntentQueryTerms = (query: string) =>
  query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((term) => term.trim())
    .filter(
      (term) => term.length >= 2 && !sessionIntentQueryStopwords.has(term),
    )
    .slice(0, 6);

const getSessionIntentSearchText = (item: NewsHomeItem) =>
  [
    item.title,
    item.summary,
    item.category,
    item.sourceName,
    item.sourceSlug,
    ...item.entities,
    ...item.tags,
  ]
    .join(" ")
    .toLowerCase();

const getSessionIntentBoost = ({
  intent,
  item,
}: {
  intent: NewsSessionIntentFilter;
  item: RankedNewsItem<NewsHomeItem>;
}) => {
  if (item.matchedSignals.includes(newsSessionIntentSignal)) return 0;

  let boost = 0;

  if (intent.category && item.category === intent.category) boost += 14;
  if (intent.sourceSlug && item.sourceSlug === intent.sourceSlug) boost += 14;

  const queryTerms = getSessionIntentQueryTerms(intent.query);

  if (queryTerms.length > 0) {
    const searchText = getSessionIntentSearchText(item);
    const matchCount = queryTerms.filter((term) =>
      searchText.includes(term),
    ).length;

    boost += Math.min(16, matchCount * 5);
  }

  return boost;
};

export const selectSessionIntentNewsHomeItems = ({
  intent,
  items,
}: {
  intent: NewsSessionIntentFilter;
  items: readonly RankedNewsItem<NewsHomeItem>[];
}) => {
  const hasIntent = Boolean(
    intent.category ?? intent.sourceSlug ?? intent.query.trim(),
  );

  if (!hasIntent) return [...items];

  return items
    .map((item, index) => {
      const boost = getSessionIntentBoost({ intent, item });

      if (boost <= 0) return { index, item };

      return {
        index,
        item: {
          ...item,
          matchedSignals: item.matchedSignals.includes(newsSessionIntentSignal)
            ? item.matchedSignals
            : [...item.matchedSignals, newsSessionIntentSignal],
          personalizedScore: item.personalizedScore + boost,
        },
      };
    })
    .sort((left, right) =>
      right.item.personalizedScore === left.item.personalizedScore
        ? left.index - right.index
        : right.item.personalizedScore - left.item.personalizedScore,
    )
    .map(({ item }) => item);
};

const newsChannelComparisonModes = [
  { key: "for_you", label: "For You" },
  { key: "latest", label: "Latest" },
  { key: "trending", label: "Trending" },
] as const satisfies readonly { key: NewsFeedMode; label: string }[];

const toNewsChannelComparisonStory = (item: RankedNewsItem<NewsHomeItem>) => ({
  id: item.id,
  sourceName: item.sourceName,
  title: item.title,
});

const getNewsChannelComparisonReason = ({
  item,
  mode,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  mode: NewsFeedMode;
}) => {
  if (mode === "latest") return "Newest publish time";
  if (mode === "trending") return "Highest heat";
  if (item.matchedSignals.length > 0) return "Reader signals";

  return "Personalized score";
};

const getNewsChannelComparisonScoreLabel = ({
  item,
  mode,
}: {
  item: RankedNewsItem<NewsHomeItem>;
  mode: NewsFeedMode;
}) => {
  if (mode === "latest") {
    return item.publishedAt.slice(0, 16).replace("T", " ");
  }

  if (mode === "trending") return `${item.trendScore} heat`;

  return `${item.personalizedScore} score`;
};

export const getNewsChannelComparison = ({
  items,
  limit,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
}) => {
  if (items.length === 0) {
    return {
      channels: [],
      label: "No Channels",
      metrics: [
        { label: "Channel leads", value: "0" },
        { label: "Lead spread", value: "0 stories" },
        { label: `Shared top ${limit}`, value: "0 stories" },
      ],
      summary: "Channel comparison will appear as stories load.",
    };
  }

  const channels = newsChannelComparisonModes
    .map(({ key, label }) => {
      const modeItems = selectNewsFeedModeItems({ items, mode: key });
      const lead = modeItems[0];

      if (!lead) return null;

      return {
        key,
        label,
        lead: toNewsChannelComparisonStory(lead),
        reason: getNewsChannelComparisonReason({ item: lead, mode: key }),
        scoreLabel: getNewsChannelComparisonScoreLabel({
          item: lead,
          mode: key,
        }),
        topStories: modeItems.slice(0, limit).map(toNewsChannelComparisonStory),
      };
    })
    .filter((channel): channel is NonNullable<typeof channel> =>
      Boolean(channel),
    );
  const leadIds = new Set(channels.map((channel) => channel.lead.id));
  const [firstChannel] = channels;
  const sharedTopIds = firstChannel
    ? firstChannel.topStories
        .map((story) => story.id)
        .filter((id) =>
          channels.every((channel) =>
            channel.topStories.some((story) => story.id === id),
          ),
        )
    : [];
  const leadSpreadLabel = leadIds.size === 1 ? "story" : "stories";

  return {
    channels,
    label: `${channels.length} Channels`,
    metrics: [
      { label: "Channel leads", value: String(channels.length) },
      { label: "Lead spread", value: `${leadIds.size} ${leadSpreadLabel}` },
      {
        label: `Shared top ${limit}`,
        value: `${sharedTopIds.length} ${
          sharedTopIds.length === 1 ? "story" : "stories"
        }`,
      },
    ],
    summary: `${channels.length} ranking ${
      channels.length === 1 ? "channel compares" : "channels compare"
    } ${items.length} ${items.length === 1 ? "story" : "stories"}; ${
      leadIds.size
    } different lead ${
      leadIds.size === 1 ? "story surfaces" : "stories surface"
    } across For You, Latest, and Trending.`,
  };
};

export const selectReaderFreshNewsHomeItems = ({
  historyItems,
  items,
}: {
  historyItems: readonly ({ id: string } & NewsUrlReference)[];
  items: readonly RankedNewsItem<NewsHomeItem>[];
}) =>
  selectReaderFreshNewsFeed(
    items,
    historyItems.map((item) => item.id),
    historyItems,
  );

export interface NewsHomeExposureRecord {
  action: "view";
  metadata: {
    exposure: true;
    exposureSlot: number;
    feedMode: NewsFeedMode;
    surface: "home";
  };
  newsItemId: string;
  visitorKey: string;
}

const normalizeNewsHomeExposureUrl = (url: string | null | undefined) => {
  if (!url) return null;

  const normalizedUrl = url
    .trim()
    .split("#")[0]
    ?.split("?")[0]
    ?.replace(/\/$/, "")
    .toLowerCase();

  return normalizedUrl && normalizedUrl.length > 0 ? normalizedUrl : null;
};

const getNewsHomeExposureUrlKeys = (item: NewsUrlReference) =>
  [item.canonicalUrl, item.originalUrl]
    .map(normalizeNewsHomeExposureUrl)
    .filter((url): url is string => url !== null);

export const selectNewsHomeExposureRecords = ({
  feedMode,
  isPreview,
  items,
  limit,
  recordedItems,
  visitorKey,
}: {
  feedMode: NewsFeedMode;
  isPreview: boolean;
  items: readonly RankedNewsItem<NewsHomeItem>[];
  limit: number;
  recordedItems: readonly ({ id: string } & NewsUrlReference)[];
  visitorKey: string | null;
}): NewsHomeExposureRecord[] => {
  if (isPreview || !visitorKey || limit <= 0) return [];

  const recordedUrlKeys = new Set(
    recordedItems.flatMap(getNewsHomeExposureUrlKeys),
  );

  return filterHiddenNewsItems(
    items,
    recordedItems.map((item) => item.id),
  )
    .filter((item) =>
      getNewsHomeExposureUrlKeys(item).every(
        (urlKey) => !recordedUrlKeys.has(urlKey),
      ),
    )
    .slice(0, limit)
    .map((item, exposureSlot) => ({
      action: "view",
      metadata: {
        exposure: true,
        exposureSlot,
        feedMode,
        surface: "home",
      },
      newsItemId: item.id,
      visitorKey,
    }));
};

const feedFatigueTopicLabels: Record<string, string> = {
  agent_product: "Agents",
  big_tech: "Big Tech",
  funding: "Funding",
  market_map: "Market Maps",
  model_release: "Models",
  musk_ai: "Musk AI",
  new_concept: "New Concepts",
  open_source: "Open Source",
  product_hunt: "Product Hunt",
  research: "Research",
  robotics: "Robotics",
  social_signal: "Hot Takes",
  yc_ai: "YC AI",
};

const formatFeedFatigueTopic = (category: string) =>
  feedFatigueTopicLabels[category] ??
  category
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatFeedFatigueRepeatCount = (count: number, noun: string) =>
  `${count} ${noun} ${count === 1 ? "repeat" : "repeats"}`;

const getNormalizedFeedFatigueEntities = (item: {
  entities: readonly string[];
}) =>
  item.entities
    .map((entity) => ({
      key: entity.trim().toLowerCase(),
      label: entity.trim(),
    }))
    .filter((entity) => entity.key.length > 0);

const getSharedFeedFatigueEntity = (
  item: { entities: readonly string[] },
  previousItem: { entities: readonly string[] },
) => {
  const previousEntities = new Set(
    getNormalizedFeedFatigueEntities(previousItem).map((entity) => entity.key),
  );

  return getNormalizedFeedFatigueEntities(item).find((entity) =>
    previousEntities.has(entity.key),
  );
};

const getLongestFeedFatigueRun = <TItem>({
  getKey,
  getLabel,
  items,
}: {
  getKey: (item: TItem) => string;
  getLabel: (item: TItem) => string;
  items: readonly TItem[];
}) => {
  let longestRun = {
    count: 0,
    label: "None",
  };
  let currentRun = {
    count: 0,
    key: "",
    label: "None",
  };

  for (const item of items) {
    const key = getKey(item);
    const label = getLabel(item);

    if (currentRun.key === key) {
      currentRun = {
        ...currentRun,
        count: currentRun.count + 1,
      };
    } else {
      currentRun = {
        count: 1,
        key,
        label,
      };
    }

    if (currentRun.count > longestRun.count) {
      longestRun = {
        count: currentRun.count,
        label: currentRun.label,
      };
    }
  }

  return longestRun;
};

const getLongestFeedEntityFatigueRun = ({
  items,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
}) => {
  let longestRun = {
    count: 0,
    label: "None",
  };
  let activeRuns = new Map<string, { count: number; label: string }>();

  for (const item of items) {
    const nextRuns = new Map<string, { count: number; label: string }>();

    for (const entity of getNormalizedFeedFatigueEntities(item)) {
      const previousRun = activeRuns.get(entity.key);
      const nextRun = {
        count: previousRun ? previousRun.count + 1 : 1,
        label: previousRun?.label ?? entity.label,
      };

      nextRuns.set(entity.key, nextRun);

      if (nextRun.count > longestRun.count) {
        longestRun = nextRun;
      }
    }

    activeRuns = nextRuns;
  }

  return longestRun;
};

export const getNewsFeedFatigueReport = ({
  items,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
}) => {
  if (items.length === 0) {
    return {
      label: "Waiting",
      metrics: [
        { label: "Source repeats", value: "0" },
        { label: "Topic repeats", value: "0" },
        { label: "Entity repeats", value: "0" },
        { label: "Longest source run", value: "0" },
        { label: "Longest topic run", value: "0" },
        { label: "Longest entity run", value: "0" },
      ],
      notices: [
        {
          detail: "Fatigue throttle will appear after stories are ranked.",
          label: "Waiting for stories",
        },
      ],
      summary: "Fatigue throttle will appear as stories load.",
    };
  }

  let sourceRepeatCount = 0;
  let topicRepeatCount = 0;
  let entityRepeatCount = 0;

  items.forEach((item, index) => {
    const previousItem = items[index - 1];

    if (!previousItem) return;

    if (previousItem.sourceSlug === item.sourceSlug) {
      sourceRepeatCount += 1;
    }

    if (previousItem.category === item.category) {
      topicRepeatCount += 1;
    }

    if (getSharedFeedFatigueEntity(item, previousItem)) {
      entityRepeatCount += 1;
    }
  });

  const longestSourceRun = getLongestFeedFatigueRun({
    getKey: (item: RankedNewsItem<NewsHomeItem>) => item.sourceSlug,
    getLabel: (item) => item.sourceName,
    items,
  });
  const longestTopicRun = getLongestFeedFatigueRun({
    getKey: (item: RankedNewsItem<NewsHomeItem>) => item.category,
    getLabel: (item) => formatFeedFatigueTopic(item.category),
    items,
  });
  const longestEntityRun = getLongestFeedEntityFatigueRun({ items });
  const notices: { detail: string; label: string }[] = [];

  if (longestSourceRun.count > 1) {
    notices.push({
      detail: `${longestSourceRun.label} repeats across ${longestSourceRun.count} adjacent stories before the next source appears.`,
      label: "Source fatigue",
    });
  }

  if (longestTopicRun.count > 1) {
    notices.push({
      detail: `${longestTopicRun.label} repeats across ${longestTopicRun.count} adjacent stories before the next topic appears.`,
      label: "Topic fatigue",
    });
  }

  if (longestEntityRun.count > 1) {
    notices.push({
      detail: `${longestEntityRun.label} repeats across ${longestEntityRun.count} adjacent stories before the next entity appears.`,
      label: "Entity fatigue",
    });
  }

  if (notices.length === 0) {
    notices.push({
      detail:
        "Adjacent stories alternate sources, topics, and entities where coverage allows.",
      label: "Fatigue throttle",
    });
  }

  return {
    label:
      sourceRepeatCount === 0 &&
      topicRepeatCount === 0 &&
      entityRepeatCount === 0
        ? "Throttled"
        : "Watch",
    metrics: [
      { label: "Source repeats", value: String(sourceRepeatCount) },
      { label: "Topic repeats", value: String(topicRepeatCount) },
      { label: "Entity repeats", value: String(entityRepeatCount) },
      { label: "Longest source run", value: String(longestSourceRun.count) },
      { label: "Longest topic run", value: String(longestTopicRun.count) },
      { label: "Longest entity run", value: String(longestEntityRun.count) },
    ],
    notices,
    summary: `${items.length} ${
      items.length === 1 ? "story" : "stories"
    } checked for source, topic, and entity fatigue: ${formatFeedFatigueRepeatCount(
      sourceRepeatCount,
      "source",
    )}, ${formatFeedFatigueRepeatCount(
      topicRepeatCount,
      "topic",
    )}, ${formatFeedFatigueRepeatCount(entityRepeatCount, "entity")}.`,
  };
};

export const selectFeedFatigueBalancedNewsHomeItems = ({
  items,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
}) => selectFatigueBalancedNewsFeed(items);

export const selectSourceCorroboratedNewsHomeItems = ({
  items,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
}) => selectSourceCorroboratedNewsFeed(items);

export const selectNegativeFeedbackAdjustedNewsHomeItems = ({
  items,
  negativeFeedbackItems,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
  negativeFeedbackItems: readonly NewsReaderMemoryItem[];
}) => selectNegativeFeedbackAdjustedNewsFeed(items, negativeFeedbackItems);

export const selectVisibleNewsHomeItems = ({
  items,
  hiddenItemIds,
  hiddenItems = [],
}: {
  items: readonly NewsHomeItem[];
  hiddenItemIds: readonly string[];
  hiddenItems?: readonly NewsHomeItem[];
}) => {
  if (hiddenItemIds.length === 0 && hiddenItems.length === 0) return [...items];

  return filterBlockedNewsItems(items, hiddenItemIds, hiddenItems);
};

export const mergeNewsHomeItems = ({
  currentItems,
  nextItems,
}: {
  currentItems: readonly NewsHomeItem[];
  nextItems: readonly NewsHomeItem[];
}) => dedupeNewsItems([...currentItems, ...nextItems]);

const countSharedRelatedSignals = (
  articleSignals: readonly string[],
  itemSignals: readonly string[],
) => {
  const articleSignalSet = new Set(
    articleSignals.map(normalizePreferenceSignal),
  );

  return itemSignals.filter((signal) =>
    articleSignalSet.has(normalizePreferenceSignal(signal)),
  ).length;
};

const getRelatedNewsScore = ({
  article,
  item,
}: {
  article: NewsHomeItem;
  item: NewsHomeItem;
}) =>
  countSharedRelatedSignals(article.entities, item.entities) * 44 +
  countSharedRelatedSignals(article.tags, item.tags) * 36 +
  (normalizePreferenceSignal(article.category) ===
  normalizePreferenceSignal(item.category)
    ? 14
    : 0) +
  Math.round(item.sourceScore / 12) +
  Math.round(item.trendScore / 18);

export const selectRelatedNewsHomeItems = ({
  article,
  limit,
  relatedItems,
}: {
  article: NewsHomeItem;
  limit: number;
  relatedItems: readonly NewsHomeItem[];
}) =>
  dedupeNewsItems(filterBlockedNewsItems(relatedItems, [article.id], [article]))
    .sort((left, right) => {
      const scoreDelta =
        getRelatedNewsScore({ article, item: right }) -
        getRelatedNewsScore({ article, item: left });

      if (scoreDelta !== 0) return scoreDelta;

      if (right.trendScore !== left.trendScore) {
        return right.trendScore - left.trendScore;
      }

      if (right.sourceScore !== left.sourceScore) {
        return right.sourceScore - left.sourceScore;
      }

      return (
        new Date(right.publishedAt).getTime() -
        new Date(left.publishedAt).getTime()
      );
    })
    .slice(0, limit);

export const getNextNewsHomeCursor = (items: readonly NewsHomeItem[]) => {
  const firstItem = items[0];
  if (!firstItem) return null;

  let oldest = firstItem.publishedAt;

  for (const item of items) {
    if (new Date(item.publishedAt).getTime() < new Date(oldest).getTime()) {
      oldest = item.publishedAt;
    }
  }

  return oldest;
};

export const shouldAutoLoadMoreNewsHomeItems = ({
  cursor,
  hasMoreItems,
  isFeedEndVisible,
  isLoadingMore,
  isPreview,
  visitorKey,
}: {
  cursor: string | null;
  hasMoreItems: boolean;
  isFeedEndVisible: boolean;
  isLoadingMore: boolean;
  isPreview: boolean;
  visitorKey: string | null;
}) =>
  Boolean(cursor) &&
  Boolean(visitorKey) &&
  hasMoreItems &&
  isFeedEndVisible &&
  !isLoadingMore &&
  !isPreview;

export const shouldFetchServerRecommendations = ({
  status,
  visitorKey,
}: {
  status: NewsHomeStatus;
  visitorKey: string | null;
}) => status === "ready" && Boolean(visitorKey);

const newsHomeReaderMemoryResetCacheScopes = [
  "forYou",
  "profile",
  "saved",
  "history",
] as const;

export const getNewsHomeReaderMemoryResetCacheScopes = () =>
  newsHomeReaderMemoryResetCacheScopes;

export const getNewsRecommendationReasons = getSharedNewsRecommendationReasons;

export const getNewsStoryRankDetails = ({
  item,
  mode = "for_you",
  now = new Date(),
}: {
  item: RankedNewsItem<NewsHomeItem>;
  mode?: NewsFeedMode;
  now?: Date;
}) => {
  if (mode === "for_you" && item.recommendation) return item.recommendation;

  return summarizeNewsRecommendation({ item, mode, now });
};

export const getNewsDeskStatusSummary = (status: NewsDeskStatus) => {
  if (status.health === "unavailable") {
    return {
      label: "Needs schema",
      detail:
        "News tables are not reachable yet. Apply the database schema before live collection.",
    };
  }

  if (status.health === "error" && status.latestRun?.status === "failed") {
    const sourceName = status.latestRun.sourceName ?? "Latest refresh";
    const errorMessage = status.latestRun.errorMessage ?? "Unknown error";

    return {
      label: "Refresh failed",
      detail: `${sourceName} failed: ${errorMessage}`,
    };
  }

  if (status.health === "live") {
    return {
      label: "Live edition",
      detail: `${status.publishedStories} published stories from ${status.activeSources} active sources.`,
    };
  }

  if (status.health === "seeded") {
    return {
      label: "Ready to crawl",
      detail: `${status.activeSources} active sources are registered. Run the refresh job to collect stories.`,
    };
  }

  return {
    label: "Needs sources",
    detail: "Seed source definitions before running the first collection job.",
  };
};

export const getNewsProductionReadinessChecklist = ({
  refreshConfigured,
  status,
}: {
  refreshConfigured: boolean;
  status: NewsDeskStatus;
}): NewsProductionReadinessItem[] => {
  const schemaReady = status.health !== "unavailable";
  const sourcesReady = schemaReady && status.activeSources > 0;
  const refreshReady =
    status.health === "live" ||
    (status.latestRun !== null && status.latestRun.status !== "failed");
  const liveReady = status.health === "live";

  return [
    {
      detail: schemaReady
        ? "News tables are reachable in the target database."
        : "POSTGRES_URL is present, but the news tables are not reachable.",
      label: "Apply database schema",
      state: schemaReady ? "done" : "current",
    },
    {
      detail: sourcesReady
        ? `${status.activeSources} active sources are registered.`
        : schemaReady
          ? "Register the AI source list before running the first crawl."
          : "Register the AI source list after the schema is available.",
      label: "Seed sources",
      state: sourcesReady ? "done" : schemaReady ? "current" : "pending",
    },
    {
      detail: refreshConfigured
        ? "NEWS_REFRESH_SECRET is configured for scheduled refresh calls."
        : "Set NEWS_REFRESH_SECRET before scheduling refresh calls.",
      label: "Protect refresh endpoint",
      state: refreshConfigured ? "done" : "current",
    },
    {
      detail: refreshReady
        ? "The collection job has produced a successful or live run."
        : sourcesReady
          ? "Run news:refresh or news:refresh:remote to collect stories."
          : "Run news:refresh or news:refresh:remote after sources exist.",
      label: "Run first refresh",
      state: refreshReady ? "done" : sourcesReady ? "current" : "pending",
    },
    {
      detail: liveReady
        ? `${status.publishedStories} published stories are serving the edition.`
        : "Preview stories stay visible until published stories exist.",
      label: "Live stories",
      state: liveReady ? "done" : "pending",
    },
  ];
};
