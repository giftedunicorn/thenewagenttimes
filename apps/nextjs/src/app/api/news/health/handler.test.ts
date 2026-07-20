import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildNewsDeskStatus } from "../../../_components/news-home-model";
import { handleNewsHealthRequest } from "./handler";

describe("handleNewsHealthRequest", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T09:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports live news readiness with refresh protection configured", async () => {
    const getDeskStatus = vi.fn(() =>
      Promise.resolve(
        buildNewsDeskStatus({
          activeSources: 26,
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
          totalSources: 28,
          unembeddedStories: 0,
        }),
      ),
    );

    const response = await handleNewsHealthRequest({
      getDeskStatus,
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [],
      checks: {
        refreshSecret: true,
        schema: true,
        semantic: true,
        sources: true,
        stories: true,
      },
      news: {
        activeSources: 26,
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

  it("surfaces stale source catalogs before treating live news as production ready", async () => {
    const response = await handleNewsHealthRequest({
      getDeskStatus: () =>
        Promise.resolve(
          buildNewsDeskStatus({
            activeSources: 24,
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
            totalSources: 24,
            unembeddedStories: 0,
          }),
        ),
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Enqueue a news refresh so the worker seeds the current 26 active-source catalog before ingesting stories.",
      ],
      checks: {
        sourceCatalog: false,
        sources: true,
      },
      commands: {
        next: null,
      },
      news: {
        activeSources: 24,
        expectedActiveSources: 26,
        sourceCatalogReady: false,
        totalSources: 24,
      },
      nextStep: "seed-news-sources",
      ready: false,
    });
  });

  it("keeps stale live editions out of the ready state", async () => {
    const response = await handleNewsHealthRequest({
      getDeskStatus: () =>
        Promise.resolve(
          buildNewsDeskStatus({
            activeSources: 26,
            embeddedStories: 24,
            latestPublishedAt: "2000-01-01T08:00:00.000Z",
            latestRun: {
              errorMessage: null,
              finishedAt: "2000-01-01T08:05:00.000Z",
              itemsCreated: 12,
              itemsSeen: 18,
              itemsUpdated: 3,
              runType: "rss",
              sourceName: "OpenAI News",
              startedAt: "2000-01-01T08:00:00.000Z",
              status: "succeeded",
            },
            publishedStories: 24,
            totalSources: 28,
            unembeddedStories: 0,
          }),
        ),
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Enqueue a news refresh because the latest live story is older than 72 hours.",
      ],
      checks: {
        freshness: false,
        stories: true,
      },
      commands: {
        next: null,
      },
      news: {
        freshReady: false,
        latestPublishedAt: "2000-01-01T08:00:00.000Z",
        maxStoryAgeHours: 72,
        ready: false,
      },
      nextStep: "run-news-refresh",
      ready: false,
    });
  });

  it("surfaces cluster schema gaps even when legacy news tables are reachable", async () => {
    const response = await handleNewsHealthRequest({
      getDeskStatus: () =>
        Promise.resolve(
          buildNewsDeskStatus({
            activeSources: 26,
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
            totalSources: 28,
            unembeddedStories: 0,
          }),
        ),
      getSchemaReadiness: () =>
        Promise.resolve({
          newsItemClusterKey: "missing",
        }),
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Apply the database schema so news_item.cluster_key is available.",
      ],
      checks: {
        refreshSecret: true,
        schema: false,
        semantic: true,
        sources: true,
        stories: true,
      },
      commands: {
        next: "pnpm run db:predeploy",
        schema: "pnpm run db:predeploy",
      },
      news: {
        health: "live",
        ready: true,
      },
      nextStep: "apply-database-schema",
      ready: false,
      schema: {
        newsItemClusterKey: "missing",
      },
    });
  });

  it("returns an operator-readable next step with the command and action detail", async () => {
    const response = await handleNewsHealthRequest({
      getDeskStatus: () =>
        Promise.resolve(
          buildNewsDeskStatus({
            activeSources: 0,
            latestPublishedAt: null,
            latestRun: null,
            publishedStories: 0,
            totalSources: 0,
            unavailable: true,
          }),
        ),
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Apply the database schema to the target database.",
        "Deploy the schema, then enqueue a news refresh.",
      ],
      commands: {
        next: "pnpm run db:predeploy",
      },
      nextStep: "apply-database-schema",
      operatorNextStep: {
        command: "pnpm run db:predeploy",
        detail: "Apply the database schema to the target database.",
        label: "Apply database schema",
        step: "apply-database-schema",
      },
    });
  });

  it("keeps half-applied cluster schema migrations out of the ready state", async () => {
    const response = await handleNewsHealthRequest({
      getDeskStatus: () =>
        Promise.resolve(
          buildNewsDeskStatus({
            activeSources: 26,
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
            totalSources: 28,
            unembeddedStories: 0,
          }),
        ),
      getSchemaReadiness: () =>
        Promise.resolve({
          newsItemClusterKey: "incomplete",
        }),
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Run pnpm run db:predeploy so news_item.cluster_key is backfilled and non-null.",
      ],
      checks: {
        schema: false,
      },
      commands: {
        next: "pnpm run db:predeploy",
      },
      nextStep: "apply-database-schema",
      ready: false,
      schema: {
        newsItemClusterKey: "incomplete",
      },
    });
  });

  it("surfaces the latest refresh yield diagnostics for production checks", async () => {
    const response = await handleNewsHealthRequest({
      getDeskStatus: () =>
        Promise.resolve(
          buildNewsDeskStatus({
            activeSources: 26,
            embeddedStories: 24,
            latestPublishedAt: "2026-07-01T08:00:00.000Z",
            latestRun: {
              errorMessage: null,
              finishedAt: "2026-07-01T08:05:00.000Z",
              itemsCreated: 4,
              itemsSeen: 9,
              itemsSkipped: 3,
              itemsUpdated: 1,
              runType: "rss",
              skippedByReason: {
                duplicate: 0,
                future: 0,
                irrelevant: 1,
                low_quality: 2,
                stale: 0,
              },
              sourceName: "OpenAI News",
              startedAt: "2026-07-01T08:00:00.000Z",
              status: "succeeded",
            },
            publishedStories: 24,
            totalSources: 28,
            unembeddedStories: 0,
          }),
        ),
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      news: {
        latestRunYield: "4 new, 1 updated, 3 skipped (2 low-quality, 1 non-AI)",
      },
      nextStep: "ready",
      ready: true,
    });
  });

  it("reports that seeded sources still need a refresh before live news is ready", async () => {
    const response = await handleNewsHealthRequest({
      getDeskStatus: () =>
        Promise.resolve(
          buildNewsDeskStatus({
            activeSources: 26,
            latestPublishedAt: null,
            latestRun: null,
            publishedStories: 0,
            totalSources: 28,
          }),
        ),
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: ["Enqueue a news refresh for the background worker."],
      news: {
        activeSources: 26,
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
      getDeskStatus: () =>
        Promise.resolve(
          buildNewsDeskStatus({
            activeSources: 26,
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
            totalSources: 28,
            unembeddedStories: 21,
          }),
        ),
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "The background worker must finish embedding the live edition; inspect failed background jobs if progress stops.",
      ],
      checks: {
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

  it("uses database progress without requiring the worker secret in web", async () => {
    const response = await handleNewsHealthRequest({
      getDeskStatus: () =>
        Promise.resolve(
          buildNewsDeskStatus({
            activeSources: 26,
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
            totalSources: 28,
            unembeddedStories: 21,
          }),
        ),
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "The background worker must finish embedding the live edition; inspect failed background jobs if progress stops.",
      ],
      checks: {
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
      nextStep: "embed-news-stories",
      ready: false,
    });
  });

  it("surfaces failed source diagnostics for partial aggregate refreshes", async () => {
    const response = await handleNewsHealthRequest({
      getDeskStatus: () =>
        Promise.resolve(
          buildNewsDeskStatus({
            activeSources: 26,
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
                emptyReasonMessages: {
                  "google-ai-blog":
                    "No usable items were collected: 4 low-quality.",
                },
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
            totalSources: 28,
            unembeddedStories: 0,
          }),
        ),
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Inspect failed sources: anthropic-news (feed unavailable). Empty sources: google-ai-blog (No usable items were collected: 4 low-quality.). Enqueue a news refresh after fixing source issues.",
      ],
      news: {
        health: "error",
        latestRun: {
          sourceHealth: {
            emptySourceSlugs: ["google-ai-blog"],
            emptyReasonMessages: {
              "google-ai-blog":
                "No usable items were collected: 4 low-quality.",
            },
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
      getDeskStatus: () => Promise.reject(new Error("relation does not exist")),
      refreshSecret: undefined,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Set CRON_SECRET in the Railway service environment.",
        "Apply the database schema to the target database.",
        "Deploy the schema, then enqueue a news refresh.",
      ],
      checks: {
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
      homepage: {
        mode: "preview",
        path: "/",
        previewStories: 12,
        servingNewsExperience: true,
        title: "The New AI Times",
      },
      nextStep: "configure-refresh-secret",
      ok: true,
      ready: false,
      refreshConfigured: false,
      web: "ready",
    });
  });

  it("prioritizes database schema setup before queued processing", async () => {
    const response = await handleNewsHealthRequest({
      getDeskStatus: () => Promise.reject(new Error("relation does not exist")),
      refreshSecret: "configured-refresh-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionRequired: [
        "Apply the database schema to the target database.",
        "Deploy the schema, then enqueue a news refresh.",
      ],
      checks: {
        refreshSecret: true,
        schema: false,
      },
      commands: {
        bootstrap: null,
        embed: null,
        health: "pnpm run news:health:remote",
        next: "pnpm run db:predeploy",
        refresh: null,
        schema: "pnpm run db:predeploy",
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
