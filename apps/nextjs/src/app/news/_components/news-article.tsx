"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  NewsPreferenceProfile,
  ReaderInteractionAction,
} from "@acme/validators";
import { Button } from "@acme/ui/button";
import {
  dedupeNewsItems,
  getNewsExplorationInterval,
  normalizeNewsPreferenceProfile,
  rankNewsForReader,
  selectDiverseNewsFeed,
  updateReaderProfileWithInteraction,
} from "@acme/validators";

import type { NewsReaderMemoryItem } from "../../_components/news-home-model";
import type { NewsArticleItem, NewsHomeItem } from "../../_data/news";
import type { NewsArticleReadMilestone } from "./news-article-model";
import { useTRPC } from "~/trpc/react";
import {
  createDefaultNewsPreferenceProfile,
  mergeNewsReaderMemoryItems,
  selectHydratedNewsPreferenceProfile,
  selectStoredNewsReaderMemoryItems,
  stripPersistedNewsPreferenceProfile,
} from "../../_components/news-home-model";
import {
  getNewsArticleDeepReadTrainingState,
  getNewsArticleDigest,
  getNewsArticleFeedbackLoop,
  getNewsArticleHeroVisual,
  getNewsArticleLearningImpact,
  getNewsArticleLocalHistoryItem,
  getNewsArticleLocalMemoryItemForAction,
  getNewsArticleNextReads,
  getNewsArticleReadDepthCheckpoints,
  getNewsArticleReaderFit,
  getNewsArticleReaderSignalCacheScopes,
  getNewsArticleReadingPath,
  getNewsArticleReadTrainingReceipt,
  getNewsArticleServerProfileAuditDisplay,
  getNewsArticleSourceLens,
  selectNewsArticleReadMilestone,
  shouldApplyNewsArticleLocalProfileFromMilestone,
  shouldApplyNewsArticleServerProfileFromInteraction,
  shouldPersistNewsArticleReaderSignals,
  shouldTrackNewsArticleReaderSignals,
} from "./news-article-model";

interface NewsArticleProps {
  article: NewsArticleItem;
  related: NewsHomeItem[];
}

const profileStorageKey = "new-ai-times-profile";
const savedStorageKey = "new-ai-times-saved";
const historyStorageKey = "new-ai-times-history";
const guardrailStorageKey = "new-ai-times-guardrails";
const visitorStorageKey = "new-ai-times-visitor-key";

const categoryLabels: Record<string, string> = {
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
};

const formatCategory = (category: string) =>
  categoryLabels[category] ?? category;

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

const readStoredMemoryItems = (storageKey: string) => {
  if (typeof window === "undefined") return [];

  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return [];

  try {
    return selectStoredNewsReaderMemoryItems(JSON.parse(stored) as unknown);
  } catch {
    return [];
  }
};

const writeStoredMemoryItem = ({
  item,
  storageKey,
}: {
  item: NewsReaderMemoryItem;
  storageKey: string;
}) => {
  window.localStorage.setItem(
    storageKey,
    JSON.stringify(
      mergeNewsReaderMemoryItems({
        localItems: [item],
        serverItems: readStoredMemoryItems(storageKey),
      }),
    ),
  );
};

const writeStoredHistoryItem = ({
  article,
  viewedAt,
}: {
  article: NewsArticleItem;
  viewedAt: string;
}) => {
  writeStoredMemoryItem({
    item: getNewsArticleLocalHistoryItem({
      article,
      viewedAt,
    }),
    storageKey: historyStorageKey,
  });
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

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));

const paragraphsFromArticle = (article: NewsArticleItem) => {
  const text = article.bodyText?.trim() ?? article.summary;
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.length > 0 ? paragraphs : [article.summary];
};

