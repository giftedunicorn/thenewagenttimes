import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import type {
  NewsHomeItem,
  NewsPositiveFeedbackMemoryItem,
  NewsReaderMemoryItem,
} from "./news-home-model";
import { selectNewsEditionStoryActionState } from "./news-edition-story-actions";

const story: NewsHomeItem = {
  canonicalUrl: "https://www.example.com/news/model-router#edition",
  category: "market_map",
  clusterKey: "model-router",
  entities: ["Model Routers"],
  id: "edition-model-router",
  imageUrl: null,
  originalUrl: "https://source.example/model-router?utm=edition",
  publishedAt: "2026-07-06T08:35:00.000Z",
  sourceName: "Market Map Desk",
  sourceScore: 84,
  sourceSlug: "market-map-desk",
  sourceType: "rss",
  summary: "Model routers steer inference between providers.",
  tags: ["routing"],
  title: "Model routers become the agent stack switchboard",
  trendScore: 89,
};

describe("selectNewsEditionStoryActionState", () => {
  it("detects saved and guardrail state from URL variants", () => {
    const savedVariant: NewsReaderMemoryItem = {
      canonicalUrl: "https://example.com/news/model-router",
      category: "market_map",
      entities: ["Model Routers"],
      id: "saved-router-variant",
      originalUrl: "https://source.example/model-router",
      savedAt: "2026-07-06T09:00:00.000Z",
      sourceName: "Market Map Desk",
      sourceSlug: "market-map-desk",
      tags: ["routing"],
      title: "Saved model router variant",
    };
    const guardrailVariant: NewsReaderMemoryItem = {
      canonicalUrl: null,
      category: "market_map",
      entities: ["Model Routers"],
      hiddenAt: "2026-07-06T09:10:00.000Z",
      id: "guardrail-router-variant",
      originalUrl: "https://source.example/model-router?ref=memory",
      sourceName: "Market Map Desk",
      sourceSlug: "market-map-desk",
      tags: ["routing"],
      title: "Guardrail model router variant",
    };

    expect(
      selectNewsEditionStoryActionState({
        guardrailItems: [guardrailVariant],
        item: story,
        savedItems: [savedVariant],
      }),
    ).toEqual({
      isGuardrailed: true,
      isSaved: true,
    });
  });

  it("hydrates edition story buttons through URL-aware reader memory state", async () => {
    const source = await readFile(
      new URL("./news-edition-story-actions.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("selectNewsEditionStoryActionState({");
    expect(source).toMatch(
      /savedItems: readStoredNewsReaderMemoryItems\(newsSavedStorageKey\)/,
    );
    expect(source).toMatch(
      /guardrailItems: readStoredNewsReaderMemoryItems\([\s\S]*?newsGuardrailStorageKey,[\s\S]*?\)/,
    );
    expect(source).toContain("setIsSaved(actionState.isSaved)");
    expect(source).toContain("setIsGuardrailed(actionState.isGuardrailed)");
  });
});

describe("getNewsEditionStoryHistoryStorageUpdate", () => {
  it("adds edition reads to shared history memory before article navigation", async () => {
    const actionsModule = await import("./news-edition-story-actions");
    const getHistoryUpdate = (
      actionsModule as {
        getNewsEditionStoryHistoryStorageUpdate?: (input: {
          item: NewsHomeItem;
          occurredAt: string;
          storedItems: readonly NewsReaderMemoryItem[];
        }) => NewsReaderMemoryItem[];
      }
    ).getNewsEditionStoryHistoryStorageUpdate;

    expect(getHistoryUpdate).toEqual(expect.any(Function));
    if (!getHistoryUpdate) return;

    expect(
      getHistoryUpdate({
        item: story,
        occurredAt: "2026-07-06T10:30:00.000Z",
        storedItems: [
          {
            ...story,
            viewedAt: "2026-07-06T09:00:00.000Z",
          },
          {
            canonicalUrl: "https://example.com/news/other",
            category: "agent_product",
            entities: ["OpenAI"],
            id: "other-edition-story",
            originalUrl: "https://source.example/other",
            sourceName: "Agent Desk",
            sourceSlug: "agent-desk",
            tags: ["agents"],
            title: "Other edition story",
            viewedAt: "2026-07-06T08:00:00.000Z",
          },
        ],
      }).map((item) => ({
        id: item.id,
        sourceSlug: item.sourceSlug,
        viewedAt: item.viewedAt,
      })),
    ).toEqual([
      {
        id: "edition-model-router",
        sourceSlug: "market-map-desk",
        viewedAt: "2026-07-06T10:30:00.000Z",
      },
      {
        id: "other-edition-story",
        sourceSlug: "agent-desk",
        viewedAt: "2026-07-06T08:00:00.000Z",
      },
    ]);
  });
});

describe("getNewsEditionStoryGuardrailStorageUpdate", () => {
  it("writes Less feedback while clearing saved and positive anchors for the story", async () => {
    const actionsModule = await import("./news-edition-story-actions");
    const getGuardrailStorageUpdate = (
      actionsModule as {
        getNewsEditionStoryGuardrailStorageUpdate?: (input: {
          guardrailItems: readonly NewsReaderMemoryItem[];
          item: NewsHomeItem;
          occurredAt: string;
          positiveFeedbackItems: readonly NewsPositiveFeedbackMemoryItem[];
          savedItems: readonly NewsReaderMemoryItem[];
        }) => {
          guardrailItems: NewsReaderMemoryItem[];
          positiveFeedbackItems: NewsPositiveFeedbackMemoryItem[];
          savedItems: NewsReaderMemoryItem[];
        };
      }
    ).getNewsEditionStoryGuardrailStorageUpdate;

    expect(getGuardrailStorageUpdate).toEqual(expect.any(Function));
    if (!getGuardrailStorageUpdate) return;

    const savedVariant: NewsReaderMemoryItem = {
      ...story,
      canonicalUrl: "https://example.com/news/model-router",
      id: "saved-router-variant",
      originalUrl: "https://source.example/model-router?utm=saved",
      savedAt: "2026-07-06T09:00:00.000Z",
    };
    const unrelatedSaved: NewsReaderMemoryItem = {
      ...story,
      canonicalUrl: "https://example.com/news/agent-runtime",
      id: "saved-agent-runtime",
      originalUrl: "https://source.example/agent-runtime",
      savedAt: "2026-07-06T08:30:00.000Z",
      title: "Agent runtimes keep separate saved state",
    };
    const positiveFeedbackItems: NewsPositiveFeedbackMemoryItem[] = [
      {
        ...savedVariant,
        action: "save",
        occurredAt: "2026-07-06T09:00:00.000Z",
      },
      {
        ...story,
        action: "share",
        canonicalUrl: "https://example.com/news/model-router#share",
        id: "shared-router-variant",
        occurredAt: "2026-07-06T09:05:00.000Z",
        originalUrl: "https://source.example/model-router?utm=share",
      },
      {
        ...story,
        action: "click_source",
        canonicalUrl: null,
        id: "source-click-router-variant",
        occurredAt: "2026-07-06T09:10:00.000Z",
        originalUrl: "https://source.example/model-router?utm=source",
      },
      {
        ...unrelatedSaved,
        action: "save",
        occurredAt: "2026-07-06T08:30:00.000Z",
      },
    ];

    const update = getGuardrailStorageUpdate({
      guardrailItems: [
        {
          ...unrelatedSaved,
          hiddenAt: "2026-07-06T08:45:00.000Z",
        },
      ],
      item: story,
      occurredAt: "2026-07-06T10:00:00.000Z",
      positiveFeedbackItems,
      savedItems: [savedVariant, unrelatedSaved],
    });

    expect(update.guardrailItems.map((item) => item.id)).toEqual([
      "edition-model-router",
      "saved-agent-runtime",
    ]);
    expect(update.savedItems.map((item) => item.id)).toEqual([
      "saved-agent-runtime",
    ]);
    expect(update.positiveFeedbackItems.map((item) => item.id)).toEqual([
      "saved-agent-runtime",
    ]);
  });
});

describe("getNewsEditionStoryPositiveStorageUpdate", () => {
  it("stores a saved story while clearing its Less guardrail", async () => {
    const actionsModule = await import("./news-edition-story-actions");
    const getPositiveStorageUpdate = (
      actionsModule as {
        getNewsEditionStoryPositiveStorageUpdate?: (input: {
          action: "save" | "share" | "click_source";
          guardrailItems: readonly NewsReaderMemoryItem[];
          item: NewsHomeItem;
          occurredAt: string;
          positiveFeedbackItems: readonly NewsPositiveFeedbackMemoryItem[];
          savedItems: readonly NewsReaderMemoryItem[];
        }) => {
          guardrailItems: NewsReaderMemoryItem[];
          positiveFeedbackItems: NewsPositiveFeedbackMemoryItem[];
          savedItems: NewsReaderMemoryItem[];
        };
      }
    ).getNewsEditionStoryPositiveStorageUpdate;

    expect(getPositiveStorageUpdate).toEqual(expect.any(Function));
    if (!getPositiveStorageUpdate) return;

    const guardrailVariant: NewsReaderMemoryItem = {
      ...story,
      canonicalUrl: "https://example.com/news/model-router#less",
      hiddenAt: "2026-07-06T09:00:00.000Z",
      id: "hidden-router-variant",
      originalUrl: "https://source.example/model-router?utm=less",
    };
    const unrelatedGuardrail: NewsReaderMemoryItem = {
      ...story,
      canonicalUrl: "https://example.com/news/agent-runtime",
      hiddenAt: "2026-07-06T08:45:00.000Z",
      id: "hidden-agent-runtime",
      originalUrl: "https://source.example/agent-runtime",
      title: "Agent runtime remains hidden",
    };
    const unrelatedSaved: NewsReaderMemoryItem = {
      ...story,
      canonicalUrl: "https://example.com/news/agent-runtime",
      id: "saved-agent-runtime",
      originalUrl: "https://source.example/agent-runtime",
      savedAt: "2026-07-06T08:30:00.000Z",
      title: "Agent runtime saved story",
    };
    const unrelatedPositive: NewsPositiveFeedbackMemoryItem = {
      ...unrelatedSaved,
      action: "save",
      occurredAt: "2026-07-06T08:30:00.000Z",
    };

    const update = getPositiveStorageUpdate({
      action: "save",
      guardrailItems: [guardrailVariant, unrelatedGuardrail],
      item: story,
      occurredAt: "2026-07-06T10:20:00.000Z",
      positiveFeedbackItems: [unrelatedPositive],
      savedItems: [unrelatedSaved],
    });

    expect(update.guardrailItems.map((item) => item.id)).toEqual([
      "hidden-agent-runtime",
    ]);
    expect(update.savedItems.map((item) => item.id)).toEqual([
      "edition-model-router",
      "saved-agent-runtime",
    ]);
    expect(
      update.positiveFeedbackItems.map((item) => `${item.id}:${item.action}`),
    ).toEqual(["edition-model-router:save", "saved-agent-runtime:save"]);
  });
});

describe("NewsEditionStoryActions history memory", () => {
  it("writes Read actions into shared reader history storage", async () => {
    const source = await readFile(
      new URL("./news-edition-story-actions.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("newsHistoryStorageKey");
    expect(source).toContain("getNewsEditionStoryHistoryStorageUpdate");
    expect(source).toMatch(
      /if \(action === "view"\) \{[\s\S]*?writeStoredNewsReaderMemoryItems\([\s\S]*?newsHistoryStorageKey,[\s\S]*?getNewsEditionStoryHistoryStorageUpdate/,
    );
  });
});

describe("NewsEditionStoryActions server cache invalidation", () => {
  it("refreshes positive feedback after shared story actions persist", async () => {
    const source = await readFile(
      new URL("./news-edition-story-actions.tsx", import.meta.url),
      "utf8",
    );
    const invalidateStart = source.indexOf(
      "const invalidateReaderQueries = async () => {",
    );
    const invalidateEnd = source.indexOf(
      "const applyServerProfile = async",
      invalidateStart,
    );
    const invalidateBlock = source.slice(invalidateStart, invalidateEnd);

    expect(invalidateStart).toBeGreaterThanOrEqual(0);
    expect(invalidateEnd).toBeGreaterThan(invalidateStart);
    expect(invalidateBlock).toContain("trpc.news.forYou.pathFilter()");
    expect(invalidateBlock).toContain(
      "trpc.news.positiveFeedback.pathFilter()",
    );
  });
});
