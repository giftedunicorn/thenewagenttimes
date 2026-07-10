"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ReaderInteractionAction } from "@acme/validators";
import { Button } from "@acme/ui/button";
import {
  normalizeNewsPreferenceProfile,
  updateReaderProfileWithInteraction,
} from "@acme/validators";

import type {
  NewsHomeItem,
  NewsHomeStoryActionCommand,
  NewsPositiveFeedbackMemoryItem,
  NewsReaderMemoryItem,
} from "./news-home-model";
import { useTRPC } from "~/trpc/react";
import {
  buildNewsHomeReaderInteraction,
  createDefaultNewsPreferenceProfile,
  getNewsHomeStoryActionPanel,
  getNewsStorySourceUrl,
  mergeNewsHomePositiveFeedbackItems,
  mergeNewsReaderMemoryItems,
  removeNewsHomePositiveFeedbackActionItem,
  removeNewsHomePositiveFeedbackItem,
  removeNewsReaderMemoryItem,
  selectActiveNewsReaderMemoryItem,
  shouldPersistNewsHomeItemReaderSignals,
  stripPersistedNewsPreferenceProfile,
} from "./news-home-model";
import {
  newsGuardrailStorageKey,
  newsHistoryStorageKey,
  newsSavedStorageKey,
  readStoredNewsPositiveFeedbackItems,
  readStoredNewsReaderMemoryItems,
  subscribeToNewsReaderMemoryStorage,
  writeStoredNewsPositiveFeedbackItems,
  writeStoredNewsReaderMemoryItems,
} from "./news-reader-memory-storage";
import {
  parseStoredNewsPreferenceProfile,
  readNewsPreferenceProfileSnapshot,
  readOrCreateNewsVisitorKey,
  writeStoredNewsPreferenceProfile,
} from "./news-reader-profile-storage";

const toNewsEditionStoryMemoryItem = ({
  item,
  occurredAt,
}: {
  item: NewsHomeItem;
  occurredAt: string;
}): NewsReaderMemoryItem => ({
  canonicalUrl: item.canonicalUrl,
  category: item.category,
  ...(item.clusterKey ? { clusterKey: item.clusterKey } : {}),
  entities: [...item.entities],
  id: item.id,
  originalUrl: item.originalUrl,
  sourceName: item.sourceName,
  sourceSlug: item.sourceSlug,
  tags: [...item.tags],
  title: item.title,
  viewedAt: occurredAt,
});

export const getNewsEditionStoryHistoryStorageUpdate = ({
  item,
  occurredAt,
  storedItems,
}: {
  item: NewsHomeItem;
  occurredAt: string;
  storedItems: readonly NewsReaderMemoryItem[];
}) =>
  mergeNewsReaderMemoryItems({
    localItems: [toNewsEditionStoryMemoryItem({ item, occurredAt })],
    serverItems: storedItems,
  });

