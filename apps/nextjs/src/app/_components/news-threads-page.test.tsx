import { readFile } from "node:fs/promises";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { NewsPreferenceProfile } from "@acme/validators";

import type { NewsHomeItem, NewsReaderMemoryItem } from "./news-home-model";
import { TRPCReactProvider } from "~/trpc/react";
import {
  applyNewsCoverageThreadFollow,
  getNewsCoverageThreadGuardrailItems,
  NewsCoverageThreadDetailView,
  NewsCoverageThreadsView,
  selectNewsCoverageThreadDetail,
  selectNewsCoverageThreads,
} from "./news-threads-page";

const globalWithReact = globalThis as typeof globalThis & {
  React: typeof React;
};

globalWithReact.React = React;

const profile: NewsPreferenceProfile = {
  noveltyBias: 1.2,
  preferredCategories: ["agent_product"],
  preferredEntities: ["OpenAI", "browser agents"],
  preferredSources: ["agent-desk"],
  recencyBias: 1.1,
};

const createItem = (
  overrides: Partial<NewsHomeItem> & Pick<NewsHomeItem, "id" | "title">,
) => {
  const { id, title, ...itemOverrides } = overrides;

  return {
    canonicalUrl: null,
    category: "agent_product",
    entities: ["OpenAI"],
    id,
    imageUrl: null,
    publishedAt: "2026-07-06T09:00:00.000Z",
    sourceName: "Agent Desk",
    sourceScore: 90,
    sourceSlug: "agent-desk",
    sourceType: "manual",
    summary: "Summary",
    tags: ["browser agents"],
    title,
    trendScore: 80,
    ...itemOverrides,
  };
};

const items: NewsHomeItem[] = [
  createItem({
    clusterKey: "openai-agent-browser",
    id: "agent-browser-a",
    sourceName: "Agent Desk",
    sourceSlug: "agent-desk",
    title: "OpenAI agent browser plans move into workflow pilots",
    trendScore: 93,
  }),
  createItem({
    clusterKey: "openai-agent-browser",
    id: "agent-browser-b",
    sourceName: "Model Desk",
    sourceSlug: "model-desk",
    title: "Browser agents get enterprise workflow tests",
    trendScore: 88,
  }),
  createItem({
    category: "funding",
    clusterKey: "gpu-funding-round",
    entities: ["GPU Cloud"],
    id: "funding-a",
    sourceName: "Capital Desk",
    sourceSlug: "capital-desk",
    tags: ["infrastructure"],
    title: "GPU cloud funding round prices inference demand",
    trendScore: 86,
  }),
  createItem({
    category: "policy",
    clusterKey: undefined,
    entities: ["Regulators"],
    id: "policy-a",
    sourceName: "Policy Desk",
    sourceSlug: "policy-desk",
    tags: ["audits"],
    title: "Policy teams ask for stronger deployment evidence",
    trendScore: 74,
  }),
  createItem({
    category: "policy",
    clusterKey: undefined,
    entities: ["AI Safety"],
    id: "policy-b",
    sourceName: "Policy Desk",
    sourceSlug: "policy-desk",
    tags: ["audits"],
    title: "Audit reports become the policy desk lead",
    trendScore: 72,
  }),
];

const createGuardrailItem = (itemId: string): NewsReaderMemoryItem => {
  const item = items.find((candidate) => candidate.id === itemId);

  if (!item) throw new Error(`Missing test story: ${itemId}`);

  return {
    category: item.category,
    entities: [...item.entities],
    hiddenAt: "2026-07-06T10:30:00.000Z",
    id: item.id,
    sourceName: item.sourceName,
    sourceSlug: item.sourceSlug,
    tags: [...item.tags],
    title: item.title,
  };
};

const renderThreadsMarkup = (element: React.ReactElement) =>
  renderToStaticMarkup(React.createElement(TRPCReactProvider, null, element));

