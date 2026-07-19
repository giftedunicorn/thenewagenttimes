export interface ClaimedBackgroundJob {
  id: string;
  lockedAt: Date | null;
  lockExpiresAt: Date | null;
}

interface BackgroundJobOwnership {
  jobId: string;
  lockedAt: Date;
  workerId: string;
}

interface CompleteBackgroundJobInput extends BackgroundJobOwnership {
  result: Record<string, unknown>;
}

interface RenewBackgroundJobLeaseInput extends BackgroundJobOwnership {
  leaseDurationMs: number;
}

export interface JobRunnerDependencies<TJob extends ClaimedBackgroundJob> {
  complete: (input: CompleteBackgroundJobInput) => Promise<boolean>;
  process: (job: TJob) => Promise<Record<string, unknown>>;
  renew: (input: RenewBackgroundJobLeaseInput) => Promise<boolean>;
  sleep: (durationMs: number, signal: AbortSignal) => Promise<void>;
}

interface RunClaimedJobOptions<TJob extends ClaimedBackgroundJob> {
  dependencies: JobRunnerDependencies<TJob>;
  heartbeatMs: number;
  leaseDurationMs: number;
  workerId: string;
}

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

const getClaimToken = (job: ClaimedBackgroundJob) => {
  if (job.lockedAt === null || job.lockExpiresAt === null) {
    throw new Error(
      `Claimed background job is missing lease metadata: ${job.id}`,
    );
  }

  return job.lockedAt;
};

export const runClaimedJob = async <TJob extends ClaimedBackgroundJob>(
  job: TJob,
  options: RunClaimedJobOptions<TJob>,
): Promise<void> => {
  const lockedAt = getClaimToken(job);
  const heartbeatController = new AbortController();
  const isHeartbeatStopped = () => heartbeatController.signal.aborted;
  let heartbeatFailure: { error: unknown } | undefined;

  const heartbeat = (async () => {
    while (!isHeartbeatStopped()) {
      try {
        await options.dependencies.sleep(
          options.heartbeatMs,
          heartbeatController.signal,
        );
      } catch (error) {
        if (isHeartbeatStopped() && isAbortError(error)) {
          return;
        }

        heartbeatFailure = { error };
        return;
      }

      if (isHeartbeatStopped()) return;

      try {
        const renewed = await options.dependencies.renew({
          jobId: job.id,
          leaseDurationMs: options.leaseDurationMs,
          lockedAt,
          workerId: options.workerId,
        });

        if (!renewed) {
          throw new Error(`Background job lease renewal failed: ${job.id}`);
        }
      } catch (error) {
        heartbeatFailure = { error };
        return;
      }
    }
  })();

  let processFailure: { error: unknown } | undefined;
  let result: Record<string, unknown> | undefined;

  try {
    result = await options.dependencies.process(job);
  } catch (error) {
    processFailure = { error };
  } finally {
    heartbeatController.abort();
    await heartbeat;
  }

  if (heartbeatFailure) throw heartbeatFailure.error;
  if (processFailure) throw processFailure.error;

  const completed = await options.dependencies.complete({
    jobId: job.id,
    lockedAt,
    result: result ?? {},
    workerId: options.workerId,
  });

  if (!completed) {
    throw new Error(`Background job completion lost its lease: ${job.id}`);
  }
};
