import type { ClaimedBackgroundJob } from "./job-runner";
import { runClaimedJob } from "./job-runner";
import { runWorkerLoop } from "./worker-loop";

interface ClaimBackgroundJobInput {
  leaseDurationMs: number;
  workerId: string;
}

interface FailBackgroundJobInput {
  error: unknown;
  jobId: string;
  lockedAt: Date;
  workerId: string;
}

interface CompleteBackgroundJobInput {
  jobId: string;
  lockedAt: Date;
  result: Record<string, unknown>;
  workerId: string;
}

interface RenewBackgroundJobLeaseInput {
  jobId: string;
  leaseDurationMs: number;
  lockedAt: Date;
  workerId: string;
}

export interface BackgroundWorkerDependencies<
  TJob extends ClaimedBackgroundJob,
> {
  claim: (input: ClaimBackgroundJobInput) => Promise<TJob | null>;
  complete: (input: CompleteBackgroundJobInput) => Promise<boolean>;
  fail: (input: FailBackgroundJobInput) => Promise<boolean>;
  process: (job: TJob) => Promise<Record<string, unknown>>;
  renew: (input: RenewBackgroundJobLeaseInput) => Promise<boolean>;
  sleep: (durationMs: number, signal: AbortSignal) => Promise<void>;
}

interface BackgroundWorkerRuntimeConfig {
  concurrency: number;
  errorSleepMs: number;
  heartbeatMs: number;
  idleSleepMs: number;
  leaseDurationMs: number;
  workerId: string;
}

interface RunBackgroundWorkerOptions<TJob extends ClaimedBackgroundJob> {
  config: BackgroundWorkerRuntimeConfig;
  dependencies: BackgroundWorkerDependencies<TJob>;
  onClaimError?: (error: unknown) => void;
  onJobError?: (job: TJob, error: unknown) => void;
  signal: AbortSignal;
}

export const runBackgroundWorker = <TJob extends ClaimedBackgroundJob>(
  options: RunBackgroundWorkerOptions<TJob>,
) =>
  runWorkerLoop({
    claim: () =>
      options.dependencies.claim({
        leaseDurationMs: options.config.leaseDurationMs,
        workerId: options.config.workerId,
      }),
    concurrency: options.config.concurrency,
    errorSleepMs: options.config.errorSleepMs,
    handleFailure: async (job, error) => {
      options.onJobError?.(job, error);

      if (job.lockedAt === null) {
        throw new Error(
          `Claimed background job is missing lockedAt: ${job.id}`,
        );
      }

      const persisted = await options.dependencies.fail({
        error,
        jobId: job.id,
        lockedAt: job.lockedAt,
        workerId: options.config.workerId,
      });

      if (!persisted) {
        throw new Error(
          `Background job failure persistence lost its lease: ${job.id}`,
        );
      }
    },
    idleSleepMs: options.config.idleSleepMs,
    onClaimError: options.onClaimError,
    process: (job) =>
      runClaimedJob(job, {
        dependencies: {
          complete: options.dependencies.complete,
          process: options.dependencies.process,
          renew: options.dependencies.renew,
          sleep: options.dependencies.sleep,
        },
        heartbeatMs: options.config.heartbeatMs,
        leaseDurationMs: options.config.leaseDurationMs,
        workerId: options.config.workerId,
      }),
    signal: options.signal,
    sleep: options.dependencies.sleep,
  });
