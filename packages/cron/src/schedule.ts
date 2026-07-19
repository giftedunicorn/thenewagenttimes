interface ScheduledNewsRefreshInput {
  dedupeKey: string;
  jobType: "news_refresh";
  payload: {
    requestedAt: string;
    trigger: "cron";
  };
}

interface EnqueueResult {
  job: {
    id: string;
  };
  status: "queued" | "duplicate";
}

interface EnqueueScheduledNewsRefreshDependencies {
  enqueue: (input: ScheduledNewsRefreshInput) => Promise<EnqueueResult>;
  now: () => Date;
}

export const getNewsRefreshScheduleWindow = (now: Date) => {
  const window = new Date(now.getTime());
  window.setUTCHours(now.getUTCHours() - (now.getUTCHours() % 2), 0, 0, 0);
  return window;
};

export const enqueueScheduledNewsRefresh = async ({
  enqueue,
  now,
}: EnqueueScheduledNewsRefreshDependencies) => {
  const requestedAt = now();
  const window = getNewsRefreshScheduleWindow(requestedAt).toISOString();
  const dedupeKey = `news-refresh:${window}`;
  const result = await enqueue({
    dedupeKey,
    jobType: "news_refresh",
    payload: {
      requestedAt: requestedAt.toISOString(),
      trigger: "cron",
    },
  });

  return {
    dedupeKey,
    jobId: result.job.id,
    status: result.status,
    window,
  };
};
