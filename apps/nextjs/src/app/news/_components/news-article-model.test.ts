import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  getNewsArticleDeepReadTrainingState,
  getNewsArticleDigest,
  getNewsArticleFeedbackLoop,
  getNewsArticleGuardrailSignalState,
  getNewsArticleHeroVisual,
  getNewsArticleInteractionMetadata,
  getNewsArticleLearningImpact,
  getNewsArticleLocalGuardrailItem,
  getNewsArticleLocalHistoryItem,
  getNewsArticleLocalMemoryItemForAction,
  getNewsArticleLocalSavedItem,
  getNewsArticleNextReads,
  getNewsArticleReadDepthCheckpoints,
  getNewsArticleReaderFit,
  getNewsArticleReaderSignalCacheScopes,
  getNewsArticleReadingPath,
  getNewsArticleReadPercent,
  getNewsArticleReadTrainingReceipt,
  getNewsArticleSaveSignalState,
  getNewsArticleServerProfileAuditDisplay,
  getNewsArticleSourceLens,
  getNewsArticleSourceUrl,
  selectNewsArticleReadMilestone,
  shouldApplyNewsArticleLocalProfileFromMilestone,
  shouldApplyNewsArticleServerProfileFromInteraction,
  shouldPersistNewsArticleReaderSignals,
  shouldTrackNewsArticleReaderSignals,
  shouldTrainNewsArticleProfileFromReadPercent,
} from "./news-article-model";

const article = {
  id: "article-openai-agents",
  title: "OpenAI releases a new agent stack",
  summary: "OpenAI ships a new agent platform for enterprise teams.",
  bodyText: "OpenAI ships a new agent platform.",
  canonicalUrl: "https://example.com/openai-agents",
  originalUrl: "https://source.example/openai-agents",
  imageUrl: null,
  authorName: "News Desk",
  publishedAt: "2026-07-01T08:00:00.000Z",
  collectedAt: "2026-07-01T08:02:00.000Z",
  category: "model_release",
  tags: ["model", "agent"],
  entities: ["OpenAI", "Agents"],
  sourceName: "OpenAI News",
  sourceSlug: "openai-news",
  sourceType: "rss",
  sourceScore: 92,
  trendScore: 90,
};

const relatedItem = {
  id: "related-openai-workflow",
  title: "OpenAI agent workflows reach more developers",
  summary: "More teams are adopting OpenAI agent workflows.",
  canonicalUrl: "https://example.com/related-openai",
  imageUrl: null,
  publishedAt: "2026-07-01T09:00:00.000Z",
  category: "agent_product",
  tags: ["agent", "workflow"],
  entities: ["OpenAI", "Agents"],
  sourceName: "Agent Desk",
  sourceSlug: "agent-desk",
  sourceType: "rss",
  sourceScore: 80,
  trendScore: 88,
  matchedSignals: ["entity"],
  personalizedScore: 108,
};

const formatArticleCategory = (category: string) =>
  category === "model_release"
    ? "Models"
    : category === "funding"
      ? "Funding"
      : category === "hot_take"
        ? "Hot Takes"
        : category === "agent_product"
          ? "Agents"
          : category;

describe("getNewsArticleReadPercent", () => {
  it("calculates bounded reading progress from scroll position", () => {
    expect(
      getNewsArticleReadPercent({
        documentHeight: 2000,
        scrollY: 1100,
        viewportHeight: 500,
      }),
    ).toBe(0.8);
    expect(
      getNewsArticleReadPercent({
        documentHeight: 2000,
        scrollY: -100,
        viewportHeight: 500,
      }),
    ).toBe(0.25);
    expect(
      getNewsArticleReadPercent({
        documentHeight: 2000,
        scrollY: 2200,
        viewportHeight: 500,
      }),
    ).toBe(1);
  });
});

describe("shouldTrainNewsArticleProfileFromReadPercent", () => {
  it("keeps article opens out of profile training until the read is meaningful", () => {
    expect(shouldTrainNewsArticleProfileFromReadPercent(0.2)).toBe(false);
    expect(shouldTrainNewsArticleProfileFromReadPercent(0.35)).toBe(true);
    expect(shouldTrainNewsArticleProfileFromReadPercent(0.8)).toBe(true);
  });
});

describe("selectNewsArticleReadMilestone", () => {
  it("exposes observable checkpoints for meaningful and deep article reads", () => {
    expect(getNewsArticleReadDepthCheckpoints()).toEqual([
      {
        key: "meaningful_read",
        readPercent: 0.35,
        topPercent: 35,
      },
      {
        key: "deep_read",
        readPercent: 0.8,
        topPercent: 80,
      },
    ]);
  });

  it("records article open, meaningful read, and deep read milestones once", () => {
    expect(
      selectNewsArticleReadMilestone({
        readPercent: 0.2,
        recordedMilestones: [],
      }),
    ).toEqual({
      key: "opened",
      readPercent: 0.2,
      shouldShowFeedback: false,
      shouldTrainProfile: false,
    });
    expect(
      selectNewsArticleReadMilestone({
        readPercent: 0.42,
        recordedMilestones: ["opened"],
      }),
    ).toEqual({
      key: "meaningful_read",
      readPercent: 0.42,
      shouldShowFeedback: false,
      shouldTrainProfile: true,
    });
    expect(
      selectNewsArticleReadMilestone({
        readPercent: 0.86,
        recordedMilestones: ["opened", "meaningful_read"],
      }),
    ).toEqual({
      key: "deep_read",
      readPercent: 0.86,
      shouldShowFeedback: true,
      shouldTrainProfile: true,
    });
    expect(
      selectNewsArticleReadMilestone({
        readPercent: 0.9,
        recordedMilestones: ["deep_read"],
      }),
    ).toBeNull();
  });

  it("treats a deep read as covering lower read milestones", () => {
    expect(
      selectNewsArticleReadMilestone({
        readPercent: 0.9,
        recordedMilestones: ["opened"],
      }),
    ).toEqual({
      key: "deep_read",
      readPercent: 0.9,
      shouldShowFeedback: true,
      shouldTrainProfile: true,
    });
    expect(
      selectNewsArticleReadMilestone({
        readPercent: 0.9,
        recordedMilestones: ["deep_read"],
      }),
    ).toBeNull();
  });
});

