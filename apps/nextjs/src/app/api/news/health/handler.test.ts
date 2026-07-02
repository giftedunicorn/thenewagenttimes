import { describe, expect, it, vi } from "vitest";

import { buildNewsDeskStatus } from "../../../_components/news-home-model";
import { handleNewsHealthRequest } from "./handler";

describe("handleNewsHealthRequest", () => {
  it("reports live news readiness with refresh protection configured", async () => {
    const getDeskStatus = vi.fn(() =>
      Promise.resolve(
        buildNewsDeskStatus({
          activeSources: 8,
          latestPublishedAt: "2026-07-01T08:00:00.000Z",
          latestRun: {
            errorMessage: null,
            finishedAt: "2026-07-01T08:05:00.000Z",
            itemsCreated: 12,
            itemsSeen: 18,
            itemsUpdated: 3,
            runType: "rss",
            sourceName: "OpenAI News",
            startedAt: "2026-07-01T08:00:00.000Z",
            status: "succeeded",
          },
          publishedStories: 24,
          totalSources: 12,
        }),
      ),
    );

    const response = await handleNewsHealthRequest({
      authSecret: "configured-auth-secret",
      getDeskStatus,
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [],
      authConfigured: true,
      checks: {
        auth: true,
        refreshSecret: true,
        schema: true,
        sources: true,
        stories: true,
      },
      news: {
        activeSources: 8,
        health: "live",
        publishedStories: 24,
        ready: true,
      },
      nextStep: "ready",
      ok: true,
      ready: true,
      refreshConfigured: true,
      web: "ready",
    });
    expect(getDeskStatus).toHaveBeenCalledOnce();
  });

  it("reports that seeded sources still need a refresh before live news is ready", async () => {
    const response = await handleNewsHealthRequest({
      authSecret: "configured-auth-secret",
      getDeskStatus: () =>
        Promise.resolve(
          buildNewsDeskStatus({
            activeSources: 10,
            latestPublishedAt: null,
            latestRun: null,
            publishedStories: 0,
            totalSources: 10,
          }),
        ),
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Run pnpm run news:refresh against the target database.",
      ],
      authConfigured: true,
      news: {
        activeSources: 10,
        health: "seeded",
        publishedStories: 0,
        ready: false,
      },
      nextStep: "run-news-refresh",
      ok: true,
      ready: false,
      refreshConfigured: true,
      web: "ready",
    });
  });

  it("surfaces missing auth secret even when the news loop is live", async () => {
    const response = await handleNewsHealthRequest({
      authSecret: undefined,
      getDeskStatus: () =>
        Promise.resolve(
          buildNewsDeskStatus({
            activeSources: 8,
            latestPublishedAt: "2026-07-01T08:00:00.000Z",
            latestRun: {
              errorMessage: null,
              finishedAt: "2026-07-01T08:05:00.000Z",
              itemsCreated: 12,
              itemsSeen: 18,
              itemsUpdated: 3,
              runType: "rss",
              sourceName: "OpenAI News",
              startedAt: "2026-07-01T08:00:00.000Z",
              status: "succeeded",
            },
            publishedStories: 24,
            totalSources: 12,
          }),
        ),
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Set BETTER_AUTH_SECRET or AUTH_SECRET in the Railway service environment.",
      ],
      authConfigured: false,
      checks: {
        auth: false,
        refreshSecret: true,
        schema: true,
        sources: true,
        stories: true,
      },
      news: {
        health: "live",
        ready: true,
      },
      nextStep: "configure-auth-secret",
      ready: false,
      refreshConfigured: true,
      web: "ready",
    });
  });

  it("keeps the web health reachable while surfacing schema and secret gaps", async () => {
    const response = await handleNewsHealthRequest({
      getDeskStatus: () => Promise.reject(new Error("relation does not exist")),
      refreshSecret: undefined,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Set BETTER_AUTH_SECRET or AUTH_SECRET in the Railway service environment.",
        "Set NEWS_REFRESH_SECRET in the Railway service environment.",
        "Apply the database schema to the target database.",
        "Seed sources and run pnpm run news:refresh.",
      ],
      authConfigured: false,
      checks: {
        auth: false,
        refreshSecret: false,
        schema: false,
        sources: false,
        stories: false,
      },
      news: {
        activeSources: 0,
        health: "unavailable",
        publishedStories: 0,
        ready: false,
      },
      nextStep: "configure-auth-secret",
      ok: true,
      ready: false,
      refreshConfigured: false,
      web: "ready",
    });
  });
});
