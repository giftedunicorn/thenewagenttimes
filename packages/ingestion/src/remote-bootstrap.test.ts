import { describe, expect, it } from "vitest";

import {
  bootstrapRemoteNewsEdition,
  RemoteNewsBootstrapNotReadyError,
  resolveRemoteNewsBootstrapCommandInput,
} from "./remote-bootstrap";

const remoteNewsHomepage = {
  mode: "live",
  path: "/",
  previewStories: 12,
  servingNewsExperience: true,
  title: "The New AI Times",
} as const;

const readyRemoteNewsHealthBody = () => ({
  homepage: remoteNewsHomepage,
  news: {
    liveReady: true,
    semanticReady: true,
  },
  nextStep: "ready",
  ready: true,
});

describe("bootstrapRemoteNewsEdition", () => {
  it("refreshes stories, embeds pending items, and checks health in order", async () => {
    const calls: string[] = [];

    const result = await bootstrapRemoteNewsEdition({
      bootstrapSecret: "remote-refresh-secret",
      bootstrapUrl: "https://thenewagenttimes.up.railway.app",
      embedLimit: 25,
      fetchEmbed: (url, init) => {
        calls.push(`${init.method} ${url}`);

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                embedded: 11,
                failed: 0,
                ok: true,
              }),
            ),
        });
      },
      fetchHealth: (url, init) => {
        calls.push(`${init.method} ${url}`);

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                checks: {
                  auth: true,
                  embeddingProvider: true,
                  refreshSecret: true,
                  schema: true,
                  semantic: true,
                  sources: true,
                  stories: true,
                },
                ...readyRemoteNewsHealthBody(),
              }),
            ),
        });
      },
      fetchRefresh: (url, init) => {
        calls.push(`${init.method} ${url}`);

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                itemsCreated: 18,
                ok: true,
                sourcesSucceeded: 9,
              }),
            ),
        });
      },
    });

    expect(calls).toEqual([
      "GET https://thenewagenttimes.up.railway.app/api/news/health",
      "POST https://thenewagenttimes.up.railway.app/api/news/refresh",
      "POST https://thenewagenttimes.up.railway.app/api/news/embed?limit=25",
      "GET https://thenewagenttimes.up.railway.app/api/news/health",
    ]);
    expect(result).toEqual({
      embed: {
        body: {
          embedded: 11,
          failed: 0,
          ok: true,
        },
        status: 200,
      },
      embedBatches: [
        {
          body: {
            embedded: 11,
            failed: 0,
            ok: true,
          },
          status: 200,
        },
      ],
      health: {
        actionRequired: [],
        body: {
          checks: {
            auth: true,
            embeddingProvider: true,
            refreshSecret: true,
            schema: true,
            semantic: true,
            sources: true,
            stories: true,
          },
          homepage: remoteNewsHomepage,
          nextStep: "ready",
          news: {
            liveReady: true,
            semanticReady: true,
          },
          ready: true,
        },
        commands: {},
        homepage: remoteNewsHomepage,
        liveReady: true,
        nextCommand: null,
        nextStep: "ready",
        ready: true,
        semanticReady: true,
        status: 200,
      },
      refresh: {
        body: {
          itemsCreated: 18,
          ok: true,
          sourcesSucceeded: 9,
        },
        status: 200,
      },
    });
  });

  it("normalizes an explicit embed endpoint across the full bootstrap sequence", async () => {
    const calls: string[] = [];

    await bootstrapRemoteNewsEdition({
      bootstrapSecret: "remote-refresh-secret",
      bootstrapUrl: "https://thenewagenttimes.up.railway.app/api/news/embed",
      embedLimit: 25,
      fetchEmbed: (url, init) => {
        calls.push(`${init.method} ${url}`);

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('{"embedded":4,"failed":0,"ok":true}'),
        });
      },
      fetchHealth: (url, init) => {
        calls.push(`${init.method} ${url}`);

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(JSON.stringify(readyRemoteNewsHealthBody())),
        });
      },
      fetchRefresh: (url, init) => {
        calls.push(`${init.method} ${url}`);

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('{"itemsCreated":2,"ok":true}'),
        });
      },
    });

    expect(calls).toEqual([
      "GET https://thenewagenttimes.up.railway.app/api/news/health",
      "POST https://thenewagenttimes.up.railway.app/api/news/refresh",
      "POST https://thenewagenttimes.up.railway.app/api/news/embed?limit=25",
      "GET https://thenewagenttimes.up.railway.app/api/news/health",
    ]);
  });

  it("exposes partial bootstrap results when final health is not ready", async () => {
    const error = await bootstrapRemoteNewsEdition({
      bootstrapSecret: "remote-refresh-secret",
      bootstrapUrl: "https://thenewagenttimes.up.railway.app",
      fetchEmbed: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('{"embedded":0,"failed":0,"ok":true}'),
        }),
      fetchHealth: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                actionRequired: [
                  "Run pnpm run news:embed:remote so semantic recommendations can use the live edition.",
                ],
                nextStep: "embed-news-stories",
                ready: false,
              }),
            ),
        }),
      fetchRefresh: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('{"itemsCreated":0,"ok":true}'),
        }),
    }).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(RemoteNewsBootstrapNotReadyError);
    expect(error).toMatchObject({
      message:
        "Remote news bootstrap finished but health is not ready: nextStep=embed-news-stories actionRequired=Run pnpm run news:embed:remote so semantic recommendations can use the live edition.",
      result: {
        embed: {
          body: { embedded: 0, failed: 0, ok: true },
          status: 200,
        },
        health: {
          actionRequired: [
            "Run pnpm run news:embed:remote so semantic recommendations can use the live edition.",
          ],
          body: {
            actionRequired: [
              "Run pnpm run news:embed:remote so semantic recommendations can use the live edition.",
            ],
            nextStep: "embed-news-stories",
            ready: false,
          },
          nextStep: "embed-news-stories",
          ready: false,
          status: 200,
        },
        refresh: {
          body: { itemsCreated: 0, ok: true },
          status: 200,
        },
      },
    });
  });

  it("runs bounded extra embedding batches while semantic health is still pending", async () => {
    const calls: string[] = [];
    let healthCallCount = 0;

    const result = await bootstrapRemoteNewsEdition({
      bootstrapSecret: "remote-refresh-secret",
      bootstrapUrl: "https://thenewagenttimes.up.railway.app",
      embedLimit: 20,
      embedMaxBatches: 2,
      fetchEmbed: (url, init) => {
        calls.push(`${init.method} ${url}`);

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                embedded: calls.filter((call) =>
                  call.includes("/api/news/embed"),
                ).length,
                failed: 0,
                ok: true,
              }),
            ),
        });
      },
      fetchHealth: (url, init) => {
        healthCallCount += 1;
        calls.push(`${init.method} ${url}`);

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify(
                healthCallCount < 3
                  ? {
                      nextStep: "embed-news-stories",
                      ready: false,
                    }
                  : {
                      ...readyRemoteNewsHealthBody(),
                    },
              ),
            ),
        });
      },
      fetchRefresh: (url, init) => {
        calls.push(`${init.method} ${url}`);

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('{"itemsCreated":8,"ok":true}'),
        });
      },
    });

    expect(calls).toEqual([
      "GET https://thenewagenttimes.up.railway.app/api/news/health",
      "POST https://thenewagenttimes.up.railway.app/api/news/refresh",
      "POST https://thenewagenttimes.up.railway.app/api/news/embed?limit=20",
      "GET https://thenewagenttimes.up.railway.app/api/news/health",
      "POST https://thenewagenttimes.up.railway.app/api/news/embed?limit=20",
      "GET https://thenewagenttimes.up.railway.app/api/news/health",
    ]);
    expect(result.embedBatches).toHaveLength(2);
    expect(result.embed?.body).toEqual({
      embedded: 2,
      failed: 0,
      ok: true,
    });
    expect(result.health.ready).toBe(true);
  });

  it("stops before refresh when remote health reports a missing prerequisite", async () => {
    const calls: string[] = [];
    const error = await bootstrapRemoteNewsEdition({
      bootstrapSecret: "remote-refresh-secret",
      bootstrapUrl: "https://thenewagenttimes.up.railway.app",
      fetchEmbed: (url, init) => {
        calls.push(`${init.method} ${url}`);

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve("{}"),
        });
      },
      fetchHealth: (url, init) => {
        calls.push(`${init.method} ${url}`);

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                actionRequired: [
                  "Set NEWS_REFRESH_SECRET in the Railway service environment.",
                ],
                nextStep: "configure-refresh-secret",
                ready: false,
              }),
            ),
        });
      },
      fetchRefresh: (url, init) => {
        calls.push(`${init.method} ${url}`);

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve("{}"),
        });
      },
    }).catch((caughtError: unknown) => caughtError);

    expect(calls).toEqual([
      "GET https://thenewagenttimes.up.railway.app/api/news/health",
    ]);
    expect(error).toBeInstanceOf(RemoteNewsBootstrapNotReadyError);
    expect(error).toMatchObject({
      message:
        "Remote news bootstrap blocked before refresh: nextStep=configure-refresh-secret actionRequired=Set NEWS_REFRESH_SECRET in the Railway service environment.",
      result: {
        embed: null,
        health: {
          actionRequired: [
            "Set NEWS_REFRESH_SECRET in the Railway service environment.",
          ],
          body: {
            actionRequired: [
              "Set NEWS_REFRESH_SECRET in the Railway service environment.",
            ],
            nextStep: "configure-refresh-secret",
            ready: false,
          },
          nextStep: "configure-refresh-secret",
          ready: false,
          status: 200,
        },
        refresh: null,
      },
    });
  });

  it("refreshes live stories before stopping at missing embedding provider config", async () => {
    const calls: string[] = [];
    const error = await bootstrapRemoteNewsEdition({
      bootstrapSecret: "remote-refresh-secret",
      bootstrapUrl: "https://thenewagenttimes.up.railway.app",
      fetchEmbed: (url, init) => {
        calls.push(`${init.method} ${url}`);

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve("{}"),
        });
      },
      fetchHealth: (url, init) => {
        calls.push(`${init.method} ${url}`);

        return Promise.resolve({
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
                ready: false,
              }),
            ),
        });
      },
      fetchRefresh: (url, init) => {
        calls.push(`${init.method} ${url}`);

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              '{"itemsCreated":12,"ok":true,"sourcesSucceeded":9}',
            ),
        });
      },
    }).catch((caughtError: unknown) => caughtError);

    expect(calls).toEqual([
      "GET https://thenewagenttimes.up.railway.app/api/news/health",
      "POST https://thenewagenttimes.up.railway.app/api/news/refresh",
      "GET https://thenewagenttimes.up.railway.app/api/news/health",
    ]);
    expect(error).toBeInstanceOf(RemoteNewsBootstrapNotReadyError);
    expect(error).toMatchObject({
      message:
        "Remote news bootstrap finished but health is not ready: nextStep=configure-embedding-provider actionRequired=Set OPENAI_API_KEY in the Railway service environment before running semantic embeddings.",
      result: {
        embed: null,
        embedBatches: [],
        refresh: {
          body: {
            itemsCreated: 12,
            ok: true,
            sourcesSucceeded: 9,
          },
          status: 200,
        },
      },
    });
  });

  it("stops before refresh when the initial health response is not health JSON", async () => {
    const calls: string[] = [];
    const error = await bootstrapRemoteNewsEdition({
      bootstrapSecret: "remote-refresh-secret",
      bootstrapUrl: "https://thenewagenttimes.up.railway.app",
      fetchEmbed: (url, init) => {
        calls.push(`${init.method} ${url}`);

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('{"ok":true}'),
        });
      },
      fetchHealth: (url, init) => {
        calls.push(`${init.method} ${url}`);

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve("<html>TanStack Start</html>"),
        });
      },
      fetchRefresh: (url, init) => {
        calls.push(`${init.method} ${url}`);

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('{"ok":true}'),
        });
      },
    }).catch((caughtError: unknown) => caughtError);

    expect(calls).toEqual([
      "GET https://thenewagenttimes.up.railway.app/api/news/health",
    ]);
    expect(error).toBeInstanceOf(RemoteNewsBootstrapNotReadyError);
    expect(error).toMatchObject({
      message: "Remote news bootstrap blocked before refresh: nextStep=unknown",
      result: {
        embed: null,
        health: {
          actionRequired: [],
          body: "<html>TanStack Start</html>",
          nextStep: null,
          ready: null,
          status: 200,
        },
        refresh: null,
      },
    });
  });
});

