import { describe, expect, it, vi } from "vitest";

import { buildNewsDeskStatus } from "../../../_components/news-home-model";
import { handleNewsHealthRequest } from "./handler";

describe("handleNewsHealthRequest", () => {
  it("reports live news readiness with refresh protection configured", async () => {
    const getDeskStatus = vi.fn(() =>
      Promise.resolve(
        buildNewsDeskStatus({
          activeSources: 8,
          embeddedStories: 24,
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
          unembeddedStories: 0,
        }),
      ),
    );

    const response = await handleNewsHealthRequest({
      authSecret: "configured-auth-secret",
      embeddingApiKey: "configured-openai-key",
      getDeskStatus,
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [],
      authConfigured: true,
      checks: {
        auth: true,
        embeddingProvider: true,
        refreshSecret: true,
        schema: true,
        semantic: true,
        sources: true,
        stories: true,
      },
      news: {
        activeSources: 8,
        health: "live",
        liveReady: true,
        publishedStories: 24,
        ready: true,
        semanticReady: true,
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
      embeddingApiKey: "configured-openai-key",
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
        liveReady: false,
        publishedStories: 0,
        ready: false,
        semanticReady: false,
      },
      nextStep: "run-news-refresh",
      ok: true,
      ready: false,
      refreshConfigured: true,
      web: "ready",
    });
  });

  it("keeps live news unready until published stories have embeddings", async () => {
    const response = await handleNewsHealthRequest({
      authSecret: "configured-auth-secret",
      embeddingApiKey: "configured-openai-key",
      getDeskStatus: () =>
        Promise.resolve(
          buildNewsDeskStatus({
            activeSources: 8,
            embeddedStories: 3,
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
            unembeddedStories: 21,
          }),
        ),
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Run pnpm run news:embed:remote so semantic recommendations can use the live edition.",
      ],
      checks: {
        auth: true,
        refreshSecret: true,
        schema: true,
        semantic: false,
        sources: true,
        stories: true,
      },
      news: {
        embeddedStories: 3,
        liveReady: true,
        ready: false,
        semanticReady: false,
        unembeddedStories: 21,
      },
      nextStep: "embed-news-stories",
      ready: false,
    });
  });

  it("surfaces missing embedding provider config before semantic embedding jobs run", async () => {
    const response = await handleNewsHealthRequest({
      authSecret: "configured-auth-secret",
      embeddingApiKey: undefined,
      getDeskStatus: () =>
        Promise.resolve(
          buildNewsDeskStatus({
            activeSources: 8,
            embeddedStories: 3,
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
            unembeddedStories: 21,
          }),
        ),
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Set OPENAI_API_KEY in the Railway service environment before running semantic embeddings.",
        "Run pnpm run news:embed:remote so semantic recommendations can use the live edition.",
      ],
      checks: {
        auth: true,
        embeddingProvider: false,
        refreshSecret: true,
        schema: true,
        semantic: false,
        sources: true,
        stories: true,
      },
      news: {
        liveReady: true,
        ready: false,
        semanticReady: false,
      },
      nextStep: "configure-embedding-provider",
      ready: false,
    });
  });

  it("surfaces missing auth secret even when the news loop is live", async () => {
    const response = await handleNewsHealthRequest({
      authSecret: undefined,
      embeddingApiKey: "configured-openai-key",
      getDeskStatus: () =>
        Promise.resolve(
          buildNewsDeskStatus({
            activeSources: 8,
            embeddedStories: 24,
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
            unembeddedStories: 0,
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
        embeddingProvider: true,
        refreshSecret: true,
        schema: true,
        semantic: true,
        sources: true,
        stories: true,
      },
      news: {
        health: "live",
        liveReady: true,
        ready: true,
        semanticReady: true,
      },
      nextStep: "configure-auth-secret",
      ready: false,
      refreshConfigured: true,
      web: "ready",
    });
  });

  it("surfaces failed source diagnostics for partial aggregate refreshes", async () => {
    const response = await handleNewsHealthRequest({
      authSecret: "configured-auth-secret",
      embeddingApiKey: "configured-openai-key",
      getDeskStatus: () =>
        Promise.resolve(
          buildNewsDeskStatus({
            activeSources: 8,
            embeddedStories: 24,
            latestPublishedAt: "2026-07-01T08:00:00.000Z",
            latestRun: {
              errorMessage: "1 source failed",
              finishedAt: "2026-07-01T08:05:00.000Z",
              itemsCreated: 12,
              itemsSeen: 18,
              itemsUpdated: 3,
              runType: "rss",
              sourceHealth: {
                emptySourceSlugs: ["google-ai-blog"],
                failedSourceSlugs: ["anthropic-news"],
                failureMessages: {
                  "anthropic-news": "feed unavailable",
                },
                healthySourceSlugs: ["openai-news", "deepmind-blog"],
              },
              sourceName: null,
              startedAt: "2026-07-01T08:00:00.000Z",
              status: "partial",
            },
            publishedStories: 24,
            totalSources: 12,
            unembeddedStories: 0,
          }),
        ),
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Inspect failed sources: anthropic-news (feed unavailable). Empty sources: google-ai-blog. Rerun pnpm run news:refresh after fixing source issues.",
      ],
      news: {
        health: "error",
        latestRun: {
          sourceHealth: {
            emptySourceSlugs: ["google-ai-blog"],
            failedSourceSlugs: ["anthropic-news"],
            failureMessages: {
              "anthropic-news": "feed unavailable",
            },
          },
        },
      },
      nextStep: "inspect-ingestion-run",
      ready: false,
    });
  });

  it("keeps the web health reachable while surfacing schema and secret gaps", async () => {
    const response = await handleNewsHealthRequest({
      embeddingApiKey: undefined,
      getDeskStatus: () => Promise.reject(new Error("relation does not exist")),
      refreshSecret: undefined,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Set BETTER_AUTH_SECRET or AUTH_SECRET in the Railway service environment.",
        "Set NEWS_REFRESH_SECRET in the Railway service environment.",
        "Set OPENAI_API_KEY in the Railway service environment before running semantic embeddings.",
        "Apply the database schema to the target database.",
        "Seed sources and run pnpm run news:refresh.",
      ],
      authConfigured: false,
      checks: {
        auth: false,
        embeddingProvider: false,
        refreshSecret: false,
        schema: false,
        semantic: false,
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

  it("prioritizes database schema setup before semantic embedding provider setup", async () => {
    const response = await handleNewsHealthRequest({
      authSecret: "configured-auth-secret",
      embeddingApiKey: undefined,
      getDeskStatus: () => Promise.reject(new Error("relation does not exist")),
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Set OPENAI_API_KEY in the Railway service environment before running semantic embeddings.",
        "Apply the database schema to the target database.",
        "Seed sources and run pnpm run news:refresh.",
      ],
      checks: {
        auth: true,
        embeddingProvider: false,
        refreshSecret: true,
        schema: false,
      },
      commands: {
        bootstrap: "pnpm run news:bootstrap:remote",
        embed: "pnpm run news:embed:remote",
        health: "pnpm run news:health:remote",
        next: "pnpm run db:push",
        refresh: "pnpm run news:refresh:remote",
        schema: "pnpm run db:push",
        seedSources: "pnpm run news:seed-sources",
      },
      news: {
        health: "unavailable",
      },
      nextStep: "apply-database-schema",
      ready: false,
    });
  });
});
