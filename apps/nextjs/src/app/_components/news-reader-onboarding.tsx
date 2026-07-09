"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  NewsPreferenceProfile,
  NewsRecommendationRotationObjective,
} from "@acme/validators";
import { Button } from "@acme/ui/button";
import {
  getNewsRecommendationAngleLabels,
  normalizeNewsPreferenceProfile,
} from "@acme/validators";

import type { NewsHomeItem, NewsHomeStatus } from "./news-home-model";
import type { NewsReaderCenterQuickStart } from "./news-reader-center";
import { useTRPC } from "~/trpc/react";
import { NewsEditionStoryActions } from "./news-edition-story-actions";
import {
  createDefaultNewsPreferenceProfile,
  selectHydratedNewsPreferenceProfile,
} from "./news-home-model";
import {
  applyNewsReaderCenterQuickStart,
  getNewsReaderCenterQuickStarts,
} from "./news-reader-center";
import {
  areNewsPreferenceProfilesEqual,
  emptyNewsPreferenceProfileSnapshot,
  parseStoredNewsPreferenceProfile,
  readNewsPreferenceProfileSnapshot,
  readOrCreateNewsVisitorKey,
  readStoredNewsForYouObjective,
  subscribeToNewsPreferenceProfileStorage,
  toNewsServerPreferenceProfileInput,
  writeStoredNewsForYouObjective,
  writeStoredNewsPreferenceProfile,
} from "./news-reader-profile-storage";

interface NewsReaderOnboardingMetric {
  label: string;
  value: string;
}

interface NewsReaderOnboardingObjective {
  detail: string;
  label: string;
  objective: NewsRecommendationRotationObjective;
}

export type NewsReaderOnboardingQuickStart = NewsReaderCenterQuickStart & {
  recommended: boolean;
};

interface NewsReaderOnboardingStoryPreviewItem {
  href: string;
  item: NewsHomeItem;
  matchLabel: string;
  reason: string;
  sourceName: string;
  title: string;
}

interface NewsReaderOnboardingStoryPreview {
  label: string;
  stories: NewsReaderOnboardingStoryPreviewItem[];
  summary: string;
}

export interface NewsReaderOnboardingPlan {
  label: string;
  metrics: NewsReaderOnboardingMetric[];
  objectives: NewsReaderOnboardingObjective[];
  quickStarts: NewsReaderOnboardingQuickStart[];
  selectedObjective: NewsRecommendationRotationObjective;
  storyPreview: NewsReaderOnboardingStoryPreview;
  summary: string;
}

const newsReaderOnboardingObjectives = [
  {
    detail:
      "Profile and local behavior move first in the recommendation rotation.",
    label: "Reader match",
    objective: "reader_match",
  },
  {
    detail:
      "Adjacent stories and newer angles move first in the recommendation rotation.",
    label: "Explore",
    objective: "exploration",
  },
  {
    detail:
      "Trending and high-velocity stories move first in the recommendation rotation.",
    label: "Market heat",
    objective: "market_heat",
  },
  {
    detail: "High-trust sources move first in the recommendation rotation.",
    label: "Source trust",
    objective: "source_trust",
  },
] as const satisfies readonly NewsReaderOnboardingObjective[];

const emptyNewsReaderOnboardingItems: readonly NewsHomeItem[] = [];

const isNewsReaderOnboardingObjective = (
  objective: NewsRecommendationRotationObjective,
) =>
  newsReaderOnboardingObjectives.some(
    (option) => option.objective === objective,
  );

const getNewsReaderOnboardingObjectiveLabel = (
  objective: NewsRecommendationRotationObjective,
) =>
  newsReaderOnboardingObjectives.find(
    (option) => option.objective === objective,
  )?.label ?? "Reader match";

const getNewsReaderOnboardingSignalCount = (profile: NewsPreferenceProfile) =>
  profile.preferredCategories.length +
  profile.preferredSources.length +
  profile.preferredEntities.length;

const normalizeNewsReaderOnboardingSignal = (value: string) =>
  value.trim().toLowerCase();

const getNewsReaderOnboardingStoryMatchLabel = (count: number) =>
  `${count} ${count === 1 ? "signal" : "signals"}`;

