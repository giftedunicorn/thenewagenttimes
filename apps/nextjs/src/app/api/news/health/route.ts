import { env } from "~/env";
import { getNewsDeskStatus, getNewsSchemaReadiness } from "../../../_data/news";
import { handleNewsHealthRequest } from "./handler";

export const dynamic = "force-dynamic";

export const GET = () =>
  handleNewsHealthRequest({
    authSecret: env.BETTER_AUTH_SECRET ?? env.AUTH_SECRET,
    embeddingApiKey: env.OPENAI_API_KEY,
    getDeskStatus: getNewsDeskStatus,
    getSchemaReadiness: getNewsSchemaReadiness,
    refreshSecret: env.NEWS_REFRESH_SECRET,
  });
