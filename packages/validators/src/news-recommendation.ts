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

export type ReaderInteractionAction =
  | "view"
  | "click_source"
  | "save"
  | "share"
  | "hide";

export interface ReaderInteraction {
  action: ReaderInteractionAction;
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

      const noveltyBoost = noveltyBias * Math.min(item.tags.length * 2, 10);
      const recencyBoost =
        recencyBias * Math.max(16 - hoursSince(item.publishedAt, now) / 3, 0);

      return {
        ...item,
        matchedSignals,
        personalizedScore: Math.round(
          item.trendScore +
            item.sourceScore / 10 +
            preferenceBoost +
            noveltyBoost +
            recencyBoost,
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

export type DedupeNewsItem = NewsIdentity & {
  canonicalUrl?: string | null;
  category: string;
  publishedAt: string;
  sourceScore: number;
  title: string;
  trendScore: number;
};

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

const getNewsDedupeKey = (item: DedupeNewsItem) => {
  const canonicalUrl = normalizeNewsDedupeUrl(item.canonicalUrl);
  if (canonicalUrl) return `url:${canonicalUrl}`;

  return `title:${item.category.trim().toLowerCase()}:${normalizeNewsDedupeTitle(
    item.title,
  )}`;
};

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
  const dedupedByKey = new Map<string, { index: number; item: TItem }>();

  for (const item of items) {
    const key = getNewsDedupeKey(item);
    const existing = dedupedByKey.get(key);

    if (!existing || compareNewsDedupeStrength(item, existing.item) > 0) {
      dedupedByKey.set(key, {
        index: existing?.index ?? dedupedByKey.size,
        item,
      });
    }
  }

  return Array.from(dedupedByKey.values())
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.item);
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

export const updateReaderProfileWithInteraction = <
  TItem extends RecommendableNewsItem,
>(
  profile: NewsPreferenceProfile,
  item: TItem,
  interaction: ReaderInteraction,
): NewsPreferenceProfile => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  if (interaction.action === "hide") {
    return {
      ...normalizedProfile,
      preferredCategories: normalizedProfile.preferredCategories.filter(
        (category) => category !== item.category,
      ),
      preferredSources: normalizedProfile.preferredSources.filter(
        (source) => source !== item.sourceSlug,
      ),
      preferredEntities: normalizedProfile.preferredEntities.filter(
        (entity) => !item.entities.includes(entity),
      ),
      noveltyBias: clampBias(normalizedProfile.noveltyBias - 0.2),
      recencyBias: clampBias(normalizedProfile.recencyBias - 0.2),
    };
  }

  const actionWeight = interactionWeights[interaction.action];
  const entityLimit = interaction.action === "view" ? 8 : 12;

  return {
    preferredCategories: uniqueAppend(
      normalizedProfile.preferredCategories,
      [item.category],
      8,
    ),
    preferredSources: uniqueAppend(
      normalizedProfile.preferredSources,
      interaction.action === "view" ? [] : [item.sourceSlug],
      8,
    ),
    preferredEntities: uniqueAppend(
      normalizedProfile.preferredEntities,
      item.entities,
      entityLimit,
    ),
    noveltyBias: clampBias(normalizedProfile.noveltyBias + actionWeight),
    recencyBias: clampBias(normalizedProfile.recencyBias + actionWeight),
  };
};
