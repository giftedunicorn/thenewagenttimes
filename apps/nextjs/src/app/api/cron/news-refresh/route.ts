import { enqueueBackgroundJob } from "@acme/db/background-jobs";
import { db } from "@acme/db/client";

import { env } from "~/env";
import { handleCronNewsRefreshRequest } from "./handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = (request: Request) =>
  handleCronNewsRefreshRequest({
    enqueue: (input) => enqueueBackgroundJob(db, input),
    expectedSecret: env.CRON_SECRET,
    now: () => new Date(),
    request,
  });
