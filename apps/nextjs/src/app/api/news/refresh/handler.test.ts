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
    await expect(response.json()).resolves.toEqual({
      ok: true,
      ...refreshResult,
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
    await expect(response.json()).resolves.toEqual({
      ok: true,
      ...refreshResult,
    });
    expect(refresh).toHaveBeenCalledOnce();
  });
});
