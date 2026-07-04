import { describe, expect, it } from "vitest";

import {
  buildEmbeddingInput,
  createFakeEmbeddingProvider,
  createOpenAIEmbeddingProvider,
  hashEmbeddingInput,
} from "./embedding";

const newsItem = {
  id: "a68d9452-8f6d-4e74-9673-4d43fd809a2e",
  title: "OpenAI releases a new agent model",
  summary: "A short summary for feed cards.",
  bodyText: "A body fragment about agentic workflows.",
  category: "model_release" as const,
  tags: ["agent", "model"],
  entities: ["OpenAI"],
};

describe("buildEmbeddingInput", () => {
  it("builds deterministic embedding text from stable fields", () => {
    expect(buildEmbeddingInput(newsItem)).toBe(
      [
        "Title: OpenAI releases a new agent model",
        "Summary: A short summary for feed cards.",
        "Category: model_release",
        "Tags: agent, model",
        "Entities: OpenAI",
        "Body: A body fragment about agentic workflows.",
      ].join("\n"),
    );
  });

  it("truncates very long article bodies before embedding", () => {
    const input = buildEmbeddingInput({
      ...newsItem,
      bodyText: "A".repeat(50_000),
    });

    expect(input.length).toBeLessThanOrEqual(12_500);
    expect(input).toContain("Body: ");
    expect(input).toContain("[truncated]");
    expect(input).not.toContain("A".repeat(50_000));
  });
});

describe("hashEmbeddingInput", () => {
  it("returns a stable sha256 content hash", () => {
    expect(hashEmbeddingInput("agent news")).toBe(
      "sha256:1e9d801345dfd209faec3f099eb13c2fe05a04813ffb4a11e21f6b1f1a2ebfb3",
    );
  });
});

describe("createFakeEmbeddingProvider", () => {
  it("returns deterministic vectors with provider metadata", async () => {
    const provider = createFakeEmbeddingProvider({ dimension: 4 });

    await expect(provider.embed("agent news")).resolves.toEqual({
      provider: "fake",
      model: "fake-embedding",
      dimension: 4,
      embedding: [0.03, 0.04, 0.05, 0.06],
    });
  });
});

describe("createOpenAIEmbeddingProvider", () => {
  it("requires an API key before creating a live provider", () => {
    expect(() =>
      createOpenAIEmbeddingProvider({
        apiKey: "",
        model: "text-embedding-3-small",
      }),
    ).toThrow("OPENAI_API_KEY is required");
  });
});