describe("resolveRemoteNewsBootstrapCommandInput", () => {
  it("uses a numeric first argument as the embed limit", () => {
    expect(
      resolveRemoteNewsBootstrapCommandInput({
        argv: ["30"],
        env: {
          NEWS_HEALTH_URL: "https://thenewagenttimes.up.railway.app",
          NEWS_REFRESH_SECRET: "remote-refresh-secret",
        },
      }),
    ).toEqual({
      bootstrapSecret: "remote-refresh-secret",
      bootstrapUrl: "https://thenewagenttimes.up.railway.app",
      embedLimit: 30,
      embedMaxBatches: undefined,
      railwayPublicDomain: undefined,
    });
  });

  it("uses a second numeric argument as the maximum embedding batches", () => {
    expect(
      resolveRemoteNewsBootstrapCommandInput({
        argv: ["30", "4"],
        env: {
          NEWS_HEALTH_URL: "https://thenewagenttimes.up.railway.app",
          NEWS_REFRESH_SECRET: "remote-refresh-secret",
        },
      }),
    ).toEqual({
      bootstrapSecret: "remote-refresh-secret",
      bootstrapUrl: "https://thenewagenttimes.up.railway.app",
      embedLimit: 30,
      embedMaxBatches: 4,
      railwayPublicDomain: undefined,
    });
  });

  it("keeps an explicit URL argument ahead of the optional limit", () => {
    expect(
      resolveRemoteNewsBootstrapCommandInput({
        argv: ["https://custom.example", "10"],
        env: {
          NEWS_REFRESH_SECRET: "remote-refresh-secret",
        },
      }),
    ).toEqual({
      bootstrapSecret: "remote-refresh-secret",
      bootstrapUrl: "https://custom.example",
      embedLimit: 10,
      embedMaxBatches: undefined,
      railwayPublicDomain: undefined,
    });
  });

  it("ignores invalid numeric environment and argument values", () => {
    expect(
      resolveRemoteNewsBootstrapCommandInput({
        argv: ["https://custom.example", "not-a-limit", "not-a-batch-count"],
        env: {
          NEWS_BOOTSTRAP_EMBED_BATCHES: "also-invalid",
          NEWS_EMBED_LIMIT: "invalid-limit",
          NEWS_REFRESH_SECRET: "remote-refresh-secret",
        },
      }),
    ).toEqual({
      bootstrapSecret: "remote-refresh-secret",
      bootstrapUrl: "https://custom.example",
      embedLimit: undefined,
      embedMaxBatches: undefined,
      railwayPublicDomain: undefined,
    });
  });

  it("skips blank environment URLs while resolving fallback bootstrap targets", () => {
    expect(
      resolveRemoteNewsBootstrapCommandInput({
        argv: ["25"],
        env: {
          NEWS_BOOTSTRAP_EMBED_BATCHES: "3",
          NEWS_BOOTSTRAP_URL: "",
          NEWS_EMBED_URL: " ",
          NEWS_HEALTH_URL: "https://thenewagenttimes.up.railway.app",
          NEWS_REFRESH_SECRET: "remote-refresh-secret",
          NEWS_REFRESH_URL: "",
          RAILWAY_PUBLIC_DOMAIN: "thenewagenttimes.up.railway.app",
        },
      }),
    ).toEqual({
      bootstrapSecret: "remote-refresh-secret",
      bootstrapUrl: "https://thenewagenttimes.up.railway.app",
      embedLimit: 25,
      embedMaxBatches: 3,
      railwayPublicDomain: "thenewagenttimes.up.railway.app",
    });
  });
});
