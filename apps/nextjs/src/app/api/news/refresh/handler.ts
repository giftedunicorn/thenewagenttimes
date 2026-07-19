interface EnqueueResult {
  job: {
    id: string;
    status: "failed" | "queued" | "running" | "succeeded";
  };
  status: "duplicate" | "queued";
}

interface HandleNewsRefreshRequestInput {
  enqueue: (input: {
    dedupeKey: string;
    jobType: "news_refresh";
    payload: {
      requestedAt: string;
      trigger: "manual";
    };
  }) => Promise<EnqueueResult>;
  expectedSecret: string | undefined;
  generateId: () => string;
  now: () => Date;
  request: Request;
}

const readRequestSecret = (request: Request) => {
  const authorization = request.headers.get("authorization");
  const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);

  return (
    bearerMatch?.[1] ??
    request.headers.get("x-news-refresh-secret") ??
    undefined
  );
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown background job failure";

const readIdempotencyKey = (request: Request) => {
  const value = request.headers.get("idempotency-key")?.trim();
  if (!value) return undefined;
  return value;
};

export const handleNewsRefreshRequest = async ({
  enqueue,
  expectedSecret,
  generateId,
  now,
  request,
}: HandleNewsRefreshRequestInput) => {
  if (!expectedSecret) {
    return Response.json(
      { error: "NEWS_REFRESH_SECRET is not configured" },
      { status: 503 },
    );
  }

  if (readRequestSecret(request) !== expectedSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idempotencyKey = readIdempotencyKey(request);
  if (idempotencyKey && idempotencyKey.length > 200) {
    return Response.json(
      { error: "Idempotency-Key must be at most 200 characters" },
      { status: 400 },
    );
  }

  try {
    const requestId = idempotencyKey ?? generateId();
    const result = await enqueue({
      dedupeKey: `manual-news-refresh:${requestId}`,
      jobType: "news_refresh",
      payload: {
        requestedAt: now().toISOString(),
        trigger: "manual",
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
