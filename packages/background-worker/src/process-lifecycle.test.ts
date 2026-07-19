import { describe, expect, it } from "vitest";

import type { ProcessSignalSource, WorkerSignal } from "./process-lifecycle";
import { runWithSignalHandlers } from "./process-lifecycle";

const deferred = () => {
  let resolvePromise: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
};

class TestSignalSource implements ProcessSignalSource {
  private readonly listeners = new Map<WorkerSignal, Set<() => void>>();

  off(signal: WorkerSignal, listener: () => void) {
    this.listeners.get(signal)?.delete(listener);
  }

  once(signal: WorkerSignal, listener: () => void) {
    const listeners = this.listeners.get(signal) ?? new Set();
    listeners.add(listener);
    this.listeners.set(signal, listeners);
  }

  emit(signal: WorkerSignal) {
    for (const listener of this.listeners.get(signal) ?? []) {
      this.off(signal, listener);
      listener();
    }
  }

  listenerCount(signal: WorkerSignal) {
    return this.listeners.get(signal)?.size ?? 0;
  }
}

describe("runWithSignalHandlers", () => {
  it("aborts on a termination signal, drains, and only then closes", async () => {
    const activeJob = deferred();
    const runStarted = deferred();
    const signalSource = new TestSignalSource();
    const receivedSignals: WorkerSignal[] = [];
    let closed = false;

    const processRun = runWithSignalHandlers({
      close: () => {
        closed = true;
        return Promise.resolve();
      },
      onSignal: (signal) => {
        receivedSignals.push(signal);
      },
      run: async (signal) => {
        runStarted.resolve();
        await new Promise<void>((resolve) => {
          signal.addEventListener(
            "abort",
            () => {
              void activeJob.promise.then(resolve);
            },
            { once: true },
          );
        });
      },
      signalSource,
    });

    await runStarted.promise;
    signalSource.emit("SIGTERM");
    await Promise.resolve();

    expect(closed).toBe(false);
    expect(receivedSignals).toEqual(["SIGTERM"]);

    activeJob.resolve();
    await processRun;

    expect(closed).toBe(true);
    expect(signalSource.listenerCount("SIGINT")).toBe(0);
    expect(signalSource.listenerCount("SIGTERM")).toBe(0);
  });

  it("preserves a run error after closing and removing handlers", async () => {
    const runError = new Error("worker failed");
    const signalSource = new TestSignalSource();
    let closeCount = 0;

    await expect(
      runWithSignalHandlers({
        close: () => {
          closeCount += 1;
          return Promise.resolve();
        },
        run: () => Promise.reject(runError),
        signalSource,
      }),
    ).rejects.toBe(runError);

    expect(closeCount).toBe(1);
    expect(signalSource.listenerCount("SIGINT")).toBe(0);
    expect(signalSource.listenerCount("SIGTERM")).toBe(0);
  });

  it("throws the original close error after a successful run", async () => {
    const closeError = new Error("close failed");
    const signalSource = new TestSignalSource();

    await expect(
      runWithSignalHandlers({
        close: () => Promise.reject(closeError),
        run: () => Promise.resolve(),
        signalSource,
      }),
    ).rejects.toBe(closeError);

    expect(signalSource.listenerCount("SIGINT")).toBe(0);
    expect(signalSource.listenerCount("SIGTERM")).toBe(0);
  });

  it("aggregates run and close errors without masking either", async () => {
    const runError = new Error("worker failed");
    const closeError = new Error("close failed");
    const signalSource = new TestSignalSource();

    const result = runWithSignalHandlers({
      close: () => Promise.reject(closeError),
      run: () => Promise.reject(runError),
      signalSource,
    });

    await expect(result).rejects.toMatchObject({
      errors: [runError, closeError],
      message: "Background worker run and close both failed",
      name: "AggregateError",
    });
    expect(signalSource.listenerCount("SIGINT")).toBe(0);
    expect(signalSource.listenerCount("SIGTERM")).toBe(0);
  });
});
