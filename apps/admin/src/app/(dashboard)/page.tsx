"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";
import { AUTO_REFRESH_INTERVAL_MS } from "../_components/monitoring";
import { OverviewView } from "./overview-view";

export default function OverviewPage() {
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.overview.get.queryOptions(),
    refetchInterval: AUTO_REFRESH_INTERVAL_MS,
  });

  return (
    <OverviewView
      data={query.data}
      isError={query.isError}
      isPending={query.isPending}
      isRefreshing={query.isFetching}
      onRefresh={() => void query.refetch()}
      onRetry={() => void query.refetch()}
    />
  );
}
