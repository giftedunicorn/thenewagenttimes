import { readFile } from "node:fs/promises";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { NewsPreferenceProfile } from "@acme/validators";

import type { NewsHomeItem } from "./news-home-model";
import { TRPCReactProvider } from "~/trpc/react";
import {
  addNewsReaderFollowingSignal,
  NewsReaderFollowingView,
  removeNewsReaderFollowingSignal,
  selectNewsReaderFollowing,
} from "./news-reader-following";

const globalWithReact = globalThis as typeof globalThis & {
  React: typeof React;
};

globalWithReact.React = React;

const profile: NewsPreferenceProfile = {
  noveltyBias: 1.4,
  preferredCategories: ["agent_product", "model_release"],
  preferredEntities: ["OpenAI", "browser agents"],
  preferredSources: ["agent-desk"],
  recencyBias: 1.2,
};

const createStory = ({
  category,
  entities = [],
  id,
  publishedAt = "2026-07-06T08:35:00.000Z",
  sourceName,
  sourceSlug,
  tags = [],
  title,
}: {
  category: string;
  entities?: readonly string[];
  id: string;
  publishedAt?: string;
  sourceName: string;
  sourceSlug: string;
  tags?: readonly string[];
  title: string;
}): NewsHomeItem => ({
  canonicalUrl: `https://example.com/${id}`,
  category,
  clusterKey: id,
  entities,
  id,
  imageUrl: null,
  originalUrl: `https://example.com/original/${id}`,
  publishedAt,
  sourceName,
  sourceScore: 84,
  sourceSlug,
  sourceType: "rss",
  summary: `${title} summary.`,
  tags,
  title,
  trendScore: 89,
});

const renderFollowingViewMarkup = (
  props: React.ComponentProps<typeof NewsReaderFollowingView>,
) =>
  renderToStaticMarkup(
    React.createElement(
      TRPCReactProvider,
      null,
      React.createElement(NewsReaderFollowingView, props),
    ),
  );

