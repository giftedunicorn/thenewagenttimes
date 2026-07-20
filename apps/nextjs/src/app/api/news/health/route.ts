import { env } from "~/env";
import { getNewsDeskStatus, getNewsSchemaReadiness } from "../../../_data/news";
import { handleNewsHealthRequest } from "./handler";

export const dynamic = "force-dynamic";

export const GET = () =>
  handleNewsHealthRequest({
    getDeskStatus: getNewsDeskStatus,
    getSchemaReadiness: getNewsSchemaReadiness,
    refreshSecret: env.CRON_SECRET,
  });
