import type {
  NewsPreferenceProfile,
  RankedNewsItem,
  RecommendableNewsItem,
} from "@acme/validators";
import { normalizeNewsPreferenceProfile } from "@acme/validators";

export interface NewsHomeItem extends RecommendableNewsItem {
  summary: string;
  canonicalUrl: string | null;
  imageUrl: string | null;
  sourceName: string;
  sourceType: string;
}

export type NewsHomeStatus = "ready" | "empty" | "unavailable";
export type NewsFeedMode = "for_you" | "latest" | "trending";

export type PersistedNewsPreferenceProfile = NewsPreferenceProfile & {
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
    ? [...serverRecommendedItems]
    : [...initialItems];

export const buildNewsHomeFeedInput = <TCategory extends string>({
  category,
  cursor,
  limit,
  q,
  sourceSlug,
  visitorKey,
}: {
  category: TCategory | null;
  cursor: string | null;
  limit: number;
  q: string;
  sourceSlug: string | null;
  visitorKey: string | null;
}) => {
  const query = q.trim();
  const input: {
    category?: TCategory;
    cursor?: string;
    limit: number;
    q?: string;
    sourceSlug?: string;
    visitorKey?: string;
  } = { limit };

  if (category) input.category = category;
  if (cursor) input.cursor = cursor;
  if (query) input.q = query;
  if (sourceSlug) input.sourceSlug = sourceSlug;
  if (visitorKey) input.visitorKey = visitorKey;

  return input;
};

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

type NewsReaderMemoryItem = Pick<
  NewsHomeItem,
  "category" | "entities" | "id" | "sourceName" | "sourceSlug" | "title"
>;

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

const formatPercentage = (count: number, totalCount: number) =>
  totalCount > 0 ? `${Math.round((count / totalCount) * 100)}%` : "0%";

export const getNewsRecommendationAudit = ({
  items,
  profile,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
  profile: NewsPreferenceProfile;
}) => {
  const editionMix = getNewsEditionMix({ items });
  const sourceBalance = getNewsSourceBalance({ items });
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
        label: "Reader signals",
        value: String(readerSignalSummary.signalCount),
      },
    ],
    notices,
    summary: `${totalCount} ${
      totalCount === 1 ? "story" : "stories"
    }: ${personalizedCount} personalized, ${explorationCount} exploratory, and ${trendLedCount} trend-led across ${
      sourceBalance.uniqueSourceCount
    } ${sourceLabel}.`,
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

const toReadingQueueStory = (item: RankedNewsItem<NewsHomeItem>) => ({
  id: item.id,
  personalizedScore: item.personalizedScore,
  sourceName: item.sourceName,
  title: item.title,
});

export const getNewsPersonalizedReadingQueue = ({
  items,
}: {
  items: readonly RankedNewsItem<NewsHomeItem>[];
}) => {
  if (items.length === 0) {
    return {
      slots: [],
      summary: "Queue will appear as stories load.",
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
  const [leadStory] = items;

  addSlot({
    intent: "Fast Brief",
    item: leadStory,
    label: "Start",
    reason: "Highest-ranked story in this edition.",
  });

  const deepDiveStory = [...items]
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
    })[0];
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

  const explorationStory = items.find(
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
      item: items.find((item) => !usedIds.has(item.id)),
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

export const selectVisibleNewsHomeItems = ({
  items,
  hiddenItemIds,
}: {
  items: readonly NewsHomeItem[];
  hiddenItemIds: readonly string[];
}) => {
  if (hiddenItemIds.length === 0) return [...items];

  const hiddenIds = new Set(hiddenItemIds);
  return items.filter((item) => !hiddenIds.has(item.id));
};

export const mergeNewsHomeItems = ({
  currentItems,
  nextItems,
}: {
  currentItems: readonly NewsHomeItem[];
  nextItems: readonly NewsHomeItem[];
}) => {
  const seenIds = new Set(currentItems.map((item) => item.id));
  const mergedItems = [...currentItems];

  for (const item of nextItems) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      mergedItems.push(item);
    }
  }

  return mergedItems;
};

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

const recommendationReasonLabels = {
  category: "Preferred topic",
  exploration: "Outside your usual mix",
  source: "Trusted source",
  entity: "Followed entity",
} as const;

type NewsRecommendationReason =
  (typeof recommendationReasonLabels)[keyof typeof recommendationReasonLabels];

export const getNewsRecommendationReasons = ({
  item,
}: {
  item: RankedNewsItem<NewsHomeItem>;
}) => {
  const reasons = item.matchedSignals
    .map(
      (signal) =>
        recommendationReasonLabels[
          signal as keyof typeof recommendationReasonLabels
        ],
    )
    .filter((reason): reason is NewsRecommendationReason => Boolean(reason));

  if (reasons.length > 0) return reasons;

  return ["Trending now", "Recently published"];
};

