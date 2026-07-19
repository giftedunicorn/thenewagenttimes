import { describe, expect, it, vi } from "vitest";

import { handleNewsEmbedRequest } from "./handler";

const request = (search = "", secret = "correct-secret-value") =>
  new Request(`https://example.com/api/news/embed${search}`, {
    headers: { authorization: `Bearer ${secret}` },
    method: "POST",
  });

describe("handleNewsEmbedRequest", () => {
  it("rejects embedding attempts when the server secret is not configured", async () => {
    const enqueue = vi.fn();

    const response = await handleNewsEmbedRequest({
      enqueue,
      expectedSecret: undefined,
      generateId: () => "request-1",
      request: request(),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "NEWS_REFRESH_SECRET is not configured",
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("rejects requests without the expected bearer token", async () => {
    const enqueue = vi.fn();

    const response = await handleNewsEmbedRequest({
      enqueue,
      expectedSecret: "correct-secret-value",
      generateId: () => "request-1",
      request: request("", "wrong-secret"),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("enqueues a uniquely keyed embedding batch and returns 202", async () => {
    const enqueue = vi.fn().mockResolvedValue({
      job: {
        id: "job-1",
        jobType: "news_embed",
        status: "queued",
      },
      status: "queued",
    });

    const response = await handleNewsEmbedRequest({
      enqueue,
      expectedSecret: "correct-secret-value",
      generateId: () => "request-1",
      request: request("?limit=40"),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      enqueueStatus: "queued",
      job: {
        id: "job-1",
        status: "queued",
        type: "news_embed",
      },
      ok: true,
    });
    expect(enqueue).toHaveBeenCalledOnce();
    expect(enqueue).toHaveBeenCalledWith({
      dedupeKey: "manual-news-embed:request-1",
      jobType: "news_embed",
      payload: {
        batch: 0,
        limit: 40,
      },
    });
  });

  it("bounds invalid limits without requiring an OpenAI key in Next.js", async () => {
    const enqueue = vi.fn().mockResolvedValue({
      job: {
        id: "job-2",
        jobType: "news_embed",
        status: "queued",
      },
      status: "queued",
    });

    const highResponse = await handleNewsEmbedRequest({
      enqueue,
      expectedSecret: "correct-secret-value",
      generateId: () => "request-2",
      request: request("?limit=400"),
    });
    const invalidResponse = await handleNewsEmbedRequest({
      enqueue,
      expectedSecret: "correct-secret-value",
      generateId: () => "request-3",
      request: request("?limit=invalid"),
    });

    expect(highResponse.status).toBe(202);
    expect(invalidResponse.status).toBe(202);
    expect(enqueue).toHaveBeenNthCalledWith(1, {
      dedupeKey: "manual-news-embed:request-2",
      jobType: "news_embed",
      payload: { batch: 0, limit: 100 },
    });
    expect(enqueue).toHaveBeenNthCalledWith(2, {
      dedupeKey: "manual-news-embed:request-3",
      jobType: "news_embed",
      payload: { batch: 0, limit: 25 },
    });
  });

  it("returns the existing job metadata for a duplicate enqueue", async () => {
    const enqueue = vi.fn().mockResolvedValue({
      job: {
        id: "existing-job",
        jobType: "news_embed",
        status: "succeeded",
      },
      status: "duplicate",
    });

    const response = await handleNewsEmbedRequest({
      enqueue,
      expectedSecret: "correct-secret-value",
      generateId: () => "request-4",
      request: new Request("https://example.com/api/news/embed", {
        headers: {
          authorization: "Bearer correct-secret-value",
          "idempotency-key": "client-request-42",
        },
        method: "POST",
      }),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      enqueueStatus: "duplicate",
      job: {
        id: "existing-job",
        status: "succeeded",
        type: "news_embed",
      },
      ok: true,
    });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: "manual-news-embed:client-request-42",
      }),
    );
  });

  it("rejects an oversized idempotency key before enqueueing", async () => {
    const enqueue = vi.fn();
    const response = await handleNewsEmbedRequest({
      enqueue,
      expectedSecret: "correct-secret-value",
      generateId: () => "request-5",
      request: new Request("https://example.com/api/news/embed", {
        headers: {
          authorization: "Bearer correct-secret-value",
          "idempotency-key": "x".repeat(201),
        },
        method: "POST",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Idempotency-Key must be at most 200 characters",
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("returns structured JSON when enqueueing fails", async () => {
    const enqueue = vi
      .fn()
      .mockRejectedValue(new Error("database connection unavailable"));

    const response = await handleNewsEmbedRequest({
      enqueue,
      expectedSecret: "correct-secret-value",
      generateId: () => "request-5",
      request: request(),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "database connection unavailable",
      ok: false,
    });
  });
});