describe("selectNewsCoverageThreads", () => {
  it("groups related stories and ranks reader-matched coverage first", () => {
    const coverage = selectNewsCoverageThreads({ items, profile });

    expect(coverage.summary).toBe(
      "3 coverage threads group 5 stories across 4 sources. 1 thread matches the active reader profile.",
    );
    expect(coverage.metrics).toEqual([
      { label: "Threads", value: "3" },
      { label: "Stories", value: "5" },
      { label: "Sources", value: "4" },
      { label: "Reader matches", value: "1" },
    ]);
    expect(coverage.threads[0]).toMatchObject({
      href: "/news/agent-browser-a",
      readerFitLabel: "4 reader matches",
      sourceCountLabel: "2 sources",
      storyCountLabel: "2 stories",
      threadHref: "/threads/openai-agent-browser",
      title: "OpenAI agent browser plans move into workflow pilots",
    });
    expect(coverage.threads[0]?.readerSignals).toEqual([
      "Topic: Agents",
      "Source: Agent Desk",
      "Entity: OpenAI",
      "Angle: browser agents",
    ]);
    expect(coverage.threads[1]?.title).toBe(
      "GPU cloud funding round prices inference demand",
    );
    expect(coverage.threads[2]).toMatchObject({
      sourceCountLabel: "1 source",
      storyCountLabel: "2 stories",
      title: "Policy teams ask for stronger deployment evidence",
    });
  });

  it("counts readable angle preferences against raw thread tags", () => {
    const coverage = selectNewsCoverageThreads({
      items: [
        createItem({
          category: "funding",
          clusterKey: "browser-angle",
          entities: ["Operator"],
          id: "browser-angle",
          sourceName: "Capital Desk",
          sourceSlug: "capital-desk",
          tags: ["browser-agents"],
          title: "Browser agent deals reshape workflow funding",
        }),
        createItem({
          category: "model_release",
          clusterKey: "model-angle",
          entities: ["Frontier Model"],
          id: "model-angle",
          sourceName: "Model Desk",
          sourceSlug: "model-desk",
          tags: ["models"],
          title: "Frontier model launch expands eval windows",
        }),
      ],
      profile: {
        noveltyBias: 1,
        preferredCategories: [],
        preferredEntities: ["browser agents"],
        preferredSources: [],
        recencyBias: 1,
      },
    });
    const angleThread = coverage.threads.find(
      (thread) => thread.lead.id === "browser-angle",
    );

    expect(coverage.metrics).toContainEqual({
      label: "Reader matches",
      value: "1",
    });
    expect(angleThread?.readerFitLabel).toBe("1 reader matches");
    expect(angleThread?.readerSignals).toEqual(["Angle: browser agents"]);
  });

  it("renders a dense coverage page with thread links and reader signals", () => {
    const coverage = selectNewsCoverageThreads({ items, profile });
    const markup = renderThreadsMarkup(
      <NewsCoverageThreadsView
        coverage={coverage}
        status="ready"
        onFollowThread={() => undefined}
        onLessThread={() => undefined}
      />,
    );

    expect(markup).toContain("Coverage Threads");
    expect(markup).toContain("OpenAI agent browser plans");
    expect(markup).toContain("4 reader matches");
    expect(markup).toContain("Topic: Agents");
    expect(markup).toContain("Angle: browser agents");
    expect(markup).toContain('href="/entities/OpenAI"');
    expect(markup).toContain('href="/news/agent-browser-a"');
    expect(markup).toContain('href="/threads/openai-agent-browser"');
    expect(markup).toContain('href="/topics/agent-product"');
    expect(markup).toContain('href="/reader/following"');
    expect(markup).toContain("Follow thread");
    expect(markup).toContain("Less thread");
    expect(markup).toContain(
      'aria-label="Reader actions: OpenAI agent browser plans move into workflow pilots"',
    );
    expect(markup).toContain(
      'aria-label="Reader actions: Browser agents get enterprise workflow tests"',
    );
    expect(markup).toContain("Save");
    expect(markup).toContain("Source");
  });

  it("selects a thread detail by cluster route key or topic fallback key", () => {
    const detail = selectNewsCoverageThreadDetail({
      items,
      profile,
      threadKey: "openai-agent-browser",
    });

    expect(detail).toMatchObject({
      statusLabel: "2 stories / 2 sources",
      summary:
        "Agents coverage led by Agent Desk with 2 sources. 4 reader signals match this thread.",
      thread: {
        threadHref: "/threads/openai-agent-browser",
        title: "OpenAI agent browser plans move into workflow pilots",
        verificationLabel: "Verified thread",
        verificationSummary:
          "2 independent sources with 90 average trust support this thread.",
      },
      timeline: [
        {
          href: "/news/agent-browser-a",
          sourceName: "Agent Desk",
          title: "OpenAI agent browser plans move into workflow pilots",
        },
        {
          href: "/news/agent-browser-b",
          sourceName: "Model Desk",
          title: "Browser agents get enterprise workflow tests",
        },
      ],
    });

    const topicFallback = selectNewsCoverageThreadDetail({
      items,
      profile,
      threadKey: "topic-policy",
    });

    expect(topicFallback?.thread.title).toBe(
      "Policy teams ask for stronger deployment evidence",
    );
    expect(
      selectNewsCoverageThreadDetail({
        items,
        profile,
        threadKey: "missing-thread",
      }),
    ).toBeNull();
  });

  it("renders a thread detail page with source timeline and feedback controls", () => {
    const detail = selectNewsCoverageThreadDetail({
      items,
      profile,
      threadKey: "openai-agent-browser",
    });

    expect(detail).not.toBeNull();
    if (!detail) throw new Error("Expected a thread detail.");

    const markup = renderThreadsMarkup(
      <NewsCoverageThreadDetailView
        detail={detail}
        onFollowThread={() => undefined}
        onLessThread={() => undefined}
      />,
    );

    expect(markup).toContain("Coverage Thread");
    expect(markup).toContain("Verification");
    expect(markup).toContain("Verified thread");
    expect(markup).toContain(
      "2 independent sources with 90 average trust support this thread.",
    );
    expect(markup).toContain("Source Timeline");
    expect(markup).toContain("OpenAI agent browser plans");
    expect(markup).toContain("Browser agents get enterprise workflow tests");
    expect(markup).toContain("4 reader signals match this thread");
    expect(markup).toContain("Angle: browser agents");
    expect(markup).toContain("Follow thread");
    expect(markup).toContain("Less thread");
    expect(markup).toContain('href="/threads"');
    expect(markup).toContain('href="/news/agent-browser-a"');
    expect(markup).toContain(
      'aria-label="Reader actions: OpenAI agent browser plans move into workflow pilots"',
    );
    expect(markup).toContain(
      'aria-label="Reader actions: Browser agents get enterprise workflow tests"',
    );
    expect(markup).toContain("Save");
    expect(markup).toContain("Source");
  });

  it("turns a followed thread into profile signals without duplicating existing preferences", () => {
    const coverage = selectNewsCoverageThreads({
      items,
      profile: {
        noveltyBias: 1,
        preferredCategories: [],
        preferredEntities: ["OpenAI"],
        preferredSources: ["agent-desk"],
        recencyBias: 1,
      },
    });
    const thread = coverage.threads[0];

    expect(thread).toBeDefined();
    if (!thread) throw new Error("Expected a coverage thread.");

    const nextProfile = applyNewsCoverageThreadFollow({
      profile: {
        noveltyBias: 1,
        preferredCategories: [],
        preferredEntities: ["OpenAI"],
        preferredSources: ["agent-desk"],
        recencyBias: 1,
      },
      thread,
    });

    expect(nextProfile).toEqual({
      noveltyBias: 1,
      preferredCategories: ["agent_product"],
      preferredEntities: ["OpenAI", "browser agents"],
      preferredSources: ["agent-desk", "model-desk"],
      recencyBias: 1,
    });
  });

  it("persists thread angle tags as readable profile signals when following a thread", () => {
    const coverage = selectNewsCoverageThreads({
      items: [
        createItem({
          category: "funding",
          clusterKey: "browser-angle",
          entities: ["Operator"],
          id: "browser-angle",
          sourceName: "Capital Desk",
          sourceSlug: "capital-desk",
          tags: ["browser-agents"],
          title: "Browser agent deals reshape workflow funding",
        }),
      ],
      profile: {
        noveltyBias: 1,
        preferredCategories: [],
        preferredEntities: [],
        preferredSources: [],
        recencyBias: 1,
      },
    });
    const thread = coverage.threads[0];

    expect(thread).toBeDefined();
    if (!thread) throw new Error("Expected a coverage thread.");

    const nextProfile = applyNewsCoverageThreadFollow({
      profile: {
        noveltyBias: 1,
        preferredCategories: [],
        preferredEntities: [],
        preferredSources: [],
        recencyBias: 1,
      },
      thread,
    });

    expect(nextProfile.preferredEntities).toEqual([
      "Operator",
      "browser agents",
    ]);
  });

  it("does not duplicate readable thread angles when legacy raw angle preferences already exist", () => {
    const coverage = selectNewsCoverageThreads({
      items: [
        createItem({
          category: "funding",
          clusterKey: "prompt-injection-angle",
          entities: ["Operator"],
          id: "prompt-injection-angle",
          sourceName: "Security Desk",
          sourceSlug: "security-desk",
          tags: ["prompt_injection"],
          title: "Prompt injection controls reshape browser agent funding",
        }),
      ],
      profile: {
        noveltyBias: 1,
        preferredCategories: [],
        preferredEntities: ["prompt_injection"],
        preferredSources: [],
        recencyBias: 1,
      },
    });
    const thread = coverage.threads[0];

    expect(thread).toBeDefined();
    if (!thread) throw new Error("Expected a coverage thread.");

    const nextProfile = applyNewsCoverageThreadFollow({
      profile: {
        noveltyBias: 1,
        preferredCategories: [],
        preferredEntities: ["prompt_injection"],
        preferredSources: [],
        recencyBias: 1,
      },
      thread,
    });

    expect(nextProfile.preferredEntities).toEqual([
      "prompt_injection",
      "Operator",
    ]);
  });

  it("converts a less-liked thread into guardrail memory for every story in the thread", () => {
    const coverage = selectNewsCoverageThreads({ items, profile });
    const thread = coverage.threads[0];

    expect(thread).toBeDefined();
    if (!thread) throw new Error("Expected a coverage thread.");

    expect(
      getNewsCoverageThreadGuardrailItems({
        hiddenAt: "2026-07-06T10:30:00.000Z",
        thread,
      }),
    ).toEqual([
      {
        canonicalUrl: null,
        category: "agent_product",
        entities: ["OpenAI"],
        hiddenAt: "2026-07-06T10:30:00.000Z",
        id: "agent-browser-a",
        occurredAt: "2026-07-06T10:30:00.000Z",
        originalUrl: undefined,
        sourceName: "Agent Desk",
        sourceSlug: "agent-desk",
        tags: ["browser agents"],
        title: "OpenAI agent browser plans move into workflow pilots",
      },
      {
        canonicalUrl: null,
        category: "agent_product",
        entities: ["OpenAI"],
        hiddenAt: "2026-07-06T10:30:00.000Z",
        id: "agent-browser-b",
        occurredAt: "2026-07-06T10:30:00.000Z",
        originalUrl: undefined,
        sourceName: "Model Desk",
        sourceSlug: "model-desk",
        tags: ["browser agents"],
        title: "Browser agents get enterprise workflow tests",
      },
    ]);
  });

  it("removes guardrailed thread stories before grouping coverage threads", () => {
    const guardrailItems: NewsReaderMemoryItem[] = [
      createGuardrailItem("agent-browser-a"),
      createGuardrailItem("agent-browser-b"),
    ];
    const input: Parameters<typeof selectNewsCoverageThreads>[0] & {
      guardrailItems: NewsReaderMemoryItem[];
    } = {
      guardrailItems,
      items,
      profile,
    };

    expect(
      selectNewsCoverageThreads(input).threads.map((thread) => thread.key),
    ).toEqual(["cluster:gpu-funding-round", "topic:policy"]);
  });

  it("returns no thread detail when every story in that thread is guardrailed", () => {
    const guardrailItems: NewsReaderMemoryItem[] = [
      createGuardrailItem("agent-browser-a"),
      createGuardrailItem("agent-browser-b"),
    ];
    const input: Parameters<typeof selectNewsCoverageThreadDetail>[0] & {
      guardrailItems: NewsReaderMemoryItem[];
    } = {
      guardrailItems,
      items,
      profile,
      threadKey: "openai-agent-browser",
    };

    expect(selectNewsCoverageThreadDetail(input)).toBeNull();
  });

  it("syncs followed thread signals to the server reader profile", async () => {
    const source = await readFile(
      new URL("./news-threads-page.tsx", import.meta.url),
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
    expect(
      source.match(/const nextProfile = applyNewsCoverageThreadFollow/g)
        ?.length,
    ).toBe(2);
    expect(
      source.match(
        /const nextProfile = applyNewsCoverageThreadFollow[\s\S]*?writeStoredNewsPreferenceProfile\(nextProfile\)/g,
      )?.length,
    ).toBe(2);
    expect(source.match(/updateProfile\.mutate\({/g)?.length).toBe(2);
    expect(source).toMatch(
      /profile: toNewsServerPreferenceProfileInput\(nextProfile\),[\s\S]*?visitorKey,/,
    );
  });

  it("hydrates persisted server reader profile before ranking threads", async () => {
    const source = await readFile(
      new URL("./news-threads-page.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("useQuery");
    expect(source).toContain("selectHydratedNewsPreferenceProfile");
    expect(source).toContain("areNewsPreferenceProfilesEqual");
    expect(source.match(/const profileQuery = useQuery\(/g)?.length).toBe(2);
    expect(source.match(/trpc\.news\.profile\.queryOptions\(/g)?.length).toBe(
      2,
    );
    expect(source.match(/profileQuery\.data\?\.persisted/g)?.length).toBe(2);
    expect(
      source.match(/selectHydratedNewsPreferenceProfile\({/g)?.length,
    ).toBe(2);
    expect(
      source.match(/areNewsPreferenceProfilesEqual\(profile, nextProfile\)/g)
        ?.length,
    ).toBe(2);
    expect(
      source.match(
        /selectHydratedNewsPreferenceProfile\({[\s\S]*?localProfile: profile,[\s\S]*?serverProfile: profileQuery\.data,[\s\S]*?\}\);[\s\S]*?writeStoredNewsPreferenceProfile\(nextProfile\)/g,
      )?.length,
    ).toBe(2);
  });

  it("keeps preview thread pages on local reader memory without server profile queries", async () => {
    const source = await readFile(
      new URL("./news-threads-page.tsx", import.meta.url),
      "utf8",
    );

    expect(
      source.match(
        /const canUseServerReaderMemory = status === "ready" && Boolean\(visitorKey\);/g,
      )?.length,
    ).toBe(2);
    expect(
      source.match(/\{ enabled: canUseServerReaderMemory \}/g)?.length,
    ).toBe(4);
    expect(
      source.match(/if \(!canUseServerReaderMemory\) return;/g)?.length,
    ).toBe(2);
    expect(source).not.toContain("{ enabled: Boolean(visitorKey) }");
  });

  it("keeps less-liked thread feedback local without interaction reporting", async () => {
    const source = await readFile(
      new URL("./news-threads-page.tsx", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("recordInteraction");
    expect(source).not.toContain("persistThreadLessFeedback");
    expect(source.match(/writeStoredNewsReaderMemoryItems/g)?.length).toBe(2);
    expect(
      source.match(/getNewsCoverageThreadGuardrailItems/g)?.length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("hydrates thread ranking from local and server guardrail memory", async () => {
    const source = await readFile(
      new URL("./news-threads-page.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("selectNewsCoverageThreadEligibleItems");
    expect(source).toContain("subscribeToNewsReaderMemoryStorage");
    expect(source).not.toContain("{ limit: 60, visitorKey");
    expect(source.match(/\{ limit: 25, visitorKey/g)?.length).toBe(2);
    expect(source.match(/trpc\.news\.guardrails\.queryOptions/g)?.length).toBe(
      2,
    );
    expect(
      source.match(/selectNewsCoverageThreadEligibleItems\({/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(2);
    expect(source).toMatch(
      /selectNewsCoverageThreads\({[\s\S]*?items: eligibleItems,[\s\S]*?profile,[\s\S]*?}\)/,
    );
    expect(source).toMatch(
      /selectNewsCoverageThreadDetail\({[\s\S]*?items: eligibleItems,[\s\S]*?profile,[\s\S]*?threadKey,[\s\S]*?}\)/,
    );
  });

  it("wires the route and home navigation", async () => {
    const [routeSource, detailRouteSource, homeSource] = await Promise.all([
      readFile(new URL("../threads/page.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../threads/[threadKey]/page.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("./news-public-front-page.tsx", import.meta.url),
        "utf8",
      ),
    ]);

    expect(routeSource).toContain("getNewsHomeData");
    expect(routeSource).toContain("<NewsCoverageThreadsPage");
    expect(routeSource).toContain('dynamic = "force-dynamic"');
    expect(detailRouteSource).toContain("getNewsHomeData");
    expect(detailRouteSource).toContain("<NewsCoverageThreadDetailPage");
    expect(detailRouteSource).toContain("notFound()");
    expect(detailRouteSource).toContain('dynamic = "force-dynamic"');
    expect(homeSource).toContain('href="/threads"');
  });
});
