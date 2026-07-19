import { describe, expect, it, vi } from "vitest";

import { handleNewsRefreshRequest } from "./handler";

const request = (secret?: string) =>
  new Request("https://example.com/api/news/refresh", {
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
    method: "POST",
  });

describe("handleNewsRefreshRequest", () => {
  it("rejects refresh attempts when the server secret is not configured", async () => {
    const enqueue = vi.fn();

    const response = await handleNewsRefreshRequest({
      enqueue,
      expectedSecret: undefined,
      generateId: () => "request-1",
      now: () => new Date("2026-07-19T12:34:56.789Z"),
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

    const response = await handleNewsRefreshRequest({
      enqueue,
      expectedSecret: "correct-secret-value",
      generateId: () => "request-1",
      now: () => new Date("2026-07-19T12:34:56.789Z"),
      request: request("wrong-secret"),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("enqueues a uniquely keyed manual refresh and returns 202", async () => {
    const enqueue = vi.fn().mockResolvedValue({
      job: {
        id: "job-1",
        jobType: "news_refresh",
        status: "queued",
      },
      status: "queued",
    });

    const response = await handleNewsRefreshRequest({
      enqueue,
      expectedSecret: "correct-secret-value",
      generateId: () => "request-1",
      now: () => new Date("2026-07-19T12:34:56.789Z"),
      request: request("correct-secret-value"),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      enqueueStatus: "queued",
      job: {
        id: "job-1",
        status: "queued",
        type: "news_refresh",
      },
      ok: true,
    });
    expect(enqueue).toHaveBeenCalledOnce();
    expect(enqueue).toHaveBeenCalledWith({
      dedupeKey: "manual-news-refresh:request-1",
      jobType: "news_refresh",
      payload: {
        requestedAt: "2026-07-19T12:34:56.789Z",
        trigger: "manual",
      },
    });
  });

  it("accepts the news refresh secret header", async () => {
    const enqueue = vi.fn().mockResolvedValue({
      job: {
        id: "job-2",
        jobType: "news_refresh",
        status: "queued",
      },
      status: "queued",
    });

    const response = await handleNewsRefreshRequest({
      enqueue,
      expectedSecret: "correct-secret-value",
      generateId: () => "request-2",
      now: () => new Date("2026-07-19T12:34:56.789Z"),
      request: new Request("https://example.com/api/news/refresh", {
        headers: { "x-news-refresh-secret": "correct-secret-value" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(202);
    expect(enqueue).toHaveBeenCalledOnce();
  });

  it("returns the existing job metadata for a duplicate enqueue", async () => {
    const enqueue = vi.fn().mockResolvedValue({
      job: {
        id: "existing-job",
        jobType: "news_refresh",
        status: "running",
      },
      status: "duplicate",
    });

    const response = await handleNewsRefreshRequest({
      enqueue,
      expectedSecret: "correct-secret-value",
      generateId: () => "request-2",
      now: () => new Date("2026-07-19T12:34:56.789Z"),
      request: new Request("https://example.com/api/news/refresh", {
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
        status: "running",
        type: "news_refresh",
      },
      ok: true,
    });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: "manual-news-refresh:client-request-42",
      }),
    );
  });

  it("rejects an oversized idempotency key before enqueueing", async () => {
    const enqueue = vi.fn();
    const response = await handleNewsRefreshRequest({
      enqueue,
      expectedSecret: "correct-secret-value",
      generateId: () => "request-3",
      now: () => new Date("2026-07-19T12:34:56.789Z"),
      request: new Request("https://example.com/api/news/refresh", {
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
      .mockRejectedValue(new Error("relation background_job does not exist"));

    const response = await handleNewsRefreshRequest({
      enqueue,
      expectedSecret: "correct-secret-value",
      generateId: () => "request-3",
      now: () => new Date("2026-07-19T12:34:56.789Z"),
      request: request("correct-secret-value"),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "relation background_job does not exist",
      ok: false,
    });
  });
});
