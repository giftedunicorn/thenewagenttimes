export interface NewsPreferenceProfile {
  preferredCategories: readonly string[];
  preferredSources: readonly string[];
  preferredEntities: readonly string[];
  noveltyBias: number;
  recencyBias: number;
}

export interface RecommendableNewsItem {
  id: string;
  title: string;
  category: string;
  tags: readonly string[];
  entities: readonly string[];
  sourceSlug: string;
  sourceScore: number;
  trendScore: number;
  publishedAt: string;
}

export type RankedNewsItem<TItem extends RecommendableNewsItem> = TItem & {
  personalizedScore: number;
  matchedSignals: string[];
};

export interface NewsIdentity {
  id: string;
}

export interface NewsUrlReference {
  canonicalUrl?: string | null;
  originalUrl?: string | null;
}

export type NewsUrlIdentity = NewsIdentity & NewsUrlReference;

export type ReaderInteractionAction =
  | "view"
  | "click_source"
  | "save"
  | "share"
  | "hide";

export interface ReaderInteraction {
  action: ReaderInteractionAction;
  rankSlot?: number;
  readPercent?: number;
}

const normalizeSet = (values: readonly string[]) =>
  new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));

const clampBias = (value: number) => Math.min(Math.max(value, 0), 2);

const preferenceLimits = {
  categories: 12,
  entities: 24,
  sources: 12,
} as const;

const normalizeSignals = (values: readonly string[], limit: number) => {
  const normalizedValues = new Set<string>();
  const nextValues: string[] = [];

  for (const value of values) {
    const signal = value.trim();
    const normalizedSignal = signal.toLowerCase();

    if (!signal || normalizedValues.has(normalizedSignal)) continue;

    nextValues.push(signal);
    normalizedValues.add(normalizedSignal);
  }

  return nextValues.slice(-limit);
};

export const normalizeNewsPreferenceProfile = (
  profile: NewsPreferenceProfile,
): NewsPreferenceProfile => ({
  preferredCategories: normalizeSignals(
    profile.preferredCategories,
    preferenceLimits.categories,
  ),
  preferredSources: normalizeSignals(
    profile.preferredSources,
    preferenceLimits.sources,
  ),
  preferredEntities: normalizeSignals(
    profile.preferredEntities,
    preferenceLimits.entities,
  ),
  noveltyBias: clampBias(profile.noveltyBias),
  recencyBias: clampBias(profile.recencyBias),
});

export const getNewsExplorationInterval = (profile: NewsPreferenceProfile) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const signalCount =
    normalizedProfile.preferredCategories.length +
    normalizedProfile.preferredSources.length +
    normalizedProfile.preferredEntities.length;
  const averageBias =
    (normalizedProfile.noveltyBias + normalizedProfile.recencyBias) / 2;

  if (signalCount === 0) return 2;
  if (signalCount >= 8 || averageBias >= 1.5) return 6;

  return 4;
};

const uniqueAppend = (
  values: readonly string[],
  candidates: readonly string[],
  limit: number,
) => {
  const normalizedValues = new Set(values.map((value) => value.toLowerCase()));
  const nextValues = [...values];

  for (const candidate of candidates) {
    if (!candidate.trim()) continue;
    if (normalizedValues.has(candidate.toLowerCase())) continue;

    nextValues.push(candidate);
    normalizedValues.add(candidate.toLowerCase());
  }

  return nextValues.slice(-limit);
};

const hoursSince = (date: string, now: Date) => {
  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return 72;
  return Math.max((now.getTime() - timestamp) / 3_600_000, 0);
};

const interactionWeights = {
  click_source: 0.28,
  save: 0.3,
  share: 0.45,
  view: 0.15,
} as const satisfies Record<Exclude<ReaderInteractionAction, "hide">, number>;

const minimumTrainingReadPercent = 0.35;

const clampReadPercent = (readPercent: number) =>
  Math.min(Math.max(readPercent, 0), 1);

const getRankSlotIntentMultiplier = (rankSlot: number | undefined) => {
  if (rankSlot === undefined || !Number.isFinite(rankSlot)) return 1;

  const normalizedRankSlot = Math.min(Math.max(Math.trunc(rankSlot), 0), 20);

  return 1 + normalizedRankSlot * 0.015;
};

export const shouldTrainReaderProfileFromInteraction = (
  interaction: ReaderInteraction,
) =>
  interaction.action !== "view" ||
  interaction.readPercent === undefined ||
  clampReadPercent(interaction.readPercent) >= minimumTrainingReadPercent;

const getInteractionWeight = (interaction: ReaderInteraction) => {
  if (interaction.action === "hide") return 0;

  const actionWeight = interactionWeights[interaction.action];
  const rankSlotMultiplier = getRankSlotIntentMultiplier(interaction.rankSlot);

  if (interaction.action !== "view") {
    return actionWeight * rankSlotMultiplier;
  }

  const readPercent = clampReadPercent(
    interaction.readPercent ?? minimumTrainingReadPercent,
  );
  const readDepthMultiplier = 0.5 + readPercent;

  return actionWeight * readDepthMultiplier * rankSlotMultiplier;
};

export const rankNewsForReader = <TItem extends RecommendableNewsItem>(
  items: readonly TItem[],
  preferences: NewsPreferenceProfile,
  now = new Date(),
): RankedNewsItem<TItem>[] => {
  const normalizedPreferences = normalizeNewsPreferenceProfile(preferences);
  const preferredCategories = normalizeSet(
    normalizedPreferences.preferredCategories,
  );
  const preferredSources = normalizeSet(normalizedPreferences.preferredSources);
  const preferredEntities = normalizeSet(
    normalizedPreferences.preferredEntities,
  );
  const noveltyBias = normalizedPreferences.noveltyBias;
  const recencyBias = normalizedPreferences.recencyBias;

  return items
    .map((item) => {
      const matchedSignals: string[] = [];
      let preferenceBoost = 0;

      if (preferredCategories.has(item.category.toLowerCase())) {
        preferenceBoost += 28;
        matchedSignals.push("category");
      }

      if (preferredSources.has(item.sourceSlug.toLowerCase())) {
        preferenceBoost += 16;
        matchedSignals.push("source");
      }

      if (
        item.entities.some((entity) =>
          preferredEntities.has(entity.toLowerCase()),
        )
      ) {
        preferenceBoost += 18;
        matchedSignals.push("entity");
      }

      if (
        item.tags.some((tag) => preferredEntities.has(tag.trim().toLowerCase()))
      ) {
        preferenceBoost += 12;
        matchedSignals.push("tag");
      }

      const ageHours = hoursSince(item.publishedAt, now);
      const noveltyBoost = noveltyBias * Math.min(item.tags.length * 2, 10);
      const recencyBoost = recencyBias * Math.max(16 - ageHours / 3, 0);
      const stalenessPenalty =
        recencyBias * Math.min(Math.max(ageHours - 48, 0) / 2, 24);
      const sourceTrustPenalty = Math.max(60 - item.sourceScore, 0) * 0.35;

      return {
        ...item,
        matchedSignals,
        personalizedScore: Math.round(
          item.trendScore +
            item.sourceScore / 10 +
            preferenceBoost +
            noveltyBoost +
            recencyBoost -
            stalenessPenalty -
            sourceTrustPenalty,
        ),
      };
    })
    .sort((left, right) => {
      if (right.personalizedScore !== left.personalizedScore) {
        return right.personalizedScore - left.personalizedScore;
      }

      return (
        new Date(right.publishedAt).getTime() -
        new Date(left.publishedAt).getTime()
      );
    });
};