const getNewsReaderOnboardingStoryReason = ({
  hasAngleMatch,
  hasCategoryMatch,
  hasEntityMatch,
  hasSourceMatch,
}: {
  hasAngleMatch: boolean;
  hasCategoryMatch: boolean;
  hasEntityMatch: boolean;
  hasSourceMatch: boolean;
}) => {
  const labels: string[] = [];

  if (hasCategoryMatch) labels.push("topics");
  if (hasSourceMatch) labels.push("sources");
  if (hasEntityMatch) labels.push("entities");
  if (hasAngleMatch) labels.push("angles");

  if (labels.length === 0) return "Matches selected quick starts.";
  if (labels.length === 1) return `Matches selected ${labels[0]}.`;
  if (labels.length === 2) {
    return `Matches selected ${labels[0]} and ${labels[1]}.`;
  }

  return `Matches selected ${labels.slice(0, -1).join(", ")}, and ${
    labels[labels.length - 1]
  }.`;
};

const getNewsReaderOnboardingStorySignalMatch = ({
  item,
  profile,
}: {
  item: NewsHomeItem;
  profile: NewsPreferenceProfile;
}) => {
  const preferredCategories = new Set(
    profile.preferredCategories.map(normalizeNewsReaderOnboardingSignal),
  );
  const preferredSources = new Set(
    profile.preferredSources.map(normalizeNewsReaderOnboardingSignal),
  );
  const preferredEntities = new Set(
    profile.preferredEntities.map(normalizeNewsReaderOnboardingSignal),
  );
  const hasCategoryMatch = preferredCategories.has(
    normalizeNewsReaderOnboardingSignal(item.category),
  );
  const hasSourceMatch = preferredSources.has(
    normalizeNewsReaderOnboardingSignal(item.sourceSlug),
  );
  const matchedEntities = new Set<string>();
  const matchedAngles = new Set<string>();

  for (const entity of item.entities) {
    const normalizedEntity = normalizeNewsReaderOnboardingSignal(entity);

    if (!preferredEntities.has(normalizedEntity)) continue;

    matchedEntities.add(normalizedEntity);
  }

  for (const tag of item.tags) {
    const angleLabels = getNewsRecommendationAngleLabels([tag]);
    const normalizedTag = normalizeNewsReaderOnboardingSignal(tag);

    for (const angleLabel of angleLabels) {
      const normalizedAngle = normalizeNewsReaderOnboardingSignal(angleLabel);

      if (!preferredEntities.has(normalizedAngle)) continue;

      matchedAngles.add(normalizedAngle);
    }

    if (angleLabels.length > 0 || !preferredEntities.has(normalizedTag)) {
      continue;
    }

    matchedEntities.add(normalizedTag);
  }

  return {
    hasAngleMatch: matchedAngles.size > 0,
    hasCategoryMatch,
    hasEntityMatch: matchedEntities.size > 0,
    hasSourceMatch,
    signalCount:
      (hasCategoryMatch ? 1 : 0) +
      (hasSourceMatch ? 1 : 0) +
      matchedEntities.size +
      matchedAngles.size,
  };
};

const getNewsReaderOnboardingStoryPreview = ({
  items,
  limit = 4,
  profile,
  selectedQuickStartCount,
}: {
  items: readonly NewsHomeItem[];
  limit?: number;
  profile: NewsPreferenceProfile;
  selectedQuickStartCount: number;
}): NewsReaderOnboardingStoryPreview => {
  if (selectedQuickStartCount === 0) {
    return {
      label: "No Preview",
      stories: [],
      summary: "Select a quick start to preview matching current stories.",
    };
  }

  const stories = items
    .flatMap((item) => {
      const match = getNewsReaderOnboardingStorySignalMatch({
        item,
        profile,
      });

      if (match.signalCount === 0) return [];

      return [
        {
          href: `/news/${item.id}`,
          item,
          matchLabel: getNewsReaderOnboardingStoryMatchLabel(match.signalCount),
          reason: getNewsReaderOnboardingStoryReason(match),
          signalCount: match.signalCount,
          sourceName: item.sourceName,
          title: item.title,
          trendScore: item.trendScore,
        },
      ];
    })
    .sort((left, right) => {
      if (right.signalCount !== left.signalCount) {
        return right.signalCount - left.signalCount;
      }

      if (right.trendScore !== left.trendScore) {
        return right.trendScore - left.trendScore;
      }

      return left.title.localeCompare(right.title);
    });
  const storyCount = stories.length;

  return {
    label: storyCount > 0 ? "Current Story Preview" : "No Preview",
    stories: stories
      .slice(0, Math.max(0, Math.trunc(limit)))
      .map(({ href, item, matchLabel, reason, sourceName, title }) => ({
        href,
        item,
        matchLabel,
        reason,
        sourceName,
        title,
      })),
    summary:
      storyCount > 0
        ? `${storyCount} current ${
            storyCount === 1 ? "story matches" : "stories match"
          } selected quick starts.`
        : "No current stories match selected quick starts yet.",
  };
};

