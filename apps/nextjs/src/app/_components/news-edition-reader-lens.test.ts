import { readFile } from "node:fs/promises";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { NewsPreferenceProfile } from "@acme/validators";

import type { NewsEditionPageData } from "../_data/news";
import type { NewsHomeItem } from "./news-home-model";
import { TRPCReactProvider } from "~/trpc/react";
import {
  applyNewsEditionFollowAction,
  getNewsEditionFollowState,
  NewsEditionReaderLens,
  selectNewsEditionReaderLens,
} from "./news-edition-reader-lens";

const globalWithReact = globalThis as typeof globalThis & {
  React: typeof React;
};

globalWithReact.React = React;

const createStory = ({
  category,
  entities = [],
  id,
  sourceSlug,
  sourceScore = 80,
  title,
  trendScore = 70,
}: {
  category: string;
  entities?: readonly string[];
  id: string;
  sourceSlug: string;
  sourceScore?: number;
  title: string;
  trendScore?: number;
}): NewsHomeItem => ({
  canonicalUrl: `https://example.com/${id}`,
  category,
  clusterKey: id,
  entities,
  id,
  imageUrl: null,
  originalUrl: `https://example.com/original/${id}`,
  publishedAt: "2026-07-06T08:35:00.000Z",
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

const renderEditionReaderLensMarkup = ({
  filter,
  items,
}: {
  filter: NewsEditionPageData["filter"];
  items: readonly NewsHomeItem[];
}) =>
  renderToStaticMarkup(
    React.createElement(
      TRPCReactProvider,
      null,
      React.createElement(NewsEditionReaderLens, { filter, items }),
    ),
  );

describe("selectNewsEditionReaderLens", () => {
  it("promotes edition stories that match the reader profile", () => {
    const lens = selectNewsEditionReaderLens({
      items: [
        createStory({
          category: "funding",
          id: "hot-market-story",
          sourceSlug: "market-desk",
          title: "Hot market story",
          trendScore: 96,
        }),
        createStory({
          category: "agent_product",
          entities: ["OpenAI"],
          id: "reader-agent-story",
          sourceSlug: "agent-product-desk",
          title: "Reader matched agent story",
          trendScore: 60,
        }),
      ],
      limit: 1,
      profile: {
        noveltyBias: 1,
        preferredCategories: ["agent_product"],
        preferredEntities: ["OpenAI"],
        preferredSources: ["agent-product-desk"],
        recencyBias: 1,
      },
    });

    expect(lens.label).toBe("For You lens");
    expect(lens.items.map((item) => item.id)).toEqual(["reader-agent-story"]);
    expect(lens.metrics).toContainEqual({
      label: "Reader signals",
      value: "3",
    });
  });

  it("promotes edition stories that match recent search memory", () => {
    const lens = selectNewsEditionReaderLens({
      items: [
        createStory({
          category: "model_release",
          id: "hot-general-model-story",
          sourceScore: 95,
          sourceSlug: "model-desk",
          title: "Frontier model release roundup",
          trendScore: 96,
        }),
        createStory({
          category: "market_map",
          entities: ["Model Routers"],
          id: "reader-search-router-story",
          sourceScore: 65,
          sourceSlug: "market-map-desk",
          title: "Model routers become control planes",
          trendScore: 55,
        }),
      ],
      limit: 1,
      profile: {
        noveltyBias: 1,
        preferredCategories: [],
        preferredEntities: [],
        preferredSources: [],
        recencyBias: 1,
      },
      searchMemoryItems: [
        {
          query: "model routers",
          resultCount: 1,
          searchedAt: "2026-07-06T09:00:00.000Z",
        },
      ],
    });

    expect(lens.label).toBe("For You lens");
    expect(lens.items.map((item) => item.id)).toEqual([
      "reader-search-router-story",
    ]);
    expect(lens.items[0]?.matchedSignals).toContain("search_memory");
    expect(lens.metrics).toContainEqual({ label: "Searches", value: "1" });
    expect(lens.summary).toContain("recent search");
  });

  it("promotes edition stories that match followed search intent", () => {
    const lens = selectNewsEditionReaderLens({
      items: [
        createStory({
          category: "model_release",
          entities: ["Frontier Models"],
          id: "hot-model-story",
          sourceSlug: "model-desk",
          title: "Hot model story",
          trendScore: 96,
        }),
        createStory({
          category: "agent_product",
          entities: ["Browser Agents"],
          id: "followed-search-story",
          sourceSlug: "agent-product-desk",
          title: "Browser agents ship new controls",
          trendScore: 55,
        }),
      ],
      limit: 1,
      profile: {
        noveltyBias: 1,
        preferredCategories: [],
        preferredEntities: ["browser agents"],
        preferredSources: [],
        recencyBias: 1,
      },
    });

    expect(lens.label).toBe("For You lens");
    expect(lens.items.map((item) => item.id)).toEqual([
      "followed-search-story",
    ]);
    expect(lens.metrics).toContainEqual({
      label: "Reader signals",
      value: "1",
    });
  });
});

describe("NewsEditionReaderLens", () => {
  it("renders direct reader actions for personalized edition stories", () => {
    const markup = renderEditionReaderLensMarkup({
      filter: {
        kind: "topic",
        title: "Models",
        value: "model_release",
      },
      items: [
        createStory({
          category: "model_release",
          entities: ["Anthropic"],
          id: "reader-model-story",
          sourceSlug: "model-desk",
          title: "Model labs ship new reasoning controls",
          trendScore: 96,
        }),
      ],
    });

    expect(markup).toContain('href="/news/reader-model-story"');
    expect(markup).toContain(
      'aria-label="Reader actions: Model labs ship new reasoning controls"',
    );
    expect(markup).toContain("Save");
    expect(markup).toContain("Less");
    expect(markup).toContain("Source");
  });
});

describe("NewsEditionReaderLens search memory hydration", () => {
  it("subscribes to local search memory and passes it into the edition lens", async () => {
    const source = await readFile(
      new URL("./news-edition-reader-lens.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("readStoredNewsSearchMemoryItems");
    expect(source).toContain("newsSearchStorageKey");
    expect(source).toContain("subscribeToNewsReaderMemoryStorage");
    expect(source).toContain("emptyNewsSearchMemoryItems");
    expect(source).toContain("readNewsSearchMemorySnapshot");
    expect(source).toMatch(
      /const searchMemoryItems = useSyncExternalStore\([\s\S]*?subscribeToNewsReaderMemoryStorage,[\s\S]*?readNewsSearchMemorySnapshot,[\s\S]*?\(\) => emptyNewsSearchMemoryItems,[\s\S]*?\)/,
    );
    expect(source).toMatch(
      /selectNewsEditionReaderLens\({[\s\S]*?searchMemoryItems,[\s\S]*?}\)/,
    );
  });
});

describe("NewsEditionReaderLens follow profile sync", () => {
  it("persists follow toggles to the server reader profile", async () => {
    const source = await readFile(
      new URL("./news-edition-reader-lens.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("useTRPC");
    expect(source).toContain("useMutation");
    expect(source).toContain("useQueryClient");
    expect(source).toContain("readOrCreateNewsVisitorKey");
    expect(source).toContain("toNewsServerPreferenceProfileInput");
    expect(source).toContain("trpc.news.updateProfile.mutationOptions");
    expect(source).toContain("trpc.news.forYou.pathFilter()");
    expect(source).toContain("trpc.news.profile.pathFilter()");
    expect(source).toMatch(
      /const nextProfile = applyNewsEditionFollowAction\({[\s\S]*?filter,[\s\S]*?profile,[\s\S]*?}\);/,
    );
    expect(source).toMatch(
      /writeStoredProfile\(nextProfile\);[\s\S]*?updateProfile\.mutate\({[\s\S]*?profile: toNewsServerPreferenceProfileInput\(nextProfile\),[\s\S]*?visitorKey,[\s\S]*?}\)/,
    );
  });

  it("hydrates edition lens preferences from the persisted server profile", async () => {
    const source = await readFile(
      new URL("./news-edition-reader-lens.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("useQuery");
    expect(source).toContain("trpc.news.profile.queryOptions");
    expect(source).toContain("selectHydratedNewsPreferenceProfile");
    expect(source).toContain("areNewsPreferenceProfilesEqual");
    expect(source).toMatch(
      /if \(!profileQuery\.data\?\.persisted\) return;[\s\S]*?const nextProfile = selectHydratedNewsPreferenceProfile\({[\s\S]*?localProfile: profile,[\s\S]*?serverProfile: profileQuery\.data,[\s\S]*?}\);[\s\S]*?if \(areNewsPreferenceProfilesEqual\(profile, nextProfile\)\) return;[\s\S]*?writeStoredProfile\(nextProfile\);/,
    );
  });

  it("keeps preview edition lenses on local reader memory without server profile calls", async () => {
    const source = await readFile(
      new URL("./news-edition-reader-lens.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain(
      "const canUseServerReaderMemory = !isPreview && Boolean(visitorKey);",
    );
    expect(source).toContain("{ enabled: canUseServerReaderMemory }");
    expect(source).toContain("if (!canUseServerReaderMemory) return;");
    expect(source).not.toContain("{ enabled: Boolean(visitorKey) }");
  });
});

describe("news edition follow controls", () => {
  const profile: NewsPreferenceProfile = {
    noveltyBias: 0.8,
    preferredCategories: ["research"],
    preferredEntities: ["OpenAI"],
    preferredSources: ["model-monitor"],
    recencyBias: 1.2,
  };

  it("toggles a topic edition filter in the reader profile", () => {
    const filter: NewsEditionPageData["filter"] = {
      kind: "topic",
      title: "Agents",
      value: "agent_product",
    };

    const followedProfile = applyNewsEditionFollowAction({ filter, profile });
    const followedAgainProfile = applyNewsEditionFollowAction({
      filter,
      profile: followedProfile,
    });

    expect(followedProfile).toMatchObject({
      noveltyBias: 0.8,
      preferredCategories: ["research", "agent_product"],
      preferredEntities: ["OpenAI"],
      preferredSources: ["model-monitor"],
      recencyBias: 1.2,
    });
    expect(followedAgainProfile.preferredCategories).toEqual(["research"]);
    expect(
      getNewsEditionFollowState({ filter, profile: followedProfile }),
    ).toMatchObject({
      isFollowing: true,
      label: "Following topic",
    });
    expect(
      getNewsEditionFollowState({ filter, profile: followedAgainProfile }),
    ).toMatchObject({
      isFollowing: false,
      label: "Follow topic",
    });
  });

  it("toggles a source edition filter in the reader profile", () => {
    const filter: NewsEditionPageData["filter"] = {
      kind: "source",
      title: "Agent Product Desk",
      value: "agent-product-desk",
    };

    const followedProfile = applyNewsEditionFollowAction({ filter, profile });
    const followedAgainProfile = applyNewsEditionFollowAction({
      filter,
      profile: followedProfile,
    });

    expect(followedProfile.preferredSources).toEqual([
      "model-monitor",
      "agent-product-desk",
    ]);
    expect(followedAgainProfile.preferredSources).toEqual(["model-monitor"]);
    expect(
      getNewsEditionFollowState({ filter, profile: followedProfile }),
    ).toMatchObject({
      isFollowing: true,
      label: "Following source",
    });
    expect(
      getNewsEditionFollowState({ filter, profile: followedAgainProfile }),
    ).toMatchObject({
      isFollowing: false,
      label: "Follow source",
    });
  });

  it("toggles followed source filters case-insensitively", () => {
    const filter: NewsEditionPageData["filter"] = {
      kind: "source",
      title: "Agent Product Desk",
      value: "agent-product-desk",
    };

    expect(
      applyNewsEditionFollowAction({
        filter,
        profile: {
          ...profile,
          preferredSources: ["Model-Monitor", "Agent-Product-Desk"],
        },
      }).preferredSources,
    ).toEqual(["Model-Monitor"]);
    expect(
      getNewsEditionFollowState({
        filter,
        profile: {
          ...profile,
          preferredSources: ["Model-Monitor", "Agent-Product-Desk"],
        },
      }),
    ).toMatchObject({
      isFollowing: true,
      label: "Following source",
    });
  });

  it("toggles a search edition query as durable reader intent", () => {
    const filter: NewsEditionPageData["filter"] = {
      kind: "search",
      title: "Search: browser agents",
      value: "browser agents",
    };

    const followedProfile = applyNewsEditionFollowAction({ filter, profile });
    const followedAgainProfile = applyNewsEditionFollowAction({
      filter,
      profile: followedProfile,
    });

    expect(followedProfile.preferredCategories).toEqual(["research"]);
    expect(followedProfile.preferredSources).toEqual(["model-monitor"]);
    expect(followedProfile.preferredEntities).toEqual([
      "OpenAI",
      "browser agents",
    ]);
    expect(followedAgainProfile.preferredEntities).toEqual(["OpenAI"]);
    expect(
      getNewsEditionFollowState({ filter, profile: followedProfile }),
    ).toMatchObject({
      isFollowing: true,
      label: "Following search",
    });
    expect(getNewsEditionFollowState({ filter, profile })).toMatchObject({
      isFollowing: false,
      label: "Follow search",
    });
  });

  it("toggles an entity edition filter in the reader profile", () => {
    const filter: NewsEditionPageData["filter"] = {
      kind: "entity",
      title: "Anthropic",
      value: "Anthropic",
    };

    const followedProfile = applyNewsEditionFollowAction({ filter, profile });
    const followedAgainProfile = applyNewsEditionFollowAction({
      filter,
      profile: followedProfile,
    });

    expect(followedProfile.preferredCategories).toEqual(["research"]);
    expect(followedProfile.preferredSources).toEqual(["model-monitor"]);
    expect(followedProfile.preferredEntities).toEqual(["OpenAI", "Anthropic"]);
    expect(followedAgainProfile.preferredEntities).toEqual(["OpenAI"]);
    expect(
      getNewsEditionFollowState({ filter, profile: followedProfile }),
    ).toMatchObject({
      isFollowing: true,
      label: "Following entity",
    });
    expect(getNewsEditionFollowState({ filter, profile })).toMatchObject({
      isFollowing: false,
      label: "Follow entity",
    });
  });

  it("toggles followed search intent case-insensitively", () => {
    const filter: NewsEditionPageData["filter"] = {
      kind: "search",
      title: "Search: browser agents",
      value: "browser agents",
    };

    expect(
      applyNewsEditionFollowAction({
        filter,
        profile: {
          ...profile,
          preferredEntities: ["OpenAI", "Browser Agents"],
        },
      }).preferredEntities,
    ).toEqual(["OpenAI"]);
    expect(
      getNewsEditionFollowState({
        filter,
        profile: {
          ...profile,
          preferredEntities: ["OpenAI", "Browser Agents"],
        },
      }),
    ).toMatchObject({
      isFollowing: true,
      label: "Following search",
    });
  });

  it("toggles followed search intent with readable angle matching", () => {
    const filter: NewsEditionPageData["filter"] = {
      kind: "search",
      title: "Search: browser-agents",
      value: "browser-agents",
    };

    expect(
      getNewsEditionFollowState({
        filter,
        profile: {
          ...profile,
          preferredEntities: ["OpenAI", "browser agents"],
        },
      }),
    ).toMatchObject({
      isFollowing: true,
      label: "Following search",
    });
    expect(
      applyNewsEditionFollowAction({
        filter,
        profile: {
          ...profile,
          preferredEntities: ["OpenAI", "browser agents"],
        },
      }).preferredEntities,
    ).toEqual(["OpenAI"]);
    expect(
      applyNewsEditionFollowAction({
        filter,
        profile,
      }).preferredEntities,
    ).toEqual(["OpenAI", "browser agents"]);
  });

  it("does not expose follow controls for a blank search edition", () => {
    expect(
      getNewsEditionFollowState({
        filter: {
          kind: "search",
          title: "Search",
          value: "   ",
        },
        profile,
      }),
    ).toBeNull();
  });
});
