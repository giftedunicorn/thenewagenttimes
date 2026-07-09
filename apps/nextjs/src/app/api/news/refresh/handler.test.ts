import { describe, expect, it, vi } from "vitest";

import { handleNewsRefreshRequest } from "./handler";

const refreshResult = {
  sourcesSeeded: 12,
  sourcesAttempted: 9,
  sourcesSucceeded: 9,
  sourcesFailed: 0,
  itemsSeen: 18,
  itemsCreated: 10,
  itemsUpdated: 8,
  itemsSkipped: 3,
  skippedByReason: {
    duplicate: 1,
    future: 0,
    irrelevant: 2,
    low_quality: 0,
    stale: 0,
  },
  results: [],
  sourceHealth: {
    healthySourceSlugs: ["openai-news"],
    emptySourceSlugs: [],
    failedSourceSlugs: [],
    failureMessages: {},
  },
};

describe("handleNewsRefreshRequest", () => {
  it("rejects refresh attempts when the server secret is not configured", async () => {
    const refresh = vi.fn(() => Promise.resolve(refreshResult));

    const response = await handleNewsRefreshRequest({
      expectedSecret: undefined,
      refresh,
      request: new Request("https://example.com/api/news/refresh", {
        method: "POST",
      }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "NEWS_REFRESH_SECRET is not configured",
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rejects requests without the expected bearer token", async () => {
    const refresh = vi.fn(() => Promise.resolve(refreshResult));

    const response = await handleNewsRefreshRequest({
      expectedSecret: "correct-secret-value",
      refresh,
      request: new Request("https://example.com/api/news/refresh", {
        headers: { authorization: "Bearer wrong-secret" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("runs the refresh job and returns its summary when authorized", async () => {
    const refresh = vi.fn(() => Promise.resolve(refreshResult));

    const response = await handleNewsRefreshRequest({
      expectedSecret: "correct-secret-value",
      refresh,
      request: new Request("https://example.com/api/news/refresh", {
        headers: { authorization: "Bearer correct-secret-value" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      ...refreshResult,
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("tells operators to embed refreshed stories after a successful content refresh", async () => {
    const refresh = vi.fn(() => Promise.resolve(refreshResult));

    const response = await handleNewsRefreshRequest({
      expectedSecret: "correct-secret-value",
      refresh,
      request: new Request("https://example.com/api/news/refresh", {
        headers: { authorization: "Bearer correct-secret-value" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Run pnpm run news:embed:remote so semantic recommendations include refreshed stories.",
      ],
      commands: {
        embed: "pnpm run news:embed:remote",
        next: "pnpm run news:embed:remote",
      },
      nextStep: "embed-news-stories",
      ok: true,
      ready: false,
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("surfaces failed and empty source diagnostics after a partial refresh", async () => {
    const refresh = vi.fn(() =>
      Promise.resolve({
        ...refreshResult,
        sourcesFailed: 1,
        sourcesSucceeded: 8,
        sourceHealth: {
          emptySourceSlugs: ["google-ai-blog"],
          failedSourceSlugs: ["anthropic-news"],
          failureMessages: {
            "anthropic-news": "feed unavailable",
          },
          healthySourceSlugs: ["openai-news"],
        },
      }),
    );

    const response = await handleNewsRefreshRequest({
      expectedSecret: "correct-secret-value",
      refresh,
      request: new Request("https://example.com/api/news/refresh", {
        headers: { authorization: "Bearer correct-secret-value" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Inspect failed news sources: anthropic-news (feed unavailable). Empty sources: google-ai-blog. Rerun pnpm run news:refresh:remote after fixing source issues.",
      ],
      commands: {
        next: "pnpm run news:refresh:remote",
      },
      nextStep: "inspect-source-failures",
      ok: true,
      ready: false,
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("accepts the news refresh secret header for scheduled refresh jobs", async () => {
    const refresh = vi.fn(() => Promise.resolve(refreshResult));

    const response = await handleNewsRefreshRequest({
      expectedSecret: "correct-secret-value",
      refresh,
      request: new Request("https://example.com/api/news/refresh", {
        headers: { "x-news-refresh-secret": "correct-secret-value" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      ...refreshResult,
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("returns structured JSON when the refresh job fails", async () => {
    const refresh = vi.fn(() =>
      Promise.reject(new Error("relation news_source does not exist")),
    );

    const response = await handleNewsRefreshRequest({
      expectedSecret: "correct-secret-value",
      refresh,
      request: new Request("https://example.com/api/news/refresh", {
        headers: { authorization: "Bearer correct-secret-value" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "relation news_source does not exist",
      ok: false,
    });
    expect(refresh).toHaveBeenCalledOnce();
  });
});
