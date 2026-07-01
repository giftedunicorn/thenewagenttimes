import { describe, expect, it } from "vitest";

import { createAuthSocialProviders } from "./providers";

describe("createAuthSocialProviders", () => {
  it("omits Discord when either credential is missing", () => {
    expect(
      createAuthSocialProviders({
        productionUrl: "https://news.example.com",
        discordClientId: undefined,
        discordClientSecret: "secret",
      }),
    ).toBeUndefined();

    expect(
      createAuthSocialProviders({
        productionUrl: "https://news.example.com",
        discordClientId: "client-id",
        discordClientSecret: undefined,
      }),
    ).toBeUndefined();
  });

  it("creates Discord provider config when credentials are present", () => {
    expect(
      createAuthSocialProviders({
        productionUrl: "https://news.example.com",
        discordClientId: "client-id",
        discordClientSecret: "secret",
      }),
    ).toEqual({
      discord: {
        clientId: "client-id",
        clientSecret: "secret",
        redirectURI: "https://news.example.com/api/auth/callback/discord",
      },
    });
  });
});