export const filterHiddenNewsItems = <TItem extends NewsIdentity>(
  items: readonly TItem[],
  hiddenNewsItemIds: readonly string[],
): TItem[] => {
  const hiddenIds = new Set(hiddenNewsItemIds);

  return items.filter((item) => !hiddenIds.has(item.id));
};

export type DedupeNewsItem = NewsUrlIdentity & {
  category: string;
  entities?: readonly string[];
  publishedAt: string;
  sourceSlug?: string;
  sourceScore: number;
  title: string;
  trendScore: number;
};

type NewsFuzzyDedupeItem = Pick<DedupeNewsItem, "category" | "title"> & {
  entities?: readonly string[];
  sourceSlug?: string;
};

const getNewsDedupeUrlKeys = (item: NewsUrlReference) =>
  [item.canonicalUrl, item.originalUrl]
    .map(normalizeNewsDedupeUrl)
    .filter((url): url is string => url !== null)
    .map((url) => `url:${url}`);

const normalizeNewsDedupeUrl = (url: string | null | undefined) => {
  if (!url) return null;

  const normalizedUrl = url
    .trim()
    .split("#")[0]
    ?.split("?")[0]
    ?.replace(/\/$/, "")
    .toLowerCase();

  return normalizedUrl && normalizedUrl.length > 0 ? normalizedUrl : null;
};

const normalizeNewsDedupeTitle = (title: string) =>
  title
    .toLowerCase()
    .replace(/gpt[\s-]?(\d+)/g, "gpt$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const newsDedupeUrlTitleStopwords = new Set([
  "and",
  "for",
  "from",
  "new",
  "news",
  "the",
  "with",
]);

const normalizeNewsDedupeToken = (token: string) =>
  token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token;

const getNewsDedupeTextTokens = (value: string) =>
  normalizeNewsDedupeTitle(value)
    .split(" ")
    .map(normalizeNewsDedupeToken)
    .filter(
      (token) => token.length > 2 && !newsDedupeUrlTitleStopwords.has(token),
    );

const getNewsDedupeUrlPath = (url: string) => {
  const withoutFragment = url.split("#")[0] ?? url;
  const withoutQuery = withoutFragment.split("?")[0] ?? withoutFragment;

  return withoutQuery.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, "");
};

const getNewsDedupeTitleKey = (item: DedupeNewsItem) =>
  `title:${item.category
    .trim()
    .toLowerCase()}:${normalizeNewsDedupeTitle(item.title)}`;

const shouldUseNewsDedupeTitleKey = (item: DedupeNewsItem) => {
  const urls = [item.canonicalUrl, item.originalUrl].filter(
    (url): url is string => Boolean(url),
  );

  if (urls.length === 0) return true;

  const titleTokens = getNewsDedupeTextTokens(item.title);
  if (titleTokens.length < 2) return false;

  const requiredOverlap = Math.min(
    3,
    Math.max(2, Math.ceil(titleTokens.length / 2)),
  );

  return urls.some((url) => {
    const urlTokens = new Set(
      getNewsDedupeTextTokens(getNewsDedupeUrlPath(url)),
    );
    const overlap = titleTokens.filter((token) => urlTokens.has(token)).length;

    return overlap >= requiredOverlap;
  });
};

const getNewsDedupeKeys = (item: DedupeNewsItem) => {
  const urlKeys = getNewsDedupeUrlKeys(item);
  const titleKeys = shouldUseNewsDedupeTitleKey(item)
    ? [getNewsDedupeTitleKey(item)]
    : [];

  return Array.from(new Set([...urlKeys, ...titleKeys]));
};

const normalizeNewsDedupeEntity = (entity: string) =>
  normalizeNewsDedupeTitle(entity);

const getNewsDedupeEntitySet = (item: NewsFuzzyDedupeItem) =>
  new Set(
    (item.entities ?? [])
      .map(normalizeNewsDedupeEntity)
      .filter((entity) => entity.length > 0),
  );

const setsIntersect = <TValue>(
  left: ReadonlySet<TValue>,
  right: ReadonlySet<TValue>,
) => {
  for (const value of left) {
    if (right.has(value)) return true;
  }

  return false;
};

const getNewsDedupeTitleTokenSet = (item: NewsFuzzyDedupeItem) =>
  new Set(getNewsDedupeTextTokens(item.title));

const shouldFuzzyDedupeNewsItems = (
  left: NewsFuzzyDedupeItem,
  right: NewsFuzzyDedupeItem,
) => {
  if (
    left.category.trim().toLowerCase() !== right.category.trim().toLowerCase()
  ) {
    return false;
  }

  if (
    left.sourceSlug &&
    right.sourceSlug &&
    left.sourceSlug === right.sourceSlug
  ) {
    return false;
  }

  const leftEntities = getNewsDedupeEntitySet(left);
  const rightEntities = getNewsDedupeEntitySet(right);

  if (
    leftEntities.size === 0 ||
    rightEntities.size === 0 ||
    !setsIntersect(leftEntities, rightEntities)
  ) {
    return false;
  }

  const leftTokens = getNewsDedupeTitleTokenSet(left);
  const rightTokens = getNewsDedupeTitleTokenSet(right);
  const overlapTokens = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  );

  return overlapTokens.length >= 4;
};

const doNewsDedupeKeysMatch = (left: DedupeNewsItem, right: DedupeNewsItem) => {
  const leftKeys = getNewsDedupeKeys(left);
  const rightKeys = new Set(getNewsDedupeKeys(right));

  return leftKeys.some((key) => rightKeys.has(key));
};

