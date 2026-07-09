"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import type { NewsPreferenceProfile } from "@acme/validators";
import { Button } from "@acme/ui/button";
import { dedupeNewsItems, rankNewsForReader } from "@acme/validators";

import type { NewsHomeItem, NewsHomeStatus } from "./news-home-model";
import type { NewsSearchMemoryItem } from "./news-reader-memory-storage";
import { useTRPC } from "~/trpc/react";
import { NewsEditionStoryActions } from "./news-edition-story-actions";
import {
  createDefaultNewsPreferenceProfile,
  getNewsBriefingPack,
  getNewsFrontPageSlotMix,
  getNewsReaderDaypartPlan,
  getNewsReaderScorecards,
  selectHydratedNewsPreferenceProfile,
} from "./news-home-model";
import {
  readStoredNewsSearchMemoryItems,
  subscribeToNewsReaderMemoryStorage,
} from "./news-reader-memory-storage";
import {
  areNewsPreferenceProfilesEqual,
  emptyNewsPreferenceProfileSnapshot,
  parseStoredNewsPreferenceProfile,
  readNewsPreferenceProfileSnapshot,
  readOrCreateNewsVisitorKey,
  subscribeToNewsPreferenceProfileStorage,
  writeStoredNewsPreferenceProfile,
} from "./news-reader-profile-storage";

interface NewsBriefingSearchMemoryMatch {
  href: string;
  query: string;
  resultCountLabel: string;
  title: string;
}

interface NewsBriefingSearchMemory {
  label: string;
  matches: NewsBriefingSearchMemoryMatch[];
  summary: string;
}

const newsBriefingReaderLensCategoryLabels: Record<string, string> = {
  agent_product: "Agents",
  big_tech: "Big Tech",
  funding: "Funding",
  hot_take: "Hot Takes",
  market_map: "Market Maps",
  model_release: "Models",
  musk_ai: "Musk AI",
  new_concept: "New Concepts",
  open_source: "Open Source",
  other: "Other",
  policy: "Policy",
  product_hunt: "Product Hunt",
  research: "Research",
  security: "Security",
  yc_ai: "YC AI",
};

const formatNewsBriefingReaderCategory = (category: string) =>
  newsBriefingReaderLensCategoryLabels[category] ?? category;

const readStoredProfile = (stored: string): NewsPreferenceProfile =>
  parseStoredNewsPreferenceProfile({
    defaultProfile: createDefaultNewsPreferenceProfile(),
    stored,
  });

const getGeneratedAtDate = (generatedAt: string) => {
  const date = new Date(generatedAt);

  return Number.isNaN(date.getTime()) ? new Date(0) : date;
};

const getNewsBriefingSearchMemoryTimestamp = (
  item: Pick<NewsSearchMemoryItem, "searchedAt">,
) => {
  const timestamp = Date.parse(item.searchedAt);

  return Number.isFinite(timestamp) ? timestamp : 0;
};

const normalizeNewsBriefingSearchText = (value: string) =>
  value.toLowerCase().replace(/[_-]+/g, " ");

const getNewsBriefingSearchMemoryTokens = (query: string) =>
  normalizeNewsBriefingSearchText(query).split(/\s+/).filter(Boolean);

const getNewsBriefingSearchText = (item: NewsHomeItem) =>
  normalizeNewsBriefingSearchText(
    [
      item.title,
      item.summary,
      item.sourceName,
      item.sourceSlug,
      item.category,
      ...item.tags,
      ...item.entities,
    ].join(" "),
  );

const doesNewsBriefingStoryMatchSearchMemory = ({
  item,
  query,
}: {
  item: NewsHomeItem;
  query: string;
}) => {
  const tokens = getNewsBriefingSearchMemoryTokens(query);

  if (tokens.length === 0) return false;

  const searchText = getNewsBriefingSearchText(item);

  return tokens.every((token) => searchText.includes(token));
};