describe("getNewsArticleReadTrainingReceipt", () => {
  it("shows the next training target as article read milestones advance", () => {
    expect(
      getNewsArticleReadTrainingReceipt({
        article,
        formatCategory: formatArticleCategory,
        recordedMilestones: ["opened"],
      }),
    ).toEqual({
      label: "Opened",
      metrics: [
        { label: "Opened", value: "Yes" },
        { label: "Training signals", value: "0" },
        { label: "Next target", value: "35%" },
      ],
      nextStep:
        "Read to 35% to train Models and add this article to reading history.",
      stages: [
        {
          detail:
            "The article open is logged, but it does not train preferences yet.",
          key: "opened",
          label: "Opened",
          status: "done",
          target: "Open",
        },
        {
          detail: "Reading to 35% starts profile training and reading history.",
          key: "meaningful_read",
          label: "Meaningful read",
          status: "next",
          target: "35%",
        },
        {
          detail: "Reading to 80% strengthens related topic and entity memory.",
          key: "deep_read",
          label: "Deep read",
          status: "locked",
          target: "80%",
        },
      ],
      summary:
        "This open is logged; the For You model waits for a meaningful read.",
    });

    expect(
      getNewsArticleReadTrainingReceipt({
        article,
        formatCategory: formatArticleCategory,
        recordedMilestones: ["opened", "meaningful_read", "deep_read"],
      }).nextStep,
    ).toBe("Deep read has trained For You toward Models from OpenAI News.");
  });
});

describe("getNewsArticleLocalHistoryItem", () => {
  it("converts a meaningful article read into a homepage reader-memory item", () => {
    expect(
      getNewsArticleLocalHistoryItem({
        article,
        viewedAt: "2026-07-01T09:30:00.000Z",
      }),
    ).toEqual({
      canonicalUrl: "https://example.com/openai-agents",
      category: "model_release",
      entities: ["OpenAI", "Agents"],
      id: "article-openai-agents",
      originalUrl: "https://source.example/openai-agents",
      sourceName: "OpenAI News",
      sourceSlug: "openai-news",
      title: "OpenAI releases a new agent stack",
      viewedAt: "2026-07-01T09:30:00.000Z",
    });
  });
});

describe("getNewsArticleLocalSavedItem", () => {
  it("converts an article save into a homepage saved-memory item", () => {
    expect(
      getNewsArticleLocalSavedItem({
        article,
        savedAt: "2026-07-01T09:45:00.000Z",
      }),
    ).toEqual({
      canonicalUrl: "https://example.com/openai-agents",
      category: "model_release",
      entities: ["OpenAI", "Agents"],
      id: "article-openai-agents",
      originalUrl: "https://source.example/openai-agents",
      savedAt: "2026-07-01T09:45:00.000Z",
      sourceName: "OpenAI News",
      sourceSlug: "openai-news",
      tags: ["model", "agent"],
      title: "OpenAI releases a new agent stack",
    });
  });
});

describe("getNewsArticleSaveSignalState", () => {
  it("switches the article save action into a remove action for saved stories", () => {
    expect(
      getNewsArticleSaveSignalState({
        articleId: "article-openai-agents",
        savedItems: [{ id: "other-story" }, { id: "article-openai-agents" }],
      }),
    ).toEqual({
      isSaved: true,
      label: "Remove saved signal",
    });

    expect(
      getNewsArticleSaveSignalState({
        articleId: "article-openai-agents",
        savedItems: [{ id: "other-story" }],
      }),
    ).toEqual({
      isSaved: false,
      label: "Save signal",
    });
  });

  it("switches the article save action into a remove action for saved URL variants", () => {
    expect(
      getNewsArticleSaveSignalState({
        article,
        articleId: "article-openai-agents",
        savedItems: [
          {
            canonicalUrl: null,
            id: "cached-openai-agents",
            originalUrl: "https://example.com/openai-agents?utm=saved",
          },
        ],
      }),
    ).toEqual({
      isSaved: true,
      label: "Remove saved signal",
    });
  });
});

describe("getNewsArticleGuardrailSignalState", () => {
  it("switches the article Less action into a restore action for guardrailed stories", () => {
    expect(
      getNewsArticleGuardrailSignalState({
        articleId: "article-openai-agents",
        guardrailItems: [
          { id: "other-story" },
          getNewsArticleLocalGuardrailItem({
            article,
            hiddenAt: "2026-07-01T10:00:00.000Z",
          }),
        ],
      }),
    ).toEqual({
      isGuardrailed: true,
      label: "Restore signal",
    });

    expect(
      getNewsArticleGuardrailSignalState({
        articleId: "article-openai-agents",
        guardrailItems: [{ id: "other-story" }],
      }),
    ).toEqual({
      isGuardrailed: false,
      label: "Less like this",
    });
  });

  it("switches the article Less action into a restore action for guardrailed URL variants", () => {
    expect(
      getNewsArticleGuardrailSignalState({
        article: {
          canonicalUrl: "https://example.com/openai-agents#article",
          originalUrl: "https://source.example/openai-agents?utm=reader",
        },
        articleId: "article-url-variant",
        guardrailItems: [
          {
            canonicalUrl: "https://www.example.com/openai-agents",
            id: "cached-openai-agents",
            originalUrl: "https://source.example/openai-agents",
          },
        ],
      }),
    ).toEqual({
      isGuardrailed: true,
      label: "Restore signal",
    });
  });
});

describe("getNewsArticleLocalGuardrailItem", () => {
  it("converts Less article feedback into a homepage guardrail-memory item", () => {
    expect(
      getNewsArticleLocalGuardrailItem({
        article,
        hiddenAt: "2026-07-01T10:15:00.000Z",
      }),
    ).toEqual({
      canonicalUrl: "https://example.com/openai-agents",
      category: "model_release",
      entities: ["OpenAI", "Agents"],
      hiddenAt: "2026-07-01T10:15:00.000Z",
      id: "article-openai-agents",
      occurredAt: "2026-07-01T10:15:00.000Z",
      originalUrl: "https://source.example/openai-agents",
      sourceName: "OpenAI News",
      sourceSlug: "openai-news",
      tags: ["model", "agent"],
      title: "OpenAI releases a new agent stack",
    });
  });
});

