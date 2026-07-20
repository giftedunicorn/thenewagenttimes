import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IngestionDetailContent } from "./ingestion-detail-dialog";
import { IngestionView } from "./ingestion-view";

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

describe("IngestionView", () => {
  it("renders loading, empty, error, and a representative row", () => {
    expect(
      renderToStaticMarkup(
        <IngestionView {...props} data={undefined} isError={false} isPending />,
      ),
    ).toContain("Loading");
    expect(
      renderToStaticMarkup(
        <IngestionView {...props} data={undefined} isError isPending={false} />,
      ),
    ).toContain("Try again");
    expect(
      renderToStaticMarkup(
        <IngestionView
          {...props}
          data={{ items: [], total: 0 }}
          isError={false}
          isPending={false}
        />,
      ),
    ).toContain("No ingestion runs");
    expect(
      renderToStaticMarkup(
        <IngestionView
          {...props}
          data={{
            items: [
              {
                errorMessage: null,
                finishedAt: "2026-07-20T10:05:00.000Z",
                id: "11111111-1111-4111-8111-111111111111",
                itemsCreated: 12,
                itemsSeen: 30,
                itemsUpdated: 4,
                runType: "rss",
                sourceId: null,
                sourceName: "OpenAI",
                sourceSlug: "openai",
                startedAt: "2026-07-20T10:00:00.000Z",
                status: "succeeded",
              },
            ],
            total: 1,
          }}
          isError={false}
          isPending={false}
        />,
      ),
    ).toContain("OpenAI");
    expect(
      renderToStaticMarkup(
        <IngestionView
          {...props}
          data={{
            items: [
              {
                errorMessage: null,
                finishedAt: "2026-07-20T10:05:00.000Z",
                id: "11111111-1111-4111-8111-111111111111",
                itemsCreated: 12,
                itemsSeen: 30,
                itemsUpdated: 4,
                runType: "rss",
                sourceId: null,
                sourceName: "OpenAI",
                sourceSlug: "openai",
                startedAt: "2026-07-20T10:00:00.000Z",
                status: "succeeded",
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

  it("renders safe source diagnostics in the detail dialog", () => {
    const html = renderToStaticMarkup(
      <IngestionDetailContent
        data={{
          errorMessage: "One source timed out",
          finishedAt: "2026-07-20T10:05:00.000Z",
          id: "11111111-1111-4111-8111-111111111111",
          itemsCreated: 12,
          itemsSeen: 30,
          itemsUpdated: 4,
          runType: "rss",
          sourceHealth: {
            failed: ["feed-a"],
            notes: { "feed-a": "Timed out" },
            succeeded: ["feed-b"],
          },
          sourceId: null,
          sourceName: "OpenAI",
          startedAt: "2026-07-20T10:00:00.000Z",
          status: "partial",
        }}
      />,
    );

    expect(html).toContain("Source health diagnostics");
    expect(html).toContain("feed-a");
    expect(html).toContain("Timed out");
  });
});
