import { describe, expect, it } from "vitest";

import type { ClaimedBackgroundJob } from "./job-runner";
import type { BackgroundWorkerDependencies } from "./runtime";
import { runBackgroundWorker } from "./runtime";

const lockedAt = new Date("2026-07-19T00:00:00.000Z");
const job: ClaimedBackgroundJob = {
  id: "11111111-1111-4111-8111-111111111111",
  lockedAt,
  lockExpiresAt: new Date("2026-07-19T00:05:00.000Z"),
};

const abortableSleep = (_durationMs: number, signal: AbortSignal) =>
  new Promise<void>((_, reject) => {
    signal.addEventListener(
      "abort",
      () => {
        reject(new DOMException("Sleep aborted", "AbortError"));
      },
      { once: true },
    );
  });

const createDependencies = (
  overrides: Partial<BackgroundWorkerDependencies<ClaimedBackgroundJob>> = {},
): BackgroundWorkerDependencies<ClaimedBackgroundJob> => ({
  claim: () => Promise.resolve(null),
  complete: () => Promise.resolve(true),
  fail: () => Promise.resolve(true),
  process: () => Promise.resolve({ processed: 1 }),
  renew: () => Promise.resolve(true),
  sleep: abortableSleep,
  ...overrides,
});

const config = {
  concurrency: 1,
  errorSleepMs: 15_000,
  heartbeatMs: 5_000,
  idleSleepMs: 5_000,
  leaseDurationMs: 30_000,
  workerId: "worker-one",
};

describe("runBackgroundWorker", () => {
  it("forwards claim errors to the runtime callback", async () => {
    const abortController = new AbortController();
    const claimError = new Error("database unavailable");
    const claimErrors: unknown[] = [];
    const sleepDurations: number[] = [];

    await runBackgroundWorker({
      config,
      dependencies: createDependencies({
        claim: () => Promise.reject(claimError),
        sleep: (durationMs) => {
          sleepDurations.push(durationMs);
          abortController.abort();
          return Promise.resolve();
        },
      }),
      onClaimError: (error) => {
        claimErrors.push(error);
      },
      signal: abortController.signal,
    });

    expect(claimErrors).toEqual([claimError]);
    expect(sleepDurations).toEqual([15_000]);
  });

  it("persists processor failures with the exact claim token", async () => {
    const abortController = new AbortController();
    const processorError = new Error("processor failed");
    const failInputs: unknown[] = [];
    let claimCount = 0;

    await runBackgroundWorker({
      config,
      dependencies: createDependencies({
        claim: () => {
          claimCount += 1;
          return Promise.resolve(claimCount === 1 ? job : null);
        },
        fail: (input) => {
          failInputs.push(input);
          abortController.abort();
          return Promise.resolve(true);
        },
        process: () => Promise.reject(processorError),
      }),
      signal: abortController.signal,
    });

    expect(failInputs).toEqual([
      {
        error: processorError,
        jobId: job.id,
        lockedAt,
        workerId: "worker-one",
      },
    ]);
  });

  it("treats failed failure persistence as fatal", async () => {
    let claimCount = 0;

    await expect(
      runBackgroundWorker({
        config,
        dependencies: createDependencies({
          claim: () => {
            claimCount += 1;
            return Promise.resolve(claimCount === 1 ? job : null);
          },
          fail: () => Promise.resolve(false),
          process: () => Promise.reject(new Error("processor failed")),
        }),
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("Background job failure persistence lost its lease");
    expect(claimCount).toBe(1);
  });
});
