import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ContentDetailContent } from "./content-detail-dialog";
import { ContentView } from "./content-view";

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

describe("ContentView", () => {
  it("renders loading, empty, error, and safe external links", () => {
    expect(
      renderToStaticMarkup(
        <ContentView {...props} data={undefined} isError={false} isPending />,
      ),
    ).toContain("Loading");
    expect(
      renderToStaticMarkup(
        <ContentView {...props} data={undefined} isError isPending={false} />,
      ),
    ).toContain("Try again");
    expect(
      renderToStaticMarkup(
        <ContentView
          {...props}
          data={{ items: [], total: 0 }}
          isError={false}
          isPending={false}
        />,
      ),
    ).toContain("No content");

    const html = renderToStaticMarkup(
      <ContentView
        {...props}
        data={{
          items: [
            {
              canonicalUrl: "https://example.com/story",
              category: "research",
              collectedAt: "2026-07-20T10:00:00.000Z",
              embeddingStatus: "embedded",
              id: "11111111-1111-4111-8111-111111111111",
              publishedAt: "2026-07-20T09:00:00.000Z",
              sourceId: "22222222-2222-4222-8222-222222222222",
              sourceName: "AI Wire",
              sourceScore: 90,
              status: "published",
              title: "A representative AI story",
              trendScore: 42,
            },
          ],
          total: 1,
        }}
        isError={false}
        isPending={false}
      />,
    );

    expect(html).toContain("A representative AI story");
    expect(html).toContain('rel="nofollow noopener noreferrer"');
    expect(html).toContain("Inspect");
  });

  it("renders editorial and dedupe fields in the detail dialog", () => {
    const html = renderToStaticMarkup(
      <ContentDetailContent
        data={{
          authorName: "AI Wire Desk",
          canonicalUrl: "https://example.com/story",
          category: "research",
          clusterKey: "cluster-1",
          collectedAt: "2026-07-20T10:00:00.000Z",
          dedupeKey: "dedupe-1",
          embeddingStatus: "embedded",
          entities: ["OpenAI"],
          id: "11111111-1111-4111-8111-111111111111",
          imageUrl: null,
          language: "en",
          originalUrl: "https://example.com/original",
          publishedAt: "2026-07-20T09:00:00.000Z",
          sourceId: "22222222-2222-4222-8222-222222222222",
          sourceName: "AI Wire",
          status: "published",
          summary: "Detailed editorial summary.",
          tags: ["agents", "research"],
          title: "A representative AI story",
        }}
      />,
    );

    expect(html).toContain("Summary");
    expect(html).toContain("Detailed editorial summary.");
    expect(html).toContain("dedupe-1");
    expect(html).toContain("OpenAI");
  });
});
