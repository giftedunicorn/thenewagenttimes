import { enqueueBackgroundJob } from "@acme/db/background-jobs";
import { db } from "@acme/db/client";

import { enqueueScheduledNewsRefresh } from "./schedule";
import { startCronExecutionWatchdog } from "./watchdog";

const stopWatchdog = startCronExecutionWatchdog({
  onTimeout: () => {
    console.error("[cron] execution exceeded 60000ms; forcing exit");
    process.exit(1);
  },
  timeoutMs: 60_000,
});

try {
  const result = await enqueueScheduledNewsRefresh({
    enqueue: (input) => enqueueBackgroundJob(db, input),
    now: () => new Date(),
  });

  console.info(
    `[cron] status=${result.status} jobId=${result.jobId} window=${result.window}`,
  );
} catch (error) {
  console.error("[cron] enqueue failed", error);
  process.exitCode = 1;
} finally {
  try {
    await db.$client.end();
  } catch (error) {
    console.error("[cron] close failed", error);
    process.exitCode = 1;
  } finally {
    stopWatchdog();
  }
}
