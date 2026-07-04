import { describe, expect, it } from "vitest";

import {
  refreshRemoteNewsEdition,
  resolveRemoteNewsRefreshCommandInput,
  resolveRemoteNewsRefreshUrl,
} from "./remote-refresh";

describe("resolveRemoteNewsRefreshUrl", () => {
  it("keeps an explicit refresh endpoint", () => {
    expect(
      resolveRemoteNewsRefreshUrl(
        "https://thenewagenttimes.up.railway.app/api/news/refresh",
      ),
    ).toBe("https://thenewagenttimes.up.railway.app/api/news/refresh");
  });

  it("turns an explicit health endpoint into the refresh endpoint", () => {
    expect(
      resolveRemoteNewsRefreshUrl(
        "https://thenewagenttimes.up.railway.app/api/news/health",
      ),
    ).toBe("https://thenewagenttimes.up.railway.app/api/news/refresh");
  });

  it("turns an explicit embed endpoint into the refresh endpoint", () => {
    expect(
      resolveRemoteNewsRefreshUrl(
        "https://thenewagenttimes.up.railway.app/api/news/embed",
      ),
    ).toBe("https://thenewagenttimes.up.railway.app/api/news/refresh");
  });

  it("turns an app base URL into the refresh endpoint", () => {
    expect(
      resolveRemoteNewsRefreshUrl("https://thenewagenttimes.up.railway.app"),
    ).toBe("https://thenewagenttimes.up.railway.app/api/news/refresh");
  });

  it("uses the Railway public domain when the refresh URL is not configured", () => {
    expect(
      resolveRemoteNewsRefreshUrl("", "thenewagenttimes.up.railway.app"),
    ).toBe("https://thenewagenttimes.up.railway.app/api/news/refresh");
  });
});

describe("resolveRemoteNewsRefreshCommandInput", () => {
  it("keeps an explicit URL argument ahead of environment URLs", () => {
    expect(
      resolveRemoteNewsRefreshCommandInput({
        argv: ["https://custom.example/api/news/health"],
        env: {
          NEWS_REFRESH_SECRET: "remote-refresh-secret",
          NEWS_REFRESH_URL: "https://thenewagenttimes.up.railway.app",
        },
      }),
    ).toEqual({
      railwayPublicDomain: undefined,
      refreshSecret: "remote-refresh-secret",
      refreshUrl: "https://custom.example/api/news/health",
    });
  });

  it("falls back to health or embed URLs when the refresh URL is not configured", () => {
    expect(
      resolveRemoteNewsRefreshCommandInput({
        argv: [],
        env: {
          NEWS_HEALTH_URL:
            "https://thenewagenttimes.up.railway.app/api/news/health",
          NEWS_REFRESH_SECRET: "remote-refresh-secret",
        },
      }),
    ).toEqual({
      railwayPublicDomain: undefined,
      refreshSecret: "remote-refresh-secret",
      refreshUrl: "https://thenewagenttimes.up.railway.app/api/news/health",
    });

    expect(
      resolveRemoteNewsRefreshCommandInput({
        argv: [],
        env: {
          NEWS_EMBED_URL:
            "https://thenewagenttimes.up.railway.app/api/news/embed",
          NEWS_REFRESH_SECRET: "remote-refresh-secret",
          RAILWAY_PUBLIC_DOMAIN: "thenewagenttimes.up.railway.app",
        },
      }),
    ).toEqual({
      railwayPublicDomain: "thenewagenttimes.up.railway.app",
      refreshSecret: "remote-refresh-secret",
      refreshUrl: "https://thenewagenttimes.up.railway.app/api/news/embed",
    });
  });

  it("skips blank environment URLs while resolving fallback refresh targets", () => {
    expect(
      resolveRemoteNewsRefreshCommandInput({
        argv: [],
        env: {
          NEWS_EMBED_URL:
            "https://thenewagenttimes.up.railway.app/api/news/embed",
          NEWS_HEALTH_URL: " ",
          NEWS_REFRESH_SECRET: "remote-refresh-secret",
          NEWS_REFRESH_URL: "",
          RAILWAY_PUBLIC_DOMAIN: "thenewagenttimes.up.railway.app",
        },
      }),
    ).toEqual({
      railwayPublicDomain: "thenewagenttimes.up.railway.app",
      refreshSecret: "remote-refresh-secret",
      refreshUrl: "https://thenewagenttimes.up.railway.app/api/news/embed",
    });
  });
});

describe("refreshRemoteNewsEdition", () => {
  it("posts the refresh secret as a bearer token", async () => {
    const requests: {
      headers: Record<string, string>;
      method: string;
      url: string;
    }[] = [];

    const result = await refreshRemoteNewsEdition({
      fetchRefresh: (url, init) => {
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
                itemsCreated: 4,
                ok: true,
                sourcesSucceeded: 9,
              }),
            ),
        });
      },
      refreshSecret: "remote-refresh-secret",
      refreshUrl: "https://thenewagenttimes.up.railway.app",
    });

    expect(requests).toEqual([
      {
        headers: { authorization: "Bearer remote-refresh-secret" },
        method: "POST",
        url: "https://thenewagenttimes.up.railway.app/api/news/refresh",
      },
    ]);
    expect(result).toEqual({
      body: {
        itemsCreated: 4,
        ok: true,
        sourcesSucceeded: 9,
      },
      status: 200,
    });
  });

  it("rejects missing remote refresh configuration", async () => {
    await expect(
      refreshRemoteNewsEdition({
        refreshSecret: "remote-refresh-secret",
        refreshUrl: "",
      }),
    ).rejects.toThrow(
      "NEWS_REFRESH_URL, NEWS_HEALTH_URL, NEWS_EMBED_URL, or RAILWAY_PUBLIC_DOMAIN is required",
    );

    await expect(
      refreshRemoteNewsEdition({
        refreshSecret: "remote-refresh-secret",
        refreshUrl: "",
        railwayPublicDomain: "",
      }),
    ).rejects.toThrow(
      "NEWS_REFRESH_URL, NEWS_HEALTH_URL, NEWS_EMBED_URL, or RAILWAY_PUBLIC_DOMAIN is required",
    );

    await expect(
      refreshRemoteNewsEdition({
        refreshSecret: "",
        refreshUrl: "https://thenewagenttimes.up.railway.app",
      }),
    ).rejects.toThrow("NEWS_REFRESH_SECRET is required");
  });

  it("includes the status and response body when the endpoint fails", async () => {
    await expect(
      refreshRemoteNewsEdition({
        fetchRefresh: () =>
          Promise.resolve({
            ok: false,
            status: 401,
            text: () => Promise.resolve('{"error":"Unauthorized"}'),
          }),
        refreshSecret: "wrong-secret",
        refreshUrl: "https://thenewagenttimes.up.railway.app",
      }),
    ).rejects.toThrow(
      'Remote news refresh failed: status=401 body={"error":"Unauthorized"}',
    );
  });

  it("rejects 200 responses that are not refresh success JSON", async () => {
    await expect(
      refreshRemoteNewsEdition({
        fetchRefresh: () =>
          Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve("<html>TanStack Start</html>"),
          }),
        refreshSecret: "remote-refresh-secret",
        refreshUrl: "https://thenewagenttimes.up.railway.app",
      }),
    ).rejects.toThrow(
      "Remote news refresh failed: status=200 body=<html>TanStack Start</html>",
    );
  });
});
