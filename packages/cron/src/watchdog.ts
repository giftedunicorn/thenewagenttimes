interface StartCronExecutionWatchdogInput {
  onTimeout: () => void;
  timeoutMs: number;
}

export const startCronExecutionWatchdog = ({
  onTimeout,
  timeoutMs,
}: StartCronExecutionWatchdogInput) => {
  const timeout = setTimeout(onTimeout, timeoutMs);

  return () => {
    clearTimeout(timeout);
  };
};
