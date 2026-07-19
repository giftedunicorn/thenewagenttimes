import { describe, expect, it, vi } from "vitest";

import { handleCronNewsRefreshRequest } from "./handler";

const request = (secret?: string) =>
  new Request("http://thenewaitimes.railway.internal/api/cron/news-refresh", {
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  });

describe("handleCronNewsRefreshRequest", () => {
  it("rejects calls when the cron secret is not configured", async () => {
    const enqueue = vi.fn();

    const response = await handleCronNewsRefreshRequest({
      enqueue,
      expectedSecret: undefined,
      now: () => new Date("2026-07-19T09:47:32.456Z"),
      request: request(),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "CRON_SECRET is not configured",
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("rejects calls without the expected bearer token", async () => {
    const enqueue = vi.fn();

    const response = await handleCronNewsRefreshRequest({
      enqueue,
      expectedSecret: "correct-secret-value",
      now: () => new Date("2026-07-19T09:47:32.456Z"),
      request: request("wrong-secret"),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("enqueues one cron refresh for the current two-hour window", async () => {
    const enqueue = vi.fn().mockResolvedValue({
      job: {
        id: "job-1",
        status: "queued",
      },
      status: "queued",
    });

    const response = await handleCronNewsRefreshRequest({
      enqueue,
      expectedSecret: "correct-secret-value",
      now: () => new Date("2026-07-19T09:47:32.456Z"),
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
      dedupeKey: "news-refresh:2026-07-19T08:00:00.000Z",
      jobType: "news_refresh",
      payload: {
        requestedAt: "2026-07-19T09:47:32.456Z",
        trigger: "cron",
      },
    });
  });

  it("returns the existing job when the cron request is repeated", async () => {
    const enqueue = vi.fn().mockResolvedValue({
      job: {
        id: "existing-job",
        status: "running",
      },
      status: "duplicate",
    });

    const response = await handleCronNewsRefreshRequest({
      enqueue,
      expectedSecret: "correct-secret-value",
      now: () => new Date("2026-07-19T09:59:59.999Z"),
      request: request("correct-secret-value"),
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
  });
});
