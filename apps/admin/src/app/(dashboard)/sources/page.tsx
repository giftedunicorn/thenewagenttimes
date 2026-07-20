"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";
import { AUTO_REFRESH_INTERVAL_MS } from "../../_components/monitoring";
import { SourcesView } from "./sources-view";

export default function SourcesPage() {
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.sources.list.queryOptions(),
    refetchInterval: AUTO_REFRESH_INTERVAL_MS,
  });

  return (
    <SourcesView
      data={query.data}
      isError={query.isError}
      isPending={query.isPending}
      isRefreshing={query.isFetching}
      onRefresh={() => void query.refetch()}
      onRetry={() => void query.refetch()}
    />
  );
}
