import { describe, expect, it } from "vitest";

import {
  refreshRemoteNewsEdition,
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
    ).rejects.toThrow("NEWS_REFRESH_URL or RAILWAY_PUBLIC_DOMAIN is required");

    await expect(
      refreshRemoteNewsEdition({
        refreshSecret: "remote-refresh-secret",
        refreshUrl: "",
        railwayPublicDomain: "",
      }),
    ).rejects.toThrow("NEWS_REFRESH_URL or RAILWAY_PUBLIC_DOMAIN is required");

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
});