const shouldDedupeNewsItems = (left: DedupeNewsItem, right: DedupeNewsItem) =>
  doNewsDedupeKeysMatch(left, right) || shouldFuzzyDedupeNewsItems(left, right);

const compareNewsDedupeStrength = (
  left: DedupeNewsItem,
  right: DedupeNewsItem,
) => {
  if (left.sourceScore !== right.sourceScore) {
    return left.sourceScore - right.sourceScore;
  }

  if (left.trendScore !== right.trendScore) {
    return left.trendScore - right.trendScore;
  }

  return (
    new Date(left.publishedAt).getTime() - new Date(right.publishedAt).getTime()
  );
};

export const dedupeNewsItems = <TItem extends DedupeNewsItem>(
  items: readonly TItem[],
): TItem[] => {
  const dedupeGroups: {
    index: number;
    item: TItem;
    keys: Set<string>;
  }[] = [];

  for (const item of items) {
    const keys = getNewsDedupeKeys(item);
    const matchingGroups = dedupeGroups.filter(
      (group) =>
        keys.some((key) => group.keys.has(key)) ||
        shouldFuzzyDedupeNewsItems(item, group.item),
    );

    if (matchingGroups.length === 0) {
      dedupeGroups.push({
        index: dedupeGroups.length,
        item,
        keys: new Set(keys),
      });
      continue;
    }

    const [primaryGroup, ...mergedGroups] = matchingGroups;
    if (!primaryGroup) continue;

    keys.forEach((key) => primaryGroup.keys.add(key));

    for (const mergedGroup of mergedGroups) {
      mergedGroup.keys.forEach((key) => primaryGroup.keys.add(key));

      if (compareNewsDedupeStrength(mergedGroup.item, primaryGroup.item) > 0) {
        primaryGroup.item = mergedGroup.item;
      }

      dedupeGroups.splice(dedupeGroups.indexOf(mergedGroup), 1);
    }

    if (compareNewsDedupeStrength(item, primaryGroup.item) > 0) {
      primaryGroup.item = item;
    }
  }

  return dedupeGroups
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.item);
};

export const filterBlockedNewsItems = <TItem extends DedupeNewsItem>(
  items: readonly TItem[],
  hiddenNewsItemIds: readonly string[],
  hiddenNewsItems: readonly DedupeNewsItem[] = [],
): TItem[] => {
  const hiddenIds = new Set(hiddenNewsItemIds);
  const hiddenDedupeKeys = new Set(hiddenNewsItems.flatMap(getNewsDedupeKeys));

  return items.filter(
    (item) =>
      !hiddenIds.has(item.id) &&
      getNewsDedupeKeys(item).every((key) => !hiddenDedupeKeys.has(key)) &&
      hiddenNewsItems.every(
        (hiddenNewsItem) => !shouldDedupeNewsItems(item, hiddenNewsItem),
      ),
  );
};

export const selectDiverseNewsFeed = <TItem extends RecommendableNewsItem>(
  rankedItems: readonly RankedNewsItem<TItem>[],
  {
    explorationInterval,
    limit,
  }: { explorationInterval?: number; limit: number },
): RankedNewsItem<TItem>[] => {
  const selected: RankedNewsItem<TItem>[] = [];
  const remaining = [...rankedItems];
  const usedSources = new Set<string>();
  const usedCategories = new Set<string>();

  const hasRecentFeedFatigue = (item: RankedNewsItem<TItem>) => {
    const previousItem = selected.at(-1);

    if (!previousItem) return false;

    return (
      previousItem.sourceSlug === item.sourceSlug ||
      previousItem.category === item.category
    );
  };

  while (selected.length < limit && remaining.length > 0) {
    const shouldExplore =
      explorationInterval !== undefined &&
      explorationInterval > 1 &&
      (selected.length + 1) % explorationInterval === 0;
    let selectedForExploration = false;
    let nextIndex = shouldExplore
      ? remaining.reduce((bestIndex, item, index) => {
          if (item.matchedSignals.length > 0) return bestIndex;
          if (bestIndex === -1) return index;

          const bestItem = remaining[bestIndex];
          if (!bestItem) return index;

          if (item.trendScore !== bestItem.trendScore) {
            return item.trendScore > bestItem.trendScore ? index : bestIndex;
          }

          return item.personalizedScore > bestItem.personalizedScore
            ? index
            : bestIndex;
        }, -1)
      : -1;

    selectedForExploration = nextIndex !== -1;

    if (nextIndex === -1) {
      nextIndex = remaining.findIndex(
        (item) =>
          !usedSources.has(item.sourceSlug) &&
          !usedCategories.has(item.category),
      );
    }

    if (nextIndex === -1) {
      nextIndex = remaining.findIndex(
        (item) =>
          !usedSources.has(item.sourceSlug) ||
          !usedCategories.has(item.category),
      );
    }

    if (nextIndex === -1) {
      nextIndex = 0;
    }

    const fatigueSafeIndex = remaining.findIndex(
      (item) =>
        !hasRecentFeedFatigue(item) &&
        (!selectedForExploration || item.matchedSignals.length === 0),
    );

    const candidateItem = remaining[nextIndex];

    if (
      candidateItem &&
      hasRecentFeedFatigue(candidateItem) &&
      fatigueSafeIndex !== -1
    ) {
      nextIndex = fatigueSafeIndex;
      selectedForExploration =
        selectedForExploration &&
        remaining[nextIndex]?.matchedSignals.length === 0;
    }

    const [nextItem] = remaining.splice(nextIndex, 1);
    if (!nextItem) continue;

    selected.push(
      selectedForExploration
        ? {
            ...nextItem,
            matchedSignals: [...nextItem.matchedSignals, "exploration"],
          }
        : nextItem,
    );
    usedSources.add(nextItem.sourceSlug);
    usedCategories.add(nextItem.category);
  }

  return selected;
};

const hasDiscoverySignal = <TItem extends RecommendableNewsItem>(
  item: RankedNewsItem<TItem>,
) =>
  item.matchedSignals.includes("discovery_slot") ||
  item.matchedSignals.includes("exploration");

const isQualifiedDiscoveryCandidate = <TItem extends RecommendableNewsItem>(
  item: RankedNewsItem<TItem>,
) =>
  (item.matchedSignals.length === 0 ||
    item.matchedSignals.every((signal) => signal === "exploration")) &&
  item.sourceScore >= 70 &&
  item.trendScore >= 60;

