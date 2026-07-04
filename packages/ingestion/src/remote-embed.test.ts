import { describe, expect, it } from "vitest";

import {
  embedRemoteNewsItems,
  resolveRemoteNewsEmbedCommandInput,
  resolveRemoteNewsEmbedUrl,
} from "./remote-embed";

describe("resolveRemoteNewsEmbedUrl", () => {
  it("turns an app base URL into the embed endpoint", () => {
    expect(
      resolveRemoteNewsEmbedUrl("https://thenewagenttimes.up.railway.app"),
    ).toBe("https://thenewagenttimes.up.railway.app/api/news/embed");
  });

  it("turns an explicit refresh endpoint into the embed endpoint", () => {
    expect(
      resolveRemoteNewsEmbedUrl(
        "https://thenewagenttimes.up.railway.app/api/news/refresh",
      ),
    ).toBe("https://thenewagenttimes.up.railway.app/api/news/embed");
  });

  it("turns an explicit health endpoint into the embed endpoint", () => {
    expect(
      resolveRemoteNewsEmbedUrl(
        "https://thenewagenttimes.up.railway.app/api/news/health",
      ),
    ).toBe("https://thenewagenttimes.up.railway.app/api/news/embed");
  });

  it("uses the Railway public domain when the embed URL is not configured", () => {
    expect(
      resolveRemoteNewsEmbedUrl("", "thenewagenttimes.up.railway.app"),
    ).toBe("https://thenewagenttimes.up.railway.app/api/news/embed");
  });
});

describe("embedRemoteNewsItems", () => {
  it("posts the refresh secret and limit to the remote embed endpoint", async () => {
    const requests: {
      headers: Record<string, string>;
      method: string;
      url: string;
    }[] = [];

    const result = await embedRemoteNewsItems({
      embedSecret: "remote-refresh-secret",
      embedUrl: "https://thenewagenttimes.up.railway.app",
      fetchEmbed: (url, init) => {
        requests.push({
          headers: init.headers,
          method: init.method,
          url,
        });

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                embedded: 12,
                failed: 1,
                limit: 50,
                ok: true,
              }),
            ),
        });
      },
      limit: 50,
    });

    expect(requests).toEqual([
      {
        headers: { authorization: "Bearer remote-refresh-secret" },
        method: "POST",
        url: "https://thenewagenttimes.up.railway.app/api/news/embed?limit=50",
      },
    ]);
    expect(result).toEqual({
      body: {
        embedded: 12,
        failed: 1,
        limit: 50,
        ok: true,
      },
      status: 200,
    });
  });

  it("rejects missing remote embed configuration", async () => {
    await expect(
      embedRemoteNewsItems({
        embedSecret: "remote-refresh-secret",
        embedUrl: "",
      }),
    ).rejects.toThrow(
      "NEWS_EMBED_URL, NEWS_REFRESH_URL, NEWS_HEALTH_URL, or RAILWAY_PUBLIC_DOMAIN is required",
    );

    await expect(
      embedRemoteNewsItems({
        embedSecret: "",
        embedUrl: "https://thenewagenttimes.up.railway.app",
      }),
    ).rejects.toThrow("NEWS_REFRESH_SECRET is required");
  });

  it("includes the status and response body when the endpoint fails", async () => {
    await expect(
      embedRemoteNewsItems({
        embedSecret: "wrong-secret",
        embedUrl: "https://thenewagenttimes.up.railway.app",
        fetchEmbed: () =>
          Promise.resolve({
            ok: false,
            status: 401,
            text: () => Promise.resolve('{"error":"Unauthorized"}'),
          }),
      }),
    ).rejects.toThrow(
      'Remote news embedding failed: status=401 body={"error":"Unauthorized"}',
    );
  });

  it("rejects 200 responses that are not embedding success JSON", async () => {
    await expect(
      embedRemoteNewsItems({
        embedSecret: "remote-refresh-secret",
        embedUrl: "https://thenewagenttimes.up.railway.app",
        fetchEmbed: () =>
          Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve("<html>TanStack Start</html>"),
          }),
      }),
    ).rejects.toThrow(
      "Remote news embedding failed: status=200 body=<html>TanStack Start</html>",
    );
  });
});

