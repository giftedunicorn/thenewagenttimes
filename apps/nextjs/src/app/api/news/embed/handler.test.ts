import { describe, expect, it, vi } from "vitest";

import { handleNewsEmbedRequest } from "./handler";

describe("handleNewsEmbedRequest", () => {
  it("rejects embedding attempts when the server secret is not configured", async () => {
    const embed = vi.fn(() => Promise.resolve({ embedded: 0, failed: 0 }));

    const response = await handleNewsEmbedRequest({
      apiKey: "openai-key",
      embed,
      expectedSecret: undefined,
      request: new Request("https://example.com/api/news/embed", {
        method: "POST",
      }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "NEWS_REFRESH_SECRET is not configured",
    });
    expect(embed).not.toHaveBeenCalled();
  });

  it("rejects requests without the expected bearer token", async () => {
    const embed = vi.fn(() => Promise.resolve({ embedded: 0, failed: 0 }));

    const response = await handleNewsEmbedRequest({
      apiKey: "openai-key",
      embed,
      expectedSecret: "correct-secret-value",
      request: new Request("https://example.com/api/news/embed", {
        headers: { authorization: "Bearer wrong-secret" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(embed).not.toHaveBeenCalled();
  });

  it("rejects embedding attempts when the OpenAI key is not configured", async () => {
    const embed = vi.fn(() => Promise.resolve({ embedded: 0, failed: 0 }));

    const response = await handleNewsEmbedRequest({
      apiKey: undefined,
      embed,
      expectedSecret: "correct-secret-value",
      request: new Request("https://example.com/api/news/embed", {
        headers: { authorization: "Bearer correct-secret-value" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "OPENAI_API_KEY is not configured",
    });
    expect(embed).not.toHaveBeenCalled();
  });

  it("runs the embedding job and returns its summary when authorized", async () => {
    const embed = vi.fn(({ limit }: { limit: number }) =>
      Promise.resolve({ embedded: limit - 1, failed: 1 }),
    );

    const response = await handleNewsEmbedRequest({
      apiKey: "openai-key",
      embed,
      expectedSecret: "correct-secret-value",
      request: new Request("https://example.com/api/news/embed", {
        headers: { authorization: "Bearer correct-secret-value" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      embedded: 24,
      failed: 1,
      limit: 25,
      ok: true,
    });
    expect(embed).toHaveBeenCalledWith({ limit: 25 });
  });

  it("tells operators to retry embeddings when the provider fails part of the batch", async () => {
    const embed = vi.fn(({ limit }: { limit: number }) =>
      Promise.resolve({ embedded: limit - 1, failed: 1 }),
    );

    const response = await handleNewsEmbedRequest({
      apiKey: "openai-key",
      embed,
      expectedSecret: "correct-secret-value",
      request: new Request("https://example.com/api/news/embed", {
        headers: { authorization: "Bearer correct-secret-value" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Retry pnpm run news:embed:remote; 1 story failed to embed in this batch.",
      ],
      commands: {
        embed: "pnpm run news:embed:remote",
        next: "pnpm run news:embed:remote",
      },
      nextStep: "retry-news-embeddings",
      ok: true,
      ready: false,
    });
  });

  it("points operators to the health check when the embedding batch drains", async () => {
    const embed = vi.fn(() => Promise.resolve({ embedded: 3, failed: 0 }));

    const response = await handleNewsEmbedRequest({
      apiKey: "openai-key",
      embed,
      expectedSecret: "correct-secret-value",
      request: new Request("https://example.com/api/news/embed?limit=25", {
        headers: { authorization: "Bearer correct-secret-value" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Run pnpm run news:health:remote to confirm semantic recommendations are ready.",
      ],
      commands: {
        health: "pnpm run news:health:remote",
        next: "pnpm run news:health:remote",
      },
      nextStep: "check-news-health",
      ok: true,
      ready: true,
    });
  });

  it("returns an operator-readable next step after an embedding batch", async () => {
    const embed = vi.fn(() => Promise.resolve({ embedded: 3, failed: 0 }));

    const response = await handleNewsEmbedRequest({
      apiKey: "openai-key",
      embed,
      expectedSecret: "correct-secret-value",
      request: new Request("https://example.com/api/news/embed?limit=25", {
        headers: { authorization: "Bearer correct-secret-value" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      commands: {
        next: "pnpm run news:health:remote",
      },
      nextStep: "check-news-health",
      operatorNextStep: {
        command: "pnpm run news:health:remote",
        detail:
          "Run pnpm run news:health:remote to confirm semantic recommendations are ready.",
        label: "Check news health",
        step: "check-news-health",
      },
    });
  });

  it("accepts bounded embedding batch limits from the request URL", async () => {
    const embed = vi.fn(({ limit }: { limit: number }) =>
      Promise.resolve({ embedded: limit, failed: 0 }),
    );

    const response = await handleNewsEmbedRequest({
      apiKey: "openai-key",
      embed,
      expectedSecret: "correct-secret-value",
      request: new Request("https://example.com/api/news/embed?limit=400", {
        headers: { "x-news-refresh-secret": "correct-secret-value" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      embedded: 100,
      failed: 0,
      limit: 100,
      ok: true,
    });
    expect(embed).toHaveBeenCalledWith({ limit: 100 });
  });

  it("returns structured JSON when the embedding job fails", async () => {
    const embed = vi.fn(() =>
      Promise.reject(new Error("embedding provider timed out")),
    );

    const response = await handleNewsEmbedRequest({
      apiKey: "openai-key",
      embed,
      expectedSecret: "correct-secret-value",
      request: new Request("https://example.com/api/news/embed?limit=10", {
        headers: { authorization: "Bearer correct-secret-value" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "embedding provider timed out",
      ok: false,
    });
    expect(embed).toHaveBeenCalledWith({ limit: 10 });
  });
});
