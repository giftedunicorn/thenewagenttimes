import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@acme/admin-api";

import {
  DetailDialog,
  DetailGrid,
  JsonBlock,
} from "../../_components/detail-dialog";
import { StatusBadge } from "../../_components/status-badge";

type IngestionDetail = inferRouterOutputs<AppRouter>["ingestion"]["byId"];

export function IngestionDetailContent({
  data,
}: {
  data: NonNullable<IngestionDetail>;
}) {
  return (
    <div className="space-y-6">
      <DetailGrid
        rows={[
          { label: "ID", value: <code>{data.id}</code> },
          {
            label: "Status",
            value: (
              <StatusBadge
                status={
                  data.status === "succeeded"
                    ? "healthy"
                    : data.status === "failed"
                      ? "critical"
                      : "degraded"
                }
              >
                {data.status}
              </StatusBadge>
            ),
          },
          { label: "Run type", value: data.runType },
          { label: "Source", value: data.sourceName ?? "All sources" },
          { label: "Started", value: data.startedAt },
          { label: "Finished", value: data.finishedAt ?? "Running" },
          {
            label: "Seen / created / updated",
            value: `${data.itemsSeen} / ${data.itemsCreated} / ${data.itemsUpdated}`,
          },
          { label: "Error", value: data.errorMessage ?? "—" },
        ]}
      />
      <JsonBlock data={data.sourceHealth} label="Source health diagnostics" />
    </div>
  );
}

export function IngestionDetailDialog({
  data,
  isError,
  isPending,
  onOpenChange,
  onRetry,
  open,
}: {
  data: IngestionDetail | undefined;
  isError: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  open: boolean;
}) {
  return (
    <DetailDialog
      description="Source diagnostics and persisted run counters."
      isError={isError}
      isPending={isPending}
      onOpenChange={onOpenChange}
      onRetry={onRetry}
      open={open}
      title="Ingestion run detail"
    >
      {data ? (
        <IngestionDetailContent data={data} />
      ) : (
        <p className="text-muted-foreground text-sm">
          The ingestion run no longer exists.
        </p>
      )}
    </DetailDialog>
  );
}
