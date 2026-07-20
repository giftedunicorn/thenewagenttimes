import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SourcesView } from "./sources-view";

describe("SourcesView", () => {
  it("renders loading, empty, error, and a representative source", () => {
    expect(
      renderToStaticMarkup(
        <SourcesView
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
        <SourcesView
          data={undefined}
          isError
          isPending={false}
          isRefreshing={false}
          onRefresh={() => undefined}
          onRetry={() => undefined}
        />,
      ),
    ).toContain("Try again");
    expect(
      renderToStaticMarkup(
        <SourcesView
          data={{ items: [] }}
          isError={false}
          isPending={false}
          isRefreshing={false}
          onRefresh={() => undefined}
          onRetry={() => undefined}
        />,
      ),
    ).toContain("No sources");

    const html = renderToStaticMarkup(
      <SourcesView
        data={{
          items: [
            {
              createdAt: "2026-07-20T10:00:00.000Z",
              credibility: 90,
              feedUrl: "https://example.com/feed.xml",
              homepageUrl: "https://example.com",
              id: "11111111-1111-4111-8111-111111111111",
              isActive: true,
              latestCollectedAt: "2026-07-20T10:00:00.000Z",
              latestIngestionAt: "2026-07-20T10:00:00.000Z",
              latestIngestionStatus: "succeeded",
              name: "AI Wire",
              slug: "ai-wire",
              sourceType: "rss",
              status: "healthy",
              storyCount: 100,
            },
          ],
        }}
        isError={false}
        isPending={false}
        isRefreshing={false}
        onRefresh={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(html).toContain("AI Wire");
    expect(html).toContain("100");
  });
});
