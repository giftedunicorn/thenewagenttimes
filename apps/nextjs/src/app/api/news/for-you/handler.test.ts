import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import type { NewsHomeItem } from "../../../_components/news-home-model";
import { handleNewsForYouRequest } from "./handler";

const createItem = (
  overrides: Partial<NewsHomeItem> & Pick<NewsHomeItem, "id" | "title">,
): NewsHomeItem => {
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
    id: "agent-browser",
    title: "Browser agents become the workflow lead",
    trendScore: 92,
  }),
  createItem({
    category: "model_release",
    entities: ["Frontier Model"],
    id: "model-launch",
    sourceName: "Model Desk",
    sourceSlug: "model-desk",
    tags: ["models"],
    title: "Frontier model release shifts eval policy",
    trendScore: 88,
  }),
  createItem({
    category: "funding",
    entities: ["GPU Cloud"],
    id: "gpu-funding",
    sourceName: "Capital Desk",
    sourceSlug: "capital-desk",
    tags: ["infrastructure"],
    title: "GPU funding follows inference demand",
    trendScore: 86,
  }),
  createItem({
    category: "policy",
    entities: ["Regulators"],
    id: "policy-audit",
    sourceName: "Policy Desk",
    sourceSlug: "policy-desk",
    tags: ["audits"],
    title: "Policy teams ask for deployment evidence",
    trendScore: 74,
  }),
];

interface NewsForYouTestResponse {
  context?: {
    degradedSignals: string[];
    filters: {
      category: string | null;
      q: string | null;
      sourceSlug: string | null;
      tag: string | null;
    };
    memory: {
      collaborativeSignals: number;
      negativeFeedback: number;
      positiveFeedback: number;
      recentExposure: number;
      searches: number;
      semanticSimilarity: number;
    };
    objective: string;
    profileSignalCount: number;
    readerLocalHour: number | null;
  };
  excludedCount: number;
  items: {
    category: string;
    id: string;
    matchedSignals: string[];
    recommendation: {
      badges: string[];
    };
    sourceName: string;
    title: string;
  }[];
  limit: number;
    memory: {
      negativeFeedback: number;
      positiveFeedback: number;
      searches: number;
    };
  mode: string;
  nextRequest: {
    category?: string;
    collaborativeSignals?: {
      newsItemId: string;
      score: number;
    }[];
    excludeNewsItemIds: string[];
    limit: number;
    negativeFeedbackItems?: {
      hiddenAt?: string;
      id: string;
    }[];
    objective: string;
    positiveFeedbackItems?: {
      action: string;
      id: string;
      occurredAt?: string;
    }[];
    profile?: {
      preferredCategories: string[];
      preferredEntities: string[];
      preferredSources: string[];
    };
    q?: string;
    readerLocalHour?: number;
    recentExposureItems?: {
      id: string;
      occurredAt?: string;
      surface?: string;
    }[];
    searchMemoryItems?: {
      query: string;
    }[];
    semanticSimilarityMatches?: {
      newsItemId: string;
      occurredAt?: string;
      similarity: number;
      strength?: number;
    }[];
    sourceSlug?: string;
    tag?: string;
  };
  ok: boolean;
  degradedSignals?: string[];
  returnedCount: number;
}