export const selectDiscoverySlotNewsFeed = <
  TItem extends RecommendableNewsItem,
>(
  rankedItems: readonly RankedNewsItem<TItem>[],
  {
    maxPersonalizedRank = 5,
    slotIndex = 3,
  }: { maxPersonalizedRank?: number; slotIndex?: number } = {},
): RankedNewsItem<TItem>[] => {
  const topItems = rankedItems.slice(0, maxPersonalizedRank);

  if (topItems.some(hasDiscoverySignal)) return [...rankedItems];

  const discoveryIndex = rankedItems.findIndex(
    (item, index) =>
      index >= maxPersonalizedRank && isQualifiedDiscoveryCandidate(item),
  );

  if (discoveryIndex === -1) return [...rankedItems];

  const nextItems = [...rankedItems];
  const [discoveryItem] = nextItems.splice(discoveryIndex, 1);

  if (!discoveryItem) return [...rankedItems];

  nextItems.splice(
    Math.min(slotIndex, nextItems.length),
    0,
    addMatchedSignal(discoveryItem, "discovery_slot"),
  );

  return nextItems;
};

export const selectFatigueBalancedNewsFeed = <
  TItem extends RecommendableNewsItem,
>(
  rankedItems: readonly RankedNewsItem<TItem>[],
): RankedNewsItem<TItem>[] => {
  const remaining = [...rankedItems];
  const selected: RankedNewsItem<TItem>[] = [];

  const hasSharedEntity = (
    item: RankedNewsItem<TItem>,
    previousItem: RankedNewsItem<TItem>,
  ) => {
    const previousEntities = normalizeSet(previousItem.entities);

    return item.entities.some((entity) =>
      previousEntities.has(entity.toLowerCase()),
    );
  };
  const isPositiveFeedbackAnchor = (item: RankedNewsItem<TItem>) =>
    item.matchedSignals.includes("positive_feedback");

  while (remaining.length > 0) {
    const previousItem = selected.at(-1);
    let nextIndex = 0;

    if (
      previousItem &&
      !(
        isPositiveFeedbackAnchor(previousItem) &&
        remaining[0] &&
        isPositiveFeedbackAnchor(remaining[0])
      )
    ) {
      const hasSourceOrCategoryFatigue = (item: RankedNewsItem<TItem>) =>
        item.sourceSlug === previousItem.sourceSlug ||
        item.category === previousItem.category;
      const fullAlternateIndex = remaining.findIndex(
        (item) =>
          !hasSourceOrCategoryFatigue(item) &&
          !hasSharedEntity(item, previousItem),
      );
      const sourceTopicAlternateIndex = remaining.findIndex(
        (item) => !hasSourceOrCategoryFatigue(item),
      );
      const partialAlternateIndex = remaining.findIndex(
        (item) =>
          item.sourceSlug !== previousItem.sourceSlug ||
          item.category !== previousItem.category ||
          !hasSharedEntity(item, previousItem),
      );

      if (fullAlternateIndex !== -1) {
        nextIndex = fullAlternateIndex;
      } else if (sourceTopicAlternateIndex !== -1) {
        nextIndex = sourceTopicAlternateIndex;
      } else if (partialAlternateIndex !== -1) {
        nextIndex = partialAlternateIndex;
      }
    }

    const [nextItem] = remaining.splice(nextIndex, 1);
    if (nextItem) selected.push(nextItem);
  }

  return selected;
};

export const selectReaderFreshNewsFeed = <
  TItem extends RecommendableNewsItem & NewsUrlIdentity,
>(
  rankedItems: readonly RankedNewsItem<TItem>[],
  viewedNewsItemIds: readonly string[],
  viewedNewsItems: readonly NewsUrlReference[] = [],
): RankedNewsItem<TItem>[] => {
  if (viewedNewsItemIds.length === 0 && viewedNewsItems.length === 0) {
    return [...rankedItems];
  }

  const viewedIds = new Set(viewedNewsItemIds);
  const viewedUrlKeys = new Set(viewedNewsItems.flatMap(getNewsDedupeUrlKeys));
  const unseenItems: RankedNewsItem<TItem>[] = [];
  const viewedItems: RankedNewsItem<TItem>[] = [];

  for (const item of rankedItems) {
    const hasViewedUrl = getNewsDedupeUrlKeys(item).some((key) =>
      viewedUrlKeys.has(key),
    );

    if (viewedIds.has(item.id) || hasViewedUrl) {
      viewedItems.push(item);
    } else {
      unseenItems.push(item);
    }
  }

  return [...unseenItems, ...viewedItems];
};

export type NegativeFeedbackNewsItem = Pick<
  RecommendableNewsItem,
  "category" | "entities" | "sourceSlug"
> & {
  occurredAt?: string;
  tags?: readonly string[];
};

type PositiveFeedbackAction = Extract<
  ReaderInteractionAction,
  "click_source" | "save" | "share"
>;

export type PositiveFeedbackNewsItem = Pick<
  RecommendableNewsItem,
  "category" | "entities" | "sourceSlug"
> & {
  action?: PositiveFeedbackAction;
  occurredAt?: string;
  tags?: readonly string[];
};

export type RecentExposureNewsItem = Pick<
  RecommendableNewsItem,
  "category" | "entities" | "sourceSlug"
> &
  NewsUrlReference & {
    id?: string;
    occurredAt?: string;
    readPercent?: number;
    surface?: string;
    tags?: readonly string[];
    title?: string;
  };

export interface NewsSemanticVector {
  newsItemId: string;
  embedding: readonly number[] | null | undefined;
  occurredAt?: string;
  strength?: number;
}

export interface NewsSemanticSimilarityMatch {
  newsItemId: string;
  similarity: number;
  occurredAt?: string;
  strength?: number;
}

export interface NewsCollaborativeSignal {
  newsItemId: string;
  score: number;
}

const addMatchedSignal = <TItem extends RecommendableNewsItem>(
  item: RankedNewsItem<TItem>,
  signal: string,
): RankedNewsItem<TItem> =>
  item.matchedSignals.includes(signal)
    ? item
    : {
        ...item,
        matchedSignals: [...item.matchedSignals, signal],
      };

const getNewsSignalSets = (
  items: readonly (Pick<
    RecommendableNewsItem,
    "category" | "entities" | "sourceSlug"
  > & { tags?: readonly string[] })[],
) => ({
  categories: normalizeSet(items.map((item) => item.category)),
  entities: normalizeSet(items.flatMap((item) => item.entities)),
  sources: normalizeSet(items.map((item) => item.sourceSlug)),
  tags: normalizeSet(items.flatMap((item) => item.tags ?? [])),
});

