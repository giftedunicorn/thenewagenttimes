import { describe, expect, it } from "vitest";

import type { AdminIdentity } from "./admin-auth";
import type { createTRPCContext } from "./trpc";
import { parseAdminEmails } from "./admin-auth";
import {
  adminProcedure,
  createTRPCCallerFactory,
  createTRPCRouter,
} from "./trpc";

const adminIdentity: AdminIdentity = {
  email: "admin@example.com",
  image: null,
  name: "Admin",
  uid: "firebase-admin",
};

const testRouter = createTRPCRouter({
  identity: adminProcedure.query(({ ctx }) => ctx.admin),
});
const createCaller = createTRPCCallerFactory(testRouter);

type AdminContext = Awaited<ReturnType<typeof createTRPCContext>>;

const createContext = (
  session: AdminIdentity | null,
  adminEmails: string,
): AdminContext => ({
  adminEmails: parseAdminEmails(adminEmails),
  db: { kind: "test-database" } as unknown as AdminContext["db"],
  session,
});

describe("parseAdminEmails", () => {
  it("normalizes, trims, and deduplicates administrator emails", () => {
    expect(
      parseAdminEmails(
        " Admin@Example.com, ops@example.com,admin@example.com ",
      ),
    ).toEqual(new Set(["admin@example.com", "ops@example.com"]));
  });

  it("rejects an empty administrator allowlist", () => {
    expect(() => parseAdminEmails(" , ")).toThrow(
      "ADMIN_EMAILS must not be empty",
    );
  });
});

describe("adminProcedure", () => {
  it("rejects an anonymous request", async () => {
    const caller = createCaller(createContext(null, "admin@example.com"));

    await expect(caller.identity()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects an authenticated email outside the allowlist", async () => {
    const caller = createCaller(
      createContext(
        { ...adminIdentity, email: "reader@example.com" },
        "admin@example.com",
      ),
    );

    await expect(caller.identity()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("returns the normalized allowed administrator identity", async () => {
    const caller = createCaller(
      createContext(
        { ...adminIdentity, email: " ADMIN@EXAMPLE.COM " },
        "admin@example.com",
      ),
    );

    await expect(caller.identity()).resolves.toEqual(adminIdentity);
  });
});
