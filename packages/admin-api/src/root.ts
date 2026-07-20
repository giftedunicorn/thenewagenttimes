import { contentRouter } from "./content";
import { ingestionRouter } from "./ingestion";
import { jobsRouter } from "./jobs";
import { overviewRouter } from "./overview";
import { sourcesRouter } from "./sources";
import { createTRPCRouter } from "./trpc";
import { usersRouter } from "./users";

export const appRouter = createTRPCRouter({
  content: contentRouter,
  ingestion: ingestionRouter,
  jobs: jobsRouter,
  overview: overviewRouter,
  sources: sourcesRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