describe("selectNewsReaderFollowing", () => {
  it("turns local profile signals into browsable following sections", () => {
    const following = selectNewsReaderFollowing({ profile });

    expect(following.metrics).toEqual([
      { label: "Topics", value: "2" },
      { label: "Sources", value: "1" },
      { label: "Entities", value: "1" },
      { label: "Angles", value: "1" },
      { label: "Feed matches", value: "0" },
      { label: "Signals", value: "5" },
    ]);
    expect(following.sections.map((section) => section.label)).toEqual([
      "Topics",
      "Sources",
      "Entities",
      "Angles",
    ]);
    expect(following.sections[0]?.entries).toEqual([
      {
        href: "/topics/agent-product",
        kind: "topic",
        label: "Agents",
        signal: "agent_product",
        summary: "Topic signal",
      },
      {
        href: "/topics/model-release",
        kind: "topic",
        label: "Models",
        signal: "model_release",
        summary: "Topic signal",
      },
    ]);
    expect(following.sections[1]?.entries[0]).toEqual({
      href: "/sources/agent-desk",
      kind: "source",
      label: "agent-desk",
      signal: "agent-desk",
      summary: "Source signal",
    });
    expect(following.sections[2]?.entries[0]).toEqual({
      href: "/entities/OpenAI",
      kind: "entity",
      label: "OpenAI",
      signal: "OpenAI",
      summary: "Entity signal",
    });
    expect(following.sections[3]?.entries[0]).toEqual({
      href: "/search?q=browser%20agents",
      kind: "angle",
      label: "browser agents",
      signal: "browser agents",
      summary: "Angle signal",
    });
    expect(following.summary).toBe(
      "5 followed signals are shaping For You on this device.",
    );
  });

  it("labels followed source signals with current coverage source names", () => {
    const following = selectNewsReaderFollowing({
      items: [
        createStory({
          category: "funding",
          entities: [],
          id: "agent-desk-story",
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          title: "Agent Desk market note",
        }),
      ],
      profile,
    });

    expect(following.sections[1]?.entries[0]).toEqual({
      href: "/sources/agent-desk",
      kind: "source",
      label: "Agent Desk",
      signal: "agent-desk",
      summary: "Source signal",
    });
  });

  it("splits followed entity and angle signals into separate sections", () => {
    const following = selectNewsReaderFollowing({
      items: [
        createStory({
          category: "agent_product",
          entities: ["OpenAI"],
          id: "openai-following-story",
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          tags: ["browser-agents"],
          title: "OpenAI agent systems update",
        }),
      ],
      profile,
    });

    expect(following.sections[2]?.entries).toEqual([
      {
        href: "/entities/OpenAI",
        kind: "entity",
        label: "OpenAI",
        signal: "OpenAI",
        summary: "Entity signal",
      },
    ]);
    expect(following.sections[3]?.entries).toEqual([
      {
        href: "/search?q=browser%20agents",
        kind: "angle",
        label: "browser agents",
        signal: "browser agents",
        summary: "Angle signal",
      },
    ]);
  });

  it("builds a ranked following feed from topic, source, and entity preferences", () => {
    const following = selectNewsReaderFollowing({
      items: [
        createStory({
          category: "funding",
          entities: ["Enterprise AI"],
          id: "market-story",
          sourceName: "Market Desk",
          sourceSlug: "market-desk",
          title: "Market story outside followed signals",
        }),
        createStory({
          category: "agent_product",
          entities: ["OpenAI", "browser agents"],
          id: "multi-signal-story",
          publishedAt: "2026-07-06T09:35:00.000Z",
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          tags: ["workflow"],
          title: "OpenAI browser agents ship controls",
        }),
        createStory({
          category: "model_release",
          entities: ["Frontier Models"],
          id: "topic-story",
          publishedAt: "2026-07-06T10:00:00.000Z",
          sourceName: "Model Desk",
          sourceSlug: "model-desk",
          tags: ["models"],
          title: "Frontier model release update",
        }),
      ],
      profile,
    });

    expect(following.feed.map((story) => story.id)).toEqual([
      "multi-signal-story",
      "topic-story",
    ]);
    expect(following.feed[0]).toMatchObject({
      href: "/news/multi-signal-story",
      matchLabel: "4 signals",
      reason: "Topic, source, and entity matches",
      sourceName: "Agent Desk",
      title: "OpenAI browser agents ship controls",
    });
    expect(following.feedSummary).toBe(
      "2 stories match followed topics, sources, entities, or angles.",
    );
    expect(following.metrics).toContainEqual({
      label: "Feed matches",
      value: "2",
    });
  });

  it("does not let future-dated stories win following feed ties", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T10:00:00.000Z"));

    try {
      const following = selectNewsReaderFollowing({
        items: [
          createStory({
            category: "agent_product",
            entities: ["OpenAI"],
            id: "future-following-story",
            publishedAt: "2026-07-07T08:00:00.000Z",
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Future following story should wait",
          }),
          createStory({
            category: "agent_product",
            entities: ["OpenAI"],
            id: "current-following-story",
            publishedAt: "2026-07-06T09:00:00.000Z",
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            title: "Current following story should lead",
          }),
        ],
        profile,
      });

      expect(following.feed.map((story) => story.id)).toEqual([
        "current-following-story",
        "future-following-story",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("suggests unfollowed signals from current coverage", () => {
    const following = selectNewsReaderFollowing({
      items: [
        createStory({
          category: "security",
          entities: ["AI safety", "OpenAI"],
          id: "security-story-one",
          publishedAt: "2026-07-06T10:00:00.000Z",
          sourceName: "Security Desk",
          sourceSlug: "security-desk",
          tags: ["risk"],
          title: "AI safety controls reach browser agents",
        }),
        createStory({
          category: "security",
          entities: ["AI safety"],
          id: "security-story-two",
          publishedAt: "2026-07-06T09:00:00.000Z",
          sourceName: "Security Desk",
          sourceSlug: "security-desk",
          tags: ["controls"],
          title: "AI safety teams harden agent workflows",
        }),
      ],
      profile,
    });

    expect(following.suggestions).toEqual([
      {
        actionLabel: "Follow topic",
        href: "/topics/security",
        kind: "topic",
        label: "Security",
        signal: "security",
        summary:
          "Follow Security from 2 current stories to lift similar coverage.",
        supportLabel: "2 stories",
      },
      {
        actionLabel: "Follow source",
        href: "/sources/security-desk",
        kind: "source",
        label: "Security Desk",
        signal: "security-desk",
        summary:
          "Follow Security Desk from 2 current stories to lift similar coverage.",
        supportLabel: "2 stories",
      },
      {
        actionLabel: "Follow entity",
        href: "/entities/AI%20safety",
        kind: "entity",
        label: "AI safety",
        signal: "AI safety",
        summary:
          "Follow AI safety from 2 current stories to lift similar coverage.",
        supportLabel: "2 stories",
      },
      {
        actionLabel: "Follow angle",
        href: "/search?q=risk",
        kind: "angle",
        label: "risk",
        signal: "risk",
        summary: "Follow risk from 1 current story to lift similar coverage.",
        supportLabel: "1 story",
      },
    ]);
  });

  it("does not let future-dated stories win following source suggestions", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T10:00:00.000Z"));

    try {
      const following = selectNewsReaderFollowing({
        items: [
          createStory({
            category: "agent_product",
            entities: ["OpenAI"],
            id: "future-source-suggestion",
            publishedAt: "2026-07-07T08:00:00.000Z",
            sourceName: "Future Source",
            sourceSlug: "future-source",
            title: "Future source suggestion should wait",
          }),
          createStory({
            category: "agent_product",
            entities: ["OpenAI"],
            id: "current-source-suggestion",
            publishedAt: "2026-07-06T09:00:00.000Z",
            sourceName: "Current Source",
            sourceSlug: "current-source",
            title: "Current source suggestion should lead",
          }),
        ],
        profile,
      });

      expect(
        following.suggestions.find(
          (suggestion) => suggestion.kind === "source",
        ),
      ).toMatchObject({
        href: "/sources/current-source",
        label: "Current Source",
        signal: "current-source",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("surfaces followed signals without current coverage as coverage gaps", () => {
    const following = selectNewsReaderFollowing({
      items: [
        createStory({
          category: "agent_product",
          entities: ["OpenAI"],
          id: "covered-agent-story",
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          title: "OpenAI agent release",
        }),
      ],
      profile: {
        noveltyBias: 1,
        preferredCategories: ["agent_product", "research"],
        preferredEntities: ["OpenAI", "AI safety"],
        preferredSources: ["agent-desk"],
        recencyBias: 1,
      },
    });

    expect(following.gapSummary).toBe(
      "2 followed signals need fresh coverage.",
    );
    expect(following.coverageGaps).toEqual([
      {
        href: "/topics/research",
        kind: "topic",
        label: "Research",
        recoveryHref: "/search?q=Research",
        signal: "research",
        summary: "No current following feed story matches this topic.",
      },
      {
        href: "/entities/AI%20safety",
        kind: "entity",
        label: "AI safety",
        recoveryHref: "/search?q=AI%20safety",
        signal: "AI safety",
        summary: "No current following feed story matches this entity.",
      },
    ]);
  });
});

describe("removeNewsReaderFollowingSignal", () => {
  it("removes one followed signal without dropping unrelated preferences", () => {
    expect(
      removeNewsReaderFollowingSignal({
        kind: "source",
        profile,
        signal: "AGENT-DESK",
      }),
    ).toEqual({
      noveltyBias: 1.4,
      preferredCategories: ["agent_product", "model_release"],
      preferredEntities: ["OpenAI", "browser agents"],
      preferredSources: [],
      recencyBias: 1.2,
    });
  });
});

describe("addNewsReaderFollowingSignal", () => {
  it("adds a trimmed topic, source, entity, or angle signal without duplicating existing follows", () => {
    expect(
      addNewsReaderFollowingSignal({
        kind: "topic",
        profile,
        signal: " research ",
      }).preferredCategories,
    ).toEqual(["agent_product", "model_release", "research"]);

    expect(
      addNewsReaderFollowingSignal({
        kind: "source",
        profile,
        signal: " Agent-Desk ",
      }).preferredSources,
    ).toEqual(["agent-desk"]);

    expect(
      addNewsReaderFollowingSignal({
        kind: "entity",
        profile,
        signal: " vector databases ",
      }).preferredEntities,
    ).toEqual(["OpenAI", "browser agents", "vector databases"]);

    expect(
      addNewsReaderFollowingSignal({
        kind: "angle",
        profile,
        signal: " workflow automation ",
      }).preferredEntities,
    ).toEqual(["OpenAI", "browser agents", "workflow automation"]);
  });

  it("ignores empty manual following signals", () => {
    expect(
      addNewsReaderFollowingSignal({
        kind: "entity",
        profile,
        signal: "   ",
      }),
    ).toEqual(profile);
  });
});

describe("NewsReaderFollowingView", () => {
  it("renders a profile following management surface", () => {
    const following = selectNewsReaderFollowing({
      items: [
        createStory({
          category: "agent_product",
          entities: ["OpenAI"],
          id: "followed-story",
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          title: "Followed agent story",
        }),
        createStory({
          category: "security",
          entities: ["AI safety"],
          id: "suggested-security-story",
          sourceName: "Security Desk",
          sourceSlug: "security-desk",
          title: "AI safety controls reach agent systems",
        }),
      ],
      profile,
    });
    const markup = renderFollowingViewMarkup({
      following,
      onAdd: () => undefined,
      onRemove: () => undefined,
    });

    expect(markup).toContain("Following");
    expect(markup).toContain("Topics");
    expect(markup).toContain("Sources");
    expect(markup).toContain("Entities");
    expect(markup).toContain("Angles");
    expect(markup).toContain("Agents");
    expect(markup).toContain("agent-desk");
    expect(markup).toContain("OpenAI");
    expect(markup).toContain("Remove");
    expect(markup).toContain("Following Feed");
    expect(markup).toContain("Coverage Gaps");
    expect(markup).toContain("Add interest");
    expect(markup).toContain('name="following-signal-kind"');
    expect(markup).toContain('name="following-signal"');
    expect(markup).toContain("Entity");
    expect(markup).toContain("Angle");
    expect(markup).toContain("Followed agent story");
    expect(markup).toContain(
      'aria-label="Reader actions: Followed agent story"',
    );
    expect(markup).toContain("Save");
    expect(markup).toContain("Less");
    expect(markup).toContain("Source");
    expect(markup).toContain("Search coverage");
    expect(markup).toContain("Suggested follows");
    expect(markup).toContain("Follow Security from 1 current story");
    expect(markup).toContain('aria-label="Follow suggested topic: Security"');
    expect(markup).toContain('href="/news/followed-story"');
    expect(markup).toContain('href="/topics/agent-product"');
    expect(markup).toContain('href="/sources/agent-desk"');
    expect(markup).toContain('href="/entities/OpenAI"');
    expect(markup).toContain('href="/search?q=Models"');
    expect(markup).toContain('href="/reader/onboarding"');
  });

  it("wires the following route and reader navigation", async () => {
    const [routeSource, centerSource, librarySource, homeSource] =
      await Promise.all([
        readFile(new URL("../reader/following/page.tsx", import.meta.url), {
          encoding: "utf8",
        }),
        readFile(new URL("./news-reader-center.tsx", import.meta.url), {
          encoding: "utf8",
        }),
        readFile(new URL("./news-reader-library.tsx", import.meta.url), {
          encoding: "utf8",
        }),
        readFile(new URL("./news-home.tsx", import.meta.url), {
          encoding: "utf8",
        }),
      ]);

    expect(routeSource).toContain("getNewsHomeData()");
    expect(routeSource).toContain("items={data.items}");
    expect(routeSource).toContain("status={data.status}");
    expect(routeSource).toContain("<NewsReaderFollowing");
    expect(routeSource).toContain('dynamic = "force-dynamic"');
    expect(routeSource).toContain("robots");
    expect(centerSource).toContain('href="/reader/following"');
    expect(librarySource).toContain('href="/reader/following"');
    expect(homeSource).toContain('href="/reader/following"');
  });

  it("persists removed following signals to the server reader profile", async () => {
    const source = await readFile(
      new URL("./news-reader-following.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("useTRPC");
    expect(source).toContain("trpc.news.updateProfile");
    expect(source).toContain("readOrCreateNewsVisitorKey");
    expect(source).toContain("toNewsServerPreferenceProfileInput");
    expect(source).toContain("queryClient.invalidateQueries");
    expect(source).toContain("trpc.news.forYou.pathFilter()");
    expect(source).toContain("trpc.news.profile.pathFilter()");
  });

  it("wires manually added following signals through local storage and the server reader profile", async () => {
    const source = await readFile(
      new URL("./news-reader-following.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("const addFollowing =");
    expect(source).toContain("addNewsReaderFollowingSignal");
    expect(source).toContain("writeStoredNewsPreferenceProfile(nextProfile)");
    expect(source).toContain('isPreview={status !== "ready"}');
    expect(source).toContain("updateProfile.mutate({");
    expect(source).toContain(
      "profile: toNewsServerPreferenceProfileInput(nextProfile)",
    );
    expect(source).toContain(
      "onAdd={canEditFollowing ? addFollowing : undefined}",
    );
  });

  it("hydrates followed signals from the persisted server profile", async () => {
    const source = await readFile(
      new URL("./news-reader-following.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("useQuery");
    expect(source).toContain("trpc.news.profile.queryOptions");
    expect(source).toContain("NewsHomeStatus");
    expect(source).toContain('status = "ready"');
    expect(source).toContain("canUseServerReaderMemory");
    expect(source).toContain("{ enabled: canUseServerReaderMemory }");
    expect(source).toContain("if (!canUseServerReaderMemory) return;");
    expect(source).not.toContain("{ enabled: Boolean(visitorKey) }");
    expect(source).toContain("selectHydratedNewsPreferenceProfile");
    expect(source).toContain("areNewsPreferenceProfilesEqual");
    expect(source).toMatch(
      /if \(!profileQuery\.data\?\.persisted\) return;[\s\S]*?const nextProfile = selectHydratedNewsPreferenceProfile\({[\s\S]*?localProfile: profile,[\s\S]*?serverProfile: profileQuery\.data,[\s\S]*?}\);[\s\S]*?if \(areNewsPreferenceProfilesEqual\(profile, nextProfile\)\) return;[\s\S]*?writeStoredNewsPreferenceProfile\(nextProfile\);/,
    );
  });

  it("keeps following edits from overwriting a pending server profile", async () => {
    const source = await readFile(
      new URL("./news-reader-following.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toMatch(
      /const canEditFollowing =\s*!\(\s*updateProfile\.isPending \|\|[\s\S]*?\(canUseServerReaderMemory && profileQuery\.isPending\)[\s\S]*?\);/,
    );
    expect(source).toContain(
      "onAdd={canEditFollowing ? addFollowing : undefined}",
    );
    expect(source).toContain(
      "onRemove={canEditFollowing ? removeFollowing : undefined}",
    );
  });
});
