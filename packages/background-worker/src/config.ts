import { randomUUID } from "node:crypto";

const DEFAULT_CONCURRENCY = 1;
const DEFAULT_EMBED_LIMIT = 25;
const DEFAULT_ERROR_SLEEP_MS = 15_000;
const DEFAULT_HEARTBEAT_MS = 60_000;
const DEFAULT_IDLE_SLEEP_MS = 5_000;
const DEFAULT_LEASE_DURATION_MS = 300_000;

export interface WorkerConfig {
  concurrency: number;
  embedLimit: number;
  errorSleepMs: number;
  heartbeatMs: number;
  idleSleepMs: number;
  leaseDurationMs: number;
  workerId: string;
}

interface ParseWorkerConfigOptions {
  generateWorkerId?: () => string;
}

type WorkerEnvironment = Readonly<Record<string, string | undefined>>;

const parseBoundedInteger = (
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) => {
  const parsed = value === undefined ? Number.NaN : Number(value.trim());

  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
};

export const parseWorkerConfig = (
  environment: WorkerEnvironment,
  options: ParseWorkerConfigOptions = {},
): WorkerConfig => {
  const leaseDurationMs = parseBoundedInteger(
    environment.BACKGROUND_WORKER_LEASE_MS,
    DEFAULT_LEASE_DURATION_MS,
    120_000,
    3_600_000,
  );
  const maximumHeartbeatMs = Math.max(5_000, Math.floor(leaseDurationMs / 3));
  const defaultHeartbeatMs = Math.min(DEFAULT_HEARTBEAT_MS, maximumHeartbeatMs);
  const rawWorkerId = environment.BACKGROUND_WORKER_ID?.trim();
  const configuredWorkerId = rawWorkerId === "" ? undefined : rawWorkerId;

  return {
    concurrency: DEFAULT_CONCURRENCY,
    embedLimit: parseBoundedInteger(
      environment.NEWS_EMBED_LIMIT,
      DEFAULT_EMBED_LIMIT,
      1,
      100,
    ),
    errorSleepMs: parseBoundedInteger(
      environment.BACKGROUND_WORKER_ERROR_MS,
      DEFAULT_ERROR_SLEEP_MS,
      100,
      60_000,
    ),
    heartbeatMs: parseBoundedInteger(
      environment.BACKGROUND_WORKER_HEARTBEAT_MS,
      defaultHeartbeatMs,
      5_000,
      maximumHeartbeatMs,
    ),
    idleSleepMs: parseBoundedInteger(
      environment.BACKGROUND_WORKER_IDLE_MS,
      DEFAULT_IDLE_SLEEP_MS,
      100,
      60_000,
    ),
    leaseDurationMs,
    workerId: configuredWorkerId ?? (options.generateWorkerId ?? randomUUID)(),
  };
};
