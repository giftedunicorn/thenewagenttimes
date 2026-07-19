import { describe, expect, it, vi } from "vitest";

import { createNewsEmbeddingRunner } from "./news-embedding";

describe("createNewsEmbeddingRunner", () => {
  it("does not require an OpenAI key until an embedding batch runs", async () => {
    const createProvider = vi.fn(() => ({ provider: "openai" }));
    const embed = vi.fn(() => Promise.resolve({ embedded: 1, failed: 0 }));

    const runEmbedding = createNewsEmbeddingRunner({
      createProvider,
      embed,
      environment: {},
      repository: { name: "news" },
    });

    expect(createProvider).not.toHaveBeenCalled();
    await expect(runEmbedding(25)).rejects.toThrow(
      "OPENAI_API_KEY is required",
    );
    expect(createProvider).not.toHaveBeenCalled();
    expect(embed).not.toHaveBeenCalled();
  });

  it("uses the default model and passes the requested limit", async () => {
    const provider = { provider: "openai" };
    const repository = { name: "news" };
    const createProvider = vi.fn(() => provider);
    const embed = vi.fn(() => Promise.resolve({ embedded: 10, failed: 0 }));
    const runEmbedding = createNewsEmbeddingRunner({
      createProvider,
      embed,
      environment: { OPENAI_API_KEY: "test-key" },
      repository,
    });

    await expect(runEmbedding(10)).resolves.toEqual({
      embedded: 10,
      failed: 0,
    });
    expect(createProvider).toHaveBeenCalledWith({
      apiKey: "test-key",
      model: "text-embedding-3-small",
    });
    expect(embed).toHaveBeenCalledWith({
      limit: 10,
      provider,
      repository,
    });
  });
});
