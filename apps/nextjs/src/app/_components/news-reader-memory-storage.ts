import type {
  NewsPositiveFeedbackMemoryItem,
  NewsReaderMemoryItem,
} from "./news-home-model";
import {
  selectStoredNewsPositiveFeedbackItems,
  selectStoredNewsReaderMemoryItems,
} from "./news-home-model";

export const newsSavedStorageKey = "new-ai-times-saved";
export const newsHistoryStorageKey = "new-ai-times-history";
export const newsHomeExposureStorageKey = "new-ai-times-home-exposures";
export const newsGuardrailStorageKey = "new-ai-times-guardrails";
export const newsPositiveFeedbackStorageKey = "new-ai-times-positive-feedback";
export const newsRestoredGuardrailStorageKey =
  "new-ai-times-restored-guardrails";
export const newsSearchStorageKey = "new-ai-times-searches";
export const newsReaderMemoryChangeEventName =
  "new-ai-times-reader-memory-change";

export interface NewsSearchMemoryItem {
  query: string;
  resultCount: number;
  searchedAt: string;
}

const newsGuardrailMemoryRetentionMs = 30 * 24 * 60 * 60 * 1000;
const newsHomeExposureMemoryRetentionMs = 2 * 24 * 60 * 60 * 1000;
const newsSearchMemoryRetentionMs = 14 * 24 * 60 * 60 * 1000;
const newsSearchMemoryQueryMaxLength = 120;

const newsReaderMemoryStorageKeys = new Set([
  newsSavedStorageKey,
  newsHistoryStorageKey,
  newsHomeExposureStorageKey,
  newsGuardrailStorageKey,
  newsPositiveFeedbackStorageKey,
  newsRestoredGuardrailStorageKey,
  newsSearchStorageKey,
]);

const isNewsReaderMemoryStorageKey = (storageKey: string | null) =>
  storageKey === null || newsReaderMemoryStorageKeys.has(storageKey);

const dispatchNewsReaderMemoryChangeEvent = (storageKey: string) => {
  if (
    typeof window === "undefined" ||
    !isNewsReaderMemoryStorageKey(storageKey)
  ) {
    return;
  }

  window.dispatchEvent(new Event(newsReaderMemoryChangeEventName));
};

export const subscribeToNewsReaderMemoryStorage = (
  onStoreChange: () => void,
) => {
  if (typeof window === "undefined") return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (isNewsReaderMemoryStorageKey(event.key)) onStoreChange();
  };
  const handleMemoryChange = () => onStoreChange();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(newsReaderMemoryChangeEventName, handleMemoryChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(
      newsReaderMemoryChangeEventName,
      handleMemoryChange,
    );
  };
};

const readStorageJson = (storageKey: string): unknown => {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as unknown;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const normalizeNewsSearchMemoryQuery = (query: string) =>
  query
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, newsSearchMemoryQueryMaxLength)
    .trim();

const toValidIsoTimestamp = (value: unknown) => {
  if (typeof value !== "string") return null;

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? value : null;
};

const toNewsSearchMemoryItem = (
  value: unknown,
): NewsSearchMemoryItem | null => {
  if (!isRecord(value)) return null;

  const query =
    typeof value.query === "string"
      ? normalizeNewsSearchMemoryQuery(value.query)
      : "";
  const searchedAt = toValidIsoTimestamp(value.searchedAt);
  const resultCount =
    typeof value.resultCount === "number" && Number.isFinite(value.resultCount)
      ? Math.max(0, Math.round(value.resultCount))
      : 0;

  if (!query || !searchedAt) return null;

  return {
    query,
    resultCount,
    searchedAt,
  };
};

const sortSearchMemoryItems = (
  left: NewsSearchMemoryItem,
  right: NewsSearchMemoryItem,
) => Date.parse(right.searchedAt) - Date.parse(left.searchedAt);

const isFreshPastTimestamp = (timestamp: number, retentionMs: number) => {
  if (!Number.isFinite(timestamp)) return false;

  const now = Date.now();

  return timestamp <= now && now - timestamp <= retentionMs;
};

const getLatestValidTimestamp = (
  timestamps: readonly (null | string | undefined)[],
) =>
  timestamps.reduce<number | null>((latest, timestamp) => {
    const time = Date.parse(timestamp ?? "");

    if (!Number.isFinite(time)) return latest;
    if (latest === null || time > latest) return time;

    return latest;
  }, null);

const isFreshNewsSearchMemoryItem = (item: NewsSearchMemoryItem) => {
  const searchedAt = Date.parse(item.searchedAt);

  return isFreshPastTimestamp(searchedAt, newsSearchMemoryRetentionMs);
};

