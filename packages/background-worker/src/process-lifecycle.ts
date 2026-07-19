export type WorkerSignal = "SIGINT" | "SIGTERM";

type SignalListener = () => void;

export interface ProcessSignalSource {
  off: (signal: WorkerSignal, listener: SignalListener) => void;
  once: (signal: WorkerSignal, listener: SignalListener) => void;
}

interface RunWithSignalHandlersOptions {
  close: () => Promise<void>;
  onSignal?: (signal: WorkerSignal) => void;
  run: (signal: AbortSignal) => Promise<void>;
  signalSource: ProcessSignalSource;
}

export const runWithSignalHandlers = async (
  options: RunWithSignalHandlersOptions,
): Promise<void> => {
  const abortController = new AbortController();
  const handleSignal = (signal: WorkerSignal) => {
    if (abortController.signal.aborted) return;
    options.onSignal?.(signal);
    abortController.abort();
  };
  const handlers: Record<WorkerSignal, SignalListener> = {
    SIGINT: () => {
      handleSignal("SIGINT");
    },
    SIGTERM: () => {
      handleSignal("SIGTERM");
    },
  };

  options.signalSource.once("SIGINT", handlers.SIGINT);
  options.signalSource.once("SIGTERM", handlers.SIGTERM);

  let runFailure: { error: unknown } | undefined;

  try {
    await options.run(abortController.signal);
  } catch (error) {
    runFailure = { error };
  }

  options.signalSource.off("SIGINT", handlers.SIGINT);
  options.signalSource.off("SIGTERM", handlers.SIGTERM);

  let closeFailure: { error: unknown } | undefined;

  try {
    await options.close();
  } catch (error) {
    closeFailure = { error };
  }

  if (runFailure && closeFailure) {
    throw new AggregateError(
      [runFailure.error, closeFailure.error],
      "Background worker run and close both failed",
    );
  }

  if (runFailure) throw runFailure.error;
  if (closeFailure) throw closeFailure.error;
};
