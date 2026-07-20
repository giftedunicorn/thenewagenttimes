import { newsRouter } from "./router/news";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  news: newsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
