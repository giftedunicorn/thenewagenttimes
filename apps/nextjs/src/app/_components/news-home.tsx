"use client";

import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  NewsPreferenceProfile,
  RankedNewsItem,
  ReaderInteractionAction,
} from "@acme/validators";
import { cn } from "@acme/ui";
import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import {
  dedupeNewsItems,
  getNewsExplorationInterval,
  normalizeNewsPreferenceProfile,
  rankNewsForReader,
  selectDiverseNewsFeed,
  updateReaderProfileWithInteraction,
} from "@acme/validators";

import type {
  NewsDeskStatus,
  NewsFeedMode,
  NewsHomeItem,
  NewsHomeStatus,
} from "./news-home-model";
import { useTRPC } from "~/trpc/react";
import {
  buildNewsHomeFeedInput,
  createDefaultNewsPreferenceProfile,
  getNewsDeskStatusSummary,
  getNewsEditionBriefing,
  getNewsEditionMix,
  getNewsEntityRadar,
  getNewsPersonalizedReadingQueue,
  getNewsReaderMemory,
  getNewsReaderRankingFactors,
  getNewsReaderSignalSummary,
  getNewsRecommendationAudit,
  getNewsSectionFronts,
  getNewsSourceBalance,
  getNewsStoryRankDetails,
  getNewsTopicPulse,
  getNextNewsHomeCursor,
  mergeNewsHomeItems,
  selectHydratedNewsPreferenceProfile,
  selectNewsFeedModeItems,
  selectNewsHomeItems,
  selectVisibleNewsHomeItems,
  shouldAutoLoadMoreNewsHomeItems,
  shouldFetchServerRecommendations,
  stripPersistedNewsPreferenceProfile,
} from "./news-home-model";

type RankedNewsHomeItem = RankedNewsItem<NewsHomeItem>;

interface NewsHomeProps {
  initialItems: NewsHomeItem[];
  deskStatus: NewsDeskStatus;
  status: NewsHomeStatus;
  generatedAt: string;
}

const categoryLabels = {
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
} as const;

type NewsCategoryKey = keyof typeof categoryLabels;

const isNewsCategoryKey = (category: string): category is NewsCategoryKey =>
  category in categoryLabels;

const feedModeOptions = [
  {
    detail: "Reader-ranked",
    label: "For You",
    mode: "for_you",
  },
  {
    detail: "Newest first",
    label: "Latest",
    mode: "latest",
  },
  {
    detail: "Heat-ranked",
    label: "Trending",
    mode: "trending",
  },
] as const satisfies readonly {
  detail: string;
  label: string;
  mode: NewsFeedMode;
}[];

const getCategoryLabel = (category: string) =>
  isNewsCategoryKey(category) ? categoryLabels[category] : category;

const profileStorageKey = "new-ai-times-profile";
const visitorStorageKey = "new-ai-times-visitor-key";

const previewItems: NewsHomeItem[] = [
  {
    id: "preview-desk",
    title: "The live AI desk is ready for its first crawl",
    summary:
      "The ingestion layer, source registry, ranking API, and Railway web service are connected. The first collected stories will take over this slot automatically.",
    category: "agent_product",
    tags: ["desk", "pipeline", "recommendations"],
    entities: ["The New AI Times"],
    sourceSlug: "new-ai-times-desk",
    sourceName: "Editor's Desk",
    sourceType: "manual",
    sourceScore: 90,
    trendScore: 64,
    publishedAt: "2026-07-01T08:00:00.000Z",
    canonicalUrl: null,
    imageUrl: null,
  },
  {
    id: "preview-sources",
    title: "Source registry covers labs, model blogs, YC AI, OSS, and launches",
    summary:
      "OpenAI, Anthropic, Google AI, DeepMind, Meta AI, Microsoft AI, NVIDIA, Hugging Face, LangChain, Product Hunt, Hacker News, and YC are modeled as source classes.",
    category: "market_map",
    tags: ["sources", "labs", "launches"],
    entities: ["OpenAI", "Anthropic", "YC"],
    sourceSlug: "new-ai-times-desk",
    sourceName: "Source Desk",
    sourceType: "manual",
    sourceScore: 86,
    trendScore: 58,
    publishedAt: "2026-07-01T07:30:00.000Z",
    canonicalUrl: null,
    imageUrl: null,
  },
  {
    id: "preview-recommendations",
    title: "Reader intent now changes the order of the front page",
    summary:
      "Topic, source, and entity preferences rerank stories while trend and freshness keep the edition from becoming a filter bubble.",
    category: "new_concept",
    tags: ["personalization", "ranking", "signals"],
    entities: ["Recommendation Engine"],
    sourceSlug: "new-ai-times-desk",
    sourceName: "Recommendation Desk",
    sourceType: "manual",
    sourceScore: 82,
    trendScore: 61,
    publishedAt: "2026-07-01T07:00:00.000Z",
    canonicalUrl: null,
    imageUrl: null,
  },
];

const readStoredProfile = (): NewsPreferenceProfile => {
  const defaultProfile = createDefaultNewsPreferenceProfile();

  if (typeof window === "undefined") return defaultProfile;

  const stored = window.localStorage.getItem(profileStorageKey);
  if (!stored) return defaultProfile;

  try {
    const parsed = JSON.parse(stored) as Partial<NewsPreferenceProfile>;
    return normalizeNewsPreferenceProfile({
      preferredCategories: Array.isArray(parsed.preferredCategories)
        ? parsed.preferredCategories.filter(
            (value): value is string => typeof value === "string",
          )
        : defaultProfile.preferredCategories,
      preferredSources: Array.isArray(parsed.preferredSources)
        ? parsed.preferredSources.filter(
            (value): value is string => typeof value === "string",
          )
        : defaultProfile.preferredSources,
      preferredEntities: Array.isArray(parsed.preferredEntities)
        ? parsed.preferredEntities.filter(
            (value): value is string => typeof value === "string",
          )
        : defaultProfile.preferredEntities,
      noveltyBias:
        typeof parsed.noveltyBias === "number"
          ? parsed.noveltyBias
          : defaultProfile.noveltyBias,
      recencyBias:
        typeof parsed.recencyBias === "number"
          ? parsed.recencyBias
          : defaultProfile.recencyBias,
    });
  } catch {
    return defaultProfile;
  }
};

