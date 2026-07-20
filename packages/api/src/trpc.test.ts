import { describe, expect, it, vi } from "vitest";

import type { AppSession, SessionReader } from "@acme/auth";

import { createTRPCContext } from "./trpc";

vi.mock("@acme/db/client", () => ({
  db: { kind: "test-db" },
}));

describe("createTRPCContext", () => {
  it("resolves the application session from the injected request reader", async () => {
    const headers = new Headers({
      authorization: "Bearer firebase-token",
    });
    const session: AppSession = {
      expiresAt: new Date("2026-07-20T12:00:00.000Z"),
      user: {
        email: "reader@example.com",
        emailVerified: true,
        id: "application-user",
        image: null,
        name: "AI Reader",
      },
    };
    const getSession: SessionReader = vi.fn(() => Promise.resolve(session));
    const invokeContext = createTRPCContext as unknown as (options: {
      getSession: SessionReader;
      headers: Headers;
    }) => ReturnType<typeof createTRPCContext>;

    const context = await invokeContext({ getSession, headers });

    expect(getSession).toHaveBeenCalledWith(headers);
    expect(context.session).toEqual(session);
    expect(context.db).toEqual({ kind: "test-db" });
  });
});