describe("getNewsArticleLocalMemoryItemForAction", () => {
  it("maps article Save and Less actions into the matching homepage memory collections", () => {
    expect(
      getNewsArticleLocalMemoryItemForAction({
        action: "save",
        article,
        occurredAt: "2026-07-01T09:45:00.000Z",
      }),
    ).toEqual({
      item: {
        canonicalUrl: "https://example.com/openai-agents",
        category: "model_release",
        entities: ["OpenAI", "Agents"],
        id: "article-openai-agents",
        originalUrl: "https://source.example/openai-agents",
        savedAt: "2026-07-01T09:45:00.000Z",
        sourceName: "OpenAI News",
        sourceSlug: "openai-news",
        tags: ["model", "agent"],
        title: "OpenAI releases a new agent stack",
      },
      storage: "saved",
    });

    expect(
      getNewsArticleLocalMemoryItemForAction({
        action: "hide",
        article,
        occurredAt: "2026-07-01T10:15:00.000Z",
      }),
    ).toEqual({
      item: {
        canonicalUrl: "https://example.com/openai-agents",
        category: "model_release",
        entities: ["OpenAI", "Agents"],
        hiddenAt: "2026-07-01T10:15:00.000Z",
        id: "article-openai-agents",
        occurredAt: "2026-07-01T10:15:00.000Z",
        originalUrl: "https://source.example/openai-agents",
        sourceName: "OpenAI News",
        sourceSlug: "openai-news",
        tags: ["model", "agent"],
        title: "OpenAI releases a new agent stack",
      },
      storage: "guardrail",
    });
  });

  it("maps article Share and Source actions into local positive feedback memory", () => {
    expect(
      getNewsArticleLocalMemoryItemForAction({
        action: "share",
        article,
        occurredAt: "2026-07-01T09:45:00.000Z",
      }),
    ).toEqual({
      item: {
        action: "share",
        canonicalUrl: "https://example.com/openai-agents",
        category: "model_release",
        entities: ["OpenAI", "Agents"],
        id: "article-openai-agents",
        occurredAt: "2026-07-01T09:45:00.000Z",
        originalUrl: "https://source.example/openai-agents",
        sourceName: "OpenAI News",
        sourceSlug: "openai-news",
        tags: ["model", "agent"],
        title: "OpenAI releases a new agent stack",
      },
      storage: "positive",
    });

    expect(
      getNewsArticleLocalMemoryItemForAction({
        action: "click_source",
        article,
        occurredAt: "2026-07-01T09:45:00.000Z",
      }),
    ).toEqual({
      item: {
        action: "click_source",
        canonicalUrl: "https://example.com/openai-agents",
        category: "model_release",
        entities: ["OpenAI", "Agents"],
        id: "article-openai-agents",
        occurredAt: "2026-07-01T09:45:00.000Z",
        originalUrl: "https://source.example/openai-agents",
        sourceName: "OpenAI News",
        sourceSlug: "openai-news",
        tags: ["model", "agent"],
        title: "OpenAI releases a new agent stack",
      },
      storage: "positive",
    });
  });
});

describe("getNewsArticleHeroVisual", () => {
  it("uses the article image when one is available", () => {
    expect(
      getNewsArticleHeroVisual({
        article: {
          ...article,
          imageUrl: "https://picsum.photos/seed/article-hero/1200/820",
        },
        formatCategory: formatArticleCategory,
      }),
    ).toEqual({
      alt: "OpenAI releases a new agent stack",
      imageUrl: "https://picsum.photos/seed/article-hero/1200/820",
      kind: "image",
      label: "Models",
    });
  });

  it("falls back to a category visual when the article has no image", () => {
    expect(
      getNewsArticleHeroVisual({
        article,
        formatCategory: formatArticleCategory,
      }),
    ).toEqual({
      kind: "fallback",
      label: "Models",
    });
  });
});

describe("shouldApplyNewsArticleServerProfileFromInteraction", () => {
  it("separates article source clicks from article feedback metadata", () => {
    expect(getNewsArticleInteractionMetadata("click_source")).toEqual({
      surface: "article_source",
    });
    expect(getNewsArticleInteractionMetadata("save")).toEqual({
      surface: "article_feedback",
    });
    expect(getNewsArticleInteractionMetadata("share")).toEqual({
      surface: "article_feedback",
    });
    expect(getNewsArticleInteractionMetadata("hide")).toEqual({
      surface: "article_feedback",
    });
    expect(getNewsArticleInteractionMetadata("view")).toEqual({
      surface: "article",
    });
  });

  it("applies local profile updates once an article read starts training", () => {
    expect(
      shouldApplyNewsArticleLocalProfileFromMilestone({
        readPercent: 0.2,
        shouldShowFeedback: false,
        shouldTrainProfile: false,
      }),
    ).toBe(false);
    expect(
      shouldApplyNewsArticleLocalProfileFromMilestone({
        readPercent: 0.42,
        shouldShowFeedback: false,
        shouldTrainProfile: true,
      }),
    ).toBe(true);
    expect(
      shouldApplyNewsArticleLocalProfileFromMilestone({
        readPercent: 0.86,
        shouldShowFeedback: true,
        shouldTrainProfile: true,
      }),
    ).toBe(true);
  });

  it("ignores shallow article-open responses that do not train reader memory", () => {
    expect(
      shouldApplyNewsArticleServerProfileFromInteraction({
        action: "view",
        metadata: { readPercent: 0.2, surface: "article" },
      }),
    ).toBe(false);
    expect(
      shouldApplyNewsArticleServerProfileFromInteraction({
        action: "view",
        metadata: { readPercent: 0.42, surface: "article" },
      }),
    ).toBe(true);
    expect(
      shouldApplyNewsArticleServerProfileFromInteraction({
        action: "view",
        metadata: { readPercent: 0.9, surface: "article" },
      }),
    ).toBe(true);
    expect(
      shouldApplyNewsArticleServerProfileFromInteraction({
        action: "save",
        metadata: { surface: "article" },
      }),
    ).toBe(true);
  });
});

describe("shouldPersistNewsArticleReaderSignals", () => {
  it("allows local article read training even when preview stories cannot persist", () => {
    expect(
      shouldTrackNewsArticleReaderSignals({
        visitorKey: "visitor-123",
      }),
    ).toBe(true);
    expect(
      shouldPersistNewsArticleReaderSignals({
        articleId: "preview-desk",
        visitorKey: "visitor-123",
      }),
    ).toBe(false);
  });

  it("keeps preview article ids out of server profile calls", () => {
    expect(
      shouldPersistNewsArticleReaderSignals({
        articleId: "preview-desk",
        visitorKey: "visitor-123",
      }),
    ).toBe(false);
  });

  it("persists real database article ids when the visitor key exists", () => {
    expect(
      shouldPersistNewsArticleReaderSignals({
        articleId: "7c8c33ef-4f20-4f78-93ea-9400c4023902",
        visitorKey: "visitor-123",
      }),
    ).toBe(true);
  });

  it("skips persistence when the visitor key is missing", () => {
    expect(
      shouldPersistNewsArticleReaderSignals({
        articleId: "7c8c33ef-4f20-4f78-93ea-9400c4023902",
        visitorKey: null,
      }),
    ).toBe(false);
  });
});

describe("getNewsArticleReaderSignalCacheScopes", () => {
  it("refreshes the front page recommendations after article feedback changes reader memory", () => {
    expect(getNewsArticleReaderSignalCacheScopes()).toEqual([
      "forYou",
      "profile",
      "saved",
      "history",
      "guardrails",
    ]);
  });
});

