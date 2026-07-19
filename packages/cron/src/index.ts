import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Cron } from "croner";

import type { CronJobConfig } from "./dispatcher";
import { dispatchCronJob } from "./dispatcher";

interface CronConfig {
  baseUrl: string;
  jobs: CronJobConfig[];
}

const configPath = resolve(process.env.CRON_CONFIG_PATH ?? "cron.json");
const config = JSON.parse(readFileSync(configPath, "utf8")) as CronConfig;
const baseUrl = process.env.CRON_BASE_URL ?? config.baseUrl;
const secret = process.env.CRON_SECRET;

if (!secret) {
  throw new Error("CRON_SECRET is required");
}

console.info("[cron] started", {
  baseUrl,
  jobs: config.jobs.map((job) => job.name),
});

for (const job of config.jobs) {
  new Cron(job.schedule, { name: job.name, timezone: "UTC" }, async () => {
    const startedAt = Date.now();

    try {
      const result = await dispatchCronJob({
        baseUrl,
        job,
        secret,
      });

      console.info("[cron] tick", {
        body: result.body,
        durationMs: Date.now() - startedAt,
        job: job.name,
        status: result.status,
      });
    } catch (error) {
      console.error("[cron] error", {
        durationMs: Date.now() - startedAt,
        job: job.name,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  console.info(`[cron] registered: ${job.name} (${job.schedule})`);
}
