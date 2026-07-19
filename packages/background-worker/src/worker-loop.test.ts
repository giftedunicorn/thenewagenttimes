import { describe, expect, it } from "vitest";

import { runWorkerLoop } from "./worker-loop";

const deferred = () => {
  let resolvePromise: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
};

const waitUntil = async (condition: () => boolean) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) return;
    await Promise.resolve();
  }

  throw new Error("Condition was not reached");
};

describe("runWorkerLoop", () => {
  it("sleeps for the idle interval when no jobs are available", async () => {
    const abortController = new AbortController();
    const sleepDurations: number[] = [];
    let claimCount = 0;

    await runWorkerLoop({
      claim: () => {
        claimCount += 1;
        return Promise.resolve(null);
      },
      concurrency: 1,
      errorSleepMs: 15_000,
      handleFailure: () => Promise.resolve(),
      idleSleepMs: 5_000,
      process: () => Promise.resolve(),
      signal: abortController.signal,
      sleep: (durationMs) => {
        sleepDurations.push(durationMs);
        abortController.abort();
        return Promise.resolve();
      },
    });

    expect(claimCount).toBe(1);
    expect(sleepDurations).toEqual([5_000]);
  });

  it("reports the exact claim error before using the error interval", async () => {
    const abortController = new AbortController();
    const claimError = new Error("database unavailable");
    const claimErrors: unknown[] = [];
    const sleepDurations: number[] = [];
    const events: string[] = [];

    await runWorkerLoop({
      claim: () => Promise.reject(claimError),
      concurrency: 1,
      errorSleepMs: 15_000,
      handleFailure: () => Promise.resolve(),
      idleSleepMs: 5_000,
      onClaimError: (error) => {
        events.push("claim-error");
        claimErrors.push(error);
      },
      process: () => Promise.resolve(),
      signal: abortController.signal,
      sleep: (durationMs) => {
        events.push("sleep");
        sleepDurations.push(durationMs);
        abortController.abort();
        return Promise.resolve();
      },
    });

    expect(claimErrors).toEqual([claimError]);
    expect(sleepDurations).toEqual([15_000]);
    expect(events).toEqual(["claim-error", "sleep"]);
  });

  it("wakes an idle sleep promptly when the signal is aborted", async () => {
    const abortController = new AbortController();
    const sleepStarted = deferred();

    const loop = runWorkerLoop({
      claim: () => Promise.resolve(null),
      concurrency: 1,
      errorSleepMs: 15_000,
      handleFailure: () => Promise.resolve(),
      idleSleepMs: 5_000,
      process: () => Promise.resolve(),
      signal: abortController.signal,
      sleep: (durationMs, signal?: AbortSignal) => {
        expect(durationMs).toBe(5_000);
        sleepStarted.resolve();

        if (!signal) {
          return Promise.reject(new Error("sleep signal was not provided"));
        }

        return new Promise((_, reject) => {
          signal.addEventListener(
            "abort",
            () => {
              reject(new DOMException("Sleep aborted", "AbortError"));
            },
            { once: true },
          );
        });
      },
    });
    const loopResult = expect(loop).resolves.toBeUndefined();

    await sleepStarted.promise;
    abortController.abort();

    await loopResult;
  });

  it("ends cleanly for an AbortError from the aborted signal", async () => {
    const abortController = new AbortController();

    await expect(
      runWorkerLoop({
        claim: () => Promise.resolve(null),
        concurrency: 1,
        errorSleepMs: 15_000,
        handleFailure: () => Promise.resolve(),
        idleSleepMs: 5_000,
        process: () => Promise.resolve(),
        signal: abortController.signal,
        sleep: () => {
          abortController.abort();
          return Promise.reject(
            new DOMException("Sleep aborted", "AbortError"),
          );
        },
      }),
    ).resolves.toBeUndefined();
  });

  it("keeps unrelated sleep errors observable", async () => {
    const sleepError = new Error("timer unavailable");

    await expect(
      runWorkerLoop({
        claim: () => Promise.resolve(null),
        concurrency: 1,
        errorSleepMs: 15_000,
        handleFailure: () => Promise.resolve(),
        idleSleepMs: 5_000,
        process: () => Promise.resolve(),
        signal: new AbortController().signal,
        sleep: () => Promise.reject(sleepError),
      }),
    ).rejects.toBe(sleepError);
  });

  it("never claims or processes more than the configured concurrency", async () => {
    const abortController = new AbortController();
    const releases = [deferred(), deferred(), deferred()];
    const jobs = [1, 2, 3];
    let activeJobs = 0;
    let claimCount = 0;
    let maxActiveJobs = 0;

    const loop = runWorkerLoop({
      claim: () => {
        claimCount += 1;
        return Promise.resolve(jobs.shift() ?? null);
      },
      concurrency: 2,
      errorSleepMs: 15_000,
      handleFailure: () => Promise.resolve(),
      idleSleepMs: 5_000,
      process: async (job) => {
        activeJobs += 1;
        maxActiveJobs = Math.max(maxActiveJobs, activeJobs);
        await releases[job - 1]?.promise;
        activeJobs -= 1;
      },
      signal: abortController.signal,
      sleep: () => Promise.resolve(),
    });

    await waitUntil(() => activeJobs === 2);
    expect(claimCount).toBe(2);

    releases[0]?.resolve();
    await waitUntil(() => claimCount === 3 && activeJobs === 2);

    abortController.abort();
    releases[1]?.resolve();
    releases[2]?.resolve();
    await loop;

    expect(maxActiveJobs).toBe(2);
    expect(claimCount).toBe(3);
  });

  it("handles a processor error and continues with the next job", async () => {
    const abortController = new AbortController();
    const jobs = [1, 2];
    const failedJobs: { error: unknown; job: number }[] = [];
    const processedJobs: number[] = [];

    await runWorkerLoop({
      claim: () => Promise.resolve(jobs.shift() ?? null),
      concurrency: 1,
      errorSleepMs: 15_000,
      handleFailure: (job, error) => {
        failedJobs.push({ error, job });
        return Promise.resolve();
      },
      idleSleepMs: 5_000,
      process: (job) => {
        processedJobs.push(job);
        if (job === 1) return Promise.reject(new Error("processor failed"));
        abortController.abort();
        return Promise.resolve();
      },
      signal: abortController.signal,
      sleep: () => Promise.resolve(),
    });

    expect(processedJobs).toEqual([1, 2]);
    expect(failedJobs).toHaveLength(1);
    expect(failedJobs[0]?.job).toBe(1);
    expect(failedJobs[0]?.error).toEqual(new Error("processor failed"));
  });

  it("handles a synchronous processor throw and continues", async () => {
    const abortController = new AbortController();
    const jobs = [1, 2];
    const failedJobs: { error: unknown; job: number }[] = [];
    const processedJobs: number[] = [];

    await runWorkerLoop({
      claim: () => Promise.resolve(jobs.shift() ?? null),
      concurrency: 1,
      errorSleepMs: 15_000,
      handleFailure: (job, error) => {
        failedJobs.push({ error, job });
        return Promise.resolve();
      },
      idleSleepMs: 5_000,
      process: (job) => {
        processedJobs.push(job);
        if (job === 1) throw new Error("synchronous processor failure");
        abortController.abort();
        return Promise.resolve();
      },
      signal: abortController.signal,
      sleep: () => Promise.resolve(),
    });

    expect(processedJobs).toEqual([1, 2]);
    expect(failedJobs).toEqual([
      { error: new Error("synchronous processor failure"), job: 1 },
    ]);
  });

  it("drains active work before rejecting a failure-persistence error", async () => {
    const abortController = new AbortController();
    const persistenceError = new Error("failure persistence unavailable");
    const secondJobStarted = deferred();
    const releaseFailurePersistence = deferred();
    const releaseSecondJob = deferred();
    const jobs = [1, 2, 3];
    let claimCount = 0;
    let failureCount = 0;
    let loopStatus: "pending" | "rejected" | "resolved" = "pending";

    const loop = runWorkerLoop({
      claim: () => {
        claimCount += 1;
        return Promise.resolve(jobs.shift() ?? null);
      },
      concurrency: 2,
      errorSleepMs: 15_000,
      handleFailure: async () => {
        failureCount += 1;
        await releaseFailurePersistence.promise;
        throw persistenceError;
      },
      idleSleepMs: 5_000,
      process: (job) => {
        if (job === 1) return Promise.reject(new Error("processor failed"));
        secondJobStarted.resolve();
        return releaseSecondJob.promise;
      },
      signal: abortController.signal,
      sleep: () => Promise.resolve(),
    });
    void loop.then(
      () => {
        loopStatus = "resolved";
      },
      () => {
        loopStatus = "rejected";
      },
    );

    await secondJobStarted.promise;
    await waitUntil(() => failureCount === 1);
    releaseFailurePersistence.resolve();
    for (let turn = 0; turn < 10; turn += 1) {
      await Promise.resolve();
    }

    const statusBeforeDrain = loopStatus;
    expect(claimCount).toBe(2);

    releaseSecondJob.resolve();
    await expect(loop).rejects.toBe(persistenceError);

    expect(statusBeforeDrain).toBe("pending");
    expect(claimCount).toBe(2);
  });

  it("stops claiming after abort and drains active jobs", async () => {
    const abortController = new AbortController();
    const release = deferred();
    let claimCount = 0;
    let loopResolved = false;

    const loop = runWorkerLoop({
      claim: () => {
        claimCount += 1;
        return Promise.resolve(claimCount);
      },
      concurrency: 1,
      errorSleepMs: 15_000,
      handleFailure: () => Promise.resolve(),
      idleSleepMs: 5_000,
      process: () => release.promise,
      signal: abortController.signal,
      sleep: () => Promise.resolve(),
    }).then(() => {
      loopResolved = true;
    });

    await waitUntil(() => claimCount === 1);
    abortController.abort();
    await Promise.resolve();

    expect(claimCount).toBe(1);
    expect(loopResolved).toBe(false);

    release.resolve();
    await loop;

    expect(loopResolved).toBe(true);
  });

  it("does not claim when already aborted", async () => {
    const abortController = new AbortController();
    abortController.abort();
    let claimCount = 0;

    await runWorkerLoop({
      claim: () => {
        claimCount += 1;
        return Promise.resolve(null);
      },
      concurrency: 1,
      errorSleepMs: 15_000,
      handleFailure: () => Promise.resolve(),
      idleSleepMs: 5_000,
      process: () => Promise.resolve(),
      signal: abortController.signal,
      sleep: () => Promise.resolve(),
    });

    expect(claimCount).toBe(0);
  });
});