const hasNewsSignalMatch = (
  item: RecommendableNewsItem,
  signalSets: ReturnType<typeof getNewsSignalSets>,
) =>
  signalSets.sources.has(item.sourceSlug.toLowerCase()) ||
  signalSets.categories.has(item.category.toLowerCase()) ||
  item.entities.some((entity) =>
    signalSets.entities.has(entity.toLowerCase()),
  ) ||
  item.tags.some((tag) => signalSets.tags.has(tag.trim().toLowerCase()));

const positiveFeedbackActionStrength = {
  click_source: 1,
  save: 2,
  share: 3,
} as const satisfies Record<PositiveFeedbackAction, number>;

const getPositiveFeedbackActionStrength = (
  action: PositiveFeedbackAction | undefined,
) =>
  action
    ? positiveFeedbackActionStrength[action]
    : positiveFeedbackActionStrength.save;

const getPositiveFeedbackTimestamp = (occurredAt: string | undefined) => {
  if (!occurredAt) return 0;

  const timestamp = new Date(occurredAt).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const isActivePositiveFeedback = (
  item: PositiveFeedbackNewsItem,
  now: Date,
) => {
  if (item.action !== "click_source") return true;
  if (!item.occurredAt) return true;

  return hoursSince(item.occurredAt, now) <= 14 * 24;
};

const getPositiveFeedbackMatch = (
  item: RecommendableNewsItem,
  positiveFeedbackItems: readonly PositiveFeedbackNewsItem[],
  now: Date,
) => {
  let matchStrength = 0;
  let matchTimestamp = 0;

  for (const feedbackItem of positiveFeedbackItems) {
    if (!isActivePositiveFeedback(feedbackItem, now)) continue;

    const feedbackStrength = getPositiveFeedbackActionStrength(
      feedbackItem.action,
    );
    const feedbackTimestamp = getPositiveFeedbackTimestamp(
      feedbackItem.occurredAt,
    );
    const matchesSource =
      item.sourceSlug.toLowerCase() === feedbackItem.sourceSlug.toLowerCase();
    const canMatchTopicOrEntity = feedbackItem.action !== "click_source";
    const matchesTopicOrEntity =
      canMatchTopicOrEntity &&
      (item.category.toLowerCase() === feedbackItem.category.toLowerCase() ||
        item.entities.some((entity) =>
          feedbackItem.entities.some(
            (feedbackEntity) =>
              feedbackEntity.toLowerCase() === entity.toLowerCase(),
          ),
        ));
    const matchesTag =
      canMatchTopicOrEntity &&
      item.tags.some((tag) =>
        (feedbackItem.tags ?? []).some(
          (feedbackTag) =>
            feedbackTag.trim().toLowerCase() === tag.trim().toLowerCase(),
        ),
      );

    if (matchesSource || matchesTopicOrEntity || matchesTag) {
      if (
        feedbackStrength > matchStrength ||
        (feedbackStrength === matchStrength &&
          feedbackTimestamp > matchTimestamp)
      ) {
        matchStrength = feedbackStrength;
        matchTimestamp = feedbackTimestamp;
      }
    }
  }

  return { strength: matchStrength, timestamp: matchTimestamp };
};

interface PositiveFeedbackAnchor<TItem extends RecommendableNewsItem> {
  item: RankedNewsItem<TItem>;
  rank: number;
  strength: number;
  timestamp: number;
}

const diversifyPositiveFeedbackAnchorGroup = <
  TItem extends RecommendableNewsItem,
>(
  anchors: readonly PositiveFeedbackAnchor<TItem>[],
) => {
  const selected: PositiveFeedbackAnchor<TItem>[] = [];
  const remaining = [...anchors];

  while (remaining.length > 0) {
    const previousAnchor = selected.at(-1);
    let nextIndex = 0;

    if (previousAnchor) {
      const fullAlternateIndex = remaining.findIndex(
        (anchor) =>
          anchor.item.sourceSlug !== previousAnchor.item.sourceSlug &&
          anchor.item.category !== previousAnchor.item.category,
      );
      const partialAlternateIndex = remaining.findIndex(
        (anchor) =>
          anchor.item.sourceSlug !== previousAnchor.item.sourceSlug ||
          anchor.item.category !== previousAnchor.item.category,
      );

      if (fullAlternateIndex !== -1) {
        nextIndex = fullAlternateIndex;
      } else if (partialAlternateIndex !== -1) {
        nextIndex = partialAlternateIndex;
      }
    }

    const [nextAnchor] = remaining.splice(nextIndex, 1);
    if (nextAnchor) selected.push(nextAnchor);
  }

  return selected;
};

const diversifyPositiveFeedbackAnchors = <TItem extends RecommendableNewsItem>(
  anchors: readonly PositiveFeedbackAnchor<TItem>[],
) => {
  const diversifiedAnchors: PositiveFeedbackAnchor<TItem>[] = [];
  let group: PositiveFeedbackAnchor<TItem>[] = [];

  const flushGroup = () => {
    diversifiedAnchors.push(...diversifyPositiveFeedbackAnchorGroup(group));
    group = [];
  };

  for (const anchor of anchors) {
    const previousAnchor = group.at(-1);

    if (
      previousAnchor &&
      (previousAnchor.strength !== anchor.strength ||
        previousAnchor.timestamp !== anchor.timestamp)
    ) {
      flushGroup();
    }

    group.push(anchor);
  }

  if (group.length > 0) flushGroup();

  return diversifiedAnchors;
};

const deepPreferenceSignals = new Set(["category", "entity", "source"]);
const exposureCooldownHours = 24;
const defaultSemanticFeedbackMaxAgeHours = 14 * 24;
const defaultSemanticSimilarityThreshold = 0.78;
const collaborativeProtectedSignals = new Set([
  "breaking_news",
  "category",
  "deep_preference",
  "entity",
  "exposure_cooldown",
  "home_exposure_cooldown",
  "negative_feedback",
  "positive_feedback",
  "semantic_feedback",
  "source",
  "tag",
]);

const hasDeepPreferenceMatch = <TItem extends RecommendableNewsItem>(
  item: RankedNewsItem<TItem>,
) =>
  item.matchedSignals.reduce(
    (signalCount, signal) =>
      deepPreferenceSignals.has(signal) ? signalCount + 1 : signalCount,
    0,
  ) >= 2;

const isActiveRecentExposure = (item: RecentExposureNewsItem, now: Date) =>
  !item.occurredAt || hoursSince(item.occurredAt, now) <= exposureCooldownHours;

const isHomeRecentExposure = (item: RecentExposureNewsItem) =>
  item.surface?.trim().toLowerCase() === "home";

const isContentRecentExposure = (item: RecentExposureNewsItem) => {
  if (isHomeRecentExposure(item)) return false;

  if (item.surface?.trim().toLowerCase() !== "article") return true;
  if (item.readPercent === undefined) return true;

  return item.readPercent >= minimumTrainingReadPercent;
};

const toOptionalNewsUrlReference = (item: object): NewsUrlReference => {
  const reference = item as Partial<Record<keyof NewsUrlReference, unknown>>;

  return {
    canonicalUrl:
      typeof reference.canonicalUrl === "string"
        ? reference.canonicalUrl
        : null,
    originalUrl:
      typeof reference.originalUrl === "string" ? reference.originalUrl : null,
  };
};

const hasRecentExposureIdentityMatch = <TItem extends RecommendableNewsItem>(
  item: RankedNewsItem<TItem>,
  recentExposureItems: readonly RecentExposureNewsItem[],
) => {
  const itemId = item.id.trim();

  if (!itemId) return false;

  return recentExposureItems.some(
    (exposureItem) => exposureItem.id?.trim() === itemId,
  );
};

const hasRecentExposureUrlMatch = (
  item: object,
  recentExposureItems: readonly RecentExposureNewsItem[],
) => {
  const itemUrlKeys = new Set(
    getNewsDedupeUrlKeys(toOptionalNewsUrlReference(item)),
  );

  if (itemUrlKeys.size === 0) return false;

  return recentExposureItems.some((exposureItem) =>
    getNewsDedupeUrlKeys(exposureItem).some((urlKey) =>
      itemUrlKeys.has(urlKey),
    ),
  );
};

const hasRecentExposureFuzzyMatch = <TItem extends RecommendableNewsItem>(
  item: RankedNewsItem<TItem>,
  recentExposureItems: readonly RecentExposureNewsItem[],
) =>
  recentExposureItems.some((exposureItem) => {
    const title = exposureItem.title?.trim();

    if (!title) return false;

    return shouldFuzzyDedupeNewsItems(item, {
      category: exposureItem.category,
      entities: exposureItem.entities,
      sourceSlug: exposureItem.sourceSlug,
      title,
    });
  });

const getExposureCooldownMatch = <TItem extends RecommendableNewsItem>(
  item: RankedNewsItem<TItem>,
  contentExposureSignals: ReturnType<typeof getNewsSignalSets> | null,
  homeExposureItems: readonly RecentExposureNewsItem[],
) => {
  if (
    homeExposureItems.length > 0 &&
    (hasRecentExposureIdentityMatch(item, homeExposureItems) ||
      hasRecentExposureUrlMatch(item, homeExposureItems) ||
      hasRecentExposureFuzzyMatch(item, homeExposureItems))
  ) {
    return "exact";
  }

  if (
    contentExposureSignals &&
    hasNewsSignalMatch(item, contentExposureSignals)
  ) {
    return "content";
  }

  return null;
};

const isActiveSemanticFeedbackVector = (
  item: NewsSemanticVector,
  now: Date,
  maxAgeHours: number,
) => !item.occurredAt || hoursSince(item.occurredAt, now) <= maxAgeHours;

const getCosineSimilarity = (
  left: readonly number[] | null | undefined,
  right: readonly number[] | null | undefined,
) => {
  if (!left || !right || left.length === 0 || left.length !== right.length) {
    return null;
  }

  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;

    dotProduct += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) return null;

  return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
};

