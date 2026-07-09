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

type NewsEmbedNextStep =
  | "check-news-health"
  | "embed-news-stories"
  | "retry-news-embeddings";

const defaultNewsEmbedLimit = 25;
const maxNewsEmbedLimit = 100;
const newsEmbedCommands = {
  embed: "pnpm run news:embed:remote",
  health: "pnpm run news:health:remote",
} as const;

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

const getNewsEmbedNextStep = ({
  failed,
  embedded,
  limit,
}: NewsEmbedSummary & { limit: number }): NewsEmbedNextStep => {
  if (failed > 0) return "retry-news-embeddings";
  if (embedded >= limit) return "embed-news-stories";

  return "check-news-health";
};

const getNewsEmbedActionRequired = ({
  failed,
  nextStep,
}: {
  failed: number;
  nextStep: NewsEmbedNextStep;
}) => {
  switch (nextStep) {
    case "retry-news-embeddings":
      return [
        `Retry pnpm run news:embed:remote; ${failed} ${
          failed === 1 ? "story" : "stories"
        } failed to embed in this batch.`,
      ];
    case "embed-news-stories":
      return [
        "Run pnpm run news:embed:remote again; this batch filled the limit and more stories may remain.",
      ];
    case "check-news-health":
      return [
        "Run pnpm run news:health:remote to confirm semantic recommendations are ready.",
      ];
  }
};

const getNewsEmbedCommandForNextStep = (nextStep: NewsEmbedNextStep) =>
  nextStep === "check-news-health"
    ? newsEmbedCommands.health
    : newsEmbedCommands.embed;

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
  const nextStep = getNewsEmbedNextStep({ ...result, limit });

  return Response.json({
    actionRequired: getNewsEmbedActionRequired({
      failed: result.failed,
      nextStep,
    }),
    commands: {
      embed: newsEmbedCommands.embed,
      health: newsEmbedCommands.health,
      next: getNewsEmbedCommandForNextStep(nextStep),
    },
    ok: true,
    ready: nextStep === "check-news-health",
    nextStep,
    limit,
    ...result,
  });
};
