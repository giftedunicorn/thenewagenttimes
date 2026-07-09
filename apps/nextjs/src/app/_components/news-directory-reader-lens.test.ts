import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import type { NewsPreferenceProfile } from "@acme/validators";

import type { NewsDirectoryPageData } from "./news-directory-page";
import { selectNewsDirectoryReaderLens } from "./news-directory-reader-lens";

const createDirectory = (): NewsDirectoryPageData => ({
  description: "Browse The New AI Times by AI topic.",
  entries: [
    {
      countLabel: "2 stories",
      href: "/topics/agent-product",
      latestItem: {
        canonicalUrl: "https://example.com/agents",
        category: "agent_product",
        clusterKey: "agents",
        entities: ["OpenAI"],
        id: "agent-lead",
        imageUrl: null,
        originalUrl: "https://example.com/original/agents",
        publishedAt: "2026-07-06T08:35:00.000Z",
        sourceName: "Agent Desk",
        sourceScore: 84,
        sourceSlug: "agent-desk",
        sourceType: "rss",
        summary: "Agent lead summary.",
        tags: ["workflow"],
        title: "Agent workflow lead",
        trendScore: 89,
      },
      metricLabel: "2 sources",
      title: "Agents",
      value: "agent_product",
    },
    {
      countLabel: "1 story",
      href: "/topics/model-release",
      latestItem: {
        canonicalUrl: "https://example.com/models",
        category: "model_release",
        clusterKey: "models",
        entities: ["Anthropic"],
        id: "model-lead",
        imageUrl: null,
        originalUrl: "https://example.com/original/models",
        publishedAt: "2026-07-06T09:35:00.000Z",
        sourceName: "Model Desk",
        sourceScore: 92,
        sourceSlug: "model-desk",
        sourceType: "rss",
        summary: "Model lead summary.",
        tags: ["model"],
        title: "Frontier model lead",
        trendScore: 94,
      },
      metricLabel: "1 source",
      title: "Models",
      value: "model_release",
    },
  ],
  health: {
    metrics: [],
    summary: "3 stories across 2 topics and 2 sources.",
  },
  kind: "topic",
  status: "ready",
  title: "Topics",
});

const createEntityDirectory = (): NewsDirectoryPageData => ({
  description: "Browse The New AI Times by entity.",
  entries: [
    {
      countLabel: "2 stories",
      href: "/entities/OpenAI",
      latestItem: {
        canonicalUrl: "https://example.com/openai",
        category: "agent_product",
        clusterKey: "openai",
        entities: ["OpenAI"],
        id: "openai-lead",
        imageUrl: null,
        originalUrl: "https://example.com/original/openai",
        publishedAt: "2026-07-06T08:35:00.000Z",
        sourceName: "Agent Desk",
        sourceScore: 84,
        sourceSlug: "agent-desk",
        sourceType: "rss",
        summary: "OpenAI lead summary.",
        tags: ["workflow"],
        title: "OpenAI workflow lead",
        trendScore: 89,
      },
      metricLabel: "2 sources",
      title: "OpenAI",
      value: "OpenAI",
    },
    {
      countLabel: "1 story",
      href: "/entities/Anthropic",
      latestItem: {
        canonicalUrl: "https://example.com/anthropic",
        category: "model_release",
        clusterKey: "anthropic",
        entities: ["Anthropic"],
        id: "anthropic-lead",
        imageUrl: null,
        originalUrl: "https://example.com/original/anthropic",
        publishedAt: "2026-07-06T09:35:00.000Z",
        sourceName: "Model Desk",
        sourceScore: 92,
        sourceSlug: "model-desk",
        sourceType: "rss",
        summary: "Anthropic lead summary.",
        tags: ["model"],
        title: "Anthropic model lead",
        trendScore: 94,
      },
      metricLabel: "1 source",
      title: "Anthropic",
      value: "Anthropic",
    },
  ],
  health: {
    metrics: [],
    summary: "3 stories across 2 entities and 2 sources.",
  },
  kind: "entity",
  status: "ready",
  title: "Entities",
});

const profile: NewsPreferenceProfile = {
  noveltyBias: 1,
  preferredCategories: ["model_release"],
  preferredEntities: [],
  preferredSources: [],
  recencyBias: 1,
};

