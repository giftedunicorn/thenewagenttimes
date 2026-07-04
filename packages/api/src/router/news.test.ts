import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import type { NewsForYouCandidate } from "./news";
import {
  attachNewsRecommendationExplanations,
  buildNewsCollaborativeSignalCondition,
  buildNewsFeedCursorCondition,
  buildNewsFeedOrderByExpressions,
  buildNewsForYouCandidateConditions,
  buildNewsGuardrailRestoreCondition,
  buildNewsHomeExposureDedupeCondition,
  buildNewsInteractionTrainingMetadata,
  buildNewsPreferenceRollbackAfterInteractionRemoval,
  buildNewsReaderMutationProfileResponse,
  buildNewsReaderProfileAfterInteractionRemoval,
  buildNewsReaderProfileResponse,
  buildNewsSavedRemovalCondition,
  buildNewsTextSearchCondition,
  getNewsCollaborativeSignalScore,
  getNewsCollaborativeSignalWindowStart,
  getNewsForYouCandidateLimit,
  getNewsHomeExposureDedupeWindowStart,
  getNewsReaderProfileResetIdentity,
  getNewsSemanticFeedbackStrength,
  NewsFeedInputSchema,
  NewsForYouInputSchema,
  NewsGuardrailsInputSchema,
  NewsHistoryInputSchema,
  NewsReaderProfileInputSchema,
  NewsRecordInteractionInputSchema,
  NewsRemoveSavedInputSchema,
  NewsRestoreGuardrailInputSchema,
  newsRouter,
  NewsSavedInputSchema,
  NewsSearchCandidatesInputSchema,
  NewsUpdateProfileInputSchema,
  rebuildNewsPreferenceProfileFromInteractions,
  selectNewsFeedItems,
  selectNewsForYouItems,
  selectNewsSearchCandidateItems,
  selectNewsViewedHistory,
  selectUniqueNewsCollectionItems,
  shouldDedupeNewsHomeExposureInteraction,
  shouldIncludeNewsInteractionAsPositiveFeedback,
  shouldIncludeNewsInteractionInReadingHistory,
  shouldTrainNewsProfileFromInteraction,
  summarizeNewsReaderProfileSignals,
  toNewsCollaborativeSignal,
  toNewsReaderProfileInteraction,
} from "./news";

interface SqlDebugChunk {
  name?: unknown;
  queryChunks?: unknown;
  value?: unknown;
}

const isSqlDebugChunk = (value: unknown): value is SqlDebugChunk =>
  typeof value === "object" && value !== null;

const collectSqlDebugText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (!isSqlDebugChunk(value)) return "";

  const stringValues = Array.isArray(value.value)
    ? value.value
        .filter((entry): entry is string => typeof entry === "string")
        .join(" ")
    : "";
  const name = typeof value.name === "string" ? value.name : "";
  const chunks = Array.isArray(value.queryChunks)
    ? value.queryChunks.map(collectSqlDebugText).join(" ")
    : "";

  return [name, stringValues, chunks].filter(Boolean).join(" ");
};

const baseNewsItem = {
  id: "openai-model-lead",
  title: "OpenAI model lead",
  summary: "OpenAI ships a model release.",
  canonicalUrl: "https://example.com/openai-model-lead",
  imageUrl: null,
  publishedAt: "2026-07-01T08:00:00.000Z",
  category: "model_release",
  tags: ["model", "agent"],
  entities: ["OpenAI"],
  sourceScore: 92,
  trendScore: 90,
  sourceName: "OpenAI News",
  sourceSlug: "openai-news",
  sourceType: "official",
};

const newsCandidateWithOriginalUrl = {
  ...baseNewsItem,
  originalUrl: "https://example.com/openai-model-lead?utm=feed",
} satisfies NewsForYouCandidate;

describe("news router input contracts", () => {
  it("models original URLs on personalized recommendation candidates", () => {
    expect(newsCandidateWithOriginalUrl.originalUrl).toBe(
      "https://example.com/openai-model-lead?utm=feed",
    );
  });

  it("defaults the public feed limit to 20", () => {
    expect(NewsFeedInputSchema.parse({}).limit).toBe(20);
  });

  it("defaults the public feed channel to Trending", () => {
    expect(NewsFeedInputSchema.parse({}).mode).toBe("trending");
  });

  it("accepts a heat cursor for Trending pagination", () => {
    expect(
      NewsFeedInputSchema.parse({
        cursor: "2026-07-01T08:00:00.000Z",
        cursorTrendScore: 86,
        mode: "trending",
      }).cursorTrendScore,
    ).toBe(86);
  });

  it("accepts public feed channel modes without allowing personalized mode", () => {
    expect(NewsFeedInputSchema.parse({ mode: "latest" }).mode).toBe("latest");
    expect(NewsFeedInputSchema.parse({ mode: "trending" }).mode).toBe(
      "trending",
    );
    expect(NewsFeedInputSchema.safeParse({ mode: "for_you" }).success).toBe(
      false,
    );
  });

  it("caps public feed page size at 50", () => {
    const result = NewsFeedInputSchema.safeParse({ limit: 51 });

    expect(result.success).toBe(false);
  });

  it("accepts the approved first-stage news categories", () => {
    const result = NewsFeedInputSchema.safeParse({
      category: "yc_ai",
      limit: 10,
    });

    expect(result.success).toBe(true);
  });

  it("normalizes readable angle tags before public feed filtering", () => {
    expect(NewsFeedInputSchema.parse({ tag: " prompt injection " }).tag).toBe(
      "prompt_injection",
    );
    expect(NewsFeedInputSchema.parse({ tag: "funding-round" }).tag).toBe(
      "funding_round",
    );
  });

  it("requires a non-empty search query after trimming", () => {
    const result = NewsSearchCandidatesInputSchema.safeParse({ q: "   " });

    expect(result.success).toBe(false);
  });

  it("defaults search candidate limit to 10", () => {
    expect(
      NewsSearchCandidatesInputSchema.parse({ q: "agent launch" }).limit,
    ).toBe(10);
  });

  it("accepts source and angle filters for search candidates", () => {
    expect(
      NewsSearchCandidatesInputSchema.parse({
        q: "agent launch",
        sourceSlug: " openai-news ",
        tag: "computer use",
      }),
    ).toMatchObject({
      sourceSlug: "openai-news",
      tag: "computer_use",
    });
  });

  it("defaults personalized for-you feed limit to 20", () => {
    expect(
      NewsForYouInputSchema.parse({ visitorKey: "visitor-test-123" }).limit,
    ).toBe(20);
  });

  it("keeps public feed channel pagination fields out of personalized input", () => {
    const parsed = NewsForYouInputSchema.parse({
      cursor: "2026-07-01T08:00:00.000Z",
      cursorTrendScore: 86,
      mode: "trending",
      visitorKey: "visitor-test-123",
    });

    expect("mode" in parsed).toBe(false);
    expect("cursorTrendScore" in parsed).toBe(false);
  });

  it("accepts bounded exclusion ids for personalized pagination", () => {
    expect(
      NewsForYouInputSchema.parse({
        excludeNewsItemIds: [
          "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
          "c79f62c2-bf96-4f31-b8a6-64b9e9aef16b",
        ],
        visitorKey: "visitor-test-123",
      }).excludeNewsItemIds,
    ).toEqual([
      "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      "c79f62c2-bf96-4f31-b8a6-64b9e9aef16b",
    ]);
  });

  it("accepts a bounded reader local hour for local daypart ranking", () => {
    expect(
      NewsForYouInputSchema.parse({
        readerLocalHour: 23,
        visitorKey: "visitor-test-123",
      }).readerLocalHour,
    ).toBe(23);

    expect(
      NewsForYouInputSchema.safeParse({
        readerLocalHour: 24,
        visitorKey: "visitor-test-123",
      }).success,
    ).toBe(false);
  });

  it("defaults saved news collection limit to a compact sidebar shelf", () => {
    expect(
      NewsSavedInputSchema.parse({ visitorKey: "visitor-test-123" }).limit,
    ).toBe(6);
  });

  it("caps saved news collection page size", () => {
    const result = NewsSavedInputSchema.safeParse({
      limit: 26,
      visitorKey: "visitor-test-123",
    });

    expect(result.success).toBe(false);
  });

  it("defaults reading history collection limit to a compact sidebar shelf", () => {
    expect(
      NewsHistoryInputSchema.parse({ visitorKey: "visitor-test-123" }).limit,
    ).toBe(6);
  });

  it("caps reading history collection page size", () => {
    const result = NewsHistoryInputSchema.safeParse({
      limit: 26,
      visitorKey: "visitor-test-123",
    });

    expect(result.success).toBe(false);
  });

  it("defaults guardrail feedback collection limit to a compact sidebar shelf", () => {
    expect(
      NewsGuardrailsInputSchema.parse({ visitorKey: "visitor-test-123" }).limit,
    ).toBe(6);
  });

  it("caps guardrail feedback collection page size", () => {
    const result = NewsGuardrailsInputSchema.safeParse({
      limit: 26,
      visitorKey: "visitor-test-123",
    });

    expect(result.success).toBe(false);
  });

  it("accepts anonymous reader keys for persisted preference profiles", () => {
    const result = NewsReaderProfileInputSchema.safeParse({
      visitorKey: "visitor-test-123",
    });

    expect(result.success).toBe(true);
  });

  it("requires useful anonymous reader keys before storing interactions", () => {
    const result = NewsRecordInteractionInputSchema.safeParse({
      visitorKey: "short",
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      action: "save",
    });

    expect(result.success).toBe(false);
  });

  it("accepts the personalization interaction actions from the reader UI", () => {
    const result = NewsRecordInteractionInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      action: "click_source",
    });

    expect(result.success).toBe(true);
  });

  it("accepts bounded reading depth metadata for article views", () => {
    const result = NewsRecordInteractionInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      action: "view",
      metadata: {
        readMilestone: "deep_read",
        readPercent: 0.82,
        surface: "article",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown article read milestones", () => {
    const result = NewsRecordInteractionInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      action: "view",
      metadata: {
        readMilestone: "almost_done",
        readPercent: 0.82,
        surface: "article",
      },
    });

    expect(result.success).toBe(false);
  });

  it("accepts bounded home exposure metadata for feed fatigue", () => {
    const result = NewsRecordInteractionInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      action: "view",
      metadata: {
        exposure: true,
        exposureSlot: 4,
        feedMode: "for_you",
        surface: "home",
      },
    });

    expect(result.success).toBe(true);
  });

  it("canonicalizes interaction metadata surfaces before storing behavior context", () => {
    expect(
      NewsRecordInteractionInputSchema.parse({
        visitorKey: "visitor-test-123",
        newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
        action: "view",
        metadata: {
          readPercent: 0.82,
          surface: " Article ",
        },
      }).metadata?.surface,
    ).toBe("article");

    expect(
      NewsRecordInteractionInputSchema.parse({
        visitorKey: "visitor-test-123",
        newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
        action: "view",
        metadata: {
          exposure: true,
          surface: "home-exposure",
        },
      }).metadata?.surface,
    ).toBe("home_exposure");
  });

  it("validates home ranking context on reader interaction metadata", () => {
    expect(
      NewsRecordInteractionInputSchema.parse({
        action: "save",
        metadata: {
          feedMode: "for_you",
          matchedSignals: ["category", "semantic_feedback"],
          personalizedScore: 147,
          rankSlot: 2,
          surface: "home",
        },
        newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
        visitorKey: "visitor-test-123",
      }).metadata,
    ).toEqual({
      feedMode: "for_you",
      matchedSignals: ["category", "semantic_feedback"],
      personalizedScore: 147,
      rankSlot: 2,
      surface: "home",
    });

    expect(
      NewsRecordInteractionInputSchema.safeParse({
        action: "save",
        metadata: {
          rankSlot: -1,
          surface: "home",
        },
        newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
        visitorKey: "visitor-test-123",
      }).success,
    ).toBe(false);
  });

  it("canonicalizes home ranking signals before storing interaction metadata", () => {
    expect(
      NewsRecordInteractionInputSchema.parse({
        action: "save",
        metadata: {
          feedMode: "for_you",
          matchedSignals: [
            " Category ",
            "CATEGORY",
            "Semantic_Feedback",
            "semantic_feedback",
          ],
          personalizedScore: 147,
          rankSlot: 2,
          surface: "home",
        },
        newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
        visitorKey: "visitor-test-123",
      }).metadata?.matchedSignals,
    ).toEqual(["category", "semantic_feedback"]);
  });

  it("canonicalizes home ranking signal separators before storing interaction metadata", () => {
    expect(
      NewsRecordInteractionInputSchema.parse({
        action: "hide",
        metadata: {
          feedMode: "for_you",
          matchedSignals: [
            " Negative Feedback ",
            "negative-feedback",
            "Source Trust",
          ],
          personalizedScore: 42,
          rankSlot: 8,
          surface: "home",
        },
        newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
        visitorKey: "visitor-test-123",
      }).metadata?.matchedSignals,
    ).toEqual(["negative_feedback", "source_trust"]);
  });

  it("deduplicates noisy home ranking signals before applying the storage limit", () => {
    expect(
      NewsRecordInteractionInputSchema.parse({
        action: "save",
        metadata: {
          feedMode: "for_you",
          matchedSignals: [
            " category ",
            "CATEGORY",
            "negative feedback",
            "negative-feedback",
            "source trust",
            "Source Trust",
            "semantic feedback",
            "semantic-feedback",
            "category",
            "negative_feedback",
            "source_trust",
            "semantic_feedback",
            " Category ",
          ],
          personalizedScore: 147,
          rankSlot: 2,
          surface: "home",
        },
        newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
        visitorKey: "visitor-test-123",
      }).metadata?.matchedSignals,
    ).toEqual([
      "category",
      "negative_feedback",
      "source_trust",
      "semantic_feedback",
    ]);
  });

  it("maps home rank slot metadata into reader profile training input", () => {
    expect(
      toNewsReaderProfileInteraction({
        action: "save",
        metadata: {
          feedMode: "for_you",
          matchedSignals: ["category"],
          personalizedScore: 147,
          rankSlot: 12,
          surface: "home",
        },
      }),
    ).toEqual({
      action: "save",
      rankSlot: 12,
      readPercent: undefined,
    });
  });

  it("rejects out-of-range home exposure slots", () => {
    const result = NewsRecordInteractionInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      action: "view",
      metadata: {
        exposure: true,
        exposureSlot: 51,
        feedMode: "for_you",
        surface: "home",
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects out-of-range reading depth metadata", () => {
    const result = NewsRecordInteractionInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      action: "view",
      metadata: {
        readPercent: 1.4,
        surface: "article",
      },
    });

    expect(result.success).toBe(false);
  });

  it("accepts restoring one persisted Less guardrail", () => {
    const result = NewsRestoreGuardrailInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
    });

    expect(result.success).toBe(true);
  });

  it("rejects guardrail restore requests without a published story id", () => {
    const result = NewsRestoreGuardrailInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      newsItemId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("accepts removing one persisted saved story", () => {
    const result = NewsRemoveSavedInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
    });

    expect(result.success).toBe(true);
  });

  it("rejects saved removal requests without a published story id", () => {
    const result = NewsRemoveSavedInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      newsItemId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("accepts explicit reader profile updates from preference controls", () => {
    const result = NewsUpdateProfileInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      profile: {
        preferredCategories: ["model_release"],
        preferredSources: ["openai-news"],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1.5,
        recencyBias: 0.5,
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects profile bias values outside the supported ranking range", () => {
    const result = NewsUpdateProfileInputSchema.safeParse({
      visitorKey: "visitor-test-123",
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 2.5,
        recencyBias: 1,
      },
    });

    expect(result.success).toBe(false);
  });

  it("exposes a reset endpoint that clears persisted reader memory", () => {
    expect(newsRouter).toHaveProperty("resetProfile");
  });

  it("exposes persisted Less feedback as a guardrail memory collection", () => {
    expect(newsRouter).toHaveProperty("guardrails");
  });

  it("exposes a persisted Less feedback restore endpoint", () => {
    expect(newsRouter).toHaveProperty("restoreGuardrail");
  });

  it("exposes a persisted saved-story removal endpoint", () => {
    expect(newsRouter).toHaveProperty("removeSaved");
  });
});

