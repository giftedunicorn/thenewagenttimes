import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { OverviewData } from "./overview-view";
import { OverviewView } from "./overview-view";

const healthyData: OverviewData = {
  health: { findings: [], state: "healthy" },
  snapshot: {
    activeSourceCount: 8,
    daily: [
      {
        collected: 24,
        date: "2026-07-20",
        failedIngestions: 0,
        succeededIngestions: 2,
      },
    ],
    ingestion: {
      finishedAt: "2026-07-20T11:35:00.000Z",
      itemsCreated: 12,
      itemsSeen: 30,
      itemsUpdated: 4,
      startedAt: "2026-07-20T11:30:00.000Z",
      status: "succeeded",
    },
    jobs: {
      expiredLeaseCount: 0,
      failed: 0,
      oldestDueQueuedAt: null,
      queued: 1,
      running: 0,
      succeeded: 24,
    },
    news: {
      collected24h: 120,
      embeddedPublishedTotal: 480,
      latestPublishedAt: "2026-07-20T10:00:00.000Z",
      published24h: 80,
      publishedTotal: 500,
    },
    sourceCount: 10,
  },
};

describe("OverviewView", () => {
  it("renders loading and request error states", () => {
    expect(
      renderToStaticMarkup(
        <OverviewView
          data={undefined}
          isError={false}
          isPending
          isRefreshing={false}
          onRefresh={() => undefined}
          onRetry={() => undefined}
        />,
      ),
    ).toContain("Loading");
    expect(
      renderToStaticMarkup(
        <OverviewView
          data={undefined}
          isError
          isPending={false}
          isRefreshing={false}
          onRefresh={() => undefined}
          onRetry={() => undefined}
        />,
      ),
    ).toContain("Try again");
  });

  it("renders the bootstrap empty state", () => {
    const html = renderToStaticMarkup(
      <OverviewView
        data={{
          ...healthyData,
          health: {
            findings: [
              {
                code: "no-content",
                message: "No published content is available.",
                severity: "warning",
              },
            ],
            state: "degraded",
          },
          snapshot: {
            ...healthyData.snapshot,
            ingestion: null,
            news: {
              ...healthyData.snapshot.news,
              latestPublishedAt: null,
              publishedTotal: 0,
            },
          },
        }}
        isError={false}
        isPending={false}
        isRefreshing={false}
        onRefresh={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(html).toContain("No published content yet");
  });

  it("renders healthy metrics and critical findings", () => {
    const healthyHtml = renderToStaticMarkup(
      <OverviewView
        data={healthyData}
        isError={false}
        isPending={false}
        isRefreshing={false}
        onRefresh={() => undefined}
        onRetry={() => undefined}
      />,
    );
    const criticalHtml = renderToStaticMarkup(
      <OverviewView
        data={{
          ...healthyData,
          health: {
            findings: [
              {
                code: "expired-job-lease",
                message: "2 running jobs have expired leases.",
                severity: "critical",
              },
            ],
            state: "critical",
          },
        }}
        isError={false}
        isPending={false}
        isRefreshing={false}
        onRefresh={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(healthyHtml).toContain("System healthy");
    expect(healthyHtml).toContain("120");
    expect(criticalHtml).toContain("2 running jobs have expired leases.");
  });
});
