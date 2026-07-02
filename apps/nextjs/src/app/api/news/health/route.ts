import { env } from "~/env";
import { getNewsDeskStatus } from "../../../_data/news";
import { handleNewsHealthRequest } from "./handler";

export const dynamic = "force-dynamic";

export const GET = () =>
  handleNewsHealthRequest({
    getDeskStatus: getNewsDeskStatus,
    refreshSecret: env.NEWS_REFRESH_SECRET,
  });
