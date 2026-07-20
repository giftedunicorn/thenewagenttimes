import type { NextRequest } from "next/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createTRPCContext } from "@acme/admin-api";

import { readAdminSession } from "~/auth/firebase-admin-session";
import { env } from "~/env";

const handler = (request: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req: request,
    createContext: () =>
      createTRPCContext({
        adminEmails: env.ADMIN_EMAILS,
        getSession: readAdminSession,
        headers: request.headers,
      }),
    onError({ error, path }) {
      console.error(`Admin tRPC error on '${path ?? "unknown"}'`, error);
    },
  });

export { handler as GET, handler as POST };