describe("selectNewsDirectoryReaderLens", () => {
  it("promotes directory sections already followed by the reader profile", () => {
    expect(
      selectNewsDirectoryReaderLens({
        directory: createDirectory(),
        profile,
      }),
    ).toEqual({
      entries: [
        {
          href: "/topics/model-release",
          label: "Following",
          summary: "1 story / 1 source",
          title: "Models",
          value: "model_release",
        },
      ],
      label: "Directory match",
      metrics: [
        { label: "Profile matches", value: "1" },
        { label: "Sections", value: "2" },
        { label: "Mode", value: "Topics" },
      ],
      summary: "1 followed topic is live in this directory.",
    });
  });

  it("falls back to high-coverage sections when the profile has no directory match", () => {
    expect(
      selectNewsDirectoryReaderLens({
        directory: createDirectory(),
        profile: {
          ...profile,
          preferredCategories: ["research"],
        },
      }),
    ).toMatchObject({
      entries: [
        {
          href: "/topics/agent-product",
          label: "Coverage leader",
          title: "Agents",
          value: "agent_product",
        },
      ],
      label: "Starter directory",
      summary:
        "No followed topic is live here yet. Start with the strongest coverage sections.",
    });
  });

  it("uses recent search memory to recommend a matching directory section", () => {
    expect(
      selectNewsDirectoryReaderLens({
        directory: createDirectory(),
        profile: {
          ...profile,
          preferredCategories: ["research"],
        },
        searchMemoryItems: [
          {
            query: "frontier model",
            resultCount: 2,
            searchedAt: "2026-07-06T09:45:00.000Z",
          },
        ],
      }),
    ).toEqual({
      entries: [
        {
          href: "/topics/model-release",
          label: "Search match",
          summary: "1 story / 1 source / frontier model",
          title: "Models",
          value: "model_release",
        },
      ],
      label: "Directory search match",
      metrics: [
        { label: "Profile matches", value: "0" },
        { label: "Sections", value: "2" },
        { label: "Mode", value: "Topics" },
      ],
      summary:
        'Recent search "frontier model" matches Models in this directory.',
    });
  });

  it("keeps followed directory sections ahead of search memory matches", () => {
    expect(
      selectNewsDirectoryReaderLens({
        directory: createDirectory(),
        profile,
        searchMemoryItems: [
          {
            query: "agent workflow",
            resultCount: 2,
            searchedAt: "2026-07-06T09:45:00.000Z",
          },
        ],
      }).entries,
    ).toEqual([
      {
        href: "/topics/model-release",
        label: "Following",
        summary: "1 story / 1 source",
        title: "Models",
        value: "model_release",
      },
    ]);
  });

  it("promotes entity directory sections followed by the reader profile", () => {
    expect(
      selectNewsDirectoryReaderLens({
        directory: createEntityDirectory(),
        profile: {
          ...profile,
          preferredCategories: [],
          preferredEntities: ["openai"],
        },
      }),
    ).toMatchObject({
      entries: [
        {
          href: "/entities/OpenAI",
          label: "Following",
          title: "OpenAI",
          value: "OpenAI",
        },
      ],
      label: "Directory match",
      summary: "1 followed entity is live in this directory.",
    });
  });
});

describe("NewsDirectoryReaderLens follow profile sync", () => {
  it("persists directory follow toggles to the server reader profile", async () => {
    const source = await readFile(
      new URL("./news-directory-reader-lens.tsx", import.meta.url),
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
      /const nextProfile = applyNewsEditionFollowAction\({[\s\S]*?profile,[\s\S]*?}\);/,
    );
    expect(source).toMatch(
      /writeStoredNewsPreferenceProfile\(nextProfile\);[\s\S]*?updateProfile\.mutate\({[\s\S]*?profile: toNewsServerPreferenceProfileInput\(nextProfile\),[\s\S]*?visitorKey,[\s\S]*?}\)/,
    );
  });

  it("hydrates directory lens preferences from the persisted server profile", async () => {
    const source = await readFile(
      new URL("./news-directory-reader-lens.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("useQuery");
    expect(source).toContain("trpc.news.profile.queryOptions");
    expect(source).toContain("selectHydratedNewsPreferenceProfile");
    expect(source).toContain("areNewsPreferenceProfilesEqual");
    expect(source).toMatch(
      /if \(!profileQuery\.data\?\.persisted\) return;[\s\S]*?const nextProfile = selectHydratedNewsPreferenceProfile\({[\s\S]*?localProfile: profile,[\s\S]*?serverProfile: profileQuery\.data,[\s\S]*?}\);[\s\S]*?if \(areNewsPreferenceProfilesEqual\(profile, nextProfile\)\) return;[\s\S]*?writeStoredNewsPreferenceProfile\(nextProfile\);/,
    );
  });

  it("keeps preview directories on local reader memory without server profile calls", async () => {
    const source = await readFile(
      new URL("./news-directory-reader-lens.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toMatch(
      /const canUseServerReaderMemory =[\s\S]*?directory\.status === "ready" && Boolean\(visitorKey\);/,
    );
    expect(source).toContain("{ enabled: canUseServerReaderMemory }");
    expect(source).toContain("if (!canUseServerReaderMemory) return;");
    expect(source).not.toContain("{ enabled: Boolean(visitorKey) }");
  });

  it("hydrates directory lens recommendations from recent search memory", async () => {
    const source = await readFile(
      new URL("./news-directory-reader-lens.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("readStoredNewsSearchMemoryItems");
    expect(source).toContain("subscribeToNewsReaderMemoryStorage");
    expect(source).toMatch(
      /const \[searchMemoryItems, setSearchMemoryItems\] = useState\([\s\S]*?readStoredNewsSearchMemoryItems\(\),[\s\S]*?\);/,
    );
    expect(source).toMatch(
      /subscribeToNewsReaderMemoryStorage\(\(\) =>[\s\S]*?setSearchMemoryItems\(readStoredNewsSearchMemoryItems\(\)\)/,
    );
    expect(source).toMatch(
      /selectNewsDirectoryReaderLens\({[\s\S]*?directory,[\s\S]*?profile,[\s\S]*?searchMemoryItems,[\s\S]*?}\)/,
    );
  });
});
