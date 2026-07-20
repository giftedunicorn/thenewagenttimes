import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@acme/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@acme/ui/card";

import { PageState } from "../_components/page-state";
import { RefreshButton } from "../_components/refresh-button";
import { StatusBadge } from "../_components/status-badge";

export type OverviewData = inferRouterOutputs<AppRouter>["overview"]["get"];

interface OverviewViewProps {
  data: OverviewData | undefined;
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

const METRIC_LABELS = {
  activeSources: "Active sources",
  collected24h: "Collected · 24h",
  embedded: "Embedded stories",
  jobs: "Queued + running",
  published24h: "Published · 24h",
  publishedTotal: "Published stories",
} as const;

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        <CardTitle className="text-2xl tabular-nums">
          {value.toLocaleString()}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

export function OverviewView({
  data,
  isError,
  isPending,
  isRefreshing,
  onRefresh,
  onRetry,
}: OverviewViewProps) {
  if (isPending) return <PageState state="loading" title="Loading overview" />;
  if (isError || !data) {
    return <PageState onRetry={onRetry} state="error" />;
  }

  const { health, snapshot } = data;
  if (snapshot.news.publishedTotal === 0) {
    return (
      <div className="space-y-6">
        <OverviewHeader
          health={health}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
        />
        <PageState
          description="The dashboard is connected, but no published stories are available."
          state="empty"
          title="No published content yet"
        />
      </div>
    );
  }

  const maxCollected = Math.max(
    1,
    ...snapshot.daily.map(({ collected }) => collected),
  );

  return (
    <div className="space-y-6">
      <OverviewHeader
        health={health}
        isRefreshing={isRefreshing}
        onRefresh={onRefresh}
      />

      <section
        aria-label="Operational metrics"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
      >
        <MetricCard
          label={METRIC_LABELS.activeSources}
          value={snapshot.activeSourceCount}
        />
        <MetricCard
          label={METRIC_LABELS.collected24h}
          value={snapshot.news.collected24h}
        />
        <MetricCard
          label={METRIC_LABELS.published24h}
          value={snapshot.news.published24h}
        />
        <MetricCard
          label={METRIC_LABELS.publishedTotal}
          value={snapshot.news.publishedTotal}
        />
        <MetricCard
          label={METRIC_LABELS.embedded}
          value={snapshot.news.embeddedPublishedTotal}
        />
        <MetricCard
          label={METRIC_LABELS.jobs}
          value={snapshot.jobs.queued + snapshot.jobs.running}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Collected stories · 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid h-48 grid-cols-7 items-end gap-2">
              {snapshot.daily.map((day) => (
                <div
                  className="flex h-full min-w-0 flex-col justify-end gap-2"
                  key={day.date}
                >
                  <span className="text-muted-foreground text-center text-xs tabular-nums">
                    {day.collected}
                  </span>
                  <div className="bg-muted flex h-32 items-end overflow-hidden rounded-sm">
                    <div
                      aria-label={`${day.collected} stories collected on ${day.date}`}
                      className="bg-primary min-h-px w-full rounded-sm"
                      style={{
                        height: `${(day.collected / maxCollected) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-muted-foreground truncate text-center text-[10px]">
                    {day.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Findings</CardTitle>
          </CardHeader>
          <CardContent>
            {health.findings.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No active operational findings.
              </p>
            ) : (
              <ol className="space-y-3">
                {health.findings.map((finding) => (
                  <li className="rounded-lg border p-3" key={finding.code}>
                    <StatusBadge
                      status={
                        finding.severity === "critical"
                          ? "critical"
                          : "degraded"
                      }
                    >
                      {finding.severity}
                    </StatusBadge>
                    <p className="mt-2 text-sm">{finding.message}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Latest ingestion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {snapshot.ingestion ? (
              <>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge
                    status={
                      snapshot.ingestion.status === "succeeded"
                        ? "healthy"
                        : snapshot.ingestion.status === "failed"
                          ? "critical"
                          : "degraded"
                    }
                  >
                    {snapshot.ingestion.status}
                  </StatusBadge>
                </div>
                <SummaryRow
                  label="Started"
                  value={formatDateTime(snapshot.ingestion.startedAt)}
                />
                <SummaryRow
                  label="Seen / created / updated"
                  value={`${snapshot.ingestion.itemsSeen} / ${snapshot.ingestion.itemsCreated} / ${snapshot.ingestion.itemsUpdated}`}
                />
              </>
            ) : (
              <p className="text-muted-foreground">No ingestion runs yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Background jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <SummaryRow label="Queued" value={snapshot.jobs.queued} />
            <SummaryRow label="Running" value={snapshot.jobs.running} />
            <SummaryRow label="Failed" value={snapshot.jobs.failed} />
            <SummaryRow
              label="Oldest due"
              value={formatDateTime(snapshot.jobs.oldestDueQueuedAt)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OverviewHeader({
  health,
  isRefreshing,
  onRefresh,
}: {
  health: OverviewData["health"];
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const label = {
    critical: "System critical",
    degraded: "System degraded",
    healthy: "System healthy",
  }[health.state];

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Current publishing and ingestion health.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <RefreshButton isRefreshing={isRefreshing} onRefresh={onRefresh} />
        <StatusBadge status={health.state}>{label}</StatusBadge>
      </div>
    </header>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}