export const getNewsReaderOnboardingPlan = ({
  forYouObjective,
  items = emptyNewsReaderOnboardingItems,
  profile,
  selectedQuickStartKeys = [],
}: {
  forYouObjective: NewsRecommendationRotationObjective;
  items?: readonly NewsHomeItem[];
  profile: NewsPreferenceProfile;
  selectedQuickStartKeys?: readonly string[];
}): NewsReaderOnboardingPlan => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const quickStarts = getNewsReaderCenterQuickStarts(normalizedProfile).map(
    (quickStart, index) => ({
      ...quickStart,
      recommended: index === 0,
    }),
  );
  const selectedQuickStartKeySet = new Set(selectedQuickStartKeys);
  const selectedQuickStartCount = quickStarts.filter((quickStart) =>
    selectedQuickStartKeySet.has(quickStart.key),
  ).length;
  const previewProfile = quickStarts.reduce(
    (currentProfile, quickStart) =>
      selectedQuickStartKeySet.has(quickStart.key)
        ? applyNewsReaderCenterQuickStart({
            currentProfile,
            quickStart,
          })
        : currentProfile,
    normalizedProfile,
  );

  return {
    label: "Set Up For You",
    metrics: [
      {
        label: "Signals",
        value: String(getNewsReaderOnboardingSignalCount(normalizedProfile)),
      },
      { label: "Quick starts", value: String(quickStarts.length) },
      {
        label: "Objective",
        value: getNewsReaderOnboardingObjectiveLabel(forYouObjective),
      },
    ],
    objectives: [...newsReaderOnboardingObjectives],
    quickStarts,
    selectedObjective: forYouObjective,
    storyPreview: getNewsReaderOnboardingStoryPreview({
      items,
      profile: previewProfile,
      selectedQuickStartCount,
    }),
    summary:
      "Choose a starting mix for The New AI Times. The same local profile powers For You, editions, briefing, and search memory.",
  };
};

export const applyNewsReaderOnboardingSelection = ({
  currentForYouObjective = "reader_match",
  currentProfile,
  quickStartKeys,
  selectedObjective,
}: {
  currentForYouObjective?: NewsRecommendationRotationObjective;
  currentProfile: NewsPreferenceProfile;
  quickStartKeys: readonly string[];
  selectedObjective: NewsRecommendationRotationObjective;
}) => {
  const selectedQuickStartKeys = new Set(quickStartKeys);
  let profile = normalizeNewsPreferenceProfile(currentProfile);

  for (const quickStart of getNewsReaderCenterQuickStarts(profile)) {
    if (!selectedQuickStartKeys.has(quickStart.key)) continue;

    profile = applyNewsReaderCenterQuickStart({
      currentProfile: profile,
      quickStart,
    });
  }

  return {
    forYouObjective: isNewsReaderOnboardingObjective(selectedObjective)
      ? selectedObjective
      : currentForYouObjective,
    profile,
  };
};

