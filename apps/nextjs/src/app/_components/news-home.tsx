"use client";

import type { FormEvent } from "react";
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
  rankNewsForReader,
  selectDiverseNewsFeed,
  updateReaderProfileWithInteraction,
} from "@acme/validators";

import type {
  NewsDeskStatus,
  NewsHomeItem,
  NewsHomeStatus,
} from "./news-home-model";
import { useTRPC } from "~/trpc/react";
import {
  buildNewsHomeFeedInput,
  getNewsDeskStatusSummary,
  getNewsRecommendationReasons,
  getNextNewsHomeCursor,
  mergeNewsHomeItems,
  selectHydratedNewsPreferenceProfile,
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

const defaultProfile: NewsPreferenceProfile = {
  preferredCategories: ["model_release", "agent_product", "funding"],
  preferredSources: [],
  preferredEntities: [],
  noveltyBias: 1,
  recencyBias: 1,
};

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
  if (typeof window === "undefined") return defaultProfile;

  const stored = window.localStorage.getItem(profileStorageKey);
  if (!stored) return defaultProfile;

  try {
    const parsed = JSON.parse(stored) as Partial<NewsPreferenceProfile>;
    return {
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
    };
  } catch {
    return defaultProfile;
  }
};

const writeStoredProfile = (profile: NewsPreferenceProfile) => {
  window.localStorage.setItem(profileStorageKey, JSON.stringify(profile));
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

const toServerProfile = (profile: NewsPreferenceProfile) => ({
  preferredCategories: profile.preferredCategories
    .filter(isNewsCategoryKey)
    .slice(0, 12),
  preferredSources: profile.preferredSources
    .map((source) => source.trim())
    .filter(Boolean)
    .slice(0, 12),
  preferredEntities: profile.preferredEntities
    .map((entity) => entity.trim())
    .filter(Boolean)
    .slice(0, 24),
  noveltyBias: Math.min(Math.max(profile.noveltyBias, 0), 2),
  recencyBias: Math.min(Math.max(profile.recencyBias, 0), 2),
});

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

  const rankedItems = useMemo(
    () =>
      selectDiverseNewsFeed(rankNewsForReader(items, profile), {
        limit: items.length,
      }),
    [items, profile],
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
                  <RecommendationReasons className="mt-5" item={leadStory} />
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
                onAction={recordStoryAction}
              />
            ))}
          </section>

          <section className="divide-y divide-[#161616]/20 border-y border-[#161616]/35 dark:divide-[#f4f1ea]/15 dark:border-[#f4f1ea]/35">
            {streamStories.length > 0 ? (
              streamStories.map((story) => (
                <StoryRow
                  key={story.id}
                  item={story}
                  isPreview={isPreview}
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
            <h2 className="text-xl font-black">Signal Board</h2>
            <div className="mt-4 grid gap-3">
              {rankedItems.slice(0, 5).map((story, index) => (
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
                      {getNewsRecommendationReasons({ item: story })[0]}
                    </span>
                  </span>
                  <span className="font-mono">{story.personalizedScore}</span>
                </div>
              ))}
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
}: {
  item: RankedNewsHomeItem;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 text-xs font-semibold tracking-normal uppercase",
        className,
      )}
    >
      <span className="text-[#5b5750] dark:text-[#bbb4aa]">Why this</span>
      {getNewsRecommendationReasons({ item }).map((reason) => (
        <span
          key={reason}
          className="border border-[#161616]/30 px-2 py-1 text-[#8a241c] dark:border-[#f4f1ea]/30 dark:text-[#ff8b7e]"
        >
          {reason}
        </span>
      ))}
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
  onAction,
}: {
  item: RankedNewsHomeItem;
  isPreview: boolean;
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
      <RecommendationReasons item={item} />
      {!isPreview ? (
        <StoryAction item={item} isPreview={isPreview} onAction={onAction} />
      ) : null}
    </article>
  );
}

function StoryRow({
  item,
  isPreview,
  onAction,
}: {
  item: RankedNewsHomeItem;
  isPreview: boolean;
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
        <RecommendationReasons className="mt-3" item={item} />
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
