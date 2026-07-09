import type {
  NewsPreferenceProfile,
  NewsRecommendationRotationObjective,
} from "@acme/validators";
import { normalizeNewsPreferenceProfile } from "@acme/validators";

export const newsForYouObjectiveStorageKey = "new-ai-times-for-you-objective";
export const newsForYouObjectiveChangeEventName =
  "new-ai-times-for-you-objective-change";
export const newsPreferenceProfileStorageKey = "new-ai-times-profile";
export const newsPreferenceProfileChangeEventName =
  "new-ai-times-profile-change";
export const newsVisitorStorageKey = "new-ai-times-visitor-key";
export const emptyNewsPreferenceProfileSnapshot = "";

const defaultNewsForYouObjective: NewsRecommendationRotationObjective =
  "reader_match";
const minNewsVisitorKeyLength = 8;
const maxNewsVisitorKeyLength = 160;
const newsForYouObjectives = [
  "exploration",
  "market_heat",
  "reader_match",
  "source_trust",
] as const satisfies readonly NewsRecommendationRotationObjective[];
const newsServerPreferenceCategoryValues = [
  "funding",
  "product_hunt",
  "model_release",
  "new_concept",
  "hot_take",
  "agent_product",
  "big_tech",
  "musk_ai",
  "yc_ai",
  "research",
  "policy",
  "security",
  "open_source",
  "market_map",
  "other",
] as const;

type NewsServerPreferenceCategory =
  (typeof newsServerPreferenceCategoryValues)[number];

const isNewsServerPreferenceCategory = (
  category: string,
): category is NewsServerPreferenceCategory =>
  newsServerPreferenceCategoryValues.some((value) => value === category);

const toNewsServerPreferenceCategory = (
  category: string,
): NewsServerPreferenceCategory | null => {
  const categoryKey = category
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");

  return isNewsServerPreferenceCategory(categoryKey) ? categoryKey : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readStringArray = (
  value: unknown,
  fallback: readonly string[],
): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [...fallback];

const readFiniteNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const readNewsPreferenceProfileSnapshot = () =>
  typeof window === "undefined"
    ? emptyNewsPreferenceProfileSnapshot
    : (window.localStorage.getItem(newsPreferenceProfileStorageKey) ??
      emptyNewsPreferenceProfileSnapshot);

export const parseStoredNewsForYouObjective = (
  stored: string | null,
): NewsRecommendationRotationObjective =>
  newsForYouObjectives.find((objective) => objective === stored) ??
  defaultNewsForYouObjective;

export const readStoredNewsForYouObjective = () =>
  typeof window === "undefined"
    ? defaultNewsForYouObjective
    : parseStoredNewsForYouObjective(
        window.localStorage.getItem(newsForYouObjectiveStorageKey),
      );

export const readOrCreateNewsVisitorKey = () => {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(newsVisitorStorageKey);
  const trimmedStored = stored?.trim() ?? "";
  if (
    trimmedStored.length >= minNewsVisitorKeyLength &&
    trimmedStored.length <= maxNewsVisitorKeyLength
  ) {
    if (stored !== trimmedStored) {
      window.localStorage.setItem(newsVisitorStorageKey, trimmedStored);
    }

    return trimmedStored;
  }

  const next =
    typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(newsVisitorStorageKey, next);
  return next;
};

export const getNewsPreferenceProfileStorageValue = (
  profile: NewsPreferenceProfile,
) => JSON.stringify(normalizeNewsPreferenceProfile(profile));

export const toNewsServerPreferenceProfileInput = (
  profile: NewsPreferenceProfile,
) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  return {
    noveltyBias: normalizedProfile.noveltyBias,
    preferredCategories: normalizedProfile.preferredCategories
      .map(toNewsServerPreferenceCategory)
      .filter(
        (category): category is NewsServerPreferenceCategory =>
          category !== null,
      )
      .slice(0, 12),
    preferredEntities: normalizedProfile.preferredEntities.slice(0, 24),
    preferredSources: normalizedProfile.preferredSources.slice(0, 12),
    recencyBias: normalizedProfile.recencyBias,
  };
};

export const areNewsPreferenceProfilesEqual = (
  left: NewsPreferenceProfile,
  right: NewsPreferenceProfile,
) =>
  getNewsPreferenceProfileStorageValue(left) ===
  getNewsPreferenceProfileStorageValue(right);

export const subscribeToNewsPreferenceProfileStorage = (
  onStoreChange: () => void,
) => {
  if (typeof window === "undefined") return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (event.key === newsPreferenceProfileStorageKey) onStoreChange();
  };
  const handleProfileChange = () => onStoreChange();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(
    newsPreferenceProfileChangeEventName,
    handleProfileChange,
  );

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(
      newsPreferenceProfileChangeEventName,
      handleProfileChange,
    );
  };
};

export const subscribeToNewsForYouObjectiveStorage = (
  onStoreChange: () => void,
) => {
  if (typeof window === "undefined") return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (event.key === newsForYouObjectiveStorageKey) onStoreChange();
  };
  const handleObjectiveChange = () => onStoreChange();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(
    newsForYouObjectiveChangeEventName,
    handleObjectiveChange,
  );

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(
      newsForYouObjectiveChangeEventName,
      handleObjectiveChange,
    );
  };
};

export const parseStoredNewsPreferenceProfile = ({
  defaultProfile,
  stored,
}: {
  defaultProfile: NewsPreferenceProfile;
  stored: string | null;
}): NewsPreferenceProfile => {
  if (!stored) return defaultProfile;

  try {
    const parsed: unknown = JSON.parse(stored);

    if (!isRecord(parsed)) return defaultProfile;

    return normalizeNewsPreferenceProfile({
      noveltyBias: readFiniteNumber(
        parsed.noveltyBias,
        defaultProfile.noveltyBias,
      ),
      preferredCategories: readStringArray(
        parsed.preferredCategories,
        defaultProfile.preferredCategories,
      ),
      preferredEntities: readStringArray(
        parsed.preferredEntities,
        defaultProfile.preferredEntities,
      ),
      preferredSources: readStringArray(
        parsed.preferredSources,
        defaultProfile.preferredSources,
      ),
      recencyBias: readFiniteNumber(
        parsed.recencyBias,
        defaultProfile.recencyBias,
      ),
    });
  } catch {
    return defaultProfile;
  }
};

export const readStoredNewsPreferenceProfile = ({
  defaultProfile,
}: {
  defaultProfile: NewsPreferenceProfile;
}) =>
  parseStoredNewsPreferenceProfile({
    defaultProfile,
    stored: readNewsPreferenceProfileSnapshot(),
  });

export const writeStoredNewsPreferenceProfile = (
  profile: NewsPreferenceProfile,
) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    newsPreferenceProfileStorageKey,
    getNewsPreferenceProfileStorageValue(profile),
  );
  window.dispatchEvent(new Event(newsPreferenceProfileChangeEventName));
};

export const writeStoredNewsForYouObjective = (
  objective: NewsRecommendationRotationObjective,
) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(newsForYouObjectiveStorageKey, objective);
  window.dispatchEvent(new Event(newsForYouObjectiveChangeEventName));
};