export function NewsReaderOnboardingView({
  isPreview = false,
  onFinish,
  onObjectiveSelect,
  onQuickStartToggle,
  plan,
  selectedObjective,
  selectedQuickStartKeys,
}: {
  isPreview?: boolean;
  onFinish?: () => void;
  onObjectiveSelect?: (objective: NewsRecommendationRotationObjective) => void;
  onQuickStartToggle?: (quickStartKey: string) => void;
  plan: NewsReaderOnboardingPlan;
  selectedObjective: NewsRecommendationRotationObjective;
  selectedQuickStartKeys: readonly string[];
}) {
  return (
    <main className="min-h-[100dvh] bg-[#f7f5ef] text-[#161616] transition-colors dark:bg-[#101010] dark:text-[#f4f1ea]">
      <header className="border-b border-[#161616] dark:border-[#f4f1ea]">
        <div className="container grid gap-4 py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <Link
              className="font-mono text-xs tracking-[0.18em] uppercase hover:underline"
              href="/"
            >
              The New AI Times
            </Link>
            <p className="mt-4 font-mono text-xs tracking-[0.18em] uppercase">
              Reader setup
            </p>
            <h1 className="mt-2 text-4xl leading-none font-black tracking-normal sm:text-6xl">
              {plan.label}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4a4a4a] dark:text-[#c8c4ba]">
              {plan.summary}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2 font-mono text-xs lg:min-w-[28rem]">
            {plan.metrics.map((metric) => (
              <div
                className="border border-[#161616]/25 bg-[#fffdf7] p-3 text-center dark:border-[#f4f1ea]/20 dark:bg-[#181818]"
                key={metric.label}
              >
                <dt className="text-[10px] tracking-[0.12em] uppercase">
                  {metric.label}
                </dt>
                <dd className="mt-1 text-2xl font-black">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <section className="container grid grid-cols-[minmax(0,1fr)] gap-6 py-6 lg:grid-cols-[minmax(0,0.64fr)_minmax(280px,0.36fr)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4">
          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">
                  {plan.storyPreview.label}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {plan.storyPreview.summary}
                </p>
              </div>
              <span className="border border-[#161616]/35 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/35">
                {plan.storyPreview.stories.length} shown
              </span>
            </div>
            {plan.storyPreview.stories.length > 0 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {plan.storyPreview.stories.map((story, index) => (
                  <article
                    className="grid gap-3 border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20"
                    key={story.href}
                  >
                    <Link
                      className="group grid min-h-32 gap-3 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                      href={story.href}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 text-sm leading-5 font-black group-hover:underline">
                          {story.title}
                        </p>
                        <span className="shrink-0 border border-[#8a241c]/50 px-2 py-0.5 font-mono text-[10px] text-[#8a241c] uppercase dark:border-[#ff8b7e]/50 dark:text-[#ff8b7e]">
                          {story.matchLabel}
                        </span>
                      </div>
                      <p className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {story.reason}
                      </p>
                      <p className="font-mono text-[10px] tracking-[0.14em] text-[#5b5750] uppercase dark:text-[#bbb4aa]">
                        {story.sourceName}
                      </p>
                    </Link>
                    <NewsEditionStoryActions
                      isPreview={isPreview}
                      item={story.item}
                      rankSlot={index + 1}
                    />
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Quick starts</h2>
                <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  Pick one or more mixes to seed the local For You profile.
                </p>
              </div>
              <span className="border border-[#161616]/35 px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]/35">
                {selectedQuickStartKeys.length} selected
              </span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {plan.quickStarts.map((quickStart) => {
                const selected = selectedQuickStartKeys.includes(
                  quickStart.key,
                );

                return (
                  <article
                    className="grid gap-3 border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20"
                    key={quickStart.key}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm leading-5 font-black">
                            {quickStart.label}
                          </h3>
                          {quickStart.recommended ? (
                            <span className="border border-[#8a241c]/50 px-2 py-0.5 font-mono text-[10px] text-[#8a241c] uppercase dark:border-[#ff8b7e]/50 dark:text-[#ff8b7e]">
                              Recommended
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                          {quickStart.summary}
                        </p>
                      </div>
                      <Button
                        className="h-8 rounded-none px-2 text-xs whitespace-nowrap"
                        type="button"
                        variant={selected ? "default" : "outline"}
                        onClick={() => onQuickStartToggle?.(quickStart.key)}
                      >
                        {selected ? "Selected" : "Select"}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {quickStart.signals.map((signal) => (
                        <span
                          className={`border px-2 py-1 text-xs ${
                            signal.active
                              ? "border-[#8a241c] bg-[#8a241c] text-[#fffdf7] dark:border-[#ff8b7e] dark:bg-[#ff8b7e] dark:text-[#181818]"
                              : "border-[#161616]/25 text-[#5b5750] dark:border-[#f4f1ea]/20 dark:text-[#bbb4aa]"
                          }`}
                          key={`${quickStart.key}-${signal.kind}-${signal.signal}`}
                        >
                          {signal.label}
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4">
          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <h2 className="text-xl font-black">For You objective</h2>
            <div className="mt-4 grid gap-3">
              {plan.objectives.map((option) => (
                <Button
                  className="h-auto w-full min-w-0 justify-start rounded-none px-3 py-3 text-left whitespace-normal"
                  key={option.objective}
                  type="button"
                  variant={
                    selectedObjective === option.objective
                      ? "default"
                      : "outline"
                  }
                  onClick={() => onObjectiveSelect?.(option.objective)}
                >
                  <span className="grid min-w-0 gap-1">
                    <span className="font-semibold">{option.label}</span>
                    <span className="text-xs leading-5 opacity-75">
                      {option.detail}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          </section>

          <section className="border border-[#161616] bg-[#161616] p-5 text-[#f4f1ea] dark:border-[#f4f1ea] dark:bg-[#f4f1ea] dark:text-[#161616]">
            <h2 className="text-xl font-black">Start reading</h2>
            <p className="mt-2 text-sm leading-6 opacity-80">
              Your choices stay on this device and can be edited later from the
              Reader Center.
            </p>
            <div className="mt-4 grid gap-2">
              <Button
                className="rounded-none"
                disabled={!onFinish}
                type="button"
                variant="secondary"
                onClick={onFinish}
              >
                Finish setup
              </Button>
              <Button asChild className="rounded-none" variant="outline">
                <Link href="/reader">Reader Center</Link>
              </Button>
              <Button asChild className="rounded-none" variant="outline">
                <Link href="/">Front page</Link>
              </Button>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

export function NewsReaderOnboarding({
  items = emptyNewsReaderOnboardingItems,
  status = "ready",
}: {
  items?: readonly NewsHomeItem[];
  status?: NewsHomeStatus;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const defaultProfile = useMemo(
    () => createDefaultNewsPreferenceProfile(),
    [],
  );
  const profileSnapshot = useSyncExternalStore(
    subscribeToNewsPreferenceProfileStorage,
    readNewsPreferenceProfileSnapshot,
    () => emptyNewsPreferenceProfileSnapshot,
  );
  const profile = useMemo(
    () =>
      parseStoredNewsPreferenceProfile({
        defaultProfile,
        stored: profileSnapshot,
      }),
    [defaultProfile, profileSnapshot],
  );
  const [visitorKey] = useState<string | null>(() =>
    readOrCreateNewsVisitorKey(),
  );
  const canUseServerReaderMemory = status === "ready" && Boolean(visitorKey);
  const [forYouObjective, setForYouObjective] =
    useState<NewsRecommendationRotationObjective>(() =>
      readStoredNewsForYouObjective(),
    );
  const [selectedQuickStartKeys, setSelectedQuickStartKeys] = useState<
    string[]
  >(["agent-builder"]);
  const plan = useMemo(
    () =>
      getNewsReaderOnboardingPlan({
        forYouObjective,
        items,
        profile,
        selectedQuickStartKeys,
      }),
    [forYouObjective, items, profile, selectedQuickStartKeys],
  );
  const profileQuery = useQuery(
    trpc.news.profile.queryOptions(
      { visitorKey: visitorKey ?? undefined },
      { enabled: canUseServerReaderMemory },
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

  useEffect(() => {
    if (!profileQuery.data?.persisted) return;

    const nextProfile = selectHydratedNewsPreferenceProfile({
      localProfile: profile,
      serverProfile: profileQuery.data,
    });

    if (areNewsPreferenceProfilesEqual(profile, nextProfile)) return;

    writeStoredNewsPreferenceProfile(nextProfile);
  }, [profile, profileQuery.data]);

  const toggleQuickStart = (quickStartKey: string) => {
    setSelectedQuickStartKeys((current) =>
      current.includes(quickStartKey)
        ? current.filter((key) => key !== quickStartKey)
        : [...current, quickStartKey],
    );
  };

  const finishSetup = () => {
    const navigateHome = () => {
      if (typeof window !== "undefined") {
        window.location.assign("/");
      }
    };
    const selection = applyNewsReaderOnboardingSelection({
      currentForYouObjective: forYouObjective,
      currentProfile: profile,
      quickStartKeys: selectedQuickStartKeys,
      selectedObjective: forYouObjective,
    });

    writeStoredNewsPreferenceProfile(selection.profile);
    writeStoredNewsForYouObjective(selection.forYouObjective);
    setForYouObjective(selection.forYouObjective);

    if (canUseServerReaderMemory && visitorKey) {
      updateProfile.mutate(
        {
          profile: toNewsServerPreferenceProfileInput(selection.profile),
          visitorKey,
        },
        {
          onSettled: navigateHome,
        },
      );
      return;
    }

    navigateHome();
  };
  const canFinishSetup = !(
    updateProfile.isPending ||
    (canUseServerReaderMemory && profileQuery.isPending)
  );

  return (
    <NewsReaderOnboardingView
      isPreview={status !== "ready"}
      plan={plan}
      selectedObjective={forYouObjective}
      selectedQuickStartKeys={selectedQuickStartKeys}
      onFinish={canFinishSetup ? finishSetup : undefined}
      onObjectiveSelect={setForYouObjective}
      onQuickStartToggle={toggleQuickStart}
    />
  );
}