describe("shouldIncludeNewsInteractionAsPositiveFeedback", () => {
  it("uses explicit positive actions as recommendation anchors", () => {
    expect(
      shouldIncludeNewsInteractionAsPositiveFeedback({
        action: "save",
        metadata: undefined,
      }),
    ).toBe(true);
    expect(
      shouldIncludeNewsInteractionAsPositiveFeedback({
        action: "share",
        metadata: undefined,
      }),
    ).toBe(true);
    expect(
      shouldIncludeNewsInteractionAsPositiveFeedback({
        action: "click_source",
        metadata: undefined,
      }),
    ).toBe(true);
  });

  it("uses meaningful article reads as recommendation anchors", () => {
    expect(
      shouldIncludeNewsInteractionAsPositiveFeedback({
        action: "view",
        metadata: { readPercent: 0.35, surface: "article" },
      }),
    ).toBe(true);
    expect(
      shouldIncludeNewsInteractionAsPositiveFeedback({
        action: "view",
        metadata: { readPercent: 0.8, surface: "article" },
      }),
    ).toBe(true);
  });

  it("keeps home exposures and shallow reads out of recommendation anchors", () => {
    expect(
      shouldIncludeNewsInteractionAsPositiveFeedback({
        action: "view",
        metadata: {
          exposure: true,
          exposureSlot: 3,
          readPercent: 1,
          surface: "home",
        },
      }),
    ).toBe(false);
    expect(
      shouldIncludeNewsInteractionAsPositiveFeedback({
        action: "view",
        metadata: { readPercent: 1, surface: "home" },
      }),
    ).toBe(false);
    expect(
      shouldIncludeNewsInteractionAsPositiveFeedback({
        action: "view",
        metadata: { readPercent: 0.2, surface: "article" },
      }),
    ).toBe(false);
    expect(
      shouldIncludeNewsInteractionAsPositiveFeedback({
        action: "hide",
        metadata: undefined,
      }),
    ).toBe(false);
  });
});

describe("getNewsSemanticFeedbackStrength", () => {
  it("weights semantic feedback by explicit action and article read depth", () => {
    expect(
      getNewsSemanticFeedbackStrength({
        action: "click_source",
        metadata: { surface: "article_source" },
      }),
    ).toBe(1);
    expect(
      getNewsSemanticFeedbackStrength({
        action: "save",
        metadata: { surface: "article_feedback" },
      }),
    ).toBe(2);
    expect(
      getNewsSemanticFeedbackStrength({
        action: "share",
        metadata: { surface: "article_feedback" },
      }),
    ).toBe(3);
    expect(
      getNewsSemanticFeedbackStrength({
        action: "view",
        metadata: { readPercent: 0.35, surface: "article" },
      }),
    ).toBe(1);
    expect(
      getNewsSemanticFeedbackStrength({
        action: "view",
        metadata: { readPercent: 0.9, surface: "article" },
      }),
    ).toBe(2);
  });
});

describe("shouldTrainNewsProfileFromInteraction", () => {
  it("does not train the reader profile from home read clicks", () => {
    expect(
      shouldTrainNewsProfileFromInteraction({
        action: "view",
        metadata: { surface: "home" },
      }),
    ).toBe(false);
  });

  it("keeps shallow article opens out of profile training until read depth is meaningful", () => {
    expect(
      shouldTrainNewsProfileFromInteraction({
        action: "view",
        metadata: { readPercent: 0.2, surface: "article" },
      }),
    ).toBe(false);
    expect(
      shouldTrainNewsProfileFromInteraction({
        action: "view",
        metadata: { readPercent: 0.8, surface: "article" },
      }),
    ).toBe(true);
  });

  it("keeps unqualified view events out of profile training", () => {
    expect(
      shouldTrainNewsProfileFromInteraction({
        action: "view",
        metadata: undefined,
      }),
    ).toBe(false);
    expect(
      shouldTrainNewsProfileFromInteraction({
        action: "view",
        metadata: { surface: "article" },
      }),
    ).toBe(false);
  });

  it("keeps explicit feedback actions as training signals", () => {
    expect(
      shouldTrainNewsProfileFromInteraction({
        action: "save",
        metadata: { surface: "home" },
      }),
    ).toBe(true);
  });
});

describe("shouldIncludeNewsInteractionInReadingHistory", () => {
  it("keeps meaningful article reads in history", () => {
    expect(
      shouldIncludeNewsInteractionInReadingHistory({
        action: "view",
        metadata: { readPercent: 0.8, surface: "article" },
      }),
    ).toBe(true);
  });

  it("keeps shallow home clicks and shallow article opens out of reading history", () => {
    expect(
      shouldIncludeNewsInteractionInReadingHistory({
        action: "view",
        metadata: { surface: "home" },
      }),
    ).toBe(false);
    expect(
      shouldIncludeNewsInteractionInReadingHistory({
        action: "view",
        metadata: { readPercent: 0.2, surface: "article" },
      }),
    ).toBe(false);
  });

  it("keeps automatic home exposures out of reading history", () => {
    expect(
      shouldIncludeNewsInteractionInReadingHistory({
        action: "view",
        metadata: {
          exposure: true,
          exposureSlot: 0,
          feedMode: "for_you",
          surface: "home",
        },
      }),
    ).toBe(false);
  });

  it("keeps non-view interactions out of reading history", () => {
    expect(
      shouldIncludeNewsInteractionInReadingHistory({
        action: "save",
        metadata: { surface: "home" },
      }),
    ).toBe(false);
  });
});

describe("shouldDedupeNewsHomeExposureInteraction", () => {
  it("deduplicates automatic home exposure views across both home surfaces", () => {
    expect(
      shouldDedupeNewsHomeExposureInteraction({
        action: "view",
        metadata: {
          exposure: true,
          exposureSlot: 2,
          feedMode: "for_you",
          surface: "home",
        },
      }),
    ).toBe(true);
    expect(
      shouldDedupeNewsHomeExposureInteraction({
        action: "view",
        metadata: {
          exposure: true,
          exposureSlot: 2,
          feedMode: "for_you",
          surface: "home_exposure",
        },
      }),
    ).toBe(true);
  });

  it("keeps explicit feedback and article reads persistable", () => {
    expect(
      shouldDedupeNewsHomeExposureInteraction({
        action: "save",
        metadata: {
          exposure: true,
          feedMode: "for_you",
          surface: "home_exposure",
        },
      }),
    ).toBe(false);
    expect(
      shouldDedupeNewsHomeExposureInteraction({
        action: "view",
        metadata: {
          readPercent: 0.85,
          surface: "article",
        },
      }),
    ).toBe(false);
    expect(
      shouldDedupeNewsHomeExposureInteraction({
        action: "view",
        metadata: {
          feedMode: "for_you",
          surface: "home_exposure",
        },
      }),
    ).toBe(false);
  });
});

describe("selectNewsViewedHistory", () => {
  it("keeps home exposures available for cooldown without treating them as read history", () => {
    const history = selectNewsViewedHistory([
      {
        canonicalUrl: "https://example.com/home-exposed",
        category: "model_release",
        entities: ["OpenAI"],
        metadata: {
          exposure: true,
          exposureSlot: 2,
          feedMode: "for_you",
          surface: "home",
        },
        newsItemId: "home-exposed",
        occurredAt: new Date("2026-07-01T09:00:00.000Z"),
        originalUrl: "https://example.com/home-exposed?utm=feed",
        sourceSlug: "openai-news",
        tags: ["models"],
        title: "Home exposed model story",
      },
      {
        canonicalUrl: "https://example.com/shallow-read",
        category: "agent_product",
        entities: ["Agents"],
        metadata: { readPercent: 0.2, surface: "article" },
        newsItemId: "shallow-article",
        occurredAt: new Date("2026-07-01T09:05:00.000Z"),
        originalUrl: "https://example.com/shallow-read",
        sourceSlug: "agent-desk",
        tags: ["agents"],
        title: "Shallow article open",
      },
      {
        canonicalUrl: "https://example.com/deep-read",
        category: "research",
        entities: ["Benchmarks"],
        metadata: { readPercent: 0.82, surface: "article" },
        newsItemId: "deep-article",
        occurredAt: new Date("2026-07-01T09:10:00.000Z"),
        originalUrl: "https://example.com/deep-read",
        sourceSlug: "research-lab",
        tags: ["evals"],
        title: "Deep article read",
      },
    ]);

    expect(history.recentExposureItems.map((item) => item.id)).toEqual([
      "home-exposed",
      "shallow-article",
      "deep-article",
    ]);
    expect(history.readingHistoryItemIds).toEqual(["deep-article"]);
    expect(history.readingHistoryItems.map((item) => item.id)).toEqual([
      "deep-article",
    ]);
  });
});

describe("selectNewsFeedItems", () => {
  it("deduplicates public feed URL variants before limiting the page", () => {
    const feed = selectNewsFeedItems({
      items: [
        {
          ...baseNewsItem,
          id: "syndicated-openai-model",
          canonicalUrl: "https://mirror.example/openai-model",
          originalUrl: "https://example.com/openai-model?utm=feed",
          sourceScore: 84,
          trendScore: 96,
        },
        {
          ...baseNewsItem,
          id: "trusted-openai-model",
          canonicalUrl: "https://example.com/openai-model",
          originalUrl: "https://example.com/openai-model",
          sourceScore: 96,
          trendScore: 90,
        },
        {
          ...baseNewsItem,
          id: "fresh-agent-story",
          canonicalUrl: "https://example.com/fresh-agent-story",
          originalUrl: "https://example.com/fresh-agent-story",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 88,
          trendScore: 86,
        },
      ],
      limit: 2,
    });

    expect(feed.map((item) => item.id)).toEqual([
      "trusted-openai-model",
      "fresh-agent-story",
    ]);
  });
});

describe("buildNewsFeedOrderByExpressions", () => {
  it("orders Latest by publish time before heat", () => {
    const orderText = buildNewsFeedOrderByExpressions({
      mode: "latest",
    })
      .map(collectSqlDebugText)
      .join(" ");

    expect(orderText.indexOf("publishedAt")).toBeLessThan(
      orderText.indexOf("trendScore"),
    );
  });

  it("orders Trending by heat before publish time", () => {
    const orderText = buildNewsFeedOrderByExpressions({
      mode: "trending",
    })
      .map(collectSqlDebugText)
      .join(" ");

    expect(orderText.indexOf("trendScore")).toBeLessThan(
      orderText.indexOf("publishedAt"),
    );
  });
});

describe("buildNewsFeedCursorCondition", () => {
  it("keeps Latest pagination on the publish-time cursor", () => {
    const condition = buildNewsFeedCursorCondition({
      cursor: "2026-07-01T08:00:00.000Z",
      cursorTrendScore: 86,
      mode: "latest",
    });
    const conditionText = collectSqlDebugText(condition);

    expect(conditionText).toContain("publishedAt");
    expect(conditionText).not.toContain("trendScore");
  });

  it("uses heat and publish time for Trending pagination", () => {
    const condition = buildNewsFeedCursorCondition({
      cursor: "2026-07-01T08:00:00.000Z",
      cursorTrendScore: 86,
      mode: "trending",
    });
    const conditionText = collectSqlDebugText(condition);

    expect(conditionText).toContain("trendScore");
    expect(conditionText).toContain("publishedAt");
  });
});

describe("buildNewsForYouCandidateConditions", () => {
  it("excludes already displayed stories during personalized pagination", () => {
    const condition = buildNewsForYouCandidateConditions({
      input: {
        excludeNewsItemIds: [
          "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
          "c79f62c2-bf96-4f31-b8a6-64b9e9aef16b",
        ],
        limit: 20,
      },
    });
    const conditionText = collectSqlDebugText(condition);

    expect(conditionText).toContain("id");
    expect(conditionText).toContain("not in");
  });
});

describe("getNewsForYouCandidateLimit", () => {
  it("widens server-side personalized candidate recall before reranking", () => {
    expect(getNewsForYouCandidateLimit(1)).toBe(6);
    expect(getNewsForYouCandidateLimit(20)).toBe(120);
    expect(getNewsForYouCandidateLimit(50)).toBe(240);
  });
});

describe("attachNewsRecommendationExplanations", () => {
  it("adds the shared recommendation explanation to server For You rows", () => {
    const [item] = attachNewsRecommendationExplanations(
      [
        {
          ...baseNewsItem,
          matchedSignals: ["category", "entity"],
          personalizedScore: 174,
          publishedAt: "2026-07-01T09:30:00.000Z",
        },
      ],
      new Date("2026-07-01T10:00:00.000Z"),
    );

    expect(item?.recommendation).toEqual({
      badges: [
        "Preferred topic",
        "Followed entity",
        "High heat",
        "Fresh",
        "Strong source",
      ],
      scoreLabel: "174 score",
      summary:
        "Ranked for your topic and entity signals, with high story heat, fresh publication timing, and source credibility.",
    });
  });
});

describe("getNewsCollaborativeSignalScore", () => {
  it("requires at least two distinct readers before cohort lift is trusted", () => {
    expect(
      getNewsCollaborativeSignalScore({
        deepReadCount: 1,
        hideCount: 0,
        readerCount: 1,
        saveCount: 2,
        shareCount: 1,
        sourceClickCount: 1,
      }),
    ).toBe(0);

    expect(
      getNewsCollaborativeSignalScore({
        deepReadCount: 1,
        hideCount: 0,
        readerCount: 2,
        saveCount: 2,
        shareCount: 1,
        sourceClickCount: 1,
      }),
    ).toBeGreaterThan(0);
  });

  it("turns similar-reader Less feedback into a negative collaborative score", () => {
    expect(
      getNewsCollaborativeSignalScore({
        deepReadCount: 0,
        hideCount: 3,
        readerCount: 2,
        saveCount: 0,
        shareCount: 0,
        sourceClickCount: 0,
      }),
    ).toBeLessThan(0);
  });
});