const getSearchMemoryResultCountLabel = (resultCount: number) =>
  `${resultCount} ${resultCount === 1 ? "result" : "results"}`;

const selectNewsBriefingSearchMemory = ({
  items,
  searchMemoryItems,
}: {
  items: readonly NewsHomeItem[];
  searchMemoryItems: readonly NewsSearchMemoryItem[];
}): NewsBriefingSearchMemory => {
  const matches = [...searchMemoryItems]
    .sort(
      (left, right) =>
        getNewsBriefingSearchMemoryTimestamp(right) -
        getNewsBriefingSearchMemoryTimestamp(left),
    )
    .flatMap((searchItem) => {
      const match = items.find((item) =>
        doesNewsBriefingStoryMatchSearchMemory({
          item,
          query: searchItem.query,
        }),
      );

      if (!match) return [];

      return [
        {
          href: `/news/${match.id}`,
          query: searchItem.query,
          resultCountLabel: getSearchMemoryResultCountLabel(
            searchItem.resultCount,
          ),
          title: match.title,
        },
      ];
    })
    .slice(0, 3);
  const leadMatch = matches[0];

  return {
    label: "Search Memory",
    matches,
    summary: leadMatch
      ? `Recent search "${leadMatch.query}" matches this briefing.`
      : "Recent searches have not matched this briefing yet.",
  };
};

export const selectNewsBriefingReaderLens = ({
  generatedAt,
  items,
  profile,
  readerLocalHour,
  searchMemoryItems = [],
}: {
  generatedAt: string;
  items: readonly NewsHomeItem[];
  profile: NewsPreferenceProfile;
  readerLocalHour?: number | null;
  searchMemoryItems?: readonly NewsSearchMemoryItem[];
}) => {
  const rankedItems = rankNewsForReader(dedupeNewsItems(items), profile);
  const rankedItemsById = new Map(rankedItems.map((item) => [item.id, item]));
  const personalizedPack = getNewsBriefingPack({
    formatCategory: formatNewsBriefingReaderCategory,
    items: rankedItems,
  });

  return {
    daypart: getNewsReaderDaypartPlan({
      formatCategory: formatNewsBriefingReaderCategory,
      generatedAt,
      items: rankedItems,
      profile,
      readerLocalHour,
    }),
    label: "Your Briefing",
    personalizedPack: {
      ...personalizedPack,
      slots: personalizedPack.slots.map((slot) => ({
        ...slot,
        item: rankedItemsById.get(slot.id) ?? null,
      })),
    },
    scorecards: getNewsReaderScorecards({
      formatCategory: formatNewsBriefingReaderCategory,
      items: rankedItems,
      limit: 2,
      now: getGeneratedAtDate(generatedAt),
      profile,
    }),
    searchMemory: selectNewsBriefingSearchMemory({
      items: rankedItems,
      searchMemoryItems,
    }),
    slotMix: getNewsFrontPageSlotMix({
      formatCategory: formatNewsBriefingReaderCategory,
      items: rankedItems,
      profile,
    }),
  };
};

const getBrowserReaderLocalHour = () =>
  typeof window === "undefined" ? null : new Date().getHours();

