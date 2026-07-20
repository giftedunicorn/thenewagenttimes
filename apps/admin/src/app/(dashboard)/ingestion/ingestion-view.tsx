import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@acme/admin-api";
import { Button } from "@acme/ui/button";
import { Card } from "@acme/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@acme/ui/table";

import { PageState } from "../../_components/page-state";
import { Pagination } from "../../_components/pagination";
import { RefreshButton } from "../../_components/refresh-button";
import { StatusBadge } from "../../_components/status-badge";

export type IngestionListData =
  inferRouterOutputs<AppRouter>["ingestion"]["list"];

export interface IngestionFilters {
  runType?: "api" | "backfill" | "crawler" | "manual_import" | "rss";
  status?: "failed" | "partial" | "queued" | "running" | "succeeded";
}

interface IngestionViewProps {
  data: IngestionListData | undefined;
  filters: IngestionFilters;
  isError: boolean;
  isPending: boolean;
  isRefreshing: boolean;
  onFiltersChange: (filters: IngestionFilters) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onRefresh: () => void;
  onSelect: (id: string) => void;
  page: number;
}

const formatDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

const formatDuration = (startedAt: string, finishedAt: string | null) => {
  if (!finishedAt) return "Running";
  const seconds = Math.max(
    0,
    Math.round(
      (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1_000,
    ),
  );
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

export function IngestionView({
  data,
  filters,
  isError,
  isPending,
  isRefreshing,
  onFiltersChange,
  onPageChange,
  onRetry,
  onRefresh,
  onSelect,
  page,
}: IngestionViewProps) {
  if (isPending) {
    return <PageState state="loading" title="Loading ingestion runs" />;
  }
  if (isError || !data) {
    return <PageState onRetry={onRetry} state="error" />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ingestion</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Read-only visibility into collection runs and source failures.
          </p>
        </div>
        <RefreshButton isRefreshing={isRefreshing} onRefresh={onRefresh} />
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              status:
                value === "all"
                  ? undefined
                  : (value as IngestionFilters["status"]),
            })
          }
          value={filters.status ?? "all"}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="succeeded">Succeeded</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              runType:
                value === "all"
                  ? undefined
                  : (value as IngestionFilters["runType"]),
            })
          }
          value={filters.runType ?? "all"}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All run types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All run types</SelectItem>
            <SelectItem value="rss">RSS</SelectItem>
            <SelectItem value="api">API</SelectItem>
            <SelectItem value="crawler">Crawler</SelectItem>
            <SelectItem value="manual_import">Manual import</SelectItem>
            <SelectItem value="backfill">Backfill</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.items.length === 0 ? (
        <PageState
          description="No runs match the current filters."
          state="empty"
          title="No ingestion runs"
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">
                  Seen / new / updated
                </TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>{formatDateTime(run.startedAt)}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={
                        run.status === "succeeded"
                          ? "healthy"
                          : run.status === "failed"
                            ? "critical"
                            : run.status === "partial"
                              ? "degraded"
                              : "neutral"
                      }
                    >
                      {run.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {run.runType}
                  </TableCell>
                  <TableCell>{run.sourceName ?? "All sources"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {run.itemsSeen} / {run.itemsCreated} / {run.itemsUpdated}
                  </TableCell>
                  <TableCell>
                    {formatDuration(run.startedAt, run.finishedAt)}
                  </TableCell>
                  <TableCell className="max-w-64 truncate">
                    {run.errorMessage ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      onClick={() => onSelect(run.id)}
                      size="sm"
                      variant="ghost"
                    >
                      Inspect
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            onPageChange={(nextPage) => onPageChange(nextPage - 1)}
            page={page + 1}
            pageSize={20}
            total={data.total}
          />
        </Card>
      )}
    </div>
  );
}