describe("toNewsCollaborativeSignal", () => {
  it("keeps cohort metadata for cross-story collaborative matching", () => {
    expect(
      toNewsCollaborativeSignal({
        category: "agent_product",
        deepReadCount: 1,
        entities: ["Agents"],
        hideCount: 0,
        newsItemId: "candidate-news-item",
        readerCount: 2,
        saveCount: 2,
        shareCount: 1,
        sourceClickCount: 1,
        sourceSlug: "agent-desk",
        tags: ["browser_agent"],
      }),
    ).toEqual({
      category: "agent_product",
      entities: ["Agents"],
      newsItemId: "candidate-news-item",
      score: 10,
      sourceSlug: "agent-desk",
      tags: ["browser_agent"],
    });
  });

  it("keeps story URLs for collaborative URL-variant suppression", () => {
    expect(
      toNewsCollaborativeSignal({
        canonicalUrl: "https://example.com/news/openai-model",
        category: "agent_product",
        deepReadCount: 1,
        entities: ["Agents"],
        hideCount: 0,
        newsItemId: "candidate-news-item",
        originalUrl: "https://example.com/news/openai-model?utm=reader",
        readerCount: 2,
        saveCount: 2,
        shareCount: 1,
        sourceClickCount: 1,
        sourceSlug: "agent-desk",
        tags: ["browser_agent"],
      }),
    ).toEqual({
      canonicalUrl: "https://example.com/news/openai-model",
      category: "agent_product",
      entities: ["Agents"],
      newsItemId: "candidate-news-item",
      originalUrl: "https://example.com/news/openai-model?utm=reader",
      score: 10,
      sourceSlug: "agent-desk",
      tags: ["browser_agent"],
    });
  });

  it("drops cohort rows before the similar-reader threshold is met", () => {
    expect(
      toNewsCollaborativeSignal({
        category: "agent_product",
        deepReadCount: 1,
        entities: ["Agents"],
        hideCount: 0,
        newsItemId: "candidate-news-item",
        readerCount: 1,
        saveCount: 2,
        shareCount: 1,
        sourceClickCount: 1,
        sourceSlug: "agent-desk",
        tags: ["browser_agent"],
      }),
    ).toBeNull();
  });
});

