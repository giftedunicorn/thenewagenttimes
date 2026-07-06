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
        "https://thenewagenttimes.up.railway.app/api/news/health",
      ),
    ).toBe("https://thenewagenttimes.up.railway.app/api/news/health");
  });

  it("turns an app base URL into the health endpoint", () => {
    expect(
      resolveRemoteNewsHealthUrl("https://thenewagenttimes.up.railway.app"),
    ).toBe("https://thenewagenttimes.up.railway.app/api/news/health");
  });

  it("turns an explicit refresh endpoint into the health endpoint", () => {
    expect(
      resolveRemoteNewsHealthUrl(
        "https://thenewagenttimes.up.railway.app/api/news/refresh",
      ),
    ).toBe("https://thenewagenttimes.up.railway.app/api/news/health");
  });

  it("turns an explicit embed endpoint into the health endpoint", () => {
    expect(
      resolveRemoteNewsHealthUrl(
        "https://thenewagenttimes.up.railway.app/api/news/embed",
      ),
    ).toBe("https://thenewagenttimes.up.railway.app/api/news/health");
  });

  it("uses the Railway public domain when the health URL is not configured", () => {
    expect(
      resolveRemoteNewsHealthUrl("", "thenewagenttimes.up.railway.app"),
    ).toBe("https://thenewagenttimes.up.railway.app/api/news/health");
  });
});

describe("resolveRemoteNewsHealthCommandInput", () => {
  it("keeps an explicit URL argument ahead of environment URLs", () => {
    expect(
      resolveRemoteNewsHealthCommandInput({
        argv: ["https://custom.example/api/news/refresh"],
        env: {
          NEWS_HEALTH_URL: "https://thenewagenttimes.up.railway.app",
          RAILWAY_PUBLIC_DOMAIN: "thenewagenttimes.up.railway.app",
        },
      }),
    ).toEqual({
      healthUrl: "https://custom.example/api/news/refresh",
      railwayPublicDomain: "thenewagenttimes.up.railway.app",
    });
  });

  it("falls back to refresh, embed, bootstrap, or Railway public URLs", () => {
    expect(
      resolveRemoteNewsHealthCommandInput({
        argv: [],
        env: {
          NEWS_REFRESH_URL:
            "https://thenewagenttimes.up.railway.app/api/news/refresh",
        },
      }),
    ).toEqual({
      healthUrl: "https://thenewagenttimes.up.railway.app/api/news/refresh",
      railwayPublicDomain: undefined,
    });

    expect(
      resolveRemoteNewsHealthCommandInput({
        argv: [],
        env: {
          NEWS_EMBED_URL:
            "https://thenewagenttimes.up.railway.app/api/news/embed",
        },
      }),
    ).toEqual({
      healthUrl: "https://thenewagenttimes.up.railway.app/api/news/embed",
      railwayPublicDomain: undefined,
    });

    expect(
      resolveRemoteNewsHealthCommandInput({
        argv: [],
        env: {
          NEWS_BOOTSTRAP_URL: "https://thenewagenttimes.up.railway.app",
          RAILWAY_PUBLIC_DOMAIN: "fallback.up.railway.app",
        },
      }),
    ).toEqual({
      healthUrl: "https://thenewagenttimes.up.railway.app",
      railwayPublicDomain: "fallback.up.railway.app",
    });
  });

  it("skips blank environment URLs while resolving fallback health targets", () => {
    expect(
      resolveRemoteNewsHealthCommandInput({
        argv: [],
        env: {
          NEWS_BOOTSTRAP_URL: "",
          NEWS_EMBED_URL: "",
          NEWS_HEALTH_URL: "   ",
          NEWS_REFRESH_URL:
            "https://thenewagenttimes.up.railway.app/api/news/refresh",
          RAILWAY_PUBLIC_DOMAIN: "thenewagenttimes.up.railway.app",
        },
      }),
    ).toEqual({
      healthUrl: "https://thenewagenttimes.up.railway.app/api/news/refresh",
      railwayPublicDomain: "thenewagenttimes.up.railway.app",
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
      healthUrl: "https://thenewagenttimes.up.railway.app",
    });

    expect(requests).toEqual([
      {
        method: "GET",
        url: "https://thenewagenttimes.up.railway.app/api/news/health",
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
      healthUrl: "https://thenewagenttimes.up.railway.app",
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
      healthUrl: "https://thenewagenttimes.up.railway.app",
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
                  "Set OPENAI_API_KEY in the Railway service environment before running semantic embeddings.",
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
                nextStep: "configure-embedding-provider",
                commands: {
                  next: null,
                  schema: "pnpm run db:push",
                  refresh: "pnpm run news:refresh:remote",
                },
                news: {
                  liveReady: true,
                  semanticReady: false,
                },
                ready: false,
              }),
            ),
        }),
      healthUrl: "https://thenewagenttimes.up.railway.app",
    }).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(RemoteNewsHealthNotReadyError);
    expect(error).toMatchObject({
      message:
        "Remote news health is not ready: nextStep=configure-embedding-provider",
      result: {
        actionRequired: [
          "Set OPENAI_API_KEY in the Railway service environment before running semantic embeddings.",
        ],
        commands: {
          next: null,
          refresh: "pnpm run news:refresh:remote",
          schema: "pnpm run db:push",
        },
        body: {
          actionRequired: [
            "Set OPENAI_API_KEY in the Railway service environment before running semantic embeddings.",
          ],
          news: {
            liveReady: true,
            semanticReady: false,
          },
        },
        liveReady: true,
        nextStep: "configure-embedding-provider",
        nextCommand: null,
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
      healthUrl: "https://thenewagenttimes.up.railway.app",
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

  it("rejects missing remote health configuration", async () => {
    await expect(
      checkRemoteNewsHealth({
        healthUrl: "",
      }),
    ).rejects.toThrow(
      "NEWS_HEALTH_URL, NEWS_REFRESH_URL, NEWS_EMBED_URL, NEWS_BOOTSTRAP_URL, or RAILWAY_PUBLIC_DOMAIN is required",
    );
  });
});

describe("formatRemoteNewsHealthSummary", () => {
  it("prints the next runnable command when health is not ready", () => {
    expect(
      formatRemoteNewsHealthSummary({
        actionRequired: ["Apply the database schema to the target database."],
        body: {},
        commands: {
          next: "pnpm run db:push",
          schema: "pnpm run db:push",
        },
        homepage: null,
        liveReady: false,
        nextCommand: "pnpm run db:push",
        nextStep: "apply-database-schema",
        ready: false,
        semanticReady: false,
        status: 200,
      }),
    ).toBe(
      "Remote news health: status=200 ready=false liveReady=false semanticReady=false nextStep=apply-database-schema nextCommand=pnpm run db:push",
    );
  });
});
