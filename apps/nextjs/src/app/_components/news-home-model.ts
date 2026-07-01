import type { RecommendableNewsItem } from "@acme/validators";

export interface NewsHomeItem extends RecommendableNewsItem {
  summary: string;
  canonicalUrl: string | null;
  imageUrl: string | null;
  sourceName: string;
  sourceType: string;
}

export type NewsHomeStatus = "ready" | "empty" | "unavailable";

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

export const shouldFetchServerRecommendations = ({
  status,
  visitorKey,
}: {
  status: NewsHomeStatus;
  visitorKey: string | null;
}) => status === "ready" && Boolean(visitorKey);

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
