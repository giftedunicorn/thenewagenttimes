import { createDbNewsRepository, refreshNewsSources } from "@acme/ingestion";

import { env } from "~/env";
import { handleNewsRefreshRequest } from "./handler";

export const dynamic = "force-dynamic";

export const POST = (request: Request) =>
  handleNewsRefreshRequest({
    expectedSecret: env.NEWS_REFRESH_SECRET,
    refresh: () =>
      refreshNewsSources({
        repository: createDbNewsRepository(),
      }),
    request,
  });
