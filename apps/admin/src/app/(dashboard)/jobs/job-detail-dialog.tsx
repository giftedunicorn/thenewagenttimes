import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@acme/admin-api";

import {
  DetailDialog,
  DetailGrid,
  JsonBlock,
} from "../../_components/detail-dialog";
import { StatusBadge } from "../../_components/status-badge";

type JobDetail = inferRouterOutputs<AppRouter>["jobs"]["byId"];

export function JobDetailContent({ data }: { data: NonNullable<JobDetail> }) {
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
                    : data.status === "failed" ||
                        data.timing.state === "expired"
                      ? "critical"
                      : "degraded"
                }
              >
                {data.status}
              </StatusBadge>
            ),
          },
          { label: "Type", value: data.jobType },
          { label: "Dedupe key", value: <code>{data.dedupeKey}</code> },
          {
            label: "Attempts",
            value: `${data.attempts} / ${data.maxAttempts}`,
          },
          { label: "Queue state", value: data.timing.state },
          { label: "Locked by", value: data.lockedBy ?? "—" },
          { label: "Error", value: data.errorMessage ?? "—" },
        ]}
      />
      <JsonBlock data={data.payload} label="Payload" />
      <JsonBlock data={data.result} label="Result" />
    </div>
  );
}

export function JobDetailDialog({
  data,
  isError,
  isPending,
  onOpenChange,
  onRetry,
  open,
}: {
  data: JobDetail | undefined;
  isError: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  open: boolean;
}) {
  return (
    <DetailDialog
      description="Queue identity, timing, payload, and result."
      isError={isError}
      isPending={isPending}
      onOpenChange={onOpenChange}
      onRetry={onRetry}
      open={open}
      title="Job detail"
    >
      {data ? (
        <JobDetailContent data={data} />
      ) : (
        <p className="text-muted-foreground text-sm">
          The job no longer exists.
        </p>
      )}
    </DetailDialog>
  );
}
