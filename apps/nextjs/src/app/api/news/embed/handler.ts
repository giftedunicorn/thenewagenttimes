interface EnqueueResult {
  job: {
    id: string;
    status: "failed" | "queued" | "running" | "succeeded";
  };
  status: "duplicate" | "queued";
}

interface HandleNewsEmbedRequestInput {
  enqueue: (input: {
    dedupeKey: string;
    jobType: "news_embed";
    payload: {
      batch: number;
      limit: number;
    };
  }) => Promise<EnqueueResult>;
  expectedSecret: string | undefined;
  generateId: () => string;
  request: Request;
}

const defaultNewsEmbedLimit = 25;
const maxNewsEmbedLimit = 100;

const readRequestSecret = (request: Request) => {
  const authorization = request.headers.get("authorization");
  const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);

  return (
    bearerMatch?.[1] ??
    request.headers.get("x-news-refresh-secret") ??
    undefined
  );
};

const readNewsEmbedLimit = (request: Request) => {
  const value = new URL(request.url).searchParams.get("limit");
  const parsedLimit = Number(value ?? defaultNewsEmbedLimit);

  if (!Number.isFinite(parsedLimit)) return defaultNewsEmbedLimit;

  return Math.min(Math.max(Math.trunc(parsedLimit), 1), maxNewsEmbedLimit);
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown background job failure";

const readIdempotencyKey = (request: Request) => {
  const value = request.headers.get("idempotency-key")?.trim();
  if (!value) return undefined;
  return value;
};

export const handleNewsEmbedRequest = async ({
  enqueue,
  expectedSecret,
  generateId,
  request,
}: HandleNewsEmbedRequestInput) => {
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
      dedupeKey: `manual-news-embed:${requestId}`,
      jobType: "news_embed",
      payload: {
        batch: 0,
        limit: readNewsEmbedLimit(request),
      },
    });

    return Response.json(
      {
        enqueueStatus: result.status,
        job: {
          id: result.job.id,
          status: result.job.status,
          type: "news_embed",
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
