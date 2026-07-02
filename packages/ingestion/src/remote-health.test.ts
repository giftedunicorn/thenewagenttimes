import { describe, expect, it } from "vitest";

import {
  checkRemoteNewsHealth,
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

  it("uses the Railway public domain when the health URL is not configured", () => {
    expect(
      resolveRemoteNewsHealthUrl("", "thenewagenttimes.up.railway.app"),
    ).toBe("https://thenewagenttimes.up.railway.app/api/news/health");
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
      body: {
        checks: {
          auth: true,
          refreshSecret: true,
          schema: true,
          sources: true,
          stories: true,
        },
        nextStep: "ready",
        ready: true,
      },
      nextStep: "ready",
      ready: true,
      status: 200,
    });
  });

  it("rejects missing remote health configuration", async () => {
    await expect(
      checkRemoteNewsHealth({
        healthUrl: "",
      }),
    ).rejects.toThrow(
      "NEWS_HEALTH_URL, NEWS_REFRESH_URL, or RAILWAY_PUBLIC_DOMAIN is required",
    );
  });
});
