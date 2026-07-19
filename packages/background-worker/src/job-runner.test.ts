import { describe, expect, it } from "vitest";

import type { ClaimedBackgroundJob, JobRunnerDependencies } from "./job-runner";
import { runClaimedJob } from "./job-runner";

const lockedAt = new Date("2026-07-19T00:00:00.000Z");

const createJob = (
  overrides: Partial<ClaimedBackgroundJob> = {},
): ClaimedBackgroundJob => ({
  id: "11111111-1111-4111-8111-111111111111",
  lockedAt,
  lockExpiresAt: new Date("2026-07-19T00:05:00.000Z"),
  ...overrides,
});

const deferred = <T>() => {
  let rejectPromise: (error: unknown) => void = () => undefined;
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    rejectPromise = reject;
    resolvePromise = resolve;
  });

  return { promise, reject: rejectPromise, resolve: resolvePromise };
};

const waitUntil = async (condition: () => boolean) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) return;
    await Promise.resolve();
  }

  throw new Error("Condition was not reached");
};

const createAbortableHeartbeatSleep = (immediateSleeps = 0) => {
  let sleepCount = 0;

  return {
    get sleepCount() {
      return sleepCount;
    },
    sleep: (_durationMs: number, signal: AbortSignal) => {
      sleepCount += 1;
      if (sleepCount <= immediateSleeps) return Promise.resolve();

      return new Promise<void>((_, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            reject(new DOMException("Sleep aborted", "AbortError"));
          },
          { once: true },
        );
      });
    },
  };
};

const createDependencies = (
  overrides: Partial<JobRunnerDependencies<ClaimedBackgroundJob>> = {},
): JobRunnerDependencies<ClaimedBackgroundJob> => ({
  complete: () => Promise.resolve(true),
  process: () => Promise.resolve({ processed: 1 }),
  renew: () => Promise.resolve(true),
  sleep: createAbortableHeartbeatSleep().sleep,
  ...overrides,
});

describe("runClaimedJob", () => {
  it("renews with the claim token and stops the heartbeat before completion", async () => {
    const job = createJob();
    const processor = deferred<Record<string, unknown>>();
    const heartbeatSleep = createAbortableHeartbeatSleep(1);
    const renewInputs: unknown[] = [];
    const completeInputs: unknown[] = [];
    const result = { processed: 1 };

    const runningJob = runClaimedJob(job, {
      heartbeatMs: 5_000,
      leaseDurationMs: 30_000,
      workerId: "worker-one",
      dependencies: createDependencies({
        complete: (input) => {
          completeInputs.push(input);
          return Promise.resolve(true);
        },
        process: () => processor.promise,
        renew: (input) => {
          renewInputs.push(input);
          return Promise.resolve(true);
        },
        sleep: heartbeatSleep.sleep,
      }),
    });

    await waitUntil(
      () => renewInputs.length === 1 && heartbeatSleep.sleepCount === 2,
    );
    processor.resolve(result);
    await runningJob;

    expect(renewInputs).toEqual([
      {
        jobId: job.id,
        leaseDurationMs: 30_000,
        lockedAt,
        workerId: "worker-one",
      },
    ]);
    expect(completeInputs).toEqual([
      {
        jobId: job.id,
        lockedAt,
        result,
        workerId: "worker-one",
      },
    ]);
    expect(heartbeatSleep.sleepCount).toBe(2);
  });

  it("waits for the processor and prevents completion when renewal returns false", async () => {
    const processor = deferred<Record<string, unknown>>();
    const completeInputs: unknown[] = [];
    let renewCount = 0;
    let status: "pending" | "rejected" | "resolved" = "pending";

    const runningJob = runClaimedJob(createJob(), {
      heartbeatMs: 5_000,
      leaseDurationMs: 30_000,
      workerId: "worker-one",
      dependencies: createDependencies({
        complete: (input) => {
          completeInputs.push(input);
          return Promise.resolve(true);
        },
        process: () => processor.promise,
        renew: () => {
          renewCount += 1;
          return Promise.resolve(false);
        },
        sleep: createAbortableHeartbeatSleep(1).sleep,
      }),
    });
    void runningJob.then(
      () => {
        status = "resolved";
      },
      () => {
        status = "rejected";
      },
    );

    await waitUntil(() => renewCount === 1);
    expect(status).toBe("pending");
    expect(completeInputs).toEqual([]);

    processor.resolve({ processed: 1 });
    await expect(runningJob).rejects.toThrow(
      "Background job lease renewal failed",
    );
    expect(completeInputs).toEqual([]);
  });

  it("records a renewal error and rejects only after the processor settles", async () => {
    const processor = deferred<Record<string, unknown>>();
    const renewalError = new Error("database unavailable");
    let renewCount = 0;
    let rejected = false;

    const runningJob = runClaimedJob(createJob(), {
      heartbeatMs: 5_000,
      leaseDurationMs: 30_000,
      workerId: "worker-one",
      dependencies: createDependencies({
        process: () => processor.promise,
        renew: () => {
          renewCount += 1;
          return Promise.reject(renewalError);
        },
        sleep: createAbortableHeartbeatSleep(1).sleep,
      }),
    });
    void runningJob.catch(() => {
      rejected = true;
    });

    await waitUntil(() => renewCount === 1);
    expect(rejected).toBe(false);

    processor.resolve({ processed: 1 });
    await expect(runningJob).rejects.toBe(renewalError);
  });

  it("rejects a processor failure without completing the job", async () => {
    const processorError = new Error("processor failed");
    const completeInputs: unknown[] = [];

    await expect(
      runClaimedJob(createJob(), {
        heartbeatMs: 5_000,
        leaseDurationMs: 30_000,
        workerId: "worker-one",
        dependencies: createDependencies({
          complete: (input) => {
            completeInputs.push(input);
            return Promise.resolve(true);
          },
          process: () => Promise.reject(processorError),
        }),
      }),
    ).rejects.toBe(processorError);
    expect(completeInputs).toEqual([]);
  });

  it("rejects when completion no longer owns the lease", async () => {
    await expect(
      runClaimedJob(createJob(), {
        heartbeatMs: 5_000,
        leaseDurationMs: 30_000,
        workerId: "worker-one",
        dependencies: createDependencies({
          complete: () => Promise.resolve(false),
        }),
      }),
    ).rejects.toThrow("Background job completion lost its lease");
  });

  it.each([{ lockedAt: null }, { lockExpiresAt: null }])(
    "rejects a claim without complete lease metadata: %o",
    async (overrides) => {
      await expect(
        runClaimedJob(createJob(overrides), {
          heartbeatMs: 5_000,
          leaseDurationMs: 30_000,
          workerId: "worker-one",
          dependencies: createDependencies(),
        }),
      ).rejects.toThrow("Claimed background job is missing lease metadata");
    },
  );
});