const writeStoredProfile = (profile: NewsPreferenceProfile) => {
  window.localStorage.setItem(
    profileStorageKey,
    JSON.stringify(normalizeNewsPreferenceProfile(profile)),
  );
};

const readOrCreateVisitorKey = () => {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(visitorStorageKey);
  if (stored) return stored;

  const next =
    typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(visitorStorageKey, next);
  return next;
};

const toServerProfile = (profile: NewsPreferenceProfile) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  return {
    preferredCategories: normalizedProfile.preferredCategories
      .filter(isNewsCategoryKey)
      .slice(0, 12),
    preferredSources: normalizedProfile.preferredSources.slice(0, 12),
    preferredEntities: normalizedProfile.preferredEntities.slice(0, 24),
    noveltyBias: normalizedProfile.noveltyBias,
    recencyBias: normalizedProfile.recencyBias,
  };
};

const formatEditionDate = (date: string) =>
  new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));

const formatTime = (date: string) =>
  new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));

const numberFormatter = new Intl.NumberFormat("en");

const formatCount = (value: number) => numberFormatter.format(value);

const formatOptionalTime = (date: string | null) =>
  date ? formatTime(date) : "None yet";

const formatLastRun = (run: NewsDeskStatus["latestRun"]) => {
  if (!run) return "No run yet";

  return `${run.sourceName ?? run.runType} ${run.status}`;
};

const formatRunYield = (run: NewsDeskStatus["latestRun"]) => {
  if (!run) return "No items yet";

  return `${formatCount(run.itemsCreated)} new, ${formatCount(run.itemsUpdated)} updated`;
};

const toggleValue = (values: readonly string[], value: string) =>
  values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];

const getUniqueValues = (items: readonly NewsHomeItem[], key: "sourceSlug") =>
  Array.from(new Set(items.map((item) => item[key]))).slice(0, 8);

const getTopEntities = (items: readonly NewsHomeItem[]) =>
  Array.from(new Set(items.flatMap((item) => item.entities))).slice(0, 10);

