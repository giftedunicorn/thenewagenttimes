import { authRouter } from "./router/auth";
import { newsRouter } from "./router/news";
import { postRouter } from "./router/post";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  news: newsRouter,
  post: postRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
