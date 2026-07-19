import { describe, expect, it } from "vitest";

import {
  checkRemoteNewsHealth,
  formatRemoteNewsHealthSummary,
  RemoteNewsHealthNotReadyError,
  resolveRemoteNewsHealthCommandInput,
  resolveRemoteNewsHealthUrl,
} from "./remote-health";

describe("resolveRemoteNewsHealthUrl", () => {
  it("keeps an explicit health endpoint", () => {
    expect(
      resolveRemoteNewsHealthUrl(
        "https://thenewaitimes.up.railway.app/api/news/health",
      ),
    ).toBe("https://thenewaitimes.up.railway.app/api/news/health");
  });

  it("turns an app base URL into the health endpoint", () => {
    expect(
      resolveRemoteNewsHealthUrl("https://thenewaitimes.up.railway.app"),
    ).toBe("https://thenewaitimes.up.railway.app/api/news/health");
  });

  it("turns an explicit refresh endpoint into the health endpoint", () => {
    expect(
      resolveRemoteNewsHealthUrl(
        "https://thenewaitimes.up.railway.app/api/news/refresh",
      ),
    ).toBe("https://thenewaitimes.up.railway.app/api/news/health");
  });

  it("turns an explicit embed endpoint into the health endpoint", () => {
    expect(
      resolveRemoteNewsHealthUrl(
        "https://thenewaitimes.up.railway.app/api/news/embed",
      ),
    ).toBe("https://thenewaitimes.up.railway.app/api/news/health");
  });

  it("uses the Railway public domain when the health URL is not configured", () => {
    expect(resolveRemoteNewsHealthUrl("", "thenewaitimes.up.railway.app")).toBe(
      "https://thenewaitimes.up.railway.app/api/news/health",
    );
  });
});

describe("resolveRemoteNewsHealthCommandInput", () => {
  it("keeps an explicit URL argument ahead of environment URLs", () => {
    expect(
      resolveRemoteNewsHealthCommandInput({
        argv: ["https://custom.example/api/news/refresh"],
        env: {
          NEWS_HEALTH_URL: "https://thenewaitimes.up.railway.app",
          RAILWAY_PUBLIC_DOMAIN: "thenewaitimes.up.railway.app",
        },
      }),
    ).toEqual({
      healthUrl: "https://custom.example/api/news/refresh",
      railwayPublicDomain: "thenewaitimes.up.railway.app",
    });
  });

  it("uses only the dedicated health URL and Railway public domain", () => {
    expect(
      resolveRemoteNewsHealthCommandInput({
        argv: [],
        env: {
          NEWS_BOOTSTRAP_URL: "https://obsolete.example/bootstrap",
          NEWS_EMBED_URL: "https://obsolete.example/embed",
          NEWS_HEALTH_URL: "https://thenewaitimes.up.railway.app",
          NEWS_REFRESH_URL: "https://obsolete.example/refresh",
          RAILWAY_PUBLIC_DOMAIN: "fallback.up.railway.app",
        },
      }),
    ).toEqual({
      healthUrl: "https://thenewaitimes.up.railway.app",
      railwayPublicDomain: "fallback.up.railway.app",
    });
  });

  it("does not revive removed producer URL fallbacks", () => {
    expect(
      resolveRemoteNewsHealthCommandInput({
        argv: [],
        env: {
          NEWS_BOOTSTRAP_URL: "",
          NEWS_EMBED_URL: "",
          NEWS_HEALTH_URL: "   ",
          NEWS_REFRESH_URL:
            "https://thenewaitimes.up.railway.app/api/news/refresh",
          RAILWAY_PUBLIC_DOMAIN: "thenewaitimes.up.railway.app",
        },
      }),
    ).toEqual({
      healthUrl: undefined,
      railwayPublicDomain: "thenewaitimes.up.railway.app",
    });
  });
});