const getSemanticMatchRank = (match: NewsSemanticSimilarityMatch) =>
  match.similarity * (match.strength ?? 1);

export const buildNewsSemanticSimilarityMatches = ({
  candidateVectors,
  feedbackVectors,
  maxAgeHours = defaultSemanticFeedbackMaxAgeHours,
  minSimilarity = defaultSemanticSimilarityThreshold,
  now = new Date(),
}: {
  candidateVectors: readonly NewsSemanticVector[];
  feedbackVectors: readonly NewsSemanticVector[];
  maxAgeHours?: number;
  minSimilarity?: number;
  now?: Date;
}): NewsSemanticSimilarityMatch[] => {
  const activeFeedbackVectors = feedbackVectors.filter((item) =>
    isActiveSemanticFeedbackVector(item, now, maxAgeHours),
  );

  return candidateVectors.flatMap((candidate) => {
    let bestMatch: NewsSemanticSimilarityMatch | null = null;

    for (const feedback of activeFeedbackVectors) {
      if (feedback.newsItemId === candidate.newsItemId) continue;

      const similarity = getCosineSimilarity(
        candidate.embedding,
        feedback.embedding,
      );

      if (similarity === null || similarity < minSimilarity) continue;

      const match = {
        newsItemId: candidate.newsItemId,
        occurredAt: feedback.occurredAt,
        similarity,
        strength: feedback.strength,
      };

      if (
        !bestMatch ||
        getSemanticMatchRank(match) > getSemanticMatchRank(bestMatch)
      ) {
        bestMatch = match;
      }
    }

    return bestMatch ? [bestMatch] : [];
  });
};

const getSemanticSimilarityBoost = ({
  maxBoost,
  minSimilarity,
  similarity,
  strength,
}: {
  maxBoost: number;
  minSimilarity: number;
  similarity: number;
  strength: number;
}) => {
  const similarityLift =
    ((Math.min(Math.max(similarity, minSimilarity), 1) - minSimilarity) /
      (1 - minSimilarity)) *
    maxBoost;

  return Math.round(similarityLift + strength * 2);
};

export const selectSemanticSimilarityNewsFeed = <
  TItem extends RecommendableNewsItem & NewsIdentity,
