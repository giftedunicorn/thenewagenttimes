import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z, ZodError } from "zod/v4";

import type { db as dbClient } from "@acme/db/client";

import type { AdminSessionReader } from "./admin-auth";
import { parseAdminEmails } from "./admin-auth";

type DbClient = typeof dbClient;

let cachedDbClient: DbClient | null = null;

const getDbClient = async () => {
  cachedDbClient ??= (await import("@acme/db/client")).db;
  return cachedDbClient;
};

export const createTRPCContext = async (options: {
  adminEmails: string;
  getSession: AdminSessionReader;
  headers: Headers;
}) => ({
  adminEmails: parseAdminEmails(options.adminEmails),
  db: await getDbClient(),
  session: await options.getSession(options.headers),
});

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => {
    const isProduction = process.env.NODE_ENV === "production";
    const isInternalError = shape.data.code === "INTERNAL_SERVER_ERROR";

    return {
      ...shape,
      message:
        isProduction && isInternalError
          ? "An internal error occurred. Please try again."
          : shape.message,
      data: {
        ...shape.data,
        stack: isProduction ? undefined : shape.data.stack,
        zodError:
          error.cause instanceof ZodError
            ? z.flattenError(error.cause as ZodError<Record<string, unknown>>)
            : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const createTRPCCallerFactory = t.createCallerFactory;

export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const email = ctx.session.email.trim().toLowerCase();

  if (!ctx.adminEmails.has(email)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return next({
    ctx: {
      ...ctx,
      admin: {
        ...ctx.session,
        email,
      },
    },
  });
});
