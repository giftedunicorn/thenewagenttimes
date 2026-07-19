import { describe, expect, it, vi } from "vitest";

import { dispatchCronJob } from "./dispatcher";

describe("dispatchCronJob", () => {
  it("calls the configured Next.js cron endpoint with bearer authentication", async () => {
    const fetchRequest = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { enqueueStatus: "queued", job: { id: "job-1" }, ok: true },
          { status: 202 },
        ),
      );

    const result = await dispatchCronJob({
      baseUrl: "http://thenewaitimes.railway.internal:8080",
      fetchRequest,
      job: {
        name: "news-refresh",
        path: "/api/cron/news-refresh",
        schedule: "0 */2 * * *",
      },
      secret: "cron-secret-value",
    });

    expect(fetchRequest).toHaveBeenCalledOnce();
    const call = fetchRequest.mock.calls.at(0);
    if (!call) throw new Error("Expected one cron HTTP request");
    const [url, options] = call;
    expect(url).toBe(
      "http://thenewaitimes.railway.internal:8080/api/cron/news-refresh",
    );
    expect(options?.headers).toEqual({
      authorization: "Bearer cron-secret-value",
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(result).toEqual({
      body: {
        enqueueStatus: "queued",
        job: { id: "job-1" },
        ok: true,
      },
      status: 202,
    });
  });

  it("rejects non-success responses from the Next.js cron endpoint", async () => {
    const fetchRequest = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ error: "Unauthorized" }, { status: 401 }),
      );

    await expect(
      dispatchCronJob({
        baseUrl: "http://thenewaitimes.railway.internal:8080",
        fetchRequest,
        job: {
          name: "news-refresh",
          path: "/api/cron/news-refresh",
          schedule: "0 */2 * * *",
        },
        secret: "wrong-secret",
      }),
    ).rejects.toThrow("news-refresh returned HTTP 401");
  });

  it("retries a transient request failure without changing the target job", async () => {
    const fetchRequest = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("request timed out"))
      .mockResolvedValueOnce(Response.json({ ok: true }, { status: 202 }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      dispatchCronJob({
        baseUrl: "http://thenewaitimes.railway.internal:8080",
        fetchRequest,
        job: {
          name: "news-refresh",
          path: "/api/cron/news-refresh",
          schedule: "0 */2 * * *",
        },
        secret: "cron-secret-value",
        sleep,
      }),
    ).resolves.toMatchObject({ status: 202 });

    expect(fetchRequest).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
  });
});