describe("handleNewsForYouRequest", () => {
  it("returns a personalized For You page with explanations and next request shape", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () => Promise.resolve(items),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          excludeNewsItemIds: ["model-launch"],
          limit: 2,
          objective: "reader_match",
          profile: {
            noveltyBias: 1.1,
            preferredCategories: ["agent_product"],
            preferredEntities: ["OpenAI"],
            preferredSources: ["agent-desk"],
            recencyBias: 1.2,
          },
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload).toMatchObject({
      excludedCount: 1,
      items: [
        {
          category: "agent_product",
          id: "agent-browser",
          sourceName: "Agent Desk",
          title: "Browser agents become the workflow lead",
        },
        {
          category: "funding",
          id: "gpu-funding",
          sourceName: "Capital Desk",
          title: "GPU funding follows inference demand",
        },
      ],
      limit: 2,
      mode: "for_you",
      nextRequest: {
        excludeNewsItemIds: ["model-launch", "agent-browser", "gpu-funding"],
        limit: 2,
        objective: "reader_match",
      },
      ok: true,
      returnedCount: 2,
    });
    expect(payload.items[0]?.recommendation.badges).toContain(
      "Preferred topic",
    );
    expect(payload.items[1]?.recommendation.badges).toContain(
      "Outside your usual mix",
    );
    expect(payload.context).toMatchObject({
      degradedSignals: [],
      filters: {
        category: null,
        q: null,
        sourceSlug: null,
        tag: null,
      },
      memory: {
        collaborativeSignals: 0,
        negativeFeedback: 0,
        positiveFeedback: 0,
        recentExposure: 0,
        searches: 0,
        semanticSimilarity: 0,
      },
      objective: "reader_match",
      profileSignalCount: 3,
      readerLocalHour: null,
    });
  });

  it("boosts profile topic and source separator variants before ranking For You", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            category: "agent_product",
            entities: ["Agents"],
            id: "preferred-agent-source",
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            tags: ["agents"],
            title: "Agent workflow desk ships browser operators",
            trendScore: 60,
          }),
          createItem({
            category: "market_map",
            entities: ["Market"],
            id: "hot-market-map",
            sourceName: "Market Map",
            sourceSlug: "market-map",
            tags: ["market"],
            title: "AI market map heats up",
            trendScore: 92,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          objective: "reader_match",
          profile: {
            noveltyBias: 1,
            preferredCategories: ["agent-product"],
            preferredEntities: [],
            preferredSources: ["Agent Desk"],
            recencyBias: 1,
          },
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual([
      "preferred-agent-source",
    ]);
    expect(payload.items[0]?.matchedSignals).toEqual(
      expect.arrayContaining(["category", "source"]),
    );
    expect(payload.items[0]?.recommendation.badges).toEqual(
      expect.arrayContaining(["Preferred topic", "Trusted source"]),
    );
  });

  it("uses preferred angle tags as first-class For You ranking signals", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "generic-agent-heat",
            tags: ["platform"],
            title: "Agent platforms dominate the market map",
            trendScore: 96,
          }),
          createItem({
            id: "browser-agent-angle",
            tags: ["browser agents"],
            title: "Browser agents become the workflow lead",
            trendScore: 72,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          objective: "reader_match",
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: ["browser agents"],
            preferredSources: [],
            recencyBias: 1,
          },
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual([
      "browser-agent-angle",
    ]);
    expect(payload.items[0]?.matchedSignals).toContain("tag");
    expect(payload.items[0]?.recommendation.badges).toContain(
      "Preferred angle: browser agents",
    );
    expect(payload.context?.profileSignalCount).toBe(1);
  });

  it("uses legacy raw preferred angle tags as For You ranking signals", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "generic-agent-heat",
            tags: ["platform"],
            title: "Agent platforms dominate the market map",
            trendScore: 96,
          }),
          createItem({
            id: "prompt-injection-angle",
            tags: ["prompt_injection"],
            title: "Prompt injection controls become the browser agent lead",
            trendScore: 72,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          objective: "reader_match",
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: ["prompt_injection"],
            preferredSources: [],
            recencyBias: 1,
          },
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual([
      "prompt-injection-angle",
    ]);
    expect(payload.items[0]?.matchedSignals).toContain("tag");
    expect(payload.items[0]?.recommendation.badges).toContain(
      "Preferred angle: prompt injection",
    );
  });

  it("keeps exact Less feedback out of the next For You page", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () => Promise.resolve(items),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 3,
          negativeFeedbackItems: [
            {
              canonicalUrl: null,
              category: "agent_product",
              entities: ["OpenAI"],
              hiddenAt: "2026-07-06T09:15:00.000Z",
              id: "agent-browser",
              originalUrl: null,
              sourceName: "Agent Desk",
              sourceSlug: "agent-desk",
              tags: ["browser agents"],
              title: "Browser agents become the workflow lead",
            },
          ],
          profile: {
            noveltyBias: 1.1,
            preferredCategories: ["agent_product"],
            preferredEntities: ["OpenAI"],
            preferredSources: ["agent-desk"],
            recencyBias: 1.2,
          },
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).not.toContain("agent-browser");
    expect(payload.memory).toEqual({
      negativeFeedback: 1,
      positiveFeedback: 0,
      searches: 0,
    });
    expect(payload.nextRequest.excludeNewsItemIds).toContain("agent-browser");
  });

  it("keeps newly returned stories when the replay exclude list is full", async () => {
    const existingExcludedIds = Array.from(
      { length: 240 },
      (_value, index) => `old-story-${index}`,
    );
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "fresh-agent-story",
            title: "Fresh agent story",
            trendScore: 82,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          excludeNewsItemIds: existingExcludedIds,
          limit: 1,
          objective: "reader_match",
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: [],
            preferredSources: [],
            recencyBias: 1,
          },
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual(["fresh-agent-story"]);
    expect(payload.nextRequest.excludeNewsItemIds).toHaveLength(240);
    expect(payload.nextRequest.excludeNewsItemIds).toContain("fresh-agent-story");
  });

  it("deduplicates repeated Less feedback before carrying it into the next For You request", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () => Promise.resolve([]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 2,
          negativeFeedbackItems: [
            {
              canonicalUrl: "https://example.com/news/agent-browser",
              category: "agent_product",
              entities: ["OpenAI"],
              hiddenAt: "2026-07-06T09:15:00.000Z",
              id: "agent-browser-old-less",
              originalUrl: "https://example.com/news/agent-browser?utm=old",
              sourceName: "Agent Desk",
              sourceSlug: "agent-desk",
              tags: ["browser agents"],
              title: "Older Less feedback",
            },
            {
              canonicalUrl: "https://example.com/news/agent-browser",
              category: "agent_product",
              entities: ["OpenAI"],
              hiddenAt: "2026-07-06T11:15:00.000Z",
              id: "agent-browser-new-less",
              originalUrl: "https://example.com/news/agent-browser?utm=new",
              sourceName: "Agent Desk",
              sourceSlug: "agent-desk",
              tags: ["browser agents"],
              title: "Newer Less feedback",
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.memory.negativeFeedback).toBe(1);
    expect(payload.nextRequest.negativeFeedbackItems).toHaveLength(1);
    expect(payload.nextRequest.negativeFeedbackItems?.[0]).toMatchObject({
      hiddenAt: "2026-07-06T11:15:00.000Z",
      id: "agent-browser-new-less",
    });
  });

  it("ignores Less feedback with invalid timestamps before filtering or replaying it", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            canonicalUrl: "https://example.com/news/agent-browser#variant",
            id: "agent-browser-repost",
            originalUrl: "https://example.com/news/agent-browser?utm=next",
            title: "Browser agents become the workflow lead again",
            trendScore: 92,
          }),
          createItem({
            canonicalUrl: "https://example.com/news/model-launch#variant",
            id: "model-launch-repost",
            originalUrl: "https://example.com/news/model-launch?utm=next",
            title: "Frontier model release shifts eval policy again",
            trendScore: 88,
          }),
          createItem({
            id: "fresh-agent-story",
            title: "Fresh agent workflow story",
            trendScore: 72,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 3,
          negativeFeedbackItems: [
            {
              canonicalUrl: "https://example.com/news/agent-browser",
              category: "agent_product",
              entities: ["OpenAI"],
              hiddenAt: "not-a-date",
              id: "agent-browser",
              originalUrl: "https://example.com/news/agent-browser?utm=less",
              sourceName: "Agent Desk",
              sourceSlug: "agent-desk",
              tags: ["browser agents"],
              title: "Browser agents become the workflow lead",
            },
            {
              canonicalUrl: "https://example.com/news/model-launch",
              category: "model_release",
              entities: ["Frontier Model"],
              id: "model-launch",
              occurredAt: "also-not-a-date",
              originalUrl: "https://example.com/news/model-launch?utm=less",
              sourceName: "Model Desk",
              sourceSlug: "model-desk",
              tags: ["models"],
              title: "Frontier model release shifts eval policy",
            },
          ],
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: [],
            preferredSources: [],
            recencyBias: 1,
          },
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual([
      "agent-browser-repost",
      "model-launch-repost",
      "fresh-agent-story",
    ]);
    expect(payload.memory.negativeFeedback).toBe(0);
    expect(payload.nextRequest.excludeNewsItemIds).toEqual([
      "agent-browser-repost",
      "model-launch-repost",
      "fresh-agent-story",
    ]);
    expect(payload.nextRequest.negativeFeedbackItems).toEqual([]);
  });

  it("ignores stale Less feedback before exact candidate exclusion", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));

    try {
      const response = await handleNewsForYouRequest({
        getItems: () =>
          Promise.resolve([
            createItem({
              canonicalUrl: "https://example.com/news/agent-browser#variant",
              id: "agent-browser",
              originalUrl: "https://example.com/news/agent-browser?utm=next",
              title: "Browser agents become the workflow lead",
              trendScore: 92,
            }),
            createItem({
              id: "fresh-agent-story",
              title: "Fresh agent workflow story",
              trendScore: 72,
            }),
          ]),
        request: new Request("https://thenewagenttimes.test/api/news/for-you", {
          body: JSON.stringify({
            limit: 2,
            negativeFeedbackItems: [
              {
                canonicalUrl: "https://example.com/news/agent-browser",
                category: "agent_product",
                entities: ["OpenAI"],
                hiddenAt: "2026-05-01T09:15:00.000Z",
                id: "agent-browser",
                originalUrl: "https://example.com/news/agent-browser?utm=less",
                sourceName: "Agent Desk",
                sourceSlug: "agent-desk",
                tags: ["browser agents"],
                title: "Browser agents become the workflow lead",
              },
            ],
            profile: {
              noveltyBias: 1,
              preferredCategories: [],
              preferredEntities: [],
              preferredSources: [],
              recencyBias: 1,
            },
          }),
          method: "POST",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as NewsForYouTestResponse;

      expect(payload.items.map((item) => item.id)).toEqual([
        "agent-browser",
        "fresh-agent-story",
      ]);
      expect(payload.memory.negativeFeedback).toBe(0);
      expect(payload.nextRequest.negativeFeedbackItems).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores future-dated Less feedback before exact candidate exclusion", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));

    try {
      const response = await handleNewsForYouRequest({
        getItems: () =>
          Promise.resolve([
            createItem({
              canonicalUrl: "https://example.com/news/agent-browser#variant",
              id: "agent-browser",
              originalUrl: "https://example.com/news/agent-browser?utm=next",
              title: "Browser agents become the workflow lead",
              trendScore: 92,
            }),
            createItem({
              id: "fresh-agent-story",
              title: "Fresh agent workflow story",
              trendScore: 72,
            }),
          ]),
        request: new Request("https://thenewagenttimes.test/api/news/for-you", {
          body: JSON.stringify({
            limit: 2,
            negativeFeedbackItems: [
              {
                canonicalUrl: "https://example.com/news/agent-browser",
                category: "agent_product",
                entities: ["OpenAI"],
                hiddenAt: "2026-08-01T09:15:00.000Z",
                id: "agent-browser",
                originalUrl: "https://example.com/news/agent-browser?utm=less",
                sourceName: "Agent Desk",
                sourceSlug: "agent-desk",
                tags: ["browser agents"],
                title: "Browser agents become the workflow lead",
              },
            ],
            profile: {
              noveltyBias: 1,
              preferredCategories: [],
              preferredEntities: [],
              preferredSources: [],
              recencyBias: 1,
            },
          }),
          method: "POST",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as NewsForYouTestResponse;

      expect(payload.items.map((item) => item.id)).toEqual([
        "agent-browser",
        "fresh-agent-story",
      ]);
      expect(payload.memory.negativeFeedback).toBe(0);
      expect(payload.nextRequest.negativeFeedbackItems).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps URL variants of excluded stories out of the next For You page", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            canonicalUrl: "https://example.com/news/model-launch",
            id: "seen-model-story",
            originalUrl: "https://example.com/news/model-launch?utm=front",
            title: "Seen model story",
            trendScore: 96,
          }),
          createItem({
            canonicalUrl: "https://example.com/news/model-launch#variant",
            id: "seen-model-story-variant",
            originalUrl: "https://example.com/news/model-launch?utm=variant",
            title: "Seen model story duplicate",
            trendScore: 95,
          }),
          createItem({
            id: "fresh-agent-story",
            title: "Fresh agent workflow story",
            trendScore: 72,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          excludeNewsItemIds: ["seen-model-story"],
          limit: 2,
          objective: "reader_match",
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual(["fresh-agent-story"]);
    expect(payload.nextRequest.excludeNewsItemIds).toEqual([
      "seen-model-story",
      "fresh-agent-story",
    ]);
  });

  it("carries returned stories into the next request as exposure memory", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T12:30:00.000Z"));

    try {
      const response = await handleNewsForYouRequest({
        getItems: () =>
          Promise.resolve([
            createItem({
              canonicalUrl: "https://example.com/news/agent-browser",
              id: "agent-browser",
              originalUrl: "https://source.example/agent-browser?utm=for-you",
              title: "Browser agents become the workflow lead",
              trendScore: 92,
            }),
            createItem({
              category: "model_release",
              entities: ["Frontier Model"],
              id: "model-launch",
              sourceName: "Model Desk",
              sourceSlug: "model-desk",
              tags: ["models"],
              title: "Frontier model release shifts eval policy",
              trendScore: 88,
            }),
          ]),
        request: new Request("https://thenewagenttimes.test/api/news/for-you", {
          body: JSON.stringify({
            limit: 1,
            objective: "reader_match",
            recentExposureItems: [
              {
                canonicalUrl: null,
                category: "funding",
                entities: ["GPU Cloud"],
                id: "prior-exposure",
                occurredAt: "2026-07-06T11:00:00.000Z",
                originalUrl: null,
                sourceSlug: "capital-desk",
                surface: "home_exposure",
                tags: ["infrastructure"],
                title: "Prior exposure",
              },
            ],
          }),
          method: "POST",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as NewsForYouTestResponse;

      expect(payload.items.map((item) => item.id)).toEqual(["agent-browser"]);
      expect(payload.nextRequest.recentExposureItems).toMatchObject([
        {
          id: "agent-browser",
          occurredAt: "2026-07-06T12:30:00.000Z",
          surface: "home_exposure",
        },
        {
          id: "prior-exposure",
          surface: "home_exposure",
        },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps excluded URL variants out when a variant appears before the excluded id", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            canonicalUrl: "https://example.com/news/model-launch#variant",
            id: "seen-model-story-variant",
            originalUrl: "https://example.com/news/model-launch?utm=variant",
            title: "Seen model story duplicate",
            trendScore: 96,
          }),
          createItem({
            canonicalUrl: "https://example.com/news/model-launch",
            id: "seen-model-story",
            originalUrl: "https://example.com/news/model-launch?utm=front",
            title: "Seen model story",
            trendScore: 95,
          }),
          createItem({
            id: "fresh-agent-story",
            title: "Fresh agent workflow story",
            trendScore: 72,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          excludeNewsItemIds: ["seen-model-story"],
          limit: 2,
          objective: "reader_match",
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual(["fresh-agent-story"]);
    expect(payload.nextRequest.excludeNewsItemIds).toEqual([
      "seen-model-story",
      "fresh-agent-story",
    ]);
  });

  it("keeps exposure URL variants out when the original story is missing from the next batch", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T12:15:00.000Z"));

    try {
      const response = await handleNewsForYouRequest({
        getItems: () =>
          Promise.resolve([
            createItem({
              canonicalUrl: "https://example.com/news/agent-browser#variant",
              id: "agent-browser-rewrite",
              originalUrl:
                "https://example.com/news/agent-browser?utm=next-page",
              title: "Browser agents duplicate wire rewrite",
              trendScore: 97,
            }),
            createItem({
              id: "fresh-agent-story",
              title: "Fresh agent workflow story",
              trendScore: 72,
            }),
          ]),
        request: new Request("https://thenewagenttimes.test/api/news/for-you", {
          body: JSON.stringify({
            excludeNewsItemIds: ["agent-browser"],
            limit: 2,
            objective: "reader_match",
            recentExposureItems: [
              {
                canonicalUrl: "https://example.com/news/agent-browser",
                category: "agent_product",
                entities: ["OpenAI"],
                id: "agent-browser",
                occurredAt: "2026-07-06T11:00:00.000Z",
                originalUrl: "https://example.com/news/agent-browser?utm=front",
                sourceSlug: "agent-desk",
                surface: "home_exposure",
                tags: ["browser agents"],
                title: "Browser agents become the workflow lead",
              },
            ],
          }),
          method: "POST",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as NewsForYouTestResponse;

      expect(payload.items.map((item) => item.id)).toEqual([
        "fresh-agent-story",
      ]);
      expect(payload.nextRequest.excludeNewsItemIds).toEqual([
        "agent-browser",
        "fresh-agent-story",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the latest repeated exposure when carrying memory into the next request", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T12:15:00.000Z"));

    try {
      const response = await handleNewsForYouRequest({
        getItems: () => Promise.resolve([]),
        request: new Request("https://thenewagenttimes.test/api/news/for-you", {
          body: JSON.stringify({
            limit: 2,
            recentExposureItems: [
              {
                canonicalUrl: "https://example.com/news/agent-browser",
                category: "agent_product",
                entities: ["OpenAI"],
                id: "agent-browser-old",
                occurredAt: "2026-07-06T09:00:00.000Z",
                originalUrl: "https://example.com/news/agent-browser?utm=old",
                sourceSlug: "agent-desk",
                surface: "home_exposure",
                tags: ["browser agents"],
                title: "Older browser agents exposure",
              },
              {
                canonicalUrl: "https://example.com/news/agent-browser",
                category: "agent_product",
                entities: ["OpenAI"],
                id: "agent-browser-new",
                occurredAt: "2026-07-06T11:00:00.000Z",
                originalUrl: "https://example.com/news/agent-browser?utm=new",
                sourceSlug: "agent-desk",
                surface: "home_exposure",
                tags: ["browser agents"],
                title: "Newer browser agents exposure",
              },
            ],
          }),
          method: "POST",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as NewsForYouTestResponse;

      expect(payload.nextRequest.recentExposureItems).toHaveLength(1);
      expect(payload.nextRequest.recentExposureItems?.[0]).toMatchObject({
        id: "agent-browser-new",
        occurredAt: "2026-07-06T11:00:00.000Z",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses recent search memory as current session intent", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "agent-browser",
            title: "Browser agents become the workflow lead",
            trendScore: 92,
          }),
          createItem({
            category: "policy",
            entities: ["Regulators"],
            id: "policy-audit",
            sourceName: "Policy Desk",
            sourceSlug: "policy-desk",
            tags: ["audits"],
            title: "Policy teams ask for deployment evidence",
            trendScore: 70,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          objective: "reader_match",
          searchMemoryItems: [
            {
              query: "deployment evidence",
              resultCount: 1,
              searchedAt: "2026-07-06T10:00:00.000Z",
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items[0]?.id).toBe("policy-audit");
    expect(payload.items[0]?.matchedSignals).toContain("session_intent");
    expect(payload.items[0]?.recommendation.badges).toContain(
      "Current session intent",
    );
    expect(payload.memory.searches).toBe(1);
  });

  it("normalizes search memory queries before echoing the next For You request", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "agent-browser",
            title: "Browser agents become the workflow lead",
            trendScore: 92,
          }),
          createItem({
            category: "policy",
            entities: ["Regulators"],
            id: "policy-audit",
            sourceName: "Policy Desk",
            sourceSlug: "policy-desk",
            tags: ["audits"],
            title: "Policy teams ask for deployment evidence",
            trendScore: 70,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          objective: "reader_match",
          searchMemoryItems: [
            {
              query: `  deployment\nevidence\t${"model ".repeat(40)}pricing  `,
              resultCount: 1,
              searchedAt: "2026-07-06T10:00:00.000Z",
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;
    const query = payload.nextRequest.searchMemoryItems?.[0]?.query;

    expect(query).toContain("deployment evidence");
    expect(query).not.toContain("\n");
    expect(query).not.toContain("\t");
    expect(query).not.toContain("  ");
    expect(query?.length).toBeLessThanOrEqual(120);
  });

  it("deduplicates normalized search memory before carrying it into the next For You request", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () => Promise.resolve(items),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          searchMemoryItems: [
            {
              query: "deployment evidence",
              resultCount: 2,
              searchedAt: "2026-07-06T09:00:00.000Z",
            },
            {
              query: "  Deployment\nEvidence  ",
              resultCount: 5,
              searchedAt: "2026-07-06T10:00:00.000Z",
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.memory.searches).toBe(1);
    expect(payload.nextRequest.searchMemoryItems).toHaveLength(1);
    expect(payload.nextRequest.searchMemoryItems?.[0]).toMatchObject({
      query: "Deployment Evidence",
      resultCount: 5,
      searchedAt: "2026-07-06T10:00:00.000Z",
    });
  });

  it("deduplicates separator-equivalent search memory before carrying it into the next For You request", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () => Promise.resolve(items),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          searchMemoryItems: [
            {
              query: "agent-product",
              resultCount: 2,
              searchedAt: "2026-07-06T09:00:00.000Z",
            },
            {
              query: "agent_product",
              resultCount: 3,
              searchedAt: "2026-07-06T09:30:00.000Z",
            },
            {
              query: "Agent Product",
              resultCount: 5,
              searchedAt: "2026-07-06T10:00:00.000Z",
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.memory.searches).toBe(1);
    expect(payload.nextRequest.searchMemoryItems).toHaveLength(1);
    expect(payload.nextRequest.searchMemoryItems?.[0]).toMatchObject({
      query: "Agent Product",
      resultCount: 5,
      searchedAt: "2026-07-06T10:00:00.000Z",
    });
  });

  it("normalizes direct search filters before echoing the next For You request", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () => Promise.resolve(items),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          q: `  deployment\nevidence\t${"model ".repeat(40)}pricing  `,
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.nextRequest.q).toContain("deployment evidence");
    expect(payload.nextRequest.q).not.toContain("\n");
    expect(payload.nextRequest.q).not.toContain("\t");
    expect(payload.nextRequest.q).not.toContain("  ");
    expect(payload.nextRequest.q?.length).toBeLessThanOrEqual(120);
  });

  it("matches direct search filters across hyphenated and underscored topic text", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () => Promise.resolve(items),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          q: "model-release",
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual(["model-launch"]);
    expect(payload.context?.filters.q).toBe("model-release");
    expect(payload.nextRequest.q).toBe("model-release");
  });

  it("does not break session-intent ties in favor of future-dated stories", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));

    try {
      const response = await handleNewsForYouRequest({
        getItems: () =>
          Promise.resolve([
            createItem({
              category: "agent_product",
              entities: ["Agent Bench"],
              id: "future-session-intent-tie",
              publishedAt: "2026-08-01T09:00:00.000Z",
              sourceScore: 90,
              sourceSlug: "future-desk",
              title: "Deployment evidence dashboard reaches agent teams",
              trendScore: 80,
            }),
            createItem({
              category: "policy",
              entities: ["Regulators"],
              id: "current-session-intent-tie",
              publishedAt: "2026-07-06T09:00:00.000Z",
              sourceScore: 90,
              sourceSlug: "current-desk",
              title: "Deployment evidence checklist reaches policy teams",
              trendScore: 80,
            }),
          ]),
        request: new Request("https://thenewagenttimes.test/api/news/for-you", {
          body: JSON.stringify({
            limit: 1,
            objective: "reader_match",
            profile: {
              noveltyBias: 0,
              preferredCategories: [],
              preferredEntities: [],
              preferredSources: [],
              recencyBias: 0,
            },
            searchMemoryItems: [
              {
                query: "deployment evidence",
                resultCount: 2,
                searchedAt: "2026-07-06T10:00:00.000Z",
              },
            ],
          }),
          method: "POST",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as NewsForYouTestResponse;

      expect(payload.items[0]?.id).toBe("current-session-intent-tie");
      expect(payload.items[0]?.matchedSignals).toContain("session_intent");
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores future-dated search memory before applying current session intent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));

    try {
      const response = await handleNewsForYouRequest({
        getItems: () =>
          Promise.resolve([
            createItem({
              id: "agent-browser",
              title: "Browser agents become the workflow lead",
              trendScore: 92,
            }),
            createItem({
              category: "policy",
              entities: ["Regulators"],
              id: "policy-audit",
              sourceName: "Policy Desk",
              sourceSlug: "policy-desk",
              tags: ["audits"],
              title: "Policy teams ask for deployment evidence",
              trendScore: 70,
            }),
          ]),
        request: new Request("https://thenewagenttimes.test/api/news/for-you", {
          body: JSON.stringify({
            limit: 1,
            objective: "reader_match",
            searchMemoryItems: [
              {
                query: "deployment evidence",
                resultCount: 1,
                searchedAt: "2026-08-01T10:00:00.000Z",
              },
            ],
          }),
          method: "POST",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as NewsForYouTestResponse;

      expect(payload.items[0]?.id).toBe("agent-browser");
      expect(payload.items[0]?.matchedSignals).not.toContain("session_intent");
      expect(payload.memory.searches).toBe(0);
      expect(payload.nextRequest.searchMemoryItems).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores stale search memory before applying current session intent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));

    try {
      const response = await handleNewsForYouRequest({
        getItems: () =>
          Promise.resolve([
            createItem({
              id: "agent-browser",
              title: "Browser agents become the workflow lead",
              trendScore: 92,
            }),
            createItem({
              category: "policy",
              entities: ["Regulators"],
              id: "policy-audit",
              sourceName: "Policy Desk",
              sourceSlug: "policy-desk",
              tags: ["audits"],
              title: "Policy teams ask for deployment evidence",
              trendScore: 70,
            }),
          ]),
        request: new Request("https://thenewagenttimes.test/api/news/for-you", {
          body: JSON.stringify({
            limit: 1,
            objective: "reader_match",
            searchMemoryItems: [
              {
                query: "deployment evidence",
                resultCount: 1,
                searchedAt: "2026-06-01T10:00:00.000Z",
              },
            ],
          }),
          method: "POST",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as NewsForYouTestResponse;

      expect(payload.items[0]?.id).toBe("agent-browser");
      expect(payload.items[0]?.matchedSignals).not.toContain("session_intent");
      expect(payload.memory.searches).toBe(0);
      expect(payload.nextRequest.searchMemoryItems).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses reader local hour to time the For You page", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            category: "funding",
            id: "generic-funding",
            sourceName: "Capital Desk",
            sourceSlug: "capital-desk",
            title: "Funding markets watch inference demand",
            trendScore: 86,
          }),
          createItem({
            category: "security",
            id: "morning-security",
            sourceName: "Security Desk",
            sourceSlug: "security-desk",
            title: "Security teams brief browser agent guardrails",
            trendScore: 79,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 2,
          objective: "reader_match",
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: [],
            preferredSources: [],
            recencyBias: 1,
          },
          readerLocalHour: 8,
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual([
      "morning-security",
      "generic-funding",
    ]);
    expect(payload.items[0]?.matchedSignals).toContain("daypart");
    expect(payload.items[0]?.recommendation.badges).toContain(
      "Timed for this edition",
    );
    expect(payload.nextRequest.readerLocalHour).toBe(8);
  });

  it("cools stories that were recently exposed on the home feed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T12:15:00.000Z"));

    try {
      const response = await handleNewsForYouRequest({
        getItems: () =>
          Promise.resolve([
            createItem({
              canonicalUrl: "https://example.com/news/seen-home-story#variant",
              id: "seen-home-story",
              originalUrl: "https://example.com/news/seen-home-story?utm=next",
              title: "Home exposed agent story returns",
              trendScore: 94,
            }),
            createItem({
              id: "fresh-agent-story",
              title: "Fresh agent workflow story",
              trendScore: 82,
            }),
          ]),
        request: new Request("https://thenewagenttimes.test/api/news/for-you", {
          body: JSON.stringify({
            limit: 2,
            objective: "reader_match",
            profile: {
              noveltyBias: 1,
              preferredCategories: [],
              preferredEntities: [],
              preferredSources: [],
              recencyBias: 1,
            },
            recentExposureItems: [
              {
                canonicalUrl: null,
                category: "agent_product",
                entities: ["OpenAI"],
                id: "seen-home-story",
                occurredAt: "2026-07-06T10:15:00.000Z",
                originalUrl: null,
                sourceSlug: "agent-desk",
                surface: "home_exposure",
                tags: ["browser agents"],
                title: "Home exposed agent story returns",
              },
            ],
          }),
          method: "POST",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as NewsForYouTestResponse;

      expect(payload.items.map((item) => item.id)).toEqual([
        "fresh-agent-story",
        "seen-home-story",
      ]);
      expect(payload.items[1]?.matchedSignals).toContain(
        "home_exposure_cooldown",
      );
      expect(payload.nextRequest.recentExposureItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "fresh-agent-story",
            occurredAt: "2026-07-06T12:15:00.000Z",
            surface: "home_exposure",
          }),
          expect.objectContaining({
            id: "seen-home-story",
            occurredAt: "2026-07-06T12:15:00.000Z",
            surface: "home_exposure",
          }),
        ]),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("deduplicates recent exposure memory before applying the replay cap", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T12:15:00.000Z"));

    try {
      const duplicateExposureItems = Array.from(
        { length: 80 },
        (_value, index) => ({
          canonicalUrl: "https://example.com/news/seen-home-story",
          category: "agent_product",
          entities: ["OpenAI"],
          id: "seen-home-story",
          occurredAt: new Date(Date.UTC(2026, 6, 6, 10, 0, index)).toISOString(),
          originalUrl: "https://example.com/news/seen-home-story?utm=old",
          sourceSlug: "agent-desk",
          surface: "home_exposure",
          tags: ["browser agents"],
          title: "Seen home story",
        }),
      );
      const response = await handleNewsForYouRequest({
        getItems: () => Promise.resolve([]),
        request: new Request("https://thenewagenttimes.test/api/news/for-you", {
          body: JSON.stringify({
            limit: 1,
            objective: "reader_match",
            recentExposureItems: [
              ...duplicateExposureItems,
              {
                canonicalUrl: "https://example.com/news/viewed-home-story",
                category: "agent_product",
                entities: ["OpenAI"],
                id: "viewed-home-story",
                occurredAt: "2026-07-06T09:00:00.000Z",
                originalUrl:
                  "https://example.com/news/viewed-home-story?utm=old",
                sourceSlug: "agent-desk",
                surface: "home_exposure",
                tags: ["browser agents"],
                title: "Viewed home story",
              },
            ],
          }),
          method: "POST",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as NewsForYouTestResponse;

      expect(payload.nextRequest.recentExposureItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "seen-home-story" }),
          expect.objectContaining({ id: "viewed-home-story" }),
        ]),
      );
      expect(
        payload.nextRequest.recentExposureItems?.filter(
          (item) => item.id === "seen-home-story",
        ),
      ).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores stale home exposure memory before applying cooldowns", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T12:15:00.000Z"));

    try {
      const response = await handleNewsForYouRequest({
        getItems: () =>
          Promise.resolve([
            createItem({
              canonicalUrl: "https://example.com/news/seen-home-story#variant",
              id: "seen-home-story",
              originalUrl: "https://example.com/news/seen-home-story?utm=next",
              title: "Home exposed agent story returns",
              trendScore: 94,
            }),
            createItem({
              id: "fresh-agent-story",
              title: "Fresh agent workflow story",
              trendScore: 82,
            }),
          ]),
        request: new Request("https://thenewagenttimes.test/api/news/for-you", {
          body: JSON.stringify({
            limit: 2,
            objective: "reader_match",
            profile: {
              noveltyBias: 1,
              preferredCategories: [],
              preferredEntities: [],
              preferredSources: [],
              recencyBias: 1,
            },
            recentExposureItems: [
              {
                canonicalUrl: "https://example.com/news/seen-home-story",
                category: "agent_product",
                entities: ["OpenAI"],
                id: "seen-home-story",
                occurredAt: "2026-07-03T10:15:00.000Z",
                originalUrl: "https://example.com/news/seen-home-story?utm=old",
                sourceSlug: "agent-desk",
                surface: "home_exposure",
                tags: ["browser agents"],
                title: "Home exposed agent story returns",
              },
            ],
          }),
          method: "POST",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as NewsForYouTestResponse;

      expect(payload.items.map((item) => item.id)).toEqual([
        "seen-home-story",
        "fresh-agent-story",
      ]);
      expect(payload.items[0]?.matchedSignals).not.toContain(
        "home_exposure_cooldown",
      );
      expect(payload.nextRequest.recentExposureItems).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            occurredAt: "2026-07-03T10:15:00.000Z",
            id: "seen-home-story",
          }),
        ]),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores future-dated home exposure memory before applying cooldowns", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T12:15:00.000Z"));

    try {
      const response = await handleNewsForYouRequest({
        getItems: () =>
          Promise.resolve([
            createItem({
              canonicalUrl: "https://example.com/news/seen-home-story#variant",
              id: "seen-home-story",
              originalUrl: "https://example.com/news/seen-home-story?utm=next",
              title: "Home exposed agent story returns",
              trendScore: 94,
            }),
            createItem({
              id: "fresh-agent-story",
              title: "Fresh agent workflow story",
              trendScore: 82,
            }),
          ]),
        request: new Request("https://thenewagenttimes.test/api/news/for-you", {
          body: JSON.stringify({
            limit: 2,
            objective: "reader_match",
            profile: {
              noveltyBias: 1,
              preferredCategories: [],
              preferredEntities: [],
              preferredSources: [],
              recencyBias: 1,
            },
            recentExposureItems: [
              {
                canonicalUrl: "https://example.com/news/seen-home-story",
                category: "agent_product",
                entities: ["OpenAI"],
                id: "seen-home-story",
                occurredAt: "2026-08-01T10:15:00.000Z",
                originalUrl:
                  "https://example.com/news/seen-home-story?utm=future",
                sourceSlug: "agent-desk",
                surface: "home_exposure",
                tags: ["browser agents"],
                title: "Home exposed agent story returns",
              },
            ],
          }),
          method: "POST",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as NewsForYouTestResponse;

      expect(payload.items.map((item) => item.id)).toEqual([
        "seen-home-story",
        "fresh-agent-story",
      ]);
      expect(payload.items[0]?.matchedSignals).not.toContain(
        "home_exposure_cooldown",
      );
      expect(payload.nextRequest.recentExposureItems).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            occurredAt: "2026-08-01T10:15:00.000Z",
            id: "seen-home-story",
          }),
        ]),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores home exposure memory with invalid timestamps before applying cooldowns", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T12:15:00.000Z"));

    try {
      const response = await handleNewsForYouRequest({
        getItems: () =>
          Promise.resolve([
            createItem({
              canonicalUrl: "https://example.com/news/seen-home-story#variant",
              id: "seen-home-story",
              originalUrl: "https://example.com/news/seen-home-story?utm=next",
              title: "Home exposed agent story returns",
              trendScore: 94,
            }),
            createItem({
              canonicalUrl:
                "https://example.com/news/viewed-home-story#variant",
              id: "viewed-home-story",
              originalUrl:
                "https://example.com/news/viewed-home-story?utm=next",
              title: "Viewed home agent story returns",
              trendScore: 90,
            }),
            createItem({
              id: "fresh-agent-story",
              title: "Fresh agent workflow story",
              trendScore: 82,
            }),
          ]),
        request: new Request("https://thenewagenttimes.test/api/news/for-you", {
          body: JSON.stringify({
            limit: 3,
            objective: "reader_match",
            profile: {
              noveltyBias: 1,
              preferredCategories: [],
              preferredEntities: [],
              preferredSources: [],
              recencyBias: 1,
            },
            recentExposureItems: [
              {
                canonicalUrl: "https://example.com/news/seen-home-story",
                category: "agent_product",
                entities: ["OpenAI"],
                id: "seen-home-story",
                occurredAt: "not-a-date",
                originalUrl: "https://example.com/news/seen-home-story?utm=old",
                sourceSlug: "agent-desk",
                surface: "home_exposure",
                tags: ["browser agents"],
                title: "Home exposed agent story returns",
              },
              {
                canonicalUrl: "https://example.com/news/viewed-home-story",
                category: "agent_product",
                entities: ["OpenAI"],
                id: "viewed-home-story",
                originalUrl:
                  "https://example.com/news/viewed-home-story?utm=old",
                sourceSlug: "agent-desk",
                surface: "home_exposure",
                tags: ["browser agents"],
                title: "Viewed home agent story returns",
                viewedAt: "also-not-a-date",
              },
            ],
          }),
          method: "POST",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as NewsForYouTestResponse;

      expect(payload.items.map((item) => item.id)).toEqual([
        "seen-home-story",
        "viewed-home-story",
        "fresh-agent-story",
      ]);
      expect(payload.items[0]?.matchedSignals).not.toContain(
        "home_exposure_cooldown",
      );
      expect(payload.items[1]?.matchedSignals).not.toContain(
        "home_exposure_cooldown",
      );
      expect(payload.nextRequest.recentExposureItems).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ occurredAt: "not-a-date" }),
          expect.objectContaining({ viewedAt: "also-not-a-date" }),
        ]),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("lifts stories that similar readers engaged with", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "generic-agent-story",
            title: "Generic agent workflow story",
            trendScore: 82,
          }),
          createItem({
            id: "cohort-agent-story",
            title: "Similar readers saved this agent story",
            trendScore: 82,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          collaborativeSignals: [
            {
              category: "agent_product",
              entities: ["OpenAI"],
              newsItemId: "cohort-agent-story",
              score: 6,
              sourceSlug: "agent-desk",
              tags: ["browser agents"],
            },
          ],
          limit: 2,
          objective: "reader_match",
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: [],
            preferredSources: [],
            recencyBias: 1,
          },
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual([
      "cohort-agent-story",
      "generic-agent-story",
    ]);
    expect(payload.items[0]?.matchedSignals).toContain(
      "collaborative_feedback",
    );
    expect(payload.nextRequest.collaborativeSignals).toMatchObject([
      { newsItemId: "cohort-agent-story", score: 6 },
    ]);
  });

  it("normalizes collaborative signal scores before replaying them", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "generic-agent-story",
            title: "Generic agent workflow story",
            trendScore: 82,
          }),
          createItem({
            id: "oversized-cohort-agent-story",
            title: "Oversized cohort signal agent story",
            trendScore: 82,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          collaborativeSignals: [
            {
              category: "agent_product",
              entities: ["OpenAI"],
              newsItemId: "oversized-cohort-agent-story",
              score: 999,
              sourceSlug: "agent-desk",
              tags: ["browser agents"],
            },
          ],
          limit: 2,
          objective: "reader_match",
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: [],
            preferredSources: [],
            recencyBias: 1,
          },
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items[0]?.matchedSignals).toContain(
      "collaborative_feedback",
    );
    expect(payload.nextRequest.collaborativeSignals).toMatchObject([
      { newsItemId: "oversized-cohort-agent-story", score: 6 },
    ]);
  });

  it("derives collaborative signals when the route provides a resolver", async () => {
    const getCollaborativeSignals = vi.fn(
      (_input: { items: readonly NewsHomeItem[] }) =>
        Promise.resolve([
          {
            category: "agent_product",
            entities: ["OpenAI"],
            newsItemId: "crowd-agent-story",
            score: 6,
            sourceSlug: "agent-desk",
            tags: ["browser agents"],
          },
        ]),
    );
    const response = await handleNewsForYouRequest({
      getCollaborativeSignals,
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "generic-agent-story",
            title: "Generic agent workflow story",
            trendScore: 82,
          }),
          createItem({
            id: "crowd-agent-story",
            title: "Crowd-backed browser agent reliability story",
            trendScore: 82,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 2,
          objective: "reader_match",
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: [],
            preferredSources: [],
            recencyBias: 1,
          },
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(getCollaborativeSignals).toHaveBeenCalledOnce();
    const [resolverInput] = getCollaborativeSignals.mock.calls[0] ?? [];
    expect(
      resolverInput?.items.some((item) => item.id === "crowd-agent-story"),
    ).toBe(true);
    expect(payload.items.map((item) => item.id)).toEqual([
      "crowd-agent-story",
      "generic-agent-story",
    ]);
    expect(payload.items[0]?.matchedSignals).toContain(
      "collaborative_feedback",
    );
  });

  it("normalizes resolver collaborative signal scores before replaying them", async () => {
    const getCollaborativeSignals = vi.fn(
      (_input: { items: readonly NewsHomeItem[] }) =>
        Promise.resolve([
          {
            category: "agent_product",
            entities: ["OpenAI"],
            newsItemId: "resolver-cohort-story",
            score: 999,
            sourceSlug: "agent-desk",
            tags: ["browser agents"],
          },
        ]),
    );
    const response = await handleNewsForYouRequest({
      getCollaborativeSignals,
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "generic-agent-story",
            title: "Generic agent workflow story",
            trendScore: 82,
          }),
          createItem({
            id: "resolver-cohort-story",
            title: "Resolver cohort signal agent story",
            trendScore: 82,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 2,
          objective: "reader_match",
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: [],
            preferredSources: [],
            recencyBias: 1,
          },
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items[0]?.matchedSignals).toContain(
      "collaborative_feedback",
    );
    expect(payload.nextRequest.collaborativeSignals).toMatchObject([
      { newsItemId: "resolver-cohort-story", score: 6 },
    ]);
  });

  it("dedupes collaborative signals before replaying them", async () => {
    const getCollaborativeSignals = vi.fn(
      (_input: { items: readonly NewsHomeItem[] }) =>
        Promise.resolve([
          {
            category: "agent_product",
            entities: ["OpenAI"],
            newsItemId: "resolver-cohort-story",
            score: 6,
            sourceSlug: "agent-desk",
            tags: ["browser agents"],
          },
        ]),
    );
    const response = await handleNewsForYouRequest({
      getCollaborativeSignals,
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "generic-agent-story",
            title: "Generic agent workflow story",
            trendScore: 82,
          }),
          createItem({
            id: "resolver-cohort-story",
            title: "Resolver cohort signal agent story",
            trendScore: 82,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          collaborativeSignals: [
            {
              category: "agent_product",
              entities: ["OpenAI"],
              newsItemId: "resolver-cohort-story",
              score: 2,
              sourceSlug: "agent-desk",
              tags: ["browser agents"],
            },
          ],
          limit: 2,
          objective: "reader_match",
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: [],
            preferredSources: [],
            recencyBias: 1,
          },
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items[0]?.matchedSignals).toContain(
      "collaborative_feedback",
    );
    expect(payload.nextRequest.collaborativeSignals).toHaveLength(1);
    expect(payload.nextRequest.collaborativeSignals).toMatchObject([
      { newsItemId: "resolver-cohort-story", score: 6 },
    ]);
  });

  it("ignores resolver collaborative signals with non-finite scores", async () => {
    const getCollaborativeSignals = vi.fn(
      (_input: { items: readonly NewsHomeItem[] }) =>
        Promise.resolve([
          {
            category: "agent_product",
            entities: ["OpenAI"],
            newsItemId: "nan-cohort-story",
            score: Number.NaN,
            sourceSlug: "agent-desk",
            tags: ["browser agents"],
          },
        ]),
    );
    const response = await handleNewsForYouRequest({
      getCollaborativeSignals,
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "valid-agent-story",
            title: "Valid agent workflow story",
            trendScore: 82,
          }),
          createItem({
            id: "nan-cohort-story",
            title: "Non-finite cohort signal agent story",
            trendScore: 81,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 2,
          objective: "reader_match",
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: [],
            preferredSources: [],
            recencyBias: 1,
          },
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual([
      "valid-agent-story",
      "nan-cohort-story",
    ]);
    expect(payload.items[1]?.matchedSignals).not.toContain(
      "collaborative_feedback",
    );
    expect(payload.nextRequest.collaborativeSignals).toEqual([]);
  });

  it("derives similar-reader cohort signals from request memory", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            category: "model_release",
            id: "generic-lab-story",
            sourceName: "Model Desk",
            sourceSlug: "model-desk",
            tags: ["models"],
            title: "Generic model release story",
            trendScore: 82,
          }),
          createItem({
            category: "agent_product",
            entities: ["Workflow AI"],
            id: "builder-cohort-story",
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            tags: ["workflow"],
            title: "Builder cohort agent workflow story",
            trendScore: 82,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 2,
          objective: "reader_match",
          positiveFeedbackItems: [
            {
              action: "save",
              canonicalUrl: null,
              category: "open_source",
              entities: ["LangChain"],
              id: "saved-oss-story",
              occurredAt: "2026-07-06T09:30:00.000Z",
              originalUrl: null,
              sourceName: "OSS Desk",
              sourceSlug: "oss-desk",
              tags: ["developer-tools"],
              title: "Saved open-source builder tool",
            },
          ],
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: [],
            preferredSources: [],
            recencyBias: 1,
          },
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual([
      "builder-cohort-story",
      "generic-lab-story",
    ]);
    expect(payload.items[0]?.matchedSignals).toContain(
      "collaborative_feedback",
    );
    expect(payload.memory.positiveFeedback).toBe(1);
  });

  it("lifts stories that are semantically similar to reader feedback", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "generic-agent-story",
            title: "Generic agent workflow story",
            trendScore: 82,
          }),
          createItem({
            id: "semantic-follow-up",
            title: "Semantic follow-up on browser agent reliability",
            trendScore: 82,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 2,
          objective: "reader_match",
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: [],
            preferredSources: [],
            recencyBias: 1,
          },
          semanticSimilarityMatches: [
            {
              newsItemId: "semantic-follow-up",
              similarity: 0.92,
              strength: 2,
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual([
      "semantic-follow-up",
      "generic-agent-story",
    ]);
    expect(payload.items[0]?.matchedSignals).toContain("semantic_feedback");
    expect(payload.nextRequest.semanticSimilarityMatches).toMatchObject([
      { newsItemId: "semantic-follow-up", similarity: 0.92 },
    ]);
  });

  it("deduplicates semantic similarity matches before replaying the next For You request", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "generic-agent-story",
            title: "Generic agent workflow story",
            trendScore: 82,
          }),
          createItem({
            id: "semantic-follow-up",
            title: "Semantic follow-up on browser agent reliability",
            trendScore: 82,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 2,
          objective: "reader_match",
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: [],
            preferredSources: [],
            recencyBias: 1,
          },
          semanticSimilarityMatches: [
            {
              newsItemId: "semantic-follow-up",
              occurredAt: "2026-07-06T09:00:00.000Z",
              similarity: 0.84,
              strength: 1,
            },
            {
              newsItemId: "semantic-follow-up",
              occurredAt: "2026-07-06T09:30:00.000Z",
              similarity: 0.92,
              strength: 3,
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.nextRequest.semanticSimilarityMatches).toEqual([
      {
        newsItemId: "semantic-follow-up",
        occurredAt: "2026-07-06T09:30:00.000Z",
        similarity: 0.92,
        strength: 3,
      },
    ]);
  });

  it("ignores future-dated semantic similarity matches before boosting or replaying them", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T10:00:00.000Z"));

    try {
      const response = await handleNewsForYouRequest({
        getItems: () =>
          Promise.resolve([
            createItem({
              id: "current-generic-agent-story",
              title: "Current generic agent workflow story",
              trendScore: 80,
            }),
            createItem({
              id: "future-semantic-follow-up",
              title: "Future semantic follow-up on browser agent reliability",
              trendScore: 79,
            }),
          ]),
        request: new Request("https://thenewagenttimes.test/api/news/for-you", {
          body: JSON.stringify({
            limit: 2,
            objective: "reader_match",
            profile: {
              noveltyBias: 1,
              preferredCategories: [],
              preferredEntities: [],
              preferredSources: [],
              recencyBias: 1,
            },
            semanticSimilarityMatches: [
              {
                newsItemId: "future-semantic-follow-up",
                occurredAt: "2026-07-07T10:00:00.000Z",
                similarity: 0.92,
                strength: 2,
              },
            ],
          }),
          method: "POST",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as NewsForYouTestResponse;

      expect(payload.items.map((item) => item.id)).toEqual([
        "current-generic-agent-story",
        "future-semantic-follow-up",
      ]);
      expect(payload.items[1]?.matchedSignals).not.toContain(
        "semantic_feedback",
      );
      expect(payload.nextRequest.semanticSimilarityMatches).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores stale semantic similarity matches before boosting or replaying them", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T10:00:00.000Z"));

    try {
      const response = await handleNewsForYouRequest({
        getItems: () =>
          Promise.resolve([
            createItem({
              id: "current-agent-story",
              title: "Current agent workflow story",
              trendScore: 80,
            }),
            createItem({
              id: "stale-semantic-follow-up",
              title: "Stale semantic follow-up on browser agent reliability",
              trendScore: 79,
            }),
          ]),
        request: new Request("https://thenewagenttimes.test/api/news/for-you", {
          body: JSON.stringify({
            limit: 2,
            objective: "reader_match",
            profile: {
              noveltyBias: 1,
              preferredCategories: [],
              preferredEntities: [],
              preferredSources: [],
              recencyBias: 1,
            },
            semanticSimilarityMatches: [
              {
                newsItemId: "stale-semantic-follow-up",
                occurredAt: "2026-06-01T10:00:00.000Z",
                similarity: 0.92,
                strength: 2,
              },
            ],
          }),
          method: "POST",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as NewsForYouTestResponse;

      expect(payload.items.map((item) => item.id)).toEqual([
        "current-agent-story",
        "stale-semantic-follow-up",
      ]);
      expect(payload.items[1]?.matchedSignals).not.toContain(
        "semantic_feedback",
      );
      expect(payload.nextRequest.semanticSimilarityMatches).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores out-of-range semantic similarity matches before boosting or replaying them", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "valid-generic-agent-story",
            title: "Valid generic agent workflow story",
            trendScore: 80,
          }),
          createItem({
            id: "invalid-semantic-follow-up",
            title: "Invalid semantic follow-up on browser agent reliability",
            trendScore: 79,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 2,
          objective: "reader_match",
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: [],
            preferredSources: [],
            recencyBias: 1,
          },
          semanticSimilarityMatches: [
            {
              newsItemId: "invalid-semantic-follow-up",
              similarity: 99,
              strength: 3,
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual([
      "valid-generic-agent-story",
      "invalid-semantic-follow-up",
    ]);
    expect(payload.items[1]?.matchedSignals).not.toContain("semantic_feedback");
    expect(payload.nextRequest.semanticSimilarityMatches).toEqual([]);
  });

  it("ignores semantic similarity matches with invalid occurredAt before boosting or replaying them", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "valid-timestamp-generic-story",
            title: "Valid timestamp generic agent story",
            trendScore: 80,
          }),
          createItem({
            id: "invalid-timestamp-semantic-follow-up",
            title: "Invalid timestamp semantic follow-up",
            trendScore: 79,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 2,
          objective: "reader_match",
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: [],
            preferredSources: [],
            recencyBias: 1,
          },
          semanticSimilarityMatches: [
            {
              newsItemId: "invalid-timestamp-semantic-follow-up",
              occurredAt: "not-a-date",
              similarity: 0.92,
              strength: 3,
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual([
      "valid-timestamp-generic-story",
      "invalid-timestamp-semantic-follow-up",
    ]);
    expect(payload.items[1]?.matchedSignals).not.toContain("semantic_feedback");
    expect(payload.nextRequest.semanticSimilarityMatches).toEqual([]);
  });

  it("normalizes semantic similarity strength before replaying it", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "generic-agent-story",
            title: "Generic agent workflow story",
            trendScore: 82,
          }),
          createItem({
            id: "semantic-follow-up",
            title: "Semantic follow-up on browser agent reliability",
            trendScore: 82,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 2,
          objective: "reader_match",
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: [],
            preferredSources: [],
            recencyBias: 1,
          },
          semanticSimilarityMatches: [
            {
              newsItemId: "semantic-follow-up",
              similarity: 0.92,
              strength: 99,
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items[0]?.matchedSignals).toContain("semantic_feedback");
    expect(payload.nextRequest.semanticSimilarityMatches).toMatchObject([
      {
        newsItemId: "semantic-follow-up",
        similarity: 0.92,
        strength: 3,
      },
    ]);
  });

  it("derives semantic similarity matches when the route provides a resolver", async () => {
    const getSemanticSimilarityMatches = vi.fn(
      (_input: {
        items: readonly NewsHomeItem[];
        positiveFeedbackItems: readonly { newsItemId: string }[];
      }) =>
        Promise.resolve([
          {
            newsItemId: "semantic-follow-up",
            similarity: 0.92,
            strength: 2,
          },
        ]),
    );
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "generic-agent-story",
            title: "Generic agent workflow story",
            trendScore: 82,
          }),
          createItem({
            id: "semantic-follow-up",
            title: "Semantic follow-up on browser agent reliability",
            trendScore: 82,
          }),
        ]),
      getSemanticSimilarityMatches,
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 2,
          objective: "reader_match",
          positiveFeedbackItems: [
            {
              action: "save",
              canonicalUrl: "https://thenewagenttimes.test/policy-feedback",
              category: "policy",
              entities: ["Regulators"],
              id: "policy-feedback",
              newsItemId: "policy-feedback",
              occurredAt: "2026-07-06T09:30:00.000Z",
              originalUrl: null,
              sourceName: "Policy Desk",
              sourceSlug: "policy-desk",
              tags: ["audits"],
              title: "Saved policy story",
            },
          ],
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: [],
            preferredSources: [],
            recencyBias: 1,
          },
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(getSemanticSimilarityMatches).toHaveBeenCalledOnce();
    const [resolverInput] = getSemanticSimilarityMatches.mock.calls[0] ?? [];
    expect(
      resolverInput?.items.some((item) => item.id === "semantic-follow-up"),
    ).toBe(true);
    expect(
      resolverInput?.positiveFeedbackItems.some(
        (item) => item.newsItemId === "policy-feedback",
      ),
    ).toBe(true);
    expect(payload.items.map((item) => item.id)).toEqual([
      "semantic-follow-up",
      "generic-agent-story",
    ]);
    expect(payload.items[0]?.matchedSignals).toContain("semantic_feedback");
    expect(payload.nextRequest.semanticSimilarityMatches).toMatchObject([
      { newsItemId: "semantic-follow-up", similarity: 0.92 },
    ]);
  });

  it("dedupes resolver semantic matches before replaying them", async () => {
    const getSemanticSimilarityMatches = vi.fn(
      (_input: {
        items: readonly NewsHomeItem[];
        positiveFeedbackItems: readonly { newsItemId: string }[];
      }) =>
        Promise.resolve([
          {
            newsItemId: "semantic-follow-up",
            occurredAt: "2026-07-06T10:00:00.000Z",
            similarity: 0.95,
            strength: 3,
          },
        ]),
    );
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "generic-agent-story",
            title: "Generic agent workflow story",
            trendScore: 82,
          }),
          createItem({
            id: "semantic-follow-up",
            title: "Semantic follow-up on browser agent reliability",
            trendScore: 82,
          }),
        ]),
      getSemanticSimilarityMatches,
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 2,
          objective: "reader_match",
          positiveFeedbackItems: [
            {
              action: "save",
              canonicalUrl: "https://thenewagenttimes.test/policy-feedback",
              category: "policy",
              entities: ["Regulators"],
              id: "policy-feedback",
              newsItemId: "policy-feedback",
              occurredAt: "2026-07-06T09:30:00.000Z",
              originalUrl: null,
              sourceName: "Policy Desk",
              sourceSlug: "policy-desk",
              tags: ["audits"],
              title: "Saved policy story",
            },
          ],
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: [],
            preferredSources: [],
            recencyBias: 1,
          },
          semanticSimilarityMatches: [
            {
              newsItemId: "semantic-follow-up",
              occurredAt: "2026-07-06T09:00:00.000Z",
              similarity: 0.82,
              strength: 1,
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items[0]?.matchedSignals).toContain("semantic_feedback");
    expect(payload.nextRequest.semanticSimilarityMatches).toEqual([
      {
        newsItemId: "semantic-follow-up",
        occurredAt: "2026-07-06T10:00:00.000Z",
        similarity: 0.95,
        strength: 3,
      },
    ]);
  });

  it("ignores resolver semantic matches with out-of-range similarity before replaying them", async () => {
    const getSemanticSimilarityMatches = vi.fn(
      (_input: {
        items: readonly NewsHomeItem[];
        positiveFeedbackItems: readonly { newsItemId: string }[];
      }) =>
        Promise.resolve([
          {
            newsItemId: "invalid-resolver-semantic-follow-up",
            similarity: 99,
            strength: 3,
          },
        ]),
    );
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "valid-resolver-generic-story",
            title: "Valid resolver generic agent story",
            trendScore: 80,
          }),
          createItem({
            id: "invalid-resolver-semantic-follow-up",
            title: "Invalid resolver semantic follow-up",
            trendScore: 79,
          }),
        ]),
      getSemanticSimilarityMatches,
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 2,
          objective: "reader_match",
          positiveFeedbackItems: [
            {
              action: "save",
              canonicalUrl: "https://thenewagenttimes.test/policy-feedback",
              category: "policy",
              entities: ["Regulators"],
              id: "policy-feedback",
              newsItemId: "policy-feedback",
              occurredAt: "2026-07-06T09:30:00.000Z",
              originalUrl: null,
              sourceName: "Policy Desk",
              sourceSlug: "policy-desk",
              tags: ["audits"],
              title: "Saved policy story",
            },
          ],
          profile: {
            noveltyBias: 1,
            preferredCategories: [],
            preferredEntities: [],
            preferredSources: [],
            recencyBias: 1,
          },
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual([
      "valid-resolver-generic-story",
      "invalid-resolver-semantic-follow-up",
    ]);
    expect(payload.items[1]?.matchedSignals).not.toContain("semantic_feedback");
    expect(payload.nextRequest.semanticSimilarityMatches).toEqual([]);
  });

  it("ignores future-dated resolver semantic matches before boosting or replaying them", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T10:00:00.000Z"));

    try {
      const getSemanticSimilarityMatches = vi.fn(
        (_input: {
          items: readonly NewsHomeItem[];
          positiveFeedbackItems: readonly { newsItemId: string }[];
        }) =>
          Promise.resolve([
            {
              newsItemId: "future-resolver-semantic-follow-up",
              occurredAt: "2026-07-07T10:00:00.000Z",
              similarity: 0.92,
              strength: 3,
            },
          ]),
      );
      const response = await handleNewsForYouRequest({
        getItems: () =>
          Promise.resolve([
            createItem({
              id: "valid-resolver-current-story",
              title: "Valid resolver current agent story",
              trendScore: 80,
            }),
            createItem({
              id: "future-resolver-semantic-follow-up",
              title: "Future resolver semantic follow-up",
              trendScore: 79,
            }),
          ]),
        getSemanticSimilarityMatches,
        request: new Request("https://thenewagenttimes.test/api/news/for-you", {
          body: JSON.stringify({
            limit: 2,
            objective: "reader_match",
            positiveFeedbackItems: [
              {
                action: "save",
                canonicalUrl: "https://thenewagenttimes.test/policy-feedback",
                category: "policy",
                entities: ["Regulators"],
                id: "policy-feedback",
                newsItemId: "policy-feedback",
                occurredAt: "2026-07-06T09:30:00.000Z",
                originalUrl: null,
                sourceName: "Policy Desk",
                sourceSlug: "policy-desk",
                tags: ["audits"],
                title: "Saved policy story",
              },
            ],
            profile: {
              noveltyBias: 1,
              preferredCategories: [],
              preferredEntities: [],
              preferredSources: [],
              recencyBias: 1,
            },
          }),
          method: "POST",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as NewsForYouTestResponse;

      expect(payload.items.map((item) => item.id)).toEqual([
        "valid-resolver-current-story",
        "future-resolver-semantic-follow-up",
      ]);
      expect(payload.items[1]?.matchedSignals).not.toContain(
        "semantic_feedback",
      );
      expect(payload.nextRequest.semanticSimilarityMatches).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps local For You ranking available when auxiliary signal resolvers fail", async () => {
    const getCollaborativeSignals = vi.fn(() =>
      Promise.reject(new Error("collaborative warehouse unavailable")),
    );
    const getSemanticSimilarityMatches = vi.fn(() =>
      Promise.reject(new Error("vector index unavailable")),
    );

    const response = await handleNewsForYouRequest({
      getCollaborativeSignals,
      getItems: () =>
        Promise.resolve([
          createItem({
            category: "model_release",
            id: "model-follow-up",
            sourceName: "Model Desk",
            sourceSlug: "model-desk",
            tags: ["models"],
            title: "Follow-up model launch analysis",
            trendScore: 70,
          }),
          createItem({
            id: "agent-browser",
            title: "Browser agents become the workflow lead",
            trendScore: 92,
          }),
        ]),
      getSemanticSimilarityMatches,
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          objective: "reader_match",
          positiveFeedbackItems: [
            {
              action: "save",
              canonicalUrl: null,
              category: "model_release",
              entities: ["Frontier Model"],
              id: "saved-model-story",
              newsItemId: "saved-model-story",
              occurredAt: "2026-07-06T09:30:00.000Z",
              originalUrl: null,
              sourceName: "Model Desk",
              sourceSlug: "model-desk",
              tags: ["models"],
              title: "Saved model story",
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(getCollaborativeSignals).toHaveBeenCalledOnce();
    expect(getSemanticSimilarityMatches).toHaveBeenCalledOnce();
    expect(payload.items.map((item) => item.id)).toEqual(["model-follow-up"]);
    expect(payload.items[0]?.matchedSignals).toContain("positive_feedback");
    expect(payload.degradedSignals).toEqual([
      "semantic_similarity",
      "collaborative_signals",
    ]);
    expect(payload.nextRequest.collaborativeSignals).toEqual([]);
    expect(payload.nextRequest.semanticSimilarityMatches).toEqual([]);
  });

  it("anchors For You around positive reader feedback", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "agent-browser",
            title: "Browser agents become the workflow lead",
            trendScore: 92,
          }),
          createItem({
            category: "model_release",
            canonicalUrl: "https://thenewagenttimes.test/model-launch",
            entities: ["Frontier Model"],
            id: "model-launch",
            sourceName: "Model Desk",
            sourceSlug: "model-desk",
            tags: ["models"],
            title: "Frontier model release shifts eval policy",
            trendScore: 70,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          objective: "reader_match",
          positiveFeedbackItems: [
            {
              action: "save",
              canonicalUrl: null,
              category: "model_release",
              entities: ["Frontier Model"],
              id: "saved-model-story",
              occurredAt: "2026-07-06T09:30:00.000Z",
              originalUrl: null,
              sourceName: "Model Desk",
              sourceSlug: "model-desk",
              tags: ["models"],
              title: "Saved model story",
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items[0]?.id).toBe("model-launch");
    expect(payload.items[0]?.matchedSignals).toContain("positive_feedback");
    expect(payload.items[0]?.recommendation.badges).toContain(
      "Saved follow-up",
    );
    expect(payload.memory.positiveFeedback).toBe(1);
  });

  it("deduplicates repeated positive feedback before carrying it into the next request", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () => Promise.resolve(items),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          objective: "reader_match",
          positiveFeedbackItems: [
            {
              action: "save",
              canonicalUrl: "https://thenewagenttimes.test/model-launch",
              category: "model_release",
              entities: ["Frontier Model"],
              id: "saved-model-story",
              newsItemId: "saved-model-story",
              occurredAt: "2026-07-06T09:30:00.000Z",
              originalUrl: "https://thenewagenttimes.test/model-launch?utm=save",
              sourceName: "Model Desk",
              sourceSlug: "model-desk",
              tags: ["models"],
              title: "Saved model story",
            },
            {
              action: "share",
              canonicalUrl: "https://thenewagenttimes.test/model-launch",
              category: "model_release",
              entities: ["Frontier Model"],
              id: "shared-model-story",
              newsItemId: "saved-model-story",
              occurredAt: "2026-07-06T09:45:00.000Z",
              originalUrl: "https://thenewagenttimes.test/model-launch?utm=share",
              sourceName: "Model Desk",
              sourceSlug: "model-desk",
              tags: ["models"],
              title: "Shared model story",
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.memory.positiveFeedback).toBe(1);
    expect(payload.nextRequest.positiveFeedbackItems).toHaveLength(1);
    expect(payload.nextRequest.positiveFeedbackItems?.[0]).toMatchObject({
      action: "share",
      id: "shared-model-story",
      occurredAt: "2026-07-06T09:45:00.000Z",
    });
  });

  it("ignores future-dated positive feedback before anchoring recommendations", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));

    try {
      const response = await handleNewsForYouRequest({
        getItems: () =>
          Promise.resolve([
            createItem({
              id: "agent-browser",
              title: "Browser agents become the workflow lead",
              trendScore: 92,
            }),
            createItem({
              category: "model_release",
              canonicalUrl: "https://thenewagenttimes.test/model-launch",
              entities: ["Frontier Model"],
              id: "model-launch",
              sourceName: "Model Desk",
              sourceSlug: "model-desk",
              tags: ["models"],
              title: "Frontier model release shifts eval policy",
              trendScore: 70,
            }),
          ]),
        request: new Request("https://thenewagenttimes.test/api/news/for-you", {
          body: JSON.stringify({
            limit: 1,
            objective: "reader_match",
            positiveFeedbackItems: [
              {
                action: "save",
                canonicalUrl: null,
                category: "model_release",
                entities: ["Frontier Model"],
                id: "saved-model-story",
                occurredAt: "2026-08-01T09:30:00.000Z",
                originalUrl: null,
                sourceName: "Model Desk",
                sourceSlug: "model-desk",
                tags: ["models"],
                title: "Saved model story",
              },
            ],
          }),
          method: "POST",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as NewsForYouTestResponse;

      expect(payload.items[0]?.id).toBe("agent-browser");
      expect(payload.items[0]?.matchedSignals).not.toContain(
        "positive_feedback",
      );
      expect(payload.memory.positiveFeedback).toBe(0);
      expect(payload.nextRequest.positiveFeedbackItems).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores positive feedback with invalid occurredAt before anchoring recommendations", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "agent-browser",
            title: "Browser agents become the workflow lead",
            trendScore: 92,
          }),
          createItem({
            category: "model_release",
            canonicalUrl: "https://thenewagenttimes.test/model-launch",
            entities: ["Frontier Model"],
            id: "model-launch",
            sourceName: "Model Desk",
            sourceSlug: "model-desk",
            tags: ["models"],
            title: "Frontier model release shifts eval policy",
            trendScore: 70,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          objective: "reader_match",
          positiveFeedbackItems: [
            {
              action: "save",
              canonicalUrl: null,
              category: "model_release",
              entities: ["Frontier Model"],
              id: "saved-model-story",
              occurredAt: "not-a-date",
              originalUrl: null,
              sourceName: "Model Desk",
              sourceSlug: "model-desk",
              tags: ["models"],
              title: "Saved model story",
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items[0]?.id).toBe("agent-browser");
    expect(payload.items[0]?.matchedSignals).not.toContain("positive_feedback");
    expect(payload.memory.positiveFeedback).toBe(0);
    expect(payload.nextRequest.positiveFeedbackItems).toEqual([]);
  });

  it("does not recommend the exact story used as positive feedback", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            category: "model_release",
            canonicalUrl: "https://thenewagenttimes.test/saved-model-story",
            entities: ["Frontier Model"],
            id: "saved-model-story",
            sourceName: "Model Desk",
            sourceSlug: "model-desk",
            tags: ["models"],
            title: "Already saved model story",
            trendScore: 99,
          }),
          createItem({
            category: "agent_product",
            canonicalUrl: "https://thenewagenttimes.test/fresh-agent-story",
            entities: ["OpenAI"],
            id: "fresh-agent-story",
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            tags: ["browser agents"],
            title: "Fresh agent workflow story",
            trendScore: 70,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          objective: "reader_match",
          positiveFeedbackItems: [
            {
              action: "save",
              canonicalUrl: "https://thenewagenttimes.test/saved-model-story",
              category: "model_release",
              entities: ["Frontier Model"],
              id: "saved-model-story",
              newsItemId: "saved-model-story",
              occurredAt: "2026-07-06T09:30:00.000Z",
              originalUrl: null,
              sourceName: "Model Desk",
              sourceSlug: "model-desk",
              tags: ["models"],
              title: "Already saved model story",
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual(["fresh-agent-story"]);
    expect(payload.items[0]?.matchedSignals).not.toContain("positive_feedback");
    expect(payload.nextRequest.positiveFeedbackItems).toEqual([
      expect.objectContaining({
        id: "saved-model-story",
        newsItemId: "saved-model-story",
      }),
    ]);
  });

  it("ignores stale source-click feedback before exact candidate exclusion", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));

    try {
      const response = await handleNewsForYouRequest({
        getItems: () =>
          Promise.resolve([
            createItem({
              canonicalUrl: "https://example.com/news/agent-browser#variant",
              id: "agent-browser",
              originalUrl: "https://example.com/news/agent-browser?utm=next",
              title: "Browser agents become the workflow lead",
              trendScore: 92,
            }),
            createItem({
              id: "fresh-agent-story",
              title: "Fresh agent workflow story",
              trendScore: 72,
            }),
          ]),
        request: new Request("https://thenewagenttimes.test/api/news/for-you", {
          body: JSON.stringify({
            limit: 2,
            objective: "reader_match",
            positiveFeedbackItems: [
              {
                action: "click_source",
                canonicalUrl: "https://example.com/news/agent-browser",
                category: "agent_product",
                entities: ["OpenAI"],
                id: "agent-browser",
                newsItemId: "agent-browser",
                occurredAt: "2026-06-01T09:30:00.000Z",
                originalUrl:
                  "https://example.com/news/agent-browser?utm=source",
                sourceName: "Agent Desk",
                sourceSlug: "agent-desk",
                tags: ["browser agents"],
                title: "Browser agents become the workflow lead",
              },
            ],
            profile: {
              noveltyBias: 1,
              preferredCategories: [],
              preferredEntities: [],
              preferredSources: [],
              recencyBias: 1,
            },
          }),
          method: "POST",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as NewsForYouTestResponse;

      expect(payload.items.map((item) => item.id)).toEqual([
        "agent-browser",
        "fresh-agent-story",
      ]);
      expect(payload.memory.positiveFeedback).toBe(0);
      expect(payload.nextRequest.positiveFeedbackItems).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps actionless deep-read feedback as a read follow-up signal", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "agent-browser",
            title: "Browser agents become the workflow lead",
            trendScore: 92,
          }),
          createItem({
            category: "model_release",
            canonicalUrl: "https://thenewagenttimes.test/model-launch",
            entities: ["Frontier Model"],
            id: "model-launch",
            sourceName: "Model Desk",
            sourceSlug: "model-desk",
            tags: ["models"],
            title: "Frontier model release shifts eval policy",
            trendScore: 70,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          objective: "reader_match",
          positiveFeedbackItems: [
            {
              canonicalUrl: null,
              category: "model_release",
              entities: ["Frontier Model"],
              id: "deep-read-model-story",
              occurredAt: "2026-07-06T09:30:00.000Z",
              originalUrl: null,
              sourceName: "Model Desk",
              sourceSlug: "model-desk",
              tags: ["models"],
              title: "Deep read model story",
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items[0]?.id).toBe("model-launch");
    expect(payload.items[0]?.matchedSignals).toContain("positive_feedback");
    expect(payload.items[0]?.matchedSignals).toContain(
      "positive_read_feedback",
    );
    expect(payload.items[0]?.recommendation.badges).toContain("Read follow-up");
    expect(payload.memory.positiveFeedback).toBe(1);
    expect(payload.nextRequest.positiveFeedbackItems).toEqual([
      expect.objectContaining({
        id: "deep-read-model-story",
      }),
    ]);
  });

  it("ignores positive feedback records with invalid actions", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "agent-browser",
            title: "Browser agents become the workflow lead",
            trendScore: 92,
          }),
          createItem({
            category: "model_release",
            canonicalUrl: "https://thenewagenttimes.test/model-launch",
            entities: ["Frontier Model"],
            id: "model-launch",
            sourceName: "Model Desk",
            sourceSlug: "model-desk",
            tags: ["models"],
            title: "Frontier model release shifts eval policy",
            trendScore: 70,
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          objective: "reader_match",
          positiveFeedbackItems: [
            {
              action: "hide",
              canonicalUrl: null,
              category: "model_release",
              entities: ["Frontier Model"],
              id: "invalid-action-model-story",
              occurredAt: "2026-07-06T09:30:00.000Z",
              originalUrl: null,
              sourceName: "Model Desk",
              sourceSlug: "model-desk",
              tags: ["models"],
              title: "Invalid action model story",
            },
            {
              action: 42,
              canonicalUrl: null,
              category: "model_release",
              entities: ["Frontier Model"],
              id: "invalid-numeric-action-model-story",
              occurredAt: "2026-07-06T09:31:00.000Z",
              originalUrl: null,
              sourceName: "Model Desk",
              sourceSlug: "model-desk",
              tags: ["models"],
              title: "Invalid numeric action model story",
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items[0]?.id).toBe("agent-browser");
    expect(payload.items[0]?.matchedSignals).not.toContain("positive_feedback");
    expect(payload.memory.positiveFeedback).toBe(0);
    expect(payload.nextRequest.positiveFeedbackItems).toEqual([]);
  });

  it("returns a replayable next request with profile and reader memory", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () => Promise.resolve(items),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          negativeFeedbackItems: [
            {
              canonicalUrl: null,
              category: "funding",
              entities: ["GPU Cloud"],
              hiddenAt: "2026-07-06T09:20:00.000Z",
              id: "gpu-funding",
              originalUrl: null,
              sourceName: "Capital Desk",
              sourceSlug: "capital-desk",
              tags: ["infrastructure"],
              title: "GPU funding follows inference demand",
            },
          ],
          objective: "reader_match",
          positiveFeedbackItems: [
            {
              action: "save",
              canonicalUrl: null,
              category: "model_release",
              entities: ["Frontier Model"],
              id: "saved-model-story",
              occurredAt: "2026-07-06T09:30:00.000Z",
              originalUrl: null,
              sourceName: "Model Desk",
              sourceSlug: "model-desk",
              tags: ["models"],
              title: "Saved model story",
            },
          ],
          profile: {
            noveltyBias: 1.1,
            preferredCategories: ["model_release"],
            preferredEntities: ["Frontier Model"],
            preferredSources: ["model-desk"],
            recencyBias: 1.2,
          },
          searchMemoryItems: [
            {
              query: "deployment evidence",
              resultCount: 1,
              searchedAt: "2026-07-06T10:00:00.000Z",
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.nextRequest).toMatchObject({
      limit: 1,
      negativeFeedbackItems: [{ id: "gpu-funding" }],
      objective: "reader_match",
      positiveFeedbackItems: [{ action: "save", id: "saved-model-story" }],
      profile: {
        preferredCategories: ["model_release"],
        preferredEntities: ["Frontier Model"],
        preferredSources: ["model-desk"],
      },
      searchMemoryItems: [{ query: "deployment evidence" }],
    });
  });

  it("applies active search and channel filters before personalized ranking", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () => Promise.resolve(items),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          category: "policy",
          limit: 2,
          objective: "reader_match",
          q: "deployment evidence",
          sourceSlug: "policy-desk",
          tag: "audits",
          profile: {
            noveltyBias: 1.1,
            preferredCategories: ["agent_product"],
            preferredEntities: ["OpenAI"],
            preferredSources: ["agent-desk"],
            recencyBias: 1.2,
          },
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual(["policy-audit"]);
    expect(payload.nextRequest).toMatchObject({
      category: "policy",
      q: "deployment evidence",
      sourceSlug: "policy-desk",
      tag: "audits",
    });
    expect(payload.returnedCount).toBe(1);
  });

  it("filters readable angle tags against normalized story tags", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () =>
        Promise.resolve([
          createItem({
            id: "browser-agent-angle",
            tags: ["browser-agents"],
            title: "Browser agents become the workflow lead",
          }),
          createItem({
            id: "model-angle",
            tags: ["models"],
            title: "Frontier model release shifts eval policy",
          }),
        ]),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 2,
          tag: "browser agents",
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual([
      "browser-agent-angle",
    ]);
    expect(payload.nextRequest).toMatchObject({
      tag: "browser agents",
    });
    expect(payload.returnedCount).toBe(1);
  });

  it("filters the full candidate pool before taking the initial recommendation window", async () => {
    const broadPoolItems = [
      ...Array.from({ length: 200 }, (_, index) =>
        createItem({
          id: `filler-${index}`,
          summary: "General agent workflow update",
          title: `General agent workflow update ${index}`,
          trendScore: 95 - (index % 10),
        }),
      ),
      createItem({
        category: "policy",
        entities: ["Regulators"],
        id: "late-policy-needle",
        sourceName: "Policy Desk",
        sourceSlug: "policy-desk",
        summary: "Deployment evidence appears after the broad top window",
        tags: ["audits"],
        title: "Late policy teams ask for deployment evidence",
        trendScore: 20,
      }),
    ];
    const response = await handleNewsForYouRequest({
      getItems: () => Promise.resolve(broadPoolItems),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          q: "deployment evidence",
          sourceSlug: "policy-desk",
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual([
      "late-policy-needle",
    ]);
  });

  it("uses search memory to recall matching stories before taking the initial recommendation window", async () => {
    const broadPoolItems = [
      ...Array.from({ length: 200 }, (_, index) =>
        createItem({
          id: `filler-${index}`,
          summary: "General agent workflow update",
          title: `General agent workflow update ${index}`,
          trendScore: 95 - (index % 10),
        }),
      ),
      createItem({
        category: "policy",
        entities: ["Regulators"],
        id: "late-search-memory-needle",
        sourceName: "Policy Desk",
        sourceSlug: "policy-desk",
        summary: "Deployment evidence appears after the broad top window",
        tags: ["audits"],
        title: "Late policy teams ask for deployment evidence",
        trendScore: 20,
      }),
    ];
    const response = await handleNewsForYouRequest({
      getItems: () => Promise.resolve(broadPoolItems),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 1,
          searchMemoryItems: [
            {
              query: "deployment evidence",
              resultCount: 1,
              searchedAt: "2026-07-06T10:00:00.000Z",
            },
          ],
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as NewsForYouTestResponse;

    expect(payload.items.map((item) => item.id)).toEqual([
      "late-search-memory-needle",
    ]);
    expect(payload.items[0]?.matchedSignals).toContain("session_intent");
    expect(payload.context?.filters.q).toBeNull();
    expect(payload.nextRequest.q).toBeUndefined();
  });

  it("falls back to a default profile and clamps invalid limits", async () => {
    const response = await handleNewsForYouRequest({
      getItems: () => Promise.resolve(items),
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: JSON.stringify({
          limit: 999,
          profile: {
            noveltyBias: "high",
            preferredCategories: "agent_product",
          },
        }),
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      limit: 30,
      ok: true,
      profile: {
        preferredCategories: ["model_release", "agent_product", "funding"],
      },
    });
  });

  it("returns a useful 400 when request JSON is malformed", async () => {
    const getItems = vi.fn(() => Promise.resolve(items));
    const response = await handleNewsForYouRequest({
      getItems,
      request: new Request("https://thenewagenttimes.test/api/news/for-you", {
        body: "{",
        method: "POST",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON request body",
      ok: false,
    });
    expect(getItems).not.toHaveBeenCalled();
  });

  it("wires the route to the handler", async () => {
    const routeSource = await readFile(
      new URL("./route.ts", import.meta.url),
      "utf8",
    );

    expect(routeSource).toContain("handleNewsForYouRequest");
    expect(routeSource).toContain("getNewsCollaborativeSignals");
    expect(routeSource).toContain("getCollaborativeSignals:");
    expect(routeSource).toContain("getNewsHomeData");
    expect(routeSource).toContain("getNewsSemanticSimilarityMatches");
    expect(routeSource).toContain("getSemanticSimilarityMatches:");
    expect(routeSource).toContain("export async function POST");
  });
});