export function NewsArticle({ article, related }: NewsArticleProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<NewsPreferenceProfile>(
    createDefaultNewsPreferenceProfile,
  );
  const [feedbackLoop, setFeedbackLoop] = useState<ReturnType<
    typeof getNewsArticleFeedbackLoop
  > | null>(null);
  const [visitorKey, setVisitorKey] = useState<string | null>(null);
  const [readTrainingMilestones, setReadTrainingMilestones] = useState<
    NewsArticleReadMilestone[]
  >([]);
  const recordedReadMilestonesRef = useRef<NewsArticleReadMilestone[]>([]);
  const articleReadCheckpointRefs = useRef(
    new Map<NewsArticleReadMilestone, HTMLSpanElement>(),
  );
  const canPersistReaderSignals = shouldPersistNewsArticleReaderSignals({
    articleId: article.id,
    visitorKey,
  });
  const canTrackReaderSignals = shouldTrackNewsArticleReaderSignals({
    visitorKey,
  });
  const articleReadDepthCheckpoints = useMemo(
    () => getNewsArticleReadDepthCheckpoints(),
    [],
  );
  const profileQuery = useQuery(
    trpc.news.profile.queryOptions(
      { visitorKey: visitorKey ?? undefined },
      { enabled: canPersistReaderSignals },
    ),
  );
  const invalidateReaderSignalQueries = async () => {
    const invalidations = getNewsArticleReaderSignalCacheScopes().map(
      (scope) => {
        switch (scope) {
          case "forYou":
            return queryClient.invalidateQueries(trpc.news.forYou.pathFilter());
          case "profile":
            return queryClient.invalidateQueries(
              trpc.news.profile.pathFilter(),
            );
          case "saved":
            return queryClient.invalidateQueries(trpc.news.saved.pathFilter());
          case "history":
            return queryClient.invalidateQueries(
              trpc.news.history.pathFilter(),
            );
        }
      },
    );

    await Promise.all(invalidations);
  };
  const recordInteraction = useMutation(
    trpc.news.recordInteraction.mutationOptions({
      onSuccess: async (serverProfile, interaction) => {
        if (shouldApplyNewsArticleServerProfileFromInteraction(interaction)) {
          const nextProfile =
            stripPersistedNewsPreferenceProfile(serverProfile);
          setProfile(nextProfile);
          writeStoredProfile(nextProfile);
        }

        await invalidateReaderSignalQueries();
      },
    }),
  );

  useEffect(() => {
    setProfile(readStoredProfile());
    setVisitorKey(readOrCreateVisitorKey());
  }, []);

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
    recordedReadMilestonesRef.current = [];
    setReadTrainingMilestones([]);
  }, [article.id]);

  useEffect(() => {
    if (!canTrackReaderSignals || !visitorKey) return;

    const milestone = selectNewsArticleReadMilestone({
      readPercent: 0.2,
      recordedMilestones: recordedReadMilestonesRef.current,
    });

    if (!milestone) return;

    recordedReadMilestonesRef.current = [
      ...recordedReadMilestonesRef.current,
      milestone.key,
    ];
    setReadTrainingMilestones(recordedReadMilestonesRef.current);

    if (milestone.shouldShowFeedback) {
      setProfile((current) => {
        const nextProfile = updateReaderProfileWithInteraction(
          current,
          article,
          {
            action: "view",
            readPercent: milestone.readPercent,
          },
        );
        writeStoredProfile(nextProfile);
        return nextProfile;
      });
    }

    if (canPersistReaderSignals) {
      recordInteraction.mutate({
        visitorKey,
        newsItemId: article.id,
        action: "view",
        metadata: {
          readMilestone: milestone.key,
          readPercent: milestone.readPercent,
          surface: "article",
        },
      });
    }
    // This should run once per article open after the reader key is available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id, canPersistReaderSignals, canTrackReaderSignals, visitorKey]);

  useEffect(() => {
    if (!canTrackReaderSignals || !visitorKey) return;

    const checkpointNodes = articleReadDepthCheckpoints
      .map((checkpoint) => ({
        ...checkpoint,
        node: articleReadCheckpointRefs.current.get(checkpoint.key),
      }))
      .filter(
        (
          checkpoint,
        ): checkpoint is (typeof articleReadDepthCheckpoints)[number] & {
          node: HTMLSpanElement;
        } => Boolean(checkpoint.node),
      );

    if (
      checkpointNodes.length === 0 ||
      typeof window.IntersectionObserver !== "function"
    ) {
      return;
    }

    const recordCheckpointRead = (readPercent: number) => {
      const milestone = selectNewsArticleReadMilestone({
        readPercent,
        recordedMilestones: recordedReadMilestonesRef.current,
      });

      if (!milestone) return;

      recordedReadMilestonesRef.current = [
        ...recordedReadMilestonesRef.current,
        milestone.key,
      ];
      setReadTrainingMilestones(recordedReadMilestonesRef.current);

      if (shouldApplyNewsArticleLocalProfileFromMilestone(milestone)) {
        setProfile((current) => {
          const trainingState = getNewsArticleDeepReadTrainingState({
            article,
            beforeProfile: current,
            formatCategory,
            readPercent: milestone.readPercent,
          });

          if (!trainingState) return current;

          if (milestone.shouldShowFeedback) {
            setFeedbackLoop(trainingState.feedbackLoop);
          }
          writeStoredProfile(trainingState.profile);
          writeStoredHistoryItem({
            article,
            viewedAt: new Date().toISOString(),
          });
          return trainingState.profile;
        });
      }
      if (canPersistReaderSignals) {
        recordInteraction.mutate({
          visitorKey,
          newsItemId: article.id,
          action: "view",
          metadata: {
            readMilestone: milestone.key,
            readPercent: milestone.readPercent,
            surface: "article",
          },
        });
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const checkpoint = checkpointNodes.find(
            ({ node }) => node === entry.target,
          );

          if (!checkpoint) return;

          recordCheckpointRead(checkpoint.readPercent);
          observer.unobserve(checkpoint.node);
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -20% 0px",
        threshold: 0,
      },
    );

    checkpointNodes.forEach(({ node }) => observer.observe(node));

    return () => {
      observer.disconnect();
    };
    // This effect tracks browser reading depth for the active article body.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    article.id,
    articleReadDepthCheckpoints,
    canPersistReaderSignals,
    canTrackReaderSignals,
    visitorKey,
  ]);

  const rankedRelated = useMemo(
    () =>
      selectDiverseNewsFeed(
        rankNewsForReader(dedupeNewsItems(related), profile),
        {
          explorationInterval: getNewsExplorationInterval(profile),
          limit: related.length,
        },
      ),
    [profile, related],
  );
  const readingPath = useMemo(
    () =>
      getNewsArticleReadingPath({
        article,
        formatCategory,
        limit: 5,
        relatedItems: rankedRelated,
      }),
    [article, rankedRelated],
  );
  const readerFit = useMemo(
    () =>
      getNewsArticleReaderFit({
        article,
        formatCategory,
        profile,
        relatedItems: rankedRelated,
      }),
    [article, profile, rankedRelated],
  );
  const learningImpact = useMemo(
    () =>
      getNewsArticleLearningImpact({
        article,
        formatCategory,
        profile,
        relatedItems: rankedRelated,
      }),
    [article, profile, rankedRelated],
  );
  const readTrainingReceipt = useMemo(
    () =>
      getNewsArticleReadTrainingReceipt({
        article,
        formatCategory,
        recordedMilestones: readTrainingMilestones,
      }),
    [article, readTrainingMilestones],
  );
  const nextReads = useMemo(
    () =>
      getNewsArticleNextReads({
        article,
        formatCategory,
        limit: 4,
        profile,
        relatedItems: rankedRelated,
      }),
    [article, profile, rankedRelated],
  );
  const articleDigest = useMemo(
    () => getNewsArticleDigest({ article }),
    [article],
  );
  const sourceLens = useMemo(
    () => getNewsArticleSourceLens({ article }),
    [article],
  );
  const serverProfileAudit = getNewsArticleServerProfileAuditDisplay(
    profileQuery.data?.audit,
  );
  const articleFeedbackLoop =
    feedbackLoop ??
    getNewsArticleFeedbackLoop({
      action: null,
      afterProfile: profile,
      article,
      beforeProfile: profile,
      formatCategory,
    });
  const paragraphs = paragraphsFromArticle(article);
  const heroVisual = getNewsArticleHeroVisual({
    article,
    formatCategory,
  });

  const recordAction = (action: ReaderInteractionAction) => {
    const occurredAt = new Date().toISOString();
    const nextProfile = updateReaderProfileWithInteraction(profile, article, {
      action,
    });
    setFeedbackLoop(
      getNewsArticleFeedbackLoop({
        action,
        afterProfile: nextProfile,
        article,
        beforeProfile: profile,
        formatCategory,
      }),
    );
    setProfile(nextProfile);
    writeStoredProfile(nextProfile);

    const localMemoryItem = getNewsArticleLocalMemoryItemForAction({
      action,
      article,
      occurredAt,
    });

    if (localMemoryItem) {
      writeStoredMemoryItem({
        item: localMemoryItem.item,
        storageKey:
          localMemoryItem.storage === "saved"
            ? savedStorageKey
            : guardrailStorageKey,
      });
    }

    if (canPersistReaderSignals && visitorKey) {
      recordInteraction.mutate({
        visitorKey,
        newsItemId: article.id,
        action,
        metadata: { surface: "article" },
      });
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#f7f5ef] text-[#161616] dark:bg-[#101010] dark:text-[#f4f1ea]">
      <header className="border-b border-[#161616] dark:border-[#f4f1ea]">
        <div className="container flex flex-col gap-4 py-5 lg:flex-row lg:items-end lg:justify-between">
          <Link
            className="text-3xl leading-none font-black tracking-normal sm:text-5xl"
            href="/"
          >
            The New AI Times
          </Link>
          <p className="max-w-xl text-sm leading-6 text-[#4a4a4a] dark:text-[#c8c4ba]">
            Reading signals from this article are folded back into your front
            page ranking on this device.
          </p>
        </div>
      </header>

      <article className="container grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-semibold tracking-normal text-[#8a241c] uppercase dark:text-[#ff8b7e]">
            <span>{formatCategory(article.category)}</span>
            <span>/</span>
            <span>{article.sourceName}</span>
            <span>/</span>
            <span>{formatDate(article.publishedAt)}</span>
          </div>

          <h1 className="max-w-5xl text-4xl leading-[1.04] font-black tracking-normal sm:text-6xl lg:text-7xl">
            {article.title}
          </h1>
          <p className="mt-6 max-w-3xl border-l-4 border-[#8a241c] pl-5 text-xl leading-8 text-[#4a4a4a] dark:border-[#ff8b7e] dark:text-[#c8c4ba]">
            {article.summary}
          </p>

          <figure className="mt-8">
            {heroVisual.kind === "image" ? (
              <div
                aria-label={heroVisual.alt}
                className="min-h-[320px] border border-[#161616] bg-cover bg-center grayscale dark:border-[#f4f1ea]"
                role="img"
                style={{ backgroundImage: `url(${heroVisual.imageUrl})` }}
              />
            ) : (
              <div className="flex min-h-[260px] items-end justify-between border border-[#161616] bg-[#e8e1d4] p-5 dark:border-[#f4f1ea] dark:bg-[#24211d]">
                <span className="max-w-[14rem] text-4xl leading-none font-black">
                  {heroVisual.label}
                </span>
                <span className="font-mono text-6xl leading-none text-[#8a241c] dark:text-[#ff8b7e]">
                  AI
                </span>
              </div>
            )}
            <figcaption className="mt-2 text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
              {heroVisual.label} / {article.sourceName}
            </figcaption>
          </figure>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              className="rounded-none"
              type="button"
              onClick={() => recordAction("save")}
            >
              Save signal
            </Button>
            <Button
              className="rounded-none"
              type="button"
              variant="outline"
              onClick={() => recordAction("share")}
            >
              Share signal
            </Button>
            <Button
              className="rounded-none"
              type="button"
              variant="outline"
              onClick={() => recordAction("hide")}
            >
              Less like this
            </Button>
            <Button asChild className="rounded-none" variant="outline">
              <a
                href={article.canonicalUrl ?? article.originalUrl}
                onClick={() => recordAction("click_source")}
                rel="nofollow noopener noreferrer"
                target="_blank"
              >
                Source
              </a>
            </Button>
          </div>

          <div className="relative mt-10 max-w-3xl space-y-7 text-lg leading-8 text-[#2d2d2d] dark:text-[#ddd8ce]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-px"
            >
              {articleReadDepthCheckpoints.map((checkpoint) => (
                <span
                  className="absolute h-px w-px"
                  key={checkpoint.key}
                  ref={(node) => {
                    if (node) {
                      articleReadCheckpointRefs.current.set(
                        checkpoint.key,
                        node,
                      );
                    } else {
                      articleReadCheckpointRefs.current.delete(checkpoint.key);
                    }
                  }}
                  style={{ top: `${checkpoint.topPercent}%` }}
                />
              ))}
            </div>
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>

        <aside className="grid content-start gap-6">
          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Fast Brief</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {articleDigest.sourceLine}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {articleDigest.readTimeLabel}
              </span>
            </div>
            <ol className="mt-4 grid gap-3 text-sm">
              {articleDigest.facts.map((fact, index) => (
                <li
                  key={fact}
                  className="grid grid-cols-[1.5rem_1fr] gap-3 border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                >
                  <span className="font-mono text-[#8a241c] dark:text-[#ff8b7e]">
                    {index + 1}
                  </span>
                  <span className="leading-6 text-[#2d2d2d] dark:text-[#ddd8ce]">
                    {fact}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-[#161616]/20 pt-3 text-xs dark:border-[#f4f1ea]/15">
              {[...articleDigest.entities, ...articleDigest.tags].map(
                (signal) => (
                  <span
                    key={signal}
                    className="border border-[#161616]/30 px-2 py-1 dark:border-[#f4f1ea]/30"
                  >
                    {signal}
                  </span>
                ),
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Source Lens</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {sourceLens.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-xs dark:border-[#f4f1ea]">
                {sourceLens.tone}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              {sourceLens.lines.map((line) => (
                <SignalLine
                  key={line.label}
                  label={line.label}
                  value={line.value}
                />
              ))}
            </dl>
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Server Profile</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {serverProfileAudit.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 text-right font-mono text-xs dark:border-[#f4f1ea]">
                {serverProfileAudit.label}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-3 border-y border-[#161616]/20 text-center text-xs dark:border-[#f4f1ea]/15">
              {serverProfileAudit.metrics.map((metric) => (
                <div
                  className="border-r border-[#161616]/20 py-3 last:border-r-0 dark:border-[#f4f1ea]/15"
                  key={metric.label}
                >
                  <dt className="text-[#5b5750] dark:text-[#bbb4aa]">
                    {metric.label}
                  </dt>
                  <dd className="mt-1 font-mono text-base">{metric.value}</dd>
                </div>
              ))}
            </dl>
            {serverProfileAudit.chips.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {serverProfileAudit.chips.map((chip) => (
                  <span
                    key={chip}
                    className="border border-[#161616]/30 px-2 py-1 text-xs dark:border-[#f4f1ea]/30"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Reader Fit</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {readerFit.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 text-right font-mono text-xs dark:border-[#f4f1ea]">
                {readerFit.label}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-3 border-y border-[#161616]/20 text-center text-xs dark:border-[#f4f1ea]/15">
              {readerFit.metrics.map((metric) => (
                <div
                  className="border-r border-[#161616]/20 py-3 last:border-r-0 dark:border-[#f4f1ea]/15"
                  key={metric.label}
                >
                  <dt className="text-[#5b5750] dark:text-[#bbb4aa]">
                    {metric.label}
                  </dt>
                  <dd className="mt-1 font-mono text-base">{metric.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 grid gap-3 text-sm">
              {readerFit.reasons.map((reason) => (
                <SignalLine
                  key={reason.label}
                  label={reason.label}
                  value={reason.detail}
                />
              ))}
            </div>
            {readerFit.nextStep ? (
              <Link
                className="mt-4 block border-t border-[#161616]/20 pt-4 text-sm leading-5 hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                href={`/news/${readerFit.nextStep.id}`}
              >
                <span className="block font-mono text-xs">
                  {readerFit.nextStep.label} / {readerFit.nextStep.scoreLabel}
                </span>
                <span className="font-bold">{readerFit.nextStep.title}</span>
                <span className="mt-1 block text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                  {readerFit.nextStep.reason}
                </span>
              </Link>
            ) : (
              <p className="mt-4 border-t border-[#161616]/20 pt-4 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                Open another story or save this one to train the article queue.
              </p>
            )}
          </section>

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Read Training</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {readTrainingReceipt.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 text-right font-mono text-xs dark:border-[#f4f1ea]">
                {readTrainingReceipt.label}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-3 border-y border-[#161616]/20 text-center text-xs dark:border-[#f4f1ea]/15">
              {readTrainingReceipt.metrics.map((metric) => (
                <div
                  className="border-r border-[#161616]/20 py-3 last:border-r-0 dark:border-[#f4f1ea]/15"
                  key={metric.label}
                >
                  <dt className="text-[#5b5750] dark:text-[#bbb4aa]">
                    {metric.label}
                  </dt>
                  <dd className="mt-1 font-mono text-base">{metric.value}</dd>
                </div>
              ))}
            </dl>
            <ol className="mt-4 grid gap-3 text-sm">
              {readTrainingReceipt.stages.map((stage) => (
                <li
                  className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                  key={stage.key}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold">{stage.label}</span>
                    <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                      {stage.status === "done"
                        ? "Done"
                        : stage.status === "next"
                          ? `Next / ${stage.target}`
                          : `Wait / ${stage.target}`}
                    </span>
                  </div>
                  <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {stage.detail}
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
              {readTrainingReceipt.nextStep}
            </p>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Feedback Loop</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {articleFeedbackLoop.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 text-right font-mono text-xs dark:border-[#f4f1ea]">
                {articleFeedbackLoop.label}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {articleFeedbackLoop.metrics.map((metric) => (
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
              {articleFeedbackLoop.notices.map((notice) => (
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

          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Learning Impact</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {learningImpact.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 text-right font-mono text-xs dark:border-[#f4f1ea]">
                {learningImpact.label}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {learningImpact.metrics.map((metric) => (
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
              {learningImpact.actions.map((action) => (
                <div
                  key={action.action}
                  className="border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold">{action.label}</span>
                    <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                      {action.signalLabel} / {action.biasLabel}
                    </span>
                  </div>
                  <p className="mt-1 leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {action.detail}
                  </p>
                </div>
              ))}
            </div>
            {learningImpact.nextStories.length > 0 ? (
              <div className="mt-4 border-t border-[#161616]/20 pt-4 dark:border-[#f4f1ea]/15">
                <h3 className="text-sm font-black">Next Recommendation</h3>
                <div className="mt-2 grid gap-3">
                  {learningImpact.nextStories.slice(0, 2).map((item) => (
                    <Link
                      className="text-sm leading-5 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                      href={`/news/${item.id}`}
                      key={item.id}
                    >
                      <span className="block font-mono text-xs">
                        {item.reason} / {item.scoreLabel}
                      </span>
                      <span className="font-bold">{item.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Next Reads</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {nextReads.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 text-right font-mono text-xs dark:border-[#f4f1ea]">
                {nextReads.label}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-4 border-y border-[#161616]/20 text-center text-xs dark:border-[#f4f1ea]/15">
              {nextReads.metrics.map((metric) => (
                <div
                  className="border-r border-[#161616]/20 py-3 last:border-r-0 dark:border-[#f4f1ea]/15"
                  key={metric.label}
                >
                  <dt className="text-[#5b5750] dark:text-[#bbb4aa]">
                    {metric.label}
                  </dt>
                  <dd className="mt-1 font-mono text-base">{metric.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 grid gap-3">
              {nextReads.reads.length > 0 ? (
                nextReads.reads.map((item) => (
                  <Link
                    className="border-t border-[#161616]/20 pt-3 text-sm leading-5 hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                    href={`/news/${item.id}`}
                    key={item.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-semibold">{item.title}</span>
                      <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                        {item.statusLabel}
                      </span>
                    </div>
                    <span className="mt-1 block font-mono text-xs">
                      {item.categoryLabel} / {item.sourceName} /{" "}
                      {item.scoreLabel}
                    </span>
                    <span className="mt-1 block text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                      {item.reason}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Continue reading and saving stories to unlock the article
                  queue.
                </p>
              )}
            </div>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <h2 className="text-xl font-black">Article Signals</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              {readingPath.context.map((signal) => (
                <SignalLine
                  key={signal.label}
                  label={signal.label}
                  value={signal.value}
                />
              ))}
              <SignalLine
                label="Reader bias"
                value={`F${profile.recencyBias.toFixed(1)} / N${profile.noveltyBias.toFixed(1)}`}
              />
            </dl>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Reading Path</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {readingPath.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
                {readingPath.recommendations.length}
              </span>
            </div>
            <div className="mt-4 grid gap-4">
              {readingPath.recommendations.length > 0 ? (
                readingPath.recommendations.map((item) => (
                  <Link
                    className="border-t border-[#161616]/20 pt-4 text-sm leading-5 hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                    href={`/news/${item.id}`}
                    key={item.id}
                  >
                    <span className="block font-mono text-xs">
                      {item.scoreLabel}
                    </span>
                    <span className="font-bold">{item.title}</span>
                    <span className="mt-1 block text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                      {item.reason}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  Related stories will appear once the ingestion run has more
                  published items.
                </p>
              )}
            </div>
          </section>
        </aside>
      </article>
    </main>
  );
}

function SignalLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-t border-current/20 pt-2">
      <dt>{label}</dt>
      <dd className="max-w-40 text-right font-mono">{value}</dd>
    </div>
  );
}
