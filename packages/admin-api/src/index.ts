import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "./root";

export type { AdminIdentity, AdminSessionReader } from "./admin-auth";
export { parseAdminEmails } from "./admin-auth";
export { type AppRouter, appRouter } from "./root";
export { createTRPCContext } from "./trpc";

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
