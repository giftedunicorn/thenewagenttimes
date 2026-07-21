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
  rankNewsForReader,
  selectDiverseNewsFeed,
  updateReaderProfileWithInteraction,
} from "@acme/validators";

import type {
  NewsPositiveFeedbackMemoryItem,
  NewsReaderMemoryItem,
} from "../../_components/news-home-model";
import type { NewsSearchMemoryItem } from "../../_components/news-reader-memory-storage";
import type { NewsArticleItem, NewsHomeItem } from "../../_data/news";
import type { NewsArticleReadMilestone } from "./news-article-model";
import { useTRPC } from "~/trpc/react";
import { NewsEditionStoryActions } from "../../_components/news-edition-story-actions";
import {
  createDefaultNewsPreferenceProfile,
  getNewsTopicHref,
  mergeNewsHomePositiveFeedbackItems,
  mergeNewsReaderMemoryItems,
  removeNewsHomePositiveFeedbackItem,
  removeNewsReaderMemoryItem,
  selectActiveNewsGuardrailItems,
  selectActiveNewsSavedItems,
  selectHydratedNewsPreferenceProfile,
  stripPersistedNewsPreferenceProfile,
} from "../../_components/news-home-model";
import {
  newsGuardrailStorageKey as guardrailStorageKey,
  newsHistoryStorageKey as historyStorageKey,
  readStoredNewsPositiveFeedbackItems,
  readStoredNewsReaderMemoryItems,
  readStoredNewsSearchMemoryItems,
  newsSavedStorageKey as savedStorageKey,
  selectStoredNewsSearchMemoryItems,
  subscribeToNewsReaderMemoryStorage,
  writeStoredNewsPositiveFeedbackItems,
  writeStoredNewsReaderMemoryItems,
  writeStoredNewsSearchMemoryItems,
} from "../../_components/news-reader-memory-storage";
import {
  areNewsPreferenceProfilesEqual,
  getNewsPreferenceProfileStorageValue,
  readOrCreateNewsVisitorKey,
  readStoredNewsPreferenceProfile,
  subscribeToNewsPreferenceProfileStorage,
  toNewsServerPreferenceProfileInput,
  writeStoredNewsPreferenceProfile,
} from "../../_components/news-reader-profile-storage";
import {
  getNewsArticleCorroboration,
  getNewsArticleDeepReadTrainingState,
  getNewsArticleDigest,
  getNewsArticleFeedbackLoop,
  getNewsArticleFormattedDate,
  getNewsArticleGuardrailSignalState,
  getNewsArticleGuardrailStorageUpdate,
  getNewsArticleHeroVisual,
  getNewsArticleLearningImpact,
  getNewsArticleLocalGuardrailItem,
  getNewsArticleLocalHistoryItem,
  getNewsArticleLocalMemoryItemForAction,
  getNewsArticleLocalReadFeedbackItem,
  getNewsArticleLocalSavedItem,
  getNewsArticleNextReads,
  getNewsArticlePositiveStorageUpdate,
  getNewsArticleReadDepthCheckpoints,
  getNewsArticleReaderFit,
  getNewsArticleReaderSignalCacheScopes,
  getNewsArticleReadingPath,
  getNewsArticleReadPercent,
  getNewsArticleReadTrainingReceipt,
  getNewsArticleSaveSignalState,
  getNewsArticleServerProfileAuditDisplay,
  getNewsArticleSourceFollowProfile,
  getNewsArticleSourceFollowState,
  getNewsArticleSourceLens,
  getNewsArticleSourceUrl,
  selectNewsArticleEligibleRelatedItems,
  selectNewsArticleReadMilestone,
  shouldApplyNewsArticleLocalProfileFromMilestone,
  shouldPersistNewsArticleReaderSignals,
  shouldTrackNewsArticleReaderSignals,
} from "./news-article-model";

interface NewsArticleProps {
  article: NewsArticleItem;
  related: NewsHomeItem[];
}

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
  return readStoredNewsPreferenceProfile({
    defaultProfile: createDefaultNewsPreferenceProfile(),
  });
};

const writeStoredProfile = (profile: NewsPreferenceProfile) => {
  writeStoredNewsPreferenceProfile(profile);
};

const readStoredMemoryItems = readStoredNewsReaderMemoryItems;

