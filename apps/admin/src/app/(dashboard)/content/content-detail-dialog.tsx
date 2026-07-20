import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@acme/admin-api";

import {
  DetailDialog,
  DetailGrid,
  JsonBlock,
} from "../../_components/detail-dialog";
import { StatusBadge } from "../../_components/status-badge";

type ContentDetail = inferRouterOutputs<AppRouter>["content"]["byId"];

const ExternalLink = ({ href, label }: { href: string; label: string }) => (
  <a
    className="text-primary break-all hover:underline"
    href={href}
    rel="nofollow noopener noreferrer"
    target="_blank"
  >
    {label}
  </a>
);

export function ContentDetailContent({
  data,
}: {
  data: NonNullable<ContentDetail>;
}) {
  return (
    <div className="space-y-6">
      <DetailGrid
        rows={[
          { label: "Title", value: data.title },
          {
            label: "Status",
            value: (
              <StatusBadge
                status={
                  data.status === "published"
                    ? "healthy"
                    : data.status === "rejected"
                      ? "critical"
                      : "neutral"
                }
              >
                {data.status}
              </StatusBadge>
            ),
          },
          { label: "Source", value: data.sourceName },
          { label: "Category", value: data.category },
          { label: "Author", value: data.authorName ?? "—" },
          { label: "Language", value: data.language },
          {
            label: "Canonical URL",
            value: (
              <ExternalLink
                href={data.canonicalUrl}
                label={data.canonicalUrl}
              />
            ),
          },
          {
            label: "Original URL",
            value: (
              <ExternalLink href={data.originalUrl} label={data.originalUrl} />
            ),
          },
          { label: "Cluster key", value: <code>{data.clusterKey}</code> },
          { label: "Dedupe key", value: <code>{data.dedupeKey}</code> },
          { label: "Summary", value: data.summary },
        ]}
      />
      <JsonBlock data={data.tags} label="Tags" />
      <JsonBlock data={data.entities} label="Entities" />
    </div>
  );
}

export function ContentDetailDialog({
  data,
  isError,
  isPending,
  onOpenChange,
  onRetry,
  open,
}: {
  data: ContentDetail | undefined;
  isError: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  open: boolean;
}) {
  return (
    <DetailDialog
      description="Editorial, source, and deduplication fields."
      isError={isError}
      isPending={isPending}
      onOpenChange={onOpenChange}
      onRetry={onRetry}
      open={open}
      title="Content detail"
    >
      {data ? (
        <ContentDetailContent data={data} />
      ) : (
        <p className="text-muted-foreground text-sm">
          The content item no longer exists.
        </p>
      )}
    </DetailDialog>
  );
}