export function NewsBriefingReaderLensView({
  isPreview = false,
  itemsLength,
  lens,
}: {
  isPreview?: boolean;
  itemsLength: number;
  lens: ReturnType<typeof selectNewsBriefingReaderLens>;
}) {
  if (itemsLength === 0) return null;

  return (
    <section className="border-b border-[#161616]/25 bg-[#fffdf7] dark:border-[#f4f1ea]/20 dark:bg-[#181818]">
      <div className="container grid gap-5 py-5 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-[0.18em] uppercase">
            {lens.label}
          </p>
          <h2 className="mt-2 text-2xl leading-tight font-black">
            Reader daypart
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
            {lens.daypart.summary}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild className="rounded-none" variant="outline">
              <Link href="/reader">Tune profile</Link>
            </Button>
            <Button asChild className="rounded-none" variant="outline">
              <Link href="/">Open For You</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
            <div className="border-t border-[#161616]/25 pt-3 dark:border-[#f4f1ea]/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm leading-5 font-black">
                    {lens.daypart.label}
                  </h3>
                  <p className="mt-1 font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                    {lens.daypart.cadenceLabel}
                  </p>
                </div>
                <span className="shrink-0 border border-[#161616]/25 px-2 py-1 font-mono text-[10px] uppercase dark:border-[#f4f1ea]/20">
                  Daypart
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                {lens.daypart.intent}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px]">
                {lens.daypart.metrics.map((metric) => (
                  <div
                    className="border border-[#161616]/20 px-2 py-2 dark:border-[#f4f1ea]/15"
                    key={metric.label}
                  >
                    <dt className="tracking-[0.12em] uppercase">
                      {metric.label}
                    </dt>
                    <dd className="mt-1 text-lg font-black">{metric.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="border-t border-[#161616]/25 pt-3 dark:border-[#f4f1ea]/20">
              <h3 className="text-sm leading-5 font-black">Slot mix</h3>
              <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                {lens.slotMix.summary}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {lens.slotMix.slots.slice(0, 4).map((slot) => (
                  <Link
                    className="grid gap-1 border-t border-[#161616]/15 pt-2 text-sm hover:underline dark:border-[#f4f1ea]/15"
                    href={`/news/${slot.id}`}
                    key={`${slot.key}-${slot.id}`}
                  >
                    <span className="font-mono text-[11px] text-[#8a241c] dark:text-[#ff8b7e]">
                      {slot.label} / {slot.treatment}
                    </span>
                    <span className="leading-5 font-black">{slot.title}</span>
                    <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                      {slot.scoreLabel}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-[#161616]/25 pt-3 dark:border-[#f4f1ea]/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm leading-5 font-black">
                  Personalized Briefing Pack
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {lens.personalizedPack.summary}
                </p>
              </div>
              <span className="shrink-0 border border-[#161616]/25 px-2 py-1 font-mono text-[10px] uppercase dark:border-[#f4f1ea]/20">
                {lens.personalizedPack.label}
              </span>
            </div>
            {lens.personalizedPack.slots.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {lens.personalizedPack.slots.slice(0, 4).map((slot, index) => (
                  <article
                    className="grid gap-2 border-t border-[#161616]/15 pt-2 text-sm dark:border-[#f4f1ea]/15"
                    key={`${slot.label}-${slot.id}`}
                  >
                    <Link
                      className="grid gap-1 hover:underline"
                      href={`/news/${slot.id}`}
                    >
                      <span className="font-mono text-[11px] text-[#8a241c] dark:text-[#ff8b7e]">
                        {slot.label} / {slot.scoreLabel}
                      </span>
                      <span className="leading-5 font-black">{slot.title}</span>
                      <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {slot.sourceName} / {slot.categoryLabel}
                      </span>
                    </Link>
                    {slot.item ? (
                      <NewsEditionStoryActions
                        isPreview={isPreview}
                        item={slot.item}
                        rankSlot={index + 1}
                      />
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
          </div>

          <div className="border-t border-[#161616]/25 pt-3 dark:border-[#f4f1ea]/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm leading-5 font-black">
                  Recent Search Memory
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {lens.searchMemory.summary}
                </p>
              </div>
              <span className="shrink-0 border border-[#161616]/25 px-2 py-1 font-mono text-[10px] uppercase dark:border-[#f4f1ea]/20">
                {lens.searchMemory.label}
              </span>
            </div>
            {lens.searchMemory.matches.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {lens.searchMemory.matches.map((match) => (
                  <Link
                    className="grid gap-1 border-t border-[#161616]/15 pt-2 text-sm hover:underline dark:border-[#f4f1ea]/15"
                    href={match.href}
                    key={`${match.query}-${match.href}`}
                  >
                    <span className="font-mono text-[11px] text-[#8a241c] dark:text-[#ff8b7e]">
                      {match.query} / {match.resultCountLabel}
                    </span>
                    <span className="leading-5 font-black">{match.title}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="border-t border-[#161616]/25 pt-3 dark:border-[#f4f1ea]/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm leading-5 font-black">Scorecards</h3>
                <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {lens.scorecards.summary}
                </p>
              </div>
              <span className="shrink-0 border border-[#161616]/25 px-2 py-1 font-mono text-[10px] uppercase dark:border-[#f4f1ea]/20">
                {lens.scorecards.label}
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {lens.scorecards.scorecards.map((scorecard) => (
                <article
                  className="grid gap-3 border-t border-[#161616]/15 pt-3 dark:border-[#f4f1ea]/15"
                  key={scorecard.id}
                >
                  <div>
                    <h4 className="text-sm leading-5 font-black">
                      <Link
                        className="hover:underline"
                        href={`/news/${scorecard.id}`}
                      >
                        {scorecard.title}
                      </Link>
                    </h4>
                    <p className="mt-1 font-mono text-[11px] text-[#5b5750] dark:text-[#bbb4aa]">
                      {scorecard.sourceName} / {scorecard.scoreLabel}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {scorecard.components.slice(0, 4).map((component) => (
                      <span
                        className="border border-[#161616]/20 px-2 py-1 text-xs dark:border-[#f4f1ea]/15"
                        key={`${scorecard.id}-${component.label}`}
                      >
                        {component.label} {component.valueLabel}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function NewsBriefingReaderLens({
  generatedAt,
  items,
  status = "ready",
}: {
  generatedAt: string;
  items: NewsHomeItem[];
  status?: NewsHomeStatus;
}) {
  const trpc = useTRPC();
  const [visitorKey] = useState<string | null>(() =>
    readOrCreateNewsVisitorKey(),
  );
  const canUseServerReaderMemory = status === "ready" && Boolean(visitorKey);
  const [searchMemoryItems, setSearchMemoryItems] = useState<
    NewsSearchMemoryItem[]
  >(() => readStoredNewsSearchMemoryItems());
  const profileQuery = useQuery(
    trpc.news.profile.queryOptions(
      { visitorKey: visitorKey ?? undefined },
      { enabled: canUseServerReaderMemory },
    ),
  );
  const profileSnapshot = useSyncExternalStore(
    subscribeToNewsPreferenceProfileStorage,
    readNewsPreferenceProfileSnapshot,
    () => emptyNewsPreferenceProfileSnapshot,
  );
  const profile = useMemo(
    () => readStoredProfile(profileSnapshot),
    [profileSnapshot],
  );
  useEffect(() => {
    if (!profileQuery.data?.persisted) return;

    const nextProfile = selectHydratedNewsPreferenceProfile({
      localProfile: profile,
      serverProfile: profileQuery.data,
    });

    if (areNewsPreferenceProfilesEqual(profile, nextProfile)) return;

    writeStoredNewsPreferenceProfile(nextProfile);
  }, [profile, profileQuery.data]);
  useEffect(() => {
    return subscribeToNewsReaderMemoryStorage(() => {
      setSearchMemoryItems(readStoredNewsSearchMemoryItems());
    });
  }, []);

  const readerLocalHour = getBrowserReaderLocalHour();
  const lens = useMemo(
    () =>
      selectNewsBriefingReaderLens({
        generatedAt,
        items,
        profile,
        readerLocalHour,
        searchMemoryItems,
      }),
    [generatedAt, items, profile, readerLocalHour, searchMemoryItems],
  );

  return (
    <NewsBriefingReaderLensView
      isPreview={status !== "ready"}
      itemsLength={items.length}
      lens={lens}
    />
  );
}
