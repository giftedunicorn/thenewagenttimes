import { readFile } from "node:fs/promises";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { NewsDeskStatus, NewsHomeItem } from "./news-home-model";
import { TRPCReactProvider } from "~/trpc/react";
import {
  addNewsDirectoryFollowingSignal,
  toggleNewsDirectoryFollowingSignal,
} from "./news-directory-follow-controls";
import {
  getNewsDirectoryPageData,
  NewsDirectoryPage,
} from "./news-directory-page";

const globalWithReact = globalThis as typeof globalThis & {
  React: typeof React;
};

globalWithReact.React = React;

const createStory = ({
  category,
  id,
  publishedAt,
  sourceName,
  sourceSlug,
  title,
}: {
  category: string;
  id: string;
  publishedAt: string;
  sourceName: string;
  sourceSlug: string;
  title: string;
}): NewsHomeItem => ({
  canonicalUrl: `https://example.com/${id}`,
  category,
  clusterKey: id,
  entities: ["OpenAI"],
  id,
  imageUrl: null,
  originalUrl: `https://example.com/original/${id}`,
  publishedAt,
  sourceName,
  sourceScore: 84,
  sourceSlug,
  sourceType: "rss",
  summary: `${title} summary.`,
  tags: ["workflow"],
  title,
  trendScore: 89,
});

const stories = [
  createStory({
    category: "agent_product",
    id: "agent-lead",
    publishedAt: "2026-07-06T08:35:00.000Z",
    sourceName: "Agent Desk",
    sourceSlug: "agent-desk",
    title: "Agent workflow lead",
  }),
  createStory({
    category: "agent_product",
    id: "agent-followup",
    publishedAt: "2026-07-06T09:05:00.000Z",
    sourceName: "Model Desk",
    sourceSlug: "model-desk",
    title: "Agent follow-up",
  }),
  createStory({
    category: "model_release",
    id: "model-lead",
    publishedAt: "2026-07-06T10:15:00.000Z",
    sourceName: "Model Desk",
    sourceSlug: "model-desk",
    title: "Frontier model lead",
  }),
];

const deskStatusWithSourceHealth = {
  activeSources: 4,
  embeddedStories: 3,
  health: "error",
  latestPublishedAt: "2026-07-06T10:15:00.000Z",
  latestRun: {
    errorMessage: null,
    finishedAt: "2026-07-06T10:30:00.000Z",
    itemsCreated: 3,
    itemsSeen: 11,
    itemsSkipped: 4,
    itemsUpdated: 2,
    runType: "rss",
    skippedByReason: {
      duplicate: 1,
      future: 0,
      irrelevant: 2,
      low_quality: 1,
      stale: 0,
    },
    sourceHealth: {
      emptySourceSlugs: ["google-ai-blog"],
      failedSourceSlugs: ["anthropic-news"],
      failureMessages: {
        "anthropic-news": "feed unavailable",
      },
      healthySourceSlugs: ["openai-news", "deepmind-blog"],
    },
    sourceName: null,
    startedAt: "2026-07-06T10:00:00.000Z",
    status: "partial",
  },
  publishedStories: 3,
  totalSources: 4,
  unembeddedStories: 0,
} satisfies NewsDeskStatus;

const renderDirectoryPageMarkup = (
  directory: ReturnType<typeof getNewsDirectoryPageData>,
) =>
  renderToStaticMarkup(
    React.createElement(
      TRPCReactProvider,
      null,
      React.createElement(NewsDirectoryPage, { directory }),
    ),
  );