const isRecentlyPublished = (publishedAt: string, now: Date) => {
  const publishedTime = new Date(publishedAt).getTime();
  if (Number.isNaN(publishedTime)) return false;

  const ageHours = (now.getTime() - publishedTime) / 3_600_000;
  return ageHours >= 0 && ageHours <= 12;
};

const signalSummaryLabels = {
  category: "topic",
  entity: "entity",
  source: "source",
} as const;

const formatReadableList = (values: readonly string[]) => {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
};

const getRankSupportText = ({
  hasFreshness,
  hasHighHeat,
  hasStrongSource,
  heatLabel,
}: {
  hasFreshness: boolean;
  hasHighHeat: boolean;
  hasStrongSource: boolean;
  heatLabel: string;
}) => {
  const supports: string[] = [];

  if (hasHighHeat) supports.push(heatLabel);
  if (hasFreshness) supports.push("fresh publication timing");
  if (hasStrongSource) supports.push("source credibility");

  return formatReadableList(supports);
};

export const getNewsStoryRankDetails = ({
  item,
  mode = "for_you",
  now = new Date(),
}: {
  item: RankedNewsItem<NewsHomeItem>;
  mode?: NewsFeedMode;
  now?: Date;
}) => {
  const badges: string[] = [];
  const isExploration = item.matchedSignals.includes("exploration");
  const hasHighHeat = item.trendScore >= 70;
  const hasFreshness = isRecentlyPublished(item.publishedAt, now);
  const hasStrongSource = item.sourceScore >= 80;
  const hasSourceSignal = item.matchedSignals.includes("source");
  const hasPersonalSignals =
    item.matchedSignals.filter((signal) => signal !== "exploration").length > 0;
  const includeStrongSourceSupport = hasStrongSource && !hasSourceSignal;

  if (mode === "latest") {
    badges.push("Newest first");
    if (hasFreshness) badges.push("Fresh");

    const supportText = getRankSupportText({
      hasFreshness,
      hasHighHeat: false,
      hasStrongSource: false,
      heatLabel: "story heat",
    });

    return {
      badges: getUniqueSignals(badges, 5),
      scoreLabel: `${item.personalizedScore} score`,
      summary: supportText
        ? `Ranked by publication time, with ${supportText}.`
        : "Ranked by publication time.",
    };
  }

  if (mode === "trending") {
    badges.push("Trending now");
    if (hasHighHeat) badges.push("High heat");
    if (hasStrongSource) badges.push("Strong source");

    const supportText = getRankSupportText({
      hasFreshness: false,
      hasHighHeat,
      hasStrongSource,
      heatLabel: "high story heat",
    });

    return {
      badges: getUniqueSignals(badges, 5),
      scoreLabel: `${item.personalizedScore} score`,
      summary: supportText
        ? `Ranked by story heat, with ${supportText}.`
        : "Ranked by story heat.",
    };
  }

  if (isExploration) {
    badges.push("Outside your usual mix");
  } else if (hasPersonalSignals) {
    badges.push(...getNewsRecommendationReasons({ item }));
  } else {
    badges.push("Trending now");
  }

  if (hasHighHeat && hasPersonalSignals) badges.push("High heat");
  if (hasFreshness) badges.push("Fresh");
  if (includeStrongSourceSupport) {
    badges.push("Strong source");
  }

  const uniqueBadges = getUniqueSignals(badges, 5);
  const supportText = getRankSupportText({
    hasFreshness,
    hasHighHeat,
    hasStrongSource: includeStrongSourceSupport,
    heatLabel: hasPersonalSignals ? "high story heat" : "story heat",
  });

  if (isExploration) {
    return {
      badges: uniqueBadges,
      scoreLabel: `${item.personalizedScore} score`,
      summary: supportText
        ? `Inserted as an exploration story outside your usual mix, supported by ${supportText}.`
        : "Inserted as an exploration story outside your usual mix.",
    };
  }

  const signalLabels = item.matchedSignals
    .map(
      (signal) =>
        signalSummaryLabels[signal as keyof typeof signalSummaryLabels],
    )
    .filter(
      (
        label,
      ): label is (typeof signalSummaryLabels)[keyof typeof signalSummaryLabels] =>
        Boolean(label),
    );

  if (signalLabels.length > 0) {
    const signalText = formatReadableList(signalLabels);

    return {
      badges: uniqueBadges,
      scoreLabel: `${item.personalizedScore} score`,
      summary: supportText
        ? `Ranked for your ${signalText} signals, with ${supportText}.`
        : `Ranked for your ${signalText} signals.`,
    };
  }

  return {
    badges: uniqueBadges,
    scoreLabel: `${item.personalizedScore} score`,
    summary: supportText
      ? `Ranked by edition-wide ${supportText}.`
      : "Ranked by edition-wide story momentum.",
  };
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
