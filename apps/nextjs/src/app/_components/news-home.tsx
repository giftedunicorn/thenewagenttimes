"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { NewsPreferenceProfile, RankedNewsItem } from "@acme/validators";
import { cn } from "@acme/ui";
import { Button } from "@acme/ui/button";
import { rankNewsForReader } from "@acme/validators";

import type { NewsHomeItem, NewsHomeStatus } from "./news-home-model";
import { useTRPC } from "~/trpc/react";
import {
  selectNewsHomeItems,
  shouldFetchServerRecommendations,
} from "./news-home-model";

type RankedNewsHomeItem = RankedNewsItem<NewsHomeItem>;

interface NewsHomeProps {
  initialItems: NewsHomeItem[];
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

const isNewsCategoryKey = (value: string): value is NewsCategoryKey =>
  value in categoryLabels;

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

const toggleValue = (values: readonly string[], value: string) =>
  values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];

const getUniqueValues = (items: readonly NewsHomeItem[], key: "sourceSlug") =>
  Array.from(new Set(items.map((item) => item[key]))).slice(0, 8);

const getTopEntities = (items: readonly NewsHomeItem[]) =>
  Array.from(new Set(items.flatMap((item) => item.entities))).slice(0, 10);

export function NewsHome({ initialItems, status, generatedAt }: NewsHomeProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [profile, setProfile] =
    useState<NewsPreferenceProfile>(readStoredProfile);
  const [visitorKey] = useState<string | null>(readOrCreateVisitorKey);
  const fallbackItems = initialItems.length > 0 ? initialItems : previewItems;
  const canPersistProfile = status !== "unavailable";
  const forYouQuery = useQuery(
    trpc.news.forYou.queryOptions(
      { limit: 30, visitorKey: visitorKey ?? undefined },
      {
        enabled: shouldFetchServerRecommendations({ status, visitorKey }),
      },
    ),
  );
  const updateProfile = useMutation(
    trpc.news.updateProfile.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.news.forYou.pathFilter());
      },
    }),
  );
  const serverRecommendedItems = forYouQuery.data;
  const items = selectNewsHomeItems({
    initialItems: fallbackItems,
    serverRecommendedItems,
  });
  const isPreview =
    initialItems.length === 0 && !serverRecommendedItems?.length;

  useEffect(() => {
    writeStoredProfile(profile);
  }, [profile]);

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

  const rankedItems = useMemo(
    () => rankNewsForReader(items, profile),
    [items, profile],
  );
  const leadStory = rankedItems[0];
  const secondaryStories = rankedItems.slice(1, 4);
  const streamStories = rankedItems.slice(4);
  const availableCategories = Array.from(
    new Set([
      ...Object.keys(categoryLabels).slice(0, 9),
      ...items.map((item) => item.category),
    ]),
  );
  const availableSources = getUniqueValues(items, "sourceSlug");
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
                </div>
                <StoryAction item={leadStory} isPreview={isPreview} />
              </div>
              <StoryVisual item={leadStory} featured />
            </article>
          ) : null}

          <section className="grid gap-4 md:grid-cols-3">
            {secondaryStories.map((story) => (
              <StoryCard key={story.id} item={story} isPreview={isPreview} />
            ))}
          </section>

          <section className="divide-y divide-[#161616]/20 border-y border-[#161616]/35 dark:divide-[#f4f1ea]/15 dark:border-[#f4f1ea]/35">
            {streamStories.length > 0 ? (
              streamStories.map((story) => (
                <StoryRow key={story.id} item={story} isPreview={isPreview} />
              ))
            ) : (
              <div className="py-8 text-sm text-[#5b5750] dark:text-[#bbb4aa]">
                More stories will appear here as the crawl volume increases.
              </div>
            )}
          </section>
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
                  <span className="leading-5">{story.title}</span>
                  <span className="font-mono">{story.personalizedScore}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-[#161616] p-5 text-[#f4f1ea] dark:bg-[#f4f1ea] dark:text-[#161616]">
            <h2 className="text-xl font-black">Desk Status</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <StatusLine
                label="Edition"
                value={isPreview ? "Preview" : "Live"}
              />
              <StatusLine label="Stories" value={String(initialItems.length)} />
              <StatusLine
                label="Data"
                value={status === "unavailable" ? "Needs schema" : "Connected"}
              />
            </dl>
          </section>
        </aside>
      </section>
    </main>
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
}: {
  item: NewsHomeItem;
  isPreview: boolean;
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
    <Button asChild className="w-fit rounded-none">
      <Link href={`/news/${item.id}`}>Read brief</Link>
    </Button>
  );
}

function StoryCard({
  item,
  isPreview,
}: {
  item: RankedNewsHomeItem;
  isPreview: boolean;
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
      {!isPreview ? <StoryAction item={item} isPreview={isPreview} /> : null}
    </article>
  );
}

function StoryRow({
  item,
  isPreview,
}: {
  item: RankedNewsHomeItem;
  isPreview: boolean;
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
      </div>
      <div className="font-mono text-sm">
        <div>{formatTime(item.publishedAt)}</div>
        <div className="mt-1 text-[#5b5750] dark:text-[#bbb4aa]">
          Score {item.personalizedScore}
        </div>
      </div>
      <StoryAction item={item} isPreview={isPreview} />
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
