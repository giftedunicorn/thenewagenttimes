import { readFile } from "node:fs/promises";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { NewsPreferenceProfile } from "@acme/validators";

import type { NewsHomeItem } from "./news-home-model";
import { TRPCReactProvider } from "~/trpc/react";
import {
  NewsBriefingReaderLensView,
  selectNewsBriefingReaderLens,
} from "./news-briefing-reader-lens";

const globalWithReact = globalThis as typeof globalThis & {
  React: typeof React;
};

globalWithReact.React = React;

const createStory = ({
  category = "agent_product",
  entities = ["OpenAI", "Agents"],
  id,
  publishedAt,
  sourceScore = 84,
  sourceSlug,
  tags = ["workflow"],
  title,
  trendScore = 89,
}: {
  category?: string;
  entities?: string[];
  id: string;
  publishedAt: string;
  sourceScore?: number;
  sourceSlug: string;
  tags?: string[];
  title: string;
  trendScore?: number;
}): NewsHomeItem => ({
  canonicalUrl: `https://example.com/${id}`,
  category,
  clusterKey: id,
  entities,
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
  tags,
  title,
  trendScore,
});

const stories = [
  createStory({
    category: "agent_product",
    id: "agent-story",
    publishedAt: "2026-07-06T08:35:00.000Z",
    sourceSlug: "agent-desk",
    title: "Agent workflows move into the browser",
    trendScore: 90,
  }),
  createStory({
    category: "model_release",
    entities: ["Anthropic", "Evals"],
    id: "model-story",
    publishedAt: "2026-07-06T08:05:00.000Z",
    sourceScore: 96,
    sourceSlug: "model-desk",
    tags: ["reasoning", "evals"],
    title: "Model labs ship new reasoning controls",
    trendScore: 86,
  }),
  createStory({
    category: "funding",
    entities: ["Enterprise AI"],
    id: "funding-story",
    publishedAt: "2026-07-06T07:30:00.000Z",
    sourceSlug: "capital-desk",
    title: "AI infrastructure funding concentrates",
    trendScore: 82,
  }),
  createStory({
    category: "security",
    entities: ["Browser agents"],
    id: "security-story",
    publishedAt: "2026-07-06T06:45:00.000Z",
    sourceSlug: "security-desk",
    title: "Agent sandboxes tighten browser permissions",
    trendScore: 79,
  }),
];

const profile: NewsPreferenceProfile = {
  noveltyBias: 1.1,
  preferredCategories: ["model_release"],
  preferredEntities: ["Anthropic", "reasoning"],
  preferredSources: ["model-desk"],
  recencyBias: 1.2,
};

const renderReaderLensMarkup = (
  props: React.ComponentProps<typeof NewsBriefingReaderLensView>,
) =>
  renderToStaticMarkup(
    React.createElement(
      TRPCReactProvider,
      null,
      React.createElement(NewsBriefingReaderLensView, props),
    ),
  );

describe("selectNewsBriefingReaderLens", () => {
  it("builds a personalized briefing lens from reader preferences", () => {
    const lens = selectNewsBriefingReaderLens({
      generatedAt: "2026-07-06T08:30:00.000Z",
      items: stories,
      profile,
      readerLocalHour: 8,
      searchMemoryItems: [
        {
          query: "reasoning controls",
          resultCount: 3,
          searchedAt: "2026-07-06T08:15:00.000Z",
        },
      ],
    });
    const firstScorecard = lens.scorecards.scorecards[0];
    const firstScorecardComponentLabels =
      firstScorecard?.components.map((component) => component.label) ?? [];

    expect(lens.label).toBe("Your Briefing");
    expect(lens.daypart).toMatchObject({
      cadenceLabel: "Refresh every 30 min",
      label: "Morning Brief",
    });
    expect(lens.slotMix.label).toBe("Slot Mix Ready");
    expect(lens.personalizedPack).toMatchObject({
      label: "3 Slots",
    });
    expect(lens.personalizedPack.slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "model-story",
          title: "Model labs ship new reasoning controls",
        }),
      ]),
    );
    expect(lens.scorecards.label).toBe("Scorecards Ready");
    expect(lens.searchMemory).toMatchObject({
      label: "Search Memory",
      matches: [
        {
          href: "/news/model-story",
          query: "reasoning controls",
          resultCountLabel: "3 results",
          title: "Model labs ship new reasoning controls",
        },
      ],
      summary: 'Recent search "reasoning controls" matches this briefing.',
    });
    expect(firstScorecard?.title).toBe(
      "Model labs ship new reasoning controls",
    );
    expect(firstScorecardComponentLabels).toEqual(
      expect.arrayContaining(["Topic", "Source", "Entity"]),
    );
  });

  it("renders a compact reader briefing surface", () => {
    const lens = selectNewsBriefingReaderLens({
      generatedAt: "2026-07-06T08:30:00.000Z",
      items: stories,
      profile,
      readerLocalHour: 8,
      searchMemoryItems: [
        {
          query: "reasoning controls",
          resultCount: 3,
          searchedAt: "2026-07-06T08:15:00.000Z",
        },
      ],
    });
    const markup = renderReaderLensMarkup({
      itemsLength: stories.length,
      lens,
    });

    expect(markup).toContain("Your Briefing");
    expect(markup).toContain("Reader daypart");
    expect(markup).toContain("Recent Search Memory");
    expect(markup).toContain("Personalized Briefing Pack");
    expect(markup).toContain("3 briefing slots");
    expect(markup).toContain("reasoning controls");
    expect(markup).toContain("Slot mix");
    expect(markup).toContain("Scorecards");
    expect(markup).toContain('href="/reader"');
    expect(markup).toContain('href="/news/model-story"');
    expect(markup).toContain(
      'aria-label="Reader actions: Model labs ship new reasoning controls"',
    );
    expect(markup).toContain("Save");
    expect(markup).toContain("Less");
    expect(markup).toContain("Source");
  });

  it("hydrates briefing lens preferences from the persisted server profile", async () => {
    const source = await readFile(
      new URL("./news-briefing-reader-lens.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("useTRPC");
    expect(source).toContain("useQuery");
    expect(source).toContain("readOrCreateNewsVisitorKey");
    expect(source).toContain("readStoredNewsSearchMemoryItems");
    expect(source).toContain("subscribeToNewsReaderMemoryStorage");
    expect(source).toContain("trpc.news.profile.queryOptions");
    expect(source).toContain("selectHydratedNewsPreferenceProfile");
    expect(source).toContain("areNewsPreferenceProfilesEqual");
    expect(source).toMatch(
      /if \(!profileQuery\.data\?\.persisted\) return;[\s\S]*?const nextProfile = selectHydratedNewsPreferenceProfile\({[\s\S]*?localProfile: profile,[\s\S]*?serverProfile: profileQuery\.data,[\s\S]*?}\);[\s\S]*?if \(areNewsPreferenceProfilesEqual\(profile, nextProfile\)\) return;[\s\S]*?writeStoredNewsPreferenceProfile\(nextProfile\);/,
    );
  });

  it("keeps preview briefing lenses on local reader memory without server profile calls", async () => {
    const source = await readFile(
      new URL("./news-briefing-reader-lens.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain(
      'const canUseServerReaderMemory = status === "ready" && Boolean(visitorKey);',
    );
    expect(source).toContain("{ enabled: canUseServerReaderMemory }");
    expect(source).not.toContain("{ enabled: Boolean(visitorKey) }");
  });
});