describe("NewsArticle guardrail restore mutation", () => {
  it("writes the rollback server profile after restoring article Less feedback", async () => {
    const source = await readFile(
      new URL("./news-article.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("trpc.news.restoreGuardrail.mutationOptions");
    expect(source).toMatch(
      /const restoreGuardrail = useMutation\([\s\S]*?onSuccess: async \(serverProfile\)[\s\S]*?stripPersistedNewsPreferenceProfile\(serverProfile\)[\s\S]*?setProfile\(nextProfile\)[\s\S]*?writeStoredProfile\(nextProfile\)/,
    );
    expect(source).toContain("getNewsArticleGuardrailSignalState");
    expect(source).toContain("restoreGuardrailSignal");
  });
});

describe("NewsArticle persisted reader memory hydration", () => {
  it("hydrates Save and Less button state from server reader memory", async () => {
    const source = await readFile(
      new URL("./news-article.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("trpc.news.saved.queryOptions");
    expect(source).toContain("trpc.news.guardrails.queryOptions");
    expect(source).toContain("const serverSavedItems =");
    expect(source).toContain("const serverGuardrailItems =");
    expect(source).toContain("selectActiveNewsSavedItems");
    expect(source).toContain("selectActiveNewsGuardrailItems");
    expect(source).toMatch(
      /getNewsArticleSaveSignalState\({[\s\S]*?savedItems,[\s\S]*?}\)/,
    );
    expect(source).toMatch(
      /getNewsArticleGuardrailSignalState\({[\s\S]*?guardrailItems,[\s\S]*?}\)/,
    );
  });
});

describe("getNewsArticleReadingPath", () => {
  it("ranks related stories by article overlap before reader score", () => {
    expect(
      getNewsArticleReadingPath({
        article,
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "funding"
              ? "Funding"
              : category === "agent_product"
                ? "Agents"
                : category,
        limit: 3,
        relatedItems: [
          {
            ...relatedItem,
            personalizedScore: 108,
          },
          {
            ...relatedItem,
            id: "same-topic",
            title: "Model releases keep accelerating",
            category: "model_release",
            tags: ["model"],
            entities: ["Anthropic"],
            personalizedScore: 112,
            sourceName: "Model Lab",
            sourceSlug: "model-lab",
          },
          {
            ...relatedItem,
            id: "same-source",
            title: "OpenAI expands its startup program",
            category: "funding",
            tags: ["startup"],
            entities: ["Series A"],
            personalizedScore: 113,
            sourceName: "OpenAI News",
            sourceSlug: "openai-news",
          },
          {
            ...relatedItem,
            id: "reader-only",
            title: "A reader signal story with no article overlap",
            category: "funding",
            tags: ["funding"],
            entities: ["YC"],
            personalizedScore: 130,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
          },
        ],
      }),
    ).toEqual({
      context: [
        { label: "Topic", value: "Models" },
        { label: "Source", value: "OpenAI News" },
        { label: "Entities", value: "OpenAI, Agents" },
        { label: "Tags", value: "model, agent" },
      ],
      recommendations: [
        {
          id: "related-openai-workflow",
          reason: "OpenAI thread",
          signalCount: 3,
          scoreLabel: "3 signals / 108 score",
          title: "OpenAI agent workflows reach more developers",
        },
        {
          id: "same-topic",
          reason: "Same topic",
          signalCount: 2,
          scoreLabel: "2 signals / 112 score",
          title: "Model releases keep accelerating",
        },
        {
          id: "same-source",
          reason: "Same source",
          signalCount: 1,
          scoreLabel: "1 signal / 113 score",
          title: "OpenAI expands its startup program",
        },
      ],
      summary:
        "3 follow-ups ranked by article overlap, shared entities, and reader signals.",
    });
  });

  it("normalizes angle tag variants in the article reading path", () => {
    expect(
      getNewsArticleReadingPath({
        article: {
          ...article,
          category: "security",
          sourceSlug: "security-lab",
          tags: ["prompt_injection"],
        },
        formatCategory: (category) =>
          category === "security" ? "Security" : category,
        limit: 2,
        relatedItems: [
          {
            ...relatedItem,
            id: "topic-only-security",
            title: "Security teams expand AI evals",
            category: "security",
            tags: ["evals"],
            entities: ["Policy Desk"],
            personalizedScore: 130,
            sourceName: "Policy Desk",
            sourceSlug: "policy-desk",
          },
          {
            ...relatedItem,
            id: "prompt-injection-follow-up",
            title: "Red teams publish prompt injection mitigations",
            category: "research",
            tags: ["prompt-injection"],
            entities: ["Red Team Lab"],
            personalizedScore: 108,
            sourceName: "Security Lab",
            sourceSlug: "security-lab",
          },
        ],
      }).recommendations,
    ).toEqual([
      {
        id: "prompt-injection-follow-up",
        reason: "prompt injection thread",
        signalCount: 2,
        scoreLabel: "2 signals / 108 score",
        title: "Red teams publish prompt injection mitigations",
      },
      {
        id: "topic-only-security",
        reason: "Same topic",
        signalCount: 1,
        scoreLabel: "1 signal / 130 score",
        title: "Security teams expand AI evals",
      },
    ]);
  });

  it("normalizes source and topic variants in the article reading path", () => {
    expect(
      getNewsArticleReadingPath({
        article,
        formatCategory: formatArticleCategory,
        limit: 2,
        relatedItems: [
          {
            ...relatedItem,
            id: "padded-source-topic-follow-up",
            title: "OpenAI publishes a model follow-up",
            category: " MODEL_RELEASE ",
            tags: ["funding"],
            entities: ["Anthropic"],
            personalizedScore: 116,
            sourceName: "OpenAI News",
            sourceSlug: " OPENAI-NEWS ",
          },
        ],
      }).recommendations,
    ).toEqual([
      {
        id: "padded-source-topic-follow-up",
        reason: "Same topic",
        signalCount: 2,
        scoreLabel: "2 signals / 116 score",
        title: "OpenAI publishes a model follow-up",
      },
    ]);
  });

  it("does not use source corroboration as an article reader signal", () => {
    expect(
      getNewsArticleReadingPath({
        article,
        formatCategory: (category) => category,
        limit: 2,
        relatedItems: [
          {
            ...relatedItem,
            id: "corroborated-no-overlap",
            category: "funding",
            entities: ["YC"],
            matchedSignals: ["source_corroboration"],
            personalizedScore: 140,
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            tags: ["funding"],
            title: "Independent coverage confirms a funding claim",
          },
        ],
      }),
    ).toMatchObject({
      recommendations: [],
      summary: "Reading path will appear as related stories load.",
    });
  });

  it("keeps the article context useful when no related stories are available", () => {
    expect(
      getNewsArticleReadingPath({
        article: {
          ...article,
          entities: [],
          tags: [],
        },
        formatCategory: (category) => category,
        limit: 3,
        relatedItems: [],
      }),
    ).toEqual({
      context: [
        { label: "Topic", value: "model_release" },
        { label: "Source", value: "OpenAI News" },
        { label: "Entities", value: "None" },
        { label: "Tags", value: "None" },
      ],
      recommendations: [],
      summary: "Reading path will appear as related stories load.",
    });
  });
});

describe("getNewsArticleReaderFit", () => {
  it("explains why an article fits the current reader profile", () => {
    expect(
      getNewsArticleReaderFit({
        article,
        formatCategory: (category) =>
          category === "model_release" ? "Models" : category,
        profile: {
          preferredCategories: ["model_release", "funding"],
          preferredSources: ["openai-news"],
          preferredEntities: ["OpenAI", "Anthropic"],
          noveltyBias: 1.4,
          recencyBias: 1.1,
        },
        relatedItems: [relatedItem],
      }),
    ).toEqual({
      label: "Strong Fit",
      metrics: [
        { label: "Profile matches", value: "3" },
        { label: "Follow-ups", value: "1" },
        { label: "Reader bias", value: "Novel" },
      ],
      nextStep: {
        id: "related-openai-workflow",
        label: "Continue Thread",
        reason: "OpenAI thread",
        scoreLabel: "3 signals / 108 score",
        title: "OpenAI agent workflows reach more developers",
      },
      reasons: [
        { detail: "Models is in your reader profile.", label: "Topic" },
        { detail: "OpenAI News is a preferred source.", label: "Source" },
        { detail: "OpenAI matches your entity memory.", label: "Entity" },
      ],
      summary:
        "3 reader signals match this article; 1 follow-up keeps the thread moving.",
    });
  });

  it("keeps cold-start article fit honest when no profile signals match", () => {
    expect(
      getNewsArticleReaderFit({
        article,
        formatCategory: (category) => category,
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
        relatedItems: [],
      }),
    ).toEqual({
      label: "Discovery Read",
      metrics: [
        { label: "Profile matches", value: "0" },
        { label: "Follow-ups", value: "0" },
        { label: "Reader bias", value: "Balanced" },
      ],
      nextStep: null,
      reasons: [
        {
          detail: "This article is training a new reader profile.",
          label: "Discovery",
        },
      ],
      summary: "No saved reader signals match this article yet.",
    });
  });
});

describe("getNewsArticleNextReads", () => {
  it("groups article follow-ups into continue, explore, and verify lanes", () => {
    expect(
      getNewsArticleNextReads({
        article,
        formatCategory: formatArticleCategory,
        limit: 4,
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: [],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1.4,
          recencyBias: 1,
        },
        relatedItems: [
          relatedItem,
          {
            ...relatedItem,
            id: "explore-ai-funding",
            title: "Agent startups pull in new funding",
            category: "funding",
            tags: ["startup", "funding"],
            entities: ["YC"],
            sourceName: "VentureWire",
            sourceSlug: "venturewire",
            sourceScore: 84,
            trendScore: 91,
            matchedSignals: ["exploration"],
            personalizedScore: 116,
          },
          {
            ...relatedItem,
            id: "verify-agent-rumor",
            title: "A viral agent rumor needs source checks",
            category: "hot_take",
            tags: ["rumor"],
            entities: ["Anonymous"],
            sourceName: "Rumor Desk",
            sourceSlug: "rumor-desk",
            sourceScore: 52,
            trendScore: 96,
            matchedSignals: [],
            personalizedScore: 102,
          },
        ],
      }),
    ).toEqual({
      label: "Next Reads Ready",
      metrics: [
        { label: "Candidates", value: "3" },
        { label: "Continue", value: "1" },
        { label: "Explore", value: "1" },
        { label: "Verify", value: "1" },
      ],
      reads: [
        {
          categoryLabel: "Agents",
          id: "related-openai-workflow",
          reason: "OpenAI thread",
          scoreLabel: "3 signals / 108 score",
          sourceName: "Agent Desk",
          statusLabel: "Continue",
          title: "OpenAI agent workflows reach more developers",
        },
        {
          categoryLabel: "Funding",
          id: "explore-ai-funding",
          reason: "Exploration match",
          scoreLabel: "1 signal / 116 score",
          sourceName: "VentureWire",
          statusLabel: "Explore",
          title: "Agent startups pull in new funding",
        },
        {
          categoryLabel: "Hot Takes",
          id: "verify-agent-rumor",
          reason: "High heat needs source check",
          scoreLabel: "0 signals / 102 score",
          sourceName: "Rumor Desk",
          statusLabel: "Verify",
          title: "A viral agent rumor needs source checks",
        },
      ],
      summary: "3 next reads: 1 continue, 1 explore, and 1 verify.",
    });
  });

  it("keeps an exploration next read when one article entity would fill the queue", () => {
    expect(
      getNewsArticleNextReads({
        article,
        formatCategory: formatArticleCategory,
        limit: 2,
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: [],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1.3,
          recencyBias: 1,
        },
        relatedItems: [
          {
            ...relatedItem,
            id: "openai-agent-follow",
            personalizedScore: 142,
            title: "OpenAI agent follow-up stays on the same thread",
          },
          {
            ...relatedItem,
            id: "openai-enterprise-follow",
            personalizedScore: 136,
            title: "OpenAI enterprise follow-up keeps the thread hot",
          },
          {
            ...relatedItem,
            id: "anthropic-research-explore",
            category: "funding",
            entities: ["Anthropic", "Claude"],
            matchedSignals: ["exploration"],
            personalizedScore: 118,
            sourceName: "Research Wire",
            sourceSlug: "research-wire",
            title: "Anthropic research gives the article queue a counterpoint",
            trendScore: 86,
          },
        ],
      }),
    ).toMatchObject({
      metrics: [
        { label: "Candidates", value: "2" },
        { label: "Continue", value: "1" },
        { label: "Explore", value: "1" },
        { label: "Verify", value: "0" },
      ],
      reads: [
        {
          id: "openai-agent-follow",
          statusLabel: "Continue",
        },
        {
          id: "anthropic-research-explore",
          reason: "Exploration match",
          statusLabel: "Explore",
        },
      ],
      summary: "2 next reads: 1 continue, 1 explore, and 0 verify.",
    });
  });

  it("does not count source corroboration as a next-read signal", () => {
    expect(
      getNewsArticleNextReads({
        article,
        formatCategory: formatArticleCategory,
        limit: 2,
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: [],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1.4,
          recencyBias: 1,
        },
        relatedItems: [
          {
            ...relatedItem,
            id: "corroborated-next-read",
            category: "funding",
            entities: ["YC"],
            matchedSignals: ["source_corroboration"],
            personalizedScore: 130,
            sourceName: "VentureWire",
            sourceScore: 84,
            sourceSlug: "venturewire",
            tags: ["funding"],
            title: "Independent coverage confirms a funding claim",
            trendScore: 94,
          },
        ],
      }),
    ).toMatchObject({
      metrics: [
        { label: "Candidates", value: "1" },
        { label: "Continue", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Verify", value: "1" },
      ],
      reads: [
        {
          id: "corroborated-next-read",
          reason: "High heat needs source check",
          scoreLabel: "0 signals / 130 score",
          statusLabel: "Verify",
        },
      ],
    });
  });

  it("routes source trust guardrails into the verify lane", () => {
    expect(
      getNewsArticleNextReads({
        article,
        formatCategory: formatArticleCategory,
        limit: 2,
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: [],
          preferredEntities: ["OpenAI"],
          noveltyBias: 1.4,
          recencyBias: 1,
        },
        relatedItems: [
          {
            ...relatedItem,
            id: "source-review-next-read",
            category: "funding",
            entities: ["YC"],
            matchedSignals: ["source_trust"],
            personalizedScore: 130,
            sourceName: "Rumor Desk",
            sourceScore: 84,
            sourceSlug: "rumor-desk",
            tags: ["funding"],
            title: "A source review story needs verification",
            trendScore: 72,
          },
        ],
      }),
    ).toMatchObject({
      metrics: [
        { label: "Candidates", value: "1" },
        { label: "Continue", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Verify", value: "1" },
      ],
      reads: [
        {
          id: "source-review-next-read",
          reason: "Source needs review",
          scoreLabel: "0 signals / 130 score",
          statusLabel: "Verify",
        },
      ],
    });
  });

  it("normalizes source and topic variants before assigning next-read lanes", () => {
    expect(
      getNewsArticleNextReads({
        article,
        formatCategory: formatArticleCategory,
        limit: 1,
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1.4,
          recencyBias: 1,
        },
        relatedItems: [
          {
            ...relatedItem,
            id: "padded-source-topic-next-read",
            title: "OpenAI model release gets an update",
            category: " MODEL_RELEASE ",
            tags: ["funding"],
            entities: ["Anthropic"],
            matchedSignals: [],
            personalizedScore: 118,
            sourceName: "OpenAI News",
            sourceScore: 84,
            sourceSlug: " OPENAI-NEWS ",
            trendScore: 84,
          },
        ],
      }),
    ).toMatchObject({
      metrics: [
        { label: "Candidates", value: "1" },
        { label: "Continue", value: "1" },
        { label: "Explore", value: "0" },
        { label: "Verify", value: "0" },
      ],
      reads: [
        {
          id: "padded-source-topic-next-read",
          reason: "Same topic",
          scoreLabel: "2 signals / 118 score",
          statusLabel: "Continue",
        },
      ],
    });
  });

  it("keeps the next-read queue explicit before related stories load", () => {
    expect(
      getNewsArticleNextReads({
        article,
        formatCategory: formatArticleCategory,
        limit: 4,
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
        relatedItems: [],
      }),
    ).toEqual({
      label: "Next Reads Waiting",
      metrics: [
        { label: "Candidates", value: "0" },
        { label: "Continue", value: "0" },
        { label: "Explore", value: "0" },
        { label: "Verify", value: "0" },
      ],
      reads: [],
      summary: "Next reads will appear as related stories load.",
    });
  });
});

describe("getNewsArticleFeedbackLoop", () => {
  it("summarizes positive article feedback as profile learning", () => {
    expect(
      getNewsArticleFeedbackLoop({
        action: "save",
        afterProfile: {
          preferredCategories: ["model_release"],
          preferredSources: ["openai-news"],
          preferredEntities: ["OpenAI", "Agents"],
          noveltyBias: 1.3,
          recencyBias: 1.3,
        },
        article,
        beforeProfile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
        formatCategory: (category) =>
          category === "model_release" ? "Models" : category,
      }),
    ).toEqual({
      label: "Positive Signal",
      metrics: [
        { label: "Action", value: "Save" },
        { label: "Signal delta", value: "+4" },
        { label: "Bias shift", value: "+0.6" },
        { label: "Topic", value: "Models" },
      ],
      notices: [
        {
          detail: "Models will rank higher after this article signal.",
          label: "Topic learned",
        },
        {
          detail: "OpenAI News gained source weight from this article.",
          label: "Source learned",
        },
        {
          detail: "OpenAI, Agents were added to related coverage memory.",
          label: "Signals learned",
        },
      ],
      summary: "Save trained the article queue toward Models from OpenAI News.",
    });
  });

  it("summarizes Less article feedback as profile guardrails", () => {
    expect(
      getNewsArticleFeedbackLoop({
        action: "hide",
        afterProfile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 0.8,
          recencyBias: 0.8,
        },
        article,
        beforeProfile: {
          preferredCategories: ["model_release"],
          preferredSources: ["openai-news"],
          preferredEntities: ["OpenAI", "Agents"],
          noveltyBias: 1,
          recencyBias: 1,
        },
        formatCategory: (category) =>
          category === "model_release" ? "Models" : category,
      }),
    ).toEqual({
      label: "Negative Signal",
      metrics: [
        { label: "Action", value: "Less" },
        { label: "Signal delta", value: "-4" },
        { label: "Bias shift", value: "-0.4" },
        { label: "Topic", value: "Models" },
      ],
      notices: [
        {
          detail: "Models will be guarded after this article signal.",
          label: "Topic guarded",
        },
        {
          detail: "OpenAI News lost source weight from this article.",
          label: "Source guarded",
        },
        {
          detail: "OpenAI, Agents were removed from related coverage memory.",
          label: "Signals guarded",
        },
      ],
      summary:
        "Less trained the article queue away from Models from OpenAI News.",
    });
  });

  it("summarizes deep article reads as profile learning", () => {
    expect(
      getNewsArticleFeedbackLoop({
        action: "view",
        afterProfile: {
          preferredCategories: ["model_release"],
          preferredSources: [],
          preferredEntities: ["OpenAI", "Agents"],
          noveltyBias: 1.1,
          recencyBias: 1.1,
        },
        article,
        beforeProfile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
        formatCategory: (category) =>
          category === "model_release" ? "Models" : category,
      }),
    ).toEqual({
      label: "Positive Signal",
      metrics: [
        { label: "Action", value: "Deep read" },
        { label: "Signal delta", value: "+3" },
        { label: "Bias shift", value: "+0.2" },
        { label: "Topic", value: "Models" },
      ],
      notices: [
        {
          detail: "Models will rank higher after this article signal.",
          label: "Topic learned",
        },
        {
          detail: "OpenAI News gained source weight from this article.",
          label: "Source learned",
        },
        {
          detail: "OpenAI, Agents were added to related coverage memory.",
          label: "Signals learned",
        },
      ],
      summary:
        "Deep read trained the article queue toward Models from OpenAI News.",
    });
  });

  it("keeps the article feedback loop idle before explicit feedback", () => {
    expect(
      getNewsArticleFeedbackLoop({
        action: null,
        afterProfile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
        article,
        beforeProfile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
        formatCategory: (category) => category,
      }),
    ).toEqual({
      label: "Waiting",
      metrics: [
        { label: "Action", value: "None" },
        { label: "Signal delta", value: "0" },
        { label: "Bias shift", value: "0" },
        { label: "Topic", value: "model_release" },
      ],
      notices: [
        {
          detail:
            "Deep read, save, share, or press Less to show article-level training feedback.",
          label: "Awaiting feedback",
        },
      ],
      summary: "Article feedback loop will appear after an explicit action.",
    });
  });
});

describe("getNewsArticleDeepReadTrainingState", () => {
  it("returns the next profile and feedback loop when a deep read trains the article profile", () => {
    expect(
      getNewsArticleDeepReadTrainingState({
        article,
        beforeProfile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
        formatCategory: (category) =>
          category === "model_release" ? "Models" : category,
        readPercent: 0.82,
      }),
    ).toEqual({
      feedbackLoop: {
        label: "Positive Signal",
        metrics: [
          { label: "Action", value: "Deep read" },
          { label: "Signal delta", value: "+3" },
          { label: "Bias shift", value: "+0.4" },
          { label: "Topic", value: "Models" },
        ],
        notices: [
          {
            detail: "Models will rank higher after this article signal.",
            label: "Topic learned",
          },
          {
            detail: "OpenAI News gained source weight from this article.",
            label: "Source learned",
          },
          {
            detail: "OpenAI, Agents were added to related coverage memory.",
            label: "Signals learned",
          },
        ],
        summary:
          "Deep read trained the article queue toward Models from OpenAI News.",
      },
      profile: {
        preferredCategories: ["model_release"],
        preferredSources: [],
        preferredEntities: ["OpenAI", "Agents"],
        noveltyBias: 1.198,
        recencyBias: 1.198,
      },
    });
  });

  it("skips shallow reads before the profile should train", () => {
    expect(
      getNewsArticleDeepReadTrainingState({
        article,
        beforeProfile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
        formatCategory: (category) => category,
        readPercent: 0.2,
      }),
    ).toBeNull();
  });
});

describe("getNewsArticleLearningImpact", () => {
  it("forecasts how article actions train the reader profile and next recommendations", () => {
    expect(
      getNewsArticleLearningImpact({
        article,
        formatCategory: (category) =>
          category === "model_release"
            ? "Models"
            : category === "agent_product"
              ? "Agents"
              : category,
        profile: {
          preferredCategories: ["model_release"],
          preferredSources: [],
          preferredEntities: ["OpenAI", "Agents"],
          noveltyBias: 1.15,
          recencyBias: 1.15,
        },
        relatedItems: [
          relatedItem,
          {
            ...relatedItem,
            id: "related-model-release",
            title: "Model labs add tool-use review loops",
            category: "model_release",
            tags: ["model", "review"],
            entities: ["Anthropic"],
            personalizedScore: 112,
            sourceName: "Model Lab",
            sourceSlug: "model-lab",
          },
        ],
      }),
    ).toEqual({
      actions: [
        {
          action: "view",
          biasLabel: "+0.3 bias",
          detail: "Read memory is active for Models, OpenAI, Agents.",
          label: "Read",
          signalLabel: "3 signals",
        },
        {
          action: "save",
          biasLabel: "+0.6 bias",
          detail: "Save would add OpenAI News as a source preference.",
          label: "Save",
          signalLabel: "+1 signal",
        },
        {
          action: "share",
          biasLabel: "+0.9 bias",
          detail:
            "Share would add OpenAI News and push freshness and novelty harder.",
          label: "Share",
          signalLabel: "+1 signal",
        },
        {
          action: "click_source",
          biasLabel: "+0.6 bias",
          detail: "Source would add OpenAI News to the reader profile.",
          label: "Source",
          signalLabel: "+1 signal",
        },
        {
          action: "hide",
          biasLabel: "-0.4 bias",
          detail: "Less would remove OpenAI, Agents from this reader profile.",
          label: "Less",
          signalLabel: "-2 signals",
        },
      ],
      label: "Learning Active",
      metrics: [
        { label: "Article memory", value: "3" },
        { label: "Save adds", value: "+1" },
        { label: "Source adds", value: "+1" },
        { label: "Less removes", value: "-2" },
        { label: "Next candidates", value: "2" },
      ],
      nextStories: [
        {
          id: "related-openai-workflow",
          reason: "OpenAI thread",
          scoreLabel: "3 signals / 108 score",
          title: "OpenAI agent workflows reach more developers",
        },
        {
          id: "related-model-release",
          reason: "Same topic",
          scoreLabel: "2 signals / 112 score",
          title: "Model labs add tool-use review loops",
        },
      ],
      summary:
        "This article has 3 active reader-memory signals and 2 follow-up recommendations.",
    });
  });

  it("keeps cold-start learning impact explicit before reader signals exist", () => {
    expect(
      getNewsArticleLearningImpact({
        article,
        formatCategory: (category) =>
          category === "model_release" ? "Models" : category,
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
        relatedItems: [],
      }),
    ).toEqual({
      actions: [
        {
          action: "view",
          biasLabel: "+0.3 bias",
          detail:
            "Read would start a new Models memory; entity and angle memory wait for a deeper read.",
          label: "Read",
          signalLabel: "+1 signal",
        },
        {
          action: "save",
          biasLabel: "+0.6 bias",
          detail:
            "Save would add Models, OpenAI News, OpenAI, Agents to the reader profile.",
          label: "Save",
          signalLabel: "+4 signals",
        },
        {
          action: "share",
          biasLabel: "+0.9 bias",
          detail:
            "Share would add Models, OpenAI News, OpenAI, Agents and push freshness and novelty harder.",
          label: "Share",
          signalLabel: "+4 signals",
        },
        {
          action: "click_source",
          biasLabel: "+0.6 bias",
          detail: "Source would add OpenAI News to the reader profile.",
          label: "Source",
          signalLabel: "+1 signal",
        },
        {
          action: "hide",
          biasLabel: "-0.4 bias",
          detail: "Less would only dampen ranking bias until a signal exists.",
          label: "Less",
          signalLabel: "0 signals",
        },
      ],
      label: "Learning Ready",
      metrics: [
        { label: "Article memory", value: "0" },
        { label: "Save adds", value: "+4" },
        { label: "Source adds", value: "+1" },
        { label: "Less removes", value: "0" },
        { label: "Next candidates", value: "0" },
      ],
      nextStories: [],
      summary:
        "This article can start reader-memory signals; follow-up recommendations will appear after related stories load.",
    });
  });
});

describe("getNewsArticleServerProfileAuditDisplay", () => {
  it("summarizes persisted server learning for the article sidebar", () => {
    expect(
      getNewsArticleServerProfileAuditDisplay({
        averageHomeRankSlot: null,
        ignoredSignalCount: 2,
        negativeSignalCount: 1,
        positiveSignalCount: 7,
        summary:
          "Server profile trained on 7 positive signals, ignored 2 shallow reads, and applied 1 guardrail.",
        topCategories: [
          { count: 4, key: "model_release" },
          { count: 2, key: "agent_product" },
        ],
        topEntities: [{ count: 5, key: "OpenAI" }],
        topFeedModes: [],
        topMatchedSignals: [],
        topSources: [{ count: 3, key: "openai-news" }],
        topTags: [{ count: 4, key: "agents" }],
        trainedSignalCount: 7,
      }),
    ).toEqual({
      chips: ["Models 4", "Agents 2", "OpenAI News 3", "agents 4"],
      label: "Server Learned",
      metrics: [
        { label: "Trained", value: "7" },
        { label: "Ignored", value: "2" },
        { label: "Hidden", value: "1" },
      ],
      summary:
        "Server profile trained on 7 positive signals, ignored 2 shallow reads, and applied 1 guardrail.",
    });
  });

  it("keeps the article sidebar honest before server learning syncs", () => {
    expect(getNewsArticleServerProfileAuditDisplay(undefined)).toEqual({
      chips: [],
      label: "Server Waiting",
      metrics: [
        { label: "Trained", value: "0" },
        { label: "Ignored", value: "0" },
        { label: "Hidden", value: "0" },
      ],
      summary:
        "Server-side profile learning will appear after saved stories, reads, source clicks, or Less feedback sync.",
    });
  });
});

describe("getNewsArticleDigest", () => {
  it("builds a fast brief with reading time, facts, and key entities", () => {
    expect(
      getNewsArticleDigest({
        article: {
          ...article,
          bodyText: [
            "OpenAI ships a new agent platform for enterprise teams.",
            "The system connects planning, tool use, and review loops for production workflows.",
            "OpenAI says the launch is aimed at developers who need safer automation.",
          ].join("\n\n"),
          entities: ["OpenAI", "Agents", "OpenAI", "Enterprise"],
          tags: ["agent", "workflow", "automation", "workflow"],
        },
      }),
    ).toEqual({
      entities: ["OpenAI", "Agents", "Enterprise"],
      facts: [
        "OpenAI ships a new agent platform for enterprise teams.",
        "The system connects planning, tool use, and review loops for production workflows.",
        "OpenAI says the launch is aimed at developers who need safer automation.",
      ],
      readTimeLabel: "1 min read",
      sourceLine: "OpenAI News / Models",
      tags: ["agent", "workflow", "automation"],
    });
  });

  it("falls back to summary text when the article body is empty", () => {
    expect(
      getNewsArticleDigest({
        article: {
          ...article,
          bodyText: "   ",
          entities: [],
          tags: [],
        },
      }),
    ).toEqual({
      entities: [],
      facts: ["OpenAI ships a new agent platform for enterprise teams."],
      readTimeLabel: "1 min read",
      sourceLine: "OpenAI News / Models",
      tags: [],
    });
  });
});

describe("getNewsArticleSourceLens", () => {
  it("summarizes provenance, heat, and signal density for an article", () => {
    expect(
      getNewsArticleSourceLens({
        article: {
          ...article,
          entities: ["OpenAI", "Agents", "Enterprise"],
          tags: ["model", "agent", "workflow"],
          sourceScore: 92,
          sourceType: "official",
          trendScore: 88,
        },
      }),
    ).toEqual({
      lines: [
        { label: "Source", value: "OpenAI News" },
        { label: "Type", value: "official" },
        { label: "Credibility", value: "92/100" },
        { label: "Heat", value: "88/100" },
        { label: "Signals", value: "3 entities / 3 tags" },
      ],
      summary:
        "High-credibility official source with strong edition heat and dense entity coverage.",
      tone: "High confidence",
    });
  });

  it("keeps low-signal provenance explicit", () => {
    expect(
      getNewsArticleSourceLens({
        article: {
          ...article,
          entities: [],
          tags: [],
          sourceScore: 45,
          sourceType: "rss",
          trendScore: 32,
        },
      }),
    ).toEqual({
      lines: [
        { label: "Source", value: "OpenAI News" },
        { label: "Type", value: "rss" },
        { label: "Credibility", value: "45/100" },
        { label: "Heat", value: "32/100" },
        { label: "Signals", value: "0 entities / 0 tags" },
      ],
      summary:
        "Lower-confidence rss source with quieter edition heat and sparse entity coverage.",
      tone: "Watch",
    });
  });
});

describe("getNewsArticleSourceUrl", () => {
  it("prefers canonical article URLs and falls back to original source URLs", () => {
    expect(
      getNewsArticleSourceUrl({
        ...article,
        canonicalUrl: " https://example.com/canonical ",
        originalUrl: "https://source.example/openai-agents",
      }),
    ).toBe("https://example.com/canonical");
    expect(
      getNewsArticleSourceUrl({
        ...article,
        canonicalUrl: "   ",
        originalUrl: " https://source.example/openai-agents ",
      }),
    ).toBe("https://source.example/openai-agents");
    expect(
      getNewsArticleSourceUrl({
        ...article,
        canonicalUrl: "   ",
        originalUrl: "   ",
      }),
    ).toBeNull();
  });

  it("rejects unsafe article source URL protocols", () => {
    expect(
      getNewsArticleSourceUrl({
        ...article,
        canonicalUrl: "javascript:alert(1)",
        originalUrl: "https://source.example/openai-agents",
      }),
    ).toBe("https://source.example/openai-agents");
    expect(
      getNewsArticleSourceUrl({
        ...article,
        canonicalUrl: "data:text/html,unsafe",
        originalUrl: "mailto:tips@example.com",
      }),
    ).toBeNull();
  });
});
