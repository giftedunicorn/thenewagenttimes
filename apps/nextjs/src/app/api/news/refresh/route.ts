import { randomUUID } from "node:crypto";

import { enqueueBackgroundJob } from "@acme/db/background-jobs";
import { db } from "@acme/db/client";

import { env } from "~/env";
import { handleNewsRefreshRequest } from "./handler";

export const dynamic = "force-dynamic";

export const POST = (request: Request) =>
  handleNewsRefreshRequest({
    enqueue: (input) => enqueueBackgroundJob(db, input),
    expectedSecret: env.NEWS_REFRESH_SECRET,
    generateId: randomUUID,
    now: () => new Date(),
    request,
  });
