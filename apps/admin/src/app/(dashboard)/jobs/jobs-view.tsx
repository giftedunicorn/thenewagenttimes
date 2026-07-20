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

export type JobsListData = inferRouterOutputs<AppRouter>["jobs"]["list"];

export interface JobsFilters {
  jobType?: "news_embed" | "news_refresh";
  status?: "failed" | "queued" | "running" | "succeeded";
}

interface JobsViewProps {
  data: JobsListData | undefined;
  filters: JobsFilters;
  isError: boolean;
  isPending: boolean;
  isRefreshing: boolean;
  onFiltersChange: (filters: JobsFilters) => void;
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

const formatDuration = (milliseconds: number | null) => {
  if (milliseconds === null) return "—";
  const seconds = Math.round(milliseconds / 1_000);
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

export function JobsView({
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
}: JobsViewProps) {
  if (isPending) return <PageState state="loading" title="Loading jobs" />;
  if (isError || !data) {
    return <PageState onRetry={onRetry} state="error" />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Queue state, attempts, leases, and execution timing.
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
                value === "all" ? undefined : (value as JobsFilters["status"]),
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
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              jobType:
                value === "all" ? undefined : (value as JobsFilters["jobType"]),
            })
          }
          value={filters.jobType ?? "all"}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All job types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All job types</SelectItem>
            <SelectItem value="news_refresh">News refresh</SelectItem>
            <SelectItem value="news_embed">News embed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.items.length === 0 ? (
        <PageState
          description="No jobs match the current filters."
          state="empty"
          title="No jobs"
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Queue state</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Queue wait</TableHead>
                <TableHead>Execution</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>{formatDateTime(job.createdAt)}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={
                        job.status === "succeeded"
                          ? "healthy"
                          : job.status === "failed" ||
                              job.timing.state === "expired"
                            ? "critical"
                            : job.timing.state === "overdue" ||
                                job.timing.state === "retrying"
                              ? "degraded"
                              : "neutral"
                      }
                    >
                      {job.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {job.jobType}
                  </TableCell>
                  <TableCell>{job.timing.state}</TableCell>
                  <TableCell className="tabular-nums">
                    {job.attempts} / {job.maxAttempts}
                  </TableCell>
                  <TableCell>
                    {formatDuration(job.timing.queueWaitMs)}
                  </TableCell>
                  <TableCell>
                    {formatDuration(job.timing.executionMs)}
                  </TableCell>
                  <TableCell className="max-w-64 truncate">
                    {job.errorMessage ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      onClick={() => onSelect(job.id)}
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