const writeStoredMemoryItems = ({
  items,
  storageKey,
}: {
  items: readonly NewsReaderMemoryItem[];
  storageKey: string;
}) => {
  writeStoredNewsReaderMemoryItems(storageKey, items);
};

const writeStoredMemoryItem = ({
  item,
  storageKey,
}: {
  item: NewsReaderMemoryItem;
  storageKey: string;
}) => {
  const nextItems = mergeNewsReaderMemoryItems({
    localItems: [item],
    serverItems: readStoredMemoryItems(storageKey),
  });

  writeStoredMemoryItems({
    items: nextItems,
    storageKey,
  });

  return nextItems;
};

const readStoredPositiveFeedbackItems = readStoredNewsPositiveFeedbackItems;
const readStoredSearchMemoryItems = readStoredNewsSearchMemoryItems;

const writeStoredPositiveFeedbackItem = ({
  item,
}: {
  item: NewsPositiveFeedbackMemoryItem;
}) => {
  writeStoredNewsPositiveFeedbackItems(
    mergeNewsHomePositiveFeedbackItems({
      currentItems: readStoredPositiveFeedbackItems(),
      nextItem: item,
    }),
  );
};

const writeStoredPositiveFeedbackItems = (
  items: readonly NewsPositiveFeedbackMemoryItem[],
) => {
  writeStoredNewsPositiveFeedbackItems(items);
};

