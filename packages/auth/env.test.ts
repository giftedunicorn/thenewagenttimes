import { afterEach, describe, expect, it, vi } from "vitest";

import { authEnv } from "./env";

describe("authEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not require optional auth providers for production startup", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_DISCORD_ID", undefined);
    vi.stubEnv("AUTH_DISCORD_SECRET", undefined);
    vi.stubEnv("AUTH_SECRET", undefined);
    vi.stubEnv("BETTER_AUTH_SECRET", undefined);

    expect(() => authEnv()).not.toThrow();
  });

  it("accepts the Better Auth secret env name", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_SECRET", "secret");

    expect(authEnv().BETTER_AUTH_SECRET).toBe("secret");
  });
});
