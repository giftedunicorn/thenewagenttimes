interface EnqueueResult {
  job: {
    id: string;
    status: "failed" | "queued" | "running" | "succeeded";
  };
  status: "duplicate" | "queued";
}

interface HandleCronNewsRefreshRequestInput {
  enqueue: (input: {
    dedupeKey: string;
    jobType: "news_refresh";
    payload: {
      requestedAt: string;
      trigger: "cron";
    };
  }) => Promise<EnqueueResult>;
  expectedSecret: string | undefined;
  now: () => Date;
  request: Request;
}

const readBearerToken = (request: Request) =>
  request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

const getScheduleWindow = (now: Date) => {
  const window = new Date(now.getTime());
  window.setUTCHours(now.getUTCHours() - (now.getUTCHours() % 2), 0, 0, 0);
  return window.toISOString();
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown background job failure";

export const handleCronNewsRefreshRequest = async ({
  enqueue,
  expectedSecret,
  now,
  request,
}: HandleCronNewsRefreshRequestInput) => {
  if (!expectedSecret) {
    return Response.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }

  if (readBearerToken(request) !== expectedSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const requestedAt = now();
    const window = getScheduleWindow(requestedAt);
    const result = await enqueue({
      dedupeKey: `news-refresh:${window}`,
      jobType: "news_refresh",
      payload: {
        requestedAt: requestedAt.toISOString(),
        trigger: "cron",
      },
    });

    return Response.json(
      {
        enqueueStatus: result.status,
        job: {
          id: result.job.id,
          status: result.job.status,
          type: "news_refresh",
        },
        ok: true,
      },
      { status: 202 },
    );
  } catch (error) {
    return Response.json(
      { error: getErrorMessage(error), ok: false },
      { status: 500 },
    );
  }
};
