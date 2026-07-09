import { readFile } from "node:fs/promises";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  NewsPreferenceProfile,
  NewsRecommendationRotationObjective,
} from "@acme/validators";
import { normalizeNewsPreferenceProfile } from "@acme/validators";

import type { NewsHomeItem } from "./news-home-model";
import { TRPCReactProvider } from "~/trpc/react";
import {
  applyNewsReaderOnboardingSelection,
  getNewsReaderOnboardingPlan,
  NewsReaderOnboardingView,
} from "./news-reader-onboarding";

const globalWithReact = globalThis as typeof globalThis & {
  React: typeof React;
};

globalWithReact.React = React;

const coldProfile: NewsPreferenceProfile = {
  noveltyBias: 1,
  preferredCategories: [],
  preferredEntities: [],
  preferredSources: [],
  recencyBias: 1,
};

const createStory = ({
  id,
  title,
  ...overrides
}: Partial<NewsHomeItem> &
  Pick<NewsHomeItem, "id" | "title">): NewsHomeItem => ({
  canonicalUrl: `https://example.com/${id}`,
  category: "agent_product",
  entities: ["OpenAI"],
  id,
  imageUrl: null,
  publishedAt: "2026-07-06T12:00:00.000Z",
  sourceName: "Agent Desk",
  sourceScore: 88,
  sourceSlug: "agent-desk",
  sourceType: "manual",
  summary: "Onboarding story",
  tags: ["agents"],
  title,
  trendScore: 82,
  ...overrides,
});

describe("getNewsReaderOnboardingPlan", () => {
  it("turns Reader Center quick starts into a cold-start onboarding plan", () => {
    const plan = getNewsReaderOnboardingPlan({
      forYouObjective: "reader_match",
      profile: coldProfile,
    });

    expect(plan).toMatchObject({
      label: "Set Up For You",
      selectedObjective: "reader_match",
      summary:
        "Choose a starting mix for The New AI Times. The same local profile powers For You, editions, briefing, and search memory.",
    });
    expect(plan.metrics).toEqual([
      { label: "Signals", value: "0" },
      { label: "Quick starts", value: "4" },
      { label: "Objective", value: "Reader match" },
    ]);
    expect(plan.quickStarts.map((quickStart) => quickStart.label)).toEqual([
      "Agent Builder",
      "Model Watch",
      "AI Business",
      "Research & OSS",
    ]);
    expect(plan.quickStarts[0]?.recommended).toBe(true);
    expect(plan.objectives).toContainEqual({
      detail:
        "Profile and local behavior move first in the recommendation rotation.",
      label: "Reader match",
      objective: "reader_match",
    });
  });

  it("previews current stories that selected quick starts will unlock", () => {
    const plan = getNewsReaderOnboardingPlan({
      forYouObjective: "reader_match",
      items: [
        createStory({
          id: "agent-builder-preview",
          title: "Agent browser workflows reach teams",
        }),
        createStory({
          category: "funding",
          entities: ["GPU Cloud"],
          id: "funding-preview",
          sourceName: "Capital Desk",
          sourceSlug: "capital-desk",
          tags: ["infrastructure"],
          title: "GPU cloud financing expands",
        }),
      ],
      profile: coldProfile,
      selectedQuickStartKeys: ["agent-builder"],
    });

    expect(plan.storyPreview).toMatchObject({
      stories: [
        {
          href: "/news/agent-builder-preview",
          matchLabel: "4 signals",
          reason: "Matches selected topics, sources, and entities.",
          sourceName: "Agent Desk",
          title: "Agent browser workflows reach teams",
        },
      ],
      summary: "1 current story matches selected quick starts.",
    });
  });

  it("previews selected quick start angle matches using recommendation angle labels", () => {
    const plan = getNewsReaderOnboardingPlan({
      forYouObjective: "reader_match",
      items: [
        createStory({
          category: "security",
          entities: ["New agent stack"],
          id: "browser-agent-angle-preview",
          sourceName: "Security Desk",
          sourceSlug: "security-desk",
          tags: ["browser-agents"],
          title: "Browser agent controls reach security teams",
        }),
      ],
      profile: coldProfile,
      selectedQuickStartKeys: ["agent-builder"],
    });

    expect(plan.storyPreview).toMatchObject({
      stories: [
        {
          href: "/news/browser-agent-angle-preview",
          matchLabel: "1 signal",
          reason: "Matches selected angles.",
          sourceName: "Security Desk",
          title: "Browser agent controls reach security teams",
        },
      ],
      summary: "1 current story matches selected quick starts.",
    });
  });
});

describe("applyNewsReaderOnboardingSelection", () => {
  it("applies selected quick starts and objective without dropping existing preferences", () => {
    const plan = getNewsReaderOnboardingPlan({
      forYouObjective: "reader_match",
      profile: {
        ...coldProfile,
        preferredEntities: ["Custom Entity"],
      },
    });
    const selection = applyNewsReaderOnboardingSelection({
      currentProfile: {
        ...coldProfile,
        preferredEntities: ["Custom Entity"],
      },
      quickStartKeys: ["agent-builder", "model-watch"],
      selectedObjective: "source_trust",
    });

    expect(selection).toEqual({
      forYouObjective: "source_trust",
      profile: normalizeNewsPreferenceProfile({
        noveltyBias: 1,
        preferredCategories: ["agent_product", "model_release"],
        preferredEntities: [
          "Custom Entity",
          "OpenAI",
          "Agents",
          "browser agents",
          "Anthropic",
          "DeepMind",
          "evals",
        ],
        preferredSources: [
          "agent-desk",
          "openai-news",
          "anthropic",
          "deepmind",
        ],
        recencyBias: 1,
      }),
    });
    expect(
      plan.quickStarts.some((quickStart) => quickStart.key === "agent-builder"),
    ).toBe(true);
  });

  it("falls back to the current objective when no valid objective is selected", () => {
    expect(
      applyNewsReaderOnboardingSelection({
        currentForYouObjective: "market_heat",
        currentProfile: coldProfile,
        quickStartKeys: [],
        selectedObjective: "invalid" as NewsRecommendationRotationObjective,
      }),
    ).toEqual({
      forYouObjective: "market_heat",
      profile: normalizeNewsPreferenceProfile(coldProfile),
    });
  });
});