export function NewsHome({
  initialItems,
  deskStatus,
  status,
  generatedAt,
}: NewsHomeProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [profile, setProfile] =
    useState<NewsPreferenceProfile>(readStoredProfile);
  const [visitorKey] = useState<string | null>(readOrCreateVisitorKey);
  const [hiddenItemIds, setHiddenItemIds] = useState<string[]>([]);
  const [loadedItems, setLoadedItems] = useState<NewsHomeItem[]>([]);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [feedMode, setFeedMode] = useState<NewsFeedMode>("for_you");
  const [activeCategory, setActiveCategory] = useState<NewsCategoryKey | null>(
    null,
  );
  const [activeSourceSlug, setActiveSourceSlug] = useState<string | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const isLoadingMoreRef = useRef(false);
  const fallbackItems = initialItems.length > 0 ? initialItems : previewItems;
  const canPersistProfile = status !== "unavailable";
  const hasExploreFilters = Boolean(
    activeCategory ?? activeSourceSlug ?? searchQuery.trim(),
  );
  const profileQuery = useQuery(
    trpc.news.profile.queryOptions(
      { visitorKey: visitorKey ?? undefined },
      { enabled: canPersistProfile && Boolean(visitorKey) },
    ),
  );
  const savedQuery = useQuery(
    trpc.news.saved.queryOptions(
      { limit: 6, visitorKey: visitorKey ?? undefined },
      { enabled: canPersistProfile && Boolean(visitorKey) },
    ),
  );
  const historyQuery = useQuery(
    trpc.news.history.queryOptions(
      { limit: 6, visitorKey: visitorKey ?? undefined },
      { enabled: canPersistProfile && Boolean(visitorKey) },
    ),
  );
  const forYouQuery = useQuery(
    trpc.news.forYou.queryOptions(
      buildNewsHomeFeedInput({
        category: activeCategory,
        cursor: null,
        limit: 30,
        q: searchQuery,
        sourceSlug: activeSourceSlug,
        visitorKey,
      }),
      {
        enabled: shouldFetchServerRecommendations({ status, visitorKey }),
      },
    ),
  );
  const updateProfile = useMutation(
    trpc.news.updateProfile.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
          queryClient.invalidateQueries(trpc.news.profile.pathFilter()),
        ]);
      },
    }),
  );
  const recordInteraction = useMutation(
    trpc.news.recordInteraction.mutationOptions({
      onSuccess: async (serverProfile) => {
        const nextProfile = stripPersistedNewsPreferenceProfile(serverProfile);
        setProfile(nextProfile);
        writeStoredProfile(nextProfile);
        await Promise.all([
          queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
          queryClient.invalidateQueries(trpc.news.profile.pathFilter()),
          queryClient.invalidateQueries(trpc.news.saved.pathFilter()),
          queryClient.invalidateQueries(trpc.news.history.pathFilter()),
        ]);
      },
    }),
  );
  const serverRecommendedItems = forYouQuery.data;
  const initialFeedItems = hasExploreFilters ? [] : fallbackItems;
  const baseItems = selectNewsHomeItems({
    initialItems: initialFeedItems,
    serverRecommendedItems,
  });
  const items = selectVisibleNewsHomeItems({
    hiddenItemIds,
    items: mergeNewsHomeItems({
      currentItems: baseItems,
      nextItems: loadedItems,
    }),
  });
  const isPreview =
    !hasExploreFilters &&
    initialItems.length === 0 &&
    !serverRecommendedItems?.length;
  const nextCursor = getNextNewsHomeCursor(items);
  const deskStatusSummary = getNewsDeskStatusSummary(deskStatus);

  useEffect(() => {
    writeStoredProfile(profile);
  }, [profile]);

  useEffect(() => {
    if (!profileQuery.data?.persisted) return;

    setProfile((current) => {
      const nextProfile = selectHydratedNewsPreferenceProfile({
        localProfile: current,
        serverProfile: profileQuery.data,
      });
      writeStoredProfile(nextProfile);
      return nextProfile;
    });
  }, [profileQuery.data]);

  useEffect(() => {
    setLoadedItems([]);
    setHasMoreItems(true);
  }, [activeCategory, activeSourceSlug, searchQuery]);

  const commitProfile = (
    createNextProfile: (
      current: NewsPreferenceProfile,
    ) => NewsPreferenceProfile,
  ) => {
    setProfile((current) => {
      const nextProfile = createNextProfile(current);

      if (visitorKey && canPersistProfile) {
        updateProfile.mutate({
          visitorKey,
          profile: toServerProfile(nextProfile),
        });
      }

      return nextProfile;
    });
  };

  const recordStoryAction = (
    item: NewsHomeItem,
    action: ReaderInteractionAction,
  ) => {
    setProfile((current) => {
      const nextProfile = updateReaderProfileWithInteraction(current, item, {
        action,
      });
      writeStoredProfile(nextProfile);
      return nextProfile;
    });

    if (action === "hide") {
      setHiddenItemIds((current) =>
        current.includes(item.id) ? current : [...current, item.id],
      );
    }

    if (visitorKey && canPersistProfile && !isPreview) {
      recordInteraction.mutate({
        visitorKey,
        newsItemId: item.id,
        action,
        metadata: { surface: "home" },
      });
    }
  };

  const applyExploreSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchQuery(searchDraft.trim());
  };

  const clearExploreFilters = () => {
    setActiveCategory(null);
    setActiveSourceSlug(null);
    setSearchDraft("");
    setSearchQuery("");
  };

  const resetProfile = () => {
    commitProfile(() => createDefaultNewsPreferenceProfile());
    setHiddenItemIds([]);
  };

  const loadMoreStories = useCallback(async () => {
    const cursor = nextCursor;

    if (!cursor || !visitorKey) return;

    if (
      !shouldAutoLoadMoreNewsHomeItems({
        cursor,
        hasMoreItems,
        isFeedEndVisible: true,
        isLoadingMore: isLoadingMoreRef.current,
        isPreview,
        visitorKey,
      })
    ) {
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const nextItems = await queryClient.fetchQuery(
        trpc.news.forYou.queryOptions(
          buildNewsHomeFeedInput({
            category: activeCategory,
            cursor,
            limit: 20,
            q: searchQuery,
            sourceSlug: activeSourceSlug,
            visitorKey,
          }),
        ),
      );

      setLoadedItems((current) =>
        mergeNewsHomeItems({
          currentItems: current,
          nextItems,
        }),
      );
      setHasMoreItems(nextItems.length > 0);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [
    activeCategory,
    activeSourceSlug,
    hasMoreItems,
    isPreview,
    nextCursor,
    queryClient,
    searchQuery,
    trpc.news.forYou,
    visitorKey,
  ]);

  useEffect(() => {
    const feedEnd = feedEndRef.current;
    if (
      !feedEnd ||
      isPreview ||
      typeof window === "undefined" ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          shouldAutoLoadMoreNewsHomeItems({
            cursor: nextCursor,
            hasMoreItems,
            isFeedEndVisible: Boolean(entry?.isIntersecting),
            isLoadingMore: isLoadingMoreRef.current,
            isPreview,
            visitorKey,
          })
        ) {
          void loadMoreStories();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(feedEnd);

    return () => observer.disconnect();
  }, [hasMoreItems, isPreview, loadMoreStories, nextCursor, visitorKey]);

  const personalizedItems = useMemo(
    () =>
      selectDiverseNewsFeed(
        rankNewsForReader(dedupeNewsItems(items), profile),
        {
          explorationInterval: getNewsExplorationInterval(profile),
          limit: items.length,
        },
      ),
    [items, profile],
  );
  const rankedItems = useMemo(
    () => selectNewsFeedModeItems({ items: personalizedItems, mode: feedMode }),
    [feedMode, personalizedItems],
  );
  const leadStory = rankedItems[0];
  const secondaryStories = rankedItems.slice(1, 4);
  const streamStories = rankedItems.slice(4);
  const defaultCategories = Object.keys(categoryLabels) as NewsCategoryKey[];
  const availableCategories = Array.from(
    new Set([
      ...defaultCategories.slice(0, 9),
      ...items.map((item) => item.category).filter(isNewsCategoryKey),
    ]),
  );
  const availableSources = getUniqueValues(items, "sourceSlug");
  const sourceFilterOptions = Array.from(
    new Set([...fallbackItems, ...items].map((item) => item.sourceSlug)),
  ).slice(0, 8);
  const availableEntities = getTopEntities(items);
  const savedItems = savedQuery.data ?? [];
  const historyItems = historyQuery.data ?? [];
  const readerMemory = getNewsReaderMemory({
    formatCategory: getCategoryLabel,
    historyItems,
    profile,
    savedItems,
  });
  const readerSignalSummary = getNewsReaderSignalSummary(profile);
  const readerRankingFactors = getNewsReaderRankingFactors(profile);
  const rankDetailsAt = useMemo(() => new Date(generatedAt), [generatedAt]);
  const editionBriefing = getNewsEditionBriefing({
    entityLimit: 3,
    formatCategory: getCategoryLabel,
    items: rankedItems,
    topicLimit: 3,
  });
  const recommendationAudit = getNewsRecommendationAudit({
    items: rankedItems,
    profile,
  });
  const readingQueue = getNewsPersonalizedReadingQueue({ items: rankedItems });
  const editionMix = getNewsEditionMix({ items: rankedItems });
  const sourceBalance = getNewsSourceBalance({ items: rankedItems });
  const entityRadar = getNewsEntityRadar({ items: rankedItems, limit: 5 });
  const topicPulse = getNewsTopicPulse({ items: rankedItems, limit: 4 });
  const sectionFronts = getNewsSectionFronts({
    formatCategory: getCategoryLabel,
    items: rankedItems,
    limit: 4,
    storiesPerSection: 3,
  });

  return (
    <main className="min-h-[100dvh] bg-[#f7f5ef] text-[#161616] transition-colors dark:bg-[#101010] dark:text-[#f4f1ea]">
      <header className="border-b border-[#161616] dark:border-[#f4f1ea]">
        <div className="container flex flex-col gap-4 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] uppercase">
              AI intelligence edition
            </p>
            <h1 className="mt-2 text-4xl leading-none font-black tracking-normal sm:text-6xl lg:text-7xl">
              The New AI Times
            </h1>
          </div>
          <div className="max-w-xl text-sm leading-6 text-[#4a4a4a] dark:text-[#c8c4ba]">
            <p>{formatEditionDate(generatedAt)}</p>
            <p>
              A ranked front page for agent products, frontier models, funding,
              research, and the companies shaping the next software cycle.
            </p>
          </div>
        </div>
        <nav className="container flex gap-2 overflow-x-auto border-t border-[#161616]/25 py-3 text-sm dark:border-[#f4f1ea]/25">
          {availableCategories.slice(0, 10).map((category) => (
            <Button
              key={category}
              type="button"
              variant={
                profile.preferredCategories.includes(category)
                  ? "default"
                  : "outline"
              }
              size="sm"
              className="rounded-none"
              onClick={() =>
                commitProfile((current) => ({
                  ...current,
                  preferredCategories: toggleValue(
                    current.preferredCategories,
                    category,
                  ),
                }))
              }
            >
              {getCategoryLabel(category)}
            </Button>
          ))}
        </nav>
        <section className="container grid gap-3 border-t border-[#161616]/25 py-4 dark:border-[#f4f1ea]/25">
          <form
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
            onSubmit={applyExploreSearch}
          >
            <Input
              aria-label="Search AI news"
              className="h-10 rounded-none border-[#161616]/45 bg-[#fffdf7] dark:border-[#f4f1ea]/45 dark:bg-[#181818]"
              placeholder="Search models, agents, funding"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
            <Button className="rounded-none" type="submit">
              Search
            </Button>
            <Button
              className="rounded-none"
              disabled={!hasExploreFilters && !searchDraft.trim()}
              type="button"
              variant="outline"
              onClick={clearExploreFilters}
            >
              Reset
            </Button>
          </form>
          <div className="grid gap-2 sm:grid-cols-3">
            {feedModeOptions.map((option) => (
              <Button
                key={option.mode}
                className="h-auto justify-between rounded-none px-3 py-2 text-left"
                type="button"
                variant={feedMode === option.mode ? "default" : "outline"}
                onClick={() => setFeedMode(option.mode)}
              >
                <span>{option.label}</span>
                <span className="ml-3 font-mono text-[11px] opacity-70">
                  {option.detail}
                </span>
              </Button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto text-sm">
            <Button
              className="rounded-none"
              size="sm"
              type="button"
              variant={!activeCategory ? "default" : "outline"}
              onClick={() => setActiveCategory(null)}
            >
              All topics
            </Button>
            {availableCategories.slice(0, 10).map((category) => (
              <Button
                key={category}
                className="rounded-none"
                size="sm"
                type="button"
                variant={activeCategory === category ? "default" : "outline"}
                onClick={() =>
                  setActiveCategory((current) =>
                    current === category ? null : category,
                  )
                }
              >
                {getCategoryLabel(category)}
              </Button>
            ))}
          </div>
          {sourceFilterOptions.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto text-sm">
              <Button
                className="rounded-none"
                size="sm"
                type="button"
                variant={!activeSourceSlug ? "default" : "outline"}
                onClick={() => setActiveSourceSlug(null)}
              >
                All sources
              </Button>
              {sourceFilterOptions.map((source) => (
                <Button
                  key={source}
                  className="rounded-none"
                  size="sm"
                  type="button"
                  variant={activeSourceSlug === source ? "default" : "outline"}
                  onClick={() =>
                    setActiveSourceSlug((current) =>
                      current === source ? null : source,
                    )
                  }
                >
                  {source}
                </Button>
              ))}
            </div>
          ) : null}
        </section>
      </header>

      <section className="border-b border-[#161616]/25 dark:border-[#f4f1ea]/25">
        <div className="container grid gap-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.55fr)] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-mono text-xs tracking-[0.18em] uppercase">
                Today&apos;s Briefing
              </p>
              {editionBriefing.lead ? (
                <span className="border border-[#161616]/35 px-2 py-1 text-xs font-semibold text-[#8a241c] dark:border-[#f4f1ea]/35 dark:text-[#ff8b7e]">
                  {editionBriefing.lead.categoryLabel}
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 max-w-4xl text-2xl leading-tight font-black tracking-normal sm:text-3xl">
              {editionBriefing.headline}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
              {editionBriefing.summary}
            </p>
          </div>

          <dl className="grid grid-cols-3 border border-[#161616]/35 text-center dark:border-[#f4f1ea]/35">
            {editionBriefing.metrics.map((metric) => (
              <div
                key={metric.label}
                className="border-r border-[#161616]/20 p-3 last:border-r-0 dark:border-[#f4f1ea]/15"
              >
                <dt className="font-mono text-[11px] tracking-[0.12em] uppercase">
                  {metric.label}
                </dt>
                <dd className="mt-1 text-xl font-black">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="container grid gap-4 pb-6 md:grid-cols-2">
          <BriefingStrip title="Top Topics">
            {editionBriefing.topics.length > 0 ? (
              editionBriefing.topics.map((topic) => (
                <span
                  key={topic.category}
                  className="border border-[#161616]/30 px-2 py-1 dark:border-[#f4f1ea]/30"
                >
                  {topic.label} / {topic.storyCount}
                </span>
              ))
            ) : (
              <span className="text-[#5b5750] dark:text-[#bbb4aa]">
                Waiting for clusters
              </span>
            )}
          </BriefingStrip>
          <BriefingStrip title="Entity Watch">
            {editionBriefing.entities.length > 0 ? (
              editionBriefing.entities.map((entity) => (
                <span
                  key={entity.entity}
                  className="border border-[#161616]/30 px-2 py-1 dark:border-[#f4f1ea]/30"
                >
                  {entity.entity} / {entity.storyCount}
                </span>
              ))
            ) : (
              <span className="text-[#5b5750] dark:text-[#bbb4aa]">
                Waiting for entity signals
              </span>
            )}
          </BriefingStrip>
        </div>
      </section>

      <section className="container grid gap-6 py-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <div className="grid gap-6">
          {leadStory ? (
            <article className="grid min-h-[420px] border-y border-[#161616] py-6 md:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.7fr)] dark:border-[#f4f1ea]">
              <div className="flex flex-col justify-between gap-8 pr-0 md:pr-6">
                <div>
                  <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold tracking-normal uppercase">
                    <span>{getCategoryLabel(leadStory.category)}</span>
                    <span className="text-[#78746c]">/</span>
                    <span>{leadStory.sourceName}</span>
                    <span className="text-[#78746c]">/</span>
                    <span>{formatTime(leadStory.publishedAt)}</span>
                  </div>
                  <h2 className="max-w-4xl text-4xl leading-[1.03] font-black tracking-normal sm:text-5xl lg:text-6xl">
                    {leadStory.title}
                  </h2>
                  <p className="mt-5 max-w-2xl text-lg leading-8 text-[#4a4a4a] dark:text-[#c8c4ba]">
                    {leadStory.summary}
                  </p>
                  <RecommendationReasons
                    className="mt-5"
                    item={leadStory}
                    mode={feedMode}
                    rankedAt={rankDetailsAt}
                  />
                </div>
                <StoryAction
                  item={leadStory}
                  isPreview={isPreview}
                  onAction={recordStoryAction}
                />
              </div>
              <StoryVisual item={leadStory} featured />
            </article>
          ) : null}

          <section className="grid gap-4 md:grid-cols-3">
            {secondaryStories.map((story) => (
              <StoryCard
                key={story.id}
                item={story}
                isPreview={isPreview}
                mode={feedMode}
                rankedAt={rankDetailsAt}
                onAction={recordStoryAction}
              />
            ))}
          </section>

          {sectionFronts.length > 0 ? (
            <section className="border-y border-[#161616]/35 py-5 dark:border-[#f4f1ea]/35">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-xs tracking-[0.18em] uppercase">
                    Section Fronts
                  </p>
                  <h2 className="mt-2 text-2xl font-black">
                    Channel desks from this edition
                  </h2>
                </div>
                <span className="border border-[#161616]/35 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/35">
                  {sectionFronts.length} channels
                </span>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {sectionFronts.map((section) => (
                  <article
                    key={section.category}
                    className="grid min-h-56 grid-rows-[auto_1fr_auto] border border-[#161616]/35 bg-[#fffdf7] p-4 dark:border-[#f4f1ea]/35 dark:bg-[#181818]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-xs tracking-[0.14em] uppercase">
                          {section.label}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                          {section.summary}
                        </p>
                      </div>
                      <span className="border border-[#161616]/30 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/30">
                        {section.heatScore}
                      </span>
                    </div>
                    {section.lead ? (
                      <div className="mt-5">
                        <div className="text-xs font-semibold tracking-normal text-[#8a241c] uppercase dark:text-[#ff8b7e]">
                          {section.lead.sourceName} /{" "}
                          {formatTime(section.lead.publishedAt)}
                        </div>
                        <h3 className="mt-2 text-2xl leading-tight font-black">
                          {section.lead.title}
                        </h3>
                      </div>
                    ) : null}
                    <div className="mt-4 grid gap-2 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15">
                      <div className="flex justify-between gap-4 font-mono text-xs">
                        <span>{section.storyCount} stories</span>
                        <span>{section.sourceCount} sources</span>
                        <span>heat {section.averageTrendScore}</span>
                      </div>
                      {section.supportingStories.map((story) => (
                        <div
                          key={story.id}
                          className="grid grid-cols-[1fr_auto] gap-3 border-t border-[#161616]/10 pt-2 dark:border-[#f4f1ea]/10"
                        >
                          <span className="leading-5">{story.title}</span>
                          <span className="font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                            {story.personalizedScore}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="divide-y divide-[#161616]/20 border-y border-[#161616]/35 dark:divide-[#f4f1ea]/15 dark:border-[#f4f1ea]/35">
            {streamStories.length > 0 ? (
              streamStories.map((story) => (
                <StoryRow
                  key={story.id}
                  item={story}
                  isPreview={isPreview}
                  mode={feedMode}
                  rankedAt={rankDetailsAt}
                  onAction={recordStoryAction}
                />
              ))
            ) : (
              <div className="py-8 text-sm text-[#5b5750] dark:text-[#bbb4aa]">
                {hasExploreFilters
                  ? "No matching stories yet. Adjust filters or reset search."
                  : "More stories will appear here as the crawl volume increases."}
              </div>
            )}
          </section>

          {!isPreview ? (
            <div ref={feedEndRef} aria-hidden="true" className="h-px w-full" />
          ) : null}

          {!isPreview ? (
            <div className="flex justify-center border-b border-[#161616]/25 pb-6 dark:border-[#f4f1ea]/25">
              <Button
                className="rounded-none"
                disabled={
                  !visitorKey || !nextCursor || isLoadingMore || !hasMoreItems
                }
                type="button"
                variant="outline"
                onClick={() => void loadMoreStories()}
              >
                {isLoadingMore
                  ? "Loading"
                  : hasMoreItems
                    ? "Load more"
                    : "End of feed"}
              </Button>
            </div>
          ) : null}
        </div>

        <aside className="grid content-start gap-6">
          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">For You</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {status === "ready"
                    ? "Your edition is ranked by trend, freshness, and selected signals."
                    : "The recommendation layer is ready; live stories need the first crawl."}
                </p>
              </div>
              <div className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {leadStory?.personalizedScore ?? 0}
              </div>
            </div>

            <div className="mt-5 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black">Reader Signal</h3>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    className="h-8 rounded-none px-2 text-xs"
                    type="button"
                    variant="outline"
                    onClick={resetProfile}
                  >
                    Reset Signal
                  </Button>
                  <span className="border border-[#161616]/50 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/50">
                    {readerSignalSummary.strength} /{" "}
                    {readerSignalSummary.signalCount}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                {readerSignalSummary.detail}
              </p>
              <div className="mt-3 grid gap-3 text-xs">
                <SignalChips
                  label="Topics"
                  values={readerSignalSummary.topics.map(getCategoryLabel)}
                />
                <SignalChips
                  label="Sources"
                  values={readerSignalSummary.sources}
                />
                <SignalChips
                  label="Entities"
                  values={readerSignalSummary.entities}
                />
              </div>
              <div className="mt-4 border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15">
                <h4 className="font-mono text-[11px] tracking-[0.14em] uppercase">
                  Ranking Factors
                </h4>
                <div className="mt-2 grid gap-2">
                  {readerRankingFactors.map((factor) => (
                    <div
                      key={`${factor.label}-${factor.detail}`}
                      className="grid gap-1 text-xs sm:grid-cols-[5rem_1fr]"
                    >
                      <span className="font-semibold">{factor.label}</span>
                      <span className="leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {factor.detail}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <PreferenceGroup title="Sources">
              {availableSources.map((source) => (
                <PreferenceButton
                  key={source}
                  active={profile.preferredSources.includes(source)}
                  onClick={() =>
                    commitProfile((current) => ({
                      ...current,
                      preferredSources: toggleValue(
                        current.preferredSources,
                        source,
                      ),
                    }))
                  }
                >
                  {source}
                </PreferenceButton>
              ))}
            </PreferenceGroup>

            <PreferenceGroup title="Entities">
              {availableEntities.map((entity) => (
                <PreferenceButton
                  key={entity}
                  active={profile.preferredEntities.includes(entity)}
                  onClick={() =>
                    commitProfile((current) => ({
                      ...current,
                      preferredEntities: toggleValue(
                        current.preferredEntities,
                        entity,
                      ),
                    }))
                  }
                >
                  {entity}
                </PreferenceButton>
              ))}
            </PreferenceGroup>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <BiasButton
                label="Fresh"
                value={profile.recencyBias}
                onClick={() =>
                  commitProfile((current) => ({
                    ...current,
                    recencyBias:
                      current.recencyBias >= 2 ? 0 : current.recencyBias + 1,
                  }))
                }
              />
              <BiasButton
                label="Novel"
                value={profile.noveltyBias}
                onClick={() =>
                  commitProfile((current) => ({
                    ...current,
                    noveltyBias:
                      current.noveltyBias >= 2 ? 0 : current.noveltyBias + 1,
                  }))
                }
              />
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Today&apos;s Queue</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {readingQueue.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {readingQueue.slots.length}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {readingQueue.slots.length > 0 ? (
                readingQueue.slots.map((slot, index) => {
                  const storyTitle = (
                    <span className="leading-5 font-semibold">
                      {slot.story.title}
                    </span>
                  );

                  return (
                    <div
                      key={`${slot.intent}-${slot.story.id}`}
                      className="grid grid-cols-[2rem_1fr_auto] gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                    >
                      <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] tracking-[0.14em] uppercase">
                          {slot.label} / {slot.intent}
                        </div>
                        {isPreview ? (
                          <div className="mt-1">{storyTitle}</div>
                        ) : (
                          <Link
                            className="mt-1 block hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                            href={`/news/${slot.story.id}`}
                          >
                            {storyTitle}
                          </Link>
                        )}
                        <p className="mt-1 leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {slot.reason}
                        </p>
                        <div className="mt-1 text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {slot.story.sourceName}
                        </div>
                      </div>
                      <span className="font-mono text-xs">
                        {slot.story.personalizedScore}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  The queue will build itself after the edition has ranked
                  stories.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Recommendation Audit</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {recommendationAudit.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {recommendationAudit.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {recommendationAudit.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                >
                  <dt className="text-xs font-semibold text-[#5b5750] dark:text-[#bbb4aa]">
                    {metric.label}
                  </dt>
                  <dd className="mt-1 font-mono text-lg">{metric.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 grid gap-3">
              {recommendationAudit.notices.map((notice) => (
                <div
                  key={notice.label}
                  className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="font-semibold">{notice.label}</div>
                  <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {notice.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Source Balance</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {sourceBalance.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {sourceBalance.concentration}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <StatusLine
                label="Sources"
                value={`${sourceBalance.uniqueSourceCount}/${sourceBalance.totalCount}`}
              />
              <StatusLine
                label="Leader"
                value={sourceBalance.dominantSource?.name ?? "None"}
              />
              <StatusLine
                label="Share"
                value={
                  sourceBalance.dominantSource
                    ? `${sourceBalance.dominantSource.percentage}%`
                    : "0%"
                }
              />
            </dl>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Edition Mix</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {editionMix.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {editionMix.totalCount}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {editionMix.segments.map((segment) => (
                <div
                  key={segment.label}
                  className="grid grid-cols-[1fr_auto] gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="min-w-0">
                    <div className="font-semibold">{segment.label}</div>
                    <div className="mt-1 text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                      {segment.detail}
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div>{segment.count}</div>
                    <div className="mt-1 text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                      {segment.percentage}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Entity Radar</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  People, companies, models, and projects recurring across the
                  edition.
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {entityRadar.length}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {entityRadar.length > 0 ? (
                entityRadar.map((entry, index) => (
                  <div
                    key={entry.entity}
                    className="grid grid-cols-[2rem_1fr_auto] items-start gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                  >
                    <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        {entry.entity}
                      </div>
                      <div className="mt-1 text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                        {entry.storyCount} stories / {entry.sourceCount} sources
                      </div>
                    </div>
                    <span className="font-mono">{entry.heatScore}</span>
                  </div>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Entity radar will appear as stories share names, products, or
                  companies.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Topic Pulse</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  Clusters in the current edition, ranked by volume and heat.
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {topicPulse.length}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {topicPulse.length > 0 ? (
                topicPulse.map((pulse, index) => (
                  <div
                    key={pulse.category}
                    className="grid grid-cols-[2rem_1fr_auto] items-start gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                  >
                    <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold">
                        {getCategoryLabel(pulse.category)}
                      </div>
                      <div className="mt-1 truncate text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                        {pulse.storyCount} stories / {pulse.sources.join(", ")}
                      </div>
                    </div>
                    <span className="font-mono">{pulse.heatScore}</span>
                  </div>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Topic clusters will appear as the edition fills.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Reader Memory</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {readerMemory.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {readerMemory.label}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {readerMemory.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                >
                  <dt className="text-xs font-semibold text-[#5b5750] dark:text-[#bbb4aa]">
                    {metric.label}
                  </dt>
                  <dd className="mt-1 font-mono text-lg">{metric.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 grid gap-3">
              {readerMemory.highlights.map((highlight) => (
                <div
                  key={highlight.label}
                  className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="font-semibold">{highlight.label}</div>
                  <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {highlight.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Saved</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  Your reading list follows the same anonymous reader key as the
                  For You feed.
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {savedItems.length}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {savedItems.length > 0 ? (
                savedItems.map((item) => (
                  <Link
                    key={item.id}
                    className="grid gap-1 border-t border-[#161616]/20 pt-3 text-sm hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                    href={`/news/${item.id}`}
                  >
                    <span className="leading-5 font-semibold">
                      {item.title}
                    </span>
                    <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                      {item.sourceName} / saved {formatTime(item.savedAt)}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Save stories from the front page to build a personal reading
                  queue.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Recently Read</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  Opened stories become a lightweight trail for follow-up
                  recommendations.
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {historyItems.length}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {historyItems.length > 0 ? (
                historyItems.map((item) => (
                  <Link
                    key={item.id}
                    className="grid gap-1 border-t border-[#161616]/20 pt-3 text-sm hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                    href={`/news/${item.id}`}
                  >
                    <span className="leading-5 font-semibold">
                      {item.title}
                    </span>
                    <span className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                      {item.sourceName} / read {formatTime(item.viewedAt)}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Open stories to build a reading trail for the next edition.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <h2 className="text-xl font-black">Signal Board</h2>
            <div className="mt-4 grid gap-3">
              {rankedItems.slice(0, 5).map((story, index) => {
                const rankDetails = getNewsStoryRankDetails({
                  item: story,
                  mode: feedMode,
                  now: rankDetailsAt,
                });

                return (
                  <div
                    key={story.id}
                    className="grid grid-cols-[2rem_1fr_auto] items-start gap-3 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                  >
                    <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="leading-5">
                      {story.title}
                      <span className="mt-1 block text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                        {rankDetails.summary}
                      </span>
                    </span>
                    <span className="font-mono">{rankDetails.scoreLabel}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-[#161616] p-5 text-[#f4f1ea] dark:bg-[#f4f1ea] dark:text-[#161616]">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-black">Desk Status</h2>
              <span className="border border-current px-2 py-1 font-mono text-xs">
                {deskStatusSummary.label}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 opacity-80">
              {deskStatusSummary.detail}
            </p>
            <dl className="mt-4 grid gap-3 text-sm">
              <StatusLine
                label="Sources"
                value={`${formatCount(deskStatus.activeSources)}/${formatCount(deskStatus.totalSources)} active`}
              />
              <StatusLine
                label="Stories"
                value={formatCount(deskStatus.publishedStories)}
              />
              <StatusLine
                label="Latest story"
                value={formatOptionalTime(deskStatus.latestPublishedAt)}
              />
              <StatusLine
                label="Last refresh"
                value={formatLastRun(deskStatus.latestRun)}
              />
              <StatusLine
                label="Run yield"
                value={formatRunYield(deskStatus.latestRun)}
              />
            </dl>
          </section>
        </aside>
      </section>
    </main>
  );
}

function RecommendationReasons({
  item,
  className,
  mode,
  rankedAt,
}: {
  item: RankedNewsHomeItem;
  className?: string;
  mode: NewsFeedMode;
  rankedAt: Date;
}) {
  const rankDetails = getNewsStoryRankDetails({
    item,
    mode,
    now: rankedAt,
  });

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-normal uppercase">
        <span className="text-[#5b5750] dark:text-[#bbb4aa]">Why this</span>
        {rankDetails.badges.map((reason) => (
          <span
            key={reason}
            className="border border-[#161616]/30 px-2 py-1 text-[#8a241c] dark:border-[#f4f1ea]/30 dark:text-[#ff8b7e]"
          >
            {reason}
          </span>
        ))}
      </div>
      <p className="max-w-2xl text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
        {rankDetails.summary}
      </p>
    </div>
  );
}

function StoryVisual({
  item,
  featured = false,
}: {
  item: NewsHomeItem;
  featured?: boolean;
}) {
  if (item.imageUrl) {
    return (
      <div
        className={cn(
          "min-h-52 bg-cover bg-center grayscale",
          featured && "mt-6 md:mt-0",
        )}
        style={{ backgroundImage: `url(${item.imageUrl})` }}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-52 items-end justify-between border border-[#161616] bg-[#e8e1d4] p-4 dark:border-[#f4f1ea] dark:bg-[#24211d]",
        featured && "mt-6 md:mt-0",
      )}
    >
      <span className="max-w-[12rem] text-3xl leading-none font-black">
        {getCategoryLabel(item.category)}
      </span>
      <span className="font-mono text-5xl leading-none text-[#8a241c] dark:text-[#ff8b7e]">
        AI
      </span>
    </div>
  );
}

function StoryAction({
  item,
  isPreview,
  onAction,
}: {
  item: NewsHomeItem;
  isPreview: boolean;
  onAction: (item: NewsHomeItem, action: ReaderInteractionAction) => void;
}) {
  if (isPreview) {
    return (
      <p className="max-w-xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
        Live collection will replace preview desk notes after sources and schema
        are initialized in production.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild className="rounded-none">
        <Link href={`/news/${item.id}`}>Read</Link>
      </Button>
      <Button
        className="rounded-none"
        type="button"
        variant="outline"
        onClick={() => onAction(item, "save")}
      >
        Save
      </Button>
      <Button
        className="rounded-none"
        type="button"
        variant="outline"
        onClick={() => onAction(item, "share")}
      >
        Share
      </Button>
      <Button
        className="rounded-none"
        type="button"
        variant="outline"
        onClick={() => onAction(item, "hide")}
      >
        Less
      </Button>
      {item.canonicalUrl ? (
        <Button asChild className="rounded-none" variant="outline">
          <a
            href={item.canonicalUrl}
            onClick={() => onAction(item, "click_source")}
            rel="nofollow noopener noreferrer"
            target="_blank"
          >
            Source
          </a>
        </Button>
      ) : null}
    </div>
  );
}

function StoryCard({
  item,
  isPreview,
  mode,
  rankedAt,
  onAction,
}: {
  item: RankedNewsHomeItem;
  isPreview: boolean;
  mode: NewsFeedMode;
  rankedAt: Date;
  onAction: (item: NewsHomeItem, action: ReaderInteractionAction) => void;
}) {
  return (
    <article className="grid gap-3 border border-[#161616]/35 bg-[#fffdf7] p-4 dark:border-[#f4f1ea]/35 dark:bg-[#181818]">
      <StoryVisual item={item} />
      <div className="text-xs font-semibold tracking-normal text-[#8a241c] uppercase dark:text-[#ff8b7e]">
        {getCategoryLabel(item.category)}
      </div>
      <h3 className="text-xl leading-tight font-black">{item.title}</h3>
      <p className="line-clamp-4 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
        {item.summary}
      </p>
      <RecommendationReasons item={item} mode={mode} rankedAt={rankedAt} />
      {!isPreview ? (
        <StoryAction item={item} isPreview={isPreview} onAction={onAction} />
      ) : null}
    </article>
  );
}

function StoryRow({
  item,
  isPreview,
  mode,
  rankedAt,
  onAction,
}: {
  item: RankedNewsHomeItem;
  isPreview: boolean;
  mode: NewsFeedMode;
  rankedAt: Date;
  onAction: (item: NewsHomeItem, action: ReaderInteractionAction) => void;
}) {
  return (
    <article className="grid gap-4 py-5 md:grid-cols-[1fr_10rem_auto] md:items-start">
      <div>
        <div className="text-xs font-semibold tracking-normal text-[#8a241c] uppercase dark:text-[#ff8b7e]">
          {item.sourceName} / {getCategoryLabel(item.category)}
        </div>
        <h3 className="mt-2 text-2xl leading-tight font-black">{item.title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
          {item.summary}
        </p>
        <RecommendationReasons
          className="mt-3"
          item={item}
          mode={mode}
          rankedAt={rankedAt}
        />
      </div>
      <div className="font-mono text-sm">
        <div>{formatTime(item.publishedAt)}</div>
        <div className="mt-1 text-[#5b5750] dark:text-[#bbb4aa]">
          Score {item.personalizedScore}
        </div>
      </div>
      <StoryAction item={item} isPreview={isPreview} onAction={onAction} />
    </article>
  );
}

function SignalChips({
  label,
  values,
}: {
  label: string;
  values: readonly string[];
}) {
  return (
    <div className="grid gap-2">
      <span className="font-mono text-[11px] tracking-[0.14em] uppercase">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {values.length > 0 ? (
          values.map((value) => (
            <span
              key={`${label}-${value}`}
              className="max-w-full border border-[#161616]/30 px-2 py-1 dark:border-[#f4f1ea]/25"
            >
              <span className="block truncate">{value}</span>
            </span>
          ))
        ) : (
          <span className="text-[#5b5750] dark:text-[#bbb4aa]">None yet</span>
        )}
      </div>
    </div>
  );
}

function BriefingStrip({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[#161616]/20 pt-3 text-xs font-semibold dark:border-[#f4f1ea]/15">
      <span className="font-mono tracking-[0.14em] uppercase">{title}</span>
      {children}
    </div>
  );
}

function PreferenceGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <h3 className="font-mono text-xs tracking-[0.18em] uppercase">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function PreferenceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      className="max-w-full rounded-none"
      onClick={onClick}
    >
      <span className="truncate">{children}</span>
    </Button>
  );
}

function BiasButton({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto rounded-none py-3"
      onClick={onClick}
    >
      <span>{label}</span>
      <span className="font-mono">{value}/2</span>
    </Button>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-t border-current/25 pt-2">
      <dt>{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