const isFreshNewsGuardrailMemoryItem = (item: NewsReaderMemoryItem) => {
  const hiddenAt = getLatestValidTimestamp([item.hiddenAt, item.occurredAt]);

  return isFreshPastTimestamp(
    hiddenAt ?? Number.NaN,
    newsGuardrailMemoryRetentionMs,
  );
};

const isFreshNewsHomeExposureMemoryItem = (item: NewsReaderMemoryItem) => {
  const viewedAt = getLatestValidTimestamp([item.viewedAt, item.occurredAt]);

  return isFreshPastTimestamp(
    viewedAt ?? Number.NaN,
    newsHomeExposureMemoryRetentionMs,
  );
};

const selectFreshNewsReaderMemoryItems = (
  storageKey: string,
  items: readonly NewsReaderMemoryItem[],
) =>
  storageKey === newsGuardrailStorageKey
    ? items.filter(isFreshNewsGuardrailMemoryItem)
    : storageKey === newsHomeExposureStorageKey
      ? items.filter(isFreshNewsHomeExposureMemoryItem)
      : [...items];

export const selectStoredNewsSearchMemoryItems = (
  value: unknown,
): NewsSearchMemoryItem[] => {
  if (!Array.isArray(value)) return [];

  const seenQueries = new Set<string>();
  const searchItems: NewsSearchMemoryItem[] = [];
  const normalizedItems = value
    .map(toNewsSearchMemoryItem)
    .filter((item): item is NewsSearchMemoryItem => item !== null)
    .filter(isFreshNewsSearchMemoryItem)
    .sort(sortSearchMemoryItems);

  for (const item of normalizedItems) {
    const queryKey = item.query.toLowerCase();

    if (seenQueries.has(queryKey)) continue;

    searchItems.push(item);
    seenQueries.add(queryKey);
  }

  return searchItems.sort(sortSearchMemoryItems).slice(0, 20);
};

export const emptyNewsSearchMemorySnapshot = "[]";

export const readNewsSearchMemorySnapshot = () => {
  if (typeof window === "undefined") return emptyNewsSearchMemorySnapshot;

  return (
    window.localStorage.getItem(newsSearchStorageKey) ??
    emptyNewsSearchMemorySnapshot
  );
};

export const parseNewsSearchMemorySnapshot = (snapshot: string) => {
  try {
    return selectStoredNewsSearchMemoryItems(JSON.parse(snapshot) as unknown);
  } catch {
    return [];
  }
};

export const readStoredNewsReaderMemoryItems = (storageKey: string) =>
  selectFreshNewsReaderMemoryItems(
    storageKey,
    selectStoredNewsReaderMemoryItems(readStorageJson(storageKey)),
  );

export const writeStoredNewsReaderMemoryItems = (
  storageKey: string,
  items: readonly NewsReaderMemoryItem[],
) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    storageKey,
    JSON.stringify(selectFreshNewsReaderMemoryItems(storageKey, items)),
  );
  dispatchNewsReaderMemoryChangeEvent(storageKey);
};

export const clearStoredNewsReaderMemoryItems = (storageKey: string) => {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(storageKey);
  dispatchNewsReaderMemoryChangeEvent(storageKey);
};

export const readStoredNewsPositiveFeedbackItems = () =>
  selectStoredNewsPositiveFeedbackItems(
    readStorageJson(newsPositiveFeedbackStorageKey),
  );

export const writeStoredNewsPositiveFeedbackItems = (
  items: readonly NewsPositiveFeedbackMemoryItem[],
) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    newsPositiveFeedbackStorageKey,
    JSON.stringify(items),
  );
  dispatchNewsReaderMemoryChangeEvent(newsPositiveFeedbackStorageKey);
};

export const readStoredNewsSearchMemoryItems = () =>
  selectStoredNewsSearchMemoryItems(readStorageJson(newsSearchStorageKey));

export const writeStoredNewsSearchMemoryItems = (
  items: readonly NewsSearchMemoryItem[],
) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    newsSearchStorageKey,
    JSON.stringify(selectStoredNewsSearchMemoryItems(items)),
  );
  dispatchNewsReaderMemoryChangeEvent(newsSearchStorageKey);
};

export const recordStoredNewsSearchMemoryItem = ({
  query,
  resultCount,
  searchedAt = new Date().toISOString(),
}: {
  query: string;
  resultCount: number;
  searchedAt?: string;
}) => {
  if (typeof window === "undefined") return;

  const searchItem = toNewsSearchMemoryItem({
    query,
    resultCount,
    searchedAt,
  });

  if (!searchItem) return;

  writeStoredNewsSearchMemoryItems([
    searchItem,
    ...readStoredNewsSearchMemoryItems(),
  ]);
};