describe("checkRemoteNewsHealth", () => {
  it("fetches the health endpoint and exposes readiness fields", async () => {
    const requests: { method: string; url: string }[] = [];

    const result = await checkRemoteNewsHealth({
      fetchHealth: (url, init) => {
        requests.push({ method: init.method, url });

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                checks: {
                  auth: true,
                  refreshSecret: true,
                  schema: true,
                  sources: true,
                  stories: true,
                },
                nextStep: "ready",
                homepage: {
                  mode: "live",
                  path: "/",
                  previewStories: 12,
                  servingNewsExperience: true,
                  title: "The New AI Times",
                },
                news: {
                  liveReady: true,
                  semanticReady: true,
                },
                ready: true,
              }),
            ),
        });
      },
      healthUrl: "https://thenewaitimes.up.railway.app",
    });

    expect(requests).toEqual([
      {
        method: "GET",
        url: "https://thenewaitimes.up.railway.app/api/news/health",
      },
    ]);
    expect(result).toEqual({
      actionRequired: [],
      body: {
        checks: {
          auth: true,
          refreshSecret: true,
          schema: true,
          sources: true,
          stories: true,
        },
        homepage: {
          mode: "live",
          path: "/",
          previewStories: 12,
          servingNewsExperience: true,
          title: "The New AI Times",
        },
        nextStep: "ready",
        news: {
          liveReady: true,
          semanticReady: true,
        },
        ready: true,
      },
      commands: {},
      homepage: {
        mode: "live",
        path: "/",
        previewStories: 12,
        servingNewsExperience: true,
        title: "The New AI Times",
      },
      liveReady: true,
      nextCommand: null,
      nextStep: "ready",
      ready: true,
      semanticReady: true,
      status: 200,
    });
  });

  it("rejects ready responses that are not serving the New AI Times homepage", async () => {
    const error = await checkRemoteNewsHealth({
      fetchHealth: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                homepage: {
                  mode: "preview",
                  path: "/",
                  previewStories: 0,
                  servingNewsExperience: false,
                  title: "TanStack Start",
                },
                news: {
                  liveReady: true,
                  semanticReady: true,
                },
                nextStep: "ready",
                ready: true,
              }),
            ),
        }),
      healthUrl: "https://thenewaitimes.up.railway.app",
    }).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(RemoteNewsHealthNotReadyError);
    expect(error).toMatchObject({
      message: "Remote news health is not ready: nextStep=homepage-mismatch",
      result: {
        homepage: {
          mode: "preview",
          path: "/",
          previewStories: 0,
          servingNewsExperience: false,
          title: "TanStack Start",
        },
        nextStep: "homepage-mismatch",
        ready: true,
        status: 200,
      },
    });
  });

  it("rejects ready responses whose homepage has no live or preview stories", async () => {
    const error = await checkRemoteNewsHealth({
      fetchHealth: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                homepage: {
                  liveStories: 0,
                  mode: "live",
                  path: "/",
                  previewStories: 0,
                  servingNewsExperience: true,
                  title: "The New AI Times",
                },
                news: {
                  liveReady: true,
                  semanticReady: true,
                },
                nextStep: "ready",
                ready: true,
              }),
            ),
        }),
      healthUrl: "https://thenewaitimes.up.railway.app",
    }).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(RemoteNewsHealthNotReadyError);
    expect(error).toMatchObject({
      message: "Remote news health is not ready: nextStep=homepage-mismatch",
      result: {
        homepage: {
          liveStories: 0,
          mode: "live",
          path: "/",
          previewStories: 0,
          servingNewsExperience: true,
          title: "The New AI Times",
        },
        nextStep: "homepage-mismatch",
        ready: true,
        status: 200,
      },
    });
  });

  it("rejects remote health responses that are not production ready", async () => {
    const error = await checkRemoteNewsHealth({
      fetchHealth: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                actionRequired: [
                  "The background worker must finish embedding the live edition; inspect failed background jobs if progress stops.",
                ],
                checks: {
                  auth: true,
                  refreshSecret: true,
                  schema: true,
                  semantic: false,
                  sources: true,
                  stories: true,
                },
                nextStep: "embed-news-stories",
                commands: {
                  next: null,
                  schema: "pnpm run db:predeploy",
                  refresh: "pnpm --filter @acme/cron start",
                },
                news: {
                  liveReady: true,
                  semanticReady: false,
                },
                operatorNextStep: {
                  command: null,
                  detail:
                    "The background worker must finish embedding the live edition; inspect failed background jobs if progress stops.",
                  label: "Generate embeddings",
                  step: "embed-news-stories",
                },
                ready: false,
              }),
            ),
        }),
      healthUrl: "https://thenewaitimes.up.railway.app",
    }).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(RemoteNewsHealthNotReadyError);
    expect(error).toMatchObject({
      message: "Remote news health is not ready: nextStep=embed-news-stories",
      result: {
        actionRequired: [
          "The background worker must finish embedding the live edition; inspect failed background jobs if progress stops.",
        ],
        commands: {
          next: null,
          refresh: "pnpm --filter @acme/cron start",
          schema: "pnpm run db:predeploy",
        },
        body: {
          actionRequired: [
            "The background worker must finish embedding the live edition; inspect failed background jobs if progress stops.",
          ],
          news: {
            liveReady: true,
            semanticReady: false,
          },
        },
        liveReady: true,
        nextStep: "embed-news-stories",
        nextCommand: null,
        operatorNextStep: {
          command: null,
          detail:
            "The background worker must finish embedding the live edition; inspect failed background jobs if progress stops.",
          label: "Generate embeddings",
          step: "embed-news-stories",
        },
        ready: false,
        semanticReady: false,
        status: 200,
      },
    });
  });

  it("rejects 200 responses without a ready flag so scaffold pages cannot pass", async () => {
    const error = await checkRemoteNewsHealth({
      fetchHealth: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve("<html>TanStack Start</html>"),
        }),
      healthUrl: "https://thenewaitimes.up.railway.app",
    }).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(RemoteNewsHealthNotReadyError);
    expect(error).toMatchObject({
      message: "Remote news health is not ready: nextStep=unknown",
      result: {
        body: "<html>TanStack Start</html>",
        liveReady: null,
        nextStep: null,
        ready: null,
        semanticReady: null,
        status: 200,
      },
    });
  });

  it("returns a structured diagnosis when the remote health endpoint is missing", async () => {
    const error = await checkRemoteNewsHealth({
      fetchHealth: () =>
        Promise.resolve({
          ok: false,
          status: 404,
          text: () => Promise.resolve("<html>Create Next App</html>"),
        }),
      healthUrl: "https://thenewaitimes.up.railway.app",
    }).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(RemoteNewsHealthNotReadyError);
    expect(error).toMatchObject({
      message:
        "Remote news health is not ready: nextStep=health-endpoint-unavailable",
      result: {
        actionRequired: [
          "Remote health endpoint returned 404. Verify the Railway service is deploying this repo root, branch, and Next.js start command.",
        ],
        body: "<html>Create Next App</html>",
        homepage: null,
        nextStep: "health-endpoint-unavailable",
        operatorNextStep: {
          command: null,
          detail:
            "Verify the Railway service is deploying this repo root, branch, and Next.js start command.",
          label: "Check Railway service routing",
          step: "health-endpoint-unavailable",
        },
        ready: null,
        status: 404,
      },
    });
  });

  it("rejects missing remote health configuration", async () => {
    await expect(
      checkRemoteNewsHealth({
        healthUrl: "",
      }),
    ).rejects.toThrow("NEWS_HEALTH_URL or RAILWAY_PUBLIC_DOMAIN is required");
  });
});

describe("formatRemoteNewsHealthSummary", () => {
  it("prints the next runnable command when health is not ready", () => {
    expect(
      formatRemoteNewsHealthSummary({
        actionRequired: ["Apply the database schema to the target database."],
        body: {},
        commands: {
          next: "pnpm run db:predeploy",
          schema: "pnpm run db:predeploy",
        },
        homepage: null,
        liveReady: false,
        nextCommand: "pnpm run db:predeploy",
        nextStep: "apply-database-schema",
        operatorNextStep: {
          command: "pnpm run db:predeploy",
          detail: "Apply the database schema to the target database.",
          label: "Apply database schema",
          step: "apply-database-schema",
        },
        ready: false,
        semanticReady: false,
        status: 200,
      }),
    ).toBe(
      'Remote news health: status=200 ready=false liveReady=false semanticReady=false nextStep=apply-database-schema nextCommand=pnpm run db:predeploy operatorNextStep="Apply database schema" operatorDetail="Apply the database schema to the target database."',
    );
  });
});
