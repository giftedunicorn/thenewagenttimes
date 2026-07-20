import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JobDetailContent } from "./job-detail-dialog";
import { JobsView } from "./jobs-view";

const props = {
  filters: {},
  isRefreshing: false,
  onFiltersChange: () => undefined,
  onPageChange: () => undefined,
  onRefresh: () => undefined,
  onRetry: () => undefined,
  onSelect: () => undefined,
  page: 0,
};

describe("JobsView", () => {
  it("renders loading, empty, error, and a representative row", () => {
    expect(
      renderToStaticMarkup(
        <JobsView {...props} data={undefined} isError={false} isPending />,
      ),
    ).toContain("Loading");
    expect(
      renderToStaticMarkup(
        <JobsView {...props} data={undefined} isError isPending={false} />,
      ),
    ).toContain("Try again");
    expect(
      renderToStaticMarkup(
        <JobsView
          {...props}
          data={{ items: [], total: 0 }}
          isError={false}
          isPending={false}
        />,
      ),
    ).toContain("No jobs");
    expect(
      renderToStaticMarkup(
        <JobsView
          {...props}
          data={{
            items: [
              {
                attempts: 1,
                completedAt: null,
                createdAt: "2026-07-20T10:00:00.000Z",
                errorMessage: null,
                id: "11111111-1111-4111-8111-111111111111",
                jobType: "news_embed",
                lockExpiresAt: null,
                lockedBy: null,
                maxAttempts: 3,
                nextRunAt: "2026-07-20T10:00:00.000Z",
                startedAt: null,
                status: "queued",
                timing: {
                  executionMs: null,
                  queueWaitMs: null,
                  state: "retrying",
                },
                updatedAt: "2026-07-20T10:00:00.000Z",
              },
            ],
            total: 1,
          }}
          isError={false}
          isPending={false}
        />,
      ),
    ).toContain("news_embed");
    expect(
      renderToStaticMarkup(
        <JobsView
          {...props}
          data={{
            items: [
              {
                attempts: 1,
                completedAt: null,
                createdAt: "2026-07-20T10:00:00.000Z",
                errorMessage: null,
                id: "11111111-1111-4111-8111-111111111111",
                jobType: "news_embed",
                lockExpiresAt: null,
                lockedBy: null,
                maxAttempts: 3,
                nextRunAt: "2026-07-20T10:00:00.000Z",
                startedAt: null,
                status: "queued",
                timing: {
                  executionMs: null,
                  queueWaitMs: null,
                  state: "retrying",
                },
                updatedAt: "2026-07-20T10:00:00.000Z",
              },
            ],
            total: 1,
          }}
          isError={false}
          isPending={false}
        />,
      ),
    ).toContain("Inspect");
  });

  it("renders payload and result in the detail dialog", () => {
    const html = renderToStaticMarkup(
      <JobDetailContent
        data={{
          attempts: 1,
          completedAt: "2026-07-20T10:02:00.000Z",
          createdAt: "2026-07-20T10:00:00.000Z",
          dedupeKey: "embed:batch:1",
          errorMessage: null,
          id: "11111111-1111-4111-8111-111111111111",
          jobType: "news_embed",
          lockExpiresAt: null,
          lockedAt: null,
          lockedBy: null,
          maxAttempts: 3,
          nextRunAt: "2026-07-20T10:00:00.000Z",
          payload: { batch: 1, limit: 25 },
          result: { embedded: 25 },
          startedAt: "2026-07-20T10:01:00.000Z",
          status: "succeeded",
          timing: {
            executionMs: 60_000,
            queueWaitMs: 60_000,
            state: "complete",
          },
          updatedAt: "2026-07-20T10:02:00.000Z",
        }}
      />,
    );

    expect(html).toContain("Payload");
    expect(html).toContain("embed:batch:1");
    expect(html).toContain("embedded");
  });
});
