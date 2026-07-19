import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Cron } from "croner";

interface CronJobConfig {
  name: string;
  path: string;
  schedule: string;
}

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

const callJob = async (job: CronJobConfig): Promise<void> => {
  const startedAt = Date.now();

  try {
    const response = await fetch(new URL(job.path, baseUrl), {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(30_000),
    });
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(`${job.name} returned HTTP ${response.status}`);
    }

    console.info("[cron] tick", {
      body,
      durationMs: Date.now() - startedAt,
      job: job.name,
      status: response.status,
    });
  } catch (error) {
    console.error("[cron] error", {
      durationMs: Date.now() - startedAt,
      job: job.name,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

console.info("[cron] started", {
  baseUrl,
  jobs: config.jobs.map((job) => job.name),
});

for (const job of config.jobs) {
  new Cron(job.schedule, { name: job.name, timezone: "UTC" }, () => {
    void callJob(job);
  });

  console.info(`[cron] registered: ${job.name} (${job.schedule})`);
}
