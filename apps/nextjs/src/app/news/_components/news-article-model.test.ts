import { describe, expect, it } from "vitest";

import {
  getNewsArticleDeepReadTrainingState,
  getNewsArticleDigest,
  getNewsArticleFeedbackLoop,
  getNewsArticleLearningImpact,
  getNewsArticleNextReads,
  getNewsArticleReaderFit,
  getNewsArticleReaderSignalCacheScopes,
  getNewsArticleReadingPath,
  getNewsArticleReadPercent,
  getNewsArticleServerProfileAuditDisplay,
  getNewsArticleSourceLens,
  selectNewsArticleReadMilestone,
  shouldApplyNewsArticleServerProfileFromInteraction,
  shouldPersistNewsArticleReaderSignals,
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

describe("shouldApplyNewsArticleServerProfileFromInteraction", () => {
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
    ]);
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
          { label: "Signal delta", value: "+5" },
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
            detail:
              "OpenAI, Agents, model, agent were added to related coverage memory.",
            label: "Signals learned",
          },
        ],
        summary:
          "Deep read trained the article queue toward Models from OpenAI News.",
      },
      profile: {
        preferredCategories: ["model_release"],
        preferredSources: [],
        preferredEntities: ["OpenAI", "Agents", "model", "agent"],
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
          detail:
            "Save would add OpenAI News, model, agent to the reader profile.",
          label: "Save",
          signalLabel: "+3 signals",
        },
        {
          action: "share",
          biasLabel: "+0.9 bias",
          detail:
            "Share would add OpenAI News, model, agent and push freshness and novelty harder.",
          label: "Share",
          signalLabel: "+3 signals",
        },
        {
          action: "hide",
          biasLabel: "-0.4 bias",
          detail:
            "Less would remove Models, OpenAI, Agents from this reader profile.",
          label: "Less",
          signalLabel: "-3 signals",
        },
      ],
      label: "Learning Active",
      metrics: [
        { label: "Article memory", value: "3" },
        { label: "Save adds", value: "+3" },
        { label: "Less removes", value: "-3" },
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
            "Save would add Models, OpenAI News, OpenAI, Agents, model, agent to the reader profile.",
          label: "Save",
          signalLabel: "+6 signals",
        },
        {
          action: "share",
          biasLabel: "+0.9 bias",
          detail:
            "Share would add Models, OpenAI News, OpenAI, Agents, model, agent and push freshness and novelty harder.",
          label: "Share",
          signalLabel: "+6 signals",
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
        { label: "Save adds", value: "+6" },
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
        topSources: [{ count: 3, key: "openai-news" }],
        topTags: [{ count: 4, key: "agents" }],
        trainedSignalCount: 7,
      }),
    ).toEqual({
      chips: [
        "model_release 4",
        "agent_product 2",
        "openai-news 3",
        "agents 4",
      ],
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
