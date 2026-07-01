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

const normalizeSet = (values: readonly string[]) =>
  new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));

const clampBias = (value: number) => Math.min(Math.max(value, 0), 2);

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