>(
  rankedItems: readonly RankedNewsItem<TItem>[],
  semanticMatches: readonly NewsSemanticSimilarityMatch[],
  {
    maxBoost = 18,
    minSimilarity = defaultSemanticSimilarityThreshold,
  }: { maxBoost?: number; minSimilarity?: number } = {},
): RankedNewsItem<TItem>[] => {
  if (semanticMatches.length === 0) return [...rankedItems];

  const semanticMatchById = new Map<string, NewsSemanticSimilarityMatch>();

  for (const match of semanticMatches) {
    const currentMatch = semanticMatchById.get(match.newsItemId);

    if (
      !currentMatch ||
      getSemanticMatchRank(match) > getSemanticMatchRank(currentMatch)
    ) {
      semanticMatchById.set(match.newsItemId, match);
    }
  }

  return rankedItems
    .map((item, index) => {
      const match = semanticMatchById.get(item.id);

      if (!match || match.similarity < minSimilarity) {
        return { index, item };
      }

      return {
        index,
        item: {
          ...addMatchedSignal(item, "semantic_feedback"),
          personalizedScore:
            item.personalizedScore +
            getSemanticSimilarityBoost({
              maxBoost,
              minSimilarity,
              similarity: match.similarity,
              strength: match.strength ?? 1,
            }),
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

const isCollaborativeLiftEligible = <TItem extends RecommendableNewsItem>(
  item: RankedNewsItem<TItem>,
  minSourceScore: number,
) =>
  item.sourceScore >= minSourceScore && !hasCollaborativeProtectedSignal(item);

const hasCollaborativeProtectedSignal = <TItem extends RecommendableNewsItem>(
  item: RankedNewsItem<TItem>,
) =>
  item.matchedSignals.some((signal) =>
    collaborativeProtectedSignals.has(signal),
  );

const hasCollaborativeFeedbackSignal = <TItem extends RecommendableNewsItem>(
  item: RankedNewsItem<TItem>,
) => item.matchedSignals.includes("collaborative_feedback");

export const selectCollaborativeSignalNewsFeed = <
  TItem extends RecommendableNewsItem & NewsIdentity,
>(
  rankedItems: readonly RankedNewsItem<TItem>[],
  collaborativeSignals: readonly NewsCollaborativeSignal[],
  {
    maxBoost = 12,
    minScore = 2,
    minSourceScore = 70,
  }: { maxBoost?: number; minScore?: number; minSourceScore?: number } = {},
): RankedNewsItem<TItem>[] => {
  if (collaborativeSignals.length === 0) return [...rankedItems];

  const collaborativeScoreById = new Map<string, number>();

  for (const signal of collaborativeSignals) {
    if (signal.score < minScore) continue;

    collaborativeScoreById.set(
      signal.newsItemId,
      Math.max(
        signal.score,
        collaborativeScoreById.get(signal.newsItemId) ?? 0,
      ),
    );
  }

  if (collaborativeScoreById.size === 0) return [...rankedItems];

  return rankedItems
    .map((item, index) => {
      const collaborativeScore = collaborativeScoreById.get(item.id);

      if (
        collaborativeScore === undefined ||
        !isCollaborativeLiftEligible(item, minSourceScore)
      ) {
        return { index, item };
      }

      return {
        index,
        item: {
          ...addMatchedSignal(item, "collaborative_feedback"),
          personalizedScore:
            item.personalizedScore +
            Math.min(maxBoost, Math.round(collaborativeScore * 2)),
        },
      };
    })
    .sort((left, right) => {
      const leftCollaborative = hasCollaborativeFeedbackSignal(left.item);
      const rightCollaborative = hasCollaborativeFeedbackSignal(right.item);

      if (leftCollaborative !== rightCollaborative) {
        const leftProtected = hasCollaborativeProtectedSignal(left.item);
        const rightProtected = hasCollaborativeProtectedSignal(right.item);

        if (leftProtected !== rightProtected) {
          return leftProtected ? -1 : 1;
        }
      }

      return right.item.personalizedScore === left.item.personalizedScore
        ? left.index - right.index
        : right.item.personalizedScore - left.item.personalizedScore;
    })
    .map(({ item }) => item);
};

export const selectExposureBalancedNewsFeed = <
  TItem extends RecommendableNewsItem,
>(
  rankedItems: readonly RankedNewsItem<TItem>[],
  recentExposureItems: readonly RecentExposureNewsItem[],
  now = new Date(),
): RankedNewsItem<TItem>[] => {
  if (recentExposureItems.length === 0) return [...rankedItems];

  const activeExposureItems = recentExposureItems.filter((item) =>
    isActiveRecentExposure(item, now),
  );

  if (activeExposureItems.length === 0) return [...rankedItems];

  const homeExposureItems = activeExposureItems.filter(isHomeRecentExposure);
  const contentExposureItems = activeExposureItems.filter(
    isContentRecentExposure,
  );
  const contentExposureSignals =
    contentExposureItems.length > 0
      ? getNewsSignalSets(contentExposureItems)
      : null;
  const freshItems: RankedNewsItem<TItem>[] = [];
  const cooledItems: RankedNewsItem<TItem>[] = [];

  for (const item of rankedItems) {
    const cooldownMatch = getExposureCooldownMatch(
      item,
      contentExposureSignals,
      homeExposureItems,
    );

    if (cooldownMatch) {
      if (cooldownMatch === "content" && hasDeepPreferenceMatch(item)) {
        freshItems.push(addMatchedSignal(item, "deep_preference"));
      } else {
        cooledItems.push(
          addMatchedSignal(
            item,
            cooldownMatch === "exact"
              ? "home_exposure_cooldown"
              : "exposure_cooldown",
          ),
        );
      }
    } else {
      freshItems.push(item);
    }
  }

  if (freshItems.length === 0) {
    return [...rankedItems];
  }

  if (cooledItems.length === 0) return freshItems;

  return [...freshItems, ...cooledItems];
};

export const selectPositiveFeedbackAnchoredNewsFeed = <
  TItem extends RecommendableNewsItem,
>(
  rankedItems: readonly RankedNewsItem<TItem>[],
  positiveFeedbackItems: readonly PositiveFeedbackNewsItem[],
  now = new Date(),
): RankedNewsItem<TItem>[] => {
  if (positiveFeedbackItems.length === 0) return [...rankedItems];

  const anchoredItems: PositiveFeedbackAnchor<TItem>[] = [];
  const otherItems: RankedNewsItem<TItem>[] = [];

  rankedItems.forEach((item, rank) => {
    const match = getPositiveFeedbackMatch(item, positiveFeedbackItems, now);

    if (match.strength > 0) {
      anchoredItems.push({
        item: addMatchedSignal(item, "positive_feedback"),
        rank,
        strength: match.strength,
        timestamp: match.timestamp,
      });
    } else {
      otherItems.push(item);
    }
  });

  if (anchoredItems.length === 0) return [...rankedItems];

  const sortedAnchoredItems = anchoredItems.sort((firstItem, secondItem) =>
    firstItem.strength === secondItem.strength
      ? firstItem.timestamp === secondItem.timestamp
        ? firstItem.rank - secondItem.rank
        : secondItem.timestamp - firstItem.timestamp
      : secondItem.strength - firstItem.strength,
  );

  return [
    ...diversifyPositiveFeedbackAnchors(sortedAnchoredItems).map(
      ({ item }) => item,
    ),
    ...otherItems,
  ];
};

export const selectNegativeFeedbackAdjustedNewsFeed = <
  TItem extends RecommendableNewsItem,
>(
  rankedItems: readonly RankedNewsItem<TItem>[],
  negativeFeedbackItems: readonly NegativeFeedbackNewsItem[],
  now = new Date(),
): RankedNewsItem<TItem>[] => {
  if (negativeFeedbackItems.length === 0) return [...rankedItems];

  const activeNegativeFeedbackItems = negativeFeedbackItems.filter((item) => {
    if (!item.occurredAt) return true;

    return hoursSince(item.occurredAt, now) <= 30 * 24;
  });

  if (activeNegativeFeedbackItems.length === 0) return [...rankedItems];

  const feedbackSources = normalizeSet(
    activeNegativeFeedbackItems.map((item) => item.sourceSlug),
  );
  const feedbackCategories = normalizeSet(
    activeNegativeFeedbackItems.map((item) => item.category),
  );
  const feedbackEntities = normalizeSet(
    activeNegativeFeedbackItems.flatMap((item) => item.entities),
  );
  const feedbackTags = normalizeSet(
    activeNegativeFeedbackItems.flatMap((item) => item.tags ?? []),
  );
  const openItems: RankedNewsItem<TItem>[] = [];
  const suppressedItems: RankedNewsItem<TItem>[] = [];

  for (const item of rankedItems) {
    const hasNegativeSignal =
      feedbackSources.has(item.sourceSlug.toLowerCase()) ||
      feedbackCategories.has(item.category.toLowerCase()) ||
      item.entities.some((entity) =>
        feedbackEntities.has(entity.toLowerCase()),
      ) ||
      item.tags.some((tag) => feedbackTags.has(tag.trim().toLowerCase()));

    if (hasNegativeSignal) {
      suppressedItems.push(addMatchedSignal(item, "negative_feedback"));
    } else {
      openItems.push(item);
    }
  }

  return [...openItems, ...suppressedItems];
};

const isBreakingNewsItem = (
  item: RankedNewsItem<RecommendableNewsItem>,
  now: Date,
) =>
  item.sourceScore >= 85 &&
  item.trendScore >= 90 &&
  hoursSince(item.publishedAt, now) <= 6 &&
  !item.matchedSignals.includes("negative_feedback") &&
  !item.matchedSignals.includes("exposure_cooldown") &&
  !item.matchedSignals.includes("home_exposure_cooldown");

export const selectBreakingNewsPriorityFeed = <
  TItem extends RecommendableNewsItem,
>(
  rankedItems: readonly RankedNewsItem<TItem>[],
  now = new Date(),
): RankedNewsItem<TItem>[] => {
  const breakingItems: RankedNewsItem<TItem>[] = [];
  const otherItems: RankedNewsItem<TItem>[] = [];

  for (const item of rankedItems) {
    if (isBreakingNewsItem(item, now)) {
      breakingItems.push(addMatchedSignal(item, "breaking_news"));
    } else {
      otherItems.push(item);
    }
  }

  if (breakingItems.length === 0) return [...rankedItems];

  return [...breakingItems, ...otherItems];
};

const needsSourceTrustReview = (item: RecommendableNewsItem) =>
  item.sourceScore < 60 && item.trendScore >= 85;

export const selectSourceTrustBalancedNewsFeed = <
  TItem extends RecommendableNewsItem,
>(
  rankedItems: readonly RankedNewsItem<TItem>[],
): RankedNewsItem<TItem>[] => {
  const openItems: RankedNewsItem<TItem>[] = [];
  const reviewItems: RankedNewsItem<TItem>[] = [];

  for (const item of rankedItems) {
    if (needsSourceTrustReview(item)) {
      reviewItems.push(item);
    } else {
      openItems.push(item);
    }
  }

  if (openItems.length === 0 || reviewItems.length === 0) {
    return [...rankedItems];
  }

  return [...openItems, ...reviewItems];
};

export const updateReaderProfileWithInteraction = <
  TItem extends RecommendableNewsItem,
>(
  profile: NewsPreferenceProfile,
  item: TItem,
  interaction: ReaderInteraction,
): NewsPreferenceProfile => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  if (!shouldTrainReaderProfileFromInteraction(interaction)) {
    return normalizedProfile;
  }

  if (interaction.action === "hide") {
    const hiddenCategory = item.category.trim().toLowerCase();
    const hiddenSource = item.sourceSlug.trim().toLowerCase();
    const hiddenEntities = normalizeSet([...item.entities, ...item.tags]);

    return {
      ...normalizedProfile,
      preferredCategories: normalizedProfile.preferredCategories.filter(
        (category) => category.trim().toLowerCase() !== hiddenCategory,
      ),
      preferredSources: normalizedProfile.preferredSources.filter(
        (source) => source.trim().toLowerCase() !== hiddenSource,
      ),
      preferredEntities: normalizedProfile.preferredEntities.filter(
        (entity) => !hiddenEntities.has(entity.trim().toLowerCase()),
      ),
      noveltyBias: clampBias(normalizedProfile.noveltyBias - 0.2),
      recencyBias: clampBias(normalizedProfile.recencyBias - 0.2),
    };
  }

  const actionWeight = getInteractionWeight(interaction);
  const shouldOnlyLearnSource = interaction.action === "click_source";
  const entityLimit = interaction.action === "view" ? 8 : 12;
  const shouldLearnEntities =
    !shouldOnlyLearnSource &&
    (interaction.action !== "view" ||
      Math.min(Math.max(interaction.readPercent ?? 0.35, 0), 1) >= 0.75);

  return {
    preferredCategories: uniqueAppend(
      normalizedProfile.preferredCategories,
      shouldOnlyLearnSource ? [] : [item.category],
      8,
    ),
    preferredSources: uniqueAppend(
      normalizedProfile.preferredSources,
      interaction.action === "view" ? [] : [item.sourceSlug],
      8,
    ),
    preferredEntities: uniqueAppend(
      normalizedProfile.preferredEntities,
      shouldLearnEntities ? [...item.entities, ...item.tags] : [],
      entityLimit,
    ),
    noveltyBias: clampBias(normalizedProfile.noveltyBias + actionWeight),
    recencyBias: clampBias(normalizedProfile.recencyBias + actionWeight),
  };
};