const writeStoredHistoryItem = ({
  article,
  readPercent,
  viewedAt,
}: {
  article: NewsArticleItem;
  readPercent: number;
  viewedAt: string;
}) => {
  writeStoredMemoryItem({
    item: getNewsArticleLocalHistoryItem({
      article,
      readPercent,
      viewedAt,
    }),
    storageKey: historyStorageKey,
  });
};

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
  const [localSavedItems, setLocalSavedItems] = useState<
    NewsReaderMemoryItem[]
  >([]);
  const [removedSavedItems, setRemovedSavedItems] = useState<
    NewsReaderMemoryItem[]
  >([]);
  const [localGuardrailItems, setLocalGuardrailItems] = useState<
    NewsReaderMemoryItem[]
  >([]);
  const [restoredGuardrailItems, setRestoredGuardrailItems] = useState<
    NewsReaderMemoryItem[]
  >([]);
  const [readTrainingMilestones, setReadTrainingMilestones] = useState<
    NewsArticleReadMilestone[]
  >([]);
  const [searchMemoryItems, setSearchMemoryItems] = useState<
    NewsSearchMemoryItem[]
  >([]);
  const recordedReadMilestonesRef = useRef<NewsArticleReadMilestone[]>([]);
  const serverProfileSyncSnapshotRef = useRef<string | null>(null);
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
  const savedQuery = useQuery(
    trpc.news.saved.queryOptions(
      { limit: 6, visitorKey: visitorKey ?? undefined },
      { enabled: canPersistReaderSignals && Boolean(visitorKey) },
    ),
  );
  const historyQuery = useQuery(
    trpc.news.history.queryOptions(
      { limit: 6, visitorKey: visitorKey ?? undefined },
      { enabled: canPersistReaderSignals && Boolean(visitorKey) },
    ),
  );
  const positiveFeedbackQuery = useQuery(
    trpc.news.positiveFeedback.queryOptions(
      { limit: 6, visitorKey: visitorKey ?? undefined },
      { enabled: canPersistReaderSignals && Boolean(visitorKey) },
    ),
  );
  const guardrailsQuery = useQuery(
    trpc.news.guardrails.queryOptions(
      { limit: 6, visitorKey: visitorKey ?? undefined },
      { enabled: canPersistReaderSignals && Boolean(visitorKey) },
    ),
  );
  const searchMemoryQuery = useQuery(
    trpc.news.searchMemory.queryOptions(
      { limit: 20, visitorKey: visitorKey ?? undefined },
      { enabled: canPersistReaderSignals && Boolean(visitorKey) },
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
          case "positiveFeedback":
            return queryClient.invalidateQueries(
              trpc.news.positiveFeedback.pathFilter(),
            );
          case "searchMemory":
            return queryClient.invalidateQueries(
              trpc.news.searchMemory.pathFilter(),
            );
          case "guardrails":
            return queryClient.invalidateQueries(
              trpc.news.guardrails.pathFilter(),
            );
        }
      },
    );

    await Promise.all(invalidations);
  };
  const updateProfile = useMutation(
    trpc.news.updateProfile.mutationOptions({
      onSuccess: async (serverProfile) => {
        const nextProfile = stripPersistedNewsPreferenceProfile(serverProfile);
        setProfile(nextProfile);
        writeStoredProfile(nextProfile);

        await invalidateReaderSignalQueries();
      },
    }),
  );
  const removeSaved = useMutation(
    trpc.news.removeSaved.mutationOptions({
      onSuccess: async (serverProfile) => {
        const nextProfile = stripPersistedNewsPreferenceProfile(serverProfile);
        setProfile(nextProfile);
        writeStoredProfile(nextProfile);

        await invalidateReaderSignalQueries();
      },
    }),
  );
  const restoreGuardrail = useMutation(
    trpc.news.restoreGuardrail.mutationOptions({
      onSuccess: async (serverProfile) => {
        const nextProfile = stripPersistedNewsPreferenceProfile(serverProfile);
        setProfile(nextProfile);
        writeStoredProfile(nextProfile);

        await invalidateReaderSignalQueries();
      },
    }),
  );

  useEffect(() => {
    setProfile(readStoredProfile());
    setLocalSavedItems(readStoredMemoryItems(savedStorageKey));
    setLocalGuardrailItems(readStoredMemoryItems(guardrailStorageKey));
    setSearchMemoryItems(readStoredSearchMemoryItems());
    setVisitorKey(readOrCreateNewsVisitorKey());
  }, []);

  useEffect(() => {
    return subscribeToNewsPreferenceProfileStorage(() => {
      const nextProfile = readStoredProfile();

      setProfile((currentProfile) =>
        areNewsPreferenceProfilesEqual(currentProfile, nextProfile)
          ? currentProfile
          : nextProfile,
      );
    });
  }, []);

  useEffect(() => {
    return subscribeToNewsReaderMemoryStorage(() => {
      setLocalSavedItems(readStoredMemoryItems(savedStorageKey));
      setLocalGuardrailItems(readStoredMemoryItems(guardrailStorageKey));
      setSearchMemoryItems(readStoredSearchMemoryItems());
    });
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
    if (!visitorKey || !canPersistReaderSignals) return;
    if (!profileQuery.data || profileQuery.data.persisted) return;
    if (
      areNewsPreferenceProfilesEqual(
        profile,
        createDefaultNewsPreferenceProfile(),
      )
    ) {
      return;
    }

    const localProfileSnapshot = getNewsPreferenceProfileStorageValue(profile);

    if (serverProfileSyncSnapshotRef.current === localProfileSnapshot) return;

    serverProfileSyncSnapshotRef.current = localProfileSnapshot;
    updateProfile.mutate({
      visitorKey,
      profile: toNewsServerPreferenceProfileInput(profile),
    });
  }, [
    canPersistReaderSignals,
    profile,
    profileQuery.data,
    updateProfile,
    visitorKey,
  ]);

  useEffect(() => {
    if (!savedQuery.data || savedQuery.data.length === 0) return;

    const nextSavedItems = mergeNewsReaderMemoryItems({
      localItems: readStoredMemoryItems(savedStorageKey),
      serverItems: savedQuery.data,
    });

    writeStoredMemoryItems({
      items: nextSavedItems,
      storageKey: savedStorageKey,
    });
  }, [savedQuery.data]);

  useEffect(() => {
    if (!historyQuery.data || historyQuery.data.length === 0) return;

    const nextHistoryItems = mergeNewsReaderMemoryItems({
      localItems: readStoredMemoryItems(historyStorageKey),
      serverItems: historyQuery.data,
    });

    writeStoredMemoryItems({
      items: nextHistoryItems,
      storageKey: historyStorageKey,
    });
  }, [historyQuery.data]);

  useEffect(() => {
    if (!positiveFeedbackQuery.data || positiveFeedbackQuery.data.length === 0)
      return;

    const nextPositiveFeedbackItems = positiveFeedbackQuery.data.reduce<
      NewsPositiveFeedbackMemoryItem[]
    >(
      (currentItems, nextItem) =>
        mergeNewsHomePositiveFeedbackItems({
          currentItems,
          nextItem,
        }),
      readStoredPositiveFeedbackItems(),
    );

    writeStoredPositiveFeedbackItems(nextPositiveFeedbackItems);
  }, [positiveFeedbackQuery.data]);

  useEffect(() => {
    if (!searchMemoryQuery.data || searchMemoryQuery.data.length === 0) return;

    const nextSearchMemoryItems = selectStoredNewsSearchMemoryItems([
      ...searchMemoryQuery.data,
      ...readStoredSearchMemoryItems(),
    ]);

    writeStoredNewsSearchMemoryItems(nextSearchMemoryItems);
    setSearchMemoryItems(nextSearchMemoryItems);
  }, [searchMemoryQuery.data]);

  useEffect(() => {
    if (!guardrailsQuery.data || guardrailsQuery.data.length === 0) return;

    const nextGuardrailItems = mergeNewsReaderMemoryItems({
      localItems: readStoredMemoryItems(guardrailStorageKey),
      serverItems: guardrailsQuery.data,
    });

    writeStoredMemoryItems({
      items: nextGuardrailItems,
      storageKey: guardrailStorageKey,
    });
  }, [guardrailsQuery.data]);

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

    // This should run once per article open after the reader key is available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id, canTrackReaderSignals, visitorKey]);

  useEffect(() => {
    if (!canTrackReaderSignals || !visitorKey) return;

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
          const occurredAt = new Date().toISOString();
          writeStoredProfile(trainingState.profile);
          writeStoredHistoryItem({
            article,
            readPercent: milestone.readPercent,
            viewedAt: occurredAt,
          });
          writeStoredPositiveFeedbackItem({
            item: getNewsArticleLocalReadFeedbackItem({
              article,
              occurredAt,
              readPercent: milestone.readPercent,
            }),
          });
          return trainingState.profile;
        });
      }
    };

    const recordCurrentReadDepth = () => {
      const documentElement = document.documentElement;
      const body = document.body;
      const documentHeight = Math.max(
        documentElement.clientHeight,
        documentElement.offsetHeight,
        documentElement.scrollHeight,
        body.offsetHeight,
        body.scrollHeight,
      );
      const readPercent = getNewsArticleReadPercent({
        documentHeight,
        scrollY: window.scrollY,
        viewportHeight: window.innerHeight,
      });

      recordCheckpointRead(readPercent);
    };

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

    const observer =
      checkpointNodes.length > 0 &&
      typeof window.IntersectionObserver === "function"
        ? new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (!entry.isIntersecting) return;

                const checkpoint = checkpointNodes.find(
                  ({ node }) => node === entry.target,
                );

                if (!checkpoint) return;

                recordCheckpointRead(checkpoint.readPercent);
                observer?.unobserve(checkpoint.node);
              });
            },
            {
              root: null,
              rootMargin: "0px 0px -20% 0px",
              threshold: 0,
            },
          )
        : null;

    checkpointNodes.forEach(({ node }) => observer?.observe(node));
    recordCurrentReadDepth();
    window.addEventListener("scroll", recordCurrentReadDepth, {
      passive: true,
    });
    window.addEventListener("resize", recordCurrentReadDepth);

    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", recordCurrentReadDepth);
      window.removeEventListener("resize", recordCurrentReadDepth);
    };
    // This effect tracks browser reading depth for the active article body.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    article.id,
    articleReadDepthCheckpoints,
    canTrackReaderSignals,
    visitorKey,
  ]);

  const serverProfileAudit = getNewsArticleServerProfileAuditDisplay(
    profileQuery.data?.audit,
  );
  const serverSavedItems = useMemo(
    () =>
      selectActiveNewsSavedItems({
        negativeFeedbackItems: [],
        removedSavedItems,
        savedItems: savedQuery.data ?? [],
      }),
    [removedSavedItems, savedQuery.data],
  );
  const restoredGuardrailItemIds = useMemo(
    () => restoredGuardrailItems.map((item) => item.id),
    [restoredGuardrailItems],
  );
  const serverGuardrailItems = useMemo(
    () =>
      selectActiveNewsGuardrailItems({
        guardrailItems: guardrailsQuery.data ?? [],
        restoredItemIds: restoredGuardrailItemIds,
        restoredItems: restoredGuardrailItems,
      }),
    [guardrailsQuery.data, restoredGuardrailItemIds, restoredGuardrailItems],
  );
  const activeLocalGuardrailItems = useMemo(
    () =>
      selectActiveNewsGuardrailItems({
        guardrailItems: localGuardrailItems,
        restoredItemIds: restoredGuardrailItemIds,
        restoredItems: restoredGuardrailItems,
      }),
    [localGuardrailItems, restoredGuardrailItemIds, restoredGuardrailItems],
  );
  const guardrailItems = useMemo(
    () =>
      mergeNewsReaderMemoryItems({
        localItems: activeLocalGuardrailItems,
        serverItems: serverGuardrailItems,
      }),
    [activeLocalGuardrailItems, serverGuardrailItems],
  );
  const eligibleRelatedItems = useMemo(
    () =>
      selectNewsArticleEligibleRelatedItems({
        guardrailItems,
        relatedItems: related,
      }),
    [guardrailItems, related],
  );
  const rankedRelated = useMemo(
    () =>
      selectDiverseNewsFeed(
        rankNewsForReader(dedupeNewsItems(eligibleRelatedItems), profile),
        {
          explorationInterval: getNewsExplorationInterval(profile),
          limit: eligibleRelatedItems.length,
        },
      ),
    [eligibleRelatedItems, profile],
  );
  const rankedRelatedById = useMemo(
    () => new Map(rankedRelated.map((item) => [item.id, item])),
    [rankedRelated],
  );
  const readingPath = useMemo(
    () =>
      getNewsArticleReadingPath({
        article,
        formatCategory,
        limit: 5,
        relatedItems: rankedRelated,
        searchMemoryItems,
      }),
    [article, rankedRelated, searchMemoryItems],
  );
  const readerFit = useMemo(
    () =>
      getNewsArticleReaderFit({
        article,
        formatCategory,
        profile,
        relatedItems: rankedRelated,
        searchMemoryItems,
      }),
    [article, profile, rankedRelated, searchMemoryItems],
  );
  const learningImpact = useMemo(
    () =>
      getNewsArticleLearningImpact({
        article,
        formatCategory,
        profile,
        relatedItems: rankedRelated,
        searchMemoryItems,
      }),
    [article, profile, rankedRelated, searchMemoryItems],
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
        searchMemoryItems,
      }),
    [article, profile, rankedRelated, searchMemoryItems],
  );
  const articleDigest = useMemo(
    () => getNewsArticleDigest({ article }),
    [article],
  );
  const sourceLens = useMemo(
    () => getNewsArticleSourceLens({ article }),
    [article],
  );
  const sourceFollowState = useMemo(
    () => getNewsArticleSourceFollowState({ article, profile }),
    [article, profile],
  );
  const articleCorroboration = useMemo(
    () =>
      getNewsArticleCorroboration({
        article,
        formatCategory,
        limit: 3,
        relatedItems: rankedRelated,
      }),
    [article, rankedRelated],
  );
  const savedItems = useMemo(() => {
    const mergedSavedItems = mergeNewsReaderMemoryItems({
      localItems: localSavedItems,
      serverItems: serverSavedItems,
    });

    return selectActiveNewsSavedItems({
      negativeFeedbackItems: guardrailItems,
      removedSavedItems,
      savedItems: mergedSavedItems,
    });
  }, [guardrailItems, localSavedItems, removedSavedItems, serverSavedItems]);
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
  const sourceUrl = getNewsArticleSourceUrl(article);
  const saveSignalState = getNewsArticleSaveSignalState({
    article,
    articleId: article.id,
    savedItems,
  });
  const guardrailSignalState = getNewsArticleGuardrailSignalState({
    article,
    articleId: article.id,
    guardrailItems,
  });
  const readerFitNextStepItem = readerFit.nextStep
    ? (rankedRelatedById.get(readerFit.nextStep.id) ?? null)
    : null;

  const removeSavedSignal = () => {
    const savedMemoryItem = getNewsArticleLocalSavedItem({
      article,
      savedAt: new Date().toISOString(),
    });

    setRemovedSavedItems((current) =>
      [
        savedMemoryItem,
        ...removeNewsReaderMemoryItem({
          item: savedMemoryItem,
          itemId: article.id,
          items: current,
        }),
      ].slice(0, 12),
    );
    setLocalSavedItems((current) => {
      const nextItems = removeNewsReaderMemoryItem({
        item: savedMemoryItem,
        itemId: article.id,
        items: current,
      });

      writeStoredMemoryItems({
        items: nextItems,
        storageKey: savedStorageKey,
      });

      return nextItems;
    });
    writeStoredPositiveFeedbackItems(
      removeNewsHomePositiveFeedbackItem({
        item: savedMemoryItem,
        itemId: article.id,
        items: readStoredPositiveFeedbackItems(),
      }),
    );

    if (canPersistReaderSignals && visitorKey) {
      removeSaved.mutate({
        visitorKey,
        newsItemId: article.id,
      });
    }
  };

  const restoreGuardrailSignal = () => {
    const guardrailMemoryItem = getNewsArticleLocalGuardrailItem({
      article,
      hiddenAt: new Date().toISOString(),
    });

    setRestoredGuardrailItems((current) =>
      current.some((item) => item.id === guardrailMemoryItem.id)
        ? current
        : [guardrailMemoryItem, ...current].slice(0, 12),
    );
    setLocalGuardrailItems((current) => {
      const nextItems = removeNewsReaderMemoryItem({
        item: guardrailMemoryItem,
        itemId: article.id,
        items: current,
      });

      writeStoredMemoryItems({
        items: nextItems,
        storageKey: guardrailStorageKey,
      });

      return nextItems;
    });

    if (canPersistReaderSignals && visitorKey) {
      restoreGuardrail.mutate({
        visitorKey,
        newsItemId: article.id,
      });
    }
  };

  const followArticleSource = () => {
    const occurredAt = new Date().toISOString();
    const nextProfile = getNewsArticleSourceFollowProfile({
      article,
      profile,
    });
    const sourceFeedbackItem = getNewsArticleLocalMemoryItemForAction({
      action: "click_source",
      article,
      occurredAt,
    });

    setFeedbackLoop(
      getNewsArticleFeedbackLoop({
        action: "click_source",
        afterProfile: nextProfile,
        article,
        beforeProfile: profile,
        formatCategory,
      }),
    );
    setProfile(nextProfile);
    writeStoredProfile(nextProfile);

    if (
      !sourceFollowState.isFollowing &&
      sourceFeedbackItem?.storage === "positive"
    ) {
      const storageUpdate = getNewsArticlePositiveStorageUpdate({
        action: "click_source",
        article,
        guardrailItems: readStoredMemoryItems(guardrailStorageKey),
        occurredAt,
        positiveFeedbackItems: readStoredPositiveFeedbackItems(),
        savedItems: readStoredMemoryItems(savedStorageKey),
      });

      writeStoredMemoryItems({
        items: storageUpdate.guardrailItems,
        storageKey: guardrailStorageKey,
      });
      writeStoredPositiveFeedbackItems(storageUpdate.positiveFeedbackItems);
      setRestoredGuardrailItems((current) =>
        removeNewsReaderMemoryItem({
          item: sourceFeedbackItem.item,
          itemId: article.id,
          items: current,
        }),
      );
      setLocalGuardrailItems(storageUpdate.guardrailItems);
    }

    if (canPersistReaderSignals && visitorKey) {
      updateProfile.mutate({
        profile: toNewsServerPreferenceProfileInput(nextProfile),
        visitorKey,
      });
    }
  };

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
      if (
        localMemoryItem.storage === "positive" &&
        (action === "share" || action === "click_source")
      ) {
        const storageUpdate = getNewsArticlePositiveStorageUpdate({
          action,
          article,
          guardrailItems: readStoredMemoryItems(guardrailStorageKey),
          occurredAt,
          positiveFeedbackItems: readStoredPositiveFeedbackItems(),
          savedItems: readStoredMemoryItems(savedStorageKey),
        });

        writeStoredMemoryItems({
          items: storageUpdate.guardrailItems,
          storageKey: guardrailStorageKey,
        });
        writeStoredPositiveFeedbackItems(storageUpdate.positiveFeedbackItems);
        setRestoredGuardrailItems((current) =>
          removeNewsReaderMemoryItem({
            item: localMemoryItem.item,
            itemId: article.id,
            items: current,
          }),
        );
        setLocalGuardrailItems(storageUpdate.guardrailItems);
      } else if (localMemoryItem.storage === "guardrail") {
        const storageUpdate = getNewsArticleGuardrailStorageUpdate({
          article,
          guardrailItems: readStoredMemoryItems(guardrailStorageKey),
          occurredAt,
          positiveFeedbackItems: readStoredPositiveFeedbackItems(),
          savedItems: readStoredMemoryItems(savedStorageKey),
        });

        writeStoredMemoryItems({
          items: storageUpdate.guardrailItems,
          storageKey: guardrailStorageKey,
        });
        writeStoredMemoryItems({
          items: storageUpdate.savedItems,
          storageKey: savedStorageKey,
        });
        writeStoredPositiveFeedbackItems(storageUpdate.positiveFeedbackItems);
        setRestoredGuardrailItems((current) =>
          removeNewsReaderMemoryItem({
            item: localMemoryItem.item,
            itemId: article.id,
            items: current,
          }),
        );
        setLocalGuardrailItems(storageUpdate.guardrailItems);
        setLocalSavedItems(storageUpdate.savedItems);
      } else if (localMemoryItem.storage === "saved" && action === "save") {
        const storageUpdate = getNewsArticlePositiveStorageUpdate({
          action,
          article,
          guardrailItems: readStoredMemoryItems(guardrailStorageKey),
          occurredAt,
          positiveFeedbackItems: readStoredPositiveFeedbackItems(),
          savedItems: readStoredMemoryItems(savedStorageKey),
        });

        writeStoredMemoryItems({
          items: storageUpdate.guardrailItems,
          storageKey: guardrailStorageKey,
        });
        writeStoredMemoryItems({
          items: storageUpdate.savedItems,
          storageKey: savedStorageKey,
        });
        writeStoredPositiveFeedbackItems(storageUpdate.positiveFeedbackItems);

        setRemovedSavedItems((current) =>
          removeNewsReaderMemoryItem({
            item: localMemoryItem.item,
            itemId: article.id,
            items: current,
          }),
        );
        setRestoredGuardrailItems((current) =>
          removeNewsReaderMemoryItem({
            item: localMemoryItem.item,
            itemId: article.id,
            items: current,
          }),
        );
        setLocalGuardrailItems(storageUpdate.guardrailItems);
        setLocalSavedItems(storageUpdate.savedItems);
      }
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
            <Link
              className="hover:underline"
              href={getNewsTopicHref(article.category)}
            >
              {formatCategory(article.category)}
            </Link>
            <span>/</span>
            <Link
              className="hover:underline"
              href={`/sources/${article.sourceSlug}`}
            >
              {article.sourceName}
            </Link>
            <span>/</span>
            <span>{getNewsArticleFormattedDate(article.publishedAt)}</span>
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
              disabled={saveSignalState.isSaved && removeSaved.isPending}
              type="button"
              variant={saveSignalState.isSaved ? "outline" : undefined}
              onClick={() => {
                if (saveSignalState.isSaved) {
                  removeSavedSignal();
                  return;
                }

                recordAction("save");
              }}
            >
              {saveSignalState.label}
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
              disabled={
                guardrailSignalState.isGuardrailed && restoreGuardrail.isPending
              }
              type="button"
              variant="outline"
              onClick={() => {
                if (guardrailSignalState.isGuardrailed) {
                  restoreGuardrailSignal();
                  return;
                }

                recordAction("hide");
              }}
            >
              {guardrailSignalState.label}
            </Button>
            {sourceUrl ? (
              <Button asChild className="rounded-none" variant="outline">
                <a
                  href={sourceUrl}
                  onClick={() => recordAction("click_source")}
                  rel="nofollow noopener noreferrer"
                  target="_blank"
                >
                  Source
                </a>
              </Button>
            ) : null}
            <Button
              className="rounded-none"
              disabled={updateProfile.isPending}
              type="button"
              variant={sourceFollowState.isFollowing ? "outline" : undefined}
              onClick={followArticleSource}
            >
              {sourceFollowState.label}
            </Button>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
            {sourceFollowState.summary}
          </p>

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
              {articleDigest.entities.map((entity) => (
                <Link
                  key={`entity-${entity}`}
                  className="border border-[#161616]/30 px-2 py-1 hover:underline dark:border-[#f4f1ea]/30"
                  href={`/entities/${encodeURIComponent(entity)}`}
                >
                  {entity}
                </Link>
              ))}
              {articleDigest.tags.map((tag) => (
                <Link
                  key={`tag-${tag}`}
                  className="border border-[#161616]/30 px-2 py-1 hover:underline dark:border-[#f4f1ea]/30"
                  href={`/search?q=${encodeURIComponent(tag)}`}
                >
                  {tag}
                </Link>
              ))}
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
                <h2 className="text-xl font-black">Article Corroboration</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {articleCorroboration.summary}
                </p>
              </div>
              <span className="border border-[#161616] px-2 py-1 text-right font-mono text-xs dark:border-[#f4f1ea]">
                {articleCorroboration.label}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-4 border-y border-[#161616]/20 text-center text-xs dark:border-[#f4f1ea]/15">
              {articleCorroboration.metrics.map((metric) => (
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
              {articleCorroboration.sources.length > 0 ? (
                articleCorroboration.sources.map((source, index) => {
                  const rankedItem = rankedRelatedById.get(source.id);

                  return (
                    <article
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm leading-5 dark:border-[#f4f1ea]/15"
                      key={source.id}
                    >
                      <Link
                        className="hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                        href={`/news/${source.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-semibold">{source.title}</span>
                          <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                            {source.scoreLabel}
                          </span>
                        </div>
                        <span className="mt-1 block font-mono text-xs">
                          {source.sourceName} / {source.categoryLabel}
                        </span>
                        <span className="mt-1 block text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {source.evidenceLabel}
                        </span>
                      </Link>
                      {rankedItem ? (
                        <NewsEditionStoryActions
                          isPreview={!canPersistReaderSignals}
                          item={rankedItem}
                          rankSlot={index + 1}
                        />
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                  Related independent sources will appear after the crawler
                  finds overlapping entities or tags.
                </p>
              )}
            </div>
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
              <article className="mt-4 grid gap-2 border-t border-[#161616]/20 pt-4 text-sm leading-5 dark:border-[#f4f1ea]/15">
                <Link
                  className="hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
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
                {readerFitNextStepItem ? (
                  <NewsEditionStoryActions
                    isPreview={!canPersistReaderSignals}
                    item={readerFitNextStepItem}
                    rankSlot={1}
                  />
                ) : null}
              </article>
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
                  {learningImpact.nextStories.slice(0, 2).map((item, index) => {
                    const rankedItem = rankedRelatedById.get(item.id);

                    return (
                      <article
                        className="grid gap-2 text-sm leading-5"
                        key={item.id}
                      >
                        <Link
                          className="hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                          href={`/news/${item.id}`}
                        >
                          <span className="block font-mono text-xs">
                            {item.reason} / {item.scoreLabel}
                          </span>
                          <span className="font-bold">{item.title}</span>
                        </Link>
                        {rankedItem ? (
                          <NewsEditionStoryActions
                            isPreview={!canPersistReaderSignals}
                            item={rankedItem}
                            rankSlot={index + 1}
                          />
                        ) : null}
                      </article>
                    );
                  })}
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
                nextReads.reads.map((item, index) => {
                  const rankedItem = rankedRelatedById.get(item.id);

                  return (
                    <article
                      className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm leading-5 dark:border-[#f4f1ea]/15"
                      key={item.id}
                    >
                      <Link
                        className="hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                        href={`/news/${item.id}`}
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
                      {rankedItem ? (
                        <NewsEditionStoryActions
                          isPreview={!canPersistReaderSignals}
                          item={rankedItem}
                          rankSlot={index + 1}
                        />
                      ) : null}
                    </article>
                  );
                })
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
                readingPath.recommendations.map((item, index) => {
                  const rankedItem = rankedRelatedById.get(item.id);

                  return (
                    <article
                      className="grid gap-2 border-t border-[#161616]/20 pt-4 text-sm leading-5 dark:border-[#f4f1ea]/15"
                      key={item.id}
                    >
                      <Link
                        className="hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                        href={`/news/${item.id}`}
                      >
                        <span className="block font-mono text-xs">
                          {item.scoreLabel}
                        </span>
                        <span className="font-bold">{item.title}</span>
                        <span className="mt-1 block text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                          {item.reason}
                        </span>
                      </Link>
                      {rankedItem ? (
                        <NewsEditionStoryActions
                          isPreview={!canPersistReaderSignals}
                          item={rankedItem}
                          rankSlot={index + 1}
                        />
                      ) : null}
                    </article>
                  );
                })
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
