import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@acme/admin-api";
import { Card } from "@acme/ui/card";
import { Input } from "@acme/ui/input";
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

export type UsersListData = inferRouterOutputs<AppRouter>["users"]["list"];

interface UsersViewProps {
  data: UsersListData | undefined;
  isError: boolean;
  isPending: boolean;
  isRefreshing: boolean;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onRefresh: () => void;
  onSearchChange: (search: string) => void;
  page: number;
  search: string;
}

const formatDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Never";

export function UsersView({
  data,
  isError,
  isPending,
  isRefreshing,
  onPageChange,
  onRetry,
  onRefresh,
  onSearchChange,
  page,
  search,
}: UsersViewProps) {
  if (isPending) return <PageState state="loading" title="Loading users" />;
  if (isError || !data) {
    return <PageState onRetry={onRetry} state="error" />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Firebase identity linkage and reader activity.
          </p>
        </div>
        <RefreshButton isRefreshing={isRefreshing} onRefresh={onRefresh} />
      </header>

      <Input
        aria-label="Search users"
        className="max-w-sm"
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search name or email"
        value={search}
      />

      {data.items.length === 0 ? (
        <PageState
          description="No users match the current search."
          state="empty"
          title="No users"
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Identity</TableHead>
                <TableHead>Reader profile</TableHead>
                <TableHead>Interactions</TableHead>
                <TableHead>Latest interaction</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                        {item.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {item.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge
                        status={item.emailVerified ? "healthy" : "degraded"}
                      >
                        {item.emailVerified ? "Email verified" : "Unverified"}
                      </StatusBadge>
                      {item.firebaseLinked ? (
                        <StatusBadge status="healthy">
                          Firebase linked
                        </StatusBadge>
                      ) : (
                        <StatusBadge status="neutral">
                          No Firebase link
                        </StatusBadge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={item.readerProfile ? "healthy" : "neutral"}
                    >
                      {item.readerProfile ? "Available" : "None"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {item.interactionCount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {formatDateTime(item.latestInteractionAt)}
                  </TableCell>
                  <TableCell>{formatDateTime(item.createdAt)}</TableCell>
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