export const getNewsEditionStoryGuardrailStorageUpdate = ({
  guardrailItems,
  item,
  occurredAt,
  positiveFeedbackItems,
  savedItems,
}: {
  guardrailItems: readonly NewsReaderMemoryItem[];
  item: NewsHomeItem;
  occurredAt: string;
  positiveFeedbackItems: readonly NewsPositiveFeedbackMemoryItem[];
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const guardrailItem = toNewsEditionStoryGuardrailMemoryItem({
    item,
    occurredAt,
  });
  const withoutSavedPositiveFeedback = removeNewsHomePositiveFeedbackItem({
    item: guardrailItem,
    itemId: item.id,
    items: positiveFeedbackItems,
  });
  const withoutSharedPositiveFeedback =
    removeNewsHomePositiveFeedbackActionItem({
      action: "share",
      item: guardrailItem,
      itemId: item.id,
      items: withoutSavedPositiveFeedback,
    });
  const nextPositiveFeedbackItems = removeNewsHomePositiveFeedbackActionItem({
    action: "click_source",
    item: guardrailItem,
    itemId: item.id,
    items: withoutSharedPositiveFeedback,
  });

  return {
    guardrailItems: mergeNewsReaderMemoryItems({
      localItems: [guardrailItem],
      serverItems: guardrailItems,
    }),
    positiveFeedbackItems: nextPositiveFeedbackItems,
    savedItems: removeNewsReaderMemoryItem({
      item: guardrailItem,
      itemId: item.id,
      items: savedItems,
    }),
  };
};

const toNewsEditionStorySavedMemoryItem = ({
  item,
  occurredAt,
}: {
  item: NewsHomeItem;
  occurredAt: string;
}): NewsReaderMemoryItem => ({
  ...toNewsEditionStoryMemoryItem({ item, occurredAt }),
  savedAt: occurredAt,
  viewedAt: undefined,
});

const toNewsEditionStoryGuardrailMemoryItem = ({
  item,
  occurredAt,
}: {
  item: NewsHomeItem;
  occurredAt: string;
}): NewsReaderMemoryItem => ({
  ...toNewsEditionStoryMemoryItem({ item, occurredAt }),
  hiddenAt: occurredAt,
  occurredAt,
  viewedAt: undefined,
});

const toNewsEditionStoryPositiveFeedbackItem = ({
  action,
  item,
  occurredAt,
}: {
  action: Extract<ReaderInteractionAction, "click_source" | "save" | "share">;
  item: NewsHomeItem;
  occurredAt: string;
}): NewsPositiveFeedbackMemoryItem => ({
  ...toNewsEditionStoryMemoryItem({ item, occurredAt }),
  action,
  occurredAt,
});

export const getNewsEditionStoryPositiveStorageUpdate = ({
  action,
  guardrailItems,
  item,
  occurredAt,
  positiveFeedbackItems,
  savedItems,
}: {
  action: Extract<ReaderInteractionAction, "click_source" | "save" | "share">;
  guardrailItems: readonly NewsReaderMemoryItem[];
  item: NewsHomeItem;
  occurredAt: string;
  positiveFeedbackItems: readonly NewsPositiveFeedbackMemoryItem[];
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const positiveFeedbackItem = toNewsEditionStoryPositiveFeedbackItem({
    action,
    item,
    occurredAt,
  });

  return {
    guardrailItems: removeNewsReaderMemoryItem({
      item: positiveFeedbackItem,
      itemId: item.id,
      items: guardrailItems,
    }),
    positiveFeedbackItems: mergeNewsHomePositiveFeedbackItems({
      currentItems: positiveFeedbackItems,
      nextItem: positiveFeedbackItem,
    }),
    savedItems:
      action === "save"
        ? mergeNewsReaderMemoryItems({
            localItems: [
              toNewsEditionStorySavedMemoryItem({
                item,
                occurredAt,
              }),
            ],
            serverItems: savedItems,
          })
        : [...savedItems],
  };
};

const isPositiveEditionStoryAction = (
  action: ReaderInteractionAction,
): action is Extract<
  ReaderInteractionAction,
  "click_source" | "save" | "share"
> => action === "click_source" || action === "save" || action === "share";

const buildNewsEditionStoryInteractionMetadata = ({
  action,
  rankSlot,
}: {
  action: ReaderInteractionAction;
  rankSlot: number;
}) => ({
  feedMode: "for_you" as const,
  rankSlot: Number.isFinite(rankSlot) ? Math.max(0, Math.trunc(rankSlot)) : 0,
  surface:
    action === "view"
      ? ("edition_read" as const)
      : action === "click_source"
        ? ("edition_source" as const)
        : ("edition_feedback" as const),
});

const readStoredProfile = () =>
  parseStoredNewsPreferenceProfile({
    defaultProfile: createDefaultNewsPreferenceProfile(),
    stored:
      typeof window === "undefined" ? "" : readNewsPreferenceProfileSnapshot(),
  });

const writeProfileForAction = ({
  action,
  item,
  rankSlot,
}: {
  action: ReaderInteractionAction;
  item: NewsHomeItem;
  rankSlot: number;
}) => {
  const profile = readStoredProfile();
  const nextProfile = updateReaderProfileWithInteraction(
    profile,
    item,
    buildNewsHomeReaderInteraction({ action, rankSlot }),
  );

  writeStoredNewsPreferenceProfile(normalizeNewsPreferenceProfile(nextProfile));
};

export const selectNewsEditionStoryActionState = ({
  guardrailItems,
  item,
  savedItems,
}: {
  guardrailItems: readonly NewsReaderMemoryItem[];
  item: NewsHomeItem;
  savedItems: readonly NewsReaderMemoryItem[];
}) => ({
  isGuardrailed: Boolean(
    selectActiveNewsReaderMemoryItem({
      item,
      memoryItems: guardrailItems,
    }),
  ),
  isSaved: Boolean(
    selectActiveNewsReaderMemoryItem({
      item,
      memoryItems: savedItems,
    }),
  ),
});

export function NewsEditionStoryActions({
  isPreview,
  item,
  rankSlot,
}: {
  isPreview: boolean;
  item: NewsHomeItem;
  rankSlot: number;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [visitorKey] = useState<string | null>(() =>
    readOrCreateNewsVisitorKey(),
  );
  const [isSaved, setIsSaved] = useState(false);
  const [isGuardrailed, setIsGuardrailed] = useState(false);
  const sourceUrl = getNewsStorySourceUrl(item);
  const invalidateReaderQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
      queryClient.invalidateQueries(trpc.news.profile.pathFilter()),
      queryClient.invalidateQueries(trpc.news.saved.pathFilter()),
      queryClient.invalidateQueries(trpc.news.history.pathFilter()),
      queryClient.invalidateQueries(trpc.news.positiveFeedback.pathFilter()),
      queryClient.invalidateQueries(trpc.news.searchMemory.pathFilter()),
      queryClient.invalidateQueries(trpc.news.guardrails.pathFilter()),
    ]);
  };
  const applyServerProfile = async (
    serverProfile: Parameters<typeof stripPersistedNewsPreferenceProfile>[0],
  ) => {
    writeStoredNewsPreferenceProfile(
      stripPersistedNewsPreferenceProfile(serverProfile),
    );
    await invalidateReaderQueries();
  };
  const recordInteraction = useMutation(
    trpc.news.recordInteraction.mutationOptions({
      onSuccess: applyServerProfile,
    }),
  );
  const restoreGuardrail = useMutation(
    trpc.news.restoreGuardrail.mutationOptions({
      onSuccess: applyServerProfile,
    }),
  );
  const removeSaved = useMutation(
    trpc.news.removeSaved.mutationOptions({
      onSuccess: applyServerProfile,
    }),
  );
  const actionPanel = useMemo(
    () =>
      getNewsHomeStoryActionPanel({
        hasSourceUrl: Boolean(sourceUrl),
        isGuardrailed,
        isPreview,
        isSaved,
      }),
    [isGuardrailed, isPreview, isSaved, sourceUrl],
  );

  useEffect(() => {
    const refreshState = () => {
      const actionState = selectNewsEditionStoryActionState({
        guardrailItems: readStoredNewsReaderMemoryItems(
          newsGuardrailStorageKey,
        ),
        item,
        savedItems: readStoredNewsReaderMemoryItems(newsSavedStorageKey),
      });

      setIsSaved(actionState.isSaved);
      setIsGuardrailed(actionState.isGuardrailed);
    };
    const unsubscribeMemory = subscribeToNewsReaderMemoryStorage(refreshState);

    refreshState();

    return () => {
      unsubscribeMemory();
    };
  }, [item]);

  const canPersistStoryAction = () =>
    Boolean(visitorKey) &&
    shouldPersistNewsHomeItemReaderSignals({
      canPersistProfile: true,
      isPreview,
      itemId: item.id,
      visitorKey,
    });

  const persistStoryInteraction = (action: ReaderInteractionAction) => {
    if (!visitorKey || !canPersistStoryAction()) return;

    recordInteraction.mutate({
      action,
      metadata: buildNewsEditionStoryInteractionMetadata({
        action,
        rankSlot,
      }),
      newsItemId: item.id,
      visitorKey,
    });
  };

  const persistSavedRemoval = () => {
    if (!visitorKey || !canPersistStoryAction()) return;

    removeSaved.mutate({
      newsItemId: item.id,
      visitorKey,
    });
  };

  const persistGuardrailRestore = () => {
    if (!visitorKey || !canPersistStoryAction()) return;

    restoreGuardrail.mutate({
      newsItemId: item.id,
      visitorKey,
    });
  };

  const runAction = (action: NewsHomeStoryActionCommand) => {
    const occurredAt = new Date().toISOString();

    if (action === "remove_saved") {
      const savedItem = toNewsEditionStorySavedMemoryItem({
        item,
        occurredAt,
      });
      const nextSavedItems = removeNewsReaderMemoryItem({
        item: savedItem,
        itemId: item.id,
        items: readStoredNewsReaderMemoryItems(newsSavedStorageKey),
      });
      const nextPositiveItems = removeNewsHomePositiveFeedbackItem({
        item: savedItem,
        itemId: item.id,
        items: readStoredNewsPositiveFeedbackItems(),
      });

      writeStoredNewsReaderMemoryItems(newsSavedStorageKey, nextSavedItems);
      writeStoredNewsPositiveFeedbackItems(nextPositiveItems);
      setIsSaved(false);
      persistSavedRemoval();
      return;
    }

    if (action === "restore_guardrail") {
      const guardrailItem = toNewsEditionStoryGuardrailMemoryItem({
        item,
        occurredAt,
      });
      const nextGuardrailItems = removeNewsReaderMemoryItem({
        item: guardrailItem,
        itemId: item.id,
        items: readStoredNewsReaderMemoryItems(newsGuardrailStorageKey),
      });

      writeStoredNewsReaderMemoryItems(
        newsGuardrailStorageKey,
        nextGuardrailItems,
      );
      setIsGuardrailed(false);
      persistGuardrailRestore();
      return;
    }

    writeProfileForAction({ action, item, rankSlot });
    persistStoryInteraction(action);

    if (action === "view") {
      writeStoredNewsReaderMemoryItems(
        newsHistoryStorageKey,
        getNewsEditionStoryHistoryStorageUpdate({
          item,
          occurredAt,
          storedItems: readStoredNewsReaderMemoryItems(newsHistoryStorageKey),
        }),
      );
      return;
    }

    if (action === "hide") {
      const storageUpdate = getNewsEditionStoryGuardrailStorageUpdate({
        guardrailItems: readStoredNewsReaderMemoryItems(
          newsGuardrailStorageKey,
        ),
        item,
        occurredAt,
        positiveFeedbackItems: readStoredNewsPositiveFeedbackItems(),
        savedItems: readStoredNewsReaderMemoryItems(newsSavedStorageKey),
      });

      writeStoredNewsReaderMemoryItems(
        newsGuardrailStorageKey,
        storageUpdate.guardrailItems,
      );
      writeStoredNewsReaderMemoryItems(
        newsSavedStorageKey,
        storageUpdate.savedItems,
      );
      writeStoredNewsPositiveFeedbackItems(storageUpdate.positiveFeedbackItems);
      setIsGuardrailed(true);
      setIsSaved(false);
      return;
    }

    if (!isPositiveEditionStoryAction(action)) return;

    const storageUpdate = getNewsEditionStoryPositiveStorageUpdate({
      action,
      guardrailItems: readStoredNewsReaderMemoryItems(newsGuardrailStorageKey),
      item,
      occurredAt,
      positiveFeedbackItems: readStoredNewsPositiveFeedbackItems(),
      savedItems: readStoredNewsReaderMemoryItems(newsSavedStorageKey),
    });

    writeStoredNewsReaderMemoryItems(
      newsGuardrailStorageKey,
      storageUpdate.guardrailItems,
    );
    writeStoredNewsPositiveFeedbackItems(storageUpdate.positiveFeedbackItems);
    setIsGuardrailed(false);
    if (isGuardrailed) persistGuardrailRestore();

    if (action === "save") {
      writeStoredNewsReaderMemoryItems(
        newsSavedStorageKey,
        storageUpdate.savedItems,
      );
      setIsSaved(true);
    }
  };

  return (
    <div
      aria-label={`Reader actions: ${item.title}`}
      className="mt-4 grid gap-2"
    >
      {actionPanel.helperText ? (
        <p className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
          {actionPanel.helperText}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {actionPanel.actions.map((action) => {
          if (action.type === "read") {
            return (
              <Button asChild className="rounded-none" key={action.action}>
                <Link
                  href={`/news/${item.id}`}
                  onClick={() => runAction(action.action)}
                >
                  {action.label}
                </Link>
              </Button>
            );
          }

          if (action.type === "source" && sourceUrl) {
            return (
              <Button
                asChild
                className="rounded-none"
                key={action.action}
                variant="outline"
              >
                <a
                  href={sourceUrl}
                  onClick={() => runAction(action.action)}
                  rel="nofollow noopener noreferrer"
                  target="_blank"
                >
                  {action.label}
                </a>
              </Button>
            );
          }

          return (
            <Button
              className="rounded-none"
              key={action.action}
              onClick={() => runAction(action.action)}
              type="button"
              variant="outline"
            >
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
