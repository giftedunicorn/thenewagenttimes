import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@acme/admin-api";
import { Button } from "@acme/ui/button";
import { Card } from "@acme/ui/card";
import { Input } from "@acme/ui/input";
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

export type ContentListData = inferRouterOutputs<AppRouter>["content"]["list"];
type ContentListInput = inferRouterInputs<AppRouter>["content"]["list"];
export type ContentFilters = Pick<
  ContentListInput,
  "category" | "embeddingStatus" | "search" | "status"
>;

interface ContentViewProps {
  data: ContentListData | undefined;
  filters: ContentFilters;
  isError: boolean;
  isPending: boolean;
  isRefreshing: boolean;
  onFiltersChange: (filters: ContentFilters) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onRefresh: () => void;
  onSelect: (id: string) => void;
  page: number;
}

const CATEGORIES: NonNullable<ContentFilters["category"]>[] = [
  "funding",
  "product_hunt",
  "model_release",
  "new_concept",
  "hot_take",
  "agent_product",
  "big_tech",
  "musk_ai",
  "yc_ai",
  "research",
  "policy",
  "security",
  "open_source",
  "market_map",
  "other",
];

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function ContentView({
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
}: ContentViewProps) {
  if (isPending) return <PageState state="loading" title="Loading content" />;
  if (isError || !data) {
    return <PageState onRetry={onRetry} state="error" />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Content</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Publishing, categorization, source, and embedding state.
          </p>
        </div>
        <RefreshButton isRefreshing={isRefreshing} onRefresh={onRefresh} />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Input
          aria-label="Search content"
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              search: event.target.value || undefined,
            })
          }
          placeholder="Search title or URL"
          value={filters.search ?? ""}
        />
        <Select
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              status:
                value === "all"
                  ? undefined
                  : (value as ContentFilters["status"]),
            })
          }
          value={filters.status ?? "all"}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="duplicate">Duplicate</SelectItem>
          </SelectContent>
        </Select>
        <Select
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              embeddingStatus:
                value === "all"
                  ? undefined
                  : (value as ContentFilters["embeddingStatus"]),
            })
          }
          value={filters.embeddingStatus ?? "all"}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All embeddings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All embeddings</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="embedded">Embedded</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
        <Select
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              category:
                value === "all"
                  ? undefined
                  : (value as ContentFilters["category"]),
            })
          }
          value={filters.category ?? "all"}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {category.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data.items.length === 0 ? (
        <PageState
          description="No stories match the current filters."
          state="empty"
          title="No content"
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Collected</TableHead>
                <TableHead>Story</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Embedding</TableHead>
                <TableHead className="text-right">Scores</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDateTime(item.collectedAt)}</TableCell>
                  <TableCell className="max-w-96 whitespace-normal">
                    <a
                      className="font-medium hover:underline"
                      href={item.canonicalUrl}
                      rel="nofollow noopener noreferrer"
                      target="_blank"
                    >
                      {item.title}
                    </a>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={
                        item.status === "published"
                          ? "healthy"
                          : item.status === "rejected"
                            ? "critical"
                            : "neutral"
                      }
                    >
                      {item.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{item.category.replaceAll("_", " ")}</TableCell>
                  <TableCell>{item.sourceName}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={
                        item.embeddingStatus === "embedded"
                          ? "healthy"
                          : item.embeddingStatus === "failed"
                            ? "critical"
                            : "neutral"
                      }
                    >
                      {item.embeddingStatus}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.sourceScore} / {item.trendScore}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      onClick={() => onSelect(item.id)}
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
