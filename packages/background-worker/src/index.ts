import {
  claimNextBackgroundJob,
  completeBackgroundJob,
  enqueueBackgroundJob,
  failBackgroundJob,
  renewBackgroundJobLease,
} from "@acme/db/background-jobs";
import { db } from "@acme/db/client";
import {
  createDbNewsRepository,
  createOpenAIEmbeddingProvider,
  embedPendingNewsItems,
  refreshNewsSources,
} from "@acme/ingestion";

import { parseWorkerConfig } from "./config";
import { formatError } from "./errors";
import { createNewsEmbeddingRunner } from "./news-embedding";
import { runWithSignalHandlers } from "./process-lifecycle";
import { createJobProcessor } from "./processors";
import { runBackgroundWorker } from "./runtime";
import { sleep } from "./sleep";

const config = parseWorkerConfig(process.env);
const repository = createDbNewsRepository();
const embed = createNewsEmbeddingRunner({
  createProvider: createOpenAIEmbeddingProvider,
  embed: embedPendingNewsItems,
  environment: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL,
  },
  repository,
});
const processJob = createJobProcessor(
  { embedLimit: config.embedLimit },
  {
    embed,
    enqueue: (input) => enqueueBackgroundJob(db, input),
    refresh: () => refreshNewsSources({ repository }),
  },
);

console.info(
  `[background-worker] started workerId=${config.workerId} concurrency=${config.concurrency}`,
);

try {
  await runWithSignalHandlers({
    close: () => db.$client.end(),
    onSignal: (signal) => {
      console.info(`[background-worker] received ${signal}; draining`);
    },
    run: (signal) =>
      runBackgroundWorker({
        config,
        dependencies: {
          claim: (input) => claimNextBackgroundJob(db, input),
          complete: (input) => completeBackgroundJob(db, input),
          fail: (input) => failBackgroundJob(db, input),
          process: processJob,
          renew: (input) => renewBackgroundJobLease(db, input),
          sleep,
        },
        onClaimError: (error) => {
          console.error(
            `[background-worker] claim failed error=${formatError(error)}`,
          );
        },
        onJobError: (job, error) => {
          console.error(
            `[background-worker] job failed jobId=${job.id} error=${formatError(error)}`,
          );
        },
        signal,
      }),
    signalSource: process,
  });
} catch (error) {
  console.error(`[background-worker] fatal error=${formatError(error)}`);
  process.exitCode = 1;
} finally {
  console.info("[background-worker] stopped");
}
