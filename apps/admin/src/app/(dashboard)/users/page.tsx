"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";
import { AUTO_REFRESH_INTERVAL_MS } from "../../_components/monitoring";
import { useDebouncedValue } from "../../_components/use-debounced-value";
import { UsersView } from "./users-view";

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebouncedValue(search);
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.users.list.queryOptions({
      page,
      pageSize: 20,
      search: debouncedSearch.trim() || undefined,
    }),
    refetchInterval: AUTO_REFRESH_INTERVAL_MS,
  });

  return (
    <UsersView
      data={query.data}
      isError={query.isError}
      isPending={query.isPending}
      isRefreshing={query.isFetching}
      onPageChange={setPage}
      onRetry={() => void query.refetch()}
      onRefresh={() => void query.refetch()}
      onSearchChange={(nextSearch) => {
        setSearch(nextSearch);
        setPage(0);
      }}
      page={page}
      search={search}
    />
  );
}
