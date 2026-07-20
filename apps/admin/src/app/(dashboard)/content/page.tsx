"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { ContentFilters } from "./content-view";
import { useTRPC } from "~/trpc/react";
import { AUTO_REFRESH_INTERVAL_MS } from "../../_components/monitoring";
import { useDebouncedValue } from "../../_components/use-debounced-value";
import { ContentDetailDialog } from "./content-detail-dialog";
import { ContentView } from "./content-view";

const EMPTY_UUID = "00000000-0000-4000-8000-000000000000";

export default function ContentPage() {
  const [filters, setFilters] = useState<ContentFilters>({});
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(filters.search);
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.content.list.queryOptions({
      ...filters,
      page,
      pageSize: 20,
      search: debouncedSearch,
    }),
    refetchInterval: AUTO_REFRESH_INTERVAL_MS,
  });
  const detailQuery = useQuery(
    trpc.content.byId.queryOptions(
      { id: selectedId ?? EMPTY_UUID },
      { enabled: selectedId !== null },
    ),
  );

  return (
    <>
      <ContentView
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
      <ContentDetailDialog
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
