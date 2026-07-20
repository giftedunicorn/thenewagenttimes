import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@acme/admin-api";
import { Card } from "@acme/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@acme/ui/table";

import { PageState } from "../../_components/page-state";
import { RefreshButton } from "../../_components/refresh-button";
import { StatusBadge } from "../../_components/status-badge";

export type SourcesData = inferRouterOutputs<AppRouter>["sources"]["list"];

interface SourcesViewProps {
  data: SourcesData | undefined;
  isError: boolean;
  isPending: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onRetry: () => void;
}

const formatDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Never";

export function SourcesView({
  data,
  isError,
  isPending,
  isRefreshing,
  onRefresh,
  onRetry,
}: SourcesViewProps) {
  if (isPending) return <PageState state="loading" title="Loading sources" />;
  if (isError || !data) {
    return <PageState onRetry={onRetry} state="error" />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Source configuration and recent collection health.
          </p>
        </div>
        <RefreshButton isRefreshing={isRefreshing} onRefresh={onRefresh} />
      </header>

      {data.items.length === 0 ? (
        <PageState
          description="No source records are configured."
          state="empty"
          title="No sources"
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Credibility</TableHead>
                <TableHead>Stories</TableHead>
                <TableHead>Latest content</TableHead>
                <TableHead>Latest ingestion</TableHead>
                <TableHead>Feed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((source) => (
                <TableRow key={source.id}>
                  <TableCell>
                    <a
                      className="font-medium hover:underline"
                      href={source.homepageUrl}
                      rel="nofollow noopener noreferrer"
                      target="_blank"
                    >
                      {source.name}
                    </a>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={
                        source.status === "inactive" ? "neutral" : source.status
                      }
                    >
                      {source.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{source.sourceType}</TableCell>
                  <TableCell className="tabular-nums">
                    {source.credibility}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {source.storyCount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {formatDateTime(source.latestCollectedAt)}
                  </TableCell>
                  <TableCell>
                    <span className="block">
                      {source.latestIngestionStatus ?? "Never"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(source.latestIngestionAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {source.feedUrl ? (
                      <a
                        className="hover:underline"
                        href={source.feedUrl}
                        rel="nofollow noopener noreferrer"
                        target="_blank"
                      >
                        Open
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
