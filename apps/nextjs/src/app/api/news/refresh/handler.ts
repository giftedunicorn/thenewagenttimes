export interface NewsRefreshSummary {
  sourcesSeeded: number;
  sourcesAttempted: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  itemsSeen: number;
  itemsCreated: number;
  itemsUpdated: number;
  results: readonly unknown[];
}

interface HandleNewsRefreshRequestInput {
  expectedSecret: string | undefined;
  refresh: () => Promise<NewsRefreshSummary>;
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

export const handleNewsRefreshRequest = async ({
  expectedSecret,
  refresh,
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

  const result = await refresh();

  return Response.json({
    ok: true,
    ...result,
  });
};
