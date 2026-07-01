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

export const rankNewsForReader = <TItem extends RecommendableNewsItem>(
  items: readonly TItem[],
  preferences: NewsPreferenceProfile,
  now = new Date(),
): RankedNewsItem<TItem>[] => {
  const preferredCategories = normalizeSet(preferences.preferredCategories);
  const preferredSources = normalizeSet(preferences.preferredSources);
  const preferredEntities = normalizeSet(preferences.preferredEntities);
  const noveltyBias = clampBias(preferences.noveltyBias);
  const recencyBias = clampBias(preferences.recencyBias);

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

export const selectDiverseNewsFeed = <TItem extends RecommendableNewsItem>(
  rankedItems: readonly RankedNewsItem<TItem>[],
  { limit }: { limit: number },
): RankedNewsItem<TItem>[] => {
  const selected: RankedNewsItem<TItem>[] = [];
  const remaining = [...rankedItems];
  const usedSources = new Set<string>();
  const usedCategories = new Set<string>();

  while (selected.length < limit && remaining.length > 0) {
    let nextIndex = remaining.findIndex(
      (item) =>
        !usedSources.has(item.sourceSlug) && !usedCategories.has(item.category),
    );

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

    selected.push(nextItem);
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
  if (interaction.action === "hide") {
    return {
      ...profile,
      preferredCategories: profile.preferredCategories.filter(
        (category) => category !== item.category,
      ),
      preferredSources: profile.preferredSources.filter(
        (source) => source !== item.sourceSlug,
      ),
      preferredEntities: profile.preferredEntities.filter(
        (entity) => !item.entities.includes(entity),
      ),
    };
  }

  const actionWeight = interaction.action === "view" ? 0.15 : 0.3;
  const entityLimit = interaction.action === "view" ? 8 : 12;

  return {
    preferredCategories: uniqueAppend(
      profile.preferredCategories,
      [item.category],
      8,
    ),
    preferredSources: uniqueAppend(
      profile.preferredSources,
      interaction.action === "view" ? [] : [item.sourceSlug],
      8,
    ),
    preferredEntities: uniqueAppend(
      profile.preferredEntities,
      item.entities,
      entityLimit,
    ),
    noveltyBias: clampBias(profile.noveltyBias + actionWeight),
    recencyBias: clampBias(profile.recencyBias + actionWeight),
  };
};