describe("getNewsDirectoryPageData", () => {
  it("summarizes aggregation health across coverage, breadth, freshness, and balance", () => {
    expect(
      getNewsDirectoryPageData({
        kind: "topic",
        items: stories,
      }).health,
    ).toEqual({
      metrics: [
        { label: "Coverage", value: "3 stories" },
        { label: "Topic sections", value: "2" },
        { label: "Source breadth", value: "2" },
        { label: "Latest", value: "Frontier model lead" },
        { label: "Balance", value: "Concentrated" },
      ],
      summary:
        "3 stories across 2 topics and 2 sources. Agents leads with 2 stories.",
    });
  });

  it("adds latest source health diagnostics when desk status is available", () => {
    const health = getNewsDirectoryPageData({
      deskStatus: deskStatusWithSourceHealth,
      kind: "source",
      items: stories,
    }).health;
    const metricsByLabel = new Map(
      health.metrics.map((metric) => [metric.label, metric.value] as const),
    );

    expect(health.diagnostics).toEqual([
      {
        detail: "feed unavailable",
        label: "anthropic-news",
        state: "failed",
      },
      {
        detail: "No items were collected in the latest refresh.",
        label: "google-ai-blog",
        state: "empty",
      },
    ]);
    expect(metricsByLabel.get("Healthy feeds")).toBe("2");
    expect(metricsByLabel.get("Attention feeds")).toBe("2");
    expect(metricsByLabel.get("Run yield")).toBe(
      "3 new, 2 updated, 4 skipped (1 low-quality, 2 non-AI, 1 duplicate)",
    );
    expect(health.summary).toBe(
      "3 stories across 2 topics and 2 sources. Model Desk leads with 2 stories. Latest refresh checked 4 feeds: 2 healthy, 2 need attention.",
    );
  });

  it("groups topic sections by story volume and source breadth", () => {
    expect(
      getNewsDirectoryPageData({
        kind: "topic",
        items: stories,
      }),
    ).toMatchObject({
      description:
        "Browse The New AI Times by AI topic, with live counts and the latest lead from each section.",
      entries: [
        {
          countLabel: "2 stories",
          href: "/topics/agent-product",
          latestItem: {
            id: "agent-followup",
            title: "Agent follow-up",
          },
          metricLabel: "2 sources",
          title: "Agents",
          value: "agent_product",
        },
        {
          countLabel: "1 story",
          href: "/topics/model-release",
          latestItem: {
            id: "model-lead",
            title: "Frontier model lead",
          },
          metricLabel: "1 source",
          title: "Models",
          value: "model_release",
        },
      ],
      kind: "topic",
      title: "Topics",
    });
  });

  it("groups source sections by source slug and topic breadth", () => {
    expect(
      getNewsDirectoryPageData({
        kind: "source",
        items: stories,
      }),
    ).toMatchObject({
      description:
        "Browse The New AI Times by source, with coverage volume and the latest story from each feed.",
      entries: [
        {
          countLabel: "2 stories",
          href: "/sources/model-desk",
          latestItem: {
            id: "model-lead",
            title: "Frontier model lead",
          },
          metricLabel: "2 topics",
          title: "Model Desk",
          value: "model-desk",
        },
        {
          countLabel: "1 story",
          href: "/sources/agent-desk",
          latestItem: {
            id: "agent-lead",
            title: "Agent workflow lead",
          },
          metricLabel: "1 topic",
          title: "Agent Desk",
          value: "agent-desk",
        },
      ],
      kind: "source",
      title: "Sources",
    });
  });
});

