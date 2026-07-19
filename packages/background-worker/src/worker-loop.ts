export interface WorkerLoopOptions<TJob> {
  claim: () => Promise<TJob | null>;
  concurrency: number;
  errorSleepMs: number;
  handleFailure: (job: TJob, error: unknown) => Promise<void>;
  idleSleepMs: number;
  onClaimError?: (error: unknown) => void;
  process: (job: TJob) => Promise<void>;
  signal: AbortSignal;
  sleep: (durationMs: number, signal: AbortSignal) => Promise<void>;
}

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

export const runWorkerLoop = async <TJob>(
  options: WorkerLoopOptions<TJob>,
): Promise<void> => {
  const activeJobs = new Set<Promise<void>>();
  const fatalState: { error: unknown; recorded: boolean } = {
    error: undefined,
    recorded: false,
  };

  const recordFatalError = (error: unknown) => {
    if (fatalState.recorded) return;
    fatalState.error = error;
    fatalState.recorded = true;
  };
  const isAbortRequested = () => options.signal.aborted;
  const shouldStop = () => isAbortRequested() || fatalState.recorded;

  const processJob = (job: TJob) => {
    const activeJob = Promise.resolve()
      .then(() => options.process(job))
      .catch(async (error: unknown) => {
        try {
          await options.handleFailure(job, error);
        } catch (failureError) {
          recordFatalError(failureError);
        }
      });
    activeJobs.add(activeJob);
    void activeJob.then(() => {
      activeJobs.delete(activeJob);
    });
  };

  const sleep = async (durationMs: number) => {
    try {
      await options.sleep(durationMs, options.signal);
    } catch (error) {
      if (isAbortRequested() && isAbortError(error)) return;
      recordFatalError(error);
    }
  };

  while (true) {
    if (shouldStop()) break;

    let claimFailed = false;
    let foundNoJob = false;

    while (activeJobs.size < options.concurrency) {
      if (shouldStop()) break;

      let job: TJob | null;

      try {
        job = await options.claim();
      } catch (error) {
        options.onClaimError?.(error);
        claimFailed = true;
        break;
      }

      if (job === null) {
        foundNoJob = true;
        break;
      }

      processJob(job);
    }

    if (shouldStop()) break;

    if (claimFailed) {
      await sleep(options.errorSleepMs);
      continue;
    }

    if (activeJobs.size === 0 && foundNoJob) {
      await sleep(options.idleSleepMs);
      continue;
    }

    if (activeJobs.size > 0) {
      await Promise.race(activeJobs);
    }
  }

  await Promise.allSettled(activeJobs);

  if (fatalState.recorded) throw fatalState.error;
};
