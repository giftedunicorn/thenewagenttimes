export interface NewsEmbedSummary {
  embedded: number;
  failed: number;
}

interface HandleNewsEmbedRequestInput {
  apiKey: string | undefined;
  embed: (input: { limit: number }) => Promise<NewsEmbedSummary>;
  expectedSecret: string | undefined;
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

const getNewsEmbedErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown news embedding failure";

export const handleNewsEmbedRequest = async ({
  apiKey,
  embed,
  expectedSecret,
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

  if (!apiKey?.trim()) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 503 },
    );
  }

  const limit = readNewsEmbedLimit(request);
  let result: NewsEmbedSummary;

  try {
    result = await embed({ limit });
  } catch (error) {
    return Response.json(
      { error: getNewsEmbedErrorMessage(error), ok: false },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    limit,
    ...result,
  });
};