describe("resolveRemoteNewsEmbedCommandInput", () => {
  it("treats a single numeric argument as the batch limit, not the URL", () => {
    expect(
      resolveRemoteNewsEmbedCommandInput({
        argv: ["50"],
        env: {
          NEWS_EMBED_URL: "https://thenewagenttimes.up.railway.app",
          NEWS_REFRESH_SECRET: "remote-refresh-secret",
        },
      }),
    ).toEqual({
      embedSecret: "remote-refresh-secret",
      embedUrl: "https://thenewagenttimes.up.railway.app",
      limit: 50,
      railwayPublicDomain: undefined,
    });
  });

  it("falls back to the health URL when no embed or refresh URL is configured", () => {
    expect(
      resolveRemoteNewsEmbedCommandInput({
        argv: ["25"],
        env: {
          NEWS_HEALTH_URL: "https://thenewagenttimes.up.railway.app",
          NEWS_REFRESH_SECRET: "remote-refresh-secret",
        },
      }),
    ).toEqual({
      embedSecret: "remote-refresh-secret",
      embedUrl: "https://thenewagenttimes.up.railway.app",
      limit: 25,
      railwayPublicDomain: undefined,
    });
  });

  it("skips blank environment URLs while resolving fallback embed targets", () => {
    expect(
      resolveRemoteNewsEmbedCommandInput({
        argv: ["25"],
        env: {
          NEWS_EMBED_URL: "",
          NEWS_HEALTH_URL: "https://thenewagenttimes.up.railway.app",
          NEWS_REFRESH_SECRET: "remote-refresh-secret",
          NEWS_REFRESH_URL: " ",
          RAILWAY_PUBLIC_DOMAIN: "thenewagenttimes.up.railway.app",
        },
      }),
    ).toEqual({
      embedSecret: "remote-refresh-secret",
      embedUrl: "https://thenewagenttimes.up.railway.app",
      limit: 25,
      railwayPublicDomain: "thenewagenttimes.up.railway.app",
    });
  });

  it("keeps an explicit URL argument ahead of the optional limit", () => {
    expect(
      resolveRemoteNewsEmbedCommandInput({
        argv: ["https://custom.example", "10"],
        env: {
          NEWS_EMBED_URL: "https://thenewagenttimes.up.railway.app",
          NEWS_REFRESH_SECRET: "remote-refresh-secret",
        },
      }),
    ).toEqual({
      embedSecret: "remote-refresh-secret",
      embedUrl: "https://custom.example",
      limit: 10,
      railwayPublicDomain: undefined,
    });
  });

  it("ignores invalid batch limits from CLI arguments and environment", () => {
    expect(
      resolveRemoteNewsEmbedCommandInput({
        argv: ["https://custom.example", "abc"],
        env: {
          NEWS_EMBED_LIMIT: "NaN",
          NEWS_REFRESH_SECRET: "remote-refresh-secret",
        },
      }),
    ).toEqual({
      embedSecret: "remote-refresh-secret",
      embedUrl: "https://custom.example",
      limit: undefined,
      railwayPublicDomain: undefined,
    });

    expect(
      resolveRemoteNewsEmbedCommandInput({
        argv: ["0"],
        env: {
          NEWS_EMBED_URL: "https://thenewagenttimes.up.railway.app",
          NEWS_REFRESH_SECRET: "remote-refresh-secret",
        },
      }),
    ).toEqual({
      embedSecret: "remote-refresh-secret",
      embedUrl: "https://thenewagenttimes.up.railway.app",
      limit: undefined,
      railwayPublicDomain: undefined,
    });
  });
});
