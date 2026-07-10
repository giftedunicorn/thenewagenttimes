"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { NewsPreferenceProfile } from "@acme/validators";
import { Button } from "@acme/ui/button";
import { normalizeNewsPreferenceProfile } from "@acme/validators";

import type {
  NewsDirectoryPageEntry,
  NewsDirectoryPageKind,
} from "./news-directory-page";
import type { NewsHomeStatus } from "./news-home-model";
import { useTRPC } from "~/trpc/react";
import {
  createDefaultNewsPreferenceProfile,
  selectHydratedNewsPreferenceProfile,
} from "./news-home-model";
import {
  areNewsPreferenceProfilesEqual,
  emptyNewsPreferenceProfileSnapshot,
  parseStoredNewsPreferenceProfile,
  readNewsPreferenceProfileSnapshot,
  readOrCreateNewsVisitorKey,
  subscribeToNewsPreferenceProfileStorage,
  toNewsServerPreferenceProfileInput,
  writeStoredNewsPreferenceProfile,
} from "./news-reader-profile-storage";

const normalizeDirectoryFollowSignal = (value: string) =>
  value.trim().toLowerCase();

const addDirectoryFollowSignal = (
  values: readonly string[],
  signal: string,
) => {
  const trimmedSignal = signal.trim();
  const normalizedSignal = normalizeDirectoryFollowSignal(trimmedSignal);

  if (!normalizedSignal) return [...values];

  return values.some(
    (value) => normalizeDirectoryFollowSignal(value) === normalizedSignal,
  )
    ? [...values]
    : [...values, trimmedSignal];
};

const toggleDirectoryFollowSignal = (
  values: readonly string[],
  signal: string,
) => {
  const trimmedSignal = signal.trim();
  const normalizedSignal = normalizeDirectoryFollowSignal(trimmedSignal);

  if (!normalizedSignal) return [...values];

  return values.some(
    (value) => normalizeDirectoryFollowSignal(value) === normalizedSignal,
  )
    ? values.filter(
        (value) => normalizeDirectoryFollowSignal(value) !== normalizedSignal,
      )
    : [...values, trimmedSignal];
};

export const addNewsDirectoryFollowingSignal = ({
  kind,
  profile,
  signal,
}: {
  kind: NewsDirectoryPageKind;
  profile: NewsPreferenceProfile;
  signal: string;
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  if (kind === "topic") {
    return normalizeNewsPreferenceProfile({
      ...normalizedProfile,
      preferredCategories: addDirectoryFollowSignal(
        normalizedProfile.preferredCategories,
        signal,
      ),
    });
  }

  if (kind === "entity") {
    return normalizeNewsPreferenceProfile({
      ...normalizedProfile,
      preferredEntities: addDirectoryFollowSignal(
        normalizedProfile.preferredEntities,
        signal,
      ),
    });
  }

  return normalizeNewsPreferenceProfile({
    ...normalizedProfile,
    preferredSources: addDirectoryFollowSignal(
      normalizedProfile.preferredSources,
      signal,
    ),
  });
};

export const toggleNewsDirectoryFollowingSignal = ({
  kind,
  profile,
  signal,
}: {
  kind: NewsDirectoryPageKind;
  profile: NewsPreferenceProfile;
  signal: string;
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);

  if (kind === "topic") {
    return normalizeNewsPreferenceProfile({
      ...normalizedProfile,
      preferredCategories: toggleDirectoryFollowSignal(
        normalizedProfile.preferredCategories,
        signal,
      ),
    });
  }

  if (kind === "entity") {
    return normalizeNewsPreferenceProfile({
      ...normalizedProfile,
      preferredEntities: toggleDirectoryFollowSignal(
        normalizedProfile.preferredEntities,
        signal,
      ),
    });
  }

  return normalizeNewsPreferenceProfile({
    ...normalizedProfile,
    preferredSources: toggleDirectoryFollowSignal(
      normalizedProfile.preferredSources,
      signal,
    ),
  });
};

export const isNewsDirectoryFollowingSignalActive = ({
  kind,
  profile,
  signal,
}: {
  kind: NewsDirectoryPageKind;
  profile: NewsPreferenceProfile;
  signal: string;
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const values =
    kind === "topic"
      ? normalizedProfile.preferredCategories
      : kind === "entity"
        ? normalizedProfile.preferredEntities
        : normalizedProfile.preferredSources;
  const normalizedSignal = normalizeDirectoryFollowSignal(signal);

  return values.some(
    (value) => normalizeDirectoryFollowSignal(value) === normalizedSignal,
  );
};

export function NewsDirectoryFollowButton({
  entry,
  kind,
  status = "ready",
}: {
  entry: NewsDirectoryPageEntry;
  kind: NewsDirectoryPageKind;
  status?: NewsHomeStatus;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const defaultProfile = useMemo(
    () => createDefaultNewsPreferenceProfile(),
    [],
  );
  const [visitorKey] = useState<string | null>(() =>
    readOrCreateNewsVisitorKey(),
  );
  const canUseServerReaderMemory = status === "ready" && Boolean(visitorKey);
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

  const active = isNewsDirectoryFollowingSignalActive({
    kind,
    profile,
    signal: entry.value,
  });

  return (
    <Button
      aria-label={`${active ? "Following" : "Follow"} ${entry.title}`}
      className="h-8 rounded-none px-2 text-xs"
      disabled={
        updateProfile.isPending ||
        (canUseServerReaderMemory && profileQuery.isPending)
      }
      type="button"
      variant={active ? "secondary" : "outline"}
      onClick={() => {
        const nextProfile = toggleNewsDirectoryFollowingSignal({
          kind,
          profile,
          signal: entry.value,
        });

        writeStoredNewsPreferenceProfile(nextProfile);

        if (!canUseServerReaderMemory) return;
        if (!visitorKey) return;

        updateProfile.mutate({
          profile: toNewsServerPreferenceProfileInput(nextProfile),
          visitorKey,
        });
      }}
    >
      {active ? "Following" : "Follow"}
    </Button>
  );
}
