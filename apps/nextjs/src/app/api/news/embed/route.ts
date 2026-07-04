import {
  createDbNewsRepository,
  createOpenAIEmbeddingProvider,
  embedPendingNewsItems,
} from "@acme/ingestion";

import { env } from "~/env";
import { handleNewsEmbedRequest } from "./handler";

export const dynamic = "force-dynamic";

export const POST = (request: Request) =>
  handleNewsEmbedRequest({
    apiKey: env.OPENAI_API_KEY,
    embed: ({ limit }) =>
      embedPendingNewsItems({
        limit,
        provider: createOpenAIEmbeddingProvider({
          apiKey: env.OPENAI_API_KEY ?? "",
          model: env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
        }),
        repository: createDbNewsRepository(),
      }),
    expectedSecret: env.NEWS_REFRESH_SECRET,
    request,
  });
