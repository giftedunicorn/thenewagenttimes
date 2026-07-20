"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { JobsFilters } from "./jobs-view";
import { useTRPC } from "~/trpc/react";
import { AUTO_REFRESH_INTERVAL_MS } from "../../_components/monitoring";
import { JobDetailDialog } from "./job-detail-dialog";
import { JobsView } from "./jobs-view";

const EMPTY_UUID = "00000000-0000-4000-8000-000000000000";

export default function JobsPage() {
  const [filters, setFilters] = useState<JobsFilters>({});
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.jobs.list.queryOptions({
      ...filters,
      page,
      pageSize: 20,
    }),
    refetchInterval: AUTO_REFRESH_INTERVAL_MS,
  });
  const detailQuery = useQuery(
    trpc.jobs.byId.queryOptions(
      { id: selectedId ?? EMPTY_UUID },
      { enabled: selectedId !== null },
    ),
  );

  return (
    <>
      <JobsView
        data={query.data}
        filters={filters}
        isError={query.isError}
        isPending={query.isPending}
        isRefreshing={query.isFetching}
        onFiltersChange={(nextFilters) => {
          setFilters(nextFilters);
          setPage(0);
        }}
        onPageChange={setPage}
        onRetry={() => void query.refetch()}
        onRefresh={() => void query.refetch()}
        onSelect={setSelectedId}
        page={page}
      />
      <JobDetailDialog
        data={detailQuery.data}
        isError={detailQuery.isError}
        isPending={detailQuery.isPending}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onRetry={() => void detailQuery.refetch()}
        open={selectedId !== null}
      />
    </>
  );
}