describe("buildNewsCollaborativeSignalCondition", () => {
  it("derives a deterministic seven-day collaborative signal window", () => {
    expect(
      getNewsCollaborativeSignalWindowStart(
        new Date("2026-07-08T12:30:00.000Z"),
      ).toISOString(),
    ).toBe("2026-07-01T12:30:00.000Z");
  });

  it("excludes the current reader profile from collaborative cohort recall", () => {
    const condition = buildNewsCollaborativeSignalCondition({
      candidateNewsItemIds: ["candidate-news-item"],
      currentReaderProfileId: "current-reader-profile",
      since: new Date("2026-07-01T00:00:00.000Z"),
    });
    const sqlText = collectSqlDebugText(condition);

    expect(sqlText).toContain("current-reader-profile");
    expect(sqlText.toLowerCase()).toContain("reader");
  });

  it("keeps anonymous cold-start cohort recall broad", () => {
    const condition = buildNewsCollaborativeSignalCondition({
      candidateNewsItemIds: ["candidate-news-item"],
      currentReaderProfileId: null,
      since: new Date("2026-07-01T00:00:00.000Z"),
    });
    const sqlText = collectSqlDebugText(condition);

    expect(sqlText).not.toContain("current-reader-profile");
  });

  it("recalls similar cohort stories from candidate source, topic, entity, and angle signals", () => {
    const condition = buildNewsCollaborativeSignalCondition({
      candidateCategories: ["agent_product"],
      candidateEntities: ["Agents"],
      candidateNewsItemIds: ["candidate-news-item"],
      candidateSourceSlugs: ["agent-desk"],
      candidateTags: ["browser_agent"],
      currentReaderProfileId: "current-reader-profile",
      since: new Date("2026-07-01T00:00:00.000Z"),
    });
    const sqlText = collectSqlDebugText(condition);

    expect(sqlText).toContain("category");
    expect(sqlText).toContain("entities");
    expect(sqlText).toContain("slug");
    expect(sqlText).toContain("tags");
    expect(sqlText).toContain("&&");
  });

  it("limits cohort recall to meaningful feedback interactions instead of passive exposure", () => {
    const condition = buildNewsCollaborativeSignalCondition({
      candidateNewsItemIds: ["candidate-news-item"],
      currentReaderProfileId: "current-reader-profile",
      since: new Date("2026-07-01T00:00:00.000Z"),
    });
    const sqlText = collectSqlDebugText(condition).toLowerCase();

    expect(sqlText).toContain("hide");
    expect(sqlText).toContain("save");
    expect(sqlText).toContain("share");
    expect(sqlText).toContain("click_source");
    expect(sqlText).toContain("readpercent");
    expect(sqlText).toContain("0.8");
  });

  it("matches legacy cased and padded article read surfaces for collaborative recall", () => {
    const condition = buildNewsCollaborativeSignalCondition({
      candidateNewsItemIds: ["candidate-news-item"],
      currentReaderProfileId: "current-reader-profile",
      since: new Date("2026-07-01T00:00:00.000Z"),
    });
    const sqlText = collectSqlDebugText(condition).toLowerCase();

    expect(sqlText).toContain("trim");
    expect(sqlText).toContain("lower");
    expect(sqlText).toContain("surface");
    expect(sqlText).toContain("article");
  });

  it("keeps collaborative deep-read aggregation on the shared article surface condition", async () => {
    const source = await readFile(
      new URL("./news.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("}->>'surface' = 'article' and coalesce");
    expect(source).toContain("newsArticleSurfaceCondition()} and coalesce");
  });
});

describe("buildNewsHomeExposureDedupeCondition", () => {
  it("derives a deterministic 24-hour home exposure dedupe window", () => {
    expect(
      getNewsHomeExposureDedupeWindowStart(
        new Date("2026-07-02T09:30:00.000Z"),
      ).toISOString(),
    ).toBe("2026-07-01T09:30:00.000Z");
  });

  it("targets one reader, one story, one feed mode, and automatic home exposure views", () => {
    const condition = buildNewsHomeExposureDedupeCondition({
      feedMode: "for_you",
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      readerProfileId: "reader-profile-123",
      since: new Date("2026-07-01T00:00:00.000Z"),
    });
    const sqlText = collectSqlDebugText(condition);

    expect(sqlText).toContain("readerProfileId");
    expect(sqlText).toContain("newsItemId");
    expect(sqlText).toContain("action");
    expect(sqlText).toContain("view");
    expect(sqlText).toContain("exposure");
    expect(sqlText).toContain("home");
    expect(sqlText).toContain("home_exposure");
    expect(sqlText).toContain("feedMode");
    expect(sqlText).toContain("for_you");
  });

  it("matches legacy padded and hyphenated home exposure surfaces during dedupe", () => {
    const condition = buildNewsHomeExposureDedupeCondition({
      feedMode: "for_you",
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      readerProfileId: "reader-profile-123",
      since: new Date("2026-07-01T00:00:00.000Z"),
    });
    const sqlText = collectSqlDebugText(condition);

    expect(sqlText).toContain("trim");
    expect(sqlText).toContain("home-exposure");
  });

  it("keeps feed mode optional for legacy exposure events", () => {
    const condition = buildNewsHomeExposureDedupeCondition({
      feedMode: undefined,
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      readerProfileId: "reader-profile-123",
      since: new Date("2026-07-01T00:00:00.000Z"),
    });

    expect(collectSqlDebugText(condition)).not.toContain("feedMode");
  });
});

describe("buildNewsGuardrailRestoreCondition", () => {
  it("targets only Less feedback for one reader and one story", () => {
    const condition = buildNewsGuardrailRestoreCondition({
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      readerProfileId: "reader-profile-123",
    });
    const sqlText = collectSqlDebugText(condition);

    expect(sqlText).toContain("readerProfileId");
    expect(sqlText).toContain("newsItemId");
    expect(sqlText).toContain("action");
    expect(sqlText).toContain("hide");
    expect(sqlText).not.toContain("save");
  });
});

describe("buildNewsSavedRemovalCondition", () => {
  it("targets only saved feedback for one reader and one story", () => {
    const condition = buildNewsSavedRemovalCondition({
      newsItemId: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
      readerProfileId: "reader-profile-123",
    });
    const sqlText = collectSqlDebugText(condition);

    expect(sqlText).toContain("readerProfileId");
    expect(sqlText).toContain("newsItemId");
    expect(sqlText).toContain("action");
    expect(sqlText).toContain("save");
    expect(sqlText).not.toContain("hide");
  });
});

describe("getNewsReaderProfileResetIdentity", () => {
  it("uses the anonymous visitor key when resetting reader memory without a session", () => {
    expect(
      getNewsReaderProfileResetIdentity({
        userId: undefined,
        visitorKey: "visitor-test-123",
      }),
    ).toEqual({
      readerKey: "visitor:visitor-test-123",
      userId: null,
    });
  });
});

describe("selectNewsSearchCandidateItems", () => {
  it("matches search queries against story tags as fine-grained angles", () => {
    const condition = buildNewsTextSearchCondition("agents");

    expect(collectSqlDebugText(condition)).toContain("tags");
  });

  it("matches readable angle search queries against normalized story tags", () => {
    const condition = buildNewsTextSearchCondition("computer use");
    const sqlText = collectSqlDebugText(condition);

    expect(sqlText).toContain("computer_use");
  });

  it("matches search queries against source names and slugs", () => {
    const condition = buildNewsTextSearchCondition("OpenAI News");
    const sqlText = collectSqlDebugText(condition);

    expect(sqlText).toContain("name");
    expect(sqlText).toContain("slug");
  });

  it("applies source and angle filters before returning search candidates", async () => {
    const source = await readFile(
      new URL("./news.ts", import.meta.url),
      "utf8",
    );

    const conditionStart = source.indexOf(
      "const searchCandidateConditions = (",
    );
    const conditionEnd = source.indexOf(
      "\n\nconst resolveReaderIdentity",
      conditionStart,
    );
    const searchCandidateConditionSource = source.slice(
      conditionStart,
      conditionEnd,
    );

    expect(searchCandidateConditionSource).toContain("input.sourceSlug");
    expect(searchCandidateConditionSource).toContain("tagCondition(input.tag)");
  });

  it("returns renderable card metadata with search candidates", async () => {
    const source = await readFile(
      new URL("./news.ts", import.meta.url),
      "utf8",
    );
    const searchStart = source.indexOf("  searchCandidates: publicProcedure");
    const searchEnd = source.indexOf(
      "\n} satisfies TRPCRouterRecord",
      searchStart,
    );
    const searchCandidatesSource = source.slice(searchStart, searchEnd);

    expect(searchCandidatesSource).toContain("imageUrl: NewsItem.imageUrl");
    expect(searchCandidatesSource).toContain("id: NewsSource.id");
    expect(searchCandidatesSource).toContain(
      "homepageUrl: NewsSource.homepageUrl",
    );
    expect(searchCandidatesSource).toContain(
      "sourceType: NewsSource.sourceType",
    );
    expect(searchCandidatesSource).toContain(
      "credibility: NewsSource.credibility",
    );
  });

  it("deduplicates search result URL variants before limiting candidates", () => {
    const candidates = selectNewsSearchCandidateItems({
      items: [
        {
          ...baseNewsItem,
          id: "search-syndicated-model",
          canonicalUrl: "https://mirror.example/openai-model",
          originalUrl: "https://example.com/openai-model?utm=search",
          sourceScore: 82,
          trendScore: 95,
        },
        {
          ...baseNewsItem,
          id: "search-official-model",
          canonicalUrl: "https://example.com/openai-model",
          originalUrl: "https://example.com/openai-model",
          sourceScore: 96,
          trendScore: 88,
        },
        {
          ...baseNewsItem,
          id: "search-agent-story",
          canonicalUrl: "https://example.com/search-agent-story",
          originalUrl: "https://example.com/search-agent-story",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 88,
          trendScore: 84,
        },
      ],
      limit: 2,
    });

    expect(candidates.map((item) => item.id)).toEqual([
      "search-official-model",
      "search-agent-story",
    ]);
  });
});

describe("summarizeNewsReaderProfileSignals", () => {
  it("explains the positive signals that trained a reader profile", () => {
    expect(
      summarizeNewsReaderProfileSignals({
        interactions: [
          {
            action: "save",
            category: "agent_product",
            entities: ["OpenAI", "Operator"],
            tags: ["agents", "browser"],
            metadata: {},
            occurredAt: "2026-07-01T09:00:00.000Z",
            sourceSlug: "openai-news",
          },
          {
            action: "share",
            category: "agent_product",
            entities: ["OpenAI"],
            tags: ["agents"],
            metadata: {},
            occurredAt: "2026-07-01T08:00:00.000Z",
            sourceSlug: "openai-news",
          },
          {
            action: "view",
            category: "model_release",
            entities: ["Anthropic"],
            tags: ["model"],
            metadata: { readPercent: 0.9, surface: "article" },
            occurredAt: "2026-07-01T07:00:00.000Z",
            sourceSlug: "anthropic-news",
          },
        ],
        profile: {
          noveltyBias: 1.5,
          preferredCategories: ["agent_product", "model_release"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["openai-news"],
          recencyBias: 1.2,
        },
      }),
    ).toEqual({
      averageHomeRankSlot: null,
      ignoredSignalCount: 0,
      negativeSignalCount: 0,
      positiveSignalCount: 3,
      summary:
        "Profile leans toward agent_product and model_release, led by openai-news and OpenAI, driven by shares.",
      topCategories: [
        { key: "agent_product", count: 2 },
        { key: "model_release", count: 1 },
      ],
      topActions: [
        { key: "save", count: 1 },
        { key: "share", count: 1 },
        { key: "view", count: 1 },
      ],
      topEntities: [
        { key: "OpenAI", count: 2 },
        { key: "Operator", count: 1 },
        { key: "Anthropic", count: 1 },
      ],
      topSources: [
        { key: "openai-news", count: 2 },
        { key: "anthropic-news", count: 1 },
      ],
      topSurfaces: [{ key: "article", count: 1 }],
      topTags: [{ key: "browser", count: 1 }],
      topFeedModes: [],
      topMatchedSignals: [],
      trainedSignalCount: 3,
    });
  });

  it("summarizes home ranking context from reader feedback metadata", () => {
    expect(
      summarizeNewsReaderProfileSignals({
        interactions: [
          {
            action: "save",
            category: "agent_product",
            entities: ["OpenAI"],
            tags: ["agents"],
            metadata: {
              feedMode: "for_you",
              matchedSignals: ["category", "semantic_feedback"],
              personalizedScore: 147,
              rankSlot: 0,
              surface: "home",
            },
            occurredAt: "2026-07-01T09:00:00.000Z",
            sourceSlug: "openai-news",
          },
          {
            action: "share",
            category: "agent_product",
            entities: ["OpenAI"],
            tags: ["agents"],
            metadata: {
              feedMode: "for_you",
              matchedSignals: ["category"],
              personalizedScore: 141,
              rankSlot: 2,
              surface: "home",
            },
            occurredAt: "2026-07-01T08:00:00.000Z",
            sourceSlug: "openai-news",
          },
          {
            action: "click_source",
            category: "research",
            entities: ["Benchmarks"],
            tags: ["evals"],
            metadata: {
              feedMode: "latest",
              matchedSignals: ["source"],
              personalizedScore: 128,
              rankSlot: 5,
              surface: "home",
            },
            occurredAt: "2026-07-01T07:00:00.000Z",
            sourceSlug: "research-lab",
          },
        ],
        profile: {
          noveltyBias: 1.5,
          preferredCategories: ["agent_product"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["openai-news"],
          recencyBias: 1.2,
        },
      }),
    ).toMatchObject({
      averageHomeRankSlot: 2.3,
      topFeedModes: [
        { key: "for_you", count: 2 },
        { key: "latest", count: 1 },
      ],
      topMatchedSignals: [
        { key: "category", count: 2 },
        { key: "semantic_feedback", count: 1 },
        { key: "source", count: 1 },
      ],
      trainedSignalCount: 3,
    });
  });

  it("summarizes only specific angle tags as reader-learning tags", () => {
    expect(
      summarizeNewsReaderProfileSignals({
        interactions: [
          {
            action: "save",
            category: "agent_product",
            entities: ["OpenAI"],
            tags: ["agents", "model", "prompt_injection", "browser-use"],
            metadata: {},
            occurredAt: "2026-07-01T09:00:00.000Z",
            sourceSlug: "openai-news",
          },
          {
            action: "view",
            category: "model_release",
            entities: ["Anthropic"],
            tags: ["models", "evals"],
            metadata: { readPercent: 0.9, surface: "article" },
            occurredAt: "2026-07-01T08:00:00.000Z",
            sourceSlug: "anthropic-news",
          },
        ],
        profile: {
          noveltyBias: 1.5,
          preferredCategories: ["agent_product", "model_release"],
          preferredEntities: ["OpenAI", "prompt injection"],
          preferredSources: ["openai-news"],
          recencyBias: 1.2,
        },
      }),
    ).toMatchObject({
      topTags: [
        { key: "prompt injection", count: 1 },
        { key: "browser use", count: 1 },
        { key: "evals", count: 1 },
      ],
      trainedSignalCount: 2,
    });
  });

  it("summarizes reader signal surfaces across home, article, and source actions", () => {
    expect(
      summarizeNewsReaderProfileSignals({
        interactions: [
          {
            action: "save",
            category: "agent_product",
            entities: ["OpenAI"],
            tags: ["agents"],
            metadata: { surface: "home" },
            occurredAt: "2026-07-01T09:00:00.000Z",
            sourceSlug: "openai-news",
          },
          {
            action: "click_source",
            category: "research",
            entities: ["Benchmarks"],
            tags: ["evals"],
            metadata: { surface: "article_source" },
            occurredAt: "2026-07-01T08:00:00.000Z",
            sourceSlug: "research-lab",
          },
          {
            action: "hide",
            category: "hot_take",
            entities: ["Rumor"],
            tags: ["rumor"],
            metadata: { surface: "article_feedback" },
            occurredAt: "2026-07-01T07:00:00.000Z",
            sourceSlug: "hot-takes",
          },
        ],
        profile: {
          noveltyBias: 1,
          preferredCategories: ["agent_product"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["openai-news"],
          recencyBias: 1,
        },
      }),
    ).toMatchObject({
      topActions: [
        { key: "save", count: 1 },
        { key: "click_source", count: 1 },
        { key: "hide", count: 1 },
      ],
      topSurfaces: [
        { key: "home", count: 1 },
        { key: "article_source", count: 1 },
        { key: "article_feedback", count: 1 },
      ],
    });
  });

  it("canonicalizes legacy interaction surfaces before profile audit counts", () => {
    expect(
      summarizeNewsReaderProfileSignals({
        interactions: [
          {
            action: "view",
            category: "model_release",
            entities: ["OpenAI"],
            tags: ["model"],
            metadata: { readPercent: 0.9, surface: " Article " },
            occurredAt: "2026-07-01T09:00:00.000Z",
            sourceSlug: "openai-news",
          },
          {
            action: "click_source",
            category: "research",
            entities: ["Benchmarks"],
            tags: ["evals"],
            metadata: { surface: "article-source" },
            occurredAt: "2026-07-01T08:00:00.000Z",
            sourceSlug: "research-lab",
          },
          {
            action: "save",
            category: "agent_product",
            entities: ["Agents"],
            tags: ["agents"],
            metadata: { surface: "Home Feedback" },
            occurredAt: "2026-07-01T07:00:00.000Z",
            sourceSlug: "agent-desk",
          },
        ],
        profile: {
          noveltyBias: 1,
          preferredCategories: ["model_release"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["openai-news"],
          recencyBias: 1,
        },
      }).topSurfaces,
    ).toEqual([
      { key: "article", count: 1 },
      { key: "article_source", count: 1 },
      { key: "home_feedback", count: 1 },
    ]);
  });

  it("keeps rank slot audit for specific home interaction surfaces", () => {
    expect(
      summarizeNewsReaderProfileSignals({
        interactions: [
          {
            action: "save",
            category: "agent_product",
            entities: ["OpenAI"],
            tags: ["agents"],
            metadata: { rankSlot: 1, surface: "home_feedback" },
            occurredAt: "2026-07-01T09:00:00.000Z",
            sourceSlug: "openai-news",
          },
          {
            action: "click_source",
            category: "research",
            entities: ["Benchmarks"],
            tags: ["evals"],
            metadata: { rankSlot: 3, surface: "home_source" },
            occurredAt: "2026-07-01T08:00:00.000Z",
            sourceSlug: "research-lab",
          },
        ],
        profile: {
          noveltyBias: 1,
          preferredCategories: ["agent_product"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["openai-news"],
          recencyBias: 1,
        },
      }).averageHomeRankSlot,
    ).toBe(2);
  });

  it("keeps mobile home feedback rank slots in the reader audit", () => {
    expect(
      summarizeNewsReaderProfileSignals({
        interactions: [
          {
            action: "save",
            category: "agent_product",
            entities: ["OpenAI"],
            tags: ["agents"],
            metadata: { rankSlot: 4, surface: "mobile_home" },
            occurredAt: "2026-07-01T09:00:00.000Z",
            sourceSlug: "openai-news",
          },
          {
            action: "hide",
            category: "research",
            entities: ["Benchmarks"],
            tags: ["evals"],
            metadata: { rankSlot: 8, surface: "mobile-home" },
            occurredAt: "2026-07-01T08:00:00.000Z",
            sourceSlug: "research-lab",
          },
        ],
        profile: {
          noveltyBias: 1,
          preferredCategories: ["agent_product"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["openai-news"],
          recencyBias: 1,
        },
      }).averageHomeRankSlot,
    ).toBe(6);
  });

  it("canonicalizes legacy matched signal metadata before profile audit counts", () => {
    expect(
      summarizeNewsReaderProfileSignals({
        interactions: [
          {
            action: "save",
            category: "model_release",
            entities: ["OpenAI"],
            tags: ["model"],
            metadata: {
              matchedSignals: [
                " Negative Feedback ",
                "negative-feedback",
                "Source Trust",
                "source-trust",
              ],
              surface: "home_feedback",
            },
            occurredAt: "2026-07-01T09:00:00.000Z",
            sourceSlug: "openai-news",
          },
        ],
        profile: {
          noveltyBias: 1,
          preferredCategories: ["model_release"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["openai-news"],
          recencyBias: 1,
        },
      }).topMatchedSignals,
    ).toEqual([
      { key: "negative_feedback", count: 1 },
      { key: "source_trust", count: 1 },
    ]);
  });

  it("separates ignored exposure signals and negative feedback from training", () => {
    expect(
      summarizeNewsReaderProfileSignals({
        interactions: [
          {
            action: "view",
            category: "funding",
            entities: ["Series A"],
            tags: ["startup"],
            metadata: { exposure: true, surface: "home" },
            occurredAt: "2026-07-01T09:00:00.000Z",
            sourceSlug: "venturewire",
          },
          {
            action: "view",
            category: "funding",
            entities: ["Series A"],
            tags: ["startup"],
            metadata: { readPercent: 0.2, surface: "article" },
            occurredAt: "2026-07-01T08:00:00.000Z",
            sourceSlug: "venturewire",
          },
          {
            action: "hide",
            category: "hot_take",
            entities: ["Rumor"],
            tags: ["rumor"],
            metadata: {},
            occurredAt: "2026-07-01T07:00:00.000Z",
            sourceSlug: "hot-takes",
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
    ).toMatchObject({
      averageHomeRankSlot: null,
      ignoredSignalCount: 2,
      negativeSignalCount: 1,
      positiveSignalCount: 0,
      summary:
        "Profile is guarding against Less feedback while recent exposure or low-depth reads stay out of training.",
      topCategories: [],
      topActions: [
        { key: "view", count: 2 },
        { key: "hide", count: 1 },
      ],
      topEntities: [],
      topFeedModes: [],
      topMatchedSignals: [],
      topSources: [],
      topTags: [],
      trainedSignalCount: 0,
    });
  });
});

describe("buildNewsReaderProfileResponse", () => {
  it("returns the default learning audit for an anonymous reader without a persisted profile", () => {
    expect(
      buildNewsReaderProfileResponse({
        interactions: [],
        persisted: false,
        profile: {
          noveltyBias: 1,
          preferredCategories: ["model_release", "agent_product", "funding"],
          preferredEntities: [],
          preferredSources: [],
          recencyBias: 1,
        },
      }),
    ).toEqual({
      audit: {
        averageHomeRankSlot: null,
        ignoredSignalCount: 0,
        negativeSignalCount: 0,
        positiveSignalCount: 0,
        summary:
          "Profile is still learning from the next meaningful read, save, share, or source click.",
        topActions: [],
        topCategories: [],
        topEntities: [],
        topFeedModes: [],
        topMatchedSignals: [],
        topSources: [],
        topSurfaces: [],
        topTags: [],
        trainedSignalCount: 0,
      },
      noveltyBias: 1,
      persisted: false,
      preferredCategories: ["model_release", "agent_product", "funding"],
      preferredEntities: [],
      preferredSources: [],
      recencyBias: 1,
    });
  });

  it("attaches the reader signal audit to a persisted profile response", () => {
    expect(
      buildNewsReaderProfileResponse({
        interactions: [
          {
            action: "save",
            category: "agent_product",
            entities: ["OpenAI"],
            tags: ["agents"],
            metadata: {},
            occurredAt: "2026-07-01T09:00:00.000Z",
            sourceSlug: "openai-news",
          },
          {
            action: "view",
            category: "funding",
            entities: ["Series A"],
            tags: ["startup"],
            metadata: { exposure: true, surface: "home" },
            occurredAt: "2026-07-01T08:00:00.000Z",
            sourceSlug: "venturewire",
          },
        ],
        persisted: true,
        profile: {
          noveltyBias: 1.4,
          preferredCategories: ["agent_product"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["openai-news"],
          recencyBias: 1.1,
        },
      }),
    ).toMatchObject({
      audit: {
        ignoredSignalCount: 1,
        positiveSignalCount: 1,
        summary:
          "Profile leans toward agent_product, led by openai-news and OpenAI, driven by saves.",
        topActions: [
          { key: "save", count: 1 },
          { key: "view", count: 1 },
        ],
        topCategories: [{ key: "agent_product", count: 1 }],
        topSources: [{ key: "openai-news", count: 1 }],
        topTags: [],
        trainedSignalCount: 1,
      },
      persisted: true,
      preferredCategories: ["agent_product"],
      preferredEntities: ["OpenAI"],
      preferredSources: ["openai-news"],
    });
  });
});

describe("buildNewsReaderMutationProfileResponse", () => {
  it("returns an audited profile response for the interaction just recorded", () => {
    expect(
      buildNewsReaderMutationProfileResponse({
        interaction: {
          action: "save",
          category: "agent_product",
          entities: ["OpenAI", "Agents"],
          tags: ["agent"],
          metadata: {
            feedMode: "for_you",
            matchedSignals: ["category", "entity"],
            rankSlot: 2,
            surface: "home",
          },
          occurredAt: "2026-07-01T10:00:00.000Z",
          sourceSlug: "openai-news",
        },
        profile: {
          noveltyBias: 1.3,
          preferredCategories: ["agent_product"],
          preferredEntities: ["OpenAI", "Agents"],
          preferredSources: ["openai-news"],
          recencyBias: 1.3,
        },
      }),
    ).toMatchObject({
      audit: {
        averageHomeRankSlot: 2,
        positiveSignalCount: 1,
        summary:
          "Profile leans toward agent_product, led by openai-news and OpenAI, driven by saves.",
        topActions: [{ count: 1, key: "save" }],
        topCategories: [{ count: 1, key: "agent_product" }],
        topEntities: [
          { count: 1, key: "OpenAI" },
          { count: 1, key: "Agents" },
        ],
        topFeedModes: [{ count: 1, key: "for_you" }],
        topMatchedSignals: [
          { count: 1, key: "category" },
          { count: 1, key: "entity" },
        ],
        topSources: [{ count: 1, key: "openai-news" }],
        topTags: [],
        trainedSignalCount: 1,
      },
      persisted: true,
      preferredCategories: ["agent_product"],
    });
  });

  it("returns a cold audited profile response for manual updates without an interaction", () => {
    expect(
      buildNewsReaderMutationProfileResponse({
        profile: {
          noveltyBias: 1,
          preferredCategories: ["model_release"],
          preferredEntities: [],
          preferredSources: [],
          recencyBias: 1,
        },
      }),
    ).toMatchObject({
      audit: {
        ignoredSignalCount: 0,
        positiveSignalCount: 0,
        summary:
          "Profile is still learning from the next meaningful read, save, share, or source click.",
        trainedSignalCount: 0,
      },
      persisted: true,
      preferredCategories: ["model_release"],
    });
  });
});

describe("buildNewsInteractionTrainingMetadata", () => {
  it("stores trusted profile snapshots while preserving ranking metadata", () => {
    expect(
      buildNewsInteractionTrainingMetadata({
        metadata: {
          matchedSignals: ["category"],
          profileAfter: { stale: true },
          profileBefore: { stale: true },
          rankSlot: 2,
          surface: "home",
        },
        profileAfter: {
          noveltyBias: 1.3,
          preferredCategories: ["agent_product"],
          preferredEntities: ["OpenAI"],
          preferredSources: ["openai-news"],
          recencyBias: 1.3,
        },
        profileBefore: {
          noveltyBias: 2.5,
          preferredCategories: [" model_release ", "MODEL_RELEASE"],
          preferredEntities: [" prompt_injection ", "Prompt Injection"],
          preferredSources: [" OpenAI-News "],
          recencyBias: -1,
        },
      }),
    ).toEqual({
      matchedSignals: ["category"],
      profileAfter: {
        noveltyBias: 1.3,
        preferredCategories: ["agent_product"],
        preferredEntities: ["OpenAI"],
        preferredSources: ["openai-news"],
        recencyBias: 1.3,
      },
      profileBefore: {
        noveltyBias: 2,
        preferredCategories: ["model_release"],
        preferredEntities: ["prompt_injection"],
        preferredSources: ["OpenAI-News"],
        recencyBias: 0,
      },
      rankSlot: 2,
      surface: "home",
    });
  });
});

describe("rebuildNewsPreferenceProfileFromInteractions", () => {
  it("replays remaining reader interactions in chronological order", () => {
    const profile = rebuildNewsPreferenceProfileFromInteractions({
      baseProfile: {
        noveltyBias: 1,
        preferredCategories: [],
        preferredEntities: [],
        preferredSources: [],
        recencyBias: 1,
      },
      interactions: [
        {
          action: "hide",
          category: "model_release",
          entities: ["OpenAI"],
          tags: ["prompt_injection"],
          metadata: {},
          occurredAt: "2026-07-01T10:00:00.000Z",
          sourceSlug: "openai-news",
        },
        {
          action: "save",
          category: "model_release",
          entities: ["OpenAI"],
          tags: ["prompt_injection"],
          metadata: {},
          occurredAt: "2026-07-01T09:00:00.000Z",
          sourceSlug: "openai-news",
        },
        {
          action: "view",
          category: "funding",
          entities: ["Series A"],
          tags: ["funding_round"],
          metadata: { readPercent: 0.2, surface: "article" },
          occurredAt: "2026-07-01T11:00:00.000Z",
          sourceSlug: "venturewire",
        },
        {
          action: "save",
          category: "agent_product",
          entities: ["Anthropic"],
          tags: ["workflow_automation"],
          metadata: {},
          occurredAt: "2026-07-01T12:00:00.000Z",
          sourceSlug: "agent-desk",
        },
      ],
    });

    expect(profile.preferredCategories).toEqual([
      "model_release",
      "agent_product",
    ]);
    expect(profile.preferredSources).toEqual(["agent-desk"]);
    expect(profile.preferredEntities).toEqual([
      "Anthropic",
      "workflow automation",
    ]);
    expect(profile.noveltyBias).toBeGreaterThan(1);
    expect(profile.recencyBias).toBeGreaterThan(1);
  });
});

describe("buildNewsPreferenceRollbackAfterInteractionRemoval", () => {
  it("rolls back a removed interaction when the snapshot chain still matches the current profile", () => {
    const baseProfile = {
      noveltyBias: 1,
      preferredCategories: [],
      preferredEntities: [],
      preferredSources: [],
      recencyBias: 1,
    };
    const removedInteraction = {
      action: "save",
      category: "model_release",
      entities: ["OpenAI"],
      tags: ["prompt_injection"],
      metadata: {},
      occurredAt: "2026-07-01T09:00:00.000Z",
      sourceSlug: "openai-news",
    } as const;
    const remainingInteraction = {
      action: "save",
      category: "agent_product",
      entities: ["Anthropic"],
      tags: ["workflow_automation"],
      metadata: {},
      occurredAt: "2026-07-01T10:00:00.000Z",
      sourceSlug: "agent-desk",
    } as const;
    const profileAfterRemoved = rebuildNewsPreferenceProfileFromInteractions({
      baseProfile,
      interactions: [removedInteraction],
    });
    const currentProfile = rebuildNewsPreferenceProfileFromInteractions({
      baseProfile,
      interactions: [removedInteraction, remainingInteraction],
    });

    const rollbackProfile = buildNewsPreferenceRollbackAfterInteractionRemoval({
      currentProfile,
      remainingInteractions: [
        {
          ...remainingInteraction,
          metadata: buildNewsInteractionTrainingMetadata({
            metadata: {},
            profileAfter: currentProfile,
            profileBefore: profileAfterRemoved,
          }),
        },
      ],
      removedInteraction: {
        ...removedInteraction,
        metadata: buildNewsInteractionTrainingMetadata({
          metadata: {},
          profileAfter: profileAfterRemoved,
          profileBefore: baseProfile,
        }),
      },
    });

    expect(rollbackProfile).toMatchObject({
      preferredCategories: ["agent_product"],
      preferredEntities: ["Anthropic", "workflow automation"],
      preferredSources: ["agent-desk"],
    });
  });

  it("refuses rollback when the current profile no longer matches the snapshot chain", () => {
    const baseProfile = {
      noveltyBias: 1,
      preferredCategories: [],
      preferredEntities: [],
      preferredSources: [],
      recencyBias: 1,
    };
    const removedInteraction = {
      action: "save",
      category: "model_release",
      entities: ["OpenAI"],
      tags: ["prompt_injection"],
      metadata: {},
      occurredAt: "2026-07-01T09:00:00.000Z",
      sourceSlug: "openai-news",
    } as const;
    const profileAfterRemoved = rebuildNewsPreferenceProfileFromInteractions({
      baseProfile,
      interactions: [removedInteraction],
    });

    expect(
      buildNewsPreferenceRollbackAfterInteractionRemoval({
        currentProfile: {
          ...profileAfterRemoved,
          preferredCategories: ["model_release", "funding"],
        },
        remainingInteractions: [],
        removedInteraction: {
          ...removedInteraction,
          metadata: buildNewsInteractionTrainingMetadata({
            metadata: {},
            profileAfter: profileAfterRemoved,
            profileBefore: baseProfile,
          }),
        },
      }),
    ).toBeNull();
  });
});

describe("buildNewsReaderProfileAfterInteractionRemoval", () => {
  it("uses the rollback profile when stored snapshots still match the current profile", () => {
    const baseProfile = {
      noveltyBias: 1,
      preferredCategories: [],
      preferredEntities: [],
      preferredSources: [],
      recencyBias: 1,
    };
    const removedInteraction = {
      action: "save",
      category: "model_release",
      entities: ["OpenAI"],
      tags: ["prompt_injection"],
      metadata: {},
      occurredAt: "2026-07-01T09:00:00.000Z",
      sourceSlug: "openai-news",
    } as const;
    const remainingInteraction = {
      action: "save",
      category: "agent_product",
      entities: ["Anthropic"],
      tags: ["workflow_automation"],
      metadata: {},
      occurredAt: "2026-07-01T10:00:00.000Z",
      sourceSlug: "agent-desk",
    } as const;
    const profileAfterRemoved = rebuildNewsPreferenceProfileFromInteractions({
      baseProfile,
      interactions: [removedInteraction],
    });
    const currentProfile = rebuildNewsPreferenceProfileFromInteractions({
      baseProfile,
      interactions: [removedInteraction, remainingInteraction],
    });

    const nextProfile = buildNewsReaderProfileAfterInteractionRemoval({
      currentProfile,
      remainingInteractions: [
        {
          ...remainingInteraction,
          metadata: buildNewsInteractionTrainingMetadata({
            metadata: {},
            profileAfter: currentProfile,
            profileBefore: profileAfterRemoved,
          }),
        },
      ],
      removedInteraction: {
        ...removedInteraction,
        metadata: buildNewsInteractionTrainingMetadata({
          metadata: {},
          profileAfter: profileAfterRemoved,
          profileBefore: baseProfile,
        }),
      },
    });

    expect(nextProfile).toMatchObject({
      preferredCategories: ["agent_product"],
      preferredEntities: ["Anthropic", "workflow automation"],
      preferredSources: ["agent-desk"],
    });
  });

  it("keeps the current profile when rollback snapshots are missing or stale", () => {
    const currentProfile = {
      noveltyBias: 1.3,
      preferredCategories: ["model_release"],
      preferredEntities: ["OpenAI", "prompt injection"],
      preferredSources: ["openai-news"],
      recencyBias: 1.3,
    };

    expect(
      buildNewsReaderProfileAfterInteractionRemoval({
        currentProfile,
        remainingInteractions: [],
        removedInteraction: {
          action: "save",
          category: "model_release",
          entities: ["OpenAI"],
          tags: ["prompt_injection"],
          metadata: {},
          occurredAt: "2026-07-01T09:00:00.000Z",
          sourceSlug: "openai-news",
        },
      }),
    ).toEqual(currentProfile);
  });
});

describe("selectNewsForYouItems", () => {
  it("applies hidden, dedupe, ranking, diversity, and fatigue balancing for server feeds", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: ["hidden-rumor"],
      hiddenNewsItems: [
        {
          ...baseNewsItem,
          id: "hidden-rumor",
          canonicalUrl: "https://example.com/hidden-rumor",
          title: "Hidden rumor should not appear",
          category: "hot_take",
          sourceName: "Rumor Desk",
          sourceSlug: "rumor-desk",
        },
      ],
      items: [
        {
          ...baseNewsItem,
          id: "openai-model-lead",
        },
        {
          ...baseNewsItem,
          id: "openai-funding-follow",
          title: "OpenAI backs new agent startups",
          canonicalUrl: "https://example.com/openai-funding",
          category: "funding",
          tags: ["funding"],
          entities: ["OpenAI", "Series A"],
          sourceScore: 86,
          trendScore: 84,
        },
        {
          ...baseNewsItem,
          id: "anthropic-model-follow",
          title: "Anthropic model notes arrive",
          canonicalUrl: "https://example.com/model-follow",
          entities: ["Anthropic"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 84,
          trendScore: 82,
        },
        {
          ...baseNewsItem,
          id: "agent-product-alternate",
          title: "Agent workflow launch gains traction",
          canonicalUrl: "https://example.com/agent-product",
          category: "agent_product",
          tags: ["workflow"],
          entities: ["Agents"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 80,
          trendScore: 95,
        },
        {
          ...baseNewsItem,
          id: "duplicate-weaker",
          canonicalUrl: "https://example.com/openai-model-lead?utm=feed",
          sourceScore: 70,
          trendScore: 60,
        },
        {
          ...baseNewsItem,
          id: "hidden-rumor",
          canonicalUrl: "https://example.com/hidden-rumor",
          title: "Hidden rumor should not appear",
          category: "hot_take",
          sourceName: "Rumor Desk",
          sourceSlug: "rumor-desk",
        },
      ],
      limit: 4,
      now: new Date("2026-07-01T09:00:00.000Z"),
      profile: {
        preferredCategories: ["model_release", "funding"],
        preferredSources: ["openai-news"],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1.2,
        recencyBias: 1.1,
      },
      negativeFeedbackItems: [],
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "openai-model-lead",
      "agent-product-alternate",
      "openai-funding-follow",
      "anthropic-model-follow",
    ]);
    expect(feed.map((item) => item.id)).not.toContain("duplicate-weaker");
    expect(feed.map((item) => item.id)).not.toContain("hidden-rumor");
  });

  it("returns an empty server feed when every candidate is hidden", () => {
    expect(
      selectNewsForYouItems({
        hiddenNewsItemIds: ["openai-model-lead"],
        items: [baseNewsItem],
        limit: 4,
        now: new Date("2026-07-01T09:00:00.000Z"),
        profile: {
          preferredCategories: [],
          preferredSources: [],
          preferredEntities: [],
          noveltyBias: 1,
          recencyBias: 1,
        },
        hiddenNewsItems: [baseNewsItem],
        negativeFeedbackItems: [],
        viewedNewsItemIds: [],
      }),
    ).toEqual([]);
  });

  it("moves viewed server recommendations behind unseen candidates", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "read-model",
          canonicalUrl: "https://example.com/read-model",
          trendScore: 95,
        },
        {
          ...baseNewsItem,
          id: "fresh-agent",
          canonicalUrl: "https://example.com/fresh-agent",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          trendScore: 85,
        },
        {
          ...baseNewsItem,
          id: "fresh-funding",
          canonicalUrl: "https://example.com/fresh-funding",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          trendScore: 80,
        },
      ],
      limit: 3,
      now: new Date("2026-07-01T09:00:00.000Z"),
      profile: {
        preferredCategories: ["model_release"],
        preferredSources: ["openai-news"],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1,
        recencyBias: 1,
      },
      negativeFeedbackItems: [],
      viewedNewsItemIds: ["read-model"],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "fresh-agent",
      "fresh-funding",
      "read-model",
    ]);
  });

  it("lifts server recommendations with semantic similarity to positive feedback", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "generic-fresh-funding",
          canonicalUrl: "https://example.com/generic-fresh-funding",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          trendScore: 86,
        },
        {
          ...baseNewsItem,
          id: "semantic-agent-follow-up",
          canonicalUrl: "https://example.com/semantic-agent-follow-up",
          category: "research",
          entities: ["Agents"],
          sourceName: "Research Lab",
          sourceSlug: "research-lab",
          sourceScore: 86,
          trendScore: 78,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      semanticMatches: [
        {
          newsItemId: "semantic-agent-follow-up",
          similarity: 0.98,
          strength: 3,
        },
      ],
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "semantic-agent-follow-up",
      "generic-fresh-funding",
    ]);
    expect(feed[0]?.matchedSignals).toContain("semantic_feedback");
  });

  it("lifts weak server recommendations from collaborative reader signals", () => {
    const feed = selectNewsForYouItems({
      collaborativeSignals: [
        {
          newsItemId: "crowd-backed-research",
          score: 6,
        },
      ],
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "personal-model-match",
          canonicalUrl: "https://example.com/personal-model-match",
          sourceScore: 90,
          trendScore: 84,
        },
        {
          ...baseNewsItem,
          id: "generic-market-story",
          canonicalUrl: "https://example.com/generic-market-story",
          category: "market_map",
          entities: ["Market"],
          sourceName: "Market Desk",
          sourceSlug: "market-desk",
          sourceScore: 84,
          trendScore: 88,
        },
        {
          ...baseNewsItem,
          id: "crowd-backed-research",
          canonicalUrl: "https://example.com/crowd-backed-research",
          category: "research",
          entities: ["Benchmarks"],
          sourceName: "Research Lab",
          sourceSlug: "research-lab",
          sourceScore: 86,
          trendScore: 78,
        },
      ],
      limit: 3,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [],
      profile: {
        preferredCategories: ["model_release"],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "personal-model-match",
      "crowd-backed-research",
      "generic-market-story",
    ]);
    expect(feed[1]?.matchedSignals).toContain("collaborative_feedback");
  });

  it("moves server recommendations with viewed canonical or original URLs behind unseen candidates", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "viewed-syndicated-model",
          canonicalUrl: "https://mirror.example/openai-model",
          originalUrl: "https://example.com/openai-model?utm=feed",
          sourceScore: 88,
          trendScore: 95,
        },
        {
          ...baseNewsItem,
          id: "fresh-agent",
          canonicalUrl: "https://example.com/fresh-agent",
          originalUrl: "https://example.com/fresh-agent",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 84,
          trendScore: 85,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      profile: {
        preferredCategories: ["model_release"],
        preferredSources: ["openai-news"],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: ["viewed-model"],
      viewedNewsItems: [
        {
          canonicalUrl: "https://example.com/openai-model",
          category: "model_release",
          entities: ["OpenAI"],
          originalUrl: "https://example.com/openai-model",
          sourceSlug: "openai-news",
        },
      ],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "fresh-agent",
      "viewed-syndicated-model",
    ]);
  });

  it("cools down paraphrased cross-source stories after home exposure", () => {
    const viewedNewsItems = [
      {
        canonicalUrl: "https://wire.example/openai-gpt5-agents",
        category: "model_release",
        entities: ["OpenAI"],
        originalUrl: "https://wire.example/openai-gpt5-agents?utm=feed",
        sourceSlug: "wire",
        surface: "home",
        title: "OpenAI releases GPT-5 for agent workflows",
      },
    ];
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "official-gpt5-launch",
          title: "GPT-5 arrives as OpenAI agent workflow tools",
          canonicalUrl: "https://openai.com/news/gpt5-agent-workflow-tools",
          originalUrl: "https://openai.com/news/gpt5-agent-workflow-tools",
          sourceSlug: "openai-news",
          sourceScore: 96,
          trendScore: 96,
        },
        {
          ...baseNewsItem,
          id: "fresh-voice-model",
          title: "OpenAI updates GPT-4o voice model",
          canonicalUrl: "https://openai.com/news/gpt4o-voice-model",
          originalUrl: "https://openai.com/news/gpt4o-voice-model",
          sourceSlug: "openai-news",
          sourceScore: 94,
          trendScore: 82,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
      viewedNewsItems,
    });

    expect(feed.map((item) => item.id)).toEqual([
      "fresh-voice-model",
      "official-gpt5-launch",
    ]);
    expect(feed[1]?.matchedSignals).toContain("home_exposure_cooldown");
  });

  it("cools down server recommendations matching recent reading exposure", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "same-source-follow-up",
          canonicalUrl: "https://example.com/same-source-follow-up",
          sourceScore: 82,
          trendScore: 84,
        },
        {
          ...baseNewsItem,
          id: "same-entity-analysis",
          canonicalUrl: "https://example.com/same-entity-analysis",
          entities: ["OpenAI", "Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 88,
          trendScore: 82,
        },
        {
          ...baseNewsItem,
          id: "fresh-market-angle",
          canonicalUrl: "https://example.com/fresh-market-angle",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          trendScore: 78,
        },
      ],
      limit: 3,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
      viewedNewsItems: [
        {
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
        },
      ],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "fresh-market-angle",
      "same-source-follow-up",
      "same-entity-analysis",
    ]);
    expect(feed[1]?.matchedSignals).toContain("exposure_cooldown");
  });

  it("cools down server recommendations matching recent reading exposure tags", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "same-agent-angle",
          canonicalUrl: "https://example.com/same-agent-angle",
          category: "research",
          entities: ["Benchmarks"],
          sourceName: "Research Lab",
          sourceSlug: "research-lab",
          tags: ["agents"],
          trendScore: 86,
        },
        {
          ...baseNewsItem,
          id: "fresh-market-angle",
          canonicalUrl: "https://example.com/fresh-market-angle",
          category: "market_map",
          entities: ["AI market"],
          sourceName: "Market Map",
          sourceSlug: "market-map",
          tags: ["enterprise"],
          trendScore: 76,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: ["agents"],
        noveltyBias: 0,
        recencyBias: 0,
      },
      viewedNewsItemIds: [],
      viewedNewsItems: [
        {
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
          tags: ["agents"],
        },
      ],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "fresh-market-angle",
      "same-agent-angle",
    ]);
    expect(feed[1]?.matchedSignals).toContain("exposure_cooldown");
  });

  it("does not cool down server recommendations from stale reading exposure", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "same-source-return",
          canonicalUrl: "https://example.com/same-source-return",
          sourceScore: 90,
          trendScore: 86,
        },
        {
          ...baseNewsItem,
          id: "fresh-market-angle",
          canonicalUrl: "https://example.com/fresh-market-angle",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          trendScore: 80,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2999-01-02T01:00:00.000Z"),
      positiveFeedbackItems: [],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
      viewedNewsItems: [
        {
          category: "model_release",
          entities: ["OpenAI"],
          occurredAt: "2999-01-01T00:00:00.000Z",
          sourceSlug: "openai-news",
        },
      ],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "same-source-return",
      "fresh-market-angle",
    ]);
    expect(feed[0]?.matchedSignals).not.toContain("exposure_cooldown");
  });

  it("keeps deep preference server matches ahead of generic fresh angles", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "deep-preference-model-follow-up",
          canonicalUrl: "https://example.com/deep-preference-model-follow-up",
          sourceScore: 92,
          trendScore: 86,
        },
        {
          ...baseNewsItem,
          id: "fresh-but-unmatched-market-angle",
          canonicalUrl: "https://example.com/fresh-but-unmatched-market-angle",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          trendScore: 80,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [],
      profile: {
        preferredCategories: ["model_release"],
        preferredSources: ["openai-news"],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
      viewedNewsItems: [
        {
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
        },
      ],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "deep-preference-model-follow-up",
      "fresh-but-unmatched-market-angle",
    ]);
    expect(feed[0]?.matchedSignals).toContain("deep_preference");
  });

  it("promotes high-trust breaking server stories before ordinary recommendations", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "ordinary-ranked-lead",
          canonicalUrl: "https://example.com/ordinary-ranked-lead",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          trendScore: 82,
        },
        {
          ...baseNewsItem,
          id: "breaking-model-update",
          canonicalUrl: "https://example.com/breaking-model-update",
          publishedAt: "2026-07-01T08:45:00.000Z",
          sourceScore: 94,
          trendScore: 97,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [],
      profile: {
        preferredCategories: ["funding"],
        preferredSources: ["venturewire"],
        preferredEntities: ["Series A"],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
      viewedNewsItems: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "breaking-model-update",
      "ordinary-ranked-lead",
    ]);
    expect(feed[0]?.matchedSignals).toContain("breaking_news");
  });

  it("inserts a discovery story near the top of an over-personalized server feed", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "matched-model-lead",
          canonicalUrl: "https://example.com/matched-model-lead",
          sourceScore: 86,
          trendScore: 86,
        },
        {
          ...baseNewsItem,
          id: "matched-funding-lead",
          canonicalUrl: "https://example.com/matched-funding-lead",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 85,
          trendScore: 84,
        },
        {
          ...baseNewsItem,
          id: "matched-agent-lead",
          canonicalUrl: "https://example.com/matched-agent-lead",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 84,
          trendScore: 82,
        },
        {
          ...baseNewsItem,
          id: "matched-research-lead",
          canonicalUrl: "https://example.com/matched-research-lead",
          category: "research",
          entities: ["Benchmarks"],
          sourceName: "Research Lab",
          sourceSlug: "research-lab",
          sourceScore: 83,
          trendScore: 80,
        },
        {
          ...baseNewsItem,
          id: "matched-market-map-lead",
          canonicalUrl: "https://example.com/matched-market-map-lead",
          category: "market_map",
          entities: ["YC"],
          sourceName: "Market Map",
          sourceSlug: "market-map",
          sourceScore: 82,
          trendScore: 78,
        },
        {
          ...baseNewsItem,
          id: "qualified-discovery-story",
          canonicalUrl: "https://example.com/qualified-discovery-story",
          category: "open_source",
          entities: ["OSS"],
          sourceName: "OSS Radar",
          sourceSlug: "oss-radar",
          sourceScore: 88,
          trendScore: 74,
        },
      ],
      limit: 6,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [],
      profile: {
        preferredCategories: [
          "model_release",
          "funding",
          "agent_product",
          "research",
          "market_map",
        ],
        preferredSources: [
          "openai-news",
          "venturewire",
          "agent-desk",
          "research-lab",
          "market-map",
        ],
        preferredEntities: ["OpenAI", "Series A", "Agents", "Benchmarks"],
        noveltyBias: 1.5,
        recencyBias: 1.5,
      },
      viewedNewsItemIds: [],
      viewedNewsItems: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "matched-model-lead",
      "matched-funding-lead",
      "matched-agent-lead",
      "qualified-discovery-story",
      "matched-research-lead",
      "matched-market-map-lead",
    ]);
    expect(feed[3]?.matchedSignals).toContain("discovery_slot");
  });

  it("moves server recommendations similar to hidden feedback behind unrelated candidates", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: ["hidden-openai-model"],
      hiddenNewsItems: [
        {
          ...baseNewsItem,
          id: "hidden-openai-model",
        },
      ],
      items: [
        {
          ...baseNewsItem,
          id: "same-source-follow-up",
          canonicalUrl: "https://example.com/same-source-follow-up",
          entities: ["Anthropic"],
          trendScore: 95,
        },
        {
          ...baseNewsItem,
          id: "unrelated-agent-story",
          canonicalUrl: "https://example.com/unrelated-agent-story",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          trendScore: 84,
        },
        {
          ...baseNewsItem,
          id: "shared-entity-follow-up",
          canonicalUrl: "https://example.com/shared-entity-follow-up",
          category: "funding",
          entities: ["OpenAI", "Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          trendScore: 90,
        },
      ],
      limit: 3,
      negativeFeedbackItems: [
        {
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
        },
      ],
      now: new Date("2026-07-01T09:00:00.000Z"),
      profile: {
        preferredCategories: ["model_release", "funding"],
        preferredSources: ["openai-news"],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "unrelated-agent-story",
      "same-source-follow-up",
      "shared-entity-follow-up",
    ]);
  });

  it("moves server recommendations sharing hidden tags behind unrelated candidates", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: ["hidden-agent-angle"],
      hiddenNewsItems: [
        {
          ...baseNewsItem,
          id: "hidden-agent-angle",
          tags: ["agents"],
        },
      ],
      items: [
        {
          ...baseNewsItem,
          id: "shared-agent-angle",
          canonicalUrl: "https://example.com/shared-agent-angle",
          category: "research",
          entities: ["Benchmarks"],
          sourceName: "Research Lab",
          sourceSlug: "research-lab",
          tags: ["agents"],
          trendScore: 96,
        },
        {
          ...baseNewsItem,
          id: "fresh-market-angle",
          canonicalUrl: "https://example.com/fresh-market-angle",
          category: "market_map",
          entities: ["AI market"],
          sourceName: "Market Map",
          sourceSlug: "market-map",
          tags: ["enterprise"],
          trendScore: 78,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [
        {
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
          tags: ["agents"],
        },
      ],
      now: new Date("2026-07-01T09:00:00.000Z"),
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: ["agents"],
        noveltyBias: 0,
        recencyBias: 0,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "fresh-market-angle",
      "shared-agent-angle",
    ]);
    expect(feed[1]?.matchedSignals).toContain("negative_feedback");
  });

  it("does not suppress server recommendations from stale hidden feedback", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "same-source-follow-up",
          canonicalUrl: "https://example.com/same-source-follow-up",
          entities: ["Anthropic"],
          trendScore: 84,
        },
        {
          ...baseNewsItem,
          id: "unrelated-agent-story",
          canonicalUrl: "https://example.com/unrelated-agent-story",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          trendScore: 82,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [
        {
          category: "model_release",
          entities: ["OpenAI"],
          occurredAt: "2026-05-01T09:00:00.000Z",
          sourceSlug: "openai-news",
        },
      ],
      now: new Date("2026-07-01T09:00:00.000Z"),
      profile: {
        preferredCategories: ["model_release"],
        preferredSources: ["openai-news"],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "same-source-follow-up",
      "unrelated-agent-story",
    ]);
    expect(feed[0]?.matchedSignals).not.toContain("negative_feedback");
  });

  it("moves low-trust high-heat server recommendations behind trusted candidates", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "viral-low-trust-claim",
          canonicalUrl: "https://example.com/viral-low-trust-claim",
          title: "Unverified agent claim surges across social feeds",
          category: "hot_take",
          entities: ["Agents"],
          sourceName: "Rumor Desk",
          sourceSlug: "rumor-desk",
          sourceScore: 45,
          trendScore: 100,
        },
        {
          ...baseNewsItem,
          id: "trusted-model-analysis",
          canonicalUrl: "https://example.com/trusted-model-analysis",
          title: "Verified model analysis lands from a trusted source",
          sourceScore: 90,
          trendScore: 80,
        },
        {
          ...baseNewsItem,
          id: "trusted-funding-context",
          canonicalUrl: "https://example.com/trusted-funding-context",
          title: "Trusted funding context explains the agent market",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          trendScore: 76,
        },
      ],
      limit: 3,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed[0]?.id).toBe("trusted-model-analysis");
    expect(feed.findIndex((item) => item.id === "viral-low-trust-claim")).toBe(
      2,
    );
  });

  it("anchors server recommendations around saved or shared reader signals", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "unrelated-high-trend-funding",
          canonicalUrl: "https://example.com/unrelated-high-trend-funding",
          title: "Broad AI funding story gets market attention",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          trendScore: 100,
        },
        {
          ...baseNewsItem,
          id: "saved-agent-follow-up",
          canonicalUrl: "https://example.com/saved-agent-follow-up",
          title: "Agent workflow follow-up matches a saved story",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 88,
          trendScore: 74,
        },
        {
          ...baseNewsItem,
          id: "saved-entity-analysis",
          canonicalUrl: "https://example.com/saved-entity-analysis",
          title: "OpenAI analysis extends a saved entity thread",
          entities: ["OpenAI", "Agents"],
          sourceScore: 90,
          trendScore: 72,
        },
      ],
      limit: 3,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [
        {
          category: "agent_product",
          entities: ["Agents"],
          sourceSlug: "agent-desk",
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed[0]?.id).toBe("saved-agent-follow-up");
    expect(feed[1]?.id).toBe("saved-entity-analysis");
    expect(feed[0]?.matchedSignals).toContain("positive_feedback");
  });

  it("lets Less feedback override a previously saved recommendation anchor", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: ["hidden-saved-agent-anchor"],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "unrelated-high-trend-funding",
          canonicalUrl: "https://example.com/unrelated-high-trend-funding",
          title: "Broad AI funding story gets market attention",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          trendScore: 100,
        },
        {
          ...baseNewsItem,
          id: "hidden-save-follow-up",
          canonicalUrl: "https://example.com/hidden-save-follow-up",
          title: "Agent workflow follow-up matches a hidden saved story",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 88,
          trendScore: 74,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [
        {
          action: "save",
          category: "agent_product",
          entities: ["Agents"],
          newsItemId: "hidden-saved-agent-anchor",
          sourceSlug: "agent-desk",
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "unrelated-high-trend-funding",
      "hidden-save-follow-up",
    ]);
    expect(feed[1]?.matchedSignals).not.toContain("positive_feedback");
  });

  it("lets Less feedback override a previously saved recommendation anchor URL variant", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [
        {
          ...baseNewsItem,
          id: "hidden-saved-agent-canonical",
          canonicalUrl: "https://example.com/saved-agent-anchor",
          originalUrl: "https://example.com/saved-agent-anchor?utm=less",
          title: "Saved agent anchor hidden by Less",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 88,
          trendScore: 80,
        },
      ],
      items: [
        {
          ...baseNewsItem,
          id: "unrelated-high-trend-funding",
          canonicalUrl: "https://example.com/unrelated-high-trend-funding",
          title: "Broad AI funding story gets market attention",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          trendScore: 100,
        },
        {
          ...baseNewsItem,
          id: "hidden-url-follow-up",
          canonicalUrl: "https://example.com/hidden-url-follow-up",
          title: "Agent workflow follow-up matches a hidden saved URL",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 88,
          trendScore: 74,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [
        {
          action: "save",
          canonicalUrl: "https://mirror.example/saved-agent-anchor",
          category: "agent_product",
          entities: ["Agents"],
          newsItemId: "saved-agent-anchor-variant",
          originalUrl: "https://example.com/saved-agent-anchor?utm=save",
          sourceSlug: "agent-desk",
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "unrelated-high-trend-funding",
      "hidden-url-follow-up",
    ]);
    expect(feed[1]?.matchedSignals).not.toContain("positive_feedback");
  });

  it("anchors server recommendations around saved tag signals", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "unrelated-market-story",
          canonicalUrl: "https://example.com/unrelated-market-story",
          title: "Broad AI market story gets attention",
          category: "market_map",
          entities: ["AI market"],
          sourceName: "Market Map",
          sourceSlug: "market-map",
          tags: ["enterprise"],
          trendScore: 86,
        },
        {
          ...baseNewsItem,
          id: "saved-agent-angle",
          canonicalUrl: "https://example.com/saved-agent-angle",
          title: "Agent workflow follow-up matches a saved angle",
          category: "research",
          entities: ["Benchmarks"],
          sourceName: "Research Lab",
          sourceSlug: "research-lab",
          tags: ["agents"],
          trendScore: 70,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [
        {
          action: "save",
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
          tags: ["agents"],
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "saved-agent-angle",
      "unrelated-market-story",
    ]);
    expect(feed[0]?.matchedSignals).toContain("positive_feedback");
  });

  it("anchors server source-click feedback without boosting topic or entity matches", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "same-topic-only",
          canonicalUrl: "https://example.com/same-topic-only",
          category: "model_release",
          entities: ["Anthropic"],
          sourceName: "Lab Notes",
          sourceSlug: "lab-notes",
          sourceScore: 86,
          title: "Model release topic match should not anchor source clicks",
          trendScore: 82,
        },
        {
          ...baseNewsItem,
          id: "same-source-follow-up",
          canonicalUrl: "https://example.com/same-source-follow-up",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 84,
          title: "Same source follow-up should anchor source clicks",
          trendScore: 72,
        },
        {
          ...baseNewsItem,
          id: "same-entity-only",
          canonicalUrl: "https://example.com/same-entity-only",
          category: "funding",
          entities: ["OpenAI"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 83,
          title: "Entity match should not anchor source clicks",
          trendScore: 80,
        },
      ],
      limit: 3,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [
        {
          action: "click_source",
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "same-source-follow-up",
      "same-topic-only",
      "same-entity-only",
    ]);
    expect(feed[0]?.matchedSignals).toContain("positive_feedback");
    expect(feed[1]?.matchedSignals).not.toContain("positive_feedback");
    expect(feed[2]?.matchedSignals).not.toContain("positive_feedback");
  });

  it("does not anchor server recommendations from stale source-click feedback", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "unrelated-market-story",
          canonicalUrl: "https://example.com/unrelated-market-story",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          title: "Unrelated market story keeps the ranked lead",
          trendScore: 88,
        },
        {
          ...baseNewsItem,
          id: "stale-source-click-follow-up",
          canonicalUrl: "https://example.com/stale-source-click-follow-up",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 84,
          title: "Old source click should not keep anchoring this source",
          trendScore: 70,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [
        {
          action: "click_source",
          category: "model_release",
          entities: ["OpenAI"],
          occurredAt: "2026-06-01T09:00:00.000Z",
          sourceSlug: "openai-news",
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "unrelated-market-story",
      "stale-source-click-follow-up",
    ]);
    expect(feed[1]?.matchedSignals).not.toContain("positive_feedback");
  });

  it("orders server shared feedback ahead of weaker source-click feedback", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "source-click-follow-up",
          canonicalUrl: "https://example.com/source-click-follow-up",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 84,
          title: "Source click follow-up should not outrank a shared topic",
          trendScore: 84,
        },
        {
          ...baseNewsItem,
          id: "shared-topic-follow-up",
          canonicalUrl: "https://example.com/shared-topic-follow-up",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 83,
          title: "Shared funding topic should train the feed more strongly",
          trendScore: 72,
        },
        {
          ...baseNewsItem,
          id: "unrelated-research-story",
          canonicalUrl: "https://example.com/unrelated-research-story",
          category: "research",
          entities: ["Benchmarks"],
          sourceName: "Research Lab",
          sourceSlug: "research-lab",
          sourceScore: 82,
          title: "Unrelated research story stays behind feedback matches",
          trendScore: 82,
        },
      ],
      limit: 3,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [
        {
          action: "click_source",
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
        },
        {
          action: "share",
          category: "funding",
          entities: ["Series A"],
          sourceSlug: "venturewire",
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "shared-topic-follow-up",
      "source-click-follow-up",
      "unrelated-research-story",
    ]);
    expect(feed[0]?.matchedSignals).toContain("positive_feedback");
    expect(feed[1]?.matchedSignals).toContain("positive_feedback");
  });

  it("orders newer server positive feedback ahead of older same-strength feedback", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      hiddenNewsItems: [],
      items: [
        {
          ...baseNewsItem,
          id: "old-share-follow-up",
          canonicalUrl: "https://example.com/old-share-follow-up",
          category: "model_release",
          entities: ["OpenAI"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 84,
          title: "Old shared topic should not permanently lead",
          trendScore: 84,
        },
        {
          ...baseNewsItem,
          id: "recent-share-follow-up",
          canonicalUrl: "https://example.com/recent-share-follow-up",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 83,
          title: "Recent shared topic should lead same-strength matches",
          trendScore: 72,
        },
        {
          ...baseNewsItem,
          id: "unrelated-research-story",
          canonicalUrl: "https://example.com/unrelated-research-story",
          category: "research",
          entities: ["Benchmarks"],
          sourceName: "Research Lab",
          sourceSlug: "research-lab",
          sourceScore: 82,
          title: "Unrelated research story stays behind feedback matches",
          trendScore: 82,
        },
      ],
      limit: 3,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      positiveFeedbackItems: [
        {
          action: "share",
          category: "model_release",
          entities: ["OpenAI"],
          occurredAt: "2026-06-01T09:00:00.000Z",
          sourceSlug: "openai-news",
        },
        {
          action: "share",
          category: "funding",
          entities: ["Series A"],
          occurredAt: "2026-07-01T09:00:00.000Z",
          sourceSlug: "venturewire",
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "recent-share-follow-up",
      "old-share-follow-up",
      "unrelated-research-story",
    ]);
    expect(feed[0]?.matchedSignals).toContain("positive_feedback");
    expect(feed[1]?.matchedSignals).toContain("positive_feedback");
  });

  it("removes server recommendations that duplicate hidden stories by canonical URL", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: ["hidden-openai-model"],
      hiddenNewsItems: [
        {
          ...baseNewsItem,
          id: "hidden-openai-model",
          canonicalUrl: "https://example.com/openai-model",
        },
      ],
      items: [
        {
          ...baseNewsItem,
          id: "hidden-openai-model",
          canonicalUrl: "https://example.com/openai-model",
        },
        {
          ...baseNewsItem,
          id: "syndicated-openai-model",
          canonicalUrl: "https://example.com/openai-model?utm=feed",
          sourceName: "Syndication Desk",
          sourceSlug: "syndication-desk",
          trendScore: 99,
        },
        {
          ...baseNewsItem,
          id: "fresh-agent-story",
          canonicalUrl: "https://example.com/fresh-agent-story",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          trendScore: 80,
        },
      ],
      limit: 3,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T09:00:00.000Z"),
      profile: {
        preferredCategories: ["model_release"],
        preferredSources: ["openai-news"],
        preferredEntities: ["OpenAI"],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual(["fresh-agent-story"]);
  });

  it("applies edition daypart ranking after base personalization", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      items: [
        {
          ...baseNewsItem,
          id: "generic-funding-brief",
          title: "Agent startup funding brief",
          canonicalUrl: "https://example.com/generic-funding-brief",
          originalUrl: "https://example.com/generic-funding-brief",
          category: "funding",
          entities: ["Series A"],
          sourceSlug: "venturewire",
          sourceScore: 82,
          trendScore: 88,
        },
        {
          ...baseNewsItem,
          id: "morning-security-brief",
          title: "AI security briefing for agent platforms",
          canonicalUrl: "https://example.com/morning-security-brief",
          originalUrl: "https://example.com/morning-security-brief",
          category: "security",
          entities: ["Security"],
          sourceSlug: "security-desk",
          sourceScore: 90,
          trendScore: 82,
        },
      ],
      limit: 2,
      now: new Date("2026-07-01T06:00:00.000Z"),
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      negativeFeedbackItems: [],
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "morning-security-brief",
      "generic-funding-brief",
    ]);
    expect(feed[0]?.matchedSignals).toContain("daypart");
  });

  it("uses reader local hour for server-side daypart ranking", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      items: [
        {
          ...baseNewsItem,
          id: "morning-security-briefing",
          title: "AI security briefing for agent platforms",
          canonicalUrl: "https://example.com/morning-security-briefing",
          originalUrl: "https://example.com/morning-security-briefing",
          category: "security",
          entities: ["Security"],
          sourceSlug: "security-desk",
          sourceScore: 90,
          trendScore: 82,
        },
        {
          ...baseNewsItem,
          id: "evening-market-map",
          title: "AI market map for the evening brief",
          canonicalUrl: "https://example.com/evening-market-map",
          originalUrl: "https://example.com/evening-market-map",
          category: "market_map",
          entities: ["Market Map"],
          sourceSlug: "market-map",
          sourceScore: 88,
          trendScore: 82,
        },
      ],
      limit: 2,
      now: new Date("2026-07-01T06:00:00.000Z"),
      readerLocalHour: 20,
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      negativeFeedbackItems: [],
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "evening-market-map",
      "morning-security-briefing",
    ]);
  });

  it("applies current search and topic intent in server-side For You ranking", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      items: [
        {
          ...baseNewsItem,
          id: "high-profile-model",
          title: "OpenAI ships a model refresh",
          canonicalUrl: "https://example.com/high-profile-model",
          originalUrl: "https://example.com/high-profile-model",
          category: "model_release",
          entities: ["OpenAI"],
          sourceSlug: "openai-news",
          sourceScore: 92,
          tags: ["model"],
          trendScore: 89,
        },
        {
          ...baseNewsItem,
          id: "session-agent-match",
          title: "LangChain agent runtime adds workflow memory",
          canonicalUrl: "https://example.com/session-agent-match",
          originalUrl: "https://example.com/session-agent-match",
          category: "agent_product",
          entities: ["LangChain"],
          sourceSlug: "agent-desk",
          sourceScore: 88,
          tags: ["agents"],
          trendScore: 82,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T12:00:00.000Z"),
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      sessionIntent: {
        category: "agent_product",
        query: "LangChain agents",
        sourceSlug: null,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "session-agent-match",
      "high-profile-model",
    ]);
    expect(feed[0]?.matchedSignals).toContain("session_intent");
  });

  it("uses summaries and source names for server-side session search intent", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      items: [
        {
          ...baseNewsItem,
          id: "title-only-model-story",
          title: "OpenAI ships a model refresh",
          summary: "A model update without the searched runtime label.",
          canonicalUrl: "https://example.com/title-only-model-story",
          originalUrl: "https://example.com/title-only-model-story",
          category: "model_release",
          entities: ["OpenAI"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 92,
          tags: ["model"],
          trendScore: 89,
        },
        {
          ...baseNewsItem,
          id: "summary-source-match",
          title: "Runtime notes from the field",
          summary: "LangChain adds workflow memory for production agents.",
          canonicalUrl: "https://example.com/summary-source-match",
          originalUrl: "https://example.com/summary-source-match",
          category: "agent_product",
          entities: ["Runtime"],
          sourceName: "AgentOps Daily",
          sourceSlug: "agentops-daily",
          sourceScore: 88,
          tags: ["runtime"],
          trendScore: 82,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T12:00:00.000Z"),
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      sessionIntent: {
        category: null,
        query: "LangChain AgentOps",
        sourceSlug: null,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "summary-source-match",
      "title-only-model-story",
    ]);
    expect(feed[0]?.matchedSignals).toContain("session_intent");
  });

  it("applies current angle tag intent in server-side For You ranking", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      items: [
        {
          ...baseNewsItem,
          id: "high-profile-model-story",
          title: "OpenAI ships a model refresh",
          canonicalUrl: "https://example.com/high-profile-model-story",
          originalUrl: "https://example.com/high-profile-model-story",
          category: "model_release",
          entities: ["OpenAI"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 92,
          tags: ["frontier_model"],
          trendScore: 89,
        },
        {
          ...baseNewsItem,
          id: "tag-intent-agent-story",
          title: "Agent workflows move into production",
          canonicalUrl: "https://example.com/tag-intent-agent-story",
          originalUrl: "https://example.com/tag-intent-agent-story",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 88,
          tags: ["workflow_automation"],
          trendScore: 82,
        },
      ],
      limit: 2,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T12:00:00.000Z"),
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      sessionIntent: {
        category: null,
        query: "",
        sourceSlug: null,
        tag: "workflow_automation",
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "tag-intent-agent-story",
      "high-profile-model-story",
    ]);
    expect(feed[0]?.matchedSignals).toContain("session_intent");
  });

  it("applies source corroboration in server-side For You ranking", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      items: [
        {
          ...baseNewsItem,
          id: "single-source-high-score",
          title: "Anthropic ships a model refresh",
          canonicalUrl: "https://example.com/single-source-high-score",
          originalUrl: "https://example.com/single-source-high-score",
          category: "model_release",
          entities: ["Anthropic"],
          sourceName: "Single Lab",
          sourceSlug: "single-lab",
          sourceScore: 88,
          tags: ["model"],
          trendScore: 84,
        },
        {
          ...baseNewsItem,
          id: "corroborated-openai-story",
          title: "OpenAI model release draws independent coverage",
          canonicalUrl: "https://example.com/corroborated-openai-story",
          originalUrl: "https://example.com/corroborated-openai-story",
          category: "model_release",
          entities: ["OpenAI"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 90,
          tags: ["frontier-model"],
          trendScore: 82,
        },
        {
          ...baseNewsItem,
          id: "openai-analysis-follow-up",
          title: "Agent Desk tracks the OpenAI release",
          canonicalUrl: "https://example.com/openai-analysis-follow-up",
          originalUrl: "https://example.com/openai-analysis-follow-up",
          category: "model_release",
          entities: ["OpenAI"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 84,
          tags: ["frontier-model"],
          trendScore: 72,
        },
      ],
      limit: 3,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T12:00:00.000Z"),
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "corroborated-openai-story",
      "single-source-high-score",
      "openai-analysis-follow-up",
    ]);
    expect(feed[0]?.matchedSignals).toContain("source_corroboration");
  });

  it("caps repeated sources in the final server-side For You page while alternates exist", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      items: [
        {
          ...baseNewsItem,
          id: "openai-model-lead",
          canonicalUrl: "https://example.com/openai-model-lead",
          originalUrl: "https://example.com/openai-model-lead",
          category: "model_release",
          entities: ["OpenAI"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 92,
          tags: ["frontier-model"],
          trendScore: 92,
        },
        {
          ...baseNewsItem,
          id: "openai-agent-follow",
          canonicalUrl: "https://example.com/openai-agent-follow",
          originalUrl: "https://example.com/openai-agent-follow",
          category: "agent_product",
          entities: ["OpenAI", "Agents"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 91,
          tags: ["workflow_automation"],
          trendScore: 90,
        },
        {
          ...baseNewsItem,
          id: "openai-research-follow",
          canonicalUrl: "https://example.com/openai-research-follow",
          originalUrl: "https://example.com/openai-research-follow",
          category: "research",
          entities: ["OpenAI", "Benchmarks"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 90,
          tags: ["evals"],
          trendScore: 88,
        },
        {
          ...baseNewsItem,
          id: "anthropic-model-angle",
          canonicalUrl: "https://example.com/anthropic-model-angle",
          originalUrl: "https://example.com/anthropic-model-angle",
          category: "model_release",
          entities: ["Anthropic"],
          sourceName: "Anthropic News",
          sourceSlug: "anthropic-news",
          sourceScore: 88,
          tags: ["frontier-model"],
          trendScore: 72,
        },
        {
          ...baseNewsItem,
          id: "venture-agent-angle",
          canonicalUrl: "https://example.com/venture-agent-angle",
          originalUrl: "https://example.com/venture-agent-angle",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 82,
          tags: ["workflow_automation"],
          trendScore: 68,
        },
      ],
      limit: 5,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T12:00:00.000Z"),
      positiveFeedbackItems: [
        {
          action: "save",
          category: "model_release",
          entities: ["OpenAI"],
          occurredAt: "2026-07-01T11:00:00.000Z",
          sourceSlug: "openai-news",
          tags: ["frontier-model"],
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "openai-model-lead",
      "openai-agent-follow",
      "anthropic-model-angle",
      "venture-agent-angle",
      "openai-research-follow",
    ]);
  });

  it("caps repeated entities in the final server-side For You page while alternates exist", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      items: [
        {
          ...baseNewsItem,
          id: "openai-model-lead",
          canonicalUrl: "https://example.com/openai-model-lead",
          originalUrl: "https://example.com/openai-model-lead",
          category: "model_release",
          entities: ["OpenAI"],
          sourceName: "Model Desk",
          sourceSlug: "model-desk",
          sourceScore: 92,
          tags: ["frontier-model"],
          trendScore: 89,
        },
        {
          ...baseNewsItem,
          id: "openai-agent-follow",
          canonicalUrl: "https://example.com/openai-agent-follow",
          originalUrl: "https://example.com/openai-agent-follow",
          category: "agent_product",
          entities: ["OpenAI", "Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 91,
          tags: ["workflow_automation"],
          trendScore: 88,
        },
        {
          ...baseNewsItem,
          id: "openai-policy-follow",
          canonicalUrl: "https://example.com/openai-policy-follow",
          originalUrl: "https://example.com/openai-policy-follow",
          category: "policy",
          entities: ["OpenAI", "Policy"],
          sourceName: "Policy Desk",
          sourceSlug: "policy-desk",
          sourceScore: 90,
          tags: ["governance"],
          trendScore: 87,
        },
        {
          ...baseNewsItem,
          id: "openai-research-follow",
          canonicalUrl: "https://example.com/openai-research-follow",
          originalUrl: "https://example.com/openai-research-follow",
          category: "research",
          entities: ["OpenAI", "Benchmarks"],
          sourceName: "Research Desk",
          sourceSlug: "research-desk",
          sourceScore: 89,
          tags: ["evals"],
          trendScore: 86,
        },
        {
          ...baseNewsItem,
          id: "openai-market-follow",
          canonicalUrl: "https://example.com/openai-market-follow",
          originalUrl: "https://example.com/openai-market-follow",
          category: "market_map",
          entities: ["OpenAI", "Microsoft"],
          sourceName: "Market Desk",
          sourceSlug: "market-desk",
          sourceScore: 88,
          tags: ["platform"],
          trendScore: 85,
        },
        {
          ...baseNewsItem,
          id: "anthropic-model-angle",
          canonicalUrl: "https://example.com/anthropic-model-angle",
          originalUrl: "https://example.com/anthropic-model-angle",
          category: "model_release",
          entities: ["Anthropic"],
          sourceName: "Anthropic News",
          sourceSlug: "anthropic-news",
          sourceScore: 86,
          tags: ["frontier-model"],
          trendScore: 80,
        },
        {
          ...baseNewsItem,
          id: "mistral-open-source-angle",
          canonicalUrl: "https://example.com/mistral-open-source-angle",
          originalUrl: "https://example.com/mistral-open-source-angle",
          category: "open_source",
          entities: ["Mistral"],
          sourceName: "Open Source Desk",
          sourceSlug: "open-source-desk",
          sourceScore: 84,
          tags: ["open-source"],
          trendScore: 78,
        },
        {
          ...baseNewsItem,
          id: "cohere-enterprise-angle",
          canonicalUrl: "https://example.com/cohere-enterprise-angle",
          originalUrl: "https://example.com/cohere-enterprise-angle",
          category: "big_tech",
          entities: ["Cohere"],
          sourceName: "Enterprise AI Desk",
          sourceSlug: "enterprise-ai-desk",
          sourceScore: 82,
          tags: ["enterprise"],
          trendScore: 76,
        },
      ],
      limit: 6,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T12:00:00.000Z"),
      positiveFeedbackItems: [
        {
          action: "save",
          category: "model_release",
          entities: ["OpenAI"],
          occurredAt: "2026-07-01T11:00:00.000Z",
          sourceSlug: "model-desk",
          tags: ["frontier-model"],
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "openai-model-lead",
      "openai-agent-follow",
      "openai-policy-follow",
      "anthropic-model-angle",
      "mistral-open-source-angle",
      "cohere-enterprise-angle",
    ]);
    expect(
      feed
        .slice(3)
        .every((item) => item.matchedSignals.includes("entity_quota")),
    ).toBe(true);
  });

  it("caps repeated topics in the final server-side For You page while alternates exist", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      items: [
        {
          ...baseNewsItem,
          id: "model-lead",
          canonicalUrl: "https://example.com/model-lead",
          originalUrl: "https://example.com/model-lead",
          category: "model_release",
          entities: ["OpenAI"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 92,
          tags: ["frontier-model"],
          trendScore: 89,
        },
        {
          ...baseNewsItem,
          id: "model-follow",
          canonicalUrl: "https://example.com/model-follow",
          originalUrl: "https://example.com/model-follow",
          category: "model_release",
          entities: ["Anthropic"],
          sourceName: "Anthropic News",
          sourceSlug: "anthropic-news",
          sourceScore: 91,
          tags: ["frontier-model"],
          trendScore: 88,
        },
        {
          ...baseNewsItem,
          id: "model-analysis",
          canonicalUrl: "https://example.com/model-analysis",
          originalUrl: "https://example.com/model-analysis",
          category: "model_release",
          entities: ["Google"],
          sourceName: "Google AI Blog",
          sourceSlug: "google-ai-blog",
          sourceScore: 90,
          tags: ["frontier-model"],
          trendScore: 87,
        },
        {
          ...baseNewsItem,
          id: "model-deep-dive",
          canonicalUrl: "https://example.com/model-deep-dive",
          originalUrl: "https://example.com/model-deep-dive",
          category: "model_release",
          entities: ["Meta"],
          sourceName: "Meta AI Blog",
          sourceSlug: "meta-ai-blog",
          sourceScore: 89,
          tags: ["frontier-model"],
          trendScore: 86,
        },
        {
          ...baseNewsItem,
          id: "agent-product-angle",
          canonicalUrl: "https://example.com/agent-product-angle",
          originalUrl: "https://example.com/agent-product-angle",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 86,
          tags: ["workflow_automation"],
          trendScore: 80,
        },
        {
          ...baseNewsItem,
          id: "funding-market-angle",
          canonicalUrl: "https://example.com/funding-market-angle",
          originalUrl: "https://example.com/funding-market-angle",
          category: "funding",
          entities: ["Series A"],
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          tags: ["funding"],
          trendScore: 78,
        },
      ],
      limit: 5,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T12:00:00.000Z"),
      positiveFeedbackItems: [
        {
          action: "save",
          category: "model_release",
          entities: ["OpenAI"],
          occurredAt: "2026-07-01T11:00:00.000Z",
          sourceSlug: "openai-news",
          tags: ["frontier-model"],
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "model-lead",
      "model-follow",
      "model-analysis",
      "agent-product-angle",
      "funding-market-angle",
    ]);
    expect(
      feed
        .slice(3)
        .every((item) => item.matchedSignals.includes("category_quota")),
    ).toBe(true);
  });

  it("caps repeated angles in the final server-side For You page while alternates exist", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      items: [
        {
          ...baseNewsItem,
          id: "frontier-model-lead",
          canonicalUrl: "https://example.com/frontier-model-lead",
          originalUrl: "https://example.com/frontier-model-lead",
          category: "model_release",
          entities: ["OpenAI"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 92,
          tags: ["frontier_model"],
          trendScore: 89,
        },
        {
          ...baseNewsItem,
          id: "frontier-model-agent",
          canonicalUrl: "https://example.com/frontier-model-agent",
          originalUrl: "https://example.com/frontier-model-agent",
          category: "agent_product",
          entities: ["Anthropic"],
          sourceName: "Anthropic News",
          sourceSlug: "anthropic-news",
          sourceScore: 91,
          tags: ["frontier_model"],
          trendScore: 88,
        },
        {
          ...baseNewsItem,
          id: "frontier-model-research",
          canonicalUrl: "https://example.com/frontier-model-research",
          originalUrl: "https://example.com/frontier-model-research",
          category: "research",
          entities: ["Google"],
          sourceName: "Google AI Blog",
          sourceSlug: "google-ai-blog",
          sourceScore: 90,
          tags: ["frontier_model"],
          trendScore: 87,
        },
        {
          ...baseNewsItem,
          id: "frontier-model-policy",
          canonicalUrl: "https://example.com/frontier-model-policy",
          originalUrl: "https://example.com/frontier-model-policy",
          category: "policy",
          entities: ["Meta"],
          sourceName: "Meta AI Blog",
          sourceSlug: "meta-ai-blog",
          sourceScore: 89,
          tags: ["frontier_model"],
          trendScore: 86,
        },
        {
          ...baseNewsItem,
          id: "workflow-automation-angle",
          canonicalUrl: "https://example.com/workflow-automation-angle",
          originalUrl: "https://example.com/workflow-automation-angle",
          category: "agent_product",
          entities: ["Agents"],
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 86,
          tags: ["workflow_automation"],
          trendScore: 80,
        },
        {
          ...baseNewsItem,
          id: "prompt-injection-angle",
          canonicalUrl: "https://example.com/prompt-injection-angle",
          originalUrl: "https://example.com/prompt-injection-angle",
          category: "security",
          entities: ["Security"],
          sourceName: "Security Desk",
          sourceSlug: "security-desk",
          sourceScore: 84,
          tags: ["prompt_injection"],
          trendScore: 78,
        },
      ],
      limit: 5,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T12:00:00.000Z"),
      positiveFeedbackItems: [
        {
          action: "save",
          category: "model_release",
          entities: ["OpenAI"],
          occurredAt: "2026-07-01T11:00:00.000Z",
          sourceSlug: "openai-news",
          tags: ["frontier_model"],
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "frontier-model-lead",
      "frontier-model-agent",
      "frontier-model-research",
      "workflow-automation-angle",
      "prompt-injection-angle",
    ]);
    expect(
      feed
        .slice(3)
        .every((item) => item.matchedSignals.includes("angle_quota")),
    ).toBe(true);
  });

  it("caps stale stories in the final server-side For You page while fresh alternates exist", () => {
    const feed = selectNewsForYouItems({
      hiddenNewsItemIds: [],
      items: [
        {
          ...baseNewsItem,
          id: "older-model-lead",
          canonicalUrl: "https://example.com/older-model-lead",
          originalUrl: "https://example.com/older-model-lead",
          category: "model_release",
          entities: ["OpenAI"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 92,
          tags: ["frontier_model"],
          trendScore: 89,
          publishedAt: "2026-06-28T08:00:00.000Z",
          matchedSignals: ["category"],
          personalizedScore: 260,
        },
        {
          ...baseNewsItem,
          id: "older-agent-follow",
          canonicalUrl: "https://example.com/older-agent-follow",
          originalUrl: "https://example.com/older-agent-follow",
          category: "model_release",
          entities: ["OpenAI"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 91,
          tags: ["frontier_model"],
          trendScore: 88,
          publishedAt: "2026-06-28T09:00:00.000Z",
          matchedSignals: ["category"],
          personalizedScore: 250,
        },
        {
          ...baseNewsItem,
          id: "older-research-analysis",
          canonicalUrl: "https://example.com/older-research-analysis",
          originalUrl: "https://example.com/older-research-analysis",
          category: "model_release",
          entities: ["OpenAI"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 90,
          tags: ["frontier_model"],
          trendScore: 87,
          publishedAt: "2026-06-28T10:00:00.000Z",
          matchedSignals: ["category"],
          personalizedScore: 240,
        },
        {
          ...baseNewsItem,
          id: "older-policy-deep-dive",
          canonicalUrl: "https://example.com/older-policy-deep-dive",
          originalUrl: "https://example.com/older-policy-deep-dive",
          category: "model_release",
          entities: ["OpenAI"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 89,
          tags: ["frontier_model"],
          trendScore: 86,
          publishedAt: "2026-06-28T11:00:00.000Z",
          matchedSignals: ["category"],
          personalizedScore: 230,
        },
        {
          ...baseNewsItem,
          id: "fresh-security-angle",
          canonicalUrl: "https://example.com/fresh-security-angle",
          originalUrl: "https://example.com/fresh-security-angle",
          category: "model_release",
          entities: ["OpenAI"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 86,
          tags: ["frontier_model"],
          trendScore: 80,
          publishedAt: "2026-07-01T08:00:00.000Z",
        },
        {
          ...baseNewsItem,
          id: "fresh-funding-angle",
          canonicalUrl: "https://example.com/fresh-funding-angle",
          originalUrl: "https://example.com/fresh-funding-angle",
          category: "model_release",
          entities: ["OpenAI"],
          sourceName: "OpenAI News",
          sourceSlug: "openai-news",
          sourceScore: 84,
          tags: ["frontier_model"],
          trendScore: 78,
          publishedAt: "2026-07-01T07:00:00.000Z",
        },
      ],
      limit: 5,
      negativeFeedbackItems: [],
      now: new Date("2026-07-01T12:00:00.000Z"),
      positiveFeedbackItems: [
        {
          action: "save",
          category: "model_release",
          entities: ["OpenAI"],
          occurredAt: "2026-07-01T11:00:00.000Z",
          sourceSlug: "openai-news",
          tags: ["frontier_model"],
        },
      ],
      profile: {
        preferredCategories: [],
        preferredSources: [
          "reader-source-a",
          "reader-source-b",
          "reader-source-c",
          "reader-source-d",
          "reader-source-e",
          "reader-source-f",
          "reader-source-g",
          "reader-source-h",
        ],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      viewedNewsItemIds: [],
    });

    expect(feed.map((item) => item.id)).toEqual([
      "older-model-lead",
      "older-agent-follow",
      "older-research-analysis",
      "fresh-security-angle",
      "fresh-funding-angle",
    ]);
    expect(
      feed
        .slice(3)
        .every((item) => item.matchedSignals.includes("freshness_quota")),
    ).toBe(true);
  });
});

describe("selectUniqueNewsCollectionItems", () => {
  it("deduplicates saved or history URL variants while keeping the collection slot", () => {
    const items = selectUniqueNewsCollectionItems([
      {
        ...baseNewsItem,
        id: "recent-syndicated-model",
        canonicalUrl: "https://mirror.example/openai-model",
        originalUrl: "https://example.com/openai-model?utm=sidebar",
        savedAt: "2026-07-01T09:00:00.000Z",
        sourceScore: 84,
        trendScore: 91,
      },
      {
        ...baseNewsItem,
        id: "trusted-official-model",
        canonicalUrl: "https://example.com/openai-model",
        originalUrl: "https://example.com/openai-model",
        savedAt: "2026-07-01T08:00:00.000Z",
        sourceScore: 96,
        trendScore: 88,
      },
      {
        ...baseNewsItem,
        id: "fresh-agent-story",
        canonicalUrl: "https://example.com/fresh-agent-story",
        originalUrl: "https://example.com/fresh-agent-story",
        category: "agent_product",
        entities: ["Agents"],
        savedAt: "2026-07-01T07:00:00.000Z",
        sourceName: "Agent Desk",
        sourceSlug: "agent-desk",
        sourceScore: 88,
        trendScore: 86,
      },
    ]);

    expect(items.map((item) => item.id)).toEqual([
      "trusted-official-model",
      "fresh-agent-story",
    ]);
  });

  it("omits collection URL variants hidden by feedback guardrails", () => {
    const items = selectUniqueNewsCollectionItems(
      [
        {
          ...baseNewsItem,
          id: "saved-hidden-agent-variant",
          canonicalUrl: "https://mirror.example/agent-workflow",
          originalUrl: "https://example.com/agent-workflow?utm=saved",
          category: "agent_product",
          entities: ["Agents"],
          savedAt: "2026-07-01T09:00:00.000Z",
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          sourceScore: 88,
          trendScore: 86,
        },
        {
          ...baseNewsItem,
          id: "fresh-funding-story",
          canonicalUrl: "https://example.com/fresh-funding-story",
          originalUrl: "https://example.com/fresh-funding-story",
          category: "funding",
          entities: ["Series A"],
          savedAt: "2026-07-01T08:00:00.000Z",
          sourceName: "VentureWire",
          sourceSlug: "venturewire",
          sourceScore: 84,
          trendScore: 84,
        },
      ],
      [
        {
          ...baseNewsItem,
          id: "hidden-agent-workflow",
          canonicalUrl: "https://example.com/agent-workflow",
          originalUrl: "https://example.com/agent-workflow?utm=less",
          category: "agent_product",
          entities: ["Agents"],
          sourceSlug: "agent-desk",
          sourceScore: 88,
          trendScore: 82,
        },
      ],
    );

    expect(items.map((item) => item.id)).toEqual(["fresh-funding-story"]);
  });
});
