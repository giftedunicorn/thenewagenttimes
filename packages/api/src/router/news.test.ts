import { describe, expect, it } from "vitest";

import {
  NewsFeedInputSchema,
  NewsForYouInputSchema,
  NewsHistoryInputSchema,
  NewsReaderProfileInputSchema,
  NewsRecordInteractionInputSchema,
  NewsSavedInputSchema,
  NewsSearchCandidatesInputSchema,
  NewsUpdateProfileInputSchema,
} from "./news";

describe("news router input contracts", () => {
  it("defaults the public feed limit to 20", () => {
    expect(NewsFeedInputSchema.parse({}).limit).toBe(20);
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

  it("requires a non-empty search query after trimming", () => {
    const result = NewsSearchCandidatesInputSchema.safeParse({ q: "   " });

    expect(result.success).toBe(false);
  });

  it("defaults search candidate limit to 10", () => {
    expect(
      NewsSearchCandidatesInputSchema.parse({ q: "agent launch" }).limit,
    ).toBe(10);
  });

  it("defaults personalized for-you feed limit to 20", () => {
    expect(
      NewsForYouInputSchema.parse({ visitorKey: "visitor-test-123" }).limit,
    ).toBe(20);
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
});