describe("NewsDirectoryPage", () => {
  it("adds directory topic and source signals to the local recommendation profile", () => {
    expect(
      addNewsDirectoryFollowingSignal({
        kind: "topic",
        profile: {
          noveltyBias: 1,
          preferredCategories: ["agent_product"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["agent-desk"],
          recencyBias: 1,
        },
        signal: "model_release",
      }),
    ).toEqual({
      noveltyBias: 1,
      preferredCategories: ["agent_product", "model_release"],
      preferredEntities: ["OpenAI"],
      preferredSources: ["agent-desk"],
      recencyBias: 1,
    });

    expect(
      addNewsDirectoryFollowingSignal({
        kind: "source",
        profile: {
          noveltyBias: 1,
          preferredCategories: ["agent_product"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["agent-desk"],
          recencyBias: 1,
        },
        signal: "model-desk",
      }),
    ).toEqual({
      noveltyBias: 1,
      preferredCategories: ["agent_product"],
      preferredEntities: ["OpenAI"],
      preferredSources: ["agent-desk", "model-desk"],
      recencyBias: 1,
    });

    expect(
      addNewsDirectoryFollowingSignal({
        kind: "entity" as never,
        profile: {
          noveltyBias: 1,
          preferredCategories: ["agent_product"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["agent-desk"],
          recencyBias: 1,
        },
        signal: "Anthropic",
      }),
    ).toEqual({
      noveltyBias: 1,
      preferredCategories: ["agent_product"],
      preferredEntities: ["OpenAI", "Anthropic"],
      preferredSources: ["agent-desk"],
      recencyBias: 1,
    });
  });

  it("toggles directory topic and source signals off from the local recommendation profile", () => {
    const profile = {
      noveltyBias: 1,
      preferredCategories: ["agent_product", "model_release"],
      preferredEntities: ["OpenAI"],
      preferredSources: ["agent-desk", "model-desk"],
      recencyBias: 1,
    };

    expect(
      toggleNewsDirectoryFollowingSignal({
        kind: "topic",
        profile,
        signal: " model_release ",
      }),
    ).toEqual({
      noveltyBias: 1,
      preferredCategories: ["agent_product"],
      preferredEntities: ["OpenAI"],
      preferredSources: ["agent-desk", "model-desk"],
      recencyBias: 1,
    });

    expect(
      toggleNewsDirectoryFollowingSignal({
        kind: "source",
        profile,
        signal: " MODEL-DESK ",
      }),
    ).toEqual({
      noveltyBias: 1,
      preferredCategories: ["agent_product", "model_release"],
      preferredEntities: ["OpenAI"],
      preferredSources: ["agent-desk"],
      recencyBias: 1,
    });

    expect(
      toggleNewsDirectoryFollowingSignal({
        kind: "entity" as never,
        profile,
        signal: " OPENAI ",
      }),
    ).toEqual({
      noveltyBias: 1,
      preferredCategories: ["agent_product", "model_release"],
      preferredEntities: [],
      preferredSources: ["agent-desk", "model-desk"],
      recencyBias: 1,
    });
  });

  it("renders dense links into every entity edition", () => {
    const directory = getNewsDirectoryPageData({
      kind: "entity" as never,
      items: stories,
    });
    const markup = renderDirectoryPageMarkup(directory);

    expect(directory).toMatchObject({
      description:
        "Browse The New AI Times by AI company, product, person, or concept entity, with live counts and the latest lead from each signal.",
      kind: "entity",
      title: "Entities",
    });
    expect(directory.entries[0]).toMatchObject({
      href: "/entities/OpenAI",
      metricLabel: "2 sources",
      title: "OpenAI",
      value: "OpenAI",
    });
    expect(markup).toContain('href="/entities/OpenAI"');
    expect(markup).toContain("Entities");
    expect(markup).toContain("Follow");
  });

  it("renders dense links into every topic edition", () => {
    const directory = getNewsDirectoryPageData({
      deskStatus: deskStatusWithSourceHealth,
      kind: "topic",
      items: stories,
    });
    const markup = renderDirectoryPageMarkup(directory);

    expect(markup).toContain('href="/topics/agent-product"');
    expect(markup).toContain('href="/topics/model-release"');
    expect(markup).toContain("Agent follow-up");
    expect(markup).toContain("2 stories");
    expect(markup).toContain("2 sources");
    expect(markup).toContain("Aggregation Health");
    expect(markup).toContain("Healthy feeds");
    expect(markup).toContain("Attention feeds");
    expect(markup).toContain("Run yield");
    expect(markup).toContain("Source feed diagnostics");
    expect(markup).toContain("anthropic-news");
    expect(markup).toContain("feed unavailable");
    expect(markup).toContain("google-ai-blog");
    expect(markup).toContain("No items were collected in the latest refresh.");
    expect(markup).toContain("3 stories across 2 topics and 2 sources");
    expect(markup).toContain("Concentrated");
    expect(markup).toContain("Follow");
    expect(markup).toContain('aria-label="Reader actions: Agent follow-up"');
    expect(markup).toContain(
      'aria-label="Reader actions: Frontier model lead"',
    );
    expect(markup).toContain("Save");
    expect(markup).toContain("Less");
    expect(markup).toContain("Source");
  });

  it("mounts the reader match lens so directory indexes reflect local preferences", async () => {
    const source = await readFile(
      new URL("./news-directory-page.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("NewsDirectoryReaderLens");
    expect(source).toContain(
      "<NewsDirectoryReaderLens directory={directory} />",
    );
    expect(source).toContain("NewsEditionStoryActions");
    expect(source).toContain("NewsDirectoryFollowButton");
    expect(source).toContain("kind={directory.kind}");
    expect(source).toContain("entry={entry}");
    expect(source).toContain("status={directory.status}");
  });

  it("keeps active directory follow buttons clickable so readers can unfollow", async () => {
    const source = await readFile(
      new URL("./news-directory-follow-controls.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toggleNewsDirectoryFollowingSignal");
    expect(source).toContain("NewsHomeStatus");
    expect(source).toContain('status = "ready"');
    expect(source).toContain("canUseServerReaderMemory");
    expect(source).toContain("if (!canUseServerReaderMemory) return;");
    expect(source).toContain("updateProfile.isPending");
    expect(source).not.toContain(
      "disabled={active || updateProfile.isPending}",
    );
  });

  it("hydrates directory follow buttons from the persisted server profile", async () => {
    const source = await readFile(
      new URL("./news-directory-follow-controls.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("useQuery");
    expect(source).toContain("trpc.news.profile.queryOptions");
    expect(source).toContain("selectHydratedNewsPreferenceProfile");
    expect(source).toContain("areNewsPreferenceProfilesEqual");
    expect(source).toMatch(
      /const profileQuery = useQuery\([\s\S]*?trpc\.news\.profile\.queryOptions\([\s\S]*?\{ visitorKey: visitorKey \?\? undefined \},[\s\S]*?\{ enabled: canUseServerReaderMemory \},[\s\S]*?\),[\s\S]*?\);/,
    );
    expect(source).toMatch(
      /if \(!profileQuery\.data\?\.persisted\) return;[\s\S]*?const nextProfile = selectHydratedNewsPreferenceProfile\({[\s\S]*?localProfile: profile,[\s\S]*?serverProfile: profileQuery\.data,[\s\S]*?}\);[\s\S]*?if \(areNewsPreferenceProfilesEqual\(profile, nextProfile\)\) return;[\s\S]*?writeStoredNewsPreferenceProfile\(nextProfile\);/,
    );
  });

  it("keeps directory follow buttons from overwriting a pending server profile", async () => {
    const source = await readFile(
      new URL("./news-directory-follow-controls.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toMatch(
      /disabled=\{[\s\S]*?updateProfile\.isPending \|\|[\s\S]*?\(canUseServerReaderMemory && profileQuery\.isPending\)[\s\S]*?\}/,
    );
  });

  it("wires topic, source, and entity index routes to the homepage news data", async () => {
    const [topicsSource, sourcesSource, entitiesSource] = await Promise.all([
      readFile(new URL("../topics/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../sources/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../entities/page.tsx", import.meta.url), "utf8"),
    ]);

    expect(topicsSource).toContain("getNewsHomeData()");
    expect(topicsSource).toContain("deskStatus: data.deskStatus");
    expect(topicsSource).toContain('kind: "topic"');
    expect(topicsSource).toContain("status: data.status");
    expect(topicsSource).toContain("<NewsDirectoryPage");
    expect(sourcesSource).toContain("getNewsHomeData()");
    expect(sourcesSource).toContain("deskStatus: data.deskStatus");
    expect(sourcesSource).toContain('kind: "source"');
    expect(sourcesSource).toContain("status: data.status");
    expect(sourcesSource).toContain("<NewsDirectoryPage");
    expect(entitiesSource).toContain("getNewsHomeData()");
    expect(entitiesSource).toContain("deskStatus: data.deskStatus");
    expect(entitiesSource).toContain('kind: "entity"');
    expect(entitiesSource).toContain("status: data.status");
    expect(entitiesSource).toContain("<NewsDirectoryPage");
  });
});
