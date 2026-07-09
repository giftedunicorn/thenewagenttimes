import { readFile } from "node:fs/promises";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { NewsHomeItem } from "./news-home-model";
import { TRPCReactProvider } from "~/trpc/react";
import {
  getNewsBriefingPageMetadata,
  NewsBriefingPage,
} from "./news-briefing-page";

const globalWithReact = globalThis as typeof globalThis & {
  React: typeof React;
};

globalWithReact.React = React;

const createStory = ({
  category = "agent_product",
  id,
  publishedAt,
  sourceScore = 84,
  sourceSlug,
  title,
  trendScore = 89,
}: {
  category?: string;
  id: string;
  publishedAt: string;
  sourceScore?: number;
  sourceSlug: string;
  title: string;
  trendScore?: number;
}): NewsHomeItem => ({
  canonicalUrl: `https://example.com/${id}`,
  category,
  clusterKey: id,
  entities: ["OpenAI", "Agents"],
  id,
  imageUrl: null,
  originalUrl: `https://source.example/${id}`,
  publishedAt,
  sourceName: sourceSlug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" "),
  sourceScore,
  sourceSlug,
  sourceType: "rss",
  summary: `${title} summary.`,
  tags: ["workflow"],
  title,
  trendScore,
});

describe("NewsBriefingPage", () => {
  it("renders a shareable daily briefing from ranked AI stories", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        TRPCReactProvider,
        null,
        React.createElement(NewsBriefingPage, {
          generatedAt: "2026-07-06T09:30:00.000Z",
          items: [
            createStory({
              id: "lead-agent-story",
              publishedAt: "2026-07-06T08:35:00.000Z",
              sourceSlug: "agent-desk",
              title: "Agent workflows move into the browser",
            }),
            createStory({
              category: "model_release",
              id: "model-story",
              publishedAt: "2026-07-06T08:05:00.000Z",
              sourceSlug: "model-desk",
              title: "Model labs ship new reasoning controls",
              trendScore: 86,
            }),
            createStory({
              category: "funding",
              id: "funding-story",
              publishedAt: "2026-07-06T07:30:00.000Z",
              sourceSlug: "capital-desk",
              title: "AI infrastructure funding concentrates",
              trendScore: 82,
            }),
            createStory({
              category: "security",
              id: "security-story",
              publishedAt: "2026-07-06T06:45:00.000Z",
              sourceSlug: "security-desk",
              title: "Agent sandboxes tighten browser permissions",
              trendScore: 79,
            }),
          ],
          status: "ready",
        }),
      ),
    );

    expect(markup).toContain("Today&#x27;s AI Briefing");
    expect(markup).toContain("Agent workflows move into the browser");
    expect(markup).toContain("Briefing Pack");
    expect(markup).toContain("A1 Desk");
    expect(markup).toContain("Your Briefing");
    expect(markup).toContain("Reader daypart");
    expect(markup).toContain("Top Topics");
    expect(markup).toContain("Entity Watch");
    expect(markup).toContain('href="/news/lead-agent-story"');
    expect(markup).toContain('href="/entities/OpenAI"');
    expect(markup).toContain('href="/entities/Agents"');
    expect(markup).toContain(
      'aria-label="Reader actions: Agent workflows move into the browser"',
    );
    expect(markup).toContain(
      'aria-label="Reader actions: Model labs ship new reasoning controls"',
    );
    expect(markup).toContain("Save");
    expect(markup).toContain("Less");
    expect(markup).toContain("Source");
    expect(markup).toContain('href="/"');
    expect(markup).toContain('href="/reader"');
  });

  it("creates canonical briefing metadata", () => {
    expect(getNewsBriefingPageMetadata()).toMatchObject({
      alternates: {
        canonical: "/briefing",
      },
      description:
        "A ranked daily AI briefing from The New AI Times, packaged from story heat, source coverage, and reader-ready briefing slots.",
      title: "Today's AI Briefing | The New AI Times",
    });
  });

  it("wires the briefing route to homepage news data and the briefing component", async () => {
    const [routeSource, componentSource] = await Promise.all([
      readFile(new URL("../briefing/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("./news-briefing-page.tsx", import.meta.url), "utf8"),
    ]);

    expect(routeSource).toContain("getNewsHomeData");
    expect(routeSource).toContain("<NewsBriefingPage");
    expect(componentSource).toContain("NewsBriefingReaderLens");
    expect(componentSource).toContain("getNewsEditionBriefing");
    expect(componentSource).toContain("getNewsBriefingPack");
    expect(componentSource).toContain("getNewsFrontPageLayout");
  });
});