describe("NewsReaderOnboardingView", () => {
  it("renders the first-run preference setup surface", () => {
    const plan = getNewsReaderOnboardingPlan({
      forYouObjective: "exploration",
      items: [
        createStory({
          id: "agent-builder-preview",
          title: "Agent browser workflows reach teams",
        }),
      ],
      profile: coldProfile,
      selectedQuickStartKeys: ["agent-builder"],
    });
    const markup = renderToStaticMarkup(
      React.createElement(
        TRPCReactProvider,
        null,
        React.createElement(NewsReaderOnboardingView, {
          plan,
          selectedObjective: "exploration",
          selectedQuickStartKeys: ["agent-builder"],
          onFinish: () => undefined,
          onObjectiveSelect: () => undefined,
          onQuickStartToggle: () => undefined,
        }),
      ),
    );

    expect(markup).toContain("Set Up For You");
    expect(markup).toContain("Current Story Preview");
    expect(markup).toContain("Agent browser workflows reach teams");
    expect(markup).toContain("Agent Builder");
    expect(markup).toContain("Model Watch");
    expect(markup).toContain("AI Business");
    expect(markup).toContain("Research &amp; OSS");
    expect(markup).toContain("For You objective");
    expect(markup).toContain("Explore");
    expect(markup).toContain("w-full min-w-0");
    expect(markup).toContain("whitespace-normal");
    expect(markup).toContain("grid min-w-0 gap-1");
    expect(markup).toContain("Finish setup");
    expect(markup).toContain('href="/reader"');
    expect(markup).toContain('href="/"');
    expect(markup).toContain(
      'aria-label="Reader actions: Agent browser workflows reach teams"',
    );
  });

  it("wires the onboarding route and discovery links", async () => {
    const [routeSource, readerSource, homeSource] = await Promise.all([
      readFile(new URL("../reader/onboarding/page.tsx", import.meta.url), {
        encoding: "utf8",
      }),
      readFile(new URL("./news-reader-center.tsx", import.meta.url), {
        encoding: "utf8",
      }),
      readFile(new URL("./news-home.tsx", import.meta.url), {
        encoding: "utf8",
      }),
    ]);

    expect(routeSource).toContain("<NewsReaderOnboarding");
    expect(routeSource).toContain("getNewsHomeData()");
    expect(routeSource).toContain("items={data.items}");
    expect(routeSource).toContain("status={data.status}");
    expect(routeSource).toContain('dynamic = "force-dynamic"');
    expect(routeSource).toContain("robots");
    expect(readerSource).toContain('href="/reader/onboarding"');
    expect(homeSource).toContain('href="/reader/onboarding"');
  });

  it("persists first-run preference setup to the server reader profile", async () => {
    const source = await readFile(
      new URL("./news-reader-onboarding.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("useTRPC");
    expect(source).toContain("trpc.news.updateProfile");
    expect(source).toContain("readOrCreateNewsVisitorKey");
    expect(source).toContain('isPreview={status !== "ready"}');
    expect(source).toContain("toNewsServerPreferenceProfileInput");
    expect(source).toContain("queryClient.invalidateQueries");
    expect(source).toContain("trpc.news.forYou.pathFilter()");
    expect(source).toContain("trpc.news.profile.pathFilter()");
  });

  it("hydrates first-run setup from the persisted server profile", async () => {
    const source = await readFile(
      new URL("./news-reader-onboarding.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("useQuery");
    expect(source).toContain("useSyncExternalStore");
    expect(source).toContain("trpc.news.profile.queryOptions");
    expect(source).toContain("NewsHomeStatus");
    expect(source).toContain('status = "ready"');
    expect(source).toContain("canUseServerReaderMemory");
    expect(source).toContain("{ enabled: canUseServerReaderMemory }");
    expect(source).toContain("if (canUseServerReaderMemory && visitorKey)");
    expect(source).not.toContain("{ enabled: Boolean(visitorKey) }");
    expect(source).toContain("selectHydratedNewsPreferenceProfile");
    expect(source).toContain("subscribeToNewsPreferenceProfileStorage");
    expect(source).toContain("areNewsPreferenceProfilesEqual");
    expect(source).toMatch(
      /if \(!profileQuery\.data\?\.persisted\) return;[\s\S]*?const nextProfile = selectHydratedNewsPreferenceProfile\({[\s\S]*?localProfile: profile,[\s\S]*?serverProfile: profileQuery\.data,[\s\S]*?}\);[\s\S]*?if \(areNewsPreferenceProfilesEqual\(profile, nextProfile\)\) return;[\s\S]*?writeStoredNewsPreferenceProfile\(nextProfile\);/,
    );
  });

  it("keeps first-run setup from overwriting a pending server profile", async () => {
    const source = await readFile(
      new URL("./news-reader-onboarding.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toMatch(
      /const canFinishSetup =\s*!\(\s*updateProfile\.isPending \|\|[\s\S]*?\(canUseServerReaderMemory && profileQuery\.isPending\)[\s\S]*?\);/,
    );
    expect(source).toContain(
      "onFinish={canFinishSetup ? finishSetup : undefined}",
    );
  });
});
