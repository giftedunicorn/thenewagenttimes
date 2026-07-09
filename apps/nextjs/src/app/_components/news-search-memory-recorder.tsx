"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";
import {
  normalizeNewsSearchMemoryQuery,
  recordStoredNewsSearchMemoryItem,
} from "./news-reader-memory-storage";
import { readOrCreateNewsVisitorKey } from "./news-reader-profile-storage";

export const getNewsSearchMemoryRecordInput = ({
  query,
  resultCount,
}: {
  query: string;
  resultCount: number;
}) => {
  const normalizedQuery = normalizeNewsSearchMemoryQuery(query);

  if (!normalizedQuery) return null;

  return {
    query: normalizedQuery,
    resultCount:
      Number.isFinite(resultCount) && resultCount > 0
        ? Math.round(resultCount)
        : 0,
  };
};

export const shouldPersistNewsSearchMemoryToServer = ({
  canPersistServerMemory,
  visitorKey,
}: {
  canPersistServerMemory: boolean;
  visitorKey: string | null;
}) => canPersistServerMemory && Boolean(visitorKey);

export function NewsSearchMemoryRecorder({
  canPersistServerMemory = true,
  query,
  resultCount,
}: {
  canPersistServerMemory?: boolean;
  query: string;
  resultCount: number;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [visitorKey] = useState<string | null>(() =>
    readOrCreateNewsVisitorKey(),
  );
  const recordedSearchMemoryKeyRef = useRef<string | null>(null);
  const { mutate: recordSearchMemory } = useMutation(
    trpc.news.recordSearchMemory.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.news.forYou.pathFilter()),
          queryClient.invalidateQueries(trpc.news.searchMemory.pathFilter()),
        ]);
      },
    }),
  );

  useEffect(() => {
    const recordInput = getNewsSearchMemoryRecordInput({
      query,
      resultCount,
    });

    if (!recordInput) return;

    const recordKey = `${recordInput.query}\n${recordInput.resultCount}\n${visitorKey ?? ""}`;

    if (recordedSearchMemoryKeyRef.current === recordKey) return;

    recordedSearchMemoryKeyRef.current = recordKey;

    recordStoredNewsSearchMemoryItem(recordInput);

    if (
      !shouldPersistNewsSearchMemoryToServer({
        canPersistServerMemory,
        visitorKey,
      })
    ) {
      return;
    }

    if (!visitorKey) return;

    recordSearchMemory({
      query: recordInput.query,
      resultCount: recordInput.resultCount,
      visitorKey,
    });
  }, [
    canPersistServerMemory,
    query,
    recordSearchMemory,
    resultCount,
    visitorKey,
  ]);

  return null;
}
